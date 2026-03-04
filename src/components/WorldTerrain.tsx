import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// ─── Seeded PRNG (LCG) — stable across re-renders ───────────────────────────
function makePRNG(seed: number) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(1664525, s) + 1013904223) >>> 0; return s / 0x100000000; };
}

// ─── Step 1: Build terrain geometry ──────────────────────────────────────────
function buildTerrainGeometry(): THREE.PlaneGeometry {
  const SIZE = 1200, SEGS = 240;
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEGS, SEGS);
  const pos = geo.attributes.position as THREE.BufferAttribute;

  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const wx = vx;
    const wz = -vy;
    const d = Math.hypot(wx, wz);

    const a = Math.sin(wx * 0.0085 + 1.7) * Math.cos(wz * 0.0078 + 0.9) * 14;
    const b = Math.sin(wx * 0.011 + 0.3) * Math.cos(wz * 0.013 - 1.1) * 10;
    const c = Math.sin((wx + wz * 0.85) * 0.021 + 2.0) * 5;
    const e = Math.cos((wx * 0.9 - wz) * 0.018 + 0.6) * 4;
    const f = Math.pow(Math.abs(Math.sin(wx * 0.0068 - wz * 0.0057 + 1.4)), 1.8) * 22;
    const g = Math.pow(Math.abs(Math.cos(wx * 0.005 + wz * 0.009 - 0.8)), 2.0) * 16;
    const h = Math.sin(wx * 0.055) * Math.cos(wz * 0.048) * 1.2;

    const raw = a + b + c + e + f + g + h;
    const fade = THREE.MathUtils.smoothstep(d, 65, 190);
    pos.setZ(i, raw * fade);
  }

  // Depress vertices inside the sandbox area so green terrain doesn't show through sand
  const SAND_HALF = 53; // slightly larger than the 100×100 sand plane
  const SAND_DEPTH = -8;
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const dx = SAND_HALF - Math.abs(vx);
    const dy = SAND_HALF - Math.abs(vy);
    if (dx > 0 && dy > 0) {
      const edgeDist = Math.min(dx, dy);
      const t = THREE.MathUtils.smoothstep(edgeDist, 0, 5);
      const currentZ = pos.getZ(i);
      pos.setZ(i, THREE.MathUtils.lerp(currentZ, SAND_DEPTH, t));
    }
  }

  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

// ─── Step 2: Raycast sampler ─────────────────────────────────────────────────
function buildHeightSampler(geo: THREE.PlaneGeometry) {
  const mat = new THREE.MeshBasicMaterial();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = -0.08;
  mesh.updateMatrixWorld(true);

  const raycaster = new THREE.Raycaster();
  const down = new THREE.Vector3(0, -1, 0);

  return (wx: number, wz: number): number => {
    raycaster.set(new THREE.Vector3(wx, 200, wz), down);
    const hits = raycaster.intersectObject(mesh);
    if (hits.length > 0) return hits[0].point.y;
    return -0.08;
  };
}

// ─── Pine tree (3-tier) ─────────────────────────────────────────────────────
function PineTree({ pos, scale, tint }: { pos: [number, number, number]; scale: number; tint: string }) {
  const s = scale;
  return (
    <group position={pos}>
      <mesh position={[0, 0.8 * s, 0]} castShadow>
        <cylinderGeometry args={[0.1 * s, 0.18 * s, 1.6 * s, 6]} />
        <meshStandardMaterial color="#5a3a1a" roughness={1} flatShading />
      </mesh>
      <mesh position={[0, 2.6 * s, 0]} castShadow>
        <coneGeometry args={[2.2 * s, 3.0 * s, 6]} />
        <meshStandardMaterial color={tint} roughness={1} flatShading />
      </mesh>
      <mesh position={[0, 4.4 * s, 0]} castShadow>
        <coneGeometry args={[1.6 * s, 2.6 * s, 6]} />
        <meshStandardMaterial color={tint} roughness={1} flatShading />
      </mesh>
      <mesh position={[0, 6.0 * s, 0]} castShadow>
        <coneGeometry args={[0.9 * s, 2.2 * s, 6]} />
        <meshStandardMaterial color={tint} roughness={1} flatShading />
      </mesh>
    </group>
  );
}

