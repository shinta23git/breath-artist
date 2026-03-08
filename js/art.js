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

  // 2. 上部にグラデーションオーバーレイ（テキスト読みやすくする）
  const topGrad = ctx.createLinearGradient(0, 0, 0, size * 0.3);
  topGrad.addColorStop(0, 'rgba(10, 10, 26, 0.85)');
  topGrad.addColorStop(1, 'rgba(10, 10, 26, 0)');
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, size, size * 0.3);

  // 3. 下部にグラデーションオーバーレイ
  const bottomGrad = ctx.createLinearGradient(0, size * 0.7, 0, size);
  bottomGrad.addColorStop(0, 'rgba(10, 10, 26, 0)');
  bottomGrad.addColorStop(1, 'rgba(10, 10, 26, 0.85)');
  ctx.fillStyle = bottomGrad;
  ctx.fillRect(0, size * 0.7, size, size * 0.3);

  // 4. 放射状の光エフェクト
  const glowGrad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size * 0.5);
  glowGrad.addColorStop(0, 'rgba(139, 92, 246, 0.08)');
  glowGrad.addColorStop(0.5, 'rgba(99, 102, 241, 0.04)');
  glowGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = glowGrad;
  ctx.fillRect(0, 0, size, size);

  // 5. アプリ名（上部小さく）
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(212, 168, 86, 0.6)';
  ctx.font = '300 24px "Noto Sans JP", sans-serif';
  ctx.letterSpacing = '4px';
  ctx.fillText('Breath Artist', size / 2, 60);

  // 6.「ありたい状態」テキスト（上部メイン）
  ctx.fillStyle = 'rgba(232, 230, 240, 0.9)';
  ctx.font = '400 36px "Noto Sans JP", sans-serif';
  wrapText(ctx, formData.afterText, size / 2, 120, size * 0.75, 48);

  // 7. 価値観キーワード（下部）
  const valueY = size - 80;
  const valueKeywords = formData.values.map((v) => v.keyword);
  const totalWidth = valueKeywords.reduce((sum, kw) => {
    ctx.font = '500 28px "Noto Sans JP", sans-serif';
    return sum + ctx.measureText(kw).width + 48; // パディング込み
  }, 0) - 16;

  let valueX = (size - totalWidth) / 2;
  valueKeywords.forEach((kw) => {
    ctx.font = '500 28px "Noto Sans JP", sans-serif';
    const textWidth = ctx.measureText(kw).width;
    const chipWidth = textWidth + 32;
    const chipHeight = 44;

    // チップ背景
    const chipX = valueX;
    const chipY = valueY - chipHeight / 2;
    ctx.beginPath();
    roundRect(ctx, chipX, chipY, chipWidth, chipHeight, 22);
    ctx.fillStyle = 'rgba(212, 168, 86, 0.15)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(212, 168, 86, 0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // チップテキスト
    ctx.fillStyle = 'rgba(212, 168, 86, 0.9)';
    ctx.textAlign = 'center';
    ctx.fillText(kw, chipX + chipWidth / 2, valueY + 8);

    valueX += chipWidth + 16;
  });

  // 8. 装飾線（上下）
  ctx.strokeStyle = 'rgba(212, 168, 86, 0.2)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(size * 0.2, 80);
  ctx.lineTo(size * 0.8, 80);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(size * 0.2, size - 120);
  ctx.lineTo(size * 0.8, size - 120);
  ctx.stroke();

  return artCanvas;
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
