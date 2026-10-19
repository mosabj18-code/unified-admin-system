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
const DEFAULT_SETTINGS = { lastBy:'' };

/* ---------- الحالة ---------- */
let vehicles = [], requests = [], reports = [], settings = { ...DEFAULT_SETTINGS };
let view = 'dash', fileId = null, fileTab = 'info';
let fq = '', fStatus = '', showArchived = false, flashId = null;

/* ---------- أدوات ---------- */
const $id = id => document.getElementById('vh-' + id);
const notify  = (...a) => window.App ? App.notify(...a) : console.log(a);
const confirmD = o => window.App ? App.confirm(o) : Promise.resolve(window.confirm(o.title));
const vib = ms => window.App && App.vibrate(ms);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num = v => Number(Math.round((Number(v) || 0) * 100) / 100).toLocaleString('ar-EG', { maximumFractionDigits:2 });
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
const VIEWS = [['dash', 'لوحة التحكم', 'chart'], ['list', 'المركبات', 'vehicles']];
function buildUI(){
  const root = document.getElementById('page-vehicles');
  root.removeAttribute('data-placeholder');
  root.innerHTML = `
  <div class="mk-head" style="--tint:var(--accent-soft)">
    <div class="tile">${carIco()}</div>
    <div class="grow"><h2>إدارة المركبات</h2><p>ملف لكل مركبة: بياناتها والسائق المسؤول وحالتها وسجل متابعتها</p></div>
    <div class="mk-tools">
      <button class="btn btn-primary" onclick="VH.openVehicleForm()">مركبة جديدة</button>
    </div>
  </div>
  <div class="mk-tabs" role="tablist" id="vh-tabs">${VIEWS.map(([v, l, i]) => `<button class="mk-tab${v === 'dash' ? ' active' : ''}" id="vh-tab-${v}" role="tab" onclick="VH.showView('${v}')">${v === 'list' ? carIco(24) : ico(i)}${l}</button>`).join('')}</div>

  <section class="mk-view active" id="vh-view-dash">
    <div class="mk-kpis vh-kpis" id="vh-kpis"></div>
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

  <section class="mk-view" id="vh-view-file"></section>`;
}

