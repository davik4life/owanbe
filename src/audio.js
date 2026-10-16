// A tiny Afrobeat band, synthesised live with Web Audio. Nothing is a recording.

export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

export class Band {
  constructor() {
    this.ctx = null;
  }

  init() {
    if (this.ctx) return this.ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = (this.ctx = new AC({ latencyHint: 'interactive' }));

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 10;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
    comp.release.value = 0.16;
    this.master = ctx.createGain();
    this.master.gain.value = 0.72;
    this.master.connect(comp).connect(ctx.destination);

    this.music = ctx.createGain();
    this.music.gain.value = 0.8;
    this.music.connect(this.master);
    this.lead = ctx.createGain();
    this.lead.gain.value = 1;
    this.lead.connect(this.master);
    this.crowd = ctx.createGain();
    this.crowd.gain.value = 0.5;
    this.crowd.connect(this.master);

    // Small room so the band sounds like it's in a hall.
    this.verb = ctx.createConvolver();
    this.verb.buffer = this.makeImpulse(1.4, 2.8);
    const verbGain = ctx.createGain();
    verbGain.gain.value = 0.22;
    this.verb.connect(verbGain).connect(this.master);

    this.noise = this.makeNoise(2);
    return ctx;
  }

  get now() { return this.ctx ? this.ctx.currentTime : 0; }

