// フォーム管理・バリデーション
import { VALUES_DATA } from './constants.js';
import { isSpeechSupported, toggleSpeechInput } from './speech.js';

const MAX_VALUES = 3;
let selectedValues = [];

/**
 * フォームを初期化
 * @param {Function} onStart - セッション開始時のコールバック
 */
export function initForm(onStart) {
  const form = document.getElementById('breath-form');
  const beforeText = document.getElementById('before-text');
  const afterText = document.getElementById('after-text');
  const startBtn = document.getElementById('start-btn');

  // 価値観グリッドを生成
  renderValuesGrid();

  // 音声入力ボタンの設定
  setupMicButtons();

  // バリデーション監視
  beforeText.addEventListener('input', validateForm);
  afterText.addEventListener('input', validateForm);

  // フォーム送信
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!isFormValid()) return;

    const formData = getFormData();
    onStart(formData);
  });
}

/**
 * 価値観チップグリッドを描画
 */
function renderValuesGrid() {
  const grid = document.getElementById('values-grid');

  VALUES_DATA.forEach((value, index) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'value-chip';
    chip.dataset.index = index;
    chip.textContent = value.keyword;

    // ツールチップ
    const tooltip = document.createElement('span');
    tooltip.className = 'chip-tooltip';
    tooltip.textContent = value.description;
    chip.appendChild(tooltip);

    chip.addEventListener('click', () => toggleValue(index));
    grid.appendChild(chip);
  });
}

/**
 * 価値観の選択/解除をトグル
 */
function toggleValue(index) {
  const chip = document.querySelector(`.value-chip[data-index="${index}"]`);
  const isSelected = selectedValues.includes(index);

  if (isSelected) {
    // 解除
    selectedValues = selectedValues.filter((i) => i !== index);
    chip.classList.remove('selected');
  } else {
    // 選択（上限チェック）
    if (selectedValues.length >= MAX_VALUES) return;
    selectedValues.push(index);
    chip.classList.add('selected');
  }

  updateValuesUI();
  validateForm();
}

/**
 * 価値観選択のUI更新
 */
function updateValuesUI() {
  const countEl = document.getElementById('values-count');
  countEl.textContent = `${selectedValues.length} / ${MAX_VALUES}`;
  countEl.classList.toggle('complete', selectedValues.length === MAX_VALUES);

  // 上限到達時、未選択チップを無効化
  const chips = document.querySelectorAll('.value-chip');
  chips.forEach((chip) => {
    const index = parseInt(chip.dataset.index);
    if (selectedValues.length >= MAX_VALUES && !selectedValues.includes(index)) {
      chip.classList.add('disabled');
    } else {
      chip.classList.remove('disabled');
    }
  });
}

/**
 * マイクボタンのセットアップ
 */
function setupMicButtons() {
  const micButtons = document.querySelectorAll('.mic-btn');

  if (!isSpeechSupported()) {
    // 非対応ブラウザではマイクボタンを非表示
    micButtons.forEach((btn) => btn.classList.add('hidden'));
    return;
  }

  micButtons.forEach((btn) => {
    const targetId = btn.dataset.target;
    const textarea = document.getElementById(targetId);

    btn.addEventListener('click', () => {
      toggleSpeechInput(btn, textarea);
    });
  });
}

/**
 * フォームの有効性チェック
 */
function isFormValid() {
  const beforeText = document.getElementById('before-text').value.trim();
  const afterText = document.getElementById('after-text').value.trim();
  return beforeText.length > 0 && afterText.length > 0 && selectedValues.length === MAX_VALUES;
}

/**
 * バリデーション実行（ボタンの有効/無効切替）
 */
function validateForm() {
  const startBtn = document.getElementById('start-btn');
  startBtn.disabled = !isFormValid();
}

/**
 * フォームデータを取得
 */
function getFormData() {
  return {
    beforeText: document.getElementById('before-text').value.trim(),
    afterText: document.getElementById('after-text').value.trim(),
    values: selectedValues.map((i) => VALUES_DATA[i]),
    rhythm: parseInt(document.getElementById('rhythm-select').value),
    duration: parseInt(document.getElementById('duration-select').value),
  };
}

/**
 * フォームをリセット
 */
export function resetForm() {
  document.getElementById('before-text').value = '';
  document.getElementById('after-text').value = '';
  selectedValues = [];

  document.querySelectorAll('.value-chip').forEach((chip) => {
    chip.classList.remove('selected', 'disabled');
  });

  updateValuesUI();
  validateForm();
}
