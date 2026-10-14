// Prisma Studio binds strictly to 127.0.0.1 by default in Prisma 7 CLI.
// When running inside a Docker container, binding to 127.0.0.1 prevents port
// forwarding from host. This script intercepts listen() to bind to 0.0.0.0.
const net = require('net');

const origListen = net.Server.prototype.listen;
net.Server.prototype.listen = function (...args) {
  if (args[1] === '127.0.0.1') {
    args[1] = '0.0.0.0';
  }
  return origListen.apply(this, args);
};

process.argv = [
  'node',
  'prisma',
  'studio',
  '--port',
  '5555',
  '--browser',
  'none',
];
require('/usr/src/app/node_modules/prisma/build/cli.js');
