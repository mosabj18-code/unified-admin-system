/* =====================================================================
   وحدة إدارة المخزون العام — INV
   البيانات: localStorage inv_a / inv_w  |  ملف الحفظ: IndexedDB fsdb_inv
   ===================================================================== */
const INV = (function(){
'use strict';
const $id = id => document.getElementById('inv-' + id);
const toDate = s => { if(!s) return ''; const d = new Date((s - 25569) * 86400 * 1000); return d.toISOString().split('T')[0]; };
const LOW = 50; // حد الرصيد المنخفض

/* ---------- البيانات الأولية (تُستخدم فقط إذا لم توجد بيانات محفوظة) ---------- */
const additions = [
  {date:toDate(46039),name:'\u0628\u0637\u0627\u0646\u064a\u0629',unit:'\u0642\u0637\u0639\u0629',qty:250,supplier:'\u0627\u0644\u0635\u0644\u064a\u0628',notes:''},
  {date:toDate(46039),name:'\u0641\u0631\u0634\u0627\u062a',unit:'\u0642\u0637\u0639\u0629',qty:250,supplier:'\u0627\u0644\u0635\u0644\u064a\u0628',notes:''},
  {date:toDate(46060),name:'\u0644\u0627\u0646\u0634\u0648\u0646',unit:'\u0639\u0644\u0628\u0629',qty:939,supplier:'\u0625\u0645\u062f\u0627\u062f \u0627\u0644\u062f\u0627\u062e\u0644\u064a\u0629',notes:''},
  {date:toDate(46060),name:'\u062d\u0645\u0635',unit:'\u0639\u0644\u0628\u0629',qty:276,supplier:'\u0625\u0645\u062f\u0627\u062f \u0627\u0644\u062f\u0627\u062e\u0644\u064a\u0629',notes:''},
  {date:toDate(46060),name:'\u0645\u0631\u0628\u0649',unit:'\u0639\u0644\u0628\u0629',qty:180,supplier:'\u0625\u0645\u062f\u0627\u062f \u0627\u0644\u062f\u0627\u062e\u0644\u064a\u0629',notes:''},
  {date:toDate(46062),name:'\u0628\u0627\u0632\u064a\u0644\u0627\u0621',unit:'\u0639\u0644\u0628\u0629',qty:251,supplier:'\u0625\u0645\u062f\u0627\u062f \u0627\u0644\u062f\u0627\u062e\u0644\u064a\u0629',notes:''},
  {date:toDate(46063),name:'\u062a\u0648\u0646\u0629',unit:'\u0639\u0644\u0628\u0629',qty:96,supplier:'\u0625\u0645\u062f\u0627\u062f \u0627\u0644\u062f\u0627\u062e\u0644\u064a\u0629',notes:''},
  {date:toDate(46063),name:'\u062d\u0645\u0635',unit:'\u0639\u0644\u0628\u0629',qty:110,supplier:'\u0625\u0645\u062f\u0627\u062f \u0627\u0644\u062f\u0627\u062e\u0644\u064a\u0629',notes:''},
  {date:toDate(46063),name:'\u062e\u0636\u0627\u0631',unit:'\u0639\u0644\u0628\u0629',qty:1019,supplier:'\u0625\u0645\u062f\u0627\u062f \u0627\u0644\u062f\u0627\u062e\u0644\u064a\u0629',notes:''},
  {date:toDate(46063),name:'\u062a\u0645\u0631 \u0645\u0636\u063a\u0648\u0637',unit:'\u0639\u0644\u0628\u0629',qty:72,supplier:'\u0625\u0645\u062f\u0627\u062f \u0627\u0644\u062f\u0627\u062e\u0644\u064a\u0629',notes:''},
  {date:toDate(46063),name:'\u062c\u0628\u0646\u0629 \u0641\u064a\u062a\u0627',unit:'\u0639\u0644\u0628\u0629',qty:121,supplier:'\u0625\u0645\u062f\u0627\u062f \u0627\u0644\u062f\u0627\u062e\u0644\u064a\u0629',notes:''},
  {date:toDate(46063),name:'\u0634\u0627\u064a \u0646\u0641\u0644',unit:'\u0639\u0644\u0628\u0629',qty:22,supplier:'\u0625\u0645\u062f\u0627\u062f \u0627\u0644\u062f\u0627\u062e\u0644\u064a\u0629',notes:''},
  {date:toDate(46063),name:'\u0641\u0648\u0644',unit:'\u0639\u0644\u0628\u0629',qty:37,supplier:'\u0625\u0645\u062f\u0627\u062f \u0627\u0644\u062f\u0627\u062e\u0644\u064a\u0629',notes:''},
  {date:toDate(46063),name:'\u0633\u0643\u0631',unit:'\u0643\u064a\u0644\u0648',qty:91,supplier:'\u0625\u0645\u062f\u0627\u062f \u0627\u0644\u062f\u0627\u062e\u0644\u064a\u0629',notes:''},
  {date:toDate(46063),name:'\u0635\u0627\u0628\u0648\u0646',unit:'\u0642\u0637\u0639\u0629',qty:36,supplier:'\u0625\u0645\u062f\u0627\u062f \u0627\u0644\u062f\u0627\u062e\u0644\u064a\u0629',notes:''},
  {date:toDate(46063),name:'\u062d\u0645\u0635 \u062d\u062c\u0645 \u0643\u0628\u064a\u0631',unit:'\u0639\u0644\u0628\u0629',qty:59,supplier:'\u0625\u0645\u062f\u0627\u062f \u0627\u0644\u062f\u0627\u062e\u0644\u064a\u0629',notes:''},
  {date:toDate(46084),name:'\u062a\u0648\u0646\u0629',unit:'\u0639\u0644\u0628\u0629',qty:240,supplier:'\u0625\u0645\u062f\u0627\u062f \u0627\u0644\u062f\u0627\u062e\u0644\u064a\u0629',notes:''},
  {date:toDate(46084),name:'\u0644\u0627\u0646\u0634\u0648\u0646',unit:'\u0639\u0644\u0628\u0629',qty:480,supplier:'\u0625\u0645\u062f\u0627\u062f \u0627\u0644\u062f\u0627\u062e\u0644\u064a\u0629',notes:''},
  {date:toDate(46110),name:'\u062d\u0645\u0635',unit:'\u0639\u0644\u0628\u0629',qty:384,supplier:'\u0625\u0645\u062f\u0627\u062f \u0627\u0644\u062f\u0627\u062e\u0644\u064a\u0629',notes:''},
  {date:toDate(46110),name:'\u062d\u0644\u0627\u0648\u0629',unit:'\u0639\u0644\u0628\u0629',qty:6148,supplier:'\u0625\u0645\u062f\u0627\u062f \u0627\u0644\u062f\u0627\u062e\u0644\u064a\u0629',notes:''},
  {date:toDate(46110),name:'\u062c\u0628\u0646\u0629 \u0641\u064a\u062a\u0627',unit:'\u0639\u0644\u0628\u0629',qty:1242,supplier:'\u0625\u0645\u062f\u0627\u062f \u0627\u0644\u062f\u0627\u062e\u0644\u064a\u0629',notes:''},
  {date:toDate(46127),name:'\u0644\u0627\u0646\u0634\u0648\u0646',unit:'\u0639\u0644\u0628\u0629',qty:864,supplier:'\u0625\u0645\u062f\u0627\u062f \u0627\u0644\u062f\u0627\u062e\u0644\u064a\u0629',notes:''},
  {date:toDate(46127),name:'\u062c\u0628\u0646\u0629 \u0641\u064a\u062a\u0627',unit:'\u0639\u0644\u0628\u0629',qty:1782,supplier:'\u0625\u0645\u062f\u0627\u062f \u0627\u0644\u062f\u0627\u062e\u0644\u064a\u0629',notes:''},
  {date:toDate(46127),name:'\u062d\u0644\u0627\u0648\u0629',unit:'\u0639\u0644\u0628\u0629',qty:2988,supplier:'\u0625\u0645\u062f\u0627\u062f \u0627\u0644\u062f\u0627\u062e\u0644\u064a\u0629',notes:''},
  {date:toDate(46127),name:'\u062d\u0645\u0635',unit:'\u0639\u0644\u0628\u0629',qty:360,supplier:'\u0625\u0645\u062f\u0627\u062f \u0627\u0644\u062f\u0627\u062e\u0644\u064a\u0629',notes:''},
  {date:toDate(46142),name:'\u062d\u0644\u0627\u0648\u0629',unit:'\u0639\u062f\u062f',qty:2448,supplier:'\u0625\u0645\u062f\u0627\u062f \u0627\u0644\u062f\u0627\u062e\u0644\u064a\u0629',notes:''},
  {date:toDate(46142),name:'\u062d\u0645\u0635',unit:'\u0639\u0644\u0628\u0629',qty:456,supplier:'\u0625\u0645\u062f\u0627\u062f \u0627\u0644\u062f\u0627\u062e\u0644\u064a\u0629',notes:''},
  {date:toDate(46142),name:'\u0644\u0627\u0646\u0634\u0648\u0646',unit:'\u0639\u0644\u0628\u0629',qty:1104,supplier:'\u0625\u0645\u062f\u0627\u062f \u0627\u0644\u062f\u0627\u062e\u0644\u064a\u0629',notes:''},
  {date:toDate(46142),name:'\u062c\u0628\u0646\u0629 \u0641\u064a\u062a\u0627',unit:'\u0639\u0644\u0628\u0629',qty:1350,supplier:'\u0625\u0645\u062f\u0627\u062f \u0627\u0644\u062f\u0627\u062e\u0644\u064a\u0629',notes:''},
  {date:toDate(46154),name:'\u0644\u0648\u0628\u064a\u0627',unit:'\u0643\u0631\u062a\u0648\u0646\u0629',qty:90,supplier:'\u0625\u0645\u062f\u0627\u062f \u0627\u0644\u062f\u0627\u062e\u0644\u064a\u0629',notes:''},
  {date:toDate(46170),name:'\u062c\u0628\u0646\u0629 \u0641\u064a\u062a\u0627',unit:'\u0643\u0631\u062a\u0648\u0646\u0629',qty:54,supplier:'\u0625\u0645\u062f\u0627\u062f \u0627\u0644\u062f\u0627\u062e\u0644\u064a\u0629',notes:''},
  {date:toDate(46170),name:'\u0644\u0627\u0646\u0634\u0648\u0646',unit:'\u0643\u0631\u062a\u0648\u0646\u0629',qty:54,supplier:'\u0625\u0645\u062f\u0627\u062f \u0627\u0644\u062f\u0627\u062e\u0644\u064a\u0629',notes:''},
  {date:toDate(46170),name:'\u062d\u0645\u0635',unit:'\u0643\u0631\u062a\u0648\u0646\u0629',qty:19,supplier:'\u0625\u0645\u062f\u0627\u062f \u0627\u0644\u062f\u0627\u062e\u0644\u064a\u0629',notes:''},
  {date:toDate(46174),name:'\u0644\u062d\u0645\u0629 \u0634\u0642\u0641',unit:'\u0639\u0644\u0628\u0629',qty:80,supplier:'\u0625\u0645\u062f\u0627\u062f \u0627\u0644\u062f\u0627\u062e\u0644\u064a\u0629',notes:''},
  {date:toDate(46182),name:'\u0644\u0627\u0646\u0634\u0648\u0646',unit:'\u0643\u0631\u062a\u0648\u0646\u0629',qty:43,supplier:'\u0625\u0645\u062f\u0627\u062f \u0627\u0644\u062f\u0627\u062e\u0644\u064a\u0629',notes:''},
  {date:toDate(46182),name:'\u062d\u0644\u0627\u0648\u0629',unit:'\u0643\u0631\u062a\u0648\u0646\u0629',qty:71,supplier:'\u0625\u0645\u062f\u0627\u062f \u0627\u0644\u062f\u0627\u062e\u0644\u064a\u0629',notes:''},
  {date:toDate(46182),name:'\u062c\u0628\u0646\u0629 \u0641\u064a\u062a\u0627',unit:'\u0643\u0631\u062a\u0648\u0646\u0629',qty:71,supplier:'\u0625\u0645\u062f\u0627\u062f \u0627\u0644\u062f\u0627\u062e\u0644\u064a\u0629',notes:''},
  {date:toDate(46182),name:'\u062d\u0645\u0635',unit:'\u0643\u0631\u062a\u0648\u0646\u0629',qty:10,supplier:'\u0625\u0645\u062f\u0627\u062f \u0627\u0644\u062f\u0627\u062e\u0644\u064a\u0629',notes:''},
  {date:toDate(46201),name:'\u062d\u0645\u0635',unit:'\u0643\u0631\u062a\u0648\u0646\u0629',qty:21,supplier:'\u0625\u0645\u062f\u0627\u062f \u0627\u0644\u062f\u0627\u062e\u0644\u064a\u0629',notes:''},
  {date:toDate(46201),name:'\u0644\u0627\u0646\u0634\u0648\u0646',unit:'\u0643\u0631\u062a\u0648\u0646\u0629',qty:50,supplier:'\u0625\u0645\u062f\u0627\u062f \u0627\u0644\u062f\u0627\u062e\u0644\u064a\u0629',notes:''},
  {date:toDate(46201),name:'\u062c\u0628\u0646\u0629 \u0641\u064a\u062a\u0627',unit:'\u0643\u0631\u062a\u0648\u0646\u0629',qty:60,supplier:'\u0625\u0645\u062f\u0627\u062f \u0627\u0644\u062f\u0627\u062e\u0644\u064a\u0629',notes:''},
  {date:toDate(46201),name:'\u062d\u0644\u0627\u0648\u0629',unit:'\u0643\u0631\u062a\u0648\u0646\u0629',qty:15,supplier:'\u0625\u0645\u062f\u0627\u062f \u0627\u0644\u062f\u0627\u062e\u0644\u064a\u0629',notes:''},
  {date:toDate(46212),name:'\u0644\u0648\u0628\u064a\u0627',unit:'\u0643\u0631\u062a\u0648\u0646\u0629',qty:50,supplier:'\u0625\u0645\u062f\u0627\u062f \u0627\u0644\u062f\u0627\u062e\u0644\u064a\u0629',notes:''},
  {date:toDate(46212),name:'\u0633\u0631\u062f\u064a\u0646',unit:'\u0643\u0631\u062a\u0648\u0646\u0629',qty:30,supplier:'\u0625\u0645\u062f\u0627\u062f \u0627\u0644\u062f\u0627\u062e\u0644\u064a\u0629',notes:''},
  {date:toDate(46223),name:'\u062d\u0644\u0627\u0648\u0629',unit:'\u0643\u0631\u062a\u0648\u0646\u0629',qty:77,supplier:'\u0625\u0645\u062f\u0627\u062f \u0627\u0644\u062f\u0627\u062e\u0644\u064a\u0629',notes:''},
  {date:toDate(46223),name:'\u062c\u0628\u0646\u0629 \u0641\u064a\u062a\u0627',unit:'\u0643\u0631\u062a\u0648\u0646\u0629',qty:76,supplier:'\u0625\u0645\u062f\u0627\u062f \u0627\u0644\u062f\u0627\u062e\u0644\u064a\u0629',notes:''},
  {date:toDate(46223),name:'\u062d\u0645\u0635',unit:'\u0643\u0631\u062a\u0648\u0646\u0629',qty:24,supplier:'\u0625\u0645\u062f\u0627\u062f \u0627\u0644\u062f\u0627\u062e\u0644\u064a\u0629',notes:''},
];
const withdrawals = [
  {date:toDate(46070),name:'\u0645\u0631\u0628\u0649',unit:'\u0639\u0644\u0628\u0629',qty:72,dept:'\u0633\u062c\u0646 \u0627\u0644\u0648\u0633\u0637\u0649',notes:''},
  {date:toDate(46070),name:'\u062d\u0645\u0635',unit:'\u0639\u0644\u0628\u0629',qty:98,dept:'\u0633\u062c\u0646 \u0627\u0644\u0648\u0633\u0637\u0649',notes:''},
  {date:toDate(46070),name:'\u0644\u0627\u0646\u0634\u0648\u0646',unit:'\u0639\u0644\u0628\u0629',qty:144,dept:'\u0633\u062c\u0646 \u0627\u0644\u0648\u0633\u0637\u0649',notes:''},
  {date:toDate(46062),name:'\u0644\u0627\u0646\u0634\u0648\u0646',unit:'\u0639\u0644\u0628\u0629',qty:48,dept:'\u0633\u062c\u0646 \u062e\u0627\u0646\u064a\u0648\u0646\u0633',notes:''},
  {date:toDate(46062),name:'\u0645\u0631\u0628\u0649',unit:'\u0639\u0644\u0628\u0629',qty:36,dept:'\u0633\u062c\u0646 \u062e\u0627\u0646\u064a\u0648\u0646\u0633',notes:''},
  {date:toDate(46062),name:'\u062d\u0645\u0635',unit:'\u0639\u0644\u0628\u0629',qty:48,dept:'\u0633\u062c\u0646 \u062e\u0627\u0646\u064a\u0648\u0646\u0633',notes:''},
  {date:toDate(46062),name:'\u0644\u0627\u0646\u0634\u0648\u0646',unit:'\u0639\u0644\u0628\u0629',qty:120,dept:'\u0633\u062c\u0646 \u062e\u0627\u0646\u064a\u0648\u0646\u0633',notes:''},
  {date:toDate(46062),name:'\u0628\u0627\u0632\u064a\u0644\u0627\u0621',unit:'\u0639\u0644\u0628\u0629',qty:120,dept:'\u0633\u062c\u0646 \u062e\u0627\u0646\u064a\u0648\u0646\u0633',notes:''},
  {date:toDate(46062),name:'\u062a\u0648\u0646\u0629',unit:'\u0639\u0644\u0628\u0629',qty:24,dept:'\u0633\u062c\u0646 \u062e\u0627\u0646\u064a\u0648\u0646\u0633',notes:''},
  {date:toDate(46073),name:'\u0645\u0631\u0628\u0649',unit:'\u0639\u0644\u0628\u0629',qty:6,dept:'\u0633\u062d\u0648\u0631 \u0627\u0644\u0639\u0633\u0627\u0643\u0631',notes:''},
  {date:toDate(46103),name:'\u0644\u0627\u0646\u0634\u0648\u0646',unit:'\u0639\u0644\u0628\u0629',qty:480,dept:'\u0633\u062c\u0646 \u062e\u0627\u0646\u064a\u0648\u0646\u0633',notes:''},
  {date:toDate(46103),name:'\u062a\u0648\u0646\u0629',unit:'\u0639\u0644\u0628\u0629',qty:240,dept:'\u0633\u062c\u0646 \u062e\u0627\u0646\u064a\u0648\u0646\u0633',notes:''},
  {date:toDate(46110),name:'\u062d\u0645\u0635',unit:'\u0639\u0644\u0628\u0629',qty:168,dept:'\u0633\u062c\u0646 \u062e\u0627\u0646\u064a\u0648\u0646\u0633',notes:''},
  {date:toDate(46110),name:'\u062d\u0644\u0627\u0648\u0629',unit:'\u0639\u0644\u0628\u0629',qty:1440,dept:'\u0633\u062c\u0646 \u062e\u0627\u0646\u064a\u0648\u0646\u0633',notes:''},
  {date:toDate(46110),name:'\u062c\u0628\u0646\u0629 \u0641\u064a\u062a\u0627',unit:'\u0639\u0644\u0628\u0629',qty:405,dept:'\u0633\u062c\u0646 \u062e\u0627\u0646\u064a\u0648\u0646\u0633',notes:''},
  {date:toDate(46110),name:'\u062d\u0645\u0635',unit:'\u0639\u0644\u0628\u0629',qty:216,dept:'\u0633\u062c\u0646 \u0627\u0644\u0648\u0633\u0637\u0649',notes:''},
  {date:toDate(46110),name:'\u062d\u0644\u0627\u0648\u0629',unit:'\u0639\u0644\u0628\u0629',qty:4680,dept:'\u0633\u062c\u0646 \u0627\u0644\u0648\u0633\u0637\u0649',notes:''},
  {date:toDate(46110),name:'\u062c\u0628\u0646\u0629 \u0641\u064a\u062a\u0627',unit:'\u0639\u0644\u0628\u0629',qty:837,dept:'\u0633\u062c\u0646 \u0627\u0644\u0648\u0633\u0637\u0649',notes:''},
  {date:toDate(46127),name:'\u062c\u0628\u0646\u0629 \u0641\u064a\u062a\u0627',unit:'\u0639\u0644\u0628\u0629',qty:1296,dept:'\u0633\u062c\u0646 \u0627\u0644\u0648\u0633\u0637\u0649',notes:''},
  {date:toDate(46127),name:'\u062d\u0644\u0627\u0648\u0629',unit:'\u0639\u0644\u0628\u0629',qty:2088,dept:'\u0633\u062c\u0646 \u0627\u0644\u0648\u0633\u0637\u0649',notes:''},
  {date:toDate(46127),name:'\u0644\u0627\u0646\u0634\u0648\u0646',unit:'\u0639\u0644\u0628\u0629',qty:840,dept:'\u0633\u062c\u0646 \u0627\u0644\u0648\u0633\u0637\u0649',notes:''},
  {date:toDate(46127),name:'\u062d\u0645\u0635',unit:'\u0639\u0644\u0628\u0629',qty:192,dept:'\u0633\u062c\u0646 \u0627\u0644\u0648\u0633\u0637\u0649',notes:''},
  {date:toDate(46127),name:'\u062d\u0645\u0635',unit:'\u0639\u0644\u0628\u0629',qty:168,dept:'\u0633\u062c\u0646 \u062e\u0627\u0646\u064a\u0648\u0646\u0633',notes:''},
  {date:toDate(46127),name:'\u062d\u0644\u0627\u0648\u0629',unit:'\u0639\u0644\u0628\u0629',qty:720,dept:'\u0633\u062c\u0646 \u062e\u0627\u0646\u064a\u0648\u0646\u0633',notes:''},
  {date:toDate(46127),name:'\u062c\u0628\u0646\u0629 \u0641\u064a\u062a\u0627',unit:'\u0639\u0644\u0628\u0629',qty:405,dept:'\u0633\u062c\u0646 \u062e\u0627\u0646\u064a\u0648\u0646\u0633',notes:''},
  {date:toDate(46127),name:'\u062c\u0628\u0646\u0629 \u0641\u064a\u062a\u0627',unit:'\u0639\u0644\u0628\u0629',qty:81,dept:'\u0639\u0633\u0627\u0643\u0631 \u0627\u0644\u0642\u0648\u0629',notes:''},
  {date:toDate(46127),name:'\u062d\u0644\u0627\u0648\u0629',unit:'\u0639\u0644\u0628\u0629',qty:180,dept:'\u0639\u0633\u0627\u0643\u0631 \u0627\u0644\u0642\u0648\u0629',notes:''},
  {date:toDate(46127),name:'\u0644\u0627\u0646\u0634\u0648\u0646',unit:'\u0639\u0644\u0628\u0629',qty:24,dept:'\u0639\u0633\u0627\u0643\u0631 \u0627\u0644\u0642\u0648\u0629',notes:''},
  {date:toDate(46142),name:'\u062d\u0644\u0627\u0648\u0629',unit:'\u0639\u062f\u062f',qty:180,dept:'\u0639\u0633\u0627\u0643\u0631 \u0627\u0644\u0642\u0648\u0629',notes:''},
  {date:toDate(46142),name:'\u062c\u0628\u0646\u0629 \u0641\u064a\u062a\u0627',unit:'\u0639\u0644\u0628\u0629',qty:135,dept:'\u0639\u0633\u0627\u0643\u0631 \u0627\u0644\u0642\u0648\u0629',notes:''},
  {date:toDate(46142),name:'\u0644\u0627\u0646\u0634\u0648\u0646',unit:'\u0639\u0644\u0628\u0629',qty:48,dept:'\u0639\u0633\u0627\u0643\u0631 \u0627\u0644\u0642\u0648\u0629',notes:''},
  {date:toDate(46142),name:'\u062d\u0644\u0627\u0648\u0629',unit:'\u0639\u062f\u062f',qty:1728,dept:'\u0633\u062c\u0646 \u0627\u0644\u0648\u0633\u0637\u0649',notes:''},
  {date:toDate(46142),name:'\u062d\u0645\u0635',unit:'\u0639\u0644\u0628\u0629',qty:288,dept:'\u0633\u062c\u0646 \u0627\u0644\u0648\u0633\u0637\u0649',notes:''},
  {date:toDate(46142),name:'\u0644\u0627\u0646\u0634\u0648\u0646',unit:'\u0639\u0644\u0628\u0629',qty:1056,dept:'\u0633\u062c\u0646 \u0627\u0644\u0648\u0633\u0637\u0649',notes:''},
  {date:toDate(46142),name:'\u062c\u0628\u0646\u0629 \u0641\u064a\u062a\u0627',unit:'\u0639\u0644\u0628\u0629',qty:1080,dept:'\u0633\u062c\u0646 \u0627\u0644\u0648\u0633\u0637\u0649',notes:''},
  {date:toDate(46142),name:'\u062d\u0644\u0627\u0648\u0629',unit:'\u0643\u0631\u062a\u0648\u0646\u0629',qty:540,dept:'\u0633\u062c\u0646 \u062e\u0627\u0646\u064a\u0648\u0646\u0633',notes:'15 \u0643\u0631\u062a\u0648\u0646\u0629'},
  {date:toDate(46142),name:'\u062d\u0645\u0635',unit:'\u0643\u0631\u062a\u0648\u0646\u0629',qty:168,dept:'\u0633\u062c\u0646 \u062e\u0627\u0646\u064a\u0648\u0646\u0633',notes:'7 \u0643\u0631\u062a\u0648\u0646\u0629'},
  {date:toDate(46142),name:'\u062c\u0628\u0646\u0629 \u0641\u064a\u062a\u0627',unit:'\u0643\u0631\u062a\u0648\u0646\u0629',qty:270,dept:'\u0633\u062c\u0646 \u062e\u0627\u0646\u064a\u0648\u0646\u0633',notes:'10 \u0643\u0631\u062a\u0648\u0646\u0629'},
  {date:toDate(46154),name:'\u0644\u0648\u0628\u064a\u0627',unit:'\u0643\u0631\u062a\u0648\u0646\u0629',qty:30,dept:'\u0633\u062c\u0646 \u062e\u0627\u0646\u064a\u0648\u0646\u0633',notes:'30*12=306 \u0639\u0644\u0628\u0629'},
  {date:toDate(46154),name:'\u0644\u0648\u0628\u064a\u0627',unit:'\u0643\u0631\u062a\u0648\u0646\u0629',qty:60,dept:'\u0633\u062c\u0646 \u0627\u0644\u0648\u0633\u0637\u0649',notes:'60*12=720 \u0639\u0644\u0628\u0629'},
  {date:toDate(46170),name:'\u062c\u0628\u0646\u0629 \u0641\u064a\u062a\u0627',unit:'\u0643\u0631\u062a\u0648\u0646\u0629',qty:17,dept:'\u0633\u062c\u0646 \u062e\u0627\u0646\u064a\u0648\u0646\u0633',notes:''},
  {date:toDate(46170),name:'\u0644\u0627\u0646\u0634\u0648\u0646',unit:'\u0643\u0631\u062a\u0648\u0646\u0629',qty:20,dept:'\u0633\u062c\u0646 \u062e\u0627\u0646\u064a\u0648\u0646\u0633',notes:''},
  {date:toDate(46170),name:'\u062d\u0645\u0635',unit:'\u0643\u0631\u062a\u0648\u0646\u0629',qty:10,dept:'\u0633\u062c\u0646 \u062e\u0627\u0646\u064a\u0648\u0646\u0633',notes:''},
  {date:toDate(46170),name:'\u062c\u0628\u0646\u0629 \u0641\u064a\u062a\u0627',unit:'\u0643\u0631\u062a\u0648\u0646\u0629',qty:32,dept:'\u0633\u062c\u0646 \u0627\u0644\u0648\u0633\u0637\u0649',notes:''},
  {date:toDate(46170),name:'\u0644\u0627\u0646\u0634\u0648\u0646',unit:'\u0643\u0631\u062a\u0648\u0646\u0629',qty:32,dept:'\u0633\u062c\u0646 \u0627\u0644\u0648\u0633\u0637\u0649',notes:''},
  {date:toDate(46170),name:'\u062d\u0645\u0635',unit:'\u0643\u0631\u062a\u0648\u0646\u0629',qty:9,dept:'\u0633\u062c\u0646 \u0627\u0644\u0648\u0633\u0637\u0649',notes:''},
  {date:toDate(46170),name:'\u062c\u0628\u0646\u0629 \u0641\u064a\u062a\u0627',unit:'\u0643\u0631\u062a\u0648\u0646\u0629',qty:5,dept:'\u0639\u0633\u0627\u0643\u0631 \u0627\u0644\u0642\u0648\u0629',notes:''},
  {date:toDate(46170),name:'\u0644\u0627\u0646\u0634\u0648\u0646',unit:'\u0643\u0631\u062a\u0648\u0646\u0629',qty:2,dept:'\u0639\u0633\u0627\u0643\u0631 \u0627\u0644\u0642\u0648\u0629',notes:''},
  {date:toDate(46182),name:'\u0644\u062d\u0645\u0629 \u0634\u0642\u0641',unit:'\u0639\u0644\u0628\u0629',qty:80,dept:'\u062a\u0648\u0632\u064a\u0639 \u0639\u0644\u0649 \u0627\u0644\u0639\u0633\u0627\u0643\u0631',notes:''},
  {date:toDate(46182),name:'\u062c\u0628\u0646\u0629 \u0641\u064a\u062a\u0627',unit:'\u0643\u0631\u062a\u0648\u0646\u0629',qty:20,dept:'\u0633\u062c\u0646 \u062e\u0627\u0646\u064a\u0648\u0646\u0633',notes:''},
  {date:toDate(46182),name:'\u062d\u0645\u0635',unit:'\u0643\u0631\u062a\u0648\u0646\u0629',qty:5,dept:'\u0633\u062c\u0646 \u062e\u0627\u0646\u064a\u0648\u0646\u0633',notes:''},
  {date:toDate(46182),name:'\u062d\u0644\u0627\u0648\u0629',unit:'\u0643\u0631\u062a\u0648\u0646\u0629',qty:25,dept:'\u0633\u062c\u0646 \u062e\u0627\u0646\u064a\u0648\u0646\u0633',notes:''},
  {date:toDate(46182),name:'\u062c\u0628\u0646\u0629 \u0641\u064a\u062a\u0627',unit:'\u0643\u0631\u062a\u0648\u0646\u0629',qty:38,dept:'\u0633\u062c\u0646 \u0627\u0644\u0648\u0633\u0637\u0649',notes:''},
  {date:toDate(46182),name:'\u062d\u0645\u0635',unit:'\u0643\u0631\u062a\u0648\u0646\u0629',qty:5,dept:'\u0633\u062c\u0646 \u0627\u0644\u0648\u0633\u0637\u0649',notes:''},
  {date:toDate(46182),name:'\u062d\u0644\u0627\u0648\u0629',unit:'\u0643\u0631\u062a\u0648\u0646\u0629',qty:40,dept:'\u0633\u062c\u0646 \u0627\u0644\u0648\u0633\u0637\u0649',notes:''},
  {date:toDate(46182),name:'\u0644\u0627\u0646\u0634\u0648\u0646',unit:'\u0643\u0631\u062a\u0648\u0646\u0629',qty:38,dept:'\u0633\u062c\u0646 \u0627\u0644\u0648\u0633\u0637\u0649',notes:''},
  {date:toDate(46182),name:'\u0644\u0627\u0646\u0634\u0648\u0646',unit:'\u0643\u0631\u062a\u0648\u0646\u0629',qty:5,dept:'\u0639\u0633\u0627\u0643\u0631 \u0627\u0644\u0642\u0648\u0629',notes:''},
  {date:toDate(46182),name:'\u062d\u0644\u0627\u0648\u0629',unit:'\u0643\u0631\u062a\u0648\u0646\u0629',qty:6,dept:'\u0639\u0633\u0627\u0643\u0631 \u0627\u0644\u0642\u0648\u0629',notes:''},
  {date:toDate(46182),name:'\u062c\u0628\u0646\u0629 \u0641\u064a\u062a\u0627',unit:'\u0643\u0631\u062a\u0648\u0646\u0629',qty:5,dept:'\u0639\u0633\u0627\u0643\u0631 \u0627\u0644\u0642\u0648\u0629',notes:''},
  {date:toDate(46201),name:'\u062c\u0628\u0646\u0629 \u0641\u064a\u062a\u0627',unit:'\u0643\u0631\u062a\u0648\u0646\u0629',qty:20,dept:'\u0633\u062c\u0646 \u062e\u0627\u0646\u064a\u0648\u0646\u0633',notes:''},
  {date:toDate(46201),name:'\u062d\u0645\u0635',unit:'\u0643\u0631\u062a\u0648\u0646\u0629',qty:10,dept:'\u0633\u062c\u0646 \u062e\u0627\u0646\u064a\u0648\u0646\u0633',notes:''},
  {date:toDate(46201),name:'\u0644\u0627\u0646\u0634\u0648\u0646',unit:'\u0643\u0631\u062a\u0648\u0646\u0629',qty:15,dept:'\u0633\u062c\u0646 \u062e\u0627\u0646\u064a\u0648\u0646\u0633',notes:''},
  {date:toDate(46201),name:'\u062d\u0644\u0627\u0648\u0629',unit:'\u0643\u0631\u062a\u0648\u0646\u0629',qty:6,dept:'\u0633\u062c\u0646 \u062e\u0627\u0646\u064a\u0648\u0646\u0633',notes:''},
  {date:toDate(46201),name:'\u062c\u0628\u0646\u0629 \u0641\u064a\u062a\u0627',unit:'\u0643\u0631\u062a\u0648\u0646\u0629',qty:35,dept:'\u0633\u062c\u0646 \u0627\u0644\u0648\u0633\u0637\u0649',notes:''},
  {date:toDate(46201),name:'\u062d\u0645\u0635',unit:'\u0643\u0631\u062a\u0648\u0646\u0629',qty:11,dept:'\u0633\u062c\u0646 \u0627\u0644\u0648\u0633\u0637\u0649',notes:''},
  {date:toDate(46201),name:'\u0644\u0627\u0646\u0634\u0648\u0646',unit:'\u0643\u0631\u062a\u0648\u0646\u0629',qty:30,dept:'\u0633\u062c\u0646 \u0627\u0644\u0648\u0633\u0637\u0649',notes:''},
  {date:toDate(46201),name:'\u062d\u0644\u0627\u0648\u0629',unit:'\u0643\u0631\u062a\u0648\u0646\u0629',qty:7,dept:'\u0633\u062c\u0646 \u0627\u0644\u0648\u0633\u0637\u0649',notes:''},
  {date:toDate(46201),name:'\u0644\u0627\u0646\u0634\u0648\u0646',unit:'\u0643\u0631\u062a\u0648\u0646\u0629',qty:5,dept:'\u0639\u0633\u0627\u0643\u0631 \u0627\u0644\u0642\u0648\u0629',notes:''},
  {date:toDate(46201),name:'\u062c\u0628\u0646\u0629 \u0641\u064a\u062a\u0627',unit:'\u0643\u0631\u062a\u0648\u0646\u0629',qty:5,dept:'\u0639\u0633\u0627\u0643\u0631 \u0627\u0644\u0642\u0648\u0629',notes:''},
  {date:toDate(46201),name:'\u062d\u0644\u0627\u0648\u0629',unit:'\u0643\u0631\u062a\u0648\u0646\u0629',qty:2,dept:'\u0639\u0633\u0627\u0643\u0631 \u0627\u0644\u0642\u0648\u0629',notes:''},
  {date:toDate(46212),name:'\u0644\u0648\u0628\u064a\u0627',unit:'\u0643\u0631\u062a\u0648\u0646\u0629',qty:20,dept:'\u0633\u062c\u0646 \u062e\u0627\u0646\u064a\u0648\u0646\u0633',notes:''},
  {date:toDate(46212),name:'\u0633\u0631\u062f\u064a\u0646',unit:'\u0643\u0631\u062a\u0648\u0646\u0629',qty:13,dept:'\u0633\u062c\u0646 \u062e\u0627\u0646\u064a\u0648\u0646\u0633',notes:''},
  {date:toDate(46212),name:'\u0644\u0648\u0628\u064a\u0627',unit:'\u0643\u0631\u062a\u0648\u0646\u0629',qty:40,dept:'\u0633\u062c\u0646 \u0627\u0644\u0648\u0633\u0637\u0649',notes:''},
  {date:toDate(46212),name:'\u0633\u0631\u062f\u064a\u0646',unit:'\u0643\u0631\u062a\u0648\u0646\u0629',qty:17,dept:'\u0633\u062c\u0646 \u0627\u0644\u0648\u0633\u0637\u0649',notes:''},
  {date:toDate(46223),name:'\u062d\u0644\u0627\u0648\u0629',unit:'\u0643\u0631\u062a\u0648\u0646\u0629',qty:30,dept:'\u0633\u062c\u0646 \u062e\u0627\u0646\u064a\u0648\u0646\u0633',notes:''},
  {date:toDate(46223),name:'\u062c\u0628\u0646\u0629 \u0641\u064a\u062a\u0627',unit:'\u0643\u0631\u062a\u0648\u0646\u0629',qty:25,dept:'\u0633\u062c\u0646 \u062e\u0627\u0646\u064a\u0648\u0646\u0633',notes:''},
  {date:toDate(46223),name:'\u062d\u0645\u0635',unit:'\u0643\u0631\u062a\u0648\u0646\u0629',qty:12,dept:'\u0633\u062c\u0646 \u062e\u0627\u0646\u064a\u0648\u0646\u0633',notes:''},
  {date:toDate(46223),name:'\u062d\u0644\u0627\u0648\u0629',unit:'\u0643\u0631\u062a\u0648\u0646\u0629',qty:41,dept:'\u0633\u062c\u0646 \u0627\u0644\u0648\u0633\u0637\u0649',notes:''},
  {date:toDate(46223),name:'\u062c\u0628\u0646\u0629 \u0641\u064a\u062a\u0627',unit:'\u0643\u0631\u062a\u0648\u0646\u0629',qty:47,dept:'\u0633\u062c\u0646 \u0627\u0644\u0648\u0633\u0637\u0649',notes:''},
  {date:toDate(46223),name:'\u062d\u0645\u0635',unit:'\u0643\u0631\u062a\u0648\u0646\u0629',qty:12,dept:'\u0633\u062c\u0646 \u0627\u0644\u0648\u0633\u0637\u0649',notes:''},
  {date:'',name:'\u062c\u0628\u0646\u0629 \u0641\u064a\u062a\u0627',unit:'\u0643\u0631\u062a\u0648\u0646\u0629',qty:4,dept:'\u0639\u0633\u0627\u0643\u0631 \u0627\u0644\u0642\u0648\u0629',notes:''},
  {date:'',name:'\u062d\u0644\u0627\u0648\u0629',unit:'\u0643\u0631\u062a\u0648\u0646\u0629',qty:6,dept:'\u0639\u0633\u0627\u0643\u0631 \u0627\u0644\u0642\u0648\u0629',notes:''},
];
const extraItems=['\u0643\u0644\u0628\u0634\u0627\u062a','\u0642\u0641\u0644','\u0634\u0648\u0627\u062f\u0631','\u0645\u062e\u062f\u0629','\u0648\u062c\u0647 \u0641\u0631\u0634\u0627\u062a','\u062d\u0631\u0627\u0645\u0627\u062a','\u0628\u0637\u0627\u0631\u064a\u0629 \u0644\u0627\u0628\u062a\u0648\u0628','\u0648\u0631\u0642 A4','\u0631\u0635\u0627\u0635 \u0643\u0644\u0627\u0634\u0646','\u0628\u0631\u0645\u064a\u0644 1500 \u0644\u062a\u0631','\u0628\u0631\u0645\u064a\u0644 2000 \u0644\u062a\u0631'];
const DEFAULT_DEPTS = ['سجن خانيونس','سجن الوسطى','عساكر القوة','سحور العساكر','توزيع على العساكر'];
const UNITS = ['علبة','كرتونة','قطعة','كيلو','عدد','حبة','طقم','دستة'];
const PACK_UNITS = ['كرتونة','دستة','طقم']; // وحدات تعبئة تحوي وحدات أصغر
// تعبئة كل صنف: { 'جبنة': { base:'حبة', pack:'كرتونة', per:27 } } — localStorage inv_p
const packs = {};

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
    localStorage.setItem('inv_a', JSON.stringify(additions));
    localStorage.setItem('inv_w', JSON.stringify(withdrawals));
    localStorage.setItem('inv_p', JSON.stringify(packs));
  } catch(e){
    notify({ type:'error', title:'تعذّر الحفظ على الجهاز', msg: e.name === 'QuotaExceededError' ? 'مساحة التخزين في المتصفح ممتلئة. انزل نسخة احتياطية وافرغ مساحة.' : 'السبب: ' + e.message, page:'inventory' });
  }
  writeToLinkedFile();
  window.App && App.refresh();
}
function loadData(){
  try {
    const a = localStorage.getItem('inv_a'), w = localStorage.getItem('inv_w');
    if (a){ const arr = JSON.parse(a); additions.length = 0; arr.forEach(r => additions.push(r)); }
    if (w){ const arr = JSON.parse(w); withdrawals.length = 0; arr.forEach(r => withdrawals.push(r)); }
    replacePacks(JSON.parse(localStorage.getItem('inv_p') || '{}'));
    if (!a && !w){ // أول تشغيل: نحفظ البيانات الأولية لتدخل في الإحصاء والنسخ الاحتياطي
      localStorage.setItem('inv_a', JSON.stringify(additions));
      localStorage.setItem('inv_w', JSON.stringify(withdrawals));
    }
  } catch(e){}
}

