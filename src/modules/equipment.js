/* =====================================================================
   وحدة مخزون المعدات — EQ
   البيانات: localStorage inv_eq_a / inv_eq_w  |  ملف الحفظ: IndexedDB fsdb_inv_eq
   ===================================================================== */
const EQ = (function(){
'use strict';
const $id = id => document.getElementById('eq-' + id);
const toDate = s => { if(!s) return ''; const d = new Date((s - 25569) * 86400 * 1000); return d.toISOString().split('T')[0]; };
const LOW = 50; // حد الرصيد المنخفض

/* ---------- البيانات الأولية (تُستخدم فقط إذا لم توجد بيانات محفوظة) ---------- */
const additions = [
  {date:'',name:'كلبشات',unit:'قطعة',qty:10,supplier:'إمداد الداخلية',notes:''},
  {date:toDate(46039),name:'بطانية',unit:'قطعة',qty:250,supplier:'الصليب',notes:''},
  {date:toDate(46039),name:'فرشات',unit:'قطعة',qty:250,supplier:'الصليب',notes:''},
  {date:toDate(46060),name:'قفل',unit:'قطعة',qty:15,supplier:'إمداد الداخلية',notes:''},
  {date:toDate(46063),name:'صابون',unit:'قطعة',qty:36,supplier:'إمداد الداخلية',notes:''},
  {date:toDate(46063),name:'شوادر',unit:'قطعة',qty:9,supplier:'إمداد الداخلية',notes:''},
  {date:toDate(46063),name:'مخدة',unit:'قطعة',qty:14,supplier:'إمداد الداخلية',notes:''},
  {date:toDate(46063),name:'وجه فرشات',unit:'قطعة',qty:66,supplier:'إمداد الداخلية',notes:''},
  {date:toDate(46063),name:'حرامات',unit:'قطعة',qty:78,supplier:'إمداد الداخلية',notes:''},
  {date:toDate(46084),name:'بطارية لابتوب',unit:'قطعة',qty:1,supplier:'شراء',notes:''},
  {date:toDate(46084),name:'ورق A4',unit:'كرتونة',qty:5,supplier:'شراء',notes:''},
  {date:'',name:'رصاص كلاشن',unit:'حبة',qty:100,supplier:'',notes:''},
  {date:toDate(46133),name:'برميل 1500 لتر',unit:'عدد',qty:3,supplier:'إمداد الداخلية',notes:''},
  {date:toDate(46133),name:'برميل 2000 لتر',unit:'عدد',qty:2,supplier:'إمداد الداخلية',notes:''},
  {date:toDate(46170),name:'كراسي',unit:'عدد',qty:20,supplier:'إمداد الداخلية',notes:''},
  {date:toDate(46170),name:'طاولات',unit:'عدد',qty:5,supplier:'إمداد الداخلية',notes:''},
  {date:toDate(46176),name:'مظاريف ورق',unit:'عدد',qty:60,supplier:'شراء المالية',notes:''},
  {date:toDate(46176),name:'نوت',unit:'دستة',qty:2,supplier:'شراء المالية',notes:''},
  {date:toDate(46176),name:'ملف',unit:'عدد',qty:2,supplier:'شراء المالية',notes:''},
  {date:toDate(46176),name:'فايل نايلون',unit:'عدد',qty:4,supplier:'شراء المالية',notes:''},
  {date:toDate(46176),name:'قلم فسفور',unit:'عدد',qty:7,supplier:'شراء المالية',notes:''},
  {date:toDate(46176),name:'مسطرة',unit:'عدد',qty:2,supplier:'شراء المالية',notes:''},
  {date:toDate(46176),name:'مشبك',unit:'عدد',qty:1,supplier:'شراء المالية',notes:''},
  {date:toDate(46176),name:'قلم جاف',unit:'عدد',qty:24,supplier:'شراء المالية',notes:''},
  {date:toDate(46176),name:'ورق ملاحظات',unit:'عدد',qty:2,supplier:'شراء المالية',notes:''},
  {date:toDate(46216),name:'جوال كشاف',unit:'عدد',qty:1,supplier:'شراء المالية',notes:''},
  {date:toDate(46216),name:'شاحن جوال',unit:'عدد',qty:1,supplier:'شراء المالية',notes:''},
  {date:toDate(46218),name:'طقم كاسات',unit:'طقم',qty:2,supplier:'شراء المالية',notes:''},
  {date:toDate(46218),name:'مرطبان',unit:'عدد',qty:3,supplier:'شراء المالية',notes:''},
  {date:toDate(46218),name:'غلاية',unit:'عدد',qty:1,supplier:'شراء المالية',notes:''},
  {date:toDate(46218),name:'صينية ضيافة',unit:'عدد',qty:2,supplier:'شراء المالية',notes:''},
  {date:toDate(46218),name:'ملاعق',unit:'قطعة',qty:12,supplier:'شراء المالية',notes:''},
  {date:toDate(46218),name:'سكاكين',unit:'قطعة',qty:2,supplier:'شراء المالية',notes:''},
  {date:toDate(46218),name:'صحون',unit:'عدد',qty:5,supplier:'شراء المالية',notes:''},
  {date:toDate(46218),name:'شاف مياه',unit:'عدد',qty:2,supplier:'شراء المالية',notes:''},
  {date:toDate(46218),name:'فناجين',unit:'عدد',qty:1,supplier:'شراء المالية',notes:''},
  {date:toDate(46218),name:'تيرموس',unit:'عدد',qty:1,supplier:'شراء المالية',notes:''},
];
const withdrawals = [
  {date:toDate(46070),name:'لانشون',unit:'علبة',qty:144,dept:'سجن الوسطى',notes:''},
  {date:toDate(46070),name:'كلبشات',unit:'قطعة',qty:3,dept:'سجن خانيونس',notes:''},
  {date:toDate(46070),name:'فرشات',unit:'قطعة',qty:70,dept:'سجن النظارة',notes:''},
  {date:toDate(46070),name:'بطانية',unit:'قطعة',qty:90,dept:'سجن النظارة',notes:''},
  {date:toDate(46085),name:'بطارية لابتوب',unit:'قطعة',qty:1,dept:'سجن النساء',notes:''},
  {date:toDate(46107),name:'كلبشات',unit:'قطعة',qty:3,dept:'سجن الوسطى',notes:''},
  {date:toDate(46107),name:'كلبشات',unit:'قطعة',qty:1,dept:'المدير العام',notes:''},
  {date:toDate(46107),name:'رصاص كلاشن',unit:'حبة',qty:60,dept:'سجن الوسطى',notes:''},
  {date:toDate(46127),name:'قفل',unit:'قطعة',qty:1,dept:'سجن خانيونس',notes:''},
  {date:toDate(46133),name:'برميل 1500 لتر',unit:'عدد',qty:2,dept:'سجن خانيونس',notes:''},
  {date:toDate(46133),name:'برميل 2000 لتر',unit:'عدد',qty:1,dept:'سجن خانيونس',notes:''},
  {date:toDate(46133),name:'برميل 1500 لتر',unit:'عدد',qty:1,dept:'سجن الوسطى',notes:''},
  {date:toDate(46133),name:'برميل 2000 لتر',unit:'عدد',qty:1,dept:'سجن الوسطى',notes:''},
  {date:toDate(46142),name:'قفل',unit:'عدد',qty:1,dept:'سجن خانيونس',notes:''},
  {date:toDate(46147),name:'قفل',unit:'عدد',qty:1,dept:'سجن الوسطى',notes:''},
  {date:toDate(46201),name:'كراسي',unit:'عدد',qty:4,dept:'سجن الوسطى',notes:''},
  {date:toDate(46201),name:'كراسي',unit:'عدد',qty:4,dept:'سجن خانيونس',notes:''},
  {date:toDate(46201),name:'كراسي',unit:'عدد',qty:4,dept:'سجن النساء',notes:''},
  {date:toDate(46175),name:'كراسي',unit:'عدد',qty:1,dept:'القانونية خالد عودة',notes:''},
  {date:toDate(46175),name:'طاولات',unit:'عدد',qty:1,dept:'القانونية خالد عودة',notes:''},
  {date:toDate(46190),name:'طاولات',unit:'عدد',qty:1,dept:'أبو معاذ',notes:''},
  {date:toDate(46147),name:'قفل',unit:'عدد',qty:1,dept:'سجن الوسطى',notes:''},
  {date:toDate(46147),name:'ملف',unit:'عدد',qty:1,dept:'مكتب المدير',notes:''},
  {date:toDate(46147),name:'فايل نايلون',unit:'عدد',qty:1,dept:'مكتب المدير',notes:''},
  {date:toDate(46147),name:'مظاريف ورق',unit:'عدد',qty:60,dept:'مكتب المدير',notes:''},
  {date:toDate(46147),name:'قلم فسفور',unit:'عدد',qty:1,dept:'مكتب المدير',notes:''},
  {date:toDate(46147),name:'قلم جاف',unit:'عدد',qty:2,dept:'مكتب المدير',notes:''},
  {date:toDate(46147),name:'مسطرة',unit:'عدد',qty:1,dept:'مكتب المدير',notes:''},
  {date:toDate(46147),name:'ورق ملاحظات',unit:'عدد',qty:1,dept:'مكتب المدير',notes:''},
  {date:toDate(46216),name:'شاحن جوال',unit:'عدد',qty:1,dept:'مكتب العمليات',notes:''},
  {date:toDate(46216),name:'جوال كشاف',unit:'عدد',qty:1,dept:'مكتب العمليات',notes:''},
  {date:toDate(46584),name:'طقم كاسات',unit:'طقم',qty:1,dept:'الحراسات',notes:''},
  {date:toDate(46584),name:'مرطبان',unit:'عدد',qty:3,dept:'الحراسات',notes:''},
  {date:toDate(46584),name:'صحون',unit:'عدد',qty:3,dept:'الحراسات',notes:''},
  {date:toDate(46584),name:'سكاكين',unit:'عدد',qty:1,dept:'الحراسات',notes:''},
  {date:toDate(46584),name:'ملاعق',unit:'عدد',qty:4,dept:'الحراسات',notes:''},
];
const extraItems = ['برميل 1000'];
const DEFAULT_DEPTS = ['سجن خانيونس','سجن الوسطى','عساكر القوة','سحور العساكر','توزيع على العساكر'];
const UNITS = ['علبة','كرتونة','قطعة','كيلو','عدد','حبة','طقم','دستة'];

let gfItem = '', gfFrom = '', gfTo = '', gfDept = '';
let chartInstance = null, currentChartType = 'balance', currentTab = 'in';
let editingAddIndex = null, editingOutIndex = null;
let flashIdx = { in:null, out:null };

const notify  = (...a) => window.App ? App.notify(...a) : console.log(a);
const confirmD = o => window.App ? App.confirm(o) : Promise.resolve(window.confirm(o.title));
const vib = ms => window.App && App.vibrate(ms);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num = x => Number(x || 0).toLocaleString('ar-EG');
const today = () => new Date().toISOString().split('T')[0];

/* ---------- الحفظ ---------- */
function saveData(){
  try {
    localStorage.setItem('inv_eq_a', JSON.stringify(additions));
    localStorage.setItem('inv_eq_w', JSON.stringify(withdrawals));
  } catch(e){
    notify({ type:'error', title:'تعذّر الحفظ على الجهاز', msg: e.name === 'QuotaExceededError' ? 'مساحة التخزين في المتصفح ممتلئة. انزل نسخة احتياطية وافرغ مساحة.' : 'السبب: ' + e.message, page:'equipment' });
  }
  writeToLinkedFile();
  window.App && App.refresh();
}
function loadData(){
  try {
    const a = localStorage.getItem('inv_eq_a'), w = localStorage.getItem('inv_eq_w');
    if (a){ const arr = JSON.parse(a); additions.length = 0; arr.forEach(r => additions.push(r)); }
    if (w){ const arr = JSON.parse(w); withdrawals.length = 0; arr.forEach(r => withdrawals.push(r)); }
    if (!a && !w){ // أول تشغيل: نحفظ البيانات الأولية لتدخل في الإحصاء والنسخ الاحتياطي
      localStorage.setItem('inv_eq_a', JSON.stringify(additions));
      localStorage.setItem('inv_eq_w', JSON.stringify(withdrawals));
    }
  } catch(e){}
}

/* ---------- ربط ملف حفظ حقيقي على الجهاز ---------- */
let fileHandle = null;
const FS_DB_NAME = 'fsdb_inv_eq';
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
    const handle = await window.showSaveFilePicker({ suggestedName:'بيانات_مخزون_المعدات.json', types:[{ description:'JSON', accept:{ 'application/json':['.json'] } }] });
    let hasData = false, imported = false, data = null;
    try { const text = await (await handle.getFile()).text(); if (text && text.trim()){ data = JSON.parse(text); if (data && Array.isArray(data.additions)) hasData = true; } } catch(e){}
    if (hasData){
      const ok = await confirmD({ title:'الملف فيه بيانات محفوظة', msg:`يحتوي ${num(data.additions.length)} إضافة و${num((data.withdrawals||[]).length)} صرف. هل تستوردها؟ (تُستبدل بيانات المعدات الحالية)`, okText:'استيراد البيانات', cancelText:'الإبقاء على بياناتي', icon:'inbox' });
      if (ok){
        additions.length = 0; (data.additions || []).forEach(r => additions.push(r));
        withdrawals.length = 0; (data.withdrawals || []).forEach(r => withdrawals.push(r));
        imported = true;
      }
    }
    fileHandle = handle;
    await idbSet('handle', handle);
    if (imported){ saveData(); refreshAll(); } else { await writeToLinkedFile(); }
    updateLinkStatus('مربوط: ' + handle.name, true);
    notify({ type:'success', title: imported ? 'تم ربط الملف واستيراد بياناته' : 'تم ربط ملف الحفظ', msg:'كل عملية حفظ تُكتب تلقائياً في «' + handle.name + '».', page:'equipment' });
  } catch(e){
    if (e.name !== 'AbortError') notify({ type:'error', title:'تعذّر ربط الملف', msg:'السبب: ' + e.message, page:'equipment' });
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
        if (!writeWarned){ writeWarned = true; notify({ type:'warning', title:'لم يُحدَّث ملف الحفظ المربوط', msg:'البيانات محفوظة بالتطبيق، لكن الملف يحتاج إذناً. اضغط «ربط ملف حفظ».', page:'equipment' }); }
        return;
      }
    }
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify({ additions, withdrawals, exported:new Date().toISOString() }, null, 2));
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

