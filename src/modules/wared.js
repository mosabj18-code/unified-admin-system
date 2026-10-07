/* =====================================================================
   وحدة سجل الوارد والصادر — WR
   البيانات: localStorage wared_sader_records_v1 (مصفوفة records) | ملف الحفظ: IndexedDB fsdb_wared_sader
   ===================================================================== */
const WR = (function(){
'use strict';
const STORAGE_KEY = 'wared_sader_records_v1';
const OVERDUE_THRESHOLD = 3; // أيام
const MAX_FILE = 20 * 1024 * 1024; // حد الملف الواحد — المرفقات لم تعد في localStorage
let records = [];
let currentView = 'list', flashId = null;

const $id = id => document.getElementById('wr-' + id);
const notify  = (...a) => window.App ? App.notify(...a) : console.log(a);
const confirmD = o => window.App ? App.confirm(o) : Promise.resolve(window.confirm(o.title));
const vib = ms => window.App && App.vibrate(ms);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num = n => Number(n || 0).toLocaleString('ar-EG');
function localISO(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
const todayISO = () => localISO(new Date());
function fmtDate(iso){ if(!iso) return '—'; return new Intl.DateTimeFormat('ar-EG',{year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(iso+'T00:00:00')); }
function markInvalid(el){ if(!el) return; el.classList.remove('invalid'); void el.offsetWidth; el.classList.add('invalid'); el.focus(); const off=()=>el.classList.remove('invalid'); el.addEventListener('input',off,{once:true}); el.addEventListener('change',off,{once:true}); }
function kb(bytes){ return bytes > 1048576 ? (Math.round(bytes/104857.6)/10).toLocaleString('ar-EG') + ' م.ب' : Math.round(bytes/1024).toLocaleString('ar-EG') + ' ك.ب'; }
function dataUrlBytes(d){ const i = (d||'').indexOf(','); return i < 0 ? 0 : Math.round((d.length - i - 1) * 3 / 4); }

/* ---------- المرفقات ---------- */
/* المرفقات لم تعد داخل localStorage: الملف نفسه في IndexedDB (fsdb_wared_atts)،
   والسجل يحمل بياناته الوصفية فقط {key,name,type,size}. اختيارياً تُنسخ كملفات
   حقيقية في مجلد على جهاز المستخدم عبر File System Access. */
const ATT_DB = 'fsdb_wared_atts', ATT_STORE = 'atts';
const urlCache = new Map();
let attDirHandle = null, attDirName = '';
function attOpen(){
  return new Promise((res, rej) => {
    const q = indexedDB.open(ATT_DB, 1);
    q.onupgradeneeded = () => { if(!q.result.objectStoreNames.contains(ATT_STORE)) q.result.createObjectStore(ATT_STORE); };
    q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error);
  });
}
function attTx(mode, fn){
  return attOpen().then(db => new Promise((res, rej) => {
    const tx = db.transaction(ATT_STORE, mode), req = fn(tx.objectStore(ATT_STORE));
    tx.oncomplete = () => res(req && 'result' in req ? req.result : undefined);
    tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error);
  }));
}
const attPut  = (key, blob) => attTx('readwrite', st => st.put(blob, key));
const attGet  = key => attTx('readonly',  st => st.get(key));
const attDel  = key => attTx('readwrite', st => st.delete(key));
const attKeys = ()  => attTx('readonly',  st => st.getAllKeys());
function newKey(){ return 'at_' + Date.now().toString(36) + Math.random().toString(36).slice(2,7); }
function b64ToBlob(dataUrl){
  const head = String(dataUrl).slice(0, 60), mime = (head.match(/^data:([^;,]+)/) || [,'application/octet-stream'])[1];
  const bin = atob(String(dataUrl).slice(String(dataUrl).indexOf(',') + 1));
  const u = new Uint8Array(bin.length); for(let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return new Blob([u], { type:mime });
}
function blobToDataUrl(blob){ return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); }); }
async function attUrl(key){
  if(urlCache.has(key)) return urlCache.get(key);
  const blob = await attGet(key); if(!blob) return '';
  const u = URL.createObjectURL(blob); urlCache.set(key, u); return u;
}
async function attSrc(a){ return a && a.key ? await attUrl(a.key) : (a && a.data) || ''; }
async function attBlob(a){ return a && a.key ? await attGet(a.key) : (a && a.data ? b64ToBlob(a.data) : null); }
function attSize(a){ return a ? (a.size || dataUrlBytes(a.data)) : 0; }
async function attDataUrl(a){ if(a && a.data) return a.data; const b = await attBlob(a); return b ? await blobToDataUrl(b) : ''; }

function getAtts(r){
  if(Array.isArray(r.attachments)) return r.attachments.filter(a => a && (a.key || a.data));
  if(r.attachment) return [r.attachment];
  if(r.image) return [{ name:'صورة.jpg', type:'image/jpeg', data:r.image }];
  return [];
}
function getAtt(r){ return getAtts(r)[0] || null; }
function setAtts(rec, list){
  rec.attachments = (list || []).filter(a => a && a.key).map(a => ({ key:a.key, name:a.name, type:a.type, size:a.size || 0 }));
  delete rec.attachment; delete rec.image;   /* لم تعد الصور داخل السجل نفسه */
}
/* حذف أي ملف في المخزن لم يعد مرتبطاً بسجل */
async function gcAtts(){
  try {
    const used = new Set();
    records.forEach(r => getAtts(r).forEach(a => a.key && used.add(a.key)));
    const keys = await attKeys();
    for(const k of keys) if(!used.has(k)){ await attDel(k); const u = urlCache.get(k); if(u) URL.revokeObjectURL(u); urlCache.delete(k); }
  } catch(e){}
}
async function attStats(){
  let count = 0, bytes = 0;
  for(const r of records) for(const a of getAtts(r)){ count++; bytes += attSize(a); }
  return { count, bytes };
}

