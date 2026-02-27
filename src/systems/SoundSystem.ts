// Procedural Sound & Music System — Web Audio API only, no external files

type SoundName =
  | 'shoot_arrow' | 'shoot_cannon' | 'shoot_ice' | 'shoot_fire'
  | 'shoot_laser' | 'shoot_electric'
  | 'explosion' | 'hit_normal' | 'hit_crit' | 'enemy_death'
  | 'tower_place' | 'tower_upgrade'
  | 'wave_start' | 'wave_complete'
  | 'skill_activate' | 'gold_earn' | 'base_hit'
  | 'ui_click' | 'ui_hover';

type MusicMood = 'calm' | 'tense' | 'dark' | 'desert' | 'battle';

// ── helpers ──────────────────────────────────────────────────────────
function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

// ── SoundSystem ──────────────────────────────────────────────────────
export class SoundSystem {
  private static instance: SoundSystem | null = null;

  private ctx: AudioContext | null = null;
  private masterGain!: GainNode;
  private sfxGain!: GainNode;
  private musicGain!: GainNode;

  private masterVol = 0.5;
  private sfxVol = 0.7;
  private musicVol = 0.3;
  private muted = false;

  // Music state
  private musicPlaying = false;
  private currentMood: MusicMood | null = null;
  private musicOscillators: OscillatorNode[] = [];
  private musicGains: GainNode[] = [];
  private musicFilters: BiquadFilterNode[] = [];
  private musicLFOs: OscillatorNode[] = [];
  private musicInterval: ReturnType<typeof setInterval> | null = null;

  // ── singleton ──────────────────────────────────────────────────────
  static getInstance(): SoundSystem {
    if (!SoundSystem.instance) {
      SoundSystem.instance = new SoundSystem();
    }
    return SoundSystem.instance;
  }

  constructor() {
    // Lazily create AudioContext on first user gesture
    const initOnGesture = () => {
      if (!this.ctx) {
        this.initAudioContext();
      }
      document.removeEventListener('click', initOnGesture);
      document.removeEventListener('keydown', initOnGesture);
      document.removeEventListener('pointerdown', initOnGesture);
    };
    document.addEventListener('click', initOnGesture);
    document.addEventListener('keydown', initOnGesture);
    document.addEventListener('pointerdown', initOnGesture);

    // Wire up UI controls if they exist
    this.initUIControls();
  }

  private initUIControls(): void {
    const muteBtn = document.getElementById('mute-btn');
    const volumeSlider = document.getElementById('volume-slider') as HTMLInputElement | null;

    if (muteBtn) {
      muteBtn.addEventListener('click', () => {
        const nowMuted = this.toggleMute();
        muteBtn.innerHTML = nowMuted ? '&#128264;' : '&#128266;';
      });
    }

    if (volumeSlider) {
      volumeSlider.addEventListener('input', () => {
        const val = parseInt(volumeSlider.value, 10) / 100;
        this.setMasterVolume(val);
        // Update icon if un-muting via slider
        if (muteBtn && val > 0 && this.muted) {
          this.muted = false;
          if (this.masterGain) this.masterGain.gain.value = this.masterVol;
          muteBtn.innerHTML = '&#128266;';
        }
      });
    }
  }

  private initAudioContext(): void {
    this.ctx = new AudioContext();

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.masterVol;
    this.masterGain.connect(this.ctx.destination);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = this.sfxVol;
    this.sfxGain.connect(this.masterGain);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = this.musicVol;
    this.musicGain.connect(this.masterGain);
  }

