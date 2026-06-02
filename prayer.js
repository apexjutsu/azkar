/* ── Prayer Times — Muslim World League (Fajr 18°, Isha 17°) ── */

const LOCATION_KEY = 'azkar_location';
const PRAYER_ORDER = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
const PRAYER_LABELS = {
  fajr: ['фаджр', 'фаджра'],
  sunrise: ['восход', 'восхода'],
  dhuhr: ['зухр', 'зухра'],
  asr: ['аср', 'асра'],
  maghrib: ['магриб', 'магриба'],
  isha: ['иша', 'иши']
};

let cachedTimes = null;
let cachedTimesDate = null;

function calcPrayerTimes(date, lat, lng) {
  var RAD = Math.PI / 180, DEG = 180 / Math.PI;

  /* ── NOAA Solar Position (Jean Meeus) ── */
  var y = date.getFullYear(), mo = date.getMonth() + 1, d = date.getDate();
  if (mo <= 2) { y--; mo += 12; }
  var A = Math.floor(y / 100);
  var JD = Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (mo + 1)) + d + (2 - A + Math.floor(A / 4)) - 1524.5;
  var T = (JD - 2451545) / 36525;

  var L0 = (280.46646 + T * (36000.76983 + 0.0003032 * T)) % 360;
  if (L0 < 0) L0 += 360;
  var M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  var Mr = M * RAD;
  var e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);

  var C = Math.sin(Mr) * (1.914602 - T * (0.004817 + 0.000014 * T))
        + Math.sin(2 * Mr) * (0.019993 - 0.000101 * T)
        + Math.sin(3 * Mr) * 0.000289;

  var omega = 125.04 - 1934.136 * T;
  var lambda = L0 + C - 0.00569 - 0.00478 * Math.sin(omega * RAD);

  var obliq0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
  var obliq = obliq0 + 0.00256 * Math.cos(omega * RAD);

  var decl = Math.asin(Math.sin(obliq * RAD) * Math.sin(lambda * RAD)) * DEG;

  var y2 = Math.pow(Math.tan(obliq * RAD / 2), 2);
  var eqt = 4 * DEG * (
    y2 * Math.sin(2 * L0 * RAD)
    - 2 * e * Math.sin(Mr)
    + 4 * e * y2 * Math.sin(Mr) * Math.cos(2 * L0 * RAD)
    - 0.5 * y2 * y2 * Math.sin(4 * L0 * RAD)
    - 1.25 * e * e * Math.sin(2 * Mr)
  ); // minutes

  /* ── Prayer time calculation ── */
  var tz = -date.getTimezoneOffset() / 60;
  var noon = 720 - 4 * lng - eqt + tz * 60; // minutes from midnight

  function ha(alt) {
    var cosH = (Math.sin(alt * RAD) - Math.sin(lat * RAD) * Math.sin(decl * RAD))
             / (Math.cos(lat * RAD) * Math.cos(decl * RAD));
    return (cosH > 1 || cosH < -1) ? NaN : Math.acos(cosH) * DEG;
  }

  var haSun = ha(-0.833);
  var sunrise = noon - (isNaN(haSun) ? NaN : haSun * 4);
  var sunset  = noon + (isNaN(haSun) ? NaN : haSun * 4);
  var fajr    = noon - (isNaN(ha(-18)) ? NaN : ha(-18) * 4);
  var isha    = noon + (isNaN(ha(-17)) ? NaN : ha(-17) * 4);

  var noonAlt = 90 - Math.abs(lat - decl);
  var asrAlt = noonAlt > 0 ? DEG * Math.atan(1 / (1 + 1 / Math.tan(noonAlt * RAD))) : NaN;
  var haAsr = isNaN(asrAlt) ? NaN : ha(asrAlt);
  var asr = noon + (isNaN(haAsr) ? NaN : haAsr * 4);

  // High-latitude fallback: angle-based method (MWL recommended)
  if (!isNaN(sunrise) && !isNaN(sunset)) {
    var nightMin = (sunrise + 1440 - sunset) % 1440;
    if (isNaN(fajr)) fajr = sunrise - (18 / 60) * nightMin;
    if (isNaN(isha)) isha = sunset  + (17 / 60) * nightMin;
  }

  return {
    fajr:    fajr / 60,
    sunrise: sunrise / 60,
    dhuhr:   noon / 60 + 2 / 60,
    asr:     asr / 60,
    maghrib: sunset / 60,
    isha:    isha / 60
  };
}

function fmtPrayer(h) {
  if (isNaN(h)) return '--:--';
  var totalMin = Math.round(((h % 24 + 24) % 24) * 60);
  if (totalMin >= 1440) totalMin -= 1440;
  return String(Math.floor(totalMin / 60)).padStart(2, '0') + ':' +
    String(totalMin % 60).padStart(2, '0');
}

function prayerToMin(str) {
  if (!str || str === '--:--') return NaN;
  var p = str.split(':');
  return Number(p[0]) * 60 + Number(p[1]);
}

function loadLocation() {
  try { return JSON.parse(localStorage.getItem(LOCATION_KEY)); }
  catch (e) { return null; }
}

function saveLocation(loc) {
  localStorage.setItem(LOCATION_KEY, JSON.stringify(loc));
}

