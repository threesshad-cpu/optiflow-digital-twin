import React, { useState, useEffect } from 'react';

import io from 'socket.io-client';

import FactoryMap from './components/FactoryMap';

import './App.css';



import AIForeman from './components/AIForeman';

const SOCKET_URL = process.env.REACT_APP_SERVER_URL || "http://localhost:3001";
const socket = io.connect(SOCKET_URL);

function App() {

  const [data, setData] = useState({

    grid: [],

    robots: [],

    taskHistory: [],

    autopilotActive: true,

    // VDA 5050 & MES State
    mesMetrics: { energyHarvested: 0, carbonOffset: 0, fleetROI: 0 },

    fleetStats: { avgBattery: 0, activeTasks: 0, totalCongestion: 0 }
  });



  useEffect(() => {

    socket.on("update", (incoming) => setData(incoming));

    return () => socket.off("update");

  }, []);



  const toggleAutopilot = () => socket.emit("toggleAutopilot");

  const handleManualTask = (robotId, taskName) => socket.emit("assignTask", { robotId, taskName });

  const togglePause = (id) => socket.emit("togglePause", id);



  const fleetEnergy = data.fleetStats?.avgBattery || 0;

  const fleetStress = data.fleetStats?.totalCongestion || 0;


  const [messages, setMessages] = useState([{ text: "System online. Fleet-Bot ready.", type: "bot" }]);



  // --- ADD THIS EFFECT ---

  useEffect(() => {

    socket.on("chatResponse", (text) => {

      setMessages(prev => [...prev, { text, type: "bot" }]);

    });

    return () => socket.off("chatResponse");

  }, []);



  const handleSendMessage = (text) => {
    setMessages(prev => [...prev, { text: text, type: "user" }]);
    socket.emit("chatQuery", text);
  };

  // 🤖 5️⃣ & 🔟 AGENT STATUS COLOR LOGIC




  const [gridTheme, setGridTheme] = useState('light');

  const [cameraMode, setCameraMode] = useState('MANUAL');
  const [zoomRequest, setZoomRequest] = useState(null);

  const autoTarget = data.robots.slice().sort((a, b) => {
    // Priority: Low Health (<50) > High Priority Task
    const healthScoreA = a.health < 50 ? 1000 : 0;
    const healthScoreB = b.health < 50 ? 1000 : 0;
    const scoreA = healthScoreA + (a.priority || 0);
    const scoreB = healthScoreB + (b.priority || 0);
    return scoreB - scoreA;
  })[0];

  const getGoodName = (t) => {
    if (t === "RAW_MATERIAL") return "BlueRoll Casting";
    if (t === "WIP") return "Drive Assembly";
    if (t === "FINISHED_GOOD") return "Sealed Unit";
    return "Pallet";
  };

  return (
    <div className="app-container" style={{
      display: 'grid',
      gridTemplateColumns: '260px 1fr 380px',
      height: '100vh',
      background: '#f8fafc',
      color: '#1e293b',
      fontFamily: '"Inter", "Roboto", sans-serif',
      overflow: 'hidden'
    }}>

      {/* 1️⃣ COLUMN 1: DASHBOARD (LEFT) */}
      <div style={{
        background: '#ffffff',
        borderRight: '1px solid #e2e8f0',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
        zIndex: 10
      }}>
        {/* Header Logo Area */}
        <div>
          <h1 style={{ color: '#0f172a', margin: 0, letterSpacing: '-0.5px', fontSize: '20px', fontWeight: 900 }}>OPTIFLOW <span style={{ color: '#3b82f6' }}></span></h1>
          <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, marginTop: 4, letterSpacing: '0.5px' }}>INDUSTRIAL ORCHESTRATOR</div>
        </div>

        {/* MES Metrics Vertical Stack */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h3 style={{ fontSize: 11, fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>MES Performance</h3>

          {[
            { label: "VALUE PRESERVED", val: `₹${data.mesMetrics?.fleetROI || 0}`, color: "#0f172a", icon: "💰" },
            { label: "ENERGY HARVESTED", val: `${data.mesMetrics?.energyHarvested || 0} Wh`, color: "#10b981", icon: "⚡" },
            { label: "CARBON OFFSET", val: `${data.mesMetrics?.carbonOffset || 0} kg`, color: "#10b981", icon: "🌱" },
            { label: "FLEET EFFICIENCY", val: `${data.mesMetrics?.fleetEfficiency || 0}%`, color: "#c91e29", icon: "⚙️" }
          ].map((m, i) => (
            <div key={i} style={{
              background: '#f8fafc',
              padding: '16px',
              borderRadius: 12,
              border: '1px solid #e2e8f0'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 10, color: '#64748b', fontWeight: 700 }}>{m.label}</span>
                <span style={{ fontSize: 14 }}>{m.icon}</span>
              </div>
              <div style={{ fontSize: 18, color: m.color, fontWeight: 800, letterSpacing: '-0.5px' }}>{m.val}</div>
            </div>
          ))}
        </div>

        {/* Mission Queue (New Widget) */}
        <div style={{ padding: 16, background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0' }}>
          <h3 style={{ fontSize: 11, fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>Active Missions</h3>
          {data.taskQueue && data.taskQueue.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data.taskQueue.slice(0, 3).map((task, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11 }}>
                  <span>
                    <span style={{ fontWeight: 600, color: '#334155' }}>{i + 1}. {task.name}</span>
                    <br />
                    <span style={{ fontSize: 9, color: '#64748b' }}>Moving: <b>{getGoodName(task.type)}</b></span>
                  </span>
                  <span style={{ fontSize: 9, color: '#94a3b8', background: '#e2e8f0', padding: '2px 6px', borderRadius: 4 }}>P-{Math.round(task.priority * 10)}</span>
                </div>
              ))}
              {data.taskQueue.length > 3 && <div style={{ fontSize: 9, color: '#64748b', textAlign: 'center' }}>+ {data.taskQueue.length - 3} more</div>}
            </div>
          ) : (
            <div style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>No pending missions</div>
          )}
        </div>

        {/* 📅 OPERATIONS SCHEDULE (Draggable) */}
        <div style={{ padding: 16, background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0' }}>
          <h3 style={{ fontSize: 11, fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>Daily Operations</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(data.schedule || []).map((job) => (
              <div
                key={job.id}
                draggable
                onDragStart={(e) => { e.dataTransfer.setData("zone", job.zone); e.dataTransfer.setData("type", "schedule"); }}
                style={{
                  background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, padding: 10, cursor: 'grab',
                  borderLeft: '4px solid #3b82f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#334155' }}>{job.time}</div>
                  <div style={{ fontSize: 10, color: '#64748b' }}>{job.task}</div>
                </div>
                <div style={{ fontSize: 9, background: '#f1f5f9', padding: '2px 6px', borderRadius: 4, color: '#94a3b8' }}>
                  {job.status}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Safety Status */}
        <div style={{ marginTop: 'auto', padding: 16, background: '#fef2f2', borderRadius: 12, border: '1px solid #fecaca' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#b91c1c', fontWeight: 700, fontSize: 12 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', animation: 'pulse 1s infinite' }}></div>
            SAFETY HEARTBEAT
          </div>
          <div style={{ fontSize: 10, marginTop: 4, color: '#7f1d1d' }}>Tracking Area: 50x50m Verified | System Tick: 100ms</div>
        </div>
      </div>

      {/* 2️⃣ COLUMN 2: DIGITAL TWIN (CENTER) */}
      <div style={{ position: 'relative', background: '#e2e8f0' }}>
        <FactoryMap
          grid={data.grid}
          robots={data.robots}
          solarIrradiance={data.solarIrradiance}
          gridTheme={gridTheme}
          zones={data.zones}
          onZoneClick={(name) => handleSendMessage(`Status report for ${name}`)}
          cameraMode={cameraMode}
          targetBot={autoTarget}
          zoomRequest={zoomRequest}
        />

        {/* Toggle Grid Theme */}
        {/* Cam Controls */}
        <div style={{
          position: 'absolute',
          top: 24,
          right: 24,
          display: 'flex',
          gap: 12
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <button onClick={() => setZoomRequest({ dir: 'IN', id: Date.now() })} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'white', fontWeight: 900, fontSize: 18, color: '#334155', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
            <button onClick={() => setZoomRequest({ dir: 'OUT', id: Date.now() })} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'white', fontWeight: 900, fontSize: 18, color: '#334155', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>-</button>
          </div>
          <button
            onClick={() => setCameraMode(prev => prev === 'AUTO' ? 'MANUAL' : 'AUTO')}
            style={{
              background: cameraMode === 'AUTO' ? '#dc2626' : 'white',
              color: cameraMode === 'AUTO' ? 'white' : '#475569',
              border: 'none', padding: '8px 16px', borderRadius: 8, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }}
          >
            {cameraMode === 'AUTO' ? '🛑 STOP AUTO' : '🎥 AUTO PILOT'}
          </button>

          <button
            onClick={() => setCameraMode(prev => prev === 'TOUR' ? 'MANUAL' : 'TOUR')}
            style={{
              background: cameraMode === 'TOUR' ? '#3b82f6' : 'white',
              color: cameraMode === 'TOUR' ? 'white' : '#475569',
              border: 'none', padding: '8px 16px', borderRadius: 8, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }}
          >
            {cameraMode === 'TOUR' ? '⏹️ END TOUR' : '🚌 START TOUR'}
          </button>

          <div onClick={() => setGridTheme(prev => prev === 'light' ? 'dark' : 'light')}
            style={{ background: 'white', padding: '8px 12px', borderRadius: 8, cursor: 'pointer', fontWeight: 700, color: '#64748b', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
            {gridTheme === 'dark' ? '🌞' : '🌚'}
          </div>
        </div>
      </div>

      {/* 3️⃣ COLUMN 3: AI & UNIT DATA (RIGHT) */}
      <div style={{
        background: '#ffffff',
        borderLeft: '1px solid #e2e8f0',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden'
      }}>

        {/* Top Scrollable List: VDA 5050 Fleet State */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          <h3 style={{ fontSize: 12, fontWeight: 900, color: '#94a3b8', marginBottom: 16, letterSpacing: '0.5px' }}>VDA 5050 FLEET STATE</h3>

          {data.robots.map(bot => {
            const statusColors = {
              "Idle": "#64748b", "Working": "#3b82f6", "Charging": "#10b981",
              "DEADLOCK": "#ef4444", "SERVICE INTERCEPT": "#f59e0b"
            };
            const mainStatus = bot.status.split(":")[0];

            return (
              <div
                key={bot.id}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  const zone = e.dataTransfer.getData("zone");
                  if (zone) handleManualTask(bot.id, zone);
                }}
                style={{ background: 'white', borderRadius: 12, padding: 16, marginBottom: 16, border: '1px solid #e2e8f0', borderLeft: `6px solid ${bot.color}`, boxShadow: '0 2px 4px rgba(0,0,0,0.02)', position: 'relative', overflow: 'hidden' }}
              >
                {/* Reserve Alert */}
                {bot.status.includes("POWERBANK") && <div style={{ background: '#fef3c7', color: '#d97706', fontSize: 10, fontWeight: 800, padding: '4px 12px', textAlign: 'center', marginBottom: 12, borderRadius: 4 }}>⚠️ EMERGENCY RESERVE ACTIVE</div>}

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 900, color: '#0f172a' }}>AGV-{bot.id} <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 500 }}>| n-{bot.x}-{bot.y}</span></div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: statusColors[mainStatus] || '#3b82f6', marginTop: 2 }}>{bot.status}</div>
                  </div>
                  {/* Circular Gauges */}
                  <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', border: `3px solid ${bot.motorTemp > 60 ? '#ef4444' : '#e2e8f0'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#0f172a' }}>{Math.round(bot.motorTemp || 45)}°</div>
                      <span style={{ fontSize: 8, color: '#94a3b8', fontWeight: 600 }}>TEMP</span>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', border: `3px solid ${bot.health < 40 ? '#ef4444' : '#10b981'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#0f172a' }}>{Math.round(bot.health)}%</div>
                      <span style={{ fontSize: 8, color: '#94a3b8', fontWeight: 600 }}>HLTH</span>
                    </div>
                  </div>
                </div>

                {/* Payload & Load Bar */}
                <div style={{ marginBottom: 16, background: '#f8fafc', padding: 8, borderRadius: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 4 }}>
                    <span style={{ color: '#64748b', fontWeight: 600 }}>PAYLOAD:</span>
                    <span style={{ color: '#0f172a', fontWeight: 700 }}>{bot.payloadWeight || 0} kg </span>
                  </div>
                  <div style={{ width: '100%', height: 4, background: '#e2e8f0', borderRadius: 2 }}>
                    <div style={{ width: `${Math.min(100, bot.payloadWeight || 0)}%`, height: '100%', background: '#3b82f6', borderRadius: 2 }}></div>
                  </div>
                  <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 4, textAlign: 'right' }}>
                    Torque Load: {Math.round((bot.payloadWeight || 0) / 100 * 100)}%
                  </div>
                </div>

                {/* SOLAR BADGE */}
                {bot.solarActive && (
                  <div style={{ position: 'absolute', top: 0, right: 0, background: '#fef08a', padding: '2px 8px', borderBottomLeftRadius: 8, fontSize: 9, fontWeight: 800, color: '#854d0e' }}>
                    ☀️ SOLAR
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {/* Dynamic Zone Buttons from Server */}
                  {Object.keys(data.zones || {}).length > 0 ? (
                    Object.keys(data.zones).map(zone => (
                      <button key={zone} onClick={() => handleManualTask(bot.id, zone)} style={{ background: '#f1f5f9', border: 'none', padding: '6px', fontSize: 9, fontWeight: 700, color: '#475569', borderRadius: 4, cursor: 'pointer', transition: 'background 0.2s' }}>
                        {zone.toUpperCase()}
                      </button>
                    ))
                  ) : (
                    // Fallback if zones not loaded yet
                    ["Warehouse", "Charging Bay"].map(z => <span key={z}>Loading...</span>)
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Section: AI Foreman */}
        <div style={{ height: '45%', borderTop: '1px solid #e2e8f0', padding: 24, background: '#f8fafc' }}>
          <AIForeman messages={messages} onSendMessage={handleSendMessage} />
        </div>

      </div>

    </div>
  );
}



export default App; 