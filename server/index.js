const express = require('express');

const http = require('http');

const { Server } = require("socket.io");

const cors = require('cors');



const app = express();

app.use(cors());

const server = http.createServer(app);

const io = new Server(server, { cors: { origin: "*" } });



// --- ⚙️ CONFIG & AUTONOMOUS THRESHOLDS ---

const ROWS = 50;
const COLS = 50;

const TICK_RATE = 300;

const MAX_CHARGING_SLOTS = 7;

const MAINTENANCE_THRESHOLD = 50;



// --- 📊 STATE AWARENESS ---

let staticMap = Array(ROWS).fill().map(() => Array(COLS).fill(0));

let heatmap = Array(ROWS).fill().map(() => Array(COLS).fill(0));

let taskHistory = [];

let taskQueue = []; // 📋 Pending Missions

let autopilotActive = true;

// ☀️ GLOBAL ENVIRONMENT STATE (SIEMS)
let solarIrradiance = 0; // W/m²
let solarClock = 0; // Ticks for oscillation

// 📊 MISSION ECONOMIC SCORE (MES)
let totalEnergyHarvested = 0; // Wh
let totalFleetROI = 0; // ₹ Saved
let totalCarbonOffset = 0; // kg CO2
let totalEfficiencyTicks = 0;
let totalTimeTicks = 0;



// --- 🏗️ VIRTUAL FACTORY LAYOUT (50x50) ---
// 1. Clear Grid
staticMap = Array(ROWS).fill().map(() => Array(COLS).fill(0));

// 2. Perimeter Walls
for (let i = 0; i < ROWS; i++) { staticMap[i][0] = 4; staticMap[i][COLS - 1] = 4; }
for (let j = 0; j < COLS; j++) { staticMap[0][j] = 4; staticMap[ROWS - 1][j] = 4; }

// 3. Zone Dividers
// Horiz Splits
for (let c = 1; c < COLS - 1; c++) {
  staticMap[18][c] = 4; // Split Top/Mid
  staticMap[35][c] = 4; // Split Mid/Bot
}
// Vert Splits
for (let r = 1; r < ROWS - 1; r++) {
  staticMap[r][18] = 4; // Left Divider
  staticMap[r][32] = 4; // Right Divider
}

// 4. Transit Arches/Gaps
// Horizontal Gaps (Crossings)
[8, 25, 42].forEach(c => {
  for (let d = 0; d < 4; d++) {
    if (staticMap[18][c + d] == 4) staticMap[18][c + d] = 0;
    if (staticMap[35][c + d] == 4) staticMap[35][c + d] = 0;
  }
});
// Vertical Gaps
[8, 26, 42].forEach(r => {
  for (let d = 0; d < 4; d++) {
    if (staticMap[r + d][18] == 4) staticMap[r + d][18] = 0;
    if (staticMap[r + d][32] == 4) staticMap[r + d][32] = 0;
  }
});

// 5. Asset Population
// Warehouse (Top Left): Racks (6)
for (let r = 2; r < 14; r += 3) for (let c = 2; c < 14; c += 3) staticMap[r][c] = 6;

// Overflow (Top Right): Racks (6)
for (let r = 2; r < 14; r += 3) for (let c = 34; c < 48; c += 3) staticMap[r][c] = 6;

// Production A (Mid Left) & B (Mid Right): Conveyors (7) & Arms (9)
// Prod A
for (let r = 22; r < 32; r += 4) {
  for (let c = 2; c < 12; c++) staticMap[r][c] = 7;
  staticMap[r][12] = 9;
}
// Prod B
for (let r = 22; r < 32; r += 4) {
  for (let c = 38; c < 48; c++) staticMap[r][c] = 7;
  staticMap[r][37] = 9;
}

// Packaging (Bot Left): Conveyors (7)
for (let c = 2; c < 14; c += 4) {
  for (let r = 38; r < 46; r++) staticMap[r][c] = 7;
}

// Shipping (Bot Right): Crates (8) & ATL Trailer
for (let r = 38; r < 44; r += 2) for (let c = 34; c < 48; c += 2) staticMap[r][c] = 8;
// ATL Dock (Bot Right Edge)
for (let c = 40; c < 48; c++) staticMap[48][c] = 7; // Conveyor loading into trailer

// Charging Bay (Bot Center): Ports (5)
for (let c = 22; c < 30; c += 2) staticMap[46][c] = 5;