/* ---------- الحسابات ---------- */
function stockKey(name, unit){ return name + '||' + (unit || ''); }
function computeStock(adds = additions, outs = withdrawals){
  const map = {};
  extraItems.forEach(n => { const k = stockKey(n, ''); map[k] = { key:k, name:n, unit:'', totalIn:0, totalOut:0 }; });
  adds.forEach(r => { const k = stockKey(r.name, r.unit); if (!map[k]) map[k] = { key:k, name:r.name, unit:r.unit, totalIn:0, totalOut:0 }; map[k].totalIn += r.qty; });
  outs.forEach(r => { const k = stockKey(r.name, r.unit); if (!map[k]) map[k] = { key:k, name:r.name, unit:r.unit, totalIn:0, totalOut:0 }; map[k].totalOut += r.qty; });
  return Object.values(map).map(i => ({ ...i, balance:i.totalIn - i.totalOut }));
}
// يرجع الأصناف التي يصبح رصيدها سالباً (أو أكثر سلبية) لو طُبّق التعديل المقترح
function negativeAfter(newAdds, newOuts){
  const before = {}; computeStock().forEach(s => before[s.key] = s.balance);
  return computeStock(newAdds, newOuts).filter(s => s.balance < 0 && s.balance < (before[s.key] ?? 0));
}
const fmtDate = d => { if (!d) return '—'; const [y, m, day] = d.split('-'); return `${day}/${m}/${y}`; };
const inRange = (date, from, to) => { if (!date) return !from && !to; if (from && date < from) return false; if (to && date > to) return false; return true; };
function statusBadge(b){
  if (b <= 0) return '<span class="pill high">نافد</span>';
  if (b < LOW) return '<span class="pill mid">منخفض</span>';
  return '<span class="pill ok">متوفر</span>';
}
function balClass(b){ return b <= 0 ? 'bal-out' : b < LOW ? 'bal-low' : 'bal-ok'; }