function showView(v, silent){
  if (v !== 'file') fileId = null;
  view = v;
  VIEWS.forEach(([k]) => { const t = $id('tab-' + k); t.classList.toggle('active', k === v); t.setAttribute('aria-selected', k === v); });
  ['dash', 'list', 'file'].forEach(k => $id('view-' + k).classList.toggle('active', k === v));
  $id('tabs').hidden = v === 'file';
  render();
  if (silent !== true) vib(8);
}
function render(){
  if (view === 'dash') renderDash();
  else if (view === 'list') renderList();
  else if (view === 'file') renderFile();
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
    card('stopped', 'المركبات المتوقفة', c.stopped, 'bad', "VH.filterStatus('stopped')");
  const recent = activeVehicles().slice().sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')).slice(0, 6);
  $id('dash-recent').innerHTML = `<div class="mk-title"><span>آخر المركبات تحديثاً</span><button class="btn btn-sm" onclick="VH.showView('list')">كل المركبات</button></div>` +
    (recent.length ? `<div class="vh-mini">${recent.map(v => `<button class="vh-mini-row" onclick="VH.openFile('${v.id}')"><b>${esc(vName(v))}</b><span class="muted num">${esc(v.code)} · ${ltr(v.plate)}</span>${statusPill(v.status)}</button>`).join('')}</div>`
      : emptyState('لا توجد مركبات بعد', 'ابدأ بإضافة أول مركبة، وكل بياناتها وصيانتها رح تنحفظ بملفها.', '<button class="btn btn-primary" onclick="VH.openVehicleForm()">إضافة مركبة</button>'));
}
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
      const v = { id:newId('veh'), no, code:vCode(no), ...data, odometer:odo, odoDate: odo != null ? todayISO() : '', photo,
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
const FILE_TABS = [['info', 'البيانات الأساسية'], ['log', 'سجل المتابعة']];
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
  const lastLog = v.log[v.log.length - 1];
  el.innerHTML = `
    <div class="vh-file-head">
      <button class="btn btn-sm btn-ghost" onclick="VH.closeFile()" aria-label="رجوع">→ رجوع</button>
      <div class="vh-file-actions">
        <button class="btn btn-sm btn-primary" onclick="VH.openVehicleForm('${v.id}')">تعديل البيانات</button>
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
        </div>
        ${v.archived ? '' : `<div class="vh-status-row"><span class="muted">تغيير الحالة:</span>${STATUS_KEYS.map(k => `<button class="btn btn-sm${v.status === k ? ' btn-primary' : ''}" ${v.status === k ? 'disabled' : ''} onclick="VH.setStatus('${v.id}','${k}')">${STATUS[k].label}</button>`).join('')}</div>`}
      </div>
    </div>
    <div class="mk-tabs vh-file-tabs" role="tablist">${FILE_TABS.map(([k, l]) => `<button class="mk-tab${fileTab === k ? ' active' : ''}" role="tab" onclick="VH.setFileTab('${k}')">${l}${k === 'log' ? ` <span class="pill info num">${num(v.log.length)}</span>` : ''}</button>`).join('')}</div>
    <div id="vh-file-body">${fileTab === 'log' ? fileLog(v) : fileInfo(v)}</div>`;
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
    <div class="mk-card mk-pad mk-section"><div class="mk-title"><span>السائق المسؤول</span></div>
      <div class="mk-detail vh-detail">${row('الاسم', esc(v.driver))}${row('الهاتف', v.driverPhone ? `<a class="num" href="tel:${esc(v.driverPhone)}">${esc(v.driverPhone)}</a>` : '')}</div>
      ${drivers.length > 1 || (drivers[0] && drivers[0].to) ? `<div class="mk-title" style="margin-top:14px"><span>سجل إسناد السائقين</span></div>
        <div class="mk-scroll"><table class="mk-table"><thead><tr><th>السائق</th><th>الهاتف</th><th>من</th><th>إلى</th></tr></thead><tbody>
        ${drivers.map(d => `<tr><td>${esc(d.name)}</td><td class="num">${esc(d.phone) || '—'}</td><td class="num">${fmtDate(d.from)}</td><td class="num">${d.to ? fmtDate(d.to) : '<span class="pill ok">حالياً</span>'}</td></tr>`).join('')}</tbody></table></div>` : ''}
    </div>`;
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

/* ---------- تنبيهات الشاشة الرئيسية ---------- */
function alerts(){
  const act = activeVehicles(), res = [];
  const stopped = act.filter(v => v.status === 'stopped'), needs = act.filter(v => v.status === 'needs');
  const list = arr => arr.slice(0, 3).map(v => vName(v) + ' (' + v.code + ')').join('، ') + (arr.length > 3 ? ` و${num(arr.length - 3)} غيرها` : '');
  if (stopped.length) res.push({ severity:'high', title: stopped.length === 1 ? 'مركبة متوقفة عن العمل' : `${num(stopped.length)} مركبات متوقفة عن العمل`, subtitle:list(stopped), onOpen:() => filterStatus('stopped') });
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
  _data:{ get vehicles(){ return vehicles; }, get requests(){ return requests; }, get reports(){ return reports; }, get settings(){ return settings; } }
};
})();

window.NotificationRegistry = window.NotificationRegistry || {};
NotificationRegistry.vehicles = () => VH.alerts();
(window.MODULE_INITS = window.MODULE_INITS || []).push(VH.init);
// الصور تدخل النسخة الاحتياطية
(window.BACKUP_HOOKS = window.BACKUP_HOOKS || {}).vehicles = { collect:VH.backupCollect, apply:VH.backupApply };
