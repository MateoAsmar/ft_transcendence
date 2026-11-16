FROM nginx:1.25-alpine

# Copy nginx configuration and certificates
COPY nginx.conf /etc/nginx/nginx.conf
COPY certs /etc/nginx/certs
COPY entrypoint.sh /entrypoint.sh
COPY healthcheck.sh /healthcheck.sh
# Install small DNS toolset (nslookup) so entrypoint can wait for service hostnames
RUN apk add --no-cache bind-tools
# Install openssl so we can generate self-signed certs at container start
RUN apk add --no-cache openssl
# Install dos2unix to fix Windows line endings
RUN apk add --no-cache dos2unix
RUN dos2unix /entrypoint.sh /healthcheck.sh
RUN chmod +x /entrypoint.sh
RUN chmod +x /healthcheck.sh

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=5 CMD ["/bin/sh", "-c", "/healthcheck.sh"]

EXPOSE 443

ENTRYPOINT ["/entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
