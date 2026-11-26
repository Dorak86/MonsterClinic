// Prozeduraler Ton (WebAudio): Effekte und generative Musik

export class Audio {
  constructor() {
    this.ctx = null;
    this.sfxVol = 0.7;
    this.musicVol = 0.35;
    this.last = new Map();
    this.listener = { x: 0, y: 0, zoom: 1 };
  }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = 0.9;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 4;
    this.master.connect(comp).connect(c.destination);
    this.sfx = c.createGain();
    this.sfx.gain.value = this.sfxVol;
    this.sfx.connect(this.master);
    this.music = c.createGain();
    this.music.gain.value = this.musicVol;
    this.music.connect(this.master);
    // Hall
    this.verb = c.createConvolver();
    const len = c.sampleRate * 1.6;
    const buf = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    this.verb.buffer = buf;
    const vg = c.createGain();
    vg.gain.value = 0.25;
    this.verb.connect(vg).connect(this.master);
    this.noise = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const nd = this.noise.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  }

  setVolumes(sfx, music) {
    this.sfxVol = sfx; this.musicVol = music;
    if (this.sfx) this.sfx.gain.value = sfx;
    if (this.music) this.music.gain.value = music;
  }

  // Lautstärke nach Entfernung zur Kamera
  att(x, y) {
    if (x === undefined) return 1;
    const d = Math.hypot(x - this.listener.x, y - this.listener.y);
    const r = 14 * this.listener.zoom;
    if (d > r * 2.2) return 0;
    return Math.max(0, 1 - d / (r * 2.2));
  }

  noiseSrc(dur) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    s.loop = true;
    s.loopStart = Math.random() * 0.5;
    return s;
  }

  env(g, t, a, peak, d) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  play(name, x, y, vol = 1) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const a = this.att(x, y) * vol;
    if (a < 0.03) return;
    const now = this.ctx.currentTime;
    const lim = { flame: 0.12, laser: 0.08, rifle: 0.05, mg: 0.05, cannon: 0.08, impact: 0.05, explode: 0.06, thump: 0.08, rocket: 0.08, sniper: 0.1, salvo: 0.1 }[name] || 0.04;
    if ((this.last.get(name) || 0) > now - lim) return;
    this.last.set(name, now);
    const fn = this['s_' + name];
    if (fn) fn.call(this, now, a);
  }

  out(node, a, verb = 0.3) {
    const g = this.ctx.createGain();
    g.gain.value = a;
    node.connect(g);
    g.connect(this.sfx);
    if (verb) { const v = this.ctx.createGain(); v.gain.value = verb; g.connect(v).connect(this.verb); }
    return g;
  }

  shot(t, a, freq, q, dur, pitchDrop, gainPeak = 0.6) {
    const c = this.ctx;
    const n = this.noiseSrc();
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(freq, t);
    f.frequency.exponentialRampToValueAtTime(freq * pitchDrop, t + dur);
    f.Q.value = q;
    const g = c.createGain();
    this.env(g, t, 0.002, gainPeak, dur);
    n.connect(f).connect(g);
    this.out(g, a);
    n.start(t); n.stop(t + dur + 0.05);
  }

  boom(t, a, f0, dur, gainPeak = 0.9) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f0 * 0.3, t + dur);
    const g = c.createGain();
    this.env(g, t, 0.004, gainPeak, dur);
    o.connect(g);
    this.out(g, a, 0.5);
    o.start(t); o.stop(t + dur + 0.05);
  }

  s_rifle(t, a) { this.shot(t, a, 2400, 1.2, 0.09, 0.4, 0.45); this.boom(t, a * 0.3, 180, 0.06); }
  s_mg(t, a) { this.shot(t, a, 1900, 1.4, 0.07, 0.5, 0.4); }
  s_flame(t, a) { this.shot(t, a, 500, 0.6, 0.35, 0.8, 0.35); }
  s_laser(t, a) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(1800, t); o.frequency.exponentialRampToValueAtTime(300, t + 0.25);
    this.env(g, t, 0.005, 0.25, 0.25); o.connect(g); this.out(g, a, 0.4); o.start(t); o.stop(t + 0.3);
  }
  s_sniper(t, a) { this.shot(t, a, 3200, 0.8, 0.25, 0.2, 0.6); this.boom(t, a * 0.5, 220, 0.2); }
  s_cannon(t, a) { this.shot(t, a, 700, 0.7, 0.35, 0.25, 0.8); this.boom(t, a, 110, 0.4); }
  s_thump(t, a) { this.boom(t, a, 160, 0.18, 0.7); this.shot(t, a * 0.5, 500, 1, 0.12, 0.5); }
  s_rocket(t, a) {
    const c = this.ctx;
    const n = this.noiseSrc();
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(400, t);
    f.frequency.exponentialRampToValueAtTime(2400, t + 0.5);
    f.Q.value = 2;
    const g = c.createGain();
    this.env(g, t, 0.02, 0.5, 0.6);
    n.connect(f).connect(g);
    this.out(g, a);
    n.start(t); n.stop(t + 0.7);
  }
  s_salvo(t, a) { for (let i = 0; i < 4; i++) this.s_rocket(t + i * 0.18, a * 0.8); }
  s_impact(t, a) { this.shot(t, a * 0.5, 1200, 1, 0.06, 0.6, 0.3); }
  s_explode(t, a) {
    const c = this.ctx;
    const n = this.noiseSrc();
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(2200, t);
    f.frequency.exponentialRampToValueAtTime(120, t + 1.1);
    const g = c.createGain();
    this.env(g, t, 0.005, 1.0, 1.2);
    n.connect(f).connect(g);
    this.out(g, a, 0.6);
    n.start(t); n.stop(t + 1.3);
    this.boom(t, a, 70, 0.8, 1.0);
  }
  s_bigexplode(t, a) { this.s_explode(t, a); this.s_explode(t + 0.25, a * 0.8); this.boom(t, a, 45, 1.6, 1.0); }

  tone(t, f, dur, type = 'sine', vol = 0.2, dest) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.value = f;
    const g = c.createGain();
    this.env(g, t, 0.01, vol, dur);
    o.connect(g);
    if (dest) g.connect(dest); else this.out(g, 1, 0.3);
    o.start(t); o.stop(t + dur + 0.05);
  }

  s_click(t) { this.tone(t, 1200, 0.04, 'square', 0.06); }
  s_select(t) { this.tone(t, 880, 0.06, 'triangle', 0.12); this.tone(t + 0.05, 1320, 0.06, 'triangle', 0.1); }
  s_order(t) { this.tone(t, 660, 0.05, 'triangle', 0.12); this.tone(t + 0.06, 990, 0.08, 'triangle', 0.12); }
  s_capture(t) { [523, 659, 784, 1046].forEach((f, i) => this.tone(t + i * 0.09, f, 0.25, 'triangle', 0.16)); }
  s_lost(t) { [523, 440, 349].forEach((f, i) => this.tone(t + i * 0.12, f, 0.3, 'sawtooth', 0.08)); }
  s_spawn(t) { this.tone(t, 440, 0.08, 'triangle', 0.08); this.tone(t + 0.08, 660, 0.12, 'triangle', 0.08); }
  s_alarm(t) { for (let i = 0; i < 3; i++) this.tone(t + i * 0.22, 740, 0.14, 'square', 0.07); }
  s_radio(t) { this.tone(t, 1400, 0.04, 'square', 0.04); this.tone(t + 0.06, 1800, 0.05, 'square', 0.035); }
  s_board(t) { this.tone(t, 300, 0.1, 'sawtooth', 0.08); this.tone(t + 0.1, 600, 0.15, 'triangle', 0.1); }

  // ---------- Musik: generativer Puls ----------
  startMusic(mood = 0) {
    if (!this.ctx) return;
    this.stopMusic();
    const c = this.ctx;
    const bus = c.createGain();
    bus.gain.value = 0.0001;
    bus.gain.exponentialRampToValueAtTime(1, c.currentTime + 3);
    bus.connect(this.music);
    const vb = c.createGain(); vb.gain.value = 0.4; bus.connect(vb).connect(this.verb);
    this.musicBus = bus;
    const roots = [[110, 130.81, 146.83, 98], [98, 116.54, 130.81, 87.31], [123.47, 146.83, 164.81, 110]][mood % 3];
    const scale = [0, 3, 5, 7, 10, 12, 15];
    let step = 0;
    const bpm = 96;
    const sp = 60 / bpm / 2;
    let next = c.currentTime + 0.1;
    const tick = () => {
      if (!this.musicBus) return;
      while (next < c.currentTime + 0.4) {
        const bar = Math.floor(step / 16) % 4;
        const root = roots[bar];
        const s = step % 16;
        // Bass
        if (s % 4 === 0 || s === 6 || s === 14) this.tone(next, root / 2, sp * 1.6, 'sawtooth', s % 8 === 0 ? 0.16 : 0.1, this.filtered(bus, 600));
        // Puls
        if (s % 2 === 1) this.tone(next, root * 2, sp * 0.5, 'square', 0.025, this.filtered(bus, 1800));
        // Arpeggio
        if (Math.random() < 0.55 && s % 2 === 0) {
          const n = scale[Math.floor(Math.random() * scale.length)];
          this.tone(next, root * 2 * Math.pow(2, n / 12), sp * 1.2, 'triangle', 0.045, bus);
        }
        // Flächenklang zu Taktbeginn
        if (s === 0) {
          for (const n of [0, 7, 15]) this.tone(next, root * Math.pow(2, n / 12), sp * 15, 'sine', 0.04, bus);
        }
        // Trommel
        if (s % 8 === 0) this.kick(next, bus);
        if (s % 8 === 4) this.snare(next, bus);
        next += sp;
        step++;
      }
      this.musicTimer = setTimeout(tick, 120);
    };
    tick();
  }

  filtered(dest, freq) {
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = freq;
    f.connect(dest);
    return f;
  }

  kick(t, dest) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.2);
    const g = c.createGain();
    this.env(g, t, 0.003, 0.35, 0.25);
    o.connect(g).connect(dest);
    o.start(t); o.stop(t + 0.3);
  }

  snare(t, dest) {
    const c = this.ctx;
    const n = this.noiseSrc();
    const f = c.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 1500;
    const g = c.createGain();
    this.env(g, t, 0.002, 0.12, 0.15);
    n.connect(f).connect(g).connect(dest);
    n.start(t); n.stop(t + 0.2);
  }

  stopMusic() {
    if (this.musicTimer) clearTimeout(this.musicTimer);
    if (this.musicBus) {
      const b = this.musicBus;
      try {
        b.gain.cancelScheduledValues(this.ctx.currentTime);
        b.gain.setValueAtTime(b.gain.value, this.ctx.currentTime);
        b.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 1);
      } catch (e) { /* egal */ }
      setTimeout(() => b.disconnect(), 1200);
    }
    this.musicBus = null;
  }
}