// Quality Control (Center): Inspection Table (7 - conveyor loop)
for (let c = 24; c < 28; c++) staticMap[25][c] = 7;



// --- 🤖 FLEET INITIALIZATION ---

const BOT_MASS = 50; // kg (Virtual Mass for KERS)

let robots = [
  { id: 1, x: 22, y: 46, color: '#1e93ad', battery: 50, status: 'Charging Bay', task: 'Charging Bay', workTimer: 0, targetX: 22, targetY: 46, velocity: 0, prevVelocity: 0, stress: 0, paused: false, waitCount: 0, priority: Math.random(), motorTemp: 45, torqueRipple: 0.1, vibrationIndex: 0.5, health: 100 },
  { id: 2, x: 24, y: 46, color: '#865eb4', battery: 50, status: 'Charging Bay', task: 'Charging Bay', workTimer: 0, targetX: 24, targetY: 46, velocity: 0, prevVelocity: 0, stress: 0, paused: false, waitCount: 0, priority: Math.random(), motorTemp: 48, torqueRipple: 0.12, vibrationIndex: 0.6, health: 98 },
  { id: 3, x: 26, y: 46, color: '#d678a5', battery: 50, status: 'Charging Bay', task: 'Charging Bay', workTimer: 0, targetX: 26, targetY: 46, velocity: 0, prevVelocity: 0, stress: 0, paused: false, waitCount: 0, priority: Math.random(), motorTemp: 55, torqueRipple: 0.2, vibrationIndex: 0.8, health: 85 },
  { id: 4, x: 28, y: 46, color: '#7db460', battery: 50, status: 'Charging Bay', task: 'Charging Bay', workTimer: 0, targetX: 28, targetY: 46, velocity: 0, prevVelocity: 0, stress: 0, paused: false, waitCount: 0, priority: Math.random(), motorTemp: 42, torqueRipple: 0.08, vibrationIndex: 0.4, health: 100 },
  { id: 5, x: 30, y: 46, color: '#000000', battery: 50, status: 'Charging Bay', task: 'Charging Bay', workTimer: 0, targetX: 30, targetY: 46, velocity: 0, prevVelocity: 0, stress: 0, paused: false, waitCount: 0, priority: Math.random(), motorTemp: 60, torqueRipple: 0.15, vibrationIndex: 0.7, health: 90 }
];



const ZONE_CAPACITY = {
  "Warehouse": 5, "Production A": 3, "Production B": 3, "Quality Control": 4,
  "Packaging": 3, "Shipping": 5, "ATL Trailer": 2, "Charging Bay": 7, "Overflow": 3
};

const ZONES = {

  // Flow: Warehouse -> Production A -> Quality Control -> Packaging -> Shipping -> ATL Trailer
  "Warehouse": { x: [2, 15], y: [2, 15], labelPos: { x: 8.5, z: 8.5 }, next: "Production A", work: "Loading Raw Materials...", type: "EMPTY", weight: 0, action: "Loading" },

  "Overflow": { x: [34, 48], y: [2, 15], labelPos: { x: 41, z: 8.5 }, next: "Warehouse", work: "Stacking Reserve...", type: "RAW_MATERIAL", weight: 50, action: "Stacking" },

  "Production A": { x: [2, 15], y: [20, 32], labelPos: { x: 8.5, z: 26 }, next: "Quality Control", work: "Machining (Line A)...", type: "RAW_MATERIAL", weight: 50, action: "Machining" },

  "Production B": { x: [34, 48], y: [20, 32], labelPos: { x: 41, z: 26 }, next: "Quality Control", work: "Machining (Line B)...", type: "RAW_MATERIAL", weight: 50, action: "Machining" },

  "Quality Control": { x: [20, 30], y: [20, 30], labelPos: { x: 25, z: 25 }, next: "Packaging", work: "Vision Inspection...", type: "WIP", weight: 30, action: "Inspecting" },

  "Packaging": { x: [2, 15], y: [38, 48], labelPos: { x: 8.5, z: 43 }, next: "Shipping", work: "Sealing & Labeling...", type: "WIP", weight: 30, action: "Packing" },

  "Shipping": { x: [34, 48], y: [38, 45], labelPos: { x: 41, z: 41.5 }, next: "ATL Trailer", work: "Staging for Load...", type: "FINISHED_GOOD", weight: 100, action: "Staging" },

  "ATL Trailer": { x: [40, 48], y: [46, 49], labelPos: { x: 44, z: 47.5 }, next: "Warehouse", work: "Auto-Docking...", type: "FINISHED_GOOD", weight: 100, action: "Docking" },

  "Charging Bay": { x: [20, 30], y: [42, 49], labelPos: { x: 25, z: 45.5 }, work: "Rapid Charging...", type: "EMPTY", weight: 0, action: "Charging" },

  "Ready": { x: [22, 28], y: [22, 28], labelPos: { x: 21, z: 21 }, work: "Standby", type: "EMPTY", weight: 0, action: "Idle" }

};



