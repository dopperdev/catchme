// (function () {
    // const socket = io({
    //     transports: ['websocket'] // Only use WebSocket transport
    // });
    const ws = new WebSocket('wss://catchplay.vercel.app');
    // const ws = new WebSocket('ws://localhost:3000');

    const canvas = document.getElementById('gameCanvas');
    const context = canvas.getContext('2d');

    // let scale = window.devicePixelRatio;
    // context.translate(window.innerWidth / scale, window.innerHeight / scale);
    // // context.scale(scale, scale);
    // context.translate(-window.innerWidth / scale, -window.innerHeight/ scale);


    const mapWidth = 1600; // Width of the map
    const mapHeight = 1200; // Height of the map

    let players = {};
    let direction = { x: 0, y: 0 };
    let catcherId = null;
    let powerUps = [];
    let player = {};
    let leaderboard = [];
    let trails = []; // Array to store bubble positions
    let burstEffects = []; // Array to store burst effects
    let serverTime = 0;
    const numVertices = 60; // Number of vertices for the jelly shape
    const jellyVertices = [];

    // Initialize jelly vertices
    for (let i = 0; i < numVertices; i++) {
        jellyVertices.push({
            angle: (i / numVertices) * Math.PI * 2,
            length: player.radius
        });
    }


    function deobfuscatePosition(position, key) {
        return position ^ key;
    }

    canvas.addEventListener('mousemove', (event) => {
        const rect = canvas.getBoundingClientRect();
        const cameraOffsetX = canvas.width / 2 - player.x;
        const cameraOffsetY = canvas.height / 2 - player.y;
        const mouseX = event.clientX - rect.left - cameraOffsetX;
        const mouseY = event.clientY - rect.top - cameraOffsetY;

        const dx = mouseX - player.x;
        const dy = mouseY - player.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 0) {
            direction.x = dx / distance;
            direction.y = dy / distance;
        }
        // socket.emit('setTarget', target);
        ws.send(JSON.stringify({ type: 'setDirection', data: direction }));
    });

    // WebSocket event listeners
    ws.addEventListener('open', () => {
        console.log('Connected to WebSocket server');
    });

    ws.addEventListener('message', event => {
        const message = JSON.parse(event.data);
        // console.log(message);
        switch (message.type) {
            case 'initialize':
                player.id = message.data.id;
                player.x = message.data.x;
                player.y = message.data.y;
                player.radius = message.data.radius;
                player.color = message.data.color;
                player.speed = message.data.speed;
                player.key = message.data.key;
                if (!trails[player.id])
                    trails[player.id] = []; // Initialize trail for new player

                requestAnimationFrame(updateLocalPlayer);

                // Resize canvas to fullscreen
                function resizeCanvas() {
                    canvas.width = window.innerWidth;
                    canvas.height = window.innerHeight;
                    draw();
                }

                window.addEventListener('resize', resizeCanvas);
                resizeCanvas();
                break;
            case 'updatePlayer':
                player.x = message.data.x;
                player.y = message.data.y;
                player.score = message.data.score;
                player.color = message.data.color;
                player.speed = message.data.speed;
                player.invisible = message.data.invisible;
                player.shield = message.data.shield;
                player.radius = message.data.radius;
                player.key = message.data.key;
                break;
            case 'updatePlayers':
                const decodedData = message.data;
                players = {};
                for (let i in decodedData.players) {
                    let p = decodedData.players[i];
                    if (p.id !== player.id) {
                        players[p.id] = {
                            id: p.id,
                            x: p.x,
                            y: p.y,
                            radius: p.radius,
                            shield: p.shield,
                            invisible: p.invisible,
                            score: p.score,
                            color: p.color,
                            key: p.key
                        }
                    };
                    if (!trails[p.id])
                        trails[p.id] = []; // Initialize trail for new player
                }
                catcherId = decodedData.catcherId;
                powerUps = decodedData.powerUps;
                // player = players[player.id]; // Update the player's own data
                serverTime = decodedData.timeNow;
                break;
            case 'updatePowerUps':
                powerUps = message.data;
                break;
            case 'youAreCatcher':
                catcherId = player.id;
                break;
            case 'powerUpCollected':
                if (message.data.id === player.id) {
                    burstEffects.push({ x: player.x, y: player.y, startTime: Date.now() });
                }
                break;
        }
    });

    // socket.on('initialize', (data) => {
    //     player.id = data.id;
    //     player.radius = data.radius;
    //     player.color = data.color;
    //     player.speed = data.speed;
    //     player.key = data.key;
    //     if (!trails[player.id])
    //         trails[player.id] = []; // Initialize trail for new player

    //     requestAnimationFrame(updateLocalPlayer);

    //     // Resize canvas to fullscreen
    //     function resizeCanvas() {
    //         canvas.width = window.innerWidth;
    //         canvas.height = window.innerHeight;
    //         draw();
    //     }

    //     window.addEventListener('resize', resizeCanvas);
    //     resizeCanvas();
    // });

    // socket.on('updatePlayer', (data) => {
    //     player.x = data.x;
    //     player.y = data.y;
    //     player.score = data.score;
    //     player.color = data.color;
    //     player.speed = data.speed;
    //     player.invisible = data.invisible;
    //     player.shield = data.shield;
    //     player.radius = data.radius;
    //     player.key = data.key;
    // });

    // socket.on('updatePlayers', updatedData => {
    //     players = {};
    //     for (let p of updatedData.players) {
    //         if (p.id !== socket.id) {
    //             players[p.id] = {
    //                 id: p.id,
    //                 x: deobfuscatePosition(p.x, p.key),
    //                 y: deobfuscatePosition(p.y, p.key),
    //                 radius: p.radius,
    //                 shield: p.shield,
    //                 invisible: p.invisible,
    //                 score: p.score,
    //                 color: p.color,
    //                 key: p.key
    //             }
    //         };
    //         if (!trails[p.id])
    //             trails[p.id] = []; // Initialize trail for new player
    //     }
    //     catcherId = updatedData.catcherId;
    //     powerUps = updatedData.powerUps;
    //     // player = players[socket.id]; // Update the player's own data
    //     serverTime = updatedData.timeNow;
    // });

    // socket.on('updatePowerUps', (updatedPowerUps) => {
    //     powerUps = updatedPowerUps;
    // });

    // socket.on('youAreCatcher', () => {
    //     catcherId = socket.id;
    //     console.log('You are the Catcher!');
    // });

    // socket.on('gameOver', (data) => {
    //     alert(`Game Over! Catcher was: ${data.winner}`);
    // });

    // socket.on('updateLeaderboard', (updatedLeaderboard) => {
    //     leaderboard = updatedLeaderboard;
    //     drawLeaderboard();
    // });

    // socket.on('powerUpCollected', (data) => {
    //     if (data.id === socket.id) {
    //         burstEffects.push({ x: player.x, y: player.y, startTime: Date.now() });
    //     }
    // });

    function updateLocalPlayer() {
        // const dx = target.x - player.x;
        // const dy = target.y - player.y;
        // const distance = Math.sqrt(dx * dx + dy * dy);
        // if (distance > player.speed) {
        //     player.x += dx / distance * player.speed;
        //     player.y += dy / distance * player.speed;
        // }
        player.x += direction.x * player.speed;
        player.y += direction.y * player.speed;
        // Ensure player stays within map boundaries
        player.x = Math.max(player.radius, Math.min(mapWidth - player.radius, player.x));
        player.y = Math.max(player.radius, Math.min(mapHeight - player.radius, player.y));
        // Draw the updated scene
        draw();
        requestAnimationFrame(updateLocalPlayer);
    }

    // Draw background grid and map boundaries
    function drawBackground(cameraOffsetX, cameraOffsetY) {
        const gridSize = 50; // Size of the grid squares
        context.fillStyle = '#e0e0e0';
        context.fillRect(0, 0, canvas.width, canvas.height);

        context.strokeStyle = '#cccccc';
        for (let x = cameraOffsetX % gridSize; x < canvas.width; x += gridSize) {
            context.beginPath();
            context.moveTo(x, 0);
            context.lineTo(x, canvas.height);
            context.stroke();
        }
        for (let y = cameraOffsetY % gridSize; y < canvas.height; y += gridSize) {
            context.beginPath();
            context.moveTo(0, y);
            context.lineTo(canvas.width, y);
            context.stroke();
        }

        // Draw map boundaries
        context.strokeStyle = 'black';
        context.lineWidth = 2;
        context.strokeRect(cameraOffsetX, cameraOffsetY, mapWidth, mapHeight);
    }

    // Draw power-ups with glow and pulse effects
    function drawPowerUps(cameraOffsetX, cameraOffsetY) {
        const pulseScale = 1.2;
        const pulseSpeed = 0.05;
        for (let i = 0; i < powerUps.length; i++) {
            const powerUp = powerUps[i];
            const pulse = 1 + Math.sin(Date.now() * pulseSpeed) * 0.1;
            context.save();
            context.translate(powerUp.x + cameraOffsetX, powerUp.y + cameraOffsetY);
            context.scale(pulse, pulse);
            context.fillStyle = powerUp.type === 'speed' ? 'green' : powerUp.type === 'invisibility' ? 'purple' : 'yellow';
            context.shadowBlur = 20;
            context.shadowColor = context.fillStyle;
            context.beginPath();
            context.arc(0, 0, powerUp.radius, 0, Math.PI * 2);
            context.fill();
            context.restore();
        }
    }

    // Draw players with bubble trail effect
    function draw() {
        context.clearRect(0, 0, canvas.width, canvas.height); // Clear the canvas

        // Calculate camera offset to keep the player centered
        const cameraOffsetX = canvas.width / 2 - player.x;
        const cameraOffsetY = canvas.height / 2 - player.y;

        // Draw background grid and map boundaries
        drawBackground(cameraOffsetX, cameraOffsetY);

        // Draw power-ups
        drawPowerUps(cameraOffsetX, cameraOffsetY);

        // Draw burst effects
        drawBurstEffects(cameraOffsetX, cameraOffsetY);

        // Draw players
        for (let id in players) {
            if (id !== player.id) {
                const p = players[id];
                drawPlayer(p, id, cameraOffsetX, cameraOffsetY);
            }
        }


        drawPlayer(player, player.id, cameraOffsetX, cameraOffsetY);
    }

    function drawPlayer(p, id, offsetX, offsetY) {
        if (p.invisible > serverTime) {
            if (id !== player.id) return;
            drawInvisiblePlayer(p, offsetX, offsetY);
        } else {
            context.save();

            drawPlayerTrail(p, offsetX, offsetY);

            context.fillStyle = p.color;

            // Draw jelly effect
            drawJelly(p, offsetX, offsetY, id === catcherId);

            if (id === catcherId)
                drawCatcherMarker(p, offsetX, offsetY);

            if (p.shield > serverTime)
                drawShield(p, offsetX, offsetY);

            context.restore();
        }
    }

    function drawPlayerTrail(player, offsetX, offsetY) {
        const trail = trails[player.id];
        const trailRadius = player.radius * 1.2; // Extend the radius of the trail
        trail.push({
            x: player.x + (Math.random() - 0.5) * trailRadius, // Randomize position within the extended radius
            y: player.y + (Math.random() - 0.5) * trailRadius,
            radius: Math.random() * 10 + 5, // Random radius between 10 and 25
            alpha: 0.5,
            startTime: Date.now(),
            color: player.color // Match the player's color
        });

        if (trail.length > 85) trail.shift(); // Limit the number of bubbles

        for (let i = 0; i < trail.length; i++) {
            const bubble = trail[i];
            const elapsedTime = Date.now() - bubble.startTime;
            bubble.alpha = 0.5 - (elapsedTime / 3000); // Fade out the bubble over 2 seconds
            if (bubble.alpha <= 0) {
                trail.splice(i, 1); // Remove faded bubbles
                i--;
                continue;
            }
            context.fillStyle = `rgba(${getColorComponents(bubble.color)}, ${bubble.alpha})`;
            context.beginPath();
            context.arc(bubble.x + offsetX, bubble.y + offsetY, bubble.radius, 0, Math.PI * 2);
            context.fill();
        }
    }

    function drawJelly(player, offsetX, offsetY, isCatcher) {
        const time = Date.now() / 1000;
        context.beginPath();
        for (let i = 0; i < jellyVertices.length; i++) {
            const v = jellyVertices[i];
            const targetX = player.radius * Math.cos(v.angle);
            const targetY = player.radius * Math.sin(v.angle);
            const noise = Math.sin(time * 30 + v.angle * 4); // Adjust the 10 for more or less wobble
            const x = player.x + targetX + noise;
            const y = player.y + targetY + noise;

            if (i === 0) {
                context.moveTo(x + offsetX, y + offsetY);
            } else {
                context.lineTo(x + offsetX, y + offsetY);
            }
        }
        context.closePath();
        context.fill();

        if (isCatcher) {
            // Add an outline for the catcher
            const color = '#000000';

            context.strokeStyle = color;
            context.lineWidth = 10;
            // context.stroke();
        }
    }

    function drawCatcherMarker(player, offsetX, offsetY) {
        context.save();
        context.fillStyle = player.color == 'yellow' ? 'black' : 'white';
        context.font = '40px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText('★', player.x + offsetX, player.y + offsetY);
        context.restore();
    }

    function drawShield(player, offsetX, offsetY) {
        const time = Date.now() / 1000;
        const pulse = Math.sin(time * 5) + 2; // Pulsating effect
        const shieldRadius = player.radius + 15 + 3 * pulse; // Adjust shield radius

        context.save();
        context.strokeStyle = '#CCFFFFAA'; // Cyan color with some transparency
        context.lineWidth = 5; // Make the line width pulsate
        context.shadowBlur = 30;
        context.shadowColor = '#00ffff';

        // context.save();
        // context.translate(player.x + offsetX, player.y + offsetY);
        context.beginPath();
        context.arc(player.x + offsetX, player.y + offsetY, shieldRadius, 0, Math.PI * 2); // Draw shield
        context.stroke();
        // context.restore();


        // Draw inner glow
        const gradient = context.createRadialGradient(
            player.x + offsetX, player.y + offsetY, player.radius,
            player.x + offsetX, player.y + offsetY, shieldRadius
        );
        gradient.addColorStop(0, 'rgba(0, 255, 255, 0.4)');
        gradient.addColorStop(1, 'rgba(0, 255, 255, 0)');

        context.fillStyle = gradient;
        context.beginPath();
        context.arc(player.x + offsetX, player.y + offsetY, shieldRadius, 0, Math.PI * 2);
        context.fill();

        context.restore();
    }

    function drawInvisiblePlayer(player, offsetX, offsetY) {
        const time = Date.now() / 1000;
        context.save();

        // Apply transparency
        context.globalAlpha = 0.3;

        // Draw jelly effect with transparency
        drawJelly(player, offsetX, offsetY);

        // Restore full opacity for outline
        context.globalAlpha = 1;

        // Draw faint, animated outline
        context.strokeStyle = `rgba(255, 255, 255, ${0.5 + 0.5 * Math.sin(time * 5)})`; // Fading in and out
        context.lineWidth = 2;
        context.beginPath();
        context.arc(player.x + offsetX, player.y + offsetY, player.radius + 5, 0, Math.PI * 2);
        context.stroke();

        context.restore();
    }

    // Helper function to convert color names to RGB components
    function getColorComponents(color) {
        const colors = {
            blue: '0, 0, 255',
            red: '255, 0, 0',
            orange: '255, 165, 0',
            green: '0, 128, 0',
            purple: '128, 0, 128',
            yellow: '255, 255, 0'
        };
        return colors[color] || '0, 0, 0'; // Default to black if color not found
    }

    // Draw burst effects
    function drawBurstEffects(cameraOffsetX, cameraOffsetY) {
        const burstDuration = 500; // Duration of the burst effect in milliseconds
        for (let i = burstEffects.length - 1; i >= 0; i--) {
            const burst = burstEffects[i];
            const elapsedTime = Date.now() - burst.startTime;
            if (elapsedTime > burstDuration) {
                burstEffects.splice(i, 1);
                continue;
            }
            const alpha = 1 - elapsedTime / burstDuration;
            context.fillStyle = `rgba(255, 255, 0, ${alpha})`;
            context.beginPath();
            context.arc(burst.x + cameraOffsetX, burst.y + cameraOffsetY, player.radius * (elapsedTime / burstDuration + 1), 0, Math.PI * 2);
            context.fill();
        }
    }

    // Draw leaderboard
    function drawLeaderboard() {
        const leaderboardElement = document.getElementById('leaderboard');
        leaderboardElement.innerHTML = '<h3>Leaderboard</h3>';
        leaderboard.forEach(player => {
            const playerElement = document.createElement('div');
            playerElement.textContent = `${player.id}: ${player.score.toFixed(2)}`;
            leaderboardElement.appendChild(playerElement);
        });
    }

    // Check if the Catcher has tagged a player
    canvas.addEventListener('click', () => {
        if (catcherId === player.id)
            ws.send(JSON.stringify({ type: 'attemptTag' }));
    });
// })();