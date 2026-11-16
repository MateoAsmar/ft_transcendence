#!/bin/sh
set -e
CERT_DIR=/etc/nginx/certs
if [ ! -f "$CERT_DIR/fullchain.pem" ] || [ ! -f "$CERT_DIR/privkey.pem" ]; then
  echo "Generating self-signed certificate with Subject Alternative Names..."
  mkdir -p "$CERT_DIR"
  
  # Get the Docker gateway IP (for internal Docker networking)
  GATEWAY_IP=$(ip route | grep -E '^default' | awk '{print $3}')
  
  # Get the container hostname
  CONTAINER_HOSTNAME=$(hostname)
  
  # Dynamically detect the host machine IP from the container's routing table
  # This gets the IP address that the container uses to reach external networks
  HOST_IP=$(ip route get 1.1.1.1 | grep -oP 'src \K[^ ]+' || echo "127.0.0.1")
  
  # Create OpenSSL config with SAN including IP addresses only
  cat > "$CERT_DIR/openssl.cnf" <<EOF
[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn
req_extensions = v3_req

[dn]
C=US
ST=State
L=City
O=Org
OU=Dev
CN=localhost

[v3_req]
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = ${CONTAINER_HOSTNAME}
IP.1 = 127.0.0.1
IP.2 = ${GATEWAY_IP}
IP.3 = ${HOST_IP}
EOF

  openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout "$CERT_DIR/privkey.pem" -out "$CERT_DIR/fullchain.pem" \
    -config "$CERT_DIR/openssl.cnf" -extensions v3_req
  
  chmod 644 "$CERT_DIR/fullchain.pem" "$CERT_DIR/privkey.pem"
  rm "$CERT_DIR/openssl.cnf"
  echo "Certificate generated for: localhost, ${CONTAINER_HOSTNAME}, 127.0.0.1, ${GATEWAY_IP}, ${HOST_IP}"
fi

# If certs exist, verify they are valid PEM files; if verification fails, regenerate
if [ -f "$CERT_DIR/fullchain.pem" ] && [ -f "$CERT_DIR/privkey.pem" ]; then
  if ! openssl x509 -in "$CERT_DIR/fullchain.pem" -noout >/dev/null 2>&1; then
    echo "Existing certificate is invalid — regenerating"
    rm -f "$CERT_DIR/fullchain.pem" "$CERT_DIR/privkey.pem"
    mkdir -p "$CERT_DIR"
    
    # Get the Docker gateway IP (for internal Docker networking)
    GATEWAY_IP=$(ip route | grep -E '^default' | awk '{print $3}')
    
    # Get the container hostname
    CONTAINER_HOSTNAME=$(hostname)
    
    # Dynamically detect the host machine IP from the container's routing table
    HOST_IP=$(ip route get 1.1.1.1 | grep -oP 'src \K[^ ]+' || echo "127.0.0.1")
    
    # Create OpenSSL config with SAN including IP addresses only
    cat > "$CERT_DIR/openssl.cnf" <<EOF
[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn
req_extensions = v3_req

[dn]
C=US
ST=State
L=City
O=Org
OU=Dev
CN=localhost

[v3_req]
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = ${CONTAINER_HOSTNAME}
IP.1 = 127.0.0.1
IP.2 = ${GATEWAY_IP}
IP.3 = ${HOST_IP}
EOF

    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
      -keyout "$CERT_DIR/privkey.pem" -out "$CERT_DIR/fullchain.pem" \
      -config "$CERT_DIR/openssl.cnf" -extensions v3_req
    
    chmod 644 "$CERT_DIR/fullchain.pem" "$CERT_DIR/privkey.pem"
    rm "$CERT_DIR/openssl.cnf"
    echo "Certificate regenerated for: localhost, ${CONTAINER_HOSTNAME}, 127.0.0.1, ${GATEWAY_IP}, ${HOST_IP}"
  fi
fi

# Wait for backend and frontend hostnames to resolve (prevents nginx failing on startup)
wait_for_host() {
  host="$1"
  tries=0
  until nslookup "$host" >/dev/null 2>&1; do
    tries=$((tries+1))
    if [ "$tries" -gt 30 ]; then
      echo "Timed out waiting for host $host to resolve"
      return 1
    fi
    echo "Waiting for $host to resolve... ($tries)"
    sleep 1
  done
}

wait_for_host frontend || echo "frontend DNS not available yet"
wait_for_host api-gateway || echo "api-gateway DNS not available yet"

exec "$@"
