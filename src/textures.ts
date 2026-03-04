import * as THREE from 'three';

// ─── Procedural Textures ──────────────────────────────────────────────────────
// Lazy-singleton factories. Created once on first call, then cached.

let sharedSandTexture: THREE.CanvasTexture | null = null;

/** Procedural 512×512 sand texture with grain noise, tiled 40×40. */
export function getSandTexture(): THREE.CanvasTexture {
  if (!sharedSandTexture) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext('2d');
    if (context) {
      context.fillStyle = '#dcb96e';
      context.fillRect(0, 0, 512, 512);
      const imgData = context.getImageData(0, 0, 512, 512);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        const noise = (Math.random() - 0.5) * 30;
        data[i] = Math.min(255, Math.max(0, data[i] + noise));
        data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
        data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
      }
      context.putImageData(imgData, 0, 0);
    }
    sharedSandTexture = new THREE.CanvasTexture(canvas);
    sharedSandTexture.wrapS = THREE.RepeatWrapping;
    sharedSandTexture.wrapT = THREE.RepeatWrapping;
    sharedSandTexture.repeat.set(40, 40);
  }
  return sharedSandTexture;
}

let sharedMetalTexture: THREE.CanvasTexture | null = null;

/** Procedural 512×512 scratched orange metal texture for the excavator body. */
export function getMetalTexture(): THREE.CanvasTexture {
  if (!sharedMetalTexture) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext('2d');
    if (context) {
      context.fillStyle = '#e89010'; // Excavator Orange
      context.fillRect(0, 0, 512, 512);

      for (let i = 0; i < 3000; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const length = Math.random() * 15 + 2;
        const angle = Math.random() * Math.PI;

        context.beginPath();
        context.moveTo(x, y);
        context.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);

        if (Math.random() > 0.7) {
          context.strokeStyle = `rgba(40, 20, 0, ${Math.random() * 0.4})`; // Dirt/grease
          context.lineWidth = Math.random() * 4;
        } else {
          context.strokeStyle = `rgba(255, 255, 255, ${Math.random() * 0.3})`; // Scratches
          context.lineWidth = Math.random() * 1;
        }
        context.stroke();
      }
    }
    sharedMetalTexture = new THREE.CanvasTexture(canvas);
    sharedMetalTexture.colorSpace = THREE.SRGBColorSpace;
    sharedMetalTexture.wrapS = THREE.RepeatWrapping;
    sharedMetalTexture.wrapT = THREE.RepeatWrapping;
  }
  return sharedMetalTexture;
}
