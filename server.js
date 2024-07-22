const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const crypto = require('crypto');
const protobuf = require('protobufjs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    transports: ['websocket'],
    upgrade: false
});

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

// Load protobuf schema
protobuf.load('public/game.proto', (err, root) => {
    if (err) throw err;

    const PlayerData = root.lookupType('game.PlayerData');
    const UpdatePlayersData = root.lookupType('game.UpdatePlayersData');

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

    io.on('connection', (socket) => {
        console.log(`Player connected: ${socket.id}`);

        const key = crypto.randomBytes(4).readUInt32BE(0);

        players[socket.id] = {
            id: socket.id,
            x: Math.random() * mapWidth,
            y: Math.random() * mapHeight,
            speed: 2,
            target: { x: 0, y: 0 },
            radius: playerRadius,
            shield: 0,
            invisible: 0,
            score: 0, // Initial score
            color: playerColors[Math.floor(Math.random() * playerColors.length)], // Assign a random color
            key: key
        };

        if (!catcherId || Object.keys(players).length === 1) {
            catcherId = socket.id;
            io.to(catcherId).emit('youAreCatcher');
        }

        emitUpdatePlayers();

        socket.on('setTarget', (data) => {
            if (players[socket.id]) {
                players[socket.id].target = data;
            }
        });

        socket.on('attemptTag', () => {
            if (socket.id === catcherId) {
                for (let id in players) {
                    const now = Date.now();
                    if (id !== catcherId && players[id].invisible < now && players[id].shield < now) {
                        const dx = players[id].x - players[catcherId].x;
                        const dy = players[id].y - players[catcherId].y;
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        if (distance < players[catcherId].radius * 2) { // Use the radius set on the server
                            players[catcherId].score += 10; // Score for tagging a player
                            players[id].score -= 20; // Decrease score for becoming the catcher
                            catcherId = id;
                            io.to(catcherId).emit('youAreCatcher');
                            break;
                        }
                    }
                }

                emitUpdatePlayers();
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

            emitUpdatePlayers();
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
                    powerUps.splice(i, 1); // Remove the power-up

                    // Emit event to trigger burst effect
                    io.to(player.id).emit('powerUpCollected', { id: player.id });

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
        }
        
        emitUpdatePlayers();
    }

    function emitUpdatePlayers() {
        const timenow = Date.now();
        const obfuscatedPlayers = [];
        for (let id in players) {
            const player = players[id];
            obfuscatedPlayers.push({
                id: player.id,
                x: obfuscatePosition(player.x, player.key),
                y: obfuscatePosition(player.y, player.key),
                radius: player.radius,
                shield: player.shield,
                invisible: player.invisible,
                score: player.score,
                color: player.color,
                key: player.key
            });
        }

        const obfuscatedPowerUps = powerUps.map(pu => ({
            type: pu.type,
            x: pu.x,
            y: pu.y,
            radius: pu.radius
        }));

        const payload = {
            players: obfuscatedPlayers,
            catcherId,
            powerUps: obfuscatedPowerUps,
            timeNow: timenow
        };

        const message = UpdatePlayersData.encode(payload).finish();
        io.emit('updatePlayers', message);
    }

    // Function to update the leaderboard
    function updateLeaderboard() {
        const leaderboard = Object.values(players)
            .sort((a, b) => b.score - a.score)
            .map(player => ({ id: player.id, score: player.score }));
        io.emit('updateLeaderboard', leaderboard);
    }

    setInterval(updatePlayerPositions, 1000 / 60); // Update 60 times per second
    setInterval(updateLeaderboard, leaderboardUpdateInterval); // Update leaderboard at intervals
});

app.use(express.static('public'));

server.listen(3000, () => {
    console.log('Server is running on port 3000');
});