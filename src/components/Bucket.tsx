import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../store';
import { getSandTexture } from '../textures';

// ─── BucketSand ───────────────────────────────────────────────────────────────
// InstancedMesh of up to 1000 dodecahedron sand particles inside the bucket.
// Particles are pre-sorted by Y so filling appears to rise from the bottom.
// Visibility count is driven by gameState.bucketFill (0–100).

function BucketSand() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const texture = useMemo(() => getSandTexture(), []);

  const particles = useMemo(() => {
    const pts: { pos: THREE.Vector3; rot: THREE.Euler; scale: number }[] = [];
    for (let i = 0; i < 1000; i++) {
      const scale = 0.06 + Math.random() * 0.08;

      // Pad the width by the scale so particles don't poke through the side plates (x = ±0.4)
      const x = (Math.random() - 0.5) * (0.8 - scale * 2);

      // Keep depth well within the bucket (z = -0.4 to 0.6)
      const z = -0.3 + Math.random() * 0.7;

      let minDepth = -0.4 + scale; // Bottom plate is at y = -0.4
      if (z < 0) {
        // Curved back is at radius 0.4. Pad by scale.
        const rSq = Math.pow(0.4 - scale, 2) - z * z;
        if (rSq > 0) {
          minDepth = -Math.sqrt(rSq);
        } else {
          continue; // Outside the padded back curve
        }
      }

      // Top level of the sand pile
      const topLevel = 0.2 - Math.abs(z - 0.1) * 0.35;

      if (topLevel > minDepth) {
        const y = minDepth + Math.random() * (topLevel - minDepth);
        pts.push({
          pos: new THREE.Vector3(x, y, z),
          rot: new THREE.Euler(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI),
          scale,
        });
      }
    }
    pts.sort((a, b) => a.pos.y - b.pos.y);
    return pts;
  }, []);

  useFrame(() => {
    if (!meshRef.current) return;
    const { bucketFill } = useGameStore.getState();
    const fillRatio = bucketFill / 100;
    const count = Math.floor(fillRatio * particles.length);
    meshRef.current.count = count;

    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const p = particles[i];
      dummy.position.copy(p.pos);
      dummy.rotation.copy(p.rot);
      dummy.scale.setScalar(p.scale);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    // @ts-ignore
    <instancedMesh ref={meshRef} args={[null, null, 1000]} castShadow receiveShadow>
      <dodecahedronGeometry args={[1, 0]} />
      <meshStandardMaterial map={texture} roughness={1} />
    </instancedMesh>
  );
}

// ─── CustomBucket ─────────────────────────────────────────────────────────────
// The bucket geometry: mounting bracket, hydraulic target bracket, bucket body
// (curved back, bottom/top/side plates, 4 teeth), reference Object3Ds for
// collision detection, and the BucketSand particle fill.

export function CustomBucket({
  metalTexture,
  bucketBottomRef,
  bucketTipRef,
}: {
  metalTexture: THREE.Texture;
  bucketBottomRef: React.RefObject<THREE.Object3D>;
  bucketTipRef: React.RefObject<THREE.Object3D>;
}) {
  const sidePlateShape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, 0.4);
    s.lineTo(0.2, 0.4);
    s.lineTo(0.6, -0.4);
    s.lineTo(0, -0.4);
    s.absarc(0, 0, 0.4, -Math.PI / 2, Math.PI / 2, true);
    return s;
  }, []);

  return (
    <group>
      {/* Mounting Bracket */}
      <group position={[0, 0, 0]}>
        <mesh position={[0.2, -0.25, -0.1]} rotation={[0.38, 0, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.05, 0.6, 0.2]} />
          <meshStandardMaterial map={metalTexture} roughness={0.6} metalness={0.3} />
        </mesh>
        <mesh position={[-0.2, -0.25, -0.1]} rotation={[0.38, 0, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.05, 0.6, 0.2]} />
          <meshStandardMaterial map={metalTexture} roughness={0.6} metalness={0.3} />
        </mesh>
        {/* Pivot cylinder */}
        <mesh rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
          <cylinderGeometry args={[0.15, 0.15, 0.5, 16]} />
          <meshStandardMaterial color="#222" roughness={0.5} metalness={0.8} />
        </mesh>
      </group>

      {/* Hydraulic Target Bracket */}
      <group position={[0, 0.4, -0.4]}>
        <mesh position={[0.1, -0.23, 0.1]} rotation={[2, 0, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.05, 0.5, 0.1]} />
          <meshStandardMaterial map={metalTexture} roughness={0.6} metalness={0.3} />
        </mesh>
        <mesh position={[-0.1, -0.23, 0.1]} rotation={[2, 0, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.05, 0.5, 0.1]} />
          <meshStandardMaterial map={metalTexture} roughness={0.6} metalness={0.3} />
        </mesh>
      </group>

      {/* Bucket Body */}
      <group position={[0, -0.5, 0]}>
        {/* Curved back */}
        <mesh rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
          <cylinderGeometry args={[0.4, 0.4, 0.8, 16, 1, false, Math.PI * 0.5, Math.PI]} />
          <meshStandardMaterial map={metalTexture} roughness={0.6} metalness={0.3} side={THREE.DoubleSide} />
        </mesh>

        {/* Bottom plate */}
        <mesh position={[0, -0.4, 0.3]} castShadow receiveShadow>
          <boxGeometry args={[0.8, 0.05, 0.6]} />
          <meshStandardMaterial map={metalTexture} roughness={0.6} metalness={0.3} />
        </mesh>

        {/* Top plate */}
        <mesh position={[0, 0.4, 0.1]} castShadow receiveShadow>
          <boxGeometry args={[0.8, 0.05, 0.2]} />
          <meshStandardMaterial map={metalTexture} roughness={0.6} metalness={0.3} />
        </mesh>

        {/* Side plates */}
        <mesh position={[0.4, 0, 0]} rotation={[0, -Math.PI / 2, 0]} castShadow receiveShadow>
          <shapeGeometry args={[sidePlateShape]} />
          <meshStandardMaterial map={metalTexture} roughness={0.6} metalness={0.3} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[-0.4, 0, 0]} rotation={[0, -Math.PI / 2, 0]} castShadow receiveShadow>
          <shapeGeometry args={[sidePlateShape]} />
          <meshStandardMaterial map={metalTexture} roughness={0.6} metalness={0.3} side={THREE.DoubleSide} />
        </mesh>

        {/* Teeth */}
        {[-0.3, -0.1, 0.1, 0.3].map((x, i) => (
          <mesh key={i} position={[x, -0.4, 0.65]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
            <coneGeometry args={[0.05, 0.2, 4]} />
            <meshStandardMaterial color="#222" roughness={0.8} metalness={0.5} />
          </mesh>
        ))}

        {/* References for game logic */}
        <object3D ref={bucketBottomRef} position={[0, -0.4, 0.2]} />
        <object3D ref={bucketTipRef} position={[0, -0.4, 0.7]} />

        {/* Sand inside bucket */}
        <BucketSand />
      </group>
    </group>
  );
}