  makeNoise(seconds) {
    const ctx = this.ctx;
    const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  makeImpulse(seconds, decay) {
    const ctx = this.ctx;
    const len = ctx.sampleRate * seconds;
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  env(t, peak, attack, decay, out) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    g.connect(out);
    return g;
  }

  noiseSource(t, dur) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur);
    return src;
  }

  kick(t, vel = 1) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(44, t + 0.14);
    const g = this.env(t, 0.95 * vel, 0.003, 0.32, this.music);
    o.connect(g);
    o.start(t);
    o.stop(t + 0.4);
  }

  clap(t, vel = 1) {
    const ctx = this.ctx;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1600;
    bp.Q.value = 0.9;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    // three quick slaps then a tail, like several hands
    [0, 0.011, 0.022].forEach((d) => {
      g.gain.setValueAtTime(0.5 * vel, t + d);
      g.gain.exponentialRampToValueAtTime(0.05, t + d + 0.009);
    });
    g.gain.setValueAtTime(0.38 * vel, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    this.noiseSource(t, 0.22).connect(bp).connect(g);
    g.connect(this.music);
    g.connect(this.verb);
  }

  rim(t, vel = 1) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = 1750;
    const g = this.env(t, 0.18 * vel, 0.001, 0.05, this.music);
    o.connect(g);
    o.start(t);
    o.stop(t + 0.08);
  }

  shaker(t, vel = 1) {
    const ctx = this.ctx;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 6500;
    const g = this.env(t, 0.16 * vel, 0.012, 0.05, this.music);
    this.noiseSource(t, 0.09).connect(hp).connect(g);
  }

  // The agogo bell: two metal tones.
  bell(t, high, vel = 1) {
    const ctx = this.ctx;
    const f = high ? 1180 : 790;
    const g = this.env(t, 0.1 * vel, 0.001, 0.22, this.music);
    g.connect(this.verb);
    [1, 2.76].forEach((ratio, i) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f * ratio;
      const pg = ctx.createGain();
      pg.gain.value = i ? 0.35 : 1;
      o.connect(pg).connect(g);
      o.start(t);
      o.stop(t + 0.3);
    });
  }

  bass(t, midi, dur, vel = 1) {
    const ctx = this.ctx;
    const f = mtof(midi);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(900, t);
    lp.frequency.exponentialRampToValueAtTime(220, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5 * vel, t + 0.008);
    g.gain.setValueAtTime(0.42 * vel, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    lp.connect(g).connect(this.music);
    ['sine', 'triangle'].forEach((type) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      o.connect(lp);
      o.start(t);
      o.stop(t + dur + 0.02);
    });
  }

  // Highlife guitar: a bright pluck.
  pluck(t, midi, vel = 1) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = mtof(midi);
    const o2 = ctx.createOscillator();
    o2.type = 'square';
    o2.frequency.value = mtof(midi) * 1.003;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 3;
    lp.frequency.setValueAtTime(3800, t);
    lp.frequency.exponentialRampToValueAtTime(600, t + 0.16);
    const g = this.env(t, 0.075 * vel, 0.002, 0.26, this.music);
    g.connect(this.verb);
    o.connect(lp);
    o2.connect(lp);
    lp.connect(g);
    o.start(t); o2.start(t);
    o.stop(t + 0.32); o2.stop(t + 0.32);
  }

  // Off-beat organ stab, the classic Afrobeat skank.
  stab(t, midis, vel = 1) {
    const ctx = this.ctx;
    const g = this.env(t, 0.06 * vel, 0.006, 0.17, this.music);
    g.connect(this.verb);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2400;
    lp.connect(g);
    midis.forEach((m) => {
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = mtof(m);
      o.connect(lp);
      o.start(t);
      o.stop(t + 0.22);
    });
  }

  // Horn section for the big moments.
  horns(t, midis, dur, vel = 1) {
    const ctx = this.ctx;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(700, t);
    lp.frequency.linearRampToValueAtTime(2600, t + 0.06);
    lp.frequency.linearRampToValueAtTime(1300, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.07 * vel, t + 0.04);
    g.gain.setValueAtTime(0.06 * vel, t + dur * 0.8);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    lp.connect(g);
    g.connect(this.music);
    g.connect(this.verb);
    midis.forEach((m, i) => {
      [-6, 6].forEach((cents) => {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = mtof(m);
        o.detune.value = cents + i;
        o.connect(lp);
        o.start(t);
        o.stop(t + dur + 0.05);
      });
    });
  }

  // The talking drum, played by the player. It speaks: the pitch bends like a squeezed drum.
  talkingDrum(t, midi, lane, vel = 1) {
    const ctx = this.ctx;
    const f = mtof(midi);
    const bendUp = lane === 3;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(bendUp ? f * 0.82 : f * 1.32, t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.07);
    o.frequency.exponentialRampToValueAtTime(bendUp ? f * 1.12 : f * 0.94, t + 0.3);
    const o2 = ctx.createOscillator();
    o2.type = 'triangle';
    o2.frequency.setValueAtTime(f * 2.01 * (bendUp ? 0.85 : 1.25), t);
    o2.frequency.exponentialRampToValueAtTime(f * 2.01, t + 0.06);
    const g = this.env(t, 0.55 * vel, 0.002, 0.34, this.lead);
    g.connect(this.verb);
    const g2 = this.env(t, 0.12 * vel, 0.002, 0.12, this.lead);
    o.connect(g);
    o2.connect(g2);
    o.start(t); o2.start(t);
    o.stop(t + 0.4); o2.stop(t + 0.2);
    // the slap of the stick on skin
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2400;
    bp.Q.value = 1.2;
    const ng = this.env(t, 0.22 * vel, 0.001, 0.03, this.lead);
    this.noiseSource(t, 0.05).connect(bp).connect(ng);
  }

  // A dull muted knock, for a missed or wrong stroke.
  dud(t) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(70, t + 0.08);
    const g = this.env(t, 0.25, 0.002, 0.09, this.lead);
    o.connect(g);
    o.start(t);
    o.stop(t + 0.12);
  }

  // The crowd: a swell of voices and claps. amount is 0..1.
  cheer(t, amount = 0.6, length = 1.6) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5 * amount, t + 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, t + length);
    g.connect(this.crowd);
    // voices: noise through a few vowel-ish formants
    [520, 900, 2400].forEach((f, i) => {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(f * 0.9, t);
      bp.frequency.linearRampToValueAtTime(f * 1.1, t + length);
      bp.Q.value = 4;
      const pg = ctx.createGain();
      pg.gain.value = [1, 0.7, 0.3][i];
      this.noiseSource(t, length + 0.05).connect(bp).connect(pg).connect(g);
    });
    g.connect(this.verb);
  }

  // Ascending whistle for Owambe Mode.
  whistle(t) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(1900, t);
    o.frequency.linearRampToValueAtTime(2900, t + 0.18);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 28;
    const lg = ctx.createGain();
    lg.gain.value = 90;
    lfo.connect(lg).connect(o.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.08, t + 0.02);
    g.gain.setValueAtTime(0.08, t + 0.16);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
    o.connect(g).connect(this.master);
    o.start(t); lfo.start(t);
    o.stop(t + 0.26); lfo.stop(t + 0.26);
    const o2 = ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.setValueAtTime(2900, t + 0.28);
    const g2 = this.env(t + 0.28, 0.08, 0.02, 0.35, this.master);
    o2.connect(g2);
    o2.start(t + 0.28);
    o2.stop(t + 0.7);
  }
}