// ─── Bush (squat layered spheres) ────────────────────────────────────────────
function Bush({ pos, scale, tint }: { pos: [number, number, number]; scale: number; tint: string }) {
  const s = scale;
  return (
    <group position={pos}>
      <mesh position={[0, 0.5 * s, 0]} castShadow>
        <dodecahedronGeometry args={[1.0 * s, 0]} />
        <meshStandardMaterial color={tint} roughness={1} flatShading />
      </mesh>
      <mesh position={[0.6 * s, 0.3 * s, 0.3 * s]} castShadow>
        <dodecahedronGeometry args={[0.7 * s, 0]} />
        <meshStandardMaterial color={tint} roughness={1} flatShading />
      </mesh>
      <mesh position={[-0.4 * s, 0.35 * s, -0.4 * s]} castShadow>
        <dodecahedronGeometry args={[0.6 * s, 0]} />
        <meshStandardMaterial color={tint} roughness={1} flatShading />
      </mesh>
    </group>
  );
}

// ─── Grass tuft (thin cones in a cluster) ────────────────────────────────────
function GrassTuft({ pos, scale }: { pos: [number, number, number]; scale: number }) {
  const s = scale;
  return (
    <group position={pos}>
      <mesh position={[0, 0.4 * s, 0]} rotation={[0.1, 0, 0.15]} castShadow>
        <coneGeometry args={[0.15 * s, 0.9 * s, 4]} />
        <meshStandardMaterial color="#6b8a3a" roughness={1} flatShading />
      </mesh>
      <mesh position={[0.15 * s, 0.35 * s, 0.1 * s]} rotation={[-0.1, 0.5, -0.1]} castShadow>
        <coneGeometry args={[0.12 * s, 0.75 * s, 4]} />
        <meshStandardMaterial color="#7a9c44" roughness={1} flatShading />
      </mesh>
      <mesh position={[-0.12 * s, 0.38 * s, -0.08 * s]} rotation={[0.05, -0.3, 0.2]} castShadow>
        <coneGeometry args={[0.13 * s, 0.82 * s, 4]} />
        <meshStandardMaterial color="#5e7832" roughness={1} flatShading />
      </mesh>
    </group>
  );
}

// ─── Rock (squashed icosahedra pair) ─────────────────────────────────────────
function Rock({ pos, sx, sy, sz, ry }: { pos: [number, number, number]; sx: number; sy: number; sz: number; ry: number }) {
  return (
    <group position={pos} rotation={[0, ry, 0]}>
      <mesh scale={[sx, sy, sz]} castShadow>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#7a7060" roughness={1} flatShading />
      </mesh>
      <mesh position={[sx * 0.7, -sy * 0.1, 0]} scale={[sx * 0.65, sy * 0.7, sz * 0.55]} castShadow>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#6b6254" roughness={1} flatShading />
      </mesh>
    </group>
  );
}

