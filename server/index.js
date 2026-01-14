const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

// --- CONFIG ---
const ROWS = 30;
const COLS = 30;
const TICK_RATE = 400;

// --- STATE ---
let staticMap = Array(ROWS).fill().map(() => Array(COLS).fill(0));
let heatmap = Array(ROWS).fill().map(() => Array(COLS).fill(0));

// --- BUILD FACTORY LAYOUT ---
// Walls
for (let i = 0; i < ROWS; i++) { staticMap[i][0] = 4; staticMap[i][COLS - 1] = 4; }
for (let j = 0; j < COLS; j++) { staticMap[0][j] = 4; staticMap[ROWS - 1][j] = 4; }

// Warehouse
for (let r = 2; r < 12; r += 3) { for (let c = 2; c < 10; c++) staticMap[r][c] = 1; }
// Production
for (let r = 3; r < 10; r += 4) {
  staticMap[r][20] = 6; staticMap[r][21] = 6;
  staticMap[r][25] = 6; staticMap[r][26] = 6;
}
// Shipping
staticMap[20][5] = 1; staticMap[20][6] = 1; staticMap[20][7] = 1;
staticMap[25][5] = 1; staticMap[25][6] = 1; staticMap[25][7] = 1;
// Packaging (New Zone)
for (let r = 18; r < 22; r+=2) { staticMap[r][22]=7; staticMap[r][23]=7; staticMap[r][24]=7; }
// Charging (10 Slots)
for (let c = 20; c < 29; c++) staticMap[28][c] = 5;

// Dividers
for (let i = 0; i < 15; i++) staticMap[i][15] = 4;
for (let i = 15; i < 30; i++) staticMap[i][15] = 4;
for (let j = 0; j < 13; j++) staticMap[15][j] = 4;
for (let j = 17; j < 30; j++) staticMap[15][j] = 4;

// Doors
for(let i=6; i<=8; i++) staticMap[i][15] = 0;  
for(let i=21; i<=23; i++) staticMap[i][15] = 0; 
for(let j=6; j<=8; j++) staticMap[15][j] = 0;  
for(let j=21; j<=23; j++) staticMap[15][j] = 0; 
for(let i=14; i<=16; i++) { for(let j=14; j<=16; j++) staticMap[i][j] = 0; }

// --- ROBOTS ---
let robots = [
  { id: 1, x: 14, y: 14, color: '#3b82f6', battery: 100, status: 'Idle', task: 'Ready', workTimer: 0, targetX: 14, targetY: 14 },
  { id: 2, x: 14, y: 16, color: '#ef4444', battery: 90, status: 'Idle', task: 'Ready', workTimer: 0, targetX: 14, targetY: 16 },
  { id: 3, x: 16, y: 14, color: '#eab308', battery: 80, status: 'Idle', task: 'Ready', workTimer: 0, targetX: 16, targetY: 14 },
  { id: 4, x: 16, y: 16, color: '#22c55e', battery: 70, status: 'Idle', task: 'Ready', workTimer: 0, targetX: 16, targetY: 16 },
  { id: 5, x: 15, y: 5, color: '#a855f7', battery: 50, status: 'Idle', task: 'Ready', workTimer: 0, targetX: 15, targetY: 5 }
];

// --- ZONES & WORK SCENARIOS ---
const ZONES = {
  "Warehouse":  { x: [2, 12], y: [2, 10], work: "Scanning Inventory..." },
  "Production": { x: [2, 12], y: [18, 28], work: "Conveying Confidential Data..." },
  "Shipping":   { x: [18, 28], y: [2, 10], work: "Handing Over Due Files..." },
  "Packaging":  { x: [18, 22], y: [20, 26], work: "Exchanging Meeting Files..." },
  "Charging":   { x: [27, 27], y: [20, 29], work: "Charging System..." } 
};

// --- HELPER: Find ANY free spot in the zone ---
// This ensures robots don't pile up; they find their own parking spot in the room.
function getFreeSpotInZone(zoneName) {
  const zone = ZONES[zoneName];
  if (!zone) return null;
  
  // Try 30 times to find a random empty tile in the room
  for(let i=0; i<30; i++) {
    let r = Math.floor(Math.random() * (zone.x[1] - zone.x[0]) + zone.x[0]);
    let c = Math.floor(Math.random() * (zone.y[1] - zone.y[0]) + zone.y[0]);
    
    // Valid spot: Floor (0) AND Not currently targeted by another robot
    if (staticMap[r][c] === 0 && !robots.some(bot => bot.targetX === r && bot.targetY === c)) {
      return { x: r, y: c };
    }
  }
  return { x: 15, y: 15 }; // Fallback to center corridor if room is 100% full
}

