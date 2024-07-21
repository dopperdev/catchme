const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

let players = [];
let catcherId = null;
let timeLeft = 60;
const catchCooldown = 1000; // Cooldown period in milliseconds
let lastCatchTime = 0; // Single cooldown timer for catching

function assignNewCatcher() {
    const availablePlayers = players.filter(p => p.id !== catcherId);
    if (availablePlayers.length > 0) {
        catcherId = availablePlayers[Math.floor(Math.random() * availablePlayers.length)].id;
        io.emit('updatePlayers', players);
    } else {
        catcherId = null; // No catcher if no players available
    }
}

function handleDisconnection(socketId) {
    console.log('Player disconnected:', socketId);

    // Remove the disconnected player
    players = players.filter(player => player.id !== socketId);

    // If the disconnected player was the catcher, assign a new catcher
    if (socketId === catcherId) {
        assignNewCatcher();
    }

    // Notify all clients about the updated player list
    io.emit('updatePlayers', players);
}

io.on('connection', (socket) => {
    console.log('New player connected:', socket.id);

    // Add new player
    const newPlayer = {
        id: socket.id,
        isCatcher: false,
        x: Math.random() * 800,
        y: Math.random() * 600
    };
    players.push(newPlayer);

    // Assign a catcher if needed
    if (catcherId === null && players.length === 1) {
        catcherId = socket.id;
        newPlayer.isCatcher = true;
    }

    io.emit('updatePlayers', players);

    socket.on('move', (vector) => {
        const player = players.find(p => p.id === socket.id);
        if (player && vector) {
            player.x = Math.max(0, Math.min(800, player.x + vector.x));
            player.y = Math.max(0, Math.min(600, player.y + vector.y));
            checkCatching(player);
            io.emit('updatePlayers', players);
        }
    });

    socket.on('stopMoving', () => {
        // Handle stopping movement if needed
    });

    socket.on('disconnect', () => {
        handleDisconnection(socket.id);
    });

    if (catcherId === null && players.length > 0) {
        assignNewCatcher();

        const countdown = setInterval(() => {
            timeLeft--;
            io.emit('updateTimer', timeLeft);
            if (timeLeft <= 0) {
                clearInterval(countdown);
                io.emit('endRound', { winner: catcherId });
                catcherId = null;
                timeLeft = 60;
            }
        }, 1000);
    }
});

function checkCatching(catcher) {
    players.forEach(player => {
        if (player.id !== catcher.id && isColliding(catcher, player)) {
            const now = Date.now();
            if (now - lastCatchTime > catchCooldown) {
                player.isCatcher = true;
                catcher.isCatcher = false;
                catcherId = player.id;
                lastCatchTime = now;
                io.emit('updatePlayers', players);
            }
        }
    });
}

function isColliding(player1, player2) {
    const distance = Math.hypot(player1.x - player2.x, player1.y - player2.y);
    return distance < 50; // Example collision radius
}

server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});