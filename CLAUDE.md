# النظام الإداري الموحّد — تعليمات العمل

تطبيق واحد أوفلاين قابل للتثبيت (PWA) يجمع ٧ وحدات إدارية. الردود باللهجة الشامية.

## قواعد لا تُكسر

1. **التعديل على `src/` فقط.** `unified-admin/index.html` و`dist/` و`release/` كلها **مُولَّدة** — ممنوع تعديلها يدوياً، وهي غير متتبَّعة في git أصلاً.
2. **بعد أي تعديل:** `python3 build.py <الإصدار>` ثم الفحص على `dist` لا على المصدر (`./scripts/test.sh` يعمل الاثنين).
3. **أي إصدار جديد:** حدّث `APP_VERSION` في `src/shell.js` و`unified-admin/sw.js` (البناء يرفض إن اختلفا)، وأضف عنصراً في أول `CHANGELOG` داخل `src/shell.js`، وقسماً في `GUIDE` إذا الميزة تهم المستخدم.
4. **سلّم جاهزاً:** بلا خطوات يدوية على المستخدم (ولا تعديل أرقام إصدار قبل النشر).
5. كل `push` على `main` يبني وينشر تلقائياً عبر GitHub Actions — لا ترفع ملفات بناء مع الكوميت.

## البنية

```
src/index.template.html   الهيكل، فيه /*#STYLES#*/ و<!--#SCRIPTS#-->
src/boot.js               سكربت الثيم المبكر داخل <head>
src/styles/00-shell.css   متغيرات الهيكل + عُدّة mk- المشتركة
src/styles/<page>.css     CSS كل وحدة، محصور بـ#page-<page>
src/modules/<page>.js     wared, payroll, equipment, fuel, inventory, cleaning, custody
src/shell.js              التنقل، الإشعارات، النسخ الاحتياطي، محرك استيراد Excel، مولّد Word، window.App
src/manifest.json         ترتيب الإدراج
unified-admin/lib/        xlsx.mini.js و chart.mini.js (بدائل محلية مصغّرة)
unified-admin/sw.js       عامل الخدمة
tests/                    مجموعات فحص Playwright
build.py                  التجميع + التصغير + إنتاج المخرجات
```

## الوحدات

| الوحدة | الكائن | مفاتيح localStorage | IndexedDB |
|---|---|---|---|
| مخزون المعدات | `EQ` | `inv_eq_a`, `inv_eq_w` | `fsdb_inv_eq` |
| دفتر الرواتب | `PR` | `ledger-state-v2` | `fsdb_payroll` |
| سجل الوارد والصادر | `WR` | `wared_sader_records_v1` | `fsdb_wared_sader` + `fsdb_wared_atts` |
| توزيع الوقود | `FU` | `fuel2_in`, `fuel2_out` | `fsdb_fuel` |
| مخزون الطعام | `INV` | `inv_a`, `inv_w` | `fsdb_inv` |
| توزيع المنظفات | `CL` | `clean_a`, `clean_w` | `fsdb_clean` |
| إدارة العهد | `CU` | `cust_a`, `cust_i`, `cust_r` | `fsdb_cust` |

EQ و INV و CL بنية واحدة (`additions` / `withdrawals` / `computeStock` / `LOW`). عند استنساخ وحدة أعد تسمية: الكائن، المعرّفات، **`for="eq-"`** في الليبلات، `list="…-dl"`، `#page-<name>` في CSS، مفاتيح التخزين، `FS_DB_NAME`، `page:'…'`، `NotificationRegistry`، `MODULE_INITS`، `PAGE_RENDERERS`. أصناف `.eq-*` تبقى لأنها محصورة بمعرّف الصفحة.

CU فيها ثلاث مصفوفات: `additions` و`issues` و`returns`، و`totalOut = Σissues − Σreturns`.

## قواعد المنطق

- **الترقيم = أكبر رقم موجود + 1** لا العدد + 1.
- **التواريخ بـ`localISO`** لا `toISOString()` (UTC+3 يزيح اليوم).
- **Excel** بـ`XLSX.write(...type:'array')` + Blob + `a.download` لا `writeFile`.
- **منع الرصيد السالب** في كل صرف أو تعديل أو حذف.
- حقل خاطئ يتلوّن أحمر مع هزة وإشعار بالسبب · تأكيد قبل الحذف و«تراجع» بعده · إشعار نجاح يحمل النتيجة وزر الخطوة التالية.
- الترويسة الرسمية على كل السندات **عدا** سندات الرواتب (قرار مقصود).

## واجهة `window.App`

```js
App.notify({type, title, msg, action:{label,fn}, duration, log, system, page})
App.confirm({title, msg, okText, cancelText, danger, icon}) → Promise<boolean>
App.sheet(html, {cls:'wide', onClose}) → {ov, close}
App.importExcel(cfg)      App.exportWord(blocks, name)
App.switchModule(id)   App.vibrate(ms)   App.refresh()   App.exportBackup()
App.compressImage(file, 1800, 0.82)   App.letterhead()   App.letterheadHTML()
```

## المكتبتان المصغّرتان

`lib/xlsx.mini.js` يوفّر `book_new / aoa_to_sheet / book_append_sheet / sheet_to_json` و`XLSX.write(wb,{type:'array'})` و**`await XLSX.read(buf,{type:'array'})` غير متزامنة**. فك الضغط يحتاج Chrome/Edge أو سفاري 16.4+؛ التصدير يعمل بكل مكان.
`lib/chart.mini.js` لمخططات الأعمدة فقط — أي نوع جديد لازم يُضاف للمحرك أولاً.

## دروس مستفادة

- تحقق من حجم كل ملف بعد الكتابة (مرة طلع `sw.js` فارغاً ومرّ دون انتباه).
- عند نسخ كتلة CSS لا تحدد نهايتها بقسم لاحق ثابت — الكتل الجديدة تقع في آخر الستايل.
- داخل `.mk-toolbar` استعمل `>` وإلا يُطبَّق `flex-basis` على الارتفاع.
- `[hidden]` يُلغى بـ`display:flex` — اكتب `.mk-field[hidden]{display:none!important}`.
- على الجوال `repeat(2,minmax(0,1fr))` لا `1fr 1fr`.
- في الفحص: أي نقر على زر بالنص احصره بـ`.overlay` وإلا يلتقط زر الصفحة الذي يحمل نفس البداية.
- لفحص دالة async تنتظر تأكيداً: `evaluate(()=>{fn()})` بدون `return`.
- خذ لقطة جوال (390×844) لكل ميزة جديدة — الفحص الوظيفي وحده لا يكشف غياب التنسيق.
- المقبول في الكونسول: 403 للخطوط والأيقونات فقط.