// --- 📅 DAILY SCHEDULE ---
const DAILY_SCHEDULE = [
  { id: "S1", time: "09:00 AM", task: "Intake", zone: "Warehouse", status: "Pending", priority: 8 },
  { id: "S2", time: "10:30 AM", task: "Line Feed", zone: "Production A", status: "Pending", priority: 6 },
  { id: "S3", time: "11:45 AM", task: "QC Transfer", zone: "Quality Control", status: "Pending", priority: 7 },
  { id: "S4", time: "01:00 PM", task: "Export Load", zone: "Shipping", status: "Pending", priority: 5 },
  { id: "S5", time: "02:30 PM", task: "Scrap Clear", zone: "Overflow", status: "Pending", priority: 4 }
];

// --- 🧠 5️⃣ PREDICTIVE ANTI-DEADLOCK AGENT ---

/** 💰 SSI AUCTIONEER & ROI ENGINE */
function calculateROI(bot, task) {
  // 1. Identification & Distance
  // Estimate distance to zone center (Manhattan)
  const zone = ZONES[task.name];
  const destX = (zone.x[0] + zone.x[1]) / 2;
  const destY = (zone.y[0] + zone.y[1]) / 2;
  const distance = Math.abs(bot.x - destX) + Math.abs(bot.y - destY);

  // 2. Mechanical Wear Penalty
  // Penalty grows with Vibration Index & Stress
  const wearPenalty = (bot.stress * 1.5) + (bot.vibrationIndex * 20);

  // 3. Preventive Intercept (Critical Temp Override)
  // If temp > 75 (Critical), bid -Infinity for work, +Infinity for Charging/Maintenance.
  if (bot.motorTemp > 75) {
    if (task.name === 'Charging Bay') return Infinity;
    return -Infinity;
  }

  // 4. ROI Formula (Simplified per User Request)
  // ROI = (Priority * 10) - (Distance + Wear Penalty)
  // SIEMS UPDATE: If Solar > 800, Energy is free -> 50% discount on "Cost" (Distance + Wear)
  let cost = distance + wearPenalty;
  if (solarIrradiance > 800) cost *= 0.5;

  return (task.priority * 10) - cost;
}

setInterval(() => {
  // 📢 THE AUCTION (Every 5 Seconds)
  if (taskQueue.length === 0) return;

  const idleRobots = robots.filter(r => r.task === 'Ready');
  if (idleRobots.length === 0) return;

  // For each available task, find the Highest ROI bidder
  // (Simple Greedy: process highest priority task first)
  taskQueue.sort((a, b) => b.priority - a.priority);

  const task = taskQueue[0]; // Take top task
  let bestBot = null;
  let highestROI = -Infinity;

  idleRobots.forEach(bot => {
    const roi = calculateROI(bot, task);
    if (roi > highestROI) {
      highestROI = roi;
      bestBot = bot;
    }
  });

  // Assign if ROI is acceptable (absolute garbage bids ignored)
  if (bestBot && highestROI > -999) {
    totalFleetROI += highestROI * 0.5; // Accumulate "Saved Value"
    console.log(`🔨 Auction Won! Task: ${task.name} -> AGV-${bestBot.id} (ROI: ${highestROI.toFixed(2)})`);
    assignBotTask(bestBot, task.name);
    taskQueue.shift(); // Remove task
  }

}, 5000);

/** 🧠 HYBRID A* WITH DUBINS APPROACH & VDA 5050 OUTPUT */

