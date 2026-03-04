// ─── Sound System Skeleton ────────────────────────────────────────────────────
// Stub implementation that establishes the API contract for game audio.
// To activate sounds, drop .mp3/.ogg files into public/sounds/ and uncomment
// the Howl initializers below.
//
// Usage in components:
//   const { play, stop } = useSound();
//   play('hydraulicMove');
//   stop('engineIdle');

// import { Howl } from 'howler';

export type SoundEffect =
  | 'engineIdle'
  | 'hydraulicMove'
  | 'bucketScrape'
  | 'sandDump';

// ─── Uncomment to activate sounds once audio files are available ──────────────
//
// const sounds: Record<SoundEffect, Howl> = {
//   engineIdle: new Howl({ src: ['/sounds/engine-idle.mp3'], loop: true, volume: 0.3 }),
//   hydraulicMove: new Howl({ src: ['/sounds/hydraulic.mp3'], loop: true, volume: 0.5 }),
//   bucketScrape: new Howl({ src: ['/sounds/scrape.mp3'], volume: 0.6 }),
//   sandDump: new Howl({ src: ['/sounds/sand-dump.mp3'], volume: 0.5 }),
// };

const noop = () => {};

interface SoundAPI {
  play: (effect: SoundEffect) => void;
  stop: (effect: SoundEffect) => void;
  setVolume: (effect: SoundEffect, vol: number) => void;
}

/**
 * Hook that returns play/stop/setVolume controls for game sound effects.
 * Currently returns no-op stubs. Activate by uncommenting the Howl instances above
 * and replacing the stubs with:
 *   play: (e) => sounds[e].play(),
 *   stop: (e) => sounds[e].stop(),
 *   setVolume: (e, v) => sounds[e].volume(v),
 */
export function useSound(): SoundAPI {
  return {
    play: noop as SoundAPI['play'],
    stop: noop as SoundAPI['stop'],
    setVolume: noop as SoundAPI['setVolume'],
  };
}
