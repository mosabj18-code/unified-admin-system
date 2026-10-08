'use strict';
/* =====================================================================
   النظام الإداري الموحّد — الهيكل العام
   ===================================================================== */
const APP_VERSION = '2.16.0';
const BUILD_DATE  = '2026-10-08';
const APP_ID      = 'unified-admin-system';

const CHANGELOG = [
  { v:'2.16.0', date:'2026-10-08', items:[
    'مخزون الطعام: إضافة كراتين وحبات فرط بعملية واحدة — مثلاً «١ كرتونة (٢٠ حبة) + ١٠ حبات» تدخل ٣٠ حبة بسطر واحد',
    'والصرف كذلك: «٢ كرتونة + ٥ حبات» في سند واحد، مع حساب المجموع والمتبقي قبل التنفيذ',
    'السندات والجداول والتقارير وملف Excel تعرض الكراتين والحبات الفرط والمجموع'
  ]},
  { v:'2.15.0', date:'2026-10-08', items:[
    'مخزون الطعام: وحدات متعددة للصنف — عرّف «١ كرتونة = ٢٧ حبة» واصرف بالكرتونة أو بالحبة من نفس الرصيد',
    'الرصيد يُحسب بالوحدة الصغرى ويظهر «٢ كرتونة + ٢٢ حبة (٧٦ حبة)» في الجداول والتقارير وملف Excel',
    'سجلات الصنف القديمة بالكرتونة والعلبة تنضم لرصيد واحد تلقائياً عند تعريف تعبئته — من زر 📦 في تبويب المخزون أو من نموذج الإضافة'
  ]},
  { v:'2.14.1', date:'2026-10-08', items:[
    'إصلاح فتح التطبيق بلا إنترنت من رابط omer.mosabj18.workers.dev — كانت تظهر صفحة خطأ بدل التطبيق عند أول تشغيل أوفلاين',
    'إضافة ملف التثبيت (manifest) الناقص، فصار زر «تثبيت التطبيق» يظهر على الجوال والكمبيوتر'
  ]},
  { v:'2.14.0', date:'2026-10-07', items:[
    'توزيع الوقود: زر «تقرير Word» ينزّل ملف .docx لشهر محدد بجدولين منسّقين — الوارد والموزع من الغاز والسولار، والتوزيع حسب الجهة',
    'مخزون المعدات: زر طباعة سند إدخال لكل سطر في تبويب الإضافة مع تحديد متعدد، كما في مخزون الطعام',
    'مولّد مستندات Word مدمج في التطبيق (App.exportWord) يعمل أوفلاين بلا مكتبات خارجية'
  ]},
  { v:'2.13.0', date:'2026-09-29', items:[
    'توزيع الوقود: زر «تقرير شهري» يختار شهراً واحداً ويطبع تقريراً مفصلاً لحركته وحدها دون دمج الشهور السابقة',
    'التقرير الشهري فيه ملخص الشهر والحركة اليومية والتوزيع حسب الجهة والوارد حسب المصدر وتفاصيل الوارد والتوزيع'
  ]},
  { v:'2.12.0', date:'2026-09-27', items:[
    'الوارد والصادر: ختم «✔ منجز» صار يوضع في أوضح منطقة فارغة من الورقة بدل أسفلها دائماً — يحلّل الصورة ويتجنّب الكتابة والأختام',
    'الختم يعرض تاريخ الإنجاز والملاحظة داخله (حتى ثلاثة أسطر) على أرضية فاتحة تبقيه واضحاً فوق أي خلفية'
  ]},
  { v:'2.11.0', date:'2026-09-23', items:[
    'مخزون الطعام: زر «تقرير مفصل» يختار شهراً أو أكثر ويطبع تقريراً بسبعة أقسام على نمط تقرير الوقود',
    'مخزون الطعام: زر طباعة سند إدخال لكل سطر في تبويب الإضافة، وتحديد متعدد مع «طباعة سند للمحدد»'
  ]},
  { v:'2.10.0', date:'2026-09-19', items:[
    'حجم التطبيق انخفض نحو ٧٠٪ — الملف الواحد من ١٫٧٩ ميغا إلى أقل من ٦٠٠ كيلوبايت',
    'استُبدلت مكتبة Excel الضخمة بمحرك مصغّر يكتب ويقرأ ملفات xlsx وcsv بنفس النتيجة',
    'استُبدلت مكتبة المخططات بمحرك رسم مصغّر بنفس الشكل والألوان والتلميحات',
    'المخرَج صار مصغّراً (بلا تعليقات ولا مسافات زائدة) فالتطبيق يفتح ويستجيب أسرع',
    'لا تغيير في أي وظيفة أو شكل أو بيانات'
  ]},
  { v:'2.9.0', date:'2026-09-19', items:[
    'زر «استيراد من Excel» في مخزون المعدات ومخزون الطعام وتوزيع المنظفات وإدارة العهد',
    'الاستيراد يضيف أصنافاً جاهزة أو يصرفها/يسلّمها دفعة واحدة — كل صف عملية، والأصناف الجديدة تُنشأ تلقائياً',
    'قالب Excel جاهز للتنزيل لكل نوع عملية، ومطابقة أسماء الأعمدة مهما اختلف الترتيب أو التشكيل',
    'مراجعة قبل الاستيراد: عدد الصفوف الصالحة، معاينة أول ثمانية، وقائمة بالصفوف المتخطّاة وسببها',
    'منع الرصيد السالب في الاستيراد: يُحسب المطلوب تراكمياً لكل صنف ويُرفض ما يتجاوز المتاح',
    'زر تراجع فوري بعد كل استيراد',
    'إعادة تسمية «إدارة المخزون» إلى «مخزون الطعام»'
  ]},
  { v:'2.8.0', date:'2026-09-16', items:[
    'مرفقات الوارد والصادر خرجت من مساحة المتصفح الصغيرة (٥ ميغا المشتركة) إلى مخزن التطبيق الكبير — مئات الميغابايت بدل ميغات',
    'الترحيل تلقائي عند أول فتح، ويظهر لك كم مساحة تحرّرت — وباقي الوحدات ارتاحت معها',
    'إمكانية ربط مجلد على جهازك من «إعدادات السجل»: كل مرفق جديد يُحفظ فيه كملف حقيقي تفتحه وتنسخه بره التطبيق',
    'زر «تصدير كل المرفقات للمجلد» لنسخ المرفقات الموجودة دفعة واحدة',
    'النسخة الاحتياطية صارت تشمل المرفقات كاملة رغم خروجها من التخزين القديم، والاستعادة ترجّعها كما هي',
    'حد الملف الواحد ارتفع من ١٫٥ ميغا إلى ٢٠ ميغا'
  ]},
  { v:'2.7.1', date:'2026-09-16', items:[
    'الوارد والصادر: إمكانية إرفاق أكثر من ملف على الكتاب الواحد — اختر عدة ملفات مرة واحدة أو أضفها واحداً واحداً',
    'الوارد والصادر: مربع تحديد بجانب كل كتاب — طباعة كشف بالسجلات المحددة، أو طباعة الكتب المرفقة صفحة لكل كتاب',
    'الوارد والصادر: صار ممكن تغيير نوع الكتاب من وارد إلى صادر والعكس عند التعديل، مع رقم تسلسلي جديد بتسلسل النوع الجديد',
    'الختم «✔ منجز» صار يُطبع على كل الصور المرفقة بالكتاب لا على واحدة فقط'
  ]},
  { v:'2.7.0', date:'2026-09-13', items:[
    'دمج وحدة إدارة العهد — الوحدة السابعة والأخيرة، واكتمال النظام الموحّد',
    'خمسة تبويبات: إضافة عهدة، تسليم لشخص، إرجاع، لوحة العهد، وكشف الأشخاص',
    'العهدة تُسترجع: الإرجاع يعيد الكمية للمتاح، وحالة كل سطر تسليم تتحدّث تلقائياً (مستلم / مرتجع جزئي / مرتجع بالكامل)',
    'سند استلام مجمّع بالترويسة الرسمية — صفحة لكل شخص مع نص الإقرار والتوقيعين، وكشف عهدة لكل موظف',
    'أرقام سندات تسليم لا تتكرر بعد الحذف، ومنع أي عملية تخلي المتاح أو ما بحوزة الشخص سالباً',
    'تنبيهات: عهد نافدة، عهد منخفضة (أقل من ٥)، وعهد أُرجعت غير سليمة'
  ]},
  { v:'2.6.1', date:'2026-09-13', items:['إصلاح: صفحة توزيع المنظفات كانت تظهر بدون تنسيق على الجوال — أُضيفت كتلة التنسيق الناقصة'] },
  { v:'2.6.0', date:'2026-09-12', items:[
    'دمج وحدة توزيع المنظفات: الإضافة والصرف ولوحة المخزون للمواد والمعقمات',
    'الوحدة تبدأ فارغة — تُدخل أصنافك بنفسك أو تستورد نسخة من التطبيق المستقل',
    'الرصيد المتاح يظهر قبل الصرف، ومنع أي صرف أو حذف يجعل الرصيد سالباً',
    'سندات الإضافة والصرف والتقرير بالترويسة الرسمية الموحّدة',
    'تنبيهات الأصناف النافدة والمنخفضة، وربط ملف حفظ للوحدة'
  ]},
  { v:'2.5.0', date:'2026-09-12', items:[
    'دمج وحدة إدارة المخزون العام: الإضافة والصرف ولوحة المخزون بالأصناف الاستهلاكية',
    'الرصيد المتاح يظهر قبل الصرف، ومنع أي إضافة أو صرف أو حذف يجعل الرصيد سالباً',
    'سندات الإضافة والصرف والتقرير بالترويسة الرسمية الموحّدة',
    'تنبيهات الرئيسية للأصناف النافدة والمنخفضة (أقل من ٥٠)',
    'ربط ملف حفظ للوحدة واستيراد نسخة من تطبيق إدارة المخزون المستقل'
  ]},
  { v:'2.4.0', date:'2026-09-12', items:[
    'دمج وحدة توزيع الوقود: الوارد والتوزيع ولوحة التحكم والتوزيع حسب الجهة',
    'توحيد الوحدات تلقائياً: الغاز بالكيلو والسولار باللتر، مع تحويل الاسطوانات حسب وزنها',
    'منع أي عملية توزيع أو تعديل أو حذف يجعل الرصيد سالباً، مع بيان الرصيد المتاح قبل الصرف',
    'سند صرف وقود وكشف حساب لكل جهة وتقرير شامل، كلها بالترويسة الرسمية',
    'ترقيم السندات بأكبر رقم موجود + 1 حتى لا يتكرر بعد الحذف، وربط ملف حفظ للوحدة',
    'تنبيهات الرئيسية: نفاد الوقود ورصيد منخفض تحت ١٥٪ من الوارد'
  ]},
  { v:'2.3.0', date:'2026-09-11', items:[
    'دمج وحدة سجل الوارد والصادر: السجلات، المرفقات، ختم «منجز» على الصور، لوحة المعلومات والتقرير',
    'ترويسة رسمية واحدة من الإعدادات تُطبع في سندات المعدات وتقرير الوارد والصادر',
    'ضغط صور المرفقات تلقائياً لتوفير المساحة، وتنبيه عند اقتراب امتلاء التخزين',
    'نافذة إنجاز المعاملة بدل نافذة المتصفح، مع معاينة ما سيحدث للمرفق وإمكانية التراجع',
    'إصلاح تكرار الرقم التسلسلي بعد الحذف، والتقرير يطبع السجلات المفلترة فقط',
    'تنبيه الرئيسية للمعاملات المتأخرة أكثر من ٣ أيام'
  ]},
  { v:'2.2.0', date:'2026-09-11', items:[
    'دمج وحدة دفتر الرواتب: الأرصدة، العمليات، السندات، التقارير، التسوية الشهرية، الموظفون وسجل التدقيق',
    'تحذير قبل صرف مبلغ أكبر من الرصيد، وقبل تسجيل راتب شهري مكرر لنفس الموظف والشهر',
    'تأكيد استلام العملية المعلّقة بضغطة من تفاصيلها، والحذف مع التراجع',
    'تعديل وحذف الموظفين، ومنع حذف موظف له عمليات',
    'إصلاح تكرار رقم المرجع بعد الحذف، وإصلاح انزياح الشهر في الرسم البياني بسبب فرق التوقيت',
    'تنبيهات الرئيسية: العمليات المعلّقة المتأخرة والأرصدة السالبة'
  ]},
  { v:'2.1.0', date:'2026-09-11', items:[
    'دمج وحدة مخزون المعدات بالكامل: الإضافة والصرف ولوحة المخزون والرسم البياني',
    'تنبيهات الأصناف النافدة والمنخفضة تظهر على الرئيسية، والضغط عليها يفتح القائمة المعنية',
    'الحذف بتأكيد وإمكانية التراجع، ومنع أي تعديل أو حذف يجعل الرصيد بالسالب',
    'بعد الصرف: زر طباعة السند مباشرة من الإشعار، وتنبيه إذا نفد الصنف أو صار منخفضاً',
    'استيراد النسخ القديمة من تطبيق المعدات المستقل'
  ]},
  { v:'2.0.0', date:'2026-09-11', items:[
    'تبديل العرض بين الكمبيوتر والجوال بزر واحد، مع وضع تلقائي',
    'إشعارات موحّدة لكل عملية (نجاح، خطأ، تحذير، معلومة) بنفس الشكل داخل التطبيق وخارجه',
    'تثبيت التطبيق على الشاشة الرئيسية ويعمل بدون إنترنت',
    'نسخة احتياطية واحدة لكل الوحدات، واستعادة بخطوات مراجعة وتأكيد',
    'دليل المستخدم، عرض الإصدار، اليوم والتاريخ الميلادي والهجري',
    'أيقونات ثلاثية الأبعاد وخطوط جديدة'
  ]},
  { v:'1.0.0', date:'', items:['الهيكل الموحّد: القائمة الجانبية، الشاشة الرئيسية، مركز التنبيهات، الثيم الفاتح والداكن'] }
];

/* ---------- الأيقونات ثلاثية الأبعاد (Fluent 3D) مع بديل إيموجي ---------- */
const ICON_BASE = 'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets/';
const ICONS = {
  home:['House','🏠'], equipment:['Wrench','🔧'], payroll:['Money bag','💰'], wared:['Incoming envelope','📨'],
  fuel:['Fuel pump','⛽'], inventory:['Package','📦'], cleaning:['Lotion bottle','🧴'], custody:['Clipboard','📋'],
  backup:['Floppy disk','💾'], guide:['Open book','📖'], settings:['Gear','⚙️'], bell:['Bell','🔔'],
  success:['Check mark button','✅'], error:['Cross mark','❌'], warning:['Warning','⚠️'], info:['Information','ℹ️'],
  mobile:['Mobile phone','📱'], desktop:['Desktop computer','🖥️'], calendar:['Spiral calendar','🗓️'],
  outbox:['Outbox tray','📤'], inbox:['Inbox tray','📥'], sun:['Sun','☀️'], moon:['Crescent moon','🌙'],
  shield:['Shield','🛡️'], sparkles:['Sparkles','✨'], clock:['Alarm clock','⏰'], vibrate:['Vibration mode','📳'],
  party:['Party popper','🎉'], compass:['Compass','🧭'], search:['Magnifying glass tilted left','🔍'],
  question:['Red question mark','❓'], rocket:['Rocket','🚀'], label:['Label','🏷️'], chart:['Bar chart','📊'],
  empty:['Hourglass not done','⏳'], person:['Bust in silhouette','👤'], checklist:['Clipboard','📋'], globe:['Globe with meridians','🌐']
};
function iconUrl(folder){ return ICON_BASE + encodeURIComponent(folder) + '/3D/' + folder.toLowerCase().replace(/ /g,'_') + '_3d.png'; }
function ico(key, size){
  const d = ICONS[key] || ['', '•'];
  const st = size ? ` style="--s:${size}px"` : '';
  return `<img class="i3d" src="${iconUrl(d[0])}" alt="" aria-hidden="true" draggable="false" data-e="${d[1]}"${st} onerror="icoFail(this)">`;
}
function icoFail(img){
  const s = document.createElement('span');
  s.className = 'i3d-fb'; s.setAttribute('aria-hidden','true');
  s.textContent = img.dataset.e || '•';
  if (img.getAttribute('style')) s.setAttribute('style', img.getAttribute('style'));
  img.replaceWith(s);
}
const LINE = {
  monitor:'<svg class="ico" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>',
  phone:'<svg class="ico" viewBox="0 0 24 24"><rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/></svg>',
  sun:'<svg class="ico" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  moon:'<svg class="ico" viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/></svg>',
  x:'<svg class="ico" viewBox="0 0 24 24" style="width:18px;height:18px"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  chev:'<svg class="ico chev" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>',
  search:'<svg class="ico" viewBox="0 0 24 24" style="color:var(--muted)"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>'
};

