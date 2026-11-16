FROM confluentinc/cp-kafka:7.5.3

COPY --chmod=0555 backend/kafka/healthcheck.sh /healthcheck.sh

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=5 CMD ["/bin/sh", "/healthcheck.sh"]
