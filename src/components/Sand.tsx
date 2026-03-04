import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore, globalBucketPos, globalBucketBottomPos, setSandHeightFn } from '../store';
import { getSandTexture } from '../textures';

// ─── Deformable Sand Terrain ──────────────────────────────────────────────────
//
// 100×100 plane with 150×150 segments. Vertices are displaced per-frame to
// simulate digging (lowering terrain under the bucket) and dumping (raising
// terrain where sand falls). A stochastic relaxation pass creates an avalanche
// effect so steep slopes settle naturally.
//
// Communication with Digger:
//   - Reads: globalBucketPos, globalBucketBottomPos (world-space bucket positions)
//   - Reads/writes: gameState.bucketFill (sand amount in bucket)
//   - Exports: getSandHeight function via setSandHeightFn (queried by Digger for ground collision)

export function Sand() {
  const geomRef = useRef<THREE.PlaneGeometry>(null);
  const texture = useMemo(() => getSandTexture(), []);

  useEffect(() => {
    if (geomRef.current) {
      const positions = geomRef.current.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        const noise = (Math.random() - 0.5) * 0.15;
        positions.setZ(i, positions.getZ(i) + noise);
      }
      positions.needsUpdate = true;
      geomRef.current.computeVertexNormals();
    }
  }, []);

  useFrame(() => {
    if (!geomRef.current) return;
    const gs = useGameStore.getState();
    const positions = geomRef.current.attributes.position;
    let needsUpdate = false;

    // Export the height query function so Digger can check ground level
    setSandHeightFn((worldX: number, worldZ: number) => {
      const localX = worldX;
      const localY = -worldZ;
      const vx = Math.round((localX + 50) / 100 * 150);
      const vy = Math.round((50 - localY) / 100 * 150);
      if (vx >= 0 && vx <= 150 && vy >= 0 && vy <= 150) {
        const idx = vy * 151 + vx;
        return positions.getZ(idx);
      }
      return 0;
    });

    // Digging / dumping logic based on absolute bucket angle
    const isDigging = gs.absoluteBucketAngle > -0.2 && gs.absoluteBucketAngle < 1.2;
    const isDumping = gs.absoluteBucketAngle > 1.2;

    const bx = globalBucketPos.x;
    const by = globalBucketPos.y;
    const bz = globalBucketPos.z;

    if (isDigging && gs.bucketFill < 100) {
      for (let i = 0; i < positions.count; i++) {
        const vx = positions.getX(i);
        const vy = positions.getY(i);
        const vz = positions.getZ(i);

        const dist = Math.hypot(vx - bx, vy - (-bz));
        if (dist < 1.2 && by < vz + 0.1 && vz > -3) {
          positions.setZ(i, vz - 0.05);
          gs.bucketFill += 0.5;
          if (gs.bucketFill > 100) gs.bucketFill = 100;
          needsUpdate = true;
        }
      }
    } else if (isDumping && gs.bucketFill > 0) {
      for (let i = 0; i < positions.count; i++) {
        const vx = positions.getX(i);
        const vy = positions.getY(i);
        const vz = positions.getZ(i);

        const dist = Math.hypot(vx - bx, vy - (-bz));
        if (dist < 1.2 && vz < 4) {
          if (by > vz - 0.5) {
            positions.setZ(i, vz + 0.05);
            gs.bucketFill -= 0.5;
            if (gs.bucketFill < 0) gs.bucketFill = 0;
            needsUpdate = true;
          }
        }
      }
    }

    // Sand relaxation (avalanche effect)
    for (let k = 0; k < 400; k++) {
      const idx = Math.floor(Math.random() * positions.count);
      const x = idx % 151;
      const y = Math.floor(idx / 151);
      if (x > 0 && x < 150 && y > 0 && y < 150) {
        const vz = positions.getZ(idx);
        const neighbors = [idx - 1, idx + 1, idx - 151, idx + 151];
        for (const n of neighbors) {
          const nz = positions.getZ(n);
          if (vz - nz > 0.8) {
            positions.setZ(idx, vz - 0.1);
            positions.setZ(n, nz + 0.1);
            needsUpdate = true;
            break;
          }
        }
      }
    }

    if (needsUpdate) {
      positions.needsUpdate = true;
      geomRef.current.computeVertexNormals();
    }
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry ref={geomRef} args={[100, 100, 150, 150]} />
      <meshStandardMaterial map={texture} bumpMap={texture} bumpScale={0.05} roughness={1} metalness={0} />
    </mesh>
  );
}