/* ---------- الوحدات ---------- */
const MODULE_META = {
  equipment:{ name:'مخزون المعدات',       desc:'إضافة وصرف المعدات، لوحة الرصيد، وسندات الصرف',     keys:['inv_eq_a','inv_eq_w'],                 tint:'rgba(59,130,246,.15)' },
  payroll:  { name:'دفتر الرواتب',        desc:'الموظفون والدفعات وسجل التدقيق',                    keys:['ledger-state-v2'],                     tint:'rgba(234,179,8,.2)'  },
  wared:    { name:'سجل الوارد والصادر',  desc:'المراسلات الرسمية وختم الإنجاز على المرفقات',        keys:['wared_sader_records_v1'],              tint:'rgba(139,92,246,.15)' },
  fuel:     { name:'توزيع الوقود',        desc:'الوارد والتوزيع ولوحة التحكم حسب الجهة',             keys:['fuel2_in','fuel2_out'],                tint:'rgba(239,68,68,.14)' },
  inventory:{ name:'مخزون الطعام',        desc:'أصناف الطعام الاستهلاكية وسندات الصرف والاستلام',   keys:['inv_a','inv_w','inv_p'],               tint:'rgba(217,119,6,.16)' },
  cleaning: { name:'توزيع المنظفات',      desc:'المواد والمعقمات وسندات التوزيع',                    keys:['clean_a','clean_w'],                   tint:'rgba(20,184,166,.16)' },
  custody:  { name:'إدارة العهد',         desc:'تسليم وإرجاع العهد وكشف عهدة كل شخص',               keys:['cust_a','cust_i','cust_r'],            tint:'rgba(236,72,153,.14)' }
};
const MODULE_ORDER  = ['equipment','payroll','wared','fuel','inventory','cleaning','custody'];
const BOTTOM_NAV    = ['home','equipment','payroll','wared'];
const SYSTEM_PAGES  = { home:'الرئيسية', backup:'النسخ الاحتياطي', guide:'دليل المستخدم', settings:'الإعدادات' };
const SETTINGS_KEYS = ['unified_theme','unified_layout','unified_settings','unified_letterhead'];
const BOTTOM_LABELS = { home:'الرئيسية', equipment:'المعدات', payroll:'الرواتب', wared:'الوارد والصادر' };

window.NotificationRegistry = window.NotificationRegistry || {};

/* ---------- تخزين الإعدادات ---------- */
const DEFAULT_SETTINGS = { haptics:true, sysNotif:false, onboarded:false, installNever:false, lastBackupAt:null, lastSeenVersion:null, lastReminderDay:null };
let S = loadSettings();
function loadSettings(){
  try { return Object.assign({}, DEFAULT_SETTINGS, JSON.parse(localStorage.getItem('unified_settings') || '{}')); }
  catch(e){ return Object.assign({}, DEFAULT_SETTINGS); }
}
function saveSettings(){ try { localStorage.setItem('unified_settings', JSON.stringify(S)); } catch(e){} }

/* ---------- أدوات ---------- */
const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
const nf = new Intl.NumberFormat('ar-EG');
const n  = x => nf.format(x);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
function vibrate(ms){ if (S.haptics && navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) { try { navigator.vibrate(ms); } catch(e){} } }
function relTime(iso){
  if (!iso) return null;
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  const rtf = new Intl.RelativeTimeFormat('ar-EG', { numeric:'auto' });
  if (diff < 60) return 'قبل لحظات';
  if (diff < 3600) return rtf.format(-Math.round(diff/60), 'minute');
  if (diff < 86400) return rtf.format(-Math.round(diff/3600), 'hour');
  return rtf.format(-Math.round(diff/86400), 'day');
}
function daysSince(iso){ return iso ? Math.floor((Date.now() - new Date(iso).getTime())/86400000) : Infinity; }
function fmtDateTime(iso){
  return new Intl.DateTimeFormat('ar-EG',{ day:'numeric', month:'long', year:'numeric', hour:'numeric', minute:'2-digit' }).format(new Date(iso));
}
function fmtVersion(v){ return v.split('.').map(x => n(+x)).join('٫'); }

/* =====================================================================
   الثيم
   ===================================================================== */
function applyTheme(t){
  document.documentElement.setAttribute('data-theme', t);
  const meta = $('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', t === 'dark' ? '#121a33' : '#1B3B2F');
  const b = $('#themeBtn');
  if (b){ b.innerHTML = t === 'dark' ? LINE.sun : LINE.moon; b.setAttribute('aria-label', t === 'dark' ? 'التبديل إلى الثيم الفاتح' : 'التبديل إلى الثيم الداكن'); b.title = b.getAttribute('aria-label'); }
}
function loadTheme(){ applyTheme(localStorage.getItem('unified_theme') || 'light'); }
function setTheme(t, silent){
  localStorage.setItem('unified_theme', t); applyTheme(t); vibrate(10);
  if (!silent) notify({ type:'info', title: t === 'dark' ? 'تم تفعيل الثيم الداكن' : 'تم تفعيل الثيم الفاتح', log:false, duration:2200 });
  if (currentPage === 'settings') renderSettings();
}
function toggleTheme(){ setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'); }

/* =====================================================================
   طريقة العرض: تلقائي / كمبيوتر / جوال
   ===================================================================== */
function getLayoutPref(){ return localStorage.getItem('unified_layout') || 'auto'; }
function effectiveLayout(){ const p = getLayoutPref(); return p === 'auto' ? (window.innerWidth <= 880 ? 'mobile' : 'desktop') : p; }
function isMobileWidth(){ return effectiveLayout() === 'mobile'; }
function applyLayout(){
  const h = document.documentElement, eff = effectiveLayout();
  h.setAttribute('data-layout', eff);
  h.setAttribute('data-layout-pref', getLayoutPref());
  h.setAttribute('data-framed', eff === 'mobile' && window.innerWidth > 600 ? '1' : '0');
  h.setAttribute('data-narrow', eff === 'desktop' && window.innerWidth < 760 ? '1' : '0');
  if (eff === 'desktop') document.body.classList.remove('sb-open');
  const b = $('#layoutBtn');
  if (b){
    const toMobile = eff === 'desktop';
    b.innerHTML = toMobile ? LINE.phone : LINE.monitor;
    const lbl = toMobile ? 'التبديل إلى عرض الجوال' : 'التبديل إلى عرض الكمبيوتر';
    b.setAttribute('aria-label', lbl); b.title = lbl;
  }
}
function setLayout(pref, silent){
  localStorage.setItem('unified_layout', pref); applyLayout(); vibrate(12);
  if (!silent){
    const names = { auto:'العرض التلقائي', desktop:'عرض الكمبيوتر', mobile:'عرض الجوال' };
    notify({ type:'info', title:'تم التبديل إلى ' + names[pref],
      msg: pref === 'auto' ? 'يتغيّر العرض حسب حجم الشاشة.' : 'للعودة إلى العرض التلقائي: الإعدادات ← طريقة العرض.', log:false, duration:3200 });
  }
  if (currentPage === 'settings') renderSettings();
}
function toggleLayout(){ setLayout(effectiveLayout() === 'desktop' ? 'mobile' : 'desktop'); }
let resizeT;
window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(applyLayout, 80); });

/* =====================================================================
   القائمة الجانبية والتنقل
   ===================================================================== */
function openSidebar(){ document.body.classList.add('sb-open'); vibrate(8); }
function closeSidebar(){ if (document.body.classList.contains('sb-open')){ document.body.classList.remove('sb-open'); vibrate(6); } }

function pageTitle(id){ return MODULE_META[id] ? MODULE_META[id].name : (SYSTEM_PAGES[id] || 'الرئيسية'); }
function validPage(id){ return !!(MODULE_META[id] || SYSTEM_PAGES[id]); }

function renderNav(){
  const item = id => `<button class="nav-item" data-page="${id}" onclick="switchModule('${id}')">
      ${ico(id, 30)}<span class="lbl">${pageTitle(id)}</span><span class="badge num" data-badge="${id}"></span></button>`;
  $('#sbNav').innerHTML =
    item('home') +
    `<div class="sb-group">الوحدات</div>` + MODULE_ORDER.map(item).join('') +
    `<div class="sb-group">النظام</div>` + ['backup','guide','settings'].map(item).join('');
  $('#bottomNav').innerHTML = BOTTOM_NAV.map(id =>
    `<button class="bn-item" data-page="${id}" onclick="switchModule('${id}')">${ico(id)}<span>${BOTTOM_LABELS[id]}</span><span class="badge num" data-badge="${id}"></span></button>`).join('');
}

let currentPage = null;
const PAGE_RENDERERS = {};
function switchModule(id, opts = {}){
  if (!validPage(id)) id = 'home';
  const changed = id !== currentPage;
  currentPage = id;
  $$('.module-page').forEach(p => p.classList.toggle('active', p.id === 'page-' + id));
  $$('[data-page]').forEach(b => { const on = b.dataset.page === id; b.classList.toggle('active', on); on ? b.setAttribute('aria-current','page') : b.removeAttribute('aria-current'); });
  $('#pageTitle').textContent = pageTitle(id);
  document.title = pageTitle(id) + ' — النظام الإداري الموحّد';
  if (PAGE_RENDERERS[id]) PAGE_RENDERERS[id]();
  else if (MODULE_META[id]) renderModulePlaceholder(id);
  if (changed){
    $('#main').scrollTo({ top:0, behavior:'instant' });
    if (opts.push !== false){ try { history.pushState({ page:id }, '', '#' + id); } catch(e){} }
    if (!opts.silent) vibrate(10);
  }
  if (isMobileWidth()) closeSidebar();
}
window.addEventListener('popstate', e => {
  if (overlays.length){ closeTopOverlay(); }
  const id = (e.state && e.state.page) || location.hash.slice(1) || 'home';
  switchModule(id, { push:false, silent:true });
});

/* =====================================================================
   الإشعارات: منبثقة داخل التطبيق + إشعارات النظام بنفس النص والأيقونة
   ===================================================================== */
const TYPE_META = {
  success:{ icon:'success', emoji:'✅', dur:3800, vib:15 },
  error:  { icon:'error',   emoji:'❌', dur:7000, vib:[40,60,40] },
  warning:{ icon:'warning', emoji:'⚠️', dur:6000, vib:[25,40,25] },
  info:   { icon:'info',    emoji:'ℹ️', dur:4200, vib:10 }
};
let notifLog = [];
try { notifLog = JSON.parse(localStorage.getItem('unified_notif_log') || '[]'); } catch(e){ notifLog = []; }
function saveLog(){ try { localStorage.setItem('unified_notif_log', JSON.stringify(notifLog.slice(0, 60))); } catch(e){} }

/**
 * notify({ type, title, msg, action:{label,fn}, duration, log, system, page })
 * type: success | error | warning | info
 * duration: 0 = يبقى حتى يُغلق
 * system: true = أرسل إشعار نظام دائماً، 'auto' (افتراضي) = فقط إذا كان التطبيق بالخلفية
 */
function notify(opts){
  const o = Object.assign({ type:'info', title:'', msg:'', log:true, system:'auto' }, typeof opts === 'string' ? { title:opts } : opts);
  const tm = TYPE_META[o.type] || TYPE_META.info;
  const dur = o.duration === undefined ? tm.dur : o.duration;
  const box = $('#toasts');
  while (box.children.length >= 4) box.firstElementChild.remove();

  const el = document.createElement('div');
  el.className = 'toast ' + o.type;
  el.setAttribute('role', o.type === 'error' ? 'alert' : 'status');
  el.innerHTML = `<div class="tile">${ico(tm.icon)}</div>
    <div class="grow"><div class="t">${esc(o.title)}</div>${o.msg ? `<div class="m">${esc(o.msg)}</div>` : ''}
      ${o.action ? `<div class="act"><button class="btn btn-sm ${o.type === 'error' ? 'btn-danger' : 'btn-primary'}">${esc(o.action.label)}</button></div>` : ''}</div>
    <button class="x" aria-label="إغلاق الإشعار">${LINE.x}</button>
    ${dur ? `<i class="bar" style="animation-duration:${dur}ms;--dur:${dur}ms"></i>` : ''}`;
  let timer = null, remaining = dur, started = Date.now();
  const close = () => { if (!el.isConnected) return; clearTimeout(timer); el.classList.add('out'); setTimeout(() => el.remove(), 220); };
  const arm = () => { if (dur){ started = Date.now(); timer = setTimeout(close, remaining); } };
  el.addEventListener('mouseenter', () => { if (dur){ clearTimeout(timer); remaining -= Date.now() - started; } });
  el.addEventListener('mouseleave', arm);
  el.querySelector('.x').onclick = close;
  if (o.action) el.querySelector('.act button').onclick = () => { close(); o.action.fn && o.action.fn(); };
  box.appendChild(el); arm();
  vibrate(tm.vib);

  if (o.log){
    notifLog.unshift({ id:Date.now() + Math.random(), type:o.type, title:o.title, msg:o.msg, at:new Date().toISOString(), read:false, page:o.page || null });
    saveLog(); updateBell();
  }
  if (o.system === true || (o.system === 'auto' && document.hidden)) showSystemNotification(o);
  return { close };
}
notify.success = (title, msg, extra) => notify(Object.assign({ type:'success', title, msg }, extra));
notify.error   = (title, msg, extra) => notify(Object.assign({ type:'error',   title, msg }, extra));
notify.warning = (title, msg, extra) => notify(Object.assign({ type:'warning', title, msg }, extra));
notify.info    = (title, msg, extra) => notify(Object.assign({ type:'info',    title, msg }, extra));