// ─── Propeller Plane (low-poly) ─────────────────────────────────────────────
function PropellerPlane() {
  const groupRef = useRef<THREE.Group>(null);
  const propRef = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;

    const speed = 0.3;
    const radius = 160;
    const a = t * speed;

    // Position on elliptical orbit
    const x = Math.cos(a) * radius;
    const z = Math.sin(a) * radius * 0.85;
    const y = 72 + Math.sin(t * 0.5) * 5;
    groupRef.current.position.set(x, y, z);

    // Look-ahead point — the plane will face this direction
    const aheadT = t + 0.06;
    const aA = aheadT * speed;
    const ax = Math.cos(aA) * radius;
    const az = Math.sin(aA) * radius * 0.85;
    const ay = 72 + Math.sin(aheadT * 0.5) * 5;

    // lookAt makes the group's -Z face the target.
    // The inner group is rotated 180° Y so the model nose (+Z) becomes -Z → faces forward.
    groupRef.current.lookAt(ax, ay, az);

    // Bank into turns — compute signed curvature from path derivatives
    const eps = 0.01;
    const a1 = (t - eps) * speed;
    const a2 = (t + eps) * speed;
    const dx1 = -Math.sin(a1) * radius;
    const dz1 = Math.cos(a1) * radius * 0.85;
    const dx2 = -Math.sin(a2) * radius;
    const dz2 = Math.cos(a2) * radius * 0.85;
    const len1 = Math.sqrt(dx1 * dx1 + dz1 * dz1);
    const len2 = Math.sqrt(dx2 * dx2 + dz2 * dz2);
    const crossY = (dx1 / len1) * (dz2 / len2) - (dz1 / len1) * (dx2 / len2);
    const bankAngle = THREE.MathUtils.clamp(crossY * 80, -0.55, 0.55);
    groupRef.current.rotateZ(bankAngle);

    // Spin propeller
    if (propRef.current) {
      propRef.current.rotation.z += 40 * delta;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Inner group: scale only, nose naturally faces lookAt direction */}
      <group scale={[2.5, 2.5, 2.5]}>
        {/* Fuselage */}
        <mesh castShadow>
          <boxGeometry args={[1.2, 1, 5]} />
          <meshStandardMaterial color="#2255aa" roughness={0.8} flatShading />
        </mesh>
        {/* Nose cone */}
        <mesh position={[0, 0, 2.8]} castShadow rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.55, 1.2, 6]} />
          <meshStandardMaterial color="#1a4488" roughness={0.8} flatShading />
        </mesh>
        {/* Tail cone */}
        <mesh position={[0, 0, -2.8]} castShadow rotation={[-Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.45, 1.2, 6]} />
          <meshStandardMaterial color="#2255aa" roughness={0.8} flatShading />
        </mesh>

        {/* Wings */}
        <mesh position={[0, 0.1, 0]} castShadow>
          <boxGeometry args={[8, 0.15, 1.4]} />
          <meshStandardMaterial color="#2960b8" roughness={0.8} flatShading />
        </mesh>

        {/* Tail horizontal stabilizer */}
        <mesh position={[0, 0.2, -2.8]} castShadow>
          <boxGeometry args={[3, 0.12, 0.8]} />
          <meshStandardMaterial color="#2960b8" roughness={0.8} flatShading />
        </mesh>
        {/* Tail vertical stabilizer */}
        <mesh position={[0, 0.8, -2.8]} castShadow>
          <boxGeometry args={[0.12, 1.4, 0.8]} />
          <meshStandardMaterial color="#cc2222" roughness={0.8} flatShading />
        </mesh>

        {/* Cockpit windshield */}
        <mesh position={[0, 0.6, 0.8]} castShadow>
          <boxGeometry args={[0.8, 0.5, 0.9]} />
          <meshStandardMaterial color="#88ccff" roughness={0.3} metalness={0.4} flatShading />
        </mesh>

        {/* Landing gear struts */}
        <mesh position={[-0.5, -0.7, 0.5]} castShadow>
          <cylinderGeometry args={[0.05, 0.05, 0.6, 4]} />
          <meshStandardMaterial color="#444444" roughness={1} flatShading />
        </mesh>
        <mesh position={[0.5, -0.7, 0.5]} castShadow>
          <cylinderGeometry args={[0.05, 0.05, 0.6, 4]} />
          <meshStandardMaterial color="#444444" roughness={1} flatShading />
        </mesh>
        {/* Wheels */}
        <mesh position={[-0.5, -1.05, 0.5]} castShadow rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.15, 0.15, 0.1, 6]} />
          <meshStandardMaterial color="#222222" roughness={1} flatShading />
        </mesh>
        <mesh position={[0.5, -1.05, 0.5]} castShadow rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.15, 0.15, 0.1, 6]} />
          <meshStandardMaterial color="#222222" roughness={1} flatShading />
        </mesh>

        {/* Propeller hub */}
        <mesh position={[0, 0, 3.4]}>
          <sphereGeometry args={[0.2, 5, 4]} />
          <meshStandardMaterial color="#333333" roughness={0.8} flatShading />
        </mesh>
        {/* Propeller blades (spinning) */}
        <mesh ref={propRef} position={[0, 0, 3.5]}>
          <boxGeometry args={[2.4, 0.3, 0.05]} />
          <meshStandardMaterial color="#5a3a1a" roughness={0.9} flatShading />
        </mesh>

        {/* Wing stripes (red tips) */}
        <mesh position={[-3.5, 0.15, 0]} castShadow>
          <boxGeometry args={[1, 0.16, 1.3]} />
          <meshStandardMaterial color="#cc2222" roughness={0.8} flatShading />
        </mesh>
        <mesh position={[3.5, 0.15, 0]} castShadow>
          <boxGeometry args={[1, 0.16, 1.3]} />
          <meshStandardMaterial color="#cc2222" roughness={0.8} flatShading />
        </mesh>
      </group>
    </group>
  );
}

