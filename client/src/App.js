import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import FactoryMap from './components/FactoryMap';
import './App.css';

// Leave empty to connect to the same host serving the page
const socket = io.connect();
function App() {
  const [grid, setGrid] = useState([]);
  const [robots, setRobots] = useState([]);
  const [heatmap, setHeatmap] = useState([]);

  useEffect(() => {
    socket.on("update", (data) => {
      setGrid(data.grid || []);
      setRobots(data.robots || []);
      setHeatmap(data.heatmap || []);
    });
  }, []);

  const assignTask = (robotId, taskName) => {
    socket.emit("assignTask", { robotId, taskName });
  };

  if (!grid || grid.length === 0) return <div style={{height:'100vh', background:'#0b1121', display:'flex', justifyContent:'center', alignItems:'center', color:'#38bdf8'}}><h2>BOOTING OPTIFLOW SYSTEMS...</h2></div>;

  const avgBattery = Math.round(robots.reduce((acc, bot) => acc + bot.battery, 0) / robots.length);

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0b1121', color: '#e2e8f0', fontFamily: 'monospace' }}>
      
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <FactoryMap grid={grid} robots={robots} heatmap={heatmap} />
        <div style={{ position: 'absolute', top: 24, left: 24, background: 'rgba(15, 23, 42, 0.9)', padding: '20px', borderRadius: '12px', border: '1px solid #1e293b' }}>
          <h1 style={{margin:0, fontSize: '1.5rem', color: '#38bdf8'}}>OPTIFLOW V5.0</h1>
          <div style={{display:'flex', gap:'12px', marginTop:'10px', fontSize: '0.8rem', color: '#94a3b8'}}>
             <span style={{color:'#22c55e'}}>● ONLINE</span>
             <span>AI: DEADLOCK ACTIVE</span>
          </div>
        </div>
      </div>

      <div style={{ width: '450px', background: '#0f172a', borderLeft: '1px solid #1e293b', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '24px', borderBottom: '1px solid #1e293b' }}>
          <h3 style={{ margin: 0, color: '#f8fafc' }}>FLEET OVERSIGHT</h3>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          <div style={{background:'#1e293b', padding:'16px', borderRadius:'8px', marginBottom: '20px', border:'1px solid #334155'}}>
             <div style={{color:'#94a3b8', fontSize:'0.7rem'}}>FLEET BATTERY</div>
             <div style={{fontSize:'2rem', fontWeight:'bold', color: avgBattery > 50 ? '#22c55e' : '#eab308'}}>{avgBattery}%</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {robots.map(bot => (
              <div key={bot.id} style={{ background: '#1e293b', padding: '15px', borderRadius: '8px', borderLeft: `4px solid ${bot.color}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <strong style={{color: '#f1f5f9', fontSize:'1.1rem'}}>AGV-{bot.id}</strong>
                  <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{bot.status}</span>
                </div>
                <div style={{ height: '6px', background: '#0f172a', borderRadius: '3px', marginBottom:'12px' }}>
                  <div style={{ height: '100%', width: `${bot.battery}%`, background: bot.battery < 20 ? '#ef4444' : '#38bdf8' }}></div>
                </div>
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'5px'}}>
                   <button onClick={() => assignTask(bot.id, "Warehouse")} style={getBtnStyle(bot.task, "Warehouse")}>📦 Warehouse</button>
                   <button onClick={() => assignTask(bot.id, "Production")} style={getBtnStyle(bot.task, "Production")}>⚙️ Production</button>
                   <button onClick={() => assignTask(bot.id, "Shipping")} style={getBtnStyle(bot.task, "Shipping")}>🚢 Shipping</button>
                   <button onClick={() => assignTask(bot.id, "Charging")} style={getBtnStyle(bot.task, "Charging")}>⚡ Charging</button>
                   <button onClick={() => assignTask(bot.id, "Packaging")} style={getBtnStyle(bot.task, "Packaging")}>📦 Packaging</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const getBtnStyle = (currentTask, btnTask) => {
  const isActive = currentTask === btnTask;
  return {
    background: isActive ? '#22c55e' : '#334155', 
    color: isActive ? '#000' : '#cbd5e1',
    fontWeight: isActive ? 'bold' : 'normal',
    border: 'none', borderRadius: '4px', padding: '8px',
    fontSize: '0.75rem', cursor: 'pointer', transition: '0.2s'
  };
};

export default App;