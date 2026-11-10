// touchfx.js - the ring the game draws where the screen is touched (a left click on PC, which the PC build passes on as
// a touch). Native 0xad4e0 reads the touch screen each frame and, for each new touch, 0x1034 takes one of 16 records
// (object *0xae0170, +0x3400, 32 bytes: x, y, -, 48.0, 0.5, time, flag 1). 0xe00 runs them: the time rises by
// frames / 60 and a record ends at 0.5 s; each draws a 32-segment disc (0xb8648, a triangle fan with no texture) at the
// touch point whose centre colour is clear (0xb895c(0, 0, 0, 0)) and whose rim is white at half alpha (0xb8974 with
// the colour at +0x3600, (1, 1, 1, 0.5), set by 0xd14). Its radius runs 0 -> 48 with easing type 3 out (cubic) and its
// alpha 1 -> 0 with type 2 in (quadratic), both over the 0.5 s (0xe1bfc). 48 is in the 1920 x 1080 picture's pixels.

export const RIPPLE = { slots: 16, life: 0.5, radius: 48, rim: [255, 255, 255, 0.5], segments: 32 };

// The ring at t seconds after the touch: its radius and its alpha, or null once it has ended.
export function rippleAt(t) {
  if (t < 0 || t >= RIPPLE.life) return null;
  const u = t / RIPPLE.life;
  return { radius: RIPPLE.radius * (1 - (1 - u) ** 3), alpha: 1 - u * u };
}

export class TouchFx {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.rings = [];
    this.running = false;
  }

  // A new touch at (x, y) in picture pixels; none when all 16 records are taken (0x1034 returns 0).
  touch(x, y, now = performance.now()) {
    if (this.rings.length >= RIPPLE.slots) return false;
    this.rings.push({ x, y, start: now });
    if (!this.running) { this.running = true; requestAnimationFrame((t) => this.frame(t)); }
    return true;
  }

  frame(now) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.rings = this.rings.filter((r) => rippleAt((now - r.start) / 1000));
    for (const r of this.rings) {
      const s = rippleAt((now - r.start) / 1000);
      if (s.radius <= 0) continue;
      // The fan's colours run from the clear centre to the rim, so the disc is a gradient out to a white edge.
      const g = ctx.createRadialGradient(r.x, r.y, 0, r.x, r.y, s.radius);
      const [cr, cg, cb, ca] = RIPPLE.rim;
      g.addColorStop(0, `rgba(${cr},${cg},${cb},0)`);
      g.addColorStop(1, `rgba(${cr},${cg},${cb},${ca})`);
      ctx.globalAlpha = s.alpha;
      ctx.fillStyle = g;
      ctx.beginPath();
      // the native disc is a 32-sided polygon
      for (let k = 0; k <= RIPPLE.segments; k++) {
        const a = (k / RIPPLE.segments) * Math.PI * 2;
        const px = r.x + Math.cos(a) * s.radius, py = r.y - Math.sin(a) * s.radius;
        if (k) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      }
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (this.rings.length) requestAnimationFrame((t) => this.frame(t));
    else this.running = false;
  }
}
