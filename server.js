const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

let players = {};
let catcherId = null;
const gameDuration = 120000; // 2 minutes

io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);

    players[socket.id] = {
        id: socket.id,
        x: Math.random() * 800,
        y: Math.random() * 600,
        speed: 2,
        target: { x: 0, y: 0 }
    };

    if (!catcherId || Object.keys(players).length === 1) {
        catcherId = socket.id;
        io.to(catcherId).emit('youAreCatcher');
    }

    io.emit('updatePlayers', { players, catcherId });

    socket.on('setTarget', (data) => {
        if (players[socket.id]) {
            players[socket.id].target = data;
        }
    });

    socket.on('tag', (id) => {
        if (socket.id === catcherId && players[id]) {
            catcherId = id;
            io.to(catcherId).emit('youAreCatcher');
        }
    });

    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);
        delete players[socket.id];
        if (socket.id === catcherId) {
            const playerIds = Object.keys(players);
            if (playerIds.length > 0) {
                catcherId = playerIds[Math.floor(Math.random() * playerIds.length)];
                io.to(catcherId).emit('youAreCatcher');
            } else {
                catcherId = null;
            }
        }
        io.emit('updatePlayers', { players, catcherId });
    });
});

function updatePlayerPositions() {
    for (let id in players) {
        const player = players[id];
        const dx = player.target.x - player.x;
        const dy = player.target.y - player.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > player.speed) {
            player.x += dx / distance * player.speed;
            player.y += dy / distance * player.speed;
        }
    }
    io.emit('updatePlayers', { players, catcherId });
}

setInterval(updatePlayerPositions, 1000 / 60); // Update 60 times per second

setTimeout(() => {
    io.emit('gameOver', { winner: catcherId });
}, gameDuration);

app.use(express.static('public'));

server.listen(3000, () => {
    console.log('Server is running on port 3000');
});