/* ---------- ربط ملف حفظ حقيقي على الجهاز ---------- */
let fileHandle = null;
const FS_DB_NAME = 'fsdb_inv';
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
    const handle = await window.showSaveFilePicker({ suggestedName:'بيانات_ادارة_المخزون.json', types:[{ description:'JSON', accept:{ 'application/json':['.json'] } }] });
    let hasData = false, imported = false, data = null;
    try { const text = await (await handle.getFile()).text(); if (text && text.trim()){ data = JSON.parse(text); if (data && Array.isArray(data.additions)) hasData = true; } } catch(e){}
    if (hasData){
      const ok = await confirmD({ title:'الملف فيه بيانات محفوظة', msg:`يحتوي ${num(data.additions.length)} إضافة و${num((data.withdrawals||[]).length)} صرف. هل تستوردها؟ (تُستبدل بيانات المعدات الحالية)`, okText:'استيراد البيانات', cancelText:'الإبقاء على بياناتي', icon:'inbox' });
      if (ok){
        additions.length = 0; (data.additions || []).forEach(r => additions.push(r));
        withdrawals.length = 0; (data.withdrawals || []).forEach(r => withdrawals.push(r));
        replacePacks(data.packs);
        imported = true;
      }
    }
    fileHandle = handle;
    await idbSet('handle', handle);
    if (imported){ saveData(); refreshAll(); } else { await writeToLinkedFile(); }
    updateLinkStatus('مربوط: ' + handle.name, true);
    notify({ type:'success', title: imported ? 'تم ربط الملف واستيراد بياناته' : 'تم ربط ملف الحفظ', msg:'كل عملية حفظ تُكتب تلقائياً في «' + handle.name + '».', page:'inventory' });
  } catch(e){
    if (e.name !== 'AbortError') notify({ type:'error', title:'تعذّر ربط الملف', msg:'السبب: ' + e.message, page:'inventory' });
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
        if (!writeWarned){ writeWarned = true; notify({ type:'warning', title:'لم يُحدَّث ملف الحفظ المربوط', msg:'البيانات محفوظة بالتطبيق، لكن الملف يحتاج إذناً. اضغط «ربط ملف حفظ».', page:'inventory' }); }
        return;
      }
    }
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify({ additions, withdrawals, packs, exported:new Date().toISOString() }, null, 2));
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

