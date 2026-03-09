// 最終アート画像の合成・ダウンロード

/**
 * 最終アート画像を生成
 * @param {HTMLCanvasElement} geometryCanvas - 幾何学模様のキャプチャ
 * @param {Object} formData - フォームデータ（afterText, values）
 * @returns {HTMLCanvasElement} 合成済みCanvas
 */
export function generateArt(geometryCanvas, formData) {
  const size = 1080;
  const artCanvas = document.getElementById('art-canvas');
  artCanvas.width = size;
  artCanvas.height = size;
  const ctx = artCanvas.getContext('2d');

  // 1. 幾何学模様を背景として描画
  ctx.drawImage(geometryCanvas, 0, 0, size, size);

  // 2. 明るさを加算する中心光エフェクト
  ctx.globalCompositeOperation = 'screen';
  const centerGlow = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size * 0.5);
  centerGlow.addColorStop(0, 'rgba(255, 240, 220, 0.25)');
  centerGlow.addColorStop(0.2, 'rgba(200, 170, 255, 0.15)');
  centerGlow.addColorStop(0.5, 'rgba(120, 100, 220, 0.08)');
  centerGlow.addColorStop(1, 'transparent');
  ctx.fillStyle = centerGlow;
  ctx.fillRect(0, 0, size, size);
  ctx.globalCompositeOperation = 'source-over';

  // 3. 上部に軽めのグラデーション（テキスト読みやすく、かつ暗くしすぎない）
  const topGrad = ctx.createLinearGradient(0, 0, 0, size * 0.22);
  topGrad.addColorStop(0, 'rgba(15, 10, 35, 0.55)');
  topGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, size, size * 0.22);

  // 4. 下部に軽めのグラデーション
  const bottomGrad = ctx.createLinearGradient(0, size * 0.82, 0, size);
  bottomGrad.addColorStop(0, 'transparent');
  bottomGrad.addColorStop(1, 'rgba(15, 10, 35, 0.55)');
  ctx.fillStyle = bottomGrad;
  ctx.fillRect(0, size * 0.82, size, size * 0.18);

  // 5. 光の粒子（ボケ効果）をランダム配置
  drawBokehParticles(ctx, size);

  // 6. アプリ名（上部 — ゴールドの光沢感）
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(212, 168, 86, 0.6)';
  ctx.shadowBlur = 12;
  ctx.fillStyle = 'rgba(230, 200, 130, 0.85)';
  ctx.font = '300 24px "Noto Sans JP", sans-serif';
  ctx.letterSpacing = '4px';
  ctx.fillText('Breath Artist', size / 2, 55);
  ctx.shadowBlur = 0;

  // 7.「ありたい状態」テキスト（光る白文字）
  ctx.shadowColor = 'rgba(200, 200, 255, 0.5)';
  ctx.shadowBlur = 10;
  ctx.fillStyle = 'rgba(245, 242, 255, 0.95)';
  ctx.font = '400 36px "Noto Sans JP", sans-serif';
  wrapText(ctx, formData.afterText, size / 2, 115, size * 0.75, 48);
  ctx.shadowBlur = 0;

  // 8. 装飾線（ゴールド光る細線）
  ctx.shadowColor = 'rgba(212, 168, 86, 0.4)';
  ctx.shadowBlur = 6;
  ctx.strokeStyle = 'rgba(212, 168, 86, 0.35)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(size * 0.15, 75);
  ctx.lineTo(size * 0.85, 75);
  ctx.stroke();

  // 上部装飾線の中央ダイヤ
  drawDiamond(ctx, size / 2, 75, 5, 'rgba(212, 168, 86, 0.6)');

  ctx.beginPath();
  ctx.moveTo(size * 0.15, size - 115);
  ctx.lineTo(size * 0.85, size - 115);
  ctx.stroke();
  drawDiamond(ctx, size / 2, size - 115, 5, 'rgba(212, 168, 86, 0.6)');
  ctx.shadowBlur = 0;

  // 9. 価値観キーワード（下部 — 光るチップ）
  const valueY = size - 75;
  const valueKeywords = formData.values.map((v) => v.keyword);
  const totalWidth = valueKeywords.reduce((sum, kw) => {
    ctx.font = '500 28px "Noto Sans JP", sans-serif';
    return sum + ctx.measureText(kw).width + 48;
  }, 0) - 16;

  let valueX = (size - totalWidth) / 2;
  valueKeywords.forEach((kw) => {
    ctx.font = '500 28px "Noto Sans JP", sans-serif';
    const textWidth = ctx.measureText(kw).width;
    const chipWidth = textWidth + 32;
    const chipHeight = 44;

    const chipX = valueX;
    const chipY = valueY - chipHeight / 2;

    // チップのグロー背景
    ctx.shadowColor = 'rgba(212, 168, 86, 0.3)';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    roundRect(ctx, chipX, chipY, chipWidth, chipHeight, 22);
    ctx.fillStyle = 'rgba(212, 168, 86, 0.2)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(230, 200, 130, 0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // チップテキスト
    ctx.fillStyle = 'rgba(240, 215, 150, 0.95)';
    ctx.textAlign = 'center';
    ctx.fillText(kw, chipX + chipWidth / 2, valueY + 8);

    valueX += chipWidth + 16;
  });

  return artCanvas;
}

/**
 * ボケ光粒子を描画（希望の光の表現）
 */
function drawBokehParticles(ctx, size) {
  ctx.globalCompositeOperation = 'screen';

  // シード固定でランダム風配置（毎回同じ位置にならないよう現在時刻を使用）
  const seed = Math.floor(Date.now() / 1000);
  let s = seed;
  const rng = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };

  const particleCount = 30;
  for (let i = 0; i < particleCount; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const r = rng() * 25 + 8;
    const alpha = rng() * 0.12 + 0.03;
    const hue = rng() * 60 + 30; // ゴールド〜アンバー系

    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `hsla(${hue}, 70%, 85%, ${alpha})`);
    grad.addColorStop(0.5, `hsla(${hue}, 60%, 75%, ${alpha * 0.4})`);
    grad.addColorStop(1, 'transparent');
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
  }

  ctx.globalCompositeOperation = 'source-over';
}

/**
 * 小さなダイヤモンド装飾を描画
 */
function drawDiamond(ctx, x, y, size, color) {
  ctx.beginPath();
  ctx.moveTo(x, y - size);
  ctx.lineTo(x + size * 0.6, y);
  ctx.lineTo(x, y + size);
  ctx.lineTo(x - size * 0.6, y);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

/**
 * テキストを折り返し描画
 */
function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const chars = text.split('');
  let line = '';
  let lineY = y;

  for (let i = 0; i < chars.length; i++) {
    const testLine = line + chars[i];
    const metrics = ctx.measureText(testLine);

    if (metrics.width > maxWidth && line.length > 0) {
      ctx.fillText(line, x, lineY);
      line = chars[i];
      lineY += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, lineY);
}

/**
 * 角丸四角形のパスを描画
 */
function roundRect(ctx, x, y, width, height, radius) {
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.arcTo(x + width, y, x + width, y + radius, radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
  ctx.lineTo(x + radius, y + height);
  ctx.arcTo(x, y + height, x, y + height - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
}

/**
 * アート画像をPNGとしてダウンロード
 */
export function downloadArt() {
  const artCanvas = document.getElementById('art-canvas');

  artCanvas.toBlob((blob) => {
    if (!blob) return;

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `breath-artist-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 'image/png');
}
