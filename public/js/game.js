const socket = io();
const canvas = document.getElementById('gameCanvas');
const context = canvas.getContext('2d');

let players = {};
let isCatcher = false;
let target = { x: 0, y: 0 };
let catcherId = null;

canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    target.x = event.clientX - rect.left;
    target.y = event.clientY - rect.top;
    socket.emit('setTarget', target);
});

socket.on('updatePlayers', (updatedPlayers) => {
    players = updatedPlayers.players;
    catcherId = updatedPlayers.catcherId;
    draw();
});

socket.on('youAreCatcher', () => {
    isCatcher = true;
    console.log('You are the Catcher!');
});

socket.on('gameOver', (data) => {
    alert(`Game Over! Catcher was: ${data.winner}`);
});

// Draw players on the canvas
function draw() {
    context.clearRect(0, 0, canvas.width, canvas.height);
    for (let id in players) {
        context.fillStyle = id === socket.id ? 'blue' : 'red';
        if (id === catcherId) {
            context.fillStyle = 'orange';
        }
        context.beginPath();
        context.arc(players[id].x, players[id].y, 10, 0, Math.PI * 2);
        context.fill();
    }
}

// Check if the Catcher has tagged a player
canvas.addEventListener('click', () => {
    if (isCatcher) {
        for (let id in players) {
            if (id !== socket.id) {
                const dx = players[id].x - players[socket.id].x;
                const dy = players[id].y - players[socket.id].y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < 20) {
                    socket.emit('tag', id);
                    break;
                }
            }
        }
    }
});