/* ---------- الوحدات المتعددة ----------
   الصنف المعرَّفة تعبئته يُحسب رصيده داخلياً بالوحدة الصغرى (base)، وسجل الوحدة الكبيرة (pack)
   يحفظ معامله per وقت تسجيله، فتعديل التعبئة لاحقاً لا يغيّر حساب السجلات القديمة.
   وقد يحمل loose: حبات فرط بالوحدة الصغرى مع الكراتين في نفس العملية (١ كرتونة + ١٠ حبات). */
const packOf = name => packs[name] || null;
function replacePacks(obj){ Object.keys(packs).forEach(k => delete packs[k]); Object.assign(packs, obj && typeof obj === 'object' ? obj : {}); }
function perOf(r){ const p = packOf(r.name); return p && r.unit === p.pack ? (+r.per || p.per) : 1; }
function baseUnit(r){ const p = packOf(r.name); return p && r.unit === p.pack ? p.base : r.unit; }
const looseOf = r => perOf(r) > 1 ? (+r.loose || 0) : 0;
const baseQty = r => (+r.qty || 0) * perOf(r) + looseOf(r);
const keyOf = r => stockKey(r.name, baseUnit(r));
// ٧٦ حبة بكرتونة ٢٧ ← «٢ كرتونة + ٢٢ حبة»
function splitPack(q, p){
  if (!p || q <= 0) return '';
  const c = Math.floor(q / p.per), rest = q - c * p.per;
  return [c ? `${num(c)} ${p.pack}` : '', rest ? `${num(rest)} ${p.base}` : ''].filter(Boolean).join(' + ');
}
const balText = (q, unit, p) => p && q >= p.per ? `${splitPack(q, p)} (${num(q)} ${p.base})` : `${num(q)} ${unit || ''}`.trim();
const packLabel = p => `١ ${p.pack} = ${num(p.per)} ${p.base}`;
// الكمية كما سُجّلت، ومعها معادلها بالوحدة الصغرى إن كانت بالوحدة الكبيرة
const qtyText = r => perOf(r) > 1 ? `${num(r.qty)}${looseOf(r) ? ` + ${num(looseOf(r))} ${baseUnit(r)}` : ''} (${num(baseQty(r))} ${baseUnit(r)})` : num(r.qty);
// وصف كامل للعملية: «١ كرتونة + ١٠ حبة»
const mixText = (qty, unit, loose, base) => [qty ? `${num(qty)} ${unit}` : '', loose ? `${num(loose)} ${base}` : ''].filter(Boolean).join(' + ');
const qtyDesc = r => perOf(r) > 1 ? mixText(r.qty, r.unit, looseOf(r), baseUnit(r)) : `${num(r.qty)} ${r.unit}`;
// يثبّت معامل التعبئة الحالي على سجل جديد بالوحدة الكبيرة
function withPer(r){
  const p = packOf(r.name);
  if (p && r.unit === p.pack){ if (!r.per) r.per = p.per; } else delete r.loose; // الفرط يخص سجلات الكرتونة وحدها
  if (!(+r.loose > 0)) delete r.loose;
  return r;
}

