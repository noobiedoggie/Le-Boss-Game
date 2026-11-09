/**
 * PROCEDURAL AUDIO — every sound is synthesised with the Web Audio API.
 * No audio files. One-shot SFX + a tiny step sequencer for music.
 */

type Wave = OscillatorType;

interface ToneOpts {
  type?: Wave;
  vol?: number;
  attack?: number;
  slide?: number;
  vibrato?: number;
  vibratoRate?: number;
  delay?: number;
  filter?: number;
  dest?: AudioNode;
}

interface NoiseOpts {
  vol?: number;
  type?: BiquadFilterType;
  freq?: number;
  q?: number;
  slide?: number;
  attack?: number;
  delay?: number;
  dest?: AudioNode;
}

export type MusicMode = 'off' | 'menu' | 'build' | 'wave' | 'boss';

class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private noiseBuf!: AudioBuffer;
  private last = new Map<string, number>();
  private voices = 0;
  sfxVol = 0.9;
  musicVol = 0.55;
  private fanfareNodes: AudioScheduledSourceNode[] = [];
  private fanfareUntil = 0;
  // music
  private mode: MusicMode = 'off';
  private wantMode: MusicMode = 'off';
  private step = 0;
  private nextTime = 0;
  private timer: number | null = null;
  private bar = 0;

  /** Must be called from a user gesture (autoplay policies). */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC({ latencyHint: 'interactive' });
    this.ctx = ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(comp).connect(ctx.destination);
    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = this.sfxVol;
    this.sfxBus.connect(this.master);
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = this.musicVol * 0.5;
    this.musicBus.connect(this.master);
    const len = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.setMusic(this.wantMode);
  }

  setVolumes(sfx: number, music: number): void {
    this.sfxVol = sfx;
    this.musicVol = music;
    if (!this.ctx) return;
    this.sfxBus.gain.value = sfx;
    this.musicBus.gain.value = music * 0.5;
  }

  suspend(): void {
    void this.ctx?.suspend();
  }
  resume(): void {
    void this.ctx?.resume();
  }

  // ------------------------------------------------------------ primitives
  private tone(freq: number, dur: number, o: ToneOpts = {}): OscillatorNode | null {
    const ctx = this.ctx;
    if (!ctx) return null;
    const t0 = ctx.currentTime + (o.delay ?? 0);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.slide), t0 + dur);
    const vol = (o.vol ?? 0.3);
    const a = o.attack ?? 0.005;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let node: AudioNode = osc;
    if (o.filter) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = o.filter;
      osc.connect(f);
      node = f;
    }
    node.connect(g).connect(o.dest ?? this.sfxBus);
    if (o.vibrato) {
      const lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      lfo.frequency.value = o.vibratoRate ?? 7;
      lg.gain.value = o.vibrato;
      lfo.connect(lg).connect(osc.frequency);
      lfo.start(t0);
      lfo.stop(t0 + dur + 0.05);
    }
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
    this.voices++;
    osc.onended = () => this.voices--;
    return osc;
  }

  private noise(dur: number, o: NoiseOpts = {}): AudioBufferSourceNode | null {
    const ctx = this.ctx;
    if (!ctx) return null;
    const t0 = ctx.currentTime + (o.delay ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = o.type ?? 'lowpass';
    f.frequency.setValueAtTime(o.freq ?? 2000, t0);
    if (o.slide) f.frequency.exponentialRampToValueAtTime(Math.max(30, o.slide), t0 + dur);
    f.Q.value = o.q ?? 1;
    const g = ctx.createGain();
    const vol = o.vol ?? 0.3;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + (o.attack ?? 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(o.dest ?? this.sfxBus);
    src.start(t0, Math.random() * 1.5);
    src.stop(t0 + dur + 0.05);
    this.voices++;
    src.onended = () => this.voices--;
    return src;
  }

  /** Vowel-ish formant voice (used for the evil laugh). */
  private formant(freq: number, dur: number, delay: number, vol: number, slide?: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, t0);
    if (slide) osc.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    for (const [ff, q, gv] of [[750, 6, 1], [1150, 8, 0.6], [2400, 10, 0.25]] as [number, number, number][]) {
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = ff;
      f.Q.value = q;
      const fg = ctx.createGain();
      fg.gain.value = gv;
      osc.connect(f).connect(fg).connect(g);
    }
    g.connect(this.sfxBus);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  private throttle(name: string, ms: number): boolean {
    const now = performance.now();
    const l = this.last.get(name) ?? 0;
    if (now - l < ms) return false;
    this.last.set(name, now);
    return true;
  }

  // ---------------------------------------------------------------- SFX
  play(name: string, pitch = 1): void {
    if (!this.ctx || this.sfxVol <= 0) return;
    if (this.voices > 64) return;
    const p = pitch;
    switch (name) {
      case 'whoosh':
        if (!this.throttle(name, 40)) return;
        this.noise(0.2, { type: 'bandpass', freq: 500, slide: 2400, q: 2, vol: 0.35 });
        break;
      case 'explosion':
        if (!this.throttle(name, 45)) return;
        this.noise(0.55, { type: 'lowpass', freq: 1800 * p, slide: 120, vol: 0.55 });
        this.tone(110 * p, 0.35, { slide: 38, vol: 0.6 });
        break;
      case 'claw':
        for (let i = 0; i < 3; i++) this.noise(0.09, { type: 'highpass', freq: 2500 + i * 900, slide: 6000, vol: 0.35, delay: i * 0.035 });
        this.tone(220, 0.15, { type: 'sawtooth', slide: 90, vol: 0.12, filter: 900 });
        break;
      case 'roar':
        this.tone(95, 0.95, { type: 'sawtooth', slide: 70, vol: 0.4, vibrato: 18, vibratoRate: 22, filter: 900 });
        this.tone(48, 1.0, { type: 'square', slide: 40, vol: 0.25, filter: 300 });
        this.noise(0.9, { type: 'lowpass', freq: 900, slide: 300, vol: 0.4 });
        break;
      case 'charge':
        this.tone(180, 0.7, { type: 'sawtooth', slide: 520, vol: 0.12, filter: 1200, attack: 0.2 });
        break;
      case 'spike':
        if (!this.throttle(name, 55)) return;
        this.tone(1900 * p, 0.07, { type: 'square', slide: 900, vol: 0.12 });
        this.noise(0.06, { type: 'highpass', freq: 5000, vol: 0.15 });
        break;
      case 'flame':
        if (!this.throttle(name, 80)) return;
        this.noise(0.4, { type: 'bandpass', freq: 700, slide: 1500, q: 0.8, vol: 0.4, attack: 0.03 });
        break;
      case 'axe':
        if (!this.throttle(name, 80)) return;
        this.noise(0.28, { type: 'bandpass', freq: 300, slide: 1800, q: 3, vol: 0.35 });
        break;
      case 'gas':
        if (!this.throttle(name, 200)) return;
        this.noise(0.7, { type: 'highpass', freq: 3500, vol: 0.12, attack: 0.1 });
        break;
      case 'trapdoor':
        if (!this.throttle(name, 100)) return;
        this.tone(140, 0.22, { type: 'sawtooth', slide: 80, vol: 0.18, filter: 700 });
        this.noise(0.1, { type: 'lowpass', freq: 600, vol: 0.3, delay: 0.18 });
        break;
      case 'whistle':
        this.tone(1900, 0.65, { slide: 260, vol: 0.18 });
        break;
      case 'boing':
        if (!this.throttle(name, 60)) return;
        this.tone(170 * p, 0.42, { type: 'sine', slide: 560 * p, vol: 0.4, vibrato: 40, vibratoRate: 18 });
        this.tone(85 * p, 0.2, { type: 'triangle', slide: 260, vol: 0.25 });
        break;
      case 'land':
        if (!this.throttle(name, 60)) return;
        this.noise(0.12, { type: 'lowpass', freq: 500, vol: 0.3 });
        this.tone(130, 0.12, { slide: 55, vol: 0.3 });
        break;
      case 'chomp':
        for (let i = 0; i < 2; i++) {
          this.noise(0.08, { type: 'lowpass', freq: 1400, vol: 0.45, delay: i * 0.13 });
          this.tone(220, 0.1, { type: 'square', slide: 70, vol: 0.2, delay: i * 0.13, filter: 900 });
        }
        break;
      case 'coin':
        if (!this.throttle(name, 45)) return;
        this.tone(1320 * p, 0.09, { type: 'square', vol: 0.07, filter: 5000 });
        this.tone(1760 * p, 0.18, { type: 'square', vol: 0.07, delay: 0.06, filter: 5000 });
        break;
      case 'death':
        if (!this.throttle(name, 35)) return;
        this.tone(520 * p, 0.09, { slide: 1300 * p, vol: 0.3 });
        this.noise(0.12, { type: 'bandpass', freq: 2600, q: 0.7, vol: 0.25 });
        for (let i = 0; i < 3; i++) this.tone(2000 + Math.random() * 2500, 0.05, { vol: 0.05, delay: 0.05 + i * 0.04 });
        break;
      case 'bigDeath':
        this.tone(320, 0.12, { type: 'triangle', slide: 160, vol: 0.4 });
        this.noise(0.15, { type: 'lowpass', freq: 900, vol: 0.35 });
        this.tone(900, 0.7, { slide: 3000, vol: 0.1, delay: 0.08 });
        break;
      case 'bossHit':
        this.tone(70, 0.35, { slide: 35, vol: 0.6 });
        this.noise(0.2, { type: 'lowpass', freq: 1200, vol: 0.4 });
        break;
      case 'bossDeath':
        this.tone(220, 1.6, { type: 'sawtooth', slide: 40, vol: 0.35, filter: 1500, vibrato: 10 });
        this.noise(1.4, { type: 'lowpass', freq: 800, slide: 60, vol: 0.4 });
        break;
      case 'laugh':
        if (!this.throttle(name, 900)) return;
        this.evilLaugh();
        break;
      case 'fanfare':
        this.fanfare();
        break;
      case 'hit':
        if (!this.throttle(name, 40)) return;
        this.noise(0.07, { type: 'bandpass', freq: 1500 * p, q: 1.2, vol: 0.25 });
        this.tone(160 * p, 0.07, { type: 'square', slide: 90, vol: 0.08, filter: 800 });
        break;
      case 'thud':
        if (!this.throttle(name, 60)) return;
        this.tone(90, 0.2, { slide: 40, vol: 0.5 });
        this.noise(0.12, { type: 'lowpass', freq: 500, vol: 0.35 });
        break;
      case 'bow':
        if (!this.throttle(name, 60)) return;
        this.tone(420 * p, 0.12, { type: 'triangle', slide: 180, vol: 0.15 });
        this.noise(0.05, { type: 'highpass', freq: 3000, vol: 0.1 });
        break;
      case 'zap':
        if (!this.throttle(name, 60)) return;
        this.tone(1100 * p, 0.14, { type: 'square', slide: 280 * p, vol: 0.08, filter: 3000 });
        break;
      case 'monsterDie':
        this.noise(0.25, { type: 'lowpass', freq: 1500, slide: 200, vol: 0.3 });
        this.tone(300, 0.25, { type: 'sawtooth', slide: 80, vol: 0.12, filter: 1000 });
        break;
      case 'pop':
        this.tone(400, 0.08, { slide: 1400, vol: 0.3 });
        break;
      case 'poof':
        this.noise(0.3, { type: 'lowpass', freq: 1200, slide: 300, vol: 0.3 });
        break;
      case 'respawn':
        [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.12, { type: 'triangle', vol: 0.15, delay: i * 0.06 }));
        break;
      case 'disarm':
        this.tone(1500, 0.03, { type: 'square', vol: 0.1 });
        this.tone(1100, 0.03, { type: 'square', vol: 0.1, delay: 0.08 });
        break;
      case 'glitch':
        if (!this.throttle(name, 120)) return;
        for (let i = 0; i < 5; i++) this.tone(200 + Math.random() * 2000, 0.03, { type: 'square', vol: 0.06, delay: i * 0.025 });
        break;
      case 'stamp':
        this.tone(120, 0.15, { slide: 60, vol: 0.4 });
        this.noise(0.08, { type: 'lowpass', freq: 800, vol: 0.4 });
        this.tone(880, 0.3, { type: 'triangle', vol: 0.1, delay: 0.1 });
        break;
      case 'aww':
        this.tone(500, 0.25, { slide: 800, vol: 0.15 });
        this.tone(800, 0.35, { slide: 450, vol: 0.15, delay: 0.25 });
        break;
      case 'evolve':
        [392, 494, 587, 784].forEach((f, i) => this.tone(f, 0.15, { type: 'square', vol: 0.07, delay: i * 0.07, filter: 3000 }));
        break;
      case 'raise':
        this.tone(80, 0.6, { type: 'sawtooth', slide: 220, vol: 0.2, filter: 700 });
        this.noise(0.4, { type: 'bandpass', freq: 400, vol: 0.15 });
        break;
      case 'summon':
        [294, 349, 440, 587].forEach((f, i) => this.tone(f, 0.18, { type: 'sawtooth', vol: 0.08, delay: i * 0.06, filter: 1500 }));
        break;
      case 'possess':
        this.tone(200, 0.8, { type: 'sawtooth', slide: 60, vol: 0.2, vibrato: 30, vibratoRate: 9, filter: 1200 });
        break;
      case 'blackhole':
        this.tone(60, 2.5, { type: 'sine', slide: 40, vol: 0.4, vibrato: 8, vibratoRate: 5, attack: 0.3 });
        this.noise(2.5, { type: 'lowpass', freq: 400, vol: 0.2, attack: 0.4 });
        break;
      case 'implode':
        this.noise(0.25, { type: 'bandpass', freq: 300, slide: 3000, vol: 0.4 });
        this.tone(80, 0.45, { slide: 30, vol: 0.6, delay: 0.2 });
        break;
      case 'freeze':
        for (let i = 0; i < 6; i++) this.tone(1800 + i * 300, 0.5, { vol: 0.05, delay: i * 0.04, vibrato: 30 });
        this.noise(0.5, { type: 'highpass', freq: 6000, vol: 0.12 });
        break;
      case 'rumble':
        this.noise(0.8, { type: 'lowpass', freq: 300, vol: 0.4 });
        break;
      case 'splash':
        this.noise(0.3, { type: 'bandpass', freq: 1200, slide: 400, vol: 0.4 });
        break;
      case 'sizzle':
        this.noise(0.6, { type: 'highpass', freq: 4000, vol: 0.2 });
        break;
      case 'bonk':
        if (!this.throttle(name, 80)) return;
        this.tone(600, 0.12, { type: 'triangle', slide: 300, vol: 0.35 });
        break;
      case 'crumble':
        this.noise(0.6, { type: 'lowpass', freq: 900, slide: 150, vol: 0.45 });
        for (let i = 0; i < 4; i++) this.noise(0.05, { type: 'bandpass', freq: 800 + i * 300, vol: 0.2, delay: 0.1 + i * 0.08 });
        break;
      case 'glass':
        this.noise(0.4, { type: 'highpass', freq: 5000, vol: 0.35 });
        for (let i = 0; i < 5; i++) this.tone(2500 + Math.random() * 3000, 0.2, { vol: 0.08, delay: i * 0.03 });
        break;
      case 'shield':
        this.tone(900, 0.4, { vol: 0.1, vibrato: 40, vibratoRate: 12 });
        break;
      case 'rageReady':
        [147, 220, 294].forEach((f) => this.tone(f, 0.9, { type: 'sawtooth', vol: 0.12, filter: 1500, attack: 0.05 }));
        this.tone(587, 0.6, { type: 'square', vol: 0.06, delay: 0.1, filter: 2500 });
        break;
      case 'ultimate':
        this.play('roar');
        this.noise(1.6, { type: 'lowpass', freq: 200, slide: 2000, vol: 0.4, attack: 0.6 });
        this.tone(55, 1.8, { type: 'sawtooth', slide: 30, vol: 0.3, filter: 400, delay: 0.5 });
        break;
      case 'click':
        this.tone(750, 0.05, { type: 'square', vol: 0.08, filter: 3000 });
        break;
      case 'back':
        this.tone(500, 0.06, { type: 'square', slide: 350, vol: 0.08, filter: 3000 });
        break;
      case 'place':
        this.tone(220, 0.1, { type: 'triangle', slide: 440, vol: 0.25 });
        this.noise(0.08, { type: 'lowpass', freq: 900, vol: 0.25 });
        break;
      case 'sell':
        this.tone(880, 0.08, { type: 'square', vol: 0.06 });
        this.tone(660, 0.12, { type: 'square', vol: 0.06, delay: 0.07 });
        break;
      case 'upgrade':
        [523, 659, 784].forEach((f, i) => this.tone(f, 0.12, { type: 'square', vol: 0.07, delay: i * 0.05, filter: 3000 }));
        break;
      case 'error':
        this.tone(140, 0.18, { type: 'square', vol: 0.12, filter: 900 });
        break;
      case 'pact':
        for (let i = 0; i < 8; i++) this.tone(600 + i * 150, 0.25, { type: 'sine', vol: 0.05, delay: i * 0.03 });
        this.tone(147, 0.8, { type: 'sawtooth', vol: 0.12, filter: 800 });
        break;
      case 'cursed':
        this.tone(110, 0.9, { type: 'sawtooth', slide: 98, vol: 0.2, filter: 600, vibrato: 6 });
        this.tone(117, 0.9, { type: 'sawtooth', slide: 104, vol: 0.2, filter: 600 });
        break;
      case 'card':
        this.noise(0.08, { type: 'bandpass', freq: 3000, vol: 0.15 });
        break;
      case 'streak': {
        const base = 300 * p;
        [1, 1.25, 1.5, 2].forEach((m, i) => this.tone(base * m, 0.1, { type: 'square', vol: 0.08, delay: i * 0.045, filter: 4000 }));
        break;
      }
      case 'combo':
        [659, 880, 1318].forEach((f, i) => this.tone(f, 0.12, { type: 'triangle', vol: 0.15, delay: i * 0.05 }));
        break;
      case 'waveClear':
        [294, 349, 440, 587, 523, 587].forEach((f, i) => this.tone(f, i === 5 ? 0.5 : 0.12, { type: 'square', vol: 0.08, delay: i * 0.1, filter: 2400 }));
        break;
      case 'victory':
        [523, 659, 784, 1046, 784, 1046].forEach((f, i) => this.tone(f, i === 5 ? 0.9 : 0.16, { type: 'square', vol: 0.1, delay: i * 0.14, filter: 3000 }));
        break;
      case 'defeat':
        [392, 370, 349, 330].forEach((f, i) => this.tone(f, i === 3 ? 0.9 : 0.3, { type: 'sawtooth', vol: 0.12, delay: i * 0.32, filter: 1200, vibrato: i === 3 ? 6 : 0 }));
        break;
      case 'buy':
        this.play('coin', 1);
        this.play('upgrade');
        break;
      case 'tick':
        this.tone(1000, 0.03, { type: 'square', vol: 0.05 });
        break;
    }
  }

  private evilLaugh(): void {
    // "MWA-HA-HA-HA-HA" descending
    const notes = [170, 160, 150, 142, 135];
    this.formant(110, 0.22, 0, 0.32, 170);
    notes.forEach((f, i) => this.formant(f, 0.15, 0.24 + i * 0.17, 0.34, f * 0.86));
  }

  /** Heroic fanfare. Cut off (sad trombone) if a hero dies while it plays. */
  private fanfare(): void {
    const ctx = this.ctx;
    if (!ctx || !this.throttle('fanfare', 1500)) return;
    this.fanfareNodes = [];
    const seq: [number, number][] = [[523, 0.12], [523, 0.12], [523, 0.12], [698, 0.6]];
    let d = 0;
    for (const [f, len] of seq) {
      const o1 = this.tone(f, len, { type: 'sawtooth', vol: 0.11, delay: d, filter: 2600 });
      const o2 = this.tone(f * 1.5, len, { type: 'square', vol: 0.04, delay: d, filter: 2600 });
      if (o1) this.fanfareNodes.push(o1);
      if (o2) this.fanfareNodes.push(o2);
      d += len + 0.03;
    }
    this.fanfareUntil = ctx.currentTime + d;
  }

  /** Call on hero death: if the fanfare is still playing, cut it. */
  cutFanfare(): boolean {
    const ctx = this.ctx;
    if (!ctx || ctx.currentTime > this.fanfareUntil) return false;
    for (const n of this.fanfareNodes) {
      try {
        n.stop();
      } catch {
        /* already stopped */
      }
    }
    this.fanfareNodes = [];
    this.fanfareUntil = 0;
    // record scratch + sad trombone "wah wah"
    this.noise(0.12, { type: 'bandpass', freq: 1800, slide: 300, q: 2, vol: 0.3 });
    [233, 220, 208, 196].forEach((f, i) => this.tone(f, i === 3 ? 0.7 : 0.3, { type: 'sawtooth', vol: 0.12, delay: 0.12 + i * 0.3, filter: 900, vibrato: i === 3 ? 8 : 0, vibratoRate: 6 }));
    return true;
  }

  /** Animal-Crossing style gibberish for speech bubbles. */
  voice(base: number, kind: 'normal' | 'chicken' | 'deep' | 'squeak' | 'robot' = 'normal'): void {
    if (!this.ctx || !this.throttle('voice', 120)) return;
    const n = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const f = base * (0.8 + Math.random() * 0.5);
      if (kind === 'chicken') this.tone(f * 1.6, 0.06, { type: 'square', slide: f * 2.2, vol: 0.06, delay: i * 0.08, filter: 3000 });
      else if (kind === 'robot') this.tone(f, 0.05, { type: 'square', vol: 0.04, delay: i * 0.06, filter: 2000 });
      else this.tone(f, 0.055, { type: 'triangle', vol: kind === 'deep' ? 0.12 : 0.08, delay: i * 0.065, slide: f * (Math.random() < 0.5 ? 1.2 : 0.85) });
    }
  }

  // --------------------------------------------------------------- MUSIC
  setMusic(mode: MusicMode): void {
    this.wantMode = mode;
    if (!this.ctx) return;
    if (mode === this.mode) return;
    this.mode = mode;
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (mode === 'off') return;
    this.step = 0;
    this.bar = 0;
    this.nextTime = this.ctx.currentTime + 0.08;
    this.timer = window.setInterval(() => this.schedule(), 25);
  }

  private bpm(): number {
    return this.mode === 'wave' ? 128 : this.mode === 'boss' ? 144 : this.mode === 'build' ? 96 : 84;
  }

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx || this.musicVol <= 0) return;
    const spb = 60 / this.bpm() / 4; // 16th notes
    while (this.nextTime < ctx.currentTime + 0.12) {
      this.playStep(this.step, this.nextTime);
      this.step = (this.step + 1) % 16;
      if (this.step === 0) this.bar = (this.bar + 1) % 4;
      this.nextTime += spb;
    }
  }

  private mNote(freq: number, t: number, dur: number, type: Wave, vol: number, filter = 2000): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filter;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f).connect(g).connect(this.musicBus);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private mNoise(t: number, dur: number, type: BiquadFilterType, freq: number, vol: number): void {
    const ctx = this.ctx!;
    const s = ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.musicBus);
    s.start(t, Math.random());
    s.stop(t + dur + 0.02);
  }

  private kick(t: number, vol = 0.9): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g).connect(this.musicBus);
    o.start(t);
    o.stop(t + 0.2);
  }

  private playStep(s: number, t: number): void {
    // D minor: Dm - Bb - C - A
    const roots = [73.42, 58.27, 65.41, 55.0];
    const chords = [[293.7, 349.2, 440.0], [233.1, 293.7, 349.2], [261.6, 329.6, 392.0], [220.0, 277.2, 329.6]];
    const root = roots[this.bar];
    const ch = chords[this.bar];
    const m = this.mode;
    if (m === 'menu') {
      if (s % 2 === 0) this.mNote(ch[(s / 2) % 3] * (s % 8 < 4 ? 1 : 2), t, 0.35, 'square', 0.035, 1800);
      if (s === 0) this.mNote(root * 2, t, 1.8, 'triangle', 0.12, 600);
      if (s === 8) this.mNote(root * 3, t, 0.8, 'triangle', 0.05, 600);
    } else if (m === 'build') {
      if (s === 0) for (const f of ch) this.mNote(f / 2, t, 2.4, 'triangle', 0.06, 900);
      if (s % 4 === 0) this.mNote(root, t, 0.5, 'sine', 0.22, 400);
      if (s % 2 === 0 && s !== 0) this.mNote(ch[(s / 2) % 3] * 2, t, 0.18, 'square', 0.025, 2500);
      if (s === 4 || s === 12) this.mNoise(t, 0.05, 'highpass', 7000, 0.05);
    } else {
      const intense = m === 'boss';
      // drums
      if (s % 4 === 0) this.kick(t, intense ? 1 : 0.85);
      if (s === 4 || s === 12) this.mNoise(t, 0.16, 'bandpass', 1800, 0.35);
      if (s % 2 === 1 || intense) this.mNoise(t, 0.03, 'highpass', 8000, s % 4 === 2 ? 0.12 : 0.06);
      // bass
      const bassPat = [1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 2, 1];
      if (bassPat[s]) this.mNote(root * (bassPat[s] === 2 ? 2 : 1), t, 0.14, 'sawtooth', 0.16, 700);
      // arp
      if (s % 2 === 0) {
        const n = ch[(s / 2) % 3] * (intense && s % 4 === 0 ? 2 : 1);
        this.mNote(n, t, 0.12, 'square', 0.03, 2400);
      }
      if (intense && s === 0) this.mNote(ch[0] * 2, t, 0.9, 'sawtooth', 0.04, 1800);
    }
  }
}

export const audio = new AudioEngine();