  private ensureCtx(): AudioContext | null {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  // ── volume controls ────────────────────────────────────────────────
  setMasterVolume(vol: number): void {
    this.masterVol = clamp01(vol);
    if (this.masterGain) this.masterGain.gain.value = this.muted ? 0 : this.masterVol;
  }

  setSfxVolume(vol: number): void {
    this.sfxVol = clamp01(vol);
    if (this.sfxGain) this.sfxGain.gain.value = this.sfxVol;
  }

  setMusicVolume(vol: number): void {
    this.musicVol = clamp01(vol);
    if (this.musicGain) this.musicGain.gain.value = this.musicVol;
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.masterGain) {
      this.masterGain.gain.value = this.muted ? 0 : this.masterVol;
    }
    return this.muted;
  }

  isMuted(): boolean {
    return this.muted;
  }

  getMasterVolume(): number {
    return this.masterVol;
  }

  // ── SFX ────────────────────────────────────────────────────────────
  play(sound: SoundName | string, volume: number = 1): void {
    const ctx = this.ensureCtx();
    if (!ctx) return;

    const vol = clamp01(volume);
    const t = ctx.currentTime;

    switch (sound as SoundName) {
      case 'shoot_arrow':   this.playShootArrow(ctx, t, vol); break;
      case 'shoot_cannon':  this.playShootCannon(ctx, t, vol); break;
      case 'shoot_ice':     this.playShootIce(ctx, t, vol); break;
      case 'shoot_fire':    this.playShootFire(ctx, t, vol); break;
      case 'shoot_laser':   this.playShootLaser(ctx, t, vol); break;
      case 'shoot_electric':this.playShootElectric(ctx, t, vol); break;
      case 'explosion':     this.playExplosion(ctx, t, vol); break;
      case 'hit_normal':    this.playHitNormal(ctx, t, vol); break;
      case 'hit_crit':      this.playHitCrit(ctx, t, vol); break;
      case 'enemy_death':   this.playEnemyDeath(ctx, t, vol); break;
      case 'tower_place':   this.playTowerPlace(ctx, t, vol); break;
      case 'tower_upgrade': this.playTowerUpgrade(ctx, t, vol); break;
      case 'wave_start':    this.playWaveStart(ctx, t, vol); break;
      case 'wave_complete': this.playWaveComplete(ctx, t, vol); break;
      case 'skill_activate':this.playSkillActivate(ctx, t, vol); break;
      case 'gold_earn':     this.playGoldEarn(ctx, t, vol); break;
      case 'base_hit':      this.playBaseHit(ctx, t, vol); break;
      case 'ui_click':      this.playUIClick(ctx, t, vol); break;
      case 'ui_hover':      this.playUIHover(ctx, t, vol); break;
    }
  }

  // ── helper: connect a chain → sfxGain ──────────────────────────────
  private sfxOut(node: AudioNode): void {
    node.connect(this.sfxGain);
  }