function computeStock(adds = additions, outs = withdrawals){
  const map = {};
  const slot = (name, unit) => { const k = stockKey(name, unit); return map[k] || (map[k] = { key:k, name, unit, totalIn:0, totalOut:0 }); };
  extraItems.forEach(n => slot(n, ''));
  adds.forEach(r => { slot(r.name, baseUnit(r)).totalIn += baseQty(r); });
  outs.forEach(r => { slot(r.name, baseUnit(r)).totalOut += baseQty(r); });
  return Object.values(map).map(i => { const p = packOf(i.name); return { ...i, pack: p && p.base === i.unit ? p : null, balance:i.totalIn - i.totalOut }; });
}
// يحسب المخزون بتعريفات تعبئة مؤقتة دون المساس بالمحفوظة
function withPacks(tmp, fn){ const saved = { ...packs }; replacePacks(tmp); try { return fn(); } finally { replacePacks(saved); } }
// يرجع الأصناف التي يصبح رصيدها سالباً (أو أكثر سلبية) لو طُبّق التعديل المقترح
function negativeAfter(newAdds, newOuts, newPacks){
  const before = {}; computeStock().forEach(s => before[s.key] = s.balance);
  const after = newPacks ? withPacks(newPacks, () => computeStock(newAdds, newOuts)) : computeStock(newAdds, newOuts);
  return after.filter(s => s.balance < 0 && s.balance < (before[s.key] ?? 0));
}
// قبل تغيير معامل التعبئة: السجلات القديمة بلا per تثبت على المعامل السابق
const stampFor = (name, old) => r => (old && r.name === name && r.unit === old.pack && !r.per) ? { ...r, per:old.per } : r;
function planPack(name, def){
  const stamp = stampFor(name, packOf(name)), tPacks = { ...packs };
  if (def) tPacks[name] = def; else delete tPacks[name];
  return { adds:additions.map(stamp), outs:withdrawals.map(stamp), packs:tPacks };
}
function commitPack(name, def){
  const plan = planPack(name, def);
  plan.adds.forEach((r, i) => additions[i] = r); plan.outs.forEach((r, i) => withdrawals[i] = r);
  replacePacks(plan.packs);
}
// يسأل قبل تعريف تعبئة تكشف رصيداً سالباً (عادة سجل قديم بالكرتونة وكميته بالحبات)
async function confirmPackNegatives(name, def, adds){
  const plan = planPack(name, def);
  const neg = negativeAfter(adds ? adds(plan.adds) : plan.adds, plan.outs, plan.packs).filter(s => s.name === name);
  if (!neg.length) return true;
  return confirmD({ title:'التوحيد يكشف رصيداً سالباً', icon:'warning', okText:'متابعة رغم ذلك', cancelText:'رجوع',
    msg:`بعد ${def ? 'توحيد الحساب' : 'إلغاء التعبئة'} يصير رصيد «${name}» ${num(neg[0].balance)} ${neg[0].unit}. غالباً في سجل قديم مسجّل بوحدة وكميته بوحدة ثانية — راجع سجلات الصنف بعد الحفظ.` });
}
const fmtDate = d => { if (!d) return '—'; const [y, m, day] = d.split('-'); return `${day}/${m}/${y}`; };
const monthKey = d => d ? d.slice(0, 7) : '';
const AR_MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
const arYear = y => Number(y).toLocaleString('ar-EG', { useGrouping:false });
function monthLabel(k){ if (!k) return 'بدون تاريخ'; const [y, m] = k.split('-'); return `${AR_MONTHS[+m - 1]} ${arYear(y)}`; }
function allMonths(){ return [...new Set([...additions, ...withdrawals].map(r => monthKey(r.date)).filter(Boolean))].sort().reverse(); }
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
    title:'مخزون الطعام', page:'inventory',
    modes:[
      { id:'in', label:'إضافة أصناف', desc:'كل صف يضيف كمية لصنف في المخزون. الصنف الجديد يُنشأ تلقائياً.',
        cols:[
          { k:'date', labels:['التاريخ','تاريخ الإضافة'], req:true, type:'date' },
          { k:'name', labels:['الصنف','اسم الصنف'], req:true, type:'text' },
          { k:'unit', labels:['الوحدة'], type:'text', def:UNITS[0] },
          { k:'qty',  labels:['الكمية','العدد'], req:true, type:'num' },
          { k:'loose', labels:['حبات فرط','فرط'], type:'num' },
          { k:'supplier', labels:['المورد','الجهة الموردة'], type:'text' },
          { k:'notes', labels:['ملاحظات','ملاحظة'], type:'text' }
        ],
        sample:[[new Date().toISOString().slice(0,10), 'بطانية', UNITS[0], 50, 'إمداد الداخلية', '']],
        check:recs => recs.filter(r => !UNITS.includes(r.unit)).map(r => ({ row:r.__row, msg:`الوحدة «${r.unit}» غير معروفة — المسموح: ${UNITS.join('، ')}` })),
        apply:async recs => {
          const prevA = additions.slice();
          recs.forEach(r => additions.push(withPer({ date:r.date, name:r.name, unit:r.unit, qty:r.qty, loose:r.loose, supplier:r.supplier || '', notes:r.notes || '' })));
          saveData(); populateDropdowns(); refreshAll();
          const items = new Set(recs.map(r => r.name)), total = recs.reduce((s,r) => s + baseQty(r), 0);
          notify({ type:'success', title:`تمت إضافة ${num(recs.length)} سجل من Excel`, page:'inventory', duration:9000,
            msg:`${num(items.size)} صنف بإجمالي ${num(total)} وحدة. راجع لوحة المخزون للأرصدة الجديدة.`,
            action:{ label:'تراجع', fn:() => { additions.length = 0; prevA.forEach(x => additions.push(x)); saveData(); populateDropdowns(); refreshAll(); notify({ type:'info', title:'تم التراجع عن الاستيراد', log:false }); } } });
        } },
      { id:'out', label:'صرف أصناف', desc:'كل صف يصرف كمية لجهة. الصنف لازم يكون موجوداً وبرصيد كافٍ.',
        cols:[
          { k:'date', labels:['التاريخ','تاريخ الصرف'], req:true, type:'date' },
          { k:'name', labels:['الصنف','اسم الصنف'], req:true, type:'text' },
          { k:'unit', labels:['الوحدة'], type:'text' },
          { k:'qty',  labels:['الكمية','العدد'], req:true, type:'num' },
          { k:'loose', labels:['حبات فرط','فرط'], type:'num' },
          { k:'dept', labels:['الجهة','الجهة المستلمة','القسم'], req:true, type:'text' },
          { k:'notes', labels:['ملاحظات','ملاحظة'], type:'text' }
        ],
        sample:[[new Date().toISOString().slice(0,10), 'بطانية', UNITS[0], 10, 'سجن النظارة', '']],
        check:recs => {
          const stock = computeStock(), errs = [], used = {};
          recs.forEach(r => {
            let hit = r.unit ? stock.find(s => s.key === keyOf(r)) : null;
            if (!hit){
              const same = stock.filter(s => s.name === r.name);
              if (same.length === 1) { hit = same[0]; r.unit = hit.unit; }
              else if (same.length > 1) return errs.push({ row:r.__row, msg:`«${r.name}» موجود بأكثر من وحدة (${same.map(s => s.unit).join('، ')}) — حدّد عمود الوحدة` });
            }
            if (!hit) return errs.push({ row:r.__row, msg:`«${r.name}»${r.unit ? ' بوحدة ' + r.unit : ''} غير موجود في المخزون — أضفه أولاً` });
            used[hit.key] = (used[hit.key] || 0) + baseQty(r);
            if (used[hit.key] > hit.balance) errs.push({ row:r.__row, msg:`الرصيد لا يكفي: المتاح من «${r.name}» ${balText(hit.balance, hit.unit, hit.pack)} والمطلوب تراكمياً ${num(used[hit.key])} ${hit.unit}` });
          });
          return errs;
        },
        apply:async recs => {
          const prevW = withdrawals.slice();
          recs.forEach(r => withdrawals.push(withPer({ date:r.date, name:r.name, unit:r.unit, qty:r.qty, loose:r.loose, dept:r.dept, notes:r.notes || '' })));
          saveData(); populateDropdowns(); refreshAll();
          const depts = new Set(recs.map(r => r.dept)), total = recs.reduce((s,r) => s + baseQty(r), 0);
          notify({ type:'success', title:`تم صرف ${num(recs.length)} سجل من Excel`, page:'inventory', duration:9000,
            msg:`${num(total)} وحدة إلى ${num(depts.size)} جهة. تقدر تطبع سند كل صرف من سجل الصرف.`,
            action:{ label:'تراجع', fn:() => { withdrawals.length = 0; prevW.forEach(x => withdrawals.push(x)); saveData(); populateDropdowns(); refreshAll(); notify({ type:'info', title:'تم التراجع عن الاستيراد', log:false }); } } });
        } }
    ]
  });
}