/* ---------- استيراد من Excel ---------- */
function importFromExcel(){
  App.importExcel({
    title:'مخزون المعدات', page:'equipment',
    modes:[
      { id:'in', label:'إضافة أصناف', desc:'كل صف يضيف كمية لصنف في المخزون. الصنف الجديد يُنشأ تلقائياً.',
        cols:[
          { k:'date', labels:['التاريخ','تاريخ الإضافة'], req:true, type:'date' },
          { k:'name', labels:['الصنف','اسم الصنف'], req:true, type:'text' },
          { k:'unit', labels:['الوحدة'], type:'text', def:UNITS[0] },
          { k:'qty',  labels:['الكمية','العدد'], req:true, type:'num' },
          { k:'supplier', labels:['المورد','الجهة الموردة'], type:'text' },
          { k:'notes', labels:['ملاحظات','ملاحظة'], type:'text' }
        ],
        sample:[[new Date().toISOString().slice(0,10), 'بطانية', UNITS[0], 50, 'إمداد الداخلية', '']],
        check:recs => recs.filter(r => !UNITS.includes(r.unit)).map(r => ({ row:r.__row, msg:`الوحدة «${r.unit}» غير معروفة — المسموح: ${UNITS.join('، ')}` })),
        apply:async recs => {
          const prevA = additions.slice();
          recs.forEach(r => additions.push({ date:r.date, name:r.name, unit:r.unit, qty:r.qty, supplier:r.supplier || '', notes:r.notes || '' }));
          saveData(); populateDropdowns(); refreshAll();
          const items = new Set(recs.map(r => r.name)), total = recs.reduce((s,r) => s + r.qty, 0);
          notify({ type:'success', title:`تمت إضافة ${num(recs.length)} سجل من Excel`, page:'equipment', duration:9000,
            msg:`${num(items.size)} صنف بإجمالي ${num(total)} وحدة. راجع لوحة المخزون للأرصدة الجديدة.`,
            action:{ label:'تراجع', fn:() => { additions.length = 0; prevA.forEach(x => additions.push(x)); saveData(); populateDropdowns(); refreshAll(); notify({ type:'info', title:'تم التراجع عن الاستيراد', log:false }); } } });
        } },
      { id:'out', label:'صرف أصناف', desc:'كل صف يصرف كمية لجهة. الصنف لازم يكون موجوداً وبرصيد كافٍ.',
        cols:[
          { k:'date', labels:['التاريخ','تاريخ الصرف'], req:true, type:'date' },
          { k:'name', labels:['الصنف','اسم الصنف'], req:true, type:'text' },
          { k:'unit', labels:['الوحدة'], type:'text' },
          { k:'qty',  labels:['الكمية','العدد'], req:true, type:'num' },
          { k:'dept', labels:['الجهة','الجهة المستلمة','القسم'], req:true, type:'text' },
          { k:'notes', labels:['ملاحظات','ملاحظة'], type:'text' }
        ],
        sample:[[new Date().toISOString().slice(0,10), 'بطانية', UNITS[0], 10, 'سجن النظارة', '']],
        check:recs => {
          const stock = computeStock(), errs = [], used = {};
          recs.forEach(r => {
            let hit = r.unit ? stock.find(s => s.key === stockKey(r.name, r.unit)) : null;
            if (!hit){
              const same = stock.filter(s => s.name === r.name);
              if (same.length === 1) { hit = same[0]; r.unit = hit.unit; }
              else if (same.length > 1) return errs.push({ row:r.__row, msg:`«${r.name}» موجود بأكثر من وحدة (${same.map(s => s.unit).join('، ')}) — حدّد عمود الوحدة` });
            }
            if (!hit) return errs.push({ row:r.__row, msg:`«${r.name}»${r.unit ? ' بوحدة ' + r.unit : ''} غير موجود في المخزون — أضفه أولاً` });
            used[hit.key] = (used[hit.key] || 0) + r.qty;
            if (used[hit.key] > hit.balance) errs.push({ row:r.__row, msg:`الرصيد لا يكفي: المتاح من «${r.name}» ${num(hit.balance)} ${hit.unit} والمطلوب تراكمياً ${num(used[hit.key])}` });
          });
          return errs;
        },
        apply:async recs => {
          const prevW = withdrawals.slice();
          recs.forEach(r => withdrawals.push({ date:r.date, name:r.name, unit:r.unit, qty:r.qty, dept:r.dept, notes:r.notes || '' }));
          saveData(); populateDropdowns(); refreshAll();
          const depts = new Set(recs.map(r => r.dept)), total = recs.reduce((s,r) => s + r.qty, 0);
          notify({ type:'success', title:`تم صرف ${num(recs.length)} سجل من Excel`, page:'equipment', duration:9000,
            msg:`${num(total)} وحدة إلى ${num(depts.size)} جهة. تقدر تطبع سند كل صرف من سجل الصرف.`,
            action:{ label:'تراجع', fn:() => { withdrawals.length = 0; prevW.forEach(x => withdrawals.push(x)); saveData(); populateDropdowns(); refreshAll(); notify({ type:'info', title:'تم التراجع عن الاستيراد', log:false }); } } });
        } }
    ]
  });
}

