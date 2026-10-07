/* =====================================================================
   chart.mini — بديل مصغّر لـChart.js يغطي مخططات الأعمدة المستعملة في التطبيق.
   يدعم: type:'bar'، عدة مجموعات، backgroundColor كلون أو مصفوفة، borderRadius،
   maxBarThickness، legend، tooltip بـcallbacks.label، محور y على اليمين مع
   ticks.callback، محور x معكوس (RTL)، grid.display/color، animation.duration،
   responsive مع maintainAspectRatio:false، و.destroy() و.update().
   ===================================================================== */
(function(global){
'use strict';
const DPR = () => Math.min(window.devicePixelRatio || 1, 2);

function niceMax(v){
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v))), n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}
function roundRect(ctx, x, y, w, h, r){
  const rr = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h)));
  ctx.beginPath();
  ctx.moveTo(x, y + h); ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.lineTo(x + w - rr, y); ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h); ctx.closePath(); ctx.fill();
}
function fontStr(f, dflt){ f = f || {}; return `${f.weight || 600} ${f.size || dflt || 12}px ${f.family || 'system-ui, sans-serif'}`; }

class Chart {
  constructor(target, config){
    this.ctx = target && target.getContext ? target.getContext('2d') : target;
    this.canvas = this.ctx.canvas;
    this.config = config || {};
    this.hover = null;
    this._alive = true;
    this._t0 = performance.now();
    this._dur = ((config.options || {}).animation || {}).duration;
    if (this._dur == null) this._dur = 350;
    this._onMove = e => {
      const r = this.canvas.getBoundingClientRect();
      const hit = this._hit(e.clientX - r.left, e.clientY - r.top);
      const key = hit ? hit.di + ':' + hit.i : null;
      if (key !== this._hoverKey){ this._hoverKey = key; this.hover = hit; this._paint(1); }
    };
    this._onLeave = () => { if (this.hover){ this.hover = null; this._hoverKey = null; this._paint(1); } };
    const resp = (config.options || {}).responsive !== false;
    if (resp){ const st = this.canvas.style; st.display = 'block'; st.boxSizing = 'border-box'; st.width = '100%'; st.height = '100%'; }
    this.canvas.addEventListener('mousemove', this._onMove);
    this.canvas.addEventListener('mouseleave', this._onLeave);
    if (typeof ResizeObserver !== 'undefined'){
      this._ro = new ResizeObserver(() => { if (this._alive) this._paint(1); });
      this._ro.observe(this.canvas.parentElement || this.canvas);
    }
    this._animate();
  }
  update(){ this.hover = null; this._hoverKey = null; this._t0 = performance.now(); this._animate(); }
  destroy(){
    this._alive = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    if (this._ro) this._ro.disconnect();
    this.canvas.removeEventListener('mousemove', this._onMove);
    this.canvas.removeEventListener('mouseleave', this._onLeave);
    const c = this.ctx; c.setTransform(1,0,0,1,0,0); c.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
  _animate(){
    const step = () => {
      if (!this._alive) return;
      const t = this._dur > 0 ? Math.min(1, (performance.now() - this._t0) / this._dur) : 1;
      this._paint(t < 1 ? 1 - Math.pow(1 - t, 3) : 1);
      if (t < 1) this._raf = requestAnimationFrame(step);
    };
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = requestAnimationFrame(step);
  }
  _layout(){
    const o = this.config.options || {}, sc = o.scales || {}, y = sc.y || {}, x = sc.x || {};
    const d = this.config.data || {}, sets = (d.datasets || []).filter(Boolean);
    const labels = (d.labels || []).slice();
    let max = 0;
    sets.forEach(s => (s.data || []).forEach(v => { const n = +v || 0; if (n > max) max = n; }));
    max = niceMax(max);
    const legendOn = !((o.plugins || {}).legend || {}).display === false
      ? (((o.plugins || {}).legend || {}).display !== false && sets.length > 1 && sets.some(s => s.label))
      : false;
    return { sets, labels, max, y, x, legendOn, o };
  }
  _geom(){
    const cv = this.canvas, dpr = DPR();
    const W = cv.clientWidth || cv.width, H = cv.clientHeight || cv.height;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)){ cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    return { W, H, dpr };
  }
  _hit(px, py){
    const g = this._bars; if (!g) return null;
    for (const b of g) if (px >= b.x && px <= b.x + b.w && py >= Math.min(b.y, b.base) - 6 && py <= b.base) return b;
    return null;
  }
  _paint(prog){
    const { W, H, dpr } = this._geom(), ctx = this.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const L = this._layout(); if (!L.labels.length && !L.sets.length) return;
    const tickY = (L.y.ticks || {}), tickX = (L.x.ticks || {});
    const gridY = (L.y.grid || {}), gridX = (L.x.grid || {});
    const fmt = tickY.callback || (v => String(v));
    const yFont = fontStr(tickY.font, 11), xFont = fontStr(tickX.font, 11);
    const legend = ((L.o.plugins || {}).legend || {});
    const legendOn = legend.display !== false && L.sets.length > 1 && L.sets.some(s => s.label);

    // هوامش
    ctx.font = yFont;
    const steps = 4;
    let yw = 0; for (let i = 0; i <= steps; i++) yw = Math.max(yw, ctx.measureText(fmt(L.max * i / steps)).width);
    const padR = yw + 14, padL = 8, padT = 10 + (legendOn ? 24 : 0), padB = 34;
    const plotW = Math.max(10, W - padR - padL), plotH = Math.max(10, H - padT - padB);
    const x0 = padL, y0 = padT, yB = padT + plotH;

    // وسيلة الإيضاح
    if (legendOn){
      const lf = fontStr((legend.labels || {}).font, 12), bw = ((legend.labels || {}).boxWidth) || 14;
      ctx.font = lf; ctx.textBaseline = 'middle';
      const items = L.sets.map(s => ({ t:s.label || '', c: Array.isArray(s.backgroundColor) ? s.backgroundColor[0] : s.backgroundColor }));
      const wTotal = items.reduce((s, it) => s + bw + 6 + ctx.measureText(it.t).width + 16, 0) - 16;
      let lx = (W - wTotal) / 2;
      items.forEach(it => {
        ctx.fillStyle = it.c || '#888'; roundRect(ctx, lx, 6, bw, 12, 3);
        ctx.fillStyle = (legend.labels || {}).color || '#888';
        ctx.textAlign = 'left'; ctx.fillText(it.t, lx + bw + 6, 12);
        lx += bw + 6 + ctx.measureText(it.t).width + 16;
      });
    }

    // شبكة المحور y + تسمياته على اليمين
    ctx.textBaseline = 'middle'; ctx.font = yFont;
    for (let i = 0; i <= steps; i++){
      const v = L.max * i / steps, yy = yB - (plotH * i / steps);
      if (gridY.display !== false){
        ctx.strokeStyle = gridY.color || 'rgba(128,128,128,.18)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x0, Math.round(yy) + .5); ctx.lineTo(x0 + plotW, Math.round(yy) + .5); ctx.stroke();
      }
      ctx.fillStyle = tickY.color || '#888'; ctx.textAlign = 'left';
      ctx.fillText(fmt(v), x0 + plotW + 8, yy);
    }

    // الأعمدة
    const nG = Math.max(1, L.labels.length), nS = Math.max(1, L.sets.length);
    const gw = plotW / nG, inner = gw * 0.72;
    let bw = inner / nS;
    const maxT = Math.min.apply(null, L.sets.map(s => s.maxBarThickness || 999).concat([999]));
    if (bw > maxT) bw = maxT;
    const groupW = bw * nS;
    const bars = [];
    for (let i = 0; i < nG; i++){
      const rev = L.x.reverse !== false;            // الافتراضي RTL كما في التطبيق
      const gi = rev ? nG - 1 - i : i;
      const gx = x0 + gi * gw + (gw - groupW) / 2;
      L.sets.forEach((s, di) => {
        const val = +((s.data || [])[i]) || 0;
        const h = L.max > 0 ? (val / L.max) * plotH * prog : 0;
        const bx = gx + di * bw + 1, bwid = Math.max(1, bw - 2);
        const col = Array.isArray(s.backgroundColor) ? (s.backgroundColor[i] || s.backgroundColor[0]) : s.backgroundColor;
        ctx.fillStyle = col || '#4b7';
        ctx.globalAlpha = this.hover && (this.hover.i !== i || this.hover.di !== di) ? .55 : 1;
        roundRect(ctx, bx, yB - h, bwid, h, s.borderRadius || 0);
        ctx.globalAlpha = 1;
        bars.push({ x:bx, y:yB - h, w:bwid, h, base:yB, i, di, val, set:s, label:L.labels[i] });
      });
      // تسمية المحور x
      ctx.font = xFont; ctx.fillStyle = tickX.color || '#888'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      let txt = String(L.labels[i] == null ? '' : L.labels[i]);
      const room = gw - 4;
      if (ctx.measureText(txt).width > room){
        while (txt.length > 1 && ctx.measureText(txt + '…').width > room) txt = txt.slice(0, -1);
        txt += '…';
      }
      ctx.fillText(txt, x0 + gi * gw + gw / 2, yB + 8);
    }
    this._bars = bars;

    // خط القاعدة
    ctx.strokeStyle = gridY.color || 'rgba(128,128,128,.25)';
    ctx.beginPath(); ctx.moveTo(x0, Math.round(yB) + .5); ctx.lineTo(x0 + plotW, Math.round(yB) + .5); ctx.stroke();

    // التلميح
    if (this.hover){
      const tp = ((L.o.plugins || {}).tooltip || {}), cb = (tp.callbacks || {}).label;
      const b = this.hover;
      const line = cb ? cb({ parsed:{ y:b.val, x:b.i }, raw:b.val, dataset:b.set, label:b.label, dataIndex:b.i, datasetIndex:b.di }) : String(b.val);
      const title = String(b.label == null ? '' : b.label);
      ctx.font = fontStr({ size:12, family:(tickX.font || {}).family }, 12);
      const tw = Math.max(ctx.measureText(title).width, ctx.measureText(line).width) + 20;
      const th = title ? 42 : 26;
      let tx = Math.min(Math.max(b.x + b.w / 2 - tw / 2, 4), W - tw - 4);
      let ty = Math.max(4, b.y - th - 8);
      ctx.fillStyle = 'rgba(17,24,39,.92)'; roundRect(ctx, tx, ty, tw, th, 8);
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      if (title) ctx.fillText(title, tx + tw / 2, ty + 7);
      ctx.fillText(line, tx + tw / 2, ty + (title ? 24 : 7));
    }
  }
}
Chart.version = 'mini-1.0';
global.Chart = Chart;
})(typeof window !== 'undefined' ? window : this);