/* ---------- مجلد المرفقات على الجهاز ---------- */
const dirSupported = () => 'showDirectoryPicker' in window;
function safeName(s){ return String(s || '').replace(/[\\/:*?"<>|]/g, '-').slice(0, 80); }
function attFileName(rec, a){ return `${safeName(rec && rec.serial || 'بلا-رقم')}__${safeName(a.name || 'مرفق')}`; }
async function writeAttFile(rec, a, blob){
  if(!attDirHandle || !blob) return false;
  try {
    const fh = await attDirHandle.getFileHandle(attFileName(rec, a), { create:true });
    const w = await fh.createWritable(); await w.write(blob); await w.close(); return true;
  } catch(e){ return false; }
}
async function dirPermitted(){
  if(!attDirHandle) return false;
  try { return (await attDirHandle.queryPermission({ mode:'readwrite' })) === 'granted'; } catch(e){ return false; }
}
async function tryReconnectFolder(){
  try {
    const h = await idbGet('attdir'); if(!h) return;
    attDirHandle = h; attDirName = h.name || 'مجلد';
    if(!(await dirPermitted())) attDirHandle = null;   /* الإذن يُطلب عند أول استخدام */
    updateFolderStatus();
  } catch(e){}
}
async function linkAttFolder(){
  if(!dirSupported()) return notify({ type:'error', title:'المتصفح لا يدعم حفظ المرفقات في مجلد', msg:'هذه الميزة تعمل على Chrome أو Edge على الكمبيوتر. المرفقات محفوظة بأمان داخل التطبيق على كل حال.', log:false });
  try {
    const h = await window.showDirectoryPicker({ mode:'readwrite', id:'wr-atts' });
    attDirHandle = h; attDirName = h.name || 'مجلد';
    await idbSet('attdir', h);
    updateFolderStatus();
    notify({ type:'success', title:`تم ربط المجلد «${esc(attDirName)}»`, msg:'كل مرفق جديد يُحفظ فيه كملف حقيقي. اضغط «تصدير كل المرفقات» لنسخ المرفقات الحالية.', page:'wared',
      action:{ label:'تصدير كل المرفقات', fn:exportAllToFolder } });
  } catch(e){ if(e && e.name !== 'AbortError') notify({ type:'error', title:'تعذّر ربط المجلد', msg:e.message || '', log:false }); }
}
async function exportAllToFolder(){
  if(!attDirHandle) return linkAttFolder();
  let done = 0, failed = 0;
  for(const r of records) for(const a of getAtts(r)){
    const blob = await attBlob(a);
    (await writeAttFile(r, a, blob)) ? done++ : failed++;
  }
  updateFolderStatus();
  notify({ type: failed ? 'warning' : 'success', title: failed ? `صُدِّر ${num(done)} مرفق و تعذّر ${num(failed)}` : `تم تصدير ${num(done)} مرفق للمجلد`,
    msg: failed ? 'تأكد أن إذن الكتابة على المجلد ممنوح ثم أعد المحاولة.' : `تجدها في المجلد «${esc(attDirName)}» بأسماء تبدأ برقم الكتاب.`, page:'wared' });
}
async function unlinkAttFolder(){
  attDirHandle = null; attDirName = ''; await idbSet('attdir', null);
  updateFolderStatus();
  notify({ type:'info', title:'تم فك ربط المجلد', msg:'الملفات الموجودة فيه تبقى كما هي. المرفقات محفوظة داخل التطبيق.', log:false });
}
async function updateFolderStatus(){
  const el = $id('att-status'); if(!el) return;
  const st = await attStats();
  el.innerHTML = `<div class="wr-storage">${ico('backup', 26)}<div class="grow">
      <b>${num(st.count)} مرفق — ${kb(st.bytes)}</b>
      <small>محفوظة في مخزن التطبيق الكبير (IndexedDB)، خارج مساحة الـ٥ ميغا المشتركة.</small>
      <small>${attDirHandle ? `مرتبط بالمجلد: <b>${esc(attDirName)}</b> — كل مرفق جديد يُنسخ فيه.` : dirSupported() ? 'غير مرتبط بمجلد على الجهاز.' : 'حفظ المرفقات في مجلد غير مدعوم في هذا المتصفح.'}</small>
    </div></div>`;
}

/* ---------- ترحيل المرفقات القديمة من localStorage ---------- */
async function migrateInlineAtts(){
  let moved = 0, freed = 0;
  for(const r of records){
    const list = getAtts(r);
    if(!list.length || !list.some(a => !a.key)) continue;
    const out = [];
    for(const a of list){
      if(a.key){ out.push(a); continue; }
      try {
        const blob = b64ToBlob(a.data), key = newKey();
        await attPut(key, blob);
        const meta = { key, name:a.name || 'مرفق', type:a.type || blob.type, size:blob.size };
        freed += dataUrlBytes(a.data); moved++;
        out.push(meta);
        if(attDirHandle) await writeAttFile(r, meta, blob);
      } catch(e){}
    }
    setAtts(r, out);
  }
  if(!moved) return;
  if(!save()) return;
  render();
  notify({ type:'success', title:`نُقل ${num(moved)} مرفق خارج مساحة المتصفح`, duration:9000, page:'wared',
    msg:`تحرّر ${kb(freed)} من المساحة المشتركة. المرفقات صارت في مخزن التطبيق الكبير، والسجلات كما هي.` });
}
function isImg(att){ return !!(att && att.type && att.type.startsWith('image/')); }
function fileExtLabel(name){ const ext = (name || '').split('.').pop().toUpperCase(); return ext.length <= 5 ? ext : 'FILE'; }
function viewAttachment(id, start){
  const r = records.find(x=>x.id===id); if(!r) return;
  const atts = getAtts(r); if(!atts.length) return;
  vib(8);
  let i = Math.min(Math.max(+start || 0, 0), atts.length - 1);
  if(atts.length === 1 && !isImg(atts[0])){ downloadAtt(atts[0]); return notify({ type:'info', title:'جارٍ تنزيل المرفق', msg:atts[0].name || 'مرفق', log:false }); }
  const s = App.sheet(`<div class="mk-form-head">${ico('inbox')}<div><h3>${esc(r.serial || '')} — ${esc(r.entity)}</h3><p id="wr-v-name"></p></div></div>
    ${atts.length > 1 ? `<div class="wr-thumbs" id="wr-v-thumbs"></div>` : ''}
    <div id="wr-v-main"></div>
    <div class="actions"><button class="btn" data-dl>تنزيل هذا المرفق</button><button class="btn btn-primary" data-x data-autofocus>إغلاق</button></div>`, { cls:'wide' });
  const qv = sel => s.ov.querySelector(sel);
  const draw = async () => {
    const a = atts[i];
    qv('#wr-v-name').textContent = `${a.name || 'مرفق'}${atts.length > 1 ? ` — ${num(i+1)} من ${num(atts.length)}` : ''}`;
    if(isImg(a)){
      const src = await attSrc(a);
      qv('#wr-v-main').innerHTML = src ? `<img class="wr-viewer" src="${src}" alt="مرفق الكتاب">`
        : `<div class="mk-banner bad">تعذّر العثور على ملف هذا المرفق في مخزن التطبيق.</div>`;
    } else qv('#wr-v-main').innerHTML = `<div class="info-box">هذا المرفق ${esc(fileExtLabel(a.name))} ولا يُعرض داخل التطبيق — اضغط «تنزيل هذا المرفق» لفتحه.</div>`;
    const th = qv('#wr-v-thumbs');
    if(th){
      th.innerHTML = atts.map((x, k) => isImg(x) ? `<img class="${k===i?'sel':''}" alt="" data-i="${k}" data-k="${x.key || ''}">`
        : `<div class="fchip ${k===i?'sel':''}" data-i="${k}">${esc(fileExtLabel(x.name))}</div>`).join('');
      th.querySelectorAll('[data-i]').forEach(el => el.onclick = () => { i = +el.dataset.i; draw(); vib(5); });
      for(const el of th.querySelectorAll('img[data-i]')){ const src = await attSrc(atts[+el.dataset.i]); if(src) el.src = src; }
    }
  };
  draw();
  qv('[data-x]').onclick = () => s.close();
  qv('[data-dl]').onclick = () => downloadAtt(atts[i]);
}
async function downloadAtt(att){
  const href = await attSrc(att);
  if(!href) return notify({ type:'error', title:'تعذّر العثور على ملف المرفق', msg:'قد يكون حُذف من مخزن التطبيق. استعده من نسخة احتياطية.', log:false });
  const a = document.createElement('a'); a.href = href; a.download = att.name || 'مرفق'; document.body.appendChild(a); a.click(); a.remove();
}

/* ---------- الحفظ ---------- */
function save(){
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(records)); }
  catch(e){
    notify({ type:'error', title:'تعذّر الحفظ: مساحة المتصفح ممتلئة', msg:'بيانات الوحدات الأخرى ملأت المساحة المشتركة. انزل نسخة احتياطية ثم خفّف السجلات القديمة.', page:'wared', duration:0 });
    return false;
  }
  writeToLinkedFile();
  window.App && App.refresh();
  return true;
}
function load(){ try { records = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); if(!Array.isArray(records)) records = []; } catch(e){ records = []; } }

/* ---------- ربط ملف حفظ ---------- */
let fileHandle=null;
const FS_DB_NAME='fsdb_wared_sader';
function idbOpen(){ return new Promise((resolve,reject)=>{ const req=indexedDB.open(FS_DB_NAME,1); req.onupgradeneeded=()=>req.result.createObjectStore('handles'); req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error); }); }
async function idbSet(key,val){ try{ const db=await idbOpen(); return new Promise((resolve,reject)=>{ const tx=db.transaction('handles','readwrite'); tx.objectStore('handles').put(val,key); tx.oncomplete=()=>resolve(true); tx.onerror=()=>reject(tx.error); }); }catch(e){return false;} }
async function idbGet(key){ try{ const db=await idbOpen(); return new Promise((resolve,reject)=>{ const tx=db.transaction('handles','readonly'); const req=tx.objectStore('handles').get(key); req.onsuccess=()=>resolve(req.result||null); req.onerror=()=>reject(req.error); }); }catch(e){return null;} }
function fsSupported(){ return 'showSaveFilePicker' in window; }
let linkText = '', linkOk = false;
function updateLinkStatus(text, ok){ linkText = text; linkOk = ok; const el = $id('link-status'); if(el){ el.textContent = text; el.className = 'pill ' + (ok ? 'ok' : 'mid'); el.hidden = !text; } }
async function linkSaveFile(){
  vib(10);
  if(!fsSupported()) return notify({ type:'warning', title:'ربط الملف غير مدعوم هنا', msg:'تعمل في Chrome وEdge على الكمبيوتر. استخدم النسخ الاحتياطي بدلاً منها.', action:{ label:'النسخ الاحتياطي', fn:() => App.switchModule('backup') } });
  try{
    const handle = await window.showSaveFilePicker({ suggestedName:'بيانات_سجل_الوارد_والصادر.json', types:[{description:'JSON',accept:{'application/json':['.json']}}] });
    let data = null, imported = false;
    try{ const text = await (await handle.getFile()).text(); if(text && text.trim()){ const d = JSON.parse(text); if(Array.isArray(d)) data = d; } }catch(e){}
    if(data){
      const ok = await confirmD({ title:'الملف فيه بيانات محفوظة', msg:`يحتوي ${num(data.length)} سجل. هل تستوردها؟ (تُستبدل سجلات الوارد والصادر الحالية)`, okText:'استيراد البيانات', cancelText:'الإبقاء على بياناتي', icon:'inbox' });
      if(ok){ records.length = 0; data.forEach(r => records.push(r)); imported = true; }
    }
    fileHandle = handle; await idbSet('handle', handle);
    if(imported){ save(); renderAll(); } else await writeToLinkedFile();
    updateLinkStatus('مربوط: ' + handle.name, true);
    notify({ type:'success', title: imported ? 'تم ربط الملف واستيراد بياناته' : 'تم ربط ملف الحفظ', msg:'كل عملية حفظ تُكتب تلقائياً في «' + handle.name + '».', page:'wared' });
  }catch(e){ if(e.name!=='AbortError') notify({ type:'error', title:'تعذّر ربط الملف', msg:'السبب: ' + e.message, page:'wared' }); }
}
let writeWarned = false;
async function writeToLinkedFile(){
  if(!fileHandle) return;
  try{
    const perm = await fileHandle.queryPermission({mode:'readwrite'});
    if(perm!=='granted'){ const req = await fileHandle.requestPermission({mode:'readwrite'}); if(req!=='granted'){ if(!writeWarned){ writeWarned = true; notify({ type:'warning', title:'لم يُحدَّث ملف الحفظ المربوط', msg:'البيانات محفوظة بالتطبيق، لكن الملف يحتاج إذناً. اضغط «ربط ملف حفظ».', page:'wared' }); } return; } }
    const writable = await fileHandle.createWritable(); await writable.write(JSON.stringify(records,null,2)); await writable.close(); writeWarned = false;
  }catch(e){}
}
async function tryReconnectFile(){
  if(!fsSupported()) return;
  try{ const handle = await idbGet('handle'); if(!handle) return; const perm = await handle.queryPermission({mode:'readwrite'});
    if(perm==='granted'){ fileHandle = handle; updateLinkStatus('مربوط: ' + handle.name, true); }
    else if(perm==='prompt'){ fileHandle = handle; updateLinkStatus('اضغط «ربط ملف حفظ» للسماح مجدداً', false); } }catch(e){}
}