/** 🧠 HYBRID A* WITH DUBINS APPROACH & VDA 5050 OUTPUT */
function findSmartPath(startX, startY, targetX, targetY, robotId) {
  // VDA 5050 Node Factory
  const createVDANode = (x, y, seq) => ({
    nodeId: `n-${x}-${y}`,
    sequenceId: seq,
    released: true,
    nodePosition: { x, y, mapId: "factory_v1" },
    actions: []
  });

  // 1️⃣ DUBINS-LIKE FINAL APPROACH (3-Unit Radius)
  // If close, attempt a smooth LSL/RSR style join (Manhattan L-shape is the grid equivalent)
  const dist = Math.abs(startX - targetX) + Math.abs(startY - targetY);
  if (dist <= 3) {
    // Try simple L-shape (Direct Drive) to avoid complex searching
    const approaches = [
      [{ x: targetX, y: startY }, { x: targetX, y: targetY }], // Horizontal first
      [{ x: startX, y: targetY }, { x: targetX, y: targetY }]  // Vertical first
    ];

    for (let currentApproach of approaches) {
      // Check if this L-shape is valid
      let valid = true;
      let corner = currentApproach[0];
      let end = currentApproach[1];

      // 🔍 PATH SEGMENT SCANNING (Collision Detection)
      // Segment 1: Start -> Corner
      let x1 = startX, y1 = startY, x2 = corner.x, y2 = corner.y;
      let dx = Math.sign(x2 - x1), dy = Math.sign(y2 - y1);

      // Scan Segment 1
      let cx = x1, cy = y1;
      while (cx !== x2 || cy !== y2) {
        cx += dx; cy += dy; // Move one step
        const v = staticMap[cx][cy];
        if (v === 4 || v === 6 || v === 7 || v === 8 || v === 9) { valid = false; break; } // Wall or Obstacle Hit
        if (robots.some(r => r.x === cx && r.y === cy)) { valid = false; break; } // Robot Hit
      }

      // Segment 2: Corner -> End (Only if Seg 1 was valid)
      if (valid) {
        x1 = corner.x; y1 = corner.y; x2 = end.x; y2 = end.y;
        dx = Math.sign(x2 - x1); dy = Math.sign(y2 - y1);
        cx = x1; cy = y1;
        while (cx !== x2 || cy !== y2) {
          cx += dx; cy += dy;
          const v = staticMap[cx][cy];
          if (v === 4 || v === 6 || v === 7 || v === 8 || v === 9) { valid = false; break; }
          if (robots.some(r => r.x === cx && r.y === cy)) { valid = false; break; }
        }
      }

      if (valid) {
        // Generate VDA Nodes for this simple curve
        return [
          createVDANode(currentApproach[0].x, currentApproach[0].y, 0),
          createVDANode(currentApproach[1].x, currentApproach[1].y, 1)
        ].filter(n => !(n.nodePosition.x === startX && n.nodePosition.y === startY));
      }
    }
  }

  // 2️⃣ HYBRID A* (Grid + Turn Penalties)
  let openList = [{ x: startX, y: startY, g: 0, f: 0, path: [], lastDx: 0, lastDy: 0 }];
  let closedSet = new Set();

  while (openList.length > 0) {
    openList.sort((a, b) => a.f - b.f);
    let current = openList.shift();

    if (current.x === targetX && current.y === targetY) {
      // Convert to VDA 5050
      return current.path.map((p, i) => createVDANode(p.x, p.y, i));
    }

    let key = `${current.x},${current.y}`;
    if (closedSet.has(key)) continue;
    closedSet.add(key);

    [[0, 1], [0, -1], [1, 0], [-1, 0]].forEach(([dx, dy]) => {
      let nx = current.x + dx, ny = current.y + dy;

      const val = staticMap[nx][ny];
      if (nx >= 0 && nx < ROWS && ny >= 0 && ny < COLS && val !== 4 && val !== 6 && val !== 7 && val !== 8 && val !== 9) {
        const blockingBot = robots.find(r => r.id !== robotId && r.x === nx && r.y === ny);

        let trafficCost = 1;
        if (blockingBot) {
          trafficCost = (blockingBot.status.includes("MAINTENANCE") || blockingBot.status.includes("YIELDING")) ? 255 : 50;
        }

        // 🏎️ Min Turning Radius Logic: Penalize sharp 90/180 turns
        // If we are changing direction, add penalty cost (approx 1.2m radius equivalent effort)
        let turnPenalty = 0;
        if (current.lastDx !== 0 || current.lastDy !== 0) {
          if (current.lastDx !== dx || current.lastDy !== dy) turnPenalty = 2; // Curve cost
        }

        let h = Math.abs(nx - targetX) + Math.abs(ny - targetY);
        let g = current.g + trafficCost + turnPenalty;

        openList.push({
          x: nx, y: ny,
          g, f: g + h,
          path: [...current.path, { x: nx, y: ny }],
          lastDx: dx, lastDy: dy
        });
      }
    });
  }
  return null;
}