// ─── Hot Air Balloon (low-poly red) ─────────────────────────────────────────
function HotAirBalloon() {
  const ref = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    // Gentle oval orbit around the scene
    const orbitRadius = 200;
    const orbitSpeed = 0.04;
    const angle = t * orbitSpeed;
    ref.current.position.set(
      Math.cos(angle) * orbitRadius,
      65 + Math.sin(t * 0.3) * 4, // gentle bobbing
      Math.sin(angle) * orbitRadius * 0.7,
    );
    // Face direction of travel
    ref.current.rotation.y = -angle + Math.PI / 2;
    // Slight sway
    ref.current.rotation.z = Math.sin(t * 0.5) * 0.03;
  });

  return (
    <group ref={ref} scale={[1.3, 1.3, 1.3]}>
      {/* Envelope (balloon) — rounder, higher segment count */}
      {/* Main body */}
      <mesh position={[0, 7, 0]} castShadow>
        <sphereGeometry args={[6, 10, 8]} />
        <meshStandardMaterial color="#cc2222" roughness={0.9} flatShading />
      </mesh>
      {/* Upper dome */}
      <mesh position={[0, 11.5, 0]} castShadow>
        <sphereGeometry args={[4, 10, 7]} />
        <meshStandardMaterial color="#dd3333" roughness={0.9} flatShading />
      </mesh>
      {/* Top cap */}
      <mesh position={[0, 14.5, 0]} castShadow>
        <sphereGeometry args={[2, 8, 5]} />
        <meshStandardMaterial color="#bb1111" roughness={0.9} flatShading />
      </mesh>
      {/* Bottom cone / throat */}
      <mesh position={[0, 1.5, 0]} castShadow>
        <coneGeometry args={[4, 3.5, 8]} />
        <meshStandardMaterial color="#aa1818" roughness={0.9} flatShading />
      </mesh>

      {/* Ropes (4 lines from envelope to basket) */}
      {[
        [1.5, 0, 1.5],
        [1.5, 0, -1.5],
        [-1.5, 0, 1.5],
        [-1.5, 0, -1.5],
      ].map(([rx, _ry, rz], i) => (
        <mesh key={i} position={[rx! * 0.5, -1.5, rz! * 0.5]} castShadow>
          <cylinderGeometry args={[0.05, 0.05, 4, 3]} />
          <meshStandardMaterial color="#8B7355" roughness={1} flatShading />
        </mesh>
      ))}

      {/* Basket */}
      <group position={[0, -4, 0]}>
        {/* Basket body */}
        <mesh castShadow>
          <boxGeometry args={[2.2, 1.6, 2.2]} />
          <meshStandardMaterial color="#8B6914" roughness={1} flatShading />
        </mesh>
        {/* Basket rim */}
        <mesh position={[0, 0.9, 0]} castShadow>
          <boxGeometry args={[2.5, 0.2, 2.5]} />
          <meshStandardMaterial color="#6B4F10" roughness={1} flatShading />
        </mesh>
        {/* Basket bottom */}
        <mesh position={[0, -0.85, 0]} castShadow>
          <boxGeometry args={[2.0, 0.15, 2.0]} />
          <meshStandardMaterial color="#6B4F10" roughness={1} flatShading />
        </mesh>
      </group>

      {/* Flame glow (tiny bright sphere) */}
      <mesh position={[0, -0.5, 0]}>
        <sphereGeometry args={[0.3, 4, 3]} />
        <meshStandardMaterial color="#ff8800" emissive="#ff6600" emissiveIntensity={2} roughness={0.5} flatShading />
      </mesh>
    </group>
  );
}

