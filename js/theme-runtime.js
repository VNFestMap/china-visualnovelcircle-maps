(function (global) {
  'use strict';

  var STORAGE_KEY = 'themePreference';
  var LEGACY_KEYS = ['vnfest-theme', 'galonly-theme'];
  var VALID_PREFERENCES = { light: true, dark: true, system: true };
  var subscribers = [];
  var mediaQuery = null;

  function safeLocalStorage(method, key, value) {
    try {
      if (!global.localStorage) return null;
      if (method === 'get') return global.localStorage.getItem(key);
      if (method === 'set') global.localStorage.setItem(key, value);
      if (method === 'remove') global.localStorage.removeItem(key);
    } catch (error) {}
    return null;
  }

  function getMediaQuery() {
    if (mediaQuery) return mediaQuery;
    try {
      mediaQuery = global.matchMedia ? global.matchMedia('(prefers-color-scheme: dark)') : null;
    } catch (error) {
      mediaQuery = null;
    }
    return mediaQuery;
  }

  function normalizePreference(value) {
    return VALID_PREFERENCES[value] ? value : null;
  }

  function readPreference() {
    var saved = normalizePreference(safeLocalStorage('get', STORAGE_KEY));
    if (saved) return saved;

    for (var i = 0; i < LEGACY_KEYS.length; i += 1) {
      var legacy = normalizePreference(safeLocalStorage('get', LEGACY_KEYS[i]));
      if (legacy && legacy !== 'system') {
        safeLocalStorage('set', STORAGE_KEY, legacy);
        return legacy;
      }
    }

    return 'system';
  }

  function resolveTheme(preference) {
    var pref = normalizePreference(preference) || readPreference();
    if (pref === 'light' || pref === 'dark') return pref;
    var mq = getMediaQuery();
    return mq && mq.matches ? 'dark' : 'light';
  }

  function applyTheme(preference) {
    var pref = normalizePreference(preference) || readPreference();
    var theme = resolveTheme(pref);
    var root = document.documentElement;

    root.setAttribute('data-theme', theme);
    root.setAttribute('data-theme-preference', pref);
    root.style.colorScheme = theme;

    var themeColor = theme === 'dark' ? '#140913' : '#9b59b6';
    document.querySelectorAll('meta[name="theme-color"]:not([media])').forEach(function (meta) {
      meta.setAttribute('content', themeColor);
    });

    var detail = { preference: pref, theme: theme };
    subscribers.slice().forEach(function (callback) {
      try { callback(detail); } catch (error) {}
    });
    try {
      global.dispatchEvent(new CustomEvent('vn-theme-change', { detail: detail }));
    } catch (error) {}
    return detail;
  }

  function setPreference(preference) {
    var pref = normalizePreference(preference) || 'system';
    safeLocalStorage('set', STORAGE_KEY, pref);
    return applyTheme(pref);
  }

  function subscribe(callback) {
    if (typeof callback !== 'function') return function () {};
    subscribers.push(callback);
    callback({ preference: readPreference(), theme: resolveTheme(readPreference()) });
    return function () {
      subscribers = subscribers.filter(function (item) { return item !== callback; });
    };
  }

  function toggle() {
    return setPreference(resolveTheme(readPreference()) === 'dark' ? 'light' : 'dark');
  }

  function handleSystemChange() {
    if (readPreference() === 'system') applyTheme('system');
  }

  var api = {
    applyEarly: applyTheme,
    apply: applyTheme,
    getPreference: readPreference,
    setPreference: setPreference,
    getEffectiveTheme: function () { return resolveTheme(readPreference()); },
    subscribe: subscribe,
    toggle: toggle
  };

  global.VNFTheme = api;
  applyTheme(readPreference());

  var mq = getMediaQuery();
  if (mq) {
    if (typeof mq.addEventListener === 'function') mq.addEventListener('change', handleSystemChange);
    else if (typeof mq.addListener === 'function') mq.addListener(handleSystemChange);
  }
})(window);
