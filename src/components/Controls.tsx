import React, { useState } from 'react';
import { useGameStore } from '../store';

// ─── KidsLever Control ─────────────────────────────────────────────────────
// Big colorful lever with emoji, glow effects, and large touch target for kids

export function KidsLever({ 
  index, 
  name 
}: { 
  index: number; 
  name: string;
}) {
  const [val, setVal] = useState(0);
  const [isPressed, setIsPressed] = useState(false);
  const [glowIntensity, setGlowIntensity] = useState(0);

  const handleChange = (v: number) => {
    setVal(v);
    setGlowIntensity(Math.abs(v));
    useGameStore.getState().levers[index] = v;
  };

  const handlePointerDown = () => setIsPressed(true);
  const handlePointerUp = () => {
    setIsPressed(false);
    handleChange(0);
  };

  const config = [
    { // Turn (Swing)
      label: 'TURN',
      emoji: '↔️',
      color: 'from-red-400 to-red-600',
      borderColor: 'border-red-500',
      glowColor: 'rgba(255, 100, 100,',
    },
    { // Boom
      label: 'BOOM',
      emoji: '⬆️',
      color: 'from-blue-400 to-blue-600',
      borderColor: 'border-blue-500',
      glowColor: 'rgba(100, 150, 255,',
    },
    { // Stick
      label: 'REACH',
      emoji: '↕️',
      color: 'from-green-400 to-green-600',
      borderColor: 'border-green-500',
      glowColor: 'rgba(100, 255, 100,',
    },
    { // Bucket
      label: 'SCOOP',
      emoji: '🥄',
      color: 'from-purple-400 to-purple-600',
      borderColor: 'border-purple-500',
      glowColor: 'rgba(200, 100, 255,',
    },
  ];

  const c = config[index];

  return (
    <div className="flex flex-col items-center">
      {/* Large lever track */}
      <div 
        className="relative h-48 w-28 bg-neutral-900 rounded-full border-4 border-neutral-700 shadow-[inset_0_4px_12px_rgba(0,0,0,0.5)] overflow-visible flex justify-center"
        style={{
          boxShadow: isPressed 
            ? `inset 0 4px 12px rgba(0,0,0,0.5), 0 0 30px ${c.glowColor} 0.4)`
            : 'inset 0 4px 12px rgba(0,0,0,0.5)',
        }}
      >
        {/* Center marker */}
        <div className="absolute top-1/2 left-3 right-3 h-1.5 bg-neutral-800 -translate-y-1/2 rounded-full"></div>
        
        {/* Direction indicators */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 text-neutral-600 text-lg">▲</div>
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-neutral-600 text-lg">▼</div>

        {/* Invisible range input */}
        <input
          type="range"
          min="-1"
          max="1"
          step="0.01"
          value={val}
          onChange={(e) => handleChange(parseFloat(e.target.value))}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          className="absolute inset-0 w-full h-full opacity-0 cursor-ns-resize z-10"
          style={{ writingMode: 'vertical-lr', direction: 'rtl', touchAction: 'none' }}
        />

        {/* Large colorful knob with scale animation */}
        <div
          className={`absolute w-28 h-28 bg-gradient-to-b ${c.color} rounded-full shadow-[0_12px_24px_rgba(0,0,0,0.5)] border-4 ${c.borderColor} pointer-events-none transition-all duration-75 flex items-center justify-center`}
          style={{
            top: '50%',
            transform: `translate(0, calc(-50% + ${-val * 48}px)) scale(${isPressed ? 1.15 : 1})`,
            boxShadow: glowIntensity > 0.1
              ? `0 12px 24px rgba(0,0,0,0.5), 0 0 ${20 + glowIntensity * 30}px ${c.glowColor} ${0.5 + glowIntensity * 0.5})`
              : '0 12px 24px rgba(0,0,0,0.5)',
          }}
        >
          {/* Inner highlight */}
          <div className="absolute inset-2 rounded-full border-2 border-white/40"></div>
          
          {/* Emoji */}
          <span className="text-4xl drop-shadow-lg select-none">{c.emoji}</span>
          
          {/* Shine effect */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-6 bg-white/20 rounded-full blur-sm"></div>
        </div>

        {/* Active glow ring */}
        {glowIntensity > 0.1 && (
          <div 
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              boxShadow: `inset 0 0 ${20 + glowIntensity * 20}px ${c.glowColor} ${glowIntensity * 0.3})`,
            }}
          />
        )}
      </div>
    </div>
  );
}

