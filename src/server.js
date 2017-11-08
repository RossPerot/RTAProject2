const http = require('http');
const fs = require('fs');
const socketio = require('socket.io');
const xxh = require('xxhashjs');

const port = process.env.PORT || process.env.NODE_PORT || 3000;

const index = fs.readFileSync(`${__dirname}/../client/index.html`);

const onRequest = (request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/html' });
  response.write(index);
  response.end();
};

const app = http.createServer(onRequest).listen(port);

console.log(`Listening on 127.0.0.1: ${port}`);

const io = socketio(app);

let squares = {};

let squaresAlive = 0;

let isGameOver = false;

const checkCollisions = (socket) => {
  const keys = Object.keys(squares);
  for (let i = 0; i < keys.length; i++) {
    for (let j = 0; j < keys.length; j++) {
      if (i !== j) {
        const square1 = squares[keys[i]];
        const square2 = squares[keys[j]];
        if (square1.x < square2.x + square2.width && square1.x + square1.width > square2.x &&
            square1.y < square2.y + square2.height && square1.height + square1.y > square2.y) {
          if (square1.seeker === true && square2.alive === true) {
            /* const newX = Math.floor(Math.random() * 700);
            const newY = Math.floor(Math.random() * 700);
            square2.x = newX;
            square2.y = newY;
            square2.prevX = newX;
            square2.prevY = newY;
            square2.destX = newX;
            square2.destY = newY; */
            square2.alive = false;
            squaresAlive--;
            if (squaresAlive <= 1) {
              io.sockets.in('room1').emit('gameOver');
              isGameOver = true;
            }
          } else if (square2.seeker === true && square1.alive === true) {
            /* const newX = Math.floor(Math.random() * 700);
            const newY = Math.floor(Math.random() * 700);
            square1.x = newX;
            square1.y = newY;
            square1.prevX = newX;
            square1.prevY = newY;
            square1.destX = newX;
            square1.destY = newY; */
            square1.alive = false;
            squaresAlive--;
            if (squaresAlive <= 1) {
              io.sockets.in('room1').emit('gameOver');
              isGameOver = true;
            }
          }
          socket.emit('collision', squares);
        }
      }
    }
  }
};

io.on('connection', (sock) => {
  const socket = sock;
  socket.join('room1');
  if (isGameOver === true) {
    squaresAlive = 0;
    squares = {};
    isGameOver = false;
  }

  const startX = Math.floor(Math.random() * 700);
  const startY = Math.floor(Math.random() * 700);

  socket.square = {
    hash: xxh.h32(`${socket.id}${new Date().getTime()}`, 0xCAFEBABE).toString(16),
    lastUpdate: new Date().getTime(),
    x: startX,
    y: startY,
    prevX: startX,
    prevY: startY,
    destX: startX,
    destY: startY,
    alpha: 0,
    height: 50,
    width: 50,
    seeker: false,
    alive: true,
  };

  squaresAlive++;

  squares[socket.square.hash] = socket.square;
  if (Object.keys(squares).length === 1) {
    squares[socket.square.hash].seeker = true;
    socket.square.seeker = true;
  }
  console.log(Object.keys(squares).length);
  socket.emit('joined', socket.square);

  socket.on('moveUpdate', (data) => {
    socket.square = data;
    socket.square.lastUpdate = new Date().getTime();
    squares[data.hash] = socket.square;
    checkCollisions(socket);
    io.sockets.in('room1').emit('updatedMovement', socket.square);
    // socket.broadcast.to('room1').emit('updatedMovement', socket.square);
  });

  socket.on('disconnect', () => {
    io.sockets.in('room1').emit('left', socket.square.hash);
    delete squares[socket.square.hash];
    socket.leave('room1');
  });
});
