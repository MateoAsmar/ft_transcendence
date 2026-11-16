This directory contains self-signed certificates generated for local development only.
If you need to recreate them locally, run the openssl command below (requires openssl installed):

# Linux / macOS / WSL
openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout privkey.pem -out fullchain.pem -subj "/C=US/ST=State/L=City/O=Org/OU=Dev/CN=localhost"

# On Windows make sure to run in Git Bash / WSL and update paths accordingly.

Note: Browsers may warn because these are self-signed certs. For a production deployment, obtain certificates from a trusted CA (e.g., Let's Encrypt).