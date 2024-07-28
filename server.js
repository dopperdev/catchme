const express = require('express');
const http = require('http');
// const socketIo = require('socket.io');
const WebSocket = require('ws');
const crypto = require('crypto');
const protobuf = require('protobufjs');

const app = express();
const server = http.createServer(app);
// const io = socketIo(server, {
//     transports: ['websocket'],
//     upgrade: false
// });
const wss = new WebSocket.Server({ server });

const mapWidth = 1600; // Width of the map
const mapHeight = 1200; // Height of the map

let players = {};
let catcherId = null;
let powerUps = [];
const gameDuration = 120000; // 2 minutes
const playerRadius = 50; // Radius of the player circles
const powerUpRadius = 10; // Radius of the power-ups
const leaderboardUpdateInterval = 5000; // Interval to update the leaderboard in ms

const powerUpTypes = ['speed', 'invisibility', 'shield'];
const playerColors = ['blue', 'red', 'green', 'purple', 'yellow'];



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

function obfuscatePosition(position, key) {
    return position ^ key;
}

wss.on('connection', ws => {
    const id = Math.random().toString(36).substring(2);
    console.log(`Player connected: ${id}`);

    const key = crypto.randomBytes(4).readUInt32BE(0);

    players[id] = {
        id,
        x: Math.random() * mapWidth,
        y: Math.random() * mapHeight,
        speed: 2,
        direction: { x: 0, y: 0 },
        radius: playerRadius,
        shield: 0,
        invisible: 0,
        score: 0, // Initial score
        color: playerColors[Math.floor(Math.random() * playerColors.length)], // Assign a random color
        key: key
    };

    if (!catcherId || Object.keys(players).length === 1) {
        catcherId = id;
        // io.to(catcherId).emit('youAreCatcher');

        ws.send(JSON.stringify({ type: 'youAreCatcher' }));
    }

    // socket.emit('initialize', { id: socket.id, radius: playerRadius, speed: players[socket.id].speed });
    ws.id = id;
    const payload = {
        type: 'initialize',
        data: {
            id,
            x: players[id].x,
            y: players[id].y,
            score: players[id].score,
            color: players[id].color,
            radius: players[id].radius,
            invisible: players[id].invisible,
            shield: players[id].shield,
            key: players[id].key,
            speed: players[id].speed
        }
    };
    ws.send(JSON.stringify(payload));

    emitUpdatePlayers();

    ws.on('message', message => {
        const parsedMessage = JSON.parse(message);
        switch (parsedMessage.type) {
            case 'setDirection':
                const { x, y } = parsedMessage.data;
                if (players[id] && verifyDirection(x, y)) {
                    players[id].direction = { x, y };
                }
                break;
            case 'attemptTag':
                if (id === catcherId) {
                    for (let pid in players) {
                        const now = Date.now();
                        if (pid !== catcherId && players[pid].invisible < now && players[pid].shield < now) {
                            const dx = players[pid].x - players[catcherId].x;
                            const dy = players[pid].y - players[catcherId].y;
                            const distance = Math.sqrt(dx * dx + dy * dy);
                            if (distance < players[catcherId].radius * 2) { // Use the radius set on the server
                                players[catcherId].score += 10; // Score for tagging a player
                                players[pid].score -= 20; // Decrease score for becoming the catcher
                                catcherId = pid;
                                wss.clients.forEach(client => {
                                    if (client.readyState === WebSocket.OPEN && client.id === catcherId) {
                                        client.send(JSON.stringify({ type: 'youAreCatcher' }));
                                    }
                                });
                                break;
                            }
                        }
                    }

                    emitUpdatePlayers();
                }
                break;
        }
    })

    ws.on('close', () => {
        console.log(`Player disconnected: ${id}`);
        delete players[id];
        if (id === catcherId) {
            const playerIds = Object.keys(players);
            if (playerIds.length > 0) {
                catcherId = playerIds[Math.floor(Math.random() * playerIds.length)];
                wss.clients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN && client.id === catcherId) {
                        client.send(JSON.stringify({ type: 'youAreCatcher' }));
                    }
                });
            } else {
                catcherId = null;
            }
        }

        emitUpdatePlayers();
    });

    // socket.on('setTarget', (data) => {
    //     if (players[socket.id]) {
    //         players[socket.id].target = data;
    //     }
    // });

    // socket.on('attemptTag', () => {
    //     if (socket.id === catcherId) {
    //         for (let id in players) {
    //             const now = Date.now();
    //             if (id !== catcherId && players[id].invisible < now && players[id].shield < now) {
    //                 const dx = players[id].x - players[catcherId].x;
    //                 const dy = players[id].y - players[catcherId].y;
    //                 const distance = Math.sqrt(dx * dx + dy * dy);
    //                 if (distance < players[catcherId].radius * 2) { // Use the radius set on the server
    //                     players[catcherId].score += 10; // Score for tagging a player
    //                     players[id].score -= 20; // Decrease score for becoming the catcher
    //                     catcherId = id;
    //                     io.to(catcherId).emit('youAreCatcher');
    //                     break;
    //                 }
    //             }
    //         }

    //         emitUpdatePlayers();
    //     }
    // });

    // socket.on('disconnect', () => {
    //     console.log(`Player disconnected: ${socket.id}`);
    //     delete players[socket.id];
    //     if (socket.id === catcherId) {
    //         const playerIds = Object.keys(players);
    //         if (playerIds.length > 0) {
    //             catcherId = playerIds[Math.floor(Math.random() * playerIds.length)];
    //             io.to(catcherId).emit('youAreCatcher');
    //         } else {
    //             catcherId = null;
    //         }
    //     }

    //     emitUpdatePlayers();
    // });
});

