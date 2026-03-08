// 音響生成モジュール（7.89Hz 振幅変調 + リバーブ）

/**
 * 音響エンジン
 * 7.89Hzは可聴域以下のため、アイソクロニック・トーン方式で実装:
 * - キャリア周波数（180Hz）のサイン波を7.89Hzで振幅変調
 * - 倍音と残響で幻想的な響きを生成
 */
export class AudioEngine {
  constructor() {
    this.audioCtx = null;
    this.masterGain = null;
    this.oscillators = [];
    this.lfo = null;
    this.lfoGain = null;
    this.isPlaying = false;
  }

  /**
   * AudioContextを初期化（ユーザー操作後に呼ぶ）
   */
  init() {
    if (this.audioCtx) return;

    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }

  /**
   * インパルス応答を生成（リバーブ用）
   */
  createImpulseResponse(duration = 3, decay = 2) {
    const ctx = this.audioCtx;
    const sampleRate = ctx.sampleRate;
    const length = sampleRate * duration;
    const impulse = ctx.createBuffer(2, length, sampleRate);

    for (let channel = 0; channel < 2; channel++) {
      const data = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }

    return impulse;
  }

  /**
   * 音響を開始
   */
  start() {
    if (this.isPlaying) return;
    this.init();

    const ctx = this.audioCtx;
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    // マスターゲイン（フェードイン/アウト用）
    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = 0;
    this.masterGain.connect(ctx.destination);

    // リバーブ
    const convolver = ctx.createConvolver();
    convolver.buffer = this.createImpulseResponse(4, 2.5);
    const reverbGain = ctx.createGain();
    reverbGain.gain.value = 0.4;
    convolver.connect(reverbGain);
    reverbGain.connect(this.masterGain);

    // ドライ/ウェット ミキサーノード
    const dryGain = ctx.createGain();
    dryGain.gain.value = 0.6;
    dryGain.connect(this.masterGain);

    // LFO（7.89Hz 振幅変調）
    this.lfo = ctx.createOscillator();
    this.lfo.type = 'sine';
    this.lfo.frequency.value = 7.89;

    this.lfoGain = ctx.createGain();
    this.lfoGain.gain.value = 0.3; // 変調の深さ

    this.lfo.connect(this.lfoGain);

    // メインオシレーター群
    const frequencies = [
      { freq: 180, gain: 0.12, type: 'sine' },      // 基音
      { freq: 360, gain: 0.04, type: 'sine' },      // 第2倍音
      { freq: 540, gain: 0.02, type: 'sine' },      // 第3倍音
      { freq: 126, gain: 0.03, type: 'triangle' },  // 低音の温かみ
    ];

    this.oscillators = frequencies.map(({ freq, gain, type }) => {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = freq;

      const oscGain = ctx.createGain();
      oscGain.gain.value = gain;

      // LFOで振幅変調を掛ける
      this.lfoGain.connect(oscGain.gain);

      osc.connect(oscGain);
      oscGain.connect(dryGain);
      oscGain.connect(convolver);

      osc.start();
      return osc;
    });

    this.lfo.start();

    // フェードイン（3秒）
    const now = ctx.currentTime;
    this.masterGain.gain.setValueAtTime(0, now);
    this.masterGain.gain.linearRampToValueAtTime(0.8, now + 3);

    this.isPlaying = true;
  }

  /**
   * 呼吸フェーズに合わせてボリュームを微調整
   * @param {string} phase - 'exhale' or 'inhale'
   * @param {number} phaseProgress - 0〜1
   */
  setBreathPhase(phase, phaseProgress) {
    if (!this.isPlaying || !this.masterGain) return;

    const ctx = this.audioCtx;
    const now = ctx.currentTime;
    // 吐く時にわずかに音量ダウン、吸う時にアップ
    const targetVolume = phase === 'exhale'
      ? 0.8 - phaseProgress * 0.15
      : 0.65 + phaseProgress * 0.15;

    this.masterGain.gain.setTargetAtTime(targetVolume, now, 0.3);
  }

  /**
   * 音響を停止（フェードアウト）
   */
  stop() {
    if (!this.isPlaying) return;

    const ctx = this.audioCtx;
    const now = ctx.currentTime;

    // フェードアウト（2秒）
    this.masterGain.gain.setTargetAtTime(0, now, 0.5);

    // 2.5秒後にオシレーターを停止
    setTimeout(() => {
      this.oscillators.forEach((osc) => {
        try { osc.stop(); } catch (e) { /* 既に停止済み */ }
      });
      try { this.lfo.stop(); } catch (e) { /* 既に停止済み */ }
      this.oscillators = [];
      this.lfo = null;
      this.isPlaying = false;
    }, 2500);
  }

  /**
   * 完全にクリーンアップ
   */
  destroy() {
    this.stop();
    if (this.audioCtx) {
      setTimeout(() => {
        this.audioCtx.close().catch(() => {});
        this.audioCtx = null;
      }, 3000);
    }
  }
}
