/* =====================================================================
   وحدة إدارة العهد — CU
   البيانات: localStorage cust_a / cust_i / cust_r  |  ملف الحفظ: IndexedDB fsdb_cust
   الفارق عن بقية وحدات المخزون: العهدة تُسترجع، فالصادر ليس نهائياً.
   ===================================================================== */
const CU = (function(){
'use strict';
const $id = id => document.getElementById('cu-' + id);
const LOW = 5; // حد الرصيد المنخفض

const additions = [];  // {date,name,unit,qty,serial,source,condition,notes}
const issues    = [];  // {no,date,name,unit,qty,person,personId,dept,notes}
const returns   = [];  // {date,name,unit,qty,person,condition,notes}

const UNITS      = ['قطعة','جهاز','طقم','صندوق','عدد'];
const COND_IN    = ['جديد','مستعمل - جيد','مستعمل - يحتاج صيانة'];
const COND_RET   = ['سليم','يحتاج صيانة','تالف'];

let gfItem = '', gfPerson = '', gfFrom = '', gfTo = '';
let chartInstance = null, currentChartType = 'balance', currentTab = 'in';
let editingAddIndex = null, editingIssueIndex = null;
let flashIdx = { in:null, issue:null, ret:null };

const notify   = (...a) => window.App ? App.notify(...a) : console.log(a);
const confirmD = o => window.App ? App.confirm(o) : Promise.resolve(window.confirm(o.title));
const vib = ms => window.App && App.vibrate(ms);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num = x => Number(x || 0).toLocaleString('ar-EG');
const localISO = d => { const x = new Date(d); return new Date(x.getTime() - x.getTimezoneOffset() * 60000).toISOString().split('T')[0]; };
const today = () => localISO(new Date());

/* ---------- الحفظ ---------- */
function saveData(){
  try {
    localStorage.setItem('cust_a', JSON.stringify(additions));
    localStorage.setItem('cust_i', JSON.stringify(issues));
    localStorage.setItem('cust_r', JSON.stringify(returns));
  } catch(e){
    notify({ type:'error', title:'تعذّر الحفظ على الجهاز', msg: e.name === 'QuotaExceededError' ? 'مساحة التخزين في المتصفح ممتلئة. انزل نسخة احتياطية وافرغ مساحة.' : 'السبب: ' + e.message, page:'custody' });
  }
  writeToLinkedFile();
  window.App && App.refresh();
}
function loadData(){
  try {
    const a = localStorage.getItem('cust_a'), i = localStorage.getItem('cust_i'), r = localStorage.getItem('cust_r');
    if (a){ additions.length = 0; JSON.parse(a).forEach(x => additions.push(x)); }
    if (i){ issues.length    = 0; JSON.parse(i).forEach(x => issues.push(x)); }
    if (r){ returns.length   = 0; JSON.parse(r).forEach(x => returns.push(x)); }
  } catch(e){}
  ensureNos();
}
/* السجلات القديمة (من التطبيق المستقل) ما فيها رقم سند — نعطيها أرقاماً عند التحميل */
function ensureNos(){
  let max = issues.reduce((m, r) => Math.max(m, +r.no || 0), 0);
  let changed = false;
  issues.forEach(r => { if (!r.no){ r.no = ++max; changed = true; } });
  if (changed){ try { localStorage.setItem('cust_i', JSON.stringify(issues)); } catch(e){} }
}
function nextNo(){ return issues.reduce((m, r) => Math.max(m, +r.no || 0), 0) + 1; }
const fmtNo = v => 'ع-' + String(v || 0).padStart(4, '0');

/* ---------- ربط ملف حفظ حقيقي على الجهاز ---------- */
let fileHandle = null;
const FS_DB_NAME = 'fsdb_cust';
function idbOpen(){
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(FS_DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('handles');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbSet(key, val){
  try { const db = await idbOpen();
    return new Promise((resolve, reject) => { const tx = db.transaction('handles','readwrite'); tx.objectStore('handles').put(val, key); tx.oncomplete = () => resolve(true); tx.onerror = () => reject(tx.error); });
  } catch(e){ return false; }
}
async function idbGet(key){
  try { const db = await idbOpen();
    return new Promise((resolve, reject) => { const tx = db.transaction('handles','readonly'); const req = tx.objectStore('handles').get(key); req.onsuccess = () => resolve(req.result || null); req.onerror = () => reject(req.error); });
  } catch(e){ return null; }
}
function fsSupported(){ return 'showSaveFilePicker' in window; }
function updateLinkStatus(text, ok){
  const el = $id('link-status'); if (!el) return;
  el.textContent = text; el.className = 'pill eq-link ' + (ok ? 'ok' : 'mid'); el.hidden = !text;
}
async function linkSaveFile(){
  vib(10);
  if (!fsSupported()){
    notify({ type:'warning', title:'ربط الملف غير مدعوم هنا', msg:'هذه الميزة تعمل في Chrome وEdge على الكمبيوتر. استخدم النسخ الاحتياطي بدلاً منها.', action:{ label:'النسخ الاحتياطي', fn:() => App.switchModule('backup') } });
    return;
  }
  try {
    const handle = await window.showSaveFilePicker({ suggestedName:'بيانات_ادارة_العهد.json', types:[{ description:'JSON', accept:{ 'application/json':['.json'] } }] });
    let hasData = false, imported = false, data = null;
    try { const text = await (await handle.getFile()).text(); if (text && text.trim()){ data = JSON.parse(text); if (data && Array.isArray(data.additions)) hasData = true; } } catch(e){}
    if (hasData){
      const ok = await confirmD({ title:'الملف فيه بيانات محفوظة', msg:`يحتوي ${num(data.additions.length)} إضافة و${num((data.issues||[]).length)} تسليم و${num((data.returns||[]).length)} إرجاع. هل تستوردها؟ (تُستبدل بيانات العهد الحالية)`, okText:'استيراد البيانات', cancelText:'الإبقاء على بياناتي', icon:'inbox' });
      if (ok){
        additions.length = 0; (data.additions || []).forEach(r => additions.push(r));
        issues.length    = 0; (data.issues || []).forEach(r => issues.push(r));
        returns.length   = 0; (data.returns || []).forEach(r => returns.push(r));
        ensureNos();
        imported = true;
      }
    }
    fileHandle = handle;
    await idbSet('handle', handle);
    if (imported){ saveData(); refreshAll(); } else { await writeToLinkedFile(); }
    updateLinkStatus('مربوط: ' + handle.name, true);
    notify({ type:'success', title: imported ? 'تم ربط الملف واستيراد بياناته' : 'تم ربط ملف الحفظ', msg:'كل عملية حفظ تُكتب تلقائياً في «' + handle.name + '».', page:'custody' });
  } catch(e){
    if (e.name !== 'AbortError') notify({ type:'error', title:'تعذّر ربط الملف', msg:'السبب: ' + e.message, page:'custody' });
  }
}
let writeWarned = false;
async function writeToLinkedFile(){
  if (!fileHandle) return;
  try {
    const perm = await fileHandle.queryPermission({ mode:'readwrite' });
    if (perm !== 'granted'){
      const req = await fileHandle.requestPermission({ mode:'readwrite' });
      if (req !== 'granted'){
        if (!writeWarned){ writeWarned = true; notify({ type:'warning', title:'لم يُحدَّث ملف الحفظ المربوط', msg:'البيانات محفوظة بالتطبيق، لكن الملف يحتاج إذناً. اضغط «ربط ملف حفظ».', page:'custody' }); }
        return;
      }
    }
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify({ additions, issues, returns, exported:new Date().toISOString() }, null, 2));
    await writable.close();
    writeWarned = false;
  } catch(e){}
}
async function tryReconnectFile(){
  if (!fsSupported()) return;
  try {
    const handle = await idbGet('handle');
    if (!handle) return;
    const perm = await handle.queryPermission({ mode:'readwrite' });
    if (perm === 'granted'){ fileHandle = handle; updateLinkStatus('مربوط: ' + handle.name, true); }
    else if (perm === 'prompt'){ fileHandle = handle; updateLinkStatus('اضغط «ربط ملف حفظ» للسماح مجدداً', false); }
  } catch(e){}
}

/* ---------- الحسابات (قلب الوحدة) ---------- */
function stockKey(name, unit){ return name + '||' + (unit || ''); }
// رصيد المخزون: الوارد مقابل ما هو مسلَّم فعلاً (التسليم ناقص الإرجاع)
function computeStock(adds = additions, iss = issues, rets = returns){
  const map = {};
  const touch = r => { const k = stockKey(r.name, r.unit); if (!map[k]) map[k] = { key:k, name:r.name, unit:r.unit, totalIn:0, totalOut:0 }; return map[k]; };
  adds.forEach(r => { touch(r).totalIn  += r.qty; });
  iss .forEach(r => { touch(r).totalOut += r.qty; });
  rets.forEach(r => { touch(r).totalOut -= r.qty; }); // الإرجاع يعيد الكمية للمتاح
  return Object.values(map).map(i => ({ ...i, balance:i.totalIn - i.totalOut }));
}
// ما بحوزة كل شخص لكل صنف: المفتاح person||name||unit
function computePersonLedger(iss = issues, rets = returns){
  const map = {};
  iss.forEach(r => {
    const k = r.person + '||' + stockKey(r.name, r.unit);
    if (!map[k]) map[k] = { key:k, person:r.person, personId:r.personId || '', dept:r.dept || '', name:r.name, unit:r.unit, held:0, issued:0 };
    map[k].held += r.qty; map[k].issued += r.qty;
    if (r.personId) map[k].personId = r.personId;
    if (r.dept) map[k].dept = r.dept;
  });
  rets.forEach(r => {
    const k = r.person + '||' + stockKey(r.name, r.unit);
    if (!map[k]) map[k] = { key:k, person:r.person, personId:'', dept:'', name:r.name, unit:r.unit, held:0, issued:0 };
    map[k].held -= r.qty;
  });
  return Object.values(map).filter(x => x.name);
}
// إجمالي ما أرجعه الشخص من نفس الصنف/الوحدة (تتبع إجمالي لا لكل سطر تسليم بعينه — سلوك الأصل)
function issueReturnedQty(row){
  return returns.filter(r => r.person === row.person && r.name === row.name && r.unit === row.unit).reduce((a, r) => a + r.qty, 0);
}
// أصناف يصبح رصيدها سالباً (أو أكثر سلبية) لو طُبّق التعديل المقترح
function negativeAfter(newAdds, newIss, newRets){
  const before = {}; computeStock().forEach(s => before[s.key] = s.balance);
  return computeStock(newAdds, newIss, newRets).filter(s => s.balance < 0 && s.balance < (before[s.key] ?? 0));
}
// سطور دفتر أشخاص يصبح «بحوزته» فيها سالباً (مثلاً حذف تسليم له إرجاعات)
function negativeHeldAfter(newIss, newRets){
  const before = {}; computePersonLedger().forEach(l => before[l.key] = l.held);
  return computePersonLedger(newIss, newRets).filter(l => l.held < 0 && l.held < (before[l.key] ?? 0));
}
const fmtDate = d => { if (!d) return '—'; const [y, m, day] = d.split('-'); return `${day}/${m}/${y}`; };
const inRange = (date, from, to) => { if (!date) return !from && !to; if (from && date < from) return false; if (to && date > to) return false; return true; };
function statusBadge(b){
  if (b <= 0) return '<span class="pill high">نافد</span>';
  if (b < LOW) return '<span class="pill mid">منخفض</span>';
  return '<span class="pill ok">متوفر</span>';
}
function balClass(b){ return b <= 0 ? 'bal-out' : b < LOW ? 'bal-low' : 'bal-ok'; }
// حالة سطر التسليم محسوبة لا مخزّنة
function issueState(r){
  const led = computePersonLedger().find(l => l.person === r.person && l.name === r.name && l.unit === r.unit);
  const held = led ? led.held : r.qty;
  if (held <= 0) return { txt:'مرتجع بالكامل', cls:'ok' };
  if (held < led.issued) return { txt:'مرتجع جزئي', cls:'mid' };
  return { txt:'مستلم', cls:'info' };
}

/* ---------- الواجهة ---------- */

/* ---------- استيراد من Excel ---------- */
function importFromExcel(){
  App.importExcel({
    title:'إدارة العهد', page:'custody',
    modes:[
      { id:'in', label:'إضافة عهدة', desc:'كل صف يضيف كمية لصنف في مخزون العهد.',
        cols:[
          { k:'date', labels:['التاريخ','تاريخ الإضافة'], req:true, type:'date' },
          { k:'name', labels:['الصنف','اسم الصنف'], req:true, type:'text' },
          { k:'unit', labels:['الوحدة'], type:'text', def:UNITS[0] },
          { k:'qty',  labels:['الكمية','العدد'], req:true, type:'num' },
          { k:'serial', labels:['الرقم التسلسلي','السيريال'], type:'text' },
          { k:'condition', labels:['الحالة','حالة الصنف'], type:'text', def:COND_IN[0] },
          { k:'source', labels:['المصدر','المورد','الجهة الموردة'], type:'text' },
          { k:'notes', labels:['ملاحظات','ملاحظة'], type:'text' }
        ],
        sample:[[new Date().toISOString().slice(0,10), 'طابعة', 'جهاز', 2, 'SN-10234', COND_IN[0], 'إمداد الداخلية', '']],
        check:recs => {
          const errs = [];
          recs.forEach(r => {
            if (!UNITS.includes(r.unit)) errs.push({ row:r.__row, msg:`الوحدة «${r.unit}» غير معروفة — المسموح: ${UNITS.join('، ')}` });
            else if (r.condition && !COND_IN.includes(r.condition)) errs.push({ row:r.__row, msg:`الحالة «${r.condition}» غير معروفة — المسموح: ${COND_IN.join('، ')}` });
          });
          return errs;
        },
        apply:async recs => {
          const prev = additions.slice();
          recs.forEach(r => additions.push({ date:r.date, name:r.name, unit:r.unit, qty:r.qty, serial:r.serial || '', source:r.source || '', condition:r.condition || COND_IN[0], notes:r.notes || '' }));
          saveData(); refreshAll();
          const items = new Set(recs.map(r => r.name)), total = recs.reduce((s,r) => s + r.qty, 0);
          notify({ type:'success', title:`تمت إضافة ${num(recs.length)} عهدة من Excel`, page:'custody', duration:9000,
            msg:`${num(items.size)} صنف بإجمالي ${num(total)} وحدة. راجع «لوحة العهد» للمتاح الجديد.`,
            action:{ label:'تراجع', fn:() => { additions.length = 0; prev.forEach(x => additions.push(x)); saveData(); refreshAll(); notify({ type:'info', title:'تم التراجع عن الاستيراد', log:false }); } } });
        } },
      { id:'issue', label:'تسليم لأشخاص', desc:'كل صف يسلّم كمية لشخص. الصنف لازم يكون موجوداً وبمتاح كافٍ، ويُعطى كل صف رقم سند.',
        cols:[
          { k:'date', labels:['التاريخ','تاريخ التسليم'], req:true, type:'date' },
          { k:'name', labels:['الصنف','اسم الصنف'], req:true, type:'text' },
          { k:'unit', labels:['الوحدة'], type:'text' },
          { k:'qty',  labels:['الكمية','العدد'], req:true, type:'num' },
          { k:'person', labels:['الشخص','اسم المستلم','المستلم'], req:true, type:'text' },
          { k:'personId', labels:['الرقم الوظيفي','رقم الموظف'], type:'text' },
          { k:'dept', labels:['القسم','الدائرة','الجهة'], type:'text' },
          { k:'notes', labels:['ملاحظات','ملاحظة'], type:'text' }
        ],
        sample:[[new Date().toISOString().slice(0,10), 'طابعة', 'جهاز', 1, 'أحمد سالم', '1201', 'الحماية', '']],
        check:recs => {
          const stock = computeStock(), errs = [], used = {};
          recs.forEach(r => {
            let hit = r.unit ? stock.find(s => s.key === stockKey(r.name, r.unit)) : null;
            if (!hit){
              const same = stock.filter(s => s.name === r.name);
              if (same.length === 1){ hit = same[0]; r.unit = hit.unit; }
              else if (same.length > 1) return errs.push({ row:r.__row, msg:`«${r.name}» موجود بأكثر من وحدة (${same.map(s => s.unit).join('، ')}) — حدّد عمود الوحدة` });
            }
            if (!hit) return errs.push({ row:r.__row, msg:`«${r.name}»${r.unit ? ' بوحدة ' + r.unit : ''} غير موجود في مخزون العهد — أضفه أولاً` });
            used[hit.key] = (used[hit.key] || 0) + r.qty;
            if (used[hit.key] > hit.balance) errs.push({ row:r.__row, msg:`المتاح لا يكفي: من «${r.name}» ${num(hit.balance)} ${hit.unit} والمطلوب تراكمياً ${num(used[hit.key])}` });
          });
          return errs;
        },
        apply:async recs => {
          const prev = issues.slice();
          let no = nextNo();
          recs.forEach(r => issues.push({ no:no++, date:r.date, name:r.name, unit:r.unit, qty:r.qty, person:r.person, personId:r.personId || '', dept:r.dept || '', notes:r.notes || '' }));
          saveData(); refreshAll();
          const people = new Set(recs.map(r => r.person)), total = recs.reduce((s,r) => s + r.qty, 0);
          notify({ type:'success', title:`تم تسليم ${num(recs.length)} سجل من Excel`, page:'custody', duration:9000,
            msg:`${num(total)} وحدة إلى ${num(people.size)} شخص. تقدر تطبع سند مجمّع لكل شخص من سجل التسليم.`,
            action:{ label:'تراجع', fn:() => { issues.length = 0; prev.forEach(x => issues.push(x)); saveData(); refreshAll(); notify({ type:'info', title:'تم التراجع عن الاستيراد', log:false }); } } });
        } }
    ]
  });
}

function buildUI(){
  const root = document.getElementById('page-custody');
  root.removeAttribute('data-placeholder');
  root.innerHTML = `
  <div class="eq-head">
    <div class="tile">${ico('custody')}</div>
    <div class="grow"><h2>إدارة العهد</h2><p>تسليم العهد للأشخاص وإرجاعها، مع كشف بما بحوزة كل شخص.</p></div>
    <div class="eq-tools">
      <button class="btn btn-sm" onclick="CU.exportExcel()">${ico('chart',20)}Excel</button>
      <button class="btn btn-sm" onclick="CU.exportPDF()">${ico('checklist',20)}تقرير PDF</button>
      <button class="btn btn-sm" onclick="CU.linkSaveFile()">${ico('label',20)}ربط ملف حفظ</button>
      <button class="btn btn-sm" onclick="CU.importFromExcel()">${ico('chart',20)}استيراد من Excel</button>
      <label class="btn btn-sm" title="استيراد ملف نسخة من تطبيق إدارة العهد المستقل">${ico('inbox',20)}استيراد بيانات قديمة<input type="file" accept=".json" hidden onchange="CU.importBackup(event)"></label>
      <span id="cu-link-status" class="pill eq-link" hidden></span>
    </div>
  </div>

  <div class="eq-tabs" role="tablist">
    <button class="eq-tab active" id="cu-tab-in" role="tab" onclick="CU.switchTab('in')">${ico('inbox')}إضافة عهدة<span class="cnt num" id="cu-in-count2">0</span></button>
    <button class="eq-tab" id="cu-tab-issue" role="tab" onclick="CU.switchTab('issue')">${ico('outbox')}تسليم<span class="cnt num" id="cu-issue-count2">0</span></button>
    <button class="eq-tab" id="cu-tab-ret" role="tab" onclick="CU.switchTab('ret')">${ico('compass')}إرجاع<span class="cnt num" id="cu-ret-count2">0</span></button>
    <button class="eq-tab" id="cu-tab-stock" role="tab" onclick="CU.switchTab('stock')">${ico('chart')}لوحة العهد<span class="cnt num" id="cu-stock-count2">0</span></button>
    <button class="eq-tab" id="cu-tab-persons" role="tab" onclick="CU.switchTab('persons')">${ico('person')}الأشخاص<span class="cnt num" id="cu-persons-count2">0</span></button>
  </div>

  <div class="card eq-filter">
    <span class="lbl" id="cu-gf-label">${ico('search',20)}فلترة</span>
    <input class="inp" type="text" id="cu-gf-item" placeholder="اسم الصنف…" oninput="CU.applyGlobalFilter()">
    <input class="inp" type="text" id="cu-gf-person" placeholder="اسم الشخص…" oninput="CU.applyGlobalFilter()">
    <input class="inp" type="date" id="cu-gf-from" title="من تاريخ" oninput="CU.applyGlobalFilter()">
    <span class="muted">←</span>
    <input class="inp" type="date" id="cu-gf-to" title="إلى تاريخ" oninput="CU.applyGlobalFilter()">
    <button class="btn btn-sm btn-ghost" onclick="CU.clearGlobalFilter()">مسح الفلتر</button>
  </div>

  <!-- إضافة عهدة -->
  <div class="eq-page active" id="cu-page-in">
    <div class="card eq-form" id="cu-form-in">
      <h3>${ico('inbox')}<span id="cu-in-title">إضافة عهدة للمخزون</span></h3>
      <div class="eq-edit-note" id="cu-in-note"></div>
      <div class="eq-grid">
        <div class="field"><label for="cu-in-date">التاريخ <i>*</i></label><input class="inp" type="date" id="cu-in-date"></div>
        <div class="field wide"><label for="cu-in-name">اسم الصنف <i>*</i></label><input class="inp" type="text" id="cu-in-name" placeholder="مثال: كمبيوتر محمول" list="cu-items-dl" autocomplete="off"><datalist id="cu-items-dl"></datalist></div>
        <div class="field"><label for="cu-in-unit">الوحدة</label><select class="inp" id="cu-in-unit">${UNITS.map(u => `<option>${u}</option>`).join('')}</select></div>
        <div class="field"><label for="cu-in-qty">الكمية <i>*</i></label><input class="inp num" type="number" id="cu-in-qty" placeholder="0" min="1" inputmode="numeric"></div>
        <div class="field"><label for="cu-in-serial">الرقم التسلسلي / الكود</label><input class="inp" type="text" id="cu-in-serial" placeholder="اختياري"></div>
        <div class="field wide"><label for="cu-in-source">المصدر</label><input class="inp" type="text" id="cu-in-source" placeholder="جهة التوريد" list="cu-src-dl"><datalist id="cu-src-dl"></datalist></div>
        <div class="field"><label for="cu-in-condition">الحالة</label><select class="inp" id="cu-in-condition">${COND_IN.map(c => `<option>${c}</option>`).join('')}</select></div>
        <div class="field wide"><label for="cu-in-notes">ملاحظات</label><input class="inp" type="text" id="cu-in-notes" placeholder="اختياري"></div>
      </div>
      <div class="eq-btns">
        <button class="btn btn-primary" id="cu-in-submit-btn" onclick="CU.addItem()">إضافة للمخزون</button>
        <button class="btn" id="cu-in-clear" onclick="CU.clearInForm(true)">مسح الحقول</button>
        <button class="btn" id="cu-in-cancel-edit" onclick="CU.cancelEditAdd()" style="display:none">إلغاء التعديل</button>
      </div>
    </div>
    <div class="card eq-table-card">
      <div class="eq-table-head"><h3>سجل الإضافات <span class="pill info num" id="cu-in-count">0</span></h3></div>
      <div class="eq-scroll"><table><thead><tr><th>#</th><th>التاريخ</th><th>الصنف</th><th>الوحدة</th><th>الكمية</th><th>الرقم التسلسلي</th><th>المصدر</th><th>الحالة</th><th>ملاحظات</th><th></th></tr></thead><tbody id="cu-in-tbody"></tbody></table></div>
    </div>
  </div>

  <!-- تسليم عهدة -->
  <div class="eq-page" id="cu-page-issue">
    <div class="card eq-form" id="cu-form-issue">
      <h3>${ico('outbox')}<span id="cu-issue-title">تسليم عهدة لشخص</span></h3>
      <div class="eq-edit-note" id="cu-issue-note"></div>
      <div class="eq-grid">
        <div class="field"><label for="cu-issue-date">التاريخ <i>*</i></label><input class="inp" type="date" id="cu-issue-date"></div>
        <div class="field wide"><label for="cu-issue-name">الصنف <i>*</i></label><select class="inp" id="cu-issue-name" onchange="CU.updateIssueInfo()"><option value="">— اختر —</option></select></div>
        <div class="field"><label for="cu-issue-unit">الوحدة</label><input class="inp" type="text" id="cu-issue-unit" readonly tabindex="-1"></div>
        <div class="field"><label for="cu-issue-balance">الرصيد المتاح</label><input class="inp num" type="text" id="cu-issue-balance" readonly tabindex="-1"></div>
        <div class="field"><label for="cu-issue-qty">الكمية المسلَّمة <i>*</i></label><input class="inp num" type="number" id="cu-issue-qty" placeholder="0" min="1" inputmode="numeric"></div>
        <div class="field wide"><label for="cu-issue-person">اسم المستلم <i>*</i></label><input class="inp" type="text" id="cu-issue-person" placeholder="اسم الشخص" list="cu-person-dl"><datalist id="cu-person-dl"></datalist></div>
        <div class="field"><label for="cu-issue-personid">الرقم الوظيفي / الهوية</label><input class="inp" type="text" id="cu-issue-personid" placeholder="اختياري"></div>
        <div class="field wide"><label for="cu-issue-dept">الجهة / القسم</label><input class="inp" type="text" id="cu-issue-dept" placeholder="القسم أو الموقع" list="cu-dept-dl"><datalist id="cu-dept-dl"></datalist></div>
        <div class="field wide"><label for="cu-issue-notes">ملاحظات</label><input class="inp" type="text" id="cu-issue-notes" placeholder="اختياري"></div>
      </div>
      <div class="eq-btns">
        <button class="btn btn-primary" id="cu-issue-submit-btn" onclick="CU.issueItem()">تنفيذ التسليم</button>
        <button class="btn" onclick="CU.clearIssueForm(true)">مسح الحقول</button>
        <button class="btn" id="cu-issue-cancel-edit" onclick="CU.cancelEditIssue()" style="display:none">إلغاء التعديل</button>
      </div>
    </div>
    <div class="card eq-table-card">
      <div class="eq-table-head"><h3>سجل التسليمات <span class="pill info num" id="cu-issue-count">0</span></h3>
        <button class="btn btn-sm" id="cu-print-sel" onclick="CU.printSelectedReceipt()">طباعة سند للمحدد</button></div>
      <div class="eq-scroll"><table><thead><tr><th><input type="checkbox" id="cu-chk-all" aria-label="تحديد الكل" onchange="CU.toggleAll(this.checked)"></th><th>السند</th><th>التاريخ</th><th>الصنف</th><th>الوحدة</th><th>الكمية</th><th>المستلم</th><th>الرقم الوظيفي</th><th>الجهة</th><th>الحالة</th><th>ملاحظات</th><th></th></tr></thead><tbody id="cu-issue-tbody"></tbody></table></div>
    </div>
  </div>

  <!-- إرجاع عهدة -->
  <div class="eq-page" id="cu-page-ret">
    <div class="card eq-form" id="cu-form-ret">
      <h3>${ico('compass')}<span>إرجاع عهدة من شخص</span></h3>
      <div class="eq-grid">
        <div class="field"><label for="cu-ret-date">التاريخ <i>*</i></label><input class="inp" type="date" id="cu-ret-date"></div>
        <div class="field wide"><label for="cu-ret-select">العهدة المراد إرجاعها <i>*</i></label><select class="inp" id="cu-ret-select" onchange="CU.updateReturnInfo()"><option value="">— اختر —</option></select></div>
        <div class="field"><label for="cu-ret-name">الصنف</label><input class="inp" type="text" id="cu-ret-name" readonly tabindex="-1"></div>
        <div class="field"><label for="cu-ret-unit">الوحدة</label><input class="inp" type="text" id="cu-ret-unit" readonly tabindex="-1"></div>
        <div class="field"><label for="cu-ret-held">المتبقي بحوزته</label><input class="inp num" type="text" id="cu-ret-held" readonly tabindex="-1"></div>
        <div class="field"><label for="cu-ret-qty">الكمية المرتجعة <i>*</i></label><input class="inp num" type="number" id="cu-ret-qty" placeholder="0" min="1" inputmode="numeric"></div>
        <div class="field"><label for="cu-ret-condition">حالة الصنف عند الإرجاع</label><select class="inp" id="cu-ret-condition">${COND_RET.map(c => `<option>${c}</option>`).join('')}</select></div>
        <div class="field wide"><label for="cu-ret-notes">ملاحظات</label><input class="inp" type="text" id="cu-ret-notes" placeholder="اختياري"></div>
      </div>
      <div class="eq-btns">
        <button class="btn btn-primary" onclick="CU.returnItem()">تنفيذ الإرجاع</button>
        <button class="btn" onclick="CU.clearReturnForm(true)">مسح الحقول</button>
      </div>
    </div>
    <div class="card eq-table-card">
      <div class="eq-table-head"><h3>سجل المرتجعات <span class="pill info num" id="cu-ret-count">0</span></h3></div>
      <div class="eq-scroll"><table><thead><tr><th>#</th><th>التاريخ</th><th>الصنف</th><th>الوحدة</th><th>الكمية</th><th>من</th><th>الحالة عند الإرجاع</th><th>ملاحظات</th><th></th></tr></thead><tbody id="cu-ret-tbody"></tbody></table></div>
    </div>
  </div>

  <!-- لوحة العهد -->
  <div class="eq-page" id="cu-page-stock">
    <div id="cu-low-alert" class="eq-alert"></div>
    <div class="eq-kpis">
      <div class="card kpi"><small>أصناف العهد</small><b class="num" id="cu-kpi-items">-</b></div>
      <div class="card kpi in"><small>إجمالي الوارد</small><b class="num" id="cu-kpi-in">-</b></div>
      <div class="card kpi out"><small>مسلَّم حالياً</small><b class="num" id="cu-kpi-out">-</b></div>
      <div class="card kpi bal"><small>المتاح بالمخزون</small><b class="num" id="cu-kpi-bal">-</b></div>
      <button class="card kpi low" onclick="CU.switchTab('persons')" style="text-align:start"><small>أشخاص لديهم عهد</small><b class="num" id="cu-kpi-persons">-</b></button>
    </div>
    <div class="card eq-chart">
      <div class="eq-chart-top"><h3>الإحصائيات البيانية</h3>
        <div class="seg" role="group">
          <button class="chart-tab" aria-pressed="true" onclick="CU.showChart('balance',this)">المتاح</button>
          <button class="chart-tab" aria-pressed="false" onclick="CU.showChart('in',this)">الوارد</button>
          <button class="chart-tab" aria-pressed="false" onclick="CU.showChart('out',this)">المسلَّم</button>
        </div></div>
      <div class="chart-wrap"><canvas id="cu-stockChart" aria-label="رسم بياني للعهد"></canvas></div>
    </div>
    <div class="eq-stock-tools">
      <select class="inp" id="cu-stock-filter" onchange="CU.renderStockTable()">
        <option value="all">كل الأصناف</option><option value="ok">متوفر</option><option value="low">منخفض</option><option value="out">نافد</option>
      </select>
      <button class="btn btn-sm btn-primary" onclick="CU.switchTab('in')">إضافة عهدة</button>
    </div>
    <div class="card eq-table-card">
      <div class="eq-table-head"><h3>تفاصيل العهد <span class="pill info num" id="cu-stock-count">0</span></h3></div>
      <div class="eq-scroll"><table><thead><tr><th>#</th><th>الصنف</th><th>الوحدة</th><th>الوارد</th><th>مسلَّم</th><th>المتاح</th><th>الحالة</th></tr></thead><tbody id="cu-stock-tbody"></tbody></table></div>
    </div>
  </div>

  <!-- كشف الأشخاص -->
  <div class="eq-page" id="cu-page-persons">
    <div class="eq-stock-tools">
      <select class="inp" id="cu-persons-filter" onchange="CU.renderPersons()">
        <option value="holding">لديهم عهد حالياً فقط</option>
        <option value="all">كل الأشخاص</option>
      </select>
      <button class="btn btn-sm btn-primary" onclick="CU.switchTab('issue')">تسليم عهدة</button>
    </div>
    <div id="cu-persons-list" class="cu-persons"></div>
  </div>`;
}

/* ---------- الفلترة ---------- */
function applyGlobalFilter(){
  gfItem = $id('gf-item').value.trim(); gfPerson = $id('gf-person').value.trim();
  gfFrom = $id('gf-from').value; gfTo = $id('gf-to').value;
  $id('gf-label').classList.toggle('on', !!(gfItem || gfPerson || gfFrom || gfTo));
  renderInTable(); renderIssueTable(); renderReturnTable(); renderStockTable(); renderPersons();
}
function clearGlobalFilter(){
  ['gf-item','gf-person','gf-from','gf-to'].forEach(id => $id(id).value = '');
  gfItem = gfPerson = gfFrom = gfTo = '';
  $id('gf-label').classList.remove('on');
  renderInTable(); renderIssueTable(); renderReturnTable(); renderStockTable(); renderPersons();
  vib(8);
}
function filterAdd(){ return additions.filter(r => { if (gfItem && !r.name.includes(gfItem)) return false; if (!inRange(r.date, gfFrom, gfTo)) return false; return true; }); }
function filterIssue(){ return issues.filter(r => { if (gfItem && !r.name.includes(gfItem)) return false; if (gfPerson && !(r.person || '').includes(gfPerson)) return false; if (!inRange(r.date, gfFrom, gfTo)) return false; return true; }); }
function filterRet(){ return returns.filter(r => { if (gfItem && !r.name.includes(gfItem)) return false; if (gfPerson && !(r.person || '').includes(gfPerson)) return false; if (!inRange(r.date, gfFrom, gfTo)) return false; return true; }); }

/* ---------- الجداول ---------- */
function renderInTable(){
  const rows = filterAdd();
  $id('in-count').textContent = num(rows.length); $id('in-count2').textContent = num(additions.length);
  const tbody = $id('in-tbody');
  if (!rows.length){ tbody.innerHTML = `<tr><td colspan="10" class="eq-empty">${additions.length ? 'لا توجد نتائج مطابقة للفلتر.' : 'لا توجد عهد مضافة بعد. أضف أول صنف من النموذج أعلاه.'}</td></tr>`; return; }
  tbody.innerHTML = [...rows].reverse().map((r, i) => {
    const idx = additions.indexOf(r);
    const cls = idx === editingAddIndex ? 'row-edit' : idx === flashIdx.in ? 'row-new' : '';
    return `<tr class="${cls}">
      <td class="n num">${num(rows.length - i)}</td><td class="num">${fmtDate(r.date)}</td><td><strong>${esc(r.name)}</strong></td><td>${esc(r.unit)}</td>
      <td class="qty-in num">+${num(r.qty)}</td><td>${esc(r.serial) || '—'}</td><td>${esc(r.source) || '—'}</td><td>${esc(r.condition) || '—'}</td><td class="muted">${esc(r.notes) || '—'}</td>
      <td><div class="acts"><button class="ib" title="تعديل" aria-label="تعديل" onclick="CU.editAdd(${idx})">✏️</button><button class="ib del" title="حذف" aria-label="حذف" onclick="CU.delAdd(${idx})">🗑</button></div></td></tr>`;
  }).join('');
  flashIdx.in = null;
}
function renderIssueTable(){
  const rows = filterIssue();
  $id('issue-count').textContent = num(rows.length); $id('issue-count2').textContent = num(issues.length);
  const tbody = $id('issue-tbody');
  $id('chk-all').checked = false; updateSelCount();
  if (!rows.length){ tbody.innerHTML = `<tr><td colspan="12" class="eq-empty">${issues.length ? 'لا توجد نتائج مطابقة للفلتر.' : 'لا يوجد تسليم بعد. اختر صنفاً من النموذج أعلاه.'}</td></tr>`; return; }
  const ledger = computePersonLedger();
  tbody.innerHTML = [...rows].reverse().map(r => {
    const idx = issues.indexOf(r);
    const cls = idx === editingIssueIndex ? 'row-edit' : idx === flashIdx.issue ? 'row-new' : '';
    const led = ledger.find(l => l.person === r.person && l.name === r.name && l.unit === r.unit);
    const held = led ? led.held : r.qty, issued = led ? led.issued : r.qty;
    const st = held <= 0 ? '<span class="pill ok">مرتجع بالكامل</span>' : held < issued ? '<span class="pill mid">مرتجع جزئي</span>' : '<span class="pill info">مستلم</span>';
    return `<tr class="${cls}">
      <td><input type="checkbox" class="cu-chk" data-idx="${idx}" aria-label="تحديد" onchange="CU.updateSelCount()"></td>
      <td class="n num">${fmtNo(r.no)}</td><td class="num">${fmtDate(r.date)}</td><td><strong>${esc(r.name)}</strong></td><td>${esc(r.unit)}</td>
      <td class="qty-out num">${num(r.qty)}</td><td>${esc(r.person)}</td><td>${esc(r.personId) || '—'}</td><td>${esc(r.dept) || '—'}</td>
      <td>${st}</td><td class="muted">${esc(r.notes) || '—'}</td>
      <td><div class="acts"><button class="ib" title="طباعة سند (يجمع كل ما سُلِّم لنفس الشخص بنفس التاريخ)" aria-label="طباعة سند" onclick="CU.printReceipt(${idx})">🖨</button>
        <button class="ib" title="تعديل" aria-label="تعديل" onclick="CU.editIssue(${idx})">✏️</button><button class="ib del" title="حذف" aria-label="حذف" onclick="CU.delIssue(${idx})">🗑</button></div></td></tr>`;
  }).join('');
  flashIdx.issue = null;
}
function renderReturnTable(){
  const rows = filterRet();
  $id('ret-count').textContent = num(rows.length); $id('ret-count2').textContent = num(returns.length);
  const tbody = $id('ret-tbody');
  if (!rows.length){ tbody.innerHTML = `<tr><td colspan="9" class="eq-empty">${returns.length ? 'لا توجد نتائج مطابقة للفلتر.' : 'لا يوجد إرجاع بعد. اختر عهدة مسلَّمة من النموذج أعلاه.'}</td></tr>`; return; }
  tbody.innerHTML = [...rows].reverse().map((r, i) => {
    const idx = returns.indexOf(r);
    const cls = idx === flashIdx.ret ? 'row-new' : '';
    return `<tr class="${cls}">
      <td class="n num">${num(rows.length - i)}</td><td class="num">${fmtDate(r.date)}</td><td><strong>${esc(r.name)}</strong></td><td>${esc(r.unit)}</td>
      <td class="qty-in num">+${num(r.qty)}</td><td>${esc(r.person)}</td><td>${esc(r.condition) || '—'}</td><td class="muted">${esc(r.notes) || '—'}</td>
      <td><div class="acts"><button class="ib del" title="حذف" aria-label="حذف" onclick="CU.delReturn(${idx})">🗑</button></div></td></tr>`;
  }).join('');
  flashIdx.ret = null;
}
function renderStockTable(){
  const flt = $id('stock-filter').value;
  let stock = computeStock();
  if (gfItem) stock = stock.filter(r => r.name.includes(gfItem));
  if (flt === 'ok') stock = stock.filter(r => r.balance >= LOW);
  if (flt === 'low') stock = stock.filter(r => r.balance > 0 && r.balance < LOW);
  if (flt === 'out') stock = stock.filter(r => r.balance <= 0);

  const full = computeStock();
  const tIn = full.reduce((a, r) => a + r.totalIn, 0), tOut = full.reduce((a, r) => a + r.totalOut, 0);
  const holders = new Set(computePersonLedger().filter(l => l.held > 0).map(l => l.person));
  $id('kpi-items').textContent = num(full.length); $id('kpi-in').textContent = num(tIn); $id('kpi-out').textContent = num(tOut);
  $id('kpi-bal').textContent = num(tIn - tOut); $id('kpi-persons').textContent = num(holders.size);
  $id('stock-count').textContent = num(stock.length); $id('stock-count2').textContent = num(full.length);

  const lowN = full.filter(r => r.balance > 0 && r.balance < LOW).map(r => esc(r.name));
  const outN = full.filter(r => r.balance <= 0 && r.totalIn > 0).map(r => esc(r.name));
  const la = $id('low-alert');
  if (outN.length){ la.className = 'eq-alert out show'; la.innerHTML = `<b>نافد (${num(outN.length)}):</b> ${outN.join('، ')}` + (lowN.length ? `<br><b>منخفض (${num(lowN.length)}):</b> ${lowN.join('، ')}` : ''); }
  else if (lowN.length){ la.className = 'eq-alert low show'; la.innerHTML = `<b>منخفض (${num(lowN.length)}):</b> ${lowN.join('، ')}`; }
  else la.className = 'eq-alert';

  const tbody = $id('stock-tbody');
  if (!stock.length){ tbody.innerHTML = '<tr><td colspan="7" class="eq-empty">لا توجد أصناف بهذا التصنيف.</td></tr>'; }
  else tbody.innerHTML = stock.map((r, i) => `<tr>
    <td class="n num">${num(i + 1)}</td><td><strong>${esc(r.name)}</strong></td><td>${esc(r.unit) || '—'}</td>
    <td class="qty-in num">${num(r.totalIn)}</td><td class="qty-out num">${num(r.totalOut)}</td><td class="qty-bal num">${num(r.balance)}</td>
    <td>${statusBadge(r.balance)}</td></tr>`).join('');
  if (currentTab === 'stock' && isVisible()) renderChart(currentChartType);
}
function renderPersons(){
  const flt = $id('persons-filter').value;
  let ledger = computePersonLedger();
  if (gfPerson) ledger = ledger.filter(l => (l.person || '').includes(gfPerson));
  if (gfItem) ledger = ledger.filter(l => l.name.includes(gfItem));
  if (flt === 'holding') ledger = ledger.filter(l => l.held > 0);

  const byPerson = {};
  ledger.forEach(l => { (byPerson[l.person] = byPerson[l.person] || []).push(l); });
  const names = Object.keys(byPerson).sort((a, b) => a.localeCompare(b, 'ar'));
  $id('persons-count2').textContent = num(new Set(computePersonLedger().filter(l => l.held > 0).map(l => l.person)).size);

  const wrap = $id('persons-list');
  if (!names.length){
    wrap.innerHTML = `<div class="card eq-empty" style="padding:34px 16px">${issues.length ? 'لا يوجد شخص مطابق للفلتر الحالي.' : 'لا يوجد أشخاص بعد. سلّم عهدة أولاً من تبويب «تسليم».'}</div>`;
    return;
  }
  wrap.innerHTML = names.map(name => {
    const items = byPerson[name];
    const meta = items.find(i => i.personId || i.dept) || items[0];
    const anyHeld = items.some(i => i.held > 0);
    const totalHeld = items.reduce((a, i) => a + Math.max(i.held, 0), 0);
    return `<div class="card cu-person">
      <h4><span class="who">${ico('person',26)}<span>${esc(name)}</span></span>
        ${anyHeld ? `<span class="pill mid">لديه عهد — ${num(totalHeld)}</span>` : '<span class="pill ok">لا يوجد عهد قائم</span>'}</h4>
      <div class="meta">${esc(meta.personId) ? 'الرقم الوظيفي: ' + esc(meta.personId) + ' · ' : ''}${esc(meta.dept) || 'بدون جهة'}</div>
      ${items.map(i => `<div class="cu-item"><span>${esc(i.name)} <span class="muted">(${esc(i.unit) || '—'})</span></span>
        <span class="q ${i.held > 0 ? 'on' : 'off'} num">${i.held > 0 ? num(i.held) + ' بحوزته' : 'مُرجَع بالكامل'}</span></div>`).join('')}
      <div class="foot">
        <button class="btn btn-sm" onclick="CU.printPersonStatement('${esc(name).replace(/'/g, "\\'")}')">${ico('checklist',18)}كشف الشخص</button>
        ${anyHeld ? `<button class="btn btn-sm" onclick="CU.gotoReturn('${esc(name).replace(/'/g, "\\'")}')">تسجيل إرجاع</button>` : ''}
      </div>
    </div>`;
  }).join('');
}

/* ---------- الرسم البياني ---------- */
function isVisible(){ const p = document.getElementById('page-custody'); return p && p.classList.contains('active'); }
function cssVar(n){ return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
function showChart(type, btn){
  currentChartType = type; vib(6);
  document.querySelectorAll('#page-custody .chart-tab').forEach(t => t.setAttribute('aria-pressed', t === btn));
  renderChart(type);
}
function renderChart(type){
  if (typeof Chart === 'undefined') return;
  const stock = computeStock().filter(r => r.totalIn > 0 || r.totalOut > 0)
    .sort((a, b) => (type === 'balance' ? b.balance - a.balance : type === 'in' ? b.totalIn - a.totalIn : b.totalOut - a.totalOut)).slice(0, 12);
  const labels = stock.map(r => r.name);
  const data = stock.map(r => type === 'balance' ? r.balance : type === 'in' ? r.totalIn : r.totalOut);
  const cOk = cssVar('--accent'), cLow = '#E8A33A', cOut = cssVar('--danger');
  const colors = data.map(v => type === 'balance' ? (v <= 0 ? cOut : v < LOW ? cLow : cOk) : type === 'in' ? cOk : cOut);
  const muted = cssVar('--muted'), grid = cssVar('--card-border'), font = cssVar('--f-body');
  const ctx = $id('stockChart').getContext('2d');
  if (chartInstance) chartInstance.destroy();
  chartInstance = new Chart(ctx, {
    type:'bar',
    data:{ labels, datasets:[{ data, backgroundColor:colors, borderRadius:8, maxBarThickness:42, label:'' }] },
    options:{ responsive:true, maintainAspectRatio:false, animation:{ duration:350 },
      plugins:{ legend:{ display:false }, tooltip:{ rtl:true, callbacks:{ label:c => num(c.parsed.y) } } },
      scales:{ x:{ reverse:true, ticks:{ color:muted, font:{ family:font, size:11 } }, grid:{ display:false } },
               y:{ position:'right', ticks:{ color:muted, font:{ family:font }, callback:v => num(v) }, grid:{ color:grid } } } }
  });
}

/* ---------- إضافة عهدة ---------- */
function markInvalid(id, title, msg){
  const el = $id(id); el.classList.remove('invalid'); void el.offsetWidth; el.classList.add('invalid'); el.focus();
  el.addEventListener('input', () => el.classList.remove('invalid'), { once:true });
  el.addEventListener('change', () => el.classList.remove('invalid'), { once:true });
  notify({ type:'error', title, msg, log:false });
}
function addItem(){
  const date = $id('in-date').value, name = $id('in-name').value.trim(), unit = $id('in-unit').value;
  const qty = parseInt($id('in-qty').value, 10), serial = $id('in-serial').value.trim();
  const source = $id('in-source').value.trim(), condition = $id('in-condition').value, notes = $id('in-notes').value.trim();
  if (!date) return markInvalid('in-date', 'التاريخ مطلوب', 'حدّد تاريخ استلام العهدة.');
  if (!name) return markInvalid('in-name', 'اسم الصنف مطلوب', 'اكتب اسم الصنف أو اختره من الاقتراحات.');
  if (!qty || qty < 1) return markInvalid('in-qty', 'الكمية غير صحيحة', 'أدخل رقماً صحيحاً أكبر من صفر.');
  const rec = { date, name, unit, qty, serial, source, condition, notes };
  if (editingAddIndex !== null){
    const trial = additions.slice(); trial[editingAddIndex] = rec;
    const neg = negativeAfter(trial, issues, returns);
    if (neg.length) return notify({ type:'error', title:'لا يمكن حفظ هذا التعديل', msg:`المتاح من «${neg[0].name}» يصبح ${num(neg[0].balance)} لأن المسلَّم منه أكثر. عدّل سجلات التسليم أولاً أو زِد الكمية.` });
    additions[editingAddIndex] = rec; flashIdx.in = editingAddIndex;
    finishEditAdd();
    notify({ type:'success', title:'تم حفظ التعديل', msg:`${name} — ${num(qty)} ${unit}`, page:'custody' });
  } else {
    additions.push(rec); flashIdx.in = additions.length - 1;
    const bal = computeStock().find(s => s.key === stockKey(name, unit));
    notify({ type:'success', title:`تمت إضافة ${num(qty)} ${unit} من ${name}`, msg:`المتاح الآن: ${num(bal ? bal.balance : qty)} ${unit}`, page:'custody' });
  }
  saveData(); populateDropdowns(); renderInTable(); renderStockTable();
  clearInForm(); $id('in-name').focus();
}
function editAdd(i){
  const r = additions[i]; if (!r) return;
  if (editingIssueIndex !== null) cancelEditIssue(true);
  switchTab('in', true);
  $id('in-date').value = r.date; $id('in-name').value = r.name; $id('in-unit').value = r.unit; $id('in-qty').value = r.qty;
  $id('in-serial').value = r.serial || ''; $id('in-source').value = r.source || ''; $id('in-notes').value = r.notes || '';
  if (r.condition) $id('in-condition').value = r.condition;
  editingAddIndex = i;
  $id('form-in').classList.add('editing'); $id('in-title').textContent = 'تعديل إضافة';
  $id('in-note').textContent = `تعدّل إضافة «${r.name}» بتاريخ ${fmtDate(r.date)}. اضغط «حفظ التعديل» أو «إلغاء التعديل».`;
  $id('in-submit-btn').textContent = 'حفظ التعديل'; $id('in-cancel-edit').style.display = ''; $id('in-clear').style.display = 'none';
  renderInTable(); scrollToForm('in'); vib(10);
}
function finishEditAdd(){
  editingAddIndex = null;
  $id('form-in').classList.remove('editing'); $id('in-title').textContent = 'إضافة عهدة للمخزون';
  $id('in-submit-btn').textContent = 'إضافة للمخزون'; $id('in-cancel-edit').style.display = 'none'; $id('in-clear').style.display = '';
}
function cancelEditAdd(silent){
  const was = editingAddIndex !== null;
  finishEditAdd(); clearInForm(); renderInTable();
  if (was && silent !== true) notify({ type:'info', title:'تم إلغاء التعديل', msg:'لم يتغيّر السجل.', log:false, duration:2500 });
}
function clearInForm(user){ ['in-name','in-qty','in-serial','in-source','in-notes'].forEach(id => $id(id).value = ''); if (user === true) vib(6); }

/* ---------- تسليم عهدة ---------- */
function issueItem(){
  const date = $id('issue-date').value, sel = $id('issue-name'), opt = sel.options[sel.selectedIndex], key = sel.value;
  const name = opt ? (opt.dataset.name || '') : '', unit = $id('issue-unit').value;
  const qty = parseInt($id('issue-qty').value, 10);
  const person = $id('issue-person').value.trim(), personId = $id('issue-personid').value.trim();
  const dept = $id('issue-dept').value.trim(), notes = $id('issue-notes').value.trim();
  if (!date) return markInvalid('issue-date', 'التاريخ مطلوب', 'حدّد تاريخ التسليم.');
  if (!computeStock().length) return notify({ type:'warning', title:'ما في عهد بالمخزون', msg:'أضف أصنافاً أولاً من تبويب «إضافة عهدة».', action:{ label:'إضافة عهدة', fn:() => switchTab('in') } });
  if (!key || !name) return markInvalid('issue-name', 'اختر الصنف', 'اختر الصنف المراد تسليمه من القائمة.');
  if (!qty || qty < 1) return markInvalid('issue-qty', 'الكمية غير صحيحة', 'أدخل رقماً صحيحاً أكبر من صفر.');
  if (!person) return markInvalid('issue-person', 'اسم المستلم مطلوب', 'اكتب اسم الشخص ليظهر على سند الاستلام.');
  const item = computeStock().find(s => s.key === key);
  let available = item ? item.balance : 0;
  if (editingIssueIndex !== null){ const orig = issues[editingIssueIndex]; if (orig && stockKey(orig.name, orig.unit) === key) available += orig.qty; }
  if (qty > available) return markInvalid('issue-qty', 'الكمية أكبر من المتاح', `المتاح من «${name}» ${num(Math.max(available, 0))} ${unit} فقط.`);
  let idx;
  if (editingIssueIndex !== null){
    const rec = { ...issues[editingIssueIndex], date, name, unit, qty, person, personId, dept, notes };
    const trial = issues.slice(); trial[editingIssueIndex] = rec;
    const negH = negativeHeldAfter(trial, returns);
    if (negH.length) return notify({ type:'error', title:'لا يمكن حفظ هذا التعديل', msg:`«${negH[0].person}» أرجع من «${negH[0].name}» أكثر مما سيبقى مسلَّماً له. احذف أو عدّل سجلات الإرجاع أولاً.` });
    issues[editingIssueIndex] = rec; idx = editingIssueIndex;
    finishEditIssue();
    notify({ type:'success', title:'تم حفظ التعديل', msg:`${name} — ${num(qty)} ${unit} إلى ${person}`, page:'custody' });
  } else {
    const rec = { no:nextNo(), date, name, unit, qty, person, personId, dept, notes };
    issues.push(rec); idx = issues.length - 1;
    const left = available - qty;
    notify({ type: left <= 0 ? 'warning' : 'success', title:`تم تسليم ${num(qty)} ${unit} من ${name} إلى ${person}`,
      msg:`سند رقم ${fmtNo(rec.no)}. ${left <= 0 ? 'نفد الصنف من المخزون.' : left < LOW ? 'المتاح المتبقي منخفض: ' + num(left) + ' ' + unit + '.' : 'المتبقي بالمخزون: ' + num(left) + ' ' + unit + '.'}`,
      action:{ label:'طباعة السند', fn:() => printReceipt(idx) }, page:'custody', duration:7000 });
  }
  flashIdx.issue = idx;
  saveData(); populateDropdowns(); renderIssueTable(); renderStockTable(); renderPersons();
  clearIssueForm();
}
function editIssue(i){
  const r = issues[i]; if (!r) return;
  if (editingAddIndex !== null) cancelEditAdd(true);
  switchTab('issue', true);
  $id('issue-date').value = r.date;
  const key = stockKey(r.name, r.unit); $id('issue-name').value = key; updateIssueInfo();
  $id('issue-qty').value = r.qty; $id('issue-person').value = r.person || '';
  $id('issue-personid').value = r.personId || ''; $id('issue-dept').value = r.dept || ''; $id('issue-notes').value = r.notes || '';
  editingIssueIndex = i;
  const bal = computeStock().find(s => s.key === key);
  if (bal) $id('issue-balance').value = `${num(bal.balance + r.qty)} ${r.unit} (مع كمية هذا السند)`;
  $id('form-issue').classList.add('editing'); $id('issue-title').textContent = 'تعديل تسليم';
  $id('issue-note').textContent = `تعدّل السند ${fmtNo(r.no)}: «${r.name}» إلى ${r.person} بتاريخ ${fmtDate(r.date)}.`;
  $id('issue-submit-btn').textContent = 'حفظ التعديل'; $id('issue-cancel-edit').style.display = '';
  renderIssueTable(); scrollToForm('issue'); vib(10);
}
function finishEditIssue(){
  editingIssueIndex = null;
  $id('form-issue').classList.remove('editing'); $id('issue-title').textContent = 'تسليم عهدة لشخص';
  $id('issue-submit-btn').textContent = 'تنفيذ التسليم'; $id('issue-cancel-edit').style.display = 'none';
}
function cancelEditIssue(silent){
  const was = editingIssueIndex !== null;
  finishEditIssue(); clearIssueForm(); renderIssueTable();
  if (was && silent !== true) notify({ type:'info', title:'تم إلغاء التعديل', msg:'لم يتغيّر السجل.', log:false, duration:2500 });
}
function clearIssueForm(user){
  ['issue-name','issue-qty','issue-person','issue-personid','issue-dept','issue-notes','issue-unit','issue-balance'].forEach(id => $id(id).value = '');
  $id('issue-balance').className = 'inp num'; if (user === true) vib(6);
}

/* ---------- إرجاع عهدة ---------- */
function updateReturnInfo(){
  const sel = $id('ret-select'), opt = sel.options[sel.selectedIndex], d = opt && opt.dataset ? opt.dataset : {};
  $id('ret-name').value = d.name || ''; $id('ret-unit').value = d.unit || '';
  $id('ret-held').value = d.held !== undefined ? `${num(d.held)} ${d.unit || ''}` : '';
}
function returnItem(){
  const date = $id('ret-date').value, sel = $id('ret-select'), opt = sel.options[sel.selectedIndex];
  const d = opt && opt.dataset ? opt.dataset : {};
  const person = d.person || '', name = d.name || '', unit = d.unit || '', held = +d.held || 0;
  const qty = parseInt($id('ret-qty').value, 10), condition = $id('ret-condition').value, notes = $id('ret-notes').value.trim();
  if (!date) return markInvalid('ret-date', 'التاريخ مطلوب', 'حدّد تاريخ الإرجاع.');
  if (!computePersonLedger().some(l => l.held > 0)) return notify({ type:'warning', title:'ما في عهد قائمة', msg:'ما في شخص بحوزته عهدة حالياً. سلّم عهدة أولاً.', action:{ label:'تسليم عهدة', fn:() => switchTab('issue') } });
  if (!person || !name) return markInvalid('ret-select', 'اختر العهدة', 'اختر الشخص والصنف المراد إرجاعه من القائمة.');
  if (!qty || qty < 1) return markInvalid('ret-qty', 'الكمية غير صحيحة', 'أدخل رقماً صحيحاً أكبر من صفر.');
  if (qty > held) return markInvalid('ret-qty', 'الكمية أكبر مما بحوزته', `بحوزة ${person} ${num(held)} ${unit} فقط من «${name}».`);
  returns.push({ date, name, unit, qty, person, condition, notes });
  flashIdx.ret = returns.length - 1;
  saveData(); populateDropdowns(); renderReturnTable(); renderIssueTable(); renderStockTable(); renderPersons();
  const left = held - qty;
  notify({ type:'success', title:`تم إرجاع ${num(qty)} ${unit} من ${name}`,
    msg:`من ${person} بحالة «${condition}». ${left > 0 ? 'ما زال بحوزته ' + num(left) + ' ' + unit + '.' : 'خلصت عهدته من هذا الصنف.'}`, page:'custody', duration:6000 });
  clearReturnForm();
}
function clearReturnForm(user){
  ['ret-qty','ret-notes','ret-name','ret-unit','ret-held'].forEach(id => $id(id).value = '');
  $id('ret-select').value = ''; if (user === true) vib(6);
}
async function delReturn(i){
  const r = returns[i]; if (!r) return;
  const trial = returns.filter((_, k) => k !== i);
  const neg = negativeAfter(additions, issues, trial);
  if (neg.length) return notify({ type:'error', title:'لا يمكن حذف هذا الإرجاع', msg:`المتاح من «${neg[0].name}» يصبح ${num(neg[0].balance)}. عدّل سجلات الإضافة أو التسليم أولاً.` });
  const ok = await confirmD({ title:'حذف هذا الإرجاع؟', msg:`${r.name} — ${num(r.qty)} ${r.unit} من ${r.person}. ترجع الكمية لعهدة الشخص وتنقص من المتاح.`, okText:'حذف', danger:true });
  if (!ok) return;
  returns.splice(i, 1);
  saveData(); populateDropdowns(); renderReturnTable(); renderIssueTable(); renderStockTable(); renderPersons();
  notify({ type:'success', title:'تم حذف الإرجاع', msg:`${r.name} — ${num(r.qty)} ${r.unit}`, page:'custody',
    action:{ label:'تراجع', fn:() => { returns.splice(i, 0, r); flashIdx.ret = i; saveData(); populateDropdowns(); renderReturnTable(); renderIssueTable(); renderStockTable(); renderPersons(); notify({ type:'info', title:'تمت استعادة السجل المحذوف', log:false }); } }, duration:8000 });
}
function gotoReturn(person){
  switchTab('ret');
  const sel = $id('ret-select');
  const opt = Array.from(sel.options).find(o => o.dataset && o.dataset.person === person);
  if (opt){ sel.value = opt.value; updateReturnInfo(); $id('ret-qty').focus(); }
  scrollToForm('ret');
}

/* ---------- الحذف (إضافة / تسليم) ---------- */
async function delAdd(i){
  const r = additions[i]; if (!r) return;
  const trial = additions.filter((_, k) => k !== i);
  const neg = negativeAfter(trial, issues, returns);
  if (neg.length) return notify({ type:'error', title:'لا يمكن حذف هذه الإضافة', msg:`سُلِّم من «${r.name}» أكثر مما سيبقى، فيصبح المتاح ${num(neg[0].balance)}. احذف أو عدّل سجلات التسليم المرتبطة أولاً.` });
  const ok = await confirmD({ title:'حذف هذه الإضافة؟', msg:`${r.name} — ${num(r.qty)} ${r.unit} بتاريخ ${fmtDate(r.date)}. ينقص المتاح بنفس الكمية.`, okText:'حذف', danger:true });
  if (!ok) return;
  if (editingAddIndex === i) cancelEditAdd(true); else if (editingAddIndex !== null && editingAddIndex > i) editingAddIndex--;
  additions.splice(i, 1);
  saveData(); populateDropdowns(); renderInTable(); renderStockTable();
  notify({ type:'success', title:'تم حذف الإضافة', msg:`${r.name} — ${num(r.qty)} ${r.unit}`, page:'custody',
    action:{ label:'تراجع', fn:() => { additions.splice(i, 0, r); flashIdx.in = i; saveData(); populateDropdowns(); renderInTable(); renderStockTable(); notify({ type:'info', title:'تمت استعادة السجل المحذوف', log:false }); } }, duration:8000 });
}
async function delIssue(i){
  const r = issues[i]; if (!r) return;
  const trial = issues.filter((_, k) => k !== i);
  const negH = negativeHeldAfter(trial, returns);
  if (negH.length){
    const ret = issueReturnedQty(r);
    return notify({ type:'error', title:'لا يمكن حذف هذا التسليم', msg:`«${r.person}» أرجع ${num(ret)} ${r.unit} من «${r.name}»، وحذف السند يخلي المُرجَع أكثر من المسلَّم. احذف سجلات الإرجاع المرتبطة أولاً.`,
      action:{ label:'سجل المرتجعات', fn:() => { switchTab('ret'); $id('gf-person').value = r.person; applyGlobalFilter(); } } });
  }
  const ok = await confirmD({ title:'حذف هذا التسليم؟', msg:`السند ${fmtNo(r.no)}: ${r.name} — ${num(r.qty)} ${r.unit} إلى ${r.person}. تعود الكمية للمتاح.`, okText:'حذف', danger:true });
  if (!ok) return;
  if (editingIssueIndex === i) cancelEditIssue(true); else if (editingIssueIndex !== null && editingIssueIndex > i) editingIssueIndex--;
  issues.splice(i, 1);
  saveData(); populateDropdowns(); renderIssueTable(); renderStockTable(); renderPersons();
  notify({ type:'success', title:'تم حذف التسليم', msg:`عادت ${num(r.qty)} ${r.unit} من «${r.name}» للمتاح.`, page:'custody',
    action:{ label:'تراجع', fn:() => { issues.splice(i, 0, r); flashIdx.issue = i; saveData(); populateDropdowns(); renderIssueTable(); renderStockTable(); renderPersons(); notify({ type:'info', title:'تمت استعادة السجل المحذوف', log:false }); } }, duration:8000 });
}

/* ---------- سند الاستلام المجمّع ---------- */
function getSelectedIndices(){ return Array.from(document.querySelectorAll('#page-custody .cu-chk')).filter(c => c.checked).map(c => parseInt(c.dataset.idx, 10)); }
function updateSelCount(){
  const n = getSelectedIndices().length, b = $id('print-sel');
  if (b){ b.textContent = n ? `طباعة سند للمحدد (${num(n)})` : 'طباعة سند للمحدد'; b.classList.toggle('btn-primary', n > 0); }
}
function toggleAll(on){ document.querySelectorAll('#page-custody .cu-chk').forEach(c => c.checked = on); updateSelCount(); vib(6); }
function printSelectedReceipt(){
  const idx = getSelectedIndices();
  if (!idx.length) return notify({ type:'warning', title:'لم تحدد أي صف', msg:'علّم مربع الاختيار بجانب سطور التسليم المطلوبة، ثم اضغط الطباعة.', log:false });
  printCombinedReceipt(idx);
}
function printReceipt(i){
  const r = issues[i]; if (!r) return;
  const groupIdx = issues.map((x, idx) => idx).filter(idx => issues[idx].person === r.person && issues[idx].date === r.date);
  printCombinedReceipt(groupIdx);
}
function openPrintWindow(html){
  const w = window.open('', '_blank');
  if (!w){ notify({ type:'error', title:'المتصفح منع نافذة الطباعة', msg:'اسمح بالنوافذ المنبثقة لهذا الموقع ثم أعد المحاولة.' }); return false; }
  w.document.write(html); w.document.close();
  return true;
}
const PRINT_CSS = `body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;padding:40px;color:#111}
  h1{text-align:center;font-size:1.3rem;border-bottom:2px solid #333;padding-bottom:12px;margin-bottom:20px}
  table{width:100%;border-collapse:collapse}td,th{border:1px solid #999;padding:8px 10px;text-align:right;font-size:.9rem}th{background:#eee}
  .sig{margin-top:50px;display:flex;justify-content:space-between}.sig div{width:40%;text-align:center;border-top:1px solid #333;padding-top:8px}`;
function printCombinedReceipt(indices){
  const rows = indices.map(i => issues[i]).filter(Boolean);
  if (!rows.length) return;
  const byPerson = {};
  rows.forEach(r => { (byPerson[r.person || '—'] = byPerson[r.person || '—'] || []).push(r); });
  const persons = Object.keys(byPerson);
  const sections = persons.map((person, pi) => {
    const items = byPerson[person];
    const meta = items.find(i => i.personId || i.dept) || items[0];
    const multiDate = new Set(items.map(r => r.date)).size > 1;
    const nos = items.map(r => fmtNo(r.no)).join('، ');
    return `
    ${pi > 0 ? '<h1>سند استلام عهدة</h1>' : ''}
    <table>
      <tr><th>اسم المستلم</th><td>${esc(person)}</td><th>الرقم الوظيفي</th><td>${esc(meta.personId) || '—'}</td></tr>
      <tr><th>الجهة / القسم</th><td>${esc(meta.dept) || '—'}</td><th>${multiDate ? 'عدة تواريخ' : 'التاريخ'}</th><td>${multiDate ? '—' : fmtDate(items[0].date)}</td></tr>
      <tr><th>رقم السند</th><td colspan="3">${nos}</td></tr>
    </table>
    <table style="margin-top:10px">
      <thead><tr><th>#</th><th>الصنف</th><th>الوحدة</th><th>الكمية</th>${multiDate ? '<th>التاريخ</th>' : ''}<th>ملاحظات</th></tr></thead>
      <tbody>${items.map((it, n) => `<tr><td>${n + 1}</td><td>${esc(it.name)}</td><td>${esc(it.unit)}</td><td>${it.qty}</td>${multiDate ? `<td>${fmtDate(it.date)}</td>` : ''}<td>${esc(it.notes) || '—'}</td></tr>`).join('')}</tbody>
    </table>
    <p style="margin-top:20px;font-size:.9rem">أقر أنا الموقع أدناه باستلام الأصناف الموضحة أعلاه وأتعهد بالمحافظة عليها وإعادتها بحالتها عند الطلب.</p>
    <div class="sig"><div>توقيع المستلم</div><div>توقيع المسؤول</div></div>
    ${pi < persons.length - 1 ? '<div style="page-break-after:always"></div>' : ''}`;
  }).join('');
  const ok = openPrintWindow(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>سند استلام عهدة</title>
  <style>${PRINT_CSS}</style></head><body>
  ${window.App ? App.letterheadHTML() : ''}<h1>سند استلام عهدة</h1>${sections}
  <script>window.onload=()=>window.print();<\/script></body></html>`);
  if (ok) notify({ type:'info', title:'تم تجهيز سند الاستلام', msg:`${num(rows.length)} صنف لـ${persons.length > 1 ? num(persons.length) + ' أشخاص (صفحة لكل شخص)' : ' ' + persons[0]}.`, log:false });
}
function printPersonStatement(person){
  const items = computePersonLedger().filter(l => l.person === person);
  if (!items.length) return;
  const meta = items.find(i => i.personId || i.dept) || items[0];
  const hist = [
    ...issues.filter(r => r.person === person).map(r => ({ ...r, t:'تسليم' })),
    ...returns.filter(r => r.person === person).map(r => ({ ...r, t:'إرجاع' }))
  ].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const ok = openPrintWindow(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>كشف عهدة — ${esc(person)}</title>
  <style>${PRINT_CSS}</style></head><body>
  ${window.App ? App.letterheadHTML() : ''}<h1>كشف عهدة موظف</h1>
  <table><tr><th>الاسم</th><td>${esc(person)}</td><th>الرقم الوظيفي</th><td>${esc(meta.personId) || '—'}</td></tr>
  <tr><th>الجهة / القسم</th><td>${esc(meta.dept) || '—'}</td><th>تاريخ الكشف</th><td>${fmtDate(today())}</td></tr></table>
  <h3 style="margin-top:22px;font-size:1rem">العهد القائمة بحوزته</h3>
  <table><thead><tr><th>#</th><th>الصنف</th><th>الوحدة</th><th>مُسلَّم</th><th>مُرجَع</th><th>بحوزته</th></tr></thead>
  <tbody>${items.map((l, i) => `<tr><td>${i + 1}</td><td>${esc(l.name)}</td><td>${esc(l.unit) || '—'}</td><td>${l.issued}</td><td>${l.issued - l.held}</td><td><b>${l.held}</b></td></tr>`).join('')}</tbody></table>
  <h3 style="margin-top:22px;font-size:1rem">حركة العهدة</h3>
  <table><thead><tr><th>التاريخ</th><th>الحركة</th><th>الصنف</th><th>الكمية</th><th>الحالة</th><th>ملاحظات</th></tr></thead>
  <tbody>${hist.map(r => `<tr><td>${fmtDate(r.date)}</td><td>${r.t}</td><td>${esc(r.name)}</td><td>${r.qty}</td><td>${esc(r.condition) || '—'}</td><td>${esc(r.notes) || '—'}</td></tr>`).join('') || '<tr><td colspan="6">لا توجد حركات</td></tr>'}</tbody></table>
  <div class="sig"><div>توقيع الموظف</div><div>توقيع المسؤول</div></div>
  <script>window.onload=()=>window.print();<\/script></body></html>`);
  if (ok) notify({ type:'info', title:'تم تجهيز كشف العهدة', msg:'كشف ' + person + ' جاهز للطباعة.', log:false });
}

/* ---------- القوائم المنسدلة ---------- */
function populateDropdowns(){
  const stock = computeStock(), sel = $id('issue-name'), cur = sel.value;
  sel.innerHTML = '<option value="">— اختر —</option>';
  stock.slice().sort((a, b) => a.name.localeCompare(b.name, 'ar')).forEach(s => {
    const o = document.createElement('option');
    o.value = s.key; o.textContent = `${s.name} — ${s.unit || '—'}  (متاح: ${s.balance})`;
    o.dataset.name = s.name; o.dataset.unit = s.unit; o.dataset.bal = s.balance;
    if (s.balance <= 0) o.textContent += ' — نافد';
    sel.appendChild(o);
  });
  if (cur) sel.value = cur;

  const fill = (id, values) => { const dl = $id(id); dl.innerHTML = ''; [...new Set(values.filter(Boolean))].forEach(v => { const o = document.createElement('option'); o.value = v; dl.appendChild(o); }); };
  fill('items-dl', stock.map(s => s.name));
  fill('src-dl', additions.map(r => r.source));
  fill('person-dl', issues.map(r => r.person));
  fill('dept-dl', issues.map(r => r.dept));

  populateReturnDropdown();
}
// قائمة الإرجاع تُبنى من دفتر الأشخاص لا من الأصناف
function populateReturnDropdown(){
  const sel = $id('ret-select'); if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">— اختر —</option>';
  computePersonLedger().filter(l => l.held > 0)
    .sort((a, b) => a.person.localeCompare(b.person, 'ar'))
    .forEach(l => {
      const o = document.createElement('option');
      o.value = l.key;
      o.textContent = `${l.person} — ${l.name} (${l.unit || '—'}) — بحوزته: ${l.held}`;
      o.dataset.person = l.person; o.dataset.name = l.name; o.dataset.unit = l.unit; o.dataset.held = l.held;
      sel.appendChild(o);
    });
  if (cur && Array.from(sel.options).some(o => o.value === cur)) sel.value = cur; else { sel.value = ''; }
  updateReturnInfo();
}
function updateIssueInfo(){
  const sel = $id('issue-name'), opt = sel.options[sel.selectedIndex];
  $id('issue-unit').value = (opt && opt.dataset.unit) || '';
  const b = opt && opt.dataset.bal !== undefined ? +opt.dataset.bal : null;
  $id('issue-balance').value = b !== null ? `${num(b)} ${opt.dataset.unit || ''}` : '';
  $id('issue-balance').className = 'inp num ' + (b === null ? '' : balClass(b));
  if (b !== null && b <= 0 && editingIssueIndex === null) notify({ type:'warning', title:'هذا الصنف نافد', msg:'كل الكمية مسلَّمة. سجّل إرجاعاً أو أضف كمية جديدة قبل التسليم.', log:false, action:{ label:'إضافة كمية', fn:() => { switchTab('in'); $id('in-name').value = opt.dataset.name; $id('in-unit').value = opt.dataset.unit || $id('in-unit').value; $id('in-qty').focus(); } } });
}

/* ---------- التصدير ---------- */
function exportExcel(){
  vib(10);
  if (typeof XLSX === 'undefined') return notify({ type:'error', title:'مكتبة Excel غير محمّلة', msg:'أعد تحميل التطبيق ثم حاول مجدداً.' });
  try {
    const wb = XLSX.utils.book_new();
    const addData = [['التاريخ','اسم الصنف','الوحدة','الكمية','الرقم التسلسلي','المصدر','الحالة','ملاحظات']];
    additions.forEach(r => addData.push([r.date, r.name, r.unit, r.qty, r.serial, r.source, r.condition, r.notes]));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(addData), 'العهد المضافة');

    const issData = [['رقم السند','التاريخ','اسم الصنف','الوحدة','الكمية','المستلم','الرقم الوظيفي','الجهة','ملاحظات']];
    issues.forEach(r => issData.push([fmtNo(r.no), r.date, r.name, r.unit, r.qty, r.person, r.personId, r.dept, r.notes]));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(issData), 'التسليمات');

    const retData = [['التاريخ','اسم الصنف','الوحدة','الكمية','من','الحالة عند الإرجاع','ملاحظات']];
    returns.forEach(r => retData.push([r.date, r.name, r.unit, r.qty, r.person, r.condition, r.notes]));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(retData), 'المرتجعات');

    const stData = [['اسم الصنف','الوحدة','الوارد','مسلَّم','المتاح','الحالة']];
    computeStock().forEach(r => stData.push([r.name, r.unit, r.totalIn, r.totalOut, r.balance, r.balance <= 0 ? 'نافد' : r.balance < LOW ? 'منخفض' : 'متوفر']));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(stData), 'الرصيد الحالي');

    const pData = [['الشخص','الرقم الوظيفي','الجهة','الصنف','الوحدة','بحوزته']];
    computePersonLedger().filter(l => l.held > 0).forEach(l => pData.push([l.person, l.personId, l.dept, l.name, l.unit, l.held]));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(pData), 'كشف الأشخاص');

    const buf = XLSX.write(wb, { bookType:'xlsx', type:'array' });
    const url = URL.createObjectURL(new Blob([buf], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    const a = document.createElement('a'); a.href = url; a.download = 'ادارة_العهد_' + today() + '.xlsx'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    notify({ type:'success', title:'تم تصدير ملف Excel', msg:'٥ أوراق: العهد المضافة والتسليمات والمرتجعات والرصيد وكشف الأشخاص — تجده في مجلد التنزيلات.' });
  } catch(e){ notify({ type:'error', title:'تعذّر تصدير Excel', msg:'السبب: ' + e.message }); }
}
function exportPDF(){
  vib(10);
  const stock = computeStock(), now = new Date().toLocaleDateString('ar-EG');
  const ledger = computePersonLedger().filter(l => l.held > 0);
  const tIn = stock.reduce((a, r) => a + r.totalIn, 0), tOut = stock.reduce((a, r) => a + r.totalOut, 0);
  const holders = new Set(ledger.map(l => l.person)).size;
  const rows = stock.map((r, i) => `<tr style="background:${i % 2 === 0 ? '#f8f9fa' : '#fff'}"><td>${i + 1}</td><td>${esc(r.name)}</td><td>${esc(r.unit) || '—'}</td>
    <td style="color:#1d6f42;font-weight:bold">${r.totalIn.toLocaleString()}</td><td style="color:#c0392b;font-weight:bold">${r.totalOut.toLocaleString()}</td>
    <td style="color:#2980b9;font-weight:bold">${r.balance.toLocaleString()}</td><td>${r.balance <= 0 ? 'نافد' : r.balance < LOW ? 'منخفض' : 'متوفر'}</td></tr>`).join('');
  const pRows = ledger.map((l, i) => `<tr style="background:${i % 2 === 0 ? '#f8f9fa' : '#fff'}"><td>${i + 1}</td><td>${esc(l.person)}</td><td>${esc(l.personId) || '—'}</td><td>${esc(l.dept) || '—'}</td><td>${esc(l.name)}</td><td>${esc(l.unit) || '—'}</td><td><b>${l.held}</b></td></tr>`).join('');
  const ok = openPrintWindow(`<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><title>تقرير إدارة العهد</title>
  <style>body{font-family:Tahoma,Arial,sans-serif;direction:rtl;padding:20px}h1{text-align:center;color:#1B3B2F;font-size:1.2rem}
  h2{font-size:.95rem;margin:22px 0 8px;color:#1B3B2F}
  .sub{text-align:center;color:#666;font-size:.82rem;margin-bottom:16px}.kpis{display:flex;gap:10px;margin-bottom:16px}
  .kpi{padding:10px 16px;border-radius:8px;text-align:center;flex:1}.kpi.g{background:#eafaf1;border:1px solid #38d9a9}.kpi.r{background:#fdecea;border:1px solid #ff6b6b}.kpi.b{background:#e8f4fd;border:1px solid #4f9cf9}.kpi.p{background:#f6edfd;border:1px solid #b197fc}
  .kv{font-size:1.3rem;font-weight:bold}.kl{font-size:.7rem;color:#666}table{width:100%;border-collapse:collapse;font-size:.8rem}
  th{background:#1B3B2F;color:#fff;padding:7px 10px;text-align:right}td{padding:6px 10px;border-bottom:1px solid #eee}@media print{body{padding:0}}</style></head><body>
  ${window.App ? App.letterheadHTML() : ''}<h1>تقرير إدارة العهد</h1><div class="sub">تاريخ: ${now} — إجمالي الأصناف: ${stock.length}</div>
  <div class="kpis"><div class="kpi g"><div class="kv">${tIn.toLocaleString()}</div><div class="kl">إجمالي الوارد</div></div>
  <div class="kpi r"><div class="kv">${tOut.toLocaleString()}</div><div class="kl">مسلَّم حالياً</div></div>
  <div class="kpi b"><div class="kv">${(tIn - tOut).toLocaleString()}</div><div class="kl">المتاح بالمخزون</div></div>
  <div class="kpi p"><div class="kv">${holders}</div><div class="kl">أشخاص لديهم عهد</div></div></div>
  <h2>الرصيد الحالي</h2>
  <table><thead><tr><th>#</th><th>الصنف</th><th>الوحدة</th><th>الوارد</th><th>مسلَّم</th><th>المتاح</th><th>الحالة</th></tr></thead><tbody>${rows || '<tr><td colspan="7">لا توجد أصناف</td></tr>'}</tbody></table>
  <h2>كشف الأشخاص (لديهم عهد حالياً)</h2>
  <table><thead><tr><th>#</th><th>الشخص</th><th>الرقم الوظيفي</th><th>الجهة</th><th>الصنف</th><th>الوحدة</th><th>بحوزته</th></tr></thead><tbody>${pRows || '<tr><td colspan="7">لا يوجد عهد قائمة</td></tr>'}</tbody></table>
  <script>window.onload=()=>window.print();<\/script></body></html>`);
  if (ok) notify({ type:'info', title:'تم تجهيز التقرير', msg:'اختر «حفظ بصيغة PDF» من نافذة الطباعة.', log:false });
}

/* استيراد نسخة من تطبيق إدارة العهد المستقل */
function importBackup(event){
  const file = event.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = async e => {
    let data;
    try { data = JSON.parse(e.target.result); } catch(err){ return notify({ type:'error', title:'تعذّرت قراءة الملف', msg:'الملف ليس بصيغة JSON أو أنه تالف.' }); }
    if (data && data.app === 'unified-admin-system') return notify({ type:'warning', title:'هذه نسخة من النظام الموحّد', msg:'استعدها من صفحة النسخ الاحتياطي، فهي تشمل كل الوحدات.', action:{ label:'النسخ الاحتياطي', fn:() => App.switchModule('backup') } });
    if (!data || !Array.isArray(data.additions) || !Array.isArray(data.issues)) return notify({ type:'error', title:'الملف ليس نسخة من إدارة العهد', msg:'اختر ملفاً نُزّل من زر «نسخة احتياطية» في تطبيق إدارة العهد المستقل.' });
    const ok = await confirmD({ title:'استبدال بيانات العهد؟', msg:`الملف فيه ${num(data.additions.length)} إضافة و${num(data.issues.length)} تسليم و${num((data.returns||[]).length)} إرجاع. الحالي: ${num(additions.length)} و${num(issues.length)} و${num(returns.length)}. سيُستبدل الحالي بالكامل.`, okText:'استبدال البيانات', danger:true, icon:'inbox' });
    if (!ok) return notify({ type:'info', title:'تم إلغاء الاستيراد', msg:'لم يتغيّر شيء.', log:false });
    const prevA = additions.slice(), prevI = issues.slice(), prevR = returns.slice();
    additions.length = 0; data.additions.forEach(r => additions.push(r));
    issues.length = 0; data.issues.forEach(r => issues.push(r));
    returns.length = 0; (data.returns || []).forEach(r => returns.push(r));
    ensureNos();
    cancelEditAdd(true); cancelEditIssue(true);
    saveData(); refreshAll();
    notify({ type:'success', title:'تم استيراد بيانات العهد', msg:`${num(additions.length)} إضافة و${num(issues.length)} تسليم و${num(returns.length)} إرجاع.`, page:'custody', duration:9000,
      action:{ label:'تراجع', fn:() => { additions.length = 0; prevA.forEach(r => additions.push(r)); issues.length = 0; prevI.forEach(r => issues.push(r)); returns.length = 0; prevR.forEach(r => returns.push(r)); saveData(); refreshAll(); notify({ type:'info', title:'تم التراجع عن الاستيراد', log:false }); } } });
  };
  reader.readAsText(file);
  event.target.value = '';
}

/* ---------- التبويبات ---------- */
function scrollToForm(t){
  const f = $id('form-' + t); if (f && f.scrollIntoView) f.scrollIntoView({ behavior:'smooth', block:'start' });
  const focusId = { in:'in-qty', issue:'issue-qty', ret:'ret-qty' }[t];
  if (focusId) setTimeout(() => { const el = $id(focusId); el && el.focus({ preventScroll:true }); }, 350);
}
function switchTab(id, silent){
  currentTab = id;
  ['in','issue','ret','stock','persons'].forEach(t => {
    $id('tab-' + t).classList.toggle('active', t === id); $id('tab-' + t).setAttribute('aria-selected', t === id);
    $id('page-' + t).classList.toggle('active', t === id);
  });
  if (id === 'stock') renderStockTable();
  if (id === 'persons') renderPersons();
  if (silent !== true) vib(8);
}
function refreshAll(){ populateDropdowns(); renderInTable(); renderIssueTable(); renderReturnTable(); renderStockTable(); renderPersons(); }
function onShow(){ if (currentTab === 'stock') renderChart(currentChartType); }

/* ---------- التهيئة ---------- */
function init(){
  buildUI();
  loadData();
  tryReconnectFile();
  $id('in-date').value = today(); $id('issue-date').value = today(); $id('ret-date').value = today();
  refreshAll();
  new MutationObserver(() => { if (currentTab === 'stock' && isVisible()) renderChart(currentChartType); })
    .observe(document.documentElement, { attributes:true, attributeFilter:['data-theme'] });
}

/* ---------- تنبيهات الشاشة الرئيسية ---------- */
function alerts(){
  const s = computeStock();
  const out = s.filter(r => r.balance <= 0 && r.totalIn > 0), low = s.filter(r => r.balance > 0 && r.balance < LOW);
  const list = arr => arr.slice(0, 4).map(r => r.name).join('، ') + (arr.length > 4 ? ` و${num(arr.length - 4)} غيرها` : '');
  const res = [];
  if (out.length) res.push({ severity:'high', title: out.length === 1 ? 'صنف عهدة نافد' : `${num(out.length)} ${out.length <= 10 ? 'أصناف عهدة نافدة' : 'صنفاً نافداً'}`, subtitle:list(out), page:'custody', onOpen:() => { switchTab('stock', true); $id('stock-filter').value = 'out'; renderStockTable(); } });
  if (low.length) res.push({ severity:'mid', title: low.length === 1 ? 'صنف عهدة رصيده منخفض' : `${num(low.length)} ${low.length <= 10 ? 'أصناف رصيدها منخفض' : 'صنفاً رصيدها منخفض'}`, subtitle:list(low), page:'custody', onOpen:() => { switchTab('stock', true); $id('stock-filter').value = 'low'; renderStockTable(); } });
  const dmg = returns.filter(r => r.condition === 'تالف' || r.condition === 'يحتاج صيانة');
  if (dmg.length) res.push({ severity:'mid', title:`${num(dmg.length)} عهدة أُرجعت غير سليمة`, subtitle:[...new Set(dmg.map(r => r.name))].slice(0, 4).join('، '), page:'custody', onOpen:() => switchTab('ret', true) });
  return res;
}

return {
  importFromExcel, addItem, issueItem, returnItem, delAdd, delIssue, delReturn, editAdd, editIssue,
  cancelEditAdd, cancelEditIssue, clearInForm, clearIssueForm, clearReturnForm,
  applyGlobalFilter, clearGlobalFilter, switchTab, showChart, renderStockTable, renderPersons,
  updateIssueInfo, updateReturnInfo, toggleAll, updateSelCount, printReceipt, printSelectedReceipt,
  printPersonStatement, gotoReturn, exportExcel, exportPDF, linkSaveFile, importBackup,
  computeStock, computePersonLedger, issueReturnedQty, init, onShow, alerts,
  _data:{ additions, issues, returns }
};
})();

window.NotificationRegistry = window.NotificationRegistry || {};
NotificationRegistry.custody = () => CU.alerts();
(window.MODULE_INITS = window.MODULE_INITS || []).push(CU.init);
