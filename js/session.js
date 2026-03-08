// 呼吸セッション制御モジュール

import { GeometryEngine } from './geometry.js';
import { AudioEngine } from './audio.js';

/**
 * 呼吸セッションコントローラー
 * 状態: idle → exhale ↔ inhale → complete
 */
export class SessionController {
  constructor() {
    this.geometry = null;
    this.audio = new AudioEngine();
    this.formData = null;

    // タイマー状態
    this.totalDuration = 0;     // 全体時間（秒）
    this.rhythmInterval = 0;    // 吐く/吸うの間隔（秒）
    this.elapsedTime = 0;       // 経過時間（秒）
    this.phaseStartTime = 0;    // 現在フェーズの開始時刻
    this.currentPhase = 'idle'; // 'idle' | 'exhale' | 'inhale' | 'complete'
    this.timerHandle = null;
    this.lastTick = 0;

    // コールバック
    this.onComplete = null;

    // UI要素
    this.phaseEl = document.getElementById('breath-phase');
    this.countdownEl = document.getElementById('breath-countdown');
    this.timerBar = document.getElementById('timer-bar');
    this.timerText = document.getElementById('timer-text');
  }

  /**
   * セッションを開始
   * @param {Object} formData - フォームデータ
   * @param {Function} onComplete - 完了時コールバック
   */
  start(formData, onComplete) {
    this.formData = formData;
    this.onComplete = onComplete;
    this.totalDuration = formData.duration;
    this.rhythmInterval = formData.rhythm;
    this.elapsedTime = 0;
    this.currentPhase = 'exhale'; // 吐くから開始

    // 幾何学エンジン初期化
    const canvas = document.getElementById('geometry-canvas');
    this.geometry = new GeometryEngine(canvas);
    this.geometry.init(formData);
    this.geometry.start();

    // 音響開始
    this.audio.start();

    // タイマー開始
    this.lastTick = performance.now();
    this.phaseStartTime = 0;
    this.updateUI();
    this.tick();
  }

  /**
   * メインティック（16ms間隔）
   */
  tick() {
    const now = performance.now();
    const delta = (now - this.lastTick) / 1000;
    this.lastTick = now;
    this.elapsedTime += delta;
    this.phaseStartTime += delta;

    // 全体タイマー終了チェック
    if (this.elapsedTime >= this.totalDuration) {
      this.complete();
      return;
    }

    // フェーズ切替チェック
    if (this.phaseStartTime >= this.rhythmInterval) {
      this.phaseStartTime -= this.rhythmInterval;
      this.currentPhase = this.currentPhase === 'exhale' ? 'inhale' : 'exhale';
    }

    // フェーズ内の進行度（0〜1）
    const phaseProgress = Math.min(1, this.phaseStartTime / this.rhythmInterval);

    // 幾何学エンジンに呼吸フェーズを伝達
    this.geometry.setBreathPhase(this.currentPhase, phaseProgress);

    // 全体の進行度（Before→After遷移）
    const totalProgress = this.elapsedTime / this.totalDuration;
    this.geometry.setProgress(totalProgress);

    // 音響にも呼吸フェーズを伝達
    this.audio.setBreathPhase(this.currentPhase, phaseProgress);

    // UI更新
    this.updateUI();

    // 次のフレーム
    this.timerHandle = requestAnimationFrame(() => this.tick());
  }

  /**
   * UI表示の更新
   */
  updateUI() {
    // フェーズ表示
    this.phaseEl.textContent = this.currentPhase === 'exhale' ? '吐く' : '吸う';

    // カウントダウン（フェーズ内の残り秒数）
    const remaining = Math.ceil(this.rhythmInterval - this.phaseStartTime);
    this.countdownEl.textContent = Math.max(1, remaining);

    // 全体の残り時間
    const totalRemaining = Math.max(0, this.totalDuration - this.elapsedTime);
    const minutes = Math.floor(totalRemaining / 60);
    const seconds = Math.floor(totalRemaining % 60);
    this.timerText.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    // プログレスバー
    const progressPercent = (1 - this.elapsedTime / this.totalDuration) * 100;
    this.timerBar.style.setProperty('--progress', `${progressPercent}%`);
  }

  /**
   * セッション完了
   */
  complete() {
    this.currentPhase = 'complete';

    // タイマー停止
    if (this.timerHandle) {
      cancelAnimationFrame(this.timerHandle);
      this.timerHandle = null;
    }

    // 音響フェードアウト
    this.audio.stop();

    // 幾何学模様のキャプチャ（アート生成用）
    const capturedCanvas = this.geometry.capture(1080);

    // 幾何学アニメーション停止
    this.geometry.stop();

    // コールバック
    if (this.onComplete) {
      this.onComplete(capturedCanvas);
    }
  }

  /**
   * セッション中断・クリーンアップ
   */
  destroy() {
    if (this.timerHandle) {
      cancelAnimationFrame(this.timerHandle);
      this.timerHandle = null;
    }
    if (this.geometry) {
      this.geometry.stop();
    }
    this.audio.destroy();
  }
}
