const { chromium } = require('playwright');
const SHOT = n => { const p = require('path'), f = require('fs'); const d = process.env.SHOT_DIR || p.join(__dirname, '..', 'screenshots'); f.mkdirSync(d, { recursive:true }); return p.join(d, n); };
const XLSX = require('xlsx'); // المرجع الأصلي للمقارنة
const URL = (process.env.BASE_URL || 'http://localhost:8765') + '/unified-admin/index.html';
const ok = [], bad = [];
const chk = (c, m) => (c ? ok : bad).push(m);
const book = rows => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'البيانات');
  return Buffer.from(XLSX.write(wb, { bookType:'xlsx', type:'array' }));
};
const pick = async (p, buf, name) => { await p.setInputFiles('#xl-file', { name, mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: buf }); await p.waitForTimeout(1000); };
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
  await p.evaluate(() => { localStorage.clear(); localStorage.setItem('unified_settings', JSON.stringify({ onboarded:true, installNever:true, lastSeenVersion:'2.10.0', haptics:false })); sessionStorage.setItem('installShown','1'); });
  await p.reload({ waitUntil:'networkidle' }); await p.waitForTimeout(1800);
  for (let k = 0; k < 4; k++){ await p.keyboard.press('Escape'); await p.waitForTimeout(150); await p.evaluate(() => document.querySelectorAll('.overlay,.ov,.sheet-ov').forEach(e => e.remove())); }

  chk(await p.evaluate(() => typeof XLSX !== 'undefined' && XLSX.version === 'mini-1.0'), 'مكتبة Excel المصغّرة محمّلة');
  chk(await p.evaluate(() => typeof Chart !== 'undefined' && Chart.version === 'mini-1.0'), 'مكتبة المخططات المصغّرة محمّلة');

  // ===== الكتابة: ملف ننتجه ونقرأه بالمكتبة الأصلية =====
  const out = await p.evaluate(() => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([['الصنف','الكمية','ملاحظة'],['بطانية "كبيرة"',250,'<وسم> & رمز'],['فرشات',70,''],['صنف بلا كمية','','آخر']]);
    ws['!cols'] = [{wch:20},{wch:10},{wch:16}];
    XLSX.utils.book_append_sheet(wb, ws, 'الأصناف');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['ورقة ثانية'],[42]]), 'ثانية');
    return Array.from(XLSX.write(wb, { bookType:'xlsx', type:'array' }));
  });
  const buf = Buffer.from(out);
  let wbRef;
  try { wbRef = XLSX.read(buf, { type:'buffer' }); } catch(e){ wbRef = null; }
  chk(!!wbRef, 'الملف المُنتَج يُقرأ بمكتبة SheetJS الأصلية (صيغة صحيحة)');
  if (wbRef){
    const a = XLSX.utils.sheet_to_json(wbRef.Sheets[wbRef.SheetNames[0]], { header:1, defval:'' });
    chk(wbRef.SheetNames.length === 2 && wbRef.SheetNames[0] === 'الأصناف' && wbRef.SheetNames[1] === 'ثانية', 'أسماء الأوراق العربية صحيحة');
    chk(a[1][0] === 'بطانية "كبيرة"' && a[1][2] === '<وسم> & رمز', 'الرموز الخاصة والاقتباس سليمة');
    chk(a[1][1] === 250 && typeof a[1][1] === 'number', 'الأرقام تُكتب كأرقام لا نصوص');
    chk(a[3][0] === 'صنف بلا كمية' && a[3][2] === 'آخر', 'الخلايا الفارغة لا تُزيح الأعمدة');
    const b2 = XLSX.utils.sheet_to_json(wbRef.Sheets['ثانية'], { header:1 });
    chk(b2[1][0] === 42, 'الورقة الثانية سليمة');
  }

  // ===== القراءة: ملف من SheetJS نقرأه بالمصغّرة =====
  const rt = await p.evaluate(async bytes => {
    const wb = await XLSX.read(new Uint8Array(bytes), { type:'array' });
    return { names: wb.SheetNames, aoa: XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header:1, defval:'' }) };
  }, Array.from(book([['التاريخ','الصنف','الكمية'],[46283,'صنف مشترك',12],['2026-09-15','صنف "مقتبس"',7],['','',''],['2026-09-16','أخير',3]])));
  chk(rt.names[0] === 'البيانات', 'اسم الورقة يُقرأ صح');
  chk(rt.aoa[1][0] === 46283 && rt.aoa[1][2] === 12, 'الأرقام والتواريخ الرقمية تُقرأ كأرقام');
  chk(rt.aoa[2][1] === 'صنف "مقتبس"', 'النصوص المشتركة (sharedStrings) تُقرأ صح');
  chk(rt.aoa[4][1] === 'أخير', 'الصفوف بعد الصف الفارغ في مكانها');

  // CSV
  const csv = await p.evaluate(async () => {
    const t = new TextEncoder().encode('\uFEFFالتاريخ,الصنف,الكمية\n2026-09-10,"صنف, بفاصلة",5\n');
    const wb = await XLSX.read(t, { type:'array' });
    return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header:1, defval:'' });
  });
  chk(csv[0][0] === 'التاريخ' && csv[1][1] === 'صنف, بفاصلة' && csv[1][2] === 5, 'ملفات CSV تُقرأ صح');

  // ===== الاستيراد الحقيقي عبر الواجهة =====
  await p.evaluate(() => switchModule('equipment')); await p.waitForTimeout(400);
  const before = await p.evaluate(() => EQ.computeStock().length);
  await p.evaluate(() => EQ.importFromExcel()); await p.waitForTimeout(500);
  await pick(p, book([['التاريخ','الصنف','الوحدة','الكمية','المورد'],['2026-09-10','صنف مصغّر','قطعة',33,'إمداد']]), 'a.xlsx');
  chk(await p.evaluate(() => /١/.test(document.querySelector('.lead').textContent)), 'المراجعة تعمل مع المكتبة الجديدة');
  await clickTxt(p, 'استيراد'); await p.waitForTimeout(900);
  chk(await p.evaluate(x => EQ.computeStock().length === x + 1, before), 'الاستيراد من الواجهة نجح');

  // تصدير Excel من الوحدة
  const dl = p.waitForEvent('download', { timeout:8000 }).catch(() => null);
  await p.evaluate(() => EQ.exportExcel());
  const got = await dl;
  chk(!!got, 'تصدير Excel من الوحدة يعمل');
  // ===== المخططات =====
  await p.evaluate(() => { switchModule('equipment'); EQ.switchTab('stock'); }); await p.waitForTimeout(900);
  const drawn = await p.evaluate(() => {
    const cv = document.getElementById('eq-stockChart'); if (!cv) return { err:'no canvas' };
    const c = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    let painted = 0; for (let i = 3; i < c.length; i += 4) if (c[i] > 0) painted++;
    return { w:cv.width, h:cv.height, painted };
  });
  chk(drawn.painted > 200, 'المخطط مرسوم فعلاً على الكانفس');
  chk(drawn.w > 100 && drawn.h > 100, 'أبعاد الكانفس صحيحة (responsive)');
  await p.evaluate(() => { const b = [...document.querySelectorAll('#page-equipment button')].find(x => (x.getAttribute('onclick')||'').includes("showChart('out'")); b.click(); }); await p.waitForTimeout(700);
  chk(await p.evaluate(() => { const cv = document.getElementById('eq-stockChart'); const c = cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data; let n=0; for (let i=3;i<c.length;i+=4) if (c[i]>0) n++; return n > 200; }), 'تبديل نوع المخطط يعيد الرسم (destroy ثم إنشاء)');
  // مخطط الوقود (٣ مجموعات + وسيلة إيضاح)
  await p.evaluate(() => switchModule('fuel')); await p.waitForTimeout(700);
  await p.evaluate(() => FU.showView('dash')); await p.waitForTimeout(900);
  chk(await p.evaluate(() => { const cv = document.querySelector('#page-fuel canvas'); if (!cv) return false; const c = cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data; let n=0; for (let i=3;i<c.length;i+=4) if (c[i]>0) n++; return n > 200; }), 'مخطط الوقود (٣ مجموعات) مرسوم');
  // الثيم الداكن
  await p.evaluate(() => { document.documentElement.setAttribute('data-theme','dark'); switchModule('equipment'); EQ.switchTab('stock'); }); await p.waitForTimeout(900);
  chk(await p.evaluate(() => { const cv = document.getElementById('eq-stockChart'); const c = cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data; let n=0; for (let i=3;i<c.length;i+=4) if (c[i]>0) n++; return n > 200; }), 'المخطط يعمل بالثيم الداكن');
  await p.evaluate(() => document.documentElement.setAttribute('data-theme','light'));

  // ===== كل الوحدات =====
  for (const m of ['wared','payroll','equipment','fuel','inventory','cleaning','custody']){
    await p.evaluate(x => switchModule(x), m); await p.waitForTimeout(280);
    chk(await p.evaluate(x => { const el = document.getElementById('page-' + x); return el && !el.hasAttribute('data-placeholder'); }, m), 'الوحدة تعمل: ' + m);
  }

  const mo = await ctx.newPage(); await mo.goto(URL, { waitUntil:'networkidle' });
  await mo.setViewportSize({ width:390, height:844 });
  await mo.evaluate(() => { localStorage.setItem('unified_settings', JSON.stringify({ onboarded:true, installNever:true, lastSeenVersion:'2.10.0', haptics:false })); sessionStorage.setItem('installShown','1'); });
  await mo.reload({ waitUntil:'networkidle' }); await mo.waitForTimeout(1600);
  for (let k = 0; k < 4; k++){ await mo.keyboard.press('Escape'); await mo.waitForTimeout(150); await mo.evaluate(() => document.querySelectorAll('.overlay,.ov,.sheet-ov').forEach(e => e.remove())); }
  await mo.evaluate(() => { switchModule('equipment'); EQ.switchTab('stock'); }); await mo.waitForTimeout(900);
  chk(await mo.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2), 'ما في فيضان أفقي على الجوال');
  await mo.screenshot({ path:SHOT('shot-mini-mobile.png') });
  await p.evaluate(() => { switchModule('equipment'); EQ.switchTab('stock'); }); await p.waitForTimeout(800);
  await p.screenshot({ path:SHOT('shot-mini-desktop.png') });

  console.log('\n=== نجح (' + ok.length + ') ===\n  ✔ ' + ok.join('\n  ✔ '));
  console.log('\n=== فشل (' + bad.length + ') ===' + (bad.length ? '\n  ✘ ' + bad.join('\n  ✘ ') : ''));
  console.log('\n=== أخطاء الكونسول ===\n' + (errs.length ? errs.join('\n') : 'لا يوجد'));
  await b.close();
})();
