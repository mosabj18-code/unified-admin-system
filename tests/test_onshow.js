// فتح أي وحدة يستدعي onShow فعلاً (الوحدات معرّفة بـ const فلا تظهر على window) ولا يترك أخطاء
const { chromium } = require('playwright');
const URL = (process.env.BASE_URL || 'http://localhost:8765') + '/unified-admin/index.html';
let pass = 0, fail = [];
const ok = (c, m) => { if (c) pass++; else fail.push(m); console.log((c ? '  ✔ ' : '  ✘ ') + m); };
(async () => {
const b = await chromium.launch({ ...(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {}) });
const p = await (await b.newContext({ viewport:{ width:1280, height:860 } })).newPage(); const errs = [];
p.on('console', m => { if (m.type() === 'error' && !/403|favicon|Failed to load resource/.test(m.text())) errs.push(m.text()); });
p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
await p.goto(URL); await p.waitForTimeout(800);
await p.evaluate(() => { localStorage.setItem('unified_settings', JSON.stringify({ onboarded:true, installNever:true, lastSeenVersion:'9.9.9', haptics:false })); sessionStorage.setItem('installShown', '1'); });
await p.reload(); await p.waitForTimeout(1500);
await p.evaluate(() => document.querySelectorAll('.overlay').forEach(e => e.remove()));

const MODS = { equipment:'EQ', payroll:'PR', wared:'WR', fuel:'FU', inventory:'INV', cleaning:'CL', custody:'CU', vehicles:'VH' };
// عدّاد لكل onShow
await p.evaluate(mods => {
  window.__shown = {};
  for (const [page, obj] of Object.entries(mods)){ const o = eval(obj); const orig = o.onShow; o.onShow = (...a) => { window.__shown[page] = (window.__shown[page] || 0) + 1; return orig(...a); }; }
}, MODS);
for (const page of Object.keys(MODS)){
  await p.evaluate(id => App.switchModule('home'), page); await p.waitForTimeout(80);
  await p.evaluate(id => App.switchModule(id), page); await p.waitForTimeout(250);
  ok(await p.evaluate(id => (window.__shown[id] || 0) >= 1, page), `فتح «${page}» يستدعي ${MODS[page]}.onShow`);
}

// المخطط يُرسم عند فتح وحدة مخزنية وهي على تبويب المخزون (كان يبقى فارغاً قبل الإصلاح)
await p.evaluate(() => { App.switchModule('equipment'); EQ.switchTab('stock'); App.switchModule('home'); });
await p.waitForTimeout(150);
await p.evaluate(() => App.switchModule('equipment')); await p.waitForTimeout(400);
const drawn = await p.evaluate(() => { const c = document.querySelector('#page-equipment canvas'); if (!c || !c.width) return false; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; for (let i = 3; i < d.length; i += 4) if (d[i]) return true; return false; });
ok(drawn, 'مخطط المعدات مرسوم عند فتح الوحدة على تبويب المخزون');

console.log('\n=== نجح (' + pass + ') === فشل (' + fail.length + ') ===');
fail.forEach(f => console.log('  - ' + f));
console.log('\n=== أخطاء الكونسول ===\n' + (errs.length ? errs.join('\n') : 'لا يوجد'));
await b.close();
process.exit(fail.length || errs.length ? 1 : 0);
})();
