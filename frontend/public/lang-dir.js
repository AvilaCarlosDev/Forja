// Set direction before first paint so an Arabic profile never flashes as LTR.
// The app re-applies this on every language change (lib/i18n.js setLang).
// i18n-core RTL_LANGS is the runtime source of truth — keep this list in sync.
try {
  var s = JSON.parse(localStorage.getItem('gym_state_v1') || '{}');
  var l = s.lang || ((navigator.language || '').slice(0, 2) === 'ar' ? 'ar' : 'en');
  document.documentElement.lang = l;
  document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr';
} catch (e) {}
