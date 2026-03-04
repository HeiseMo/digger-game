import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// ─── Hydraulic Cylinder Component ─────────────────────────────────────────────
//
// Visual-only hydraulic actuator: a barrel (outer cylinder) and a rod (inner piston)
// aligned along the local Z axis.
//
// HOW IT WORKS:
//   1. The <Hydraulic> is placed at the cylinder's BASE attachment point on the parent part.
//   2. A targetRef (THREE.Object3D) is placed at the cylinder's END attachment point on the
//      child part. As the child joint rotates, the target moves with it.
//   3. Every frame, the barrel group calls lookAt(target) so it always points at the end.
//   4. The rod's Z position is set to (distance - rodLength/2) so it extends/retracts
//      to visually bridge the gap between base and target.
//
// This is NOT inverse kinematics — the joint angles drive rotation directly,
// and the hydraulics passively follow as a visual effect.

export function Hydraulic({
  targetRef,
  barrelRadius = 0.12,
  barrelLength = 2.5,
  rodRadius = 0.06,
  rodLength = 2.5,
}: {
  targetRef: React.RefObject<THREE.Object3D>;
  barrelRadius?: number;
  barrelLength?: number;
  rodRadius?: number;
  rodLength?: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const rodRef = useRef<THREE.Mesh>(null);
  const _start = useRef(new THREE.Vector3());
  const _end = useRef(new THREE.Vector3());
  const _dir = useRef(new THREE.Vector3());
  const _up = useRef(new THREE.Vector3());

  useFrame(() => {
    if (!groupRef.current || !targetRef.current || !rodRef.current) return;

    groupRef.current.getWorldPosition(_start.current);
    targetRef.current.getWorldPosition(_end.current);

    // Compute direction and distance
    _dir.current.subVectors(_end.current, _start.current);
    const dist = _dir.current.length();
    if (dist < 0.001) return; // avoid degenerate zero-length

    // Choose an up vector that isn't parallel to the look direction
    // (prevents gimbal-lock flicker when the cylinder is near-vertical)
    _dir.current.normalize();
    _up.current.set(0, 1, 0);
    if (Math.abs(_dir.current.dot(_up.current)) > 0.99) {
      _up.current.set(0, 0, 1);
    }
    groupRef.current.up.copy(_up.current);

    // Point the barrel at the target attachment point
    groupRef.current.lookAt(_end.current);

    // Extend/retract the rod to match the distance
    rodRef.current.position.z = dist - rodLength / 2;
  });

  return (
    <group ref={groupRef}>
      {/* Barrel (outer cylinder) */}
      <mesh position={[0, 0, barrelLength / 2]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[barrelRadius, barrelRadius, barrelLength, 16]} />
        <meshStandardMaterial color="#111" roughness={0.7} />
      </mesh>
      {/* Rod (inner piston) */}
      <mesh ref={rodRef} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[rodRadius, rodRadius, rodLength, 16]} />
        <meshStandardMaterial color="#ddd" roughness={0.2} metalness={0.9} />
      </mesh>
    </group>
  );
}
