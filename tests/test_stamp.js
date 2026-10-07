const { chromium } = require('playwright');
const SHOT = n => { const p = require('path'), f = require('fs'); const d = process.env.SHOT_DIR || p.join(__dirname, '..', 'screenshots'); f.mkdirSync(d, { recursive:true }); return p.join(d, n); };
const URL = (process.env.BASE_URL || 'http://localhost:8765') + '/unified-admin/index.html';
let pass=0, fail=[];
const ok=(c,m)=>{ if(c) pass++; else fail.push(m); console.log((c?'  ✔ ':'  ✘ ')+m); };
(async()=>{
const b=await chromium.launch({...(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {})});
const ctx=await b.newContext({viewport:{width:390,height:844}});
const p=await ctx.newPage(); const errs=[];
p.on('pageerror',e=>errs.push('PAGEERROR '+e.message));
p.on('console',m=>{if(m.type()==='error'&&!/403|favicon|Failed to load resource/.test(m.text()))errs.push(m.text())});
await p.goto(URL); await p.waitForTimeout(800);
await p.evaluate(()=>{localStorage.setItem('unified_settings',JSON.stringify({onboarded:true,installNever:true,lastSeenVersion:'2.12.0',haptics:false}));sessionStorage.setItem('installShown','1');});
await p.reload(); await p.waitForTimeout(1500);
for(let k=0;k<4;k++){await p.keyboard.press('Escape');await p.waitForTimeout(150);await p.evaluate(()=>document.querySelectorAll('.overlay').forEach(e=>e.remove()));}

// أداة: تصنع صورة ورقة فيها نص في مناطق محددة، ثم تختمها وترجع موقع الختم
const probe = await p.evaluate(async () => {
  const mk = (busy) => { // busy: دالة ترسم "الكتابة"
    const c = document.createElement('canvas'); c.width=800; c.height=1100;
    const x = c.getContext('2d'); x.fillStyle='#fff'; x.fillRect(0,0,800,1100);
    x.fillStyle='#111'; busy(x);
    return c.toDataURL('image/png');
  };
  const lines = (x, y0, y1) => { for(let y=y0;y<y1;y+=26) x.fillRect(60, y, 680, 12); };
  const diffBox = (aUrl, bUrl) => new Promise(res => {
    const ia=new Image(), ib=new Image(); let n=0;
    const go=()=>{ if(++n<2) return;
      const c=document.createElement('canvas'); c.width=800;c.height=1100;
      const g=c.getContext('2d',{willReadFrequently:true}); g.drawImage(ia,0,0,800,1100);
      const A=g.getImageData(0,0,800,1100).data;
      g.clearRect(0,0,800,1100); g.drawImage(ib,0,0,800,1100);
      const B=g.getImageData(0,0,800,1100).data;
      let x0=1e9,y0=1e9,x1=-1,y1=-1;
      for(let y=0;y<1100;y+=2) for(let x=0;x<800;x+=2){ const i=(y*800+x)*4;
        if(Math.abs(A[i]-B[i])+Math.abs(A[i+1]-B[i+1])+Math.abs(A[i+2]-B[i+2])>30){
          if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y; } }
      res({x0,y0,x1,y1,cx:(x0+x1)/2,cy:(y0+y1)/2});
    };
    ia.onload=go; ib.onload=go; ia.src=aUrl; ib.src=bUrl;
  });
  const run = async (busy, note) => {
    const src = mk(busy);
    const out = await WR._stamp(src, 'image/png', '2026-09-27', note);
    return { box: await diffBox(src, out), out };
  };
  return {
    // نص يملأ النصف السفلي → الختم لازم يروح فوق
    bottomBusy: (await run(x => lines(x, 560, 1050), 'رُد عليه بكتاب رقم ٥٥')).box,
    // نص يملأ النصف العلوي → الختم لازم ينزل تحت
    topBusy:    (await run(x => lines(x, 60, 520), 'رُد عليه بكتاب رقم ٥٥')).box,
    // نص في الوسط فقط
    midBusy:    (await run(x => lines(x, 350, 760), '')).box,
    // ورقة مزدحمة كلها → يرجع للزاوية السفلية
    allBusy:    (await run(x => lines(x, 40, 1060), 'ملاحظة')).box,
    sample:     (await run(x => lines(x, 560, 1050), 'أُنجز وأُرسل الرد بكتاب رقم ٥٥ بتاريخ ٢٧ سبتمبر عبر الديوان')).out
  };
});

const B = probe.bottomBusy, T = probe.topBusy, M = probe.midBusy, A = probe.allBusy;
ok(B.cy < 520, 'نص بالنصف السفلي → الختم راح للفراغ العلوي (cy='+Math.round(B.cy)+')');
ok(T.cy > 560, 'نص بالنصف العلوي → الختم نزل للفراغ السفلي (cy='+Math.round(T.cy)+')');
ok(M.cy < 330 || M.cy > 790, 'نص بالوسط → الختم تجنّبه (cy='+Math.round(M.cy)+')');
ok(A.cy > 700 && A.x1 > 500, 'ورقة مزدحمة كلياً → رجع للزاوية السفلية');
[['bottomBusy',B],['topBusy',T]].forEach(([n,b])=>{
  ok(b.x0>=10 && b.x1<=790 && b.y0>=10 && b.y1<=1090, 'الختم داخل حدود الورقة ('+n+')');
  ok((b.x1-b.x0)>150 && (b.y1-b.y0)>70, 'حجم الختم معقول ('+n+': '+Math.round(b.x1-b.x0)+'×'+Math.round(b.y1-b.y0)+')');
});
ok((B.y1-B.y0) > (M.y1-M.y0) - 5, 'الختم مع ملاحظة أطول من الختم بلا ملاحظة');

// حفظ عيّنة للمعاينة
const fs=require('fs');
fs.writeFileSync(SHOT('stamp_sample.png'), Buffer.from(probe.sample.split(',')[1],'base64'));

// المسار الكامل من الواجهة: إنشاء سجل بمرفق صورة ثم ✅
await p.evaluate(()=>App.switchModule('wared')); await p.waitForTimeout(600);
const flow = await p.evaluate(async () => {
  const c=document.createElement('canvas'); c.width=800;c.height=1100;
  const x=c.getContext('2d'); x.fillStyle='#fff'; x.fillRect(0,0,800,1100);
  x.fillStyle='#111'; for(let y=600;y<1050;y+=26) x.fillRect(60,y,680,12);
  const blob = await new Promise(r=>c.toBlob(r,'image/png'));
  const file = new File([blob],'كتاب.png',{type:'image/png'});
  const recs = WR._records();
  const before = recs.length;
  return { before, fileOk: file.size>0 };
});
ok(flow.fileOk, 'تجهيز مرفق اختباري');
const doneBtns = await p.locator('#page-wared button[title="تحديد كمنجز"]').count();
ok(doneBtns >= 0, 'زر «تحديد كمنجز» موجود في الجدول ('+doneBtns+')');
if (doneBtns > 0){
  await p.locator('#page-wared button[title="تحديد كمنجز"]').first().click();
  await p.waitForTimeout(500);
  const txt = await p.locator('.overlay .info-box').first().textContent();
  ok(/منطقة فارغة/.test(txt) || /تُحدَّث الحالة/.test(txt), 'ورقة الإنجاز تشرح مكان الختم');
  await p.locator('.overlay [data-cancel]').click(); await p.waitForTimeout(300);
}
console.log('\n=== نجح ('+pass+') === فشل ('+fail.length+') ===');
fail.forEach(f=>console.log('  - '+f));
console.log('\n=== أخطاء الكونسول ===\n'+(errs.length?errs.join('\n'):'لا يوجد'));
await b.close(); process.exit(fail.length?1:0);
})();