function sysNotifSupported(){ return 'Notification' in window; }
async function showSystemNotification(o){
  if (!S.sysNotif || !sysNotifSupported() || Notification.permission !== 'granted') return false;
  const tm = TYPE_META[o.type] || TYPE_META.info;
  const title = tm.emoji + ' ' + o.title;
  const options = { body:o.msg || '', icon:'icons/icon-192.png', badge:'icons/badge-96.png', dir:'rtl', lang:'ar',
    tag:'unified-' + o.type + '-' + (o.title || ''), renotify:true, vibrate: S.haptics ? [30,40,30] : undefined, data:{ page:o.page || null } };
  try {
    const reg = swReg || (navigator.serviceWorker && await navigator.serviceWorker.getRegistration());
    if (reg && reg.showNotification){ await reg.showNotification(title, options); return true; }
    const nn = new Notification(title, options);
    nn.onclick = () => { window.focus(); if (o.page) switchModule(o.page); nn.close(); };
    return true;
  } catch(e){ return false; }
}
async function setSystemNotif(on){
  if (!on){ S.sysNotif = false; saveSettings(); renderSettings(); notify.info('تم إيقاف إشعارات النظام', 'ستظهر الإشعارات داخل التطبيق فقط.', { log:false }); return; }
  if (!sysNotifSupported()){ notify.error('المتصفح لا يدعم إشعارات النظام', 'جرّب Chrome أو Edge، أو ثبّت التطبيق أولاً.'); return renderSettings(); }
  let perm = Notification.permission;
  if (perm === 'default'){ try { perm = await Notification.requestPermission(); } catch(e){} }
  if (perm === 'granted'){
    S.sysNotif = true; saveSettings(); renderSettings();
    notify({ type:'success', title:'تم تفعيل إشعارات النظام', msg:'ستصلك الإشعارات حتى لو كان التطبيق بالخلفية.', system:true });
  } else {
    S.sysNotif = false; saveSettings(); renderSettings();
    notify.error('تم رفض إذن الإشعارات', 'اسمح بالإشعارات من إعدادات الموقع في المتصفح (رمز القفل بجانب الرابط) ثم فعّلها من جديد.');
  }
}
function testNotification(){
  notify({ type:'success', title:'إشعار تجريبي', msg:'هكذا تبدو إشعارات التطبيق — داخل التطبيق وعلى الجهاز.', system:true, log:false });
  if (S.sysNotif && sysNotifSupported() && Notification.permission !== 'granted')
    notify.warning('إشعارات النظام غير مسموحة', 'فعّل الإذن من إعدادات المتصفح ليصلك الإشعار خارج التطبيق.');
}

function updateBell(){
  const unread = notifLog.filter(x => !x.read).length;
  const alerts = collectAllAlerts().length;
  const total = unread + alerts;
  const dot = $('#bellDot');
  dot.hidden = !total; dot.textContent = total > 99 ? '+٩٩' : n(total);
}

/* =====================================================================
   النوافذ (تأكيد، ورقة سفلية، درج)
   ===================================================================== */
const overlays = [];
function openOverlay(html, opt = {}){
  const ov = document.createElement('div');
  ov.className = 'overlay' + (opt.drawer ? ' for-drawer' : '');
  ov.innerHTML = opt.drawer ? `<div class="drawer" role="dialog" aria-modal="true">${html}</div>` : `<div class="sheet ${opt.cls || ''}" role="dialog" aria-modal="true">${html}</div>`;
  $('#frame').appendChild(ov);
  const entry = { ov, onClose: opt.onClose, closed:false };
  entry.close = (val) => {
    if (entry.closed) return; entry.closed = true;
    ov.classList.add('closing'); setTimeout(() => ov.remove(), 200);
    const i = overlays.indexOf(entry); if (i > -1) overlays.splice(i, 1);
    entry.onClose && entry.onClose(val);
  };
  ov.addEventListener('click', e => { if (e.target === ov && opt.dismissible !== false) entry.close(undefined); });
  overlays.push(entry);
  setTimeout(() => { const f = ov.querySelector('[data-autofocus]') || ov.querySelector('button'); f && f.focus({ preventScroll:true }); }, 60);
  return entry;
}
function closeTopOverlay(){ const t = overlays[overlays.length - 1]; if (t) t.close(undefined); }
document.addEventListener('keydown', e => {
  if (e.key === 'Escape'){ if (overlays.length) closeTopOverlay(); else closeSidebar(); }
});

/** confirmDialog({title,msg,okText,cancelText,danger,icon}) → Promise<boolean> */
function confirmDialog(o){
  return new Promise(resolve => {
    const tint = o.danger ? 'var(--danger-bg)' : 'var(--accent-soft)';
    const ent = openOverlay(`
      <div class="hero-ico" style="--tint:${tint}">${ico(o.icon || (o.danger ? 'warning' : 'question'))}</div>
      <h3>${esc(o.title)}</h3>${o.msg ? `<p class="lead">${esc(o.msg)}</p>` : ''}${o.html || ''}
      <div class="actions">
        <button class="btn ${o.danger ? 'btn-danger' : 'btn-primary'}" data-ok data-autofocus>${esc(o.okText || 'تأكيد')}</button>
        <button class="btn" data-cancel>${esc(o.cancelText || 'إلغاء')}</button>
      </div>`, { onClose: v => resolve(!!v) });
    vibrate(o.danger ? [20,30,20] : 10);
    ent.ov.querySelector('[data-ok]').onclick = () => ent.close(true);
    ent.ov.querySelector('[data-cancel]').onclick = () => ent.close(false);
  });
}

/* =====================================================================
   مركز التنبيهات الموحّد
   ===================================================================== */
// تنبيهات النظام نفسه (تذكير النسخ الاحتياطي)
/* مساحة التخزين المحلي (مشتركة بين كل الوحدات، ~٥ ملايين حرف في Chrome) */
const LS_QUOTA_CHARS = 5000000;
function localUsage(){ let c = 0; try { for (let i = 0; i < localStorage.length; i++){ const k = localStorage.key(i); c += k.length + (localStorage.getItem(k) || '').length; } } catch(e){} return { chars:c, pct:Math.min(100, Math.round(c / LS_QUOTA_CHARS * 100)) }; }
NotificationRegistry.system = () => {
  const d = daysSince(S.lastBackupAt), total = totalRecords();
  const u = localUsage(), res = [];
  if (u.pct >= 75) res.push({ severity: u.pct >= 90 ? 'high' : 'mid', title:'مساحة التخزين تقترب من الامتلاء', subtitle:`مستخدم ${n(u.pct)}٪ — غالباً بسبب مرفقات الوارد والصادر`, page:'backup' });
  if (!total) return res;
  if (d === Infinity) return res.concat([{ severity:'mid', title:'لا توجد نسخة احتياطية بعد', subtitle:'احفظ نسخة من بياناتك الآن', page:'backup' }]);
  if (d >= 7) return res.concat([{ severity: d >= 14 ? 'high' : 'mid', title:'حان وقت النسخ الاحتياطي', subtitle:'آخر نسخة ' + relTime(S.lastBackupAt), page:'backup' }]);
  return res;
};
function collectAllAlerts(){
  const out = [];
  ['system', ...MODULE_ORDER].forEach(mid => {
    const fn = NotificationRegistry[mid];
    if (typeof fn !== 'function') return;
    let list = [];
    try { list = fn() || []; } catch(e){ console.warn('تنبيهات الوحدة', mid, e); }
    list.forEach(a => out.push(Object.assign({ module:mid, page: a.page || (MODULE_META[mid] ? mid : 'home') }, a)));
  });
  const rank = { high:0, mid:1 };
  out.sort((a, b) => (rank[a.severity] ?? 2) - (rank[b.severity] ?? 2));
  window.__alerts = out;
  return out;
}
function updateBadges(alerts){
  const count = {};
  alerts.forEach(a => { count[a.page] = count[a.page] || { total:0, high:0 }; count[a.page].total++; if (a.severity === 'high') count[a.page].high++; });
  $$('[data-badge]').forEach(b => {
    const c = count[b.dataset.badge];
    b.classList.toggle('show', !!c); b.classList.toggle('mid', !!c && !c.high);
    b.textContent = c ? n(c.total) : '';
  });
  updateBell();
}
function openAlert(i){
  const a = (window.__alerts || [])[i]; if (!a) return;
  switchModule(a.page);
  if (typeof a.onOpen === 'function'){ try { a.onOpen(); } catch(e){} }
}
function alertRowHTML(a, i){
  const icon = a.module === 'system' ? 'backup' : a.module;
  return `<button class="alert-row" onclick="openAlert(${i})">
    ${ico(icon)}<div class="grow"><div class="t">${esc(a.title)}</div>${a.subtitle ? `<div class="s">${esc(a.subtitle)}</div>` : ''}</div>
    <span class="pill ${a.severity === 'high' ? 'high' : 'mid'}">${a.severity === 'high' ? 'عاجل' : 'متابعة'}</span></button>`;
}

/* =====================================================================
   بيانات الوحدات (للإحصاء والنسخ الاحتياطي)
   ===================================================================== */
function countKey(key){
  const raw = localStorage.getItem(key);
  if (raw == null) return 0;
  try {
    const v = JSON.parse(raw);
    if (Array.isArray(v)) return v.length;
    if (v && typeof v === 'object'){
      if (Array.isArray(v.entries) || Array.isArray(v.employees)) return (v.entries || []).length + (v.employees || []).length;
      return Object.keys(v).length;
    }
  } catch(e){}
  return raw ? 1 : 0;
}
function countRawMap(map){ // map: key → raw string (من ملف نسخة)
  let t = 0;
  Object.values(map || {}).forEach(raw => {
    if (raw == null) return;
    try { const v = JSON.parse(raw);
      if (Array.isArray(v)) t += v.length;
      else if (v && typeof v === 'object') t += (Array.isArray(v.entries) || Array.isArray(v.employees)) ? (v.entries || []).length + (v.employees || []).length : Object.keys(v).length;
    } catch(e){ t += 1; }
  });
  return t;
}
function moduleRecords(id){ return MODULE_META[id].keys.reduce((s, k) => s + countKey(k), 0); }
function totalRecords(){ return MODULE_ORDER.reduce((s, id) => s + moduleRecords(id), 0); }
function isMounted(id){ const el = $('#page-' + id); return el && !el.hasAttribute('data-placeholder'); }

/* =====================================================================
   الشاشة الرئيسية
   ===================================================================== */
function renderModuleCards(){
  return MODULE_ORDER.map(id => {
    const m = MODULE_META[id], recs = moduleRecords(id);
    return `<button class="mod-card" onclick="switchModule('${id}')" style="--tint:${m.tint}">
      <span class="badge num" data-badge="${id}"></span>
      <div class="tile">${ico(id)}</div>
      <div><h3>${m.name}</h3><p>${m.desc}</p></div>
      <div class="foot">
        <span class="pill ${recs ? 'ok' : 'info'} num">${recs ? n(recs) + ' سجل' : 'لا بيانات'}</span>
        ${isMounted(id) ? '' : '<span class="pill mid">قيد الدمج</span>'}
      </div></button>`;
  }).join('');
}
function renderHome(){
  const alerts = collectAllAlerts();
  const high = alerts.filter(a => a.severity === 'high').length;
  const lb = S.lastBackupAt ? relTime(S.lastBackupAt) : 'لم تُنشأ بعد';
  $('#page-home').innerHTML = `
    <div class="today">
      <div>
        <div class="today-greet">${ico('calendar', 22)}<span id="greet"></span><span class="today-clock num" id="clock"></span></div>
        <div class="today-day" id="dayName"></div>
        <div class="today-dates num"><span id="gDate"></span><span class="sep">|</span><span id="hDate"></span></div>
      </div>
      <div class="today-side">
        <button class="today-stat" onclick="document.getElementById('alertsSec').scrollIntoView({behavior:'smooth'})">
          ${ico(alerts.length ? (high ? 'warning' : 'bell') : 'success')}
          <span><b class="num">${alerts.length ? n(alerts.length) + ' تنبيه' : 'لا تنبيهات'}</b><small>${high ? n(high) + ' عاجل' : 'كل شيء تحت السيطرة'}</small></span></button>
        <button class="today-stat" onclick="switchModule('backup')">
          ${ico('backup')}<span><b>${lb}</b><small>آخر نسخة احتياطية</small></span></button>
      </div>
    </div>

    <div class="sec-head" id="alertsSec"><h2>${ico('bell', 28)}التنبيهات</h2><span class="hint num">${alerts.length ? 'مرتّبة حسب الأهمية' : ''}</span></div>
    <div class="card alert-list">${alerts.length ? alerts.map(alertRowHTML).join('') :
      `<div class="empty">${ico('success')}<div><b>لا توجد تنبيهات الآن</b><p>تظهر هنا الأصناف النافدة والمهام المتأخرة من كل الوحدات.</p></div></div>`}</div>

    <div class="sec-head"><h2>${ico('chart', 28)}الوحدات</h2><span class="hint num">${n(MODULE_ORDER.length)} وحدات</span></div>
    <div class="mod-grid">${renderModuleCards()}</div>`;
  renderDate();
  updateBadges(alerts);
}
PAGE_RENDERERS.home = renderHome;
PAGE_RENDERERS.equipment = () => { if (window.EQ) EQ.onShow(); };
PAGE_RENDERERS.payroll = () => { if (window.PR) PR.onShow(); };
PAGE_RENDERERS.wared = () => { if (window.WR) WR.onShow(); };
PAGE_RENDERERS.fuel = () => { if (window.FU) FU.onShow(); };
PAGE_RENDERERS.inventory = () => { if (window.INV) INV.onShow(); };
PAGE_RENDERERS.cleaning = () => { if (window.CL) CL.onShow(); };
PAGE_RENDERERS.custody = () => { if (window.CU) CU.onShow(); };

/* صفحة وحدة لم تُدمج بعد */
function renderModulePlaceholder(id){
  const el = $('#page-' + id);
  if (!el.hasAttribute('data-placeholder')) return;
  const m = MODULE_META[id], recs = moduleRecords(id);
  el.innerHTML = `
    <div class="page-head" style="--tint:${m.tint}"><div class="tile">${ico(id)}</div>
      <div><h2>${m.name}</h2><p>${m.desc}</p></div></div>
    <div class="card placeholder">
      ${ico('empty')}
      <b>هذه الوحدة في مرحلة الدمج</b>
      <p>ستظهر واجهتها الكاملة هنا بعد نقلها إلى التطبيق الموحّد. ${recs ? 'بياناتها الحالية على هذا الجهاز (' + n(recs) + ' سجل) محفوظة وتدخل في النسخة الاحتياطية.' : 'لا توجد بيانات محفوظة لها على هذا الجهاز بعد.'}</p>
      <ol class="steps">
        <li>إلى أن يكتمل الدمج، استمر باستخدام ملف الوحدة المستقل كالمعتاد.</li>
        <li>البيانات تُحفظ على نفس الجهاز والمتصفح، فتظهر هنا تلقائياً بعد الدمج.</li>
        <li>انزل نسخة احتياطية من صفحة النسخ الاحتياطي قبل أي تحديث.</li>
      </ol>
    </div>`;
}

/* =====================================================================
   اليوم والتاريخ
   ===================================================================== */
