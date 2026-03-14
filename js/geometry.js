// 神聖幾何学模様エンジン — 8層構成の豪華絢爛な万華鏡アニメーション

// ===== ユーティリティ関数 =====

function hashText(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function seededRandom(seed) {
  let s = seed;
  return function () {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function easeInOutSine(t) {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function hsl(h, s, l, a = 1) {
  return `hsla(${((h % 360) + 360) % 360}, ${s}%, ${l}%, ${a})`;
}

// ===== カラーパレット =====
const PALETTE = {
  gold:   (a = 1) => hsl(42, 85, 65, a),
  purple: (a = 1) => hsl(270, 60, 50, a),
  cyan:   (a = 1) => hsl(185, 70, 60, a),
  rose:   (a = 1) => hsl(330, 60, 60, a),
  white:  (a = 1) => hsl(0, 0, 95, a),
};

// ===== パラメータ生成 =====

function generateParams(text, values) {
  const seed = hashText(text + values.map((v) => v.keyword).join(''));
  const rng = seededRandom(seed);

  return {
    petalCount: Math.floor(rng() * 6) + 6,
    symmetry: [6, 8, 10, 12][Math.floor(rng() * 4)],
    hueBase: rng() * 360,
    hueSecondary: rng() * 360,
    hueDrift: rng() * 80 + 30,
    saturation: rng() * 15 + 65,
    complexity: rng() * 0.4 + 0.6,
    flowerLayers: Math.floor(rng() * 2) + 2,
    spiralTightness: rng() * 1.5 + 1.5,
    particleHue: rng() * 360,
    outerTicks: Math.floor(rng() * 36) + 36,
    starLayers: Math.floor(rng() * 2) + 2,
  };
}

function lerpParams(paramsA, paramsB, t) {
  const result = {};
  for (const key of Object.keys(paramsA)) {
    if (typeof paramsA[key] === 'number') {
      result[key] = lerp(paramsA[key], paramsB[key], t);
    } else {
      result[key] = t < 0.5 ? paramsA[key] : paramsB[key];
    }
  }
  return result;
}

// ===== パーティクルシステム =====

class Particle {
  constructor(rng, maxRadius) {
    this.reset(rng, maxRadius);
  }

  reset(rng, maxRadius) {
    const angle = rng() * Math.PI * 2;
    const dist = rng() * maxRadius * 0.8;
    this.x = Math.cos(angle) * dist;
    this.y = Math.sin(angle) * dist;
    this.vx = (rng() - 0.5) * 0.3;
    this.vy = (rng() - 0.5) * 0.3;
    this.life = rng() * 1.0;
    this.maxLife = rng() * 4 + 2;
    this.size = rng() * 2.5 + 0.5;
    this.hueOffset = rng() * 60;
    this.orbitSpeed = (rng() - 0.5) * 0.5;
    this.orbitRadius = dist;
    this.orbitAngle = angle;
  }

  update(dt, breathScale) {
    this.life += dt;
    if (this.life > this.maxLife) return false;
    this.orbitAngle += this.orbitSpeed * dt;
    const breathFactor = lerp(0.85, 1.15, (breathScale - 0.7) / 0.3);
    const r = this.orbitRadius * breathFactor;
    this.x = Math.cos(this.orbitAngle) * r + this.vx * this.life;
    this.y = Math.sin(this.orbitAngle) * r + this.vy * this.life;
    return true;
  }

  getAlpha() {
    const t = this.life / this.maxLife;
    if (t < 0.1) return t / 0.1;
    if (t > 0.8) return (1 - t) / 0.2;
    return 1.0;
  }
}

// ===== メインエンジン =====

export class GeometryEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.animationId = null;
    this.startTime = 0;
    this.breathScale = 1.0;
    this.paramsA = null;
    this.paramsB = null;
    this.progress = 0;
    this.isRunning = false;
    this.particles = [];
    this.particleRng = null;
    this.lastTime = 0;
    this._flowerCenters = [];
  }

  init(formData) {
    this.resizeCanvas();
    this.paramsA = generateParams(formData.beforeText, formData.values);
    this.paramsB = generateParams(formData.afterText, formData.values);
    this.progress = 0;
    this.breathScale = 1.0;
    this.startTime = performance.now();

    // パーティクル初期化
    const maxR = Math.min(window.innerWidth, window.innerHeight) * 0.42;
    this.particleRng = seededRandom(hashText(formData.beforeText + formData.afterText));
    this.particles = [];
    for (let i = 0; i < 200; i++) {
      this.particles.push(new Particle(this.particleRng, maxR));
    }

    window.addEventListener('resize', this.handleResize);
  }

  handleResize = () => { this.resizeCanvas(); };

  resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.ctx.scale(dpr, dpr);
  }

  start() {
    this.isRunning = true;
    this.startTime = performance.now();
    this.lastTime = this.startTime;
    this.animate();
  }

  stop() {
    this.isRunning = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    window.removeEventListener('resize', this.handleResize);
  }

  setBreathPhase(phase, phaseProgress) {
    const eased = easeInOutSine(phaseProgress);
    if (phase === 'exhale') {
      this.breathScale = lerp(1.0, 0.7, eased);
    } else {
      this.breathScale = lerp(0.7, 1.0, eased);
    }
  }

  setProgress(progress) {
    this.progress = Math.min(1, Math.max(0, progress));
  }

  animate() {
    if (!this.isRunning) return;
    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;
    const elapsed = (now - this.startTime) / 1000;
    this.draw(elapsed, dt);
    this.animationId = requestAnimationFrame(() => this.animate());
  }

  // ===== メイン描画（8層構成） =====
  draw(elapsed, dt) {
    const ctx = this.ctx;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const cx = w / 2;
    const cy = h / 2;
    const maxR = Math.min(w, h) * 0.42;
    const params = lerpParams(this.paramsA, this.paramsB, this.progress);

    // --- Layer 1: 背景（トレイル残像 — 深い暗色に収束）---
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(8, 5, 18, 0.12)';
    ctx.fillRect(0, 0, w, h);

    // --- Layer 1.5: 温かいゴールドのアンビエントグロー（神秘的な明るさ）---
    ctx.globalCompositeOperation = 'screen';
    const glowPulse = 0.38 + 0.20 * ((this.breathScale - 0.7) / 0.3);
    const ambGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(w, h) * 0.75);
    ambGlow.addColorStop(0,    `hsla(42, 98%, 75%, ${glowPulse})`);
    ambGlow.addColorStop(0.25, `hsla(38, 92%, 65%, ${glowPulse * 0.65})`);
    ambGlow.addColorStop(0.5,  `hsla(30, 85%, 55%, ${glowPulse * 0.30})`);
    ambGlow.addColorStop(0.75, `hsla(22, 75%, 42%, ${glowPulse * 0.12})`);
    ambGlow.addColorStop(1,    'transparent');
    ctx.fillStyle = ambGlow;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(this.breathScale, this.breathScale);

    // --- Layer 2: フラワー・オブ・ライフ ---
    ctx.globalCompositeOperation = 'screen';
    this.drawFlowerOfLife(ctx, params, maxR, elapsed);

    // --- Layer 3: メタトロンキューブ ---
    ctx.globalCompositeOperation = 'lighter';
    this.drawMetatronsCube(ctx, params, maxR, elapsed);

    // --- Layer 4: 六芒星の多重回転 ---
    ctx.globalCompositeOperation = 'screen';
    this.drawHexagrams(ctx, params, maxR, elapsed);

    // --- Layer 5: ゴールデンスパイラル＆ベシカパイシス ---
    ctx.globalCompositeOperation = 'screen';
    this.drawGoldenSpirals(ctx, params, maxR, elapsed);

    // --- Layer 6: 万華鏡セグメント ---
    ctx.globalCompositeOperation = 'screen';
    this.drawKaleidoscope(ctx, params, maxR, elapsed);

    // --- Layer 6.5: ゆっくり回転するマンダラ花弁（source-over で色を明確に出す）---
    ctx.globalCompositeOperation = 'source-over';
    this.drawMandalaPetals(ctx, params, maxR, elapsed);

    // --- Layer 7: パーティクル ---
    ctx.globalCompositeOperation = 'lighter';
    this.drawParticles(ctx, params, maxR, elapsed, dt);

    // --- Layer 8: 外輪装飾＋ゴッドレイ＋中心グロー ---
    ctx.globalCompositeOperation = 'screen';
    this.drawOuterRing(ctx, params, maxR, elapsed);
    ctx.globalCompositeOperation = 'lighter';
    this.drawGodRays(ctx, params, maxR, elapsed);
    this.drawCenterGlow(ctx, params, maxR, elapsed);

    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';
  }

  // ===== Layer 2: フラワー・オブ・ライフ =====
  drawFlowerOfLife(ctx, params, maxR, time) {
    const layers = Math.round(params.flowerLayers);
    const baseRadius = maxR * 0.18;
    const rotation = time * 0.08;
    const hue0 = params.hueBase + time * 3;

    ctx.save();
    ctx.rotate(rotation);

    // 六角形格子で中心点を生成
    const centers = [{ x: 0, y: 0 }];
    for (let layer = 1; layer <= layers; layer++) {
      for (let side = 0; side < 6; side++) {
        const a1 = (side / 6) * Math.PI * 2;
        const a2 = ((side + 1) / 6) * Math.PI * 2;
        for (let pos = 0; pos < layer; pos++) {
          const t = pos / layer;
          const x = lerp(Math.cos(a1), Math.cos(a2), t) * baseRadius * layer;
          const y = lerp(Math.sin(a1), Math.sin(a2), t) * baseRadius * layer;
          centers.push({ x, y });
        }
      }
    }

    // 各中心に円を描画
    centers.forEach((c, i) => {
      const dist = Math.sqrt(c.x * c.x + c.y * c.y);
      const alpha = Math.max(0.05, 0.35 - dist / (maxR * 1.1));
      const pulseAlpha = alpha * (0.7 + 0.3 * Math.sin(time * 1.5 + i * 0.2));
      const circleHue = hue0 + (dist / maxR) * params.hueDrift;

      ctx.beginPath();
      ctx.arc(c.x, c.y, baseRadius, 0, Math.PI * 2);
      ctx.strokeStyle = hsl(circleHue, params.saturation, 60, pulseAlpha);
      ctx.lineWidth = 0.8;
      ctx.stroke();

      // 内部グロー（近い円のみ）
      if (dist < maxR * 0.5) {
        const glow = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, baseRadius * 0.7);
        glow.addColorStop(0, hsl(circleHue, params.saturation, 70, pulseAlpha * 0.22));
        glow.addColorStop(1, 'transparent');
        ctx.beginPath();
        ctx.arc(c.x, c.y, baseRadius * 0.7, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();
      }
    });

    ctx.restore();
    this._flowerCenters = centers;
  }

  // ===== Layer 3: メタトロンキューブ =====
  drawMetatronsCube(ctx, params, maxR, time) {
    const centers = this._flowerCenters;
    if (!centers || centers.length < 7) return;

    const points = centers.slice(0, Math.min(13, centers.length));
    const dashOffset = time * 30;

    ctx.save();
    ctx.rotate(time * 0.08);
    ctx.setLineDash([4, 8]);
    ctx.lineDashOffset = dashOffset;

    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const dist = Math.sqrt(
          (points[i].x - points[j].x) ** 2 + (points[i].y - points[j].y) ** 2
        );
        if (dist < maxR * 0.55) {
          const alpha = 0.12 + 0.08 * Math.sin(time * 2 + i + j);
          ctx.beginPath();
          ctx.moveTo(points[i].x, points[i].y);
          ctx.lineTo(points[j].x, points[j].y);
          ctx.strokeStyle = PALETTE.gold(alpha);
          ctx.lineWidth = 0.6;
          ctx.stroke();
        }
      }
    }

    ctx.setLineDash([]);

    // 交差点の光点
    points.forEach((p, i) => {
      const pulse = 0.5 + 0.5 * Math.sin(time * 3 + i * 0.8);
      const r = 2 + pulse * 1.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = PALETTE.gold(0.35 * pulse);
      ctx.fill();
    });

    ctx.restore();
  }

  // ===== Layer 4: 六芒星の多重回転 =====
  drawHexagrams(ctx, params, maxR, time) {
    const layers = Math.round(params.starLayers);

    for (let layer = 0; layer < layers; layer++) {
      const scale = 0.3 + layer * 0.25;
      const r = maxR * scale;
      const speed = (layer % 2 === 0 ? 1 : -1) * (0.12 - layer * 0.03);
      const rotation = time * speed;
      const alpha = 0.2 - layer * 0.03;
      const hue0 = params.hueSecondary + layer * 40 + time * 5;

      ctx.save();
      ctx.rotate(rotation);

      // 上向き＋下向き三角形
      this.drawTriangle(ctx, r, 0, hsl(hue0, params.saturation, 55, alpha), 1.0);
      this.drawTriangle(ctx, r, Math.PI, hsl(hue0 + 30, params.saturation, 55, alpha * 0.8), 1.0);

      // グローライン
      this.drawTriangle(ctx, r * 1.02, 0, hsl(hue0, params.saturation, 65, alpha * 0.3), 2.0);
      this.drawTriangle(ctx, r * 1.02, Math.PI, hsl(hue0 + 30, params.saturation, 65, alpha * 0.3), 2.0);

      ctx.restore();
    }
  }

  drawTriangle(ctx, radius, rotOffset, color, lw) {
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const angle = rotOffset + (i / 3) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.stroke();
  }

  // ===== Layer 5: ゴールデンスパイラル＆ベシカパイシス =====
  drawGoldenSpirals(ctx, params, maxR, time) {
    const phi = (1 + Math.sqrt(5)) / 2;
    const rotation = time * 0.1;
    const hue0 = params.hueBase + 60 + time * 4;

    ctx.save();
    ctx.rotate(rotation);

    // 黄金比スパイラル（対称2本）
    for (let mirror = 0; mirror < 2; mirror++) {
      ctx.save();
      if (mirror === 1) ctx.scale(-1, 1);

      ctx.beginPath();
      for (let i = 0; i < 200; i++) {
        const t = i / 200;
        const angle = t * Math.PI * 6;
        const r = Math.pow(phi, angle / (Math.PI * 2)) * maxR * 0.02;
        if (r > maxR * 0.9) break;
        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      const alpha = 0.1 + 0.05 * Math.sin(time * 1.5);
      ctx.strokeStyle = hsl(hue0, params.saturation - 10, 65, alpha);
      ctx.lineWidth = 0.8;
      ctx.stroke();

      ctx.restore();
    }

    // ベシカパイシス（6方向）
    const vpR = maxR * 0.25;
    const vpDist = vpR * 0.7;
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const px = Math.cos(angle) * vpDist;
      const py = Math.sin(angle) * vpDist;
      const alpha = 0.06 + 0.03 * Math.sin(time * 2 + i);
      const vpHue = hue0 + i * 20;

      ctx.beginPath();
      ctx.arc(px - vpR * 0.3, py, vpR, 0, Math.PI * 2);
      ctx.strokeStyle = hsl(vpHue, params.saturation, 55, alpha);
      ctx.lineWidth = 0.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(px + vpR * 0.3, py, vpR, 0, Math.PI * 2);
      ctx.strokeStyle = hsl(vpHue + 15, params.saturation, 55, alpha);
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }

    ctx.restore();
  }

  // ===== Layer 6: 万華鏡セグメント =====
  drawKaleidoscope(ctx, params, maxR, time) {
    const symmetry = Math.round(params.symmetry);
    const angleStep = (Math.PI * 2) / symmetry;
    const rotation = time * 0.12;

    ctx.save();
    ctx.rotate(rotation);

    for (let seg = 0; seg < symmetry; seg++) {
      ctx.save();
      ctx.rotate(angleStep * seg);
      if (seg % 2 === 1) ctx.scale(-1, 1);
      this.drawSegment(ctx, params, maxR, time);
      ctx.restore();
    }

    ctx.restore();
  }

  drawSegment(ctx, params, maxR, time) {
    const { hueBase, hueDrift, saturation, complexity, petalCount, spiralTightness } = params;
    const sym = Math.round(params.symmetry);

    // 多層花弁（3レイヤー）
    const petals = Math.round(petalCount);
    for (let layer = 0; layer < 3; layer++) {
      const layerOffset = layer * 0.15;
      const layerAlpha = 0.32 - layer * 0.06;

      for (let i = 0; i < petals; i++) {
        const t = i / petals;
        const r = maxR * (0.15 + t * 0.65 + layerOffset) * complexity;
        const angle = t * Math.PI * 0.45 + layer * 0.1;
        const hue = hueBase + hueDrift * t + time * 8 + layer * 30;

        ctx.beginPath();
        ctx.strokeStyle = hsl(hue, saturation, 60 + layer * 5, layerAlpha * (0.7 + 0.3 * Math.sin(time * 2 + i)));
        ctx.lineWidth = lerp(1.2, 0.3, t);

        const x1 = Math.cos(angle) * r * 0.2;
        const y1 = Math.sin(angle) * r * 0.2;
        const cp1x = Math.cos(angle + 0.4) * r * 0.55;
        const cp1y = Math.sin(angle + 0.4) * r * 0.55;
        const cp2x = Math.cos(angle + 0.15) * r * 0.85;
        const cp2y = Math.sin(angle + 0.15) * r * 0.85;
        const x2 = Math.cos(angle - 0.05) * r;
        const y2 = Math.sin(angle - 0.05) * r;

        ctx.moveTo(x1, y1);
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x2, y2);
        ctx.stroke();
      }
    }

    // スパイラル
    ctx.beginPath();
    for (let i = 0; i < 80; i++) {
      const t = i / 80;
      const angle = t * Math.PI * spiralTightness + time * 0.2;
      const r = t * maxR * 0.6;
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = hsl(hueBase + 120 + time * 6, saturation, 55, 0.08);
    ctx.lineWidth = 0.6;
    ctx.stroke();

    // リング弧
    const rings = Math.round(complexity * 5) + 2;
    for (let i = 1; i <= rings; i++) {
      const r = maxR * (i / (rings + 1)) * 0.85;
      const hue = hueBase + hueDrift * (i / rings) + time * 4;
      const alpha = 0.06 + 0.04 * Math.sin(time * 2.5 + i);
      ctx.beginPath();
      ctx.arc(0, 0, r, -0.02, Math.PI / sym + 0.02);
      ctx.strokeStyle = hsl(hue, saturation - 10, 50, alpha);
      ctx.lineWidth = 0.4;
      ctx.stroke();
    }
  }

  // ===== Layer 6.5: ゆっくり回転するマンダラ花弁 =====
  drawMandalaPetals(ctx, params, maxR, time) {
    const sym = Math.round(params.symmetry);
    const breathAlpha = 0.5 + 0.5 * (this.breathScale - 0.7) / 0.3; // 吸う時に明るく
    const h0 = params.hueBase + time * 8;
    const h1 = params.hueSecondary + time * 6;

    // 外側リング — 時計回り（尖った花弁、ティール系）
    this._drawPetalRing(ctx, {
      radius: maxR * 0.68,
      count: sym,
      len: maxR * 0.22,
      width: maxR * 0.06,
      hue0: h1 + 150,
      hueDrift: 55,
      sat: params.saturation,
      light: 55,
      alpha: 0.62 * breathAlpha,
      rotation: time * 0.06,
      pointed: true,
    });

    // 中間リング — 反時計回り（丸い花弁、ゴールド系）
    this._drawPetalRing(ctx, {
      radius: maxR * 0.45,
      count: sym * 2,
      len: maxR * 0.15,
      width: maxR * 0.055,
      hue0: h0 + 25,
      hueDrift: 45,
      sat: params.saturation + 8,
      light: 60,
      alpha: 0.65 * breathAlpha,
      rotation: -time * 0.08,
      pointed: false,
    });

    // 内側リング — 時計回り（小さな丸い花弁、ピンク系）
    this._drawPetalRing(ctx, {
      radius: maxR * 0.25,
      count: sym,
      len: maxR * 0.1,
      width: maxR * 0.04,
      hue0: h0 + 330,
      hueDrift: 30,
      sat: params.saturation + 5,
      light: 65,
      alpha: 0.68 * breathAlpha,
      rotation: time * 0.1,
      pointed: false,
    });
  }

  // ===== Layer 7: パーティクルシステム =====
  drawParticles(ctx, params, maxR, time, dt) {
    const hue0 = params.particleHue + time * 10;

    this.particles.forEach((p) => {
      const alive = p.update(dt, this.breathScale);
      if (!alive) {
        p.reset(this.particleRng, maxR);
        return;
      }

      const alpha = p.getAlpha() * 0.7;
      if (alpha <= 0) return;

      const sz = p.size * (0.8 + 0.4 * Math.sin(time * 5 + p.hueOffset));
      const pH = hue0 + p.hueOffset;

      // グロー
      const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, sz * 3);
      glow.addColorStop(0, hsl(pH, 70, 85, alpha * 0.6));
      glow.addColorStop(0.5, hsl(pH, 60, 70, alpha * 0.2));
      glow.addColorStop(1, 'transparent');
      ctx.beginPath();
      ctx.arc(p.x, p.y, sz * 3, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();

      // 明るいコア
      ctx.beginPath();
      ctx.arc(p.x, p.y, sz * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = PALETTE.white(alpha * 0.8);
      ctx.fill();
    });
  }

  // ===== Layer 8a: 外輪装飾 =====
  drawOuterRing(ctx, params, maxR, time) {
    const outerR = maxR * 0.95;
    const ticks = Math.round(params.outerTicks);
    const hue0 = params.hueBase + time * 3;

    // 外側の主円
    ctx.beginPath();
    ctx.arc(0, 0, outerR, 0, Math.PI * 2);
    ctx.strokeStyle = hsl(hue0, params.saturation - 20, 45, 0.12);
    ctx.lineWidth = 1.0;
    ctx.stroke();

    // 第2円
    ctx.beginPath();
    ctx.arc(0, 0, outerR * 1.02, 0, Math.PI * 2);
    ctx.strokeStyle = hsl(hue0 + 20, params.saturation - 20, 45, 0.06);
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // ティック装飾
    ctx.save();
    ctx.rotate(time * 0.05);

    for (let i = 0; i < ticks; i++) {
      const angle = (i / ticks) * Math.PI * 2;
      const isMajor = i % 6 === 0;
      const len = isMajor ? maxR * 0.06 : maxR * 0.025;
      const innerR = outerR - len;
      const pulse = 0.08 + (isMajor ? 0.08 : 0.03) * Math.sin(time * 2 + i * 0.3);

      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * innerR, Math.sin(angle) * innerR);
      ctx.lineTo(Math.cos(angle) * outerR, Math.sin(angle) * outerR);
      ctx.strokeStyle = PALETTE.gold(pulse);
      ctx.lineWidth = isMajor ? 1.0 : 0.4;
      ctx.stroke();

      // メジャーティックにダイヤモンド装飾
      if (isMajor) {
        const dx = Math.cos(angle) * (outerR + 5);
        const dy = Math.sin(angle) * (outerR + 5);
        const ds = 3;
        ctx.save();
        ctx.translate(dx, dy);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(0, -ds);
        ctx.lineTo(ds * 0.6, 0);
        ctx.lineTo(0, ds);
        ctx.lineTo(-ds * 0.6, 0);
        ctx.closePath();
        ctx.fillStyle = PALETTE.gold(pulse * 1.5);
        ctx.fill();
        ctx.restore();
      }
    }

    ctx.restore();
  }

  // ===== Layer 8b: ゴッドレイ =====
  drawGodRays(ctx, params, maxR, time) {
    const rayCount = 12;
    const hue0 = params.hueBase + time * 5;

    ctx.save();
    ctx.rotate(time * 0.03);

    for (let i = 0; i < rayCount; i++) {
      const angle = (i / rayCount) * Math.PI * 2;
      const pulse = 0.055 + 0.04 * Math.sin(time * 1.8 + i * 1.3);
      const rayLen = maxR * (0.7 + 0.3 * Math.sin(time * 0.8 + i * 0.5));
      const rayW = maxR * 0.08;

      const grad = ctx.createLinearGradient(0, 0, Math.cos(angle) * rayLen, Math.sin(angle) * rayLen);
      grad.addColorStop(0, hsl(hue0 + i * 10, 50, 80, pulse));
      grad.addColorStop(0.5, hsl(hue0 + i * 10, 40, 60, pulse * 0.3));
      grad.addColorStop(1, 'transparent');

      const perpA = angle + Math.PI / 2;
      const endX = Math.cos(angle) * rayLen;
      const endY = Math.sin(angle) * rayLen;
      const wX = Math.cos(perpA) * rayW * 0.5;
      const wY = Math.sin(perpA) * rayW * 0.5;

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(endX + wX, endY + wY);
      ctx.lineTo(endX - wX, endY - wY);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();
    }

    ctx.restore();
  }

  // ===== Layer 8c: 中心グロー =====
  drawCenterGlow(ctx, params, maxR, time) {
    const pulse = 0.6 + 0.4 * Math.sin(time * 1.5);
    const hue0 = params.hueBase + time * 12;
    const glowR = maxR * 0.3;

    // メイングロー（強化）
    const g1 = ctx.createRadialGradient(0, 0, 0, 0, 0, glowR);
    g1.addColorStop(0, PALETTE.white(0.45 * pulse));
    g1.addColorStop(0.15, hsl(hue0 + 40, 70, 90, 0.3 * pulse));
    g1.addColorStop(0.35, hsl(hue0, 60, 75, 0.15 * pulse));
    g1.addColorStop(0.6, hsl(hue0 + 30, 50, 60, 0.06 * pulse));
    g1.addColorStop(1, 'transparent');
    ctx.beginPath();
    ctx.arc(0, 0, glowR, 0, Math.PI * 2);
    ctx.fillStyle = g1;
    ctx.fill();

    // ゴールドグロー
    const g2R = maxR * 0.18;
    const g2 = ctx.createRadialGradient(0, 0, 0, 0, 0, g2R);
    g2.addColorStop(0, PALETTE.gold(0.4 * pulse));
    g2.addColorStop(0.4, hsl(hue0 - 20, 70, 70, 0.15 * pulse));
    g2.addColorStop(1, 'transparent');
    ctx.beginPath();
    ctx.arc(0, 0, g2R, 0, Math.PI * 2);
    ctx.fillStyle = g2;
    ctx.fill();

    // 極小の白いコア
    const gCore = ctx.createRadialGradient(0, 0, 0, 0, 0, maxR * 0.06);
    gCore.addColorStop(0, PALETTE.white(0.7 * pulse));
    gCore.addColorStop(1, 'transparent');
    ctx.beginPath();
    ctx.arc(0, 0, maxR * 0.06, 0, Math.PI * 2);
    ctx.fillStyle = gCore;
    ctx.fill();
  }

  // ===== アート用キャプチャ: ヘルパーメソッド群 =====

  /** 花弁パス生成（原点から+x方向に伸びる） */
  _petalPath(ctx, len, w, pointed) {
    ctx.beginPath();
    if (pointed) {
      ctx.moveTo(0, 0);
      ctx.lineTo(len * 0.55, -w * 0.35);
      ctx.lineTo(len, 0);
      ctx.lineTo(len * 0.55, w * 0.35);
    } else {
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(len * 0.25, -w, len * 0.75, -w * 0.5, len, 0);
      ctx.bezierCurveTo(len * 0.75, w * 0.5, len * 0.25, w, 0, 0);
    }
    ctx.closePath();
  }

  /** 花弁リング描画 */
  _drawPetalRing(ctx, cfg) {
    const { radius, count, len, width, hue0: h0, hueDrift: hd, sat, light, alpha, rotation, pointed } = cfg;
    ctx.save();
    ctx.rotate(rotation || 0);
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const pH = h0 + (i / count) * (hd || 60);
      ctx.save();
      ctx.rotate(angle);
      ctx.translate(radius, 0);
      this._petalPath(ctx, len, width, pointed);

      const g = ctx.createLinearGradient(0, 0, len, 0);
      g.addColorStop(0, hsl(pH, sat, light + 15, alpha));
      g.addColorStop(0.4, hsl(pH + 10, sat - 5, light, alpha * 0.7));
      g.addColorStop(1, hsl(pH + 20, sat - 15, light - 15, alpha * 0.15));
      ctx.fillStyle = g;
      ctx.fill();

      ctx.strokeStyle = hsl(pH, sat + 10, light + 25, alpha * 0.35);
      ctx.lineWidth = 0.6;
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  /** 星空背景描画 */
  _drawStarField(ctx, halfSize, rng) {
    for (let i = 0; i < 400; i++) {
      const x = (rng() - 0.5) * halfSize * 2;
      const y = (rng() - 0.5) * halfSize * 2;
      const r = rng() * 1.2 + 0.2;
      const a = rng() * 0.6 + 0.2;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 240, ${a})`;
      ctx.fill();
    }
  }

  /** ジェムレイ（宝石風光線） */
  _drawGemRays(ctx, maxR, params) {
    const sym = Math.round(params.symmetry);
    const h0 = params.hueBase + 30;
    for (let i = 0; i < sym; i++) {
      const angle = (i / sym) * Math.PI * 2;
      const rayLen = maxR * 0.9;
      const rayW = maxR * 0.055;
      const h = h0 + i * (360 / sym);
      ctx.save();
      ctx.rotate(angle);

      // メインレイ
      ctx.beginPath();
      ctx.moveTo(maxR * 0.12, 0);
      ctx.lineTo(rayLen, -rayW);
      ctx.lineTo(rayLen * 1.05, 0);
      ctx.lineTo(rayLen, rayW);
      ctx.closePath();
      const g = ctx.createLinearGradient(maxR * 0.12, 0, rayLen, 0);
      g.addColorStop(0, hsl(h, 65, 80, 0.35));
      g.addColorStop(0.4, hsl(h, 55, 65, 0.15));
      g.addColorStop(1, hsl(h, 40, 50, 0.02));
      ctx.fillStyle = g;
      ctx.fill();

      // エッジハイライト
      ctx.strokeStyle = hsl(h, 60, 85, 0.12);
      ctx.lineWidth = 0.4;
      ctx.stroke();
      ctx.restore();
    }
  }

  /** ロータス中心花 */
  _drawLotusCenter(ctx, maxR, params) {
    const h0 = params.hueBase + params.hueDrift + 180;
    for (let layer = 3; layer >= 0; layer--) {
      const count = 8 + layer * 4;
      const r = maxR * (0.04 + layer * 0.055);
      const len = maxR * (0.1 + layer * 0.035);
      const w = len * (0.3 + layer * 0.04);
      const h = h0 + layer * 22;
      ctx.save();
      ctx.rotate(layer * Math.PI / (count * 2));
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        const pH = h + (i / count) * 35;
        ctx.save();
        ctx.rotate(a);
        ctx.translate(r, 0);
        this._petalPath(ctx, len, w, false);
        const g = ctx.createLinearGradient(0, 0, len, 0);
        g.addColorStop(0, hsl(pH, 70, 78, 0.65));
        g.addColorStop(0.5, hsl(pH + 10, 65, 65, 0.45));
        g.addColorStop(1, hsl(pH + 20, 55, 55, 0.1));
        ctx.fillStyle = g;
        ctx.fill();
        ctx.strokeStyle = hsl(pH, 70, 88, 0.2);
        ctx.lineWidth = 0.3;
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    }
  }

  /** ダイヤモンド装飾を周囲に配置 */
  _drawDiamondRing(ctx, maxR, count, params) {
    const h0 = params.hueBase;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const dx = Math.cos(angle) * maxR;
      const dy = Math.sin(angle) * maxR;
      const ds = maxR * 0.025;
      const pulse = 0.4 + 0.3 * Math.sin(i * 1.7);
      ctx.save();
      ctx.translate(dx, dy);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(0, -ds);
      ctx.lineTo(ds * 0.7, 0);
      ctx.lineTo(0, ds);
      ctx.lineTo(-ds * 0.7, 0);
      ctx.closePath();
      ctx.fillStyle = hsl(h0 + 42, 75, 75, pulse);
      ctx.fill();
      ctx.restore();
    }
  }

  /** ヘックステッセレーション（大きな重なり合う円の格子）*/
  _drawHexTessellation(ctx, maxR, params, tessHue) {
    const h0 = tessHue !== undefined ? tessHue : params.hueBase + 185;
    const circleR = maxR * 0.40;
    const centers = [{ x: 0, y: 0 }];
    for (let ring = 1; ring <= 2; ring++) {
      for (let side = 0; side < 6; side++) {
        const a1 = (side / 6) * Math.PI * 2;
        const a2 = ((side + 1) / 6) * Math.PI * 2;
        for (let pos = 0; pos < ring; pos++) {
          const t = pos / ring;
          centers.push({
            x: lerp(Math.cos(a1), Math.cos(a2), t) * circleR * ring,
            y: lerp(Math.sin(a1), Math.sin(a2), t) * circleR * ring,
          });
        }
      }
    }
    centers.forEach((c, i) => {
      const dist = Math.sqrt(c.x * c.x + c.y * c.y);
      const alpha = Math.max(0.04, 0.38 - dist / (maxR * 1.7));
      const hue = h0 + i * 18;
      const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, circleR);
      g.addColorStop(0, hsl(hue, 65, 58, alpha * 0.18));
      g.addColorStop(0.7, hsl(hue, 55, 50, alpha * 0.07));
      g.addColorStop(1, 'transparent');
      ctx.beginPath();
      ctx.arc(c.x, c.y, circleR, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = hsl(hue, 62, 72, alpha * 0.80);
      ctx.lineWidth = 1.4;
      ctx.stroke();
    });
  }

  /** ダイヤモンドグリッド（斜め正方形の格子）*/
  _drawDiamondGrid(ctx, maxR, params, gridHue) {
    const h0 = gridHue !== undefined ? gridHue : params.hueBase;
    const tw = maxR * 0.19;
    const th = maxR * 0.13;
    const cols = Math.ceil(maxR / tw) + 2;
    const rows = Math.ceil(maxR / th) + 2;
    for (let row = -rows; row <= rows; row++) {
      for (let col = -cols; col <= cols; col++) {
        const x = col * tw + (row % 2) * tw * 0.5;
        const y = row * th;
        const dist = Math.sqrt(x * x + y * y);
        if (dist > maxR * 1.02) continue;
        const alpha = Math.max(0, 0.40 - dist / (maxR * 1.12));
        if (alpha < 0.01) continue;
        const hue = h0 + (((col * 7 + row * 11) % 80) + 80) % 80;
        ctx.beginPath();
        ctx.moveTo(x,            y - th * 0.88);
        ctx.lineTo(x + tw * 0.88, y);
        ctx.lineTo(x,            y + th * 0.88);
        ctx.lineTo(x - tw * 0.88, y);
        ctx.closePath();
        ctx.fillStyle = hsl(hue, 55, 52, alpha * 0.42);
        ctx.fill();
        ctx.strokeStyle = hsl(hue, 50, 76, alpha * 0.70);
        ctx.lineWidth = 0.7;
        ctx.stroke();
      }
    }
  }

  /** ゴールデン軌道リング（螺旋装飾付き） */
  _drawGoldenOrbit(ctx, maxR, params, orbitHue) {
    const r = maxR * 0.63;
    const ornCount = Math.max(3, Math.round(params.symmetry / 3));
    // 軌道リングの色（ゴールド/シルバー/ローズ/ティール/パープルなど）
    const oh = orbitHue !== undefined ? orbitHue : 42;
    const orbitColor = (a) => hsl(oh, 78, 68, a);
    ctx.save();
    // 外枠グロー
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    const rg = ctx.createLinearGradient(-r, -r, r, r);
    rg.addColorStop(0,   orbitColor(0.22));
    rg.addColorStop(0.3, orbitColor(0.88));
    rg.addColorStop(0.6, orbitColor(0.98));
    rg.addColorStop(1,   orbitColor(0.22));
    ctx.strokeStyle = rg;
    ctx.lineWidth = 3.5;
    ctx.shadowColor = orbitColor(0.9);
    ctx.shadowBlur = 14;
    ctx.stroke();
    ctx.shadowBlur = 0;
    // 内側細リング
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.93, 0, Math.PI * 2);
    ctx.strokeStyle = orbitColor(0.28);
    ctx.lineWidth = 0.8;
    ctx.stroke();
    // 螺旋装飾
    for (let i = 0; i < ornCount; i++) {
      const angle = (i / ornCount) * Math.PI * 2;
      ctx.save();
      ctx.translate(r * Math.cos(angle), r * Math.sin(angle));
      ctx.rotate(angle + Math.PI / 2);
      ctx.beginPath();
      for (let t = 0.3; t <= Math.PI * 3.8; t += 0.08) {
        const sr = t * 3.8;
        if (t <= 0.38) ctx.moveTo(sr * Math.cos(t), sr * Math.sin(t));
        else           ctx.lineTo(sr * Math.cos(t), sr * Math.sin(t));
      }
      ctx.strokeStyle = orbitColor(0.55);
      ctx.lineWidth = 0.9;
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  /** エネルギー爆発（炎・火花の放射） */
  _drawEnergyBurst(ctx, maxR, params, rng, burstHue) {
    const lineCount = Math.round(params.symmetry) * 10;
    const baseHue = burstHue !== undefined ? burstHue : 20 + rng() * 35;
    ctx.save();
    for (let i = 0; i < lineCount; i++) {
      const angle = (i / lineCount) * Math.PI * 2;
      const len   = maxR * (0.22 + rng() * 0.28);
      const alpha = 0.35 + rng() * 0.45;
      const hue   = baseHue + rng() * 40 - 20;
      const lw    = 0.4 + rng() * 2.0;
      const ex = Math.cos(angle) * len;
      const ey = Math.sin(angle) * len;
      const g = ctx.createLinearGradient(0, 0, ex, ey);
      g.addColorStop(0,   hsl(hue,      95, 86, alpha));
      g.addColorStop(0.4, hsl(hue + 12, 90, 70, alpha * 0.7));
      g.addColorStop(1,   hsl(hue + 22, 85, 55, 0));
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(ex, ey);
      ctx.strokeStyle = g;
      ctx.lineWidth = lw;
      ctx.stroke();
    }
    const fg = ctx.createRadialGradient(0, 0, 0, 0, 0, maxR * 0.32);
    fg.addColorStop(0,    hsl(baseHue + 30, 100, 98, 0.95));
    fg.addColorStop(0.1,  hsl(baseHue + 20,  98, 88, 0.85));
    fg.addColorStop(0.25, hsl(baseHue + 5,   95, 72, 0.65));
    fg.addColorStop(0.5,  hsl(baseHue - 10,  90, 55, 0.30));
    fg.addColorStop(0.75, hsl(baseHue - 15,  80, 40, 0.10));
    fg.addColorStop(1,    'transparent');
    ctx.beginPath();
    ctx.arc(0, 0, maxR * 0.32, 0, Math.PI * 2);
    ctx.fillStyle = fg;
    ctx.fill();
    ctx.restore();
  }

  // ===== キャプチャ（マンダラアート生成） =====
  capture(size) {
    const captureCanvas = document.createElement('canvas');
    captureCanvas.width = size;
    captureCanvas.height = size;
    const ctx = captureCanvas.getContext('2d');
    const cx = size / 2;
    const cy = size / 2;
    const maxR = size * 0.44;

    const params = lerpParams(this.paramsA, this.paramsB, 0.85);
    const elapsed = performance.now() / 1000;
    const h0 = params.hueBase;
    const h1 = params.hueSecondary;
    const sym = Math.round(params.symmetry);
    const sat = params.saturation;

    // キャプチャ用シードRNG
    const rng = seededRandom(hashText(
      h0.toFixed(2) + h1.toFixed(2) + sym + sat.toFixed(2)
    ));

    // ===== シードで全体スタイルを決定（rng()を最初に使う）=====
    const numRings    = 3 + Math.floor(rng() * 3); // 3〜5リング
    const bgTexture   = Math.floor(rng() * 3);     // 0=星のみ 1=ヘックス 2=ダイヤ
    const geoOverlay  = Math.floor(rng() * 4);     // 0=花+六芒星 1=メタトロン 2=万華鏡 3=スパイラル
    const centerStyle = Math.floor(rng() * 3);     // 0=蓮 1=エネルギー爆発 2=グローのみ
    const hasOrbit    = rng() > 0.45;              // 軌道リング（55%）

    // 背景色をh0非依存のランダム色相で決定（淡い色調）
    const bgHue = rng() * 360;
    const bgC = [
      [bgHue,      42 + rng() * 16, 26 + rng() * 6],
      [bgHue + 8,  50 + rng() * 12, 16 + rng() * 5],
      [bgHue + 14, 55 + rng() * 10,  9 + rng() * 4],
      [bgHue + 18, 60 + rng() * 8,   4 + rng() * 3],
    ];

    ctx.save();
    ctx.translate(cx, cy);

    // ========== Layer 1: 背景 + 星空 ==========
    const bg = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 0.72);
    bg.addColorStop(0,    hsl(bgC[0][0], bgC[0][1], bgC[0][2], 1));
    bg.addColorStop(0.4,  hsl(bgC[1][0], bgC[1][1], bgC[1][2], 1));
    bg.addColorStop(0.75, hsl(bgC[2][0], bgC[2][1], bgC[2][2], 1));
    bg.addColorStop(1,    hsl(bgC[3][0], bgC[3][1], bgC[3][2], 1));
    ctx.fillStyle = bg;
    ctx.fillRect(-cx, -cy, size, size);

    // 星雲パッチ（大きなソフトな色の塊）
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 8; i++) {
      const nx = (rng() - 0.5) * size * 0.7;
      const ny = (rng() - 0.5) * size * 0.7;
      const nr = rng() * size * 0.22 + size * 0.08;
      const nh = rng() * 360;
      const ng = ctx.createRadialGradient(nx, ny, 0, nx, ny, nr);
      ng.addColorStop(0, hsl(nh, 50, 45, 0.1));
      ng.addColorStop(1, 'transparent');
      ctx.fillStyle = ng;
      ctx.fillRect(-cx, -cy, size, size);
    }

    // 星空
    ctx.globalCompositeOperation = 'lighter';
    this._drawStarField(ctx, cx, rng);

    // ========== Layer 1.5: 背景テクスチャ（ヘックス or ダイヤモンド格子）==========
    const tessHue = rng() * 360;
    if (bgTexture === 1) {
      ctx.globalCompositeOperation = 'screen';
      this._drawHexTessellation(ctx, maxR, params, tessHue);
    } else if (bgTexture === 2) {
      ctx.globalCompositeOperation = 'screen';
      this._drawDiamondGrid(ctx, maxR, params, tessHue);
    }

    // ========== Layer 2: 外側オーラ ==========
    ctx.globalCompositeOperation = 'screen';
    const aura = ctx.createRadialGradient(0, 0, maxR * 0.25, 0, 0, maxR * 1.15);
    aura.addColorStop(0, hsl(h0, 50, 65, 0.15));
    aura.addColorStop(0.5, hsl(h0 + 60, 40, 45, 0.08));
    aura.addColorStop(1, 'transparent');
    ctx.fillStyle = aura;
    ctx.fillRect(-cx, -cy, size, size);

    // ========== Layer 3: ジェムレイ（宝石風光線） ==========
    ctx.globalCompositeOperation = 'screen';
    this._drawGemRays(ctx, maxR, params);

    // ========== Layer 4: ランダム花弁リング群（毎回異なるパターン） ==========
    ctx.globalCompositeOperation = 'screen';

    // 色相を h0, h1, ランダムの3ソースからミックス（毎回異なるカラーパレット）
    const hueSources = [h0, h1, rng() * 360, (h0 + 180) % 360, (h1 + 120) % 360, rng() * 360];
    const ringHues = Array.from({ length: numRings + 3 }, (_, i) =>
      hueSources[i % hueSources.length] + rng() * 70 - 35
    );

    // 外→内の基準半径
    const baseRadii = [0.82, 0.65, 0.50, 0.35, 0.22];

    for (let ri = 0; ri < numRings; ri++) {
      const baseR      = Math.max(0.16, baseRadii[ri] + (rng() - 0.5) * 0.07);
      const isLarge    = rng() > 0.38;
      const isPointed  = rng() > 0.50;
      const countMult  = 1 + Math.floor(rng() * 3); // sym x1/x2/x3
      const ringLen    = maxR * (isLarge ? 0.20 + rng() * 0.16 : 0.10 + rng() * 0.12);
      const ringAlpha  = 0.38 + rng() * 0.32;
      const ringHue    = ringHues[ri];
      const ringRot    = rng() * Math.PI / sym;

      // メインリング
      this._drawPetalRing(ctx, {
        radius: maxR * baseR,
        count:  sym * countMult,
        len:    ringLen,
        width:  maxR * (0.044 + rng() * 0.065),
        hue0:   ringHue,
        hueDrift: 28 + rng() * 68,
        sat:    sat + (rng() - 0.5) * 16,
        light:  52 + rng() * 22,
        alpha:  ringAlpha,
        rotation: ringRot,
        pointed: isPointed,
      });

      // 60%の確率でオフセット重ねリングを追加（深み演出）
      if (rng() > 0.40) {
        this._drawPetalRing(ctx, {
          radius: maxR * baseR,
          count:  sym * countMult,
          len:    ringLen * (0.65 + rng() * 0.30),
          width:  maxR * (0.040 + rng() * 0.050),
          hue0:   ringHue + 20 + Math.floor(rng() * 40),
          hueDrift: 30 + rng() * 50,
          sat:    sat + (rng() - 0.5) * 12,
          light:  54 + rng() * 20,
          alpha:  ringAlpha * (0.35 + rng() * 0.35),
          rotation: ringRot + Math.PI / (sym * countMult),
          pointed: isPointed,
        });
      }
    }

    // ========== Layer 5: 幾何学オーバーレイ（4パターンからランダム選択）==========
    ctx.globalCompositeOperation = 'screen';
    if (geoOverlay === 0) {
      // フラワー・オブ・ライフ + 六芒星
      this.drawFlowerOfLife(ctx, params, maxR, elapsed);
      this.drawHexagrams(ctx, params, maxR, elapsed);
      this.drawFlowerOfLife(ctx, params, maxR, elapsed + 0.5);
    } else if (geoOverlay === 1) {
      // メタトロンキューブ + フラワー
      this.drawFlowerOfLife(ctx, params, maxR, elapsed);
      this.drawMetatronsCube(ctx, params, maxR, elapsed);
    } else if (geoOverlay === 2) {
      // 万華鏡セグメント + フラワー
      this.drawKaleidoscope(ctx, params, maxR, elapsed);
      this.drawFlowerOfLife(ctx, params, maxR, elapsed);
    } else {
      // ゴールデンスパイラル + 六芒星
      this.drawGoldenSpirals(ctx, params, maxR, elapsed);
      this.drawHexagrams(ctx, params, maxR, elapsed);
      this.drawFlowerOfLife(ctx, params, maxR, elapsed + 1.0);
    }

    // ========== Layer 5.5: 軌道リング（確率的・色はランダム）==========
    if (hasOrbit) {
      ctx.globalCompositeOperation = 'lighter';
      this._drawGoldenOrbit(ctx, maxR, params, rng() * 360);
    }

    // ========== Layer 6: 中心スタイル（3種からランダム選択）==========
    if (centerStyle === 0) {
      ctx.globalCompositeOperation = 'screen';
      this._drawLotusCenter(ctx, maxR, params);
    } else if (centerStyle === 1) {
      ctx.globalCompositeOperation = 'lighter';
      this._drawEnergyBurst(ctx, maxR, params, rng, rng() * 360);
    }
    // centerStyle === 2: 中心グロー（Layer 9）のみ、ここは何もしない

    // ========== Layer 7: ワイヤーフレーム装飾 ==========
    // 同心円
    ctx.globalCompositeOperation = 'screen';
    const circleRadii = [0.2, 0.35, 0.5, 0.65, 0.82, 0.95];
    circleRadii.forEach((ratio, i) => {
      const r = maxR * ratio;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.strokeStyle = hsl(h0 + i * 20, 40, 70, 0.12 + i * 0.02);
      ctx.lineWidth = i === circleRadii.length - 1 ? 1.2 : 0.5;
      ctx.stroke();
    });

    // 外輪ダイヤモンド装飾
    ctx.globalCompositeOperation = 'lighter';
    this._drawDiamondRing(ctx, maxR * 0.95, sym * 2, params);

    // ========== Layer 8: ゴッドレイ ==========
    ctx.globalCompositeOperation = 'lighter';
    this.drawGodRays(ctx, params, maxR, elapsed);
    this.drawGodRays(ctx, params, maxR, elapsed + 1.8);

    // ========== Layer 9: 中心グロー ==========
    ctx.globalCompositeOperation = 'lighter';

    // 大きなグロー
    const g1 = ctx.createRadialGradient(0, 0, 0, 0, 0, maxR * 0.4);
    g1.addColorStop(0, PALETTE.white(0.55));
    g1.addColorStop(0.1, hsl(h0 + 40, 70, 90, 0.35));
    g1.addColorStop(0.3, hsl(h0, 60, 75, 0.15));
    g1.addColorStop(0.6, hsl(h0 + 270, 45, 55, 0.05));
    g1.addColorStop(1, 'transparent');
    ctx.beginPath();
    ctx.arc(0, 0, maxR * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = g1;
    ctx.fill();

    // 白いコア
    const g2 = ctx.createRadialGradient(0, 0, 0, 0, 0, maxR * 0.1);
    g2.addColorStop(0, PALETTE.white(0.95));
    g2.addColorStop(0.3, PALETTE.white(0.5));
    g2.addColorStop(1, 'transparent');
    ctx.beginPath();
    ctx.arc(0, 0, maxR * 0.1, 0, Math.PI * 2);
    ctx.fillStyle = g2;
    ctx.fill();

    // ========== Layer 10: スパークル ==========
    for (let i = 0; i < 60; i++) {
      const angle = rng() * Math.PI * 2;
      const dist = rng() * maxR * 0.92;
      const sx = Math.cos(angle) * dist;
      const sy = Math.sin(angle) * dist;
      const sr = rng() * 2.5 + 0.8;
      const sa = rng() * 0.55 + 0.25;

      const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr * 3.5);
      sg.addColorStop(0, PALETTE.white(sa));
      sg.addColorStop(0.25, hsl(h0 + rng() * 80, 60, 82, sa * 0.4));
      sg.addColorStop(1, 'transparent');
      ctx.beginPath();
      ctx.arc(sx, sy, sr * 3.5, 0, Math.PI * 2);
      ctx.fillStyle = sg;
      ctx.fill();
    }

    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';

    return captureCanvas;
  }
}
