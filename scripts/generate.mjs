// Writes the static HTML pages into site/, one full set per language (index.html, index.en.html ...).
import fs from 'node:fs/promises';
import path from 'node:path';
import { moonSVG } from './moon.mjs';
import { ROOT, loadContent } from './content.mjs';
import { LANGS, UI } from './i18n.mjs';

const photos = JSON.parse(await fs.readFile(path.join(ROOT, '.cache/photos.json'), 'utf8'));
let media = {};
try { media = JSON.parse(await fs.readFile(path.join(ROOT, '.cache/media.json'), 'utf8')); } catch { /* none */ }

const esc = (s = '') => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
// links typed into the admin: only web, mail and phone addresses are written into a page (never javascript: etc.)
const safeUrl = (u) => (/^(https?:\/\/|mailto:|tel:)/i.test(String(u || '').trim()) ? String(u).trim() : '');
const OG_LOCALE = { zh: 'zh_CN', en: 'en_US', ja: 'ja_JP' };
const sitemap = [];
const P = (src) => photos[src] || null;
const largest = (p) => `${p.dir}/${p.base}-${p.widths[p.widths.length - 1]}.webp`;
const exifText = (e) => (e ? Object.values(e).filter(Boolean).join('　') : '');
const dur = (s) => (s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : '');
const day = (t) => (t ? new Date(t * 1000).toISOString().slice(0, 10).replace(/-/g, '.') : '');

function picture(src, { sizes = '100vw', alt = '', cls = '', eager = false } = {}) {
  const p = P(src);
  if (!p) return `<span class="ph ph-missing ${cls}"></span>`;
  const set = p.widths.map((w) => `${p.dir}/${p.base}-${w}.webp ${w}w`).join(', ');
  // every current browser takes the WebP source; the single JPEG is only for the rest
  return `<picture class="ph ${cls}" style="--ar:${p.w}/${p.h};--pc:${p.color}"><source type="image/webp" srcset="${set}" sizes="${sizes}"><img class="dev" src="${p.dir}/${p.base}-${p.fallback}.jpg" width="${p.w}" height="${p.h}" alt="${esc(alt)}" ${eager ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"'} decoding="async"></picture>`;
}

// splits a Chinese or Japanese line at its punctuation so a phrase never breaks in the middle;
// Latin text keeps its spaces and wraps normally
const CJK = /[\u3040-\u30ff\u3400-\u9fff]/;
const phrases = (l) => (CJK.test(l) ? esc(l).split(/(?<=[，。、；！？])/).map((t) => `<span class="nw">${t}</span>`).join('') : esc(l));

const out = path.join(ROOT, 'site');
const pages = {};

