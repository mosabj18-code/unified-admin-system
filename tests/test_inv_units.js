// مخزون الطعام: الوحدات المتعددة (كرتونة = ٢٧ حبة) — الإضافة والصرف المختلط والتوحيد ومنع السالب
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
// بيانات نظيفة: لا إضافات ولا صرف
await p.evaluate(() => {
  localStorage.setItem('unified_settings', JSON.stringify({ onboarded:true, installNever:true, lastSeenVersion:'2.15.0', haptics:false }));
  sessionStorage.setItem('installShown', '1');
  localStorage.setItem('inv_a', '[]'); localStorage.setItem('inv_w', '[]'); localStorage.removeItem('inv_p');
});
await p.reload(); await p.waitForTimeout(1500);
for (let k = 0; k < 4; k++){ await p.keyboard.press('Escape'); await p.waitForTimeout(150); await p.evaluate(() => document.querySelectorAll('.overlay').forEach(e => e.remove())); }
await p.evaluate(() => App.switchModule('inventory')); await p.waitForTimeout(600);
const stockOf = () => p.evaluate(() => INV.computeStock().filter(s => s.name === 'جبنة'));
const bal = async () => { const s = await stockOf(); return s.length === 1 ? s[0].balance : s.map(x => x.unit + ':' + x.balance).join(','); };
const fill = async (sel, v) => { await p.fill(sel, String(v)); };

// ١. الإضافة: ٥ كراتين × ٢٧ حبة
await p.evaluate(() => INV.switchTab('in'));
await fill('#inv-in-name', 'جبنة');
await p.selectOption('#inv-in-unit', 'كرتونة'); await p.waitForTimeout(100);
ok(await p.isVisible('#inv-in-per'), 'اختيار «كرتونة» يظهر حقل عدد الحبات');
ok(await p.isVisible('#inv-in-base'), 'ويظهر حقل الوحدة الصغرى');
await p.selectOption('#inv-in-base', 'حبة');
await fill('#inv-in-per', 27); await fill('#inv-in-qty', 5); await p.waitForTimeout(100);
ok(/١٣٥ حبة/.test(await p.textContent('#inv-in-pack-hint')), 'التلميح يعرض ٥ كرتونة = ١٣٥ حبة');
await p.evaluate(() => { INV.addItem(); }); await p.waitForTimeout(400);
ok(await bal() === 135, 'المخزون بعد الإضافة = ١٣٥ حبة (صار ' + await bal() + ')');
ok(await p.evaluate(() => JSON.parse(localStorage.getItem('inv_p'))['جبنة'].per === 27), 'التعبئة محفوظة في inv_p');
ok(await p.evaluate(() => INV._data.additions.at(-1).per === 27), 'سجل الإضافة يحفظ معامله ٢٧');

// ٢. الصرف بالكرتونة: ٢ كرتونة = ٥٤ حبة
await p.evaluate(() => INV.switchTab('out'));
await p.selectOption('#inv-out-name', 'جبنة||حبة'); await p.waitForTimeout(100);
const units = await p.$$eval('#inv-out-unit option', o => o.map(x => x.value));
ok(units.join() === 'حبة,كرتونة', 'وحدة الصرف فيها حبة وكرتونة (' + units.join('،') + ')');
ok(/٥ كرتونة \(١٣٥ حبة\)/.test(await p.inputValue('#inv-out-balance')), 'الرصيد المتاح يظهر ٥ كرتونة (١٣٥ حبة)');
const outRow = async (unit, qty) => {
  await p.selectOption('#inv-out-name', 'جبنة||حبة'); await p.waitForTimeout(80);
  await p.selectOption('#inv-out-unit', unit); await fill('#inv-out-qty', qty); await fill('#inv-out-dept', 'سجن الوسطى');
  await p.waitForTimeout(80);
  await p.evaluate(() => INV.withdrawItem()); await p.waitForTimeout(250);
};
await p.selectOption('#inv-out-unit', 'كرتونة'); await fill('#inv-out-qty', 2); await p.waitForTimeout(80);
ok(/٥٤ حبة/.test(await p.textContent('#inv-out-pack-hint')), 'تلميح الصرف: ٢ كرتونة = ٥٤ حبة قبل التنفيذ');
await outRow('كرتونة', 2);
ok(await bal() === 81, 'بعد صرف ٢ كرتونة: ٨١ حبة (صار ' + await bal() + ')');
ok(await p.evaluate(() => { const w = INV._data.withdrawals.at(-1); return w.unit === 'كرتونة' && w.qty === 2 && w.per === 27; }), 'سجل الصرف محفوظ كما أُدخل: ٢ كرتونة بمعامل ٢٧');

