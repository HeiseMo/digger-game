import React, { useEffect, useState, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Sky } from '@react-three/drei';
import { useGameStore } from './store';
import { Digger } from './components/Digger';
import { Sand } from './components/Sand';
import { WorldTerrain } from './components/WorldTerrain';
import { KidsLever, DriveLever } from './components/Controls';
import { FreeFlyCamera } from './components/FreeFlyCamera';

function LoadingScreen() {
  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-b from-sky-400 to-sky-200">
      <div className="relative">
        {/* Animated excavator emoji */}
        <div className="text-8xl animate-bounce" style={{ animationDuration: '1.5s' }}>🏗️</div>
      </div>
      <div className="mt-8 text-3xl font-black text-white drop-shadow-lg tracking-wide">DIGGER</div>
      <div className="mt-4 flex items-center gap-3">
        <div className="w-48 h-3 bg-white/30 rounded-full overflow-hidden">
          <div
            className="h-full bg-yellow-400 rounded-full"
            style={{
              animation: 'loading-bar 2s ease-in-out infinite',
            }}
          />
        </div>
      </div>
      <div className="mt-3 text-sm font-medium text-white/70">Building your sandbox...</div>
      <style>{`
        @keyframes loading-bar {
          0% { width: 0%; }
          50% { width: 80%; }
          100% { width: 100%; }
        }
      `}</style>
    </div>
  );
}

function SceneContent() {
  return (
    <>
      <Digger />
      <WorldTerrain />
      <Sand />
      <FreeFlyCamera />
    </>
  );
}

type ControlMode = 'normal' | 'kids';