const F_DAY  = new Intl.DateTimeFormat('ar-EG', { weekday:'long' });
const F_G    = new Intl.DateTimeFormat('ar-EG', { day:'numeric', month:'long', year:'numeric' });
const F_GS   = new Intl.DateTimeFormat('ar-EG', { day:'numeric', month:'long' });
let F_H; try { F_H = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-arab', { day:'numeric', month:'long', year:'numeric' }); } catch(e){ F_H = null; }
const F_T    = new Intl.DateTimeFormat('ar-EG', { hour:'numeric', minute:'2-digit' });
function renderDate(){
  const d = new Date(), day = F_DAY.format(d);
  $('#topDate').innerHTML = isMobileWidth() ? `<bdi>${day}، ${F_GS.format(d)}</bdi>` : `<bdi>${day}، ${F_G.format(d)}</bdi>${F_H ? ' <span style="opacity:.5">•</span> <bdi>' + F_H.format(d) + '</bdi>' : ''}`;
  const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  set('dayName', day); set('gDate', F_G.format(d)); set('hDate', F_H ? F_H.format(d) : '');
  set('clock', F_T.format(d)); set('greet', d.getHours() < 12 ? 'صباح الخير' : 'مساء الخير');
}
let lastDay = new Date().toDateString();
setInterval(() => {
  renderDate();
  if (new Date().toDateString() !== lastDay){ lastDay = new Date().toDateString(); if (currentPage === 'home') renderHome(); }
}, 20000);


/* =====================================================================
   استيراد من Excel — محرك موحّد تستخدمه وحدات المخزون
   App.importExcel({ title, icon, page, modes:[{ id,label,desc,cols,check,apply }] })
   العمود: { k, labels:[...], req, type:'date'|'num'|'text', def }
   ===================================================================== */
function localISO(dt){ const x = dt || new Date(); const p = v => String(v).padStart(2,'0'); return `${x.getFullYear()}-${p(x.getMonth()+1)}-${p(x.getDate())}`; }
const xlNorm = s => String(s == null ? '' : s)
  .replace(/[\u064B-\u0652\u0640]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
  .replace(/[^\u0600-\u06FFa-zA-Z0-9]/g, '').toLowerCase();

function xlDate(v){
  if (v == null || v === '') return '';
  if (v instanceof Date && !isNaN(v)) return localISO(v);
  if (typeof v === 'number' && isFinite(v)){
    const ms = Math.round((v - 25569) * 86400000);
    const dt = new Date(ms); return isNaN(dt) ? '' : localISO(new Date(dt.getTime() + dt.getTimezoneOffset() * 60000));
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) return `${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`;
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (m) return `${m[3]}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`;
  const dt = new Date(s); return isNaN(dt) ? '' : localISO(dt);
}
function xlNum(v){
  if (typeof v === 'number') return v;
  const s = String(v == null ? '' : v).replace(/[٠-٩]/g, c => '٠١٢٣٤٥٦٧٨٩'.indexOf(c)).replace(/[^\d.-]/g, '');
  const x = parseFloat(s); return isFinite(x) ? x : NaN;
}
function xlText(v){ return String(v == null ? '' : v).trim(); }

/** يقرأ أول ورقة ويحوّلها لمصفوفة صفوف خام. */
async function xlReadFile(file){
  const buf = await file.arrayBuffer();
  const wb = await XLSX.read(buf, { type:'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error('الملف لا يحتوي أي ورقة بيانات.');
  return XLSX.utils.sheet_to_json(ws, { header:1, blankrows:false, defval:'' });
}
/** يطابق أسماء الأعمدة مع رؤوس الملف مهما اختلف التشكيل والمسافات. */
function xlMapHeader(row, cols){
  const heads = row.map(xlNorm), map = {};
  cols.forEach(c => {
    let i = -1;
    for (const lab of c.labels){ i = heads.indexOf(xlNorm(lab)); if (i >= 0) break; }
    if (i < 0) for (const lab of c.labels){ i = heads.findIndex(h => h && h.includes(xlNorm(lab))); if (i >= 0) break; }
    map[c.k] = i;
  });
  return map;
}
function xlBuildRows(rows, cols){
  if (!rows.length) return { recs:[], errors:[{ row:0, msg:'الملف فارغ.' }], missing:[] };
  const map = xlMapHeader(rows[0], cols);
  const missing = cols.filter(c => c.req && map[c.k] < 0).map(c => c.labels[0]);
  if (missing.length) return { recs:[], errors:[], missing };
  const recs = [], errors = [];
  for (let r = 1; r < rows.length; r++){
    const raw = rows[r];
    if (!raw || raw.every(v => String(v == null ? '' : v).trim() === '')) continue;
    const rec = {}; let err = null;
    for (const c of cols){
      const i = map[c.k], v = i >= 0 ? raw[i] : '';
      if (c.type === 'date'){
        const dt = xlDate(v);
        if (!dt && c.req){ err = `عمود «${c.labels[0]}» فارغ أو تاريخه غير مفهوم`; break; }
        rec[c.k] = dt || (c.def || '');
      } else if (c.type === 'num'){
        const x = xlNum(v);
        if (!isFinite(x) || x <= 0){ err = `عمود «${c.labels[0]}» يجب أن يكون رقماً أكبر من صفر`; break; }
        rec[c.k] = Math.round(x);
      } else {
        const t = xlText(v);
        if (!t && c.req){ err = `عمود «${c.labels[0]}» مطلوب وهو فارغ`; break; }
        rec[c.k] = t || (c.def || '');
      }
    }
    if (err) errors.push({ row:r + 1, msg:err }); else { rec.__row = r + 1; recs.push(rec); }
  }
  return { recs, errors, missing:[] };
}
function xlTemplate(cfg, mode){
  const head = mode.cols.map(c => c.labels[0]);
  const rows = [head].concat(mode.sample || []);
  const wb = XLSX.utils.book_new(), ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = head.map(h => ({ wch: Math.max(12, h.length + 4) }));
  XLSX.utils.book_append_sheet(wb, ws, 'البيانات');
  const out = XLSX.write(wb, { bookType:'xlsx', type:'array' });
  const url = URL.createObjectURL(new Blob([out], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const a = document.createElement('a'); a.href = url; a.download = `قالب_${cfg.title}_${mode.label}.xlsx`;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
  notify.info('تم تنزيل القالب', 'عبّئه ثم ارجع واختره — لا تغيّر أسماء الأعمدة.', { log:false });
}

async function importExcel(cfg){
  vibrate(10);
  let mode = cfg.modes[0];
  const ent = openOverlay(`
    <div class="hero-ico" style="--tint:var(--info-bg)">${ico('chart')}</div>
    <h3>استيراد من Excel — ${esc(cfg.title)}</h3>
    <p class="lead">اختر نوع العملية، ثم اختر ملف Excel. كل صف = عملية واحدة.</p>
    <div class="mk-seg" id="xl-modes" style="margin:14px 0">${cfg.modes.map(m => `<button type="button" data-m="${m.id}" aria-pressed="${m.id === mode.id}">${esc(m.label)}</button>`).join('')}</div>
    <div class="info-box" id="xl-desc"></div>
    <div class="actions">
      <label class="btn btn-primary">اختيار ملف Excel<input type="file" id="xl-file" hidden accept=".xlsx,.xls,.csv"></label>
      <button class="btn" id="xl-tpl">تنزيل قالب جاهز</button>
      <button class="btn btn-ghost" data-cancel data-autofocus>إلغاء</button>
    </div>`);
  const q = s => ent.ov.querySelector(s);
  const drawDesc = () => {
    q('#xl-desc').innerHTML = `${esc(mode.desc)}<br><b>أعمدة الملف:</b> ${mode.cols.map(c => esc(c.labels[0]) + (c.req ? ' <i style="color:var(--danger-text)">*</i>' : '')).join(' — ')}
      <br><span class="muted">الأعمدة بعلامة * إلزامية، والترتيب غير مهم. الصفوف الخاطئة تُتخطّى ويُعرض سببها.</span>`;
  };
  drawDesc();
  q('#xl-modes').querySelectorAll('[data-m]').forEach(b => b.onclick = () => {
    mode = cfg.modes.find(m => m.id === b.dataset.m);
    q('#xl-modes').querySelectorAll('[data-m]').forEach(x => x.setAttribute('aria-pressed', x === b));
    drawDesc(); vibrate(6);
  });
  q('#xl-tpl').onclick = () => xlTemplate(cfg, mode);
  q('[data-cancel]').onclick = () => { ent.close(); notify.info('تم إلغاء الاستيراد', '', { log:false, duration:2000 }); };
  q('#xl-file').addEventListener('change', async e => {
    const file = e.target.files && e.target.files[0]; if (!file) return;
    let rows;
    try { rows = await xlReadFile(file); }
    catch(err){ return notify.error('تعذّرت قراءة الملف', 'تأكد أنه ملف Excel صالح (.xlsx أو .csv) وأعد المحاولة.'); }
    const built = xlBuildRows(rows, mode.cols);
    if (built.missing.length){
      return notify.error('أعمدة ناقصة في الملف', `لم أجد: ${built.missing.join('، ')}. نزّل القالب الجاهز وانسخ بياناتك فيه.`, { duration:9000 });
    }
    const extra = mode.check ? (mode.check(built.recs) || []) : [];
    const badRows = new Set(extra.map(x => x.row));
    const good = built.recs.filter(r => !badRows.has(r.__row));
    const errors = built.errors.concat(extra).sort((a,b) => a.row - b.row);
    ent.close();
    showPreview(cfg, mode, good, errors, file.name);
  });
}
function showPreview(cfg, mode, recs, errors, fileName){
  const cols = mode.cols;
  const head = cols.map(c => `<th>${esc(c.labels[0])}</th>`).join('');
  const body = recs.slice(0, 8).map(r => `<tr>${cols.map(c => `<td>${esc(String(r[c.k] == null ? '' : r[c.k]))}</td>`).join('')}</tr>`).join('');
  const ent = openOverlay(`
    <div class="hero-ico" style="--tint:${recs.length ? 'var(--ok-bg)' : 'var(--warn-bg)'}">${ico(recs.length ? 'success' : 'warning')}</div>
    <h3>مراجعة قبل الاستيراد</h3>
    <p class="lead num">${esc(mode.label)} — <b>${n(recs.length)}</b> صف صالح${errors.length ? ` و<b>${n(errors.length)}</b> صف سيُتخطّى` : ''}</p>
    ${recs.length ? `<div class="card" style="margin-top:14px;overflow:auto"><table class="data-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>
      ${recs.length > 8 ? `<p class="note num">تُعرض أول ٨ صفوف من ${n(recs.length)}.</p>` : ''}` : ''}
    ${errors.length ? `<div class="info-box" style="background:var(--warn-bg);color:var(--warn-text);max-height:180px;overflow:auto">
      <b>صفوف لن تُستورد:</b><br>${errors.slice(0, 25).map(x => `صف ${n(x.row)}: ${esc(x.msg)}`).join('<br>')}
      ${errors.length > 25 ? `<br><b>… و${n(errors.length - 25)} صفاً آخر</b>` : ''}</div>` : ''}
    <div class="info-box">تُضاف هذه الصفوف إلى سجلاتك الحالية ولا تُستبدل. تقدر تتراجع مباشرة بعد الاستيراد.</div>
    <div class="actions">
      <button class="btn btn-primary" data-ok ${recs.length ? '' : 'disabled'}>استيراد ${n(recs.length)} صف</button>
      <button class="btn" data-cancel data-autofocus>إلغاء</button>
    </div>
    <p class="note">${esc(fileName)}</p>`);
  ent.ov.querySelector('[data-cancel]').onclick = () => { ent.close(); notify.info('تم إلغاء الاستيراد', 'لم يتغيّر شيء في بياناتك.', { log:false }); };
  const okBtn = ent.ov.querySelector('[data-ok]');
  if (okBtn) okBtn.onclick = async () => { ent.close(); try { await mode.apply(recs); } catch(err){ notify.error('فشل الاستيراد', 'السبب: ' + (err.message || err)); } };
}

/* =====================================================================
   النسخ الاحتياطي والاستعادة
   ===================================================================== */
window.BACKUP_HOOKS = window.BACKUP_HOOKS || {};
async function buildBackup(){
  const modules = {}, blobs = {};
  MODULE_ORDER.forEach(id => {
    modules[id] = {};
    MODULE_META[id].keys.forEach(k => { const v = localStorage.getItem(k); if (v != null) modules[id][k] = v; });
  });
  for (const id of MODULE_ORDER){
    const h = window.BACKUP_HOOKS[id];
    if (h && h.collect){ try { const extra = await h.collect(); if (extra) blobs[id] = extra; } catch(e){} }
  }
  const settings = {};
  SETTINGS_KEYS.forEach(k => { const v = localStorage.getItem(k); if (v != null) settings[k] = v; });
  return { app:APP_ID, version:APP_VERSION, createdAt:new Date().toISOString(), modules, blobs, settings };
}
function backupFileName(prefix){
  const d = new Date(), p = x => String(x).padStart(2, '0');
  return `${prefix || 'نسخة_احتياطية'}_النظام_الموحد_${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}.json`;
}
function downloadJSON(obj, name){
  const blob = new Blob([JSON.stringify(obj, null, 1)], { type:'application/json' });
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
async function exportBackup(opts = {}){
  const total = totalRecords();
  if (!total && !opts.silent){
    const ok = await confirmDialog({ title:'لا توجد بيانات بعد', msg:'كل الوحدات فارغة على هذا الجهاز. هل تريد إنشاء نسخة تحتوي الإعدادات فقط؟', okText:'إنشاء النسخة', icon:'empty' });
    if (!ok){ notify.info('تم إلغاء إنشاء النسخة', '', { log:false }); return false; }
  }
  try {
    const data = await buildBackup(), name = backupFileName(opts.prefix);
    downloadJSON(data, name);
    if (!opts.prefix){ S.lastBackupAt = data.createdAt; saveSettings(); }
    notify.success(opts.prefix ? 'تم حفظ نسخة من بياناتك الحالية' : 'تم إنشاء النسخة الاحتياطية', `${n(total)} سجل — تجد الملف في مجلد التنزيلات.`);
    refreshAfterData();
    return true;
  } catch(e){
    notify.error('تعذّر إنشاء النسخة الاحتياطية', 'السبب: ' + (e.message || e) + '. أعد المحاولة، وإن تكرر الخطأ جرّب متصفحاً آخر.');
    return false;
  }
}
function startRestore(){ vibrate(10); const inp = $('#restoreInput'); inp.value = ''; inp.click(); }
$('#restoreInput').addEventListener('change', async e => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  if (file.size > 300 * 1024 * 1024) return notify.error('الملف كبير جداً', 'حجم ملف النسخة يتجاوز ٣٠٠ ميغابايت، تأكد أنك اخترت الملف الصحيح.');
  let text, data;
  try { text = await file.text(); } catch(err){ return notify.error('تعذّرت قراءة الملف', 'تأكد أن الملف غير تالف وأعد المحاولة.'); }
  try { data = JSON.parse(text); } catch(err){ return notify.error('الملف ليس نسخة احتياطية صالحة', 'الملف المختار ليس بصيغة JSON أو أنه تالف.'); }
  if (!data || data.app !== APP_ID || typeof data.modules !== 'object')
    return notify.error('هذا الملف ليس نسخة من النظام الموحّد', 'اختر ملفاً أُنشئ من زر «تنزيل نسخة احتياطية» في هذا التطبيق.');
  previewRestore(data, file.name);
});
function previewRestore(data, fileName){
  const rows = MODULE_ORDER.map(id => {
    const inFile = countRawMap(data.modules[id]), now = moduleRecords(id);
    return `<tr><td>${ico(id)}${MODULE_META[id].name}</td><td class="num">${n(inFile)}</td><td class="num muted">${n(now)}</td></tr>`;
  }).join('');
  const newer = String(data.version || '0').split('.')[0] > APP_VERSION.split('.')[0];
  const ent = openOverlay(`
    <div class="hero-ico" style="--tint:var(--info-bg)">${ico('inbox')}</div>
    <h3>مراجعة النسخة قبل الاستعادة</h3>
    <p class="lead num">أُنشئت ${data.createdAt ? fmtDateTime(data.createdAt) : 'بتاريخ غير معروف'} — الإصدار ${fmtVersion(String(data.version || '0.0.0'))}</p>
    <div class="card" style="margin-top:16px;overflow:hidden">
      <table class="data-table"><thead><tr><th>الوحدة</th><th>بالملف</th><th>حالياً</th></tr></thead><tbody>${rows}</tbody></table>
    </div>
    ${newer ? `<div class="info-box" style="background:var(--warn-bg);color:var(--warn-text)">هذه النسخة من إصدار أحدث من تطبيقك. حدّث التطبيق أولاً لتفادي فقدان أي بيانات.</div>` : ''}
    <div class="info-box">ستُستبدل بيانات الوحدات الموجودة بالملف ببيانات النسخة. الوحدات غير الموجودة بالملف تبقى كما هي.</div>
    <label class="check"><input type="checkbox" id="safetyChk" checked><span>نزّل نسخة من بياناتي الحالية أولاً (موصى به)</span></label>
    <div class="actions">
      <button class="btn btn-danger" data-ok>استعادة النسخة</button>
      <button class="btn" data-cancel data-autofocus>إلغاء</button>
    </div>
    <p class="note">${esc(fileName)}</p>`);
  ent.ov.querySelector('[data-cancel]').onclick = () => { ent.close(); notify.info('تم إلغاء الاستعادة', 'لم يتغيّر أي شيء في بياناتك.', { log:false }); };
  ent.ov.querySelector('[data-ok]').onclick = async () => {
    const safety = ent.ov.querySelector('#safetyChk').checked;
    ent.close();
    if (safety){ const ok = await exportBackup({ silent:true, prefix:'قبل_الاستعادة' }); if (!ok) return; await sleep(500); }
    await applyRestore(data);
  };
}
async function applyRestore(data){
  let restored = 0;
  try {
    MODULE_ORDER.forEach(id => {
      const map = data.modules[id]; if (!map) return;
      MODULE_META[id].keys.forEach(k => { if (k in map){ localStorage.setItem(k, map[k]); } });
      restored += countRawMap(map);
    });
    if (data.settings) SETTINGS_KEYS.forEach(k => {
      if (k === 'unified_settings' && data.settings[k]){ // نحافظ على حالة الترحيب والتثبيت الحالية
        try { const inc = JSON.parse(data.settings[k]); S = Object.assign({}, S, { haptics:inc.haptics ?? S.haptics }); saveSettings(); } catch(e){}
      } else if (data.settings[k] != null) localStorage.setItem(k, data.settings[k]);
    });
    if (data.blobs) for (const id of MODULE_ORDER){
      const h = window.BACKUP_HOOKS[id];
      if (h && h.apply && data.blobs[id]){ try { await h.apply(data.blobs[id]); } catch(e){} }
    }
    S.lastBackupAt = data.createdAt || S.lastBackupAt; saveSettings();
    sessionStorage.setItem('unified_after_restore', JSON.stringify({ count:restored, date:data.createdAt }));
    notify.info('جارٍ تطبيق النسخة…', 'سيُعاد تحميل التطبيق خلال لحظات.', { log:false, duration:1500 });
    setTimeout(() => location.reload(), 1300);
  } catch(e){
    notify.error('فشلت الاستعادة', (e.name === 'QuotaExceededError' ? 'مساحة التخزين في المتصفح ممتلئة.' : 'السبب: ' + (e.message || e)) + ' استعد النسخة التي نُزّلت قبل الاستعادة.', { duration:0 });
  }
}
function refreshAfterData(){ if (currentPage === 'home') renderHome(); else if (currentPage === 'backup') renderBackup(); else updateBadges(collectAllAlerts()); }

async function renderBackup(){
  const lb = S.lastBackupAt, d = daysSince(lb);
  const status = !lb ? '<span class="pill mid">لم تُنشأ نسخة بعد</span>'
    : d >= 7 ? `<span class="pill ${d >= 14 ? 'high' : 'mid'}">آخر نسخة ${relTime(lb)}</span>` : `<span class="pill ok">آخر نسخة ${relTime(lb)}</span>`;
  const rows = MODULE_ORDER.map(id => {
    const recs = moduleRecords(id);
    return `<tr><td>${ico(id)}${MODULE_META[id].name}</td><td class="num">${recs ? n(recs) : '—'}</td>
      <td>${recs ? '<span class="pill ok">محفوظة</span>' : '<span class="pill info">فارغة</span>'}</td></tr>`;
  }).join('');
  $('#page-backup').innerHTML = `
    <div class="page-head" style="--tint:rgba(59,130,246,.15)"><div class="tile">${ico('backup')}</div>
      <div><h2>النسخ الاحتياطي</h2><p>ملف واحد يحفظ بيانات كل الوحدات، تقدر ترجعه على نفس الجهاز أو جهاز جديد.</p></div></div>
    <div class="grid-2">
      <div class="card action-card">
        <div class="top">${ico('outbox')}<div><h3>إنشاء نسخة احتياطية</h3><p>ينزّل ملف JSON فيه بيانات الوحدات السبعة والإعدادات.</p></div></div>
        <div class="row">${status}<span class="pill info num">${n(totalRecords())} سجل على الجهاز</span></div>
        <button class="btn btn-primary" onclick="exportBackup()">تنزيل نسخة احتياطية</button>
      </div>
      <div class="card action-card">
        <div class="top">${ico('inbox')}<div><h3>استعادة نسخة</h3><p>اختر الملف، راجع ما بداخله، ثم أكّد. نحفظ نسخة من بياناتك الحالية قبل الاستبدال.</p></div></div>
        <div class="row"><span class="pill info">يقبل ملفات هذا التطبيق فقط</span></div>
        <button class="btn" onclick="startRestore()">اختيار ملف النسخة…</button>
      </div>
    </div>
    <div class="sec-head"><h2>${ico('chart', 28)}البيانات على هذا الجهاز</h2><span class="hint" id="storageUse"></span></div>
    <div class="card" style="overflow:hidden"><table class="data-table"><thead><tr><th>الوحدة</th><th>السجلات</th><th>الحالة</th></tr></thead><tbody>${rows}</tbody></table></div>
    <div class="sec-head"><h2>${ico('shield', 28)}طريقة آمنة للحفظ</h2></div>
    <div class="card" style="padding:18px 20px"><ol class="steps" style="margin:0;max-width:none">
      <li>انزل نسخة احتياطية مرة بالأسبوع على الأقل، أو قبل أي تحديث أو مسح لبيانات المتصفح.</li>
      <li>انقل الملف لمكان خارج الجهاز: Google Drive أو البريد أو فلاشة.</li>
      <li>عند تغيير الجهاز: افتح التطبيق وثبّته، ثم استعد آخر نسخة من هذه الصفحة.</li>
    </ol></div>`;
  if (navigator.storage && navigator.storage.estimate){
    try { const est = await navigator.storage.estimate(); const mb = (est.usage || 0) / 1048576;
      const el = $('#storageUse'); if (el) el.textContent = 'المساحة المستخدمة: ' + nf.format(Math.round(mb * 10) / 10) + ' ميغابايت'; } catch(e){}
  }
  const u = localUsage(), el2 = $('#storageUse');
  if (el2) el2.textContent = `مساحة البيانات: ${n(u.pct)}٪ من المتاح للمتصفح`;
}
PAGE_RENDERERS.backup = renderBackup;

/* =====================================================================
   تثبيت التطبيق على الشاشة الرئيسية
   ===================================================================== */
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; if (currentPage === 'settings') renderSettings(); });
window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  notify({ type:'success', title:'تم تثبيت التطبيق', msg:'تجده على الشاشة الرئيسية باسم «النظام الموحّد».', system:true });
  if (currentPage === 'settings') renderSettings();
});
function isStandalone(){ return window.matchMedia('(display-mode: standalone)').matches || window.matchMedia('(display-mode: window-controls-overlay)').matches || navigator.standalone === true; }
function isIOS(){ return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }
function isFileProtocol(){ return location.protocol === 'file:'; }
async function waitFor(fn, ms){ const t = Date.now(); while (!fn() && Date.now() - t < ms) await sleep(100); return fn(); }

function showInstallSheet(opts = {}){
  return new Promise(resolve => {
    let body, primary;
    if (deferredPrompt){
      body = ''; primary = 'تثبيت الآن';
    } else if (isIOS()){
      body = `<div class="info-box"><ol><li>اضغط زر المشاركة <b>⬆︎</b> أسفل متصفح Safari.</li><li>اختر <b>«إضافة إلى الشاشة الرئيسية»</b>.</li><li>اضغط <b>«إضافة»</b>.</li></ol></div>`;
    } else if (isFileProtocol()){
      body = `<div class="info-box">التثبيت يعمل عند فتح التطبيق من رابطه على الإنترنت (مثل رابط Netlify)، وليس عند فتح الملف مباشرة من الجهاز. بعد التثبيت يعمل بدون إنترنت.</div>`;
    } else {
      body = `<div class="info-box"><ol><li>افتح قائمة المتصفح <b>⋮</b> (أعلى الشاشة).</li><li>اختر <b>«تثبيت التطبيق»</b> أو <b>«إضافة إلى الشاشة الرئيسية»</b>.</li><li>أكّد التثبيت.</li></ol></div>`;
    }
    const ent = openOverlay(`
      <div class="hero-ico">${ico('mobile')}</div>
      <h3>ثبّت التطبيق على شاشتك الرئيسية</h3>
      <p class="lead">يفتح بضغطة وحدة، بشاشة كاملة، ويشتغل بدون إنترنت.</p>
      <div class="install-app"><img src="icons/icon-192.png" alt=""><div><b>النظام الإداري الموحّد</b><small class="num">الإصدار ${fmtVersion(APP_VERSION)} — للجوال والكمبيوتر</small></div></div>
      ${body}
      ${opts.startup ? '<label class="check"><input type="checkbox" id="installNever"><span>لا تُظهر هذه الرسالة مرة أخرى</span></label>' : ''}
      <div class="actions">
        ${primary ? `<button class="btn btn-primary" data-ok data-autofocus>${primary}</button>` : ''}
        <button class="btn" data-cancel ${primary ? '' : 'data-autofocus'}>${primary ? 'لاحقاً' : 'فهمت'}</button>
      </div>`, { onClose: () => {
        const nv = ent.ov.querySelector('#installNever');
        if (nv && nv.checked){ S.installNever = true; saveSettings(); notify.info('لن تظهر رسالة التثبيت عند الفتح', 'تقدر تثبّت التطبيق في أي وقت من الإعدادات.', { log:false }); }
        resolve();
      }});
    const ok = ent.ov.querySelector('[data-ok]');
    if (ok) ok.onclick = async () => {
      ent.close();
      if (!deferredPrompt) return;
      try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome !== 'accepted') notify.info('تم إلغاء التثبيت', 'تقدر تثبّت التطبيق لاحقاً من الإعدادات.', { log:false });
        deferredPrompt = null;
      } catch(e){ notify.error('تعذّر فتح نافذة التثبيت', 'استخدم قائمة المتصفح ⋮ ثم «تثبيت التطبيق».'); }
    };
    ent.ov.querySelector('[data-cancel]').onclick = () => ent.close();
  });
}

