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

    // --- Layer 1: 背景（トレイル残像） ---
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(8, 6, 20, 0.18)';
    ctx.fillRect(0, 0, w, h);

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
      const alpha = Math.max(0.03, 0.22 - dist / (maxR * 1.2));
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
        glow.addColorStop(0, hsl(circleHue, params.saturation, 70, pulseAlpha * 0.12));
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
          const alpha = 0.07 + 0.05 * Math.sin(time * 2 + i + j);
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
      const alpha = 0.12 - layer * 0.02;
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
      const layerAlpha = 0.22 - layer * 0.05;

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
      const pulse = 0.03 + 0.025 * Math.sin(time * 1.8 + i * 1.3);
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

    // メイングロー
    const g1 = ctx.createRadialGradient(0, 0, 0, 0, 0, glowR);
    g1.addColorStop(0, PALETTE.white(0.25 * pulse));
    g1.addColorStop(0.2, hsl(hue0, 60, 80, 0.15 * pulse));
    g1.addColorStop(0.5, hsl(hue0 + 30, 50, 60, 0.06 * pulse));
    g1.addColorStop(1, 'transparent');
    ctx.beginPath();
    ctx.arc(0, 0, glowR, 0, Math.PI * 2);
    ctx.fillStyle = g1;
    ctx.fill();

    // セカンダリグロー（ゴールド）
    const g2R = maxR * 0.15;
    const g2 = ctx.createRadialGradient(0, 0, 0, 0, 0, g2R);
    g2.addColorStop(0, PALETTE.gold(0.2 * pulse));
    g2.addColorStop(0.5, hsl(hue0 - 30, 70, 70, 0.08 * pulse));
    g2.addColorStop(1, 'transparent');
    ctx.beginPath();
    ctx.arc(0, 0, g2R, 0, Math.PI * 2);
    ctx.fillStyle = g2;
    ctx.fill();
  }

  // ===== キャプチャ（アート生成用） =====
  capture(size) {
    const captureCanvas = document.createElement('canvas');
    captureCanvas.width = size;
    captureCanvas.height = size;
    const capCtx = captureCanvas.getContext('2d');

    const cx = size / 2;
    const cy = size / 2;
    const maxR = size * 0.42;

    // 背景
    const bgGrad = capCtx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.7);
    bgGrad.addColorStop(0, '#1a1040');
    bgGrad.addColorStop(0.5, '#0f0a2a');
    bgGrad.addColorStop(1, '#080614');
    capCtx.fillStyle = bgGrad;
    capCtx.fillRect(0, 0, size, size);

    const params = lerpParams(this.paramsA, this.paramsB, 0.85);
    const elapsed = performance.now() / 1000;

    capCtx.save();
    capCtx.translate(cx, cy);

    // 全レイヤーを描画
    capCtx.globalCompositeOperation = 'screen';
    this.drawFlowerOfLife(capCtx, params, maxR, elapsed);

    capCtx.globalCompositeOperation = 'lighter';
    this.drawMetatronsCube(capCtx, params, maxR, elapsed);

    capCtx.globalCompositeOperation = 'screen';
    this.drawHexagrams(capCtx, params, maxR, elapsed);
    this.drawGoldenSpirals(capCtx, params, maxR, elapsed);
    this.drawKaleidoscope(capCtx, params, maxR, elapsed);

    // パーティクル静的スナップショット
    capCtx.globalCompositeOperation = 'lighter';
    this.particles.forEach((p) => {
      const alpha = p.getAlpha() * 0.5;
      if (alpha <= 0) return;
      const pH = params.particleHue + p.hueOffset;
      const glow = capCtx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 3);
      glow.addColorStop(0, hsl(pH, 70, 85, alpha * 0.5));
      glow.addColorStop(1, 'transparent');
      capCtx.beginPath();
      capCtx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
      capCtx.fillStyle = glow;
      capCtx.fill();
    });

    capCtx.globalCompositeOperation = 'screen';
    this.drawOuterRing(capCtx, params, maxR, elapsed);
    capCtx.globalCompositeOperation = 'lighter';
    this.drawGodRays(capCtx, params, maxR, elapsed);
    this.drawCenterGlow(capCtx, params, maxR, elapsed);

    capCtx.restore();
    capCtx.globalCompositeOperation = 'source-over';

    return captureCanvas;
  }
}
