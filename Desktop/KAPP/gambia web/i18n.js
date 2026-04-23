// WebGen Gambia — shared i18n helper
// Usage:
//   <script src="i18n.js"></script>
//   <script>
//     I18n.init({ translations: { nl: {key:'tekst'}, en: {key:'text'} }, default: 'nl' });
//   </script>
// Then mark up text with data-i18n="key" or call I18n.t('key').
// A tiny floating <button class="lang-toggle"> is auto-injected unless you add your own with data-i18n-toggle.
(function (global) {
  const KEY = 'wg_lang';
  const BROWSER_DEFAULT = (navigator.language || 'nl').slice(0, 2).toLowerCase();
  let DICT = { nl: {}, en: {} };
  let CURRENT = localStorage.getItem(KEY) || null;
  const listeners = new Set();

  function t(key, vars) {
    const lang = CURRENT || 'nl';
    let s = (DICT[lang] && DICT[lang][key]) || (DICT.en && DICT.en[key]) || (DICT.nl && DICT.nl[key]) || key;
    if (vars && typeof s === 'string') {
      for (const [k, v] of Object.entries(vars)) s = s.replace(new RegExp('\\{' + k + '\\}', 'g'), v);
    }
    return s;
  }

  function applyToDom(root) {
    root = root || document;
    root.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.dataset.i18n;
      if (!key) return;
      const val = t(key);
      // If element has [data-i18n-attr], set that attribute; otherwise textContent
      const attr = el.dataset.i18nAttr;
      if (attr) el.setAttribute(attr, val);
      else el.textContent = val;
    });
    // Placeholders
    root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      el.setAttribute('placeholder', t(el.dataset.i18nPlaceholder));
    });
    // Titles (tooltip)
    root.querySelectorAll('[data-i18n-title]').forEach(el => {
      el.setAttribute('title', t(el.dataset.i18nTitle));
    });
    // Aria-labels
    root.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
      el.setAttribute('aria-label', t(el.dataset.i18nAriaLabel));
    });
  }

  function switchLang(lang) {
    if (!DICT[lang]) return;
    CURRENT = lang;
    localStorage.setItem(KEY, lang);
    document.documentElement.lang = lang;
    applyToDom();
    listeners.forEach(fn => { try { fn(lang); } catch (e) {} });
    updateToggleUi();
  }

  function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

  function ensureToggle() {
    if (document.querySelector('.wg-lang-toggle') || document.querySelector('[data-i18n-toggle]')) return;
    const btn = document.createElement('button');
    btn.className = 'wg-lang-toggle';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Taal / Language');
    btn.style.cssText = 'position:fixed;top:14px;left:14px;z-index:10000;background:rgba(0,200,150,0.14);color:#00c896;border:1px solid rgba(0,200,150,0.35);padding:7px 12px;border-radius:999px;font-family:system-ui,-apple-system,sans-serif;font-size:12px;font-weight:700;letter-spacing:.12em;cursor:pointer;backdrop-filter:blur(6px);text-transform:uppercase;box-shadow:0 4px 14px rgba(0,0,0,0.25)';
    btn.addEventListener('click', () => switchLang(CURRENT === 'nl' ? 'en' : 'nl'));
    document.body.appendChild(btn);
    document.querySelectorAll('[data-i18n-toggle]').forEach(el => el.addEventListener('click', () => switchLang(CURRENT === 'nl' ? 'en' : 'nl')));
  }

  function updateToggleUi() {
    const label = CURRENT === 'nl' ? '🇬🇧 EN' : '🇳🇱 NL';
    document.querySelectorAll('.wg-lang-toggle, [data-i18n-toggle]').forEach(el => { el.textContent = label; });
  }

  function init(opts) {
    DICT = opts.translations || DICT;
    if (!CURRENT) CURRENT = (DICT[BROWSER_DEFAULT] ? BROWSER_DEFAULT : (opts.default || 'nl'));
    document.documentElement.lang = CURRENT;
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', onReady);
    else onReady();
    function onReady() {
      applyToDom();
      ensureToggle();
      updateToggleUi();
    }
  }

  global.I18n = { init, t, switchLang, onChange, get lang() { return CURRENT; }, applyToDom };
})(window);
