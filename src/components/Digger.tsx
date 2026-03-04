import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore, globalBucketPos, globalBucketBottomPos, getSandHeight } from '../store';
import { getSandTexture, getMetalTexture } from '../textures';
import { Hydraulic } from './Hydraulic';
import { CustomBucket } from './Bucket';

// ─── Excavator Scene Graph ────────────────────────────────────────────────────
//
// JOINT HIERARCHY (forward kinematics — each child inherits parent transforms):
//
//   baseRef              Root group — positioned at diggerPos, rotated by diggerRot
//   └── cabRef           Swing platform — rotation.y = swing angle
//       ├── Camera       First-person view inside cab
//       ├── Cab body     Floor + dashboard meshes
//       └── Arm Base     Mounting point for the boom
//           ├── Boom Hydraulics (L+R)   lookAt → boomCylTarget on boom
//           └── boomRef                 rotation.x = boomAngle
//               ├── Boom body + side plates + joints
//               ├── Stick Hydraulic     lookAt → stickCylTarget on stick
//               └── stickRef            rotation.x = stickAngle
//                   ├── Stick body + reinforcement
//                   ├── Bucket Hydraulic lookAt → bucketCylTarget on bucket
//                   └── bucketRef        rotation.x = bucketAngle
//                       ├── Bucket Hydraulic Target
//                       └── CustomBucket (geometry + BucketSand particles)
//
// ANIMATION LOOP (inside useFrame):
//   1. Smooth lever inputs → hydraulicVelocities (simulates fluid pressure lag)
//   2. Apply WASD driving with inertia
//   3. Apply joint angle changes from smoothed velocities, clamp to limits
//   4. Update world positions of bucket tip/bottom for Sand collision
//   5. Ground collision — push boom up if bucket penetrates terrain
//   6. Sand stream visual for dumping