  // ── helper: create noise buffer ────────────────────────────────────
  private noiseBuffer(ctx: AudioContext, duration: number): AudioBuffer {
    const len = Math.ceil(ctx.sampleRate * duration);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  // ── 1. shoot_arrow: quick pluck ────────────────────────────────────
  private playShootArrow(ctx: AudioContext, t: number, vol: number): void {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.exponentialRampToValueAtTime(440, t + 0.06);
    g.gain.setValueAtTime(0.3 * vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    osc.connect(g);
    this.sfxOut(g);
    osc.start(t);
    osc.stop(t + 0.1);
  }

  // ── 2. shoot_cannon: low boom ──────────────────────────────────────
  private playShootCannon(ctx: AudioContext, t: number, vol: number): void {
    // Sine sweep
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, t);
    osc.frequency.exponentialRampToValueAtTime(50, t + 0.3);
    g.gain.setValueAtTime(0.4 * vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc.connect(g);
    this.sfxOut(g);
    osc.start(t);
    osc.stop(t + 0.31);

    // Noise layer
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer(ctx, 0.3);
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.15 * vol, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 600;
    noise.connect(filt);
    filt.connect(ng);
    this.sfxOut(ng);
    noise.start(t);
    noise.stop(t + 0.3);
  }

  // ── 3. shoot_ice: crystal chime ────────────────────────────────────
  private playShootIce(ctx: AudioContext, t: number, vol: number): void {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const lfo = ctx.createOscillator();
    const lfoG = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.value = 800;
    lfo.type = 'sine';
    lfo.frequency.value = 30; // fast tremolo
    lfoG.gain.value = 0.15 * vol;
    lfo.connect(lfoG);
    lfoG.connect(g.gain);
    g.gain.setValueAtTime(0.2 * vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(g);
    this.sfxOut(g);
    osc.start(t);
    lfo.start(t);
    osc.stop(t + 0.15);
    lfo.stop(t + 0.15);
  }

  // ── 4. shoot_fire: whoosh filtered noise sweep ─────────────────────
  private playShootFire(ctx: AudioContext, t: number, vol: number): void {
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer(ctx, 0.25);
    const filt = ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.setValueAtTime(400, t);
    filt.frequency.exponentialRampToValueAtTime(2000, t + 0.12);
    filt.frequency.exponentialRampToValueAtTime(300, t + 0.2);
    filt.Q.value = 2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.25 * vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    noise.connect(filt);
    filt.connect(g);
    this.sfxOut(g);
    noise.start(t);
    noise.stop(t + 0.22);
  }

  // ── 5. shoot_laser: high sawtooth buzz ─────────────────────────────
  private playShootLaser(ctx: AudioContext, t: number, vol: number): void {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1200, t);
    osc.frequency.linearRampToValueAtTime(900, t + 0.1);
    g.gain.setValueAtTime(0.12 * vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    osc.connect(g);
    this.sfxOut(g);
    osc.start(t);
    osc.stop(t + 0.1);
  }

  // ── 6. shoot_electric: zap with random pitch ───────────────────────
  private playShootElectric(ctx: AudioContext, t: number, vol: number): void {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'square';
    const baseFreq = 300 + Math.random() * 600;
    osc.frequency.setValueAtTime(baseFreq, t);
    osc.frequency.setValueAtTime(baseFreq * 1.5, t + 0.03);
    osc.frequency.setValueAtTime(baseFreq * 0.7, t + 0.07);
    osc.frequency.setValueAtTime(baseFreq * 1.2, t + 0.1);
    g.gain.setValueAtTime(0.12 * vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(g);
    this.sfxOut(g);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  // ── 7. explosion: big boom ─────────────────────────────────────────
  private playExplosion(ctx: AudioContext, t: number, vol: number): void {
    // Low sine
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.5);
    g.gain.setValueAtTime(0.5 * vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    osc.connect(g);
    this.sfxOut(g);
    osc.start(t);
    osc.stop(t + 0.51);

    // Noise burst
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer(ctx, 0.5);
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.35 * vol, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.setValueAtTime(2000, t);
    filt.frequency.exponentialRampToValueAtTime(100, t + 0.4);
    noise.connect(filt);
    filt.connect(ng);
    this.sfxOut(ng);
    noise.start(t);
    noise.stop(t + 0.5);
  }

  // ── 8. hit_normal: thud ────────────────────────────────────────────
  private playHitNormal(ctx: AudioContext, t: number, vol: number): void {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.08);
    g.gain.setValueAtTime(0.25 * vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc.connect(g);
    this.sfxOut(g);
    osc.start(t);
    osc.stop(t + 0.08);
  }

  // ── 9. hit_crit: sharper impact ────────────────────────────────────
  private playHitCrit(ctx: AudioContext, t: number, vol: number): void {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const dist = ctx.createWaveShaper();
    // Simple distortion curve
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = (i / 128) - 1;
      curve[i] = (Math.PI + 4) * x / (Math.PI + 4 * Math.abs(x));
    }
    dist.curve = curve;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.exponentialRampToValueAtTime(100, t + 0.12);
    g.gain.setValueAtTime(0.3 * vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc.connect(dist);
    dist.connect(g);
    this.sfxOut(g);
    osc.start(t);
    osc.stop(t + 0.12);
  }

  // ── 10. enemy_death: squish ────────────────────────────────────────
  private playEnemyDeath(ctx: AudioContext, t: number, vol: number): void {
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer(ctx, 0.2);
    const filt = ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.setValueAtTime(800, t);
    filt.frequency.exponentialRampToValueAtTime(150, t + 0.2);
    filt.Q.value = 3;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.2 * vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    noise.connect(filt);
    filt.connect(g);
    this.sfxOut(g);
    noise.start(t);
    noise.stop(t + 0.2);
  }

  // ── 11. tower_place: rising sine chord ─────────────────────────────
  private playTowerPlace(ctx: AudioContext, t: number, vol: number): void {
    const freqs = [261.6, 329.6, 392.0]; // C4, E4, G4
    for (const freq of freqs) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq * 0.8, t);
      osc.frequency.linearRampToValueAtTime(freq, t + 0.15);
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.12 * vol, t + 0.08);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      osc.connect(g);
      this.sfxOut(g);
      osc.start(t);
      osc.stop(t + 0.3);
    }
  }

  // ── 12. tower_upgrade: triumphant major triad sweep up ─────────────
  private playTowerUpgrade(ctx: AudioContext, t: number, vol: number): void {
    const notes = [261.6, 329.6, 392.0, 523.3]; // C4 E4 G4 C5
    for (let i = 0; i < notes.length; i++) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      const start = t + i * 0.08;
      osc.frequency.value = notes[i];
      g.gain.setValueAtTime(0.001, start);
      g.gain.linearRampToValueAtTime(0.15 * vol, start + 0.04);
      g.gain.exponentialRampToValueAtTime(0.001, start + 0.25);
      osc.connect(g);
      this.sfxOut(g);
      osc.start(start);
      osc.stop(start + 0.25);
    }
  }

  // ── 13. wave_start: warning horn ───────────────────────────────────
  private playWaveStart(ctx: AudioContext, t: number, vol: number): void {
    // Two-tone horn
    const osc1 = ctx.createOscillator();
    const g1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.value = 220;
    g1.gain.setValueAtTime(0.25 * vol, t);
    g1.gain.setValueAtTime(0.25 * vol, t + 0.25);
    g1.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc1.connect(g1);
    this.sfxOut(g1);
    osc1.start(t);
    osc1.stop(t + 0.3);

    const osc2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.value = 277.2; // C#4
    g2.gain.setValueAtTime(0.001, t + 0.3);
    g2.gain.linearRampToValueAtTime(0.25 * vol, t + 0.32);
    g2.gain.setValueAtTime(0.25 * vol, t + 0.55);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    osc2.connect(g2);
    this.sfxOut(g2);
    osc2.start(t + 0.3);
    osc2.stop(t + 0.6);
  }

  // ── 14. wave_complete: ascending victory jingle ────────────────────
  private playWaveComplete(ctx: AudioContext, t: number, vol: number): void {
    const notes = [392, 440, 494, 523.3, 587.3]; // G4 A4 B4 C5 D5
    for (let i = 0; i < notes.length; i++) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      const start = t + i * 0.08;
      osc.frequency.value = notes[i];
      g.gain.setValueAtTime(0.001, start);
      g.gain.linearRampToValueAtTime(0.12 * vol, start + 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, start + 0.18);
      osc.connect(g);
      this.sfxOut(g);
      osc.start(start);
      osc.stop(start + 0.18);
    }
  }

