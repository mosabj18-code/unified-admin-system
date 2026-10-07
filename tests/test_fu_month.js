const { chromium } = require('playwright');
const SHOT = n => { const p = require('path'), f = require('fs'); const d = process.env.SHOT_DIR || p.join(__dirname, '..', 'screenshots'); f.mkdirSync(d, { recursive:true }); return p.join(d, n); };
const URL=(process.env.BASE_URL || 'http://localhost:8765') + '/unified-admin/index.html';
let pass=0, fail=[];
const ok=(c,m)=>{ if(c) pass++; else fail.push(m); console.log((c?'  ✔ ':'  ✘ ')+m); };
(async()=>{
const b=await chromium.launch({...(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {})});
const ctx=await b.newContext({viewport:{width:390,height:844}});
const p=await ctx.newPage(); const errs=[];
p.on('pageerror',e=>errs.push('PAGEERROR '+e.message));
p.on('console',m=>{if(m.type()==='error'&&!/403|favicon|Failed to load resource/.test(m.text()))errs.push(m.text())});
await p.goto(URL); await p.waitForTimeout(800);
// بيانات معروفة على ثلاثة شهور
await p.evaluate(()=>{
  localStorage.setItem('unified_settings',JSON.stringify({onboarded:true,installNever:true,lastSeenVersion:'2.13.0',haptics:false}));
  sessionStorage.setItem('installShown','1');
  localStorage.setItem('fuel2_in', JSON.stringify([
    {id:'i1',date:'2026-07-05',type:'غاز',qty:1000,unit:'كيلو',src:'مصدر تموز'},
    {id:'i2',date:'2026-08-05',type:'غاز',qty:500,unit:'كيلو',src:'مصدر آب'},
    {id:'i3',date:'2026-08-07',type:'سولار',qty:800,unit:'لتر',src:'مصدر آب'},
    {id:'i4',date:'2026-09-05',type:'سولار',qty:300,unit:'لتر',src:'مصدر أيلول'}
  ]));
  localStorage.setItem('fuel2_out', JSON.stringify([
    {id:'o1',no:1,date:'2026-07-10',type:'غاز',qty:200,unit:'كيلو',dept:'جهة تموز'},
    {id:'o2',no:2,date:'2026-08-11',type:'غاز',qty:120,unit:'كيلو',dept:'جهة آب'},
    {id:'o3',no:3,date:'2026-08-12',type:'سولار',qty:90,unit:'لتر',dept:'جهة آب'},
    {id:'o4',no:4,date:'2026-09-12',type:'سولار',qty:40,unit:'لتر',dept:'جهة أيلول'}
  ]));
});
await p.reload(); await p.waitForTimeout(1600);
for(let k=0;k<4;k++){await p.keyboard.press('Escape');await p.waitForTimeout(150);await p.evaluate(()=>document.querySelectorAll('.overlay').forEach(e=>e.remove()));}
await p.evaluate(()=>App.switchModule('fuel')); await p.waitForTimeout(600);
await p.evaluate(()=>FU.showView('out')); await p.waitForTimeout(400);

ok(await p.locator('#page-fuel button:has-text("تقرير شهري")').count()===1,'زر «تقرير شهري» موجود بجانب التقرير الشامل');
ok(await p.locator('#page-fuel button:has-text("تقرير شامل")').count()===1,'زر التقرير الشامل ما زال موجوداً');

await p.evaluate(()=>FU.openMonthSheet()); await p.waitForTimeout(400);
const months = await p.locator('.fu-mchk').count();
ok(months===3,'الورقة تعرض الشهور الثلاثة (ظهر '+months+')');
ok(await p.locator('.fu-mchk:checked').count()===1,'اختيار واحد فقط (radio) وأحدث شهر محدد مسبقاً');
ok(await p.locator('.fu-mlist').evaluate(e=>getComputedStyle(e).borderRadius!=='0px'),'قائمة الشهور منسّقة (CSS مطبّق)');
ok(await p.locator('.overlay .sheet').evaluate(e=>e.getBoundingClientRect().width)<=390,'الورقة لا تفيض أفقياً على الجوال');

// اختيار آب تحديداً
await p.evaluate(()=>{ const r=[...document.querySelectorAll('.fu-mchk')].find(x=>x.value==='2026-08'); r.checked=true; });
const pop = ctx.waitForEvent('page');
await p.evaluate(()=>FU.runMonthReport());
const w = await pop; await w.waitForLoadState('domcontentloaded');
const h = await w.content();

ok(/التقرير الشهري لتوزيع الوقود/.test(h),'عنوان التقرير الشهري');
ok(/أغسطس ٢٠٢٦/.test(h),'اسم الشهر المحدد بالترويسة');
ok(/لا تتضمن أي شهر سابق/.test(h),'تنويه أن الأرقام لهذا الشهر وحده');
['١. ملخص الشهر','٢. الحركة اليومية','٣. التوزيع حسب الجهة','٤. الوارد حسب المصدر','٥. تفاصيل الوارد','٦. تفاصيل التوزيع']
  .forEach(t=>ok(h.includes(t),'التقرير فيه: '+t));
// عزل الشهر: بيانات تموز وأيلول ممنوعة
ok(!/جهة تموز/.test(h) && !/مصدر تموز/.test(h),'لا أثر لبيانات يوليو');
ok(!/جهة أيلول/.test(h) && !/مصدر أيلول/.test(h),'لا أثر لبيانات سبتمبر');
ok(/جهة آب/.test(h) && /مصدر آب/.test(h),'بيانات أغسطس موجودة');
// الأرقام: وارد غاز 500 وموزع 120 وسولار 800/90 — بلا تراكم (1500 أو 320 تعني دمجاً)
ok(/٥٠٠/.test(h) && /١٢٠/.test(h) && /٨٠٠/.test(h) && /٩٠/.test(h),'أرقام أغسطس صحيحة');
ok(!/١٬٥٠٠/.test(h) && !/٣٢٠/.test(h),'ما في تراكم من الشهور السابقة');
ok(/أمين المخزن/.test(h) && /اعتماد المدير العام/.test(h),'خانات التواقيع موجودة');
await w.close(); await p.waitForTimeout(300);
ok(await p.locator('.overlay').count()===0,'الورقة تُغلق بعد إنشاء التقرير');

// التقرير الشامل ما تأثر
const pop2 = ctx.waitForEvent('page');
await p.evaluate(()=>FU.printReport());
const w2 = await pop2; await w2.waitForLoadState('domcontentloaded');
const h2 = await w2.content();
ok(/التقرير الشامل لتوزيع الوقود/.test(h2) && /جهة تموز/.test(h2),'التقرير الشامل ما زال يشمل كل الشهور');
await w2.close();

console.log('\n=== نجح ('+pass+') === فشل ('+fail.length+') ===');
fail.forEach(f=>console.log('  - '+f));
console.log('\n=== أخطاء الكونسول ===\n'+(errs.length?errs.join('\n'):'لا يوجد'));
await p.screenshot({path:SHOT('fu_month.png')});
await b.close(); process.exit(fail.length?1:0);
})();
