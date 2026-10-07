/* تطبيق الثيم والعرض قبل الرسم لتجنّب الوميض */
(function(){try{
  var t=localStorage.getItem('unified_theme')||'light';
  document.documentElement.setAttribute('data-theme',t);
  var l=localStorage.getItem('unified_layout')||'auto';
  var eff=l==='auto'?(window.innerWidth<=880?'mobile':'desktop'):l;
  document.documentElement.setAttribute('data-layout',eff);
  document.documentElement.setAttribute('data-layout-pref',l);
}catch(e){}})();