/* شاشة الترحيب (أول تشغيل) */
function showWelcome(){
  return new Promise(resolve => {
    const ent = openOverlay(`
      <div class="hero-ico">${ico('sparkles')}</div>
      <h3>أهلاً بك في النظام الإداري الموحّد</h3>
      <p class="lead">سبع وحدات في تطبيق واحد. ثلاث أشياء تساعدك من البداية:</p>
      <div class="welcome-steps">
        <div>${ico('compass')}<span>تنقّل من القائمة الجانبية على الكمبيوتر، ومن الشريط السفلي على الجوال.</span></div>
        <div>${ico('bell')}<span>كل عملية يظهر لها إشعار يوضّح النتيجة: نجاح أو خطأ وسببه.</span></div>
        <div>${ico('backup')}<span>انزل نسخة احتياطية أسبوعياً من صفحة النسخ الاحتياطي.</span></div>
      </div>
      <div class="actions">
        <button class="btn btn-primary" data-ok data-autofocus>ابدأ الاستخدام</button>
        <button class="btn" data-guide>اقرأ الدليل</button>
      </div>`, { onClose: v => { S.onboarded = true; saveSettings(); if (v === 'guide') switchModule('guide'); resolve(); } });
    ent.ov.querySelector('[data-ok]').onclick = () => ent.close('start');
    ent.ov.querySelector('[data-guide]').onclick = () => ent.close('guide');
  });
}

/* مركز الإشعارات */
function openNotifCenter(tab){
  vibrate(8);
  const alerts = collectAllAlerts();
  tab = tab || (alerts.length ? 'alerts' : 'log');
  const ent = openOverlay(`
    <div class="drawer-head">${ico('bell', 30)}<h3>الإشعارات</h3><button class="tb-btn" style="color:var(--text);background:var(--card-2);border-color:var(--card-border)" data-close aria-label="إغلاق">${LINE.x}</button></div>
    <div class="tabs" role="tablist">
      <button role="tab" data-tab="alerts">التنبيهات (${n(alerts.length)})</button>
      <button role="tab" data-tab="log">سجل العمليات</button>
    </div>
    <div class="drawer-body" id="ncBody"></div>`, { drawer:true, onClose: () => updateBell() });
  const body = ent.ov.querySelector('#ncBody');
  const show = t => {
    ent.ov.querySelectorAll('[data-tab]').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === t));
    if (t === 'alerts'){
      body.innerHTML = alerts.length ? alerts.map(alertRowHTML).join('') : `<div class="empty">${ico('success')}<div><b>لا توجد تنبيهات</b><p>كل الوحدات بوضع جيد الآن.</p></div></div>`;
      body.querySelectorAll('.alert-row').forEach(r => r.addEventListener('click', () => ent.close()));
    } else {
      body.innerHTML = notifLog.length ? notifLog.map(x => `<div class="log-item ${x.read ? '' : 'unread'}">${ico(TYPE_META[x.type] ? x.type : 'info')}
          <div style="flex:1;min-width:0"><b>${esc(x.title)}</b>${x.msg ? `<p>${esc(x.msg)}</p>` : ''}<time class="num">${relTime(x.at)}</time></div></div>`).join('')
        + `<div style="padding:14px 18px"><button class="btn btn-sm btn-ghost" id="clearLog">مسح السجل</button></div>`
        : `<div class="empty">${ico('empty')}<div><b>السجل فارغ</b><p>تظهر هنا نتائج العمليات: الحفظ، الاستعادة، الأخطاء.</p></div></div>`;
      notifLog.forEach(x => x.read = true); saveLog();
      const c = body.querySelector('#clearLog');
      if (c) c.onclick = async () => {
        if (await confirmDialog({ title:'مسح سجل الإشعارات؟', msg:'يُحذف السجل فقط، ولا تتأثر أي بيانات.', okText:'مسح السجل', danger:true })){
          notifLog = []; saveLog(); show('log'); notify.success('تم مسح السجل', '', { log:false });
        }
      };
    }
  };
  ent.ov.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { vibrate(6); show(b.dataset.tab); });
  ent.ov.querySelector('[data-close]').onclick = () => ent.close();
  show(tab);
}

/* =====================================================================
   الإعدادات
   ===================================================================== */