function verifyDirection(x, y) {
    const length = Math.sqrt(x * x + y * y);
    return length <= 1.1 && length >= 0.9; // Allowing some margin of error for floating point calculations
}


function updatePlayerPositions() {
    for (let id in players) {
        const player = players[id];
        player.x += player.direction.x * player.speed;
        player.y += player.direction.y * player.speed;

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
                powerUps.splice(i, 1); // Remove the power-up

                // Emit event to trigger burst effect
                // io.to(player.id).emit('powerUpCollected', { id: player.id });
                wss.clients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN && client.id === player.id) {
                        client.send(JSON.stringify({ type: 'powerUpCollected', data: { id: player.id } }));
                    }
                });

                // Apply power-up effects
                switch (powerUp.type) {
                    case 'speed':
                        player.speed *= 1.5; // Increase speed by 50%
                        setTimeout(() => {
                            player.speed /= 1.5; // Revert speed after 5 seconds
                        }, 5000);
                        break;
                    case 'invisibility':
                        player.invisible = Date.now() + 5000; // Make player invisible for 5 seconds
                        break;
                    case 'shield':
                        player.shield = Date.now() + 5000; // Activate shield for 5 seconds
                        break;
                }

                // Increase score for collecting power-up
                player.score += 5;

                // Create a new power-up
                powerUps.push(createRandomPowerUp());
            }
        }

        // Increase score for staying untagged
        if (id !== catcherId)
            player.score += 0.01;
        else
            player.score -= 0.05;

        emitUpdatePlayer(player);
    }

    emitUpdatePlayers();
}

function emitUpdatePlayers() {
    const timenow = Date.now();

    const payload = {
        type: 'updatePlayers',
        data: {
            players,
            catcherId,
            powerUps,
            timeNow: timenow
        }
    };
    // io.emit('updatePlayers', payload);

    const message = JSON.stringify(payload);
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

function emitUpdatePlayer(player) {
    const payload = {
        type: 'updatePlayer',
        data: {
            x: player.x,
            y: player.y,
            score: player.score,
            color: player.color,
            radius: player.radius,
            invisible: player.invisible,
            shield: player.shield,
            key: player.key,
            speed: player.speed
        }
    };

    const message = JSON.stringify(payload);
    // console.log(wss.clients);
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN && client.id == player.id) {
            client.send(message);
        }
    });
}
setInterval(updatePlayerPositions, 1000 / 60); // Update 60 times per second

// app.use(express.static('public'));

server.listen(3000, () => {
    console.log('Server is running on port 3000');
});