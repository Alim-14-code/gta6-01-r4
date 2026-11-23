// Neon Harbor — synthesized sound, no audio files.
// Everything is a WebAudio oscillator or filtered noise: engine hum
// that follows speed, police sirens, pickup blips, gunshots and
// mission stingers. Audio starts on the first user gesture (browsers
// require it) and degrades silently to nothing when unavailable.

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenTimer = 0;
  let muted = false;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.32;
      master.connect(ctx.destination);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      return true;
    } catch {
      return false;
    }
  }

  function blip(freq, dur, type = 'sine', vol = 0.5) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noiseBurst(dur, vol = 0.4, freq = 1200) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t);
  }

  return {
    unlock() {
      ensure();
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.32;
      return muted;
    },
    // speedRatio 0..1 while driving; 0 and silent on foot.
    setEngine(speedRatio, on) {
      if (!ctx || muted) return;
      const target = on ? 0.05 + speedRatio * 0.11 : 0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
      engineOsc.frequency.setTargetAtTime(52 + speedRatio * 130, ctx.currentTime, 0.1);
    },
    sirenTick(dt, wanted) {
      if (!ensure() || muted || wanted < 1) return;
      sirenTimer -= dt;
      if (sirenTimer <= 0) {
        sirenTimer = 0.85;
        blip(660, 0.4, 'triangle', 0.12);
        setTimeout(() => blip(520, 0.4, 'triangle', 0.12), 380);
      }
    },
    pickup() {
      blip(880, 0.09, 'sine', 0.4);
      setTimeout(() => blip(1318, 0.14, 'sine', 0.4), 90);
    },
    gunshot() {
      noiseBurst(0.12, 0.5, 900);
    },
    crash() {
      noiseBurst(0.25, 0.6, 300);
    },
    missionStart() {
      [523, 659, 784].forEach((f, i) => setTimeout(() => blip(f, 0.22, 'square', 0.22), i * 110));
    },
    missionComplete() {
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.3, 'triangle', 0.35), i * 130));
    },
    missionFailed() {
      [392, 330, 262].forEach((f, i) => setTimeout(() => blip(f, 0.35, 'sawtooth', 0.2), i * 160));
    },
    busted() {
      [220, 175, 147].forEach((f, i) => setTimeout(() => blip(f, 0.4, 'sawtooth', 0.25), i * 200));
    },
  };
}