function renderSettings(){
  const el = $('#page-settings'); if (!el) return;
  const theme = document.documentElement.getAttribute('data-theme'), lay = getLayoutPref();
  const perm = sysNotifSupported() ? Notification.permission : 'unsupported';
  const permTxt = { granted:'مسموحة على هذا الجهاز', denied:'محظورة من المتصفح — غيّرها من إعدادات الموقع', default:'تحتاج إذناً عند التفعيل', unsupported:'غير مدعومة في هذا المتصفح' }[perm];
  const seg = (name, cur, opts) => `<div class="seg" role="group">${opts.map(([v, l]) => `<button aria-pressed="${cur === v}" onclick="${name}('${v}')">${l}</button>`).join('')}</div>`;
  const sw = (on, fn, label) => `<button class="switch" role="switch" aria-checked="${on}" aria-label="${label}" onclick="${fn}"></button>`;
  const installState = isStandalone() ? '<span class="pill ok">مثبّت</span>' : `<button class="btn btn-sm btn-primary" onclick="showInstallSheet()">تثبيت</button>`;
  el.innerHTML = `
    <div class="page-head" style="--tint:rgba(107,114,128,.15)"><div class="tile">${ico('settings')}</div>
      <div><h2>الإعدادات</h2><p>المظهر، طريقة العرض، الإشعارات، ومعلومات الإصدار.</p></div></div>
    <div class="card set-list">
      <div class="set-row">${ico(theme === 'dark' ? 'moon' : 'sun')}<div class="grow"><b>المظهر</b><small>فاتح للنهار، داكن لراحة العين ليلاً.</small></div>
        ${seg('setTheme', theme, [['light','فاتح'],['dark','داكن']])}</div>
      <div class="set-row">${ico(effectiveLayout() === 'mobile' ? 'mobile' : 'desktop')}<div class="grow"><b>طريقة العرض</b><small>التلقائي يختار حسب حجم الشاشة. زر ${effectiveLayout() === 'mobile' ? '🖥' : '📱'} بالأعلى يبدّل مباشرة.</small></div>
        ${seg('setLayout', lay, [['auto','تلقائي'],['desktop','كمبيوتر'],['mobile','جوال']])}</div>
      <div class="set-row">${ico('vibrate')}<div class="grow"><b>الاهتزاز عند اللمس</b><small>اهتزاز خفيف مع كل ضغطة (على الجوال).</small></div>
        ${sw(S.haptics, 'toggleHaptics()', 'الاهتزاز')}</div>
      <div class="set-row">${ico('bell')}<div class="grow"><b>إشعارات النظام</b><small>${permTxt}. تصلك بنفس نص وأيقونة إشعارات التطبيق.</small></div>
        ${sw(S.sysNotif && perm === 'granted', 'setSystemNotif(' + !(S.sysNotif && perm === 'granted') + ')', 'إشعارات النظام')}</div>
      <div class="set-row">${ico('party')}<div class="grow"><b>تجربة الإشعارات</b><small>يعرض إشعاراً تجريبياً داخل التطبيق وعلى الجهاز.</small></div>
        <button class="btn btn-sm" onclick="testNotification()">إرسال إشعار تجريبي</button></div>
      <div class="set-row">${ico('mobile')}<div class="grow"><b>تثبيت التطبيق</b><small>${isStandalone() ? 'التطبيق مثبّت ويعمل كتطبيق مستقل.' : 'أضفه للشاشة الرئيسية ليعمل بشاشة كاملة وبدون إنترنت.'}</small></div>
        ${installState}</div>
      <div class="set-row">${ico('label')}<div class="grow"><b>الترويسة الرسمية</b><small>${letterhead() ? 'تُطبع أعلى سندات المعدات وتقرير الوارد والصادر.' : 'ارفع صورة الترويسة مرة واحدة لتظهر في كل المطبوعات الرسمية.'}</small>
          ${letterhead() ? `<img class="lh-prev" src="${letterhead()}" alt="الترويسة" style="margin-top:8px">` : ''}</div>
        <div class="row"><label class="btn btn-sm ${letterhead() ? '' : 'btn-primary'}">${letterhead() ? 'تغيير' : 'رفع صورة'}<input type="file" accept="image/*" hidden onchange="uploadLetterhead(event)"></label>${letterhead() ? '<button class="btn btn-sm btn-ghost" onclick="removeLetterhead()">إزالة</button>' : ''}</div></div>
      <div class="set-row">${ico('sparkles')}<div class="grow"><b>شاشة الترحيب</b><small>تعرض الخطوات الأولى مرة أخرى.</small></div>
        <button class="btn btn-sm" onclick="showWelcome()">عرض</button></div>
    </div>
    <div class="sec-head"><h2>${ico('info', 28)}حول التطبيق</h2></div>
    <div class="card set-list">
      <div class="set-row">${ico('label')}<div class="grow"><b class="num">الإصدار ${fmtVersion(APP_VERSION)}</b><small class="num">تاريخ البناء: ${F_G.format(new Date(BUILD_DATE))}</small></div>
        <button class="btn btn-sm" onclick="checkForUpdate()">البحث عن تحديث</button></div>
      <div class="set-row">${ico('rocket')}<div class="grow"><b>ما الجديد</b><small>التغييرات في كل إصدار.</small></div>
        <button class="btn btn-sm" onclick="showChangelog()">عرض</button></div>
      <div class="set-row">${ico('globe')}<div class="grow"><b>التخزين</b><small>كل البيانات محفوظة على هذا الجهاز فقط، ولا تُرسل لأي خادم.</small></div></div>
    </div>`;
}
PAGE_RENDERERS.settings = renderSettings;
function toggleHaptics(){
  S.haptics = !S.haptics; saveSettings(); vibrate(20); renderSettings();
  notify.info(S.haptics ? 'تم تفعيل الاهتزاز' : 'تم إيقاف الاهتزاز', '', { log:false, duration:2200 });
}
function showChangelog(){
  vibrate(8);
  const ent = openOverlay(`
    <div class="hero-ico">${ico('rocket')}</div>
    <h3 class="num">الإصدار ${fmtVersion(APP_VERSION)}</h3>
    <p class="lead num">تاريخ البناء: ${F_G.format(new Date(BUILD_DATE))}</p>
    ${CHANGELOG.map(c => `<div class="info-box"><b class="num">${fmtVersion(c.v)}</b>${c.date ? ` <span class="muted num">— ${F_G.format(new Date(c.date))}</span>` : ''}
      <ul style="padding-inline-start:20px;margin-top:6px">${c.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul></div>`).join('')}
    <div class="actions"><button class="btn btn-primary" data-ok data-autofocus>تم</button></div>`);
  ent.ov.querySelector('[data-ok]').onclick = () => ent.close();
}

/* =====================================================================
   دليل المستخدم
   ===================================================================== */
const GUIDE = [
  { icon:'rocket', t:'البدء السريع', b:`
    <p>عند فتح التطبيق يمر بهذا التسلسل: شاشة البداية ← عرض تثبيت التطبيق (إن لم يكن مثبّتاً) ← شاشة الترحيب (أول مرة فقط) ← الشاشة الرئيسية.</p>
    <p>الشاشة الرئيسية تعرض اليوم والتاريخ الميلادي والهجري، عدد التنبيهات، وقت آخر نسخة احتياطية، ثم قائمة التنبيهات وبطاقات الوحدات السبعة.</p>` },
  { icon:'mobile', t:'تثبيت التطبيق على الشاشة الرئيسية', b:`
    <p><b>أندرويد وكروم على الكمبيوتر:</b> اضغط «تثبيت الآن» في الرسالة التي تظهر عند الفتح، أو من الإعدادات ← تثبيت التطبيق.</p>
    <p><b>آيفون:</b> من Safari اضغط زر المشاركة ⬆︎ ثم «إضافة إلى الشاشة الرئيسية».</p>
    <p>بعد التثبيت يفتح التطبيق بشاشة كاملة ويعمل بدون إنترنت. التثبيت يتطلب فتح التطبيق من رابطه (مثل Netlify)، وليس من ملف على الجهاز.</p>` },
  { icon:'compass', t:'التنقل بين الوحدات', b:`
    <ul><li><b>الكمبيوتر:</b> القائمة الجانبية ثابتة دائماً.</li>
    <li><b>الجوال:</b> الشريط السفلي فيه الرئيسية وأكثر ثلاث وحدات استخداماً، وباقي الوحدات من زر القائمة ☰.</li>
    <li>زر الرجوع في الجوال يعيدك للصفحة السابقة داخل التطبيق.</li>
    <li>الرقم الأحمر بجانب أي وحدة يعني وجود تنبيهات عاجلة فيها، والبرتقالي تنبيهات للمتابعة.</li></ul>` },
  { icon:'desktop', t:'التبديل بين عرض الكمبيوتر والجوال', b:`
    <p>الزر 📱/🖥 في الشريط العلوي يبدّل مباشرة. عرض الجوال على شاشة كبيرة يظهر داخل إطار بحجم الهاتف، ومفيد للمعاينة.</p>
    <p>للعودة للاختيار حسب حجم الشاشة: الإعدادات ← طريقة العرض ← تلقائي.</p>` },
  { icon:'bell', t:'الإشعارات', b:`
    <p>كل عملية يظهر لها إشعار بأعلى الشاشة بلون ونوع واضح:</p>
    <ul><li>✅ <b>نجاح:</b> تمت العملية، مع تفاصيلها (مثل عدد السجلات واسم الملف).</li>
    <li>❌ <b>خطأ:</b> ماذا حدث وكيف تحله. يبقى أطول لتقرأه.</li>
    <li>⚠️ <b>تحذير:</b> أمر يحتاج انتباهك، مثل تأخر النسخة الاحتياطية.</li>
    <li>ℹ️ <b>معلومة:</b> تأكيد لتغيير بسيط مثل الثيم.</li></ul>
    <p>مرّر الفأرة فوق الإشعار لإيقاف مؤقته. كل الإشعارات المهمة تُحفظ في <b>مركز الإشعارات</b> (زر الجرس) ← سجل العمليات.</p>
    <p><b>إشعارات النظام:</b> فعّلها من الإعدادات لتصلك خارج التطبيق بنفس النص والأيقونة. شكل الإطار نفسه يحدده نظام التشغيل.</p>` },
  { icon:'backup', t:'النسخ الاحتياطي والاستعادة', b:`
    <p><b>إنشاء نسخة:</b> النسخ الاحتياطي ← «تنزيل نسخة احتياطية». ينزل ملف واحد فيه بيانات كل الوحدات والإعدادات.</p>
    <p><b>الاستعادة بالترتيب:</b></p>
    <ol><li>اضغط «اختيار ملف النسخة».</li><li>راجع جدول المقارنة: عدد السجلات بالملف مقابل الموجود حالياً.</li>
    <li>اترك خيار «نزّل نسخة من بياناتي الحالية أولاً» مفعّلاً.</li><li>اضغط «استعادة النسخة» ثم انتظر إعادة التحميل.</li></ol>
    <p>يظهر تنبيه على الرئيسية إذا مرّ أسبوع بدون نسخة، ويصبح عاجلاً بعد أسبوعين.</p>` },
  { icon:'equipment', t:'مخزون المعدات', b:`
    <p>ثلاث تبويبات: <b>الإضافة</b> (الوارد)، <b>الصرف</b> (للجهات)، <b>المخزون</b> (الرصيد والرسم البياني).</p>
    <ol><li><b>إضافة صنف:</b> التاريخ ثم اسم الصنف والوحدة والكمية، ثم «إضافة للمخزون». يظهر إشعار بالرصيد الجديد.</li>
    <li><b>الصرف:</b> اختر الصنف فيظهر رصيده، اكتب الكمية والجهة، ثم «تنفيذ الصرف». لا يقبل كمية أكبر من الرصيد.</li>
    <li><b>السند:</b> من إشعار الصرف مباشرة، أو زر 🖨 بجانب الصف (يجمع كل ما صُرف لنفس الجهة بنفس اليوم)، أو حدّد عدة صفوف ثم «طباعة سند للمحدد».</li></ol>
    <p><b>سندات الإدخال:</b> في تبويب الإضافة أيضاً زر 🖨 لكل سطر، يطبع سند إدخال يجمع كل ما أُضيف من نفس المورد بنفس التاريخ، بإجمالي الكميات ونص إقرار وتوقيعي المورّد وأمين المخزن. وفيه تحديد متعدد و«طباعة سند للمحدد» — إذا اختلف الموردون يخرج سند مستقل لكل مورد.</p>
    <p><b>التعديل ✏️:</b> يفتح السجل بالنموذج بإطار برتقالي حتى تحفظ أو تلغي. <b>الحذف 🗑:</b> يطلب تأكيداً، وبعده يظهر زر «تراجع» لثوانٍ.</p>
    <p>لا يسمح التطبيق بحذف أو تعديل إضافة إذا صار الرصيد بالسالب بسبب الصرف منها. الصنف «منخفض» إذا رصيده أقل من ٥٠.</p>
    <p><b>نقل بياناتك القديمة:</b> زر «استيراد نسخة قديمة» يقبل ملف النسخة من تطبيق المعدات المستقل.</p>` },
  { icon:'payroll', t:'دفتر الرواتب', b:`
    <p><b>الترتيب الصحيح للعمل:</b></p>
    <ol><li>من «إعدادات الدفتر» اكتب اسم المندوب والعملة (يظهران على السندات).</li>
    <li>من «الموظفون» أضف الموظفين ورواتبهم الأساسية.</li>
    <li>سجّل «استلام رصيد» عند وصول المبلغ (نقدي أو بنكي).</li>
    <li>سجّل «تسليم لموظف» لكل دفعة، ثم اطبع السند من الإشعار مباشرة.</li>
    <li>آخر الشهر افتح «التسوية الشهرية» لمقارنة الراتب الأساسي بما صُرف، واطبع كشف الرواتب.</li></ol>
    <p>إذا كان المبلغ أكبر من الرصيد المتاح، أو سجّلت راتب نفس الشهر لنفس الموظف مرتين، يطلب التطبيق تأكيداً قبل الحفظ.</p>
    <p><b>المعلّق:</b> اختر «معلّق» وسببه إذا لم يكتمل الاستلام. عند اكتماله افتح العملية واضغط «تأكيد الاستلام». تظهر المعلّقة المتأخرة كتنبيه عاجل على الرئيسية (المدة من إعدادات الدفتر).</p>
    <p><b>إكسل:</b> نزّل القالب من «العمليات»، عبّئه، ثم «استيراد من إكسل». يعرض لك عدد الصفوف الصالحة قبل الاستيراد، ويُنشئ الموظفين غير الموجودين.</p>
    <p>كل إضافة أو تعديل أو حذف تُسجَّل في «سجل التدقيق».</p>` },
  { icon:'wared', t:'سجل الوارد والصادر', b:`
    <ol><li>اضغط «وارد جديد» أو «صادر جديد». الحالة الافتراضية للوارد «قيد المعالجة» وللصادر «منجز».</li>
    <li>عبّئ التاريخ والجهة والموضوع، وأرفق صورة الكتاب أو ملف PDF/Word. تقدر ترفق <b>أكثر من ملف</b> على الكتاب الواحد (اختر عدة ملفات مرة واحدة، أو اضغط «إضافة مرفق آخر»). الصور تُضغط تلقائياً.</li>
    <li>عند الحفظ يُعطى رقم تسلسلي تلقائي: «و-السنة-الرقم» للوارد و«ص-السنة-الرقم» للصادر.</li>
    <li>عند إنجاز المعاملة اضغط ✅ بجانبها، واكتب ملاحظة الإنجاز. إذا المرفقات صور يُطبع عليها كلها ختم أخضر «✔ منجز» مع تاريخ الإنجاز والملاحظة داخله.</li>
    <li>التطبيق يفحص كل صورة ويضع الختم في أوضح منطقة فارغة فيها — لا أسفل الورقة دائماً ولا فوق الكتابة أو الأختام. إن كانت الورقة مزدحمة بالكامل يرجع للزاوية السفلية، وفي كل الحالات يوضع الختم على أرضية فاتحة تبقيه مقروءاً.</li>
    <li>في عمود المرفقات تظهر أول صورة وبجانبها علامة <b>+عدد</b> لباقي المرفقات — اضغطها لتتنقّل بينها وتنزّل أي واحد.</li>
    <li><b>تعديل النوع:</b> عند الضغط على ✏️ تقدر تحوّل الكتاب من وارد إلى صادر أو العكس. لأن الرقم التسلسلي يتبع النوع، يطلب منك التطبيق تأكيداً ويعطي الكتاب رقماً جديداً في تسلسل النوع الجديد (الرقم القديم لا يُعاد استخدامه).</li></ol>
    <p>المعاملة «قيد المعالجة» لأكثر من ٣ أيام تظهر بالأحمر، وكتنبيه عاجل على الرئيسية.</p>
    <p><b>التقرير:</b> «تقرير PDF» يطبع السجلات الظاهرة حسب البحث والفلتر، مع الترويسة الرسمية إن كانت مرفوعة.</p>
    <p><b>طباعة أكثر من كتاب:</b> علّم المربع بجانب الكتب اللي بدك إياها (أو المربع في رأس الجدول لتحديد كل الظاهر)، فيظهر شريط فيه خيارين: «طباعة كشف المحدد» يطبع جدولاً بالسجلات المختارة، و«طباعة الكتب المرفقة» يطبع صفحة لكل كتاب فيها بياناته وصور مرفقاته.</p>
    <p><b>أين تُحفظ المرفقات:</b> من الإصدار ٢٫٨٫٠ صارت في مخزن التطبيق الكبير داخل المتصفح (مئات الميغابايت)، لا في المساحة المشتركة الصغيرة، فما عادت تزاحم باقي الوحدات. الترحيل تم تلقائياً عند أول فتح.</p>
    <p><b>مجلد على جهازك:</b> من «إعدادات السجل» اضغط «ربط مجلد المرفقات» واختر مجلداً. بعدها كل مرفق جديد يُنسخ فيه كملف حقيقي باسم يبدأ برقم الكتاب، وتقدر تضغط «تصدير كل المرفقات للمجلد» لنسخ الموجود. الميزة تعمل على Chrome وEdge على الكمبيوتر، وقد يطلب المتصفح إذن الوصول للمجلد مرة كل جلسة.</p>
    <p><b>النسخة الاحتياطية:</b> تشمل المرفقات كاملة، فحجم الملف أكبر من قبل — وهو المكان الوحيد اللي بيضمن رجوع كل شي لو انمسحت بيانات المتصفح.</p>` },
  { icon:'chart', t:'الاستيراد من Excel', b:`
    <p>موجود في <b>مخزون المعدات</b> و<b>مخزون الطعام</b> و<b>توزيع المنظفات</b> و<b>إدارة العهد</b> — زر «استيراد من Excel» أعلى الوحدة.</p>
    <ol><li>اختر نوع العملية: <b>إضافة أصناف</b> (تزيد الرصيد) أو <b>صرف/تسليم</b> (ينقص الرصيد).</li>
    <li>اضغط «تنزيل قالب جاهز» أول مرة، عبّئ بياناتك فيه ولا تغيّر أسماء الأعمدة.</li>
    <li>اختر الملف. الأعمدة تُطابَق بالاسم لا بالترتيب، والفروق في المسافات والهمزات ما بتفرق.</li>
    <li>تظهر شاشة مراجعة: كم صف صالح، معاينة أول ثمانية، وأي صف خاطئ مع سبب تخطّيه.</li>
    <li>اضغط «استيراد» — وتقدر تتراجع فوراً من زر «تراجع» في الإشعار.</li></ol>
    <p><b>أعمدة الإضافة:</b> التاريخ*، الصنف*، الوحدة، الكمية*، المورد، ملاحظات. وفي العهد يزيد: الرقم التسلسلي والحالة.</p>
    <p><b>أعمدة الصرف:</b> التاريخ*، الصنف*، الوحدة، الكمية*، الجهة*، ملاحظات. وفي العهد بدل الجهة: الشخص* والرقم الوظيفي والقسم.</p>
    <p><b>الأمان:</b> الصرف يتحقق من الرصيد تراكمياً — لو مجموع صفوف الملف يتجاوز المتاح من صنف، تُرفض الصفوف الزائدة ويُذكر المتاح. والاستيراد يُضيف لسجلاتك ولا يستبدلها.</p>` },
  { icon:'label', t:'الترويسة الرسمية', b:`
    <p>من <b>الإعدادات ← الترويسة الرسمية</b> ارفع صورة ترويسة الجهة مرة واحدة. تُطبع تلقائياً أعلى سندات صرف المعدات وتقريرها، وتقرير الوارد والصادر، وتدخل في النسخة الاحتياطية.</p>` },
  { icon:'fuel', t:'توزيع الوقود', b:`
    <p>الوحدة تشتغل بوحدات موحّدة: <b>الغاز بالكيلو</b> و<b>السولار باللتر</b>. لو استلمت أو صرفت اسطوانات، اختر «بالاسطوانات» واكتب عددها ووزن الاسطوانة، والنظام يحوّلها لكيلو ويعرض لك الناتج قبل الحفظ.</p>
    <ul><li><b>الوارد:</b> كل كمية تدخل المخزن. الرصيد = مجموع الوارد ناقص مجموع الموزع.</li>
    <li><b>التوزيع:</b> يظهر لك الرصيد المتاح داخل النموذج، ويُرفض أي صرف أكبر منه. بعد الحفظ يظهر زر «طباعة السند».</li>
    <li><b>لوحة التحكم:</b> أرصدة الغاز والسولار، مخطط بياني (شهري / حسب الجهة / وارد مقابل موزع)، وملخص شهري بنسبة التغيّر.</li>
    <li><b>حسب الجهة:</b> إجمالي ما استلمته كل جهة، ومنها تطبع كشف حساب للجهة.</li></ul>
    <p>لا يمكن حذف كمية واردة إذا كان حذفها يخلي الرصيد سالباً — احذف عمليات التوزيع المرتبطة أولاً. أرقام السندات لا تتكرر بعد الحذف.</p>
    <p>فلتر الشهر والنوع والجهة أعلى الصفحة ينعكس على الجداول والتقارير والتصدير.</p>
    <p><b>تقرير Word:</b> زر «تقرير Word» في تبويب التوزيع ينزّل ملف <b>.docx</b> لشهر تختاره، فيه جدولان منسّقان فقط: الأول وارد وموزع الغاز والسولار بوحداتهما، والثاني التوزيع حسب الجهة بصف إجمالي، وتحتهما خانات التواقيع. الملف يفتح بـWord وبإمكانك تعديله.</p>
    <p><b>التقارير:</b> في تبويب التوزيع زران. «تقرير شامل» يطبع كل ما يطابق الفلتر الحالي مع ملخص لكل الشهور. و«تقرير شهري» يفتح قائمة الشهور — تختار شهراً واحداً فيخرج تقرير لحركة ذاك الشهر وحده، لا يدمج أي شهر سابق ولا يتأثر بالفلتر. أقسامه: ملخص الشهر، الحركة اليومية، التوزيع حسب الجهة، الوارد حسب المصدر، ثم تفاصيل الوارد والتوزيع وخانات التواقيع.</p>` },
  { icon:'inventory', t:'مخزون الطعام', b:`
    <p>هذه الوحدة للأصناف الاستهلاكية (بطانيات، فرشات، مواد غذائية، قرطاسية)، وتعمل بنفس منطق مخزون المعدات تماماً.</p>
    <ul><li><b>الإضافة:</b> كل كمية تدخل المخزن بتاريخها ووحدتها والمورد.</li>
    <li><b>الصرف:</b> تختار الصنف من القائمة فيظهر الرصيد المتاح، ويُرفض أي صرف أكبر منه. الجهة إلزامية.</li>
    <li><b>المخزون:</b> الرصيد لكل صنف مع حالته (متوفر / منخفض / نافد)، ومخطط بياني وفلتر حسب الحالة.</li></ul>
    <p>حدّد صفوفاً من الجدول ثم اضغط «طباعة سند للمحدد» لسند رسمي بالترويسة. الحد المنخفض هو ٥٠ وحدة.</p>
    <p><b>سندات الإدخال:</b> في تبويب الإضافة صار لكل سطر زر 🖨 يطبع سند إدخال يجمع كل ما أُضيف من نفس المورد بنفس التاريخ، بإجمالي الكميات ونص إقرار وتوقيعي المورّد وأمين المخزن. وفيه تحديد متعدد و«طباعة سند للمحدد» — إذا اختلف الموردون يخرج سند مستقل لكل مورد.</p>
    <p><b>الصرف بالكرتونة أو بالحبة:</b> لكل صنف تقدر تعرّف تعبئة مثل «١ كرتونة = ٢٧ حبة» — إما من نموذج الإضافة (اختر وحدة «كرتونة» فيظهر حقل «كم حبة في الكرتونة؟» والوحدة الصغرى)، أو من زر 📦 بجانب الصنف في تبويب المخزون. بعدها:</p>
    <ul><li>الرصيد يُحسب داخلياً بالوحدة الصغرى: ٥ كراتين = ١٣٥ حبة، ويظهر «٢ كرتونة + ٢٢ حبة (٧٦ حبة)».</li>
    <li>في الصرف تختار «وحدة الصرف»: صرف ٢ كرتونة يخصم ٥٤ حبة، وصرف ٥ حبات يخصم ٥ — وتظهر تحت الحقل النتيجة قبل التنفيذ.</li>
    <li><b>كراتين وحبات فرط معاً:</b> لما تختار «كرتونة» يظهر حقل «فرط بالحبة». استلمت كرتونة فيها ٢٠ ومعها ١٠ حبات لحالها؟ اكتب الكمية ١ وعدد الحبات في الكرتونة ٢٠ والفرط ١٠ ← تدخل ٣٠ حبة بسطر واحد. وفي الصرف نفس الشي: ٢ كرتونة + ٥ حبات بسند واحد.</li>
    <li>أي صرف أكبر من الرصيد يُرفض مهما كانت الوحدة.</li>
    <li>السجلات القديمة للصنف بالكرتونة والعلبة تنضم لرصيد واحد. إذا طلع الرصيد سالباً بعد التوحيد ينبهك التطبيق — غالباً سجل قديم مكتوب «كرتونة» وكميته بالحبات.</li>
    <li>كل سجل بالكرتونة يحفظ عددها وقت تسجيله، فلو تغيّرت التعبئة لاحقاً (مثلاً ٢٤ بدل ٢٧) لا تتغيّر الحسابات القديمة.</li></ul>
    <p><b>التقرير المفصل:</b> زر «تقرير مفصل» أعلى الوحدة يفتح قائمة بالأشهر التي فيها حركة (مع عدد الإضافات والصرف في كل شهر). اختر شهراً أو أكثر — أو اترك الاختيار فارغاً لكل الفترات — فيخرج تقرير بالترويسة فيه: الملخص التنفيذي، الملخص الشهري، حركة الأصناف مع الرصيد الحالي وحالته، الصرف حسب الجهة، الوارد حسب المورد، ثم تفاصيل الإضافات والصرف وخانات التواقيع.</p>` },
  { icon:'cleaning', t:'توزيع المنظفات', b:`
    <p>للمواد والمعقمات (كلور، صابون، ديتول، أكياس). تعمل بنفس منطق مخزون المعدات ومخزون الطعام تماماً.</p>
    <ul><li><b>الإضافة:</b> كل كمية تدخل بتاريخها ووحدتها والمورد.</li>
    <li><b>الصرف:</b> تختار الصنف فيظهر الرصيد المتاح، ويُرفض أي صرف أكبر منه. الجهة إلزامية.</li>
    <li><b>المخزون:</b> رصيد كل صنف وحالته، مع مخطط بياني وفلتر حسب الحالة.</li></ul>
    <p>الوحدة تبدأ فارغة. لو عندك بيانات في تطبيق المنظفات المستقل، استوردها من «استيراد بيانات قديمة».</p>` },
  { icon:'custody', t:'إدارة العهد', b:`
    <p>العهدة غير المخزون: <b>تُسلَّم لشخص وتُسترجع منه</b>. لذلك الصادر هنا ليس نهائياً — كل إرجاع يعيد الكمية للمتاح تلقائياً.</p>
    <ul><li><b>إضافة عهدة:</b> الأصناف الداخلة للمخزن، مع الرقم التسلسلي وحالة الصنف (جديد / مستعمل).</li>
    <li><b>تسليم:</b> المستلم هنا <b>شخص</b> باسمه ورقمه الوظيفي وقسمه. يظهر لك المتاح قبل التسليم، ويُرفض أي تسليم أكبر منه.</li>
    <li><b>إرجاع:</b> تختار من قائمة «الشخص — الصنف — بحوزته كذا»، وتحدد حالة الصنف عند الإرجاع (سليم / يحتاج صيانة / تالف). لا يمكن إرجاع أكثر مما بحوزته.</li>
    <li><b>لوحة العهد:</b> الوارد والمسلَّم حالياً والمتاح لكل صنف، مع مخطط بياني. الحد المنخفض هنا <b>٥</b> فقط.</li>
    <li><b>كشف الأشخاص:</b> بطاقة لكل شخص فيها بنوده وشارة «لديه عهد / لا يوجد عهد قائم»، ومنها تطبع كشف عهدته أو تسجّل إرجاعاً مباشرة.</li></ul>
    <p><b>سند الاستلام المجمّع:</b> علّم عدة سطور من جدول التسليمات ثم «طباعة سند للمحدد» — يُجمَّع السند حسب الشخص (صفحة لكل شخص) بالترويسة الرسمية ونص الإقرار والتوقيعين.</p>
    <p>لا يمكن حذف إضافة إذا صار المتاح سالباً، ولا حذف تسليم له إرجاعات مسجّلة — احذف الإرجاعات أولاً. الفلتر أعلى الصفحة فيه حقل شخص إضافة للصنف والمدى الزمني.</p>` },
  { icon:'sun', t:'المظهر والاهتزاز', b:`
    <p>زر 🌙/☀️ بالأعلى يبدّل بين الفاتح والداكن، ويُحفظ اختيارك. الاهتزاز الخفيف عند اللمس يمكن إيقافه من الإعدادات.</p>` },
  { icon:'chart', t:'الوحدات السبعة', b:`
    <ul>${MODULE_ORDER.map(id => `<li><b>${MODULE_META[id].name}:</b> ${MODULE_META[id].desc}.</li>`).join('')}</ul>
    <p>الوحدات التي عليها «قيد الدمج» تُستخدم حالياً من ملفاتها المستقلة، وبياناتها تدخل في النسخة الاحتياطية.</p>` },
  { icon:'question', t:'أسئلة شائعة', b:`
    <p><b>أين تُحفظ بياناتي؟</b> على هذا الجهاز وداخل هذا المتصفح فقط. لا تُرسل لأي خادم.</p>
    <p><b>ماذا لو مسحت بيانات المتصفح؟</b> تُحذف البيانات، ولا ترجع إلا من نسخة احتياطية. لهذا انزل نسخة دورياً.</p>
    <p><b>هل أقدر أنقل بياناتي لجهاز آخر؟</b> نعم: انزل نسخة من الجهاز الأول، ثم استعدها على الثاني.</p>
    <p><b>كيف أعرف رقم الإصدار؟</b> أسفل القائمة الجانبية، أو الإعدادات ← حول التطبيق.</p>
    <p><b>اختصارات لوحة المفاتيح:</b> <span class="kbd">Esc</span> يغلق أي نافذة أو القائمة.</p>` }
];
function renderGuide(){
  const el = $('#page-guide');
  if (el.dataset.ready) return;
  el.dataset.ready = '1';
  el.innerHTML = `
    <div class="page-head" style="--tint:rgba(234,179,8,.2)"><div class="tile">${ico('guide')}</div>
      <div><h2>دليل المستخدم</h2><p class="num">كل ما تحتاجه لاستخدام التطبيق — الإصدار ${fmtVersion(APP_VERSION)}</p></div></div>
    <label class="card guide-search">${LINE.search}<span class="sr-only">بحث في الدليل</span>
      <input type="search" id="guideQ" placeholder="ابحث في الدليل: نسخة، تثبيت، إشعارات…" autocomplete="off"></label>
    <div class="card guide" id="guideList">${GUIDE.map((g, i) => `<details ${i === 0 ? 'open' : ''}><summary>${ico(g.icon)}<span>${g.t}</span>${LINE.chev}</summary><div class="body">${g.b}</div></details>`).join('')}
    </div>
    <div class="empty card" id="guideEmpty" hidden style="margin-top:12px">${ico('search')}<div><b>لا نتائج</b><p>جرّب كلمة أخرى، مثل «نسخة» أو «تثبيت».</p></div></div>`;
  const q = $('#guideQ');
  q.addEventListener('input', () => {
    const v = q.value.trim(); let shown = 0;
    $$('#guideList details').forEach(d => {
      const hit = !v || d.textContent.includes(v);
      d.hidden = !hit; if (hit) shown++;
      if (v && hit) d.open = true;
    });
    $('#guideEmpty').hidden = shown > 0;
    $('#guideList').hidden = shown === 0;
  });
  $$('#guideList summary').forEach(s => s.addEventListener('click', () => vibrate(6)));
}
PAGE_RENDERERS.guide = renderGuide;

/* =====================================================================
   الاتصال بالإنترنت
   ===================================================================== */
function renderOnline(){
  const el = $('#onlineState'), on = navigator.onLine;
  el.classList.toggle('off', !on); el.querySelector('span').textContent = on ? 'متصل' : 'بدون إنترنت';
}
window.addEventListener('online',  () => { renderOnline(); notify.success('عاد الاتصال بالإنترنت', '', { log:false, duration:2500 }); });
window.addEventListener('offline', () => { renderOnline(); notify.warning('انقطع الاتصال بالإنترنت', 'التطبيق يواصل العمل، وبياناتك محفوظة على الجهاز.', { log:false }); });

/* =====================================================================
   التحديثات (Service Worker)
   ===================================================================== */
let swReg = null, updating = false;
function promptUpdate(worker){
  notify({ type:'info', title:'يتوفر إصدار جديد من التطبيق', msg:'اضغط «تحديث الآن» لتطبيقه. بياناتك لن تتأثر.', duration:0,
    action:{ label:'تحديث الآن', fn:() => { updating = true; worker.postMessage('SKIP_WAITING'); } } });
}
function registerSW(){
  if (!('serviceWorker' in navigator) || isFileProtocol()) return;
  navigator.serviceWorker.register('sw.js').then(reg => {
    swReg = reg;
    if (reg.waiting && navigator.serviceWorker.controller) promptUpdate(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing; if (!nw) return;
      nw.addEventListener('statechange', () => { if (nw.state === 'installed' && navigator.serviceWorker.controller) promptUpdate(nw); });
    });
  }).catch(e => console.warn('SW', e));
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (updating){ updating = false; location.reload(); } });
  navigator.serviceWorker.addEventListener('message', e => { if (e.data && e.data.type === 'NAVIGATE' && e.data.page) switchModule(e.data.page); });
}
async function checkForUpdate(){
  vibrate(8);
  if (!swReg){ return notify.info('التحديث التلقائي غير متاح هنا', 'يعمل عند فتح التطبيق من رابطه على الإنترنت أو بعد تثبيته.'); }
  if (!navigator.onLine){ return notify.warning('لا يوجد اتصال بالإنترنت', 'اتصل بالإنترنت ثم ابحث عن تحديث مرة أخرى.'); }
  try {
    await swReg.update();
    await sleep(900);
    if (swReg.waiting || swReg.installing) return; // سيظهر إشعار «يتوفر إصدار جديد»
    notify.success('أنت على آخر إصدار', 'الإصدار ' + fmtVersion(APP_VERSION), { log:false });
  } catch(e){ notify.error('تعذّر البحث عن تحديث', 'تحقق من الاتصال وأعد المحاولة.'); }
}