io.on("connection", (socket) => {
  socket.on("assignTask", (data) => {
    const { robotId, taskName } = data;
    const bot = robots.find(r => r.id === robotId);
    if (bot && ZONES[taskName]) {
      const spot = getFreeSpotInZone(taskName);
      bot.task = taskName; 
      bot.status = "Task Assigned"; 
      bot.workTimer = 0;
      bot.targetX = spot.x;
      bot.targetY = spot.y;
    }
  });
});

// A* Pathfinding
function findPath(startX, startY, targetX, targetY, grid, currentRobots) {
  let collisionMap = JSON.parse(JSON.stringify(grid));
  currentRobots.forEach(r => { if (r.x !== startX || r.y !== startY) collisionMap[r.x][r.y] = 99; });

  let queue = [[{ x: startX, y: startY }]];
  let visited = new Set([`${startX},${startY}`]);

  while (queue.length > 0) {
    let path = queue.shift();
    let { x, y } = path[path.length - 1];
    if (x === targetX && y === targetY) return path;

    [[0, 1], [0, -1], [1, 0], [-1, 0]].forEach(([dx, dy]) => {
      let nx = x + dx, ny = y + dy;
      if (nx >= 0 && nx < ROWS && ny >= 0 && ny < COLS &&
        (collisionMap[nx][ny] === 0 || collisionMap[nx][ny] === 3 || collisionMap[nx][ny] === 5) &&
        !visited.has(`${nx},${ny}`)) {
        visited.add(`${nx},${ny}`);
        queue.push([...path, { x: nx, y: ny }]);
      }
    });
  }
  return null;
}

setInterval(() => {
  robots.forEach(bot => {
    // 1. BATTERY SAFETY (Force Charge)
    if (bot.battery < 20 && bot.status !== 'Charging' && bot.status !== 'Low Battery') {
      bot.status = 'Low Battery'; 
      bot.task = 'Charging';
      const spot = getFreeSpotInZone("Charging");
      bot.targetX = spot.x; bot.targetY = spot.y;
    }

    // 2. WORK & CHARGING EXECUTION (When Arrived)
    if (bot.x === bot.targetX && bot.y === bot.targetY) {
       let currentZone = Object.keys(ZONES).find(key => bot.task === key);
       
       if (currentZone === "Charging") {
          // Check if actually near a charger pad
          let isNearCharger = false;
          [[0,1],[0,-1],[1,0],[-1,0]].forEach(([dx, dy]) => {
              let nx = bot.x + dx, ny = bot.y + dy;
              if(nx >= 0 && nx < ROWS && ny >= 0 && ny < COLS && staticMap[nx][ny] === 5) isNearCharger = true;
          });
          if(isNearCharger) {
             bot.status = "Charging...";
             bot.battery = Math.min(100, bot.battery + 2);
             if (bot.battery === 100) { bot.status = 'Idle'; bot.task = 'Ready'; }
          }
       } 
       else if (currentZone && bot.workTimer < 15) { // Work takes 15 ticks
          bot.status = ZONES[currentZone].work; // e.g. "Conveying Data..."
          bot.workTimer++;
       } 
       else if (currentZone && bot.workTimer >= 15) {
          bot.status = "Task Executed";
          bot.workTimer = 0;
       }
       return; // Stop moving while working
    }

    // 3. MOVEMENT
    if(!bot.status.includes('Charging') && !bot.status.includes('...')) {
       let path = findPath(bot.x, bot.y, bot.targetX, bot.targetY, staticMap, robots);
       if (path && path.length > 1) {
         bot.x = path[1].x; bot.y = path[1].y;
         bot.battery = Math.max(0, bot.battery - 0.05);
         heatmap[bot.x][bot.y] += 1;
         if(bot.status !== 'Low Battery') bot.status = "Finding Best Path"; 
       }
    }
  });
  io.emit("update", { grid: staticMap, robots: robots, heatmap: heatmap });
}, TICK_RATE);

server.listen(3001, () => { console.log('✅ MULTI-ACCESS BRAIN ACTIVE'); });