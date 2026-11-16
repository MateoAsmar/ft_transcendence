#!/bin/sh
set -e

wget --spider --quiet --no-check-certificate https://127.0.0.1 2>/dev/null || exit 1

exit 0
