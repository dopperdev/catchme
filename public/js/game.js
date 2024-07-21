const socket = io();
const canvas = document.getElementById('gameCanvas');
const context = canvas.getContext('2d');

const mapWidth = 1600; // Width of the map
const mapHeight = 1200; // Height of the map

let players = {};
let isCatcher = false;
let target = { x: 0, y: 0 };
let catcherId = null;
let powerUps = [];
let player = { x: 0, y: 0, radius: 50 };

canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    const cameraOffsetX = canvas.width / 2 - player.x;
    const cameraOffsetY = canvas.height / 2 - player.y;
    target.x = event.clientX - rect.left - cameraOffsetX;
    target.y = event.clientY - rect.top - cameraOffsetY;
    socket.emit('setTarget', target);
});

socket.on('updatePlayers', (updatedData) => {
    players = updatedData.players;
    catcherId = updatedData.catcherId;
    powerUps = updatedData.powerUps;
    player = players[socket.id]; // Update the player's own data
    draw();
});

socket.on('youAreCatcher', () => {
    isCatcher = true;
    console.log('You are the Catcher!');
});

socket.on('gameOver', (data) => {
    alert(`Game Over! Catcher was: ${data.winner}`);
});

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

// Draw power-ups
function drawPowerUps(cameraOffsetX, cameraOffsetY) {
    for (let i = 0; i < powerUps.length; i++) {
        const powerUp = powerUps[i];
        context.fillStyle = powerUp.type === 'speed' ? 'green' : powerUp.type === 'invisibility' ? 'purple' : 'yellow';
        context.beginPath();
        context.arc(powerUp.x + cameraOffsetX, powerUp.y + cameraOffsetY, powerUp.radius, 0, Math.PI * 2);
        context.fill();
    }
}

// Draw players on the canvas
function draw() {
    // Calculate camera offset to keep the player centered
    const cameraOffsetX = canvas.width / 2 - player.x;
    const cameraOffsetY = canvas.height / 2 - player.y;

    // Draw background grid and map boundaries
    drawBackground(cameraOffsetX, cameraOffsetY);

    // Draw power-ups
    drawPowerUps(cameraOffsetX, cameraOffsetY);

    // Draw players
    for (let id in players) {
        const p = players[id];
        if (p.invisible && id !== socket.id) continue; // Skip drawing invisible players

        context.fillStyle = id === socket.id ? 'blue' : 'red';
        if (id === catcherId) {
            context.fillStyle = 'orange';
        }
        if (p.shield) {
            context.strokeStyle = 'cyan';
            context.lineWidth = 3;
            context.beginPath();
            context.arc(p.x + cameraOffsetX, p.y + cameraOffsetY, p.radius + 5, 0, Math.PI * 2); // Draw shield
            context.stroke();
        }
        context.beginPath();
        context.arc(p.x + cameraOffsetX, p.y + cameraOffsetY, p.radius, 0, Math.PI * 2); // Use the radius from the server
        context.fill();
    }
}

// Check if the Catcher has tagged a player
canvas.addEventListener('click', () => {
    if (isCatcher) {
        socket.emit('attemptTag');
    }
});