function assignBotTask(bot, taskName) {

  const zone = ZONES[taskName] || ZONES["Ready"];

  const currentInZone = robots.filter(r => r.task === taskName).length;

  if (currentInZone >= (ZONE_CAPACITY[taskName] || 99)) {

    bot.status = "ZONE CAPACITY REACHED: QUEUING";

    return;

  }

  if (bot.task !== "Ready" && taskName === "Ready") {

    taskHistory.push({ id: bot.id, completedTask: bot.task, timestamp: Date.now() });

    if (taskHistory.length > 15) taskHistory.shift();

  }

  bot.task = taskName;

  bot.targetX = Math.floor(Math.random() * (zone.x[1] - zone.x[0]) + zone.x[0]);

  bot.targetY = Math.floor(Math.random() * (zone.y[1] - zone.y[0]) + zone.y[0]);

  bot.status = `Routing to ${taskName}`;
  bot.taskType = zone.type || "EMPTY";
  bot.payloadWeight = zone.weight || 0;
  bot.taskState = "In Transit";

  bot.workTimer = 0; bot.waitCount = 0;

}



io.on("connection", (socket) => {

  socket.on("toggleAutopilot", () => { autopilotActive = !autopilotActive; io.emit("autopilotStatus", autopilotActive); });

  socket.on("assignTask", ({ robotId, taskName }) => {

    const bot = robots.find(r => r.id === robotId);

    if (bot) { bot.paused = false; bot.stress = 0; assignBotTask(bot, taskName); }

  });

  // --- ⚙️ ADDED TO io.on("connection") ---

  socket.on("chatQuery", (query) => {
    const text = query.toLowerCase();
    let response = "I'm monitoring the fleet. How can I help?";

    if (text.includes("status") || text.includes("health") || text.includes("torque")) {
      const urgent = robots.filter(r => r.health < 60);
      if (urgent.length > 0) {
        response = `Warning: AGV-${urgent[0].id} reports ${Math.round(urgent[0].health)}% health integrity. Vibration index critical.`;
      } else {
        const avgStress = Math.round(robots.reduce((a, b) => a + b.stress, 0) / robots.length);
        const maxTorque = Math.max(...robots.map(r => r.torqueRipple || 0)).toFixed(2);
        response = `Fleet health nominal. Avg strain: ${avgStress}. Max Torque Ripple: ${maxTorque} (ISO Compliant).`;
      }
    }
    else if (text.includes("highest torque")) {
      const highest = robots.reduce((max, b) => b.torqueRipple > max.torqueRipple ? b : max, robots[0]);
      response = `AGV-${highest.id} has highest torque ripple (${highest.torqueRipple.toFixed(2)}). Monitor for potential bearing wear.`;
    }
    else if (text.includes("lowest battery") || text.includes("battery")) {
      const lowest = robots.reduce((min, b) => b.battery < min.battery ? b : min, robots[0]);
      response = `Fleet Avg Battery: ${Math.round(robots.reduce((a, b) => a + b.battery, 0) / robots.length)}%. AGV-${lowest.id} is lowest at ${Math.round(lowest.battery)}%. Predictive Charging active.`;
    }
    else if (text.includes("deadlock") || text.includes("stuck")) {
      const stuck = robots.filter(r => r.status.includes("DEADLOCK")).length;
      response = stuck > 0 ? `Alert: ${stuck} units in deadlock state. Auto-resolution active.` : "Traffic flow smooth. No deadlocks detected.";
    }
    else if (text.includes("force resolution") || text.includes("resolve deadlocks")) {
      robots.forEach(r => { if (r.status.includes("DEADLOCK")) { r.waitCount = 0; r.x = r.targetX; r.y = r.targetY; } });
      response = "Forcing global deadlock resolution... Teleporting stuck units to targets.";
    }
    else if (text.includes("emergency stop") || text.includes("halt")) {
      robots.forEach(r => r.paused = true);
      response = "🚨 GLOBAL E-STOP ENGAGED. All units halted.";
    }
    else if (text.includes("resume") || text.includes("start")) {
      robots.forEach(r => r.paused = false);
      response = "Resuming fleet operations.";
    }
    else if (text.includes("repair") || text.includes("fix")) {
      const id = text.match(/\d+/);
      if (id) {
        const bot = robots.find(r => r.id === parseInt(id[0]));
        if (bot) {
          bot.stress = 0;
          response = `Autonomous Repair command sent to AGV-${bot.id}. Stress reset to 0.`;
        }
      }
    }
    else if (Object.keys(ZONES).some(z => text.includes(z.toLowerCase()))) {
      const zoneName = Object.keys(ZONES).find(z => text.includes(z.toLowerCase()));
      const count = robots.filter(r => r.task === zoneName || r.status.includes(zoneName)).length;

      let detail = "";
      if (count > 0) {
        const types = robots.filter(r => r.task === zoneName).map(r => r.taskType).filter(t => t !== "EMPTY" && t).map(t => t.replace("_", " ")).join(", ");
        if (types) detail = ` Incoming goods: [${types}].`;
      }
      response = `Zone Analysis: ${zoneName} has ${count} active units.${detail}`;
    }
    else if (text.includes("heaviest") || text.includes("heavy")) {
      const heaviest = robots.reduce((max, r) => (r.payloadWeight || 0) > (max.payloadWeight || 0) ? r : max, robots[0]);
      response = `AGV-${heaviest.id} carrying heaviest load: ${heaviest.payloadWeight || 0}kg (${heaviest.taskType || 'None'}).`;
    }
    else if (text.includes("moving to") || text.includes("carrying")) {
      // Find zone name in text
      const zoneName = Object.keys(ZONES).find(z => text.includes(z.toLowerCase()));
      if (zoneName) {
        const bots = robots.filter(r => r.task === zoneName && r.taskType && r.taskType !== "EMPTY");
        if (bots.length > 0) {
          response = `In transit to ${zoneName}: ${bots.length} units carrying [${bots[0].taskType.replace("_", " ")}].`;
        } else {
          response = `No goods currently moving to ${zoneName}.`;
        }
      } else {
        response = "For transit data, please specify a zone (e.g., 'moving to Production A').";
      }
    }
    else if (text.includes("online")) {
      response = `System Online. Tracking ${robots.length} AGVs.`;
    }

    else if (text.includes("torque") || text.includes("spec") || text.includes("capacity")) {
      response = "BlueRoll Specs: Max Dynamic Load 1,020kg. Torque limit 45Nm. Thermal Cutoff at 75°C. Current fleet utilization is within safe VDA 5050 margins.";
    }
    else if (text.includes("error") || text.includes("code")) {
      response = "VDA 5050 Error Codes: E01=Path Blocked, E04=Emergency Stop, E09=Low Battery. No critical errors active.";
    }

    socket.emit("chatResponse", response);
  });

  // 🚨 PROACTIVE TORQUE MONITOR (Runs every 10s via client query usually, but simulated here via loop check)
  // We'll hook this into the main loop to push alerts if needed.

  socket.on("togglePause", (id) => {

    const bot = robots.find(r => r.id === id);

    if (bot) bot.paused = !bot.paused;

  });

});



