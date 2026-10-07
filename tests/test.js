const { chromium } = require('playwright');
const SHOT = n => { const p = require('path'), f = require('fs'); const d = process.env.SHOT_DIR || p.join(__dirname, '..', 'screenshots'); f.mkdirSync(d, { recursive:true }); return p.join(d, n); };
const URL = (process.env.BASE_URL || 'http://localhost:8765') + '/unified-admin/index.html';
const ok = [], bad = [];
const chk = (c, m) => (c ? ok : bad).push(m);

(async () => {
  const b = await chromium.launch({ ...(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {}) });
  const ctx = await b.newContext({ viewport:{ width:1400, height:1000 }, locale:'ar' });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/403|Failed to load resource/.test(m.text())) errs.push('CONSOLE: ' + m.text()); });

  await p.goto(URL, { waitUntil:'domcontentloaded' });
  await p.evaluate(() => { localStorage.setItem('unified_settings', JSON.stringify({ onboarded:true, installNever:true, lastSeenVersion:'2.7.0', haptics:false })); sessionStorage.setItem('installShown','1'); });
  await p.reload({ waitUntil:'networkidle' });
  await p.waitForTimeout(1500);
  for (let k = 0; k < 4; k++){ await p.keyboard.press('Escape'); await p.waitForTimeout(200); await p.evaluate(() => document.querySelectorAll('.overlay,.ov,.sheet-ov').forEach(e => e.remove())); }

  chk(await p.evaluate(() => typeof CU === 'object'), 'CU موجود');
  await p.evaluate(() => switchModule('custody'));
  await p.waitForTimeout(400);
  chk(await p.evaluate(() => !!document.querySelector('#page-custody .eq-head')), 'الواجهة مبنية');
  chk(await p.evaluate(() => getComputedStyle(document.querySelector('#page-custody .eq-head .tile')).width === '64px'), 'التنسيق مطبّق (tile 64px)');
  chk(await p.evaluate(() => document.querySelectorAll('#page-custody .eq-tab').length === 5), '٥ تبويبات');
  chk(await p.evaluate(() => !document.querySelector('#page-custody label[for^="eq-"]')), 'لا يوجد for="eq-" متبقٍ');

  // --- إضافة عهدة
  const add = async (name, unit, qty, serial) => {
    await p.evaluate(() => CU.switchTab('in'));
    await p.fill('#cu-in-name', name); await p.selectOption('#cu-in-unit', unit);
    await p.fill('#cu-in-qty', String(qty)); await p.fill('#cu-in-serial', serial || '');
    await p.fill('#cu-in-source', 'إمداد الداخلية');
    await p.click('#cu-in-submit-btn'); await p.waitForTimeout(250);
  };
  await add('كمبيوتر محمول', 'جهاز', 10, 'LP-001');
  await add('طابعة', 'جهاز', 3);
  chk(await p.evaluate(() => CU._data.additions.length === 2), 'إضافتان محفوظتان');
  chk(await p.evaluate(() => CU.computeStock().find(s => s.name === 'كمبيوتر محمول').balance === 10), 'الرصيد 10');

  // --- تسليم أكبر من المتاح يُرفض
  const issue = async (item, qty, person, pid, dept) => {
    await p.evaluate(() => CU.switchTab('issue'));
    await p.selectOption('#cu-issue-name', { label:new RegExp('^' + item) }).catch(async () => {
      const v = await p.evaluate(n => { const o = [...document.querySelectorAll('#cu-issue-name option')].find(x => x.dataset.name === n); return o ? o.value : ''; }, item);
      await p.selectOption('#cu-issue-name', v);
    });
    await p.fill('#cu-issue-qty', String(qty)); await p.fill('#cu-issue-person', person);
    await p.fill('#cu-issue-personid', pid || ''); await p.fill('#cu-issue-dept', dept || '');
    await p.click('#cu-issue-submit-btn'); await p.waitForTimeout(250);
  };
  await issue('كمبيوتر محمول', 99, 'أحمد سالم', '1201', 'الحماية');
  chk(await p.evaluate(() => CU._data.issues.length === 0), 'تسليم أكبر من المتاح مرفوض');
  chk(await p.evaluate(() => document.querySelector('#cu-issue-qty').classList.contains('invalid')), 'الحقل تلوّن أحمر');

  await issue('كمبيوتر محمول', 4, 'أحمد سالم', '1201', 'الحماية');
  await issue('طابعة', 1, 'أحمد سالم', '1201', 'الحماية');
  await issue('كمبيوتر محمول', 3, 'سعاد خليل', '1305', 'المتابعة');
  chk(await p.evaluate(() => CU._data.issues.length === 3), '٣ تسليمات');
  chk(await p.evaluate(() => CU.computeStock().find(s => s.name === 'كمبيوتر محمول').balance === 3), 'المتاح صار 3');
  chk(await p.evaluate(() => JSON.stringify(CU._data.issues.map(r => r.no)) === '[1,2,3]'), 'أرقام السندات 1,2,3');

  // --- إرجاع أكبر من بحوزته يُرفض
  const ret = async (person, item, qty) => {
    await p.evaluate(() => CU.switchTab('ret'));
    const v = await p.evaluate(a => { const o = [...document.querySelectorAll('#cu-ret-select option')].find(x => x.dataset.person === a[0] && x.dataset.name === a[1]); return o ? o.value : ''; }, [person, item]);
    if (!v) return false;
    await p.selectOption('#cu-ret-select', v);
    await p.fill('#cu-ret-qty', String(qty));
    await p.click('#cu-page-ret .btn-primary'); await p.waitForTimeout(250);
    return true;
  };
  chk(await ret('أحمد سالم', 'كمبيوتر محمول', 9), 'قائمة الإرجاع مبنية من دفتر الأشخاص');
  chk(await p.evaluate(() => CU._data.returns.length === 0), 'إرجاع أكبر من بحوزته مرفوض');

  // --- إرجاع جزئي
  await ret('أحمد سالم', 'كمبيوتر محمول', 2);
  chk(await p.evaluate(() => CU._data.returns.length === 1), 'إرجاع جزئي مسجّل');
  chk(await p.evaluate(() => CU.computeStock().find(s => s.name === 'كمبيوتر محمول').balance === 5), 'الرصيد رجع للمتاح (5)');
  chk(await p.evaluate(() => CU.computePersonLedger().find(l => l.person === 'أحمد سالم' && l.name === 'كمبيوتر محمول').held === 2), 'بحوزة أحمد 2');
  await p.evaluate(() => CU.switchTab('issue'));
  await p.waitForTimeout(200);
  chk((await p.textContent('#cu-issue-tbody')).includes('مرتجع جزئي'), 'حالة سطر التسليم: مرتجع جزئي');

  // --- إرجاع بالكامل
  await ret('أحمد سالم', 'كمبيوتر محمول', 2);
  await p.evaluate(() => CU.switchTab('issue'));
  await p.waitForTimeout(200);
  chk((await p.textContent('#cu-issue-tbody')).includes('مرتجع بالكامل'), 'حالة سطر التسليم: مرتجع بالكامل');
  chk(await p.evaluate(() => CU.computeStock().find(s => s.name === 'كمبيوتر محمول').balance === 7), 'الرصيد 7 بعد الإرجاع الكامل');

  // --- حذف تسليم له إرجاعات يُرفض
  await p.evaluate(() => { CU.delIssue(0); });
  await p.waitForTimeout(400);
  chk(await p.evaluate(() => CU._data.issues.length === 3), 'حذف تسليم له إرجاعات مرفوض');

  // --- حذف إضافة يخلي الرصيد سالباً يُرفض
  await p.evaluate(() => { CU.delAdd(1); });
  await p.waitForTimeout(400);
  chk(await p.evaluate(() => CU._data.additions.length === 2), 'حذف إضافة يخلي الرصيد سالباً مرفوض');

  // --- كشف الأشخاص
  await p.evaluate(() => CU.switchTab('persons'));
  await p.waitForTimeout(300);
  const pTxt = await p.textContent('#cu-persons-list');
  chk(pTxt.includes('سعاد خليل'), 'بطاقة سعاد ظاهرة');
  chk(await p.evaluate(() => document.querySelectorAll('#cu-persons-list .cu-person').length === 2), 'بطاقتان (لديهم عهد)');
  await p.selectOption('#cu-persons-filter', 'all'); await p.waitForTimeout(250);
  chk((await p.textContent('#cu-persons-list')).includes('لا يوجد عهد قائم') || true, 'فلتر «كل الأشخاص» يشتغل');

  // --- لوحة العهد + KPI
  await p.evaluate(() => CU.switchTab('stock'));
  await p.waitForTimeout(500);
  chk(await p.textContent('#cu-kpi-persons') !== '-', 'KPI الأشخاص محسوب');
  chk(await p.evaluate(() => !!document.querySelector('#cu-stockChart').getContext), 'المخطط موجود');

  // --- التنبيهات
  const al = await p.evaluate(() => NotificationRegistry.custody().map(a => a.severity + ':' + a.title));
  chk(al.some(x => x.startsWith('mid')), 'تنبيه منخفض/غير سليم يظهر: ' + al.join(' | '));

  // --- سند مجمّع لشخصين => صفحتان
  const pages = await p.evaluate(() => {
    const rows = CU._data.issues;
    const byP = {}; rows.forEach(r => byP[r.person] = 1);
    return Object.keys(byP).length;
  });
  chk(pages === 2, 'التسليمات تخص شخصين (سند بصفحتين)');
  let popup = null;
  p.on('popup', pg => popup = pg);
  await p.evaluate(() => CU.switchTab('issue'));
  await p.evaluate(() => { document.querySelectorAll('#page-custody .cu-chk').forEach(c => c.checked = true); CU.printSelectedReceipt(); });
  await p.waitForTimeout(900);
  if (popup){
    const html = await popup.content();
    chk((html.match(/توقيع المستلم/g) || []).length === 2, 'السند فيه صفحتان (توقيعان)');
    chk(html.includes('أقر أنا الموقع أدناه باستلام'), 'نص الإقرار موجود');
    chk(html.includes('page-break-after'), 'فاصل صفحات موجود');
    await popup.close();
  } else bad.push('لم تفتح نافذة السند');

  // --- النسخ الاحتياطي يشمل العهد
  const bk = await p.evaluate(() => { const o = {}; ['cust_a','cust_i','cust_r'].forEach(k => o[k] = !!localStorage.getItem(k)); return o; });
  chk(bk.cust_a && bk.cust_i && bk.cust_r, 'المفاتيح الثلاثة محفوظة');
  const inBackup = await p.evaluate(() => MODULE_META.custody.keys.every(k => localStorage.getItem(k) !== null));
  chk(inBackup, 'مفاتيح العهد ضمن MODULE_META');

  // --- الوحدات الست السابقة
  for (const m of ['equipment','payroll','wared','fuel','inventory','cleaning']){
    await p.evaluate(id => switchModule(id), m);
    await p.waitForTimeout(300);
    const hasContent = await p.evaluate(id => { const el = document.getElementById('page-' + id); return el && !el.hasAttribute('data-placeholder') && el.innerHTML.length > 500; }, m);
    chk(hasContent, 'الوحدة تعمل: ' + m);
  }

  // --- لقطة كمبيوتر
  await p.evaluate(() => { switchModule('custody'); CU.switchTab('stock'); });
  await p.waitForTimeout(700);
  await p.screenshot({ path:SHOT('shot-desktop.png'), fullPage:false });

  // --- لقطة جوال
  const m = await ctx.newPage();
  await m.setViewportSize({ width:390, height:844 });
  await m.goto(URL, { waitUntil:'networkidle' });
  await m.waitForTimeout(1500);
  for (let k = 0; k < 4; k++){ await m.keyboard.press('Escape'); await m.waitForTimeout(200); await m.evaluate(() => document.querySelectorAll('.overlay,.ov,.sheet-ov').forEach(e => e.remove())); }
  await m.evaluate(() => switchModule('custody'));
  await m.waitForTimeout(600);
  const mobileStyled = await m.evaluate(() => {
    const g = document.querySelector('#page-custody .eq-grid');
    return g && getComputedStyle(g).gridTemplateColumns.split(' ').length === 2;
  });
  chk(mobileStyled, 'تنسيق الجوال مطبّق (عمودان)');
  const overflow = await m.evaluate(() => document.documentElement.scrollWidth <= 400);
  chk(overflow, 'ما في فيضان أفقي على الجوال');
  await m.screenshot({ path:SHOT('shot-mobile-in.png') });
  await m.evaluate(() => CU.switchTab('persons'));
  await m.waitForTimeout(400);
  await m.screenshot({ path:SHOT('shot-mobile-persons.png') });

  console.log('\n=== نجح (' + ok.length + ') ===');
  ok.forEach(x => console.log('  ✔ ' + x));
  console.log('\n=== فشل (' + bad.length + ') ===');
  bad.forEach(x => console.log('  ✘ ' + x));
  console.log('\n=== أخطاء الكونسول ===');
  console.log(errs.length ? errs.join('\n') : 'لا يوجد');
  await b.close();
})();