/* =====================================================================
   تسلسل التشغيل
   ===================================================================== */
async function hideSplash(){
  await sleep(850);
  const s = $('#splash'); s.classList.add('hide'); setTimeout(() => s.remove(), 400);
  await sleep(250);
}
function postStartupNotices(){
  // ١. نتيجة استعادة سابقة
  const ar = sessionStorage.getItem('unified_after_restore');
  if (ar){
    sessionStorage.removeItem('unified_after_restore');
    try { const r = JSON.parse(ar);
      notify({ type:'success', title:'تمت استعادة النسخة الاحتياطية', msg:`${n(r.count)} سجل${r.date ? ' — من نسخة ' + fmtDateTime(r.date) : ''}.`, duration:6000 }); } catch(e){}
  }
  // ٢. تحديث للإصدار
  if (S.lastSeenVersion && S.lastSeenVersion !== APP_VERSION){
    notify({ type:'success', title:'تم تحديث التطبيق إلى الإصدار ' + fmtVersion(APP_VERSION), msg:'اطّلع على التغييرات الجديدة.', action:{ label:'ما الجديد', fn:showChangelog }, duration:8000 });
  }
  S.lastSeenVersion = APP_VERSION; saveSettings();
  // ٣. تذكير النسخ الاحتياطي (مرة باليوم)
  const today = new Date().toDateString(), sys = NotificationRegistry.system();
  if (sys.length && S.lastReminderDay !== today){
    S.lastReminderDay = today; saveSettings();
    setTimeout(() => notify({ type:'warning', title:sys[0].title, msg:sys[0].subtitle + '.', page:'backup',
      action:{ label:'نسخ الآن', fn:() => { switchModule('backup'); exportBackup(); } } }), 700);
  }
}
async function runStartup(){
  await hideSplash();
  // رسالة التثبيت: مرة واحدة لكل فتح للتطبيق (لا تتكرر مع إعادة التحميل بنفس الجلسة)
  if (!isStandalone() && !S.installNever && !sessionStorage.getItem('unified_install_shown')){
    sessionStorage.setItem('unified_install_shown', '1');
    await waitFor(() => deferredPrompt, 1200);
    await showInstallSheet({ startup:true });
  }
  if (!S.onboarded) await showWelcome();
  postStartupNotices();
}

