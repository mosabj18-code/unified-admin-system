const { chromium } = require('playwright');
const SHOT = n => { const p = require('path'), f = require('fs'); const d = process.env.SHOT_DIR || p.join(__dirname, '..', 'screenshots'); f.mkdirSync(d, { recursive:true }); return p.join(d, n); };
const URL = (process.env.BASE_URL || 'http://localhost:8765') + '/unified-admin/index.html';
const ok = [], bad = [];
const chk = (c, m) => (c ? ok : bad).push(m);
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC';

(async () => {
  const b = await chromium.launch({ ...(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {}) });
  const ctx = await b.newContext({ viewport:{ width:1400, height:1000 }, locale:'ar', acceptDownloads:true });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/403|Failed to load resource/.test(m.text())) errs.push('CONSOLE: ' + m.text()); });

  const boot = async (pg) => {
    await pg.evaluate(() => { localStorage.setItem('unified_settings', JSON.stringify({ onboarded:true, installNever:true, lastSeenVersion:'2.8.0', haptics:false })); sessionStorage.setItem('installShown','1'); });
    await pg.reload({ waitUntil:'networkidle' }); await pg.waitForTimeout(1800);
    for (let k = 0; k < 4; k++){ await pg.keyboard.press('Escape'); await pg.waitForTimeout(150); await pg.evaluate(() => document.querySelectorAll('.overlay,.ov,.sheet-ov').forEach(e => e.remove())); }
  };

  // --- بيانات قديمة بمرفقات base64 داخل localStorage
  await p.goto(URL, { waitUntil:'domcontentloaded' });
  await p.evaluate(P => {
    localStorage.clear();
    localStorage.setItem('wared_sader_records_v1', JSON.stringify([
      { id:'a1', serial:'و-2026-1', date:'2026-09-10', type:'وارد', entity:'الداخلية', ref:'1', status:'قيد المعالجة', subject:'تعميم', notes:'',
        attachments:[{name:'ص1.png',type:'image/png',data:P},{name:'ص2.png',type:'image/png',data:P}] },
      { id:'a2', serial:'و-2026-2', date:'2026-09-11', type:'وارد', entity:'البلدية', ref:'2', status:'قيد المعالجة', subject:'طلب', notes:'',
        attachment:{name:'قديم.png',type:'image/png',data:P} }
    ]));
  }, PNG);
  const before = await p.evaluate(() => localStorage.getItem('wared_sader_records_v1').length);
  await boot(p);
  await p.evaluate(() => switchModule('wared'));
  await p.waitForTimeout(2000);

  const after = await p.evaluate(() => localStorage.getItem('wared_sader_records_v1').length);
  chk(after < before && after > 0, `الترحيل صغّر الـlocalStorage (${before} ← ${after} حرف)`);
  chk(!(await p.evaluate(() => /base64/.test(localStorage.getItem('wared_sader_records_v1')))), 'ما بقي أي base64 في localStorage');
  chk(await p.evaluate(() => WR._records().every(r => !r.attachment && !r.image && r.attachments.every(a => a.key && a.size > 0))), 'السجلات تحمل بيانات وصفية فقط');
  chk(await p.evaluate(async () => (await WR._stats()).count === 3), 'ثلاثة مرفقات في المخزن');
  chk(await p.evaluate(() => [...document.querySelectorAll('#wr-body .thumb')].every(el => (el.src || '').startsWith('blob:'))), 'المصغّرات تُحمَّل من المخزن (blob:)');

  // العارض
  await p.click('#wr-body .attmore'); await p.waitForTimeout(700);
  chk(await p.evaluate(() => { const i = document.querySelector('#wr-v-main img'); return i && i.src.startsWith('blob:'); }), 'العارض يعرض الصورة من المخزن');
  chk(await p.evaluate(() => [...document.querySelectorAll('.wr-thumbs img')].every(el => (el.src||'').startsWith('blob:'))), 'مصغّرات العارض محمّلة');
  await p.evaluate(() => document.querySelector('[data-x]').click()); await p.waitForTimeout(300);

  // إضافة سجل جديد بمرفق
  await p.evaluate(() => WR.openForm('صادر')); await p.waitForTimeout(400);
  await p.fill('#wr-e-entity', 'جهة جديدة'); await p.fill('#wr-e-subject', 'كتاب جديد');
  await p.setInputFiles('[data-file]', [{ name:'ج.png', mimeType:'image/png', buffer: Buffer.from(PNG.split(',')[1], 'base64') }]);
  await p.waitForTimeout(900);
  chk(await p.evaluate(() => { const i = document.querySelector('#wr-e-att img[data-p]'); return i && i.src.startsWith('blob:'); }), 'معاينة المرفق الجديد قبل الحفظ');
  await p.evaluate(() => document.querySelector('[data-save]').click()); await p.waitForTimeout(1200);
  chk(await p.evaluate(async () => { const r = WR._records().find(x => x.entity === 'جهة جديدة'); return r && r.attachments.length === 1 && r.attachments[0].key && !r.attachments[0].data; }), 'الحفظ يخزّن الملف بالمخزن والمفتاح بالسجل');
  chk(await p.evaluate(async () => (await WR._stats()).count === 4), 'أربعة مرفقات بالمخزن');

  // الختم على كل الصور
  p.evaluate(() => { WR.markComplete('a1'); }); await p.waitForTimeout(700);
  await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find(e => e.textContent.trim() === 'تأكيد الإنجاز'); x && x.click(); });
  await p.waitForTimeout(2000);
  chk(await p.evaluate(() => { const r = WR._records().find(x => x.id === 'a1'); return r.status === 'منجز' && r.attachments.length === 2 && r.attachments.every(a => a.key); }), 'الختم يكتب نسخاً جديدة بالمخزن');

  // النسخة الاحتياطية تشمل المرفقات
  const dl = p.waitForEvent('download');
  await p.evaluate(() => exportBackup());
  const file = await dl; const path = await file.path();
  const fs = require('fs'); const backup = JSON.parse(fs.readFileSync(path, 'utf8'));
  chk(!!(backup.blobs && backup.blobs.wared && Object.keys(backup.blobs.wared.atts).length === 4), 'النسخة الاحتياطية فيها الأربع مرفقات');
  chk(backup.modules.wared['wared_sader_records_v1'].length < 2000, 'قسم السجلات بالنسخة صغير (بلا base64)');

  // الاستعادة على جهاز فاضي
  const p2 = await ctx.newPage();
  p2.on('pageerror', e => errs.push('PAGEERROR2: ' + e.message));
  await p2.goto(URL, { waitUntil:'domcontentloaded' });
  await p2.evaluate(async () => { localStorage.clear(); await new Promise(r => { const q = indexedDB.deleteDatabase('fsdb_wared_atts'); q.onsuccess = q.onerror = q.onblocked = r; }); });
  await boot(p2);
  await p2.evaluate(async data => { await applyRestore(data); }, backup);
  await p2.waitForTimeout(2500);
  await p2.waitForLoadState('networkidle'); await p2.waitForTimeout(1500);
  for (let k = 0; k < 4; k++){ await p2.keyboard.press('Escape'); await p2.waitForTimeout(150); await p2.evaluate(() => document.querySelectorAll('.overlay,.ov,.sheet-ov').forEach(e => e.remove())); }
  await p2.evaluate(() => switchModule('wared')); await p2.waitForTimeout(1500);
  chk(await p2.evaluate(async () => (await WR._stats()).count === 4), 'الاستعادة رجّعت المرفقات الأربعة');
  chk(await p2.evaluate(() => [...document.querySelectorAll('#wr-body .thumb')].every(el => (el.src||'').startsWith('blob:'))), 'المرفقات المستعادة تُعرض فعلاً');

  // التنظيف بعد الحذف
  await p.evaluate(() => { const r = WR._records().find(x => x.entity === 'جهة جديدة'); WR._records().splice(WR._records().indexOf(r), 1); });
  await p.evaluate(() => WR._gc()); await p.waitForTimeout(600);
  chk(await p.evaluate(async () => (await WR._stats()).count === 3), 'التنظيف يحذف ملفات السجلات المحذوفة');

  // واجهة الإعدادات
  await p.evaluate(() => WR.showView('settings')); await p.waitForTimeout(700);
  chk(await p.evaluate(() => /مرفق/.test(document.querySelector('#wr-att-status').textContent)), 'بطاقة تخزين المرفقات تعرض الحالة');

  // الوحدات الأخرى
  for (const m of ['equipment','payroll','fuel','inventory','cleaning','custody']){
    await p.evaluate(x => switchModule(x), m); await p.waitForTimeout(250);
    chk(await p.evaluate(x => { const el = document.getElementById('page-' + x); return el && !el.hasAttribute('data-placeholder'); }, m), 'الوحدة تعمل: ' + m);
  }
  await p.evaluate(() => switchModule('wared')); await p.waitForTimeout(500);
  await p.screenshot({ path:SHOT('shot-store-desktop.png') });
  const m = await ctx.newPage(); await m.goto(URL, { waitUntil:'networkidle' });
  await m.setViewportSize({ width:390, height:844 }); await boot(m);
  await m.evaluate(() => { switchModule('wared'); WR.showView('settings'); }); await m.waitForTimeout(900);
  chk(await m.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2), 'ما في فيضان أفقي على الجوال');
  await m.screenshot({ path:SHOT('shot-store-mobile.png') });

  console.log('\n=== نجح (' + ok.length + ') ===\n  ✔ ' + ok.join('\n  ✔ '));
  console.log('\n=== فشل (' + bad.length + ') ===' + (bad.length ? '\n  ✘ ' + bad.join('\n  ✘ ') : ''));
  console.log('\n=== أخطاء الكونسول ===\n' + (errs.length ? errs.join('\n') : 'لا يوجد'));
  await b.close();
})();
