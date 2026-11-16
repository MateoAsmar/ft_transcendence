#!/bin/sh
set -e

if [ -f "/data/ft_transcendence.db" ]; then
  exit 0
fi

exit 1
