// إدارة المركبات: الأيقونة والتسجيل والترقيم ومنع التكرار والبحث والحالة والسائق والأرشفة والملف والنسخة الاحتياطية
const { chromium } = require('playwright');
const SHOT = n => { const p = require('path'), f = require('fs'); const d = process.env.SHOT_DIR || p.join(__dirname, '..', 'screenshots'); f.mkdirSync(d, { recursive:true }); return p.join(d, n); };
const URL = (process.env.BASE_URL || 'http://localhost:8765') + '/unified-admin/index.html';
let pass = 0, fail = [];
const ok = (c, m) => { if (c) pass++; else fail.push(m); console.log((c ? '  ✔ ' : '  ✘ ') + m); };
(async () => {
const b = await chromium.launch({ ...(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {}) });
const ctx = await b.newContext({ viewport:{ width:390, height:844 } });
const p = await ctx.newPage(); const errs = [];
p.on('console', m => { if (m.type() === 'error' && !/403|favicon|Failed to load resource/.test(m.text())) errs.push(m.text()); });
p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
await p.goto(URL); await p.waitForTimeout(800);
await p.evaluate(() => {
  localStorage.setItem('unified_settings', JSON.stringify({ onboarded:true, installNever:true, lastSeenVersion:'9.9.9', haptics:false }));
  sessionStorage.setItem('installShown', '1');
  ['veh_v','veh_q','veh_m','veh_s'].forEach(k => localStorage.removeItem(k));
});
await p.reload(); await p.waitForTimeout(1500);
const clean = async () => { for (let k = 0; k < 3; k++){ await p.keyboard.press('Escape'); await p.waitForTimeout(120); } await p.evaluate(() => { document.querySelectorAll('.overlay').forEach(e => e.remove()); document.getElementById('toasts').innerHTML = ''; }); };
await clean();

// ١. الأيقونة في القائمة الجانبية: مسطّحة SVG بنفس مقاس الأقسام
const nav = await p.evaluate(() => {
  const btn = document.querySelector('#sbNav .nav-item[data-page="vehicles"]');
  const other = document.querySelector('#sbNav .nav-item[data-page="custody"] .i3d, #sbNav .nav-item[data-page="custody"] .i3d-fb');
  const svg = btn && btn.querySelector('svg.i3d-flat');
  return { exists:!!btn, label: btn && btn.textContent.trim(), svg:!!svg, w: svg && svg.getBoundingClientRect().width, ow: other && other.getBoundingClientRect().width };
});
ok(nav.exists && /إدارة المركبات/.test(nav.label), 'عنصر «إدارة المركبات» في القائمة الجانبية');
ok(nav.svg, 'الأيقونة SVG مسطّحة (ليست صورة ثلاثية الأبعاد)');
ok(nav.w && nav.ow && Math.abs(nav.w - nav.ow) < 1, `مقاس الأيقونة مطابق للأقسام الأخرى (${nav.w} / ${nav.ow})`);
ok(await p.evaluate(() => document.querySelectorAll('#sbNav .nav-item svg.i3d-flat').length === 1), 'باقي أيقونات القائمة لم تتغيّر');

// ٢. الدخول للوحدة: لوحة التحكم بأصفار حقيقية وحالة فارغة
await p.evaluate(() => App.switchModule('vehicles')); await p.waitForTimeout(500);
ok(await p.evaluate(() => document.querySelector('#page-vehicles h2').textContent.trim() === 'إدارة المركبات'), 'عنوان الوحدة');
ok(await p.evaluate(() => [...document.querySelectorAll('#vh-kpis b')].every(x => x.textContent.trim() === '٠')), 'بطاقات اللوحة كلها صفر بدون بيانات تجريبية');
ok(await p.locator('#vh-dash-recent .vh-empty').count() === 1, 'حالة فارغة مع زر إضافة');
await p.screenshot({ path:SHOT('veh_dash_empty_mobile.png') });

// ٣. إضافة مركبة
const addVehicle = async (o) => {
  await p.evaluate(() => VH.openVehicleForm()); await p.waitForTimeout(300);
  for (const [id, v] of Object.entries(o)) await p.fill('.overlay #vh-f-' + id, String(v));
  await p.locator('.overlay [data-save]').click(); await p.waitForTimeout(350);
};
await p.evaluate(() => VH.openVehicleForm()); await p.waitForTimeout(300);
ok(/VEH-001/.test(await p.textContent('.overlay .mk-form-head')), 'الرقم الإداري المقترح VEH-001');
await p.locator('.overlay [data-save]').click(); await p.waitForTimeout(200);
ok(await p.evaluate(() => document.querySelector('.overlay #vh-f-make').classList.contains('invalid')), 'الحقل الناقص يتلوّن أحمر');
await clean();
await addVehicle({ make:'Kia', model:'Forte', plate:'12-345-67', year:'2019', color:'أبيض', driver:'أحمد محمود', phone:'0599123456', odo:'85000', by:'مصعب' });
let V = await p.evaluate(() => VH._data.vehicles);
ok(V.length === 1 && V[0].code === 'VEH-001' && V[0].odometer === 85000, 'المركبة الأولى محفوظة VEH-001 بعداد ٨٥٠٠٠');
ok(V[0].drivers.length === 1 && V[0].drivers[0].name === 'أحمد محمود', 'سجل الإسناد بدأ بالسائق');
ok(V[0].log.length === 1 && V[0].log[0].by === 'مصعب', 'سجل المتابعة: إضافة المركبة باسم المُدخِل');
ok(await p.evaluate(() => JSON.parse(localStorage.getItem('veh_s')).lastBy === 'مصعب'), 'اسم المُدخِل محفوظ للمرة القادمة');
await clean();

// ٤. منع تكرار اللوحة حتى مع اختلاف الشرطات والمسافات والأرقام العربية
await addVehicle({ make:'Toyota', model:'Hilux', plate:'١٢ ٣٤٥ ٦٧' });
ok(await p.evaluate(() => VH._data.vehicles.length) === 1, 'لوحة مكررة (بأرقام عربية ومسافات) مرفوضة');
ok(await p.evaluate(() => document.querySelector('.overlay #vh-f-plate').classList.contains('invalid')), 'حقل اللوحة يتلوّن أحمر');
await clean();
await addVehicle({ make:'Toyota', model:'Hilux', plate:'88-111-22', driver:'خالد يوسف' });
await clean();
await addVehicle({ make:'Hyundai', model:'H1', plate:'55-222-33' });
await clean();
V = await p.evaluate(() => VH._data.vehicles.map(v => v.code));
ok(V.join() === 'VEH-001,VEH-002,VEH-003', 'الترقيم متسلسل VEH-001..003');

// ٥. البحث والفلترة
await p.evaluate(() => VH.showView('list'));
const shown = async q => { await p.fill('#vh-q', q); await p.waitForTimeout(120); return p.locator('#vh-grid .vh-card').count(); };
ok(await shown('VEH-002') === 1, 'البحث بالرقم الإداري');
ok(await shown('8811122') === 1, 'البحث باللوحة بدون شرطات');
ok(await shown('أحمد') === 1, 'البحث باسم السائق');
ok(await shown('hilux') === 1, 'البحث بالنوع (بدون حساسية للأحرف)');
await shown('');
ok(await p.locator('#vh-grid .vh-card').count() === 3, 'كل المركبات تظهر بدون بحث');

// ٦. تغيير الحالة مع تسجيلها وتراجع
const id1 = await p.evaluate(() => VH._data.vehicles[0].id);
await p.evaluate(id => VH.setStatus(id, 'under'), id1); await p.waitForTimeout(150);
ok(await p.evaluate(() => VH._data.vehicles[0].status === 'under' && /تحت الصيانة/.test(VH._data.vehicles[0].log.at(-1).text)), 'تغيير الحالة مسجّل في المتابعة');
await p.selectOption('#vh-f-status', 'under'); await p.waitForTimeout(100);
ok(await p.locator('#vh-grid .vh-card').count() === 1, 'فلترة حسب الحالة');
await p.selectOption('#vh-f-status', ''); await p.waitForTimeout(100);

// ٧. لوحة التحكم تعكس البيانات والضغط على بطاقة يفتح القائمة المفلترة
await p.evaluate(() => VH.showView('dash')); await p.waitForTimeout(150);
const k = await p.evaluate(() => [...document.querySelectorAll('#vh-kpis .mk-kpi')].map(x => x.querySelector('small').textContent + '=' + x.querySelector('b').textContent));
ok(k.includes('إجمالي المركبات=٣') && k.includes('المركبات الجاهزة=٢') && k.includes('تحت الصيانة=١'), 'إحصائيات اللوحة صحيحة (' + k.join('، ') + ')');
await p.locator('#vh-kpis .mk-kpi', { hasText:'تحت الصيانة' }).click(); await p.waitForTimeout(200);
ok(await p.evaluate(() => document.getElementById('vh-view-list').classList.contains('active') && document.getElementById('vh-f-status').value === 'under'), 'الضغط على البطاقة يفتح القائمة المفلترة');
await p.screenshot({ path:SHOT('veh_list_mobile.png') });

// ٨. ملف المركبة وتغيير السائق مع الاحتفاظ بالإسناد السابق
await p.evaluate(id => VH.openFile(id), id1); await p.waitForTimeout(300);
ok(await p.evaluate(() => document.getElementById('vh-view-file').classList.contains('active') && document.getElementById('vh-tabs').hidden), 'ملف المركبة يفتح كصفحة كاملة');
ok(/Kia Forte/.test(await p.textContent('#vh-view-file h2')), 'عنوان الملف: Kia Forte');
await p.screenshot({ path:SHOT('veh_file_mobile.png') });
await p.evaluate(id => VH.openVehicleForm(id), id1); await p.waitForTimeout(300);
await p.fill('.overlay #vh-f-driver', 'سامي عادل'); await p.fill('.overlay #vh-f-odo', '86200');
await p.locator('.overlay [data-save]').click(); await p.waitForTimeout(350);
V = await p.evaluate(() => VH._data.vehicles[0]);
ok(V.driver === 'سامي عادل' && V.drivers.length === 2 && V.drivers[0].to && !V.drivers[1].to, 'تغيير السائق يغلق فترة السابق ويفتح فترة الجديد');
ok(/السائق: أحمد محمود ← سامي عادل/.test(V.log.at(-1).text) && /العداد/.test(V.log.at(-1).text), 'التعديل مسجّل بالتفصيل في سجل المتابعة');
await p.evaluate(id => VH.openVehicleForm(id), id1); await p.waitForTimeout(300);
await p.fill('.overlay #vh-f-odo', '1000'); await p.locator('.overlay [data-save]').click(); await p.waitForTimeout(350);
ok(await p.locator('.overlay h3', { hasText:'العداد أقل' }).count() === 1, 'تأكيد قبل إنقاص قراءة العداد');
await p.locator('.overlay button', { hasText:'رجوع' }).last().click(); await p.waitForTimeout(250);
ok(await p.evaluate(() => VH._data.vehicles[0].odometer) === 86200, 'العداد لم يتغيّر عند التراجع');
await clean();
await p.evaluate(() => VH.setFileTab('log')); await p.waitForTimeout(150);
ok(await p.locator('#vh-view-file .vh-timeline li').count() >= 3, 'تبويب سجل المتابعة يعرض الأحداث');

// ٩. زر الرجوع في المتصفح يعيد للقائمة
await p.goBack(); await p.waitForTimeout(400);
ok(await p.evaluate(() => document.getElementById('vh-view-list').classList.contains('active')), 'زر الرجوع يعيد من الملف إلى القائمة');

// ١٠. الأرشفة مع تأكيد وتراجع، والمؤرشفة تخرج من الإحصائيات
const id3 = await p.evaluate(() => VH._data.vehicles[2].id);
await p.evaluate(id => { VH.toggleArchive(id); }, id3); await p.waitForTimeout(300);
ok(await p.locator('.overlay h3', { hasText:'أرشفة' }).count() === 1, 'تأكيد قبل الأرشفة');
await p.locator('.overlay [data-ok]').click(); await p.waitForTimeout(300);
ok(await p.evaluate(() => VH._data.vehicles[2].archived === true), 'المركبة مؤرشفة');
await p.evaluate(() => VH.showView('dash')); await p.waitForTimeout(150);
ok(/إجمالي المركبات/.test(await p.textContent('#vh-kpis')) && await p.evaluate(() => document.querySelector('#vh-kpis b').textContent.trim()) === '٢', 'المؤرشفة لا تُحسب في الإجمالي');
await p.evaluate(() => VH.showView('list')); await p.selectOption('#vh-f-status', ''); await p.check('#vh-f-arch'); await p.waitForTimeout(150);
ok(await p.locator('#vh-grid .vh-card').count() === 1, 'فلتر المؤرشفة يعرضها');
await p.uncheck('#vh-f-arch');

// ١١. النسخة الاحتياطية تشمل بيانات المركبات، والإعدادات لا تُعدّ سجلات
const bk = await p.evaluate(async () => {
  const oURL = URL.createObjectURL, oClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function(){};
  const r = await new Promise(res => { URL.createObjectURL = blob => { blob.text().then(res); return oURL(blob); }; App.exportBackup({ silent:true, prefix:'t' }); });
  URL.createObjectURL = oURL; HTMLAnchorElement.prototype.click = oClick;
  return JSON.parse(r);
});
ok(bk.modules.vehicles && JSON.parse(bk.modules.vehicles.veh_v).length === 3 && 'veh_s' in bk.modules.vehicles, 'النسخة الاحتياطية فيها المركبات والإعدادات');
await p.evaluate(() => App.switchModule('home')); await p.waitForTimeout(300);
ok(/٣ سجل/.test(await p.evaluate(() => [...document.querySelectorAll('.mod-card')].find(c => c.textContent.includes('إدارة المركبات'))?.textContent || '')), 'بطاقة الوحدة بالرئيسية تعدّ ٣ سجلات (بدون الإعدادات)');

// ١٢. التنبيهات: مركبة تحت الصيانة لا تنبّه، ومتوقفة تنبّه
await p.evaluate(() => App.switchModule('vehicles')); await p.waitForTimeout(200);
const id2 = await p.evaluate(() => VH._data.vehicles[1].id);
await p.evaluate(id => VH.setStatus(id, 'stopped'), id2); await p.waitForTimeout(150);
ok(await p.evaluate(() => VH.alerts().some(a => a.severity === 'high' && /متوقفة/.test(a.title))), 'تنبيه عاجل لمركبة متوقفة');

// لقطة كمبيوتر
await p.setViewportSize({ width:1280, height:860 }); await p.waitForTimeout(300);
await clean(); await p.evaluate(() => VH.showView('list')); await p.waitForTimeout(200);
await p.screenshot({ path:SHOT('veh_list_desktop.png') });

console.log('\n=== نجح (' + pass + ') === فشل (' + fail.length + ') ===');
fail.forEach(f => console.log('  - ' + f));
console.log('\n=== أخطاء الكونسول ===\n' + (errs.length ? errs.join('\n') : 'لا يوجد'));
await b.close();
process.exit(fail.length || errs.length ? 1 : 0);
})();
