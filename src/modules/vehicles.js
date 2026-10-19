/* =====================================================================
   وحدة إدارة المركبات — VH
   البيانات: localStorage veh_v (المركبات) / veh_q (طلبات الصيانة) / veh_m (تقارير الصيانة) / veh_s (الإعدادات)
   الصور والمرفقات: IndexedDB fsdb_veh_atts — تدخل النسخة الاحتياطية عبر BACKUP_HOOKS
   الوحدة مستقلة تماماً: لا تقرأ ولا تكتب بيانات أي وحدة أخرى.
   ===================================================================== */
const VH = (function(){
'use strict';
const K_V = 'veh_v', K_Q = 'veh_q', K_M = 'veh_m', K_S = 'veh_s';

/* ---------- الثوابت ---------- */
const STATUS = {
  ready:  { label:'جاهزة للعمل',      pill:'ok'   },
  needs:  { label:'تحتاج إلى صيانة',  pill:'mid'  },
  under:  { label:'تحت الصيانة',      pill:'info' },
  stopped:{ label:'متوقفة عن العمل',  pill:'high' }
};
const STATUS_KEYS = Object.keys(STATUS);
// حالات طلب الصيانة — المكتملة والملغاة «مغلقة»، والباقي مفتوح
const REQ_STATUS = {
  new:      { label:'بلاغ جديد',          pill:'info' },
  approval: { label:'بانتظار الموافقة',   pill:'mid'  },
  pending:  { label:'بانتظار التنفيذ',    pill:'mid'  },
  progress: { label:'قيد الصيانة',        pill:'info' },
  done:     { label:'مكتملة',             pill:'ok'   },
  cancelled:{ label:'ملغاة',              pill:''     }
};
const REQ_KEYS = Object.keys(REQ_STATUS);
const isOpenReq = r => r.status !== 'done' && r.status !== 'cancelled';
const PRIORITY = {
  low:    { label:'منخفضة', pill:''     },
  normal: { label:'عادية',  pill:'info' },
  high:   { label:'مرتفعة', pill:'mid'  },
  urgent: { label:'عاجلة',  pill:'high' }
};
const PRIORITY_KEYS = Object.keys(PRIORITY);
// أنواع الصيانة قابلة للتوسع من «إدارة الأنواع» (تُحفظ في veh_s)
const DEFAULT_TYPES = ['تغيير زيت المحرك','تغيير الفلاتر','إصلاح المحرك','إصلاح نظام الفرامل','تغيير الإطارات','تركيب زجاج',
  'إصلاح نظام الكهرباء','صيانة المكيف','صيانة دورية','إصلاح أعطال ميكانيكية','إصلاح أعطال كهربائية','صيانة أخرى'];
const DEFAULT_SETTINGS = { lastBy:'', types:DEFAULT_TYPES.slice() };

/* ---------- الحالة ---------- */
let vehicles = [], requests = [], reports = [], settings = { ...DEFAULT_SETTINGS };
let view = 'dash', fileId = null, fileTab = 'info';
let fq = '', fStatus = '', showArchived = false, flashId = null;
let rq = { q:'', veh:'', status:'open', pri:'', from:'', to:'' };   // فلاتر طلبات الصيانة
let mq = { veh:'', type:'', from:'', to:'', sort:'desc' };           // فلاتر سجل الصيانة

/* ---------- أدوات ---------- */
const $id = id => document.getElementById('vh-' + id);
const notify  = (...a) => window.App ? App.notify(...a) : console.log(a);
const confirmD = o => window.App ? App.confirm(o) : Promise.resolve(window.confirm(o.title));
const vib = ms => window.App && App.vibrate(ms);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num = v => Number(Math.round((Number(v) || 0) * 100) / 100).toLocaleString('ar-EG', { maximumFractionDigits:2 });
const CUR = '₪';
const money = v => num(v) + ' ' + CUR;
const r2 = v => Math.round((Number(v) || 0) * 100) / 100;
const moneyVal = v => { const n = parseFloat(toEn(v).replace(/[,٬\s]/g, '')); return isNaN(n) ? null : n; };
function localISO(d){ return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
const todayISO = () => localISO(new Date());
function fmtDate(iso){ if (!iso) return '—'; return new Intl.DateTimeFormat('ar-EG', { year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date(iso.slice(0, 10) + 'T00:00:00')); }
function fmtDateTime(iso){ if (!iso) return '—'; return new Intl.DateTimeFormat('ar-EG', { year:'numeric', month:'2-digit', day:'2-digit', hour:'numeric', minute:'2-digit' }).format(new Date(iso)); }
const newId = p => p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
// أرقام عربية مكتوبة (٠١٢٣) ← إنجليزية، وتجاهل المسافات والشرطات في المقارنة
const toEn = s => String(s ?? '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
const normPlate = s => toEn(s).replace(/[\s\-_.\/]/g, '').toLowerCase();
const intVal = v => { const n = parseInt(toEn(v), 10); return isNaN(n) ? null : n; };
function markInvalid(el, title, msg){
  if (!el) return;
  el.classList.remove('invalid'); void el.offsetWidth; el.classList.add('invalid'); el.focus();
  const off = () => el.classList.remove('invalid');
  el.addEventListener('input', off, { once:true }); el.addEventListener('change', off, { once:true });
  if (title) notify({ type:'error', title, msg, log:false });
}
// أيقونة السيارة المسطّحة (نفسها في القائمة الجانبية)
const carIco = size => ico('vehicles', size);
// اللوحة والرقم الإداري يُعرضان من اليسار لليمين دائماً حتى لا تنقلب الشرطات في RTL
const ltr = t => t ? `<bdi dir="ltr">${esc(t)}</bdi>` : '—';

/* ---------- الترقيم: أكبر رقم موجود + 1 ---------- */
const nextNo = list => list.reduce((m, r) => Math.max(m, +r.no || 0), 0) + 1;
const vCode = n => 'VEH-' + String(n).padStart(3, '0');
const qCode = n => 'REQ-' + String(n).padStart(3, '0');
const mCode = n => 'MNT-' + String(n).padStart(3, '0');

/* ---------- الحفظ والتحميل ---------- */
function save(){
  try {
    localStorage.setItem(K_V, JSON.stringify(vehicles));
    localStorage.setItem(K_Q, JSON.stringify(requests));
    localStorage.setItem(K_M, JSON.stringify(reports));
    localStorage.setItem(K_S, JSON.stringify(settings));
  } catch(e){
    notify({ type:'error', title:'تعذّر الحفظ على الجهاز', msg: e.name === 'QuotaExceededError' ? 'مساحة التخزين في المتصفح ممتلئة. نزّل نسخة احتياطية وافرغ مساحة.' : 'السبب: ' + e.message, page:'vehicles', duration:0 });
    return false;
  }
  window.App && App.refresh();
  return true;
}
function load(){
  const read = (k, def) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v ?? def; } catch(e){ return def; } };
  vehicles = read(K_V, []); requests = read(K_Q, []); reports = read(K_M, []);
  settings = Object.assign({ ...DEFAULT_SETTINGS }, read(K_S, {}));
  if (!Array.isArray(vehicles)) vehicles = [];
  if (!Array.isArray(requests)) requests = [];
  if (!Array.isArray(reports)) reports = [];
  vehicles.forEach(v => { v.log = v.log || []; v.drivers = v.drivers || []; });
  if (!Array.isArray(settings.types) || !settings.types.length) settings.types = DEFAULT_TYPES.slice();
  requests.forEach(r => { r.history = r.history || []; r.atts = r.atts || []; });
  reports.forEach(r => { r.edits = r.edits || []; r.atts = r.atts || []; });
}

/* ---------- الصور والمرفقات (IndexedDB) ---------- */
const ATT_DB = 'fsdb_veh_atts', ATT_STORE = 'atts';
const urlCache = new Map();
function attOpen(){
  return new Promise((res, rej) => {
    const q = indexedDB.open(ATT_DB, 1);
    q.onupgradeneeded = () => { if (!q.result.objectStoreNames.contains(ATT_STORE)) q.result.createObjectStore(ATT_STORE); };
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
const attPut = (key, blob) => attTx('readwrite', st => st.put(blob, key));
const attGet = key => attTx('readonly', st => st.get(key));
const attDel = key => attTx('readwrite', st => st.delete(key));
const attKey = () => 'va_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
function b64ToBlob(dataUrl){
  const head = String(dataUrl).slice(0, 60), mime = (head.match(/^data:([^;,]+)/) || [, 'application/octet-stream'])[1];
  const bin = atob(String(dataUrl).slice(String(dataUrl).indexOf(',') + 1));
  const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return new Blob([u], { type:mime });
}
function blobToDataUrl(blob){ return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); }); }
async function attUrl(key){
  if (!key) return '';
  if (urlCache.has(key)) return urlCache.get(key);
  let blob = null; try { blob = await attGet(key); } catch(e){}
  if (!blob) return '';
  const u = URL.createObjectURL(blob); urlCache.set(key, u); return u;
}
// يحفظ ملفاً (صورة تُضغط) ويرجع وصفه {key,name,type,size}
async function storeFile(file){
  let blob = file;
  if (/^image\//.test(file.type) && window.App && App.compressImage){
    try { blob = b64ToBlob(await App.compressImage(file, 1600, 0.78)); } catch(e){ blob = file; }
  }
  const key = attKey();
  await attPut(key, blob);
  return { key, name:file.name || 'ملف', type:blob.type || file.type, size:blob.size };
}
// يملأ كل <img data-att="key"> بالصورة المخزّنة
function hydrateImages(root){
  (root || document).querySelectorAll('img[data-att]').forEach(async img => {
    const u = await attUrl(img.dataset.att);
    if (u) img.src = u; else img.closest('.vh-photo')?.classList.add('none');
  });
}
// النسخة الاحتياطية: الملفات نفسها تُضمَّن كـ dataURL وتُعاد عند الاستعادة
async function backupCollect(){
  const atts = {};
  for (const k of allAttKeys()) if (!atts[k]){ try { const b = await attGet(k); if (b) atts[k] = await blobToDataUrl(b); } catch(e){} }
  return Object.keys(atts).length ? { atts } : null;
}
async function backupApply(obj){
  if (!obj || !obj.atts) return;
  for (const [k, d] of Object.entries(obj.atts)){ try { await attPut(k, b64ToBlob(d)); } catch(e){} }
}
function allAttKeys(){
  const keys = [];
  vehicles.forEach(v => { if (v.photo) keys.push(v.photo.key); });
  [...requests, ...reports].forEach(r => (r.atts || []).forEach(a => keys.push(a.key)));
  return keys.filter(Boolean);
}

/* ---------- المنطق: المركبات ---------- */
const vById = id => vehicles.find(v => v.id === id);
const vName = v => v ? [v.make, v.model].filter(Boolean).join(' ') || v.code : '—';
const activeVehicles = () => vehicles.filter(v => !v.archived);
function logEvent(v, text, by){ v.log.push({ at:new Date().toISOString(), text, by: by || settings.lastBy || '' }); }
function statusPill(s){ const m = STATUS[s] || STATUS.ready; return `<span class="pill ${m.pill}">${m.label}</span>`; }
function plateTaken(plate, exceptId){ const p = normPlate(plate); return p && vehicles.some(v => v.id !== exceptId && normPlate(v.plate) === p); }
function matchesSearch(v, q){
  if (!q) return true;
  const t = toEn(q).toLowerCase().trim(), np = normPlate(q);
  return [v.code, v.make, v.model, v.driver, v.color].some(x => toEn(x).toLowerCase().includes(t)) || (np && normPlate(v.plate).includes(np));
}
function counts(){
  const act = activeVehicles(), c = { total:act.length };
  STATUS_KEYS.forEach(k => c[k] = act.filter(v => v.status === k).length);
  return c;
}

/* ---------- الواجهة ---------- */
const VIEWS = [['dash', 'لوحة التحكم', 'chart'], ['list', 'المركبات', 'vehicles'], ['req', 'طلبات الصيانة', 'bell'], ['mnt', 'سجل الصيانة', 'calendar'], ['rep', 'التقارير', 'checklist']];
function buildUI(){
  const root = document.getElementById('page-vehicles');
  root.removeAttribute('data-placeholder');
  root.innerHTML = `
  <div class="mk-head" style="--tint:var(--accent-soft)">
    <div class="tile">${carIco()}</div>
    <div class="grow"><h2>إدارة المركبات</h2><p>ملف لكل مركبة: بياناتها والسائق المسؤول وطلبات صيانتها وتقاريرها وتكاليفها</p></div>
    <div class="mk-tools">
      <button class="btn btn-primary" onclick="VH.openVehicleForm()">مركبة جديدة</button>
      <button class="btn" onclick="VH.openRequestForm()">طلب صيانة</button>
      <button class="btn" onclick="VH.openReportForm()">صيانة منفذة</button>
    </div>
  </div>
  <div class="mk-tabs" role="tablist" id="vh-tabs">${VIEWS.map(([v, l, i]) => `<button class="mk-tab${v === 'dash' ? ' active' : ''}" id="vh-tab-${v}" role="tab" onclick="VH.showView('${v}')">${v === 'list' ? carIco(24) : ico(i)}${l}${v === 'req' ? '<span class="badge num" id="vh-req-badge"></span>' : ''}</button>`).join('')}</div>

  <section class="mk-view active" id="vh-view-dash">
    <div id="vh-dash-urgent"></div>
    <div class="mk-kpis vh-kpis" id="vh-kpis"></div>
    <div class="mk-card mk-pad mk-section" id="vh-dash-cost"></div>
    <div class="mk-card mk-pad mk-section" id="vh-dash-alerts"></div>
    <div class="mk-card mk-pad mk-section" id="vh-dash-recent"></div>
  </section>

  <section class="mk-view" id="vh-view-list">
    <div class="mk-toolbar vh-toolbar">
      <input class="mk-inp" type="search" id="vh-q" placeholder="ابحث بالرقم الإداري أو اللوحة أو السائق أو النوع…" oninput="VH.applyFilter()">
      <select class="mk-inp" id="vh-f-status" onchange="VH.applyFilter()"><option value="">كل الحالات</option>${STATUS_KEYS.map(k => `<option value="${k}">${STATUS[k].label}</option>`).join('')}</select>
      <label class="vh-check"><input type="checkbox" id="vh-f-arch" onchange="VH.applyFilter()"> المؤرشفة</label>
    </div>
    <div class="vh-grid" id="vh-grid"></div>
  </section>

  <section class="mk-view" id="vh-view-req">
    <div class="mk-toolbar vh-toolbar">
      <input class="mk-inp" type="search" id="vh-rq-q" placeholder="ابحث برقم الطلب أو الوصف أو المُبلِّغ…" oninput="VH.applyReqFilter()">
      <select class="mk-inp" id="vh-rq-veh" onchange="VH.applyReqFilter()"></select>
      <select class="mk-inp" id="vh-rq-status" onchange="VH.applyReqFilter()"><option value="open">المفتوحة</option><option value="">كل الحالات</option>${REQ_KEYS.map(k => `<option value="${k}">${REQ_STATUS[k].label}</option>`).join('')}</select>
      <select class="mk-inp" id="vh-rq-pri" onchange="VH.applyReqFilter()"><option value="">كل الأولويات</option>${PRIORITY_KEYS.map(k => `<option value="${k}">${PRIORITY[k].label}</option>`).join('')}</select>
      <input class="mk-inp" type="date" id="vh-rq-from" title="من تاريخ" onchange="VH.applyReqFilter()">
      <input class="mk-inp" type="date" id="vh-rq-to" title="إلى تاريخ" onchange="VH.applyReqFilter()">
    </div>
    <div class="mk-card mk-table-card">
      <div class="mk-table-head"><h3>طلبات الصيانة <span class="pill info num" id="vh-rq-count">0</span></h3>
        <div class="row"><button class="btn btn-sm" onclick="VH.openTypes()">أنواع الصيانة</button><button class="btn btn-sm btn-primary" onclick="VH.openRequestForm()">طلب جديد</button></div></div>
      <div class="mk-scroll"><table class="mk-table vh-table"><thead><tr><th>الرقم</th><th>التاريخ</th><th>المركبة</th><th>النوع</th><th>الأولوية</th><th>الحالة</th><th></th></tr></thead><tbody id="vh-rq-body"></tbody></table></div>
    </div>
  </section>

  <section class="mk-view" id="vh-view-mnt">
    <div class="mk-toolbar vh-toolbar">
      <select class="mk-inp" id="vh-mq-veh" onchange="VH.applyMntFilter()"></select>
      <select class="mk-inp" id="vh-mq-type" onchange="VH.applyMntFilter()"></select>
      <input class="mk-inp" type="date" id="vh-mq-from" title="من تاريخ" onchange="VH.applyMntFilter()">
      <input class="mk-inp" type="date" id="vh-mq-to" title="إلى تاريخ" onchange="VH.applyMntFilter()">
      <button class="btn btn-sm" id="vh-mq-sort" onclick="VH.toggleMntSort()">الأحدث أولاً ↓</button>
    </div>
    <div class="mk-card mk-table-card">
      <div class="mk-table-head"><h3>سجل الصيانة المنفذة <span class="pill info num" id="vh-mq-count">0</span></h3>
        <div class="row"><span class="vh-sum">الإجمالي: <b class="num" id="vh-mq-total">0</b></span><button class="btn btn-sm btn-primary" onclick="VH.openReportForm()">تسجيل صيانة</button></div></div>
      <div class="mk-scroll"><table class="mk-table vh-table"><thead><tr><th>التقرير</th><th>التاريخ</th><th>المركبة</th><th>النوع</th><th>الورشة</th><th>العداد</th><th>الإجمالي</th><th></th></tr></thead><tbody id="vh-mq-body"></tbody></table></div>
    </div>
  </section>

  <section class="mk-view" id="vh-view-rep">
    <div class="mk-card mk-pad mk-section">
      <div class="mk-grid vh-rep-form">
        <div class="mk-field wide2"><label for="vh-rp-kind">التقرير</label><select class="mk-inp" id="vh-rp-kind" onchange="VH.syncRepForm()">${REPORTS.map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></div>
        <div class="mk-field"><label for="vh-rp-veh" id="vh-rp-veh-l">المركبة</label><select class="mk-inp" id="vh-rp-veh"></select></div>
        <div class="mk-field"><label for="vh-rp-from">من تاريخ</label><input class="mk-inp" type="date" id="vh-rp-from"></div>
        <div class="mk-field"><label for="vh-rp-to">إلى تاريخ</label><input class="mk-inp" type="date" id="vh-rp-to"></div>
        <div class="mk-field"><label for="vh-rp-status">الحالة</label><select class="mk-inp" id="vh-rp-status"></select></div>
        <div class="mk-field"><label for="vh-rp-pri">الأولوية</label><select class="mk-inp" id="vh-rp-pri"><option value="">كل الأولويات</option>${PRIORITY_KEYS.map(k => `<option value="${k}">${PRIORITY[k].label}</option>`).join('')}</select></div>
        <div class="mk-field"><label for="vh-rp-group">التجميع</label><select class="mk-inp" id="vh-rp-group"><option value="vehicle">حسب المركبة</option><option value="month">حسب الشهر</option></select></div>
      </div>
      <div class="mk-btns"><button class="btn btn-primary" onclick="VH.runReport()">عرض التقرير</button><label class="vh-check"><input type="checkbox" id="vh-rp-arch"> تشمل المؤرشفة</label></div>
    </div>
    <div id="vh-rp-out"><div class="mk-card mk-pad"><div class="vh-empty">${ico('checklist', 52)}<b>اختر التقرير واضغط «عرض التقرير»</b><p>كل التقارير محسوبة من البيانات المحفوظة فعلياً، وتقدر تطبعها أو تحفظها PDF أو تصدّرها Excel.</p></div></div></div>
  </section>

  <section class="mk-view" id="vh-view-file"></section>`;
}

function showView(v, silent){
  if (v !== 'file') fileId = null;
  view = v;
  VIEWS.forEach(([k]) => { const t = $id('tab-' + k); t.classList.toggle('active', k === v); t.setAttribute('aria-selected', k === v); });
  ['dash', 'list', 'req', 'mnt', 'rep', 'file'].forEach(k => $id('view-' + k).classList.toggle('active', k === v));
  $id('tabs').hidden = v === 'file';
  render();
  if (silent !== true) vib(8);
}
function render(){
  if (view === 'dash') renderDash();
  else if (view === 'list') renderList();
  else if (view === 'req') renderReqs();
  else if (view === 'mnt') renderMnts();
  else if (view === 'rep') renderReportsView();
  else if (view === 'file') renderFile();
  const open = requests.filter(isOpenReq), urgent = open.filter(r => r.priority === 'urgent').length, b = $id('req-badge');
  if (b){ b.textContent = open.length ? num(open.length) : ''; b.classList.toggle('show', !!open.length); b.classList.toggle('mid', !urgent); }
}

/* ---------- لوحة التحكم ---------- */
function renderDash(){
  const c = counts();
  const card = (key, label, val, cls, onclick) => `<button class="mk-card mk-kpi ${cls}" onclick="${onclick}"><small>${label}</small><b class="num">${num(val)}</b></button>`;
  $id('kpis').innerHTML =
    card('total', 'إجمالي المركبات', c.total, 'info', "VH.filterStatus('')") +
    card('ready', 'المركبات الجاهزة', c.ready, 'good', "VH.filterStatus('ready')") +
    card('needs', 'تحتاج إلى صيانة', c.needs, 'warn', "VH.filterStatus('needs')") +
    card('under', 'تحت الصيانة', c.under, '', "VH.filterStatus('under')") +
    card('stopped', 'المركبات المتوقفة', c.stopped, 'bad', "VH.filterStatus('stopped')") +
    card('open', 'طلبات الصيانة المفتوحة', requests.filter(isOpenReq).length, 'warn', "VH.filterRequests({status:'open'})") +
    card('due', 'الصيانة المستحقة', dueVehicles().size, dueVehicles().size ? 'bad' : '', "VH.showDueAlerts()");
  const pr = periodRange(costPeriod);
  $id('dash-cost').innerHTML = `<div class="vh-cost-card"><div class="grow"><small>إجمالي تكاليف الصيانة — ${esc(pr.label)}</small><b class="num">${money(costIn(pr.from, pr.to))}</b>
      <span class="muted num">${num(reports.filter(m => inRange(m.date, pr.from, pr.to)).length)} عملية صيانة</span></div>
    <div class="vh-cost-tools"><div class="mk-seg">${[['month', 'هذا الشهر'], ['prev', 'الشهر السابق'], ['year', 'هذه السنة'], ['custom', 'فترة مخصصة']].map(([k, l]) => `<button type="button" aria-pressed="${costPeriod.mode === k}" onclick="VH.setCostPeriod('${k}')">${l}</button>`).join('')}</div>
      ${costPeriod.mode === 'custom' ? `<div class="vh-cost-range"><input class="mk-inp" type="date" id="vh-cp-from" value="${costPeriod.from}" onchange="VH.setCostPeriod('custom')"><span>←</span><input class="mk-inp" type="date" id="vh-cp-to" value="${costPeriod.to}" onchange="VH.setCostPeriod('custom')"></div>` : ''}
      <button class="btn btn-sm" onclick="VH.openCostReports()">تفاصيل التكاليف</button></div></div>`;
  const al = vehicleAlerts();
  $id('dash-alerts').innerHTML = `<div class="mk-title"><span>تنبيهات الصيانة <span class="pill ${al.some(a => a.severity === 'high') ? 'high' : al.length ? 'mid' : 'ok'} num">${num(al.length)}</span></span><button class="btn btn-sm" onclick="VH.openIntervals()">الفترات الافتراضية</button></div>` +
    (al.length ? `<div class="vh-alerts">${al.map(a => { const v = vById(a.vid); return `<button class="vh-alert ${a.severity}" onclick="VH.openFile('${a.vid}')"><span class="vh-alert-dot"></span><div class="grow"><b>${esc(vName(v))} <span class="muted num">${ltr(v.code)}</span></b><span>${esc(a.title)}</span><small class="num">${a.due ? 'الاستحقاق: ' + esc(a.due) + ' · ' : ''}${esc(a.text)}</small></div><span class="pill ${a.severity === 'high' ? 'high' : 'mid'}">${a.severity === 'high' ? 'عاجل' : 'قريب'}</span></button>`; }).join('')}</div>`
      : `<p class="muted vh-ok">✓ لا توجد مواعيد مستحقة ولا طلبات عاجلة.</p>`);
  const urgent = requests.filter(r => isOpenReq(r) && r.priority === 'urgent').sort(byDateDesc);
  $id('dash-urgent').innerHTML = urgent.length ? `<div class="mk-banner bad"><div class="grow"><b>⚡ ${num(urgent.length)} ${urgent.length === 1 ? 'طلب صيانة عاجل مفتوح' : 'طلبات صيانة عاجلة مفتوحة'}</b><br>${urgent.slice(0, 3).map(r => `${esc(r.code)} — ${esc(r.vSnap?.name)}: ${esc(r.type)}`).join(' · ')}</div><button class="btn btn-sm" onclick="VH.filterRequests({status:'open',pri:'urgent'})">عرضها</button></div>` : '';
  const recent = activeVehicles().slice().sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')).slice(0, 6);
  $id('dash-recent').innerHTML = `<div class="mk-title"><span>آخر المركبات تحديثاً</span><button class="btn btn-sm" onclick="VH.showView('list')">كل المركبات</button></div>` +
    (recent.length ? `<div class="vh-mini">${recent.map(v => `<button class="vh-mini-row" onclick="VH.openFile('${v.id}')"><b>${esc(vName(v))}</b><span class="muted num">${esc(v.code)} · ${ltr(v.plate)}</span>${statusPill(v.status)}</button>`).join('')}</div>`
      : emptyState('لا توجد مركبات بعد', 'ابدأ بإضافة أول مركبة، وكل بياناتها وصيانتها رح تنحفظ بملفها.', '<button class="btn btn-primary" onclick="VH.openVehicleForm()">إضافة مركبة</button>'));
}
function showDueAlerts(){ showView('dash', true); const el = $id('dash-alerts'); if (el && el.scrollIntoView) el.scrollIntoView({ behavior:'smooth', block:'start' }); }
function emptyState(title, msg, btn){ return `<div class="vh-empty">${carIco(56)}<b>${title}</b><p>${msg}</p>${btn || ''}</div>`; }
function filterStatus(s){
  showView('list', true);
  $id('f-status').value = s; $id('f-arch').checked = false; $id('q').value = '';
  applyFilter();
}

/* ---------- قائمة المركبات ---------- */
function applyFilter(){
  fq = $id('q').value.trim(); fStatus = $id('f-status').value; showArchived = $id('f-arch').checked;
  renderList();
}
function renderList(){
  const list = vehicles.filter(v => !!v.archived === showArchived && (!fStatus || v.status === fStatus) && matchesSearch(v, fq))
    .sort((a, b) => (a.no || 0) - (b.no || 0));
  const grid = $id('grid');
  if (!list.length){
    grid.innerHTML = vehicles.length ? emptyState('لا توجد نتائج', 'غيّر البحث أو الفلتر.', '') : emptyState('لا توجد مركبات بعد', 'أضف أول مركبة للمؤسسة.', '<button class="btn btn-primary" onclick="VH.openVehicleForm()">إضافة مركبة</button>');
    return;
  }
  grid.innerHTML = list.map(v => `
    <article class="mk-card vh-card${v.id === flashId ? ' row-new' : ''}${v.archived ? ' archived' : ''}" onclick="VH.openFile('${v.id}')" tabindex="0" onkeydown="if(event.key==='Enter')VH.openFile('${v.id}')">
      <div class="vh-photo${v.photo ? '' : ' none'}">${v.photo ? `<img data-att="${esc(v.photo.key)}" alt="">` : ''}${carIco(40)}</div>
      <div class="vh-card-body">
        <div class="vh-card-top"><span class="vh-code num">${ltr(v.code)}</span>${v.archived ? '<span class="pill">مؤرشفة</span>' : statusPill(v.status)}</div>
        <h3>${esc(vName(v))}${v.year ? ` <span class="muted num">${esc(v.year)}</span>` : ''}</h3>
        <div class="vh-meta"><span>اللوحة: <b class="num">${ltr(v.plate)}</b></span><span>السائق: <b>${esc(v.driver) || '—'}</b></span><span>العداد: <b class="num">${v.odometer != null ? num(v.odometer) + ' كم' : '—'}</b></span></div>
      </div>
    </article>`).join('');
  flashId = null;
  hydrateImages(grid);
}

/* ---------- نموذج المركبة (إضافة / تعديل) ---------- */
function openVehicleForm(id){
  vib(10);
  const ex = id ? vById(id) : null;
  const code = ex ? ex.code : vCode(nextNo(vehicles));
  const f = (k, d = '') => esc(ex ? (ex[k] ?? d) : d);
  const html = `
    <div class="mk-form-head">${carIco(40)}<div><h3>${ex ? 'تعديل بيانات المركبة' : 'مركبة جديدة'}</h3><p>الرقم الإداري: <b class="num">${esc(code)}</b>${ex ? '' : ' (يُنشأ تلقائياً)'}</p></div></div>
    <div class="vh-form-photo">
      <div class="vh-photo big${ex && ex.photo ? '' : ' none'}" id="vh-f-photo-box">${ex && ex.photo ? `<img data-att="${esc(ex.photo.key)}" alt="">` : ''}${carIco(48)}</div>
      <div class="vh-photo-btns">
        <label class="btn btn-sm">صورة المركبة<input type="file" accept="image/*" hidden id="vh-f-photo"></label>
        <button type="button" class="btn btn-sm btn-ghost" id="vh-f-photo-rm"${ex && ex.photo ? '' : ' hidden'}>إزالة الصورة</button>
      </div>
    </div>
    <div class="mk-grid">
      <div class="mk-field"><label for="vh-f-make">الشركة المصنّعة <i>*</i></label><input class="mk-inp" id="vh-f-make" list="vh-make-dl" placeholder="مثال: Kia" value="${f('make')}"><datalist id="vh-make-dl">${[...new Set(vehicles.map(v => v.make).filter(Boolean))].map(m => `<option value="${esc(m)}">`).join('')}</datalist></div>
      <div class="mk-field"><label for="vh-f-model">النوع والطراز <i>*</i></label><input class="mk-inp" id="vh-f-model" placeholder="مثال: Forte" value="${f('model')}"></div>
      <div class="mk-field"><label for="vh-f-plate">رقم لوحة الترخيص <i>*</i></label><input class="mk-inp num" id="vh-f-plate" placeholder="مثال: 12-345-67" value="${f('plate')}"></div>
      <div class="mk-field"><label for="vh-f-year">سنة الصنع</label><input class="mk-inp num" id="vh-f-year" inputmode="numeric" placeholder="مثال: 2019" value="${f('year')}"></div>
      <div class="mk-field"><label for="vh-f-color">اللون</label><input class="mk-inp" id="vh-f-color" placeholder="اختياري" value="${f('color')}"></div>
      <div class="mk-field"><label for="vh-f-status">الحالة</label><select class="mk-inp" id="vh-f-status">${STATUS_KEYS.map(k => `<option value="${k}"${(ex ? ex.status : 'ready') === k ? ' selected' : ''}>${STATUS[k].label}</option>`).join('')}</select></div>
      <div class="mk-field"><label for="vh-f-driver">السائق المسؤول</label><input class="mk-inp" id="vh-f-driver" list="vh-drv-dl" placeholder="اسم السائق" value="${f('driver')}"><datalist id="vh-drv-dl">${[...new Set(vehicles.map(v => v.driver).filter(Boolean))].map(m => `<option value="${esc(m)}">`).join('')}</datalist></div>
      <div class="mk-field"><label for="vh-f-phone">هاتف السائق</label><input class="mk-inp num" id="vh-f-phone" type="tel" inputmode="tel" placeholder="05xxxxxxxx" value="${f('driverPhone')}"></div>
      <div class="mk-field"><label for="vh-f-odo">عداد الكيلومترات الحالي</label><input class="mk-inp num" id="vh-f-odo" inputmode="numeric" placeholder="0" value="${ex && ex.odometer != null ? ex.odometer : ''}"></div>
      <div class="mk-field"><label for="vh-f-added">تاريخ الإضافة للنظام</label><input class="mk-inp" type="date" id="vh-f-added" value="${ex ? (ex.added || '') : todayISO()}"></div>
      <div class="mk-field"><label for="vh-f-by">اسم المُدخِل</label><input class="mk-inp" id="vh-f-by" placeholder="اسمك" value="${esc(settings.lastBy)}"></div>
    </div>
    <div class="mk-field" style="margin-top:12px"><label for="vh-f-notes">ملاحظات</label><textarea class="mk-inp" id="vh-f-notes" placeholder="اختياري">${f('notes')}</textarea></div>
    <div class="actions"><button class="btn btn-primary" data-save data-autofocus>${ex ? 'حفظ التعديل' : 'إضافة المركبة'}</button><button class="btn" data-cancel>إلغاء</button></div>`;
  const sheet = App.sheet(html, { cls:'wide' });
  const ov = sheet.ov, q = s => ov.querySelector(s);
  hydrateImages(ov);
  let photo = ex ? ex.photo || null : null, photoChanged = false;
  q('#vh-f-photo').addEventListener('change', async e => {
    const file = e.target.files[0]; e.target.value = '';
    if (!file) return;
    if (!/^image\//.test(file.type)) return notify({ type:'error', title:'الملف ليس صورة', msg:'اختر صورة بصيغة JPG أو PNG.', log:false });
    try {
      photo = await storeFile(file); photoChanged = true;
      const box = q('#vh-f-photo-box'); box.classList.remove('none');
      box.innerHTML = `<img alt="" src="${await attUrl(photo.key)}">${carIco(48)}`;
      q('#vh-f-photo-rm').hidden = false;
    } catch(err){ notify({ type:'error', title:'تعذّر حفظ الصورة', msg:'السبب: ' + (err.message || err), log:false }); }
  });
  q('#vh-f-photo-rm').onclick = () => { photo = null; photoChanged = true; const box = q('#vh-f-photo-box'); box.classList.add('none'); box.innerHTML = carIco(48); q('#vh-f-photo-rm').hidden = true; };
  q('[data-cancel]').onclick = () => sheet.close();
  q('[data-save]').onclick = async () => {
    const val = s => q(s).value.trim();
    const make = val('#vh-f-make'), model = val('#vh-f-model'), plate = toEn(val('#vh-f-plate'));
    if (!make) return markInvalid(q('#vh-f-make'), 'الشركة المصنّعة مطلوبة', 'مثال: Kia أو Toyota.');
    if (!model) return markInvalid(q('#vh-f-model'), 'نوع المركبة وطرازها مطلوب', 'مثال: Forte أو Hilux.');
    if (!plate) return markInvalid(q('#vh-f-plate'), 'رقم اللوحة مطلوب', 'اكتب رقم لوحة الترخيص كما هو.');
    if (plateTaken(plate, ex && ex.id)){ const o = vehicles.find(v => v.id !== (ex && ex.id) && normPlate(v.plate) === normPlate(plate)); return markInvalid(q('#vh-f-plate'), 'رقم اللوحة مسجّل مسبقاً', `اللوحة ${plate} مسجّلة للمركبة ${o.code}${o.archived ? ' (مؤرشفة)' : ''}.`); }
    const yearRaw = val('#vh-f-year'), year = yearRaw ? intVal(yearRaw) : null, maxY = new Date().getFullYear() + 1;
    if (yearRaw && (!year || year < 1950 || year > maxY)) return markInvalid(q('#vh-f-year'), 'سنة الصنع غير صحيحة', `اكتب سنة بين ١٩٥٠ و${num(maxY).replace(/٬/g, '')}.`);
    const odoRaw = val('#vh-f-odo'), odo = odoRaw ? intVal(odoRaw.replace(/[,٬]/g, '')) : null;
    if (odoRaw && (odo == null || odo < 0)) return markInvalid(q('#vh-f-odo'), 'قراءة العداد غير صحيحة', 'اكتب رقماً صحيحاً بالكيلومتر.');
    const phone = toEn(val('#vh-f-phone')).replace(/[\s\-]/g, '');
    if (phone && !/^\+?\d{7,15}$/.test(phone)) return markInvalid(q('#vh-f-phone'), 'رقم الهاتف غير صحيح', 'اكتب الرقم بالأرقام فقط، مثل 0599123456.');
    const by = val('#vh-f-by');
    const data = { make, model, plate, year: year || '', color:val('#vh-f-color'), status:q('#vh-f-status').value,
      driver:val('#vh-f-driver'), driverPhone:phone, added:q('#vh-f-added').value || todayISO(), notes:val('#vh-f-notes') };
    if (by) settings.lastBy = by;
    const now = new Date().toISOString();
    if (ex){
      // تحذير قبل إنقاص العداد (غالباً خطأ إدخال)
      if (odo != null && ex.odometer != null && odo < ex.odometer){
        const ok = await confirmD({ title:'العداد أقل من آخر قراءة', msg:`آخر قراءة مسجّلة ${num(ex.odometer)} كم والجديدة ${num(odo)} كم. هل تريد الحفظ رغم ذلك؟`, okText:'حفظ رغم ذلك', cancelText:'رجوع', icon:'warning' });
        if (!ok) return;
      }
      const changes = describeChanges(ex, data, odo);
      if (data.driver !== (ex.driver || '') || data.driverPhone !== (ex.driverPhone || '')) assignDriver(ex, data.driver, data.driverPhone, now);
      if (data.status !== ex.status) ex.statusSince = now;
      if (odo != null && odo !== ex.odometer){ ex.odometer = odo; ex.odoDate = todayISO(); }
      if (photoChanged){ if (ex.photo && (!photo || photo.key !== ex.photo.key)) attDel(ex.photo.key).catch(() => {}); ex.photo = photo; }
      Object.assign(ex, data, { updatedAt:now });
      if (changes.length || photoChanged) logEvent(ex, 'تعديل البيانات: ' + (changes.concat(photoChanged ? ['الصورة'] : [])).join('، '), by);
      flashId = ex.id;
      save(); sheet.close(); render();
      notify({ type:'success', title:'تم حفظ بيانات المركبة', msg:`${vName(ex)} — ${ex.code}${changes.length ? '. التغييرات مسجّلة في سجل المتابعة.' : ''}`, page:'vehicles' });
    } else {
      const no = nextNo(vehicles);
      const v = { id:newId('veh'), no, code:vCode(no), ...data, odometer:odo, odoStart:odo, odoDate: odo != null ? todayISO() : '', photo,
        statusSince:now, archived:false, drivers:[], log:[], createdAt:now, updatedAt:now, by };
      if (v.driver) v.drivers.push({ name:v.driver, phone:v.driverPhone, from:todayISO(), to:'' });
      logEvent(v, 'إضافة المركبة إلى النظام' + (v.driver ? ` — السائق: ${v.driver}` : ''), by);
      vehicles.push(v); flashId = v.id;
      save(); sheet.close();
      if (view !== 'list') showView('list', true); else render();
      notify({ type:'success', title:`تمت إضافة ${vName(v)}`, msg:`الرقم الإداري ${v.code} — اللوحة ${v.plate}.`, page:'vehicles', duration:7000,
        action:{ label:'فتح ملفها', fn:() => openFile(v.id) } });
    }
  };
}
// سجل الإسناد: إغلاق فترة السائق السابق وفتح فترة الجديد
function assignDriver(v, name, phone, nowIso){
  const d = todayISO(), open = v.drivers.find(x => !x.to);
  if (open && open.name === name){ open.phone = phone; return; }
  if (open) open.to = d;
  if (name) v.drivers.push({ name, phone, from:d, to:'' });
}
function describeChanges(ex, data, odo){
  const L = { make:'الشركة', model:'الطراز', plate:'اللوحة', year:'سنة الصنع', color:'اللون', driver:'السائق', driverPhone:'هاتف السائق', added:'تاريخ الإضافة', notes:'الملاحظات' };
  const out = [];
  Object.keys(L).forEach(k => { const a = String(ex[k] ?? ''), b = String(data[k] ?? ''); if (a !== b) out.push(k === 'notes' ? L[k] : `${L[k]}: ${a || '—'} ← ${b || '—'}`); });
  if (data.status !== ex.status) out.push(`الحالة: ${STATUS[ex.status]?.label || '—'} ← ${STATUS[data.status].label}`);
  if (odo != null && odo !== ex.odometer) out.push(`العداد: ${ex.odometer != null ? num(ex.odometer) : '—'} ← ${num(odo)} كم`);
  return out;
}

/* ---------- تغيير الحالة السريع والأرشفة ---------- */
function setStatus(id, s, note){
  const v = vById(id); if (!v || v.status === s) return;
  const prev = v.status;
  v.status = s; v.statusSince = new Date().toISOString(); v.updatedAt = v.statusSince;
  logEvent(v, `تغيير الحالة: ${STATUS[prev]?.label || '—'} ← ${STATUS[s].label}${note ? ' — ' + note : ''}`);
  save(); render();
  notify({ type:'success', title:'تم تحديث حالة المركبة', msg:`${vName(v)}: ${STATUS[s].label}`, page:'vehicles',
    action:{ label:'تراجع', fn:() => { v.status = prev; logEvent(v, `تراجع عن تغيير الحالة ← ${STATUS[prev]?.label}`); save(); render(); notify({ type:'info', title:'تم التراجع', log:false }); } } });
}
async function toggleArchive(id){
  const v = vById(id); if (!v) return;
  if (!v.archived){
    const ok = await confirmD({ title:`أرشفة ${vName(v)}؟`, msg:`تختفي ${v.code} من القوائم والإحصائيات اليومية، ويبقى ملفها وكل صيانتها محفوظاً ويظهر في التقارير. تقدر ترجعها في أي وقت.`, okText:'أرشفة', cancelText:'رجوع', danger:true });
    if (!ok) return;
  }
  const was = v.archived;
  v.archived = !was; v.archivedAt = v.archived ? new Date().toISOString() : ''; v.updatedAt = new Date().toISOString();
  logEvent(v, v.archived ? 'أرشفة المركبة' : 'استعادة المركبة من الأرشيف');
  save(); render();
  notify({ type:'success', title: v.archived ? 'تمت أرشفة المركبة' : 'تمت استعادة المركبة', msg:`${vName(v)} — ${v.code}`, page:'vehicles', duration:8000,
    action:{ label:'تراجع', fn:() => { v.archived = was; logEvent(v, 'تراجع عن ' + (was ? 'الاستعادة' : 'الأرشفة')); save(); render(); notify({ type:'info', title:'تم التراجع', log:false }); } } });
}

/* ---------- ملف المركبة ---------- */
const FILE_TABS = [['info', 'البيانات الأساسية'], ['req', 'طلبات الصيانة'], ['mnt', 'سجل الصيانة'], ['cost', 'المصاريف'], ['log', 'سجل المتابعة']];
function openFile(id, push){
  const v = vById(id); if (!v) return;
  fileId = id; fileTab = 'info';
  showView('file', true);
  fileId = id; renderFile();
  const main = document.getElementById('main'); if (main) main.scrollTo({ top:0, behavior:'instant' });
  if (push !== false){ try { history.pushState({ page:'vehicles', veh:id }, '', '#vehicles'); } catch(e){} }
  vib(10);
}
function closeFile(){
  if (history.state && history.state.veh){ history.back(); return; } // زر الرجوع يعيد للقائمة
  showView('list');
}
function setFileTab(t){ fileTab = t; renderFile(); vib(6); }
function renderFile(){
  const v = vById(fileId), el = $id('view-file');
  if (!v){ showView('list', true); return; }
  const lastR = lastReport(v.id), nextP = nextPlanned(v.id);
  const tabCount = { req:vRequests(v.id).length, mnt:vReports(v.id).length, log:v.log.length };
  el.innerHTML = `
    <div class="vh-file-head">
      <button class="btn btn-sm btn-ghost" onclick="VH.closeFile()" aria-label="رجوع">→ رجوع</button>
      <div class="vh-file-actions">
        <button class="btn btn-sm btn-primary" onclick="VH.openRequestForm(null,'${v.id}')">إضافة طلب صيانة</button>
        <button class="btn btn-sm btn-primary" onclick="VH.openReportForm(null,'${v.id}')">تسجيل صيانة منفذة</button>
        <button class="btn btn-sm" onclick="VH.openVehicleForm('${v.id}')">تعديل البيانات</button>
        <button class="btn btn-sm" onclick="VH.setFileTab('mnt')">عرض سجل الصيانة</button>
        <button class="btn btn-sm" onclick="VH.printVehicle('${v.id}')">طباعة الملف</button>
        <button class="btn btn-sm ${v.archived ? '' : 'btn-ghost'}" onclick="VH.toggleArchive('${v.id}')">${v.archived ? 'استعادة من الأرشيف' : 'أرشفة'}</button>
      </div>
    </div>
    <div class="mk-card vh-hero">
      <div class="vh-photo big${v.photo ? '' : ' none'}">${v.photo ? `<img data-att="${esc(v.photo.key)}" alt="">` : ''}${carIco(56)}</div>
      <div class="vh-hero-body">
        <div class="vh-card-top"><span class="vh-code num">${ltr(v.code)}</span>${v.archived ? '<span class="pill">مؤرشفة</span>' : statusPill(v.status)}</div>
        <h2>${esc(vName(v))}${v.year ? ` <span class="muted num">${esc(v.year)}</span>` : ''}</h2>
        <div class="vh-hero-grid">
          <div><small>رقم اللوحة</small><b class="num">${ltr(v.plate)}</b></div>
          <div><small>السائق المسؤول</small><b>${esc(v.driver) || '—'}</b>${v.driverPhone ? `<a class="vh-tel num" href="tel:${esc(v.driverPhone)}">${esc(v.driverPhone)}</a>` : ''}</div>
          <div><small>قراءة العداد</small><b class="num">${v.odometer != null ? num(v.odometer) + ' كم' : '—'}</b>${v.odoDate ? `<span class="muted">${fmtDate(v.odoDate)}</span>` : ''}</div>
          <div><small>الحالة منذ</small><b>${fmtDate(v.statusSince)}</b></div>
          <div><small>آخر صيانة</small><b>${lastR ? fmtDate(lastR.date) : '—'}</b>${lastR ? `<span class="muted">${esc(lastR.type)}</span>` : ''}</div>
          <div><small>موعد الصيانة القادمة</small><b>${nextP ? [nextP.date ? fmtDate(nextP.date) : '', nextP.km ? num(nextP.km) + ' كم' : ''].filter(Boolean).join(' أو ') : '—'}</b></div>
        </div>
        ${v.archived ? '' : `<div class="vh-status-row"><span class="muted">تغيير الحالة:</span>${STATUS_KEYS.map(k => `<button class="btn btn-sm${v.status === k ? ' btn-primary' : ''}" ${v.status === k ? 'disabled' : ''} onclick="VH.setStatus('${v.id}','${k}')">${STATUS[k].label}</button>`).join('')}</div>`}
      </div>
    </div>
    <div class="mk-tabs vh-file-tabs" role="tablist">${FILE_TABS.map(([k, l]) => `<button class="mk-tab${fileTab === k ? ' active' : ''}" role="tab" onclick="VH.setFileTab('${k}')">${l}${tabCount[k] ? ` <span class="pill info num">${num(tabCount[k])}</span>` : ''}</button>`).join('')}</div>
    <div id="vh-file-body">${({ log:fileLog, req:fileReqs, mnt:fileMnts, cost:fileCosts })[fileTab]?.(v) || fileInfo(v)}</div>`;
  hydrateImages(el);
}
function fileInfo(v){
  const row = (l, val) => `<div><small>${l}</small><b>${val || '—'}</b></div>`;
  const drivers = v.drivers.slice().reverse();
  return `<div class="mk-card mk-pad mk-section"><div class="mk-title"><span>بيانات المركبة</span></div>
      <div class="mk-detail vh-detail">
        ${row('الرقم الإداري', `<span class="num">${esc(v.code)}</span>`)}${row('الشركة المصنّعة', esc(v.make))}${row('النوع والطراز', esc(v.model))}
        ${row('رقم اللوحة', `<span class="num">${ltr(v.plate)}</span>`)}${row('سنة الصنع', `<span class="num">${esc(v.year)}</span>`)}${row('اللون', esc(v.color))}
        ${row('تاريخ الإضافة', fmtDate(v.added))}${row('الحالة', STATUS[v.status]?.label)}${row('أدخلها', esc(v.by))}
      </div>${v.notes ? `<div class="vh-notes"><small>ملاحظات</small><p>${esc(v.notes)}</p></div>` : ''}</div>
    ${fileSchedules(v)}
    <div class="mk-card mk-pad mk-section"><div class="mk-title"><span>السائق المسؤول</span></div>
      <div class="mk-detail vh-detail">${row('الاسم', esc(v.driver))}${row('الهاتف', v.driverPhone ? `<a class="num" href="tel:${esc(v.driverPhone)}">${esc(v.driverPhone)}</a>` : '')}</div>
      ${drivers.length > 1 || (drivers[0] && drivers[0].to) ? `<div class="mk-title" style="margin-top:14px"><span>سجل إسناد السائقين</span></div>
        <div class="mk-scroll"><table class="mk-table"><thead><tr><th>السائق</th><th>الهاتف</th><th>من</th><th>إلى</th></tr></thead><tbody>
        ${drivers.map(d => `<tr><td>${esc(d.name)}</td><td class="num">${esc(d.phone) || '—'}</td><td class="num">${fmtDate(d.from)}</td><td class="num">${d.to ? fmtDate(d.to) : '<span class="pill ok">حالياً</span>'}</td></tr>`).join('')}</tbody></table></div>` : ''}
    </div>`;
}
function fileReqs(v){
  const list = vRequests(v.id).sort((a, b) => (isOpenReq(b) - isOpenReq(a)) || byDateDesc(a, b));
  return `<div class="mk-card mk-table-card"><div class="mk-table-head"><h3>طلبات الصيانة <span class="pill info num">${num(list.length)}</span></h3><div class="row"><button class="btn btn-sm btn-primary" onclick="VH.openRequestForm(null,'${v.id}')">طلب جديد</button></div></div>
    <div class="mk-scroll"><table class="mk-table vh-table"><thead><tr><th>الرقم</th><th>التاريخ</th><th>المركبة</th><th>النوع</th><th>الأولوية</th><th>الحالة</th><th></th></tr></thead><tbody>
    ${list.length ? reqRows(list) : '<tr><td colspan="7" class="mk-empty">لا توجد طلبات صيانة لهذه المركبة.</td></tr>'}</tbody></table></div></div>`;
}
let fileSort = 'desc';
function setFileSort(){ fileSort = fileSort === 'desc' ? 'asc' : 'desc'; renderFile(); vib(6); }
function fileMnts(v){
  const list = vReports(v.id).sort(byDateDesc); if (fileSort === 'asc') list.reverse();
  return `<div class="mk-card mk-table-card"><div class="mk-table-head"><h3>سجل الصيانة <span class="pill info num">${num(list.length)}</span></h3>
    <div class="row"><button class="btn btn-sm" onclick="VH.setFileSort()">${fileSort === 'desc' ? 'الأحدث أولاً ↓' : 'الأقدم أولاً ↑'}</button><button class="btn btn-sm btn-primary" onclick="VH.openReportForm(null,'${v.id}')">تسجيل صيانة</button></div></div>
    <div class="mk-scroll"><table class="mk-table vh-table"><thead><tr><th>التقرير</th><th>التاريخ</th><th>النوع</th><th>الورشة</th><th>العداد</th><th>الإجمالي</th><th></th></tr></thead><tbody>
    ${list.length ? mntRows(list, false) : '<tr><td colspan="7" class="mk-empty">لا توجد صيانة مسجّلة لهذه المركبة.</td></tr>'}</tbody></table></div></div>`;
}
function fileCosts(v){
  const list = vReports(v.id).sort(byDateDesc);
  const sum = k => r2(list.reduce((s, m) => s + (+m[k] || 0), 0)), tot = r2(list.reduce((s, m) => s + reportTotal(m), 0));
  return `<div class="mk-kpis"><div class="mk-card mk-kpi"><small>قطع الغيار</small><b class="num">${money(sum('partsCost'))}</b></div><div class="mk-card mk-kpi"><small>أجور العمل</small><b class="num">${money(sum('labor'))}</b></div>
      <div class="mk-card mk-kpi"><small>تكاليف إضافية</small><b class="num">${money(sum('extra'))}</b></div><div class="mk-card mk-kpi good"><small>الإجمالي</small><b class="num">${money(tot)}</b></div></div>
    <div class="mk-card mk-table-card"><div class="mk-table-head"><h3>تفاصيل المصاريف</h3></div>
    <div class="mk-scroll"><table class="mk-table vh-table"><thead><tr><th>التقرير</th><th>التاريخ</th><th>النوع</th><th>قطع الغيار</th><th>أجور العمل</th><th>إضافية</th><th>الإجمالي</th></tr></thead><tbody>
    ${list.length ? list.map(m => `<tr onclick="VH.openReport('${m.id}')"><td class="num">${ltr(m.code)}</td><td class="num">${fmtDate(m.date)}</td><td>${esc(m.type)}</td><td class="num">${money(m.partsCost)}</td><td class="num">${money(m.labor)}</td><td class="num">${money(m.extra)}</td><td class="num"><b>${money(reportTotal(m))}</b></td></tr>`).join('')
      + `<tr class="tot"><td colspan="3">الإجمالي</td><td class="num">${money(sum('partsCost'))}</td><td class="num">${money(sum('labor'))}</td><td class="num">${money(sum('extra'))}</td><td class="num"><b>${money(tot)}</b></td></tr>` : '<tr><td colspan="7" class="mk-empty">لا توجد مصاريف بعد.</td></tr>'}</tbody></table></div></div>`;
}
function fileSchedules(v){
  const sc = schedules(v), iv = intervalsOf(v), custom = v.intervals && Object.keys(v.intervals).length;
  const ST = { overdue:['high', 'متأخرة'], soon:['mid', 'قريبة'], ok:['ok', 'في موعدها'] };
  return `<div class="mk-card mk-pad mk-section"><div class="mk-title"><span>الصيانة الدورية</span><button class="btn btn-sm" onclick="VH.openIntervals('${v.id}')">فترات الصيانة</button></div>
    <p class="muted vh-iv-note">${custom ? 'فترات خاصة بهذه المركبة' : 'الفترات الافتراضية'}: الزيت ${iv.oilKm ? num(iv.oilKm) + ' كم' : '—'}${iv.oilDays ? ' / ' + num(iv.oilDays) + ' يوم' : ''} · الدورية ${iv.perKm ? num(iv.perKm) + ' كم' : '—'}${iv.perDays ? ' / ' + num(iv.perDays) + ' يوم' : ''}</p>
    ${sc.length ? `<div class="vh-sched">${sc.map(x => `<div class="vh-sched-row ${x.state}"><div class="grow"><b>${esc(x.label)}</b><small class="num">آخر تنفيذ: ${x.last ? fmtDate(x.last.date) : 'لا يوجد — من تاريخ الإضافة'} · الاستحقاق: ${[x.dueDate ? fmtDate(x.dueDate) : '', x.dueKm != null ? num(x.dueKm) + ' كم' : ''].filter(Boolean).join(' أو ') || '—'}</small></div><span class="muted num">${esc(x.text)}</span><span class="pill ${ST[x.state][0]}">${ST[x.state][1]}</span></div>`).join('')}</div>` : '<p class="muted">لا توجد متابعة دورية لهذه المركبة.</p>'}</div>`;
}
function fileLog(v){
  if (!v.log.length) return `<div class="mk-card mk-pad">${emptyState('لا يوجد سجل بعد', 'كل تعديل أو تغيير حالة رح يظهر هون.', '')}</div>`;
  return `<div class="mk-card mk-pad"><div class="mk-title"><span>سجل المتابعة</span><button class="btn btn-sm" onclick="VH.addNote('${v.id}')">إضافة ملاحظة متابعة</button></div>
    <ol class="vh-timeline">${v.log.slice().reverse().map(l => `<li><time class="num">${fmtDateTime(l.at)}</time><p>${esc(l.text)}</p>${l.by ? `<small>${esc(l.by)}</small>` : ''}</li>`).join('')}</ol></div>`;
}
function addNote(id){
  const v = vById(id); if (!v) return;
  const sheet = App.sheet(`<div class="mk-form-head">${carIco(40)}<div><h3>ملاحظة متابعة</h3><p>${esc(vName(v))} — ${esc(v.code)}</p></div></div>
    <div class="mk-field"><label for="vh-n-text">الملاحظة <i>*</i></label><textarea class="mk-inp" id="vh-n-text" placeholder="مثال: تم فحص الإطارات قبل السفر"></textarea></div>
    <div class="actions"><button class="btn btn-primary" data-save>حفظ</button><button class="btn" data-cancel>إلغاء</button></div>`);
  const q = s => sheet.ov.querySelector(s);
  setTimeout(() => q('#vh-n-text').focus(), 80);
  q('[data-cancel]').onclick = () => sheet.close();
  q('[data-save]').onclick = () => {
    const t = q('#vh-n-text').value.trim();
    if (!t) return markInvalid(q('#vh-n-text'), 'اكتب الملاحظة', 'سطر واحد يكفي.');
    logEvent(v, t); v.updatedAt = new Date().toISOString();
    save(); sheet.close(); render();
    notify({ type:'success', title:'تمت إضافة الملاحظة', msg:`في سجل متابعة ${v.code}.`, page:'vehicles', log:false });
  };
}

/* ---------- المنطق: طلبات الصيانة وتقاريرها ---------- */
const qById = id => requests.find(r => r.id === id);
const mById = id => reports.find(r => r.id === id);
// نسخة من بيانات المركبة وقت التسجيل: تغيير السائق أو اللوحة لاحقاً لا يغيّر السجلات القديمة
const snap = v => ({ code:v.code, name:vName(v), plate:v.plate, driver:v.driver || '' });
const reportTotal = r => r2((+r.partsCost || 0) + (+r.labor || 0) + (+r.extra || 0));
const vReports = id => reports.filter(r => r.vehicleId === id);
const vRequests = id => requests.filter(r => r.vehicleId === id);
const byDateDesc = (a, b) => (b.date || '').localeCompare(a.date || '') || (b.no || 0) - (a.no || 0);
function lastReport(id){ return vReports(id).slice().sort(byDateDesc)[0] || null; }
// أقرب موعد قادم مسجّل في آخر تقرير يحمل موعداً
function nextPlanned(id){ const r = vReports(id).filter(x => x.nextDate || x.nextKm).sort(byDateDesc)[0]; return r ? { date:r.nextDate || '', km:r.nextKm || null, report:r } : null; }
const reqPill = s => { const m = REQ_STATUS[s] || REQ_STATUS.new; return `<span class="pill ${m.pill}">${m.label}</span>`; };
const priPill = p => { const m = PRIORITY[p] || PRIORITY.normal; return `<span class="pill ${m.pill}">${p === 'urgent' ? '⚡ ' : ''}${m.label}</span>`; };
const vehOptions = (sel, withArchived) => vehicles.filter(v => withArchived || !v.archived || v.id === sel).slice().sort((a, b) => a.no - b.no)
  .map(v => `<option value="${v.id}"${v.id === sel ? ' selected' : ''}>${esc(v.code)} — ${esc(vName(v))}${v.plate ? ' (' + esc(v.plate) + ')' : ''}${v.archived ? ' — مؤرشفة' : ''}</option>`).join('');
const typeOptions = sel => { const list = settings.types.slice(); if (sel && !list.includes(sel)) list.push(sel); return list.map(t => `<option${t === sel ? ' selected' : ''}>${esc(t)}</option>`).join(''); };

/* ---------- المرفقات في النماذج ---------- */
// ودجة مرفقات متعددة: صور تُضغط، وPDF/مستندات تُحفظ كما هي
function attWidget(ov, prefix, initial){
  let list = (initial || []).slice();
  const box = ov.querySelector('#' + prefix + '-atts'), inp = ov.querySelector('#' + prefix + '-file');
  const draw = () => {
    box.innerHTML = list.map((a, i) => `<span class="vh-att"><button type="button" class="vh-att-open" data-i="${i}">${/^image\//.test(a.type) ? '🖼' : '📄'} ${esc(a.name)}</button><button type="button" class="vh-att-rm" data-rm="${i}" aria-label="إزالة">×</button></span>`).join('') || '<span class="muted">لا توجد مرفقات</span>';
  };
  box.addEventListener('click', e => {
    const rm = e.target.closest('[data-rm]'), op = e.target.closest('[data-i]');
    if (rm){ list.splice(+rm.dataset.rm, 1); draw(); }
    else if (op) openAtt(list[+op.dataset.i]);
  });
  inp.addEventListener('change', async () => {
    const files = [...inp.files]; inp.value = '';
    for (const f of files){
      if (f.size > 15 * 1024 * 1024){ notify({ type:'error', title:'الملف كبير جداً', msg:`«${f.name}» أكبر من ١٥ ميغا.`, log:false }); continue; }
      try { list.push(await storeFile(f)); } catch(err){ notify({ type:'error', title:'تعذّر حفظ المرفق', msg:'السبب: ' + (err.message || err), log:false }); }
    }
    draw();
  });
  draw();
  return { get:() => list };
}
async function openAtt(a){
  if (!a) return;
  const u = await attUrl(a.key);
  if (!u) return notify({ type:'error', title:'المرفق غير موجود على هذا الجهاز', msg:'ربما حُذف من المتصفح. استعد نسخة احتياطية فيها المرفقات.', log:false });
  const w = window.open(u, '_blank');
  if (!w) notify({ type:'error', title:'المتصفح منع فتح المرفق', msg:'اسمح بالنوافذ المنبثقة لهذا الموقع.', log:false });
}
const attList = atts => (atts || []).length ? `<div class="vh-att-list">${atts.map(a => `<button type="button" class="vh-att" onclick='VH.openAttKey(${JSON.stringify(a.key)})'>${/^image\//.test(a.type) ? '🖼' : '📄'} ${esc(a.name)}</button>`).join('')}</div>` : '<span class="muted">—</span>';
function openAttKey(key){
  const a = [...requests, ...reports].flatMap(r => r.atts || []).find(x => x.key === key);
  openAtt(a);
}

/* ---------- نموذج طلب الصيانة ---------- */
function openRequestForm(id, vehicleId){
  vib(10);
  const ex = id ? qById(id) : null;
  if (!ex && !activeVehicles().length) return notify({ type:'warning', title:'لا توجد مركبات بعد', msg:'أضف مركبة أولاً ثم سجّل طلب الصيانة عليها.', action:{ label:'مركبة جديدة', fn:() => openVehicleForm() } });
  const code = ex ? ex.code : qCode(nextNo(requests));
  const f = (k, d = '') => esc(ex ? (ex[k] ?? d) : d);
  const html = `
    <div class="mk-form-head">${carIco(40)}<div><h3>${ex ? 'تعديل طلب الصيانة' : 'طلب صيانة جديد'}</h3><p>رقم الطلب: <b class="num">${esc(code)}</b> — يُسجَّل الطلب «بلاغ جديد» حتى تحدّث حالته بنفسك.</p></div></div>
    <div class="mk-grid">
      <div class="mk-field wide2"><label for="vh-r-veh">المركبة <i>*</i></label><select class="mk-inp" id="vh-r-veh">${ex ? '' : '<option value="">— اختر المركبة —</option>'}${vehOptions(ex ? ex.vehicleId : vehicleId)}</select></div>
      <div class="mk-field"><label for="vh-r-date">تاريخ الإبلاغ <i>*</i></label><input class="mk-inp" type="date" id="vh-r-date" value="${ex ? ex.date : todayISO()}"></div>
      <div class="mk-field"><label for="vh-r-reporter">المُبلِّغ عن العطل</label><input class="mk-inp" id="vh-r-reporter" list="vh-rep-dl" placeholder="مثال: السائق" value="${f('reporter')}"><datalist id="vh-rep-dl">${[...new Set([...vehicles.map(v => v.driver), ...requests.map(r => r.reporter)].filter(Boolean))].map(x => `<option value="${esc(x)}">`).join('')}</datalist></div>
      <div class="mk-field"><label for="vh-r-type">نوع الصيانة <i>*</i></label><select class="mk-inp" id="vh-r-type">${typeOptions(ex ? ex.type : '')}</select></div>
      <div class="mk-field"><label for="vh-r-pri">الأولوية</label><select class="mk-inp" id="vh-r-pri">${PRIORITY_KEYS.map(k => `<option value="${k}"${(ex ? ex.priority : 'normal') === k ? ' selected' : ''}>${PRIORITY[k].label}</option>`).join('')}</select></div>
    </div>
    <div class="mk-field" style="margin-top:12px"><label for="vh-r-desc">وصف العطل بالتفصيل <i>*</i></label><textarea class="mk-inp" id="vh-r-desc" placeholder="مثال: صوت طقطقة من العجل الأمامي اليمين عند الفرملة">${f('desc')}</textarea></div>
    <div class="mk-grid" style="margin-top:12px">
      <div class="mk-field"><label for="vh-r-cause">سبب العطل (إن كان معروفاً)</label><input class="mk-inp" id="vh-r-cause" placeholder="اختياري" value="${f('cause')}"></div>
      <div class="mk-field"><label for="vh-r-by">اسم مُسجِّل الطلب</label><input class="mk-inp" id="vh-r-by" value="${esc(ex ? ex.by || '' : settings.lastBy)}"></div>
    </div>
    <div class="mk-field" style="margin-top:12px"><label for="vh-r-notes">ملاحظات</label><input class="mk-inp" id="vh-r-notes" placeholder="اختياري" value="${f('notes')}"></div>
    <div class="mk-field" style="margin-top:12px"><label>صور العطل أو مستندات</label><div class="vh-atts" id="vh-r-atts"></div>
      <label class="btn btn-sm" style="align-self:flex-start">إرفاق ملفات<input type="file" id="vh-r-file" multiple accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx" hidden></label></div>
    <div class="actions"><button class="btn btn-primary" data-save>${ex ? 'حفظ التعديل' : 'تسجيل الطلب'}</button><button class="btn" data-cancel>إلغاء</button></div>`;
  const sheet = App.sheet(html, { cls:'wide' });
  const ov = sheet.ov, q = s => ov.querySelector(s);
  const atts = attWidget(ov, 'vh-r', ex ? ex.atts : []);
  q('[data-cancel]').onclick = () => sheet.close();
  q('[data-save]').onclick = () => {
    const val = s => q(s).value.trim();
    const vehicleId = q('#vh-r-veh').value, date = q('#vh-r-date').value, desc = val('#vh-r-desc');
    if (!vehicleId) return markInvalid(q('#vh-r-veh'), 'اختر المركبة', 'كل طلب صيانة لازم يرتبط بمركبة.');
    if (!date) return markInvalid(q('#vh-r-date'), 'تاريخ الإبلاغ مطلوب', 'حدّد يوم الإبلاغ عن العطل.');
    if (date > todayISO()) return markInvalid(q('#vh-r-date'), 'تاريخ الإبلاغ في المستقبل', 'اختر تاريخ اليوم أو قبله.');
    if (!desc) return markInvalid(q('#vh-r-desc'), 'وصف العطل مطلوب', 'اكتب شو المشكلة بالضبط.');
    const by = val('#vh-r-by'); if (by) settings.lastBy = by;
    const v = vById(vehicleId), now = new Date().toISOString();
    const data = { vehicleId, date, reporter:val('#vh-r-reporter'), type:q('#vh-r-type').value, priority:q('#vh-r-pri').value,
      desc, cause:val('#vh-r-cause'), notes:val('#vh-r-notes'), atts:atts.get(), by };
    if (ex){
      if (ex.vehicleId !== vehicleId) ex.vSnap = snap(v);
      Object.assign(ex, data, { updatedAt:now });
      ex.history.push({ at:now, from:ex.status, to:ex.status, note:'تعديل بيانات الطلب', by });
      save(); sheet.close(); render();
      notify({ type:'success', title:'تم حفظ تعديل الطلب', msg:`${ex.code} — ${vName(v)}`, page:'vehicles' });
    } else {
      const no = nextNo(requests);
      const r = { id:newId('req'), no, code:qCode(no), ...data, vSnap:snap(v), status:'new',
        history:[{ at:now, from:'', to:'new', note:'تسجيل الطلب', by }], createdAt:now, updatedAt:now };
      requests.push(r);
      logEvent(v, `طلب صيانة ${r.code}: ${r.type}${r.priority === 'urgent' ? ' (عاجل)' : ''}`, by);
      if (v.status === 'ready'){ /* عطل مُبلّغ: نعرض تحويل الحالة بدل فرضها */ }
      flashId = r.id;
      save(); sheet.close(); render();
      notify({ type: r.priority === 'urgent' ? 'warning' : 'success', title:`تم تسجيل طلب الصيانة ${r.code}`, page:'vehicles', duration:8000,
        msg:`${vName(v)} — ${r.type}. الحالة: بلاغ جديد.` + (v.status === 'ready' ? ' المركبة ما زالت «جاهزة».' : ''),
        action: v.status === 'ready' ? { label:'تحويلها «تحتاج صيانة»', fn:() => setStatus(v.id, 'needs', 'بسبب ' + r.code) } : { label:'تحديث الحالة', fn:() => openReqStatus(r.id) } });
    }
  };
}

/* ---------- تحديث حالة الطلب (مع سجل كل تغيير) ---------- */
function openReqStatus(id){
  const r = qById(id); if (!r) return;
  const sheet = App.sheet(`
    <div class="mk-form-head">${carIco(40)}<div><h3>تحديث حالة ${esc(r.code)}</h3><p>${esc(r.vSnap?.name || '')} — ${esc(r.type)}. الحالة الحالية: <b>${REQ_STATUS[r.status].label}</b></p></div></div>
    <div class="mk-field"><label>الحالة الجديدة</label><div class="vh-seg-wrap" id="vh-s-seg">${REQ_KEYS.map(k => `<button type="button" class="btn btn-sm" data-st="${k}" aria-pressed="false"${k === r.status ? ' disabled' : ''}>${REQ_STATUS[k].label}</button>`).join('')}</div></div>
    <div class="mk-grid" style="margin-top:12px">
      <div class="mk-field"><label for="vh-s-date">تاريخ التغيير</label><input class="mk-inp" type="date" id="vh-s-date" value="${todayISO()}"></div>
      <div class="mk-field"><label for="vh-s-by">بواسطة</label><input class="mk-inp" id="vh-s-by" value="${esc(settings.lastBy)}"></div>
    </div>
    <div class="mk-field" style="margin-top:12px"><label for="vh-s-note">ملاحظة التحديث</label><textarea class="mk-inp" id="vh-s-note" placeholder="مثال: وافق المدير على الإصلاح في ورشة الأمل"></textarea></div>
    <div class="actions"><button class="btn btn-primary" data-save>حفظ التحديث</button><button class="btn" data-cancel>إلغاء</button></div>`);
  const ov = sheet.ov, q = s => ov.querySelector(s);
  let to = '';
  q('#vh-s-seg').addEventListener('click', e => { const b = e.target.closest('[data-st]'); if (!b || b.disabled) return; to = b.dataset.st; ov.querySelectorAll('#vh-s-seg [data-st]').forEach(x => { x.classList.toggle('btn-primary', x === b); x.setAttribute('aria-pressed', x === b); }); vib(6); });
  q('[data-cancel]').onclick = () => sheet.close();
  q('[data-save]').onclick = () => {
    if (!to) return markInvalid(q('#vh-s-seg'), 'اختر الحالة الجديدة', 'اضغط على إحدى الحالات.');
    const day = q('#vh-s-date').value || todayISO(), by = q('#vh-s-by').value.trim(), note = q('#vh-s-note').value.trim();
    if (to === 'cancelled' && !note) return markInvalid(q('#vh-s-note'), 'اكتب سبب الإلغاء', 'حتى يبقى واضحاً بالسجل ليش انلغى الطلب.');
    if (by) settings.lastBy = by;
    sheet.close();
    changeReqStatus(r, to, note, by, day);
  };
}
function changeReqStatus(r, to, note, by, day){
  const from = r.status, now = new Date().toISOString();
  const at = day && day !== todayISO() ? day + 'T12:00:00' : now;
  r.status = to; r.updatedAt = now;
  if (to === 'done' || to === 'cancelled') r.closedAt = day || todayISO(); else r.closedAt = '';
  r.history.push({ at, from, to, note:note || '', by: by || settings.lastBy || '' });
  const v = vById(r.vehicleId);
  if (v){ logEvent(v, `${r.code}: ${REQ_STATUS[from]?.label || '—'} ← ${REQ_STATUS[to].label}${note ? ' — ' + note : ''}`, by); v.updatedAt = now; }
  save(); render();
  const action = to === 'done' && !reports.some(m => m.requestId === r.id) ? { label:'تسجيل الصيانة المنفذة', fn:() => openReportForm(null, r.vehicleId, r.id) }
    : to === 'progress' && v && v.status !== 'under' ? { label:'المركبة «تحت الصيانة»', fn:() => setStatus(v.id, 'under', 'بسبب ' + r.code) }
    : { label:'تراجع', fn:() => { r.status = from; r.history.pop(); r.closedAt = ''; if (v) logEvent(v, `تراجع عن تحديث ${r.code}`); save(); render(); notify({ type:'info', title:'تم التراجع', log:false }); } };
  notify({ type:'success', title:`${r.code}: ${REQ_STATUS[to].label}`, msg:`تم تسجيل التغيير من «${REQ_STATUS[from]?.label || '—'}» بتاريخه${note ? ' مع الملاحظة' : ''}.`, page:'vehicles', duration:8000, action });
}

/* ---------- تفاصيل الطلب ---------- */
function openRequest(id){
  const r = qById(id); if (!r) return;
  const v = vById(r.vehicleId), linked = reports.filter(m => m.requestId === r.id);
  const sheet = App.sheet(`
    <div class="mk-form-head">${carIco(40)}<div><h3>${esc(r.code)} — ${esc(r.type)}</h3><p>${esc(v ? vName(v) : r.vSnap?.name)} · ${ltr(r.vSnap?.plate)}</p></div></div>
    <div class="vh-badges">${reqPill(r.status)}${priPill(r.priority)}</div>
    <div class="mk-detail vh-detail">
      <div><small>تاريخ الإبلاغ</small><b>${fmtDate(r.date)}</b></div><div><small>المُبلِّغ</small><b>${esc(r.reporter) || '—'}</b></div>
      <div><small>السائق وقت الطلب</small><b>${esc(r.vSnap?.driver) || '—'}</b></div><div><small>سجّله</small><b>${esc(r.by) || '—'}</b></div>
    </div>
    <div class="vh-notes"><small>وصف العطل</small><p>${esc(r.desc)}</p></div>
    ${r.cause ? `<div class="vh-notes"><small>سبب العطل</small><p>${esc(r.cause)}</p></div>` : ''}${r.notes ? `<div class="vh-notes"><small>ملاحظات</small><p>${esc(r.notes)}</p></div>` : ''}
    <div class="vh-notes"><small>المرفقات</small>${attList(r.atts)}</div>
    ${linked.length ? `<div class="vh-notes"><small>تقارير الصيانة المرتبطة</small><p>${linked.map(m => `<button class="btn btn-sm" onclick="VH.openReport('${m.id}')">${esc(m.code)} — ${money(reportTotal(m))}</button>`).join(' ')}</p></div>` : ''}
    <div class="mk-title" style="margin-top:14px"><span>سجل تغييرات الحالة</span></div>
    <ol class="vh-timeline">${r.history.slice().reverse().map(h => `<li><time class="num">${fmtDateTime(h.at)}</time><p>${h.from === h.to ? esc(h.note) : `${h.from ? REQ_STATUS[h.from]?.label + ' ← ' : ''}<b>${REQ_STATUS[h.to]?.label}</b>${h.note ? ' — ' + esc(h.note) : ''}`}</p>${h.by ? `<small>${esc(h.by)}</small>` : ''}</li>`).join('')}</ol>
    <div class="actions">
      <button class="btn btn-primary" data-st>تحديث الحالة</button>
      ${isOpenReq(r) ? '<button class="btn" data-rep>تسجيل الصيانة المنفذة</button>' : ''}
      <button class="btn" data-edit>تعديل</button><button class="btn btn-ghost" data-close>إغلاق</button></div>`, { cls:'wide' });
  const q = s => sheet.ov.querySelector(s);
  q('[data-close]').onclick = () => sheet.close();
  q('[data-st]').onclick = () => { sheet.close(); openReqStatus(r.id); };
  q('[data-edit]').onclick = () => { sheet.close(); openRequestForm(r.id); };
  if (q('[data-rep]')) q('[data-rep]').onclick = () => { sheet.close(); openReportForm(null, r.vehicleId, r.id); };
}

/* ---------- نموذج تقرير الصيانة المنفذة ---------- */
function openReportForm(id, vehicleId, requestId){
  vib(10);
  const ex = id ? mById(id) : null;
  if (!ex && !vehicles.length) return notify({ type:'warning', title:'لا توجد مركبات بعد', msg:'أضف مركبة أولاً.', action:{ label:'مركبة جديدة', fn:() => openVehicleForm() } });
  const req = requestId ? qById(requestId) : ex && ex.requestId ? qById(ex.requestId) : null;
  const vid = ex ? ex.vehicleId : vehicleId || (req && req.vehicleId) || '';
  const code = ex ? ex.code : mCode(nextNo(reports));
  const f = (k, d = '') => esc(ex ? (ex[k] ?? d) : d);
  const v0 = vById(vid);
  const reqOpts = vId => `<option value="">— بدون طلب —</option>` + requests.filter(r => r.vehicleId === vId && (isOpenReq(r) || (ex && r.id === ex.requestId) || r.id === requestId))
    .map(r => `<option value="${r.id}"${(req && r.id === req.id) ? ' selected' : ''}>${esc(r.code)} — ${esc(r.type)} (${REQ_STATUS[r.status].label})</option>`).join('');
  const html = `
    <div class="mk-form-head">${carIco(40)}<div><h3>${ex ? 'تعديل تقرير الصيانة' : 'تسجيل صيانة منفذة'}</h3><p>رقم التقرير: <b class="num">${esc(code)}</b>. كل صيانة سجل مستقل ولا تستبدل ما قبلها.</p></div></div>
    <div class="mk-grid">
      <div class="mk-field wide2"><label for="vh-m-veh">المركبة <i>*</i></label><select class="mk-inp" id="vh-m-veh"${ex ? ' disabled' : ''}>${vid ? '' : '<option value="">— اختر المركبة —</option>'}${vehOptions(vid, !!ex)}</select></div>
      <div class="mk-field"><label for="vh-m-req">طلب الصيانة المرتبط</label><select class="mk-inp" id="vh-m-req">${reqOpts(vid)}</select></div>
      <div class="mk-field"><label for="vh-m-date">تاريخ التنفيذ <i>*</i></label><input class="mk-inp" type="date" id="vh-m-date" value="${ex ? ex.date : todayISO()}"></div>
      <div class="mk-field"><label for="vh-m-type">نوع الصيانة <i>*</i></label><select class="mk-inp" id="vh-m-type">${typeOptions(ex ? ex.type : req ? req.type : '')}</select></div>
      <div class="mk-field"><label for="vh-m-odo">عداد الكيلومترات وقت الصيانة</label><input class="mk-inp num" id="vh-m-odo" inputmode="numeric" placeholder="${v0 && v0.odometer != null ? 'آخر قراءة: ' + v0.odometer : '0'}" value="${ex && ex.odometer != null ? ex.odometer : ''}"></div>
      <div class="mk-field"><label for="vh-m-shop">مركز الصيانة / الورشة</label><input class="mk-inp" id="vh-m-shop" list="vh-shop-dl" placeholder="مثال: ورشة الأمل" value="${f('workshop')}"><datalist id="vh-shop-dl">${[...new Set(reports.map(r => r.workshop).filter(Boolean))].map(x => `<option value="${esc(x)}">`).join('')}</datalist></div>
    </div>
    <div class="mk-field" style="margin-top:12px"><label for="vh-m-problem">وصف المشكلة</label><textarea class="mk-inp" id="vh-m-problem" placeholder="اختياري">${ex ? esc(ex.problem || '') : req ? esc(req.desc) : ''}</textarea></div>
    <div class="mk-field" style="margin-top:12px"><label for="vh-m-work">الأعمال والإصلاحات المنفذة <i>*</i></label><textarea class="mk-inp" id="vh-m-work" placeholder="مثال: تغيير فحمات الفرامل الأمامية وخراطة الديسكات">${f('work')}</textarea></div>
    <div class="mk-field" style="margin-top:12px"><label for="vh-m-parts">قطع الغيار المستخدمة</label><textarea class="mk-inp" id="vh-m-parts" placeholder="مثال: فحمات أمامية ×٢، زيت فرامل لتر">${f('parts')}</textarea></div>
    <div class="vh-costs">
      <div class="mk-field"><label for="vh-m-pc">تكلفة قطع الغيار (${CUR})</label><input class="mk-inp num" id="vh-m-pc" inputmode="decimal" placeholder="0" value="${ex && ex.partsCost ? ex.partsCost : ''}"></div>
      <div class="mk-field"><label for="vh-m-lab">أجور العمل (${CUR})</label><input class="mk-inp num" id="vh-m-lab" inputmode="decimal" placeholder="0" value="${ex && ex.labor ? ex.labor : ''}"></div>
      <div class="mk-field"><label for="vh-m-ext">تكاليف إضافية (${CUR})</label><input class="mk-inp num" id="vh-m-ext" inputmode="decimal" placeholder="0" value="${ex && ex.extra ? ex.extra : ''}"></div>
      <div class="vh-total"><small>إجمالي التكلفة</small><b class="num" id="vh-m-total">${money(ex ? reportTotal(ex) : 0)}</b></div>
    </div>
    <div class="mk-grid" style="margin-top:12px">
      <div class="mk-field"><label for="vh-m-ndate">موعد الصيانة القادمة (تاريخ)</label><input class="mk-inp" type="date" id="vh-m-ndate" value="${f('nextDate')}"></div>
      <div class="mk-field"><label for="vh-m-nkm">أو عند عداد (كم)</label><input class="mk-inp num" id="vh-m-nkm" inputmode="numeric" placeholder="اختياري" value="${ex && ex.nextKm ? ex.nextKm : ''}"></div>
      <div class="mk-field"><label for="vh-m-by">اسم مُسجِّل التقرير</label><input class="mk-inp" id="vh-m-by" value="${esc(settings.lastBy)}"></div>
    </div>
    <div class="mk-field" style="margin-top:12px"><label for="vh-m-notes">ملاحظات إضافية</label><input class="mk-inp" id="vh-m-notes" placeholder="اختياري" value="${f('notes')}"></div>
    <div class="mk-field" style="margin-top:12px"><label>صورة الفاتورة أو مستند الصيانة</label><div class="vh-atts" id="vh-m-atts"></div>
      <label class="btn btn-sm" style="align-self:flex-start">إرفاق ملفات<input type="file" id="vh-m-file" multiple accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx" hidden></label></div>
    <div class="actions"><button class="btn btn-primary" data-save>${ex ? 'حفظ التعديل' : 'حفظ التقرير'}</button><button class="btn" data-cancel>إلغاء</button></div>`;
  const sheet = App.sheet(html, { cls:'wide' });
  const ov = sheet.ov, q = s => ov.querySelector(s);
  const atts = attWidget(ov, 'vh-m', ex ? ex.atts : []);
  const costs = () => ['#vh-m-pc', '#vh-m-lab', '#vh-m-ext'].map(s => moneyVal(q(s).value) ?? 0);
  // الإجمالي = قطع الغيار + أجور العمل + الإضافية، يتحدّث مع كل تعديل
  const recalc = () => { const [a, b, c] = costs(); q('#vh-m-total').textContent = money(r2(a + b + c)); };
  ['#vh-m-pc', '#vh-m-lab', '#vh-m-ext'].forEach(s => q(s).addEventListener('input', recalc));
  q('#vh-m-veh').addEventListener('change', () => { q('#vh-m-req').innerHTML = reqOpts(q('#vh-m-veh').value); const v = vById(q('#vh-m-veh').value); q('#vh-m-odo').placeholder = v && v.odometer != null ? 'آخر قراءة: ' + v.odometer : '0'; });
  q('#vh-m-req').addEventListener('change', () => { const r = qById(q('#vh-m-req').value); if (r){ q('#vh-m-type').innerHTML = typeOptions(r.type); if (!q('#vh-m-problem').value.trim()) q('#vh-m-problem').value = r.desc; } });
  q('[data-cancel]').onclick = () => sheet.close();
  q('[data-save]').onclick = async () => {
    const val = s => q(s).value.trim();
    const vehicleId = q('#vh-m-veh').value, date = q('#vh-m-date').value, work = val('#vh-m-work');
    if (!vehicleId) return markInvalid(q('#vh-m-veh'), 'اختر المركبة', 'كل تقرير صيانة لازم يرتبط بمركبة.');
    if (!date) return markInvalid(q('#vh-m-date'), 'تاريخ التنفيذ مطلوب', 'حدّد يوم تنفيذ الصيانة.');
    if (date > todayISO()) return markInvalid(q('#vh-m-date'), 'تاريخ التنفيذ في المستقبل', 'سجّل الصيانة بعد تنفيذها. للمواعيد القادمة استعمل «موعد الصيانة القادمة».');
    if (!work) return markInvalid(q('#vh-m-work'), 'اكتب الأعمال المنفذة', 'مثال: تغيير الزيت والفلتر.');
    const ids = { '#vh-m-pc':'تكلفة قطع الغيار', '#vh-m-lab':'أجور العمل', '#vh-m-ext':'التكاليف الإضافية' };
    for (const [s, l] of Object.entries(ids)){ const raw = val(s), n = raw ? moneyVal(raw) : 0; if (n == null || n < 0) return markInvalid(q(s), `${l} غير صحيحة`, 'اكتب مبلغاً موجباً أو اتركه فارغاً.'); }
    const odoRaw = val('#vh-m-odo'), odo = odoRaw ? intVal(odoRaw.replace(/[,٬]/g, '')) : null;
    if (odoRaw && (odo == null || odo < 0)) return markInvalid(q('#vh-m-odo'), 'قراءة العداد غير صحيحة', 'اكتب رقماً صحيحاً بالكيلومتر.');
    const nkmRaw = val('#vh-m-nkm'), nextKm = nkmRaw ? intVal(nkmRaw.replace(/[,٬]/g, '')) : null;
    if (nkmRaw && (nextKm == null || nextKm <= 0)) return markInvalid(q('#vh-m-nkm'), 'عداد الموعد القادم غير صحيح', 'اكتب رقماً بالكيلومتر.');
    if (nextKm && odo != null && nextKm <= odo) return markInvalid(q('#vh-m-nkm'), 'عداد الموعد القادم أقل من الحالي', `العداد وقت الصيانة ${num(odo)} كم — الموعد القادم لازم يكون أكبر.`);
    const nextDate = q('#vh-m-ndate').value;
    if (nextDate && nextDate <= date) return markInvalid(q('#vh-m-ndate'), 'موعد الصيانة القادمة غير صحيح', 'لازم يكون بعد تاريخ التنفيذ.');
    const [partsCost, labor, extra] = costs().map(r2);
    const by = val('#vh-m-by'); if (by) settings.lastBy = by;
    const v = vById(vehicleId), now = new Date().toISOString(), requestId = q('#vh-m-req').value || '';
    const data = { requestId, date, type:q('#vh-m-type').value, problem:val('#vh-m-problem'), work, parts:val('#vh-m-parts'),
      partsCost, labor, extra, workshop:val('#vh-m-shop'), odometer:odo, nextDate, nextKm:nextKm || null, notes:val('#vh-m-notes'), atts:atts.get() };
    let rec;
    if (ex){
      const changed = reportChanges(ex, data);
      Object.assign(ex, data, { updatedAt:now });
      if (changed.length) ex.edits.push({ at:now, by, fields:changed });
      rec = ex;
    } else {
      const no = nextNo(reports);
      rec = { id:newId('mnt'), no, code:mCode(no), vehicleId, vSnap:snap(v), ...data, by, edits:[], createdAt:now, updatedAt:now };
      reports.push(rec);
      logEvent(v, `صيانة منفذة ${rec.code}: ${rec.type} — ${money(reportTotal(rec))}`, by);
    }
    // العداد: قراءة الصيانة الأحدث من قراءة المركبة تحدّثها
    if (odo != null && (v.odometer == null || odo > v.odometer)){ logEvent(v, `تحديث العداد من تقرير ${rec.code}: ${v.odometer != null ? num(v.odometer) : '—'} ← ${num(odo)} كم`, by); v.odometer = odo; v.odoDate = date; }
    v.updatedAt = now; flashId = rec.id;
    save(); sheet.close(); render();
    const linked = requestId ? qById(requestId) : null;
    notify({ type:'success', title: ex ? `تم حفظ تعديل ${rec.code}` : `تم حفظ تقرير الصيانة ${rec.code}`, page:'vehicles', duration:8000,
      msg:`${vName(v)} — ${rec.type}. الإجمالي ${money(reportTotal(rec))}.`,
      action:{ label:'عرض التقرير', fn:() => openReport(rec.id) } });
    // الطلب لا يُغلق تلقائياً: نسأل صراحة
    if (linked && isOpenReq(linked)){
      const ok = await confirmD({ title:`تحويل ${linked.code} إلى «مكتملة»؟`, msg:`التقرير ${rec.code} مرتبط بهذا الطلب وحالته «${REQ_STATUS[linked.status].label}». الطلب لا يُغلق إلا إذا أكّدت.`, okText:'نعم، مكتملة', cancelText:'ليس الآن', icon:'success' });
      if (ok) changeReqStatus(linked, 'done', 'أُنجز بتقرير ' + rec.code, by, date);
    }
  };
}
function reportChanges(ex, data){
  const L = { date:'التاريخ', type:'النوع', work:'الأعمال', parts:'القطع', partsCost:'تكلفة القطع', labor:'أجور العمل', extra:'الإضافية', workshop:'الورشة', odometer:'العداد', nextDate:'الموعد القادم', nextKm:'عداد الموعد القادم', requestId:'الطلب المرتبط', problem:'المشكلة', notes:'الملاحظات' };
  return Object.keys(L).filter(k => String(ex[k] ?? '') !== String(data[k] ?? '')).map(k => ['partsCost', 'labor', 'extra'].includes(k) ? `${L[k]}: ${money(ex[k])} ← ${money(data[k])}` : L[k])
    .concat((ex.atts || []).length !== data.atts.length ? ['المرفقات'] : []);
}

/* ---------- تفاصيل تقرير الصيانة ---------- */
function openReport(id){
  const m = mById(id); if (!m) return;
  const v = vById(m.vehicleId), req = m.requestId ? qById(m.requestId) : null;
  const sheet = App.sheet(`
    <div class="mk-form-head">${carIco(40)}<div><h3>${esc(m.code)} — ${esc(m.type)}</h3><p>${esc(v ? vName(v) : m.vSnap?.name)} · ${ltr(m.vSnap?.plate)} · ${fmtDate(m.date)}</p></div></div>
    <div class="mk-detail vh-detail">
      <div><small>الورشة</small><b>${esc(m.workshop) || '—'}</b></div><div><small>العداد وقت الصيانة</small><b class="num">${m.odometer != null ? num(m.odometer) + ' كم' : '—'}</b></div>
      <div><small>السائق وقتها</small><b>${esc(m.vSnap?.driver) || '—'}</b></div><div><small>الطلب المرتبط</small><b>${req ? `<button class="btn btn-sm" data-req>${esc(req.code)}</button>` : '—'}</b></div>
      <div><small>الموعد القادم</small><b>${m.nextDate ? fmtDate(m.nextDate) : ''}${m.nextDate && m.nextKm ? ' أو ' : ''}${m.nextKm ? num(m.nextKm) + ' كم' : ''}${!m.nextDate && !m.nextKm ? '—' : ''}</b></div><div><small>سجّله</small><b>${esc(m.by) || '—'}</b></div>
    </div>
    ${m.problem ? `<div class="vh-notes"><small>وصف المشكلة</small><p>${esc(m.problem)}</p></div>` : ''}
    <div class="vh-notes"><small>الأعمال المنفذة</small><p>${esc(m.work)}</p></div>
    ${m.parts ? `<div class="vh-notes"><small>قطع الغيار</small><p>${esc(m.parts)}</p></div>` : ''}
    <table class="mk-table vh-cost-table"><tbody>
      <tr><td>قطع الغيار</td><td class="num">${money(m.partsCost)}</td></tr><tr><td>أجور العمل</td><td class="num">${money(m.labor)}</td></tr>
      <tr><td>تكاليف إضافية</td><td class="num">${money(m.extra)}</td></tr><tr class="tot"><td>الإجمالي</td><td class="num">${money(reportTotal(m))}</td></tr></tbody></table>
    ${m.notes ? `<div class="vh-notes"><small>ملاحظات</small><p>${esc(m.notes)}</p></div>` : ''}
    <div class="vh-notes"><small>المرفقات</small>${attList(m.atts)}</div>
    ${m.edits.length ? `<div class="vh-notes"><small>سجل التعديلات</small>${m.edits.slice().reverse().map(e => `<p class="vh-edit"><span class="num">${fmtDateTime(e.at)}</span>${e.by ? ' — ' + esc(e.by) : ''}: ${esc(e.fields.join('، '))}</p>`).join('')}</div>` : ''}
    <div class="actions"><button class="btn btn-primary" data-edit>تعديل التقرير</button><button class="btn" data-print>طباعة</button><button class="btn btn-ghost" data-close>إغلاق</button></div>`, { cls:'wide' });
  const q = s => sheet.ov.querySelector(s);
  q('[data-close]').onclick = () => sheet.close();
  q('[data-edit]').onclick = () => { sheet.close(); openReportForm(m.id); };
  q('[data-print]').onclick = () => printReport(m.id);
  if (q('[data-req]')) q('[data-req]').onclick = () => { sheet.close(); openRequest(req.id); };
}

/* ---------- قائمة طلبات الصيانة ---------- */
function applyReqFilter(){
  rq = { q:$id('rq-q').value.trim(), veh:$id('rq-veh').value, status:$id('rq-status').value, pri:$id('rq-pri').value, from:$id('rq-from').value, to:$id('rq-to').value };
  renderReqs();
}
function filterRequests(f){
  showView('req', true);
  rq = Object.assign({ q:'', veh:'', status:'', pri:'', from:'', to:'' }, f);
  ['q', 'veh', 'status', 'pri', 'from', 'to'].forEach(k => $id('rq-' + k).value = rq[k]);
  renderReqs();
}
function reqMatches(r, f){
  if (f.veh && r.vehicleId !== f.veh) return false;
  if (f.status === 'open' ? !isOpenReq(r) : f.status && r.status !== f.status) return false;
  if (f.pri && r.priority !== f.pri) return false;
  if (f.from && r.date < f.from) return false;
  if (f.to && r.date > f.to) return false;
  if (f.q){ const t = toEn(f.q).toLowerCase(); if (![r.code, r.type, r.desc, r.reporter, r.vSnap?.name, r.vSnap?.plate, r.vSnap?.code].some(x => toEn(x).toLowerCase().includes(t))) return false; }
  return true;
}
const priRank = { urgent:0, high:1, normal:2, low:3 };
function reqRows(list){
  return list.map(r => `<tr class="${r.priority === 'urgent' && isOpenReq(r) ? 'vh-urgent' : ''}${r.id === flashId ? ' row-new' : ''}" onclick="VH.openRequest('${r.id}')">
    <td class="num"><b>${ltr(r.code)}</b></td><td class="num">${fmtDate(r.date)}</td><td>${esc(r.vSnap?.name)}<small class="vh-sub num">${ltr(r.vSnap?.code)}</small></td>
    <td>${esc(r.type)}</td><td>${priPill(r.priority)}</td><td>${reqPill(r.status)}</td>
    <td><div class="acts" onclick="event.stopPropagation()"><button class="ib" title="تحديث الحالة" aria-label="تحديث الحالة" onclick="VH.openReqStatus('${r.id}')">🔄</button><button class="ib" title="تعديل" aria-label="تعديل" onclick="VH.openRequestForm('${r.id}')">✏️</button></div></td></tr>`).join('');
}
function renderReqs(){
  const sel = $id('rq-veh'), cur = sel.value;
  sel.innerHTML = '<option value="">كل المركبات</option>' + vehOptions(cur, true); sel.value = cur;
  const list = requests.filter(r => reqMatches(r, rq)).sort((a, b) => (isOpenReq(b) - isOpenReq(a)) || (priRank[a.priority] - priRank[b.priority]) || byDateDesc(a, b));
  $id('rq-count').textContent = num(list.length);
  $id('rq-body').innerHTML = list.length ? reqRows(list) : `<tr><td colspan="7" class="mk-empty">${requests.length ? 'لا توجد طلبات مطابقة للفلتر.' : 'لا توجد طلبات صيانة بعد. سجّل أي عطل فور الإبلاغ عنه.'}</td></tr>`;
  flashId = null;
}

/* ---------- سجل الصيانة المنفذة ---------- */
function applyMntFilter(){
  mq = { veh:$id('mq-veh').value, type:$id('mq-type').value, from:$id('mq-from').value, to:$id('mq-to').value, sort:mq.sort };
  renderMnts();
}
function toggleMntSort(){ mq.sort = mq.sort === 'desc' ? 'asc' : 'desc'; renderMnts(); vib(6); }
function mntRows(list, withVeh){
  return list.map(m => `<tr class="${m.id === flashId ? 'row-new' : ''}" onclick="VH.openReport('${m.id}')">
    <td class="num"><b>${ltr(m.code)}</b></td><td class="num">${fmtDate(m.date)}</td>${withVeh ? `<td>${esc(m.vSnap?.name)}<small class="vh-sub num">${ltr(m.vSnap?.code)}</small></td>` : ''}
    <td>${esc(m.type)}</td><td>${esc(m.workshop) || '—'}</td><td class="num">${m.odometer != null ? num(m.odometer) : '—'}</td><td class="num"><b>${money(reportTotal(m))}</b></td>
    <td><div class="acts" onclick="event.stopPropagation()"><button class="ib" title="تعديل" aria-label="تعديل" onclick="VH.openReportForm('${m.id}')">✏️</button><button class="ib" title="طباعة" aria-label="طباعة" onclick="VH.printReport('${m.id}')">🖨</button></div></td></tr>`).join('');
}
function renderMnts(){
  const sel = $id('mq-veh'), cur = sel.value;
  sel.innerHTML = '<option value="">كل المركبات</option>' + vehOptions(cur, true); sel.value = cur;
  const ts = $id('mq-type'), tcur = ts.value;
  ts.innerHTML = '<option value="">كل الأنواع</option>' + [...new Set([...settings.types, ...reports.map(r => r.type)])].map(t => `<option>${esc(t)}</option>`).join(''); ts.value = tcur;
  let list = reports.filter(m => (!mq.veh || m.vehicleId === mq.veh) && (!mq.type || m.type === mq.type) && (!mq.from || m.date >= mq.from) && (!mq.to || m.date <= mq.to));
  list.sort(byDateDesc); if (mq.sort === 'asc') list.reverse();
  $id('mq-sort').textContent = mq.sort === 'desc' ? 'الأحدث أولاً ↓' : 'الأقدم أولاً ↑';
  const tot = list.reduce((s, m) => s + reportTotal(m), 0);
  $id('mq-count').textContent = num(list.length); $id('mq-total').textContent = money(tot);
  $id('mq-body').innerHTML = list.length ? mntRows(list, true) : `<tr><td colspan="8" class="mk-empty">${reports.length ? 'لا توجد تقارير مطابقة للفلتر.' : 'لا توجد صيانة مسجّلة بعد.'}</td></tr>`;
  flashId = null;
}

/* ---------- إدارة أنواع الصيانة ---------- */
function openTypes(){
  const draw = () => settings.types.map((t, i) => `<div class="vh-type-row"><span>${esc(t)}</span><span class="muted num">${num(requests.filter(r => r.type === t).length + reports.filter(r => r.type === t).length)} استخدام</span><button class="ib del" data-del="${i}" aria-label="حذف">🗑</button></div>`).join('');
  const sheet = App.sheet(`<div class="mk-form-head">${carIco(40)}<div><h3>أنواع الصيانة</h3><p>أضف أي نوع جديد ليظهر في الطلبات والتقارير. حذف نوع لا يغيّر السجلات القديمة.</p></div></div>
    <div class="vh-types" id="vh-types">${draw()}</div>
    <div class="mk-toolbar" style="margin-top:12px"><input class="mk-inp" id="vh-t-new" placeholder="نوع جديد، مثال: تغيير البطارية"><button class="btn btn-primary" data-add>إضافة</button></div>
    <div class="actions"><button class="btn" data-close>تم</button></div>`);
  const q = s => sheet.ov.querySelector(s);
  q('[data-close]').onclick = () => sheet.close();
  q('[data-add]').onclick = () => {
    const t = q('#vh-t-new').value.trim();
    if (!t) return markInvalid(q('#vh-t-new'), 'اكتب اسم النوع', '');
    if (settings.types.some(x => x.trim() === t)) return markInvalid(q('#vh-t-new'), 'النوع موجود مسبقاً', '');
    settings.types.push(t); save(); q('#vh-t-new').value = ''; q('#vh-types').innerHTML = draw();
    notify({ type:'success', title:'تمت إضافة نوع الصيانة', msg:t, log:false });
  };
  q('#vh-types').addEventListener('click', async e => {
    const b = e.target.closest('[data-del]'); if (!b) return;
    const i = +b.dataset.del, t = settings.types[i];
    if (settings.types.length <= 1) return notify({ type:'warning', title:'لازم يبقى نوع واحد على الأقل', log:false });
    settings.types.splice(i, 1); save(); q('#vh-types').innerHTML = draw();
    notify({ type:'success', title:'تم حذف النوع', msg:`«${t}» — السجلات القديمة بقيت كما هي.`, log:false, action:{ label:'تراجع', fn:() => { settings.types.splice(i, 0, t); save(); if (q('#vh-types')) q('#vh-types').innerHTML = draw(); } } });
  });
}

/* ---------- الصيانة الدورية: الفترات والمواعيد ---------- */
const DEFAULT_INTERVALS = { oilKm:5000, oilDays:90, perKm:10000, perDays:180, warnKm:500, warnDays:14, longDays:7 };
const IV_LABELS = { oilKm:'الزيت كل (كم)', oilDays:'الزيت كل (يوم)', perKm:'الدورية كل (كم)', perDays:'الدورية كل (يوم)' };
const globalIntervals = () => Object.assign({}, DEFAULT_INTERVALS, settings.intervals || {});
// فترات المركبة: ما تحدده لمركبتها يتقدّم على الافتراضي (٠ = بدون متابعة لهذا البند)
function intervalsOf(v){
  const g = globalIntervals(), o = v.intervals || {}, out = { ...g };
  ['oilKm', 'oilDays', 'perKm', 'perDays'].forEach(k => { if (o[k] !== undefined && o[k] !== null && o[k] !== '') out[k] = +o[k]; });
  return out;
}
function addDays(iso, n){ const d = new Date(iso.slice(0, 10) + 'T00:00:00'); d.setDate(d.getDate() + n); return localISO(d); }
function daysBetween(a, b){ return Math.round((new Date(b.slice(0, 10) + 'T00:00:00') - new Date(a.slice(0, 10) + 'T00:00:00')) / 86400000); }
// مواعيد المركبة: الزيت والدورية من آخر تقرير بنفس النوع (أو من تاريخ الإضافة)، والموعد المحدد يدوياً في آخر تقرير
function schedules(v){
  const iv = intervalsOf(v), out = [], today = todayISO(), odo = v.odometer;
  const evaluate = it => {
    const dLeft = it.dueDate ? daysBetween(today, it.dueDate) : null, kLeft = it.dueKm != null && odo != null ? it.dueKm - odo : null;
    it.daysLeft = dLeft; it.kmLeft = kLeft;
    it.state = (dLeft != null && dLeft <= 0) || (kLeft != null && kLeft <= 0) ? 'overdue'
      : (dLeft != null && dLeft <= iv.warnDays) || (kLeft != null && kLeft <= iv.warnKm) ? 'soon' : 'ok';
    const parts = [];
    if (dLeft != null) parts.push(dLeft < 0 ? `متأخر ${num(-dLeft)} يوم` : dLeft === 0 ? 'مستحق اليوم' : `بعد ${num(dLeft)} يوم`);
    if (kLeft != null) parts.push(kLeft < 0 ? `تجاوز ${num(-kLeft)} كم` : kLeft === 0 ? 'وصل العداد' : `متبقٍ ${num(kLeft)} كم`);
    it.text = parts.join(' أو ');
    return it;
  };
  const plan = (kind, label, type, km, days) => {
    if (!km && !days) return;
    const last = vReports(v.id).filter(r => r.type === type).sort(byDateDesc)[0];
    const baseDate = last ? last.date : (v.added || ''), baseKm = last ? (last.odometer ?? null) : (v.odoStart ?? null);
    out.push(evaluate({ kind, label, last, dueDate: days && baseDate ? addDays(baseDate, days) : '', dueKm: km && baseKm != null ? baseKm + km : null }));
  };
  plan('oil', 'تغيير زيت المحرك', 'تغيير زيت المحرك', iv.oilKm, iv.oilDays);
  plan('per', 'الصيانة الدورية', 'صيانة دورية', iv.perKm, iv.perDays);
  // الموعد المحدد في تقرير: يُعتبر منجزاً إذا سُجّل بعده تقرير من نفس النوع
  const np = nextPlanned(v.id);
  if (np){
    const done = vReports(v.id).some(r => r.id !== np.report.id && r.type === np.report.type && r.date > np.report.date);
    if (!done) out.push(evaluate({ kind:'custom', label:'موعد محدد: ' + np.report.type, last:np.report, dueDate:np.date, dueKm:np.km }));
  }
  return out;
}
// تنبيهات المركبات — مفتاح لكل حدث فلا يتكرر التنبيه نفسه
function vehicleAlerts(){
  const res = new Map(), iv = globalIntervals();
  const add = a => { if (!res.has(a.key)) res.set(a.key, a); };
  activeVehicles().forEach(v => {
    schedules(v).filter(s => s.state !== 'ok').forEach(s => add({ key:`${v.id}|${s.kind}`, vid:v.id, severity: s.state === 'overdue' ? 'high' : 'mid', kind:'due',
      title: `${s.label} — ${s.state === 'overdue' ? 'تجاوز الموعد' : 'اقترب الموعد'}`, due:[s.dueDate ? fmtDate(s.dueDate) : '', s.dueKm != null ? num(s.dueKm) + ' كم' : ''].filter(Boolean).join(' أو '), text:s.text }));
    vRequests(v.id).filter(r => isOpenReq(r) && r.priority === 'urgent').forEach(r => add({ key:`${v.id}|req|${r.id}`, vid:v.id, severity:'high', kind:'req', reqId:r.id,
      title:`طلب صيانة عاجل مفتوح ${r.code}`, due:fmtDate(r.date), text:`${r.type} — ${REQ_STATUS[r.status].label}` }));
    if (v.status === 'under' && v.statusSince){
      const d = daysBetween(v.statusSince, todayISO()), lim = iv.longDays;
      if (d > lim) add({ key:`${v.id}|long`, vid:v.id, severity:'mid', kind:'long', title:'تحت الصيانة لفترة طويلة', due:fmtDate(v.statusSince), text:`منذ ${num(d)} يوم (الحد ${num(lim)} أيام)` });
    }
  });
  const rank = { high:0, mid:1 };
  return [...res.values()].sort((a, b) => rank[a.severity] - rank[b.severity]);
}
const dueVehicles = () => new Set(vehicleAlerts().filter(a => a.kind === 'due').map(a => a.vid));

/* ---------- نموذج فترات الصيانة (للمركبة أو الافتراضية) ---------- */
function openIntervals(vehicleId){
  const v = vehicleId ? vById(vehicleId) : null, g = globalIntervals(), cur = v ? (v.intervals || {}) : g;
  const fields = v ? ['oilKm', 'oilDays', 'perKm', 'perDays'] : ['oilKm', 'oilDays', 'perKm', 'perDays', 'warnKm', 'warnDays', 'longDays'];
  const L = Object.assign({}, IV_LABELS, { warnKm:'نبّه قبل الموعد بـ (كم)', warnDays:'نبّه قبل الموعد بـ (يوم)', longDays:'«تحت الصيانة طويلاً» بعد (يوم)' });
  const sheet = App.sheet(`<div class="mk-form-head">${carIco(40)}<div><h3>${v ? 'فترات صيانة ' + esc(vName(v)) : 'الفترات الافتراضية للصيانة'}</h3>
      <p>${v ? 'اترك الحقل فارغاً لاستعمال الافتراضي، واكتب ٠ لإيقاف متابعة البند لهذه المركبة.' : 'تُطبَّق على كل مركبة لم تحدد فتراتها الخاصة. اكتب ٠ لإيقاف البند.'}</p></div></div>
    <div class="mk-grid">${fields.map(k => `<div class="mk-field"><label for="vh-iv-${k}">${L[k]}</label><input class="mk-inp num" inputmode="numeric" id="vh-iv-${k}" placeholder="${v ? 'الافتراضي: ' + g[k] : ''}" value="${cur[k] !== undefined && cur[k] !== null ? cur[k] : ''}"></div>`).join('')}</div>
    <div class="actions"><button class="btn btn-primary" data-save>حفظ</button>${v ? '<button class="btn" data-reset>رجوع للافتراضي</button>' : ''}<button class="btn" data-cancel>إلغاء</button></div>`);
  const q = s => sheet.ov.querySelector(s);
  q('[data-cancel]').onclick = () => sheet.close();
  if (q('[data-reset]')) q('[data-reset]').onclick = () => { v.intervals = {}; logEvent(v, 'فترات الصيانة: رجوع للافتراضي'); save(); sheet.close(); render(); notify({ type:'success', title:'رجعت فترات المركبة للافتراضي', log:false }); };
  q('[data-save]').onclick = () => {
    const out = {};
    for (const k of fields){
      const raw = q('#vh-iv-' + k).value.trim();
      if (!raw){ if (!v) return markInvalid(q('#vh-iv-' + k), 'الحقل مطلوب', 'اكتب رقماً، أو ٠ للإيقاف.'); continue; }
      const n = intVal(raw.replace(/[,٬]/g, ''));
      if (n == null || n < 0) return markInvalid(q('#vh-iv-' + k), 'رقم غير صحيح', 'اكتب رقماً صحيحاً موجباً أو ٠.');
      out[k] = n;
    }
    if (v){ v.intervals = out; logEvent(v, 'تعديل فترات الصيانة: ' + (Object.keys(out).map(k => `${IV_LABELS[k]} ${num(out[k])}`).join('، ') || 'الافتراضي')); v.updatedAt = new Date().toISOString(); }
    else settings.intervals = out;
    save(); sheet.close(); render();
    notify({ type:'success', title:'تم حفظ فترات الصيانة', msg:'التنبيهات تحدّثت حسب الفترات الجديدة.', page:'vehicles', log:false });
  };
}

/* ---------- فترة تكاليف الصيانة في اللوحة ---------- */
let costPeriod = { mode:'month', from:'', to:'' };
function periodRange(p){
  const d = new Date(), y = d.getFullYear(), m = d.getMonth();
  if (p.mode === 'month') return { from:localISO(new Date(y, m, 1)), to:localISO(new Date(y, m + 1, 0)), label:'هذا الشهر' };
  if (p.mode === 'prev') return { from:localISO(new Date(y, m - 1, 1)), to:localISO(new Date(y, m, 0)), label:'الشهر السابق' };
  if (p.mode === 'year') return { from:`${y}-01-01`, to:`${y}-12-31`, label:'هذه السنة' };
  return { from:p.from || '', to:p.to || '', label: p.from || p.to ? `${p.from ? fmtDate(p.from) : '…'} ← ${p.to ? fmtDate(p.to) : '…'}` : 'كل الفترات' };
}
const inRange = (date, from, to) => (!from || (date || '') >= from) && (!to || (date || '') <= to);
const costIn = (from, to, vid) => r2(reports.filter(m => (!vid || m.vehicleId === vid) && inRange(m.date, from, to)).reduce((s, m) => s + reportTotal(m), 0));
function setCostPeriod(mode){
  costPeriod.mode = mode;
  if (mode === 'custom' && $id('cp-from')){ costPeriod.from = $id('cp-from').value; costPeriod.to = $id('cp-to').value; }
  renderDash(); vib(6);
}
function openCostReports(){
  const r = periodRange(costPeriod);
  showView('mnt', true);
  $id('mq-from').value = r.from; $id('mq-to').value = r.to; $id('mq-veh').value = ''; $id('mq-type').value = '';
  applyMntFilter();
}

/* ---------- التقارير ---------- */
const REPORTS = [
  ['fleet',    'التقرير الشامل للمركبات'],
  ['vehicle',  'تقرير صيانة مركبة محددة'],
  ['requests', 'تقرير طلبات الصيانة'],
  ['costs',    'تقرير تكاليف الصيانة'],
  ['periodic', 'تقرير الصيانة الدورية'],
  ['drivers',  'تقرير السائقين'],
  ['expenses', 'تقرير المصروفات']
];
let repKind = 'fleet', repF = { veh:'', from:'', to:'', status:'', pri:'', group:'vehicle', archived:false }, lastRep = null;
// كل تقرير يُبنى مرة واحدة كبيانات خام: {title, sub, kpis, sections:[{title, cols:[{h,t}], rows, foot}]}
// ومنها تُولَّد المعاينة والطباعة وملف Excel، فلا تختلف الأرقام بين المخرجات
function buildReport(kind, f){
  const per = f.from || f.to ? `الفترة: ${f.from ? fmtDate(f.from) : 'البداية'} ← ${f.to ? fmtDate(f.to) : 'اليوم'}` : 'كل الفترات';
  const vSet = vehicles.filter(v => (f.archived || !v.archived) && (!f.veh || v.id === f.veh)).sort((a, b) => a.no - b.no);
  const repsIn = reports.filter(m => (!f.veh || m.vehicleId === f.veh) && inRange(m.date, f.from, f.to)).sort(byDateDesc);
  const T = { code:{ h:'الرقم', t:'text' }, date:{ h:'التاريخ', t:'date' } };
  const sum = (list, k) => r2(list.reduce((s, m) => s + (k === 'total' ? reportTotal(m) : (+m[k] || 0)), 0));
  if (kind === 'fleet'){
    const rows = vSet.map(v => { const l = lastReport(v.id); return [v.code, vName(v), v.plate || '', v.year || '', STATUS[v.status]?.label + (v.archived ? ' (مؤرشفة)' : ''), v.driver || '', v.odometer ?? '', l ? l.date : '', l ? l.type : '', costIn(f.from, f.to, v.id)]; });
    const c = {}; vSet.forEach(v => c[v.status] = (c[v.status] || 0) + 1);
    return { title:'التقرير الشامل للمركبات', sub:per + ' (لتكاليف الصيانة)', kpis:[['عدد المركبات', vSet.length, 'num'], ...STATUS_KEYS.map(k => [STATUS[k].label, c[k] || 0, 'num']), ['تكاليف الصيانة', r2(rows.reduce((s, r) => s + r[9], 0)), 'money']],
      sections:[{ title:'المركبات', cols:[T.code, { h:'المركبة', t:'text' }, { h:'اللوحة', t:'ltr' }, { h:'السنة', t:'text' }, { h:'الحالة', t:'text' }, { h:'السائق المسؤول', t:'text' }, { h:'العداد (كم)', t:'num' }, { h:'آخر صيانة', t:'date' }, { h:'نوعها', t:'text' }, { h:'تكلفة الصيانة', t:'money' }],
        rows, foot:['الإجمالي', '', '', '', '', '', '', '', '', r2(rows.reduce((s, r) => s + r[9], 0))] }] };
  }
  if (kind === 'vehicle'){
    const v = vById(f.veh); if (!v) return { error:'اختر المركبة أولاً.' };
    const list = repsIn.filter(m => m.vehicleId === v.id);
    return { title:`تقرير صيانة ${vName(v)} — ${v.code}`, sub:per, kpis:[['عدد عمليات الصيانة', list.length, 'num'], ['قطع الغيار', sum(list, 'partsCost'), 'money'], ['أجور العمل', sum(list, 'labor'), 'money'], ['إضافية', sum(list, 'extra'), 'money'], ['الإجمالي', sum(list, 'total'), 'money']],
      sections:[
        { title:'بيانات المركبة', cols:[{ h:'البند', t:'text' }, { h:'القيمة', t:'text' }], rows:[['الرقم الإداري', v.code], ['المركبة', vName(v)], ['اللوحة', v.plate || ''], ['سنة الصنع', String(v.year || '')], ['السائق المسؤول', v.driver || ''], ['العداد الحالي', v.odometer != null ? num(v.odometer) + ' كم' : ''], ['الحالة', STATUS[v.status]?.label]] },
        { title:'عمليات الصيانة', cols:[T.code, T.date, { h:'النوع', t:'text' }, { h:'الأعمال المنفذة', t:'text' }, { h:'الورشة', t:'text' }, { h:'العداد', t:'num' }, { h:'قطع الغيار', t:'money' }, { h:'أجور العمل', t:'money' }, { h:'إضافية', t:'money' }, { h:'الإجمالي', t:'money' }],
          rows:list.map(m => [m.code, m.date, m.type, m.work, m.workshop || '', m.odometer ?? '', +m.partsCost || 0, +m.labor || 0, +m.extra || 0, reportTotal(m)]),
          foot:['الإجمالي', '', '', '', '', '', sum(list, 'partsCost'), sum(list, 'labor'), sum(list, 'extra'), sum(list, 'total')] }] };
  }
  if (kind === 'requests'){
    const list = requests.filter(r => (!f.veh || r.vehicleId === f.veh) && (!f.pri || r.priority === f.pri) && (f.status === 'open' ? isOpenReq(r) : !f.status || r.status === f.status) && inRange(r.date, f.from, f.to)).sort(byDateDesc);
    const c = {}; list.forEach(r => c[r.status] = (c[r.status] || 0) + 1);
    return { title:'تقرير طلبات الصيانة', sub:per, kpis:[['عدد الطلبات', list.length, 'num'], ['المفتوحة', list.filter(isOpenReq).length, 'num'], ['المكتملة', c.done || 0, 'num'], ['الملغاة', c.cancelled || 0, 'num'], ['العاجلة', list.filter(r => r.priority === 'urgent').length, 'num']],
      sections:[
        { title:'حسب الحالة', cols:[{ h:'الحالة', t:'text' }, { h:'العدد', t:'num' }], rows:REQ_KEYS.map(k => [REQ_STATUS[k].label, c[k] || 0]), foot:['الإجمالي', list.length] },
        { title:'الطلبات', cols:[T.code, T.date, { h:'المركبة', t:'text' }, { h:'النوع', t:'text' }, { h:'الوصف', t:'text' }, { h:'الأولوية', t:'text' }, { h:'الحالة', t:'text' }, { h:'المُبلِّغ', t:'text' }, { h:'تاريخ الإغلاق', t:'date' }],
          rows:list.map(r => [r.code, r.date, `${r.vSnap?.name || ''} (${r.vSnap?.code || ''})`, r.type, r.desc, PRIORITY[r.priority]?.label, REQ_STATUS[r.status]?.label, r.reporter || '', r.closedAt || '']) }] };
  }
  if (kind === 'costs'){
    const rows = vSet.map(v => { const l = repsIn.filter(m => m.vehicleId === v.id); return [v.code, vName(v), l.length, sum(l, 'partsCost'), sum(l, 'labor'), sum(l, 'extra'), sum(l, 'total')]; }).filter(r => r[2] || !f.from && !f.to);
    const tot = i => r2(rows.reduce((s, r) => s + r[i], 0));
    return { title:'تقرير تكاليف الصيانة', sub:per, kpis:[['عمليات الصيانة', tot(2), 'num'], ['قطع الغيار', tot(3), 'money'], ['أجور العمل', tot(4), 'money'], ['إضافية', tot(5), 'money'], ['الإجمالي', tot(6), 'money']],
      sections:[{ title:'التكاليف لكل مركبة', cols:[T.code, { h:'المركبة', t:'text' }, { h:'عدد العمليات', t:'num' }, { h:'قطع الغيار', t:'money' }, { h:'أجور العمل', t:'money' }, { h:'إضافية', t:'money' }, { h:'الإجمالي', t:'money' }],
        rows, foot:['الإجمالي', '', tot(2), tot(3), tot(4), tot(5), tot(6)] }] };
  }
  if (kind === 'periodic'){
    const ST = { overdue:'متأخرة', soon:'قريبة', ok:'في موعدها' }, rows = [];
    vSet.filter(v => !v.archived).forEach(v => schedules(v).forEach(s => rows.push([v.code, vName(v), s.label, s.last ? s.last.date : '', s.dueDate, s.dueKm ?? '', v.odometer ?? '', ST[s.state], s.text])));
    const rank = { 'متأخرة':0, 'قريبة':1, 'في موعدها':2 }; rows.sort((a, b) => rank[a[7]] - rank[b[7]] || (a[4] || '9').localeCompare(b[4] || '9'));
    const filtered = f.status ? rows.filter(r => r[7] === ST[f.status]) : rows;
    return { title:'تقرير الصيانة الدورية', sub:'حسب الفترات المحددة لكل مركبة وآخر صيانة مسجّلة', kpis:[['متأخرة', rows.filter(r => r[7] === 'متأخرة').length, 'num'], ['قريبة', rows.filter(r => r[7] === 'قريبة').length, 'num'], ['في موعدها', rows.filter(r => r[7] === 'في موعدها').length, 'num']],
      sections:[{ title:'المواعيد', cols:[T.code, { h:'المركبة', t:'text' }, { h:'البند', t:'text' }, { h:'آخر تنفيذ', t:'date' }, { h:'الاستحقاق (تاريخ)', t:'date' }, { h:'الاستحقاق (كم)', t:'num' }, { h:'العداد الحالي', t:'num' }, { h:'الحالة', t:'text' }, { h:'التفاصيل', t:'text' }], rows:filtered }] };
  }
  if (kind === 'drivers'){
    const rows = [];
    vSet.forEach(v => (v.drivers || []).forEach(d => rows.push([d.name, d.phone || '', `${vName(v)} (${v.code})`, d.from || '', d.to || '', d.to ? 'سابق' : 'حالياً'])));
    rows.sort((a, b) => a[0].localeCompare(b[0], 'ar') || (b[3] || '').localeCompare(a[3] || ''));
    const names = new Set(rows.map(r => r[0])), current = rows.filter(r => !r[4]);
    return { title:'تقرير السائقين', sub:'السائقون والمركبات المسندة إليهم مع سجل الإسناد السابق', kpis:[['عدد السائقين', names.size, 'num'], ['إسنادات حالية', current.length, 'num'], ['إسنادات سابقة', rows.length - current.length, 'num']],
      sections:[
        { title:'الإسناد الحالي', cols:[{ h:'السائق', t:'text' }, { h:'الهاتف', t:'ltr' }, { h:'المركبة', t:'text' }, { h:'منذ', t:'date' }], rows:current.map(r => [r[0], r[1], r[2], r[3]]) },
        { title:'سجل الإسناد كاملاً', cols:[{ h:'السائق', t:'text' }, { h:'الهاتف', t:'ltr' }, { h:'المركبة', t:'text' }, { h:'من', t:'date' }, { h:'إلى', t:'date' }, { h:'الحالة', t:'text' }], rows }] };
  }
  if (kind === 'expenses'){
    const byMonth = f.group === 'month', groups = new Map();
    repsIn.forEach(m => { const k = byMonth ? (m.date || '').slice(0, 7) : `${m.vSnap?.name || ''} (${m.vSnap?.code || ''})`; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(m); });
    const keys = [...groups.keys()].sort((a, b) => byMonth ? b.localeCompare(a) : a.localeCompare(b, 'ar'));
    const AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
    const label = k => byMonth && k ? `${AR[+k.slice(5, 7) - 1]} ${k.slice(0, 4)}` : k;
    const rows = [];
    keys.forEach(k => { const l = groups.get(k);
      l.forEach(m => rows.push([m.code, m.date, byMonth ? `${m.vSnap?.name || ''} (${m.vSnap?.code || ''})` : m.type, m.parts || '', +m.partsCost || 0, +m.labor || 0, +m.extra || 0, reportTotal(m)]));
      rows.push({ cls:'sub', cells:[`مجموع ${label(k)}`, '', '', '', sum(l, 'partsCost'), sum(l, 'labor'), sum(l, 'extra'), sum(l, 'total')] }); });
    return { title:'تقرير المصروفات', sub:per + (byMonth ? ' — مجمّع حسب الشهر' : ' — مجمّع حسب المركبة'), kpis:[['قطع الغيار', sum(repsIn, 'partsCost'), 'money'], ['أجور العمل', sum(repsIn, 'labor'), 'money'], ['تكاليف إضافية', sum(repsIn, 'extra'), 'money'], ['الإجمالي', sum(repsIn, 'total'), 'money']],
      sections:[{ title:'تفاصيل المصروفات', cols:[T.code, T.date, { h: byMonth ? 'المركبة' : 'النوع', t:'text' }, { h:'قطع الغيار المستخدمة', t:'text' }, { h:'تكلفة القطع', t:'money' }, { h:'أجور العمل', t:'money' }, { h:'إضافية', t:'money' }, { h:'الإجمالي', t:'money' }],
        rows, foot:['الإجمالي العام', '', '', '', sum(repsIn, 'partsCost'), sum(repsIn, 'labor'), sum(repsIn, 'extra'), sum(repsIn, 'total')] }] };
  }
  return { error:'تقرير غير معروف' };
}
function fmtCell(v, t){
  if (v === '' || v == null) return '—';
  if (t === 'money') return money(v);
  if (t === 'num') return num(v);
  if (t === 'date') return fmtDate(v);
  if (t === 'ltr') return ltr(String(v));
  return esc(v);
}
function reportHTML(rep, print){
  const kpis = `<div class="${print ? 'kpis' : 'mk-kpis'}">${rep.kpis.map(([l, v, t]) => print ? `<div class="kpi"><div class="kv">${fmtCell(v, t)}</div><div class="kl">${esc(l)}</div></div>` : `<div class="mk-card mk-kpi"><small>${esc(l)}</small><b class="num">${fmtCell(v, t)}</b></div>`).join('')}</div>`;
  const secs = rep.sections.map(s => {
    const row = (cells, cls) => `<tr${cls ? ` class="${cls}"` : ''}>${cells.map((c, i) => `<td${s.cols[i] && ['money', 'num'].includes(s.cols[i].t) ? ' class="num"' : ''}>${cls && typeof c === 'string' ? esc(c) || '' : fmtCell(c, s.cols[i] && s.cols[i].t)}</td>`).join('')}</tr>`;
    const body = s.rows.length ? s.rows.map(r => Array.isArray(r) ? row(r) : row(r.cells, r.cls)).join('') : `<tr><td colspan="${s.cols.length}" class="${print ? '' : 'mk-empty'}" style="text-align:center">لا توجد بيانات</td></tr>`;
    return `${print ? `<h2>${esc(s.title)}</h2>` : `<div class="mk-title" style="margin-top:14px"><span>${esc(s.title)}</span><span class="pill info num">${num(s.rows.filter(Array.isArray).length)}</span></div>`}
      ${print ? '' : '<div class="mk-card mk-table-card"><div class="mk-scroll">'}<table class="${print ? '' : 'mk-table vh-table vh-rep-table'}"><thead><tr>${s.cols.map(c => `<th>${esc(c.h)}</th>`).join('')}</tr></thead><tbody>${body}${s.foot && s.rows.length ? row(s.foot, 'tot') : ''}</tbody></table>${print ? '' : '</div></div>'}`;
  }).join('');
  return kpis + secs;
}
function readRepForm(){
  repKind = $id('rp-kind').value;
  repF = { veh:$id('rp-veh').value, from:$id('rp-from').value, to:$id('rp-to').value, status:$id('rp-status').value, pri:$id('rp-pri').value, group:$id('rp-group').value, archived:$id('rp-arch').checked };
}
function syncRepForm(){
  const k = $id('rp-kind').value, show = (id, on) => { $id(id).closest('.mk-field').hidden = !on; };
  show('rp-from', !['periodic', 'drivers'].includes(k)); show('rp-to', !['periodic', 'drivers'].includes(k));
  show('rp-pri', k === 'requests'); show('rp-group', k === 'expenses'); show('rp-status', k === 'requests' || k === 'periodic');
  $id('rp-arch').closest('.vh-check').hidden = !['fleet', 'costs', 'drivers'].includes(k);
  const st = $id('rp-status'), cur = st.value;
  st.innerHTML = k === 'periodic' ? '<option value="">كل الحالات</option><option value="overdue">متأخرة</option><option value="soon">قريبة</option><option value="ok">في موعدها</option>'
    : '<option value="">كل الحالات</option><option value="open">المفتوحة</option>' + REQ_KEYS.map(s => `<option value="${s}">${REQ_STATUS[s].label}</option>`).join('');
  if ([...st.options].some(o => o.value === cur)) st.value = cur;
  $id('rp-veh-l').innerHTML = k === 'vehicle' ? 'المركبة <i>*</i>' : 'المركبة';
}
function runReport(){
  readRepForm();
  if (repKind === 'vehicle' && !repF.veh) return markInvalid($id('rp-veh'), 'اختر المركبة', 'تقرير صيانة مركبة محددة يحتاج مركبة.');
  if (repF.from && repF.to && repF.from > repF.to) return markInvalid($id('rp-to'), 'الفترة غير صحيحة', '«إلى» لازم يكون بعد «من».');
  const rep = buildReport(repKind, repF);
  if (rep.error) return notify({ type:'error', title:'تعذّر إنشاء التقرير', msg:rep.error, log:false });
  lastRep = rep;
  $id('rp-out').innerHTML = `<div class="vh-rep-head"><div><h3>${esc(rep.title)}</h3><p class="muted">${esc(rep.sub)} — أُنشئ ${fmtDateTime(new Date().toISOString())}</p></div>
    <div class="row"><button class="btn btn-sm" onclick="VH.exportReportExcel()">Excel</button><button class="btn btn-sm btn-primary" onclick="VH.printCurrentReport()">طباعة / PDF</button></div></div>${reportHTML(rep, false)}`;
  vib(8);
}
function printCurrentReport(){
  if (!lastRep) runReport(); if (!lastRep) return;
  const body = `<h1>${esc(lastRep.title)}</h1><div class="sub">${esc(lastRep.sub)} — تاريخ الإنشاء ${fmtDateTime(new Date().toISOString())}</div>${reportHTML(lastRep, true)}
    <div class="sig"><div class="s">أعدّه${settings.lastBy ? ': ' + esc(settings.lastBy) : ''}</div><div class="s">مسؤول الحركة</div><div class="s">اعتماد المدير</div></div>`;
  if (openPrintWindow(lastRep.title, body)) notify({ type:'info', title:'تم تجهيز التقرير للطباعة', msg:'اختر «حفظ بصيغة PDF» من نافذة الطباعة لو بدك ملف.', log:false });
}
function exportReportExcel(){
  if (!lastRep) runReport(); if (!lastRep) return;
  if (typeof XLSX === 'undefined') return notify({ type:'error', title:'مكتبة Excel غير محمّلة', msg:'أعد تحميل التطبيق ثم حاول مجدداً.' });
  try {
    const wb = XLSX.utils.book_new(), stamp = new Date();
    const sum = [[lastRep.title], [lastRep.sub], ['تاريخ الإنشاء', fmtDateTime(stamp.toISOString())], [], ['البند', 'القيمة'], ...lastRep.kpis.map(([l, v]) => [l, v])];
    const ws0 = XLSX.utils.aoa_to_sheet(sum); ws0['!cols'] = [{ wch:28 }, { wch:22 }];
    XLSX.utils.book_append_sheet(wb, ws0, 'الملخص');
    const used = new Set(['الملخص']);
    lastRep.sections.forEach(s => {
      const aoa = [s.cols.map(c => c.h), ...s.rows.map(r => (Array.isArray(r) ? r : r.cells).map((c, i) => s.cols[i] && s.cols[i].t === 'date' && c ? c : c))];
      if (s.foot && s.rows.length) aoa.push(s.foot);
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!cols'] = s.cols.map(c => ({ wch: c.t === 'text' ? 26 : 14 }));
      let name = s.title.slice(0, 28), i = 2; while (used.has(name)) name = s.title.slice(0, 25) + ' ' + i++;
      used.add(name); XLSX.utils.book_append_sheet(wb, ws, name);
    });
    const fname = `${lastRep.title.replace(/[\\/:*?"<>|—]/g, '').trim().replace(/\s+/g, '_')}_${todayISO()}.xlsx`;
    const buf = XLSX.write(wb, { bookType:'xlsx', type:'array' });
    const url = URL.createObjectURL(new Blob([buf], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    const a = document.createElement('a'); a.href = url; a.download = fname; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    notify({ type:'success', title:'تم تصدير التقرير إلى Excel', msg:`${fname} — تجده في مجلد التنزيلات.`, page:'vehicles' });
  } catch(e){ notify({ type:'error', title:'تعذّر تصدير Excel', msg:'السبب: ' + e.message }); }
}
function renderReportsView(){
  const sel = $id('rp-veh'), cur = sel.value;
  sel.innerHTML = '<option value="">كل المركبات</option>' + vehOptions(cur, true); sel.value = cur;
  syncRepForm();
}

/* ---------- الطباعة ---------- */
function openPrintWindow(title, body){
  const w = window.open('', '_blank');
  if (!w){ notify({ type:'error', title:'المتصفح منع نافذة الطباعة', msg:'اسمح بالنوافذ المنبثقة لهذا الموقع ثم أعد المحاولة.' }); return false; }
  w.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>${esc(title)}</title>
  <style>body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;direction:rtl;padding:24px;color:#111}
  h1{text-align:center;font-size:1.25rem;margin:8px 0 2px}.sub{text-align:center;color:#555;font-size:.85rem;margin-bottom:16px}
  h2{font-size:1rem;margin:22px 0 8px;padding-bottom:5px;border-bottom:2px solid #1B3B2F;color:#1B3B2F;page-break-after:avoid}
  table{width:100%;border-collapse:collapse;font-size:.82rem}thead{display:table-header-group}tr{page-break-inside:avoid}
  th{background:#1B3B2F;color:#fff;padding:7px 9px;text-align:right;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  td{border-bottom:1px solid #ddd;padding:6px 9px;vertical-align:top}
  tr.tot td{font-weight:bold;background:#e3efe8;-webkit-print-color-adjust:exact;print-color-adjust:exact}tr.sub td{font-weight:bold;background:#f0f6f2;-webkit-print-color-adjust:exact;print-color-adjust:exact}bdi{unicode-bidi:isolate}
  .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px 18px}.grid small{display:block;color:#666;font-size:.72rem}.grid b{font-size:.9rem}
  .kpis{display:flex;gap:9px;flex-wrap:wrap;margin-bottom:8px}.kpi{flex:1;min-width:105px;padding:10px;border-radius:7px;text-align:center;border:1px solid #ccc}
  .kv{font-size:1.1rem;font-weight:bold}.kl{font-size:.67rem;color:#555}
  .sig{margin-top:44px;display:flex;gap:30px;page-break-inside:avoid}.s{flex:1;text-align:center;border-top:1px solid #111;padding-top:6px;font-size:.82rem}
  .foot{margin-top:16px;font-size:.7rem;color:#888;text-align:center}@media print{body{padding:0}@page{size:A4;margin:14mm}}</style></head><body>
  ${window.App ? App.letterheadHTML() : ''}${body}
  <div class="foot">تقرير مُصدر إلكترونياً من النظام الإداري الموحّد — ${fmtDateTime(new Date().toISOString())}</div>
  <script>window.onload=()=>window.print();<\/script></body></html>`);
  w.document.close();
  return true;
}
function printVehicle(id){
  const v = vById(id); if (!v) return;
  const cell = (l, val) => `<div><small>${l}</small><b>${val || '—'}</b></div>`;
  const body = `<h1>ملف مركبة — ${esc(vName(v))}</h1><div class="sub">الرقم الإداري ${esc(v.code)} — تاريخ الإصدار ${fmtDate(todayISO())}</div>
    <h2>البيانات الأساسية</h2><div class="grid">
      ${cell('الرقم الإداري', esc(v.code))}${cell('الشركة المصنّعة', esc(v.make))}${cell('النوع والطراز', esc(v.model))}
      ${cell('رقم اللوحة', esc(v.plate))}${cell('سنة الصنع', esc(v.year))}${cell('اللون', esc(v.color))}
      ${cell('السائق المسؤول', esc(v.driver))}${cell('هاتف السائق', esc(v.driverPhone))}${cell('قراءة العداد', v.odometer != null ? num(v.odometer) + ' كم' : '')}
      ${cell('الحالة', (STATUS[v.status]?.label || '') + (v.archived ? ' (مؤرشفة)' : ''))}${cell('تاريخ الإضافة', fmtDate(v.added))}${cell('ملاحظات', esc(v.notes))}</div>
    ${v.drivers.length ? `<h2>سجل إسناد السائقين</h2><table><thead><tr><th>السائق</th><th>الهاتف</th><th>من</th><th>إلى</th></tr></thead><tbody>
      ${v.drivers.map(d => `<tr><td>${esc(d.name)}</td><td>${esc(d.phone) || '—'}</td><td>${fmtDate(d.from)}</td><td>${d.to ? fmtDate(d.to) : 'حالياً'}</td></tr>`).join('')}</tbody></table>` : ''}
    <h2>سجل المتابعة</h2><table><thead><tr><th>التاريخ</th><th>البيان</th><th>بواسطة</th></tr></thead><tbody>
      ${v.log.map(l => `<tr><td>${fmtDateTime(l.at)}</td><td>${esc(l.text)}</td><td>${esc(l.by) || '—'}</td></tr>`).join('') || '<tr><td colspan="3">لا يوجد</td></tr>'}</tbody></table>
    <div class="sig"><div class="s">مسؤول الحركة</div><div class="s">المدير الإداري</div></div>`;
  if (openPrintWindow('ملف مركبة ' + v.code, body)) notify({ type:'info', title:'تم تجهيز ملف المركبة للطباعة', msg:'اختر «حفظ بصيغة PDF» من نافذة الطباعة لو بدك ملف.', log:false });
}

function printReport(id){
  const m = mById(id); if (!m) return;
  const cell = (l, val) => `<div><small>${l}</small><b>${val || '—'}</b></div>`;
  const body = `<h1>تقرير صيانة ${esc(m.code)}</h1><div class="sub">${esc(m.vSnap?.name)} — ${esc(m.vSnap?.code)} — تاريخ التنفيذ ${fmtDate(m.date)}</div>
    <div class="grid">${cell('المركبة', esc(m.vSnap?.name))}${cell('الرقم الإداري', esc(m.vSnap?.code))}${cell('رقم اللوحة', esc(m.vSnap?.plate))}
      ${cell('السائق وقتها', esc(m.vSnap?.driver))}${cell('نوع الصيانة', esc(m.type))}${cell('الورشة', esc(m.workshop))}
      ${cell('العداد', m.odometer != null ? num(m.odometer) + ' كم' : '')}${cell('الطلب المرتبط', m.requestId ? esc(qById(m.requestId)?.code) : '')}${cell('الموعد القادم', [m.nextDate ? fmtDate(m.nextDate) : '', m.nextKm ? num(m.nextKm) + ' كم' : ''].filter(Boolean).join(' أو '))}</div>
    ${m.problem ? `<h2>وصف المشكلة</h2><p>${esc(m.problem)}</p>` : ''}<h2>الأعمال المنفذة</h2><p>${esc(m.work)}</p>${m.parts ? `<h2>قطع الغيار</h2><p>${esc(m.parts)}</p>` : ''}
    <h2>التكاليف</h2><table><tbody><tr><td>قطع الغيار</td><td>${money(m.partsCost)}</td></tr><tr><td>أجور العمل</td><td>${money(m.labor)}</td></tr><tr><td>تكاليف إضافية</td><td>${money(m.extra)}</td></tr>
      <tr><th>الإجمالي</th><th>${money(reportTotal(m))}</th></tr></tbody></table>${m.notes ? `<h2>ملاحظات</h2><p>${esc(m.notes)}</p>` : ''}
    <div class="sig"><div class="s">مسجّل التقرير${m.by ? ': ' + esc(m.by) : ''}</div><div class="s">مسؤول الحركة</div><div class="s">اعتماد المدير</div></div>`;
  if (openPrintWindow('تقرير صيانة ' + m.code, body)) notify({ type:'info', title:'تم تجهيز تقرير الصيانة للطباعة', msg:'اختر «حفظ بصيغة PDF» لو بدك ملف.', log:false });
}

/* ---------- تنبيهات الشاشة الرئيسية ---------- */
function alerts(){
  const act = activeVehicles(), res = [];
  const stopped = act.filter(v => v.status === 'stopped'), needs = act.filter(v => v.status === 'needs');
  const list = arr => arr.slice(0, 3).map(v => vName(v) + ' (' + v.code + ')').join('، ') + (arr.length > 3 ? ` و${num(arr.length - 3)} غيرها` : '');
  if (stopped.length) res.push({ severity:'high', title: stopped.length === 1 ? 'مركبة متوقفة عن العمل' : `${num(stopped.length)} مركبات متوقفة عن العمل`, subtitle:list(stopped), onOpen:() => filterStatus('stopped') });
  const urgent = requests.filter(r => isOpenReq(r) && r.priority === 'urgent');
  if (urgent.length) res.push({ severity:'high', title: urgent.length === 1 ? 'طلب صيانة عاجل مفتوح' : `${num(urgent.length)} طلبات صيانة عاجلة مفتوحة`, subtitle:urgent.slice(0, 3).map(r => `${r.code} — ${r.vSnap?.name || ''}`).join('، '), onOpen:() => filterRequests({ status:'open', pri:'urgent' }) });
  const due = vehicleAlerts().filter(a => a.kind === 'due'), over = due.filter(a => a.severity === 'high'), soon = due.filter(a => a.severity === 'mid');
  const vl = arr => [...new Set(arr.map(a => a.vid))].slice(0, 3).map(id => vName(vById(id))).join('، ');
  if (over.length) res.push({ severity:'high', title:`صيانة متأخرة لـ${num(new Set(over.map(a => a.vid)).size)} مركبة`, subtitle:vl(over), onOpen:() => showDueAlerts() });
  if (soon.length) res.push({ severity:'mid', title:`صيانة يقترب موعدها لـ${num(new Set(soon.map(a => a.vid)).size)} مركبة`, subtitle:vl(soon), onOpen:() => showDueAlerts() });
  if (needs.length) res.push({ severity:'mid', title: needs.length === 1 ? 'مركبة تحتاج إلى صيانة' : `${num(needs.length)} مركبات تحتاج إلى صيانة`, subtitle:list(needs), onOpen:() => filterStatus('needs') });
  return res;
}

/* ---------- التهيئة والعرض ---------- */
function init(){ buildUI(); load(); render(); }
function onShow(){
  // زر الرجوع في المتصفح: الحالة {veh} تفتح الملف، وغيابها يرجع للقائمة
  const st = history.state || {};
  if (st.veh && vById(st.veh)){ if (view !== 'file' || fileId !== st.veh){ fileId = st.veh; fileTab = 'info'; showView('file', true); fileId = st.veh; renderFile(); } }
  else if (view === 'file') showView('list', true);
  else render();
}

return {
  init, onShow, alerts, showView, applyFilter, filterStatus, openVehicleForm, openFile, closeFile, setFileTab,
  setStatus, toggleArchive, addNote, printVehicle, backupCollect, backupApply,
  openRequestForm, openReqStatus, openRequest, applyReqFilter, filterRequests, openReportForm, openReport, printReport,
  applyMntFilter, toggleMntSort, setFileSort, openTypes, openAttKey,
  openIntervals, setCostPeriod, openCostReports, showDueAlerts, syncRepForm, runReport, printCurrentReport, exportReportExcel, buildReport, schedules: id => schedules(vById(id)), vehicleAlerts,
  _data:{ get vehicles(){ return vehicles; }, get requests(){ return requests; }, get reports(){ return reports; }, get settings(){ return settings; } }
};
})();

window.NotificationRegistry = window.NotificationRegistry || {};
NotificationRegistry.vehicles = () => VH.alerts();
(window.MODULE_INITS = window.MODULE_INITS || []).push(VH.init);
// الصور تدخل النسخة الاحتياطية
(window.BACKUP_HOOKS = window.BACKUP_HOOKS || {}).vehicles = { collect:VH.backupCollect, apply:VH.backupApply };
