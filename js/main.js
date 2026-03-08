// Breath Artist — メインエントリーポイント
import { initForm, resetForm } from './form.js';
import { SessionController } from './session.js';
import { generateArt, downloadArt } from './art.js';

// 画面要素
const inputScreen = document.getElementById('input-screen');
const sessionScreen = document.getElementById('session-screen');
const completeScreen = document.getElementById('complete-screen');

// セッションコントローラー
let sessionController = null;

// 現在のフォームデータ（アート生成用に保持）
let currentFormData = null;

/**
 * 画面切替
 * @param {HTMLElement} screen - 表示する画面要素
 */
function showScreen(screen) {
  [inputScreen, sessionScreen, completeScreen].forEach((s) => {
    s.classList.remove('active');
  });
  screen.classList.add('active');
}

/**
 * 呼吸セッション開始
 */
function startSession(formData) {
  currentFormData = formData;
  showScreen(sessionScreen);

  // 少し待ってからセッション開始（画面遷移アニメーション後）
  setTimeout(() => {
    sessionController = new SessionController();
    sessionController.start(formData, onSessionComplete);
  }, 300);
}

/**
 * セッション完了時のコールバック
 * @param {HTMLCanvasElement} capturedCanvas - 幾何学模様のキャプチャ
 */
function onSessionComplete(capturedCanvas) {
  // アート画像を生成
  generateArt(capturedCanvas, currentFormData);

  // 完了画面へ遷移
  showScreen(completeScreen);

  // セッションコントローラーをクリーンアップ
  if (sessionController) {
    sessionController.destroy();
    sessionController = null;
  }
}

/**
 * 「もう一度」ボタン
 */
function handleRetry() {
  resetForm();
  showScreen(inputScreen);
}

// === イベントリスナー登録 ===

// フォーム初期化（セッション開始コールバック付き）
initForm(startSession);

// 画像ダウンロードボタン
document.getElementById('download-btn').addEventListener('click', downloadArt);

// もう一度ボタン
document.getElementById('retry-btn').addEventListener('click', handleRetry);