/* ---------- المنطق ---------- */
// إصلاح: الرقم التسلسلي = أكبر رقم لنفس النوع والسنة + 1 (لا يتكرر بعد الحذف)
function generateSerial(type, dateStr){
  const year = dateStr ? +dateStr.slice(0,4) : new Date().getFullYear();
  const prefix = type === 'وارد' ? 'و' : 'ص';
  const maxSeq = records.filter(r => r.type === type && r.serial && r.serial.startsWith(`${prefix}-${year}-`))
    .reduce((m, r) => Math.max(m, parseInt(r.serial.split('-')[2], 10) || 0), 0);
  return `${prefix}-${year}-${String(maxSeq + 1).padStart(3,'0')}`;
}
function daysSince(dateStr){ if(!dateStr) return 0; const then = new Date(dateStr + 'T00:00:00'); return Math.floor((Date.now() - then) / 86400000); }
const isOverdue = r => r.status === 'قيد المعالجة' && daysSince(r.date) > OVERDUE_THRESHOLD;
function statusPill(s){ return s === 'منجز' ? '<span class="pill ok">منجز</span>' : s === 'قيد المعالجة' ? '<span class="pill info">قيد المعالجة</span>' : '<span class="pill mid">معلّق</span>'; }
function typePill(t){ return t === 'وارد' ? '<span class="pill ok">وارد</span>' : '<span class="pill" style="background:rgba(227,154,97,.18);color:#b8662b">صادر</span>'; }

/* ---------- الواجهة ---------- */
const VIEWS = [['list','السجلات','checklist'], ['dash','لوحة المعلومات','chart'], ['settings','إعدادات السجل','settings']];
function buildUI(){
  const root = document.getElementById('page-wared');
  root.removeAttribute('data-placeholder');
  root.innerHTML = `
  <div class="mk-head" style="--tint:rgba(139,92,246,.15)">
    <div class="tile">${ico('wared')}</div>
    <div class="grow"><h2>سجل الوارد والصادر</h2><p>دائرة الشؤون الإدارية والمالية والإمداد — توثيق المعاملات الرسمية</p></div>
    <div class="mk-tools">
      <button class="btn btn-primary" onclick="WR.openForm('وارد')">وارد جديد</button>
      <button class="btn" onclick="WR.openForm('صادر')">صادر جديد</button>
    </div>
  </div>
  <div class="mk-tabs" role="tablist">${VIEWS.map(([v,l,i]) => `<button class="mk-tab${v==='list'?' active':''}" id="wr-tab-${v}" onclick="WR.showView('${v}')">${ico(i)}${l}${v==='list'?'<span class="badge num" id="wr-late-badge"></span>':''}</button>`).join('')}</div>

  <section class="mk-view active" id="wr-view-list">
    <div id="wr-banner"></div>
    <div class="mk-kpis">
      <button class="mk-card mk-kpi good" onclick="WR.quickFilter('type','وارد')"><small>إجمالي الوارد</small><b id="wr-st-in">0</b></button>
      <button class="mk-card mk-kpi" style="--x:0" onclick="WR.quickFilter('type','صادر')"><small>إجمالي الصادر</small><b id="wr-st-out" style="color:#b8662b">0</b></button>
      <button class="mk-card mk-kpi info" onclick="WR.quickFilter('status','قيد المعالجة')"><small>قيد المعالجة</small><b id="wr-st-pend">0</b></button>
      <button class="mk-card mk-kpi" onclick="WR.quickFilter('','')"><small>إجمالي السجلات</small><b id="wr-st-total">0</b></button>
    </div>
    <div class="mk-toolbar">
      <input class="mk-inp" type="search" id="wr-q" placeholder="بحث بالجهة أو الموضوع أو المرجع أو الرقم…" oninput="WR.render()">
      <select class="mk-inp" id="wr-f-type" onchange="WR.render()"><option value="">كل الأنواع</option><option value="وارد">وارد فقط</option><option value="صادر">صادر فقط</option></select>
      <select class="mk-inp" id="wr-f-status" onchange="WR.render()"><option value="">كل الحالات</option><option value="منجز">منجز</option><option value="قيد المعالجة">قيد المعالجة</option><option value="معلّق">معلّق</option></select>
    </div>
    <div class="mk-card mk-table-card">
      <div class="mk-table-head"><h3>السجلات <span class="pill info num" id="wr-count">0</span></h3>
        <div class="row"><button class="btn btn-sm" onclick="WR.printReport()">تقرير PDF</button><button class="btn btn-sm" onclick="WR.exportCsv()">تصدير CSV</button></div></div>
      <div id="wr-selbar"></div>
      <div class="mk-scroll"><table class="mk-table"><thead><tr><th style="width:34px"><input type="checkbox" class="wr-chk" id="wr-chk-all" title="تحديد الكل" onclick="WR.toggleAll(this.checked)"></th><th>الرقم</th><th>المرفقات</th><th>التاريخ</th><th>النوع</th><th>الجهة</th><th>الموضوع</th><th>المرجع</th><th>الحالة</th><th>ملاحظات</th><th></th></tr></thead><tbody id="wr-body"></tbody></table></div>
    </div>
  </section>

  <section class="mk-view" id="wr-view-dash">
    <div class="mk-card mk-pad mk-section">
      <div class="mk-title"><span>الحركة الشهرية <span class="muted num" id="wr-year" style="font-weight:500;font-size:13px"></span></span>
        <span class="wr-legend"><span><i style="background:var(--accent)"></i>وارد</span><span><i style="background:#E39A61"></i>صادر</span></span></div>
      <div class="wr-chart" id="wr-chart"></div>
    </div>
    <div class="mk-kpis">
      <button class="mk-card mk-kpi info" onclick="WR.quickFilter('status','قيد المعالجة')"><small>قيد المعالجة</small><b id="wr-d-pend">0</b></button>
      <button class="mk-card mk-kpi bad" onclick="WR.gotoOverdue()"><small>متأخرة (+${num(OVERDUE_THRESHOLD)} أيام)</small><b id="wr-d-late">0</b></button>
      <div class="mk-card mk-kpi good"><small>منجزة هذا الشهر</small><b id="wr-d-done">0</b></div>
      <div class="mk-card mk-kpi"><small>مساحة المرفقات</small><b id="wr-d-size" style="font-size:20px">0</b></div>
    </div>
  </section>

  <section class="mk-view" id="wr-view-settings">
    <div class="mk-card mk-pad mk-section">
      <div class="mk-title"><span>الترويسة الرسمية</span></div>
      <p class="mk-hint">تُطبع أعلى تقرير السجل وسندات المخازن. تُضبط مرة واحدة من إعدادات التطبيق وتُستخدم في كل الوحدات.</p>
      <div class="row" style="justify-content:flex-start"><span id="wr-lh"></span><button class="btn btn-sm" onclick="App.switchModule('settings')">إدارة الترويسة</button></div>
    </div>
    <div class="mk-card mk-pad mk-section">
      <div class="mk-title"><span>تخزين المرفقات</span></div>
      <p class="mk-hint">المرفقات محفوظة في مخزن التطبيق الكبير داخل المتصفح (مئات الميغابايت)، مش في المساحة المشتركة الصغيرة. تقدر كمان تربط مجلداً على جهازك فتُنسخ فيه كملفات حقيقية تفتحها وتنسخها متى بدك.</p>
      <div id="wr-att-status"></div>
      <div class="row" style="justify-content:flex-start;margin-top:10px">
        <button class="btn" onclick="WR.linkAttFolder()">ربط مجلد المرفقات</button>
        <button class="btn" onclick="WR.exportAllToFolder()">تصدير كل المرفقات للمجلد</button>
        <button class="btn btn-ghost" onclick="WR.unlinkAttFolder()">فك الربط</button>
      </div>
    </div>
    <div class="mk-card mk-pad mk-section">
      <div class="mk-title"><span>ملف الحفظ والبيانات القديمة</span><span id="wr-link-status" class="pill" hidden></span></div>
      <p class="mk-hint">النسخة الاحتياطية الكاملة من «النسخ الاحتياطي» تشمل السجل ومرفقاته. هنا تقدر تربط ملف حفظ، أو تستورد ملف الحفظ من تطبيق الوارد والصادر المستقل.</p>
      <div class="row" style="justify-content:flex-start"><button class="btn" onclick="WR.linkSaveFile()">ربط ملف حفظ</button>
        <label class="btn">استيراد بيانات قديمة<input type="file" accept="application/json,.json" hidden onchange="WR.importLegacy(event)"></label></div>
    </div>
  </section>`;
}
function showView(v, silent){
  currentView = v;
  VIEWS.forEach(([k]) => { $id('view-'+k).classList.toggle('active', k===v); $id('tab-'+k).classList.toggle('active', k===v); });
  if(v==='dash') renderDashboard();
  if(v==='settings'){ updateFolderStatus(); updateLinkStatus(linkText, linkOk); const lh = App.letterhead(); $id('lh').innerHTML = lh ? `<img class="lh-prev" src="${lh}" alt="الترويسة">` : '<span class="pill mid">لم تُرفع ترويسة بعد</span>'; }
  if(silent !== true) vib(8);
}

