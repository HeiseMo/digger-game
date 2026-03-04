import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '../store';

// ─── Free-Fly Debug Camera ───────────────────────────────────────────────────
// WASD + Space/Shift to move, mouse drag to look around.
// Toggled with F8. When active, replaces the cab PerspectiveCamera.

export function FreeFlyCamera() {
  const { gl } = useThree();
  const freeFly = useGameStore((s) => s.freeFly);
  const camRef = useRef<THREE.PerspectiveCamera>(null);
  const euler = useRef(new THREE.Euler(0, 0, 0, 'YXZ'));
  const isPointerLocked = useRef(false);

  // Pointer lock for mouse look
  useEffect(() => {
    const canvas = gl.domElement;

    const onClick = () => {
      if (useGameStore.getState().freeFly) {
        canvas.requestPointerLock();
      }
    };

    const onLockChange = () => {
      isPointerLocked.current = document.pointerLockElement === canvas;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isPointerLocked.current) return;
      euler.current.y -= e.movementX * 0.002;
      euler.current.x -= e.movementY * 0.002;
      euler.current.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, euler.current.x));
    };

    canvas.addEventListener('click', onClick);
    document.addEventListener('pointerlockchange', onLockChange);
    document.addEventListener('mousemove', onMouseMove);

    return () => {
      canvas.removeEventListener('click', onClick);
      document.removeEventListener('pointerlockchange', onLockChange);
      document.removeEventListener('mousemove', onMouseMove);
    };
  }, [gl]);

  // Initialize position near excavator when first enabled
  const initialized = useRef(false);
  useEffect(() => {
    if (camRef.current && !initialized.current) {
      const gs = useGameStore.getState();
      camRef.current.position.set(
        gs.diggerPos.x - 5,
        5,
        gs.diggerPos.z + 5
      );
      euler.current.set(-0.3, -Math.PI / 4, 0, 'YXZ');
      initialized.current = true;
    }
  }, []);

  useFrame((_state, delta) => {
    if (!camRef.current) return;
    const gs = useGameStore.getState();
    if (!gs.freeFly) return;

    // Apply rotation
    camRef.current.quaternion.setFromEuler(euler.current);

    // Movement
    const speed = 10 * delta;
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camRef.current.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camRef.current.quaternion);

    const fk = gs.flyKeys;
    if (fk.w) camRef.current.position.addScaledVector(forward, speed);
    if (fk.s) camRef.current.position.addScaledVector(forward, -speed);
    if (fk.d) camRef.current.position.addScaledVector(right, speed);
    if (fk.a) camRef.current.position.addScaledVector(right, -speed);
    if (fk.space) camRef.current.position.y += speed;
    if (fk.shift) camRef.current.position.y -= speed;
  });

  return (
    <PerspectiveCamera
      ref={camRef}
      makeDefault={freeFly}
      fov={80}
      near={0.1}
      far={1000}
    />
  );
}
