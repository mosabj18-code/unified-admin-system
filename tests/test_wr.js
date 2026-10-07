const { chromium } = require('playwright');
const SHOT = n => { const p = require('path'), f = require('fs'); const d = process.env.SHOT_DIR || p.join(__dirname, '..', 'screenshots'); f.mkdirSync(d, { recursive:true }); return p.join(d, n); };
const URL = (process.env.BASE_URL || 'http://localhost:8765') + '/unified-admin/index.html';
const ok = [], bad = [];
const chk = (c, m) => (c ? ok : bad).push(m);

// صورة png صغيرة كـ dataURL
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC';

(async () => {
  const b = await chromium.launch({ ...(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {}) });
  const ctx = await b.newContext({ viewport:{ width:1400, height:1000 }, locale:'ar' });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/403|Failed to load resource/.test(m.text())) errs.push('CONSOLE: ' + m.text()); });
  ctx.on('page', pg => pg.on('pageerror', e => errs.push('PRINT-PAGEERROR: ' + e.message)));

  await p.goto(URL, { waitUntil:'domcontentloaded' });
  await p.evaluate(() => { localStorage.clear(); localStorage.setItem('unified_settings', JSON.stringify({ onboarded:true, installNever:true, lastSeenVersion:'2.7.1', haptics:false })); sessionStorage.setItem('installShown','1'); });
  await p.reload({ waitUntil:'networkidle' });
  await p.waitForTimeout(1500);
  for (let k = 0; k < 4; k++){ await p.keyboard.press('Escape'); await p.waitForTimeout(150); await p.evaluate(() => document.querySelectorAll('.overlay,.ov,.sheet-ov').forEach(e => e.remove())); }

  await p.evaluate(() => switchModule('wared'));
  await p.waitForTimeout(400);
  chk(await p.evaluate(() => !!document.querySelector('#wr-chk-all')), 'مربع تحديد الكل موجود في الرأس');

  // --- إنشاء سجلات مباشرة (مرفقات متعددة)
  await p.evaluate(P => {
    const recs = [
      { id:'a1', serial:'و-2026-1', date:'2026-09-10', type:'وارد', entity:'وزارة الداخلية', ref:'2026/1', status:'قيد المعالجة', subject:'تعميم إداري', notes:'', attachments:[{name:'ص1.png',type:'image/png',data:P},{name:'ص2.png',type:'image/png',data:P},{name:'ملف.pdf',type:'application/pdf',data:'data:application/pdf;base64,JVBERi0='}] },
      { id:'a2', serial:'و-2026-2', date:'2026-09-11', type:'وارد', entity:'البلدية', ref:'2026/2', status:'قيد المعالجة', subject:'طلب بيانات', notes:'', attachment:{name:'قديم.png',type:'image/png',data:P} },
      { id:'a3', serial:'ص-2026-1', date:'2026-09-12', type:'صادر', entity:'الإمداد', ref:'', status:'منجز', subject:'رد على الطلب', notes:'' }
    ];
    localStorage.setItem('wared_sader_records_v1', JSON.stringify(recs));
    WR._records().length = 0; recs.forEach(r => WR._records().push(r)); WR.render();
  }, PNG);
  await p.waitForTimeout(300);

  // 1) مرفقات متعددة
  chk(await p.evaluate(() => WR._atts(WR._records()[0]).length === 3), 'ثلاثة مرفقات على الكتاب الأول');
  chk(await p.evaluate(() => WR._atts(WR._records()[1]).length === 1), 'التوافق مع الصيغة القديمة (attachment مفرد)');
  chk(await p.evaluate(() => !!document.querySelector('#wr-body .attmore')), 'شارة +٢ ظاهرة بعمود المرفقات');
  await p.click('#wr-body .attmore'); await p.waitForTimeout(400);
  chk(await p.evaluate(() => document.querySelectorAll('.wr-thumbs [data-i]').length === 3), 'عارض المرفقات فيه ٣ مصغّرات');
  chk(await p.evaluate(() => /٢ من ٣/.test(document.querySelector('#wr-v-name').textContent)), 'فتح على المرفق الثاني');
  await p.click('.wr-thumbs [data-i="2"]'); await p.waitForTimeout(250);
  chk(await p.evaluate(() => /pdf/i.test(document.querySelector('#wr-v-name').textContent) && !!document.querySelector('#wr-v-main .info-box')), 'التنقّل لمرفق PDF يعرض رسالة بدل الصورة');
  await p.evaluate(() => document.querySelector('[data-x]').click()); await p.waitForTimeout(300);

  // إضافة مرفقين من النموذج
  await p.evaluate(() => WR.openForm('وارد')); await p.waitForTimeout(400);
  await p.fill('#wr-e-entity', 'جهة اختبار'); await p.fill('#wr-e-subject', 'كتاب بمرفقين');
  await p.setInputFiles('[data-file]', [
    { name:'م1.png', mimeType:'image/png', buffer: Buffer.from(PNG.split(',')[1], 'base64') },
    { name:'م2.png', mimeType:'image/png', buffer: Buffer.from(PNG.split(',')[1], 'base64') }
  ]);
  await p.waitForTimeout(900);
  chk(await p.evaluate(() => document.querySelectorAll('#wr-e-att [data-rm]').length === 2), 'رفع ملفين دفعة واحدة');
  await p.evaluate(() => document.querySelector('[data-rm="0"]').click()); await p.waitForTimeout(250);
  chk(await p.evaluate(() => document.querySelectorAll('#wr-e-att [data-rm]').length === 1), 'إزالة مرفق واحد فقط تشتغل');
  await p.evaluate(() => document.querySelector('[data-save]').click()); await p.waitForTimeout(600);
  chk(await p.evaluate(() => { const r = WR._records().find(x => x.entity === 'جهة اختبار'); return r && WR._atts(r).length === 1 && !!r.attachments[0].key && !r.attachment; }), 'الحفظ يخزّن الملف بالمخزن لا داخل السجل');

  // 2) التحديد والطباعة
  await p.evaluate(() => { WR.toggleSel('a1', true); WR.toggleSel('a3', true); });
  await p.waitForTimeout(300);
  chk(await p.evaluate(() => /٢/.test(document.querySelector('#wr-selbar .selbar b').textContent)), 'شريط التحديد يعرض ٢');
  const pop = [];
  ctx.on('page', pg => pop.push(pg));
  await p.evaluate(() => WR.printSelected()); await p.waitForTimeout(900);
  let pg = pop[pop.length-1];
  let html = pg ? await pg.content() : '';
  chk(/سجلات مختارة/.test(html), 'كشف المحدد يذكر النطاق');
  chk((html.match(/<tr><td>/g) || []).length === 2, 'الكشف فيه صفّان فقط (المحدد)');
  await pg.close();
  await p.evaluate(() => WR.printBooks()); await p.waitForTimeout(900);
  pg = pop[pop.length-1]; html = pg ? await pg.content() : '';
  chk((html.match(/class="bk"/g) || []).length === 1, 'طباعة الكتب: صفحة واحدة (a3 بلا صور تُتخطّى)');
  chk((html.match(/<figure/g) || []).length === 2, 'الصفحة فيها صورتا المرفقات');
  chk(/و-2026-1/.test(html) && /تعميم إداري/.test(html), 'بيانات الكتاب مطبوعة');
  await pg.close();
  await p.evaluate(() => WR.toggleAll(true)); await p.waitForTimeout(300);
  chk(await p.evaluate(() => document.querySelectorAll('#wr-body .wr-chk:checked').length === document.querySelectorAll('#wr-body .wr-chk').length), 'تحديد الكل يشتغل');
  await p.evaluate(() => WR.clearSel()); await p.waitForTimeout(250);
  chk(await p.evaluate(() => !document.querySelector('#wr-selbar .selbar')), 'إلغاء التحديد يخفي الشريط');

  // 3) تغيير النوع بالتعديل
  await p.evaluate(() => WR.editRecord('a2')); await p.waitForTimeout(400);
  chk(await p.evaluate(() => !document.querySelector('#wr-e-type button[data-val="صادر"]').disabled), 'زر النوع غير معطّل بالتعديل');
  await p.click('#wr-e-type button[data-val="صادر"]');
  p.evaluate(() => { document.querySelector('[data-save]').click(); });
  await p.waitForTimeout(700);
  chk(await p.evaluate(() => [...document.querySelectorAll('button')].some(x => x.textContent.trim() === 'تحويل النوع')), 'يطلب تأكيد تحويل النوع');
  await p.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'تحويل النوع'); b && b.click(); });
  await p.waitForTimeout(800);
  chk(await p.evaluate(() => { const r = WR._records().find(x => x.id === 'a2'); return r.type === 'صادر' && /^ص-2026-/.test(r.serial); }), 'تحوّل لصادر برقم تسلسل صادر');
  chk(await p.evaluate(() => WR._records().find(x => x.id === 'a2').serial !== 'ص-2026-1'), 'الرقم الجديد لا يصطدم برقم موجود');
  chk(await p.evaluate(() => WR._atts(WR._records().find(x => x.id === 'a2')).length === 1), 'المرفق محفوظ بعد تحويل النوع');

  // الختم على كل الصور
  p.evaluate(() => { WR.markComplete('a1'); });
  await p.waitForTimeout(600);
  await p.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'تأكيد الإنجاز'); b && b.click(); });
  await p.waitForTimeout(1500);
  chk(await p.evaluate(() => { const r = WR._records()[0]; const a = WR._atts(r); return r.status === 'منجز' && a.length === 3 && a.every(x => x.key) && a[2].type === 'application/pdf'; }), 'الإنجاز خَتَم الصور وأبقى الـPDF');

  // الوحدات الأخرى
  for (const m of ['equipment','payroll','fuel','inventory','cleaning','custody']){
    await p.evaluate(x => switchModule(x), m); await p.waitForTimeout(250);
    chk(await p.evaluate(x => { const el = document.getElementById('page-' + x); return el && !el.hasAttribute('data-placeholder'); }, m), 'الوحدة تعمل: ' + m);
  }

  // جوال
  await p.evaluate(() => switchModule('wared'));
  const m = await ctx.newPage(); await m.goto(URL, { waitUntil:'networkidle' });
  await m.setViewportSize({ width:390, height:844 });
  await m.evaluate(() => { localStorage.setItem('unified_settings', JSON.stringify({ onboarded:true, installNever:true, lastSeenVersion:'2.7.1', haptics:false })); sessionStorage.setItem('installShown','1'); });
  await m.reload({ waitUntil:'networkidle' }); await m.waitForTimeout(1500);
  for (let k = 0; k < 4; k++){ await m.keyboard.press('Escape'); await m.waitForTimeout(150); await m.evaluate(() => document.querySelectorAll('.overlay,.ov,.sheet-ov').forEach(e => e.remove())); }
  await m.evaluate(() => { switchModule('wared'); WR.toggleSel('a1', true); });
  await m.waitForTimeout(600);
  chk(await m.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2), 'ما في فيضان أفقي على الجوال');
  await m.screenshot({ path:SHOT('shot-wr-mobile.png'), fullPage:false });
  await p.screenshot({ path:SHOT('shot-wr-desktop.png'), fullPage:false });

  console.log('\n=== نجح (' + ok.length + ') ===\n  ✔ ' + ok.join('\n  ✔ '));
  console.log('\n=== فشل (' + bad.length + ') ===' + (bad.length ? '\n  ✘ ' + bad.join('\n  ✘ ') : ''));
  console.log('\n=== أخطاء الكونسول ===\n' + (errs.length ? errs.join('\n') : 'لا يوجد'));
  await b.close();
})();