// ─── DriveLever ───────────────────────────────────────────────────────────────
// Drive control for kids mode - big yellow lever with tractor emoji

export function DriveLever({ isKidsMode }: { isKidsMode?: boolean }) {
  const [val, setVal] = useState(0);
  const [isPressed, setIsPressed] = useState(false);
  const [glowIntensity, setGlowIntensity] = useState(0);

  const handleChange = (v: number) => {
    setVal(v);
    setGlowIntensity(Math.abs(v));
    const gs = useGameStore.getState();
    gs.keys.w = v < -0.1; // Up = forward
    gs.keys.s = v > 0.1;  // Down = backward
  };

  const handlePointerDown = () => setIsPressed(true);
  const handlePointerUp = () => {
    setIsPressed(false);
    setVal(0);
    setGlowIntensity(0);
    const gs = useGameStore.getState();
    gs.keys.w = false;
    gs.keys.s = false;
  };

  if (!isKidsMode) return null;

  const c = {
    label: 'DRIVE',
    emoji: '🚜',
    color: 'from-yellow-400 to-yellow-600',
    borderColor: 'border-yellow-500',
    glowColor: 'rgba(255, 200, 0,',
  };

  return (
    <div className="flex flex-col items-center">
      {/* Large lever track */}
      <div 
        className="relative h-48 w-28 bg-neutral-900 rounded-full border-4 border-neutral-700 shadow-[inset_0_4px_12px_rgba(0,0,0,0.5)] overflow-visible flex justify-center"
        style={{
          boxShadow: isPressed 
            ? `inset 0 4px 12px rgba(0,0,0,0.5), 0 0 30px ${c.glowColor} 0.4)`
            : 'inset 0 4px 12px rgba(0,0,0,0.5)',
        }}
      >
        {/* Center marker */}
        <div className="absolute top-1/2 left-3 right-3 h-1.5 bg-neutral-800 -translate-y-1/2 rounded-full"></div>
        
        {/* Direction indicators */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 text-neutral-600 text-lg">▲</div>
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-neutral-600 text-lg">▼</div>

        {/* Invisible range input */}
        <input
          type="range"
          min="-1"
          max="1"
          step="0.01"
          value={val}
          onChange={(e) => handleChange(parseFloat(e.target.value))}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          className="absolute inset-0 w-full h-full opacity-0 cursor-ns-resize z-10"
          style={{ writingMode: 'vertical-lr', direction: 'rtl', touchAction: 'none' }}
        />

        {/* Large colorful knob with scale animation */}
        <div
          className={`absolute w-28 h-28 bg-gradient-to-b ${c.color} rounded-full shadow-[0_12px_24px_rgba(0,0,0,0.5)] border-4 ${c.borderColor} pointer-events-none transition-all duration-75 flex items-center justify-center`}
          style={{
            top: '50%',
            transform: `translate(0, calc(-50% + ${-val * 48}px)) scale(${isPressed ? 1.15 : 1})`,
            boxShadow: glowIntensity > 0.1
              ? `0 12px 24px rgba(0,0,0,0.5), 0 0 ${20 + glowIntensity * 30}px ${c.glowColor} ${0.5 + glowIntensity * 0.5})`
              : '0 12px 24px rgba(0,0,0,0.5)',
          }}
        >
          {/* Inner highlight */}
          <div className="absolute inset-2 rounded-full border-2 border-white/40"></div>
          
          {/* Emoji */}
          <span className="text-4xl drop-shadow-lg select-none">{c.emoji}</span>
          
          {/* Shine effect */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-6 bg-white/20 rounded-full blur-sm"></div>
        </div>

        {/* Active glow ring */}
        {glowIntensity > 0.1 && (
          <div 
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              boxShadow: `inset 0 0 ${20 + glowIntensity * 20}px ${c.glowColor} ${glowIntensity * 0.3})`,
            }}
          />
        )}
      </div>
    </div>
  );
}
