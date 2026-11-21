/** Loaded only in the bounded OpenPencil subprocess, before the upstream CLI. */
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import http2 from 'node:http2';
import net from 'node:net';
import dgram from 'node:dgram';
import { syncBuiltinESMExports } from 'node:module';

const blocked = [];
const deny = method => function deniedNetwork() {
  blocked.push(method);
  throw new Error('Daftar design handoffs run offline; network access is disabled.');
};
globalThis.fetch = deny('fetch');
globalThis.WebSocket = class OfflineWebSocket { constructor() { deny('WebSocket')(); } };
http.request = deny('http.request'); http.get = deny('http.get');
https.request = deny('https.request'); https.get = deny('https.get');
http2.connect = deny('http2.connect');
net.connect = deny('net.connect'); net.createConnection = deny('net.createConnection');
net.Socket.prototype.connect = deny('net.Socket.connect');
dgram.createSocket = deny('dgram.createSocket');
syncBuiltinESMExports();
process.once('exit', () => {
  const file = process.env.DAFTAR_DESIGN_NETWORK_RECEIPT;
  if (file) fs.writeFileSync(file, JSON.stringify({ attempts: blocked.length, methods: [...new Set(blocked)] }));
});