function initShell(){
  $('#splashVer').textContent = 'الإصدار ' + fmtVersion(APP_VERSION);
  $('#verChip').textContent = 'الإصدار ' + fmtVersion(APP_VERSION);
  $('#verChip').title = 'ما الجديد';
  loadTheme(); applyLayout(); renderNav(); renderOnline(); renderDate();
  // تهيئة الوحدات المدموجة (كل وحدة تضيف init هنا عند دمجها، مثل: EQ.init())
  window.MODULE_INITS && window.MODULE_INITS.forEach(fn => { try { fn(); } catch(e){ console.error(e); } });
  const start = location.hash.slice(1);
  try { history.replaceState({ page: validPage(start) ? start : 'home' }, '', '#' + (validPage(start) ? start : 'home')); } catch(e){}
  switchModule(validPage(start) ? start : 'home', { push:false, silent:true });
  document.addEventListener('visibilitychange', () => { if (!document.hidden){ renderDate(); if (currentPage === 'home') renderHome(); } });
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  registerSW();
  runStartup();
}

/* واجهة عامة للوحدات المدموجة */
/* ضغط الصور: يعيد dataURL بصيغة JPEG بحد أقصى للأبعاد */
function compressImage(src, maxDim = 1800, quality = 0.82){
  return new Promise((resolve, reject) => {
    const go = url => { const img = new Image(); img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * scale); c.height = Math.round(img.naturalHeight * scale);
        const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', quality)); }; img.onerror = reject; img.src = url; };
    if (typeof src === 'string') return go(src);
    const r = new FileReader(); r.onload = e => go(e.target.result); r.onerror = reject; r.readAsDataURL(src);
  });
}
/* الترويسة الرسمية المشتركة */
function letterhead(){ try { return localStorage.getItem('unified_letterhead') || ''; } catch(e){ return ''; } }
function letterheadHTML(){ const d = letterhead(); return d ? `<div style="text-align:center;margin-bottom:12px"><img src="${d}" alt="" style="max-width:100%;max-height:150px;object-fit:contain"></div>` : ''; }
async function uploadLetterhead(ev){
  const f = ev.target.files[0]; ev.target.value = ''; if (!f) return;
  if (!f.type.startsWith('image/')) return notify.error('الملف ليس صورة', 'اختر صورة الترويسة بصيغة JPG أو PNG.');
  try {
    const data = await compressImage(f, 1600, 0.85);
    const had = !!letterhead();
    localStorage.setItem('unified_letterhead', data);
    renderSettings();
    notify.success(had ? 'تم تغيير الترويسة الرسمية' : 'تم حفظ الترويسة الرسمية', 'تظهر الآن أعلى سندات المعدات وتقرير الوارد والصادر، وتدخل في النسخة الاحتياطية.');
  } catch(e){ notify.error('تعذّر حفظ الترويسة', e.name === 'QuotaExceededError' ? 'مساحة التخزين ممتلئة.' : 'جرّب صورة أخرى.'); }
}
async function removeLetterhead(){
  if (!await confirmDialog({ title:'إزالة الترويسة الرسمية؟', msg:'تُطبع المستندات بعدها بدون ترويسة. تقدر ترفعها من جديد في أي وقت.', okText:'إزالة', danger:true })) return;
  const prev = letterhead(); localStorage.removeItem('unified_letterhead'); renderSettings();
  notify({ type:'success', title:'تمت إزالة الترويسة', action:{ label:'تراجع', fn:() => { localStorage.setItem('unified_letterhead', prev); renderSettings(); } } });
}
/* ---------- مولّد مستندات Word (.docx) — OOXML حقيقي بلا مكتبات خارجية ---------- */
function wxEsc(t){ return String(t == null ? '' : t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,''); }
/* فقرة: سطور متعددة مفصولة بـ\n داخل نفس الفقرة */
function wxPara(text, o){
  const op = o || {};
  const sz = op.size || 22, align = op.align || 'right';
  const runs = String(text == null ? '' : text).split('\n').map((ln, i) =>
    `${i ? '<w:r><w:br/></w:r>' : ''}<w:r><w:rPr><w:rtl/>${op.bold ? '<w:b/><w:bCs/>' : ''}${op.color ? `<w:color w:val="${op.color}"/>` : ''}<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr><w:t xml:space="preserve">${wxEsc(ln)}</w:t></w:r>`).join('');
  return `<w:p><w:pPr><w:bidi/><w:jc w:val="${align}"/>${op.space ? `<w:spacing w:before="${op.space}" w:after="${Math.round(op.space/2)}"/>` : '<w:spacing w:after="80"/>'}${op.shd ? `<w:shd w:val="clear" w:fill="${op.shd}"/>` : ''}</w:pPr>${runs}</w:p>`;
}
function wxCell(text, o){
  const op = o || {};
  const w = op.w ? `<w:tcW w:w="${op.w}" w:type="pct"/>` : '';
  return `<w:tc><w:tcPr>${w}${op.shd ? `<w:shd w:val="clear" w:color="auto" w:fill="${op.shd}"/>` : ''}<w:vAlign w:val="center"/></w:tcPr>${wxPara(text, { bold:op.bold, color:op.color, size:op.size || 20, align:op.align || 'center' })}</w:tc>`;
}
/* جدول: head مصفوفة عناوين، rows مصفوفة صفوف، widths نِسب مئوية ×50 (مجموعها 5000) */
function wxTable(head, rows, widths){
  const n = (head && head.length) || (rows[0] || []).length;
  const ws = widths && widths.length === n ? widths : new Array(n).fill(Math.round(5000 / n));
  const borders = `<w:tblBorders>${['top','left','bottom','right','insideH','insideV'].map(b => `<w:${b} w:val="single" w:sz="6" w:space="0" w:color="B9C6C0"/>`).join('')}</w:tblBorders>`;
  const headRow = head && head.length ? `<w:tr><w:trPr><w:tblHeader/></w:trPr>${head.map((h, i) => wxCell(h, { bold:true, shd:'1B3B2F', color:'FFFFFF', w:ws[i] })).join('')}</w:tr>` : '';
  const body = rows.map((r, ri) => `<w:tr>${r.map((c, i) => wxCell(c, { w:ws[i], shd: ri % 2 ? 'F4F6F5' : null, bold: r.__bold })).join('')}</w:tr>`).join('');
  return `<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:bidiVisual/><w:tblW w:w="5000" w:type="pct"/>${borders}<w:tblCellMar><w:top w:w="60" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr>
    <w:tblGrid>${ws.map(w => `<w:gridCol w:w="${Math.round(9000 * w / 5000)}"/>`).join('')}</w:tblGrid>${headRow}${body}</w:tbl><w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>`;
}
/* blocks: {type:'h1'|'h2'|'p'|'note'|'table'|'space', ...} */
function buildDocx(blocks){
  const body = (blocks || []).map(b => {
    if(!b) return '';
    if(b.type === 'h1') return wxPara(b.text, { bold:true, size:32, align:'center', space:160 });
    if(b.type === 'h2') return wxPara(b.text, { bold:true, size:26, color:'1B3B2F', space:220 });
    if(b.type === 'note') return wxPara(b.text, { size:18, align:'center', color:'44544C' });
    if(b.type === 'p') return wxPara(b.text, { size:b.size || 22, align:b.align || 'right', bold:b.bold });
    if(b.type === 'space') return '<w:p><w:pPr><w:spacing w:after="240"/></w:pPr></w:p>';
    if(b.type === 'table') return wxTable(b.head, b.rows, b.widths);
    return '';
  }).join('');
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}
<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="900" w:right="900" w:bottom="900" w:left="900" w:header="440" w:footer="440" w:gutter="0"/><w:bidi/></w:sectPr></w:body></w:document>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:bidi="ar-SA"/></w:rPr></w:rPrDefault>
<w:pPrDefault><w:pPr><w:bidi/><w:jc w:val="right"/><w:spacing w:after="80" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/></w:style></w:styles>`;
  const ct = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
  const docRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
  const e = new TextEncoder();
  return XLSX.zip([
    { name:'[Content_Types].xml', data:e.encode(ct) },
    { name:'_rels/.rels', data:e.encode(rels) },
    { name:'word/_rels/document.xml.rels', data:e.encode(docRels) },
    { name:'word/document.xml', data:e.encode(doc) },
    { name:'word/styles.xml', data:e.encode(styles) }
  ]);
}
/* ينزّل مستند Word جاهزاً — يرجع true عند النجاح */
function exportWord(fileName, blocks){
  try{
    if(typeof XLSX === 'undefined' || !XLSX.zip) throw new Error('مولّد الملفات غير متاح');
    const bytes = buildDocx(blocks);
    const blob = new Blob([bytes], { type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = /\.docx$/i.test(fileName) ? fileName : fileName + '.docx';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return true;
  }catch(e){
    notify({ type:'error', title:'تعذّر إنشاء ملف Word', msg:e.message || 'حاول مرة أخرى.', log:false });
    return false;
  }
}

window.App = { version:APP_VERSION, notify, confirm:confirmDialog, sheet:openOverlay, compressImage, letterhead, letterheadHTML, switchModule, vibrate, refresh:refreshAfterData, exportBackup, importExcel, exportWord };

initShell();