/* ---------- الجدول ---------- */
function filtered(){
  const q = $id('q').value.trim().toLowerCase(), typeF = $id('f-type').value, statusF = $id('f-status').value;
  return records.filter(r => {
    const matchQ = !q || [r.entity, r.subject, r.ref, r.notes, r.serial].join(' ').toLowerCase().includes(q);
    return matchQ && (!typeF || r.type === typeF) && (!statusF || r.status === statusF);
  }).sort((a,b) => (b.date||'').localeCompare(a.date||'') || (b.serial||'').localeCompare(a.serial||''));
}
function render(){
  const list = filtered();
  $id('count').textContent = num(list.length);
  const body = $id('body');
  selected.forEach(id => { if(!records.some(r => r.id === id)) selected.delete(id); });
  if(!list.length) body.innerHTML = `<tr><td colspan="11" class="mk-empty">${records.length ? 'لا توجد سجلات مطابقة للبحث.' : 'لا توجد سجلات بعد. ابدأ بـ«وارد جديد» أو «صادر جديد».'}</td></tr>`;
  else body.innerHTML = list.map(r => {
    const atts = getAtts(r), att = atts[0], late = isOverdue(r);
    const first = att ? (isImg(att) ? `<img class="thumb" ${att.key ? `data-k="${att.key}"` : `src="${att.data}"`} alt="" onclick="WR.viewAttachment('${r.id}',0)">` : `<div class="fchip" title="${esc(att.name||'')}" onclick="WR.viewAttachment('${r.id}',0)">${esc(fileExtLabel(att.name))}</div>`) : '<span class="nochip">—</span>';
    const attCell = atts.length > 1
      ? `<div class="attwrap">${first}<button class="attmore" title="عرض كل المرفقات" onclick="WR.viewAttachment('${r.id}',1)">+${num(atts.length-1)}</button></div>` : first;
    return `<tr class="${late?'overdue':''}${r.id===flashId?' row-new':''}">
      <td><input type="checkbox" class="wr-chk" ${selected.has(r.id)?'checked':''} aria-label="تحديد السجل ${esc(r.serial||'')}" onclick="WR.toggleSel('${r.id}',this.checked)"></td>
      <td><span class="serial">${esc(r.serial || '-')}</span></td><td>${attCell}</td><td class="num">${fmtDate(r.date)}</td><td>${typePill(r.type)}</td>
      <td>${esc(r.entity)}</td><td class="subj">${esc(r.subject)}${late ? `<span class="pill high late">متأخر ${num(daysSince(r.date))} يوم</span>` : ''}</td>
      <td>${esc(r.ref || '—')}</td><td>${statusPill(r.status)}</td><td class="wrap muted" style="max-width:220px">${esc(r.notes || '—')}</td>
      <td><div class="acts">${r.status !== 'منجز' ? `<button class="ib" title="تحديد كمنجز" aria-label="تحديد كمنجز" onclick="WR.markComplete('${r.id}')">✅</button>` : ''}
        <button class="ib" title="تعديل" aria-label="تعديل" onclick="WR.editRecord('${r.id}')">✏️</button><button class="ib del" title="حذف" aria-label="حذف" onclick="WR.deleteRecord('${r.id}')">🗑</button></div></td></tr>`;
  }).join('');
  flashId = null;
  hydrateThumbs();
  renderSelBar();
  $id('st-in').textContent = num(records.filter(r=>r.type==='وارد').length);
  $id('st-out').textContent = num(records.filter(r=>r.type==='صادر').length);
  $id('st-pend').textContent = num(records.filter(r=>r.status==='قيد المعالجة').length);
  $id('st-total').textContent = num(records.length);
  const late = records.filter(isOverdue);
  $id('banner').innerHTML = late.length ? `<div class="mk-banner bad">${ico('warning')}<span class="grow">يوجد <b>${num(late.length)}</b> معاملة «قيد المعالجة» متأخرة أكثر من ${num(OVERDUE_THRESHOLD)} أيام دون إنجاز.</span><button class="btn btn-sm btn-danger" onclick="WR.gotoOverdue()">عرضها</button></div>` : '';
  const b = $id('late-badge'); b.textContent = late.length ? num(late.length) : ''; b.classList.toggle('show', late.length > 0);
}
/* ---------- تحديد السجلات للطباعة ---------- */
const selected = new Set();
function selectedList(){ return filtered().filter(r => selected.has(r.id)); }
function toggleSel(id, on){ if(on) selected.add(id); else selected.delete(id); renderSelBar(); syncAllBox(); vib(4); }
function toggleAll(on){
  const list = filtered();
  list.forEach(r => on ? selected.add(r.id) : selected.delete(r.id));
  render(); vib(8);
}
function clearSel(){ selected.clear(); render(); vib(6); }
function syncAllBox(){
  const box = $id('chk-all'); if(!box) return;
  const list = filtered();
  const on = list.length > 0 && list.every(r => selected.has(r.id));
  box.checked = on;
  box.indeterminate = !on && list.some(r => selected.has(r.id));
}
function renderSelBar(){
  const bar = $id('selbar'); if(!bar) return;
  const list = selectedList();
  const withAtt = list.filter(r => getAtts(r).some(isImg)).length;
  bar.innerHTML = !list.length ? '' : `<div class="selbar">${ico('checklist',22)}
    <span class="grow">محدَّد: <b class="num">${num(list.length)}</b> سجل${withAtt ? ` — منها <b class="num">${num(withAtt)}</b> فيها صور مرفقة` : ''}</span>
    <button class="btn btn-sm btn-primary" onclick="WR.printSelected()">طباعة كشف المحدد</button>
    <button class="btn btn-sm" onclick="WR.printBooks()">طباعة الكتب المرفقة</button>
    <button class="btn btn-sm btn-ghost" onclick="WR.clearSel()">إلغاء التحديد</button></div>`;
  syncAllBox();
}

async function hydrateThumbs(){
  for(const el of document.querySelectorAll('#page-wared .thumb[data-k]')){
    const src = await attUrl(el.dataset.k);
    if(src){ el.src = src; el.removeAttribute('data-k'); } else { el.replaceWith(Object.assign(document.createElement('div'), { className:'fchip', textContent:'؟', title:'ملف المرفق غير موجود' })); }
  }
}
function quickFilter(kind, val){
  $id('f-type').value = kind==='type' ? val : ''; $id('f-status').value = kind==='status' ? val : ''; $id('q').value = ''; selected.clear();
  showView('list', true); render(); vib(8);
}
function gotoOverdue(){ quickFilter('status','قيد المعالجة'); }

/* ---------- لوحة المعلومات ---------- */
const MONTH_NAMES = ['ينا','فبر','مار','أبر','ماي','يون','يول','أغس','سبت','أكت','نوف','ديس'];
function renderDashboard(){
  const now = new Date(), year = now.getFullYear();
  $id('year').textContent = `(${num(year).replace(/٬/g,'')})`;
  const monthly = Array.from({length:12}, () => ({in:0, out:0}));
  records.forEach(r => { if(!r.date || +r.date.slice(0,4) !== year) return; const m = +r.date.slice(5,7) - 1; if(r.type==='وارد') monthly[m].in++; else monthly[m].out++; });
  const maxVal = Math.max(1, ...monthly.map(m => Math.max(m.in, m.out)));
  $id('chart').innerHTML = monthly.map((m, i) => `<div class="wr-col${i===now.getMonth()?' now':''}"><div class="wr-bars">
    <div class="wr-bar in" style="height:${(m.in/maxVal*100).toFixed(0)}%" title="وارد: ${m.in}"></div><div class="wr-bar out" style="height:${(m.out/maxVal*100).toFixed(0)}%" title="صادر: ${m.out}"></div></div><small>${MONTH_NAMES[i]}</small></div>`).join('');
  const ym = todayISO().slice(0,7);
  $id('d-pend').textContent = num(records.filter(r=>r.status==='قيد المعالجة').length);
  $id('d-late').textContent = num(records.filter(isOverdue).length);
  $id('d-done').textContent = num(records.filter(r => r.status==='منجز' && (r.completedAt || r.date || '').slice(0,7) === ym).length);
  $id('d-size').textContent = kb(records.reduce((s,r) => s + getAtts(r).reduce((t,a) => t + attSize(a), 0), 0));
}