// ─── Drifting cloud (group of soft spheres) ──────────────────────────────────
function CloudCluster({ startPos, speed, scale, seed }: {
  startPos: [number, number, number]; speed: number; scale: number; seed: number;
}) {
  const ref = useRef<THREE.Group>(null);
  const rand = useMemo(() => makePRNG(seed), [seed]);

  // Generate 5-8 overlapping spheres
  const puffs = useMemo(() => {
    const count = 5 + Math.floor(rand() * 4);
    return Array.from({ length: count }, () => ({
      x: (rand() - 0.5) * 12 * scale,
      y: (rand() - 0.5) * 2 * scale,
      z: (rand() - 0.5) * 6 * scale,
      r: (2 + rand() * 4) * scale,
    }));
  }, [rand, scale]);

  useFrame((_state, delta) => {
    if (ref.current) {
      ref.current.position.x += speed * delta;
      // Wrap around when too far
      if (ref.current.position.x > 600) ref.current.position.x = -600;
      if (ref.current.position.x < -600) ref.current.position.x = 600;
    }
  });

  return (
    <group ref={ref} position={startPos}>
      {puffs.map((p, i) => (
        <mesh key={i} position={[p.x, p.y, p.z]}>
          <sphereGeometry args={[p.r, 7, 5]} />
          <meshStandardMaterial color="#ffffff" roughness={1} transparent opacity={0.85} flatShading />
        </mesh>
      ))}
    </group>
  );
}