/* ---------- الواجهة ---------- */
function buildUI(){
  const root = document.getElementById('page-inventory');
  root.removeAttribute('data-placeholder');
  root.innerHTML = `
  <div class="eq-head">
    <div class="tile">${ico('inventory')}</div>
    <div class="grow"><h2>مخزون الطعام</h2><p>أصناف الطعام الاستهلاكية: الإضافة والصرف للجهات ومتابعة الأرصدة.</p></div>
    <div class="eq-tools">
      <button class="btn btn-sm" onclick="INV.exportExcel()">${ico('chart',20)}Excel</button>
      <button class="btn btn-sm" onclick="INV.exportPDF()">${ico('checklist',20)}تقرير PDF</button>
      <button class="btn btn-sm" onclick="INV.openReportSheet()">${ico('chart',20)}تقرير مفصل</button>
      <button class="btn btn-sm" onclick="INV.importFromExcel()">${ico('chart',20)}استيراد من Excel</button>
      <button class="btn btn-sm" onclick="INV.linkSaveFile()">${ico('label',20)}ربط ملف حفظ</button>
      <label class="btn btn-sm" title="استيراد ملف نسخة من تطبيق المعدات المستقل">${ico('inbox',20)}استيراد نسخة قديمة<input type="file" accept=".json" hidden onchange="INV.importBackup(event)"></label>
      <span id="inv-link-status" class="pill eq-link" hidden></span>
    </div>
  </div>

  <div class="eq-tabs" role="tablist">
    <button class="eq-tab active" id="inv-tab-in" role="tab" onclick="INV.switchTab('in')">${ico('inbox')}الإضافة<span class="cnt num" id="inv-in-count2">0</span></button>
    <button class="eq-tab" id="inv-tab-out" role="tab" onclick="INV.switchTab('out')">${ico('outbox')}الصرف<span class="cnt num" id="inv-out-count2">0</span></button>
    <button class="eq-tab" id="inv-tab-stock" role="tab" onclick="INV.switchTab('stock')">${ico('chart')}المخزون<span class="cnt num" id="inv-stock-count2">0</span></button>
  </div>

  <div class="card eq-filter">
    <span class="lbl" id="inv-gf-label">${ico('search',20)}فلترة</span>
    <input class="inp" type="text" id="inv-gf-item" placeholder="اسم الصنف…" oninput="INV.applyGlobalFilter()">
    <input class="inp" type="date" id="inv-gf-from" title="من تاريخ" oninput="INV.applyGlobalFilter()">
    <span class="muted">←</span>
    <input class="inp" type="date" id="inv-gf-to" title="إلى تاريخ" oninput="INV.applyGlobalFilter()">
    <select class="inp" id="inv-gf-dept" onchange="INV.applyGlobalFilter()"><option value="">كل الجهات</option></select>
    <button class="btn btn-sm btn-ghost" onclick="INV.clearGlobalFilter()">مسح الفلتر</button>
  </div>

  <!-- الإضافة -->
  <div class="eq-page active" id="inv-page-in">
    <div class="card eq-form" id="inv-form-in">
      <h3>${ico('inbox')}<span id="inv-in-title">إضافة صنف للمخزون</span></h3>
      <div class="eq-edit-note" id="inv-in-note"></div>
      <div class="eq-grid">
        <div class="field"><label for="inv-in-date">التاريخ <i>*</i></label><input class="inp" type="date" id="inv-in-date"></div>
        <div class="field wide"><label for="inv-in-name">اسم الصنف <i>*</i></label><input class="inp" type="text" id="inv-in-name" placeholder="مثال: بطانية" list="inv-items-dl" autocomplete="off" oninput="INV.updateInPack(true)"><datalist id="inv-items-dl"></datalist></div>
        <div class="field"><label for="inv-in-unit">الوحدة</label><select class="inp" id="inv-in-unit" onchange="INV.updateInPack(true)">${UNITS.map(u => `<option>${u}</option>`).join('')}</select></div>
        <div class="field"><label for="inv-in-qty">الكمية <i>*</i></label><input class="inp num" type="number" id="inv-in-qty" placeholder="0" min="1" inputmode="numeric" oninput="INV.updateInPack()"></div>
        <div class="field" id="inv-in-per-f" hidden><label for="inv-in-per" id="inv-in-per-l">كم حبة في الكرتونة؟</label><input class="inp num" type="number" id="inv-in-per" placeholder="مثال: 27" min="2" inputmode="numeric" oninput="INV.updateInPack()"></div>
        <div class="field" id="inv-in-base-f" hidden><label for="inv-in-base">الوحدة الصغرى</label><select class="inp" id="inv-in-base" onchange="INV.updateInPack()">${UNITS.map(u => `<option>${u}</option>`).join('')}</select></div>
        <div class="field" id="inv-in-loose-f" hidden><label for="inv-in-loose" id="inv-in-loose-l">حبات فرط معها</label><input class="inp num" type="number" id="inv-in-loose" placeholder="0" min="0" inputmode="numeric" oninput="INV.updateInPack()"></div>
        <div class="inv-pack-hint wide" id="inv-in-pack-hint" hidden></div>
        <div class="field wide"><label for="inv-in-supplier">المورد</label><input class="inp" type="text" id="inv-in-supplier" placeholder="إمداد الداخلية" list="inv-sup-dl"><datalist id="inv-sup-dl"></datalist></div>
        <div class="field wide"><label for="inv-in-notes">ملاحظات</label><input class="inp" type="text" id="inv-in-notes" placeholder="اختياري"></div>
      </div>
      <div class="eq-btns">
        <button class="btn btn-primary" id="inv-in-submit-btn" onclick="INV.addItem()">إضافة للمخزون</button>
        <button class="btn" id="inv-in-clear" onclick="INV.clearInForm(true)">مسح الحقول</button>
        <button class="btn" id="inv-in-cancel-edit" onclick="INV.cancelEditAdd()" style="display:none">إلغاء التعديل</button>
      </div>
    </div>
    <div class="card eq-table-card">
      <div class="eq-table-head"><h3>سجل الإضافات <span class="pill info num" id="inv-in-count">0</span></h3>
        <button class="btn btn-sm" id="inv-print-sel-in" onclick="INV.printSelectedAddReceipt()">طباعة سند للمحدد</button></div>
      <div class="eq-scroll"><table><thead><tr><th><input type="checkbox" id="inv-chk-all-in" aria-label="تحديد الكل" onchange="INV.toggleAllIn(this.checked)"></th><th>#</th><th>التاريخ</th><th>الصنف</th><th>الوحدة</th><th>الكمية</th><th>المورد</th><th>ملاحظات</th><th></th></tr></thead><tbody id="inv-in-tbody"></tbody></table></div>
    </div>
  </div>

  <!-- الصرف -->
  <div class="eq-page" id="inv-page-out">
    <div class="card eq-form" id="inv-form-out">
      <h3>${ico('outbox')}<span id="inv-out-title">صرف من المخزون</span></h3>
      <div class="eq-edit-note" id="inv-out-note"></div>
      <div class="eq-grid">
        <div class="field"><label for="inv-out-date">التاريخ <i>*</i></label><input class="inp" type="date" id="inv-out-date"></div>
        <div class="field wide"><label for="inv-out-name">الصنف <i>*</i></label><select class="inp" id="inv-out-name" onchange="INV.updateOutInfo()"><option value="">— اختر —</option></select></div>
        <div class="field"><label for="inv-out-unit">وحدة الصرف</label><select class="inp" id="inv-out-unit" onchange="INV.updateOutHint()"></select></div>
        <div class="field"><label for="inv-out-balance">الرصيد المتاح</label><input class="inp num" type="text" id="inv-out-balance" readonly tabindex="-1"></div>
        <div class="field"><label for="inv-out-qty">الكمية المصروفة <i>*</i></label><input class="inp num" type="number" id="inv-out-qty" placeholder="0" min="0" inputmode="numeric" oninput="INV.updateOutHint()"></div>
        <div class="field" id="inv-out-loose-f" hidden><label for="inv-out-loose" id="inv-out-loose-l">حبات فرط معها</label><input class="inp num" type="number" id="inv-out-loose" placeholder="0" min="0" inputmode="numeric" oninput="INV.updateOutHint()"></div>
        <div class="inv-pack-hint wide" id="inv-out-pack-hint" hidden></div>
        <div class="field wide"><label for="inv-out-dept">الجهة المستلمة <i>*</i></label><input class="inp" type="text" id="inv-out-dept" placeholder="سجن خانيونس" list="inv-dept-dl"><datalist id="inv-dept-dl"></datalist></div>
        <div class="field wide"><label for="inv-out-notes">ملاحظات</label><input class="inp" type="text" id="inv-out-notes" placeholder="اختياري"></div>
      </div>
      <div class="eq-btns">
        <button class="btn btn-primary" id="inv-out-submit-btn" onclick="INV.withdrawItem()">تنفيذ الصرف</button>
        <button class="btn" onclick="INV.clearOutForm(true)">مسح الحقول</button>
        <button class="btn" id="inv-out-cancel-edit" onclick="INV.cancelEditOut()" style="display:none">إلغاء التعديل</button>
      </div>
    </div>
    <div class="card eq-table-card">
      <div class="eq-table-head"><h3>سجل الصرف <span class="pill info num" id="inv-out-count">0</span></h3>
        <button class="btn btn-sm" id="inv-print-sel" onclick="INV.printSelectedReceipt()">طباعة سند للمحدد</button></div>
      <div class="eq-scroll"><table><thead><tr><th><input type="checkbox" id="inv-chk-all" aria-label="تحديد الكل" onchange="INV.toggleAll(this.checked)"></th><th>#</th><th>التاريخ</th><th>الصنف</th><th>الوحدة</th><th>الكمية</th><th>الجهة</th><th>ملاحظات</th><th></th></tr></thead><tbody id="inv-out-tbody"></tbody></table></div>
    </div>
  </div>

  <!-- لوحة المخزون -->
  <div class="eq-page" id="inv-page-stock">
    <div id="inv-low-alert" class="eq-alert"></div>
    <div class="eq-kpis">
      <div class="card kpi"><small>إجمالي الأصناف</small><b class="num" id="inv-kpi-items">-</b></div>
      <div class="card kpi in"><small>إجمالي الوارد</small><b class="num" id="inv-kpi-in">-</b></div>
      <div class="card kpi out"><small>إجمالي الصادر</small><b class="num" id="inv-kpi-out">-</b></div>
      <div class="card kpi bal"><small>الرصيد الكلي</small><b class="num" id="inv-kpi-bal">-</b></div>
      <button class="card kpi low" onclick="INV.filterLow()" style="text-align:start"><small>منخفض أو نافد</small><b class="num" id="inv-kpi-low">-</b></button>
    </div>
    <div class="card eq-chart">
      <div class="eq-chart-top"><h3>الإحصائيات البيانية</h3>
        <div class="seg" role="group">
          <button class="chart-tab" aria-pressed="true" onclick="INV.showChart('balance',this)">الرصيد</button>
          <button class="chart-tab" aria-pressed="false" onclick="INV.showChart('in',this)">الوارد</button>
          <button class="chart-tab" aria-pressed="false" onclick="INV.showChart('out',this)">الصادر</button>
        </div></div>
      <div class="chart-wrap"><canvas id="inv-stockChart" aria-label="رسم بياني للمخزون"></canvas></div>
    </div>
    <div class="eq-stock-tools">
      <select class="inp" id="inv-stock-filter" onchange="INV.renderStockTable()">
        <option value="all">كل الأصناف</option><option value="ok">متوفر</option><option value="low">منخفض</option><option value="out">نافد</option>
      </select>
      <button class="btn btn-sm btn-primary" onclick="INV.switchTab('in')">إضافة صنف</button>
    </div>
    <div class="card eq-table-card">
      <div class="eq-table-head"><h3>تفاصيل المخزون <span class="pill info num" id="inv-stock-count">0</span></h3></div>
      <div class="eq-scroll"><table><thead><tr><th>#</th><th>الصنف</th><th>الوحدة</th><th>الوارد</th><th>الصادر</th><th>الرصيد</th><th>الحالة</th><th></th></tr></thead><tbody id="inv-stock-tbody"></tbody></table></div>
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
      <td><input type="checkbox" class="in-chk" data-idx="${idx}" aria-label="تحديد" onchange="INV.updateSelCountIn()"></td>
      <td class="n num">${num(rows.length - i)}</td><td class="num">${fmtDate(r.date)}</td><td><strong>${esc(r.name)}</strong></td><td>${esc(r.unit)}</td>
      <td class="qty-in num">+${qtyText(r)}</td><td>${esc(r.supplier) || '—'}</td><td class="muted">${esc(r.notes) || '—'}</td>
      <td><div class="acts"><button class="ib" title="طباعة سند إدخال (يجمع كل ما أُضيف من نفس المورد بنفس التاريخ)" aria-label="طباعة سند" onclick="INV.printAddReceipt(${idx})">🖨</button>
        <button class="ib" title="تعديل" aria-label="تعديل" onclick="INV.editAdd(${idx})">✏️</button><button class="ib del" title="حذف" aria-label="حذف" onclick="INV.delAdd(${idx})">🗑</button></div></td></tr>`;
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
      <td><input type="checkbox" class="out-chk" data-idx="${idx}" aria-label="تحديد" onchange="INV.updateSelCount()"></td>
      <td class="n num">${num(rows.length - i)}</td><td class="num">${fmtDate(r.date)}</td><td><strong>${esc(r.name)}</strong></td><td>${esc(r.unit)}</td>
      <td class="qty-out num">-${qtyText(r)}</td><td>${esc(r.dept) || '—'}</td><td class="muted">${esc(r.notes) || '—'}</td>
      <td><div class="acts"><button class="ib" title="طباعة سند (يجمع كل ما صُرف لنفس الجهة بنفس التاريخ)" aria-label="طباعة سند" onclick="INV.printReceipt(${idx})">🖨</button>
        <button class="ib" title="تعديل" aria-label="تعديل" onclick="INV.editOut(${idx})">✏️</button><button class="ib del" title="حذف" aria-label="حذف" onclick="INV.delOut(${idx})">🗑</button></div></td></tr>`;
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
  else la.className = 'inv-alert';

  const tbody = $id('stock-tbody');
  if (!stock.length){ tbody.innerHTML = '<tr><td colspan="8" class="eq-empty">لا توجد أصناف بهذا التصنيف.</td></tr>'; }
  else tbody.innerHTML = stock.map((r, i) => `<tr>
    <td class="n num">${num(i + 1)}</td><td><strong>${esc(r.name)}</strong></td>
    <td>${esc(r.unit) || '—'}${r.pack ? `<small class="inv-pk-sub num">${esc(packLabel(r.pack))}</small>` : ''}</td>
    <td class="qty-in num">${num(r.totalIn)}</td><td class="qty-out num">${num(r.totalOut)}</td>
    <td class="qty-bal num">${num(r.balance)}${r.pack && r.balance >= r.pack.per ? `<small class="inv-pk-sub">${esc(splitPack(r.balance, r.pack))}</small>` : ''}</td>
    <td>${statusBadge(r.balance)}</td>
    <td>${r.name && (!packOf(r.name) || r.pack) ? `<button class="ib" title="${r.pack ? 'تعديل التعبئة' : 'تعريف تعبئة (كرتونة وحبة)'}" aria-label="التعبئة" data-name="${esc(r.name)}" onclick="INV.openPackSheet(this.dataset.name)">📦</button>` : ''}</td></tr>`).join('');
  if (currentTab === 'stock' && isVisible()) renderChart(currentChartType);
}
function filterLow(){ $id('stock-filter').value = 'low'; renderStockTable(); vib(8); }

/* ---------- الرسم البياني ---------- */
function isVisible(){ const p = document.getElementById('page-inventory'); return p && p.classList.contains('active'); }
function cssVar(n){ return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
function showChart(type, btn){
  currentChartType = type; vib(6);
  document.querySelectorAll('#page-inventory .chart-tab').forEach(t => t.setAttribute('aria-pressed', t === btn));
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
// حقلا التعبئة يظهران لوحدات التعبئة (كرتونة…) أو لوحدة الصنف الكبيرة المعرّفة مسبقاً
function updateInPack(prefill){
  const name = $id('in-name').value.trim(), unit = $id('in-unit').value, p = packOf(name);
  const show = PACK_UNITS.includes(unit) || !!(p && p.pack === unit);
  $id('in-per-f').hidden = $id('in-base-f').hidden = $id('in-loose-f').hidden = !show;
  if (show && prefill === true){
    $id('in-per').value = p && p.pack === unit ? p.per : '';
    const other = additions.find(r => r.name === name && !PACK_UNITS.includes(r.unit));
    $id('in-base').value = p ? p.base : other ? other.unit : 'حبة';
  }
  const base = $id('in-base').value, per = parseInt($id('in-per').value, 10), qty = parseInt($id('in-qty').value, 10) || 0;
  const loose = parseInt($id('in-loose').value, 10) || 0;
  $id('in-per-l').textContent = `كم ${base} في ال${unit}؟`;
  $id('in-loose-l').textContent = `فرط بال${base} (اختياري)`;
  let hint = '';
  if (show && per > 1) hint = `١ ${unit} = ${num(per)} ${base}` + (qty || loose ? ` — ${mixText(qty, unit, loose, base)} = <b>${num(qty * per + loose)} ${base}</b>` : '') + `. الرصيد يُحسب بال${base} وتقدر تصرف بأيّهما.`;
  else if (show) hint = `اكتب كم ${base} في ال${unit} لتقدر تصرف بال${base} أيضاً — أو اتركه فارغاً.`;
  else if (p) hint = `«${esc(name)}» معرّف: ${packLabel(p)}. الإضافة بال${unit} تدخل الرصيد مباشرة.`;
  const h = $id('in-pack-hint'); h.innerHTML = hint; h.hidden = !hint;
}
async function addItem(){
  const date = $id('in-date').value, name = $id('in-name').value.trim(), unit = $id('in-unit').value;
  const qty = parseInt($id('in-qty').value, 10) || 0, supplier = $id('in-supplier').value.trim(), notes = $id('in-notes').value.trim();
  const packShown = !$id('in-per-f').hidden, looseRaw = packShown ? $id('in-loose').value.trim() : '';
  const loose = parseInt(looseRaw, 10) || 0;
  if (!date) return markInvalid('in-date', 'التاريخ مطلوب', 'حدّد تاريخ استلام الصنف.');
  if (!name) return markInvalid('in-name', 'اسم الصنف مطلوب', 'اكتب اسم الصنف أو اختره من الاقتراحات.');
  if (looseRaw && (loose < 0 || String(loose) !== looseRaw)) return markInvalid('in-loose', 'عدد الحبات الفرط غير صحيح', 'اكتب رقماً صحيحاً، أو اتركه فارغاً.');
  if (qty < 0 || (qty < 1 && !loose)) return markInvalid('in-qty', 'الكمية غير صحيحة', 'أدخل رقماً صحيحاً أكبر من صفر.');
  const rec = { date, name, unit, qty, supplier, notes };
  // التعبئة (اختيارية): ١ كرتونة = ٢٧ حبة، ومعها حبات فرط في نفس الإضافة
  const cur = packOf(name), editing = editingAddIndex;
  let def = null;
  const perRaw = packShown ? $id('in-per').value.trim() : '';
  if (loose && !perRaw) return markInvalid('in-per', 'عدد الوحدات مطلوب', `اكتب كم ${$id('in-base').value} في ال${unit} لتُحسب الحبات الفرط معها.`);
  if (perRaw){
    const per = parseInt(perRaw, 10), base = $id('in-base').value;
    if (!per || per < 2 || String(per) !== perRaw) return markInvalid('in-per', 'عدد الوحدات غير صحيح', `اكتب كم ${base} في ال${unit} الواحدة (رقم صحيح ٢ أو أكثر)، أو اترك الحقل فارغاً.`);
    if (base === unit) return markInvalid('in-base', 'الوحدة الصغرى نفس الكبيرة', `اختر وحدة أصغر من «${unit}» مثل حبة أو علبة.`);
    if (cur && (cur.pack !== unit || cur.base !== base)) return markInvalid('in-base', 'تعبئة الصنف معرّفة بشكل مختلف', `«${name}» معرّف: ${packLabel(cur)}. لتغييره اضغط 📦 بجانب الصنف في تبويب المخزون.`);
    rec.per = per; if (loose) rec.loose = loose;
    // تعديل سجل قديم لا يغيّر المعامل الافتراضي؛ إضافة جديدة بمعامل مختلف تعتمده للقادم
    if (!cur || (cur.per !== per && editing === null)) def = { base, pack:unit, per };
  } else if (cur && unit === cur.pack){
    return markInvalid('in-per', 'عدد الوحدات مطلوب', `«${name}» يُحسب بال${cur.base} — اكتب كم ${cur.base} في ال${unit} (المعتاد ${num(cur.per)}).`);
  }
  const place = list => { const t = list.slice(); if (editing !== null) t[editing] = rec; else t.push(rec); return t; };
  if (editing !== null){
    const check = () => negativeAfter(place(additions), withdrawals);
    const neg = def ? withPacks(planPack(name, def).packs, check) : check();
    if (neg.length) return notify({ type:'error', title:'لا يمكن حفظ هذا التعديل', msg:`رصيد «${neg[0].name}» يصبح ${num(neg[0].balance)} ${neg[0].unit} لأن المصروف منه أكثر. عدّل سجلات الصرف أولاً أو زِد الكمية.` });
  }
  if (def && !(await confirmPackNegatives(name, def, place))) return;
  if (def) commitPack(name, def);
  if (editing !== null){
    additions[editing] = rec; flashIdx.in = editing;
    finishEditAdd();
    notify({ type:'success', title:'تم حفظ التعديل', msg:`${name} — ${qtyDesc(rec)}`, page:'inventory' });
  } else {
    additions.push(rec); flashIdx.in = additions.length - 1;
    const bal = computeStock().find(s => s.key === keyOf(rec));
    notify({ type:'success', title:`تمت إضافة ${qtyDesc(rec)} من ${name}`, page:'inventory',
      msg:(perOf(rec) > 1 ? `= ${num(baseQty(rec))} ${baseUnit(rec)}. ` : '') + `الرصيد الحالي: ${bal ? balText(bal.balance, bal.unit, bal.pack) : num(qty) + ' ' + unit}` + (def ? ` — صار «${name}» يُصرف بال${def.base} أو بال${def.pack}.` : ''),
      action:{ label:'صرف منه', fn:() => { switchTab('out'); $id('out-name').value = keyOf(rec); updateOutInfo(); $id('out-qty').focus(); } } });
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
  updateInPack(true); if (r.per) $id('in-per').value = r.per; $id('in-loose').value = r.loose || ''; updateInPack();
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
function clearInForm(user){ ['in-name','in-qty','in-supplier','in-notes','in-per','in-loose'].forEach(id => $id(id).value = ''); updateInPack(); if (user === true) vib(6); }

/* ---------- الصرف ---------- */
function withdrawItem(){
  const date = $id('out-date').value, sel = $id('out-name'), opt = sel.options[sel.selectedIndex], key = sel.value;
  const name = opt ? (opt.dataset.name || '') : '', unit = $id('out-unit').value;
  const qty = parseInt($id('out-qty').value, 10) || 0, dept = $id('out-dept').value.trim(), notes = $id('out-notes').value.trim();
  // حبات فرط مع الكراتين في نفس الصرف (٢ كرتونة + ٥ حبات)
  const looseRaw = $id('out-loose-f').hidden ? '' : $id('out-loose').value.trim(), loose = parseInt(looseRaw, 10) || 0;
  if (!date) return markInvalid('out-date', 'التاريخ مطلوب', 'حدّد تاريخ الصرف.');
  if (!key || !name) return markInvalid('out-name', 'اختر الصنف', 'اختر الصنف المراد صرفه من القائمة.');
  if (looseRaw && (loose < 0 || String(loose) !== looseRaw)) return markInvalid('out-loose', 'عدد الحبات الفرط غير صحيح', 'اكتب رقماً صحيحاً، أو اتركه فارغاً.');
  if (qty < 0 || (qty < 1 && !loose)) return markInvalid('out-qty', 'الكمية غير صحيحة', 'أدخل رقماً صحيحاً أكبر من صفر.');
  if (!dept) return markInvalid('out-dept', 'الجهة المستلمة مطلوبة', 'اكتب الجهة ليظهر اسمها على سند الصرف.');
  const item = computeStock().find(s => s.key === key), p = item && item.pack;
  const orig = editingOutIndex !== null ? withdrawals[editingOutIndex] : null;
  // الصرف بالوحدة الكبيرة يُخصم بالصغرى؛ تعديل سجل قديم يحتفظ بمعامله
  const per = p && unit === p.pack ? (orig && orig.name === name && orig.unit === unit && +orig.per || p.per) : 1;
  const lo = per > 1 ? loose : 0, need = qty * per + lo, bu = item ? item.unit : unit;
  let available = item ? item.balance : 0;
  if (orig && keyOf(orig) === key) available += baseQty(orig);
  if (need > available) return markInvalid(lo && !qty ? 'out-loose' : 'out-qty', 'الكمية أكبر من الرصيد', `المتاح من «${name}» ${balText(Math.max(available, 0), bu, p)} فقط` + (per > 1 ? ` — طلبت ${mixText(qty, unit, lo, bu)} = ${num(need)} ${bu}.` : '.'));
  const rec = { date, name, unit, qty, dept, notes };
  if (per > 1){ rec.per = per; if (lo) rec.loose = lo; }
  let idx;
  if (editingOutIndex !== null){
    withdrawals[editingOutIndex] = rec; idx = editingOutIndex;
    finishEditOut();
    notify({ type:'success', title:'تم حفظ التعديل', msg:`${name} — ${qtyDesc(rec)} إلى ${dept}`, page:'inventory' });
  } else {
    withdrawals.push(rec); idx = withdrawals.length - 1;
    const left = available - need, lt = balText(left, bu, p);
    notify({ type: left <= 0 ? 'warning' : 'success', title:`تم صرف ${qtyDesc(rec)} من ${name}`,
      msg:`إلى ${dept}${per > 1 ? ` (= ${num(need)} ${bu})` : ''}. ${left <= 0 ? 'نفد الصنف من المخزون.' : left < LOW ? 'الرصيد المتبقي منخفض: ' + lt + '.' : 'المتبقي: ' + lt + '.'}`,
      action:{ label:'طباعة السند', fn:() => printReceipt(idx) }, page:'inventory', duration:7000 });
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
  const key = keyOf(r); $id('out-name').value = key; editingOutIndex = i; updateOutInfo();
  $id('out-unit').value = r.unit; $id('out-qty').value = r.qty; $id('out-loose').value = r.loose || ''; $id('out-dept').value = r.dept || ''; $id('out-notes').value = r.notes || '';
  const bal = computeStock().find(s => s.key === key);
  if (bal) $id('out-balance').value = `${balText(bal.balance + baseQty(r), bal.unit, bal.pack)} مع هذا السجل`;
  updateOutHint();
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
function clearOutForm(user){ ['out-name','out-qty','out-loose','out-dept','out-notes','out-balance'].forEach(id => $id(id).value = ''); $id('out-unit').innerHTML = ''; $id('out-balance').className = 'inp num'; updateOutHint(); if (user === true) vib(6); }

/* ---------- الحذف (مع تأكيد وتراجع) ---------- */
async function delAdd(i){
  const r = additions[i]; if (!r) return;
  const trial = additions.filter((_, k) => k !== i);
  const neg = negativeAfter(trial, withdrawals);
  if (neg.length) return notify({ type:'error', title:'لا يمكن حذف هذه الإضافة', msg:`صُرف من «${r.name}» أكثر مما سيبقى، فيصبح الرصيد ${num(neg[0].balance)} ${neg[0].unit}. احذف أو عدّل سجلات الصرف المرتبطة أولاً.` });
  const ok = await confirmD({ title:'حذف هذه الإضافة؟', msg:`${r.name} — ${qtyDesc(r)} بتاريخ ${fmtDate(r.date)}. ينقص الرصيد بنفس الكمية.`, okText:'حذف', danger:true });
  if (!ok) return;
  if (editingAddIndex === i) cancelEditAdd(true); else if (editingAddIndex !== null && editingAddIndex > i) editingAddIndex--;
  additions.splice(i, 1);
  saveData(); populateDropdowns(); renderInTable(); renderStockTable();
  notify({ type:'success', title:'تم حذف الإضافة', msg:`${r.name} — ${qtyDesc(r)}`, page:'inventory',
    action:{ label:'تراجع', fn:() => { additions.splice(i, 0, r); flashIdx.in = i; saveData(); populateDropdowns(); renderInTable(); renderStockTable(); notify({ type:'info', title:'تمت استعادة السجل المحذوف', log:false }); } }, duration:8000 });
}
async function delOut(i){
  const r = withdrawals[i]; if (!r) return;
  const ok = await confirmD({ title:'حذف هذا الصرف؟', msg:`${r.name} — ${qtyDesc(r)} إلى ${r.dept || '—'}. تعود الكمية للرصيد.`, okText:'حذف', danger:true });
  if (!ok) return;
  if (editingOutIndex === i) cancelEditOut(true); else if (editingOutIndex !== null && editingOutIndex > i) editingOutIndex--;
  withdrawals.splice(i, 1);
  saveData(); populateDropdowns(); renderOutTable(); renderStockTable();
  notify({ type:'success', title:'تم حذف الصرف', msg:`عادت ${qtyDesc(r)} من «${r.name}» للرصيد.`, page:'inventory',
    action:{ label:'تراجع', fn:() => { withdrawals.splice(i, 0, r); flashIdx.out = i; saveData(); populateDropdowns(); renderOutTable(); renderStockTable(); notify({ type:'info', title:'تمت استعادة السجل المحذوف', log:false }); } }, duration:8000 });
}

/* ---------- طباعة سند صرف ---------- */
function getSelectedOutIndices(){ return Array.from(document.querySelectorAll('#page-inventory .out-chk')).filter(c => c.checked).map(c => parseInt(c.dataset.idx, 10)); }
function updateSelCount(){
  const n = getSelectedOutIndices().length, b = $id('print-sel');
  if (b){ b.textContent = n ? `طباعة سند للمحدد (${num(n)})` : 'طباعة سند للمحدد'; b.classList.toggle('btn-primary', n > 0); }
}
function toggleAll(on){ document.querySelectorAll('#page-inventory .out-chk').forEach(c => c.checked = on); updateSelCount(); vib(6); }
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
      <tbody>${items.map((it, n) => `<tr><td>${n + 1}</td><td>${esc(it.name)}</td><td>${esc(it.unit)}</td><td>${qtyText(it)}</td>${multiDate ? `<td>${fmtDate(it.date)}</td>` : ''}<td>${esc(it.notes) || '—'}</td></tr>`).join('')}</tbody></table>
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

/* ---------- سندات الإضافة ---------- */
function getSelectedAddIndices(){ return Array.from(document.querySelectorAll('#page-inventory .in-chk')).filter(c => c.checked).map(c => parseInt(c.dataset.idx, 10)); }
function updateSelCountIn(){
  const n = getSelectedAddIndices().length, b = $id('print-sel-in');
  if (b){ b.textContent = n ? `طباعة سند للمحدد (${num(n)})` : 'طباعة سند للمحدد'; b.classList.toggle('btn-primary', n > 0); }
}
function toggleAllIn(on){ document.querySelectorAll('#page-inventory .in-chk').forEach(c => c.checked = on); updateSelCountIn(); vib(6); }
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
      <tbody>${items.map((it, n) => `<tr><td>${n + 1}</td><td>${esc(it.name)}</td><td>${esc(it.unit)}</td><td>${qtyText(it)}</td>${multiDate ? `<td>${fmtDate(it.date)}</td>` : ''}<td>${esc(it.notes) || '—'}</td></tr>`).join('')}
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

/* ---------- التقرير المفصل حسب الأشهر ---------- */
let reportSheet = null;
function openReportSheet(){
  const months = allMonths();
  if (!months.length) return notify({ type:'warning', title:'لا توجد بيانات مؤرخة', msg:'أضف حركات عليها تواريخ ثم أعد المحاولة.', log:false });
  const rows = months.map(m => {
    const a = additions.filter(r => monthKey(r.date) === m).length, w = withdrawals.filter(r => monthKey(r.date) === m).length;
    return `<label class="inv-mrow"><input type="checkbox" class="inv-mchk" value="${m}"><span class="inv-mname">${monthLabel(m)}</span><span class="inv-mcnt num">${num(a)} إضافة · ${num(w)} صرف</span></label>`;
  }).join('');
  reportSheet = App.sheet(`
    <div class="mk-form-head"><h3>تقرير مفصل حسب الأشهر</h3><p class="mk-hint">اختر شهراً أو أكثر. إن لم تختر شيئاً يشمل التقرير كل الفترات.</p></div>
    <div class="inv-mtools">
      <button class="btn btn-sm" onclick="INV.reportSelectAll(true)">تحديد الكل</button>
      <button class="btn btn-sm btn-ghost" onclick="INV.reportSelectAll(false)">مسح التحديد</button>
      <button class="btn btn-sm" onclick="INV.reportSelectLast(3)">آخر ٣ أشهر</button>
    </div>
    <div class="inv-mlist">${rows}</div>
    <div class="mk-btns"><button class="btn btn-primary" onclick="INV.runDetailedReport()">إنشاء التقرير</button></div>`, { cls:'wide', onClose:() => { reportSheet = null; } });
  vib(8);
}
function reportSelectAll(on){ document.querySelectorAll('.inv-mchk').forEach(c => c.checked = on); vib(6); }
function reportSelectLast(n){
  const ms = allMonths().slice(0, n);
  document.querySelectorAll('.inv-mchk').forEach(c => c.checked = ms.includes(c.value));
  vib(6);
}
function runDetailedReport(){
  const sel = Array.from(document.querySelectorAll('.inv-mchk')).filter(c => c.checked).map(c => c.value);
  if (reportSheet && reportSheet.close) reportSheet.close();
  printDetailedReport(sel);
}
function printDetailedReport(monthsSel){
  const set = new Set(monthsSel || []);
  const inScope = r => !set.size || set.has(monthKey(r.date));
  const adds = additions.filter(inScope).slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const outs = withdrawals.filter(inScope).slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  if (!adds.length && !outs.length) return notify({ type:'warning', title:'لا توجد بيانات في الأشهر المختارة', msg:'اختر أشهراً أخرى وأعد المحاولة.', log:false });

  const scope = set.size ? [...set].sort().reverse().map(monthLabel).join(' · ') : 'كل الفترات';
  const tIn = adds.reduce((a, r) => a + baseQty(r), 0), tOut = outs.reduce((a, r) => a + baseQty(r), 0);
  const stockAll = computeStock();
  const balOf = {}; stockAll.forEach(s => balOf[s.key] = s.balance);

  // الملخص الشهري
  const months = [...new Set([...adds, ...outs].map(r => monthKey(r.date)).filter(Boolean))].sort().reverse();
  const mRows = months.map(m => {
    const a = adds.filter(r => monthKey(r.date) === m), w = outs.filter(r => monthKey(r.date) === m);
    const ai = a.reduce((x, r) => x + baseQty(r), 0), wo = w.reduce((x, r) => x + baseQty(r), 0);
    return `<tr><td><b>${monthLabel(m)}</b></td><td>${num(ai)}</td><td>${num(wo)}</td><td>${num(ai - wo)}</td><td>${num(a.length + w.length)}</td></tr>`;
  }).join('');

  // حركة الأصناف داخل النطاق
  const mv = {};
  const touch = r => { const k = keyOf(r); if (!mv[k]) mv[k] = { name:r.name, unit:baseUnit(r), inQ:0, outQ:0 }; return mv[k]; };
  adds.forEach(r => touch(r).inQ += baseQty(r));
  outs.forEach(r => touch(r).outQ += baseQty(r));
  const packAt = {}; stockAll.forEach(s => packAt[s.key] = s.pack);
  const itemRows = Object.entries(mv).sort((a, b) => b[1].outQ - a[1].outQ || a[1].name.localeCompare(b[1].name, 'ar')).map(([k, v], i) => {
    const bal = balOf[k] ?? (v.inQ - v.outQ);
    const st = bal <= 0 ? 'نافد' : bal < LOW ? 'منخفض' : 'متوفر';
    const pk = packAt[k];
    return `<tr><td>${num(i + 1)}</td><td>${esc(v.name)}</td><td>${esc(v.unit) || '—'}${pk ? `<br><small>${esc(packLabel(pk))}</small>` : ''}</td><td>${num(v.inQ)}</td><td>${num(v.outQ)}</td><td>${num(v.inQ - v.outQ)}</td><td>${esc(balText(bal, v.unit, pk))}</td><td>${st}</td></tr>`;
  }).join('');

  // حسب الجهة
  const byDept = {};
  outs.forEach(r => { const k = r.dept || '—'; if (!byDept[k]) byDept[k] = { qty:0, count:0, last:'' }; byDept[k].qty += baseQty(r); byDept[k].count++; if ((r.date || '') > byDept[k].last) byDept[k].last = r.date || ''; });
  const deptRows = Object.entries(byDept).sort((a, b) => b[1].qty - a[1].qty).map(([d, v], i) =>
    `<tr><td>${num(i + 1)}</td><td>${esc(d)}</td><td>${num(v.qty)}</td><td>${num(v.count)}</td><td>${fmtDate(v.last)}</td></tr>`).join('');

  // حسب المورد
  const bySup = {};
  adds.forEach(r => { const k = r.supplier || '—'; if (!bySup[k]) bySup[k] = { qty:0, count:0, last:'' }; bySup[k].qty += baseQty(r); bySup[k].count++; if ((r.date || '') > bySup[k].last) bySup[k].last = r.date || ''; });
  const supRows = Object.entries(bySup).sort((a, b) => b[1].qty - a[1].qty).map(([d, v], i) =>
    `<tr><td>${num(i + 1)}</td><td>${esc(d)}</td><td>${num(v.qty)}</td><td>${num(v.count)}</td><td>${fmtDate(v.last)}</td></tr>`).join('');

  const empty = c => `<tr><td colspan="${c}" style="text-align:center;padding:16px;color:#999">لا توجد بيانات</td></tr>`;
  const body = `<h1>التقرير المفصل لمخزون الطعام</h1>
    <div class="sub">النطاق: <b>${esc(scope)}</b> — تاريخ الإصدار: ${fmtDate(today())}</div>
    <h2>١. الملخص التنفيذي</h2>
    <div class="kpis">
      <div class="kpi"><div class="kv">${num(tIn)}</div><div class="kl">إجمالي الوارد بالفترة</div></div>
      <div class="kpi"><div class="kv">${num(tOut)}</div><div class="kl">إجمالي الصادر بالفترة</div></div>
      <div class="kpi"><div class="kv">${num(tIn - tOut)}</div><div class="kl">صافي الحركة</div></div>
      <div class="kpi"><div class="kv">${num(Object.keys(mv).length)}</div><div class="kl">أصناف متحرّكة</div></div>
      <div class="kpi"><div class="kv">${num(Object.keys(byDept).length)}</div><div class="kl">جهات مستلمة</div></div>
      <div class="kpi"><div class="kv">${num(adds.length + outs.length)}</div><div class="kl">عدد العمليات</div></div>
    </div>
    <h2>٢. الملخص الشهري</h2>
    <table><thead><tr><th>الشهر</th><th>الوارد</th><th>الصادر</th><th>الصافي</th><th>العمليات</th></tr></thead><tbody>${mRows || empty(5)}</tbody></table>
    <h2>٣. حركة الأصناف</h2>
    <table><thead><tr><th>#</th><th>الصنف</th><th>الوحدة</th><th>وارد بالفترة</th><th>صادر بالفترة</th><th>الصافي</th><th>الرصيد الحالي</th><th>الحالة</th></tr></thead><tbody>${itemRows || empty(8)}</tbody></table>
    <h2>٤. الصرف حسب الجهة</h2>
    <table><thead><tr><th>#</th><th>الجهة المستلمة</th><th>الكمية</th><th>العمليات</th><th>آخر صرف</th></tr></thead><tbody>${deptRows || empty(5)}</tbody></table>
    <h2>٥. الوارد حسب المورد</h2>
    <table><thead><tr><th>#</th><th>المورد</th><th>الكمية</th><th>العمليات</th><th>آخر توريد</th></tr></thead><tbody>${supRows || empty(5)}</tbody></table>
    <h2>٦. تفاصيل الإضافات</h2>
    <table><thead><tr><th>#</th><th>التاريخ</th><th>الصنف</th><th>الوحدة</th><th>الكمية</th><th>المورد</th><th>ملاحظات</th></tr></thead><tbody>
      ${adds.map((r, i) => `<tr><td>${num(i + 1)}</td><td>${fmtDate(r.date)}</td><td>${esc(r.name)}</td><td>${esc(r.unit) || '—'}</td><td>${qtyText(r)}</td><td>${esc(r.supplier) || '—'}</td><td>${esc(r.notes) || '—'}</td></tr>`).join('') || empty(7)}</tbody></table>
    <h2>٧. تفاصيل الصرف</h2>
    <table><thead><tr><th>#</th><th>التاريخ</th><th>الصنف</th><th>الوحدة</th><th>الكمية</th><th>الجهة</th><th>ملاحظات</th></tr></thead><tbody>
      ${outs.map((r, i) => `<tr><td>${num(i + 1)}</td><td>${fmtDate(r.date)}</td><td>${esc(r.name)}</td><td>${esc(r.unit) || '—'}</td><td>${qtyText(r)}</td><td>${esc(r.dept) || '—'}</td><td>${esc(r.notes) || '—'}</td></tr>`).join('') || empty(7)}</tbody></table>
    <div class="sig"><div class="s">أمين المخزن</div><div class="s">مدير العمليات</div><div class="s">اعتماد المدير العام</div></div>
    <div class="foot">تقرير مُصدر إلكترونياً — ${fmtDate(today())}</div>`;
  const ok = openPrintWindow(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>التقرير المفصل لمخزون الطعام</title>
  <style>body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;direction:rtl;padding:24px;color:#111}
  h1{text-align:center;font-size:1.25rem;margin:8px 0 2px}.sub{text-align:center;color:#555;font-size:.85rem;margin-bottom:16px}
  h2{font-size:1rem;margin:24px 0 9px;padding-bottom:5px;border-bottom:2px solid #1B3B2F;color:#1B3B2F;page-break-after:avoid}
  table{width:100%;border-collapse:collapse;font-size:.82rem}
  th{background:#1B3B2F;color:#fff;padding:7px 9px;text-align:right;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  td{border-bottom:1px solid #ddd;padding:6px 9px;vertical-align:top}
  .kpis{display:flex;gap:9px;flex-wrap:wrap;margin-bottom:8px}
  .kpi{flex:1;min-width:105px;padding:10px;border-radius:7px;text-align:center;border:1px solid #ccc}
  .kv{font-size:1.1rem;font-weight:bold}.kl{font-size:.67rem;color:#555}
  .sig{margin-top:44px;display:flex;gap:30px;page-break-inside:avoid}
  .s{flex:1;text-align:center;border-top:1px solid #111;padding-top:6px;font-size:.82rem}
  .foot{margin-top:16px;font-size:.7rem;color:#888;text-align:center}@media print{body{padding:0}}</style></head><body>
  ${window.App ? App.letterheadHTML() : ''}${body}
  <script>window.onload=()=>window.print();<\/script></body></html>`);
  if (ok) notify({ type:'info', title:'تم تجهيز التقرير المفصل', msg:`${esc(scope)} — ${num(adds.length)} إضافة و${num(outs.length)} صرف. اختر «حفظ بصيغة PDF».`, log:false });
}

