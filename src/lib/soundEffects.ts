"use client";

import confetti from "canvas-confetti";

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!sharedAudioCtx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtx) {
        sharedAudioCtx = new AudioCtx();
      }
    }
    if (sharedAudioCtx && sharedAudioCtx.state === "suspended") {
      void sharedAudioCtx.resume();
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

/**
 * 1. playTap(): Soft tactile pop when tapping any button or chip (Duolingo/Finch style)
 */
export function playTap(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(680, now + 0.055);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.065);
  } catch {
    // Ignore audio errors on restricted devices
  }
}

/**
 * 2. playCoin(): Crisp double-chime coin/reward sound when choosing to save or wait
 */
export function playCoin(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const notes = [987.77, 1318.51]; // B5 -> E6

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      const start = now + idx * 0.075;
      const duration = idx === 1 ? 0.24 : 0.09;

      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.12, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + duration + 0.01);
    });
  } catch {
    // Ignore audio errors
  }
}

/**
 * 3. playDamage(): Low shield-hit thud when a purchase compromises quincena liquidity
 */
export function playDamage(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(190, now);
    osc.frequency.exponentialRampToValueAtTime(85, now + 0.22);

    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.25);
  } catch {
    // Ignore audio errors
  }
}

/**
 * 4. playLevelUp(): Cheerful major arpeggio chord + canvas-confetti burst!
 */
export function playLevelUp(): void {
  // Trigger celebratory confetti burst
  if (typeof window !== "undefined") {
    try {
      void confetti({
        particleCount: 70,
        spread: 68,
        origin: { y: 0.65 },
        colors: ["#10B981", "#F59E0B", "#34D399", "#38BDF8", "#F472B6"],
      });
    } catch {
      // Ignore confetti errors
    }
  }

  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    // C5 - E5 - G5 - C6 cheerful arpeggio
    const chord = [523.25, 659.25, 783.99, 1046.5];

    chord.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      const start = now + idx * 0.07;
      const duration = idx === chord.length - 1 ? 0.35 : 0.14;

      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.12, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + duration + 0.01);
    });
  } catch {
    // Ignore audio errors
  }
}

export function useSoundEffects() {
  return {
    playTap,
    playCoin,
    playDamage,
    playLevelUp,
  };
}

