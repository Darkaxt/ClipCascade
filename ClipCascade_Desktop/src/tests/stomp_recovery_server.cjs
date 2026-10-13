const { Server: WebSocketServer } = require('../../../ClipCascade_Mobile/src/node_modules/ws');
const readline = require('node:readline');
const server = new WebSocketServer({ port: 0, host: '127.0.0.1' });
server.on('listening', () => console.log(server.address().port));
server.on('connection', socket => {
  socket.on('message', data => {
    const frame = data.toString();
    if (frame.startsWith('CONNECT\n')) {
      socket.send('CONNECTED\nversion:1.1\nheart-beat:0,0\n\n\0');
    } else if (frame.startsWith('SEND\n')) {
      console.log('sent');
    }
  });
});
readline.createInterface({ input: process.stdin }).on('line', command => {
  if (command === 'drop') {
    for (const socket of server.clients) socket.terminate();
  } else if (command === 'stop') {
    for (const socket of server.clients) socket.terminate();
    server.close();
    process.stdin.destroy();
  }
});
