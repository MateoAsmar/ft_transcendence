FROM alpine:3.18

# install sqlite
RUN apk add --no-cache sqlite dos2unix

WORKDIR /data

COPY schema.sql /database/schema.sql
COPY init.sh /database/init.sh
COPY healthcheck.sh /healthcheck.sh
RUN dos2unix /database/init.sh /healthcheck.sh
RUN chmod +x /database/init.sh
RUN chmod +x /healthcheck.sh

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=5 CMD ["/bin/sh", "/healthcheck.sh"]

# Run init script on container start
CMD ["/database/init.sh"]