for (const L of LANGS) {
  const C = await loadContent(L.code);
  const { site, contact, socials, series, films, about, homeTeaser, music } = C;
  const t = UI[L.code];
  const href = (name) => `${name}${L.suffix}.html`;
  const seriesHref = (s) => href(`series-${s.slug}`);
  const edge = (n, code = site.edgeCode) => `<span class="edge" data-edge>${esc(code)}<i>▸ ${n}</i><i>${n}A</i></span>`;
  const config = {
    lang: L.code,
    music: { on: music.on, file: media.music || '', volume: music.volume },
    formEndpoint: /^https:\/\//i.test(contact.formEndpoint) ? contact.formEndpoint : '', email: contact.email,
    ui: {
      copied: t.copied, copyFail: t.copyFail, soundOn: t.soundOn, soundOff: t.soundOff, notReady: t.notReady,
      f: { ...t.f, budgets: undefined }, pswp: t.pswp, view: t.cursor.view,
    },
  };

  // the address a page is published at; the Chinese home page is the site root
  const pageUrl = (key, l) => (key === 'index' && !l.suffix ? site.url : `${site.url}${key}${l.suffix}.html`);
  function head({ key, title, desc = site.description, theme = 'paper', preload = '', image = null, ld = null }) {
    const full = title ? `${title} | ${site.title}` : `${site.title} | ${t.tagline}`;
    const alt = (l) => `${key}${l.suffix}.html`;
    const pageType = key.startsWith('series-') ? 'series' : key === 'index' ? 'home' : key === '404' ? 'nf' : key;
    const indexable = key !== '404';
    if (indexable) sitemap.push({ key, lang: L });
    const og = image ? { url: `${site.url}${image}`, w: 1200, h: 630 } : { url: `${site.url}og.jpg`, w: 1200, h: 630 };
    const seo = indexable
      ? `<link rel="canonical" href="${pageUrl(key, L)}">
${LANGS.map((l) => `<link rel="alternate" hreflang="${l.html}" href="${pageUrl(key, l)}">`).join('\n')}
<link rel="alternate" hreflang="x-default" href="${pageUrl(key, LANGS[0])}">
<meta property="og:url" content="${pageUrl(key, L)}">`
      : '<meta name="robots" content="noindex">';
    return `<!doctype html>
<html lang="${L.html}" class="no-js" data-page="${pageType}" data-theme-base="${theme}" ${LANGS.map((l) => `data-alt-${l.code}="${alt(l)}"`).join(' ')}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(full)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="theme-color" content="${theme === 'room' ? '#1B1612' : '#EFE6D8'}">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<link rel="manifest" href="manifest.webmanifest">
${preload ? `<link rel="preload" as="image" href="${esc(preload)}" type="image/webp" fetchpriority="high">\n` : ''}${seo}
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="${esc(site.name)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(site.title)}">
<meta property="og:title" content="${esc(full)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:locale" content="${OG_LOCALE[L.code] || L.html}">
${LANGS.filter((l) => l !== L).map((l) => `<meta property="og:locale:alternate" content="${OG_LOCALE[l.code] || l.html}">`).join('\n')}
<meta property="og:image" content="${og.url}">
<meta property="og:image:width" content="${og.w}">
<meta property="og:image:height" content="${og.h}">
<meta name="twitter:card" content="summary_large_image">
${ld ? `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>` : ''}
<script>(function(d){d.classList.replace('no-js','js');try{var s=localStorage.getItem('qt-lang');if(!s&&d.lang==='zh-CN'&&!/bot|crawl|spider|slurp|preview|facebookexternalhit/i.test(navigator.userAgent)){var n=(navigator.language||'').toLowerCase();var to=n.indexOf('zh')===0?'':'en';if(to){var a=d.getAttribute('data-alt-'+to);if(a){location.replace(a+location.hash);return}}}if(sessionStorage.getItem('qt-leak'))d.classList.add('leak-in');if(sessionStorage.getItem('qt-pre'))d.classList.add('pre-seen')}catch(e){}})(document.documentElement)</script>
<script type="application/json" id="qt-config">${JSON.stringify(config).replace(/</g, '\\u003c')}</script>
<script type="module" src="./src/main.js"></script>
</head>
<body>
<a class="skip" href="#main">${esc(t.skip)}</a>
<div class="grain" aria-hidden="true"></div>
<div class="leak" aria-hidden="true"><i></i><i></i></div>
${header(key)}`;
  }

  const NAV = [['works', 'works'], ['gallery', 'gallery'], ['films', 'films'], ['about', 'about'], ['contact', 'contact']];
  function langSwitch(key) {
    return `<div class="lang" role="group" aria-label="${esc(t.language)}">${LANGS.map((l) => `<a href="${key}${l.suffix}.html" hreflang="${l.html}" lang="${l.html}" data-lang="${l.code}"${l.code === L.code ? ' aria-current="true"' : ''} title="${esc(l.name)}">${esc(l.label)}</a>`).join('')}</div>`;
  }
  function header(key) {
    const cur = (k) => (key === k || (k === 'works' && key.startsWith('series-')) ? ' aria-current="page"' : '');
    const link = ([k, file]) => `<a href="${href(file)}"${cur(k)}><span class="roll-t" data-t="${esc(t.nav[k])}"><span>${esc(t.nav[k])}</span></span></a>`;
    const sound = music.on
      ? `<button type="button" class="sound" data-sound aria-pressed="false" aria-label="${esc(t.sound)}"><span class="sound-bars" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span class="sound-t">${esc(t.soundOff)}</span></button>`
      : '';
    return `<header class="hdr" data-hdr>
<a class="brand" href="${href('index')}" aria-label="${esc(site.title)} ${esc(t.home)}">${moonSVG({ id: 'hm', cls: 'brand-moon' })}<span class="brand-en">${esc(site.name)}</span><span class="brand-zh">${esc(site.nameZh)}</span></a>
<div class="hdr-r">
<nav class="nav" aria-label="${esc(t.menu)}">${NAV.map(link).join('')}</nav>
${langSwitch(key)}
${sound}
<button type="button" class="menu-btn" data-menu-btn aria-expanded="false" aria-controls="menu"><span class="menu-lines" aria-hidden="true"><i></i><i></i></span><span class="sr-only">${esc(t.menu)}</span></button>
</div>
</header>
<div class="menu" id="menu" data-menu hidden>
<nav class="menu-nav" aria-label="${esc(t.menu)}">${NAV.map(([k, file]) => `<a href="${href(file)}"${cur(k)}><span class="mn-zh">${esc(t.nav[k])}</span><span class="mn-en">${esc(UI[L.code === 'en' ? 'zh' : 'en'].nav[k])}</span></a>`).join('')}</nav>
<div class="menu-foot">${langSwitch(key)}${contact.wechat ? `<p>${esc(t.wechat)} ${esc(contact.wechat)}</p>` : ''}${contact.email ? `<p>${esc(contact.email)}</p>` : ''}</div>
</div>`;
  }

  function contactLines(big = false) {
    const c = big ? 'copy big' : 'copy';
    return [
      contact.wechat && `<p><span class="k">${esc(t.wechat)}</span><button type="button" class="${c}" data-copy="${esc(contact.wechat)}">${esc(contact.wechat)}</button></p>`,
      contact.email && `<p><span class="k">${esc(t.email)}</span><button type="button" class="${c}" data-copy="${esc(contact.email)}">${esc(contact.email)}</button></p>`,
    ].filter(Boolean).join('\n');
  }

  function footer() {
    const soc = socials.filter((s) => safeUrl(s.url));
    return `<footer class="ftr" data-ftr>
<div class="ftr-edge" aria-hidden="true"><span class="edge">${esc(site.edgeCode)}<i>▸ END</i></span></div>
<div class="ftr-inner">
<p class="ftr-word"><span class="fw-en">${esc(site.name)}</span><span class="fw-zh">${esc(site.nameZh)}</span></p>
<div class="ftr-contact">
${contactLines()}
${soc.length ? `<p class="ftr-soc">${soc.map((s) => `<a href="${esc(safeUrl(s.url))}" target="_blank" rel="noopener">${esc(s.label)}</a>`).join('')}</p>` : ''}
</div>
<div class="ftr-legal"><p class="ftr-copy">${esc(contact.copyright)}</p>
${site.samples && site.sampleCredit ? `<p class="ftr-credit">${esc(site.sampleCredit)}</p>` : ''}</div>
</div>
<p class="sr-only" aria-live="polite" data-live></p>
</footer>
</body>
</html>`;
  }

  function playerMarkup() {
    return `<div class="player" data-player hidden role="dialog" aria-modal="true" aria-label="${esc(t.player)}">
<div class="player-box" data-player-box><div class="player-frame" data-player-frame></div>
<div class="player-bar"><p class="player-title" data-player-title></p><div><a data-player-link href="#" target="_blank" rel="noopener">${esc(t.openBili)}</a><button type="button" data-player-close>${esc(t.close)}</button></div></div></div>
</div>`;
  }

  const ready = (f) => Boolean(f.bvid || f.aid);
  const filmAttrs = (f) => (ready(f)
    ? `data-bvid="${esc(f.bvid)}" data-aid="${esc(f.aid)}" data-cid="${esc(f.cid)}" data-p="${f.p}" data-cursor="${esc(t.cursor.play)}"`
    : `aria-disabled="true" data-cursor="${esc(t.cursor.soon)}"`);
  const filmState = (f) => (ready(f) ? t.play : t.soon);
  const facts = (f) => [dur(f.meta?.duration), f.meta?.views != null ? t.plays(f.meta.views) : '', day(f.meta?.pubdate)].filter(Boolean);

  function filmGrid(h = 'h3') {
    if (!films.length) return `<p class="empty">${esc(t.filmsEmpty)}</p>`;
    const [lead, ...rest] = films;
    return `<div class="screen">
<button type="button" class="film-btn" ${filmAttrs(lead)} aria-label="${esc(filmState(lead))}：${esc(lead.title)}">${picture(lead.src, { sizes: '(max-width: 860px) 100vw, 84vw' })}<span class="film-state">${esc(filmState(lead))}${lead.meta?.duration ? `<i>${dur(lead.meta.duration)}</i>` : ''}</span></button>
<div class="screen-cap"><${h}>${esc(lead.title)}</${h}><p>${esc(lead.sub)}<span>${esc(lead.kind)}</span></p>${facts(lead).length ? `<p class="film-facts">${facts(lead).map((x) => `<span>${esc(x)}</span>`).join('')}</p>` : ''}</div>
</div>
${rest.length ? `<ol class="film-rows">${rest.map((f) => `<li><button type="button" class="film-row" ${filmAttrs(f)} aria-label="${esc(filmState(f))}：${esc(f.title)}"><span class="fr-t">${esc(f.title)}</span><span class="fr-e">${esc(f.sub)}</span><span class="fr-k">${esc(facts(f)[0] || f.kind)}</span><span class="fr-s">${esc(filmState(f))}</span></button></li>`).join('')}</ol>` : ''}`;
  }

  // ── Scene data, shared by the home spine and the darkroom ──
  // a picture as a texture: the largest size up to `max` pixels wide
  const texUrl = (p, max = 960) => {
    const ws = p.widths.filter((w) => w <= max);
    return `${p.dir}/${p.base}-${ws.length ? ws[ws.length - 1] : p.widths[0]}.webp`;
  };
  const sceneJSON = (o) => `<script type="application/json" id="qt-scene">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`;
  const framesOf = (s) => s.frames.map((f) => ({ f, p: P(f.src) })).filter((x) => x.p);
  const capBar = `<div class="cap" data-cap aria-hidden="true"><p class="k" data-cap-k></p><p class="t" data-cap-t></p><p class="s" data-cap-s></p></div>`;
  const darkSlates = {
    head: [`${site.edgeCode} ▸ 0`, site.name, site.nameZh, 'DARKROOM · ONE TAKE'],
    end: [`${site.edgeCode} ▸ END`, t.endRoll, t.scene.writeUs, contact.email || ''],
  };
  const darkCaps = {
    head: [`${site.edgeCode} ▸ 0`, t.scene.darkroom, t.scene.darkroomSub],
    end: [`${site.edgeCode} ▸ END`, t.endRoll, contact.email || ''],
  };
  const darkSeries = (s, i) => {
    const fr = framesOf(s);
    return {
      href: seriesHref(s),
      slate: [`ROLL ${i + 1}`, s.title, s.sub, t.scene.prints(fr.length)],
      cap: [`ROLL ${i + 1}`, s.title, s.sub],
      frames: fr.map(({ p }) => ({ w: p.w, h: p.h })),
      images: fr.map(({ p }) => texUrl(p)),
    };
  };

  // ── Home: a title card, then one strip of film, a stop for every series ──
  function home() {
    let from = 0;
    const spine = series.map((s, i) => {
      const fr = framesOf(s);
      // a frame of the film atlas is about 485 px wide, so the 480 px size is enough
      const o = { n: fr.length, from, cap: [`ROLL ${i + 1}`, s.title, `${s.sub} · ${t.frames(fr.length)}`], images: fr.map(({ p }) => texUrl(p, 480)), sizes: fr.map(({ p }) => [p.w, p.h]) };
      from += fr.length;
      return o;
    });
    const first = framesOf(series[0] || { frames: [] })[0];
    const data = {
      edge: site.edgeCode,
      // the letters of the title are cut out of this picture: a landscape set in the admin, else the first frame
      heroPhoto: P(site.heroImage) ? texUrl(P(site.heroImage), 1600) : first ? texUrl(first.p, 1600) : '',
      capHead: [`${site.edgeCode} ▸ 0`, t.scene.head, t.scene.headSub],
      capEnd: [`${site.edgeCode} ▸ END`, t.endRoll, contact.email || ''],
      // the pictures' shapes come with the page, so the strip is laid out before any picture has loaded
      images: spine.flatMap((x) => x.images),
      sizes: spine.flatMap((x) => x.sizes),
      series: spine.map(({ images, sizes, ...rest }) => rest),
    };
    // without WebGL (or with reduced motion) the run holds a plain strip: a slate and the first frames of each series
    const cells = [];
    let n = 0;
    const cellEdge = () => { n += 1; return `<span class="cell-edge">${edge(n)}</span>`; };
    series.forEach((s, i) => {
      cells.push(`<div class="cell cell-slate"><div class="frame">
<p class="slate-roll">${esc(t.roll(i + 1))}</p>
<h2 class="slate-title"><a href="${seriesHref(s)}" data-cursor="${esc(t.cursor.open)}">${esc(s.title)}</a></h2>
<p class="slate-sub">${esc(s.sub)}</p>
<p class="slate-n">${esc(t.frames(s.frames.length))}</p>
<a class="more" href="${seriesHref(s)}">${esc(t.openRoll)}</a></div>${cellEdge()}</div>`);
      s.frames.slice(0, 3).forEach((f, k) => {
        cells.push(`<a class="cell cell-photo" href="${seriesHref(s)}#f${k + 1}" data-cursor="${esc(t.cursor.open)}" aria-label="${esc(s.title)} ${esc(t.frameN(k + 1))}"><span class="frame">${picture(f.src, { sizes: '(max-width: 860px) 90vw, 60vw', alt: f.caption })}</span><span class="cell-cap">${esc(f.caption)}</span>${cellEdge()}</a>`);
      });
    });
    const title = (site.name || 'Quietime').toUpperCase();
    const ld = {
      '@context': 'https://schema.org', '@type': 'ProfessionalService', additionalType: 'https://schema.org/Photograph',
      name: site.title, alternateName: [site.name, site.nameZh], description: site.description, url: site.url,
      logo: `${site.url}icon-512.png`, image: `${site.url}og.jpg`, inLanguage: L.html,
      ...(contact.email ? { email: contact.email } : {}),
      ...(socials.some((x) => /^https?:/i.test(safeUrl(x.url))) ? { sameAs: socials.map((x) => safeUrl(x.url)).filter((u) => /^https?:/i.test(u)) } : {}),
    };
    return `${head({ key: 'index', title: '', preload: data.heroPhoto, ld })}
<main id="main" class="home">
<section class="hero" data-hero aria-label="${esc(site.title)}">
<p class="h-edge">${esc(site.edgeCode)} ▸ 0 · 36 EXP</p>
<h1 class="h-title" data-hero-title aria-label="${esc(site.name)} ${esc(site.nameZh)}">${esc(title)}</h1>
<div class="h-row"><p class="h-zh" data-hero-zh aria-hidden="true">${esc(site.nameZh)}</p><p class="h-en">${esc(t.scene.heroEn)}</p></div>
<p class="h-st">${site.statement.map((l) => esc(l)).join('<br>')}</p>
<p class="h-hint" aria-hidden="true">${esc(t.scene.scroll)} ↓</p>
</section>
<div class="run" data-run>
<section class="roll" aria-label="${esc(t.nav.works)}"><div class="roll-cam"><div class="roll-track">${cells.join('\n')}</div></div></section>
</div>
${capBar}
<section class="h-sec h-films" aria-labelledby="h-films-t">
<div class="h-sec-head"><h2 id="h-films-t">${esc(t.nav.films)}</h2><p>${esc(t.filmsSub)}</p></div>
${filmGrid()}
<p class="more-wrap"><a class="more" href="${href('films')}">${esc(t.allFilms)}</a></p>
</section>
<section class="h-sec h-about">
<p class="about-q">${esc(homeTeaser || about.intro[0] || '')}</p>
<p class="h-about-links"><a class="more" href="${href('about')}">${esc(t.aboutLink)}</a><a class="more" href="${href('contact')}">${esc(t.book)}</a></p>
</section>
${sceneJSON(data)}
</main>
${playerMarkup()}
${footer()}`;
  }

  // ── Works ──
  function works() {
    const list = series.map((s, i) => `<article class="ws ${i % 2 ? 'ws-r' : ''}">
<a class="ws-img" href="${seriesHref(s)}" data-cursor="${esc(t.cursor.open)}" aria-label="${esc(t.openSeries)} ${esc(s.title)}">${picture(s.frames[0].src, { sizes: '(max-width: 860px) 92vw, 52vw', alt: s.frames[0].caption })}</a>
<div class="ws-text"><h2><a href="${seriesHref(s)}">${esc(s.title)}</a></h2><p class="ws-en">${esc(s.sub)}</p><p class="ws-st">${esc(s.statement)}</p><p class="ws-n">${esc(t.frames(s.frames.length))}</p></div>
</article>`).join('');
    const sheets = series.map((s) => `<section class="sheet"><h2>${esc(s.title)}<span>${esc(s.sub)}</span></h2><div class="sheet-grid">${s.frames.map((f, i) => {
      const p = P(f.src);
      return `<a class="sc" href="${seriesHref(s)}#f${i + 1}" data-cursor="hide" data-full="${p ? largest(p) : ''}" aria-label="${esc(s.title)} ${esc(t.frameN(i + 1))}">${picture(f.src, { sizes: '(max-width: 860px) 45vw, 18vw', alt: f.caption })}<span class="sc-n">${i + 1}</span></a>`;
    }).join('')}</div></section>`).join('');
    const dark = series.map(darkSeries);
    const data = { slates: darkSlates, caps: darkCaps, images: dark.flatMap((x) => x.images), series: dark.map(({ images, ...rest }) => rest) };
    return `${head({ key: 'works', title: t.nav.works, desc: `${site.title}：${series.map((s) => s.title).join('、')}`, theme: 'room', image: P(series[0]?.frames[0]?.src)?.og })}
<main id="main" class="works">
<header class="page-head dr-head"><p class="dr-edge">${esc(site.edgeCode)} ▸ 0</p><h1 data-split><span class="line"><span>${esc(t.nav.works)}</span></span></h1><p class="dr-lede">${esc(t.scene.darkroomSub)}</p></header>
<div class="run" data-run></div>
${capBar}
${sceneJSON(data)}
<header class="page-head w-index-head">
<div class="toggle" role="group" aria-label="${esc(t.views.label)}"><button type="button" aria-pressed="true" data-view="list">${esc(t.views.list)}</button><button type="button" aria-pressed="false" data-view="sheet">${esc(t.views.sheet)}</button></div>
${site.samples ? `<p class="sample-note">${esc(t.samples)}</p>` : ''}
</header>
<div class="w-list" data-panel="list">${list}</div>
<div class="w-sheet" data-panel="sheet" hidden>${sheets}<div class="loupe" data-loupe aria-hidden="true"></div></div>
</main>
${footer()}`;
  }

  // ── Series ──
  function seriesPage(s, i) {
    const next = series[(i + 1) % series.length];
    const fig = (f, n, cls) => {
      const p = P(f.src);
      const tall = p && p.h > p.w;
      const ew = p ? p.widths[p.widths.length - 1] : 0;
      const attrs = p ? ` href="${largest(p)}" data-pswp-width="${ew}" data-pswp-height="${Math.round((p.h * ew) / p.w)}" data-cap="${esc(f.caption)}" data-exif="${esc(exifText(p.exif))}" data-n="${n}"` : '';
      return `<figure class="fr ${cls}${tall ? ' is-tall' : ''}" id="f${n}" data-frame="${n}"${tall ? ` style="--maxw:calc(78vh * ${p.w} / ${p.h})"` : ''}><a class="fr-open"${attrs} data-cursor="${esc(t.cursor.view)}" aria-label="${esc(t.viewFrame(n))} ${esc(f.caption)}">${picture(f.src, { sizes: cls === 'fr-wide' ? '(max-width: 860px) 100vw, 80vw' : '(max-width: 860px) 100vw, 50vw', alt: f.caption, eager: n === 1 })}</a><figcaption>${edge(n)}<span class="cap">${esc(f.caption)}</span></figcaption></figure>`;
    };
    let body = '';
    const fr = s.frames;
    for (let k = 0; k < fr.length; k++) {
      const f = fr[k];
      if (f.layout === 'pair' && fr[k + 1] && fr[k + 1].layout === 'pair') {
        body += `<div class="fr-pair">${fig(f, k + 1, 'fr-p')}${fig(fr[k + 1], k + 2, 'fr-p')}</div>`;
        k += 1;
      } else {
        const lay = ['wide', 'right', 'left', 'small'].includes(f.layout) ? f.layout : 'right';
        body += fig(f, k + 1, `fr-${lay}`);
      }
    }
    const meta = [[t.metaFrames, String(fr.length)], ...s.meta];
    const dk = darkSeries(s, i);
    const data = {
      slates: { head: darkSlates.head, end: next && next !== s ? [`${site.edgeCode} ▸ END`, t.next, next.title, next.sub] : darkSlates.end },
      caps: { head: darkCaps.head, end: next && next !== s ? [`${site.edgeCode} ▸ END`, t.next, next.title] : darkCaps.end },
      images: dk.images, series: [{ ...dk, images: undefined }],
    };
    const cover = P(fr[0]?.src);
    const ld = {
      '@context': 'https://schema.org', '@type': 'ImageGallery', name: s.title, alternateName: s.sub || undefined,
      description: s.statement || undefined, url: pageUrl(`series-${s.slug}`, L), inLanguage: L.html,
      image: cover?.og ? `${site.url}${cover.og}` : undefined, numberOfItems: fr.length,
      author: { '@type': 'Organization', name: site.title, url: site.url },
    };
    return `${head({ key: `series-${s.slug}`, title: s.title, desc: s.statement || site.description, theme: 'room', image: cover?.og, ld })}
<div class="rail" aria-hidden="true"></div>
<main id="main" class="series">
<header class="s-head">
<h1 class="s-title" data-split><span class="line"><span>${esc(s.title)}</span></span></h1>
<p class="s-en">${esc(s.sub)}</p>
<dl class="s-meta">${meta.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
</header>
${s.statement ? `<div class="s-statement"><p class="zh" data-words>${esc(s.statement)}</p></div>` : '<div class="s-gap"></div>'}
<div class="run" data-run></div>
${capBar}
${sceneJSON(data)}
<div class="frames" data-gallery>${body}</div>
${series.length > 1 ? `<nav class="s-next" aria-label="${esc(t.next)}"><a href="${seriesHref(next)}" data-cursor="${esc(t.cursor.next)}"><span class="k">${esc(t.next)}</span><span class="s-next-txt"><span class="t">${esc(next.title)}</span><span class="e">${esc(next.sub)}</span></span>${picture(next.frames[0].src, { sizes: '(max-width: 860px) 92vw, 40vw' })}</a></nav>` : ''}
<p class="counter" aria-hidden="true" data-counter><span data-cur>1</span><span class="of">/ ${fr.length}</span></p>
</main>
${footer()}`;
  }

  // ── Gallery ──
  function galleryPage() {
    const all = series.flatMap((s) => s.frames.map((f, i) => ({ s, f, n: i + 1, p: P(f.src) }))).filter((x) => x.p);
    const tiles = all.map(({ s, f, n, p }) => {
      const ew = p.widths[p.widths.length - 1];
      return `<a class="gl-tile" href="${largest(p)}" data-series="${s.slug}" data-ar="${(p.w / p.h).toFixed(4)}" data-pswp-width="${ew}" data-pswp-height="${Math.round((p.h * ew) / p.w)}" data-cap="${esc(f.caption)}" data-exif="${esc(exifText(p.exif))}" data-n="${n}" data-sname="${esc(s.title)}" data-cursor="${esc(t.cursor.view)}" aria-label="${esc(s.title)} ${esc(t.frameN(n))} ${esc(f.caption)}">${picture(f.src, { sizes: '(max-width: 860px) 50vw, 30vw', alt: f.caption })}<span class="gl-cap"><b>${esc(f.caption)}</b><i>${esc(s.title)}　${esc(t.frameN(n))}</i></span></a>`;
    }).join('');
    const chips = [`<button type="button" aria-pressed="true" data-filter="all">${esc(t.all)}<sup>${all.length}</sup></button>`]
      .concat(series.map((s) => `<button type="button" aria-pressed="false" data-filter="${s.slug}">${esc(s.title)}<sup>${s.frames.length}</sup></button>`)).join('');
    return `${head({ key: 'gallery', title: t.nav.gallery })}
<main id="main" class="gallery">
<header class="page-head"><h1 data-split><span class="line"><span>${esc(t.nav.gallery)}</span></span></h1>
<div class="toggle gl-filter" role="group" aria-label="${esc(t.filter)}">${chips}</div>
${site.samples ? `<p class="sample-note">${esc(t.samples)}</p>` : ''}
</header>
<div class="gl-grid" data-gallery-grid>${tiles}</div>
</main>
${footer()}`;
  }

  // ── Films ──
  function filmsPage() {
    return `${head({ key: 'films', title: t.nav.films, desc: t.filmsLede, theme: 'room' })}
<main id="main" class="films-page">
<header class="page-head"><h1 data-split><span class="line"><span>${esc(t.nav.films)}</span></span></h1><p class="lede">${esc(t.filmsLede)}</p></header>
${filmGrid('h2')}
</main>
${playerMarkup()}
${footer()}`;
  }

  // ── About ──
  function aboutPage() {
    const strip = series.map((s) => s.frames[0]).slice(0, 4);
    return `${head({ key: 'about', title: t.nav.about, desc: about.intro[0] || site.description })}
<main id="main" class="about">
<header class="page-head"><h1 data-split><span class="line"><span>${esc(t.nav.about)}</span></span></h1></header>
<div class="ab-text">${about.intro.map((x, k) => `<p${k === 0 ? ' class="ab-lead"' : ''}>${esc(x)}</p>`).join('')}</div>
<div class="ab-strip" aria-hidden="true"><div class="strip">${strip.map((f, k) => `<figure class="sf">${picture(f.src, { sizes: '30vw' })}<figcaption>${edge(k + 1)}</figcaption></figure>`).join('')}</div></div>
${about.services.length ? `<section class="ab-services" aria-labelledby="h-svc"><h2 id="h-svc">${esc(t.together)}</h2>
<dl>${about.services.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl></section>` : ''}
<section class="ab-contact" aria-labelledby="h-ct"><h2 id="h-ct">${esc(t.nav.contact)}</h2>
<p class="ab-lede">${esc(contact.lede)}</p>
<div class="ab-ways">${contactLines(true)}</div>
<p class="ab-hint"><a class="more" href="${href('contact')}">${esc(t.toForm)}</a></p>
</section>
</main>
${footer()}`;
  }

  // ── Contact ──
  function contactPage() {
    const kinds = [...about.services.map(([k]) => k), t.f.other];
    const qr = contact.qr && P(contact.qr);
    const [none, ...budgets] = t.f.budgets;
    return `${head({ key: 'contact', title: t.nav.contact, desc: contact.lede || site.description })}
<main id="main" class="contact">
<header class="page-head"><h1 data-split><span class="line"><span>${esc(t.nav.contact)}</span></span></h1><p class="lede">${esc(contact.lede)}</p></header>
<div class="ct-grid">
<form class="ct-form" data-form novalidate>
<div class="fld"><input id="f-name" aria-describedby="f-name-msg" name="name" type="text" autocomplete="name" placeholder=" " required><label for="f-name">${esc(t.f.name)}</label><p class="fld-msg" id="f-name-msg" data-msg aria-live="polite"></p></div>
<div class="fld"><input id="f-reach" aria-describedby="f-reach-msg" name="reach" type="text" autocomplete="email" placeholder=" " required><label for="f-reach">${esc(t.f.reach)}</label><p class="fld-msg" id="f-reach-msg" data-msg aria-live="polite"></p></div>
<fieldset class="chips"><legend>${esc(t.f.kind)}</legend>${kinds.map((k, i) => `<label><input type="radio" name="kind" value="${esc(k)}"${i === 0 ? ' checked' : ''}><span>${esc(k)}</span></label>`).join('')}</fieldset>
<div class="fld-row">
<div class="fld"><input id="f-date" name="date" type="date" placeholder=" "><label for="f-date">${esc(t.f.date)}</label></div>
<div class="fld"><select id="f-budget" name="budget"><option value="">${esc(none)}</option>${budgets.map((b) => `<option>${esc(b)}</option>`).join('')}</select><label for="f-budget" class="is-up">${esc(t.f.budget)}</label></div>
</div>
<div class="fld"><textarea id="f-msg" aria-describedby="f-msg-msg" name="message" rows="5" placeholder=" " required></textarea><label for="f-msg">${esc(t.f.msg)}</label><p class="fld-msg" id="f-msg-msg" data-msg aria-live="polite"></p></div>
<div class="ct-send"><button type="submit" class="send" data-send><span class="send-t">${esc(t.f.send)}</span><span class="send-spin" aria-hidden="true"></span></button><p class="send-note" data-note role="status" aria-live="polite"></p></div>
</form>
<aside class="ct-side">
<div class="ct-ways">${contactLines(true)}</div>
${qr ? `<div class="ct-qr">${picture(contact.qr, { sizes: '180px', alt: t.f.qr })}<p>${esc(t.f.qr)}</p></div>` : ''}
${socials.filter((x) => safeUrl(x.url)).length ? `<p class="ct-soc">${socials.filter((x) => safeUrl(x.url)).map((x) => `<a href="${esc(safeUrl(x.url))}" target="_blank" rel="noopener">${esc(x.label)}</a>`).join('')}</p>` : ''}
</aside>
</div>
${contact.process.length ? `<section class="ct-process" aria-labelledby="h-proc"><h2 id="h-proc">${esc(t.f.process)}</h2><ol>${contact.process.map((p) => `<li><h3>${esc(p.title)}</h3><p>${esc(p.text)}</p></li>`).join('')}</ol></section>` : ''}
${contact.faq.length ? `<section class="ct-faq" aria-labelledby="h-faq"><h2 id="h-faq">${esc(t.f.faq)}</h2>${contact.faq.map((q) => `<details><summary>${esc(q.q)}</summary><div class="faq-a"><p>${esc(q.a)}</p></div></details>`).join('')}</section>` : ''}
</main>
${footer()}`;
  }

  function notFound() {
    return `${head({ key: '404', title: t.nf.title })}
<main id="main" class="nf">
<div class="nf-strip" aria-hidden="true"><span class="nf-cell"></span><span class="nf-cell nf-blank"></span><span class="nf-cell"></span><span class="nf-edge">${edge('404')}</span></div>
<h1>${esc(t.nf.title)}</h1>
<p>${esc(t.nf.text)}</p>
<p><a class="more" href="${href('index')}">${esc(t.nf.back)}</a></p>
</main>
${footer()}`;
  }

  pages[href('index')] = home();
  pages[href('works')] = works();
  pages[href('gallery')] = galleryPage();
  pages[href('films')] = filmsPage();
  pages[href('about')] = aboutPage();
  pages[href('contact')] = contactPage();
  pages[href('404')] = notFound();
  series.forEach((s, i) => { pages[seriesHref(s)] = seriesPage(s, i); });

  if (L.code === 'zh') {
    await fs.writeFile(path.join(out, 'public/manifest.webmanifest'), JSON.stringify({
      name: site.title, short_name: site.name, description: site.description, lang: 'zh-CN',
      start_url: './', scope: './', display: 'standalone', background_color: '#1B1612', theme_color: '#1B1612',
      icons: [
        { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    }, null, 2));
  }
}

// sitemap with every language version of each page, and robots.txt pointing at it
{
  const { site } = await loadContent('zh');
  const url = (key, l) => (key === 'index' && !l.suffix ? site.url : `${site.url}${key}${l.suffix}.html`);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${sitemap.map(({ key, lang }) => `<url><loc>${url(key, lang)}</loc>${LANGS.map((l) => `<xhtml:link rel="alternate" hreflang="${l.html}" href="${url(key, l)}"/>`).join('')}<xhtml:link rel="alternate" hreflang="x-default" href="${url(key, LANGS[0])}"/></url>`).join('\n')}
</urlset>
`;
  await fs.writeFile(path.join(out, 'public/sitemap.xml'), xml);
  await fs.writeFile(path.join(out, 'public/robots.txt'), `User-agent: *\nAllow: /\nDisallow: /admin/\n\nSitemap: ${site.url}sitemap.xml\n`);
}

// The site used to have Japanese pages (*.ja.html). Each old address now forwards to its English page, so links that
// people saved or shared keep working; the stubs are not indexed and the sitemap does not list them.
{
  const { site } = await loadContent('en');
  for (const f of Object.keys(pages).filter((k) => k.endsWith('.en.html'))) {
    const to = f, old = f.replace(/\.en\.html$/, '.ja.html');
    pages[old] = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(site.title)}</title>
<meta name="description" content="${esc(site.description)}">
<meta name="robots" content="noindex">
<link rel="canonical" href="${site.url}${to}">
<meta http-equiv="refresh" content="0; url=${to}">
<script>location.replace(${JSON.stringify(to)} + location.hash)</script>
</head>
<body><p><a href="${to}">${esc(site.title)}</a></p></body>
</html>
`;
  }
}

for (const f of (await fs.readdir(out)).filter((f) => f.endsWith('.html'))) await fs.unlink(path.join(out, f));
for (const [f, html] of Object.entries(pages)) await fs.writeFile(path.join(out, f), html);
console.log(`pages: ${Object.keys(pages).filter((k) => !k.endsWith('.ja.html')).length} (${LANGS.map((l) => l.code).join(', ')}), plus redirects from the old Japanese addresses`);
