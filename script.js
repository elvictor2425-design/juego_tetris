const canvas = document.getElementById('tetris');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nctx = nextCanvas.getContext('2d');

const ROWS = 20, COLS = 12, SIZE = 25;
ctx.scale(SIZE, SIZE);
nctx.scale(SIZE, SIZE);

const COLORS = {
    neon: [null, '#00f3ff', '#ff00ff', '#fde047', '#39ff14', '#ff3131', '#bc13fe', '#ff5e00'],
    sunset: [null, '#FF5F6D', '#FFC371', '#FF9A8B', '#FF6A88', '#FF99AC', '#FA8BFF', '#2BD2FF'],
    ocean: [null, '#00c6ff', '#0072ff', '#4facfe', '#00f2fe', '#43e97b', '#38f9d7', '#0575E6'],
    candy: [null, '#ff9a9e', '#fad0c4', '#ffecd2', '#fcb69f', '#ff9a9e', '#fecfef', '#a1887f'],
    retro: [null, '#00e5ff', '#2979ff', '#ff9100', '#ffea00', '#00e676', '#d500f9', '#ff1744'],
    matrix: [null, '#00FF41', '#008F11', '#00FF41', '#003B00', '#00FF41', '#008F11', '#00FF41']
};

function createPiece(type) {
    if (type === 'I') return [[0,1,0,0],[0,1,0,0],[0,1,0,0],[0,1,0,0]];
    if (type === 'L') return [[0,2,0],[0,2,0],[0,2,2]];
    if (type === 'J') return [[0,3,0],[0,3,0],[3,3,0]];
    if (type === 'O') return [[4,4],[4,4]];
    if (type === 'T') return [[0,5,0],[5,5,5],[0,0,0]];
    if (type === 'S') return [[0,6,6],[6,6,0],[0,0,0]];
    if (type === 'Z') return [[7,7,0],[0,7,7],[0,0,0]];
}

const arena = Array.from({length: ROWS}, () => new Array(COLS).fill(0));
const player = { pos: {x: 0, y: 0}, matrix: null, next: null, score: 0 };

let dropCounter = 0;
let dropInterval = 1000;
let lastTime = 0;
let gameRunning = false;
let timeLeft = 120;
let timerId = null;

function draw() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawMatrix(arena, {x: 0, y: 0}, ctx);
    drawMatrix(player.matrix, player.pos, ctx);
}

function drawMatrix(matrix, offset, context) {
    const pal = document.getElementById('paletteSelect').value;
    matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                context.shadowBlur = 8;
                context.shadowColor = COLORS[pal][value];
                context.fillStyle = COLORS[pal][value];
                context.fillRect(x + offset.x, y + offset.y, 1, 1);
                context.shadowBlur = 0;
                context.strokeStyle = 'rgba(0,0,0,0.5)';
                context.lineWidth = 0.05;
                context.strokeRect(x + offset.x, y + offset.y, 1, 1);
            }
        });
    });
}

function drawNext() {
    nctx.fillStyle = '#000';
    nctx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
    drawMatrix(player.next, {x: 1, y: 1}, nctx);
}

function collide(arena, player) {
    const [m, o] = [player.matrix, player.pos];
    for (let y = 0; y < m.length; ++y) {
        for (let x = 0; x < m[y].length; ++x) {
            if (m[y][x] !== 0 && (arena[y + o.y] && arena[y + o.y][x + o.x]) !== 0) return true;
        }
    }
    return false;
}

function merge(arena, player) {
    player.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) arena[y + player.pos.y][x + player.pos.x] = value;
        });
    });
}

