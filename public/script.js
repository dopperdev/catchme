const socket = io();
const canvas = document.getElementById('game');
const context = canvas.getContext('2d');
const player = { x: canvas.width / 2, y: canvas.height / 2 }; // Player starts at the center

canvas.addEventListener('mousemove', (event) => {
    // Calculate movement based on mouse position relative to canvas center
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left - player.x;
    const mouseY = event.clientY - rect.top - player.y;
    socket.emit('movement', { x: mouseX, y: mouseY });
});

socket.on('positionUpdate', (players) => {
    context.clearRect(0, 0, canvas.width, canvas.height); // Clear canvas
    Object.keys(players).forEach(id => {
        // Draw each player relative to the centered player
        const x = canvas.width / 2 + (players[id].x - player.x);
        const y = canvas.height / 2 + (players[id].y - player.y);
        context.beginPath();
        context.arc(x, y, 10, 0, 2 * Math.PI);
        context.fillStyle = players[id].isCatcher ? 'red' : 'blue';
        context.fill();
    });
});