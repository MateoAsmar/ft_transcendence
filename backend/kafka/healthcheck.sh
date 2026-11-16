#!/bin/sh
set -e

cub kafka-ready -b localhost:9092 1 5
