#!/bin/sh
set -e

PORT="${PORT:-3000}"

node <<'NODE'
const http = require('http');
const port = Number(process.env.PORT || 3000);
const req = http.request({ host: '127.0.0.1', port, path: '/api/ping', timeout: 5000 }, (res) => {
  process.exit(res.statusCode && res.statusCode < 500 ? 0 : 1);
});
req.on('error', () => process.exit(1));
req.end();
NODE
