// WebGen Gambia — Currency helper
// Source-of-truth currency = GMD. Other currencies are display-conversions only.
// Customer can pick their display currency; orders, totals, kassa data all stay in GMD.
//
// Usage:
//   <script src="currency.js"></script>
//   Currency.init({ default: 'GMD' });
//   Currency.format(450, 'GMD')         → "GMD 450"
//   Currency.format(450, 'GMD', 'EUR')  → "€ 6"   (uses preferred display)
//
// To update rates: Currency.setRates({ EUR: 0.0133, USD: 0.0145, GBP: 0.0114 });
// (Default values are hard-coded; in production you'd refresh from an FX API.)
(function (global) {
  const KEY = 'wg_display_currency';
  const RATES_KEY = 'wg_fx_rates';
  const DEFAULTS = {
    base: 'GMD',
    rates: { GMD: 1, EUR: 0.0133, USD: 0.0145, GBP: 0.0114 },
    symbols: { GMD: 'GMD', EUR: '€', USD: '$', GBP: '£' },
    flags:   { GMD: '🇬🇲', EUR: '🇪🇺', USD: '🇺🇸', GBP: '🇬🇧' }
  };
  let RATES = { ...DEFAULTS.rates };
  try { Object.assign(RATES, JSON.parse(localStorage.getItem(RATES_KEY) || '{}')); } catch(e) {}
  let CURRENT = localStorage.getItem(KEY) || null;
  const listeners = new Set();

  function setRates(obj) { RATES = { ...RATES, ...obj }; localStorage.setItem(RATES_KEY, JSON.stringify(RATES)); }
  function getRates() { return { ...RATES }; }

  function convert(amount, from, to) {
    from = from || 'GMD'; to = to || from;
    if (from === to) return amount;
    // amount in `from` → GMD → `to`
    const inGmd = amount / (RATES[from] || 1);
    return inGmd * (RATES[to] || 1);
  }

  function format(amount, sourceCurrency, displayOverride) {
    const src = sourceCurrency || 'GMD';
    const target = displayOverride || CURRENT || src;
    const num = Number(amount);
    if (!Number.isFinite(num)) return src + ' 0';
    const converted = convert(num, src, target);
    const symbol = DEFAULTS.symbols[target] || target;
    // Round small currencies to nearest 0.50, GMD/UGX-style integers
    const rounded = (target === 'GMD') ? Math.round(converted)
                  : (target === 'EUR' || target === 'USD' || target === 'GBP') ? (Math.round(converted * 2) / 2)
                  : Math.round(converted * 100) / 100;
    return symbol + ' ' + rounded.toLocaleString(navigator.language || 'nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  function setCurrency(code) {
    if (!RATES[code]) return;
    CURRENT = code;
    localStorage.setItem(KEY, code);
    listeners.forEach(fn => { try { fn(code); } catch(e) {} });
    updateToggleUi();
  }

  function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

  function ensureToggle(opts) {
    if (document.querySelector('.wg-cur-toggle') || document.querySelector('[data-cur-toggle]')) return;
    const btn = document.createElement('button');
    btn.className = 'wg-cur-toggle';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Currency / Valuta');
    // Position it next to the language toggle (top-left, but offset right)
    btn.style.cssText = 'position:fixed;top:14px;left:84px;z-index:10000;background:rgba(0,200,150,0.14);color:#00c896;border:1px solid rgba(0,200,150,0.35);padding:7px 12px;border-radius:999px;font-family:system-ui,-apple-system,sans-serif;font-size:12px;font-weight:700;letter-spacing:.06em;cursor:pointer;backdrop-filter:blur(6px);box-shadow:0 4px 14px rgba(0,0,0,0.25)';
    btn.addEventListener('click', () => {
      const cycle = ['GMD', 'EUR', 'USD', 'GBP'];
      const next = cycle[(cycle.indexOf(CURRENT || 'GMD') + 1) % cycle.length];
      setCurrency(next);
    });
    document.body.appendChild(btn);
    document.querySelectorAll('[data-cur-toggle]').forEach(el => el.addEventListener('click', () => {
      const cycle = ['GMD', 'EUR', 'USD', 'GBP'];
      setCurrency(cycle[(cycle.indexOf(CURRENT || 'GMD') + 1) % cycle.length]);
    }));
  }

  function updateToggleUi() {
    const cur = CURRENT || 'GMD';
    document.querySelectorAll('.wg-cur-toggle, [data-cur-toggle]').forEach(el => {
      el.textContent = (DEFAULTS.flags[cur] || '') + ' ' + cur;
    });
  }

  function init(opts) {
    opts = opts || {};
    if (!CURRENT) CURRENT = opts.default || 'GMD';
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', onReady);
    else onReady();
    function onReady() {
      ensureToggle(opts);
      updateToggleUi();
    }
  }

  global.Currency = { init, format, convert, setCurrency, setRates, getRates, onChange,
    get current(){ return CURRENT || 'GMD'; }, get base(){ return DEFAULTS.base; },
    get symbols(){ return {...DEFAULTS.symbols}; }, get flags(){ return {...DEFAULTS.flags}; }
  };
})(window);