/* ---------- نموذج الإضافة / التعديل ---------- */
function openForm(type, existing){
  vib(10);
  const ex = existing || null;
  let atts = ex ? getAtts(ex).slice() : [];
  const t = ex ? ex.type : type;
  const html = `
    <div class="mk-form-head">${ico(t==='وارد'?'inbox':'outbox')}<div><h3>${ex ? 'تعديل السجل ' + esc(ex.serial||'') : (t==='وارد' ? 'تسجيل كتاب وارد' : 'تسجيل كتاب صادر')}</h3><p>${ex ? 'تقدر تغيّر النوع — عندها يُعطى رقم تسلسلي جديد بتسلسل النوع الجديد.' : 'يُعطى رقم تسلسلي تلقائي عند الحفظ.'}</p></div></div>
    <div class="mk-grid-2">
      <div class="mk-field"><label for="wr-e-date">التاريخ <i>*</i></label><input class="mk-inp" type="date" id="wr-e-date" value="${ex ? ex.date : todayISO()}"></div>
      <div class="mk-field"><label>النوع</label><div class="mk-seg" id="wr-e-type"><button type="button" data-val="وارد" aria-pressed="${t==='وارد'}">وارد</button><button type="button" data-val="صادر" aria-pressed="${t==='صادر'}">صادر</button></div></div>
    </div>
    <div class="mk-grid-2">
      <div class="mk-field"><label for="wr-e-entity">الجهة <i>*</i></label><input class="mk-inp" type="text" id="wr-e-entity" list="wr-entities" placeholder="الجهة المرسلة / المستقبلة" value="${esc(ex ? ex.entity : '')}"><datalist id="wr-entities">${[...new Set(records.map(r=>r.entity).filter(Boolean))].map(e=>`<option value="${esc(e)}">`).join('')}</datalist></div>
      <div class="mk-field"><label for="wr-e-ref">رقم المرجع</label><input class="mk-inp" type="text" id="wr-e-ref" placeholder="مثال: 2026/014" value="${esc(ex ? ex.ref||'' : '')}"></div>
    </div>
    <div class="mk-field"><label for="wr-e-subject">الموضوع / الوصف <i>*</i></label><textarea class="mk-inp" id="wr-e-subject" placeholder="وصف مختصر للمعاملة">${esc(ex ? ex.subject : '')}</textarea></div>
    <div class="mk-field"><label for="wr-e-status">الحالة</label><select class="mk-inp" id="wr-e-status">${['قيد المعالجة','منجز','معلّق'].map(s=>`<option${(ex ? ex.status : (t==='وارد'?'قيد المعالجة':'منجز'))===s?' selected':''}>${s}</option>`).join('')}</select></div>
    <div class="mk-field"><label for="wr-e-notes">ملاحظات</label><textarea class="mk-inp" id="wr-e-notes" placeholder="اختياري">${esc(ex ? ex.notes||'' : '')}</textarea></div>
    <div class="mk-field"><label>مرفقات الكتاب (صور / PDF / Word — أكثر من ملف)</label><div id="wr-e-att"></div></div>
    <div class="actions"><button class="btn btn-primary" data-save data-autofocus>${ex ? 'حفظ التعديل' : 'حفظ السجل'}</button><button class="btn" data-cancel>إلغاء</button></div>`;
  let saved = false;
  const sheet = App.sheet(html, { cls:'wide', onClose: () => { if(!saved) notify({ type:'info', title: ex ? 'تم إلغاء التعديل' : 'لم يُحفظ السجل', msg:'أُغلق النموذج دون حفظ.', log:false, duration:2400 }); } });
  const ov = sheet.ov, q = s => ov.querySelector(s);
  let typeVal = t;
  q('#wr-e-type').addEventListener('click', e => { const b = e.target.closest('button'); if(!b || b.disabled) return; typeVal = b.dataset.val; ov.querySelectorAll('#wr-e-type button').forEach(x => x.setAttribute('aria-pressed', x===b)); if(!statusTouched) q('#wr-e-status').value = typeVal==='وارد' ? 'قيد المعالجة' : 'منجز'; vib(6); });
  let statusTouched = false; q('#wr-e-status').addEventListener('change', () => statusTouched = true);
  const ACCEPT = 'image/*,.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const addFiles = async (files) => {
    let added = 0, savedBytes = 0;
    for(const file of files){
      try {
        if(file.type.startsWith('image/')){
          const data = await App.compressImage(file, 1800, 0.82);
          const blob = b64ToBlob(data);
          atts.push({ blob, name:file.name.replace(/\.(heic|png|webp|bmp)$/i, '.jpg'), type:'image/jpeg', size:blob.size });
          added++; savedBytes += file.size - blob.size;
        } else {
          if(file.size > MAX_FILE){ notify({ type:'error', title:`الملف «${file.name}» أكبر من الحد`, msg:`حجمه ${kb(file.size)} والحد ${kb(MAX_FILE)} للملف الواحد.`, log:false }); continue; }
          atts.push({ blob:file, name:file.name, type:file.type || 'application/octet-stream', size:file.size }); added++;
        }
      } catch(e){ notify({ type:'error', title:`تعذّرت قراءة «${file.name}»`, msg:'جرّب ملفاً آخر.', log:false }); }
    }
    if(added) notify({ type:'success', title: added === 1 ? 'تم إرفاق ملف' : `تم إرفاق ${num(added)} ملفات`, msg:`إجمالي المرفقات على الكتاب: ${num(atts.length)}${savedBytes > 0 ? ` — وُفِّر ${kb(savedBytes)} بضغط الصور` : ''}.`, log:false, duration:2800 });
    drawAtt();
  };
  const attPrev = a => a.blob ? (a._u || (a._u = URL.createObjectURL(a.blob))) : '';
  const drawAtt = async () => {
    q('#wr-e-att').innerHTML = `<div class="wr-atts">${atts.map((a, i) => `<div class="wr-att">${isImg(a) ? `<img data-p="${i}" alt="">` : `<div class="fchip">${esc(fileExtLabel(a.name))}</div>`}
        <div class="grow"><b>${esc(a.name || 'مرفق')}</b><small>${kb(a.size || 0)}${isImg(a) ? ' — يُختم عند التحديد كمنجز' : ''}</small></div>
        <button type="button" class="btn btn-sm btn-ghost" data-rm="${i}">إزالة</button></div>`).join('')}
      <label class="wr-att" style="cursor:pointer"><div class="fchip">📎</div>
        <div class="grow"><b>${atts.length ? 'إضافة مرفق آخر' : 'اختيار ملف'}</b><small>${atts.length ? `المرفقات الحالية: ${num(atts.length)} — ` : ''}تقدر تختار أكثر من ملف مرة واحدة، والصور تُضغط تلقائياً</small></div>
        <input type="file" multiple hidden data-file accept="${ACCEPT}"></label></div>`;
    for(const el of q('#wr-e-att').querySelectorAll('img[data-p]')){
      const a = atts[+el.dataset.p], src = a.blob ? attPrev(a) : await attSrc(a);
      if(src) el.src = src;
    }
    const fi = q('[data-file]');
    fi.addEventListener('change', async () => { const files = [...fi.files]; fi.value = ''; if(files.length) await addFiles(files); });
    ov.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { atts.splice(+b.dataset.rm, 1); drawAtt(); vib(6); });
  };
  drawAtt();
  q('[data-cancel]').onclick = () => sheet.close();
  q('[data-save]').onclick = async () => {
    const data = { date:q('#wr-e-date').value, type:typeVal, entity:q('#wr-e-entity').value.trim(), ref:q('#wr-e-ref').value.trim(),
      status:q('#wr-e-status').value, subject:q('#wr-e-subject').value.trim(), notes:q('#wr-e-notes').value.trim() };
    if(!data.date){ markInvalid(q('#wr-e-date')); return notify({ type:'error', title:'التاريخ مطلوب', log:false }); }
    if(!data.entity){ markInvalid(q('#wr-e-entity')); return notify({ type:'error', title:'الجهة مطلوبة', msg:'اكتب الجهة المرسلة أو المستقبلة.', log:false }); }
    if(!data.subject){ markInvalid(q('#wr-e-subject')); return notify({ type:'error', title:'الموضوع مطلوب', msg:'اكتب وصفاً مختصراً للمعاملة.', log:false }); }
    if(data.ref){ const dup = records.find(r => r.id !== (ex && ex.id) && r.ref && r.ref === data.ref && r.type === data.type); if(dup) notify({ type:'warning', title:'رقم المرجع مستخدم سابقاً', msg:`نفس المرجع موجود في ${dup.serial} (${dup.entity}). حُفظ السجل، راجع إذا كان تكراراً.`, log:false }); }
    let newSerial = null, oldSerial = ex && ex.serial;
    if(ex && data.type !== ex.type){
      newSerial = generateSerial(data.type, data.date);
      const ok = await confirmD({ title:`تحويل السجل من ${ex.type} إلى ${data.type}؟`,
        msg:`الرقم ${oldSerial || ''} يتبع تسلسل ${ex.type}، فيُستبدل بالرقم ${newSerial} في تسلسل ${data.type}. الأرقام القديمة لا يُعاد استخدامها.`,
        okText:'تحويل النوع', icon:'wared' });
      if(!ok) return notify({ type:'info', title:'تم إلغاء تحويل النوع', msg:'باقي التعديلات ما انحفظت — اضغط حفظ من جديد بعد ما تقرر.', log:false });
    }
    /* تخزين الملفات الجديدة في مخزن المرفقات قبل حفظ السجل */
    try {
      for(const a of atts){
        if(a.key) continue;
        const blob = a.blob || (a.data ? b64ToBlob(a.data) : null);   /* يشمل مرفقاً قديماً لم يُرحَّل بعد */
        if(!blob) continue;
        const key = newKey(); await attPut(key, blob); a.key = key; a.size = blob.size; delete a.data;
      }
    } catch(e){ return notify({ type:'error', title:'تعذّر حفظ المرفقات', msg:'مخزن المتصفح رفض الكتابة: ' + (e.message || e), log:false }); }
    let rec;
    const snapshot = JSON.stringify(records);
    if(ex){
      const i = records.findIndex(r => r.id === ex.id);
      rec = records[i] = { ...records[i], ...data };
      if(newSerial) rec.serial = newSerial;
      setAtts(rec, atts);
      if(data.status === 'منجز' && ex.status !== 'منجز') rec.completedAt = todayISO();
    } else {
      rec = { ...data, id:'r_' + Date.now() + '_' + Math.random().toString(36).slice(2,7), serial:generateSerial(data.type, data.date), createdAt:new Date().toISOString() };
      setAtts(rec, atts);
      if(rec.status === 'منجز') rec.completedAt = todayISO();
      records.push(rec);
    }
    if(!save()){ records = JSON.parse(snapshot); return; }
    if(attDirHandle) for(const a of atts){ const b = await attBlob(a); if(b) await writeAttFile(rec, a, b); }
    gcAtts();
    saved = true; flashId = rec.id; sheet.close('saved');
    showView('list', true); render();
    notify({ type:'success', title: ex ? (newSerial ? `تحوّل ${oldSerial || ''} إلى ${rec.type} برقم ${rec.serial}` : `تم تحديث السجل ${rec.serial}`) : `تم حفظ ${rec.type} برقم ${rec.serial}`, msg:`${rec.entity} — ${rec.subject.slice(0,60)}${atts.length > 1 ? ` — ${num(atts.length)} مرفقات` : ''}${rec.status==='قيد المعالجة' ? '. يظهر تنبيه إذا تأخر أكثر من ' + num(OVERDUE_THRESHOLD) + ' أيام.' : ''}`, page:'wared' });
  };
}
function editRecord(id){ const r = records.find(x => x.id === id); if(r) openForm(r.type, r); }

