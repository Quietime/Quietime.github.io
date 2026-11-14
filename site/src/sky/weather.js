// The weather outside the studio window, from Open-Meteo (free, no key, no visitor location involved).
// Cached for 30 minutes in the visitor's browser; a reading that takes longer than `wait` ms is not waited for, the
// title card then goes by the time of day alone.
const KEY = 'qt-weather';
const TTL = 30 * 60 * 1000;

/** WMO weather code → the kind of weather the title card can draw, with a rain rate (mm/h) where it rains. */
function kindOf(code, precip) {
  if (code === 45 || code === 48) return { kind: 'fog' };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { kind: 'snow', R: Math.max(0.5, precip || 1.5) };
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95) {
    const byCode = { 51: 0.5, 53: 1, 55: 2, 56: 1, 57: 2, 61: 2, 63: 6, 65: 12, 66: 2, 67: 8, 80: 3, 81: 8, 82: 20 }[code] || 10;
    return { kind: 'rain', R: Math.max(precip || 0, byCode) };
  }
  if (code === 3) return { kind: 'cloud' };
  return { kind: 'clear' };
}

export async function studioWeather({ lat, lon }, wait = 1500) {
  if (lat == null || lon == null) return null;
  try {
    const c = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (c && c.lat === lat && c.lon === lon && Date.now() - c.at < TTL) return c.w;
  } catch { /* storage blocked */ }
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}`
    + '&current=weather_code,cloud_cover,visibility,wind_speed_10m,precipitation&wind_speed_unit=ms&timezone=auto';
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(wait) });
    if (!r.ok) return null;
    const j = await r.json(), cur = j.current || {};
    const w = {
      ...kindOf(cur.weather_code, cur.precipitation),
      cover: cur.cloud_cover != null ? cur.cloud_cover / 100 : null,
      V: cur.visibility || null,
      u: cur.wind_speed_10m != null ? cur.wind_speed_10m : null,
      utcOffset: j.utc_offset_seconds != null ? j.utc_offset_seconds : null,
    };
    try { localStorage.setItem(KEY, JSON.stringify({ lat, lon, at: Date.now(), w })); } catch { /* storage blocked */ }
    return w;
  } catch { return null; }
}