// ─── Animated birds (simple V shapes circling) ──────────────────────────────
function BirdFlock({ center, radius, height, count, seed }: {
  center: [number, number, number]; radius: number; height: number; count: number; seed: number;
}) {
  const ref = useRef<THREE.Group>(null);

  const birds = useMemo(() => {
    const rand = makePRNG(seed);
    return Array.from({ length: count }, () => ({
      offset: rand() * Math.PI * 2,
      radiusMul: 0.7 + rand() * 0.6,
      heightOff: (rand() - 0.5) * 4,
      speed: 0.15 + rand() * 0.15,
    }));
  }, [count, seed]);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    ref.current.children.forEach((child, i) => {
      const b = birds[i];
      const angle = t * b.speed + b.offset;
      const r = radius * b.radiusMul;
      child.position.set(
        center[0] + Math.cos(angle) * r,
        center[1] + height + b.heightOff + Math.sin(t * 2 + b.offset) * 0.5,
        center[2] + Math.sin(angle) * r,
      );
      child.rotation.y = -angle + Math.PI / 2;
    });
  });

  return (
    <group ref={ref}>
      {birds.map((_, i) => (
        <group key={i}>
          {/* Simple V-shape bird */}
          <mesh rotation={[0, 0, 0.4]}>
            <boxGeometry args={[0.6, 0.04, 0.12]} />
            <meshStandardMaterial color="#1a1a1a" roughness={1} />
          </mesh>
          <mesh rotation={[0, 0, -0.4]}>
            <boxGeometry args={[0.6, 0.04, 0.12]} />
            <meshStandardMaterial color="#1a1a1a" roughness={1} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ─── Sandbox Border (wooden planks) ─────────────────────────────────────────
function SandboxBorder() {
  const woodColor = '#9B7922';
  const darkWood = '#7A5F18';
  const wallH = 1.2;
  const wallThick = 0.8;
  const half = 50;
  const len = half * 2 + wallThick;

  return (
    <group>
      {/* North wall */}
      <mesh position={[0, wallH / 2 - 0.3, -half - wallThick / 2]} castShadow receiveShadow>
        <boxGeometry args={[len, wallH, wallThick]} />
        <meshStandardMaterial color={woodColor} roughness={0.95} flatShading />
      </mesh>
      {/* South wall */}
      <mesh position={[0, wallH / 2 - 0.3, half + wallThick / 2]} castShadow receiveShadow>
        <boxGeometry args={[len, wallH, wallThick]} />
        <meshStandardMaterial color={woodColor} roughness={0.95} flatShading />
      </mesh>
      {/* East wall */}
      <mesh position={[half + wallThick / 2, wallH / 2 - 0.3, 0]} castShadow receiveShadow>
        <boxGeometry args={[wallThick, wallH, len]} />
        <meshStandardMaterial color={woodColor} roughness={0.95} flatShading />
      </mesh>
      {/* West wall */}
      <mesh position={[-half - wallThick / 2, wallH / 2 - 0.3, 0]} castShadow receiveShadow>
        <boxGeometry args={[wallThick, wallH, len]} />
        <meshStandardMaterial color={woodColor} roughness={0.95} flatShading />
      </mesh>

      {/* Corner posts */}
      {[
        [half + 0.3, -half - 0.3],
        [half + 0.3, half + 0.3],
        [-half - 0.3, -half - 0.3],
        [-half - 0.3, half + 0.3],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, wallH / 2, z]} castShadow receiveShadow>
          <boxGeometry args={[1, wallH + 0.6, 1]} />
          <meshStandardMaterial color={darkWood} roughness={0.95} flatShading />
        </mesh>
      ))}

      {/* Sandbox floor (visible when digging to max depth) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -3.5, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#8B7355" roughness={1} />
      </mesh>
    </group>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────
export function WorldTerrain() {
  const { geometry, trees, bushes, grass, rocks, clouds } = useMemo(() => {
    // 1. Build terrain
    const geo = buildTerrainGeometry();
    const getY = buildHeightSampler(geo);

    // 2. Trees — proportional to distance band
    const rand1 = makePRNG(7331);
    const tints = ['#2d4e1e', '#354f1f', '#3b5c22', '#2a4820', '#4a6628'];
    const treeDefs: { pos: [number, number, number]; scale: number; tint: string }[] = [];

    while (treeDefs.length < 280) {
      const angle = rand1() * Math.PI * 2;
      const t = rand1();
      // Distribution: dense fringe, mid-field, far treeline
      let r: number;
      if (t < 0.35)      r = 68 + rand1() * 60;    // close fringe
      else if (t < 0.7)  r = 130 + rand1() * 150;   // mid-field
      else                r = 280 + rand1() * 260;   // far
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      if (Math.hypot(x, z) < 64) continue;

      const y = getY(x, z);

      // Scale proportional to distance band: close=small/medium, far=large
      let baseScale: number;
      if (r < 130)       baseScale = 0.6 + rand1() * 0.5;   // 0.6–1.1
      else if (r < 280)  baseScale = 0.8 + rand1() * 0.7;   // 0.8–1.5
      else                baseScale = 1.2 + rand1() * 1.0;   // 1.2–2.2

      treeDefs.push({
        pos: [x, y, z],
        scale: baseScale,
        tint: tints[Math.floor(rand1() * tints.length)],
      });
    }

    // 3. Bushes — fill gaps between trees near sand edge
    const rand3 = makePRNG(5566);
    const bushTints = ['#3a5c24', '#4a6830', '#2f4e20', '#506e2c'];
    const bushDefs: { pos: [number, number, number]; scale: number; tint: string }[] = [];

    while (bushDefs.length < 120) {
      const angle = rand3() * Math.PI * 2;
      const r = 58 + rand3() * 120;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      if (Math.hypot(x, z) < 54) continue;

      const y = getY(x, z);
      bushDefs.push({
        pos: [x, y, z],
        scale: 0.4 + rand3() * 0.6,
        tint: bushTints[Math.floor(rand3() * bushTints.length)],
      });
    }

    // 4. Grass tufts — transition border around sand
    const rand4 = makePRNG(9988);
    const grassDefs: { pos: [number, number, number]; scale: number }[] = [];

    while (grassDefs.length < 200) {
      const angle = rand4() * Math.PI * 2;
      const r = 48 + rand4() * 40; // right at sand edge
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;

      const y = getY(x, z);
      grassDefs.push({
        pos: [x, y, z],
        scale: 0.6 + rand4() * 0.8,
      });
    }

    // 5. Rocks — proportional sizing
    const rand2 = makePRNG(4242);
    const rockDefs: { pos: [number, number, number]; sx: number; sy: number; sz: number; ry: number }[] = [];

    while (rockDefs.length < 90) {
      const angle = rand2() * Math.PI * 2;
      const r = 55 + rand2() * 400;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;

      const y = getY(x, z) - 0.15;
      const sizeMul = r < 120 ? 0.3 + rand2() * 0.5 : r < 280 ? 0.5 + rand2() * 1.0 : 0.8 + rand2() * 1.5;
      rockDefs.push({
        pos: [x, y, z],
        sx: (0.4 + rand2() * 0.8) * sizeMul,
        sy: (0.3 + rand2() * 0.5) * sizeMul,
        sz: (0.4 + rand2() * 0.7) * sizeMul,
        ry: rand2() * Math.PI,
      });
    }

    // 6. Cloud positions
    const rand5 = makePRNG(1234);
    const cloudDefs: { startPos: [number, number, number]; speed: number; scale: number; seed: number }[] = [];

    for (let i = 0; i < 14; i++) {
      cloudDefs.push({
        startPos: [
          (rand5() - 0.5) * 1000,
          55 + rand5() * 50,
          (rand5() - 0.5) * 800,
        ],
        speed: 1.5 + rand5() * 3.5,
        scale: 0.8 + rand5() * 1.4,
        seed: Math.floor(rand5() * 100000),
      });
    }

    return { geometry: geo, trees: treeDefs, bushes: bushDefs, grass: grassDefs, rocks: rockDefs, clouds: cloudDefs };
  }, []);

  return (
    <group>
      {/* Ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.08, 0]} receiveShadow castShadow>
        <primitive object={geometry} attach="geometry" />
        <meshStandardMaterial color="#7b8c52" roughness={1} metalness={0} flatShading={true} />
      </mesh>

      {/* Trees */}
      {trees.map((t, i) => <PineTree key={`t${i}`} {...t} />)}

      {/* Bushes */}
      {bushes.map((b, i) => <Bush key={`b${i}`} {...b} />)}

      {/* Grass tufts */}
      {grass.map((g, i) => <GrassTuft key={`g${i}`} {...g} />)}

      {/* Rocks */}
      {rocks.map((r, i) => <Rock key={`r${i}`} {...r} />)}

      {/* Sandbox border */}
      <SandboxBorder />

      {/* Drifting clouds */}
      {clouds.map((c, i) => <CloudCluster key={`c${i}`} {...c} />)}

      {/* Bird flocks */}
      <BirdFlock center={[40, 0, -30]} radius={35} height={40} count={7} seed={111} />
      <BirdFlock center={[-80, 0, 60]} radius={50} height={55} count={5} seed={222} />
      <BirdFlock center={[120, 0, -100]} radius={40} height={45} count={6} seed={333} />

      {/* Hot air balloon */}
      <HotAirBalloon />

      {/* Propeller plane */}
      <PropellerPlane />
    </group>
  );
}