/* ---------- تحديد كمنجز + ختم المرفق ---------- */
function markComplete(id){
  const r = records.find(x => x.id === id); if(!r) return;
  vib(10);
  const atts = getAtts(r), imgs = atts.filter(isImg), img = imgs.length > 0;
  const s = App.sheet(`
    <div class="hero-ico" style="--tint:var(--success-bg)">${ico('success')}</div>
    <h3>تحديد ${esc(r.serial||'')} كمنجز</h3>
    <p class="lead">${esc(r.entity)} — ${esc(r.subject.slice(0,80))}</p>
    <div class="mk-field" style="margin-top:16px"><label for="wr-c-note">ملاحظات الإنجاز</label><input class="mk-inp" id="wr-c-note" placeholder="اختياري — مثال: رُد عليه بكتاب رقم 55" data-autofocus></div>
    <div class="info-box">${img ? `سيُطبع ختم أخضر «✔ منجز» مع تاريخ الإنجاز والملاحظة داخل ${imgs.length > 1 ? num(imgs.length) + ' صور مرفقة' : 'صورة المرفق نفسها'}، في أوضح منطقة فارغة من الورقة لا فوق الكتابة.${atts.length > imgs.length ? ' باقي المرفقات تبقى كما هي.' : ''}` : atts.length ? 'المرفقات ليست صوراً، فتُحدَّث الحالة فقط دون ختم.' : 'لا يوجد مرفق، فتُحدَّث الحالة فقط.'}</div>
    <div class="actions"><button class="btn btn-primary" data-ok>تأكيد الإنجاز</button><button class="btn" data-cancel>إلغاء</button></div>`);
  s.ov.querySelector('[data-cancel]').onclick = () => s.close();
  s.ov.querySelector('[data-ok]').onclick = async () => {
    const today = todayISO(), noteIn = s.ov.querySelector('#wr-c-note').value.trim();
    const completionNote = noteIn || `تم الإنجاز بتاريخ ${today}`;
    s.close();
    const before = JSON.parse(JSON.stringify(r));
    r.status = 'منجز'; r.completedAt = today;
    r.notes = r.notes ? `${r.notes} — ${completionNote}` : completionNote;
    let stamped = false;
    if(img){
      try {
        const out = [];
        for(const a of atts){
          if(!isImg(a)){   /* غير الصور: تُنقل للمخزن إن كانت ما زالت قديمة، وتبقى بلا ختم */
            if(!a.key && a.data){ const bl = b64ToBlob(a.data), k = newKey(); await attPut(k, bl); out.push({ key:k, name:a.name, type:a.type, size:bl.size }); }
            else out.push(a);
            continue;
          }
          const src = await attDataUrl(a);
          if(!src){ out.push(a); continue; }
          const blob = b64ToBlob(await stampImage(src, a.type, today, completionNote)), key = newKey();
          await attPut(key, blob);
          const meta = { key, name:a.name, type:a.type, size:blob.size };
          if(attDirHandle) await writeAttFile(r, meta, blob);
          out.push(meta);
        }
        setAtts(r, out); stamped = true;
      }
      catch(e){ notify({ type:'warning', title:'تعذّر ختم الصور', msg:'تم تحديث الحالة فقط.', log:false }); }
    }
    if(!save()){ Object.keys(r).forEach(k => delete r[k]); Object.assign(r, before); return render(); }
    flashId = r.id; render(); if(currentView==='dash') renderDashboard();
    notify({ type:'success', title:`تم إنجاز ${r.serial}`, msg: stamped ? (imgs.length > 1 ? `خُتمت ${num(imgs.length)} صور مرفقة بختم «منجز».` : 'خُتم المرفق بختم «منجز».') : 'تم تحديث الحالة.', page:'wared', duration:8000,
      action: stamped ? { label:'عرض المرفق', fn:() => viewAttachment(r.id) } : { label:'تراجع', fn:() => { Object.keys(r).forEach(k => delete r[k]); Object.assign(r, before); save(); render(); notify({ type:'info', title:'تم التراجع', log:false }); } } });
  };
}
function roundRect(ctx,x,y,w,h,rad){ ctx.beginPath(); ctx.moveTo(x+rad,y); ctx.arcTo(x+w,y,x+w,y+h,rad); ctx.arcTo(x+w,y+h,x,y+h,rad); ctx.arcTo(x,y+h,x,y,rad); ctx.arcTo(x,y,x+w,y,rad); ctx.closePath(); }
function wrapStampText(ctx, text, x, y, maxWidth, lineHeight, maxLines){
  const words = String(text||'').split(' '); let line = '', lines = [];
  for(let n=0;n<words.length;n++){ const t = line + words[n] + ' '; if(ctx.measureText(t).width > maxWidth && n>0){ lines.push(line.trim()); line = words[n] + ' '; } else line = t; }
  lines.push(line.trim()); lines.slice(0, maxLines).forEach((l,i) => ctx.fillText(l, x, y + i*lineHeight));
}
/* يبحث عن أنسب منطقة فارغة في الصورة لوضع الختم فيها (بدل إلصاقه أسفل الورقة دائماً) */
function findBlankSpot(img, w, h, stampW, stampH, margin){
  const fallback = { x:w - stampW - margin, y:h - stampH - margin };
  try{
    const AW = 180, AH = Math.max(10, Math.round(AW * h / w));
    const ac = document.createElement('canvas'); ac.width = AW; ac.height = AH;
    const actx = ac.getContext('2d', { willReadFrequently:true });
    actx.drawImage(img, 0, 0, AW, AH);
    const d = actx.getImageData(0, 0, AW, AH).data;

    /* لون الخلفية = أكثر درجة سطوع تكراراً */
    const hist = new Uint32Array(32), lum = new Uint8Array(AW * AH);
    for(let i = 0, n = 0; i < d.length; i += 4, n++){
      const L = (d[i]*0.299 + d[i+1]*0.587 + d[i+2]*0.114) | 0;
      lum[n] = L; hist[L >> 3]++;
    }
    let bgBin = 0; for(let i = 1; i < 32; i++) if(hist[i] > hist[bgBin]) bgBin = i;
    const bg = bgBin * 8 + 4, TH = 26;

    /* صورة تكاملية لعدد البكسلات المختلفة عن الخلفية */
    const IW = AW + 1, integ = new Uint32Array(IW * (AH + 1));
    for(let y = 0; y < AH; y++){
      let rowSum = 0;
      for(let x = 0; x < AW; x++){
        if(Math.abs(lum[y*AW + x] - bg) > TH) rowSum++;
        integ[(y+1)*IW + (x+1)] = integ[y*IW + (x+1)] + rowSum;
      }
    }
    const inkIn = (x0, y0, x1, y1) => integ[y1*IW + x1] - integ[y0*IW + x1] - integ[y1*IW + x0] + integ[y0*IW + x0];

    const sc = AW / w;
    const bw = Math.max(4, Math.round(stampW * sc)), bh = Math.max(4, Math.round(stampH * sc));
    const pad = Math.max(2, Math.round(margin * sc));
    if(bw + pad*2 >= AW || bh + pad*2 >= AH) return fallback;

    const step = Math.max(2, Math.round(AW / 45));
    let best = null;
    for(let y = pad; y + bh <= AH - pad; y += step){
      for(let x = pad; x + bw <= AW - pad; x += step){
        const ink = inkIn(x, y, x + bw, y + bh);
        /* هامش أمان حول الختم حتى لا يلامس نصاً مجاوراً */
        const gx0 = Math.max(0, x - step), gy0 = Math.max(0, y - step);
        const gx1 = Math.min(AW, x + bw + step), gy1 = Math.min(AH, y + bh + step);
        const halo = inkIn(gx0, gy0, gx1, gy1) - ink;
        /* تفضيل خفيف للنصف السفلي واليمين — مكان الأختام المعتاد — دون فرضه */
        const bias = (1 - (y + bh/2) / AH) * bw * bh * 0.012 + (1 - (x + bw/2) / AW) * bw * bh * 0.006;
        const score = ink * 3 + halo * 0.6 + bias;
        if(!best || score < best.score) best = { score, x, y, ink };
      }
    }
    if(!best) return fallback;
    /* لو كل المواضع مزدحمة نرجع للموضع التقليدي */
    if(best.ink > bw * bh * 0.06) return fallback;
    return { x: Math.round(best.x / sc), y: Math.round(best.y / sc) };
  }catch(e){ return fallback; }
}
function stampImage(dataUrl, mimeType, dateStr, noteStr){
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = function(){
      try{
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width; canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const w = canvas.width, h = canvas.height;
        const note = String(noteStr || '').trim();
        const stampW = Math.max(Math.min(w*0.44, 220), Math.min(w*0.36, 900));
        const stampH = stampW * (note ? 0.54 : 0.38), margin = w*0.03;
        const spot = findBlankSpot(img, w, h, stampW, stampH, margin);
        const x = Math.max(margin, Math.min(spot.x, w - stampW - margin));
        const y = Math.max(margin, Math.min(spot.y, h - stampH - margin));
        ctx.save(); ctx.translate(x + stampW/2, y + stampH/2); ctx.rotate(-8 * Math.PI/180); ctx.translate(-(stampW/2), -(stampH/2));
        /* خلفية شبه معتمة تحت الختم حتى يبقى واضحاً فوق أي أرضية */
        ctx.globalAlpha = 0.82; ctx.fillStyle = '#ffffff'; roundRect(ctx, 0, 0, stampW, stampH, 10); ctx.fill();
        ctx.globalAlpha = 0.94; ctx.lineWidth = Math.max(3, stampW*0.02); ctx.strokeStyle = '#2e7d32'; ctx.fillStyle = 'rgba(46,125,50,0.14)';
        roundRect(ctx, 0, 0, stampW, stampH, 10); ctx.fill(); ctx.stroke();
        ctx.globalAlpha = 1; ctx.fillStyle = '#2e7d32'; ctx.textAlign = 'center'; ctx.direction = 'rtl';
        const tH = note ? stampH : stampH * 1.32;   /* بلا ملاحظة: نوزّع السطرين في ارتفاع أقل */
        ctx.font = `bold ${Math.round(tH*0.24)}px 'IBM Plex Sans Arabic', Tajawal, Arial, sans-serif`; ctx.fillText('✔ منجز', stampW/2, tH*0.32);
        ctx.font = `${Math.round(tH*0.13)}px 'IBM Plex Sans Arabic', Tajawal, Arial, sans-serif`; ctx.fillText(dateStr, stampW/2, tH*0.5);
        if(note){
          ctx.font = `${Math.round(stampH*0.105)}px 'IBM Plex Sans Arabic', Tajawal, Arial, sans-serif`;
          wrapStampText(ctx, note, stampW/2, stampH*0.66, stampW*0.88, stampH*0.125, 3);
        }
        ctx.restore();
        resolve(canvas.toDataURL(mimeType === 'image/png' ? 'image/png' : 'image/jpeg', 0.92));
      }catch(err){ reject(err); }
    };
    img.onerror = reject; img.src = dataUrl;
  });
}

