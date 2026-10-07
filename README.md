# النظام الإداري الموحّد

تطبيق واحد أوفلاين قابل للتثبيت (PWA) يجمع سبع وحدات إدارية: مخزون المعدات، دفتر الرواتب، سجل الوارد والصادر، توزيع الوقود، مخزون الطعام، توزيع المنظفات، وإدارة العهد. يعمل بلا إنترنت، وكل البيانات في المتصفح (localStorage + IndexedDB).

إعداد: أ. مصعب جاد الله.

## التشغيل محلياً

```bash
python3 -m http.server 8765
# ثم افتح http://localhost:8765/unified-admin/index.html
```

`unified-admin/index.html` لا يوجد في المستودع لأنه مُولَّد — شغّل البناء أولاً.

## البناء

```bash
python3 build.py 2.14.0
```

يجمّع `src/` إلى `unified-admin/index.html` (نسخة تطوير مقروءة)، يصغّرها في `dist/`، وينتج في `release/` الملفَّ الواحد والحزمة. يرفض البناء إذا اختلف `APP_VERSION` بين `src/shell.js` و`unified-admin/sw.js`.
لتغيير مجلد المخرجات: `OUT_DIR=/path python3 build.py 2.14.0`.

## الفحص

```bash
npm install          # playwright + xlsx (مرجع للمقارنة)
npx playwright install chromium
./scripts/test.sh    # يبني، يخدم dist، ويشغّل كل المجموعات
```

الفحص يعمل على `dist` المصغّرة لا على المصدر — التصغير نفسه يحتاج فحصاً.

| الملف | يغطي |
|---|---|
| `tests/test.js` | وحدة العهد |
| `tests/test_wr.js` | الوارد: مرفقات متعددة، تحديد وطباعة، تغيير النوع |
| `tests/test_store.js` | مرفقات IndexedDB والمجلد والنسخة الاحتياطية |
| `tests/test_xl.js` | الاستيراد من Excel في الوحدات الأربع |
| `tests/test_mini.js` | المكتبتان المصغّرتان مقابل SheetJS الأصلية |
| `tests/test_inv_report.js` | تقرير الطعام المفصل وسندات الإدخال |
| `tests/test_stamp.js` | اختيار موضع ختم «منجز» في الصورة |
| `tests/test_stamp_e2e.js` | مسار الختم الكامل من الواجهة |
| `tests/test_fu_month.js` | التقرير الشهري للوقود وعزل الشهر |
| `tests/test_word_eq.js` | تقرير Word وسندات إدخال المعدات |

## النشر

كل `push` على `main` يشغّل `.github/workflows/deploy.yml`: يبني، يفحص، ثم ينشر `dist` على GitHub Pages. الرابط يظهر في تبويب Actions وفي إعدادات Pages.

## عند كل إصدار

1. `APP_VERSION` في `src/shell.js` و`unified-admin/sw.js`.
2. عنصر جديد في أول `CHANGELOG` داخل `src/shell.js`.
3. قسم في `GUIDE` إن كانت الميزة تهم المستخدم.
4. `python3 build.py <الإصدار>` ثم `./scripts/test.sh`.

تفاصيل البنية وقواعد التعديل في [`CLAUDE.md`](CLAUDE.md).