function rotate(matrix, dir) {
    for (let y = 0; y < matrix.length; ++y) {
        for (let x = 0; x < y; ++x) [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
    }
    if (dir > 0) matrix.forEach(row => row.reverse()); else matrix.reverse();
}

function arenaSweep() {
    let lines = 0;
    outer: for (let y = arena.length - 1; y > 0; --y) {
        for (let x = 0; x < arena[y].length; ++x) if (arena[y][x] === 0) continue outer;
        arena.splice(y, 1);
        arena.unshift(new Array(COLS).fill(0));
        lines++; y++;
    }
    if (lines > 0) {
        player.score += [0, 40, 100, 300, 1200][lines] * (11 - (dropInterval/100));
        document.getElementById('score').innerText = player.score;
    }
}

function playerReset() {
    const pieces = 'ILJOTSZ';
    if (!player.next) player.next = createPiece(pieces[pieces.length * Math.random() | 0]);
    player.matrix = player.next;
    player.next = createPiece(pieces[pieces.length * Math.random() | 0]);
    player.pos.y = 0;
    player.pos.x = (arena[0].length / 2 | 0) - (player.matrix[0].length / 2 | 0);
    if (collide(arena, player)) endGame();
    drawNext();
}

function handleDrop() {
    player.pos.y++;
    if (collide(arena, player)) {
        player.pos.y--;
        merge(arena, player);
        playerReset();
        arenaSweep();
    }
    dropCounter = 0;
}

function handleHardDrop() {
    while (!collide(arena, player)) player.pos.y++;
    player.pos.y--;
    merge(arena, player);
    playerReset();
    arenaSweep();
    dropCounter = 0;
}

function handleMove(dir) {
    player.pos.x += dir;
    if (collide(arena, player)) player.pos.x -= dir;
}

function handleRotate(dir) {
    const pos = player.pos.x;
    let offset = 1;
    rotate(player.matrix, dir);
    while (collide(arena, player)) {
        player.pos.x += offset;
        offset = -(offset + (offset > 0 ? 1 : -1));
        if (offset > player.matrix[0].length) {
            rotate(player.matrix, -dir);
            player.pos.x = pos;
            return;
        }
    }
}

function update(time = 0) {
    if (!gameRunning) return;
    const dt = time - lastTime;
    lastTime = time;
    dropCounter += dt;
    if (dropCounter > dropInterval) handleDrop();
    draw();
    requestAnimationFrame(update);
}

function updateTimer() {
    const m = Math.floor(timeLeft / 60), s = timeLeft % 60;
    document.getElementById('timer').innerText = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    if (timeLeft <= 0) endGame();
    timeLeft--;
}

// Eventos
document.addEventListener('keydown', e => {
    if (!gameRunning) return;
    if (e.keyCode === 37) handleMove(-1);
    if (e.keyCode === 39) handleMove(1);
    if (e.keyCode === 40) handleDrop();
    if (e.keyCode === 32) handleHardDrop();
    if (e.keyCode === 88) handleRotate(1);
    if (e.keyCode === 90) handleRotate(-1);
});

// Ratón: Arrastre y Click
let isDragging = false, startX = 0;
canvas.onmousedown = e => { isDragging = true; startX = e.offsetX; };
window.onmousemove = e => {
    if (!isDragging || !gameRunning) return;
    if (Math.abs(e.offsetX - startX) > 20) {
        handleMove(e.offsetX > startX ? 1 : -1);
        startX = e.offsetX;
    }
};
window.onmouseup = e => {
    if (isDragging && Math.abs(e.offsetX - startX) < 5) handleRotate(1);
    isDragging = false;
};

document.getElementById('speedRange').oninput = e => document.getElementById('speedVal').innerText = e.target.value;

document.getElementById('start-btn').onclick = () => {
    document.getElementById('overlay').style.display = 'none';
    arena.forEach(row => row.fill(0));
    player.score = 0;
    document.getElementById('score').innerText = 0;
    timeLeft = 120;
    dropInterval = 1100 - (document.getElementById('speedRange').value * 100);
    gameRunning = true;
    playerReset();
    updateTimer();
    timerId = setInterval(updateTimer, 1000);
    lastTime = performance.now();
    update();
};

function endGame() {
    gameRunning = false;
    clearInterval(timerId);
    document.getElementById('overlay').style.display = 'flex';
    document.getElementById('game-over-info').classList.remove('d-none');
    document.getElementById('final-score').innerText = player.score;
    document.getElementById('start-btn').innerText = 'RECONECTAR';
}

draw();