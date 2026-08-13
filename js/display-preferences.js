(function (global) {
  'use strict';

  var STORAGE_KEY = 'vnfestMapInvertControls';
  var subscribers = [];

  function readStorage() {
    try {
      var saved = global.localStorage.getItem(STORAGE_KEY);
      if (saved === '0') return false;
      if (saved === '1') return true;
    } catch (error) {}
    return true;
  }

  function notify(value) {
    subscribers.slice().forEach(function (callback) {
      try { callback(value); } catch (error) {}
    });
    try {
      global.dispatchEvent(new CustomEvent('vn-display-preference-change', {
        detail: { mapInvert: value }
      }));
    } catch (error) {}
  }

  function setMapInvert(enabled) {
    var value = enabled !== false;
    try { global.localStorage.setItem(STORAGE_KEY, value ? '1' : '0'); } catch (error) {}
    notify(value);
    return value;
  }

  function subscribe(callback) {
    if (typeof callback !== 'function') return function () {};
    subscribers.push(callback);
    callback(readStorage());
    return function () {
      subscribers = subscribers.filter(function (item) { return item !== callback; });
    };
  }

  global.VNFDisplayPreferences = {
    storageKey: STORAGE_KEY,
    getMapInvert: readStorage,
    setMapInvert: setMapInvert,
    subscribe: subscribe
  };

  if (typeof global.addEventListener === 'function') {
    global.addEventListener('storage', function (event) {
      if (event.key === STORAGE_KEY) notify(readStorage());
    });
  }
})(window);
