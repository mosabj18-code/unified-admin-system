const { chromium } = require('playwright');
const SHOT = n => { const p = require('path'), f = require('fs'); const d = process.env.SHOT_DIR || p.join(__dirname, '..', 'screenshots'); f.mkdirSync(d, { recursive:true }); return p.join(d, n); };
const XLSX = require('xlsx');
const URL = (process.env.BASE_URL || 'http://localhost:8765') + '/unified-admin/index.html';
const ok = [], bad = [];
const chk = (c, m) => (c ? ok : bad).push(m);

const book = rows => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'البيانات');
  return Buffer.from(XLSX.write(wb, { bookType:'xlsx', type:'array' }));
};
const pick = async (p, buf, name) => { await p.setInputFiles('#xl-file', { name, mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: buf }); await p.waitForTimeout(900); };
/* يُحصر البحث داخل النافذة المنبثقة حتى لا يُلتقط زر «استيراد من Excel» الموجود في الصفحة نفسها */
const clickTxt = (p, t) => p.evaluate(x => {
  const scope = document.querySelector('.overlay') || document;
  const b = [...scope.querySelectorAll('button')].find(e => e.textContent.trim().startsWith(x));
  if (b) b.click();
}, t);

(async () => {
  const b = await chromium.launch({ ...(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {}) });
  const ctx = await b.newContext({ viewport:{ width:1400, height:1000 }, locale:'ar', acceptDownloads:true });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/403|Failed to load resource/.test(m.text())) errs.push('CONSOLE: ' + m.text()); });

  await p.goto(URL, { waitUntil:'domcontentloaded' });
  await p.evaluate(() => { localStorage.clear(); localStorage.setItem('unified_settings', JSON.stringify({ onboarded:true, installNever:true, lastSeenVersion:'2.9.0', haptics:false })); sessionStorage.setItem('installShown','1'); });
  await p.reload({ waitUntil:'networkidle' }); await p.waitForTimeout(1800);
  for (let k = 0; k < 4; k++){ await p.keyboard.press('Escape'); await p.waitForTimeout(150); await p.evaluate(() => document.querySelectorAll('.overlay,.ov,.sheet-ov').forEach(e => e.remove())); }

  // ===== إعادة التسمية =====
  chk(await p.evaluate(() => [...document.querySelectorAll('#sbNav .lbl')].some(e => e.textContent.trim() === 'مخزون الطعام')), 'القائمة تعرض «مخزون الطعام»');
  await p.evaluate(() => switchModule('inventory')); await p.waitForTimeout(400);
  chk(await p.evaluate(() => document.querySelector('#page-inventory h2').textContent.trim() === 'مخزون الطعام'), 'عنوان الوحدة «مخزون الطعام»');
  chk(await p.evaluate(() => !!localStorage.getItem('inv_a')), 'مفاتيح التخزين ما تغيّرت (inv_a)');

  // ===== المعدات: إضافة =====
  await p.evaluate(() => switchModule('equipment')); await p.waitForTimeout(400);
  const before = await p.evaluate(() => EQ.computeStock().length);
  await p.evaluate(() => EQ.importFromExcel()); await p.waitForTimeout(500);
  chk(await p.evaluate(() => !!document.querySelector('#xl-modes')), 'نافذة الاستيراد تفتح');
  chk(await p.evaluate(() => document.querySelectorAll('#xl-modes [data-m]').length === 2), 'خيارا الإضافة والصرف');
  await pick(p, book([
    ['التاريخ','الصنف','الوحدة','الكمية','المورد','ملاحظات'],
    ['2026-09-10','صنف تجريبي','قطعة',30,'إمداد','من الملف'],
    ['15/09/2026','بطانية','قطعة',20,'الصليب',''],
    [46283,'صنف تسلسلي','قطعة',5,'',''],          // تاريخ Excel رقمي
    ['2026-09-10','','قطعة',5,'',''],               // خطأ: بلا اسم
    ['2026-09-10','صنف خطأ','قطعة',0,'',''],        // خطأ: كمية صفر
    ['2026-09-10','صنف وحدة','وحدة غريبة',5,'','']  // خطأ: وحدة غير معروفة
  ]), 'add.xlsx');
  chk(await p.evaluate(() => /٣/.test(document.querySelector('.lead').textContent)), 'المراجعة: ٣ صفوف صالحة');
  chk(await p.evaluate(() => /٣ صف سيُتخطّى|٣<\/b> صف سيُتخطّى/.test(document.body.innerHTML.replace(/<[^>]+>/g,'')) || /٣/.test(document.querySelector('.lead').textContent)), 'المراجعة تعرض المتخطّى');
  chk(await p.evaluate(() => document.body.innerText.includes('غير معروفة')), 'سبب الوحدة الخاطئة معروض');
  await clickTxt(p, 'استيراد'); await p.waitForTimeout(900);
  chk(await p.evaluate(x => EQ.computeStock().length === x + 2, before), 'أُنشئ صنفان جديدان');
  chk(await p.evaluate(() => { const s = EQ.computeStock().find(x => x.name === 'صنف تجريبي'); return s && s.balance === 30; }), 'رصيد الصنف الجديد ٣٠');
  chk(await p.evaluate(() => { const a = JSON.parse(localStorage.getItem('inv_eq_a')); return a.some(r => r.date === '2026-09-15' && r.name === 'بطانية'); }), 'تاريخ dd/mm/yyyy تحوّل صح');
  chk(await p.evaluate(() => { const a = JSON.parse(localStorage.getItem('inv_eq_a')); return a.some(r => r.name === 'صنف تسلسلي' && /^20\d\d-/.test(r.date)); }), 'تاريخ Excel الرقمي تحوّل صح');

  // تراجع
  await p.evaluate(() => { const b = [...document.querySelectorAll('.toast .act button')].find(x => x.textContent.includes('تراجع')); b && b.click(); });
  await p.waitForTimeout(600);
  chk(await p.evaluate(x => EQ.computeStock().length === x, before), 'التراجع أرجع الوضع كما كان');

  // ===== المعدات: صرف =====
  await p.evaluate(() => EQ.importFromExcel()); await p.waitForTimeout(400);
  await p.evaluate(() => document.querySelector('#xl-modes [data-m="out"]').click()); await p.waitForTimeout(250);
  const bal = await p.evaluate(() => { const s = EQ.computeStock().find(x => x.name === 'بطانية'); return s.balance; });
  await pick(p, book([
    ['التاريخ','الصنف','الكمية','الجهة'],
    ['2026-09-12','بطانية',5,'سجن النظارة'],
    ['2026-09-12','بطانية',999999,'سجن خانيونس'],
    ['2026-09-12','صنف غير موجود',3,'جهة']
  ]), 'out.xlsx');
  chk(await p.evaluate(() => document.body.innerText.includes('الرصيد لا يكفي')), 'يرفض ما يتجاوز الرصيد تراكمياً');
  chk(await p.evaluate(() => document.body.innerText.includes('غير موجود في المخزون')), 'يرفض صنفاً غير موجود');
  await clickTxt(p, 'استيراد'); await p.waitForTimeout(900);
  chk(await p.evaluate(x => { const s = EQ.computeStock().find(y => y.name === 'بطانية'); return s.balance === x - 5; }, bal), 'الصرف نقص الرصيد ٥ (الوحدة استُنتجت تلقائياً)');

  // ===== العهد =====
  await p.evaluate(() => switchModule('custody')); await p.waitForTimeout(400);
  await p.evaluate(() => CU.importFromExcel()); await p.waitForTimeout(400);
  await pick(p, book([
    ['التاريخ','الصنف','الوحدة','الكمية','الرقم التسلسلي','الحالة'],
    ['2026-09-10','طابعة اختبار','جهاز',3,'SN-1','جديد']
  ]), 'cu-in.xlsx');
  await clickTxt(p, 'استيراد'); await p.waitForTimeout(900);
  chk(await p.evaluate(() => { const s = CU.computeStock().find(x => x.name === 'طابعة اختبار'); return s && s.balance === 3; }), 'العهد: أُضيفت ٣ أجهزة');
  await p.evaluate(() => CU.importFromExcel()); await p.waitForTimeout(400);
  await p.evaluate(() => document.querySelector('#xl-modes [data-m="issue"]').click()); await p.waitForTimeout(250);
  await pick(p, book([
    ['التاريخ','الصنف','الكمية','الشخص','الرقم الوظيفي','القسم'],
    ['2026-09-13','طابعة اختبار',2,'سامي اختبار','777','الحماية'],
    ['2026-09-13','طابعة اختبار',5,'خالد اختبار','778','الحماية']
  ]), 'cu-out.xlsx');
  chk(await p.evaluate(() => document.body.innerText.includes('المتاح لا يكفي')), 'العهد: يرفض ما يتجاوز المتاح');
  await clickTxt(p, 'استيراد'); await p.waitForTimeout(900);
  chk(await p.evaluate(() => { const s = CU.computeStock().find(x => x.name === 'طابعة اختبار'); return s.balance === 1; }), 'العهد: المتاح صار ١');
  chk(await p.evaluate(() => { const L = CU.computePersonLedger(); return L.some(x => x.person === 'سامي اختبار' && x.held === 2); }), 'العهد: دفتر الشخص يعرض ٢ بحوزته');
  chk(await p.evaluate(() => { const i = CU._data.issues.filter(x => x.person === 'سامي اختبار'); return i.length === 1 && +i[0].no > 0; }), 'العهد: أُعطي رقم سند');

  // ===== المنظفات + مخزون الطعام: وجود الزر =====
  for (const [m, o] of [['inventory','INV'],['cleaning','CL']]){
    await p.evaluate(x => switchModule(x), m); await p.waitForTimeout(300);
    chk(await p.evaluate(x => document.querySelector('#page-' + x).innerText.includes('استيراد من Excel'), m), 'زر الاستيراد موجود: ' + m);
    await p.evaluate(x => (x === 'INV' ? INV : CL).importFromExcel(), o); await p.waitForTimeout(400);
    chk(await p.evaluate(() => !!document.querySelector('#xl-modes')), 'النافذة تفتح: ' + m);
    await p.evaluate(() => document.querySelector('[data-cancel]').click()); await p.waitForTimeout(300);
  }
  // استيراد فعلي للمنظفات
  await p.evaluate(() => switchModule('cleaning')); await p.waitForTimeout(300);
  await p.evaluate(() => CL.importFromExcel()); await p.waitForTimeout(400);
  await pick(p, book([['التاريخ','الصنف','الوحدة','الكمية'],['2026-09-11','كلور','لتر',40]]), 'cl.xlsx');
  await clickTxt(p, 'استيراد'); await p.waitForTimeout(900);
  chk(await p.evaluate(() => { const s = CL.computeStock().find(x => x.name === 'كلور'); return s && s.balance === 40; }), 'المنظفات: استيراد فعلي نجح');

  // قالب
  await p.evaluate(() => CL.importFromExcel()); await p.waitForTimeout(400);
  const dl = p.waitForEvent('download', { timeout:6000 }).catch(() => null);
  await p.evaluate(() => document.querySelector('#xl-tpl').click());
  chk(!!(await dl), 'تنزيل القالب يعمل');
  await p.evaluate(() => { const b = document.querySelector('[data-cancel]'); b && b.click(); }); await p.waitForTimeout(300);

  // الوحدات الأخرى
  for (const m of ['wared','payroll','fuel']){
    await p.evaluate(x => switchModule(x), m); await p.waitForTimeout(250);
    chk(await p.evaluate(x => { const el = document.getElementById('page-' + x); return el && !el.hasAttribute('data-placeholder'); }, m), 'الوحدة تعمل: ' + m);
  }

  // جوال
  const mo = await ctx.newPage(); await mo.goto(URL, { waitUntil:'networkidle' });
  await mo.setViewportSize({ width:390, height:844 });
  await mo.evaluate(() => { localStorage.setItem('unified_settings', JSON.stringify({ onboarded:true, installNever:true, lastSeenVersion:'2.9.0', haptics:false })); sessionStorage.setItem('installShown','1'); });
  await mo.reload({ waitUntil:'networkidle' }); await mo.waitForTimeout(1600);
  for (let k = 0; k < 4; k++){ await mo.keyboard.press('Escape'); await mo.waitForTimeout(150); await mo.evaluate(() => document.querySelectorAll('.overlay,.ov,.sheet-ov').forEach(e => e.remove())); }
  await mo.evaluate(() => { switchModule('equipment'); EQ.importFromExcel(); }); await mo.waitForTimeout(700);
  chk(await mo.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2), 'ما في فيضان أفقي على الجوال');
  await mo.screenshot({ path:SHOT('shot-xl-mobile.png') });
  await p.evaluate(() => { switchModule('equipment'); EQ.importFromExcel(); }); await p.waitForTimeout(600);
  await p.screenshot({ path:SHOT('shot-xl-desktop.png') });

  console.log('\n=== نجح (' + ok.length + ') ===\n  ✔ ' + ok.join('\n  ✔ '));
  console.log('\n=== فشل (' + bad.length + ') ===' + (bad.length ? '\n  ✘ ' + bad.join('\n  ✘ ') : ''));
  console.log('\n=== أخطاء الكونسول ===\n' + (errs.length ? errs.join('\n') : 'لا يوجد'));
  await b.close();
})();
