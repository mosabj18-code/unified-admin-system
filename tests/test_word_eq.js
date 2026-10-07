const { chromium } = require('playwright');
const SHOT = n => { const p = require('path'), f = require('fs'); const d = process.env.SHOT_DIR || p.join(__dirname, '..', 'screenshots'); f.mkdirSync(d, { recursive:true }); return p.join(d, n); };
const fs=require('fs');
const URL=(process.env.BASE_URL || 'http://localhost:8765') + '/unified-admin/index.html';
let pass=0, fail=[];
const ok=(c,m)=>{ if(c) pass++; else fail.push(m); console.log((c?'  ✔ ':'  ✘ ')+m); };
(async()=>{
const b=await chromium.launch({...(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {})});
const ctx=await b.newContext({viewport:{width:390,height:844},acceptDownloads:true});
const p=await ctx.newPage(); const errs=[];
p.on('pageerror',e=>errs.push('PAGEERROR '+e.message));
p.on('console',m=>{if(m.type()==='error'&&!/403|favicon|Failed to load resource/.test(m.text()))errs.push(m.text())});
await p.goto(URL); await p.waitForTimeout(800);
await p.evaluate(()=>{
  localStorage.setItem('unified_settings',JSON.stringify({onboarded:true,installNever:true,lastSeenVersion:'2.14.0',haptics:false}));
  sessionStorage.setItem('installShown','1');
  localStorage.setItem('fuel2_in', JSON.stringify([
    {id:'i1',date:'2026-07-05',type:'غاز',qty:1000,unit:'كيلو',src:'مصدر تموز'},
    {id:'i2',date:'2026-08-05',type:'غاز',qty:500,unit:'كيلو',src:'مصدر آب'},
    {id:'i3',date:'2026-08-07',type:'سولار',qty:800,unit:'لتر',src:'مصدر آب'}
  ]));
  localStorage.setItem('fuel2_out', JSON.stringify([
    {id:'o1',no:1,date:'2026-07-10',type:'غاز',qty:200,unit:'كيلو',dept:'جهة تموز'},
    {id:'o2',no:2,date:'2026-08-11',type:'غاز',qty:120,unit:'كيلو',dept:'مركز النور'},
    {id:'o3',no:3,date:'2026-08-12',type:'سولار',qty:90,unit:'لتر',dept:'مركز النور'},
    {id:'o4',no:4,date:'2026-08-13',type:'سولار',qty:60,unit:'لتر',dept:'مركز الرمال'}
  ]));
  localStorage.setItem('inv_eq_a', JSON.stringify([
    {date:'2026-08-01',name:'كرسي',unit:'حبة',qty:10,supplier:'مورد أ',notes:''},
    {date:'2026-08-01',name:'طاولة',unit:'حبة',qty:5,supplier:'مورد أ',notes:''},
    {date:'2026-08-02',name:'مروحة',unit:'حبة',qty:3,supplier:'مورد ب',notes:''}
  ]));
  localStorage.setItem('inv_eq_w', JSON.stringify([]));
});
await p.reload(); await p.waitForTimeout(1600);
for(let k=0;k<4;k++){await p.keyboard.press('Escape');await p.waitForTimeout(150);await p.evaluate(()=>document.querySelectorAll('.overlay').forEach(e=>e.remove()));}

/* ===== وقود: تقرير Word ===== */
await p.evaluate(()=>App.switchModule('fuel')); await p.waitForTimeout(600);
await p.evaluate(()=>FU.showView('out')); await p.waitForTimeout(400);
ok(await p.locator('#page-fuel button:has-text("تقرير Word")').count()===1,'زر «تقرير Word» موجود');
await p.evaluate(()=>FU.openWordSheet()); await p.waitForTimeout(400);
const txt = await p.locator('.overlay .mk-hint').first().textContent();
ok(/جدولين/.test(txt),'الورقة تشرح أن الملف بجدولين');
ok(/تنزيل ملف Word/.test(await p.locator('.overlay .mk-btns button').first().textContent()),'زر التنزيل بصيغة Word');
await p.evaluate(()=>{ const r=[...document.querySelectorAll('.fu-mchk')].find(x=>x.value==='2026-08'); r.checked=true; });
const dl = p.waitForEvent('download');
await p.evaluate(()=>FU.runMonthReport());
const d = await dl;
const path = SHOT('fuel_word.docx'); await d.saveAs(path);
ok(fs.statSync(path).size > 1500,'حجم الملف معقول ('+fs.statSync(path).size+' بايت)');
// بيئة الفحص تسمّي كل تنزيل "download"؛ نفحص الاسم المطلوب من الكود نفسه
const raw = fs.readFileSync(path);
const txt8 = raw.toString('utf8');
ok(raw[0]===0x50 && raw[1]===0x4B,'الملف أرشيف ZIP صالح (توقيع PK)');
['[Content_Types].xml','_rels/.rels','word/document.xml','word/styles.xml','word/_rels/document.xml.rels']
  .forEach(n=>ok(txt8.includes(n),'الملف يحوي الجزء: '+n));
ok((txt8.match(/<w:tbl>/g)||[]).length===3,'فيه ثلاثة جداول (الكميات، الجهات، التواقيع)');
ok(txt8.includes('wordprocessingml')&&txt8.includes('<w:bidi/>'),'مستند Word باتجاه من اليمين لليسار');
// المحتوى: أغسطس فقط
ok(txt8.includes('أغسطس'),'عنوان الشهر داخل المستند');
ok(txt8.includes('مركز النور')&&txt8.includes('مركز الرمال'),'جدول التوزيع حسب الجهة موجود');
ok(!txt8.includes('جهة تموز'),'لا أثر لبيانات يوليو');
ok(txt8.includes('الوارد')&&txt8.includes('الموزع'),'جدول الوارد والموزع موجود');
ok(txt8.includes('الإجمالي'),'صف الإجمالي في جدول الجهات');
ok(txt8.includes('أمين المخزن')&&txt8.includes('اعتماد المدير العام'),'خانات التواقيع');
// الأرقام: غاز 500/120 وسولار 800/150 — بلا تراكم من يوليو (1500 أو 320)
ok(txt8.includes('٥٠٠')&&txt8.includes('١٢٠')&&txt8.includes('٨٠٠')&&txt8.includes('١٥٠'),'أرقام أغسطس صحيحة');
ok(!txt8.includes('١٬٥٠٠')&&!txt8.includes('٣٢٠'),'ما في تراكم من الشهور السابقة');
await p.waitForTimeout(300);
ok(await p.locator('.overlay').count()===0,'الورقة تُغلق بعد التنزيل');
// التقارير الأخرى ما تأثرت
ok(await p.locator('#page-fuel button:has-text("تقرير شهري")').count()===1,'زر التقرير الشهري ما زال موجوداً');
ok(await p.locator('#page-fuel button:has-text("تقرير شامل")').count()===1,'زر التقرير الشامل ما زال موجوداً');

/* ===== مخزون المعدات: سند الإضافة ===== */
await p.evaluate(()=>App.switchModule('equipment')); await p.waitForTimeout(700);
await p.evaluate(()=>EQ.switchTab('in')); await p.waitForTimeout(400);
ok(await p.locator('#eq-print-sel-in').count()===1,'زر «طباعة سند للمحدد» في تبويب الإضافة');
ok(await p.locator('#eq-chk-all-in').count()===1,'مربع تحديد الكل في الإضافة');
ok(await p.locator('#eq-in-tbody .in-chk').count()===3,'مربع تحديد لكل سطر إضافة');
ok(await p.locator('#eq-in-tbody button[title^="طباعة سند إدخال"]').count()===3,'زر طباعة لكل سطر إضافة');
ok(await p.evaluate(()=>document.querySelectorAll('#eq-page-in thead th').length)===9,'أعمدة رأس جدول الإضافات ٩');
await p.locator('#eq-in-tbody .in-chk').first().check(); await p.waitForTimeout(150);
ok(/\(/.test(await p.locator('#eq-print-sel-in').textContent()),'نص الزر يعرض عدد المحدد');
await p.evaluate(()=>EQ.toggleAllIn(false)); await p.waitForTimeout(150);
ok(await p.locator('#eq-in-tbody .in-chk:checked').count()===0,'مسح التحديد يعمل');

// سند الإدخال يجمع نفس المورد بنفس التاريخ (كرسي + طاولة من مورد أ)
const pop = ctx.waitForEvent('page');
await p.evaluate(()=>EQ.printAddReceipt(0));
const w = await pop; await w.waitForLoadState('domcontentloaded');
const h = await w.content();
ok(/سند إدخال للمخزون/.test(h),'عنوان سند الإدخال');
ok(/كرسي/.test(h)&&/طاولة/.test(h),'السند جمع صنفي نفس المورد ونفس التاريخ');
ok(!/مروحة/.test(h),'السند لم يضم صنف المورد الآخر');
ok(/إجمالي الكميات/.test(h)&&/توقيع المورِّد/.test(h)&&/توقيع أمين المخزن/.test(h),'السند فيه الإجمالي والتوقيعان');
await w.close();
// جدول الصرف ما تغيّر
ok(await p.evaluate(()=>document.querySelectorAll('#eq-page-out thead th').length)===9,'جدول الصرف لم يتغيّر');
await p.screenshot({path:SHOT('eq_in.png')});
console.log('\n=== نجح ('+pass+') === فشل ('+fail.length+') ===');
fail.forEach(f=>console.log('  - '+f));
console.log('\n=== أخطاء الكونسول ===\n'+(errs.length?errs.join('\n'):'لا يوجد'));
await b.close(); process.exit(fail.length?1:0);
})();