export function Digger() {
  const texture = useMemo(() => getSandTexture(), []);
  const metalTexture = useMemo(() => getMetalTexture(), []);
  const freeFly = useGameStore((s) => s.freeFly);

  const baseRef = useRef<THREE.Group>(null);
  const cabRef = useRef<THREE.Group>(null);
  const boomRef = useRef<THREE.Group>(null);
  const stickRef = useRef<THREE.Group>(null);
  const bucketRef = useRef<THREE.Group>(null);
  const bucketTipRef = useRef<THREE.Object3D>(null);
  const bucketBottomRef = useRef<THREE.Object3D>(null);
  const sandStreamRef = useRef<THREE.Mesh>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);
  const cabLookRef = useRef({ x: 0, y: 0, smoothX: 0, smoothY: 0 });

  // Click/touch-drag cockpit look-around
  useEffect(() => {
    const look = cabLookRef.current;
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let baseX = 0;
    let baseY = 0;

    const onDown = (cx: number, cy: number) => {
      dragging = true;
      startX = cx;
      startY = cy;
      baseX = look.x;
      baseY = look.y;
    };
    const onMove = (cx: number, cy: number) => {
      if (!dragging) return;
      // Sensitivity: pixels to normalized look range
      const sens = 3.0 / Math.min(window.innerWidth, window.innerHeight);
      look.x = THREE.MathUtils.clamp(baseX + (cx - startX) * sens, -1, 1);
      look.y = THREE.MathUtils.clamp(baseY - (cy - startY) * sens, -1, 1);
    };
    const onUp = () => {
      dragging = false;
      // Smoothly return to center (handled in useFrame via lerp to 0)
      look.x = 0;
      look.y = 0;
    };

    const isOverUI = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false;
      // Check if the click/touch landed on or inside a UI control (pointer-events-auto)
      return !!target.closest('.pointer-events-auto');
    };

    const handleMouseDown = (e: MouseEvent) => { if (e.button === 0 && !isOverUI(e.target)) onDown(e.clientX, e.clientY); };
    const handleMouseMove = (e: MouseEvent) => onMove(e.clientX, e.clientY);
    const handleMouseUp = () => onUp();

    const handleTouchStart = (e: TouchEvent) => { if (!isOverUI(e.target)) { const t = e.touches[0]; onDown(t.clientX, t.clientY); } };
    const handleTouchMove = (e: TouchEvent) => { const t = e.touches[0]; onMove(t.clientX, t.clientY); };
    const handleTouchEnd = () => onUp();

    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

  // Hydraulic target refs — placed on child parts, move when joints rotate
  const boomCylTargetLRef = useRef<THREE.Object3D>(null);
  const boomCylTargetRRef = useRef<THREE.Object3D>(null);
  const stickCylTargetRef = useRef<THREE.Object3D>(null);
  const bucketCylTargetRef = useRef<THREE.Object3D>(null);

  useFrame((_state, delta) => {
    const gs = useGameStore.getState();

    // 1. Hydraulic spool valve simulation — fluid pressure builds up and releases smoothly
    const hydraulicResponsiveness = 3.0;
    for (let i = 0; i < 4; i++) {
      gs.hydraulicVelocities[i] = THREE.MathUtils.lerp(
        gs.hydraulicVelocities[i],
        gs.levers[i],
        delta * hydraulicResponsiveness
      );
    }

    // 2. Drive tracks (WASD) with inertia
    const targetForward = (gs.keys.w ? 1 : 0) - (gs.keys.s ? 1 : 0);
    const targetTurn = (gs.keys.a ? 1 : 0) - (gs.keys.d ? 1 : 0);

    gs.trackVelocity.forward = THREE.MathUtils.lerp(gs.trackVelocity.forward, targetForward, delta * 2.0);
    gs.trackVelocity.turn = THREE.MathUtils.lerp(gs.trackVelocity.turn, targetTurn, delta * 3.0);

    const speed = gs.trackVelocity.forward * 4 * delta;
    const rotSpeed = gs.trackVelocity.turn * 1.5 * delta;

    gs.diggerPos.x -= Math.sin(gs.diggerRot) * speed;
    gs.diggerPos.z -= Math.cos(gs.diggerRot) * speed;
    gs.diggerRot += rotSpeed;

    if (baseRef.current) {
      baseRef.current.position.copy(gs.diggerPos);
      baseRef.current.rotation.y = gs.diggerRot;
    }

    // 3. Arm kinematics from hydraulic velocities
    gs.swing -= gs.hydraulicVelocities[0] * 1.2 * delta;
    gs.boomAngle -= gs.hydraulicVelocities[1] * 1.0 * delta;
    gs.stickAngle -= gs.hydraulicVelocities[2] * 1.2 * delta;
    gs.bucketAngle += gs.hydraulicVelocities[3] * 1.8 * delta;

    // Clamp angles: preserve outward reach, limit only inward folding
    const boomMinOutward = -2;
    const boomMaxInward = 0.1;
    const stickMinOutward = 0.5
    const stickMaxInward = 2.8;
    const bucketMinOutward = -Math.PI / 2;

    gs.boomAngle = THREE.MathUtils.clamp(gs.boomAngle, boomMinOutward, boomMaxInward);
    gs.stickAngle = THREE.MathUtils.clamp(gs.stickAngle, stickMinOutward, stickMaxInward);

    const stickRetraction = THREE.MathUtils.clamp((gs.stickAngle - 0.35) / 1, 0, 1);
    const boomInward = THREE.MathUtils.clamp((gs.boomAngle + 0.45) / 0.7, 0, 1);
    const jamRisk = Math.max(stickRetraction, boomInward * 0.85);
    const bucketMaxInward = THREE.MathUtils.lerp(1.5, -0.2, jamRisk);
    gs.bucketAngle = THREE.MathUtils.clamp(gs.bucketAngle, bucketMinOutward, bucketMaxInward);

    if (cabRef.current) cabRef.current.rotation.y = gs.swing;
    if (boomRef.current) boomRef.current.rotation.x = gs.boomAngle;
    if (stickRef.current) stickRef.current.rotation.x = gs.stickAngle;
    if (bucketRef.current) bucketRef.current.rotation.x = gs.bucketAngle;

    if (baseRef.current) baseRef.current.updateMatrixWorld(true);

    // 4. Update bucket tip/bottom world positions (read by Sand for digging)
    if (bucketTipRef.current) {
      bucketTipRef.current.getWorldPosition(globalBucketPos);
    }
    if (bucketBottomRef.current) {
      bucketBottomRef.current.getWorldPosition(globalBucketBottomPos);
    }

    // 5. Ground collision
    const tipGroundHeight = getSandHeight(globalBucketPos.x, globalBucketPos.z);
    const bottomGroundHeight = getSandHeight(globalBucketBottomPos.x, globalBucketBottomPos.z);

    const isDiggingAngle = gs.absoluteBucketAngle > -0.2 && gs.absoluteBucketAngle < 1.2;

    const tipDepth = tipGroundHeight - globalBucketPos.y;
    const bottomDepth = bottomGroundHeight - globalBucketBottomPos.y;

    const tipAllowed = isDiggingAngle ? 0.8 : 0.05;
    const bottomAllowed = 0.1;

    const tipExcess = Math.max(0, tipDepth - tipAllowed);
    const bottomExcess = Math.max(0, bottomDepth - bottomAllowed);
    const pushUp = Math.max(tipExcess, bottomExcess);

    if (pushUp > 0) {
      if (gs.hydraulicVelocities[1] > 0) {
        gs.hydraulicVelocities[1] *= 0.5;
      }
      gs.boomAngle += pushUp * 0.2;
      gs.boomAngle = THREE.MathUtils.clamp(gs.boomAngle, boomMinOutward, boomMaxInward);
      if (boomRef.current) boomRef.current.rotation.x = gs.boomAngle;
      if (baseRef.current) baseRef.current.updateMatrixWorld(true);
      if (bucketTipRef.current) bucketTipRef.current.getWorldPosition(globalBucketPos);
      if (bucketBottomRef.current) bucketBottomRef.current.getWorldPosition(globalBucketBottomPos);
    }

    gs.absoluteBucketAngle = gs.boomAngle + gs.stickAngle + gs.bucketAngle;

    // 6. Cockpit look-around (mouse-driven head rotation)
    if (cameraRef.current && !gs.freeFly) {
      const look = cabLookRef.current;
      look.smoothX = THREE.MathUtils.lerp(look.smoothX, look.x, delta * 4);
      look.smoothY = THREE.MathUtils.lerp(look.smoothY, look.y, delta * 4);
      const maxYaw = 0.5;   // ~29 degrees left/right
      const maxPitch = 0.35; // ~20 degrees up/down
      cameraRef.current.rotation.set(
        -0.2 + look.smoothY * maxPitch,
        -0.3 + look.smoothX * maxYaw,
        0
      );
    }

    // 7. Sand stream visual (falling sand when dumping)
    if (sandStreamRef.current) {
      const isDumping = gs.absoluteBucketAngle > 1.2;
      if (isDumping && gs.bucketFill > 0) {
        sandStreamRef.current.visible = true;
        const groundY = getSandHeight(globalBucketPos.x, globalBucketPos.z);
        const streamHeight = Math.max(0, globalBucketPos.y - groundY);

        sandStreamRef.current.position.copy(globalBucketPos);
        sandStreamRef.current.position.y = globalBucketPos.y - streamHeight / 2;
        if (baseRef.current) {
          baseRef.current.worldToLocal(sandStreamRef.current.position);
        }

        const width = 0.15 + Math.random() * 0.1;
        sandStreamRef.current.scale.set(width, streamHeight, width);
      } else {
        sandStreamRef.current.visible = false;
      }
    }
  });

  return (
    <group ref={baseRef}>
      {/* Sand Stream (Falling sand) */}
      <mesh ref={sandStreamRef} visible={false} castShadow>
        <cylinderGeometry args={[1, 1, 1, 8]} />
        <meshStandardMaterial color="#dcb96e" roughness={1} />
      </mesh>

      {/* Undercarriage / Tracks */}
      <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.5, 1, 3.5]} />
        <meshStandardMaterial color="#222" />
      </mesh>

      {/* Swinging Upper Structure */}
      <group ref={cabRef} position={[0, 1, 0]}>

        {/* Camera (Player's Head inside the Cab) */}
        <PerspectiveCamera ref={cameraRef} makeDefault={!freeFly} position={[-0.4, 2.2, 0.5]} rotation={[-0.2, -0.3, 0]} fov={95} />

        {/* Cab Body Visual */}
        <group position={[-0.6, 1.2, 0.5]}>
          {/* Floor */}
          <mesh position={[0, -1.15, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.2, 0.1, 1.8]} />
            <meshStandardMaterial color="#333" />
          </mesh>
          {/* Dashboard */}
          <mesh position={[0, -0.1, -0.75]} rotation={[-0.2, 0, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.0, 0.4, 0.3]} />
            <meshStandardMaterial color="#222" />
          </mesh>
        </group>

        {/* Arm Base (Right side of cab) */}
        <group position={[0.8, 0.5, -0.5]}>
          <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.8, 1, 1]} />
            <meshStandardMaterial map={metalTexture} roughness={0.6} metalness={0.3} />
          </mesh>

          {/* Boom Hydraulic Base Mounting Lugs */}
          <mesh position={[0.45, 0.15, -0.25]} castShadow receiveShadow>
            <boxGeometry args={[0.2, 0.25, 0.25]} />
            <meshStandardMaterial color="#222" roughness={0.5} metalness={0.8} />
          </mesh>
          <mesh position={[-0.45, 0.15, -0.25]} castShadow receiveShadow>
            <boxGeometry args={[0.2, 0.25, 0.25]} />
            <meshStandardMaterial color="#222" roughness={0.5} metalness={0.8} />
          </mesh>

          {/* Boom Hydraulic Bases (Left + Right) — outboard of side plates */}
          <group position={[0.50, 0.15, -0.25]}>
            <mesh rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
              <cylinderGeometry args={[0.12, 0.12, 0.15, 16]} />
              <meshStandardMaterial color="#222" roughness={0.5} metalness={0.8} />
            </mesh>
            <Hydraulic targetRef={boomCylTargetLRef} barrelRadius={0.10} barrelLength={1} rodRadius={0.05} rodLength={2.0} />
          </group>
          <group position={[-0.50, 0.15, -0.25]}>
            <mesh rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
              <cylinderGeometry args={[0.12, 0.12, 0.15, 16]} />
              <meshStandardMaterial color="#222" roughness={0.5} metalness={0.8} />
            </mesh>
            <Hydraulic targetRef={boomCylTargetRRef} barrelRadius={0.10} barrelLength={1} rodRadius={0.05} rodLength={2.0} />
          </group>

          {/* ═══════════ BOOM ═══════════ */}
          <group ref={boomRef} position={[0, 1, 0]}>
            {/* Boom Hydraulic Target Brackets (bridge from boom body to outboard pins) */}
            <mesh position={[0.2, 1.5, 0.25]} castShadow receiveShadow>
              <boxGeometry args={[0.60, 0.22, 0.30]} />
              <meshStandardMaterial color="#222" roughness={0.5} metalness={0.8} />
            </mesh>
            <mesh position={[-0.2, 1.5, 0.25]} castShadow receiveShadow>
              <boxGeometry args={[0.60, 0.22, 0.30]} />
              <meshStandardMaterial color="#222" roughness={0.5} metalness={0.8} />
            </mesh>

            {/* Boom Hydraulic Targets — outboard at same x as bases */}
            <group position={[0.50, 1.5, 0.35]}>
              <mesh rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
                <cylinderGeometry args={[0.08, 0.08, 0.15, 16]} />
                <meshStandardMaterial color="#222" roughness={0.5} metalness={0.8} />
              </mesh>
              <object3D ref={boomCylTargetLRef} />
            </group>
            <group position={[-0.50, 1.5, 0.35]}>
              <mesh rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
                <cylinderGeometry args={[0.08, 0.08, 0.15, 16]} />
                <meshStandardMaterial color="#222" roughness={0.5} metalness={0.8} />
              </mesh>
              <object3D ref={boomCylTargetRRef} />
            </group>

            {/* Main Boom Body */}
            <mesh position={[0, 2.5, 0]} castShadow receiveShadow>
              <boxGeometry args={[0.3, 5, 0.4]} />
              <meshStandardMaterial map={metalTexture} roughness={0.6} metalness={0.3} />
            </mesh>
            {/* Side plates */}
            <mesh position={[0.2, 0.5, 0]} castShadow receiveShadow>
              <boxGeometry args={[0.1, 1.5, 0.6]} />
              <meshStandardMaterial map={metalTexture} roughness={0.6} metalness={0.3} />
            </mesh>
            <mesh position={[-0.2, 0.5, 0]} castShadow receiveShadow>
              <boxGeometry args={[0.1, 1.5, 0.6]} />
              <meshStandardMaterial map={metalTexture} roughness={0.6} metalness={0.3} />
            </mesh>
            <mesh position={[0.18, 4.5, 0]} castShadow receiveShadow>
              <boxGeometry args={[0.1, 1.5, 0.5]} />
              <meshStandardMaterial map={metalTexture} roughness={0.6} metalness={0.3} />
            </mesh>
            <mesh position={[-0.18, 4.5, 0]} castShadow receiveShadow>
              <boxGeometry args={[0.1, 1.5, 0.5]} />
              <meshStandardMaterial map={metalTexture} roughness={0.6} metalness={0.3} />
            </mesh>

            {/* Joints */}
            <mesh position={[0, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
              <cylinderGeometry args={[0.35, 0.35, 0.7, 16]} />
              <meshStandardMaterial color="#222" roughness={0.5} metalness={0.8} />
            </mesh>
            <mesh position={[0, 5, 0]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
              <cylinderGeometry args={[0.25, 0.25, 0.6, 16]} />
              <meshStandardMaterial color="#222" roughness={0.5} metalness={0.8} />
            </mesh>

            {/* Stick Hydraulic Base */}
            <group position={[0, 1.3, 0.3]}>
              <mesh rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
                <cylinderGeometry args={[0.15, 0.15, 0.4, 16]} />
                <meshStandardMaterial color="#222" roughness={0.5} metalness={0.8} />
              </mesh>
              <Hydraulic targetRef={stickCylTargetRef} barrelLength={1.8} rodLength={2.5} />
            </group>

            {/* ═══════════ STICK ═══════════ */}
            <group ref={stickRef} position={[0, 5, 0.3]}>
              {/* Stick Hydraulic Target */}
              <group position={[0, 0.3, 0.2]}>
                <mesh rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
                  <cylinderGeometry args={[0.1, 0.1, 0.4, 16]} />
                  <meshStandardMaterial color="#222" roughness={0.5} metalness={0.8} />
                </mesh>
                <object3D ref={stickCylTargetRef} />
              </group>

              {/* Main stick */}
              <mesh position={[0, -2, 0]} castShadow receiveShadow>
                <boxGeometry args={[0.25, 4, 0.35]} />
                <meshStandardMaterial map={metalTexture} roughness={0.6} metalness={0.3} />
              </mesh>
              {/* Top reinforcement */}
              <mesh position={[0, -0.5, 0]} castShadow receiveShadow>
                <boxGeometry args={[0.3, 1.5, 0.45]} />
                <meshStandardMaterial map={metalTexture} roughness={0.6} metalness={0.3} />
              </mesh>

              {/* Bottom Joint (Bucket) */}
              <mesh position={[0, -4, 0]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
                <cylinderGeometry args={[0.2, 0.2, 0.5, 16]} />
                <meshStandardMaterial color="#222" roughness={0.5} metalness={0.8} />
              </mesh>

                {/* Bucket Hydraulic Base */}
                <group position={[0, 0.1, -0.3]}>
                <mesh rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
                  <cylinderGeometry args={[0.15, 0.15, 0.4, 16]} />
                  <meshStandardMaterial color="#222" roughness={0.5} metalness={0.8} />
                </mesh>
                <Hydraulic targetRef={bucketCylTargetRef} barrelLength={1.3} rodLength={4} />
                </group>

              {/* ═══════════ BUCKET ═══════════ */}
              <group ref={bucketRef} position={[0, -4, 0]}>
                {/* Bucket Hydraulic Target */}
                <group position={[0, 0.2, -0.5]}>
                  <mesh rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
                    <cylinderGeometry args={[0.1, 0.1, 0.3, 16]} />
                    <meshStandardMaterial color="#222" roughness={0.5} metalness={0.8} />
                  </mesh>
                  <object3D ref={bucketCylTargetRef} />
                </group>

                <CustomBucket
                  metalTexture={metalTexture}
                  bucketBottomRef={bucketBottomRef}
                  bucketTipRef={bucketTipRef}
                />
              </group>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}