/* ---------- تعبئة الصنف (كرتونة = عدد من الحبات) ---------- */
let packSheet = null;
function openPackSheet(name){
  if (!name) return;
  const p = packOf(name);
  const other = additions.concat(withdrawals).find(r => r.name === name && !PACK_UNITS.includes(r.unit));
  const base = p ? p.base : other ? other.unit : 'حبة', pack = p ? p.pack : 'كرتونة';
  const opts = sel => UNITS.map(u => `<option${u === sel ? ' selected' : ''}>${u}</option>`).join('');
  packSheet = App.sheet(`
    <div class="mk-form-head"><h3>تعبئة «${esc(name)}»</h3></div>
    <p class="mk-hint">حدّد كم وحدة صغرى في الوحدة الكبيرة. الرصيد يُحسب بالصغرى ويُعرض بالاثنتين، وتقدر تضيف وتصرف بأيّهما. السجلات القديمة بالوحدتين تنضم لرصيد واحد.</p>
    <div class="mk-grid inv-pk">
      <div class="mk-field"><label for="inv-pk-pack">الوحدة الكبيرة</label><select class="mk-inp" id="inv-pk-pack" onchange="INV.previewPack()">${opts(pack)}</select></div>
      <div class="mk-field"><label for="inv-pk-per">كم وحدة صغرى فيها؟ <i>*</i></label><input class="mk-inp num" type="number" id="inv-pk-per" min="2" inputmode="numeric" placeholder="مثال: 27" value="${p ? p.per : ''}" oninput="INV.previewPack()"></div>
      <div class="mk-field"><label for="inv-pk-base">الوحدة الصغرى</label><select class="mk-inp" id="inv-pk-base" onchange="INV.previewPack()">${opts(base)}</select></div>
    </div>
    <div class="inv-pack-hint" id="inv-pk-prev"></div>
    <div class="mk-btns"><button class="btn btn-primary" onclick="INV.savePack()">حفظ التعبئة</button>
      ${p ? '<button class="btn btn-danger" onclick="INV.removePack()">إلغاء التعبئة</button>' : ''}</div>`, { onClose:() => { packSheet = null; } });
  packSheet.name = name;
  previewPack(); vib(8);
  setTimeout(() => { const el = $id('pk-per'); if (el) el.focus(); }, 250);
}
function readPackForm(){ return { pack:$id('pk-pack').value, base:$id('pk-base').value, per:parseInt($id('pk-per').value, 10) }; }
function previewPack(){
  if (!packSheet) return;
  const name = packSheet.name, d = readPackForm(), el = $id('pk-prev');
  if (!(d.per > 1) || d.pack === d.base){ el.textContent = d.pack === d.base ? 'الوحدتان لازم تختلفا.' : `اكتب كم ${d.base} في ال${d.pack}.`; return; }
  const plan = planPack(name, d), s = withPacks(plan.packs, () => computeStock(plan.adds, plan.outs)).find(x => x.name === name && x.unit === d.base);
  el.innerHTML = `${packLabel(d)} — الرصيد بعد التوحيد: <b>${s ? balText(s.balance, d.base, d) : '٠ ' + d.base}</b>` + (s && s.balance < 0 ? ' <b class="bad">(سالب — راجع السجلات)</b>' : '');
}
async function savePack(){
  if (!packSheet) return;
  const name = packSheet.name, d = readPackForm(), old = packOf(name);
  if (!(d.per > 1) || String(d.per) !== $id('pk-per').value.trim()) return markInvalid('pk-per', 'العدد غير صحيح', `اكتب كم ${d.base} في ال${d.pack} (رقم صحيح ٢ أو أكثر).`);
  if (d.pack === d.base) return markInvalid('pk-base', 'الوحدتان متطابقتان', 'اختر وحدة صغرى غير الوحدة الكبيرة.');
  if (!(await confirmPackNegatives(name, d))) return;
  commitPack(name, { base:d.base, pack:d.pack, per:d.per });
  if (packSheet) packSheet.close();
  saveData(); refreshAll();
  const s = computeStock().find(x => x.name === name && x.unit === d.base);
  notify({ type:'success', title: old ? `تم تعديل تعبئة «${name}»` : `صار «${name}» يُصرف بال${d.base} أو بال${d.pack}`, page:'inventory', duration:8000,
    msg:`${packLabel(d)}. الرصيد: ${s ? balText(s.balance, s.unit, s.pack) : '٠'}.`,
    action:{ label:'صرف منه', fn:() => { switchTab('out'); $id('out-name').value = stockKey(name, d.base); updateOutInfo(); $id('out-qty').focus(); } } });
}
async function removePack(){
  if (!packSheet) return;
  const name = packSheet.name, old = packOf(name); if (!old) return;
  const mixed = additions.concat(withdrawals).filter(r => r.name === name && r.unit === old.pack && +r.loose > 0).length;
  if (mixed) return notify({ type:'error', title:'لا يمكن إلغاء التعبئة', msg:`في ${num(mixed)} سجل لـ«${name}» فيه ${old.pack} وحبات فرط معاً، ولا تنفصل بدون التعبئة. عدّل التعبئة بدل إلغائها، أو عدّل هذه السجلات أولاً.` });
  const ok = await confirmD({ title:`إلغاء تعبئة «${name}»؟`, msg:`يرجع رصيد ال${old.pack} وال${old.base} منفصلين كما كانا. السجلات نفسها لا تُحذف.`, okText:'إلغاء التعبئة', cancelText:'رجوع', danger:true });
  if (!ok || !(await confirmPackNegatives(name, null))) return;
  commitPack(name, null);
  if (packSheet) packSheet.close();
  saveData(); refreshAll();
  notify({ type:'success', title:`تم إلغاء تعبئة «${name}»`, msg:'الرصيد صار منفصلاً لكل وحدة.', page:'inventory', duration:8000,
    action:{ label:'تراجع', fn:() => { commitPack(name, old); saveData(); refreshAll(); notify({ type:'info', title:'تمت استعادة التعبئة', log:false }); } } });
}