/* ---------- الحذف ---------- */
async function deleteRecord(id){
  const r = records.find(x => x.id === id); if(!r) return;
  const ok = await confirmD({ title:`حذف السجل ${r.serial || ''}؟`, msg:`${r.type} — ${r.entity} — ${r.subject.slice(0,60)}${getAtts(r).length ? (getAtts(r).length > 1 ? `. تُحذف ${num(getAtts(r).length)} مرفقات معه.` : '. يُحذف المرفق معه.') : '.'}`, okText:'حذف', danger:true });
  if(!ok) return;
  const pos = records.indexOf(r);
  records = records.filter(x => x.id !== id); save(); render();
  const undone = { v:false };
  notify({ type:'success', title:`تم حذف السجل ${r.serial || ''}`, msg:r.entity, page:'wared', duration:8000,
    action:{ label:'تراجع', fn:() => { undone.v = true; records.splice(Math.min(pos, records.length), 0, r); flashId = r.id; save(); render(); notify({ type:'info', title:'تمت استعادة السجل', log:false }); } } });
  setTimeout(() => { if(!undone.v) gcAtts(); }, 12000);   /* نمهل فرصة التراجع قبل حذف الملفات */
}

/* ---------- التقرير والتصدير ---------- */
function printReport(){
  const list = filtered();
  if(!list.length) return notify({ type:'warning', title:'لا توجد سجلات للطباعة', msg:'غيّر البحث أو الفلتر.', log:false });
  const fType = $id('f-type').value, fStatus = $id('f-status').value, q = $id('q').value.trim();
  printList(list, [fType, fStatus, q ? `بحث: ${q}` : ''].filter(Boolean).join(' — ') || 'كل السجلات');
}
function printSelected(){
  const list = selectedList();
  if(!list.length) return notify({ type:'warning', title:'ما في سجلات محدَّدة', msg:'علّم المربع بجانب الكتب اللي بدك تطبعها.', log:false });
  printList(list, `سجلات مختارة (${num(list.length)})`);
}
async function printBooks(){
  const list = selectedList();
  if(!list.length) return notify({ type:'warning', title:'ما في سجلات محدَّدة', msg:'علّم المربع بجانب الكتب اللي بدك تطبعها.', log:false });
  const withImgs = list.filter(r => getAtts(r).some(isImg));
  if(!withImgs.length) return notify({ type:'warning', title:'المحدَّد ما فيه صور مرفقة', msg:'طباعة الكتب تشمل الصور فقط. مرفقات PDF وWord تُفتح من عمود المرفقات.', log:false });
  const skipped = list.length - withImgs.length;
  const w = window.open('', '_blank');
  if(!w) return notify({ type:'error', title:'المتصفح منع نافذة الطباعة', msg:'اسمح بالنوافذ المنبثقة لهذا الموقع ثم أعد المحاولة.' });
  const pages = [];
  for(let i = 0; i < withImgs.length; i++){
    const r = withImgs[i], imgs = [];
    for(const a of getAtts(r).filter(isImg)){ const src = await attDataUrl(a); if(src) imgs.push({ name:a.name, src }); }
    pages.push(`<section class="bk"${i ? ' style="page-break-before:always"' : ''}>${App.letterheadHTML()}
      <h2>${r.type} رقم ${esc(r.serial || '-')}</h2>
      <table class="meta"><tr><th>التاريخ</th><td>${esc(r.date || '-')}</td><th>الجهة</th><td>${esc(r.entity)}</td></tr>
        <tr><th>المرجع</th><td>${esc(r.ref || '-')}</td><th>الحالة</th><td>${esc(r.status)}</td></tr>
        <tr><th>الموضوع</th><td colspan="3">${esc(r.subject)}</td></tr>
        ${r.notes ? `<tr><th>ملاحظات</th><td colspan="3">${esc(r.notes)}</td></tr>` : ''}</table>
      ${imgs.map((a, k) => `<figure${k ? ' class="brk"' : ''}><img src="${a.src}" alt=""><figcaption>${esc(a.name || '')} — مرفق ${num(k+1)} من ${num(imgs.length)}</figcaption></figure>`).join('')}
    </section>`);
  }
  w.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>طباعة الكتب المرفقة</title><style>
    body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;padding:18px;color:#111}
    h2{text-align:center;font-size:1.1rem;margin:10px 0 8px}
    table.meta{width:100%;border-collapse:collapse;font-size:.85rem;margin-bottom:12px}
    table.meta th{background:#3D4A2F;color:#fff;padding:6px 8px;text-align:right;width:70px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    table.meta td{border:1px solid #ddd;padding:6px 8px}
    figure{margin:0 0 10px;text-align:center}figure.brk{page-break-before:always}
    figure img{max-width:100%;max-height:220mm;object-fit:contain;border:1px solid #ddd}
    figcaption{font-size:.72rem;color:#666;margin-top:4px}
    @page{size:A4 portrait;margin:10mm}</style></head><body>${pages.join('')}
    <script>window.onload=()=>window.print();<\/script></body></html>`);
  w.document.close();
  notify({ type:'info', title:'تم تجهيز الكتب للطباعة', msg:`${num(withImgs.length)} كتاب${skipped ? ` — تُخطّي ${num(skipped)} بلا صور مرفقة` : ''}. اختر «حفظ بصيغة PDF» من نافذة الطباعة.`, log:false });
}
function printList(list, scope){
  const w = window.open('', '_blank');
  if(!w) return notify({ type:'error', title:'المتصفح منع نافذة الطباعة', msg:'اسمح بالنوافذ المنبثقة لهذا الموقع ثم أعد المحاولة.' });
  w.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>تقرير سجل الوارد والصادر</title><style>
    body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;padding:24px;color:#111}h1{text-align:center;font-size:1.25rem;margin:8px 0 2px}
    .sub{text-align:center;color:#555;font-size:.85rem;margin-bottom:14px}table{width:100%;border-collapse:collapse;font-size:.82rem}
    th{background:#3D4A2F;color:#fff;padding:7px;text-align:right;-webkit-print-color-adjust:exact;print-color-adjust:exact}td{border-bottom:1px solid #ddd;padding:6px 7px;vertical-align:top}
    .foot{display:flex;justify-content:space-between;margin-top:30px;font-size:.9rem}@page{size:A4 landscape;margin:12mm}</style></head><body>
    ${App.letterheadHTML()}
    <h1>دائرة الشؤون الإدارية والمالية والإمداد</h1><div class="sub">تقرير سجل الوارد والصادر — ${esc(scope)} — تاريخ الإصدار: ${new Date().toLocaleDateString('ar-EG',{year:'numeric',month:'long',day:'numeric'})}</div>
    <table><thead><tr><th>#</th><th>الرقم</th><th>التاريخ</th><th>النوع</th><th>الجهة</th><th>الموضوع</th><th>المرجع</th><th>الحالة</th><th>ملاحظات</th><th>المرفقات</th></tr></thead><tbody>
    ${list.map((r,i) => `<tr><td>${i+1}</td><td>${esc(r.serial||'-')}</td><td>${r.date||''}</td><td>${r.type}</td><td>${esc(r.entity)}</td><td>${esc(r.subject)}</td><td>${esc(r.ref||'-')}</td><td>${r.status}</td><td>${esc(r.notes||'-')}</td><td>${getAtts(r).length ? getAtts(r).length : '-'}</td></tr>`).join('')}
    </tbody></table><div class="foot"><span>عدد السجلات: ${list.length}</span><span>توقيع المسؤول: ______________</span></div>
    <script>window.onload=()=>window.print();<\/script></body></html>`);
  w.document.close();
  notify({ type:'info', title:'تم تجهيز التقرير', msg:`${num(list.length)} سجل — اختر «حفظ بصيغة PDF» من نافذة الطباعة.`, log:false });
}
function exportCsv(){
  const list = filtered();
  if(!list.length) return notify({ type:'warning', title:'لا توجد سجلات للتصدير', msg:'غيّر البحث أو الفلتر.', log:false });
  const headers = ['الرقم التسلسلي','التاريخ','النوع','الجهة','الموضوع','المرجع','الحالة','ملاحظات','عدد المرفقات','أسماء المرفقات'];
  let csv = '\uFEFF' + headers.join(',') + '\n';
  list.forEach(r => { const atts = getAtts(r); csv += [r.serial||'-', r.date, r.type, r.entity, r.subject, r.ref, r.status, r.notes, atts.length, atts.map(a => a.name).join(' | ') || '-'].map(v => '"' + String(v||'').replace(/"/g,'""') + '"').join(',') + '\n'; });
  const url = URL.createObjectURL(new Blob([csv], {type:'text/csv;charset=utf-8;'}));
  const a = document.createElement('a'); a.href = url; a.download = `سجل_الوارد_والصادر_${todayISO()}.csv`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
  notify({ type:'success', title:'تم تصدير CSV', msg:`${num(list.length)} سجل — يفتح في Excel. تجده في مجلد التنزيلات.` });
}
function importLegacy(ev){
  const file = ev.target.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    let data; try { data = JSON.parse(reader.result); } catch(e){ return notify({ type:'error', title:'تعذّرت قراءة الملف', msg:'الملف ليس بصيغة JSON أو أنه تالف.' }); }
    if(data && data.app === 'unified-admin-system') return notify({ type:'warning', title:'هذه نسخة من النظام الموحّد', msg:'استعدها من صفحة النسخ الاحتياطي.', action:{ label:'النسخ الاحتياطي', fn:() => App.switchModule('backup') } });
    if(!Array.isArray(data) || (data.length && !data[0].type)) return notify({ type:'error', title:'الملف ليس بيانات سجل الوارد والصادر', msg:'اختر ملف الحفظ المربوط من تطبيق الوارد والصادر المستقل.' });
    const ok = await confirmD({ title:'استبدال سجلات الوارد والصادر؟', msg:`الملف: ${num(data.length)} سجل. الحالي: ${num(records.length)} سجل. سيُستبدل الحالي بالكامل.`, okText:'استبدال البيانات', danger:true, icon:'inbox' });
    if(!ok) return notify({ type:'info', title:'تم إلغاء الاستيراد', log:false });
    const prev = records; records = data;
    if(!save()){ records = prev; return; }
    await migrateInlineAtts();
    renderAll();
    notify({ type:'success', title:'تم استيراد سجلات الوارد والصادر', msg:`${num(records.length)} سجل.`, page:'wared', duration:9000, action:{ label:'تراجع', fn:() => { records = prev; save(); renderAll(); notify({ type:'info', title:'تم التراجع عن الاستيراد', log:false }); } } });
  };
  reader.readAsText(file); ev.target.value = '';
}

function renderAll(){ render(); if(currentView==='dash') renderDashboard(); }
function onShow(){ renderAll(); }
function init(){
  buildUI(); load(); render(); tryReconnectFile();
  tryReconnectFolder().then(migrateInlineAtts).catch(() => {});
}
/* النسخة الاحتياطية الموحّدة: المرفقات صارت خارج localStorage فتُجمَّع عبر خطّاف */
(window.BACKUP_HOOKS = window.BACKUP_HOOKS || {}).wared = {
  collect: async () => {
    const atts = {};
    for(const r of records) for(const a of getAtts(r)) if(a.key && !atts[a.key]){
      const b = await attGet(a.key); if(b) atts[a.key] = { name:a.name, type:a.type, data: await blobToDataUrl(b) };
    }
    return Object.keys(atts).length ? { atts } : null;
  },
  apply: async (obj) => {
    if(!obj || !obj.atts) return;
    for(const [k, v] of Object.entries(obj.atts)){ try { await attPut(k, b64ToBlob(v.data)); } catch(e){} }
  },
  label: async () => { const st = await attStats(); return st.count ? `${num(st.count)} مرفق (${kb(st.bytes)})` : ''; }
};
function alerts(){
  const late = records.filter(isOverdue);
  if(!late.length) return [];
  return [{ severity:'high', title: late.length === 1 ? 'معاملة متأخرة دون إنجاز' : `${num(late.length)} ${late.length <= 10 ? 'معاملات متأخرة' : 'معاملة متأخرة'} دون إنجاز`,
    subtitle: late.slice(0,3).map(r => `${r.serial} ${r.entity}`).join('، ') + (late.length > 3 ? ` و${num(late.length-3)} غيرها` : ''), onOpen: gotoOverdue }];
}
return { showView, render, openForm, editRecord, markComplete, deleteRecord, viewAttachment, quickFilter, gotoOverdue,
  toggleSel, toggleAll, clearSel, printSelected, printBooks,
  linkAttFolder, exportAllToFolder, unlinkAttFolder, _gc: gcAtts, _stats: attStats,
  printReport, exportCsv, linkSaveFile, importLegacy, init, onShow, alerts, _records: () => records, _stamp: stampImage, _atts: getAtts };
})();
window.NotificationRegistry = window.NotificationRegistry || {};
NotificationRegistry.wared = () => WR.alerts();
(window.MODULE_INITS = window.MODULE_INITS || []).push(WR.init);
