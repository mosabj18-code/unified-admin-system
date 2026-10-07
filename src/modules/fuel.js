/* =====================================================================
   وحدة توزيع الوقود — FU
   البيانات: localStorage fuel2_in / fuel2_out (مع ترحيل fuel_in / fuel_out)
   ملف الحفظ: IndexedDB fsdb_fuel — بيانات_توزيع_الوقود.json
   ===================================================================== */
const FU = (function(){
'use strict';
const K_IN = 'fuel2_in', K_OUT = 'fuel2_out';
const BASE_UNIT = { 'غاز':'كيلو', 'سولار':'لتر' };
const TYPES = ['غاز','سولار'];
const DEFAULT_CYL = 12;
const LOW_RATIO = 0.15;

let fIn = [], fOut = [];
let currentView = 'in', chartType = 'monthly', chartInstance = null, flashId = null;
let fMonth = '', fType = '', fDept = '';

const $id = id => document.getElementById('fu-' + id);
const notify  = (...a) => window.App ? App.notify(...a) : console.log(a);
const confirmD = o => window.App ? App.confirm(o) : Promise.resolve(window.confirm(o.title));
const vib = ms => window.App && App.vibrate(ms);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num = v => Number(Math.round((Number(v)||0)*100)/100).toLocaleString('ar-EG', { maximumFractionDigits:2 });
function localISO(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
const todayISO = () => localISO(new Date());
function fmtDate(iso){ if(!iso) return '—'; return new Intl.DateTimeFormat('ar-EG',{year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(iso+'T00:00:00')); }
const monthKey = d => d ? d.slice(0,7) : '';
const AR_MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
const arYear = y => Number(y).toLocaleString('ar-EG', { useGrouping:false });
function monthLabel(k){ if(!k) return '—'; const [y,m] = k.split('-'); return `${AR_MONTHS[+m-1]} ${arYear(y)}`; }
function markInvalid(el){ if(!el) return; el.classList.remove('invalid'); void el.offsetWidth; el.classList.add('invalid'); el.focus(); const off=()=>el.classList.remove('invalid'); el.addEventListener('input',off,{once:true}); el.addEventListener('change',off,{once:true}); }
const newId = p => p + '_' + Date.now() + '_' + Math.random().toString(36).slice(2,7);

/* ---------- الحفظ والتحميل ---------- */
function ensureIds(){
  fIn.forEach(r => { if(!r.id) r.id = newId('fi'); });
  let maxNo = fOut.reduce((m,r) => Math.max(m, +r.no || 0), 0);
  fOut.forEach(r => { if(!r.id) r.id = newId('fo'); if(!r.no) r.no = ++maxNo; });
}
// إصلاح: رقم السند = أكبر رقم موجود + 1 (لا يتكرر بعد الحذف)
function nextNo(){ return fOut.reduce((m,r) => Math.max(m, +r.no || 0), 0) + 1; }
const voucherNo = r => 'V-' + String(r.no || 0).padStart(4,'0');

function save(){
  try {
    localStorage.setItem(K_IN,  JSON.stringify(fIn));
    localStorage.setItem(K_OUT, JSON.stringify(fOut));
  } catch(e){
    notify({ type:'error', title:'تعذّر الحفظ: مساحة المتصفح ممتلئة', msg:'نزّل نسخة احتياطية ثم احذف سجلات قديمة من الوحدات الأخرى.', page:'fuel', duration:0 });
    return false;
  }
  writeToLinkedFile();
  window.App && App.refresh();
  return true;
}
function migrate(r){
  let qty = r.qty;
  if(r.unit === 'اسطوانة') qty = r.qty * DEFAULT_CYL;
  return { ...r, qty, unit: BASE_UNIT[r.type] || r.unit, cyl: r.unit === 'اسطوانة' ? DEFAULT_CYL : (r.cyl || null) };
}
function load(){
  fIn = []; fOut = [];
  try {
    const a = localStorage.getItem(K_IN), b = localStorage.getItem(K_OUT);
    if(a) fIn  = JSON.parse(a) || [];
    if(b) fOut = JSON.parse(b) || [];
    if(!a && !b){ // ترحيل من الإصدار الأول للتطبيق المستقل
      const oa = localStorage.getItem('fuel_in'), ob = localStorage.getItem('fuel_out');
      if(oa) fIn  = (JSON.parse(oa) || []).map(migrate);
      if(ob) fOut = (JSON.parse(ob) || []).map(migrate);
      if(oa || ob){ ensureIds(); save(); }
    }
  } catch(e){ fIn = []; fOut = []; }
  if(!Array.isArray(fIn)) fIn = [];
  if(!Array.isArray(fOut)) fOut = [];
  ensureIds();
}

/* ---------- ربط ملف حفظ ---------- */
let fileHandle = null;
const FS_DB_NAME = 'fsdb_fuel';
function idbOpen(){ return new Promise((resolve,reject)=>{ const req=indexedDB.open(FS_DB_NAME,1); req.onupgradeneeded=()=>req.result.createObjectStore('handles'); req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error); }); }
async function idbSet(key,val){ try{ const db=await idbOpen(); return new Promise((resolve,reject)=>{ const tx=db.transaction('handles','readwrite'); tx.objectStore('handles').put(val,key); tx.oncomplete=()=>resolve(true); tx.onerror=()=>reject(tx.error); }); }catch(e){return false;} }
async function idbGet(key){ try{ const db=await idbOpen(); return new Promise((resolve,reject)=>{ const tx=db.transaction('handles','readonly'); const req=tx.objectStore('handles').get(key); req.onsuccess=()=>resolve(req.result||null); req.onerror=()=>reject(req.error); }); }catch(e){return null;} }
function fsSupported(){ return 'showSaveFilePicker' in window; }
let linkText = '', linkOk = false;
function updateLinkStatus(text, ok){ linkText = text; linkOk = ok; const el = $id('link-status'); if(el){ el.textContent = text; el.className = 'pill ' + (ok ? 'ok' : 'mid'); el.hidden = !text; } }
const filePayload = () => JSON.stringify({ fuelIn:fIn, fuelOut:fOut, version:2, exported:new Date().toISOString() }, null, 2);
async function linkSaveFile(){
  vib(10);
  if(!fsSupported()) return notify({ type:'warning', title:'ربط الملف غير مدعوم هنا', msg:'تعمل في Chrome وEdge على الكمبيوتر. استخدم النسخ الاحتياطي بدلاً منها.', action:{ label:'النسخ الاحتياطي', fn:() => App.switchModule('backup') } });
  try{
    const handle = await window.showSaveFilePicker({ suggestedName:'بيانات_توزيع_الوقود.json', types:[{description:'JSON',accept:{'application/json':['.json']}}] });
    let data = null, imported = false;
    try{ const text = await (await handle.getFile()).text(); if(text && text.trim()){ const d = JSON.parse(text); if(d && Array.isArray(d.fuelIn) && Array.isArray(d.fuelOut)) data = d; } }catch(e){}
    if(data){
      const ok = await confirmD({ title:'الملف فيه بيانات محفوظة', msg:`يحتوي ${num(data.fuelIn.length)} وارد و${num(data.fuelOut.length)} توزيع. هل تستوردها؟ (تُستبدل بيانات الوقود الحالية)`, okText:'استيراد البيانات', cancelText:'الإبقاء على بياناتي', icon:'fuel' });
      if(ok){ applyImported(data); imported = true; }
    }
    fileHandle = handle; await idbSet('handle', handle);
    if(imported){ save(); renderAll(); } else await writeToLinkedFile();
    updateLinkStatus('مربوط: ' + handle.name, true);
    notify({ type:'success', title: imported ? 'تم ربط الملف واستيراد بياناته' : 'تم ربط ملف الحفظ', msg:'كل عملية حفظ تُكتب تلقائياً في «' + handle.name + '».', page:'fuel' });
  }catch(e){ if(e.name!=='AbortError') notify({ type:'error', title:'تعذّر ربط الملف', msg:'السبب: ' + e.message, page:'fuel' }); }
}
let writeWarned = false;
async function writeToLinkedFile(){
  if(!fileHandle) return;
  try{
    const perm = await fileHandle.queryPermission({mode:'readwrite'});
    if(perm!=='granted'){ const req = await fileHandle.requestPermission({mode:'readwrite'}); if(req!=='granted'){ if(!writeWarned){ writeWarned = true; notify({ type:'warning', title:'لم يُحدَّث ملف الحفظ المربوط', msg:'البيانات محفوظة بالتطبيق، لكن الملف يحتاج إذناً. اضغط «ربط ملف حفظ».', page:'fuel' }); } return; } }
    const writable = await fileHandle.createWritable(); await writable.write(filePayload()); await writable.close(); writeWarned = false;
  }catch(e){}
}
async function tryReconnectFile(){
  if(!fsSupported()) return;
  try{ const handle = await idbGet('handle'); if(!handle) return; const perm = await handle.queryPermission({mode:'readwrite'});
    if(perm==='granted'){ fileHandle = handle; updateLinkStatus('مربوط: ' + handle.name, true); }
    else if(perm==='prompt'){ fileHandle = handle; updateLinkStatus('اضغط «ربط ملف حفظ» للسماح مجدداً', false); } }catch(e){}
}
function applyImported(data){
  const v = data.version === 2;
  fIn  = (data.fuelIn  || []).map(r => v ? r : migrate(r));
  fOut = (data.fuelOut || []).map(r => v ? r : migrate(r));
  ensureIds();
}

/* ---------- الأرصدة ---------- */
function balanceOf(type, arrIn, arrOut){
  const a = arrIn || fIn, b = arrOut || fOut;
  const i = a.filter(r => r.type === type).reduce((s,r) => s + (+r.qty||0), 0);
  const o = b.filter(r => r.type === type).reduce((s,r) => s + (+r.qty||0), 0);
  return { in:i, out:o, bal:i - o };
}
// منع أي عملية تجعل الرصيد سالباً
function negativeTypes(arrIn, arrOut){
  return TYPES.filter(t => { const b = balanceOf(t, arrIn, arrOut); return b.bal < -0.0001; });
}

/* ---------- الفلاتر ---------- */
function applyFilter(){
  fMonth = $id('f-month').value; fType = $id('f-type').value; fDept = $id('f-dept').value;
  renderAll(); vib(6);
}
function clearFilter(){ ['f-month','f-type','f-dept'].forEach(i => $id(i).value = ''); fMonth = fType = fDept = ''; renderAll(); vib(8); }
function filterIn(){ return fIn.filter(r => (!fMonth || monthKey(r.date) === fMonth) && (!fType || r.type === fType)); }
function filterOut(){ return fOut.filter(r => (!fMonth || monthKey(r.date) === fMonth) && (!fType || r.type === fType) && (!fDept || r.dept === fDept)); }
function depts(){ return [...new Set(fOut.map(r => r.dept).filter(Boolean))].sort(); }
function sources(){ return [...new Set(fIn.map(r => r.src).filter(Boolean))].sort(); }
function allMonths(){ return [...new Set([...fIn, ...fOut].map(r => monthKey(r.date)).filter(Boolean))].sort().reverse(); }
function fillFilters(){
  const ms = $id('f-month'), cm = ms.value;
  ms.innerHTML = '<option value="">كل الشهور</option>' + allMonths().map(m => `<option value="${m}">${monthLabel(m)}</option>`).join('');
  ms.value = cm;
  const ds = $id('f-dept'), cd = ds.value;
  ds.innerHTML = '<option value="">كل الجهات</option>' + depts().map(d => `<option value="${esc(d)}">${esc(d)}</option>`).join('');
  ds.value = cd;
}

/* ---------- الواجهة ---------- */
const VIEWS = [['in','الوارد','inbox'], ['out','التوزيع','outbox'], ['dash','لوحة التحكم','chart'], ['dept','حسب الجهة','label'], ['settings','إعدادات الوحدة','settings']];
function buildUI(){
  const root = document.getElementById('page-fuel');
  root.removeAttribute('data-placeholder');
  root.innerHTML = `
  <div class="mk-head" style="--tint:rgba(239,68,68,.14)">
    <div class="tile">${ico('fuel')}</div>
    <div class="grow"><h2>توزيع الوقود</h2><p>الغاز بالكيلو والسولار باللتر — وارد وتوزيع وأرصدة وسندات صرف</p></div>
    <div class="mk-tools">
      <button class="btn btn-primary" onclick="FU.openIn()">وارد جديد</button>
      <button class="btn" onclick="FU.openOut()">توزيع جديد</button>
    </div>
  </div>
  <div class="mk-tabs" role="tablist">${VIEWS.map(([v,l,i]) => `<button class="mk-tab${v==='in'?' active':''}" id="fu-tab-${v}" onclick="FU.showView('${v}')">${ico(i)}${l}${v==='dash'?'<span class="badge num" id="fu-low-badge"></span>':''}</button>`).join('')}</div>

  <div class="fu-filter" id="fu-filterbar">
    <select class="mk-inp" id="fu-f-month" onchange="FU.applyFilter()"><option value="">كل الشهور</option></select>
    <select class="mk-inp" id="fu-f-type" onchange="FU.applyFilter()"><option value="">كل الأنواع</option><option value="غاز">غاز</option><option value="سولار">سولار</option></select>
    <select class="mk-inp" id="fu-f-dept" onchange="FU.applyFilter()"><option value="">كل الجهات</option></select>
    <button class="btn btn-sm btn-ghost" onclick="FU.clearFilter()">مسح الفلتر</button>
  </div>

  <section class="mk-view active" id="fu-view-in">
    <div class="fu-note">${ico('info')}<span>الوحدة موحّدة تلقائياً: <b>الغاز بالكيلو</b> و<b>السولار باللتر</b>. لو أدخلت اسطوانات، النظام يحوّلها لكيلو حسب وزن الاسطوانة.</span></div>
    <div class="mk-kpis">
      <div class="mk-card mk-kpi good"><small>رصيد الغاز (كيلو)</small><b id="fu-k-gas">0</b></div>
      <div class="mk-card mk-kpi good"><small>رصيد السولار (لتر)</small><b id="fu-k-dsl">0</b></div>
    </div>
    <div class="mk-card mk-table-card">
      <div class="mk-table-head"><h3>سجل الوارد <span class="pill info num" id="fu-in-count">0</span></h3>
        <div class="row"><button class="btn btn-sm" onclick="FU.exportExcel()">تصدير Excel</button></div></div>
      <div class="mk-scroll"><table class="mk-table"><thead><tr><th>#</th><th>التاريخ</th><th>النوع</th><th>الكمية</th><th>الوحدة</th><th>المصدر</th><th>ملاحظات</th><th></th></tr></thead><tbody id="fu-in-body"></tbody></table></div>
    </div>
  </section>

  <section class="mk-view" id="fu-view-out">
    <div id="fu-out-banner"></div>
    <div class="mk-card mk-table-card">
      <div class="mk-table-head"><h3>سجل التوزيع <span class="pill info num" id="fu-out-count">0</span></h3>
        <div class="row"><button class="btn btn-sm" onclick="FU.openMonthSheet()">تقرير شهري</button><button class="btn btn-sm" onclick="FU.openWordSheet()">تقرير Word</button><button class="btn btn-sm" onclick="FU.printReport()">تقرير شامل</button><button class="btn btn-sm" onclick="FU.exportExcel()">تصدير Excel</button></div></div>
      <div class="mk-scroll"><table class="mk-table"><thead><tr><th>السند</th><th>التاريخ</th><th>النوع</th><th>الكمية</th><th>الوحدة</th><th>الجهة / الشخص</th><th>ملاحظات</th><th></th></tr></thead><tbody id="fu-out-body"></tbody></table></div>
    </div>
  </section>

  <section class="mk-view" id="fu-view-dash">
    <div id="fu-dash-banner"></div>
    <div class="mk-kpis">
      <div class="mk-card mk-kpi"><small>وارد الغاز (كيلو)</small><b id="fu-d-gin">0</b></div>
      <div class="mk-card mk-kpi"><small>موزع الغاز</small><b id="fu-d-gout">0</b></div>
      <div class="mk-card mk-kpi good"><small>رصيد الغاز</small><b id="fu-d-gbal">0</b><small id="fu-d-gcyl" class="fu-sub"></small></div>
      <div class="mk-card mk-kpi"><small>وارد السولار (لتر)</small><b id="fu-d-din">0</b></div>
      <div class="mk-card mk-kpi"><small>موزع السولار</small><b id="fu-d-dout">0</b></div>
      <div class="mk-card mk-kpi good"><small>رصيد السولار</small><b id="fu-d-dbal">0</b></div>
    </div>
    <div class="mk-card mk-pad mk-section">
      <div class="mk-title"><span>الإحصائيات البيانية</span>
        <div class="mk-seg" id="fu-chart-seg">
          <button type="button" aria-pressed="true"  onclick="FU.showChart('monthly',this)">التوزيع الشهري</button>
          <button type="button" aria-pressed="false" onclick="FU.showChart('dept',this)">حسب الجهة</button>
          <button type="button" aria-pressed="false" onclick="FU.showChart('compare',this)">وارد مقابل موزع</button>
        </div></div>
      <div class="fu-chart"><canvas id="fu-chart"></canvas></div>
    </div>
    <div class="mk-card mk-table-card">
      <div class="mk-table-head"><h3>الملخص الشهري <span class="mk-hint" style="margin:0">مع نسبة التغيّر في الموزع</span></h3></div>
      <div class="mk-scroll"><table class="mk-table"><thead><tr><th>الشهر</th><th>وارد غاز</th><th>موزع غاز</th><th>التغيّر</th><th>وارد سولار</th><th>موزع سولار</th><th>التغيّر</th></tr></thead><tbody id="fu-month-body"></tbody></table></div>
    </div>
  </section>

  <section class="mk-view" id="fu-view-dept">
    <div class="mk-card mk-table-card">
      <div class="mk-table-head"><h3>إجمالي ما استلمته كل جهة <span class="pill info num" id="fu-dept-count">0</span></h3></div>
      <div class="mk-scroll"><table class="mk-table"><thead><tr><th>#</th><th>الجهة / الشخص</th><th>غاز (كيلو)</th><th>سولار (لتر)</th><th>العمليات</th><th>آخر استلام</th><th></th></tr></thead><tbody id="fu-dept-body"></tbody></table></div>
    </div>
  </section>

  <section class="mk-view" id="fu-view-settings">
    <div class="mk-card mk-pad mk-section">
      <div class="mk-title"><span>الترويسة الرسمية</span></div>
      <p class="mk-hint">تُطبع أعلى سند الصرف وكشف الحساب والتقرير الشامل. تُضبط مرة واحدة من إعدادات التطبيق وتُستخدم في كل الوحدات.</p>
      <div class="row" style="justify-content:flex-start"><span id="fu-lh"></span><button class="btn btn-sm" onclick="App.switchModule('settings')">إدارة الترويسة</button></div>
    </div>
    <div class="mk-card mk-pad mk-section">
      <div class="mk-title"><span>وزن الاسطوانة الافتراضي</span></div>
      <p class="mk-hint">يُستخدم لتحويل الاسطوانات إلى كيلو عند الإدخال، ولعرض الرصيد بالاسطوانات في لوحة التحكم. تقدر تغيّره لكل عملية على حدة.</p>
      <div class="mk-field" style="max-width:220px"><label for="fu-set-cyl">الوزن (كيلو)</label><input class="mk-inp" type="number" id="fu-set-cyl" min="0.1" step="0.1" value="${DEFAULT_CYL}" onchange="FU.setCyl(this.value)"></div>
    </div>
    <div class="mk-card mk-pad mk-section">
      <div class="mk-title"><span>ملف الحفظ والبيانات القديمة</span><span id="fu-link-status" class="pill" hidden></span></div>
      <p class="mk-hint">النسخة الاحتياطية الكاملة من «النسخ الاحتياطي» تشمل الوقود. هنا تقدر تربط ملف حفظ يُكتب تلقائياً، أو تستورد ملف نسخة من تطبيق توزيع الوقود المستقل.</p>
      <div class="row" style="justify-content:flex-start"><button class="btn" onclick="FU.linkSaveFile()">ربط ملف حفظ</button>
        <label class="btn">استيراد بيانات قديمة<input type="file" accept="application/json,.json" hidden onchange="FU.importLegacy(event)"></label></div>
    </div>
  </section>`;
}
let cylDefault = DEFAULT_CYL;
function setCyl(v){
  const n = parseFloat(v);
  if(!n || n <= 0) return notify({ type:'error', title:'وزن غير صحيح', msg:'أدخل رقماً أكبر من صفر.', log:false });
  cylDefault = n; try{ localStorage.setItem('fuel_cyl_default', String(n)); }catch(e){}
  renderDash();
  notify({ type:'info', title:'تم ضبط وزن الاسطوانة', msg:`${num(n)} كيلو للاسطوانة.`, log:false, duration:2400 });
}
function showView(v, silent){
  currentView = v;
  VIEWS.forEach(([k]) => { $id('view-'+k).classList.toggle('active', k===v); $id('tab-'+k).classList.toggle('active', k===v); });
  $id('filterbar').hidden = (v === 'settings');
  if(v === 'dash') renderDash();
  if(v === 'dept') renderDept();
  if(v === 'settings'){
    updateLinkStatus(linkText, linkOk);
    const lh = App.letterhead();
    $id('lh').innerHTML = lh ? `<img class="lh-prev" src="${lh}" alt="الترويسة">` : '<span class="pill mid">لم تُرفع ترويسة بعد</span>';
  }
  if(silent !== true) vib(8);
}

/* ---------- الجداول ---------- */
function cylNote(r){ return r.cyl ? `<span class="fu-sub">${num(r.qty / r.cyl)} اسطوانة × ${num(r.cyl)} كيلو</span>` : ''; }
function typePill(t){ return t === 'غاز' ? '<span class="pill mid">غاز</span>' : '<span class="pill info">سولار</span>'; }
function renderIn(){
  const list = filterIn().slice().sort((a,b) => (b.date||'').localeCompare(a.date||''));
  $id('in-count').textContent = num(list.length);
  const body = $id('in-body');
  body.innerHTML = !list.length
    ? `<tr><td colspan="8" class="mk-empty">${fIn.length ? 'لا يوجد وارد مطابق للفلتر.' : 'لا يوجد وارد بعد. ابدأ بـ«وارد جديد».'}</td></tr>`
    : list.map((r,i) => `<tr class="${r.id===flashId?'row-new':''}">
        <td class="num">${num(list.length - i)}</td><td class="num">${fmtDate(r.date)}</td><td>${typePill(r.type)}</td>
        <td class="fu-q in">+${num(r.qty)}${cylNote(r)}</td><td>${esc(r.unit || BASE_UNIT[r.type])}</td>
        <td>${esc(r.src || '—')}</td><td class="wrap muted" style="max-width:200px">${esc(r.notes || '—')}</td>
        <td><div class="acts"><button class="ib" title="تعديل" aria-label="تعديل" onclick="FU.openIn('${r.id}')">✏️</button>
          <button class="ib del" title="حذف" aria-label="حذف" onclick="FU.delIn('${r.id}')">🗑</button></div></td></tr>`).join('');
  const g = balanceOf('غاز'), d = balanceOf('سولار');
  $id('k-gas').textContent = num(g.bal); $id('k-dsl').textContent = num(d.bal);
}
function renderOut(){
  const list = filterOut().slice().sort((a,b) => (b.date||'').localeCompare(a.date||'') || (b.no||0) - (a.no||0));
  $id('out-count').textContent = num(list.length);
  const body = $id('out-body');
  body.innerHTML = !list.length
    ? `<tr><td colspan="8" class="mk-empty">${fOut.length ? 'لا يوجد توزيع مطابق للفلتر.' : 'لا يوجد توزيع بعد. سجّل الوارد أولاً ثم وزّع منه.'}</td></tr>`
    : list.map(r => `<tr class="${r.id===flashId?'row-new':''}">
        <td><span class="pill">${voucherNo(r)}</span></td><td class="num">${fmtDate(r.date)}</td><td>${typePill(r.type)}</td>
        <td class="fu-q out">-${num(r.qty)}${cylNote(r)}</td><td>${esc(r.unit || BASE_UNIT[r.type])}</td>
        <td><b>${esc(r.dept || '—')}</b></td><td class="wrap muted" style="max-width:200px">${esc(r.notes || '—')}</td>
        <td><div class="acts"><button class="ib" title="طباعة السند" aria-label="طباعة السند" onclick="FU.printVoucher('${r.id}')">🖨</button>
          <button class="ib" title="تعديل" aria-label="تعديل" onclick="FU.openOut('${r.id}')">✏️</button>
          <button class="ib del" title="حذف" aria-label="حذف" onclick="FU.delOut('${r.id}')">🗑</button></div></td></tr>`).join('');
  const empty = TYPES.every(t => balanceOf(t).in === 0);
  $id('out-banner').innerHTML = empty
    ? `<div class="mk-banner warn">${ico('warning')}<span class="grow">ما في وارد مسجّل بعد، فما في رصيد للتوزيع منه.</span><button class="btn btn-sm btn-primary" onclick="FU.openIn()">تسجيل وارد</button></div>` : '';
}
function deptSummary(){
  const map = {};
  filterOut().forEach(r => {
    if(!r.dept) return;
    if(!map[r.dept]) map[r.dept] = { dept:r.dept, gas:0, diesel:0, count:0, last:'' };
    if(r.type === 'غاز') map[r.dept].gas += (+r.qty||0); else map[r.dept].diesel += (+r.qty||0);
    map[r.dept].count++;
    if((r.date||'') > map[r.dept].last) map[r.dept].last = r.date || '';
  });
  return Object.values(map).sort((a,b) => (b.gas + b.diesel) - (a.gas + a.diesel));
}
function renderDept(){
  const rows = deptSummary();
  $id('dept-count').textContent = num(rows.length);
  $id('dept-body').innerHTML = !rows.length
    ? '<tr><td colspan="7" class="mk-empty">لا توجد عمليات توزيع بعد.</td></tr>'
    : rows.map((r,i) => `<tr><td class="num">${num(i+1)}</td><td><b>${esc(r.dept)}</b></td>
        <td class="fu-q">${num(r.gas)}</td><td class="fu-q">${num(r.diesel)}</td><td class="num">${num(r.count)}</td><td class="num">${fmtDate(r.last)}</td>
        <td><button class="btn btn-sm" onclick="FU.printStatement('${esc(r.dept).replace(/'/g,"\\'")}')">كشف حساب</button></td></tr>`).join('');
}
function renderDash(){
  const g = balanceOf('غاز'), d = balanceOf('سولار');
  $id('d-gin').textContent = num(g.in);   $id('d-gout').textContent = num(g.out); $id('d-gbal').textContent = num(g.bal);
  $id('d-gcyl').textContent = `≈ ${num(g.bal / cylDefault)} اسطوانة`;
  $id('d-din').textContent = num(d.in);   $id('d-dout').textContent = num(d.out); $id('d-dbal').textContent = num(d.bal);
  const warn = alerts();
  $id('dash-banner').innerHTML = warn.length
    ? warn.map(a => `<div class="mk-banner ${a.severity === 'high' ? 'bad' : 'warn'}">${ico(a.severity === 'high' ? 'error' : 'warning')}<span class="grow"><b>${esc(a.title)}</b> — ${esc(a.subtitle)}</span></div>`).join('') : '';
  const badge = $id('low-badge');
  if(badge){ badge.textContent = warn.length ? num(warn.length) : ''; badge.classList.toggle('show', warn.length > 0); badge.classList.toggle('mid', !warn.some(a => a.severity === 'high')); }

  const months = allMonths();
  const body = $id('month-body');
  if(!months.length) body.innerHTML = '<tr><td colspan="7" class="mk-empty">لا توجد بيانات بعد.</td></tr>';
  else body.innerHTML = months.map((m,i) => {
    const sum = (arr,t) => arr.filter(r => monthKey(r.date) === m && r.type === t).reduce((s,r) => s + (+r.qty||0), 0);
    const gi = sum(fIn,'غاز'), go = sum(fOut,'غاز'), di = sum(fIn,'سولار'), dof = sum(fOut,'سولار');
    const prev = months[i+1];
    const chg = (cur, t) => {
      if(!prev) return '<span class="muted">—</span>';
      const p = fOut.filter(r => monthKey(r.date) === prev && r.type === t).reduce((s,r) => s + (+r.qty||0), 0);
      if(!p) return '<span class="muted">—</span>';
      const pct = (cur - p) / p * 100;
      const cls = pct > 0 ? 'up' : pct < 0 ? 'down' : '';
      return `<span class="fu-chg ${cls}">${pct > 0 ? '▲' : pct < 0 ? '▼' : '—'} ${num(Math.abs(pct).toFixed(0))}٪</span>`;
    };
    return `<tr><td><b>${monthLabel(m)}</b></td><td class="fu-q in">${num(gi)}</td><td class="fu-q out">${num(go)}</td><td>${chg(go,'غاز')}</td>
      <td class="fu-q in">${num(di)}</td><td class="fu-q out">${num(dof)}</td><td>${chg(dof,'سولار')}</td></tr>`;
  }).join('');
  renderChart(chartType);
}

/* ---------- الرسم البياني ---------- */
function isVisible(){ const p = document.getElementById('page-fuel'); return p && p.classList.contains('active'); }
function cssVar(n){ return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
function showChart(type, btn){
  chartType = type; vib(6);
  document.querySelectorAll('#fu-chart-seg button').forEach(b => b.setAttribute('aria-pressed', b === btn));
  renderChart(type);
}
function renderChart(type){
  if(typeof Chart === 'undefined') return;
  const cv = $id('chart'); if(!cv) return;
  const gasC = '#E8A33A', dslC = '#4F9CF9';
  let labels = [], datasets = [];
  if(type === 'monthly'){
    const months = [...new Set(fOut.map(r => monthKey(r.date)).filter(Boolean))].sort().slice(-12);
    labels = months.map(monthLabel);
    const s = (m,t) => fOut.filter(r => monthKey(r.date) === m && r.type === t).reduce((a,r) => a + (+r.qty||0), 0);
    datasets = [{ label:'غاز (كيلو)', data:months.map(m => s(m,'غاز')), backgroundColor:gasC, borderRadius:8, maxBarThickness:54 },
                { label:'سولار (لتر)', data:months.map(m => s(m,'سولار')), backgroundColor:dslC, borderRadius:8, maxBarThickness:54 }];
  } else if(type === 'dept'){
    const rows = deptSummary().slice(0,10);
    labels = rows.map(r => r.dept);
    datasets = [{ label:'غاز (كيلو)', data:rows.map(r => r.gas), backgroundColor:gasC, borderRadius:8, maxBarThickness:54 },
                { label:'سولار (لتر)', data:rows.map(r => r.diesel), backgroundColor:dslC, borderRadius:8, maxBarThickness:54 }];
  } else {
    const g = balanceOf('غاز'), d = balanceOf('سولار');
    labels = ['غاز (كيلو)','سولار (لتر)'];
    datasets = [{ label:'وارد', data:[g.in,d.in], backgroundColor:cssVar('--accent'), borderRadius:8, maxBarThickness:54 },
                { label:'موزع', data:[g.out,d.out], backgroundColor:cssVar('--danger'), borderRadius:8, maxBarThickness:54 },
                { label:'رصيد', data:[g.bal,d.bal], backgroundColor:dslC, borderRadius:8, maxBarThickness:54 }];
  }
  const muted = cssVar('--muted'), grid = cssVar('--card-border'), font = cssVar('--f-body');
  if(chartInstance) chartInstance.destroy();
  chartInstance = new Chart(cv.getContext('2d'), {
    type:'bar', data:{ labels, datasets },
    options:{ responsive:true, maintainAspectRatio:false, animation:{ duration:350 },
      plugins:{ legend:{ rtl:true, labels:{ color:muted, font:{ family:font, size:12 }, boxWidth:14 } },
                tooltip:{ rtl:true, callbacks:{ label:c => `${c.dataset.label}: ${num(c.parsed.y)}` } } },
      scales:{ x:{ reverse:true, ticks:{ color:muted, font:{ family:font, size:11 } }, grid:{ display:false } },
               y:{ position:'right', beginAtZero:true, ticks:{ color:muted, font:{ family:font }, callback:v => num(v) }, grid:{ color:grid } } } }
  });
}

/* ---------- نموذج الوارد ---------- */
function openIn(id){
  vib(10);
  const ex = id ? fIn.find(r => r.id === id) : null;
  const html = `
    <div class="mk-form-head">${ico('inbox')}<div><h3>${ex ? 'تعديل سجل وارد' : 'تسجيل كمية واردة'}</h3><p>الغاز بالكيلو والسولار باللتر. الاسطوانات تُحوَّل تلقائياً.</p></div></div>
    <div class="mk-grid-2">
      <div class="mk-field"><label for="fu-i-date">التاريخ <i>*</i></label><input class="mk-inp" type="date" id="fu-i-date" value="${ex ? ex.date : todayISO()}"></div>
      <div class="mk-field"><label>نوع الوقود</label><div class="mk-seg" id="fu-i-type">${TYPES.map(t => `<button type="button" data-val="${t}" aria-pressed="${(ex?ex.type:'غاز')===t}">${t}</button>`).join('')}</div></div>
    </div>
    <div class="mk-grid-2">
      <div class="mk-field"><label for="fu-i-mode">طريقة الإدخال</label><select class="mk-inp" id="fu-i-mode"><option value="base">بالوحدة الأساسية</option><option value="cyl"${ex && ex.cyl ? ' selected' : ''}>بالاسطوانات</option></select></div>
      <div class="mk-field" id="fu-i-cylf" hidden><label for="fu-i-cyl">وزن الاسطوانة (كيلو)</label><input class="mk-inp" type="number" id="fu-i-cyl" min="0.1" step="0.1" value="${ex && ex.cyl ? ex.cyl : cylDefault}"></div>
    </div>
    <div class="mk-field"><label for="fu-i-qty" id="fu-i-qlabel">الكمية <i>*</i></label><input class="mk-inp" type="number" id="fu-i-qty" min="0" step="0.01" placeholder="0" value="${ex ? (ex.cyl ? ex.qty/ex.cyl : ex.qty) : ''}"></div>
    <div class="fu-prev" id="fu-i-prev"></div>
    <div class="mk-grid-2">
      <div class="mk-field"><label for="fu-i-src">المصدر / المورد</label><input class="mk-inp" type="text" id="fu-i-src" list="fu-src-dl" placeholder="مثال: إمداد الداخلية" value="${esc(ex ? ex.src||'' : '')}"><datalist id="fu-src-dl">${sources().map(s => `<option value="${esc(s)}">`).join('')}</datalist></div>
      <div class="mk-field"><label for="fu-i-notes">ملاحظات</label><input class="mk-inp" type="text" id="fu-i-notes" placeholder="اختياري" value="${esc(ex ? ex.notes||'' : '')}"></div>
    </div>
    <div class="actions"><button class="btn btn-primary" data-save data-autofocus>${ex ? 'حفظ التعديل' : 'تسجيل الوارد'}</button><button class="btn" data-cancel>إلغاء</button></div>`;
  const sheet = App.sheet(html, { cls:'wide' });
  const ov = sheet.ov, q = s => ov.querySelector(s);
  let typeVal = ex ? ex.type : 'غاز';
  const calc = () => {
    const mode = q('#fu-i-mode').value, raw = parseFloat(q('#fu-i-qty').value) || 0;
    if(mode === 'cyl' && typeVal === 'غاز'){ const w = parseFloat(q('#fu-i-cyl').value) || cylDefault; return { qty: raw*w, cyl:w, count:raw }; }
    return { qty: raw, cyl:null, count:null };
  };
  const sync = () => {
    const modeSel = q('#fu-i-mode');
    if(typeVal === 'سولار'){ modeSel.value = 'base'; modeSel.disabled = true; } else modeSel.disabled = false;
    const isCyl = modeSel.value === 'cyl' && typeVal === 'غاز';
    q('#fu-i-cylf').hidden = !isCyl;
    q('#fu-i-qlabel').innerHTML = (isCyl ? 'عدد الاسطوانات' : `الكمية (${BASE_UNIT[typeVal]})`) + ' <i>*</i>';
    const c = calc();
    q('#fu-i-prev').textContent = (c.count && c.qty) ? `= ${num(c.qty)} ${BASE_UNIT[typeVal]} (${num(c.count)} اسطوانة × ${num(c.cyl)} كيلو)` : '';
  };
  q('#fu-i-type').addEventListener('click', e => { const b = e.target.closest('button'); if(!b) return; typeVal = b.dataset.val; ov.querySelectorAll('#fu-i-type button').forEach(x => x.setAttribute('aria-pressed', x === b)); sync(); vib(6); });
  ['#fu-i-mode','#fu-i-cyl','#fu-i-qty'].forEach(s => { q(s).addEventListener('input', sync); q(s).addEventListener('change', sync); });
  sync();
  q('[data-cancel]').onclick = () => sheet.close();
  q('[data-save]').onclick = () => {
    const date = q('#fu-i-date').value, c = calc();
    if(!date){ markInvalid(q('#fu-i-date')); return notify({ type:'error', title:'التاريخ مطلوب', log:false }); }
    if(!c.qty || c.qty <= 0){ markInvalid(q('#fu-i-qty')); return notify({ type:'error', title:'أدخل كمية صحيحة', msg:'الكمية لازم تكون أكبر من صفر.', log:false }); }
    const rec = { date, type:typeVal, qty:c.qty, unit:BASE_UNIT[typeVal], cyl:c.cyl, src:q('#fu-i-src').value.trim(), notes:q('#fu-i-notes').value.trim() };
    const snapIn = JSON.stringify(fIn);
    let target;
    if(ex){
      const nextIn = fIn.map(r => r.id === ex.id ? { ...r, ...rec } : r);
      const neg = negativeTypes(nextIn, fOut);
      if(neg.length) return notify({ type:'error', title:'التعديل يجعل الرصيد سالباً', msg:`رصيد ${neg.join(' و')} ما بيكفي الكميات الموزعة. عدّل التوزيع أولاً.`, log:false });
      fIn = nextIn; target = fIn.find(r => r.id === ex.id);
    } else {
      target = { id:newId('fi'), ...rec, createdAt:new Date().toISOString() };
      fIn.push(target);
    }
    if(!save()){ fIn = JSON.parse(snapIn); return; }
    flashId = target.id; sheet.close('saved');
    showView('in', true); renderAll();
    const b = balanceOf(typeVal);
    notify({ type:'success', title: ex ? 'تم تحديث سجل الوارد' : `تم تسجيل ${num(c.qty)} ${BASE_UNIT[typeVal]} ${typeVal}`,
      msg:`الرصيد الجديد من ${typeVal}: ${num(b.bal)} ${BASE_UNIT[typeVal]}.`, page:'fuel',
      action:{ label:'توزيع منه', fn:() => openOut() } });
  };
}

/* ---------- نموذج التوزيع ---------- */
function openOut(id){
  vib(10);
  const ex = id ? fOut.find(r => r.id === id) : null;
  if(!ex && TYPES.every(t => balanceOf(t).in === 0))
    return notify({ type:'warning', title:'ما في رصيد للتوزيع', msg:'سجّل كمية واردة أول شي، بعدها بتقدر توزّع منها.', action:{ label:'تسجيل وارد', fn:() => openIn() } });
  const html = `
    <div class="mk-form-head">${ico('outbox')}<div><h3>${ex ? 'تعديل سجل توزيع ' + voucherNo(ex) : 'تسجيل عملية توزيع'}</h3><p>${ex ? 'رقم السند لا يتغيّر بالتعديل.' : 'يُعطى رقم سند تلقائي عند الحفظ.'}</p></div></div>
    <div class="fu-bal" id="fu-o-bal"></div>
    <div class="mk-grid-2">
      <div class="mk-field"><label for="fu-o-date">التاريخ <i>*</i></label><input class="mk-inp" type="date" id="fu-o-date" value="${ex ? ex.date : todayISO()}"></div>
      <div class="mk-field"><label>نوع الوقود</label><div class="mk-seg" id="fu-o-type">${TYPES.map(t => `<button type="button" data-val="${t}" aria-pressed="${(ex?ex.type:'غاز')===t}">${t}</button>`).join('')}</div></div>
    </div>
    <div class="mk-grid-2">
      <div class="mk-field"><label for="fu-o-mode">طريقة الإدخال</label><select class="mk-inp" id="fu-o-mode"><option value="base">بالوحدة الأساسية</option><option value="cyl"${ex && ex.cyl ? ' selected' : ''}>بالاسطوانات</option></select></div>
      <div class="mk-field" id="fu-o-cylf" hidden><label for="fu-o-cyl">وزن الاسطوانة (كيلو)</label><input class="mk-inp" type="number" id="fu-o-cyl" min="0.1" step="0.1" value="${ex && ex.cyl ? ex.cyl : cylDefault}"></div>
    </div>
    <div class="mk-field"><label for="fu-o-qty" id="fu-o-qlabel">الكمية <i>*</i></label><input class="mk-inp" type="number" id="fu-o-qty" min="0" step="0.01" placeholder="0" value="${ex ? (ex.cyl ? ex.qty/ex.cyl : ex.qty) : ''}"></div>
    <div class="fu-prev" id="fu-o-prev"></div>
    <div class="mk-grid-2">
      <div class="mk-field"><label for="fu-o-dept">الجهة / الشخص <i>*</i></label><input class="mk-inp" type="text" id="fu-o-dept" list="fu-dept-dl" placeholder="مثال: مركز النور" value="${esc(ex ? ex.dept||'' : '')}"><datalist id="fu-dept-dl">${depts().map(d => `<option value="${esc(d)}">`).join('')}</datalist></div>
      <div class="mk-field"><label for="fu-o-notes">ملاحظات</label><input class="mk-inp" type="text" id="fu-o-notes" placeholder="اختياري" value="${esc(ex ? ex.notes||'' : '')}"></div>
    </div>
    <div class="actions"><button class="btn btn-primary" data-save data-autofocus>${ex ? 'حفظ التعديل' : 'تنفيذ التوزيع'}</button><button class="btn" data-cancel>إلغاء</button></div>`;
  const sheet = App.sheet(html, { cls:'wide' });
  const ov = sheet.ov, q = s => ov.querySelector(s);
  let typeVal = ex ? ex.type : 'غاز';
  const available = t => { const others = fOut.filter(r => !ex || r.id !== ex.id).filter(r => r.type === t).reduce((s,r) => s + (+r.qty||0), 0); return balanceOf(t).in - others; };
  const calc = () => {
    const mode = q('#fu-o-mode').value, raw = parseFloat(q('#fu-o-qty').value) || 0;
    if(mode === 'cyl' && typeVal === 'غاز'){ const w = parseFloat(q('#fu-o-cyl').value) || cylDefault; return { qty: raw*w, cyl:w, count:raw }; }
    return { qty: raw, cyl:null, count:null };
  };
  const sync = () => {
    const modeSel = q('#fu-o-mode');
    if(typeVal === 'سولار'){ modeSel.value = 'base'; modeSel.disabled = true; } else modeSel.disabled = false;
    const isCyl = modeSel.value === 'cyl' && typeVal === 'غاز';
    q('#fu-o-cylf').hidden = !isCyl;
    q('#fu-o-qlabel').innerHTML = (isCyl ? 'عدد الاسطوانات' : `الكمية (${BASE_UNIT[typeVal]})`) + ' <i>*</i>';
    const avail = available(typeVal);
    q('#fu-o-bal').innerHTML = `${ico('fuel',22)}<span>الرصيد المتاح من <b>${typeVal}</b>: <b>${num(avail)}</b> ${BASE_UNIT[typeVal]}</span>`;
    const c = calc();
    q('#fu-o-prev').textContent = (c.count && c.qty) ? `= ${num(c.qty)} ${BASE_UNIT[typeVal]} (${num(c.count)} اسطوانة × ${num(c.cyl)} كيلو)` : '';
  };
  q('#fu-o-type').addEventListener('click', e => { const b = e.target.closest('button'); if(!b) return; typeVal = b.dataset.val; ov.querySelectorAll('#fu-o-type button').forEach(x => x.setAttribute('aria-pressed', x === b)); sync(); vib(6); });
  ['#fu-o-mode','#fu-o-cyl','#fu-o-qty'].forEach(s => { q(s).addEventListener('input', sync); q(s).addEventListener('change', sync); });
  sync();
  q('[data-cancel]').onclick = () => sheet.close();
  q('[data-save]').onclick = () => {
    const date = q('#fu-o-date').value, dept = q('#fu-o-dept').value.trim(), c = calc();
    if(!date){ markInvalid(q('#fu-o-date')); return notify({ type:'error', title:'التاريخ مطلوب', log:false }); }
    if(!c.qty || c.qty <= 0){ markInvalid(q('#fu-o-qty')); return notify({ type:'error', title:'أدخل كمية صحيحة', msg:'الكمية لازم تكون أكبر من صفر.', log:false }); }
    if(!dept){ markInvalid(q('#fu-o-dept')); return notify({ type:'error', title:'الجهة مطلوبة', msg:'اكتب الجهة أو الشخص المستلم.', log:false }); }
    const avail = available(typeVal);
    if(c.qty > avail + 0.0001){ markInvalid(q('#fu-o-qty')); return notify({ type:'error', title:'الرصيد لا يكفي', msg:`المتاح من ${typeVal}: ${num(avail)} ${BASE_UNIT[typeVal]} فقط.`, log:false }); }
    const rec = { date, type:typeVal, qty:c.qty, unit:BASE_UNIT[typeVal], cyl:c.cyl, dept, notes:q('#fu-o-notes').value.trim() };
    const snapOut = JSON.stringify(fOut);
    let target;
    if(ex){ const i = fOut.findIndex(r => r.id === ex.id); target = fOut[i] = { ...fOut[i], ...rec }; }
    else { target = { id:newId('fo'), no:nextNo(), ...rec, createdAt:new Date().toISOString() }; fOut.push(target); }
    if(!save()){ fOut = JSON.parse(snapOut); return; }
    flashId = target.id; sheet.close('saved');
    showView('out', true); renderAll();
    const b = balanceOf(typeVal);
    notify({ type:'success', title: ex ? `تم تحديث السند ${voucherNo(target)}` : `تم صرف ${num(c.qty)} ${BASE_UNIT[typeVal]} ${typeVal} — سند ${voucherNo(target)}`,
      msg:`${dept} — الرصيد المتبقي من ${typeVal}: ${num(b.bal)} ${BASE_UNIT[typeVal]}.`, page:'fuel', duration:9000,
      action:{ label:'طباعة السند', fn:() => printVoucher(target.id) } });
  };
}

/* ---------- الحذف ---------- */
async function delIn(id){
  const r = fIn.find(x => x.id === id); if(!r) return;
  const after = fIn.filter(x => x.id !== id);
  const neg = negativeTypes(after, fOut);
  if(neg.length) return notify({ type:'error', title:'لا يمكن حذف هذا الوارد', msg:`حذفه يخلي رصيد ${neg.join(' و')} سالباً. احذف عمليات التوزيع المرتبطة أولاً.`, log:false });
  const ok = await confirmD({ title:'حذف سجل الوارد؟', msg:`${r.type} — ${num(r.qty)} ${r.unit || BASE_UNIT[r.type]} بتاريخ ${fmtDate(r.date)}${r.src ? ' من ' + r.src : ''}.`, okText:'حذف', danger:true, icon:'fuel' });
  if(!ok) return;
  const pos = fIn.indexOf(r);
  fIn = after; save(); renderAll();
  notify({ type:'success', title:'تم حذف سجل الوارد', msg:`الرصيد الجديد من ${r.type}: ${num(balanceOf(r.type).bal)} ${BASE_UNIT[r.type]}.`, page:'fuel', duration:8000,
    action:{ label:'تراجع', fn:() => { fIn.splice(Math.min(pos, fIn.length), 0, r); flashId = r.id; save(); renderAll(); notify({ type:'info', title:'تمت استعادة السجل', log:false }); } } });
}
async function delOut(id){
  const r = fOut.find(x => x.id === id); if(!r) return;
  const ok = await confirmD({ title:`حذف سند التوزيع ${voucherNo(r)}؟`, msg:`${r.dept || '—'} — ${num(r.qty)} ${r.unit || BASE_UNIT[r.type]} ${r.type} بتاريخ ${fmtDate(r.date)}. الكمية بترجع للرصيد.`, okText:'حذف', danger:true, icon:'fuel' });
  if(!ok) return;
  const pos = fOut.indexOf(r);
  fOut = fOut.filter(x => x.id !== id); save(); renderAll();
  notify({ type:'success', title:`تم حذف السند ${voucherNo(r)}`, msg:`الرصيد الجديد من ${r.type}: ${num(balanceOf(r.type).bal)} ${BASE_UNIT[r.type]}.`, page:'fuel', duration:8000,
    action:{ label:'تراجع', fn:() => { fOut.splice(Math.min(pos, fOut.length), 0, r); flashId = r.id; save(); renderAll(); notify({ type:'info', title:'تمت استعادة السند', log:false }); } } });
}

/* ---------- الطباعة ---------- */
const PRINT_BASE = `body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;direction:rtl;padding:24px;color:#111}
  h1{text-align:center;font-size:1.25rem;margin:8px 0 2px}.sub{text-align:center;color:#555;font-size:.85rem;margin-bottom:16px}
  table{width:100%;border-collapse:collapse;font-size:.82rem}
  th{background:#1B3B2F;color:#fff;padding:7px 9px;text-align:right;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  td{border-bottom:1px solid #ddd;padding:6px 9px;vertical-align:top}
  .sig{margin-top:44px;display:flex;gap:30px;page-break-inside:avoid}
  .s{flex:1;text-align:center;border-top:1px solid #111;padding-top:6px;font-size:.82rem}
  .foot{margin-top:16px;font-size:.7rem;color:#888;text-align:center}@media print{body{padding:0}}`;
function openPrint(title, body, extraCss){
  const w = window.open('', '_blank');
  if(!w) return notify({ type:'error', title:'المتصفح منع نافذة الطباعة', msg:'اسمح بالنوافذ المنبثقة لهذا الموقع ثم أعد المحاولة.' });
  w.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>${esc(title)}</title><style>${PRINT_BASE}${extraCss||''}</style></head><body>${App.letterheadHTML()}${body}<script>window.onload=()=>window.print();<\/script></body></html>`);
  w.document.close();
  return true;
}
function printVoucher(id){
  const r = fOut.find(x => x.id === id); if(!r) return;
  const cylTxt = r.cyl ? ` (${num(r.qty/r.cyl)} اسطوانة × ${num(r.cyl)} كيلو)` : '';
  const body = `<div class="doc">
    <div class="head"><div class="ttl">سند صرف وقود</div><div class="no">رقم السند: ${voucherNo(r)}</div></div>
    <table>
      <tr><th>التاريخ</th><td>${fmtDate(r.date)}</td></tr>
      <tr><th>الجهة / الشخص المستلم</th><td class="big">${esc(r.dept || '—')}</td></tr>
      <tr><th>نوع الوقود</th><td class="big">${esc(r.type)}</td></tr>
      <tr><th>الكمية المصروفة</th><td class="big">${num(r.qty)} ${esc(r.unit || BASE_UNIT[r.type])}${cylTxt}</td></tr>
      <tr><th>ملاحظات</th><td>${esc(r.notes || '—')}</td></tr>
    </table>
    <div class="sig"><div class="s">توقيع أمين المخزن</div><div class="s">توقيع المستلم</div><div class="s">اعتماد المدير</div></div>
    <div class="foot">أُصدر هذا السند إلكترونياً بتاريخ ${fmtDate(todayISO())}</div></div>`;
  const css = `.doc{max-width:720px;margin:0 auto;border:2px solid #111;padding:26px}
    .head{text-align:center;border-bottom:2px solid #111;padding-bottom:12px;margin-bottom:18px}
    .ttl{font-size:1.3rem;font-weight:bold}.no{font-size:.85rem;color:#555;margin-top:4px}
    th{width:32%}.big{font-size:1.1rem;font-weight:bold}td,th{border:1px solid #999}`;
  if(openPrint('سند صرف ' + voucherNo(r), body, css)) notify({ type:'info', title:'تم تجهيز السند ' + voucherNo(r), msg:'اختر «حفظ بصيغة PDF» أو اطبعه مباشرة.', log:false });
}
function printStatement(dept){
  const rows = fOut.filter(r => r.dept === dept && (!fMonth || monthKey(r.date) === fMonth)).sort((a,b) => (a.date||'').localeCompare(b.date||''));
  if(!rows.length) return notify({ type:'warning', title:'لا توجد عمليات لهذه الجهة', msg:'غيّر فلتر الشهر وأعد المحاولة.', log:false });
  const gas = rows.filter(r => r.type === 'غاز').reduce((s,r) => s + (+r.qty||0), 0);
  const dsl = rows.filter(r => r.type === 'سولار').reduce((s,r) => s + (+r.qty||0), 0);
  const body = `<h1>كشف حساب توزيع وقود</h1>
    <div class="sub">الجهة: <b>${esc(dept)}</b> — الفترة: ${fMonth ? monthLabel(fMonth) : 'كل الفترات'} — تاريخ الإصدار: ${fmtDate(todayISO())}</div>
    <div class="box"><div class="b"><div class="bv">${num(gas)}</div><div class="bl">إجمالي الغاز (كيلو)</div></div>
      <div class="b"><div class="bv">${num(dsl)}</div><div class="bl">إجمالي السولار (لتر)</div></div>
      <div class="b"><div class="bv">${num(rows.length)}</div><div class="bl">عدد العمليات</div></div></div>
    <table><thead><tr><th>#</th><th>السند</th><th>التاريخ</th><th>النوع</th><th>الكمية</th><th>الوحدة</th><th>ملاحظات</th></tr></thead><tbody>
    ${rows.map((r,i) => `<tr><td>${num(i+1)}</td><td>${voucherNo(r)}</td><td>${fmtDate(r.date)}</td><td>${esc(r.type)}</td><td>${num(r.qty)}</td><td>${esc(r.unit || BASE_UNIT[r.type])}</td><td>${esc(r.notes || '—')}</td></tr>`).join('')}
    </tbody></table>
    <div class="sig"><div class="s">أمين المخزن</div><div class="s">المستلم</div><div class="s">اعتماد المدير</div></div>`;
  const css = `.box{border:1px solid #999;border-radius:6px;padding:12px 16px;margin-bottom:16px;display:flex;gap:24px;justify-content:center}
    .b{text-align:center}.bv{font-size:1.2rem;font-weight:bold}.bl{font-size:.7rem;color:#666}`;
  if(openPrint('كشف حساب ' + dept, body, css)) notify({ type:'info', title:'تم تجهيز كشف الحساب', msg:`${esc(dept)} — ${num(rows.length)} عملية.`, log:false });
}
/* ---------- التقرير الشهري المفصل (شهر واحد فقط، بلا دمج ما قبله) ---------- */
let monthSheet = null, monthMode = 'print';
function openWordSheet(){ openMonthSheet('word'); }
function openMonthSheet(mode){
  monthMode = mode === 'word' ? 'word' : 'print';
  const months = allMonths();
  if(!months.length) return notify({ type:'warning', title:'لا توجد بيانات مؤرخة', msg:'أضف وارداً أو توزيعاً ثم أعد المحاولة.', log:false });
  const rows = months.map((m,i) => {
    const ci = fIn.filter(r => monthKey(r.date) === m).length, co = fOut.filter(r => monthKey(r.date) === m).length;
    return `<label class="fu-mrow"><input type="radio" name="fu-month" class="fu-mchk" value="${m}"${i===0?' checked':''}><span class="fu-mname">${monthLabel(m)}</span><span class="fu-mcnt num">${num(ci)} وارد · ${num(co)} توزيع</span></label>`;
  }).join('');
  monthSheet = App.sheet(`
    <div class="mk-form-head"><h3>${monthMode === 'word' ? 'تقرير Word شهري' : 'تقرير شهري مفصل'}</h3><p class="mk-hint">اختر شهراً واحداً. ${monthMode === 'word' ? 'يُنزَّل ملف Word بجدولين: كميات الغاز والسولار، والتوزيع حسب الجهة.' : 'التقرير يشمل حركة هذا الشهر فقط دون أي شهر سابق.'}</p></div>
    <div class="fu-mlist">${rows}</div>
    <div class="mk-btns"><button class="btn btn-primary" onclick="FU.runMonthReport()">${monthMode === 'word' ? 'تنزيل ملف Word' : 'إنشاء التقرير'}</button></div>`, { cls:'wide', onClose:() => { monthSheet = null; } });
  vib(8);
}
function runMonthReport(){
  const sel = document.querySelector('.fu-mchk:checked');
  if(!sel) return notify({ type:'warning', title:'لم تختر شهراً', msg:'حدّد الشهر المطلوب ثم اضغط إنشاء التقرير.', log:false });
  const m = sel.value;
  const mode = monthMode;
  if(monthSheet && monthSheet.close) monthSheet.close();
  if(mode === 'word') wordMonthReport(m); else printMonthReport(m);
}

/* تقرير Word شهري: جدولان فقط — الكميات حسب النوع، والتوزيع حسب الجهة */
function wordMonthReport(m){
  const inList = fIn.filter(r => monthKey(r.date) === m);
  const outList = fOut.filter(r => monthKey(r.date) === m);
  if(!inList.length && !outList.length) return notify({ type:'warning', title:'لا توجد حركة في هذا الشهر', msg:'اختر شهراً آخر.', log:false });
  const sum = (arr, t) => arr.filter(r => r.type === t).reduce((s, r) => s + (+r.qty||0), 0);
  const gi = sum(inList,'غاز'), go = sum(outList,'غاز'), di = sum(inList,'سولار'), dout = sum(outList,'سولار');

  const qtyRows = [
    ['الغاز', BASE_UNIT['غاز'], num(gi), num(go), num(gi - go)],
    ['السولار', BASE_UNIT['سولار'], num(di), num(dout), num(di - dout)]
  ];

  const dmap = {};
  outList.forEach(r => {
    const k = r.dept || '—';
    if(!dmap[k]) dmap[k] = { dept:k, gas:0, diesel:0, count:0 };
    if(r.type === 'غاز') dmap[k].gas += (+r.qty||0); else dmap[k].diesel += (+r.qty||0);
    dmap[k].count++;
  });
  const dList = Object.values(dmap).sort((a,b) => (b.gas + b.diesel) - (a.gas + a.diesel));
  const deptRows = dList.map((r, i) => [num(i+1), r.dept, num(r.gas), num(r.diesel), num(r.count)]);
  if(deptRows.length){
    const tot = ['', 'الإجمالي', num(dList.reduce((s,r) => s + r.gas, 0)), num(dList.reduce((s,r) => s + r.diesel, 0)), num(dList.reduce((s,r) => s + r.count, 0))];
    tot.__bold = true; deptRows.push(tot);
  }

  const blocks = [
    { type:'h1', text:'تقرير توزيع الوقود — ' + monthLabel(m) },
    { type:'note', text:`حركة شهر ${monthLabel(m)} وحده — تاريخ الإصدار ${fmtDate(todayISO())}` },
    { type:'h2', text:'أولاً: الوارد والموزع حسب النوع' },
    { type:'table', head:['النوع','الوحدة','الوارد','الموزع','المتبقي من الوارد'], rows:qtyRows, widths:[1100,800,1050,1050,1000] },
    { type:'h2', text:'ثانياً: التوزيع حسب الجهة' },
    { type:'table', head:['#','الجهة / الشخص',`غاز (${BASE_UNIT['غاز']})`,`سولار (${BASE_UNIT['سولار']})`,'عدد السندات'],
      rows: deptRows.length ? deptRows : [['—','لا يوجد توزيع في هذا الشهر','—','—','—']], widths:[450,2000,900,900,750] },
    { type:'space' },
    { type:'table', head:null, rows:[['أمين المخزن','مدير العمليات','اعتماد المدير العام'], ['','','']], widths:[1666,1667,1667] }
  ];
  const name = `تقرير الوقود ${monthLabel(m)}.docx`;
  if(App.exportWord(name, blocks))
    notify({ type:'success', title:`تم تنزيل تقرير ${monthLabel(m)}`, msg:`ملف Word بجدولين — ${num(dList.length)} جهة في هذا الشهر.`, log:false });
}
function printMonthReport(m){
  const inList = fIn.filter(r => monthKey(r.date) === m).sort((a,b) => (a.date||'').localeCompare(b.date||''));
  const outList = fOut.filter(r => monthKey(r.date) === m).sort((a,b) => (a.date||'').localeCompare(b.date||''));
  if(!inList.length && !outList.length) return notify({ type:'warning', title:'لا توجد حركة في هذا الشهر', msg:'اختر شهراً آخر.', log:false });
  const sum = (arr,t) => arr.filter(r => r.type === t).reduce((s,r) => s + (+r.qty||0), 0);
  const gi = sum(inList,'غاز'), go = sum(outList,'غاز'), di = sum(inList,'سولار'), dsl = sum(outList,'سولار');

  /* التوزيع اليومي داخل الشهر */
  const days = [...new Set([...inList, ...outList].map(r => r.date).filter(Boolean))].sort();
  const dayRows = days.map(d => {
    const di2 = inList.filter(r => r.date === d), do2 = outList.filter(r => r.date === d);
    const q = (arr,t) => arr.filter(r => r.type === t).reduce((s,r) => s + (+r.qty||0), 0);
    return `<tr><td><b>${fmtDate(d)}</b></td><td>${num(q(di2,'غاز'))}</td><td>${num(q(do2,'غاز'))}</td><td>${num(q(di2,'سولار'))}</td><td>${num(q(do2,'سولار'))}</td><td>${num(di2.length + do2.length)}</td></tr>`;
  }).join('');

  /* حسب الجهة داخل الشهر فقط */
  const dmap = {};
  outList.forEach(r => {
    if(!r.dept) return;
    if(!dmap[r.dept]) dmap[r.dept] = { dept:r.dept, gas:0, diesel:0, count:0, last:'' };
    if(r.type === 'غاز') dmap[r.dept].gas += (+r.qty||0); else dmap[r.dept].diesel += (+r.qty||0);
    dmap[r.dept].count++;
    if((r.date||'') > dmap[r.dept].last) dmap[r.dept].last = r.date || '';
  });
  const deptRows = Object.values(dmap).sort((a,b) => (b.gas + b.diesel) - (a.gas + a.diesel))
    .map((r,i) => `<tr><td>${num(i+1)}</td><td>${esc(r.dept)}</td><td>${num(r.gas)}</td><td>${num(r.diesel)}</td><td>${num(r.count)}</td><td>${fmtDate(r.last)}</td></tr>`).join('');

  /* حسب المصدر داخل الشهر فقط */
  const smap = {};
  inList.forEach(r => {
    const k = r.src || '—';
    if(!smap[k]) smap[k] = { src:k, gas:0, diesel:0, count:0, last:'' };
    if(r.type === 'غاز') smap[k].gas += (+r.qty||0); else smap[k].diesel += (+r.qty||0);
    smap[k].count++;
    if((r.date||'') > smap[k].last) smap[k].last = r.date || '';
  });
  const srcRows = Object.values(smap).sort((a,b) => (b.gas + b.diesel) - (a.gas + a.diesel))
    .map((r,i) => `<tr><td>${num(i+1)}</td><td>${esc(r.src)}</td><td>${num(r.gas)}</td><td>${num(r.diesel)}</td><td>${num(r.count)}</td><td>${fmtDate(r.last)}</td></tr>`).join('');

  const empty = c => `<tr><td colspan="${c}" style="text-align:center;padding:16px;color:#999">لا توجد بيانات</td></tr>`;
  const body = `<h1>التقرير الشهري لتوزيع الوقود</h1>
    <div class="sub">الشهر: <b>${esc(monthLabel(m))}</b> — تاريخ الإصدار: ${fmtDate(todayISO())}</div>
    <div class="note">هذا التقرير يشمل حركة شهر ${esc(monthLabel(m))} وحده — الأرقام فيه لا تتضمن أي شهر سابق.</div>
    <h2>١. ملخص الشهر</h2>
    <div class="kpis">
      <div class="kpi"><div class="kv">${num(gi)}</div><div class="kl">وارد الغاز (كيلو)</div></div>
      <div class="kpi"><div class="kv">${num(go)}</div><div class="kl">موزع الغاز</div></div>
      <div class="kpi"><div class="kv">${num(gi - go)}</div><div class="kl">صافي حركة الغاز</div></div>
      <div class="kpi"><div class="kv">${num(di)}</div><div class="kl">وارد السولار (لتر)</div></div>
      <div class="kpi"><div class="kv">${num(dsl)}</div><div class="kl">موزع السولار</div></div>
      <div class="kpi"><div class="kv">${num(di - dsl)}</div><div class="kl">صافي حركة السولار</div></div>
      <div class="kpi"><div class="kv">${num(outList.length)}</div><div class="kl">سندات التوزيع</div></div>
      <div class="kpi"><div class="kv">${num(Object.keys(dmap).length)}</div><div class="kl">جهات مستفيدة</div></div>
    </div>
    <h2>٢. الحركة اليومية</h2>
    <table><thead><tr><th>اليوم</th><th>وارد غاز</th><th>موزع غاز</th><th>وارد سولار</th><th>موزع سولار</th><th>العمليات</th></tr></thead><tbody>${dayRows || empty(6)}</tbody></table>
    <h2>٣. التوزيع حسب الجهة</h2>
    <table><thead><tr><th>#</th><th>الجهة / الشخص</th><th>غاز (كيلو)</th><th>سولار (لتر)</th><th>العمليات</th><th>آخر استلام</th></tr></thead><tbody>${deptRows || empty(6)}</tbody></table>
    <h2>٤. الوارد حسب المصدر</h2>
    <table><thead><tr><th>#</th><th>المصدر</th><th>غاز (كيلو)</th><th>سولار (لتر)</th><th>العمليات</th><th>آخر توريد</th></tr></thead><tbody>${srcRows || empty(6)}</tbody></table>
    <h2>٥. تفاصيل الوارد</h2>
    <table><thead><tr><th>#</th><th>التاريخ</th><th>النوع</th><th>الكمية</th><th>الوحدة</th><th>المصدر</th><th>ملاحظات</th></tr></thead><tbody>
      ${inList.map((r,i) => `<tr><td>${num(i+1)}</td><td>${fmtDate(r.date)}</td><td>${esc(r.type)}</td><td>${num(r.qty)}</td><td>${esc(r.unit || BASE_UNIT[r.type])}</td><td>${esc(r.src || '—')}</td><td>${esc(r.notes || '—')}</td></tr>`).join('') || empty(7)}</tbody></table>
    <h2>٦. تفاصيل التوزيع</h2>
    <table><thead><tr><th>السند</th><th>التاريخ</th><th>النوع</th><th>الكمية</th><th>الوحدة</th><th>الجهة</th><th>ملاحظات</th></tr></thead><tbody>
      ${outList.map(r => `<tr><td>${voucherNo(r)}</td><td>${fmtDate(r.date)}</td><td>${esc(r.type)}</td><td>${num(r.qty)}</td><td>${esc(r.unit || BASE_UNIT[r.type])}</td><td>${esc(r.dept || '—')}</td><td>${esc(r.notes || '—')}</td></tr>`).join('') || empty(7)}</tbody></table>
    <div class="sig"><div class="s">أمين المخزن</div><div class="s">مدير العمليات</div><div class="s">اعتماد المدير العام</div></div>
    <div class="foot">تقرير شهري مُصدر إلكترونياً — ${fmtDate(todayISO())}</div>`;
  const css = `h2{font-size:1rem;margin:24px 0 9px;padding-bottom:5px;border-bottom:2px solid #1B3B2F;color:#1B3B2F;page-break-after:avoid}
    .note{border:1px solid #cfd8d3;background:#f3f7f5;border-radius:6px;padding:8px 12px;font-size:.76rem;color:#345;margin-bottom:8px;text-align:center}
    .kpis{display:flex;gap:9px;flex-wrap:wrap;margin-bottom:8px}
    .kpi{flex:1;min-width:105px;padding:10px;border-radius:7px;text-align:center;border:1px solid #ccc}
    .kv{font-size:1.1rem;font-weight:bold}.kl{font-size:.67rem;color:#555}`;
  if(openPrint('تقرير ' + monthLabel(m), body, css)) notify({ type:'info', title:`تم تجهيز تقرير ${monthLabel(m)}`, msg:`${num(inList.length)} وارد و${num(outList.length)} توزيع في هذا الشهر وحده — اختر «حفظ بصيغة PDF».`, log:false });
}
function printReport(){
  const inList = filterIn().slice().sort((a,b) => (a.date||'').localeCompare(b.date||''));
  const outList = filterOut().slice().sort((a,b) => (a.date||'').localeCompare(b.date||''));
  if(!inList.length && !outList.length) return notify({ type:'warning', title:'لا توجد بيانات للطباعة', msg:'غيّر الفلتر وأعد المحاولة.', log:false });
  const g = balanceOf('غاز'), d = balanceOf('سولار');
  const scope = [fMonth ? monthLabel(fMonth) : '', fType, fDept].filter(Boolean).join(' — ') || 'كل الفترات';
  const months = allMonths().slice().reverse();
  const mRows = months.map(m => {
    const s = (arr,t) => arr.filter(r => monthKey(r.date) === m && r.type === t).reduce((a,r) => a + (+r.qty||0), 0);
    return `<tr><td><b>${monthLabel(m)}</b></td><td>${num(s(fIn,'غاز'))}</td><td>${num(s(fOut,'غاز'))}</td><td>${num(s(fIn,'سولار'))}</td><td>${num(s(fOut,'سولار'))}</td></tr>`;
  }).join('');
  const empty = c => `<tr><td colspan="${c}" style="text-align:center;padding:16px;color:#999">لا توجد بيانات</td></tr>`;
  const body = `<h1>التقرير الشامل لتوزيع الوقود</h1>
    <div class="sub">النطاق: <b>${esc(scope)}</b> — تاريخ الإصدار: ${fmtDate(todayISO())}</div>
    <h2>١. الملخص التنفيذي</h2>
    <div class="kpis">
      <div class="kpi"><div class="kv">${num(g.in)}</div><div class="kl">وارد الغاز (كيلو)</div></div>
      <div class="kpi"><div class="kv">${num(g.out)}</div><div class="kl">موزع الغاز</div></div>
      <div class="kpi"><div class="kv">${num(g.bal)}</div><div class="kl">رصيد الغاز</div></div>
      <div class="kpi"><div class="kv">${num(d.in)}</div><div class="kl">وارد السولار (لتر)</div></div>
      <div class="kpi"><div class="kv">${num(d.out)}</div><div class="kl">موزع السولار</div></div>
      <div class="kpi"><div class="kv">${num(d.bal)}</div><div class="kl">رصيد السولار</div></div>
    </div>
    <h2>٢. الملخص الشهري</h2>
    <table><thead><tr><th>الشهر</th><th>وارد غاز</th><th>موزع غاز</th><th>وارد سولار</th><th>موزع سولار</th></tr></thead><tbody>${mRows || empty(5)}</tbody></table>
    <h2>٣. التوزيع حسب الجهة</h2>
    <table><thead><tr><th>#</th><th>الجهة / الشخص</th><th>غاز (كيلو)</th><th>سولار (لتر)</th><th>العمليات</th><th>آخر استلام</th></tr></thead><tbody>
      ${deptSummary().map((r,i) => `<tr><td>${num(i+1)}</td><td>${esc(r.dept)}</td><td>${num(r.gas)}</td><td>${num(r.diesel)}</td><td>${num(r.count)}</td><td>${fmtDate(r.last)}</td></tr>`).join('') || empty(6)}</tbody></table>
    <h2>٤. تفاصيل الوارد</h2>
    <table><thead><tr><th>#</th><th>التاريخ</th><th>النوع</th><th>الكمية</th><th>الوحدة</th><th>المصدر</th></tr></thead><tbody>
      ${inList.map((r,i) => `<tr><td>${num(i+1)}</td><td>${fmtDate(r.date)}</td><td>${esc(r.type)}</td><td>${num(r.qty)}</td><td>${esc(r.unit || BASE_UNIT[r.type])}</td><td>${esc(r.src || '—')}</td></tr>`).join('') || empty(6)}</tbody></table>
    <h2>٥. تفاصيل التوزيع</h2>
    <table><thead><tr><th>السند</th><th>التاريخ</th><th>النوع</th><th>الكمية</th><th>الوحدة</th><th>الجهة</th></tr></thead><tbody>
      ${outList.map(r => `<tr><td>${voucherNo(r)}</td><td>${fmtDate(r.date)}</td><td>${esc(r.type)}</td><td>${num(r.qty)}</td><td>${esc(r.unit || BASE_UNIT[r.type])}</td><td>${esc(r.dept || '—')}</td></tr>`).join('') || empty(6)}</tbody></table>
    <div class="sig"><div class="s">أمين المخزن</div><div class="s">مدير العمليات</div><div class="s">اعتماد المدير العام</div></div>
    <div class="foot">تقرير مُصدر إلكترونياً — ${fmtDate(todayISO())}</div>`;
  const css = `h2{font-size:1rem;margin:24px 0 9px;padding-bottom:5px;border-bottom:2px solid #1B3B2F;color:#1B3B2F;page-break-after:avoid}
    .kpis{display:flex;gap:9px;flex-wrap:wrap;margin-bottom:8px}
    .kpi{flex:1;min-width:105px;padding:10px;border-radius:7px;text-align:center;border:1px solid #ccc}
    .kv{font-size:1.1rem;font-weight:bold}.kl{font-size:.67rem;color:#555}`;
  if(openPrint('تقرير توزيع الوقود', body, css)) notify({ type:'info', title:'تم تجهيز التقرير', msg:`${num(inList.length)} وارد و${num(outList.length)} توزيع — اختر «حفظ بصيغة PDF».`, log:false });
}

/* ---------- Excel ---------- */
function exportExcel(){
  if(typeof XLSX === 'undefined') return notify({ type:'error', title:'مكتبة Excel غير محمّلة', msg:'أعد تحميل الصفحة وحاول مجدداً.' });
  const inList = filterIn(), outList = filterOut();
  if(!inList.length && !outList.length) return notify({ type:'warning', title:'لا توجد بيانات للتصدير', msg:'غيّر الفلتر وأعد المحاولة.', log:false });
  const wb = XLSX.utils.book_new();
  const inD = [['التاريخ','نوع الوقود','الكمية','الوحدة','المصدر','ملاحظات']];
  inList.forEach(r => inD.push([r.date, r.type, r.qty, r.unit || BASE_UNIT[r.type], r.src || '', r.notes || '']));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(inD), 'الوارد');
  const outD = [['رقم السند','التاريخ','نوع الوقود','الكمية','الوحدة','الجهة / الشخص','ملاحظات']];
  outList.forEach(r => outD.push([voucherNo(r), r.date, r.type, r.qty, r.unit || BASE_UNIT[r.type], r.dept || '', r.notes || '']));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(outD), 'التوزيع');
  const mD = [['الشهر','وارد غاز','موزع غاز','رصيد غاز','وارد سولار','موزع سولار','رصيد سولار']];
  allMonths().slice().reverse().forEach(m => {
    const s = (arr,t) => arr.filter(r => monthKey(r.date) === m && r.type === t).reduce((a,r) => a + (+r.qty||0), 0);
    const gi = s(fIn,'غاز'), go = s(fOut,'غاز'), di = s(fIn,'سولار'), dof = s(fOut,'سولار');
    mD.push([monthLabel(m), gi, go, gi-go, di, dof, di-dof]);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(mD), 'الملخص الشهري');
  const dD = [['الجهة / الشخص','إجمالي غاز (كيلو)','إجمالي سولار (لتر)','عدد العمليات','آخر استلام']];
  deptSummary().forEach(r => dD.push([r.dept, r.gas, r.diesel, r.count, r.last]));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(dD), 'حسب الجهة');
  const out = XLSX.write(wb, { bookType:'xlsx', type:'array' });
  const url = URL.createObjectURL(new Blob([out], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const a = document.createElement('a'); a.href = url; a.download = `توزيع_الوقود_${todayISO()}.xlsx`; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  notify({ type:'success', title:'تم تصدير ملف Excel', msg:'٤ أوراق: الوارد، التوزيع، الملخص الشهري، حسب الجهة. تجده في مجلد التنزيلات.' });
}

/* ---------- استيراد بيانات قديمة ---------- */
function importLegacy(ev){
  const file = ev.target.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    let data; try { data = JSON.parse(reader.result); } catch(e){ return notify({ type:'error', title:'تعذّرت قراءة الملف', msg:'الملف ليس بصيغة JSON أو أنه تالف.' }); }
    if(data && data.app === 'unified-admin-system') return notify({ type:'warning', title:'هذه نسخة من النظام الموحّد', msg:'استعدها من صفحة النسخ الاحتياطي.', action:{ label:'النسخ الاحتياطي', fn:() => App.switchModule('backup') } });
    if(!data || !Array.isArray(data.fuelIn) || !Array.isArray(data.fuelOut)) return notify({ type:'error', title:'الملف ليس بيانات توزيع وقود', msg:'اختر ملف النسخة الاحتياطية من تطبيق توزيع الوقود المستقل.' });
    const ok = await confirmD({ title:'استبدال بيانات الوقود؟', msg:`الملف: ${num(data.fuelIn.length)} وارد و${num(data.fuelOut.length)} توزيع. الحالي: ${num(fIn.length)} وارد و${num(fOut.length)} توزيع. سيُستبدل الحالي بالكامل.`, okText:'استبدال البيانات', danger:true, icon:'fuel' });
    if(!ok) return notify({ type:'info', title:'تم إلغاء الاستيراد', log:false });
    const prevIn = fIn, prevOut = fOut;
    applyImported(data);
    if(!save()){ fIn = prevIn; fOut = prevOut; return; }
    renderAll();
    notify({ type:'success', title:'تم استيراد بيانات الوقود', msg:`${num(fIn.length)} وارد و${num(fOut.length)} توزيع.`, page:'fuel', duration:9000,
      action:{ label:'تراجع', fn:() => { fIn = prevIn; fOut = prevOut; save(); renderAll(); notify({ type:'info', title:'تم التراجع عن الاستيراد', log:false }); } } });
  };
  reader.readAsText(file); ev.target.value = '';
}

/* ---------- التنبيهات ---------- */
function alerts(){
  const out = [];
  TYPES.forEach(t => {
    const b = balanceOf(t);
    if(b.in <= 0) return;
    if(b.bal <= 0) out.push({ severity:'high', title:`نفد ${t}`, subtitle:`الرصيد ${num(b.bal)} ${BASE_UNIT[t]} — سُجّل وارد ${num(b.in)} ووُزّع ${num(b.out)}`, onOpen:() => showView('dash') });
    else if(b.bal < b.in * LOW_RATIO) out.push({ severity:'mid', title:`رصيد ${t} منخفض`, subtitle:`المتبقي ${num(b.bal)} ${BASE_UNIT[t]} من أصل ${num(b.in)} واردة`, onOpen:() => showView('dash') });
  });
  return out;
}

/* ---------- التشغيل ---------- */
function renderAll(){ fillFilters(); renderIn(); renderOut(); if(currentView === 'dash') renderDash(); if(currentView === 'dept') renderDept(); flashId = null; }
function onShow(){ renderAll(); if(currentView === 'dash') renderChart(chartType); }
function init(){
  buildUI(); load();
  try{ const c = parseFloat(localStorage.getItem('fuel_cyl_default')); if(c > 0){ cylDefault = c; const el = $id('set-cyl'); if(el) el.value = c; } }catch(e){}
  renderAll(); tryReconnectFile();
  new MutationObserver(() => { if(currentView === 'dash' && isVisible()) renderChart(chartType); })
    .observe(document.documentElement, { attributes:true, attributeFilter:['data-theme'] });
}
return { showView, applyFilter, clearFilter, openIn, openOut, delIn, delOut, showChart, setCyl,
  printVoucher, printStatement, printReport, openMonthSheet, openWordSheet, runMonthReport, exportExcel, linkSaveFile, importLegacy,
  init, onShow, alerts, _in:() => fIn, _out:() => fOut, _bal:balanceOf };
})();
window.NotificationRegistry = window.NotificationRegistry || {};
NotificationRegistry.fuel = () => FU.alerts();
(window.MODULE_INITS = window.MODULE_INITS || []).push(FU.init);