/* ---------- الواجهة ---------- */
function buildUI(){
  const root = document.getElementById('page-equipment');
  root.removeAttribute('data-placeholder');
  root.innerHTML = `
  <div class="eq-head">
    <div class="tile">${ico('equipment')}</div>
    <div class="grow"><h2>مخزون المعدات</h2><p>سجّل الوارد، اصرف للجهات، وتابع الرصيد والأصناف النافدة.</p></div>
    <div class="eq-tools">
      <button class="btn btn-sm" onclick="EQ.exportExcel()">${ico('chart',20)}Excel</button>
      <button class="btn btn-sm" onclick="EQ.exportPDF()">${ico('checklist',20)}تقرير PDF</button>
      <button class="btn btn-sm" onclick="EQ.importFromExcel()">${ico('chart',20)}استيراد من Excel</button>
      <button class="btn btn-sm" onclick="EQ.linkSaveFile()">${ico('label',20)}ربط ملف حفظ</button>
      <label class="btn btn-sm" title="استيراد ملف نسخة من تطبيق المعدات المستقل">${ico('inbox',20)}استيراد نسخة قديمة<input type="file" accept=".json" hidden onchange="EQ.importBackup(event)"></label>
      <span id="eq-link-status" class="pill eq-link" hidden></span>
    </div>
  </div>

  <div class="eq-tabs" role="tablist">
    <button class="eq-tab active" id="eq-tab-in" role="tab" onclick="EQ.switchTab('in')">${ico('inbox')}الإضافة<span class="cnt num" id="eq-in-count2">0</span></button>
    <button class="eq-tab" id="eq-tab-out" role="tab" onclick="EQ.switchTab('out')">${ico('outbox')}الصرف<span class="cnt num" id="eq-out-count2">0</span></button>
    <button class="eq-tab" id="eq-tab-stock" role="tab" onclick="EQ.switchTab('stock')">${ico('chart')}المخزون<span class="cnt num" id="eq-stock-count2">0</span></button>
  </div>

  <div class="card eq-filter">
    <span class="lbl" id="eq-gf-label">${ico('search',20)}فلترة</span>
    <input class="inp" type="text" id="eq-gf-item" placeholder="اسم الصنف…" oninput="EQ.applyGlobalFilter()">
    <input class="inp" type="date" id="eq-gf-from" title="من تاريخ" oninput="EQ.applyGlobalFilter()">
    <span class="muted">←</span>
    <input class="inp" type="date" id="eq-gf-to" title="إلى تاريخ" oninput="EQ.applyGlobalFilter()">
    <select class="inp" id="eq-gf-dept" onchange="EQ.applyGlobalFilter()"><option value="">كل الجهات</option></select>
    <button class="btn btn-sm btn-ghost" onclick="EQ.clearGlobalFilter()">مسح الفلتر</button>
  </div>

  <!-- الإضافة -->
  <div class="eq-page active" id="eq-page-in">
    <div class="card eq-form" id="eq-form-in">
      <h3>${ico('inbox')}<span id="eq-in-title">إضافة صنف للمخزون</span></h3>
      <div class="eq-edit-note" id="eq-in-note"></div>
      <div class="eq-grid">
        <div class="field"><label for="eq-in-date">التاريخ <i>*</i></label><input class="inp" type="date" id="eq-in-date"></div>
        <div class="field wide"><label for="eq-in-name">اسم الصنف <i>*</i></label><input class="inp" type="text" id="eq-in-name" placeholder="مثال: بطانية" list="eq-items-dl" autocomplete="off"><datalist id="eq-items-dl"></datalist></div>
        <div class="field"><label for="eq-in-unit">الوحدة</label><select class="inp" id="eq-in-unit">${UNITS.map(u => `<option>${u}</option>`).join('')}</select></div>
        <div class="field"><label for="eq-in-qty">الكمية <i>*</i></label><input class="inp num" type="number" id="eq-in-qty" placeholder="0" min="1" inputmode="numeric"></div>
        <div class="field wide"><label for="eq-in-supplier">المورد</label><input class="inp" type="text" id="eq-in-supplier" placeholder="إمداد الداخلية" list="eq-sup-dl"><datalist id="eq-sup-dl"></datalist></div>
        <div class="field wide"><label for="eq-in-notes">ملاحظات</label><input class="inp" type="text" id="eq-in-notes" placeholder="اختياري"></div>
      </div>
      <div class="eq-btns">
        <button class="btn btn-primary" id="eq-in-submit-btn" onclick="EQ.addItem()">إضافة للمخزون</button>
        <button class="btn" id="eq-in-clear" onclick="EQ.clearInForm(true)">مسح الحقول</button>
        <button class="btn" id="eq-in-cancel-edit" onclick="EQ.cancelEditAdd()" style="display:none">إلغاء التعديل</button>
      </div>
    </div>
    <div class="card eq-table-card">
      <div class="eq-table-head"><h3>سجل الإضافات <span class="pill info num" id="eq-in-count">0</span></h3>
        <button class="btn btn-sm" id="eq-print-sel-in" onclick="EQ.printSelectedAddReceipt()">طباعة سند للمحدد</button></div>
      <div class="eq-scroll"><table><thead><tr><th><input type="checkbox" id="eq-chk-all-in" aria-label="تحديد الكل" onchange="EQ.toggleAllIn(this.checked)"></th><th>#</th><th>التاريخ</th><th>الصنف</th><th>الوحدة</th><th>الكمية</th><th>المورد</th><th>ملاحظات</th><th></th></tr></thead><tbody id="eq-in-tbody"></tbody></table></div>
    </div>
  </div>

  <!-- الصرف -->
  <div class="eq-page" id="eq-page-out">
    <div class="card eq-form" id="eq-form-out">
      <h3>${ico('outbox')}<span id="eq-out-title">صرف من المخزون</span></h3>
      <div class="eq-edit-note" id="eq-out-note"></div>
      <div class="eq-grid">
        <div class="field"><label for="eq-out-date">التاريخ <i>*</i></label><input class="inp" type="date" id="eq-out-date"></div>
        <div class="field wide"><label for="eq-out-name">الصنف <i>*</i></label><select class="inp" id="eq-out-name" onchange="EQ.updateOutInfo()"><option value="">— اختر —</option></select></div>
        <div class="field"><label for="eq-out-unit">الوحدة</label><input class="inp" type="text" id="eq-out-unit" readonly tabindex="-1"></div>
        <div class="field"><label for="eq-out-balance">الرصيد المتاح</label><input class="inp num" type="text" id="eq-out-balance" readonly tabindex="-1"></div>
        <div class="field"><label for="eq-out-qty">الكمية المصروفة <i>*</i></label><input class="inp num" type="number" id="eq-out-qty" placeholder="0" min="1" inputmode="numeric"></div>
        <div class="field wide"><label for="eq-out-dept">الجهة المستلمة <i>*</i></label><input class="inp" type="text" id="eq-out-dept" placeholder="سجن خانيونس" list="eq-dept-dl"><datalist id="eq-dept-dl"></datalist></div>
        <div class="field wide"><label for="eq-out-notes">ملاحظات</label><input class="inp" type="text" id="eq-out-notes" placeholder="اختياري"></div>
      </div>
      <div class="eq-btns">
        <button class="btn btn-primary" id="eq-out-submit-btn" onclick="EQ.withdrawItem()">تنفيذ الصرف</button>
        <button class="btn" onclick="EQ.clearOutForm(true)">مسح الحقول</button>
        <button class="btn" id="eq-out-cancel-edit" onclick="EQ.cancelEditOut()" style="display:none">إلغاء التعديل</button>
      </div>
    </div>
    <div class="card eq-table-card">
      <div class="eq-table-head"><h3>سجل الصرف <span class="pill info num" id="eq-out-count">0</span></h3>
        <button class="btn btn-sm" id="eq-print-sel" onclick="EQ.printSelectedReceipt()">طباعة سند للمحدد</button></div>
      <div class="eq-scroll"><table><thead><tr><th><input type="checkbox" id="eq-chk-all" aria-label="تحديد الكل" onchange="EQ.toggleAll(this.checked)"></th><th>#</th><th>التاريخ</th><th>الصنف</th><th>الوحدة</th><th>الكمية</th><th>الجهة</th><th>ملاحظات</th><th></th></tr></thead><tbody id="eq-out-tbody"></tbody></table></div>
    </div>
  </div>

  <!-- لوحة المخزون -->
  <div class="eq-page" id="eq-page-stock">
    <div id="eq-low-alert" class="eq-alert"></div>
    <div class="eq-kpis">
      <div class="card kpi"><small>إجمالي الأصناف</small><b class="num" id="eq-kpi-items">-</b></div>
      <div class="card kpi in"><small>إجمالي الوارد</small><b class="num" id="eq-kpi-in">-</b></div>
      <div class="card kpi out"><small>إجمالي الصادر</small><b class="num" id="eq-kpi-out">-</b></div>
      <div class="card kpi bal"><small>الرصيد الكلي</small><b class="num" id="eq-kpi-bal">-</b></div>
      <button class="card kpi low" onclick="EQ.filterLow()" style="text-align:start"><small>منخفض أو نافد</small><b class="num" id="eq-kpi-low">-</b></button>
    </div>
    <div class="card eq-chart">
      <div class="eq-chart-top"><h3>الإحصائيات البيانية</h3>
        <div class="seg" role="group">
          <button class="chart-tab" aria-pressed="true" onclick="EQ.showChart('balance',this)">الرصيد</button>
          <button class="chart-tab" aria-pressed="false" onclick="EQ.showChart('in',this)">الوارد</button>
          <button class="chart-tab" aria-pressed="false" onclick="EQ.showChart('out',this)">الصادر</button>
        </div></div>
      <div class="chart-wrap"><canvas id="eq-stockChart" aria-label="رسم بياني للمخزون"></canvas></div>
    </div>
    <div class="eq-stock-tools">
      <select class="inp" id="eq-stock-filter" onchange="EQ.renderStockTable()">
        <option value="all">كل الأصناف</option><option value="ok">متوفر</option><option value="low">منخفض</option><option value="out">نافد</option>
      </select>
      <button class="btn btn-sm btn-primary" onclick="EQ.switchTab('in')">إضافة صنف</button>
    </div>
    <div class="card eq-table-card">
      <div class="eq-table-head"><h3>تفاصيل المخزون <span class="pill info num" id="eq-stock-count">0</span></h3></div>
      <div class="eq-scroll"><table><thead><tr><th>#</th><th>الصنف</th><th>الوحدة</th><th>الوارد</th><th>الصادر</th><th>الرصيد</th><th>الحالة</th></tr></thead><tbody id="eq-stock-tbody"></tbody></table></div>
    </div>
  </div>`;
}

/* ---------- الفلترة ---------- */
function applyGlobalFilter(){
  gfItem = $id('gf-item').value.trim(); gfFrom = $id('gf-from').value; gfTo = $id('gf-to').value; gfDept = $id('gf-dept').value;
  $id('gf-label').classList.toggle('on', !!(gfItem || gfFrom || gfTo || gfDept));
  renderInTable(); renderOutTable(); renderStockTable();
}
function clearGlobalFilter(){
  ['gf-item','gf-from','gf-to','gf-dept'].forEach(id => $id(id).value = '');
  gfItem = gfFrom = gfTo = gfDept = '';
  $id('gf-label').classList.remove('on');
  renderInTable(); renderOutTable(); renderStockTable();
  vib(8);
}
function filterAdd(){ return additions.filter(r => { if (gfItem && !r.name.includes(gfItem)) return false; if (!inRange(r.date, gfFrom, gfTo)) return false; return true; }); }
function filterOut(){ return withdrawals.filter(r => { if (gfItem && !r.name.includes(gfItem)) return false; if (!inRange(r.date, gfFrom, gfTo)) return false; if (gfDept && r.dept !== gfDept) return false; return true; }); }

