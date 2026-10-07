/* =====================================================================
   وحدة دفتر الرواتب — PR
   البيانات: localStorage ledger-state-v2 (كائن state واحد) | ملف الحفظ: IndexedDB fsdb_payroll
   ===================================================================== */
const PR = (function(){
'use strict';

/* ==================== منطق الدفتر (مطابق للوحدة المُختبرة logic.js) ==================== */
function computeBalances(entries){
  let cash=0, bank=0;
  for(const e of entries){
    const sign = e.kind==='in' ? 1 : -1;
    if(e.method==='cash') cash += sign*e.amount;
    else if(e.method==='bank') bank += sign*e.amount;
  }
  return {cash, bank};
}
// إصلاح: الرقم التالي = أكبر تسلسل موجود + 1 (بدل عدد العمليات) حتى لا يتكرر المرجع بعد الحذف
function nextRef(entries, date){
  const year = date.slice(0,4);
  const maxSeq = entries.filter(e=>e.id && e.id.startsWith(year+'-'))
    .reduce((m,e)=>Math.max(m, parseInt(e.id.slice(5),10)||0), 0);
  return `${year}-${String(maxSeq+1).padStart(4,'0')}`;
}
function filterEntries(entries, {query, method, status, kind, employeeId}={}){
  return entries.filter(e=>{
    if(kind && e.kind!==kind) return false;
    if(method && e.method!==method) return false;
    if(status && e.status!==status) return false;
    if(employeeId && e.employeeId!==employeeId) return false;
    if(query){
      const q = query.trim().toLowerCase();
      const hay = [e.id, e.employeeName, e.category, e.notes, e.proofRef].filter(Boolean).join(' ').toLowerCase();
      if(!hay.includes(q)) return false;
    }
    return true;
  });
}
function employeeSummary(entries, employeeId){
  const own = entries.filter(e=>e.kind==='out' && e.employeeId===employeeId);
  const due = own.reduce((s,e)=>s+(e.dueAmount ?? e.amount),0);
  const paid = own.reduce((s,e)=>s+e.amount,0);
  return {due, paid, remaining: due-paid, count: own.length};
}
function validateEntry(e){
  const errors=[];
  if(!e.date) errors.push('التاريخ مطلوب');
  if(!e.method) errors.push('طريقة الدفع مطلوبة');
  if(e.amount===undefined||e.amount===null||isNaN(e.amount)||e.amount<=0) errors.push('المبلغ يجب أن يكون رقمًا أكبر من صفر');
  if(e.kind==='out' && !e.employeeId) errors.push('الموظف مطلوب لعملية التسليم');
  if(e.kind==='out' && !e.category) errors.push('نوع الصرف مطلوب');
  if(e.status==='pending' && !e.pendingReason) errors.push('سبب التعليق مطلوب عند اختيار حالة معلّق');
  return errors;
}
function rangeSummary(entries, fromDate, toDate){
  const inRange = entries.filter(e=> e.date>=fromDate && e.date<=toDate);
  const income = inRange.filter(e=>e.kind==='in');
  const expense = inRange.filter(e=>e.kind==='out');
  const incomeCash = income.filter(e=>e.method==='cash').reduce((s,e)=>s+e.amount,0);
  const incomeBank = income.filter(e=>e.method==='bank').reduce((s,e)=>s+e.amount,0);
  const expenseCash = expense.filter(e=>e.method==='cash').reduce((s,e)=>s+e.amount,0);
  const expenseBank = expense.filter(e=>e.method==='bank').reduce((s,e)=>s+e.amount,0);
  const byCategory = {};
  for(const e of expense) byCategory[e.category] = (byCategory[e.category]||0) + e.amount;
  const pendingCount = inRange.filter(e=>e.status==='pending').length;
  return {
    totalIncome: incomeCash+incomeBank, totalExpense: expenseCash+expenseBank,
    net: (incomeCash+incomeBank)-(expenseCash+expenseBank),
    incomeCash, incomeBank, expenseCash, expenseBank, byCategory, pendingCount, entryCount: inRange.length,
  };
}
function reconciliation(entries, employees, period){
  return employees.map(emp=>{
    const paid = entries.filter(e=> e.kind==='out' && e.employeeId===emp.id && e.period===period && e.category==='راتب شهري').reduce((s,e)=>s+e.amount,0);
    const expected = emp.monthlySalary || 0;
    return {employeeId: emp.id, name: emp.name, expected, paid, diff: expected-paid};
  });
}
function stalePending(entries, days, today){
  const cutoff = new Date(today); cutoff.setDate(cutoff.getDate()-days);
  const cutoffStr = cutoff.toISOString().slice(0,10);
  return entries.filter(e=> e.status==='pending' && e.date<=cutoffStr);
}
function monthlySeries(entries, monthsBack, today){
  const result=[]; const base = new Date(today);
  for(let i=monthsBack-1;i>=0;i--){
    const d = new Date(base.getFullYear(), base.getMonth()-i, 1);
    const period = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const monthEntries = entries.filter(e=> (e.period || e.date.slice(0,7))===period);
    const income = monthEntries.filter(e=>e.kind==='in').reduce((s,e)=>s+e.amount,0);
    const expense = monthEntries.filter(e=>e.kind==='out').reduce((s,e)=>s+e.amount,0);
    result.push({period, income, expense});
  }
  return result;
}
function auditRecord(action, entryRef, before, after, actor, ts){
  return {ts, action, entryRef, before: before||null, after: after||null, actor: actor||''};
}

/* ==================== منطق استيراد إكسل (مطابق للوحدة المُختبرة logic3.js) ==================== */
const FIELD_DEFS = [
  { key: 'kind', aliases: ['نوع العملية'] },
  { key: 'employeeName', aliases: ['اسم الموظف', 'الموظف'] },
  { key: 'category', aliases: ['نوع الصرف'] },
  { key: 'method', aliases: ['طريقة الدفع', 'الطريقة'] },
  { key: 'date', aliases: ['تاريخ الصرف الفعلي', 'التاريخ'] },
  { key: 'period', aliases: ['الفترة/الشهر', 'الشهر'] },
  { key: 'dueAmount', aliases: ['المبلغ المستحق'] },
  { key: 'amount', aliases: ['المبلغ'] },
  { key: 'status', aliases: ['الحالة'] },
  { key: 'pendingReason', aliases: ['سبب التعليق'] },
  { key: 'proofRef', aliases: ['رقم/وصف الإثبات', 'الإثبات'] },
  { key: 'notes', aliases: ['ملاحظات'] },
];
function normalizeHeader(h){ return String(h ?? '').trim(); }
function buildColumnMap(headerRow){
  const map = {};
  (headerRow||[]).forEach((h, idx)=>{
    const norm = normalizeHeader(h);
    for(const def of FIELD_DEFS){ if(def.aliases.includes(norm) && map[def.key]===undefined) map[def.key] = idx; }
  });
  return map;
}
function excelDateToISO(val){
  if(val instanceof Date && !isNaN(val)) return val.toISOString().slice(0,10);
  if(typeof val === 'string'){
    const s = val.trim();
    const m1 = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if(m1) return `${m1[1]}-${m1[2]}-${m1[3]}`;
    const m2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if(m2){ const dd=m2[1].padStart(2,'0'), mm=m2[2].padStart(2,'0'); return `${m2[3]}-${mm}-${dd}`; }
  }
  if(typeof val === 'number' && isFinite(val)){
    const epoch = Date.UTC(1899,11,30);
    const d = new Date(epoch + val*86400000);
    if(!isNaN(d)) return d.toISOString().slice(0,10);
  }
  return null;
}
function normalizeKindValue(v){ const s = normalizeHeader(v); if(['استلام رصيد','استلام','قبض'].includes(s)) return 'in'; if(['تسليم لموظف','تسليم','صرف'].includes(s)) return 'out'; return null; }
function normalizeMethodValue(v){ const s = normalizeHeader(v); if(['نقدي','كاش'].includes(s)) return 'cash'; if(['بنكي','تحويل بنكي','تحويل'].includes(s)) return 'bank'; return null; }
function normalizeStatusValue(v){ const s = normalizeHeader(v); if(!s) return 'complete'; if(['مكتمل','تم'].includes(s)) return 'complete'; if(['معلق','معلّق'].includes(s)) return 'pending'; return null; }
function parseImportRows(headerRow, dataRows){
  const colMap = buildColumnMap(headerRow);
  const required = ['kind','date','method','amount'];
  const missing = required.filter(k=> colMap[k]===undefined);
  if(missing.length){
    const labels = missing.map(k=> FIELD_DEFS.find(f=>f.key===k).aliases[0]);
    return { drafts: [], headerError: 'أعمدة ناقصة في الملف: ' + labels.join('، ') };
  }
  const drafts = [];
  (dataRows||[]).forEach((row, i)=>{
    const rowNumber = i+2;
    const isRowEmpty = (row||[]).every(c=> c===undefined||c===null||String(c).trim()==='');
    if(isRowEmpty) return;
    const get = (key)=> colMap[key]!==undefined ? row[colMap[key]] : undefined;
    const kind = normalizeKindValue(get('kind'));
    const method = normalizeMethodValue(get('method'));
    const status = normalizeStatusValue(get('status'));
    const dateISO = excelDateToISO(get('date'));
    const amountRaw = get('amount');
    const amount = (amountRaw===undefined||amountRaw==='') ? NaN : parseFloat(amountRaw);
    const dueRaw = get('dueAmount');
    const dueAmount = (dueRaw===undefined||dueRaw==='') ? undefined : parseFloat(dueRaw);
    const employeeNameVal = normalizeHeader(get('employeeName'));
    const category = normalizeHeader(get('category')) || undefined;
    const period = normalizeHeader(get('period')) || (dateISO ? dateISO.slice(0,7) : undefined);
    const pendingReason = normalizeHeader(get('pendingReason')) || undefined;
    const proofRef = normalizeHeader(get('proofRef')) || '';
    const notes = normalizeHeader(get('notes')) || '';
    const parseErrors = [];
    if(!kind) parseErrors.push('نوع العملية غير معروف (استخدم "استلام رصيد" أو "تسليم لموظف")');
    if(!method) parseErrors.push('طريقة الدفع غير معروفة (استخدم "نقدي" أو "بنكي")');
    if(!dateISO) parseErrors.push('تاريخ غير صالح');
    if(status===null) parseErrors.push('الحالة غير معروفة (استخدم "مكتمل" أو "معلّق")');
    if(isNaN(amount)||amount<=0) parseErrors.push('المبلغ غير صالح');
    if(kind==='out' && !employeeNameVal) parseErrors.push('اسم الموظف مطلوب لعملية التسليم');
    if((status||'complete')==='pending' && !pendingReason) parseErrors.push('سبب التعليق مطلوب عند اختيار حالة معلّق');
    drafts.push({ rowNumber, kind, employeeName: employeeNameVal||undefined, category, method,
      date: dateISO, period, dueAmount, amount, status: status||'complete', pendingReason, proofRef, notes, parseErrors });
  });
  return { drafts, headerError: null };
}

/* ==================== أدوات ==================== */
const $id = id => document.getElementById('pr-' + id);
const notify  = (...a) => window.App ? App.notify(...a) : console.log(a);
const confirmD = o => window.App ? App.confirm(o) : Promise.resolve(window.confirm(o.title));
const vib = ms => window.App && App.vibrate(ms);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const CATEGORIES = ['راتب شهري','مكافأة','مواصلات','سلفة','أخرى'];
const PENDING_REASONS = ['لسا ما استلم','نقص بالمبلغ','خطأ بالبيانات','بانتظار التوقيع'];
const DEFAULT_STATE = () => ({ repName:'', currency:'₪', pendingAlertDays:3, employees:[], entries:[], auditLog:[] });

function fmtAmount(n){ return new Intl.NumberFormat('ar-EG').format(Math.round(n*100)/100); }
function money(n){ return `${fmtAmount(n)} ${esc(state.currency)}`; }
function fmtDate(iso){ if(!iso) return ''; const d = new Date(iso+'T00:00:00'); return new Intl.DateTimeFormat('ar-EG', {year:'numeric', month:'2-digit', day:'2-digit'}).format(d); }
function fmtDateTime(iso){ if(!iso) return ''; return new Intl.DateTimeFormat('ar-EG', {year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit'}).format(new Date(iso)); }
function fmtPeriod(p){ if(!p) return '—'; const [y,m] = p.split('-'); return new Intl.DateTimeFormat('ar-EG',{month:'long',year:'numeric'}).format(new Date(+y, +m-1, 1)); }
function localISO(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function todayISO(){ return localISO(new Date()); }
function currentPeriod(){ return todayISO().slice(0,7); }
function employeeName(id){ const emp = state.employees.find(x=>x.id===id); return emp ? emp.name : '—'; }
function whoOf(e){ return e.kind==='out' ? employeeName(e.employeeId) : 'استلام رصيد'; }
function kindLabel(e){ return e.kind==='out' ? (e.category||'—') : 'استلام رصيد'; }
function statusPill(e){ return e.status==='complete' ? '<span class="pill ok">مكتمل</span>' : `<span class="pill mid" title="${esc(e.pendingReason||'')}">معلّق</span>`; }
function methodPill(m){ return m==='cash' ? '<span class="pill info">نقدي</span>' : '<span class="pill" style="background:rgba(139,92,246,.15);color:#7c5cd6">بنكي</span>'; }
function markInvalid(el){ if(!el) return; el.classList.remove('invalid'); void el.offsetWidth; el.classList.add('invalid'); el.focus(); const off = () => el.classList.remove('invalid'); el.addEventListener('input', off, {once:true}); el.addEventListener('change', off, {once:true}); }
function downloadWb(wb, name){
  const buf = XLSX.write(wb, { bookType:'xlsx', type:'array' });
  const url = URL.createObjectURL(new Blob([buf], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/* ==================== الحالة والتخزين ==================== */
const STORAGE_KEY = 'ledger-state-v2';
let state = DEFAULT_STATE();
function hasCloudStorage(){ return typeof window.storage !== 'undefined' && window.storage && typeof window.storage.get === 'function' && typeof window.storage.set === 'function'; }
function mergeState(parsed){ state = Object.assign(DEFAULT_STATE(), parsed); }
async function loadState(){
  if(hasCloudStorage()){
    try{ const res = await window.storage.get(STORAGE_KEY, false); if(res && res.value){ mergeState(JSON.parse(res.value)); return; } }catch(err){}
  }
  try{ const raw = localStorage.getItem(STORAGE_KEY); if(raw) mergeState(JSON.parse(raw)); }catch(err){}
}
function loadStateSync(){ try{ const raw = localStorage.getItem(STORAGE_KEY); if(raw) mergeState(JSON.parse(raw)); }catch(err){} }
async function saveState(){
  const payload = JSON.stringify(state);
  let cloudOk = false;
  if(hasCloudStorage()){ try{ await window.storage.set(STORAGE_KEY, payload, false); cloudOk = true; }catch(err){} }
  try{ localStorage.setItem(STORAGE_KEY, payload); }
  catch(err){
    if(!cloudOk) notify({ type:'error', title:'تعذّر حفظ بيانات الرواتب', msg: err.name==='QuotaExceededError' ? 'مساحة التخزين في المتصفح ممتلئة. انزل نسخة احتياطية وافرغ مساحة.' : 'تحقق أنك لست في وضع التصفح الخاص ثم أعد المحاولة.', page:'payroll', duration:0 });
  }
  writeToLinkedFile();
  window.App && App.refresh();
}

/* ==================== ربط ملف حفظ حقيقي على الجهاز ==================== */
let fileHandle=null;
const FS_DB_NAME='fsdb_payroll';
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
    const handle = await window.showSaveFilePicker({ suggestedName:'بيانات_دفتر_الرواتب.json', types:[{description:'JSON',accept:{'application/json':['.json']}}] });
    let hasData=false, imported=false, data=null;
    try{ const text = await (await handle.getFile()).text(); if(text && text.trim()){ data = JSON.parse(text); if(data && Array.isArray(data.employees)) hasData = true; } }catch(e){}
    if(hasData){
      const ok = await confirmD({ title:'الملف فيه بيانات محفوظة', msg:`يحتوي ${fmtAmount((data.entries||[]).length)} عملية و${fmtAmount(data.employees.length)} موظف. هل تستوردها؟ (تُستبدل بيانات الدفتر الحالية)`, okText:'استيراد البيانات', cancelText:'الإبقاء على بياناتي', icon:'inbox' });
      if(ok){ mergeState(data); imported = true; }
    }
    fileHandle = handle; await idbSet('handle', handle);
    if(imported){ await saveState(); renderAll(); } else await writeToLinkedFile();
    updateLinkStatus('مربوط: ' + handle.name, true);
    notify({ type:'success', title: imported ? 'تم ربط الملف واستيراد بياناته' : 'تم ربط ملف الحفظ', msg:'كل عملية حفظ تُكتب تلقائياً في «' + handle.name + '».', page:'payroll' });
  }catch(e){ if(e.name!=='AbortError') notify({ type:'error', title:'تعذّر ربط الملف', msg:'السبب: ' + e.message, page:'payroll' }); }
}
let writeWarned = false;
async function writeToLinkedFile(){
  if(!fileHandle) return;
  try{
    const perm = await fileHandle.queryPermission({mode:'readwrite'});
    if(perm!=='granted'){
      const req = await fileHandle.requestPermission({mode:'readwrite'});
      if(req!=='granted'){ if(!writeWarned){ writeWarned = true; notify({ type:'warning', title:'لم يُحدَّث ملف الحفظ المربوط', msg:'البيانات محفوظة بالتطبيق، لكن الملف يحتاج إذناً. اضغط «ربط ملف حفظ» من إعدادات الدفتر.', page:'payroll' }); } return; }
    }
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(state,null,2));
    await writable.close();
    writeWarned = false;
  }catch(e){}
}
async function tryReconnectFile(){
  if(!fsSupported()) return;
  try{
    const handle = await idbGet('handle'); if(!handle) return;
    const perm = await handle.queryPermission({mode:'readwrite'});
    if(perm==='granted'){ fileHandle = handle; updateLinkStatus('مربوط: ' + handle.name, true); }
    else if(perm==='prompt'){ fileHandle = handle; updateLinkStatus('اضغط «ربط ملف حفظ» للسماح مجدداً', false); }
  }catch(e){}
}

/* ==================== سجل التدقيق ==================== */
function logAudit(action, entryRef, before, after){ state.auditLog.push(auditRecord(action, entryRef, before, after, state.repName, new Date().toISOString())); }

/* ==================== الواجهة ==================== */
const VIEWS = [
  ['overview','نظرة عامة','chart'], ['entries','العمليات','checklist'], ['vouchers','السندات','label'],
  ['reports','التقارير','chart'], ['recon','التسوية الشهرية','calendar'], ['employees','الموظفون','compass'],
  ['audit','سجل التدقيق','search'], ['settings','إعدادات الدفتر','settings']
];
let currentView = 'overview', flashId = null;
function buildUI(){
  const root = document.getElementById('page-payroll');
  root.removeAttribute('data-placeholder');
  root.innerHTML = `
  <div class="mk-head" style="--tint:rgba(234,179,8,.2)">
    <div class="tile">${ico('payroll')}</div>
    <div class="grow"><h2>دفتر الرواتب</h2><p id="pr-sub">الأرصدة، التسليمات للموظفين، السندات والتسوية الشهرية.</p></div>
    <div class="mk-tools">
      <button class="btn btn-primary" onclick="PR.openEntry('out')">تسليم لموظف</button>
      <button class="btn" onclick="PR.openEntry('in')">استلام رصيد</button>
    </div>
  </div>
  <div class="mk-tabs" role="tablist">${VIEWS.map(([v,l,i]) => `<button class="mk-tab${v==='overview'?' active':''}" id="pr-tab-${v}" role="tab" onclick="PR.showView('${v}')">${ico(i)}${l}${v==='entries'?'<span class="badge mid num" id="pr-pend-badge"></span>':''}</button>`).join('')}</div>

  <section class="mk-view active" id="pr-view-overview">
    <div id="pr-stale"></div>
    <div class="mk-kpis" id="pr-kpis"></div>
    <div class="mk-card mk-pad mk-section pr-chart">
      <div class="mk-title"><span>حركة آخر ٦ أشهر</span><span class="pr-legend"><span><i style="background:var(--accent)"></i>وارد</span><span><i style="background:var(--info-text)"></i>مصروف</span></span></div>
      <div id="pr-chart"></div>
    </div>
    <div class="mk-card mk-table-card">
      <div class="mk-table-head"><h3>آخر العمليات</h3><button class="btn btn-sm" onclick="PR.showView('entries')">كل العمليات</button></div>
      <div class="mk-scroll"><table class="mk-table"><thead><tr><th>المرجع</th><th>التاريخ</th><th>الجهة / الموظف</th><th>النوع</th><th>المبلغ</th><th>الحالة</th></tr></thead><tbody id="pr-recent"></tbody></table></div>
    </div>
  </section>

  <section class="mk-view" id="pr-view-entries">
    <div class="mk-toolbar">
      <input class="mk-inp" type="search" id="pr-search" placeholder="ابحث بالاسم، المرجع، الملاحظات…" oninput="PR.renderTable()">
      <select class="mk-inp" id="pr-f-kind" onchange="PR.renderTable()"><option value="">كل العمليات</option><option value="out">تسليم لموظف</option><option value="in">استلام رصيد</option></select>
      <select class="mk-inp" id="pr-f-method" onchange="PR.renderTable()"><option value="">كل الطرق</option><option value="cash">نقدي</option><option value="bank">بنكي</option></select>
      <select class="mk-inp" id="pr-f-status" onchange="PR.renderTable()"><option value="">كل الحالات</option><option value="complete">مكتمل</option><option value="pending">معلّق</option></select>
      <select class="mk-inp" id="pr-sort" onchange="PR.renderTable()"><option value="date_desc">الأحدث أولاً</option><option value="date_asc">الأقدم أولاً</option><option value="amount_desc">أعلى مبلغ</option><option value="amount_asc">أقل مبلغ</option><option value="status">حسب الحالة</option></select>
    </div>
    <div class="mk-card mk-table-card">
      <div class="mk-table-head"><h3>العمليات <span class="pill info num" id="pr-count">0</span></h3>
        <div class="row"><button class="btn btn-sm" onclick="PR.downloadTemplate()">قالب إكسل</button>
        <label class="btn btn-sm">استيراد من إكسل<input type="file" id="pr-import-xl" accept=".xlsx,.xls,.csv" hidden onchange="PR.importExcel(event)"></label></div></div>
      <div class="mk-scroll"><table class="mk-table"><thead><tr><th>المرجع</th><th>التاريخ</th><th>الجهة / الموظف</th><th>النوع</th><th>الطريقة</th><th>المبلغ</th><th>الحالة</th><th></th></tr></thead><tbody id="pr-entries"></tbody></table></div>
    </div>
  </section>

  <section class="mk-view" id="pr-view-vouchers">
    <p class="mk-hint">اضغط «طباعة السند» لإصدار سند قبض أو صرف جاهز للطباعة.</p>
    <div class="mk-card mk-table-card"><div class="mk-scroll"><table class="mk-table"><thead><tr><th>المرجع</th><th>التاريخ</th><th>الجهة / الموظف</th><th>النوع</th><th>المبلغ</th><th></th></tr></thead><tbody id="pr-vouchers"></tbody></table></div></div>
  </section>

  <section class="mk-view" id="pr-view-reports">
    <div class="mk-card mk-pad mk-section">
      <div class="mk-toolbar" style="margin:0">
        <div class="mk-field"><label for="pr-rep-from">من تاريخ</label><input class="mk-inp" type="date" id="pr-rep-from"></div>
        <div class="mk-field"><label for="pr-rep-to">إلى تاريخ</label><input class="mk-inp" type="date" id="pr-rep-to"></div>
        <button class="btn btn-primary" onclick="PR.genReport()">عرض التقرير</button>
      </div>
    </div>
    <div id="pr-report"></div>
  </section>

  <section class="mk-view" id="pr-view-recon">
    <div class="mk-card mk-pad mk-section">
      <div class="mk-toolbar" style="margin:0">
        <div class="mk-field"><label for="pr-recon-period">الشهر</label><input class="mk-inp" type="month" id="pr-recon-period"></div>
        <button class="btn btn-primary" onclick="PR.genRecon()">عرض التسوية</button>
        <button class="btn" onclick="PR.printPayroll()">طباعة كشف رواتب الشهر</button>
      </div>
      <p class="mk-hint" style="margin:10px 0 0">الراتب الأساسي يُضبط من «الموظفون». الفرق = الأساسي − ما صُرف فعلياً كراتب شهري لهذا الشهر.</p>
    </div>
    <div id="pr-recon"></div>
  </section>

  <section class="mk-view" id="pr-view-employees">
    <div class="mk-card mk-pad mk-section">
      <div class="mk-title"><span>إضافة موظف</span></div>
      <div class="mk-toolbar" style="margin:0">
        <div class="mk-field" style="flex:2 1 200px"><label for="pr-emp-name">اسم الموظف <i>*</i></label><input class="mk-inp" type="text" id="pr-emp-name" placeholder="الاسم الكامل" onkeydown="if(event.key==='Enter')PR.addEmployee()"></div>
        <div class="mk-field"><label for="pr-emp-salary">الراتب الأساسي الشهري</label><input class="mk-inp num" type="number" id="pr-emp-salary" min="0" step="0.01" placeholder="اختياري" inputmode="decimal" onkeydown="if(event.key==='Enter')PR.addEmployee()"></div>
        <button class="btn btn-primary" onclick="PR.addEmployee()">إضافة موظف</button>
      </div>
    </div>
    <div class="emp-grid" id="pr-emp-list"></div>
  </section>

  <section class="mk-view" id="pr-view-audit">
    <p class="mk-hint">سجل تلقائي لكل إضافة أو تعديل أو حذف — يوثّق من ومتى وماذا تغيّر.</p>
    <div class="mk-card mk-table-card"><div class="mk-scroll"><table class="mk-table"><thead><tr><th>الوقت</th><th>الإجراء</th><th>المرجع</th><th>بواسطة</th><th>التفاصيل</th></tr></thead><tbody id="pr-audit"></tbody></table></div></div>
  </section>

  <section class="mk-view" id="pr-view-settings">
    <div class="mk-card mk-pad mk-section">
      <div class="mk-title"><span>بيانات الدفتر</span></div>
      <div class="mk-grid">
        <div class="mk-field"><label for="pr-set-rep">اسم المندوب</label><input class="mk-inp" type="text" id="pr-set-rep" placeholder="يظهر على السندات"></div>
        <div class="mk-field"><label for="pr-set-cur">رمز العملة</label><input class="mk-inp" type="text" id="pr-set-cur" maxlength="6"></div>
        <div class="mk-field"><label for="pr-set-days">تنبيه المعلّق بعد (أيام)</label><input class="mk-inp num" type="number" id="pr-set-days" min="1" step="1"></div>
      </div>
      <div class="mk-btns"><button class="btn btn-primary" onclick="PR.saveSettings()">حفظ الإعدادات</button></div>
    </div>
    <div class="mk-card mk-pad mk-section">
      <div class="mk-title"><span>ملف الحفظ والبيانات القديمة</span><span id="pr-link-status" class="pill" hidden></span></div>
      <p class="mk-hint">النسخة الاحتياطية الكاملة من صفحة «النسخ الاحتياطي» تشمل الدفتر. هنا تقدر تربط ملف حفظ مباشر، أو تستورد نسخة من تطبيق الرواتب المستقل.</p>
      <div class="row">
        <button class="btn" onclick="PR.linkSaveFile()">ربط ملف حفظ</button>
        <label class="btn">استيراد نسخة قديمة<input type="file" accept="application/json,.json" hidden onchange="PR.importLegacy(event)"></label>
      </div>
    </div>
  </section>`;
}

/* ==================== التنقل ==================== */
function showView(name, silent){
  currentView = name;
  VIEWS.forEach(([v]) => { $id('view-' + v).classList.toggle('active', v === name); $id('tab-' + v).classList.toggle('active', v === name); });
  const t = $id('tab-' + name); if (t && t.scrollIntoView) t.scrollIntoView({ block:'nearest', inline:'center' });
  if(name==='overview') renderOverview();
  if(name==='entries') renderTable();
  if(name==='vouchers') renderVouchers();
  if(name==='audit') renderAudit();
  if(name==='employees') renderEmployeeList();
  if(name==='settings') renderSettingsView();
  if(silent !== true) vib(8);
}

/* ==================== نظرة عامة ==================== */
function renderOverview(){
  const {cash, bank} = computeBalances(state.entries);
  const period = currentPeriod();
  const monthEntries = state.entries.filter(e=> (e.period||e.date.slice(0,7))===period);
  const monthIncome = monthEntries.filter(e=>e.kind==='in').reduce((s,e)=>s+e.amount,0);
  const monthExpense = monthEntries.filter(e=>e.kind==='out').reduce((s,e)=>s+e.amount,0);
  const pendingCount = state.entries.filter(e=>e.status==='pending').length;
  const cur = `<span class="cur">${esc(state.currency)}</span>`;
  $id('kpis').innerHTML = `
    <div class="mk-card mk-kpi ${cash<0?'bad':'good'}"><small>الرصيد النقدي</small><b>${fmtAmount(cash)}${cur}</b></div>
    <div class="mk-card mk-kpi ${bank<0?'bad':'info'}"><small>الرصيد البنكي</small><b>${fmtAmount(bank)}${cur}</b></div>
    <div class="mk-card mk-kpi"><small>وارد هذا الشهر</small><b>${fmtAmount(monthIncome)}${cur}</b></div>
    <div class="mk-card mk-kpi"><small>مصروف هذا الشهر</small><b>${fmtAmount(monthExpense)}${cur}</b></div>
    <button class="mk-card mk-kpi ${pendingCount?'warn':''}" onclick="PR.gotoPending()"><small>عمليات معلّقة</small><b>${fmtAmount(pendingCount)}</b></button>`;
  const stale = stalePending(state.entries, state.pendingAlertDays, todayISO());
  $id('stale').innerHTML = stale.length ? `<div class="mk-banner bad">${ico('warning')}<span class="grow">لديك <b>${fmtAmount(stale.length)}</b> عملية معلّقة منذ أكثر من ${fmtAmount(state.pendingAlertDays)} يوم — تحتاج متابعة.</span><button class="btn btn-sm btn-danger" onclick="PR.gotoPending()">عرضها</button></div>` : '';
  const neg = [cash<0?'النقدي':'', bank<0?'البنكي':''].filter(Boolean);
  if(neg.length) $id('stale').innerHTML += `<div class="mk-banner warn">${ico('warning')}<span class="grow">الرصيد ${neg.join(' و')} بالسالب — سجّل استلام رصيد أو راجع العمليات.</span><button class="btn btn-sm" onclick="PR.openEntry('in')">استلام رصيد</button></div>`;
  $id('chart').innerHTML = buildBarChartSVG(monthlySeries(state.entries, 6, todayISO()));
  const recent = sortedEntries(state.entries).slice(0, 5);
  $id('recent').innerHTML = recent.length ? recent.map(e => `<tr class="clickable" onclick="PR.openDetail('${e.id}')"><td class="ref">${e.id}</td><td class="num">${fmtDate(e.date)}</td><td>${esc(whoOf(e))}</td><td>${esc(kindLabel(e))}</td><td class="amt">${money(e.amount)}</td><td>${statusPill(e)}</td></tr>`).join('')
    : `<tr><td colspan="6" class="mk-empty">لا توجد عمليات بعد. ابدأ بتسجيل «استلام رصيد»، ثم «تسليم لموظف».</td></tr>`;
  updatePendBadge();
}
function updatePendBadge(){ const b = $id('pend-badge'); if(!b) return; const n = state.entries.filter(e=>e.status==='pending').length; b.textContent = n ? fmtAmount(n) : ''; b.classList.toggle('show', n>0); }
function buildBarChartSVG(series){
  const w = 640, h = 200, padBottom = 28, padTop = 12;
  const max = Math.max(1, ...series.map(s=>Math.max(s.income, s.expense)));
  const groupW = w / series.length, barW = Math.min(28, groupW*0.3);
  let bars = '';
  series.forEach((s, i)=>{
    const cx = w - (i*groupW + groupW/2); // من اليمين لليسار
    const incH = (s.income/max) * (h-padBottom-padTop), expH = (s.expense/max) * (h-padBottom-padTop);
    bars += `<rect x="${cx + 3}" y="${h-padBottom-incH}" width="${barW}" height="${incH}" fill="var(--accent)" rx="4"><title>وارد ${fmtPeriod(s.period)}: ${fmtAmount(s.income)}</title></rect>`;
    bars += `<rect x="${cx - barW - 3}" y="${h-padBottom-expH}" width="${barW}" height="${expH}" fill="var(--info-text)" rx="4"><title>مصروف ${fmtPeriod(s.period)}: ${fmtAmount(s.expense)}</title></rect>`;
    bars += `<text x="${cx}" y="${h-8}" text-anchor="middle" font-size="11" fill="var(--muted)" font-family="IBM Plex Sans Arabic, sans-serif">${new Intl.DateTimeFormat('ar-EG',{month:'short'}).format(new Date(+s.period.slice(0,4), +s.period.slice(5)-1, 1))}</text>`;
  });
  return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="رسم بياني لحركة آخر ستة أشهر"><line x1="0" y1="${h-padBottom}" x2="${w}" y2="${h-padBottom}" stroke="var(--card-border)"/>${bars}</svg>`;
}
function gotoPending(){ showView('entries', true); $id('f-status').value = 'pending'; renderTable(); vib(8); }

/* ==================== جدول العمليات ==================== */
function sortedEntries(list){ return list.slice().sort((a,b)=> (b.date+b.id).localeCompare(a.date+a.id)); }
function applySortOrder(list, key){
  const arr = list.slice();
  if(key==='date_asc') return arr.sort((a,b)=> (a.date+a.id).localeCompare(b.date+b.id));
  if(key==='amount_desc') return arr.sort((a,b)=> b.amount-a.amount);
  if(key==='amount_asc') return arr.sort((a,b)=> a.amount-b.amount);
  if(key==='status') return arr.sort((a,b)=> a.status.localeCompare(b.status) || (b.date+b.id).localeCompare(a.date+a.id));
  return arr.sort((a,b)=> (b.date+b.id).localeCompare(a.date+a.id));
}
function renderTable(){
  const filters = { query:$id('search').value, kind:$id('f-kind').value, method:$id('f-method').value, status:$id('f-status').value };
  const list = applySortOrder(filterEntries(state.entries, filters), $id('sort').value);
  $id('count').textContent = fmtAmount(list.length);
  const body = $id('entries');
  if(!list.length){ body.innerHTML = `<tr><td colspan="8" class="mk-empty">${state.entries.length ? 'لا توجد عمليات مطابقة للبحث.' : 'لا توجد عمليات بعد.'}</td></tr>`; return; }
  body.innerHTML = list.map(e => `<tr class="clickable${e.id===flashId?' row-new':''}" onclick="if(!event.target.closest('.acts'))PR.openDetail('${e.id}')">
    <td class="ref">${e.id}</td><td class="num">${fmtDate(e.date)}</td><td>${esc(whoOf(e))}</td><td>${esc(kindLabel(e))}</td>
    <td>${methodPill(e.method)}</td><td class="amt">${money(e.amount)}</td><td>${statusPill(e)}</td>
    <td><div class="acts"><button class="ib" title="تعديل" aria-label="تعديل" onclick="PR.editEntry('${e.id}')">✏️</button><button class="ib" title="طباعة السند" aria-label="طباعة السند" onclick="PR.printVoucher('${e.id}')">🖨</button><button class="ib del" title="حذف" aria-label="حذف" onclick="PR.deleteEntry('${e.id}')">🗑</button></div></td></tr>`).join('');
  flashId = null;
}

/* ==================== السندات ==================== */
function renderVouchers(){
  const list = sortedEntries(state.entries), body = $id('vouchers');
  if(!list.length){ body.innerHTML = `<tr><td colspan="6" class="mk-empty">لا توجد عمليات بعد.</td></tr>`; return; }
  body.innerHTML = list.map(e => `<tr><td class="ref">${e.id}</td><td class="num">${fmtDate(e.date)}</td><td>${esc(e.kind==='out' ? employeeName(e.employeeId) : 'الشركة')}</td>
    <td>${e.kind==='out' ? 'سند صرف — ' + esc(e.category||'') : 'سند قبض'}</td><td class="amt">${money(e.amount)}</td>
    <td><button class="btn btn-sm" onclick="PR.printVoucher('${e.id}')">طباعة السند</button></td></tr>`).join('');
}
const PRINT_CSS = `body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;padding:32px;color:#111;direction:rtl}
.print-head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #16212C;padding-bottom:10px;margin-bottom:16px}
.print-head h1{font-size:1.25rem;margin:0 0 4px}.print-table{width:100%;border-collapse:collapse;margin-top:10px}
.print-table th,.print-table td{border:1px solid #999;padding:8px;font-size:.9rem;text-align:right}.print-table th{background:#eee;width:32%}
.sign-box{margin-top:48px;display:flex;justify-content:space-between}.sign-box div{width:42%;border-top:1px solid #333;padding-top:6px;font-size:.85rem;text-align:center}`;
function openPrint(title, body){
  const w = window.open('', '_blank');
  if(!w){ notify({ type:'error', title:'المتصفح منع نافذة الطباعة', msg:'اسمح بالنوافذ المنبثقة لهذا الموقع ثم أعد المحاولة.' }); return false; }
  w.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>${title}</title><style>${PRINT_CSS}</style></head><body>${body}<script>window.onload=()=>window.print();<\/script></body></html>`);
  w.document.close(); return true;
}
function printVoucher(entryId){
  const e = state.entries.find(x=>x.id===entryId); if(!e) return;
  const isOut = e.kind==='out', who = isOut ? employeeName(e.employeeId) : 'الشركة', title = isOut ? 'سند صرف' : 'سند قبض';
  const ok = openPrint(title + ' ' + e.id, `
    <div class="print-head"><div><h1>${title}</h1><div>رقم المرجع: ${e.id}</div></div>
      <div>${state.repName ? 'المندوب: ' + esc(state.repName) + '<br>' : ''}التاريخ: ${fmtDate(e.date)}</div></div>
    <table class="print-table">
      <tr><th>${isOut ? 'اسم المستلم' : 'الجهة'}</th><td>${esc(who)}</td></tr>
      <tr><th>البيان</th><td>${isOut ? esc(e.category||'') : 'دفعة رصيد'} ${e.period ? '— فترة ' + fmtPeriod(e.period) : ''}</td></tr>
      <tr><th>طريقة الدفع</th><td>${e.method==='cash'?'نقدي':'تحويل بنكي'}</td></tr>
      <tr><th>المبلغ</th><td>${money(e.amount)}</td></tr>
      ${e.dueAmount!==undefined ? `<tr><th>المبلغ المستحق</th><td>${money(e.dueAmount)}</td></tr>` : ''}
      <tr><th>رقم/وصف الإثبات</th><td>${esc(e.proofRef) || '—'}</td></tr>
      <tr><th>ملاحظات</th><td>${esc(e.notes) || '—'}</td></tr>
    </table>
    <div class="sign-box"><div>توقيع المُسلِّم</div><div>توقيع المُستلِم</div></div>`);
  if(ok) notify({ type:'info', title:`تم تجهيز ${title} ${e.id}`, msg:'اختر الطابعة أو «حفظ بصيغة PDF».', log:false });
}

/* ==================== إضافة / تعديل عملية ==================== */
let entryCtx = null; // { kind, editingId, method, status, sheet }
function openEntry(kind, existing){
  if(kind==='out' && !state.employees.length){
    return notify({ type:'warning', title:'أضف موظفاً أولاً', msg:'التسليم يحتاج موظفاً مسجّلاً في الدفتر.', action:{ label:'إضافة موظف', fn:() => { showView('employees'); $id('emp-name').focus(); } }, log:false });
  }
  vib(10);
  const isOut = kind==='out', ex = existing || null;
  entryCtx = { kind, editingId: ex ? ex.id : null, method: ex ? ex.method : 'cash', status: ex ? ex.status : 'complete' };
  const opt = (arr, sel) => arr.map(v => `<option${v===sel?' selected':''}>${esc(v)}</option>`).join('');
  const html = `
    <div class="mk-form-head">${ico(isOut ? 'outbox' : 'inbox')}<div><h3>${ex ? 'تعديل عملية ' + ex.id : (isOut ? 'تسليم لموظف' : 'تسجيل استلام رصيد')}</h3><p>${isOut ? 'مبلغ يُصرف لموظف من الرصيد النقدي أو البنكي.' : 'رصيد يدخل الدفتر من الجهة المموّلة.'}</p></div></div>
    <div class="mk-errbox" id="pr-e-err"></div>
    ${isOut ? `
    <div class="mk-grid-2">
      <div class="mk-field"><label for="pr-e-emp">الموظف <i>*</i></label><select class="mk-inp" id="pr-e-emp">${state.employees.map(emp => `<option value="${emp.id}"${ex && ex.employeeId===emp.id?' selected':''}>${esc(emp.name)}</option>`).join('')}</select></div>
      <div class="mk-field"><label for="pr-e-cat">نوع الصرف <i>*</i></label><select class="mk-inp" id="pr-e-cat">${opt(CATEGORIES, ex ? ex.category : 'راتب شهري')}</select></div>
    </div>` : ''}
    <div class="mk-field"><label>طريقة الدفع <i>*</i></label><div class="mk-seg" id="pr-e-method">
      <button type="button" data-val="cash" aria-pressed="${entryCtx.method==='cash'}">نقدي</button><button type="button" data-val="bank" aria-pressed="${entryCtx.method==='bank'}">بنكي</button></div>
      <span class="help" id="pr-e-bal"></span></div>
    <div class="mk-grid-2">
      <div class="mk-field"><label for="pr-e-date">تاريخ الصرف الفعلي <i>*</i></label><input class="mk-inp" type="date" id="pr-e-date" value="${ex ? ex.date : todayISO()}"></div>
      ${isOut ? `<div class="mk-field"><label for="pr-e-period">الشهر الذي يخصه المبلغ</label><input class="mk-inp" type="month" id="pr-e-period" value="${ex ? (ex.period||currentPeriod()) : currentPeriod()}"></div>` : '<div></div>'}
    </div>
    <div class="mk-grid-2">
      <div class="mk-field"><label for="pr-e-amount">${isOut ? 'المبلغ المصروف فعلياً' : 'المبلغ المستلم'} <i>*</i></label><input class="mk-inp num" type="number" id="pr-e-amount" min="0" step="0.01" inputmode="decimal" placeholder="0.00" value="${ex ? ex.amount : ''}"></div>
      ${isOut ? `<div class="mk-field"><label for="pr-e-due">المبلغ المستحق</label><input class="mk-inp num" type="number" id="pr-e-due" min="0" step="0.01" inputmode="decimal" placeholder="إن كان مختلفاً" value="${ex && ex.dueAmount!==undefined ? ex.dueAmount : ''}"></div>` : '<div></div>'}
    </div>
    <div class="mk-field"><label>حالة الاستلام</label><div class="mk-seg" id="pr-e-status">
      <button type="button" data-val="complete" aria-pressed="${entryCtx.status==='complete'}">مكتمل</button><button type="button" data-val="pending" aria-pressed="${entryCtx.status==='pending'}">معلّق</button></div></div>
    <div class="mk-field" id="pr-e-reason-f" ${entryCtx.status==='pending'?'':'hidden'}><label for="pr-e-reason">سبب التعليق <i>*</i></label><select class="mk-inp" id="pr-e-reason">${opt(PENDING_REASONS, ex && ex.pendingReason)}</select></div>
    <div class="mk-field"><label for="pr-e-proof">رقم / وصف الإثبات</label><input class="mk-inp" type="text" id="pr-e-proof" placeholder="مثال: إيصال موقّع رقم 114" value="${esc(ex ? ex.proofRef||'' : '')}"></div>
    <div class="mk-field"><label for="pr-e-notes">ملاحظات</label><textarea class="mk-inp" id="pr-e-notes" placeholder="أي تفاصيل إضافية…">${esc(ex ? ex.notes||'' : '')}</textarea></div>
    <div class="actions"><button class="btn btn-primary" data-save data-autofocus>${ex ? 'حفظ التعديلات' : 'حفظ العملية'}</button><button class="btn" data-cancel>إلغاء</button></div>`;
  const sheet = App.sheet(html, { cls:'wide', onClose: v => { if(v !== 'saved' && entryCtx && entryCtx.sheet === sheet) notify({ type:'info', title: ex ? 'تم إلغاء التعديل' : 'لم تُحفظ العملية', msg: ex ? 'لم يتغيّر السجل.' : 'أُغلق النموذج دون حفظ.', log:false, duration:2400 }); } });
  entryCtx.sheet = sheet;
  const ov = sheet.ov;
  const seg = (id, key, after) => ov.querySelector('#' + id).addEventListener('click', ev => { const b = ev.target.closest('button'); if(!b) return; entryCtx[key] = b.dataset.val; ov.querySelectorAll('#' + id + ' button').forEach(x => x.setAttribute('aria-pressed', x === b)); vib(6); after && after(); });
  const showBal = () => { if(!isOut) return; const others = state.entries.filter(x => x.id !== entryCtx.editingId); const b = computeBalances(others)[entryCtx.method]; ov.querySelector('#pr-e-bal').innerHTML = `المتاح ${entryCtx.method==='cash'?'نقداً':'بالبنك'}: <b style="color:${b<=0?'var(--danger-text)':'var(--success-text)'}">${money(b)}</b>`; };
  seg('pr-e-method', 'method', showBal);
  seg('pr-e-status', 'status', () => { ov.querySelector('#pr-e-reason-f').hidden = entryCtx.status !== 'pending'; });
  showBal();
  ov.querySelector('[data-cancel]').onclick = () => sheet.close();
  ov.querySelector('[data-save]').onclick = () => submitEntry(ov, sheet);
  ov.querySelectorAll('.mk-inp').forEach(i => i.addEventListener('keydown', ev => { if(ev.key==='Enter' && i.tagName==='INPUT'){ ev.preventDefault(); submitEntry(ov, sheet); } }));
}
async function submitEntry(ov, sheet){
  const isOut = entryCtx.kind==='out', q = s => ov.querySelector(s);
  const amount = parseFloat(q('#pr-e-amount').value);
  const dueRaw = isOut ? q('#pr-e-due').value : '';
  const draft = {
    kind: entryCtx.kind, method: entryCtx.method, date: q('#pr-e-date').value,
    period: isOut ? q('#pr-e-period').value : undefined,
    employeeId: isOut ? q('#pr-e-emp').value : undefined,
    category: isOut ? q('#pr-e-cat').value : undefined,
    amount, dueAmount: (isOut && dueRaw) ? parseFloat(dueRaw) : undefined,
    status: entryCtx.status, pendingReason: entryCtx.status==='pending' ? q('#pr-e-reason').value : undefined,
    proofRef: q('#pr-e-proof').value.trim(), notes: q('#pr-e-notes').value.trim(),
  };
  const errors = validateEntry(draft);
  const box = q('#pr-e-err');
  if(errors.length){
    box.textContent = errors.join(' · '); box.classList.add('show');
    if(!draft.date) markInvalid(q('#pr-e-date')); else if(!(amount > 0)) markInvalid(q('#pr-e-amount'));
    notify({ type:'error', title:'راجع بيانات العملية', msg:errors[0], log:false });
    return;
  }
  box.classList.remove('show');
  // تحقق منطقي قبل الحفظ
  if(isOut){
    const others = state.entries.filter(x => x.id !== entryCtx.editingId);
    const bal = computeBalances(others)[draft.method];
    if(bal - draft.amount < 0){
      const ok = await confirmD({ title:'الرصيد لا يكفي', msg:`المتاح ${draft.method==='cash'?'نقداً':'بالبنك'} ${fmtAmount(bal)} ${state.currency}، والمبلغ ${fmtAmount(draft.amount)}. سيصبح الرصيد ${fmtAmount(bal - draft.amount)}. هل تتابع؟`, okText:'حفظ رغم ذلك', cancelText:'تعديل المبلغ', icon:'warning' });
      if(!ok){ markInvalid(q('#pr-e-amount')); return; }
    }
    if(draft.category==='راتب شهري'){
      const dup = others.find(x => x.kind==='out' && x.category==='راتب شهري' && x.employeeId===draft.employeeId && x.period===draft.period);
      if(dup){
        const ok = await confirmD({ title:'راتب هذا الشهر مسجّل مسبقاً', msg:`لـ${employeeName(draft.employeeId)} عن ${fmtPeriod(draft.period)} (المرجع ${dup.id} بمبلغ ${fmtAmount(dup.amount)}). هل تسجّل دفعة إضافية؟`, okText:'تسجيل دفعة إضافية', cancelText:'رجوع', icon:'warning' });
        if(!ok) return;
      }
    }
    if(draft.dueAmount!==undefined && draft.amount < draft.dueAmount && draft.status==='complete'){
      notify({ type:'info', title:'المصروف أقل من المستحق', msg:`المتبقي للموظف ${fmtAmount(draft.dueAmount - draft.amount)} ${state.currency} ويظهر في ملخصه.`, log:false });
    }
  }
  draft.employeeName = isOut ? employeeName(draft.employeeId) : undefined;
  let saved;
  if(entryCtx.editingId){
    const idx = state.entries.findIndex(x=>x.id===entryCtx.editingId);
    if(idx>-1){
      const before = Object.assign({}, state.entries[idx]);
      draft.id = entryCtx.editingId; draft.createdAt = state.entries[idx].createdAt;
      state.entries[idx] = draft; logAudit('update', draft.id, before, draft);
    }
  } else {
    draft.id = nextRef(state.entries, draft.date); draft.createdAt = new Date().toISOString();
    state.entries.push(draft); logAudit('create', draft.id, null, draft);
  }
  saved = draft; flashId = draft.id;
  await saveState();
  sheet.close('saved');
  renderAll();
  const editing = !!entryCtx.editingId;
  notify({ type: draft.status==='pending' ? 'warning' : 'success',
    title: editing ? `تم حفظ تعديل ${saved.id}` : (isOut ? `تم تسليم ${fmtAmount(saved.amount)} ${state.currency} لـ${saved.employeeName}` : `تم تسجيل استلام ${fmtAmount(saved.amount)} ${state.currency}`),
    msg: `المرجع ${saved.id}${saved.status==='pending' ? ' — معلّق: ' + saved.pendingReason : ''}. الرصيد ${saved.method==='cash'?'النقدي':'البنكي'} الآن ${fmtAmount(computeBalances(state.entries)[saved.method])} ${state.currency}.`,
    action:{ label:'طباعة السند', fn:() => printVoucher(saved.id) }, page:'payroll', duration:7000 });
}
function editEntry(id){ const e = state.entries.find(x=>x.id===id); if(e) openEntry(e.kind, e); }

/* ==================== الحذف مع التراجع ==================== */
async function deleteEntry(id, fromSheet){
  const e = state.entries.find(x=>x.id===id); if(!e) return;
  const ok = await confirmD({ title:`حذف العملية ${e.id}؟`, msg:`${whoOf(e)} — ${kindLabel(e)} — ${fmtAmount(e.amount)} ${state.currency}. يُسجَّل الحذف في سجل التدقيق.`, okText:'حذف العملية', danger:true });
  if(!ok) return;
  if(fromSheet) fromSheet.close('saved');
  const pos = state.entries.indexOf(e);
  logAudit('delete', id, e, null);
  state.entries = state.entries.filter(x=>x.id!==id);
  await saveState(); renderAll();
  notify({ type:'success', title:`تم حذف العملية ${id}`, msg:`${fmtAmount(e.amount)} ${state.currency} — ${whoOf(e)}`, page:'payroll', duration:8000,
    action:{ label:'تراجع', fn: async () => {
      if(state.entries.some(x=>x.id===id)) return notify({ type:'error', title:'تعذّر التراجع', msg:'تم استخدام نفس رقم المرجع لعملية أحدث.' });
      state.entries.splice(Math.min(pos, state.entries.length), 0, e); logAudit('restore', id, null, e); flashId = id;
      await saveState(); renderAll(); notify({ type:'info', title:'تمت استعادة العملية ' + id, log:false });
    } } });
}

/* ==================== تفاصيل عملية ==================== */
function openDetail(id){
  const e = state.entries.find(x=>x.id===id); if(!e) return;
  vib(8);
  const rows = [
    ['نوع العملية', e.kind==='out' ? 'تسليم لموظف' : 'استلام رصيد'], ['الجهة / الموظف', esc(e.kind==='out' ? employeeName(e.employeeId) : 'الشركة')],
    ['نوع الصرف', esc(e.category || '—')], ['الطريقة', e.method==='cash' ? 'نقدي' : 'بنكي'],
    ['تاريخ الصرف', fmtDate(e.date)], ['الفترة / الشهر', fmtPeriod(e.period)],
    ['المبلغ', money(e.amount)], ['المبلغ المستحق', e.dueAmount!==undefined ? money(e.dueAmount) : '—'],
    ['الحالة', e.status==='complete' ? 'مكتمل' : ('معلّق — ' + esc(e.pendingReason||''))], ['رقم/وصف الإثبات', esc(e.proofRef || '—')],
  ];
  const sheet = App.sheet(`
    <div class="mk-form-head">${ico(e.kind==='out'?'outbox':'inbox')}<div><h3>العملية ${e.id}</h3><p>أُنشئت ${e.createdAt ? fmtDateTime(e.createdAt) : '—'}</p></div></div>
    <div class="mk-detail">${rows.map(([k,v]) => `<div><small>${k}</small><b>${v}</b></div>`).join('')}</div>
    ${e.notes ? `<div class="info-box">ملاحظات: ${esc(e.notes)}</div>` : ''}
    ${e.status==='pending' ? `<div class="actions" style="margin-top:14px"><button class="btn btn-primary" data-complete>تأكيد الاستلام (مكتمل)</button></div>` : ''}
    <div class="actions"><button class="btn" data-edit>تعديل</button><button class="btn" data-print>طباعة السند</button><button class="btn btn-danger" data-del>حذف</button></div>`, { cls:'wide' });
  const ov = sheet.ov;
  ov.querySelector('[data-edit]').onclick = () => { sheet.close(); setTimeout(() => editEntry(id), 220); };
  ov.querySelector('[data-print]').onclick = () => printVoucher(id);
  ov.querySelector('[data-del]').onclick = () => deleteEntry(id, sheet);
  const c = ov.querySelector('[data-complete]');
  if(c) c.onclick = async () => {
    const idx = state.entries.findIndex(x=>x.id===id); const before = Object.assign({}, state.entries[idx]);
    state.entries[idx] = Object.assign({}, before, { status:'complete', pendingReason:undefined });
    logAudit('update', id, before, state.entries[idx]); flashId = id;
    await saveState(); sheet.close(); renderAll();
    notify({ type:'success', title:`تم تأكيد استلام ${id}`, msg:'تحوّلت الحالة من معلّق إلى مكتمل.', page:'payroll' });
  };
}

/* ==================== الموظفون ==================== */
function renderEmployeeList(){
  const box = $id('emp-list');
  if(!state.employees.length){ box.innerHTML = `<div class="mk-card empty">${ico('compass')}<div><b>لا يوجد موظفون بعد</b><p>أضف أول موظف من النموذج أعلاه ليظهر في نموذج التسليم.</p></div></div>`; return; }
  box.innerHTML = state.employees.map(emp => {
    const s = employeeSummary(state.entries, emp.id);
    return `<div class="mk-card emp-card"><div class="top"><div class="av">${esc(emp.name.trim().charAt(0))}</div><div style="flex:1;min-width:0"><b>${esc(emp.name)}</b>
      <small>${emp.monthlySalary ? 'الراتب الأساسي: ' + money(emp.monthlySalary) : 'بدون راتب أساسي مسجّل'}</small></div></div>
      <div class="row"><span class="pill info num">${fmtAmount(s.count)} حركة</span>${s.remaining>0 ? `<span class="pill mid">متبقٍ له ${money(s.remaining)}</span>` : `<span class="pill ok">مصروف ${money(s.paid)}</span>`}</div>
      <div class="row" style="justify-content:flex-start"><button class="btn btn-sm" onclick="PR.openEmployee('${emp.id}')">السجل</button><button class="btn btn-sm" onclick="PR.editEmployee('${emp.id}')">تعديل</button><button class="btn btn-sm btn-ghost" onclick="PR.deleteEmployee('${emp.id}')">حذف</button></div></div>`;
  }).join('');
}
async function addEmployee(){
  const nameInput = $id('emp-name'), salaryInput = $id('emp-salary');
  const name = nameInput.value.trim();
  if(!name){ markInvalid(nameInput); return notify({ type:'error', title:'اسم الموظف مطلوب', msg:'اكتب اسم الموظف ثم اضغط «إضافة موظف».', log:false }); }
  if(state.employees.some(x => x.name.trim().toLowerCase() === name.toLowerCase())){ markInvalid(nameInput); return notify({ type:'error', title:'الموظف موجود مسبقاً', msg:`«${name}» مسجّل في الدفتر. استخدم «تعديل» لتغيير بياناته.`, log:false }); }
  const salary = salaryInput.value ? parseFloat(salaryInput.value) : undefined;
  if(salary !== undefined && (isNaN(salary) || salary < 0)){ markInvalid(salaryInput); return notify({ type:'error', title:'الراتب غير صحيح', msg:'أدخل رقماً موجباً أو اتركه فارغاً.', log:false }); }
  state.employees.push({ id:'emp-' + Date.now(), name, monthlySalary: salary });
  nameInput.value=''; salaryInput.value='';
  await saveState(); renderEmployeeList(); nameInput.focus();
  notify({ type:'success', title:`تمت إضافة ${name}`, msg: salary ? `الراتب الأساسي ${fmtAmount(salary)} ${state.currency}.` : 'بدون راتب أساسي — تقدر تضيفه من «تعديل».', action:{ label:'تسليم له', fn:() => { openEntry('out'); setTimeout(() => { const s = document.getElementById('pr-e-emp'); if(s) s.value = state.employees[state.employees.length-1].id; }, 50); } }, page:'payroll' });
}
function editEmployee(id){
  const emp = state.employees.find(x=>x.id===id); if(!emp) return;
  const sheet = App.sheet(`
    <div class="mk-form-head">${ico('compass')}<div><h3>تعديل بيانات الموظف</h3><p>التعديل لا يغيّر العمليات السابقة.</p></div></div>
    <div class="mk-field"><label for="pr-ee-name">الاسم <i>*</i></label><input class="mk-inp" id="pr-ee-name" value="${esc(emp.name)}"></div>
    <div class="mk-field"><label for="pr-ee-sal">الراتب الأساسي الشهري</label><input class="mk-inp num" type="number" min="0" step="0.01" id="pr-ee-sal" value="${emp.monthlySalary ?? ''}"></div>
    <div class="actions"><button class="btn btn-primary" data-ok data-autofocus>حفظ</button><button class="btn" data-cancel>إلغاء</button></div>`);
  const ov = sheet.ov;
  ov.querySelector('[data-cancel]').onclick = () => sheet.close();
  ov.querySelector('[data-ok]').onclick = async () => {
    const n = ov.querySelector('#pr-ee-name'), sv = ov.querySelector('#pr-ee-sal').value, name = n.value.trim();
    if(!name){ markInvalid(n); return; }
    if(state.employees.some(x => x.id!==id && x.name.trim().toLowerCase()===name.toLowerCase())){ markInvalid(n); return notify({ type:'error', title:'الاسم مستخدم لموظف آخر', log:false }); }
    emp.name = name; emp.monthlySalary = sv ? parseFloat(sv) : undefined;
    state.entries.forEach(e => { if(e.employeeId===id) e.employeeName = name; });
    await saveState(); sheet.close(); renderAll();
    notify({ type:'success', title:'تم حفظ بيانات الموظف', msg:name, page:'payroll' });
  };
}
async function deleteEmployee(id){
  const emp = state.employees.find(x=>x.id===id); if(!emp) return;
  const used = state.entries.filter(e=>e.employeeId===id).length;
  if(used) return notify({ type:'error', title:'لا يمكن حذف هذا الموظف', msg:`له ${fmtAmount(used)} عملية في الدفتر. احذف عملياته أولاً أو أبقِه للسجل.` });
  if(!await confirmD({ title:`حذف ${emp.name}؟`, msg:'لا توجد له عمليات، وسيُحذف من القائمة فقط.', okText:'حذف', danger:true })) return;
  const pos = state.employees.indexOf(emp);
  state.employees.splice(pos, 1); await saveState(); renderEmployeeList();
  notify({ type:'success', title:`تم حذف ${emp.name}`, action:{ label:'تراجع', fn: async () => { state.employees.splice(pos, 0, emp); await saveState(); renderEmployeeList(); } }, page:'payroll' });
}
function openEmployee(employeeId){
  const emp = state.employees.find(x=>x.id===employeeId); if(!emp) return;
  const s = employeeSummary(state.entries, employeeId);
  const hist = sortedEntries(filterEntries(state.entries, {kind:'out', employeeId}));
  const sheet = App.sheet(`
    <div class="mk-form-head">${ico('compass')}<div><h3>${esc(emp.name)}</h3><p>${emp.monthlySalary ? 'الراتب الأساسي ' + money(emp.monthlySalary) : 'بدون راتب أساسي مسجّل'}</p></div></div>
    <div class="mk-detail"><div><small>إجمالي المستحق</small><b>${money(s.due)}</b></div><div><small>إجمالي المصروف</small><b>${money(s.paid)}</b></div>
      <div><small>المتبقي</small><b style="color:${s.remaining>0?'var(--warn-text)':'inherit'}">${money(s.remaining)}</b></div><div><small>عدد الحركات</small><b>${fmtAmount(s.count)}</b></div></div>
    <div class="mk-card" style="margin-top:16px;overflow:hidden"><div class="mk-scroll"><table class="mk-table"><thead><tr><th>المرجع</th><th>التاريخ</th><th>النوع</th><th>المبلغ</th><th>الحالة</th></tr></thead><tbody>
      ${hist.length ? hist.map(e => `<tr><td class="ref">${e.id}</td><td class="num">${fmtDate(e.date)}</td><td>${esc(e.category)}</td><td class="amt">${money(e.amount)}</td><td>${statusPill(e)}</td></tr>`).join('') : `<tr><td colspan="5" class="mk-empty">لا توجد حركات لهذا الموظف بعد.</td></tr>`}
    </tbody></table></div></div>
    <div class="actions"><button class="btn btn-primary" data-pay>تسليم لهذا الموظف</button><button class="btn" data-cancel>إغلاق</button></div>`, { cls:'wide' });
  sheet.ov.querySelector('[data-cancel]').onclick = () => sheet.close();
  sheet.ov.querySelector('[data-pay]').onclick = () => { sheet.close(); setTimeout(() => { openEntry('out'); const sel = document.getElementById('pr-e-emp'); if(sel) sel.value = employeeId; }, 220); };
}

/* ==================== التقارير ==================== */
let lastReport = null;
function genReport(){
  const from = $id('rep-from').value, to = $id('rep-to').value, box = $id('report');
  if(!from || !to){ markInvalid(!from ? $id('rep-from') : $id('rep-to')); return notify({ type:'error', title:'حدّد الفترة', msg:'اختر تاريخ البداية والنهاية.', log:false }); }
  if(from > to){ markInvalid($id('rep-to')); return notify({ type:'error', title:'الفترة غير صحيحة', msg:'تاريخ النهاية قبل تاريخ البداية.', log:false }); }
  const r = rangeSummary(state.entries, from, to); lastReport = { from, to, r };
  vib(8);
  const catRows = Object.entries(r.byCategory).map(([k,v]) => `<tr><td>${esc(k)}</td><td class="amt">${money(v)}</td></tr>`).join('') || `<tr><td colspan="2" class="mk-empty">لا يوجد مصروف ضمن هذه الفترة.</td></tr>`;
  const cur = `<span class="cur">${esc(state.currency)}</span>`;
  box.innerHTML = `
    <div class="mk-kpis">
      <div class="mk-card mk-kpi good"><small>إجمالي الوارد</small><b>${fmtAmount(r.totalIncome)}${cur}</b></div>
      <div class="mk-card mk-kpi info"><small>إجمالي المصروف</small><b>${fmtAmount(r.totalExpense)}${cur}</b></div>
      <div class="mk-card mk-kpi ${r.net<0?'bad':''}"><small>الصافي</small><b>${fmtAmount(r.net)}${cur}</b></div>
      <div class="mk-card mk-kpi ${r.pendingCount?'warn':''}"><small>معلّقة بالفترة</small><b>${fmtAmount(r.pendingCount)}</b></div>
    </div>
    <div class="mk-card mk-table-card"><div class="mk-table-head"><h3>المصروف حسب النوع</h3>
      <div class="row"><button class="btn btn-sm btn-primary" onclick="PR.printReport()">طباعة التقرير</button><button class="btn btn-sm" onclick="PR.exportReportExcel()">تصدير إكسل</button></div></div>
      <div class="mk-scroll"><table class="mk-table"><thead><tr><th>النوع</th><th>المبلغ</th></tr></thead><tbody>${catRows}</tbody></table></div></div>
    <p class="mk-hint">${fmtAmount(r.entryCount)} عملية من ${fmtDate(from)} إلى ${fmtDate(to)} — نقدي: وارد ${fmtAmount(r.incomeCash)} / مصروف ${fmtAmount(r.expenseCash)}، بنكي: وارد ${fmtAmount(r.incomeBank)} / مصروف ${fmtAmount(r.expenseBank)}.</p>`;
}
function printReport(){
  if(!lastReport) return; const { from, to, r } = lastReport;
  const catRows = Object.entries(r.byCategory).map(([k,v])=>`<tr><td>${esc(k)}</td><td>${money(v)}</td></tr>`).join('') || `<tr><td colspan="2">لا يوجد مصروف ضمن هذه الفترة</td></tr>`;
  openPrint('تقرير مالي', `<div class="print-head"><div><h1>تقرير مالي</h1><div>الفترة: من ${fmtDate(from)} إلى ${fmtDate(to)}</div></div>
    <div>${state.repName ? 'المندوب: ' + esc(state.repName) + '<br>' : ''}تاريخ الإصدار: ${fmtDate(todayISO())}</div></div>
    <table class="print-table"><tr><th>إجمالي الوارد</th><td>${money(r.totalIncome)}</td></tr><tr><th>إجمالي المصروف</th><td>${money(r.totalExpense)}</td></tr>
    <tr><th>الصافي</th><td>${money(r.net)}</td></tr><tr><th>عمليات معلّقة</th><td>${r.pendingCount}</td></tr></table>
    <h1 style="font-size:1rem;margin-top:20px">المصروف حسب نوع الصرف</h1><table class="print-table"><tr><th>النوع</th><th>المبلغ</th></tr>${catRows}</table>
    <div class="sign-box"><div>إعداد</div><div>اعتماد</div></div>`);
}
function exportReportExcel(){
  if(!lastReport) return; const { from, to } = lastReport;
  if(typeof XLSX === 'undefined') return notify({ type:'error', title:'مكتبة Excel غير محمّلة', msg:'أعد تحميل التطبيق ثم حاول مجدداً.' });
  const inRange = state.entries.filter(e=> e.date>=from && e.date<=to).slice().sort((a,b)=> a.date.localeCompare(b.date));
  const headers = FIELD_DEFS.map(f=>f.aliases[0]);
  const rows = inRange.map(e=> [ e.kind==='in' ? 'استلام رصيد' : 'تسليم لموظف', e.kind==='out' ? employeeName(e.employeeId) : '', e.category || '',
    e.method==='cash' ? 'نقدي' : 'بنكي', e.date, e.period || '', e.dueAmount!==undefined ? e.dueAmount : '', e.amount,
    e.status==='complete' ? 'مكتمل' : 'معلّق', e.pendingReason || '', e.proofRef || '', e.notes || '' ]);
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([headers, ...rows]), 'العمليات');
  downloadWb(wb, `تقرير-الرواتب-من-${from}-الى-${to}.xlsx`);
  notify({ type:'success', title:'تم تصدير التقرير إلى Excel', msg:`${fmtAmount(rows.length)} عملية — تجده في مجلد التنزيلات.` });
}

/* ==================== التسوية الشهرية ==================== */
function genRecon(){
  const period = $id('recon-period').value, box = $id('recon');
  if(!period){ markInvalid($id('recon-period')); return notify({ type:'error', title:'اختر الشهر', log:false }); }
  if(!state.employees.length){ box.innerHTML = `<div class="mk-card empty">${ico('compass')}<div><b>لا يوجد موظفون</b><p>أضف الموظفين ورواتبهم الأساسية من «الموظفون».</p></div></div>`; return; }
  const rows = reconciliation(state.entries, state.employees, period);
  const tot = rows.reduce((a,r) => ({ e:a.e+r.expected, p:a.p+r.paid, d:a.d+r.diff }), { e:0, p:0, d:0 });
  const noSalary = rows.filter(r => !r.expected).length;
  vib(8);
  box.innerHTML = `
    ${noSalary ? `<div class="mk-banner warn">${ico('warning')}<span class="grow">${fmtAmount(noSalary)} موظف بدون راتب أساسي، فالفرق عندهم لا يعبّر عن نقص فعلي.</span><button class="btn btn-sm" onclick="PR.showView('employees')">ضبط الرواتب</button></div>` : ''}
    <div class="mk-card mk-table-card"><div class="mk-table-head"><h3>تسوية ${fmtPeriod(period)}</h3></div><div class="mk-scroll"><table class="mk-table">
      <thead><tr><th>الموظف</th><th>الراتب الأساسي</th><th>المصروف فعلياً</th><th>الفرق</th></tr></thead><tbody>
      ${rows.map(r => `<tr><td>${esc(r.name)}</td><td class="amt">${money(r.expected)}</td><td class="amt">${money(r.paid)}</td>
        <td class="amt" style="color:${r.diff===0?'var(--success-text)':r.diff>0?'var(--warn-text)':'var(--danger-text)'}">${money(r.diff)}</td></tr>`).join('')}
      <tr><td><b>الإجمالي</b></td><td class="amt">${money(tot.e)}</td><td class="amt">${money(tot.p)}</td><td class="amt">${money(tot.d)}</td></tr>
      </tbody></table></div></div>`;
}
function printPayroll(){
  const period = $id('recon-period').value || currentPeriod();
  if(!state.employees.length) return notify({ type:'warning', title:'لا يوجد موظفون لطباعة الكشف', msg:'أضف الموظفين أولاً.', log:false });
  const rows = state.employees.map(emp => ({ name: emp.name, paid: state.entries.filter(e=> e.kind==='out' && e.employeeId===emp.id && e.period===period).reduce((s,e)=>s+e.amount,0) }));
  openPrint('كشف رواتب ' + period, `<div class="print-head"><div><h1>كشف رواتب شهري</h1><div>الفترة: ${fmtPeriod(period)}</div></div>
    <div>${state.repName ? 'المندوب: ' + esc(state.repName) + '<br>' : ''}تاريخ الإصدار: ${fmtDate(todayISO())}</div></div>
    <table class="print-table"><tr><th style="width:auto">#</th><th style="width:auto">اسم الموظف</th><th style="width:auto">إجمالي المصروف له هذا الشهر</th><th style="width:auto">التوقيع</th></tr>
    ${rows.map((r,i)=>`<tr><td>${i+1}</td><td>${esc(r.name)}</td><td>${money(r.paid)}</td><td></td></tr>`).join('')}</table>`);
}

/* ==================== سجل التدقيق ==================== */
const FIELD_LABELS = { amount:'المبلغ', method:'الطريقة', status:'الحالة', category:'النوع', date:'التاريخ', employeeId:'الموظف', period:'الفترة', dueAmount:'المستحق' };
const VAL_LABELS = { cash:'نقدي', bank:'بنكي', complete:'مكتمل', pending:'معلّق' };
function renderAudit(){
  const list = state.auditLog.slice().sort((a,b)=> b.ts.localeCompare(a.ts)), body = $id('audit');
  if(!list.length){ body.innerHTML = `<tr><td colspan="5" class="mk-empty">لا توجد حركات مسجّلة بعد.</td></tr>`; return; }
  const actionLabel = { create:'<span class="pill ok">إضافة</span>', update:'<span class="pill info">تعديل</span>', delete:'<span class="pill high">حذف</span>', restore:'<span class="pill ok">استعادة</span>' };
  const show = (k, v) => k==='employeeId' ? employeeName(v) : k==='amount'||k==='dueAmount' ? (v===undefined?'—':fmtAmount(v)) : (VAL_LABELS[v] || v || '—');
  body.innerHTML = list.map(a=>{
    let details = '—';
    if(a.action==='update' && a.before && a.after){
      const changed = [];
      for(const k of Object.keys(FIELD_LABELS)) if(a.before[k] !== a.after[k]) changed.push(`${FIELD_LABELS[k]}: ${esc(show(k,a.before[k]))} ← ${esc(show(k,a.after[k]))}`);
      details = changed.join('، ') || 'لا تغييرات جوهرية';
    } else if((a.action==='delete') && a.before) details = `مبلغ ${money(a.before.amount)}`;
    else if((a.action==='create' || a.action==='restore') && a.after) details = `مبلغ ${money(a.after.amount)}`;
    return `<tr><td class="num">${fmtDateTime(a.ts)}</td><td>${actionLabel[a.action]||esc(a.action)}</td><td class="ref">${esc(a.entryRef)}</td><td>${esc(a.actor) || '—'}</td><td class="wrap">${details}</td></tr>`;
  }).join('');
}

/* ==================== الإعدادات ==================== */
function renderSettingsView(){
  $id('set-rep').value = state.repName || ''; $id('set-cur').value = state.currency || '₪'; $id('set-days').value = state.pendingAlertDays || 3;
  updateLinkStatus(linkText, linkOk);
}
async function saveSettings(){
  const days = parseInt($id('set-days').value, 10);
  if(!days || days < 1){ markInvalid($id('set-days')); return notify({ type:'error', title:'عدد الأيام غير صحيح', msg:'أدخل رقماً صحيحاً من ١ فأكثر.', log:false }); }
  state.repName = $id('set-rep').value.trim(); state.currency = $id('set-cur').value.trim() || '₪'; state.pendingAlertDays = days;
  await saveState(); renderAll();
  notify({ type:'success', title:'تم حفظ إعدادات الدفتر', msg:`العملة ${state.currency} — تنبيه المعلّق بعد ${fmtAmount(days)} يوم.`, page:'payroll' });
}
function importLegacy(ev){
  const file = ev.target.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    let parsed;
    try{ parsed = JSON.parse(reader.result); }catch(err){ return notify({ type:'error', title:'تعذّرت قراءة الملف', msg:'الملف ليس بصيغة JSON أو أنه تالف.' }); }
    if(parsed && parsed.app === 'unified-admin-system') return notify({ type:'warning', title:'هذه نسخة من النظام الموحّد', msg:'استعدها من صفحة النسخ الاحتياطي.', action:{ label:'النسخ الاحتياطي', fn:() => App.switchModule('backup') } });
    if(!parsed || !Array.isArray(parsed.entries) || !Array.isArray(parsed.employees)) return notify({ type:'error', title:'الملف ليس نسخة من دفتر الرواتب', msg:'اختر ملفاً نُزّل من «تصدير نسخة احتياطية» في تطبيق الرواتب المستقل.' });
    const ok = await confirmD({ title:'استبدال بيانات الدفتر؟', msg:`الملف: ${fmtAmount(parsed.entries.length)} عملية و${fmtAmount(parsed.employees.length)} موظف. الحالي: ${fmtAmount(state.entries.length)} عملية و${fmtAmount(state.employees.length)} موظف. سيُستبدل الحالي بالكامل.`, okText:'استبدال البيانات', danger:true, icon:'inbox' });
    if(!ok) return notify({ type:'info', title:'تم إلغاء الاستيراد', msg:'لم يتغيّر شيء.', log:false });
    const prev = JSON.parse(JSON.stringify(state));
    mergeState(parsed); await saveState(); renderAll();
    notify({ type:'success', title:'تم استيراد بيانات الدفتر', msg:`${fmtAmount(state.entries.length)} عملية و${fmtAmount(state.employees.length)} موظف.`, page:'payroll', duration:9000,
      action:{ label:'تراجع', fn: async () => { mergeState(prev); await saveState(); renderAll(); notify({ type:'info', title:'تم التراجع عن الاستيراد', log:false }); } } });
  };
  reader.readAsText(file); ev.target.value = '';
}

/* ==================== استيراد/تصدير إكسل ==================== */
function resolveEmployeeIdByName(name, createdList){
  const trimmed = name.trim();
  let emp = state.employees.find(x=> x.name.trim().toLowerCase() === trimmed.toLowerCase());
  if(!emp){ emp = { id:'emp-' + Date.now() + '-' + Math.random().toString(36).slice(2,7), name: trimmed }; state.employees.push(emp); createdList.push(trimmed); }
  return emp.id;
}
function downloadTemplate(){
  if(typeof XLSX === 'undefined') return notify({ type:'error', title:'مكتبة Excel غير محمّلة', msg:'أعد تحميل التطبيق ثم حاول مجدداً.' });
  const headers = FIELD_DEFS.map(f=>f.aliases[0]);
  const y = todayISO().slice(0,4), p = currentPeriod();
  const exampleIn = ['استلام رصيد','','','نقدي',`${p}-01`,'','','50000','مكتمل','','إيصال رقم 1','مثال - احذف هذا الصف'];
  const exampleOut = ['تسليم لموظف','اسم الموظف هنا','راتب شهري','نقدي',`${p}-05`,p,'','3000','مكتمل','','إيصال موقّع رقم 10','مثال - احذف هذا الصف'];
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([headers, exampleIn, exampleOut]), 'قالب الاستيراد');
  downloadWb(wb, 'قالب-استيراد-دفتر-الرواتب.xlsx');
  notify({ type:'success', title:'تم تنزيل قالب الاستيراد', msg:'عبّئ الصفوف واحذف صفي المثال، ثم استخدم «استيراد من إكسل».', log:false });
}
async function importExcel(ev){
  const file = ev.target.files[0]; if(!file) return;
  if(typeof XLSX === 'undefined'){ ev.target.value=''; return notify({ type:'error', title:'مكتبة Excel غير محمّلة', msg:'أعد تحميل التطبيق ثم حاول مجدداً.' }); }
  try{
    const wb = await XLSX.read(await file.arrayBuffer(), { type:'array' });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header:1, defval:'' });
    const { drafts, headerError } = parseImportRows(rows[0] || [], rows.slice(1));
    if(headerError){ ev.target.value=''; return notify({ type:'error', title:'الملف لا يطابق القالب', msg: headerError + '. نزّل القالب للتأكد من أسماء الأعمدة.', action:{ label:'تنزيل القالب', fn:downloadTemplate } }); }
    // تجاهل صفوف المثال الموجودة في القالب
    const exampleRows = drafts.filter(d => (d.notes||'').includes('مثال - احذف هذا الصف'));
    drafts.splice(0, drafts.length, ...drafts.filter(d => !exampleRows.includes(d)));
    if(!drafts.length){ ev.target.value=''; return notify({ type:'warning', title: exampleRows.length ? 'الملف فيه صفوف المثال فقط' : 'الملف فارغ', msg: exampleRows.length ? 'احذف صفي المثال وأضف عملياتك الحقيقية ثم أعد الاستيراد.' : 'لا توجد صفوف بيانات تحت العناوين.' }); }
    const valid = drafts.filter(d => !d.parseErrors.length);
    const ok = await confirmD({ title:`استيراد ${fmtAmount(valid.length)} عملية؟`, msg:`الملف فيه ${fmtAmount(drafts.length)} صف، ${fmtAmount(drafts.length - valid.length)} منها فيه أخطاء وسيُتجاهل. تُضاف العمليات الصالحة للدفتر ويُنشأ أي موظف غير موجود.`, okText:'استيراد', icon:'inbox' });
    if(!ok){ ev.target.value=''; return notify({ type:'info', title:'تم إلغاء الاستيراد', log:false }); }
    let importedCount = 0; const createdEmployees = [], failures = [], importedIds = [];
    for(const d of drafts){
      if(d.parseErrors.length){ failures.push(`صف ${d.rowNumber}: ` + d.parseErrors.join('، ')); continue; }
      const draft = { kind:d.kind, method:d.method, date:d.date, proofRef:d.proofRef, notes:d.notes, status:d.status, pendingReason:d.pendingReason };
      if(d.kind==='out'){
        draft.employeeId = resolveEmployeeIdByName(d.employeeName, createdEmployees); draft.employeeName = employeeName(draft.employeeId);
        draft.category = d.category || 'أخرى'; draft.period = d.period; draft.dueAmount = d.dueAmount; draft.amount = d.amount;
      } else draft.amount = d.amount;
      const errors = validateEntry(draft);
      if(errors.length){ failures.push(`صف ${d.rowNumber}: ` + errors.join('، ')); continue; }
      draft.id = nextRef(state.entries, draft.date); draft.createdAt = new Date().toISOString();
      state.entries.push(draft); logAudit('create', draft.id, null, draft); importedCount++; importedIds.push(draft.id);
    }
    await saveState(); renderAll();
    notify({ type: failures.length ? 'warning' : 'success', title:`تم استيراد ${fmtAmount(importedCount)} من ${fmtAmount(drafts.length)} عملية`,
      msg: (createdEmployees.length ? `موظفون جدد: ${[...new Set(createdEmployees)].join('، ')}. ` : '') + (failures.length ? `${fmtAmount(failures.length)} صف تُجوهل.` : ''),
      action: failures.length ? { label:'عرض الأخطاء', fn:() => { const s = App.sheet(`<div class="mk-form-head">${ico('warning')}<div><h3>صفوف لم تُستورد</h3><p>صحّحها في الملف ثم استورد هذه الصفوف فقط.</p></div></div><div class="info-box"><ul style="padding-inline-start:18px">${failures.map(f=>`<li>${esc(f)}</li>`).join('')}</ul></div><div class="actions"><button class="btn btn-primary" data-x>تم</button></div>`, { cls:'wide' }); s.ov.querySelector('[data-x]').onclick = () => s.close(); } } : undefined,
      page:'payroll', duration: failures.length ? 0 : 6000 });
  }catch(err){ console.error(err); notify({ type:'error', title:'تعذّرت قراءة ملف Excel', msg:'تأكد أنه ملف xlsx صحيح ومطابق للقالب.' }); }
  ev.target.value = '';
}

/* ==================== إعادة الرسم ==================== */
function renderAll(){
  $id('sub').textContent = state.repName ? `المندوب: ${state.repName}` : 'الأرصدة، التسليمات للموظفين، السندات والتسوية الشهرية.';
  renderOverview();
  if(currentView==='entries') renderTable();
  if(currentView==='vouchers') renderVouchers();
  if(currentView==='audit') renderAudit();
  if(currentView==='employees') renderEmployeeList();
  updatePendBadge();
}
function onShow(){ renderAll(); }

/* ==================== التهيئة ==================== */
function init(){
  buildUI();
  loadStateSync();            // متزامن حتى تكون التنبيهات جاهزة فوراً للرئيسية
  $id('rep-from').value = currentPeriod() + '-01'; $id('rep-to').value = todayISO(); $id('recon-period').value = currentPeriod();
  renderAll();
  tryReconnectFile();
  if(hasCloudStorage()) loadState().then(renderAll);
}

/* ==================== تنبيهات الشاشة الرئيسية ==================== */
function alerts(){
  const res = [];
  const stale = stalePending(state.entries, state.pendingAlertDays, todayISO());
  if(stale.length) res.push({ severity:'high', title:`${fmtAmount(stale.length)} عملية معلّقة منذ أكثر من ${fmtAmount(state.pendingAlertDays)} يوم`,
    subtitle: stale.slice(0,3).map(e => `${e.id} ${whoOf(e)}`).join('، ') + (stale.length>3 ? ` و${fmtAmount(stale.length-3)} غيرها` : ''), onOpen: gotoPending });
  const b = computeBalances(state.entries);
  if(b.cash < 0) res.push({ severity:'high', title:'الرصيد النقدي بالسالب', subtitle:`${fmtAmount(b.cash)} ${state.currency}`, onOpen:() => showView('overview', true) });
  if(b.bank < 0) res.push({ severity:'high', title:'الرصيد البنكي بالسالب', subtitle:`${fmtAmount(b.bank)} ${state.currency}`, onOpen:() => showView('overview', true) });
  return res;
}

return {
  showView, openEntry, editEntry, deleteEntry, openDetail, printVoucher, renderTable, gotoPending,
  addEmployee, editEmployee, deleteEmployee, openEmployee, genReport, printReport, exportReportExcel,
  genRecon, printPayroll, saveSettings, linkSaveFile, importLegacy, downloadTemplate, importExcel,
  init, onShow, alerts,
  _state: () => state, _logic: { nextRef, computeBalances, parseImportRows }
};
})();

window.NotificationRegistry = window.NotificationRegistry || {};
NotificationRegistry.payroll = () => PR.alerts();
(window.MODULE_INITS = window.MODULE_INITS || []).push(PR.init);
