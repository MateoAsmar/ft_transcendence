#!/bin/sh
set -e

node <<'NODE'
const net = require('net');
const port = Number(process.env.FRIENDS_GRPC_PORT || 50052);
const socket = net.connect({ host: '127.0.0.1', port }, () => {
  socket.end();
  process.exit(0);
});
socket.on('error', () => {
  process.exit(1);
});
setTimeout(() => {
  socket.destroy();
  process.exit(1);
}, 5000);
NODE