/* ---------- الجداول ---------- */
function renderInTable(){
  const rows = filterAdd();
  $id('in-count').textContent = num(rows.length); $id('in-count2').textContent = num(additions.length);
  const tbody = $id('in-tbody');
  const chkAll = $id('chk-all-in'); if (chkAll) chkAll.checked = false; updateSelCountIn();
  if (!rows.length){ tbody.innerHTML = `<tr><td colspan="9" class="eq-empty">${additions.length ? 'لا توجد نتائج مطابقة للفلتر.' : 'لا توجد إضافات بعد. أضف أول صنف من النموذج أعلاه.'}</td></tr>`; return; }
  tbody.innerHTML = [...rows].reverse().map((r, i) => {
    const idx = additions.indexOf(r);
    const cls = idx === editingAddIndex ? 'row-edit' : idx === flashIdx.in ? 'row-new' : '';
    return `<tr class="${cls}">
      <td><input type="checkbox" class="in-chk" data-idx="${idx}" aria-label="تحديد" onchange="EQ.updateSelCountIn()"></td>
      <td class="n num">${num(rows.length - i)}</td><td class="num">${fmtDate(r.date)}</td><td><strong>${esc(r.name)}</strong></td><td>${esc(r.unit)}</td>
      <td class="qty-in num">+${num(r.qty)}</td><td>${esc(r.supplier) || '—'}</td><td class="muted">${esc(r.notes) || '—'}</td>
      <td><div class="acts"><button class="ib" title="طباعة سند إدخال (يجمع كل ما أُضيف من نفس المورد بنفس التاريخ)" aria-label="طباعة سند" onclick="EQ.printAddReceipt(${idx})">🖨</button>
        <button class="ib" title="تعديل" aria-label="تعديل" onclick="EQ.editAdd(${idx})">✏️</button><button class="ib del" title="حذف" aria-label="حذف" onclick="EQ.delAdd(${idx})">🗑</button></div></td></tr>`;
  }).join('');
  flashIdx.in = null;
}
function renderOutTable(){
  const rows = filterOut();
  $id('out-count').textContent = num(rows.length); $id('out-count2').textContent = num(withdrawals.length);
  const tbody = $id('out-tbody');
  $id('chk-all').checked = false; updateSelCount();
  if (!rows.length){ tbody.innerHTML = `<tr><td colspan="9" class="eq-empty">${withdrawals.length ? 'لا توجد نتائج مطابقة للفلتر.' : 'لا يوجد صرف بعد. اختر صنفاً من النموذج أعلاه.'}</td></tr>`; return; }
  tbody.innerHTML = [...rows].reverse().map((r, i) => {
    const idx = withdrawals.indexOf(r);
    const cls = idx === editingOutIndex ? 'row-edit' : idx === flashIdx.out ? 'row-new' : '';
    return `<tr class="${cls}">
      <td><input type="checkbox" class="out-chk" data-idx="${idx}" aria-label="تحديد" onchange="EQ.updateSelCount()"></td>
      <td class="n num">${num(rows.length - i)}</td><td class="num">${fmtDate(r.date)}</td><td><strong>${esc(r.name)}</strong></td><td>${esc(r.unit)}</td>
      <td class="qty-out num">-${num(r.qty)}</td><td>${esc(r.dept) || '—'}</td><td class="muted">${esc(r.notes) || '—'}</td>
      <td><div class="acts"><button class="ib" title="طباعة سند (يجمع كل ما صُرف لنفس الجهة بنفس التاريخ)" aria-label="طباعة سند" onclick="EQ.printReceipt(${idx})">🖨</button>
        <button class="ib" title="تعديل" aria-label="تعديل" onclick="EQ.editOut(${idx})">✏️</button><button class="ib del" title="حذف" aria-label="حذف" onclick="EQ.delOut(${idx})">🗑</button></div></td></tr>`;
  }).join('');
  flashIdx.out = null;
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
  const low = full.filter(r => r.balance < LOW).length;
  $id('kpi-items').textContent = num(full.length); $id('kpi-in').textContent = num(tIn); $id('kpi-out').textContent = num(tOut);
  $id('kpi-bal').textContent = num(tIn - tOut); $id('kpi-low').textContent = num(low);
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
function filterLow(){ $id('stock-filter').value = 'low'; renderStockTable(); vib(8); }

/* ---------- الرسم البياني ---------- */
function isVisible(){ const p = document.getElementById('page-equipment'); return p && p.classList.contains('active'); }
function cssVar(n){ return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
function showChart(type, btn){
  currentChartType = type; vib(6);
  document.querySelectorAll('#page-equipment .chart-tab').forEach(t => t.setAttribute('aria-pressed', t === btn));
  renderChart(type);
}
function renderChart(type){
  if (typeof Chart === 'undefined'){ return; }
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

/* ---------- الإضافة ---------- */
function markInvalid(id, title, msg){
  const el = $id(id); el.classList.remove('invalid'); void el.offsetWidth; el.classList.add('invalid'); el.focus();
  el.addEventListener('input', () => el.classList.remove('invalid'), { once:true });
  el.addEventListener('change', () => el.classList.remove('invalid'), { once:true });
  notify({ type:'error', title, msg, log:false });
}
function addItem(){
  const date = $id('in-date').value, name = $id('in-name').value.trim(), unit = $id('in-unit').value;
  const qty = parseInt($id('in-qty').value, 10), supplier = $id('in-supplier').value.trim(), notes = $id('in-notes').value.trim();
  if (!date) return markInvalid('in-date', 'التاريخ مطلوب', 'حدّد تاريخ استلام الصنف.');
  if (!name) return markInvalid('in-name', 'اسم الصنف مطلوب', 'اكتب اسم الصنف أو اختره من الاقتراحات.');
  if (!qty || qty < 1) return markInvalid('in-qty', 'الكمية غير صحيحة', 'أدخل رقماً صحيحاً أكبر من صفر.');
  const rec = { date, name, unit, qty, supplier, notes };
  if (editingAddIndex !== null){
    const trial = additions.slice(); trial[editingAddIndex] = rec;
    const neg = negativeAfter(trial, withdrawals);
    if (neg.length) return notify({ type:'error', title:'لا يمكن حفظ هذا التعديل', msg:`رصيد «${neg[0].name}» يصبح ${num(neg[0].balance)} لأن المصروف منه أكثر. عدّل سجلات الصرف أولاً أو زِد الكمية.` });
    additions[editingAddIndex] = rec; flashIdx.in = editingAddIndex;
    finishEditAdd();
    notify({ type:'success', title:'تم حفظ التعديل', msg:`${name} — ${num(qty)} ${unit}`, page:'equipment' });
  } else {
    additions.push(rec); flashIdx.in = additions.length - 1;
    const bal = computeStock().find(s => s.key === stockKey(name, unit));
    notify({ type:'success', title:`تمت إضافة ${num(qty)} ${unit} من ${name}`, msg:`الرصيد الحالي: ${num(bal ? bal.balance : qty)} ${unit}`, page:'equipment' });
  }
  saveData(); populateDropdowns(); renderInTable(); renderStockTable();
  clearInForm(); $id('in-name').focus();
}
function editAdd(i){
  const r = additions[i]; if (!r) return;
  if (editingOutIndex !== null) cancelEditOut(true);
  switchTab('in', true);
  $id('in-date').value = r.date; $id('in-name').value = r.name; $id('in-unit').value = r.unit; $id('in-qty').value = r.qty;
  $id('in-supplier').value = r.supplier || ''; $id('in-notes').value = r.notes || '';
  editingAddIndex = i;
  $id('form-in').classList.add('editing'); $id('in-title').textContent = 'تعديل إضافة';
  $id('in-note').textContent = `تعدّل إضافة «${r.name}» بتاريخ ${fmtDate(r.date)}. اضغط «حفظ التعديل» أو «إلغاء التعديل».`;
  $id('in-submit-btn').textContent = 'حفظ التعديل'; $id('in-cancel-edit').style.display = ''; $id('in-clear').style.display = 'none';
  renderInTable(); scrollToForm('in'); vib(10);
}
function finishEditAdd(){
  editingAddIndex = null;
  $id('form-in').classList.remove('editing'); $id('in-title').textContent = 'إضافة صنف للمخزون';
  $id('in-submit-btn').textContent = 'إضافة للمخزون'; $id('in-cancel-edit').style.display = 'none'; $id('in-clear').style.display = '';
}
function cancelEditAdd(silent){
  const was = editingAddIndex !== null;
  finishEditAdd(); clearInForm(); renderInTable();
  if (was && silent !== true) notify({ type:'info', title:'تم إلغاء التعديل', msg:'لم يتغيّر السجل.', log:false, duration:2500 });
}
function clearInForm(user){ ['in-name','in-qty','in-supplier','in-notes'].forEach(id => $id(id).value = ''); if (user === true) vib(6); }

/* ---------- الصرف ---------- */
function withdrawItem(){
  const date = $id('out-date').value, sel = $id('out-name'), opt = sel.options[sel.selectedIndex], key = sel.value;
  const name = opt ? (opt.dataset.name || '') : '', unit = $id('out-unit').value;
  const qty = parseInt($id('out-qty').value, 10), dept = $id('out-dept').value.trim(), notes = $id('out-notes').value.trim();
  if (!date) return markInvalid('out-date', 'التاريخ مطلوب', 'حدّد تاريخ الصرف.');
  if (!key || !name) return markInvalid('out-name', 'اختر الصنف', 'اختر الصنف المراد صرفه من القائمة.');
  if (!qty || qty < 1) return markInvalid('out-qty', 'الكمية غير صحيحة', 'أدخل رقماً صحيحاً أكبر من صفر.');
  if (!dept) return markInvalid('out-dept', 'الجهة المستلمة مطلوبة', 'اكتب الجهة ليظهر اسمها على سند الصرف.');
  const item = computeStock().find(s => s.key === key);
  let available = item ? item.balance : 0;
  if (editingOutIndex !== null){ const orig = withdrawals[editingOutIndex]; if (orig && stockKey(orig.name, orig.unit) === key) available += orig.qty; }
  if (qty > available) return markInvalid('out-qty', 'الكمية أكبر من الرصيد', `المتاح من «${name}» ${num(Math.max(available, 0))} ${unit} فقط.`);
  const rec = { date, name, unit, qty, dept, notes };
  let idx;
  if (editingOutIndex !== null){
    withdrawals[editingOutIndex] = rec; idx = editingOutIndex;
    finishEditOut();
    notify({ type:'success', title:'تم حفظ التعديل', msg:`${name} — ${num(qty)} ${unit} إلى ${dept}`, page:'equipment' });
  } else {
    withdrawals.push(rec); idx = withdrawals.length - 1;
    const left = available - qty;
    notify({ type: left <= 0 ? 'warning' : 'success', title:`تم صرف ${num(qty)} ${unit} من ${name}`,
      msg:`إلى ${dept}. ${left <= 0 ? 'نفد الصنف من المخزون.' : left < LOW ? 'الرصيد المتبقي منخفض: ' + num(left) + ' ' + unit + '.' : 'المتبقي: ' + num(left) + ' ' + unit + '.'}`,
      action:{ label:'طباعة السند', fn:() => printReceipt(idx) }, page:'equipment', duration:7000 });
  }
  flashIdx.out = idx;
  saveData(); populateDropdowns(); renderOutTable(); renderStockTable();
  clearOutForm();
}
function editOut(i){
  const r = withdrawals[i]; if (!r) return;
  if (editingAddIndex !== null) cancelEditAdd(true);
  switchTab('out', true);
  $id('out-date').value = r.date;
  const key = stockKey(r.name, r.unit); $id('out-name').value = key; updateOutInfo();
  $id('out-qty').value = r.qty; $id('out-dept').value = r.dept || ''; $id('out-notes').value = r.notes || '';
  editingOutIndex = i;
  const bal = computeStock().find(s => s.key === key);
  if (bal) $id('out-balance').value = `${num(bal.balance + r.qty)} ${r.unit} (مع كمية هذا السجل)`;
  $id('form-out').classList.add('editing'); $id('out-title').textContent = 'تعديل صرف';
  $id('out-note').textContent = `تعدّل صرف «${r.name}» إلى ${r.dept || '—'} بتاريخ ${fmtDate(r.date)}.`;
  $id('out-submit-btn').textContent = 'حفظ التعديل'; $id('out-cancel-edit').style.display = '';
  renderOutTable(); scrollToForm('out'); vib(10);
}
function finishEditOut(){
  editingOutIndex = null;
  $id('form-out').classList.remove('editing'); $id('out-title').textContent = 'صرف من المخزون';
  $id('out-submit-btn').textContent = 'تنفيذ الصرف'; $id('out-cancel-edit').style.display = 'none';
}
function cancelEditOut(silent){
  const was = editingOutIndex !== null;
  finishEditOut(); clearOutForm(); renderOutTable();
  if (was && silent !== true) notify({ type:'info', title:'تم إلغاء التعديل', msg:'لم يتغيّر السجل.', log:false, duration:2500 });
}
function clearOutForm(user){ ['out-name','out-qty','out-dept','out-notes','out-unit','out-balance'].forEach(id => $id(id).value = ''); $id('out-balance').className = 'inp num'; if (user === true) vib(6); }

/* ---------- الحذف (مع تأكيد وتراجع) ---------- */
async function delAdd(i){
  const r = additions[i]; if (!r) return;
  const trial = additions.filter((_, k) => k !== i);
  const neg = negativeAfter(trial, withdrawals);
  if (neg.length) return notify({ type:'error', title:'لا يمكن حذف هذه الإضافة', msg:`صُرف من «${r.name}» أكثر مما سيبقى، فيصبح الرصيد ${num(neg[0].balance)}. احذف أو عدّل سجلات الصرف المرتبطة أولاً.` });
  const ok = await confirmD({ title:'حذف هذه الإضافة؟', msg:`${r.name} — ${num(r.qty)} ${r.unit} بتاريخ ${fmtDate(r.date)}. ينقص الرصيد بنفس الكمية.`, okText:'حذف', danger:true });
  if (!ok) return;
  if (editingAddIndex === i) cancelEditAdd(true); else if (editingAddIndex !== null && editingAddIndex > i) editingAddIndex--;
  additions.splice(i, 1);
  saveData(); populateDropdowns(); renderInTable(); renderStockTable();
  notify({ type:'success', title:'تم حذف الإضافة', msg:`${r.name} — ${num(r.qty)} ${r.unit}`, page:'equipment',
    action:{ label:'تراجع', fn:() => { additions.splice(i, 0, r); flashIdx.in = i; saveData(); populateDropdowns(); renderInTable(); renderStockTable(); notify({ type:'info', title:'تمت استعادة السجل المحذوف', log:false }); } }, duration:8000 });
}
async function delOut(i){
  const r = withdrawals[i]; if (!r) return;
  const ok = await confirmD({ title:'حذف هذا الصرف؟', msg:`${r.name} — ${num(r.qty)} ${r.unit} إلى ${r.dept || '—'}. تعود الكمية للرصيد.`, okText:'حذف', danger:true });
  if (!ok) return;
  if (editingOutIndex === i) cancelEditOut(true); else if (editingOutIndex !== null && editingOutIndex > i) editingOutIndex--;
  withdrawals.splice(i, 1);
  saveData(); populateDropdowns(); renderOutTable(); renderStockTable();
  notify({ type:'success', title:'تم حذف الصرف', msg:`عادت ${num(r.qty)} ${r.unit} من «${r.name}» للرصيد.`, page:'equipment',
    action:{ label:'تراجع', fn:() => { withdrawals.splice(i, 0, r); flashIdx.out = i; saveData(); populateDropdowns(); renderOutTable(); renderStockTable(); notify({ type:'info', title:'تمت استعادة السجل المحذوف', log:false }); } }, duration:8000 });
}

/* ---------- طباعة سند صرف ---------- */
/* ---------- سندات الإضافة ---------- */
function getSelectedAddIndices(){ return Array.from(document.querySelectorAll('#page-equipment .in-chk')).filter(c => c.checked).map(c => parseInt(c.dataset.idx, 10)); }
function updateSelCountIn(){
  const n = getSelectedAddIndices().length, b = $id('print-sel-in');
  if (b){ b.textContent = n ? `طباعة سند للمحدد (${num(n)})` : 'طباعة سند للمحدد'; b.classList.toggle('btn-primary', n > 0); }
}
function toggleAllIn(on){ document.querySelectorAll('#page-equipment .in-chk').forEach(c => c.checked = on); updateSelCountIn(); vib(6); }
function printSelectedAddReceipt(){
  const idx = getSelectedAddIndices();
  if (!idx.length) return notify({ type:'warning', title:'لم تحدد أي صف', msg:'علّم مربع الاختيار بجانب الأصناف المطلوبة، ثم اضغط الطباعة.', log:false });
  printCombinedAddReceipt(idx);
}
function printAddReceipt(i){
  const r = additions[i]; if (!r) return;
  const groupIdx = additions.map((x, idx) => idx).filter(idx => (additions[idx].supplier || '') === (r.supplier || '') && additions[idx].date === r.date);
  printCombinedAddReceipt(groupIdx);
}
function printCombinedAddReceipt(indices){
  const rows = indices.map(i => additions[i]).filter(Boolean);
  if (!rows.length) return;
  const bySup = {};
  rows.forEach(r => { const k = r.supplier || '—'; (bySup[k] = bySup[k] || []).push(r); });
  const sups = Object.keys(bySup);
  const sections = sups.map(sup => {
    const items = bySup[sup];
    const multiDate = new Set(items.map(r => r.date)).size > 1;
    const total = items.reduce((a, r) => a + (+r.qty || 0), 0);
    return `
    <table><tr><th>المورد / الجهة المورِّدة</th><td>${esc(sup)}</td><th>${multiDate ? 'عدة تواريخ' : 'التاريخ'}</th><td>${multiDate ? '—' : fmtDate(items[0].date)}</td></tr></table>
    <table style="margin-top:10px"><thead><tr><th>#</th><th>الصنف</th><th>الوحدة</th><th>الكمية</th>${multiDate ? '<th>التاريخ</th>' : ''}<th>ملاحظات</th></tr></thead>
      <tbody>${items.map((it, n) => `<tr><td>${n + 1}</td><td>${esc(it.name)}</td><td>${esc(it.unit)}</td><td>${it.qty}</td>${multiDate ? `<td>${fmtDate(it.date)}</td>` : ''}<td>${esc(it.notes) || '—'}</td></tr>`).join('')}
      <tr><td colspan="${multiDate ? 4 : 3}" style="text-align:left;font-weight:bold">إجمالي الكميات</td><td colspan="2" style="font-weight:bold">${total}</td></tr></tbody></table>
    <p style="margin-top:20px;font-size:.9rem">أقر أنا الموقع أدناه بإدخال الأصناف الموضحة أعلاه إلى المخزون بحالة سليمة ومطابقة للكميات المذكورة.</p>
    <div class="sig"><div>توقيع المورِّد</div><div>توقيع أمين المخزن</div></div>
    <div style="page-break-after:always"></div>`;
  }).join('');
  const ok = openPrintWindow(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>سند إدخال للمخزون</title>
  <style>body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;padding:40px;color:#111}
  h1{text-align:center;font-size:1.3rem;border-bottom:2px solid #333;padding-bottom:12px;margin-bottom:20px}
  table{width:100%;border-collapse:collapse}td,th{border:1px solid #999;padding:8px 10px;text-align:right;font-size:.9rem}th{background:#eee}
  .sig{margin-top:50px;display:flex;justify-content:space-between}.sig div{width:40%;text-align:center;border-top:1px solid #333;padding-top:8px}</style></head><body>
  ${window.App ? App.letterheadHTML() : ''}<h1>سند إدخال للمخزون</h1>${sections}
  <script>window.onload=()=>window.print();<\/script></body></html>`);
  if (ok) notify({ type:'info', title:'تم تجهيز سند الإدخال', msg:`${num(rows.length)} صنف من ${sups.length > 1 ? num(sups.length) + ' موردين (سند لكل مورد)' : sups[0]}.`, log:false });
}

function getSelectedOutIndices(){ return Array.from(document.querySelectorAll('#page-equipment .out-chk')).filter(c => c.checked).map(c => parseInt(c.dataset.idx, 10)); }
function updateSelCount(){
  const n = getSelectedOutIndices().length, b = $id('print-sel');
  if (b){ b.textContent = n ? `طباعة سند للمحدد (${num(n)})` : 'طباعة سند للمحدد'; b.classList.toggle('btn-primary', n > 0); }
}
function toggleAll(on){ document.querySelectorAll('#page-equipment .out-chk').forEach(c => c.checked = on); updateSelCount(); vib(6); }
function printSelectedReceipt(){
  const idx = getSelectedOutIndices();
  if (!idx.length) return notify({ type:'warning', title:'لم تحدد أي صف', msg:'علّم مربع الاختيار بجانب الأصناف المطلوبة، ثم اضغط الطباعة.', log:false });
  printCombinedReceipt(idx);
}
function printReceipt(i){
  const r = withdrawals[i]; if (!r) return;
  const groupIdx = withdrawals.map((x, idx) => idx).filter(idx => withdrawals[idx].dept === r.dept && withdrawals[idx].date === r.date);
  printCombinedReceipt(groupIdx);
}
function openPrintWindow(html, title){
  const w = window.open('', '_blank');
  if (!w){ notify({ type:'error', title:'المتصفح منع نافذة الطباعة', msg:'اسمح بالنوافذ المنبثقة لهذا الموقع ثم أعد المحاولة.' }); return false; }
  w.document.write(html); w.document.close();
  return true;
}
function printCombinedReceipt(indices){
  const rows = indices.map(i => withdrawals[i]).filter(Boolean);
  if (!rows.length) return;
  const byDept = {};
  rows.forEach(r => { (byDept[r.dept || '—'] = byDept[r.dept || '—'] || []).push(r); });
  const depts = Object.keys(byDept);
  const multiDate = new Set(rows.map(r => r.date)).size > 1;
  const sections = depts.map(dept => {
    const items = byDept[dept];
    return `
    <table><tr><th>الجهة المستلمة</th><td>${esc(dept)}</td><th>${multiDate ? 'عدة تواريخ' : 'التاريخ'}</th><td>${multiDate ? '—' : fmtDate(items[0].date)}</td></tr></table>
    <table style="margin-top:10px"><thead><tr><th>#</th><th>الصنف</th><th>الوحدة</th><th>الكمية</th>${multiDate ? '<th>التاريخ</th>' : ''}<th>ملاحظات</th></tr></thead>
      <tbody>${items.map((it, n) => `<tr><td>${n + 1}</td><td>${esc(it.name)}</td><td>${esc(it.unit)}</td><td>${it.qty}</td>${multiDate ? `<td>${fmtDate(it.date)}</td>` : ''}<td>${esc(it.notes) || '—'}</td></tr>`).join('')}</tbody></table>
    <p style="margin-top:20px;font-size:.9rem">أقر أنا الموقع أدناه باستلام الأصناف الموضحة أعلاه بحالة سليمة.</p>
    <div class="sig"><div>توقيع المستلم</div><div>توقيع أمين المخزن</div></div>
    <div style="page-break-after:always"></div>`;
  }).join('');
  const ok = openPrintWindow(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>سند صرف من المخزون</title>
  <style>body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;padding:40px;color:#111}
  h1{text-align:center;font-size:1.3rem;border-bottom:2px solid #333;padding-bottom:12px;margin-bottom:20px}
  table{width:100%;border-collapse:collapse}td,th{border:1px solid #999;padding:8px 10px;text-align:right;font-size:.9rem}th{background:#eee}
  .sig{margin-top:50px;display:flex;justify-content:space-between}.sig div{width:40%;text-align:center;border-top:1px solid #333;padding-top:8px}</style></head><body>
  ${window.App ? App.letterheadHTML() : ''}<h1>سند صرف من المخزون</h1>${sections}
  <script>window.onload=()=>window.print();<\/script></body></html>`);
  if (ok) notify({ type:'info', title:'تم تجهيز سند الصرف', msg:`${num(rows.length)} صنف لـ${depts.length > 1 ? num(depts.length) + ' جهات (سند لكل جهة)' : ' ' + depts[0]}.`, log:false });
}

/* ---------- القوائم المنسدلة ---------- */
function populateDropdowns(){
  const stock = computeStock(), sel = $id('out-name'), cur = sel.value;
  sel.innerHTML = '<option value="">— اختر —</option>';
  stock.slice().sort((a, b) => a.name.localeCompare(b.name, 'ar')).forEach(s => {
    const o = document.createElement('option');
    o.value = s.key; o.textContent = `${s.name} — ${s.unit || '—'}  (رصيد: ${s.balance} ${s.unit})`;
    o.dataset.name = s.name; o.dataset.unit = s.unit; o.dataset.bal = s.balance;
    if (s.balance <= 0) o.textContent += ' — نافد';
    sel.appendChild(o);
  });
  if (cur) sel.value = cur;
  const dl = $id('items-dl'); dl.innerHTML = '';
  [...new Set(stock.map(s => s.name))].forEach(n => { const o = document.createElement('option'); o.value = n; dl.appendChild(o); });
  const sup = $id('sup-dl'); sup.innerHTML = '';
  [...new Set(['إمداد الداخلية','الصليب', ...additions.map(r => r.supplier).filter(Boolean)])].forEach(n => { const o = document.createElement('option'); o.value = n; sup.appendChild(o); });
  const depts = [...new Set([...DEFAULT_DEPTS, ...withdrawals.map(r => r.dept).filter(Boolean)])];
  const ddl = $id('dept-dl'); ddl.innerHTML = ''; depts.forEach(n => { const o = document.createElement('option'); o.value = n; ddl.appendChild(o); });
  const gd = $id('gf-dept'), gcur = gd.value;
  gd.innerHTML = '<option value="">كل الجهات</option>' + depts.map(d => `<option>${esc(d)}</option>`).join('');
  gd.value = gcur;
}
function updateOutInfo(){
  const sel = $id('out-name'), opt = sel.options[sel.selectedIndex];
  $id('out-unit').value = (opt && opt.dataset.unit) || '';
  const b = opt && opt.dataset.bal !== undefined ? +opt.dataset.bal : null;
  $id('out-balance').value = b !== null ? `${num(b)} ${opt.dataset.unit || ''}` : '';
  $id('out-balance').className = 'inp num ' + (b === null ? '' : balClass(b));
  if (b !== null && b <= 0 && editingOutIndex === null) notify({ type:'warning', title:'هذا الصنف نافد', msg:'أضف كمية جديدة من تبويب الإضافة قبل الصرف.', log:false, action:{ label:'إضافة كمية', fn:() => { switchTab('in'); $id('in-name').value = opt.dataset.name; $id('in-unit').value = opt.dataset.unit || $id('in-unit').value; $id('in-qty').focus(); } } });
}

/* ---------- التصدير ---------- */
function exportExcel(){
  vib(10);
  if (typeof XLSX === 'undefined') return notify({ type:'error', title:'مكتبة Excel غير محمّلة', msg:'أعد تحميل التطبيق ثم حاول مجدداً.' });
  try {
    const wb = XLSX.utils.book_new();
    const addData = [['التاريخ','اسم الصنف','الوحدة','الكمية','المورد','ملاحظات']];
    additions.forEach(r => addData.push([r.date, r.name, r.unit, r.qty, r.supplier, r.notes]));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(addData), 'الإضافات');
    const outData = [['التاريخ','اسم الصنف','الوحدة','الكمية','الجهة المستلمة','ملاحظات']];
    withdrawals.forEach(r => outData.push([r.date, r.name, r.unit, r.qty, r.dept, r.notes]));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(outData), 'الصرف');
    const stData = [['اسم الصنف','الوحدة','الوارد','الصادر','الرصيد','الحالة']];
    computeStock().forEach(r => stData.push([r.name, r.unit, r.totalIn, r.totalOut, r.balance, r.balance <= 0 ? 'نافد' : r.balance < LOW ? 'منخفض' : 'متوفر']));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(stData), 'المخزون');
    const fname = 'مخزون_المعدات_' + today() + '.xlsx';
    const buf = XLSX.write(wb, { bookType:'xlsx', type:'array' });
    const url = URL.createObjectURL(new Blob([buf], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    const a = document.createElement('a'); a.href = url; a.download = fname; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    notify({ type:'success', title:'تم تصدير ملف Excel', msg:`٣ أوراق: الإضافات والصرف والمخزون — تجده في مجلد التنزيلات.` });
  } catch(e){ notify({ type:'error', title:'تعذّر تصدير Excel', msg:'السبب: ' + e.message }); }
}
function exportPDF(){
  vib(10);
  const stock = computeStock(), now = new Date().toLocaleDateString('ar-EG');
  const tIn = stock.reduce((a, r) => a + r.totalIn, 0), tOut = stock.reduce((a, r) => a + r.totalOut, 0);
  const rows = stock.map((r, i) => `<tr style="background:${i % 2 === 0 ? '#f8f9fa' : '#fff'}"><td>${i + 1}</td><td>${esc(r.name)}</td><td>${esc(r.unit) || '—'}</td>
    <td style="color:#1d6f42;font-weight:bold">${r.totalIn.toLocaleString()}</td><td style="color:#c0392b;font-weight:bold">${r.totalOut.toLocaleString()}</td>
    <td style="color:#2980b9;font-weight:bold">${r.balance.toLocaleString()}</td><td>${r.balance <= 0 ? 'نافد' : r.balance < LOW ? 'منخفض' : 'متوفر'}</td></tr>`).join('');
  const ok = openPrintWindow(`<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><title>تقرير مخزون المعدات</title>
  <style>body{font-family:Tahoma,Arial,sans-serif;direction:rtl;padding:20px}h1{text-align:center;color:#1B3B2F;font-size:1.2rem}
  .sub{text-align:center;color:#666;font-size:.82rem;margin-bottom:16px}.kpis{display:flex;gap:10px;margin-bottom:16px}
  .kpi{padding:10px 16px;border-radius:8px;text-align:center;flex:1}.kpi.g{background:#eafaf1;border:1px solid #38d9a9}.kpi.r{background:#fdecea;border:1px solid #ff6b6b}.kpi.b{background:#e8f4fd;border:1px solid #4f9cf9}
  .kv{font-size:1.3rem;font-weight:bold}.kl{font-size:.7rem;color:#666}table{width:100%;border-collapse:collapse;font-size:.8rem}
  th{background:#1B3B2F;color:#fff;padding:7px 10px;text-align:right}td{padding:6px 10px;border-bottom:1px solid #eee}@media print{body{padding:0}}</style></head><body>
  ${window.App ? App.letterheadHTML() : ''}<h1>تقرير مخزون المعدات</h1><div class="sub">تاريخ: ${now} — إجمالي الأصناف: ${stock.length}</div>
  <div class="kpis"><div class="kpi g"><div class="kv">${tIn.toLocaleString()}</div><div class="kl">إجمالي الوارد</div></div>
  <div class="kpi r"><div class="kv">${tOut.toLocaleString()}</div><div class="kl">إجمالي الصادر</div></div>
  <div class="kpi b"><div class="kv">${(tIn - tOut).toLocaleString()}</div><div class="kl">الرصيد الكلي</div></div></div>
  <table><thead><tr><th>#</th><th>الصنف</th><th>الوحدة</th><th>الوارد</th><th>الصادر</th><th>الرصيد</th><th>الحالة</th></tr></thead><tbody>${rows}</tbody></table>
  <script>window.onload=()=>window.print();<\/script></body></html>`);
  if (ok) notify({ type:'info', title:'تم تجهيز التقرير', msg:'اختر «حفظ بصيغة PDF» من نافذة الطباعة.', log:false });
}

/* استيراد نسخة من تطبيق المعدات المستقل القديم */
function importBackup(event){
  const file = event.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = async e => {
    let data;
    try { data = JSON.parse(e.target.result); } catch(err){ return notify({ type:'error', title:'تعذّرت قراءة الملف', msg:'الملف ليس بصيغة JSON أو أنه تالف.' }); }
    if (data && data.app === 'unified-admin-system') return notify({ type:'warning', title:'هذه نسخة من النظام الموحّد', msg:'استعدها من صفحة النسخ الاحتياطي، فهي تشمل كل الوحدات.', action:{ label:'النسخ الاحتياطي', fn:() => App.switchModule('backup') } });
    if (!data || !Array.isArray(data.additions) || !Array.isArray(data.withdrawals)) return notify({ type:'error', title:'الملف ليس نسخة من مخزون المعدات', msg:'اختر ملفاً نُزّل من زر «نسخة احتياطية» في تطبيق المعدات القديم.' });
    const ok = await confirmD({ title:'استبدال بيانات المعدات؟', msg:`الملف فيه ${num(data.additions.length)} إضافة و${num(data.withdrawals.length)} صرف. الحالي: ${num(additions.length)} إضافة و${num(withdrawals.length)} صرف. سيُستبدل الحالي بالكامل.`, okText:'استبدال البيانات', danger:true, icon:'inbox' });
    if (!ok) return notify({ type:'info', title:'تم إلغاء الاستيراد', msg:'لم يتغيّر شيء.', log:false });
    const prevA = additions.slice(), prevW = withdrawals.slice();
    additions.length = 0; data.additions.forEach(r => additions.push(r));
    withdrawals.length = 0; data.withdrawals.forEach(r => withdrawals.push(r));
    cancelEditAdd(true); cancelEditOut(true);
    saveData(); refreshAll();
    notify({ type:'success', title:'تم استيراد بيانات المعدات', msg:`${num(additions.length)} إضافة و${num(withdrawals.length)} صرف.`, page:'equipment', duration:9000,
      action:{ label:'تراجع', fn:() => { additions.length = 0; prevA.forEach(r => additions.push(r)); withdrawals.length = 0; prevW.forEach(r => withdrawals.push(r)); saveData(); refreshAll(); notify({ type:'info', title:'تم التراجع عن الاستيراد', log:false }); } } });
  };
  reader.readAsText(file);
  event.target.value = '';
}

/* ---------- التبويبات ---------- */
function scrollToForm(t){ const f = $id('form-' + t); if (f && f.scrollIntoView) f.scrollIntoView({ behavior:'smooth', block:'start' }); setTimeout(() => $id(t === 'in' ? 'in-qty' : 'out-qty').focus({ preventScroll:true }), 350); }
function switchTab(id, silent){
  currentTab = id;
  ['in','out','stock'].forEach(t => {
    $id('tab-' + t).classList.toggle('active', t === id); $id('tab-' + t).setAttribute('aria-selected', t === id);
    $id('page-' + t).classList.toggle('active', t === id);
  });
  if (id === 'stock') renderStockTable();
  if (silent !== true) vib(8);
}
function refreshAll(){ populateDropdowns(); renderInTable(); renderOutTable(); renderStockTable(); }
function onShow(){ if (currentTab === 'stock') renderChart(currentChartType); }

/* ---------- التهيئة ---------- */
function init(){
  buildUI();
  loadData();
  tryReconnectFile();
  $id('in-date').value = today(); $id('out-date').value = today();
  refreshAll();
  // إعادة رسم المخطط عند تغيير الثيم
  new MutationObserver(() => { if (currentTab === 'stock' && isVisible()) renderChart(currentChartType); })
    .observe(document.documentElement, { attributes:true, attributeFilter:['data-theme'] });
}

/* ---------- تنبيهات الشاشة الرئيسية ---------- */
function alerts(){
  const s = computeStock();
  const out = s.filter(r => r.balance <= 0 && r.totalIn > 0), low = s.filter(r => r.balance > 0 && r.balance < LOW);
  const list = arr => arr.slice(0, 4).map(r => r.name).join('، ') + (arr.length > 4 ? ` و${num(arr.length - 4)} غيرها` : '');
  const res = [];
  if (out.length) res.push({ severity:'high', title: out.length === 1 ? 'صنف نافد' : `${num(out.length)} ${out.length <= 10 ? 'أصناف نافدة' : 'صنفاً نافداً'}`, subtitle:list(out), onOpen:() => { switchTab('stock', true); $id('stock-filter').value = 'out'; renderStockTable(); } });
  if (low.length) res.push({ severity:'mid', title: low.length === 1 ? 'صنف رصيده منخفض' : `${num(low.length)} ${low.length <= 10 ? 'أصناف رصيدها منخفض' : 'صنفاً رصيدها منخفض'}`, subtitle:list(low), onOpen:() => { switchTab('stock', true); $id('stock-filter').value = 'low'; renderStockTable(); } });
  return res;
}

return {
  importFromExcel, addItem, cancelEditAdd, cancelEditOut, clearGlobalFilter, clearInForm, clearOutForm, exportExcel, exportPDF, linkSaveFile,
  printSelectedReceipt, showChart, switchTab, withdrawItem, applyGlobalFilter, importBackup, renderStockTable,
  updateOutInfo, delAdd, delOut, editAdd, editOut, printReceipt, toggleAll, updateSelCount, filterLow,
  printAddReceipt, printSelectedAddReceipt, toggleAllIn, updateSelCountIn,
  computeStock, init, onShow, alerts,
  _data:{ additions, withdrawals }
};
})();

window.NotificationRegistry = window.NotificationRegistry || {};
NotificationRegistry.equipment = () => EQ.alerts();
(window.MODULE_INITS = window.MODULE_INITS || []).push(EQ.init);
