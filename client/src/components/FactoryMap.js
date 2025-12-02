import React from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text, RoundedBox, Environment, Grid } from '@react-three/drei';
import * as THREE from 'three';
import io from 'socket.io-client';

// Leave empty to connect to the same host serving the page
const socket = io.connect();

// --- ASSETS ---
const Rack = ({ position }) => (
  <group position={[position[0], 0, position[1]]}>
    {[[0.4,0.4],[-0.4,0.4],[0.4,-0.4],[-0.4,-0.4]].map((p,i)=><mesh key={i} position={[p[0],0.6,p[1]]}><boxGeometry args={[0.05,1.25,0.05]} /><meshStandardMaterial color="#0033cc"/></mesh>)}
    {[0.1,0.6,1.1].map((y,i)=><mesh key={i} position={[0,y,0]}><boxGeometry args={[0.92,0.03,0.92]} /><meshStandardMaterial color="#f97316"/></mesh>)}
    <RoundedBox args={[0.3,0.3,0.3]} position={[0,0.3,0]} radius={0.02}><meshStandardMaterial color="#c29b61"/></RoundedBox>
  </group>
);

const Machine = ({ position }) => (
  <group position={[position[0], 0, position[1]]}>
     <RoundedBox args={[0.9, 1.2, 0.9]} position={[0, 0.6, 0]} radius={0.05}><meshStandardMaterial color="#334155" metalness={0.9} /></RoundedBox>
     <mesh position={[0, 1.3, 0]}><cylinderGeometry args={[0.05, 0.05, 0.2]} /><meshStandardMaterial color="#06b6d4" emissive="#06b6d4" emissiveIntensity={3} /></mesh>
  </group>
);

const Conveyor = ({ position }) => (
  <group position={[position[0], 0, position[1]]}>
     <mesh position={[0, 0.2, 0]}><boxGeometry args={[0.9, 0.4, 0.9]} /><meshStandardMaterial color="#444" /></mesh>
     <mesh position={[0, 0.41, 0]}><planeGeometry args={[0.8, 0.8]} rotation={[-Math.PI/2,0,0]} /><meshStandardMaterial color="#222" /></mesh>
     <RoundedBox args={[0.4, 0.2, 0.4]} position={[0, 0.5, 0]} radius={0.02}><meshStandardMaterial color="#a855f7" /></RoundedBox>
  </group>
);

const Charger = ({ position }) => (
  <group position={[position[0], 0, position[1]]}>
     <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}><planeGeometry args={[0.5, 0.5]} /><meshStandardMaterial color="#eab308" emissive="#eab308" /></mesh>
  </group>
);

const FloorTile = ({ position, heatLevel, onToggle }) => {
  let color = "#1e293b"; 
  if (heatLevel > 0) color = new THREE.Color().lerpColors(new THREE.Color("#1e293b"), new THREE.Color("#ef4444"), Math.min(heatLevel/50, 1));
  return (
    <group position={[position[0], 0, position[1]]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]}><planeGeometry args={[0.95, 0.95]} /><meshStandardMaterial color={color} /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]} onClick={(e) => { e.stopPropagation(); onToggle(position[0], position[1]); }}><planeGeometry args={[0.95, 0.95]} /><meshBasicMaterial color="black" transparent opacity={0.0} /></mesh>
    </group>
  );
};

// --- ROBOT (With Process Status) ---
const AGV = ({ data }) => {
  // Color code based on activity
  let statusColor = "#22c55e"; // Green (Working/Moving)
  if(data.status === 'Low Battery') statusColor = "#ef4444";
  if(data.status.includes('Charging')) statusColor = "#eab308";
  if(data.status === 'Finding Best Path') statusColor = "#38bdf8"; 

  return (
    <group position={[data.x, 0, data.y]}>
      <RoundedBox args={[0.65, 0.35, 0.5]} radius={0.05} smoothness={4} position={[0, 0.2, 0]}><meshStandardMaterial color="#ffffff" /></RoundedBox>
      <mesh position={[0, 0.4, 0]}><cylinderGeometry args={[0.06, 0.06, 0.05]} /><meshStandardMaterial color={data.color} emissive={data.color} emissiveIntensity={4} /></mesh>
      <Text position={[0, 0.9, 0]} fontSize={0.4} color="white" outlineWidth={0.04} outlineColor="black" anchorY="bottom">AGV-{data.id}</Text>
      
      {/* THIS SHOWS THE SPECIFIC WORK PROCESS */}
      <Text position={[0, 1.4, 0]} fontSize={0.25} color={statusColor} outlineWidth={0.02} outlineColor="black" anchorY="bottom">{data.status}</Text>
    </group>
  );
};

const RoomLabel = ({ text, position }) => (
  <Text position={[position[0], 2, position[1]]} fontSize={1.5} color="white" outlineWidth={0.05} outlineColor="black" rotation={[-Math.PI/2, 0, 0]}>{text}</Text>
);

const FactoryMap = ({ grid, robots, heatmap }) => {
  const handleToggle = (x, y) => socket.emit("toggleWall", { x, y });

  return (
    <Canvas camera={{ position: [15, 45, 45], fov: 40 }} shadows>
      <color attach="background" args={['#0b1121']} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[20, 30, 20]} intensity={1.2} />
      <Environment preset="city" />
      <OrbitControls target={[15, 0, 15]} minDistance={5} maxDistance={100} />
      
      <RoomLabel text="WAREHOUSE" position={[6, 6]} />
      <RoomLabel text="PRODUCTION" position={[6, 24]} />
      <RoomLabel text="SHIPPING" position={[24, 6]} />
      <RoomLabel text="CHARGING" position={[24, 24]} />
      <RoomLabel text="PACKAGING" position={[20, 24]} />

      <group>
        {grid.map((row, x) =>
          row.map((cell, y) => {
            if (cell === 1) return <Rack key={`${x}-${y}`} position={[x, y]} />;
            if (cell === 5) return <Charger key={`${x}-${y}`} position={[x, y]} />;
            if (cell === 6) return <Machine key={`${x}-${y}`} position={[x, y]} />;
            if (cell === 7) return <Conveyor key={`${x}-${y}`} position={[x, y]} />;
            if (cell !== 4) return <FloorTile key={`${x}-${y}`} position={[x, y]} heatLevel={heatmap ? heatmap[x][y] : 0} onToggle={handleToggle} />;
            return null;
          })
        )}
      </group>
      {grid.map((row,x)=>row.map((cell,y)=> cell===4 ? <mesh key={`w${x}${y}`} position={[x,0.75,y]}><boxGeometry args={[1,1.5,1]}/><meshStandardMaterial color="#475569"/></mesh> : null))}

      {robots.map(bot => <AGV key={bot.id} data={bot} />)}
      <Grid position={[15, 0.01, 15]} args={[40, 40]} cellSize={1} cellThickness={0.5} sectionColor={'#1e293b'} cellColor={'#0f172a'} fadeDistance={60} />
      <mesh rotation={[-Math.PI/2, 0, 0]} position={[15, -0.01, 15]}><planeGeometry args={[60, 60]} /><meshStandardMaterial color="#020617" /></mesh>
    </Canvas>
  );
};

export default FactoryMap;