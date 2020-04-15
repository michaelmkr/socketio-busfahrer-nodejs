const app = require('express')();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const port = process.env.PORT || 3000;

const Lobby = require('./Lobby.js');

io.on('connection', (socket) => {
    socket.on('create-lobby', () => {
        const nspString = Math.random().toString(36).substring(2, 6) + Math.random().toString(36).substring(2, 6);
        const namespace = io.of(nspString);
        console.log('creating new lobby: ' + nspString);
        const lobby = new Lobby(123, namespace);
        lobby.listen();
    });
});

http.listen(port, function () {
    console.log('listening on *:' + port);
});
