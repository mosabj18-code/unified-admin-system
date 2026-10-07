const { chromium } = require('playwright');
const SHOT = n => { const p = require('path'), f = require('fs'); const d = process.env.SHOT_DIR || p.join(__dirname, '..', 'screenshots'); f.mkdirSync(d, { recursive:true }); return p.join(d, n); };
const URL = (process.env.BASE_URL || 'http://localhost:8765') + '/unified-admin/index.html';
let pass=0, fail=[];
const ok=(c,m)=>{ if(c) pass++; else fail.push(m); console.log((c?'  ✔ ':'  ✘ ')+m); };
(async()=>{
const b=await chromium.launch({...(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {})});
const ctx=await b.newContext({viewport:{width:390,height:844}});
const p=await ctx.newPage(); const errs=[];
p.on('console',m=>{if(m.type()==='error'&&!/403|favicon|Failed to load resource/.test(m.text()))errs.push(m.text())});
p.on('pageerror',e=>errs.push('PAGEERROR '+e.message));
await p.goto(URL); await p.waitForTimeout(800);
await p.evaluate(() => { localStorage.setItem('unified_settings', JSON.stringify({ onboarded:true, installNever:true, lastSeenVersion:'2.11.0', haptics:false })); sessionStorage.setItem('installShown','1'); });
await p.reload(); await p.waitForTimeout(1500);
for (let k=0;k<4;k++){ await p.keyboard.press('Escape'); await p.waitForTimeout(200); await p.evaluate(()=>document.querySelectorAll('.overlay').forEach(e=>e.remove())); }
await p.evaluate(()=>App.switchModule('inventory')); await p.waitForTimeout(700);

// تبويب الإضافة
await p.evaluate(()=>INV.switchTab('in')); await p.waitForTimeout(300);
ok(await p.locator('#inv-print-sel-in').count()===1,'زر «طباعة سند للمحدد» موجود في الإضافة');
ok(await p.locator('#inv-chk-all-in').count()===1,'مربع تحديد الكل في الإضافة');
ok(await p.locator('#inv-in-tbody .in-chk').count()>0,'مربعات تحديد لكل سطر إضافة');
const printBtns = await p.locator('#inv-in-tbody button[title^="طباعة سند إدخال"]').count();
ok(printBtns>0,'زر طباعة لكل سطر إضافة ('+printBtns+')');
const cols = await p.evaluate(()=>document.querySelectorAll('#inv-page-in thead th').length);
ok(cols===9,'أعمدة رأس جدول الإضافات ٩ (صار '+cols+')');

// التحديد يغيّر نص الزر
await p.locator('#inv-in-tbody .in-chk').first().check(); await p.waitForTimeout(150);
ok(/\(/.test(await p.locator('#inv-print-sel-in').textContent()),'نص الزر يعرض عدد المحدد');
await p.evaluate(()=>INV.toggleAllIn(false));

// سند الإدخال يفتح نافذة
let pop = ctx.waitForEvent('page');
await p.evaluate(()=>INV.printAddReceipt(0));
let w = await pop; await w.waitForLoadState('domcontentloaded');
const rh = await w.content();
ok(/سند إدخال للمخزون/.test(rh),'نافذة سند الإدخال فيها العنوان الصحيح');
ok(/توقيع المورِّد/.test(rh)&&/توقيع أمين المخزن/.test(rh),'سند الإدخال فيه التوقيعان');
ok(/إجمالي الكميات/.test(rh),'سند الإدخال فيه صف الإجمالي');
await w.close();

// ورقة التقرير
await p.evaluate(()=>INV.openReportSheet()); await p.waitForTimeout(400);
const months = await p.locator('.inv-mchk').count();
ok(months>0,'ورقة التقرير تعرض الأشهر ('+months+')');
ok(await p.locator('.inv-mlist').evaluate(e=>getComputedStyle(e).borderRadius!=='0px'),'قائمة الأشهر منسّقة (CSS مطبّق)');
const ovW = await p.locator('.overlay .sheet').evaluate(e=>e.getBoundingClientRect().width);
ok(ovW<=390,'ورقة التقرير لا تفيض أفقياً على الجوال');
await p.evaluate(()=>INV.reportSelectLast(3)); await p.waitForTimeout(150);
const sel3 = await p.locator('.inv-mchk:checked').count();
ok(sel3>0&&sel3<=3,'«آخر ٣ أشهر» يحدد '+sel3+' شهر');
await p.evaluate(()=>INV.reportSelectAll(true)); await p.waitForTimeout(100);
ok(await p.locator('.inv-mchk:checked').count()===months,'تحديد الكل يعمل');
await p.evaluate(()=>INV.reportSelectAll(false)); await p.waitForTimeout(100);
ok(await p.locator('.inv-mchk:checked').count()===0,'مسح التحديد يعمل');

// تقرير كل الفترات
await p.evaluate(()=>INV.reportSelectLast(2)); await p.waitForTimeout(150);
pop = ctx.waitForEvent('page');
await p.evaluate(()=>INV.runDetailedReport());
w = await pop; await w.waitForLoadState('domcontentloaded');
const h = await w.content();
['التقرير المفصل لمخزون الطعام','١. الملخص التنفيذي','٢. الملخص الشهري','٣. حركة الأصناف','٤. الصرف حسب الجهة','٥. الوارد حسب المورد','٦. تفاصيل الإضافات','٧. تفاصيل الصرف']
  .forEach(t=>ok(h.includes(t),'التقرير فيه: '+t));
ok(/أمين المخزن/.test(h)&&/اعتماد المدير العام/.test(h),'التقرير فيه خانات التواقيع');
ok(!/كل الفترات/.test(h),'نطاق التقرير = الأشهر المحددة لا كل الفترات');
await w.close();
await p.waitForTimeout(300);
ok(await p.locator('.overlay').count()===0,'الورقة تُغلق بعد إنشاء التقرير');

// النسخة والصرف ما تأثر
ok(await p.evaluate(()=>typeof INV.printSelectedAddReceipt==='function'&&typeof INV.printReceipt==='function'),'دوال الطباعة القديمة والجديدة كلها مصدَّرة');
const outCols = await p.evaluate(()=>document.querySelectorAll('#inv-page-out thead th').length);
ok(outCols===9,'جدول الصرف لم يتغيّر');

console.log('\n=== نجح ('+pass+') === فشل ('+fail.length+') ===');
fail.forEach(f=>console.log('  - '+f));
console.log('\n=== أخطاء الكونسول ===\n'+(errs.length?errs.join('\n'):'لا يوجد'));
await p.screenshot({path:SHOT('inv_mobile.png'),fullPage:false});
await b.close(); process.exit(fail.length?1:0);
})();
