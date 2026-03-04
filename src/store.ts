import { create } from 'zustand';
import * as THREE from 'three';

// ─── Game State (Zustand Store) ───────────────────────────────────────────────
// We use zustand with getState()/setState() inside useFrame to avoid React
// re-renders in the 60fps hot loop. UI components can use selector subscriptions
// for reactive updates (e.g. kidsMode toggle).

export interface GameState {
  levers: number[];            // [Swing, Boom, Stick, Bucket] — range [-1, 1]
  hydraulicVelocities: number[]; // Smoothed lever values simulating fluid pressure lag
  trackVelocity: { forward: number; turn: number }; // WASD inertia
  swing: number;
  boomAngle: number;           // Start pointing forward/up
  stickAngle: number;          // Start pointing down/back towards cab
  bucketAngle: number;         // Start curled slightly
  absoluteBucketAngle: number;
  bucketFill: number;          // 0–100, percentage of sand in bucket
  diggerPos: THREE.Vector3;
  diggerRot: number;
  keys: { w: boolean; a: boolean; s: boolean; d: boolean };
  kidsMode: boolean;
  setKidsMode: (v: boolean) => void;
  toddlerMode: boolean;
  setToddlerMode: (v: boolean) => void;
  toddlerUnlocked: number;     // Progressive unlock: 1=Move, 2=+Arm, 3=+Dig
  setToddlerUnlocked: (v: number) => void;
  freeFly: boolean;            // F8 debug free-fly camera mode
  flyKeys: { w: boolean; a: boolean; s: boolean; d: boolean; space: boolean; shift: boolean };
}

export const useGameStore = create<GameState>((set) => ({
  levers: [0, 0, 0, 0],
  hydraulicVelocities: [0, 0, 0, 0],
  trackVelocity: { forward: 0, turn: 0 },
  swing: 0,
  boomAngle: -Math.PI / 4,
  stickAngle: Math.PI / 4,
  bucketAngle: -Math.PI / 4,
  absoluteBucketAngle: 0,
  bucketFill: 0,
  diggerPos: new THREE.Vector3(0, 0, 0),
  diggerRot: 0,
  keys: { w: false, a: false, s: false, d: false },
  kidsMode: false,
  setKidsMode: (v: boolean) => set({ kidsMode: v }),
  toddlerMode: false,
  setToddlerMode: (v: boolean) => set({ toddlerMode: v }),
  toddlerUnlocked: 1,
  setToddlerUnlocked: (v: number) => set({ toddlerUnlocked: v }),
  freeFly: false,
  flyKeys: { w: false, a: false, s: false, d: false, space: false, shift: false },
}));

// ─── Module-scope shared vectors ──────────────────────────────────────────────
// These are mutated in-place every frame by the Digger and read by Sand.
// They are NOT in zustand because they're Vector3 objects mutated 60× per second
// and zustand's immutable setState would create unnecessary garbage.

export const globalBucketPos = new THREE.Vector3();
export const globalBucketBottomPos = new THREE.Vector3();

// ─── Sand height query function ───────────────────────────────────────────────
// Set by the Sand component once the terrain geometry is ready.
// Read by the Digger component for ground collision detection.

export let getSandHeight = (_x: number, _z: number): number => 0;

export function setSandHeightFn(fn: (x: number, z: number) => number) {
  getSandHeight = fn;
}
