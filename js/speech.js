// 音声入力モジュール（Web Speech API）

// ブラウザ対応チェック
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

// 現在アクティブな認識インスタンス
let activeRecognition = null;
let activeButton = null;

/**
 * 音声入力がサポートされているか
 */
export function isSpeechSupported() {
  return !!SpeechRecognition;
}

/**
 * 音声入力のトグル（開始/停止）
 * @param {HTMLButtonElement} button - マイクボタン要素
 * @param {HTMLTextAreaElement} textarea - テキスト入力先
 */
export function toggleSpeechInput(button, textarea) {
  // 既に録音中のボタンを停止
  if (activeRecognition && activeButton === button) {
    stopRecognition();
    return;
  }

  // 他のボタンが録音中なら停止
  if (activeRecognition) {
    stopRecognition();
  }

  startRecognition(button, textarea);
}

/**
 * 音声認識を開始
 */
function startRecognition(button, textarea) {
  const recognition = new SpeechRecognition();
  recognition.lang = 'ja-JP';
  recognition.continuous = true;
  recognition.interimResults = true;

  let finalTranscript = '';

  recognition.onstart = () => {
    button.classList.add('recording');
    activeButton = button;
  };

  recognition.onresult = (event) => {
    let interimTranscript = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalTranscript += transcript;
      } else {
        interimTranscript += transcript;
      }
    }

    // テキストエリアに既存テキスト + 確定テキスト + 中間テキスト を表示
    const existing = textarea.dataset.originalText || textarea.value;
    textarea.value = existing + finalTranscript + interimTranscript;

    // input イベントを発火（バリデーション用）
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  };

  recognition.onend = () => {
    // 確定テキストを反映
    const existing = textarea.dataset.originalText || '';
    textarea.value = existing + finalTranscript;
    textarea.dataset.originalText = textarea.value;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    cleanup();
  };

  recognition.onerror = (event) => {
    // ユーザーによる中断は無視
    if (event.error !== 'aborted') {
      console.warn('音声認識エラー:', event.error);
    }
    cleanup();
  };

  // 開始前に現在のテキストを保存
  textarea.dataset.originalText = textarea.value;
  finalTranscript = '';

  activeRecognition = recognition;
  recognition.start();
}

/**
 * 音声認識を停止
 */
function stopRecognition() {
  if (activeRecognition) {
    activeRecognition.stop();
  }
}

/**
 * 状態をクリーンアップ
 */
function cleanup() {
  if (activeButton) {
    activeButton.classList.remove('recording');
  }
  activeRecognition = null;
  activeButton = null;
}
