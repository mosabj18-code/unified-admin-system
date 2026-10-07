const { chromium } = require('playwright');
const SHOT = n => { const p = require('path'), f = require('fs'); const d = process.env.SHOT_DIR || p.join(__dirname, '..', 'screenshots'); f.mkdirSync(d, { recursive:true }); return p.join(d, n); };
const fs=require('fs');
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
await p.evaluate(()=>{localStorage.setItem('unified_settings',JSON.stringify({onboarded:true,installNever:true,lastSeenVersion:'2.12.0',haptics:false}));sessionStorage.setItem('installShown','1');});
await p.reload(); await p.waitForTimeout(1500);
for(let k=0;k<4;k++){await p.keyboard.press('Escape');await p.waitForTimeout(150);await p.evaluate(()=>document.querySelectorAll('.overlay').forEach(e=>e.remove()));}
await p.evaluate(()=>App.switchModule('wared')); await p.waitForTimeout(600);

// إنشاء سجل وارد مع مرفق صورة
await p.evaluate(()=>WR.openForm('وارد')); await p.waitForTimeout(500);
await p.fill('#wr-e-entity','وزارة الداخلية');
await p.fill('#wr-e-subject','كتاب اختبار الختم');
await p.selectOption('#wr-e-status','قيد المعالجة').catch(()=>{});
await p.setInputFiles('.overlay input[data-file]', require('path').join(__dirname,'fixtures','kitab.png'));
await p.waitForTimeout(900);
await p.locator('.overlay [data-save]').click(); await p.waitForTimeout(900);
for(let k=0;k<3;k++){await p.keyboard.press('Escape');await p.waitForTimeout(150);}
const rec = await p.evaluate(()=>{ const r=WR._records().find(x=>x.subject==='كتاب اختبار الختم'); return r?{id:r.id,status:r.status,atts:(r.attachments||[]).length}:null; });
ok(!!rec,'السجل انحفظ');
ok(rec && rec.atts===1,'المرفق انحفظ مع السجل');

// قياس الصورة قبل الختم
const before = await p.evaluate(async id => { const r=WR._records().find(x=>x.id===id); const a=WR._atts(r)[0]; const bl=await (await fetch(URL.createObjectURL ? '' : '')).catch(()=>null); return a.size; }, rec.id).catch(()=>null);

// تحديد كمنجز من الواجهة
const btn = p.locator('#page-wared button[title="تحديد كمنجز"]').first();
ok(await btn.count()>0,'زر ✅ ظاهر للسجل');
await btn.click(); await p.waitForTimeout(500);
const info = await p.locator('.overlay .info-box').first().textContent();
ok(/منطقة فارغة/.test(info),'ورقة الإنجاز تذكر أن الختم في منطقة فارغة');
await p.fill('.overlay #wr-c-note','رُد عليه بكتاب رقم ٥٥');
await p.locator('.overlay [data-ok]').click(); await p.waitForTimeout(2000);

const after = await p.evaluate(async () => {
  const r = WR._records().find(x=>x.subject==='كتاب اختبار الختم');
  const a = WR._atts(r)[0];
  const db = await new Promise(res=>{ const q=indexedDB.open('fsdb_wared_atts'); q.onsuccess=()=>res(q.result); q.onerror=()=>res(null); });
  let blob=null;
  if(db){ const st=db.objectStoreNames[0]; blob = await new Promise(res=>{ const tx=db.transaction(st,'readonly'); const g=tx.objectStore(st).get(a.key); g.onsuccess=()=>res(g.result); g.onerror=()=>res(null); }); }
  if(!blob) return { status:r.status, note:r.notes, ok:false };
  const url = URL.createObjectURL(blob instanceof Blob ? blob : new Blob([blob]));
  const img = await new Promise(res=>{ const i=new Image(); i.onload=()=>res(i); i.onerror=()=>res(null); i.src=url; });
  if(!img) return { status:r.status, note:r.notes, ok:false };
  const c=document.createElement('canvas'); c.width=img.naturalWidth; c.height=img.naturalHeight;
  const g=c.getContext('2d',{willReadFrequently:true}); g.drawImage(img,0,0);
  const d=g.getImageData(0,0,c.width,c.height).data;
  let x0=1e9,y0=1e9,x1=-1,y1=-1,green=0;
  for(let y=0;y<c.height;y+=2) for(let x=0;x<c.width;x+=2){ const i=(y*c.width+x)*4;
    if(d[i+1]>d[i]+20 && d[i+1]>d[i+2]+20){ green++; if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y; } }
  return { status:r.status, completedAt:r.completedAt, note:r.notes, ok:true, green, x0,y0,x1,y1, h:c.height, dataUrl:c.toDataURL('image/png') };
});
ok(after.status==='منجز','الحالة صارت منجز');
ok(!!after.completedAt,'تاريخ الإنجاز انحفظ');
ok(/٥٥/.test(after.note||''),'الملاحظة انحفظت بالسجل');
ok(after.ok && after.green>500,'الختم الأخضر مطبوع على الصورة ('+after.green+' بكسل)');
ok(after.ok && after.y1 < after.h*0.56,'الختم في الفراغ العلوي لا أسفل الورقة (y1='+after.y1+' من '+after.h+')');
if(after.dataUrl) fs.writeFileSync(SHOT('stamp_e2e.png'), Buffer.from(after.dataUrl.split(',')[1],'base64'));
console.log('\n=== نجح ('+pass+') === فشل ('+fail.length+') ===');
fail.forEach(f=>console.log('  - '+f));
console.log('\n=== أخطاء الكونسول ===\n'+(errs.length?errs.join('\n'):'لا يوجد'));
await b.close(); process.exit(fail.length?1:0);
})();
