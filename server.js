const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));

let players = {};

io.on('connection', (socket) => {
    console.log('A user connected: ' + socket.id);
    players[socket.id] = {
        x: Math.floor(Math.random() * 500),
        y: Math.floor(Math.random() * 500),
        isCatcher: false,
        isCaught: false
    };

    socket.on('movement', (data) => {
        if (players[socket.id]) {
            players[socket.id].x += data.x;
            players[socket.id].y += data.y;
            checkForCatches();
            io.emit('positionUpdate', players);
        }
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
        io.emit('positionUpdate', players);
        console.log('User disconnected: ' + socket.id);
    });

    chooseCatcher();
});

function chooseCatcher() {
    // Check if a catcher already exists
    const catcherExists = Object.keys(players).some(id => players[id].isCatcher);

    if (!catcherExists) {
        let ids = Object.keys(players);
        let randomId = ids[Math.floor(Math.random() * ids.length)];
        ids.forEach(id => {
            players[id].isCatcher = (id === randomId);
        });
        console.log(`New catcher chosen: ${randomId}`);
        io.emit('gameUpdate', players);
    }
}


function checkForCatches() {
    let catcherId = Object.keys(players).find(id => players[id].isCatcher);
    if (!catcherId) return;

    Object.keys(players).forEach(id => {
        if (id !== catcherId && !players[id].isCaught) {
            let dx = players[id].x - players[catcherId].x;
            let dy = players[id].y - players[catcherId].y;
            if (Math.sqrt(dx * dx + dy * dy) < 20) { // 20 pixels proximity to catch
                players[id].isCaught = true;
                console.log(`Player ${id} has been caught by ${catcherId}`);
            }
        }
    });
}

server.listen(3000, () => {
    console.log('Server listening on *:3000');
});