// ٣. الصرف بالحبة: ٥ حبات
await outRow('حبة', 5);
ok(await bal() === 76, 'بعد صرف ٥ حبات: ٧٦ حبة (صار ' + await bal() + ')');
await p.evaluate(() => INV.switchTab('stock')); await p.waitForTimeout(250);
const row = await p.evaluate(() => [...document.querySelectorAll('#inv-stock-tbody tr')].find(t => t.textContent.includes('جبنة'))?.textContent || '');
ok(/٢ كرتونة \+ ٢٢ حبة/.test(row), 'جدول المخزون يعرض ٢ كرتونة + ٢٢ حبة');
ok(/١ كرتونة = ٢٧ حبة/.test(row), 'جدول المخزون يعرض التعبئة');

// ٤. منع الرصيد السالب: ٣ كراتين = ٨١ > ٧٦
await p.evaluate(() => INV.switchTab('out'));
await outRow('كرتونة', 3);
ok(await bal() === 76, 'صرف ٣ كراتين (٨١ حبة) من ٧٦ مرفوض');
ok(await p.evaluate(() => document.getElementById('inv-out-qty').classList.contains('invalid')), 'حقل الكمية يتلوّن أحمر عند الرفض');
await outRow('حبة', 77);
ok(await bal() === 76, 'صرف ٧٧ حبة من ٧٦ مرفوض');

// ٥. الصرف المختلط من البداية: ١٣٥ − (٢٧ + ٥ + ٥٤) = ٤٩
await p.evaluate(() => { INV._data.withdrawals.length = 0; localStorage.setItem('inv_w', '[]'); INV.renderStockTable(); });
await outRow('كرتونة', 1); await outRow('حبة', 5); await outRow('كرتونة', 2);
ok(await bal() === 49, 'الصرف المختلط ١ كرتونة + ٥ حبات + ٢ كرتونة يترك ٤٩ حبة (صار ' + await bal() + ')');
ok(/١ كرتونة \+ ٢٢ حبة \(٤٩ حبة\)/.test(await p.evaluate(() => document.querySelector('#inv-out-name option[value="جبنة||حبة"]').textContent)), 'قائمة الأصناف تعرض ١ كرتونة + ٢٢ حبة (٤٩ حبة)');

// ٦. تعديل صرف بالكرتونة يحسب الرصيد مع السجل نفسه
const lastIdx = await p.evaluate(() => INV._data.withdrawals.length - 1);
await p.evaluate(i => INV.editOut(i), lastIdx); await p.waitForTimeout(300);
ok(await p.inputValue('#inv-out-unit') === 'كرتونة', 'التعديل يرجع وحدة الصرف «كرتونة»');
ok(/١٠٣ حبة/.test(await p.inputValue('#inv-out-balance')), 'الرصيد عند التعديل يشمل كمية السجل (٤٩ + ٥٤ = ١٠٣)');
await fill('#inv-out-qty', 3); await p.evaluate(() => INV.withdrawItem()); await p.waitForTimeout(250);
ok(await bal() === 22, 'تعديل الصرف إلى ٣ كراتين يترك ٢٢ حبة (صار ' + await bal() + ')');

// ٧. تغيير التعبئة لاحقاً لا يغيّر الحساب القديم
await p.evaluate(() => INV.switchTab('stock')); await p.waitForTimeout(200);
await p.evaluate(() => INV.openPackSheet('جبنة')); await p.waitForTimeout(350);
ok(await p.locator('.overlay #inv-pk-per').count() === 1, 'زر 📦 يفتح ورقة التعبئة');
await p.fill('.overlay #inv-pk-per', '24'); await p.waitForTimeout(100);
await p.evaluate(() => { INV.savePack(); }); await p.waitForTimeout(500);
ok(await bal() === 22, 'تغيير التعبئة إلى ٢٤ لا يغيّر الرصيد القديم (صار ' + await bal() + ')');
ok(await p.evaluate(() => JSON.parse(localStorage.getItem('inv_p'))['جبنة'].per === 24), 'التعبئة الجديدة ٢٤ محفوظة');

