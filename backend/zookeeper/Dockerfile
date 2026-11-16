FROM confluentinc/cp-zookeeper:7.5.3

COPY --chmod=0555 backend/zookeeper/healthcheck.sh /healthcheck.sh

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=5 CMD ["/bin/sh", "/healthcheck.sh"]