export default function App() {
  const [controlMode, setControlMode] = useState<ControlMode>('normal');
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const freeFly = useGameStore((s) => s.freeFly);

  useEffect(() => {
    useGameStore.setState({ 
      kidsMode: controlMode === 'kids',
      toddlerMode: false 
    });
  }, [controlMode]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const gs = useGameStore.getState();

      // F8 toggles free-fly debug camera
      if (e.key === 'F8') {
        gs.freeFly = !gs.freeFly;
        useGameStore.setState({ freeFly: gs.freeFly });
        // Release pointer lock when exiting fly mode
        if (!gs.freeFly && document.pointerLockElement) {
          document.exitPointerLock();
        }
        return;
      }

      if (gs.freeFly) {
        // In free-fly mode, WASD/Space/Shift control the camera
        const fk = gs.flyKeys;
        if (e.key.toLowerCase() === 'w') fk.w = true;
        if (e.key.toLowerCase() === 'a') fk.a = true;
        if (e.key.toLowerCase() === 's') fk.s = true;
        if (e.key.toLowerCase() === 'd') fk.d = true;
        if (e.key === ' ') { fk.space = true; e.preventDefault(); }
        if (e.key === 'Shift') fk.shift = true;
      } else {
        const keys = gs.keys;
        if (e.key.toLowerCase() === 'w') keys.w = true;
        if (e.key.toLowerCase() === 'a') keys.a = true;
        if (e.key.toLowerCase() === 's') keys.s = true;
        if (e.key.toLowerCase() === 'd') keys.d = true;
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      const gs = useGameStore.getState();

      if (gs.freeFly) {
        const fk = gs.flyKeys;
        if (e.key.toLowerCase() === 'w') fk.w = false;
        if (e.key.toLowerCase() === 'a') fk.a = false;
        if (e.key.toLowerCase() === 's') fk.s = false;
        if (e.key.toLowerCase() === 'd') fk.d = false;
        if (e.key === ' ') fk.space = false;
        if (e.key === 'Shift') fk.shift = false;
      } else {
        const keys = gs.keys;
        if (e.key.toLowerCase() === 'w') keys.w = false;
        if (e.key.toLowerCase() === 'a') keys.a = false;
        if (e.key.toLowerCase() === 's') keys.s = false;
        if (e.key.toLowerCase() === 'd') keys.d = false;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const renderControls = () => {
    switch (controlMode) {
      case 'kids':
        return (
          <div className="flex gap-3 bg-gradient-to-t from-neutral-900/50 to-neutral-800/40 p-3 rounded-2xl border border-neutral-600/50 shadow-[0_-6px_24px_rgba(0,0,0,0.3)] backdrop-blur-sm">
            <DriveLever isKidsMode={true} />
            <KidsLever index={0} name="Turn" />
            <KidsLever index={1} name="Boom" />
            <KidsLever index={2} name="Stick" />
            <KidsLever index={3} name="Scoop" />
          </div>
        );
      default:
        return (
          <div className="flex gap-4 bg-neutral-950/80 p-4 rounded-xl border border-neutral-800">
            <NormalLever index={0} name="Swing" />
            <NormalLever index={1} name="Boom" />
            <NormalLever index={2} name="Stick" />
            <NormalLever index={3} name="Bucket" />
          </div>
        );
    }
  };

  const getModeButtonStyle = (mode: ControlMode) => {
    const base = 'px-4 py-2 rounded-lg transition-all duration-200 font-bold text-sm flex items-center gap-2';
    if (controlMode === mode) {
      switch (mode) {
        case 'kids':
          return `${base} bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-[0_4px_16px_rgba(100,200,255,0.4)] scale-105`;
        default:
          return `${base} bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-[0_4px_16px_rgba(255,150,100,0.4)] scale-105`;
      }
    }
    return `${base} bg-neutral-800 hover:bg-neutral-700 text-neutral-400`;
  };

  return (
    <div className="w-screen h-screen bg-black overflow-hidden relative font-sans select-none">
      
      {/* Loading Screen */}
      {!loaded && <LoadingScreen />}

      {/* 3D World */}
      <Canvas shadows onCreated={() => setLoaded(true)}>
        <fog attach="fog" args={['#c8dce8', 180, 700]} />
        <Sky sunPosition={[80, 18, 60]} turbidity={2.5} rayleigh={0.8} mieCoefficient={0.004} mieDirectionalG={0.8} />
        <ambientLight intensity={0.55} />
        <hemisphereLight args={['#a8c4e0', '#5c7a3a', 0.6]} />
        <directionalLight 
          position={[60, 80, 40]} 
          intensity={1.8} 
          castShadow 
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-60}
          shadow-camera-right={60}
          shadow-camera-top={60}
          shadow-camera-bottom={-60}
          shadow-camera-near={1}
          shadow-camera-far={300}
        />
        
        <Suspense fallback={null}>
          <SceneContent />
        </Suspense>
      </Canvas>

      {/* Cockpit UI Overlay */}
      {freeFly ? (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-red-600/90 text-white px-4 py-2 rounded font-mono text-sm pointer-events-none">
          FREE-FLY DEBUG — WASD move · Space/Shift up/down · Click to mouselook · F8 to exit
        </div>
      ) : (
      <>
      {/* Top-left mode switcher button */}
      <div className="absolute top-4 left-4 z-20 pointer-events-auto flex gap-2">
        <button
          onClick={() => setModeMenuOpen(!modeMenuOpen)}
          className={`px-4 py-2 rounded-lg font-bold text-sm backdrop-blur-sm transition-all duration-200 shadow-lg ${
            controlMode === 'kids'
              ? 'bg-gradient-to-r from-blue-500/80 to-cyan-500/80 text-white'
              : 'bg-gradient-to-r from-orange-500/80 to-red-500/80 text-white'
          }`}
        >
          {controlMode === 'kids' ? '🧸 Kids' : '👤 Normal'}
        </button>
        {modeMenuOpen && (
          <div className="absolute top-full left-0 mt-2 flex flex-col gap-1 bg-neutral-900/90 rounded-lg p-2 backdrop-blur-sm border border-neutral-700/50">
            <button
              onClick={() => { setControlMode('normal'); setModeMenuOpen(false); }}
              className={getModeButtonStyle('normal')}
            >
              👤 Normal
            </button>
            <button
              onClick={() => { setControlMode('kids'); setModeMenuOpen(false); }}
              className={getModeButtonStyle('kids')}
            >
              🧸 Kids
            </button>
          </div>
        )}
        <button
          onClick={() => {
            if (!document.fullscreenElement) {
              document.documentElement.requestFullscreen().catch(() => {});
            } else {
              document.exitFullscreen();
            }
          }}
          className="px-4 py-2 rounded-lg font-bold text-sm backdrop-blur-sm transition-all duration-200 shadow-lg bg-neutral-800/80 text-white hover:bg-neutral-700/80"
        >
          ⛶
        </button>
      </div>

      <div className="absolute inset-0 pointer-events-none flex flex-col justify-end z-10">
        {/* Dashboard / Control Panel */}
        <div className={`pointer-events-auto flex items-center justify-center px-4 ${controlMode === 'kids' ? 'h-56' : 'h-48'}`}>

          {/* Main Controls */}
          {renderControls()}

        </div>
      </div>
      </>
      )}

    </div>
  );
}

// Normal lever for adult mode (smaller, simpler)
function NormalLever({ index, name }: { index: number; name: string }) {
  const [val, setVal] = useState(0);

  const handleChange = (v: number) => {
    setVal(v);
    useGameStore.getState().levers[index] = v;
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">{name}</div>
      <div className="relative h-32 w-12 bg-neutral-950 rounded-lg border border-neutral-800 shadow-inner overflow-visible">
        <div className="absolute top-1/2 left-2 right-2 h-0.5 bg-neutral-800 -translate-y-1/2"></div>
        <input
          type="range"
          min="-1"
          max="1"
          step="0.01"
          value={val}
          onChange={(e) => handleChange(parseFloat(e.target.value))}
          onPointerUp={() => handleChange(0)}
          onPointerLeave={() => handleChange(0)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-ns-resize z-10"
          style={{ writingMode: 'vertical-lr', direction: 'rtl' }}
        />
        <div
          className="absolute w-10 h-10 bg-gradient-to-b from-orange-500 to-orange-700 rounded-full shadow-[0_4px_10px_rgba(0,0,0,0.5)] border-2 border-orange-400 pointer-events-none transition-transform duration-75"
          style={{
            top: '50%',
            left: '50%',
            transform: `translate(-50%, calc(-50% + ${-val * 48}px))`,
          }}
        >
          <div className="absolute inset-1 rounded-full border border-white/30"></div>
        </div>
      </div>
    </div>
  );
}