// ٨. توحيد صنف قديم مسجّل بوحدتين
await p.evaluate(() => {
  const A = INV._data.additions;
  A.push({ date:'2026-10-01', name:'لانشون', unit:'علبة', qty:10, supplier:'', notes:'' });
  A.push({ date:'2026-10-01', name:'لانشون', unit:'كرتونة', qty:3, supplier:'', notes:'' });
  INV.renderStockTable();
});
ok(await p.evaluate(() => INV.computeStock().filter(s => s.name === 'لانشون').length === 2), 'قبل التعريف: لانشون سطران منفصلان');
await p.evaluate(() => INV.openPackSheet('لانشون')); await p.waitForTimeout(350);
ok(await p.inputValue('.overlay #inv-pk-base') === 'علبة', 'الوحدة الصغرى تُقترح من سجلات الصنف (علبة)');
await p.fill('.overlay #inv-pk-per', '12'); await p.waitForTimeout(100);
ok(/٤٦ علبة/.test(await p.textContent('.overlay #inv-pk-prev')), 'معاينة التوحيد: ١٠ + ٣×١٢ = ٤٦ علبة');
await p.evaluate(() => { INV.savePack(); }); await p.waitForTimeout(500);
const lan = await p.evaluate(() => INV.computeStock().filter(s => s.name === 'لانشون').map(s => s.unit + ':' + s.balance).join());
ok(lan === 'علبة:46', 'بعد التعريف: سطر واحد ٤٦ علبة (صار ' + lan + ')');

// ٩. إلغاء التعبئة مع تراجع
await p.evaluate(() => INV.openPackSheet('لانشون')); await p.waitForTimeout(350);
await p.evaluate(() => { INV.removePack(); }); await p.waitForTimeout(350);
await p.locator('.overlay button:has-text("إلغاء التعبئة")').last().click(); await p.waitForTimeout(500);
ok(await p.evaluate(() => INV.computeStock().filter(s => s.name === 'لانشون').length === 2), 'إلغاء التعبئة يرجع السطرين منفصلين');
await p.evaluate(() => document.querySelectorAll('.overlay').forEach(e => e.remove()));

// ١٠. منع الرصيد السالب عند الحذف ما زال يعمل بالوحدات المختلطة
const addIdx = await p.evaluate(() => INV._data.additions.findIndex(r => r.name === 'جبنة'));
await p.evaluate(i => { INV.delAdd(i); }, addIdx); await p.waitForTimeout(300);
ok(await p.locator('.overlay').count() === 0 && await bal() === 22, 'حذف إضافة الجبنة مرفوض لأن المصروف منها بالكرتونة والحبة');

// ١١. النسخة الاحتياطية تشمل inv_p
const bk = await p.evaluate(async () => {
  const oURL = URL.createObjectURL, oClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function(){};
  const r = await new Promise(res => { URL.createObjectURL = blob => { blob.text().then(res); return oURL(blob); }; App.exportBackup({ silent:true, prefix:'t' }); });
  URL.createObjectURL = oURL; HTMLAnchorElement.prototype.click = oClick;
  return JSON.parse(r);
});
ok(bk.modules.inventory && 'inv_p' in bk.modules.inventory, 'النسخة الاحتياطية فيها تعريفات التعبئة inv_p');

// ١٢. السند والتقرير يعرضان المعادل
let pop = ctx.waitForEvent('page');
await p.evaluate(() => INV.printReceipt(INV._data.withdrawals.length - 1));
let w = await pop; await w.waitForLoadState('domcontentloaded');
ok(/٣ \(٨١ حبة\)/.test(await w.content()), 'سند الصرف يعرض ٣ كرتونة ومعادلها ٨١ حبة');
await w.close();

// لقطة جوال
await p.evaluate(() => { INV.switchTab('out'); }); await p.waitForTimeout(200);
await p.selectOption('#inv-out-name', 'جبنة||حبة'); await p.selectOption('#inv-out-unit', 'كرتونة'); await fill('#inv-out-qty', 1); await p.waitForTimeout(150);
await p.evaluate(() => { document.getElementById('toasts').innerHTML = ''; document.getElementById('inv-form-out').scrollIntoView(); });
await p.screenshot({ path:SHOT('inv_units_out_mobile.png') });
await p.evaluate(() => { INV.switchTab('in'); }); await fill('#inv-in-name', 'جبنة'); await p.selectOption('#inv-in-unit', 'كرتونة'); await fill('#inv-in-qty', 4); await p.waitForTimeout(150);
await p.evaluate(() => { document.getElementById('toasts').innerHTML = ''; document.getElementById('inv-form-in').scrollIntoView(); });
await p.screenshot({ path:SHOT('inv_units_in_mobile.png') });
await p.evaluate(() => { INV.switchTab('stock'); }); await p.waitForTimeout(300);
await p.evaluate(() => { document.getElementById('toasts').innerHTML = ''; });
await p.locator('#inv-page-stock .eq-table-card').screenshot({ path:SHOT('inv_units_stock_mobile.png') });

console.log('\n=== نجح (' + pass + ') === فشل (' + fail.length + ') ===');
fail.forEach(f => console.log('  - ' + f));
console.log('\n=== أخطاء الكونسول ===\n' + (errs.length ? errs.join('\n') : 'لا يوجد'));
await b.close();
process.exit(fail.length || errs.length ? 1 : 0);
})();