function getTodayTimes() {
  var loc = loadLocation();
  if (!loc) return null;
  var today = getTodayStr();
  if (cachedTimesDate === today && cachedTimes) return cachedTimes;
  cachedTimes = calcPrayerTimes(new Date(), loc.lat, loc.lng);
  cachedTimesDate = today;
  return cachedTimes;
}

function fetchCityName(lat, lng) {
  var url = 'https://nominatim.openstreetmap.org/reverse?lat=' + lat
    + '&lon=' + lng + '&format=json&accept-language=ru&zoom=10';
  fetch(url).then(function (r) { return r.json(); }).then(function (data) {
    var a = data.address || {};
    var city = a.city || a.town || a.village || a.state || '';
    if (city) {
      var loc = loadLocation();
      if (loc) { loc.city = city; saveLocation(loc); }
      showCityName(city);
    }
  }).catch(function () {});
}

function showCityName(city) {
  var el = document.getElementById('prayer-city');
  if (el) el.textContent = city;
}

function onLocationFound(lat, lng) {
  saveLocation({ lat: lat, lng: lng });
  cachedTimes = null;
  cachedTimesDate = null;
  showPrayerContent();
  fetchCityName(lat, lng);
}

function ipFallback() {
  var prompt = document.getElementById('prayer-prompt');
  fetch('https://ipapi.co/json/').then(function (r) { return r.json(); }).then(function (d) {
    if (d && d.latitude && d.longitude) {
      onLocationFound(d.latitude, d.longitude);
    } else if (prompt) {
      prompt.innerHTML = retryBtnHTML;
    }
  }).catch(function () {
    if (prompt) prompt.innerHTML = retryBtnHTML;
  });
}

var retryBtnHTML = '<button class="prayer-enable-btn" onclick="enablePrayerTimes()">' +
  '<svg class="ico-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>' +
  ' попробовать снова</button>';

function enablePrayerTimes() {
  var prompt = document.getElementById('prayer-prompt');
  if (prompt) prompt.innerHTML = '<span class="prayer-loading">определение…</span>';

  if (!navigator.geolocation) { ipFallback(); return; }

  navigator.geolocation.getCurrentPosition(
    function (pos) { onLocationFound(pos.coords.latitude, pos.coords.longitude); },
    function () { ipFallback(); },
    { enableHighAccuracy: false, timeout: 15000, maximumAge: 3600000 }
  );
}

function showPrayerContent() {
  var times = getTodayTimes();
  if (!times) return;

  var prompt = document.getElementById('prayer-prompt');
  var content = document.getElementById('prayer-content');
  if (prompt) prompt.hidden = true;
  if (content) content.hidden = false;

  PRAYER_ORDER.forEach(function (key) {
    var el = document.getElementById('pt-' + key);
    if (el) el.textContent = fmtPrayer(times[key]);
  });

  var loc = loadLocation();
  if (loc && loc.city) {
    showCityName(loc.city);
  } else if (loc) {
    fetchCityName(loc.lat, loc.lng);
  }

  updatePrayerHighlight();
}

function updatePrayerHighlight() {
  var times = getTodayTimes();
  if (!times) return;

  var now = new Date();
  var nowMin = now.getHours() * 60 + now.getMinutes();

  var entries = PRAYER_ORDER.map(function (key) {
    return { key: key, min: prayerToMin(fmtPrayer(times[key])) };
  }).filter(function (e) { return !isNaN(e.min); });

  if (!entries.length) return;

  var nextIdx = -1;
  for (var i = 0; i < entries.length; i++) {
    if (entries[i].min > nowMin) { nextIdx = i; break; }
  }
  if (nextIdx === -1) nextIdx = 0;

  var nextEntry = entries[nextIdx];

  document.querySelectorAll('.prayer-item').forEach(function (el) {
    el.classList.toggle('next-prayer', el.dataset.prayer === nextEntry.key);
  });

  var nextEl = document.getElementById('prayer-next');
  if (nextEl && nextEntry) {
    var diff = nextEntry.min - nowMin;
    if (diff < 0) diff += 1440;
    var h = Math.floor(diff / 60);
    var m = diff % 60;
    var timeStr = h > 0 ? h + 'ч ' + m + 'м' : m + 'м';
    nextEl.textContent = 'до ' + PRAYER_LABELS[nextEntry.key][1] + ' · ' + timeStr;
    nextEl.hidden = false;
  }
}

function togglePrayerTimes() {
  var s = loadSettings();
  s.showPrayerTimes = s.showPrayerTimes === false;
  saveSettings(s);
  applyPrayerVisibility();
}

function applyPrayerVisibility() {
  var s = loadSettings();
  var show = s.showPrayerTimes !== false;
  var el = document.getElementById('prayer-times');
  var btn = document.getElementById('prayer-toggle');
  if (el) el.hidden = !show;
  if (btn) btn.setAttribute('aria-checked', String(show));
}

(function initPrayer() {
  applyPrayerVisibility();
  var s = loadSettings();
  if (s.showPrayerTimes === false) return;

  var loc = loadLocation();
  if (loc) {
    showPrayerContent();
    setInterval(updatePrayerHighlight, 60000);
  }
})();