/* ---------- القوائم المنسدلة ---------- */
function populateDropdowns(){
  const stock = computeStock(), sel = $id('out-name'), cur = sel.value;
  sel.innerHTML = '<option value="">— اختر —</option>';
  stock.slice().sort((a, b) => a.name.localeCompare(b.name, 'ar')).forEach(s => {
    const o = document.createElement('option');
    o.value = s.key; o.textContent = `${s.name} — ${s.pack ? s.unit + '/' + s.pack.pack : s.unit || '—'}  (رصيد: ${balText(s.balance, s.unit, s.pack)})`;
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
function updateOutHint(){
  const h = $id('out-pack-hint'), key = $id('out-name').value;
  const s = key ? computeStock().find(x => x.key === key) : null, p = s && s.pack;
  const unit = $id('out-unit').value, lf = $id('out-loose-f');
  lf.hidden = !p || unit !== p.pack; // حقل الحبات الفرط مع الصرف بالكرتونة فقط
  if (!p){ h.hidden = true; return; }
  $id('out-loose-l').textContent = `فرط بال${p.base} (اختياري)`;
  const qty = parseInt($id('out-qty').value, 10) || 0;
  const orig = editingOutIndex !== null ? withdrawals[editingOutIndex] : null;
  const per = unit === p.pack ? (orig && orig.name === s.name && orig.unit === unit && +orig.per || p.per) : 1;
  const lo = per > 1 ? (parseInt($id('out-loose').value, 10) || 0) : 0, need = qty * per + lo;
  const left = s.balance + (orig && keyOf(orig) === key ? baseQty(orig) : 0) - need;
  h.innerHTML = `${packLabel(p)}` + (need > 0 ? ` — تصرف ${mixText(qty, unit, lo, p.base)}${per > 1 ? ` = <b>${num(need)} ${p.base}</b>` : ''}، ` + (left < 0 ? `<b class="bad">أكثر من الرصيد</b>` : `يبقى ${balText(left, p.base, p)}`) : `. اختر وحدة الصرف: ${p.base} أو ${p.pack}.`);
  h.hidden = false;
}
function updateOutInfo(){
  const sel = $id('out-name'), opt = sel.options[sel.selectedIndex];
  const s = sel.value ? computeStock().find(x => x.key === sel.value) : null;
  // الصنف المعرّفة تعبئته يُصرف بالوحدة الصغرى أو الكبيرة
  $id('out-unit').innerHTML = s ? [s.unit, ...(s.pack ? [s.pack.pack] : [])].map(u => `<option value="${esc(u)}">${esc(u || '—')}</option>`).join('') : '';
  const b = s ? s.balance : null;
  $id('out-balance').value = s ? balText(b, s.unit, s.pack) : '';
  updateOutHint();
  $id('out-balance').className = 'inp num ' + (b === null ? '' : balClass(b));
  if (b !== null && b <= 0 && editingOutIndex === null) notify({ type:'warning', title:'هذا الصنف نافد', msg:'أضف كمية جديدة من تبويب الإضافة قبل الصرف.', log:false, action:{ label:'إضافة كمية', fn:() => { switchTab('in'); $id('in-name').value = opt.dataset.name; $id('in-unit').value = opt.dataset.unit || $id('in-unit').value; $id('in-qty').focus(); } } });
}

/* ---------- التصدير ---------- */
function exportExcel(){
  vib(10);
  if (typeof XLSX === 'undefined') return notify({ type:'error', title:'مكتبة Excel غير محمّلة', msg:'أعد تحميل التطبيق ثم حاول مجدداً.' });
  try {
    const wb = XLSX.utils.book_new();
    const addData = [['التاريخ','اسم الصنف','الوحدة','الكمية','المورد','ملاحظات','حبات فرط','بالوحدة الصغرى']];
    additions.forEach(r => addData.push([r.date, r.name, r.unit, r.qty, r.supplier, r.notes, looseOf(r) || '', perOf(r) > 1 ? `${baseQty(r)} ${baseUnit(r)}` : '']));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(addData), 'الإضافات');
    const outData = [['التاريخ','اسم الصنف','الوحدة','الكمية','الجهة المستلمة','ملاحظات','حبات فرط','بالوحدة الصغرى']];
    withdrawals.forEach(r => outData.push([r.date, r.name, r.unit, r.qty, r.dept, r.notes, looseOf(r) || '', perOf(r) > 1 ? `${baseQty(r)} ${baseUnit(r)}` : '']));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(outData), 'الصرف');
    const stData = [['اسم الصنف','الوحدة','الوارد','الصادر','الرصيد','الحالة','التعبئة','الرصيد بالتعبئة']];
    computeStock().forEach(r => stData.push([r.name, r.unit, r.totalIn, r.totalOut, r.balance, r.balance <= 0 ? 'نافد' : r.balance < LOW ? 'منخفض' : 'متوفر', r.pack ? `1 ${r.pack.pack} = ${r.pack.per} ${r.pack.base}` : '', r.pack ? splitPack(r.balance, r.pack) : '']));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(stData), 'المخزون');
    const fname = 'مخزون_الطعام_' + today() + '.xlsx';
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
  const rows = stock.map((r, i) => `<tr style="background:${i % 2 === 0 ? '#f8f9fa' : '#fff'}"><td>${i + 1}</td><td>${esc(r.name)}</td><td>${esc(r.unit) || '—'}${r.pack ? `<br><small>${esc(packLabel(r.pack))}</small>` : ''}</td>
    <td style="color:#1d6f42;font-weight:bold">${r.totalIn.toLocaleString()}</td><td style="color:#c0392b;font-weight:bold">${r.totalOut.toLocaleString()}</td>
    <td style="color:#2980b9;font-weight:bold">${r.balance.toLocaleString()}${r.pack && r.balance >= r.pack.per ? `<br><small style="font-weight:normal">${esc(splitPack(r.balance, r.pack))}</small>` : ''}</td><td>${r.balance <= 0 ? 'نافد' : r.balance < LOW ? 'منخفض' : 'متوفر'}</td></tr>`).join('');
  const ok = openPrintWindow(`<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><title>تقرير المخزون العام</title>
  <style>body{font-family:Tahoma,Arial,sans-serif;direction:rtl;padding:20px}h1{text-align:center;color:#1B3B2F;font-size:1.2rem}
  .sub{text-align:center;color:#666;font-size:.82rem;margin-bottom:16px}.kpis{display:flex;gap:10px;margin-bottom:16px}
  .kpi{padding:10px 16px;border-radius:8px;text-align:center;flex:1}.kpi.g{background:#eafaf1;border:1px solid #38d9a9}.kpi.r{background:#fdecea;border:1px solid #ff6b6b}.kpi.b{background:#e8f4fd;border:1px solid #4f9cf9}
  .kv{font-size:1.3rem;font-weight:bold}.kl{font-size:.7rem;color:#666}table{width:100%;border-collapse:collapse;font-size:.8rem}
  th{background:#1B3B2F;color:#fff;padding:7px 10px;text-align:right}td{padding:6px 10px;border-bottom:1px solid #eee}@media print{body{padding:0}}</style></head><body>
  ${window.App ? App.letterheadHTML() : ''}<h1>تقرير المخزون العام</h1><div class="sub">تاريخ: ${now} — إجمالي الأصناف: ${stock.length}</div>
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
    if (!data || !Array.isArray(data.additions) || !Array.isArray(data.withdrawals)) return notify({ type:'error', title:'الملف ليس نسخة من إدارة المخزون', msg:'اختر ملفاً نُزّل من زر «نسخة احتياطية» في تطبيق إدارة المخزون المستقل.' });
    const ok = await confirmD({ title:'استبدال بيانات المعدات؟', msg:`الملف فيه ${num(data.additions.length)} إضافة و${num(data.withdrawals.length)} صرف. الحالي: ${num(additions.length)} إضافة و${num(withdrawals.length)} صرف. سيُستبدل الحالي بالكامل.`, okText:'استبدال البيانات', danger:true, icon:'inbox' });
    if (!ok) return notify({ type:'info', title:'تم إلغاء الاستيراد', msg:'لم يتغيّر شيء.', log:false });
    const prevA = additions.slice(), prevW = withdrawals.slice(), prevP = { ...packs };
    additions.length = 0; data.additions.forEach(r => additions.push(r));
    withdrawals.length = 0; data.withdrawals.forEach(r => withdrawals.push(r));
    replacePacks(data.packs);
    cancelEditAdd(true); cancelEditOut(true);
    saveData(); refreshAll();
    notify({ type:'success', title:'تم استيراد بيانات المعدات', msg:`${num(additions.length)} إضافة و${num(withdrawals.length)} صرف.`, page:'inventory', duration:9000,
      action:{ label:'تراجع', fn:() => { additions.length = 0; prevA.forEach(r => additions.push(r)); withdrawals.length = 0; prevW.forEach(r => withdrawals.push(r)); replacePacks(prevP); saveData(); refreshAll(); notify({ type:'info', title:'تم التراجع عن الاستيراد', log:false }); } } });
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
  openReportSheet, reportSelectAll, reportSelectLast, runDetailedReport,
  updateInPack, updateOutHint, openPackSheet, previewPack, savePack, removePack,
  computeStock, init, onShow, alerts,
  _data:{ additions, withdrawals, packs }
};
})();

window.NotificationRegistry = window.NotificationRegistry || {};
NotificationRegistry.inventory = () => INV.alerts();
(window.MODULE_INITS = window.MODULE_INITS || []).push(INV.init);
