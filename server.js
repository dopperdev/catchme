const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const mapWidth = 1600; // Width of the map
const mapHeight = 1200; // Height of the map

let players = {};
let catcherId = null;
let powerUps = [];
const gameDuration = 120000; // 2 minutes
const playerRadius = 50; // Radius of the player circles
const powerUpRadius = 10; // Radius of the power-ups

const powerUpTypes = ['speed', 'invisibility', 'shield'];

function createRandomPowerUp() {
    const type = powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)];
    return {
        type,
        x: Math.random() * (mapWidth - 2 * powerUpRadius) + powerUpRadius,
        y: Math.random() * (mapHeight - 2 * powerUpRadius) + powerUpRadius,
        radius: powerUpRadius
    };
}

// Create initial power-ups
for (let i = 0; i < 5; i++) {
    powerUps.push(createRandomPowerUp());
}

io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);

    players[socket.id] = {
        id: socket.id,
        x: Math.random() * mapWidth,
        y: Math.random() * mapHeight,
        speed: 2,
        target: { x: 0, y: 0 },
        radius: playerRadius,
        powerUp: null,
        shield: false,
        invisible: false
    };

    if (!catcherId || Object.keys(players).length === 1) {
        catcherId = socket.id;
        io.to(catcherId).emit('youAreCatcher');
    }

    io.emit('updatePlayers', { players, catcherId, powerUps });

    socket.on('setTarget', (data) => {
        if (players[socket.id]) {
            players[socket.id].target = data;
        }
    });

    socket.on('attemptTag', () => {
        if (socket.id === catcherId) {
            for (let id in players) {
                if (id !== catcherId && !players[id].invisible && !players[id].shield) {
                    const dx = players[id].x - players[catcherId].x;
                    const dy = players[id].y - players[catcherId].y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    if (distance < players[catcherId].radius * 2) { // Use the radius set on the server
                        catcherId = id;
                        io.to(catcherId).emit('youAreCatcher');
                        break;
                    }
                }
            }
            io.emit('updatePlayers', { players, catcherId, powerUps });
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
        io.emit('updatePlayers', { players, catcherId, powerUps });
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

        // Ensure player stays within map boundaries
        player.x = Math.max(player.radius, Math.min(mapWidth - player.radius, player.x));
        player.y = Math.max(player.radius, Math.min(mapHeight - player.radius, player.y));

        // Check for power-up collection
        for (let i = powerUps.length - 1; i >= 0; i--) {
            const powerUp = powerUps[i];
            const pdx = player.x - powerUp.x;
            const pdy = player.y - powerUp.y;
            const pdistance = Math.sqrt(pdx * pdx + pdy * pdy);

            if (pdistance < player.radius + powerUp.radius) {
                // Apply power-up effect
                player.powerUp = powerUp.type;
                powerUps.splice(i, 1); // Remove the power-up

                // Apply power-up effects
                switch (powerUp.type) {
                    case 'speed':
                        player.speed *= 1.5; // Increase speed by 50%
                        setTimeout(() => {
                            player.speed /= 1.5; // Revert speed after 5 seconds
                        }, 5000);
                        break;
                    case 'invisibility':
                        player.invisible = true; // Make player invisible
                        setTimeout(() => {
                            player.invisible = false; // Revert invisibility after 5 seconds
                        }, 5000);
                        break;
                    case 'shield':
                        player.shield = true; // Activate shield
                        setTimeout(() => {
                            player.shield = false; // Deactivate shield after 5 seconds
                        }, 5000);
                        break;
                }

                // Create a new power-up
                powerUps.push(createRandomPowerUp());
            }
        }
    }
    io.emit('updatePlayers', { players, catcherId, powerUps });
}

setInterval(updatePlayerPositions, 1000 / 60); // Update 60 times per second

app.use(express.static('public'));

server.listen(3000, () => {
    console.log('Server is running on port 3000');
});