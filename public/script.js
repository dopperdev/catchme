const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const socket = io();

let players = [];
let playerId;
let isMoving = false;
let movementDirection = { x: 0, y: 0 };
let timeLeft;
const speed = 5; // Define the speed for movement

const canvasWidth = canvas.width;
const canvasHeight = canvas.height;

function draw() {
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    const player = players.find(p => p.id === playerId);
    if (player) {
        const cameraX = player.x - canvasWidth / 2;
        const cameraY = player.y - canvasHeight / 2;

        players.forEach(p => {
            ctx.beginPath();
            ctx.arc(p.x - cameraX, p.y - cameraY, 25, 0, Math.PI * 2);
            ctx.fillStyle = p.isCatcher ? 'red' : 'blue';
            ctx.fill();
            ctx.stroke();
        });

        ctx.font = '24px Arial';
        ctx.fillStyle = 'black';
        if (timeLeft)
            ctx.fillText(`Time left: ${timeLeft}s`, canvasWidth / 2 - 50, canvasHeight / 2 - 30);
    }
}

function calculateDirection(mouseX, mouseY) {
    const player = players.find(p => p.id === playerId);
    if (player) {
        const canvasCenterX = canvasWidth / 2;
        const canvasCenterY = canvasHeight / 2;

        const dx = mouseX - canvasCenterX;
        const dy = mouseY - canvasCenterY;

        const magnitude = Math.sqrt(dx * dx + dy * dy);
        if (magnitude > 0) {
            return {
                x: (dx / magnitude) * speed,
                y: (dy / magnitude) * speed
            };
        }
    }
    return null;
}

canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    const direction = calculateDirection(mouseX, mouseY);
    if (direction) {
        movementDirection = direction;
        isMoving = true;
    }
});

canvas.addEventListener('mousedown', () => {
    isMoving = true;
});

canvas.addEventListener('mouseup', () => {
    isMoving = false;
    socket.emit('stopMoving');
});

function updatePlayer() {
    if (isMoving) {
        socket.emit('move', movementDirection);
    }
    requestAnimationFrame(updatePlayer); // Continue sending updates
}

updatePlayer(); // Start periodic updates

socket.on('updatePlayers', (data) => {
    players = data;
    draw();
});

socket.on('updateTimer', (time) => {
    timeLeft = time;
});

socket.on('endRound', (data) => {
    if (data.winner === playerId) {
        alert('You won!');
    } else {
        alert('You lost.');
    }
});

socket.on('connect', () => {
    playerId = socket.id;
    players.push({
        id: playerId,
        x: canvasWidth / 2,
        y: canvasHeight / 2
    });
});