  // ── 15. skill_activate: power-up whoosh sweep up ───────────────────
  private playSkillActivate(ctx: AudioContext, t: number, vol: number): void {
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer(ctx, 0.35);
    const filt = ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.setValueAtTime(200, t);
    filt.frequency.exponentialRampToValueAtTime(4000, t + 0.25);
    filt.Q.value = 4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.2 * vol, t + 0.1);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    noise.connect(filt);
    filt.connect(g);
    this.sfxOut(g);
    noise.start(t);
    noise.stop(t + 0.32);
  }

  // ── 16. gold_earn: metallic coin clink ─────────────────────────────
  private playGoldEarn(ctx: AudioContext, t: number, vol: number): void {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(2400, t);
    osc.frequency.exponentialRampToValueAtTime(1800, t + 0.05);
    g.gain.setValueAtTime(0.15 * vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    osc.connect(g);
    this.sfxOut(g);
    osc.start(t);
    osc.stop(t + 0.1);

    // Second ping slightly delayed
    const osc2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.value = 3200;
    g2.gain.setValueAtTime(0.001, t + 0.03);
    g2.gain.linearRampToValueAtTime(0.1 * vol, t + 0.035);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    osc2.connect(g2);
    this.sfxOut(g2);
    osc2.start(t + 0.03);
    osc2.stop(t + 0.1);
  }

  // ── 17. base_hit: alarm pulsing ────────────────────────────────────
  private playBaseHit(ctx: AudioContext, t: number, vol: number): void {
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 110;
      const start = t + i * 0.12;
      g.gain.setValueAtTime(0.3 * vol, start);
      g.gain.exponentialRampToValueAtTime(0.001, start + 0.08);
      osc.connect(g);
      this.sfxOut(g);
      osc.start(start);
      osc.stop(start + 0.1);
    }
  }

  // ── 18. ui_click: short noise burst ────────────────────────────────
  private playUIClick(ctx: AudioContext, t: number, vol: number): void {
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer(ctx, 0.05);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.08 * vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    const filt = ctx.createBiquadFilter();
    filt.type = 'highpass';
    filt.frequency.value = 2000;
    noise.connect(filt);
    filt.connect(g);
    this.sfxOut(g);
    noise.start(t);
    noise.stop(t + 0.05);
  }

  // ── 19. ui_hover: very short high sine ─────────────────────────────
  private playUIHover(ctx: AudioContext, t: number, vol: number): void {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 1600;
    g.gain.setValueAtTime(0.04 * vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
    osc.connect(g);
    this.sfxOut(g);
    osc.start(t);
    osc.stop(t + 0.03);
  }

  // ══════════════════════════════════════════════════════════════════
  //  AMBIENT MUSIC
  // ══════════════════════════════════════════════════════════════════

  startMusic(mood: MusicMood | string): void {
    const ctx = this.ensureCtx();
    if (!ctx) return;

    // If already playing the same mood, do nothing
    if (this.musicPlaying && this.currentMood === mood) return;

    // Stop current music first
    this.stopMusic();

    this.musicPlaying = true;
    this.currentMood = mood as MusicMood;

    switch (mood as MusicMood) {
      case 'calm':    this.playMoodCalm(ctx); break;
      case 'tense':   this.playMoodTense(ctx); break;
      case 'dark':    this.playMoodDark(ctx); break;
      case 'desert':  this.playMoodDesert(ctx); break;
      case 'battle':  this.playMoodBattle(ctx); break;
      default:        this.playMoodCalm(ctx); break;
    }
  }

  stopMusic(): void {
    this.musicPlaying = false;
    this.currentMood = null;

    // Stop all music oscillators
    for (const osc of this.musicOscillators) {
      try { osc.stop(); } catch (_) { /* already stopped */ }
    }
    for (const lfo of this.musicLFOs) {
      try { lfo.stop(); } catch (_) { /* already stopped */ }
    }
    // Disconnect everything
    for (const g of this.musicGains) {
      try { g.disconnect(); } catch (_) { /* ok */ }
    }
    for (const f of this.musicFilters) {
      try { f.disconnect(); } catch (_) { /* ok */ }
    }

    if (this.musicInterval !== null) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }

    this.musicOscillators = [];
    this.musicGains = [];
    this.musicFilters = [];
    this.musicLFOs = [];
  }

  // ── helper: create a pad oscillator ────────────────────────────────
  private createPad(
    ctx: AudioContext,
    type: OscillatorType,
    freq: number,
    gain: number,
    filterFreq: number,
    lfoRate: number,
    lfoDepth: number
  ): void {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;

    const g = ctx.createGain();
    g.gain.value = gain;

    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = filterFreq;
    filt.Q.value = 1;

    // LFO modulates gain for evolving texture
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = lfoRate;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = lfoDepth;
    lfo.connect(lfoGain);
    lfoGain.connect(g.gain);

    osc.connect(filt);
    filt.connect(g);
    g.connect(this.musicGain);

    osc.start();
    lfo.start();

    this.musicOscillators.push(osc);
    this.musicLFOs.push(lfo);
    this.musicGains.push(g, lfoGain);
    this.musicFilters.push(filt);
  }

  // ── Calm: soft major chords, slow movement (Level 1) ───────────────
  private playMoodCalm(ctx: AudioContext): void {
    // C major pad: C3, E3, G3
    this.createPad(ctx, 'sine', 130.8, 0.06, 400, 0.15, 0.02);   // C3
    this.createPad(ctx, 'sine', 164.8, 0.04, 350, 0.12, 0.015);  // E3
    this.createPad(ctx, 'sine', 196.0, 0.04, 380, 0.18, 0.015);  // G3
    // Sub bass
    this.createPad(ctx, 'sine', 65.4, 0.05, 200, 0.08, 0.01);    // C2

    // Slowly evolve chord every 8 seconds
    let chordIdx = 0;
    const chords = [
      [130.8, 164.8, 196.0], // C
      [146.8, 174.6, 220.0], // Dm (D3 F3 A3 approx)
      [130.8, 164.8, 196.0], // C
      [110.0, 138.6, 164.8], // Am
    ];
    this.musicInterval = setInterval(() => {
      if (!this.musicPlaying) return;
      chordIdx = (chordIdx + 1) % chords.length;
      const chord = chords[chordIdx];
      const t = ctx.currentTime;
      // Smoothly glide existing oscillators to new pitches
      for (let i = 0; i < 3 && i < this.musicOscillators.length; i++) {
        this.musicOscillators[i].frequency.linearRampToValueAtTime(chord[i], t + 2);
      }
    }, 8000);
  }

  // ── Tense: minor chords, faster LFO (Level 3-4) ───────────────────
  private playMoodTense(ctx: AudioContext): void {
    // A minor: A2, C3, E3
    this.createPad(ctx, 'triangle', 110.0, 0.06, 500, 0.4, 0.025);
    this.createPad(ctx, 'triangle', 130.8, 0.04, 450, 0.35, 0.02);
    this.createPad(ctx, 'sine', 164.8, 0.04, 480, 0.5, 0.02);
    // Sub
    this.createPad(ctx, 'sine', 55.0, 0.05, 180, 0.2, 0.015);

    let chordIdx = 0;
    const chords = [
      [110.0, 130.8, 164.8], // Am
      [98.0, 123.5, 146.8],  // Gm-ish
      [110.0, 130.8, 164.8], // Am
      [116.5, 138.6, 174.6], // Bb
    ];
    this.musicInterval = setInterval(() => {
      if (!this.musicPlaying) return;
      chordIdx = (chordIdx + 1) % chords.length;
      const chord = chords[chordIdx];
      const t = ctx.currentTime;
      for (let i = 0; i < 3 && i < this.musicOscillators.length; i++) {
        this.musicOscillators[i].frequency.linearRampToValueAtTime(chord[i], t + 1.5);
      }
    }, 6000);
  }

  // ── Dark: dissonant, deep bass drone (Level 6-7) ───────────────────
  private playMoodDark(ctx: AudioContext): void {
    // Dissonant tritone drone
    this.createPad(ctx, 'sawtooth', 55.0, 0.03, 250, 0.08, 0.015);
    this.createPad(ctx, 'sawtooth', 77.8, 0.02, 200, 0.1, 0.01);   // tritone
    this.createPad(ctx, 'sine', 41.2, 0.06, 150, 0.05, 0.02);       // deep sub
    this.createPad(ctx, 'triangle', 110.0, 0.02, 300, 0.25, 0.01);  // eerie high

    let step = 0;
    this.musicInterval = setInterval(() => {
      if (!this.musicPlaying) return;
      step++;
      const t = ctx.currentTime;
      // Slowly shift pitches for unease
      const drift = Math.sin(step * 0.3) * 5;
      if (this.musicOscillators.length > 0) {
        this.musicOscillators[0].frequency.linearRampToValueAtTime(55 + drift, t + 2);
      }
      if (this.musicOscillators.length > 1) {
        this.musicOscillators[1].frequency.linearRampToValueAtTime(77.8 - drift, t + 2);
      }
    }, 4000);
  }

  // ── Desert: pentatonic scale, shimmer (Level 2) ────────────────────
  private playMoodDesert(ctx: AudioContext): void {
    // D pentatonic pad: D3, F#3, A3
    this.createPad(ctx, 'sine', 146.8, 0.05, 600, 0.2, 0.02);
    this.createPad(ctx, 'sine', 185.0, 0.04, 550, 0.25, 0.015);
    this.createPad(ctx, 'triangle', 220.0, 0.03, 700, 0.3, 0.015);
    // Shimmer: high sine with fast tremolo
    this.createPad(ctx, 'sine', 587.3, 0.015, 800, 3.0, 0.008);
    // Sub
    this.createPad(ctx, 'sine', 73.4, 0.04, 180, 0.1, 0.01);

    let chordIdx = 0;
    const pentatonic = [
      [146.8, 185.0, 220.0], // D F# A
      [164.8, 220.0, 246.9], // E A B
      [146.8, 185.0, 220.0], // D F# A
      [130.8, 164.8, 196.0], // C E G — resolution
    ];
    this.musicInterval = setInterval(() => {
      if (!this.musicPlaying) return;
      chordIdx = (chordIdx + 1) % pentatonic.length;
      const chord = pentatonic[chordIdx];
      const t = ctx.currentTime;
      for (let i = 0; i < 3 && i < this.musicOscillators.length; i++) {
        this.musicOscillators[i].frequency.linearRampToValueAtTime(chord[i], t + 2);
      }
    }, 7000);
  }

  // ── Battle: pulsing bass, rhythmic (during waves) ──────────────────
  private playMoodBattle(ctx: AudioContext): void {
    // Pulsing bass with higher LFO rate
    this.createPad(ctx, 'sawtooth', 55.0, 0.04, 300, 2.0, 0.025);  // pulsing bass
    this.createPad(ctx, 'square', 110.0, 0.02, 400, 1.5, 0.015);   // rhythm layer
    this.createPad(ctx, 'triangle', 82.4, 0.03, 350, 2.5, 0.02);   // E2 pulse
    // Tension chord
    this.createPad(ctx, 'sine', 130.8, 0.03, 500, 0.6, 0.015);

    let step = 0;
    const bassNotes = [55.0, 55.0, 65.4, 49.0]; // A1 A1 C2 G1
    this.musicInterval = setInterval(() => {
      if (!this.musicPlaying) return;
      step = (step + 1) % bassNotes.length;
      const t = ctx.currentTime;
      if (this.musicOscillators.length > 0) {
        this.musicOscillators[0].frequency.linearRampToValueAtTime(bassNotes[step], t + 0.3);
      }
      if (this.musicOscillators.length > 2) {
        this.musicOscillators[2].frequency.linearRampToValueAtTime(bassNotes[step] * 1.5, t + 0.3);
      }
    }, 3000);
  }
}