// --- ⚙️ ORCHESTRATOR LOOP ---

setInterval(() => {

  const chargingNow = robots.filter(r => r.task === "Charging Bay").length;



  // ☀️ SIMULATE SOLAR IRRADIANCE (10 Minute Oscillation)
  // 10 mins = 600 seconds. Tick Rate = 300ms. 2000 ticks approx.
  solarClock++;
  solarIrradiance = 500 + 500 * Math.sin(solarClock * 0.003); // Oscillates 0 to 1000

  // Solar Energy Accrual (Approx 0.3s tick)
  // Power (W) * Time (h). 0.3s = 0.000083h. Assume 5 AGVs * 1m2 panel.
  // Increment global counter
  totalEnergyHarvested += (solarIrradiance * 5 * 0.000083);

  robots.forEach(bot => {

    if (bot.paused) return;

    // ☀️ SIEMS: ACTIVE STATUS
    bot.solarActive = solarIrradiance > 800;

    let isEfficient = false;

    // ⚡ KERS & VELOCITY TRACKING ⚡
    const v1 = bot.prevVelocity || 0;
    const v2 = bot.velocity;

    // KERS Recovery: 0.5 * m * (v1^2 - v2^2) * efficiency
    // Heavy Load Deceleration = 23% Efficiency, else 20%
    if (v2 < v1 && bot.task !== 'Ready' && bot.velocity > 0.1) {
      const loadMass = bot.payloadWeight || 0;
      const kersEfficiency = (loadMass > 80) ? 0.23 : 0.20;
      const totalMass = BOT_MASS + loadMass;

      const kersEnergy = 0.5 * totalMass * (Math.pow(v1, 2) - Math.pow(v2, 2)) * kersEfficiency;

      if (kersEnergy > 0) {
        bot.battery = Math.min(100, bot.battery + (kersEnergy * 0.05)); // Scaling
        totalEnergyHarvested += kersEnergy * 0.001;
        isEfficient = true;
      }
    }
    bot.prevVelocity = bot.velocity;

    // TRACK EFFICIENCY
    totalTimeTicks++;
    if (bot.solarActive) isEfficient = true;
    if (isEfficient) totalEfficiencyTicks++;

    // 🔋 SOFTWARE-DEFINED POWERBANK (15% Reserve)
    // If battery < 25 but Task is High Priority (Urgent) -> Unlock Reserve
    // We treat "Production" or "Shipping" as potential Urgent tasks if explicitly marked or implicitly needed
    // For now, if battery < 25, we usually force charge.
    // Logic: If battery < 10 (Critical), FORCE CHARGE. 
    // If 10 < Battery < 25, allow if Task Priority > 0.8 (simulated urgent)

    const isUrgent = bot.priority > 0.7; // Simulating 'Urgent' flag
    const reserveActive = isUrgent && bot.battery < 25 && bot.battery > 10;

    if (reserveActive) {
      bot.status = "⚠️ POWERBANK RESERVE ACTIVE";
    }



    // 🌡️ THERMAL FATIGUE & HEALTH CALCULATION
    if (bot.velocity > 0.8) bot.motorTemp += 0.5;
    else bot.motorTemp = Math.max(25, bot.motorTemp - 0.2); // Cools down when idle

    // Safe Mode: Throttle if too hot
    let speedLimit = 1.0;
    if (bot.motorTemp > 75) {
      speedLimit = 0.5;
      bot.status = "OVERHEAT: SAFE MODE";
    }

    // Health Decay: Based on Stress + Temp Extremes
    bot.health = Math.max(0, 100 - (bot.stress + Math.max(0, bot.motorTemp - 65) * 2));

    // 🤖 AUTOPILOT AGENT

    // 🤖 AUTOPILOT AGENT
    // Instead of assigning directly, push to Auction Queue
    if (autopilotActive && taskQueue.length < 3) {
      taskQueue.push({
        name: "Warehouse",
        priority: 5,
        id: Date.now() + Math.random(),
        type: "EMPTY", // Will pick up RAW at Warehouse
        weight: 0
      });
    }



    // 🔟 AUTONOMOUS SERVICE AGENT (Prevents maintenance downtime)
    // Intercept if Health drops below 40% (User specified Autonomous Intercept)
    if (bot.health < 40 && bot.task !== 'Charging Bay') {
      // Intercept bot for maintenance IMMEDIATELY
      if (bot.task === 'Ready' || bot.status !== "SERVICE INTERCEPT: REPAIRING") {
        assignBotTask(bot, "Charging Bay"); // Charging zone serves as a Repair Bay.
        bot.status = "SERVICE INTERCEPT: REPAIRING";
      }
    }



    // 🔋 NIGHT MODE PREDICTIVE CHARGING
    // If Solar < 200 (Night), increase reserve to 35%
    const baseThreshold = solarIrradiance < 200 ? 35 : 25;

    const shouldCharge = !reserveActive && (bot.battery < baseThreshold || (bot.battery < 65 && chargingNow < MAX_CHARGING_SLOTS && bot.task === 'Ready'));

    if (shouldCharge && bot.task !== 'Charging Bay') assignBotTask(bot, "Charging Bay");



    if (bot.x === bot.targetX && bot.y === bot.targetY) {

      bot.velocity = 0;

      if (bot.task === "Charging Bay") {

        bot.battery = Math.min(100, bot.battery + 2.5);
        bot.stress = Math.max(0, bot.stress - 5);
        bot.status = "RECOVERY & CHARGING";
        bot.taskState = "Charging";

        if (bot.battery > 95 && bot.stress === 0) assignBotTask(bot, "Ready");

      } else if (bot.task !== "Ready") {

        if (bot.workTimer < 15) {
          bot.status = ZONES[bot.task].work;
          bot.taskState = ZONES[bot.task].action || "Working";
          bot.workTimer++;
        }
        else {
          // Update Schedule Status
          const scheduleItem = DAILY_SCHEDULE.find(s => s.zone === bot.task && s.status === "Pending");
          if (scheduleItem) {
            scheduleItem.status = "Completed";
          }
          assignBotTask(bot, ZONES[bot.task].next);
        }

      }

    } else {

      let path = findSmartPath(bot.x, bot.y, bot.targetX, bot.targetY, bot.id);

      if (path && path.length > 0) {
        // VDA 5050 Node Unpacking
        const nextNode = path[0];
        const next = nextNode.nodePosition; // Extract {x,y} from VDA node

        const obstacleBot = robots.find(r => r.id !== bot.id && r.x === next.x && r.y === next.y);

        if (!obstacleBot) {
          // 📈 S-CURVE VELOCITY PROFILE (Jerk-Limited)
          const remainingDist = path.length;
          let targetSpeed = 1.0;
          let accelRate = 0.1;

          let brakingDist = 5.0;

          // 🏗️ LOAD PHYSICS
          if ((bot.payloadWeight || 0) > 80) { // Heavy Load (Finished Goods)
            accelRate *= 0.7; // -30% Acceleration
            brakingDist = 8.0; // Slower deceleration phase
          }

          // Apply S-Curve with Thermal Throttling
          if (remainingDist > brakingDist) {
            const variableAccel = accelRate * (1.2 - (bot.velocity / targetSpeed));
            bot.velocity = Math.min(bot.velocity + variableAccel, targetSpeed * speedLimit);
          } else {
            const approachPct = remainingDist / brakingDist;
            // Eased deceleration
            const easeSpeed = (Math.sin(approachPct * Math.PI / 2)) * targetSpeed * speedLimit;
            bot.velocity = Math.max(0.1, easeSpeed);
          }

          bot.x = next.x; bot.y = next.y;
          bot.battery -= (0.05 + (bot.velocity * 0.08));
          bot.status = "SMOOTH FLOW [VDA-ACTIVE]";
          bot.waitCount = 0;
          heatmap[bot.x][bot.y]++;

        } else {
          // 🚦 PROACTIVE DEADLOCK RESOLVER
          bot.velocity = 0;
          bot.waitCount++;
          bot.stress += 0.4;
          bot.status = "TRAFFIC DELAY";

          if (bot.waitCount > 1) {
            if (bot.priority < obstacleBot.priority) {
              bot.status = "DEADLOCK: YIELDING";
              const sides = [[0, 1], [0, -1], [1, 0], [-1, 0]];
              for (const [sx, sy] of sides) {
                const tx = bot.x + sx, ty = bot.y + sy;
                if (tx >= 0 && tx < ROWS && ty >= 0 && ty < COLS && staticMap[tx][ty] === 0) {
                  if (!robots.some(r => r.x === tx && r.y === ty)) {
                    bot.x = tx; bot.y = ty; bot.waitCount = 0; break;
                  }
                }
              }
            } else { bot.status = "DEADLOCK: RESOLVING"; }
          }
        }
      }

    }

  });



  io.emit("update", {
    // 📦 VDA 5050 v2.1.1 COMPLIANCE HEADER
    header: {
      timestamp: new Date().toISOString(),
      version: "2.1.1",
      manufacturer: "OptiFlow"
    },
    // PAYLOAD
    solarIrradiance,
    mesMetrics: {
      energyHarvested: totalEnergyHarvested.toFixed(2),
      carbonOffset: (totalEnergyHarvested * 0.0005).toFixed(4),
      fleetROI: totalFleetROI.toFixed(2),
      fleetEfficiency: totalTimeTicks > 0 ? ((totalEfficiencyTicks / totalTimeTicks) * 100).toFixed(1) : 0
    },
    grid: staticMap, robots, taskHistory, autopilotActive, taskQueue, zones: ZONES, schedule: DAILY_SCHEDULE,

    fleetStats: {

      avgBattery: Math.round(robots.reduce((a, b) => a + b.battery, 0) / robots.length),

      activeTasks: robots.filter(r => r.task !== 'Ready').length,

      totalCongestion: Math.round(robots.reduce((a, b) => a + b.stress, 0))

    }

  });

}, TICK_RATE);



server.listen(3001, () => { console.log('✅ OPTIFLOW V6.0 HYPER-AUTONOMOUS READY'); }); 