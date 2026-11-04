// Writes the static HTML pages into site/ from the content edited in the admin backend.
import fs from 'node:fs/promises';
import path from 'node:path';
import { moonSVG } from './moon.mjs';
import { ROOT, loadContent } from './content.mjs';

const { site, contact, socials, series, films, about, homeTeaser } = await loadContent();
const photos = JSON.parse(await fs.readFile(path.join(ROOT, '.cache/photos.json'), 'utf8'));

const esc = (s = '') => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const seriesHref = (s) => `series-${s.slug}.html`;
const P = (src) => photos[src] || null;
const largest = (p, ext = 'webp') => `${p.dir}/${p.base}-${p.widths[p.widths.length - 1]}.${ext}`;
const smallest = (p, ext = 'webp') => `${p.dir}/${p.base}-${p.widths[0]}.${ext}`;

function picture(src, { sizes = '100vw', alt = '', cls = '', eager = false } = {}) {
  const p = P(src);
  if (!p) return `<span class="ph ph-missing ${cls}"></span>`;
  const set = (ext) => p.widths.map((w) => `${p.dir}/${p.base}-${w}.${ext} ${w}w`).join(', ');
  return `<picture class="ph ${cls}" style="--ar:${p.w}/${p.h};--pc:${p.color}"><source type="image/webp" srcset="${set('webp')}" sizes="${sizes}"><img class="dev" src="${largest(p, 'jpg')}" srcset="${set('jpg')}" sizes="${sizes}" width="${p.w}" height="${p.h}" alt="${esc(alt)}" loading="${eager ? 'eager' : 'lazy'}" decoding="async"></picture>`;
}

const edge = (n) => `<span class="edge" data-edge>${esc(site.edgeCode)}<i>▸ ${n}</i><i>${n}A</i></span>`;
const phrases = (l) => esc(l).split(/(?<=[，。、；！？])/).map((t) => `<span class="nw">${t}</span>`).join('');
const exifText = (e) => (e ? Object.values(e).filter(Boolean).join('　') : '');

function head({ page, title, desc = site.description, theme = 'paper' }) {
  const full = title ? `${title} | ${site.title}` : `${site.title} | 摄影作品与影像`;
  return `<!doctype html>
<html lang="zh-CN" class="no-js" data-page="${page}" data-theme-base="${theme}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(full)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="theme-color" content="${theme === 'room' ? '#1B1612' : '#EFE6D8'}">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(site.title)}">
<meta property="og:title" content="${esc(full)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${site.url}og.jpg">
<meta name="twitter:card" content="summary_large_image">
<script>(function(d){d.classList.replace('no-js','js');try{if(sessionStorage.getItem('qt-leak'))d.classList.add('leak-in');if(sessionStorage.getItem('qt-pre'))d.classList.add('pre-seen')}catch(e){}})(document.documentElement)</script>
<script type="module" src="./src/main.js"></script>
</head>
<body>
<a class="skip" href="#main">跳到正文</a>
<div class="grain" aria-hidden="true"></div>
<div class="leak" aria-hidden="true"><i></i><i></i></div>
${header(page)}`;
}

function header(page) {
  const link = (href, label, key) =>
    `<a href="${href}"${page === key ? ' aria-current="page"' : ''}><span class="roll" data-t="${label}"><span>${label}</span></span></a>`;
  return `<header class="hdr" data-hdr>
<a class="brand" href="index.html" aria-label="${esc(site.title)} 首页">${moonSVG({ id: 'hm', cls: 'brand-moon' })}<span class="brand-en">${esc(site.name)}</span><span class="brand-zh">${esc(site.nameZh)}</span></a>
<nav class="nav" aria-label="主导航">${link('works.html', '作品', 'works')}${link('films.html', '影像', 'films')}${link('about.html', '关于', 'about')}</nav>
</header>`;
}

function contactLines(big = false) {
  const c = big ? 'copy big' : 'copy';
  return [
    contact.wechat && `<p><span class="k">微信</span><button type="button" class="${c}" data-copy="${esc(contact.wechat)}">${esc(contact.wechat)}</button></p>`,
    contact.email && `<p><span class="k">邮箱</span><button type="button" class="${c}" data-copy="${esc(contact.email)}">${esc(contact.email)}</button></p>`,
  ].filter(Boolean).join('\n');
}

function footer({ compact = false } = {}) {
  const soc = socials.filter((s) => s.url);
  if (compact) {
    return `<footer class="ftr ftr-compact" data-ftr>
<div class="ftr-inner"><p class="ftr-word"><span class="fw-en">${esc(site.name)}</span><span class="fw-zh">${esc(site.nameZh)}</span></p>
<p class="ftr-copy">${esc(contact.copyright)}</p>
${site.samples && site.sampleCredit ? `<p class="ftr-credit">${esc(site.sampleCredit)}</p>` : ''}</div>
<p class="sr-only" aria-live="polite" data-live></p>
</footer>
</body>
</html>`;
  }
  return `<footer class="ftr" data-ftr>
<div class="ftr-inner">
<div class="ftr-moon">${moonSVG({ id: 'fm', cls: 'ftr-svg' })}</div>
<div class="ftr-main">
<p class="ftr-word"><span class="fw-en">${esc(site.name)}</span><span class="fw-zh">${esc(site.nameZh)}</span></p>
<div class="ftr-contact">
${contactLines()}
${soc.length ? `<p class="ftr-soc">${soc.map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a>`).join('')}</p>` : ''}
</div>
<p class="ftr-copy">${esc(contact.copyright)}</p>
${site.samples && site.sampleCredit ? `<p class="ftr-credit">${esc(site.sampleCredit)}</p>` : ''}
</div>
</div>
<p class="sr-only" aria-live="polite" data-live></p>
</footer>
</body>
</html>`;
}

function playerMarkup() {
  return `<div class="player" data-player hidden role="dialog" aria-modal="true" aria-label="视频播放">
<div class="player-box" data-player-box><div class="player-frame" data-player-frame></div>
<div class="player-bar"><a data-player-link href="#" target="_blank" rel="noopener">在 B站 打开</a><button type="button" data-player-close>关闭</button></div></div>
</div>`;
}

function filmGrid(h = 'h3') {
  if (!films.length) return '<p class="empty">影片整理中。</p>';
  const ready = (f) => Boolean(String(f.bvid || '').trim());
  const attrs = (f) => (ready(f) ? `data-bvid="${esc(f.bvid.trim())}"` : 'aria-disabled="true"');
  const state = (f) => (ready(f) ? '播放' : '整理中');
  const [lead, ...rest] = films;
  return `<div class="screen">
<button type="button" class="film-btn" ${attrs(lead)} aria-label="${state(lead)}：${esc(lead.title_zh)}">${picture(lead.src, { sizes: '(max-width: 860px) 100vw, 84vw' })}<span class="film-state">${state(lead)}</span></button>
<div class="screen-cap"><${h}>${esc(lead.title_zh)}</${h}><p>${esc(lead.title_en || '')}<span>${esc(lead.kind || '')}</span></p></div>
</div>
${rest.length ? `<ol class="film-rows">${rest.map((f) => `<li><button type="button" class="film-row" ${attrs(f)} aria-label="${state(f)}：${esc(f.title_zh)}"><span class="fr-t">${esc(f.title_zh)}</span><span class="fr-e">${esc(f.title_en || '')}</span><span class="fr-k">${esc(f.kind || '')}</span><span class="fr-s">${state(f)}</span></button></li>`).join('')}</ol>` : ''}`;
}

// ── Home ────────────────────────────────────────────────────
function home() {
  const totalFrames = series.reduce((a, s) => a + s.frames.length, 0);
  const list = series
    .map((s) => {
      const p = P(s.frames[0].src);
      return `<li><a href="${seriesHref(s)}" data-cover="${p ? smallest(p) : ''}" data-ar="${p ? `${p.w}/${p.h}` : '3/2'}"><span class="sl-zh">${esc(s.zh)}</span><span class="sl-en">${esc(s.en)}</span><span class="sl-n">${s.frames.length} 格</span></a></li>`;
    })
    .join('');
  let k = 0;
  const strip = series
    .flatMap((s) => s.frames.slice(0, 2).map((f, i) => [s, f, i + 1]))
    .map(([s, f, n]) => {
      k += 1;
      return `<figure class="sf"><a href="${seriesHref(s)}#f${n}" aria-label="${esc(s.zh)} 第 ${n} 格">${picture(f.src, { sizes: '(max-width: 860px) 70vw, 34vw', alt: f.caption || '' })}</a><figcaption>${edge(k)}${n === 1 ? `<span class="sf-name">${esc(s.zh)}</span>` : ''}</figcaption></figure>`;
    })
    .join('');
  return `${head({ page: 'home', title: '' })}
<div class="stage" data-stage aria-hidden="true"><div class="stage-moon"><div class="stage-inner"></div></div></div>
<div class="pre" data-pre aria-hidden="true">
<div class="pre-moon">${moonSVG({ id: 'pm', cls: 'pre-svg' })}</div>
<p class="pre-word"><span>${esc(site.name)}</span><span>${esc(site.nameZh)}</span></p>
</div>
<main id="main">
<section class="hero" data-hero>
<div class="hero-moon" data-hero-moon>${moonSVG({ id: 'hero', cls: 'hero-svg', label: `${site.name} 月亮标志` })}</div>
<div class="hero-text">
<h1 class="hero-title" data-split><span class="sr-only">${esc(site.title)}：</span>${site.statement.zh.map((l) => `<span class="line"><span>${phrases(l)}</span></span>`).join('')}</h1>
<p class="hero-en">${esc(site.statement.en)}</p>
</div>
</section>

<section class="index" id="works" aria-labelledby="h-works">
<div class="sec-head"><h2 id="h-works">作品</h2><p>${series.length} 个系列，${totalFrames} 个画格。</p></div>
<ol class="series-list" data-series-list>${list}</ol>
<div class="reveal" data-reveal aria-hidden="true"><img alt=""></div>
</section>

<section class="strip-sec" data-strip aria-labelledby="h-strip">
<div class="sec-head"><h2 id="h-strip">画格</h2><p>从每一卷里各抽出几格，像翻看一条刚冲好的底片。</p></div>
<div class="strip-vp" data-strip-vp><div class="strip" data-strip-track>${strip}</div></div>
</section>

<section class="room-sec" data-room aria-labelledby="h-films">
<div class="sec-head"><h2 id="h-films">影像</h2><p>短片、Vlog 与幕后，在 B站 更新。</p></div>
${filmGrid()}
<p class="more-wrap"><a class="more" href="films.html">全部影像</a></p>
</section>

<section class="about-teaser" aria-labelledby="h-about">
<h2 id="h-about" class="sr-only">关于</h2>
<p class="big-quote">${esc(homeTeaser || about.intro[0] || '')}</p>
<p class="more-wrap"><a class="more" href="about.html">关于工作室</a></p>
</section>
</main>
${playerMarkup()}
${footer()}`;
}

// ── Works ───────────────────────────────────────────────────
function works() {
  const list = series
    .map((s, i) => `<article class="ws ${i % 2 ? 'ws-r' : ''}">
<a class="ws-img" href="${seriesHref(s)}" aria-label="进入系列 ${esc(s.zh)}">${picture(s.frames[0].src, { sizes: '(max-width: 860px) 92vw, 52vw', alt: s.frames[0].caption || '' })}</a>
<div class="ws-text"><h2><a href="${seriesHref(s)}">${esc(s.zh)}</a></h2><p class="ws-en">${esc(s.en)}</p><p class="ws-st">${esc(s.statement.zh)}</p><p class="ws-n">${s.frames.length} 格</p></div>
</article>`)
    .join('');
  const sheets = series
    .map((s) => {
      const cells = s.frames
        .map((f, i) => {
          const p = P(f.src);
          return `<a class="sc" href="${seriesHref(s)}#f${i + 1}" data-full="${p ? largest(p) : ''}" aria-label="${esc(s.zh)} 第 ${i + 1} 格">${picture(f.src, { sizes: '(max-width: 860px) 45vw, 18vw', alt: f.caption || '' })}<span class="sc-n">${i + 1}</span></a>`;
        })
        .join('');
      return `<section class="sheet"><h2>${esc(s.zh)}<span>${esc(s.en)}</span></h2><div class="sheet-grid">${cells}</div></section>`;
    })
    .join('');
  return `${head({ page: 'works', title: '作品', desc: `${site.title}的摄影系列：${series.map((s) => s.zh).join('、')}。` })}
<main id="main" class="works">
<header class="page-head"><h1 data-split><span class="line"><span>作品</span></span></h1>
<div class="toggle" role="group" aria-label="查看方式"><button type="button" aria-pressed="true" data-view="list">系列</button><button type="button" aria-pressed="false" data-view="sheet">印样</button></div>
${site.samples ? `<p class="sample-note">当前展示的是示例影像，${esc(site.name)} 的作品正在整理。</p>` : ''}
</header>
<div class="w-list" data-panel="list">${list}</div>
<div class="w-sheet" data-panel="sheet" hidden>${sheets}<div class="loupe" data-loupe aria-hidden="true"></div></div>
</main>
${footer()}`;
}

// ── Series ──────────────────────────────────────────────────
function seriesPage(s, i) {
  const next = series[(i + 1) % series.length];
  const fig = (f, n, cls) => {
    const p = P(f.src);
    const tall = p && p.h > p.w;
    const ew = p ? p.widths[p.widths.length - 1] : 0;
    const attrs = p ? ` href="${largest(p)}" data-pswp-width="${ew}" data-pswp-height="${Math.round((p.h * ew) / p.w)}" data-cap="${esc(f.caption || '')}" data-exif="${esc(exifText(p.exif))}" data-n="${n}"` : '';
    return `<figure class="fr ${cls}${tall ? ' is-tall' : ''}" id="f${n}" data-frame="${n}"${tall ? ` style="--maxw:calc(78vh * ${p.w} / ${p.h})"` : ''}><a class="fr-open"${attrs} aria-label="放大查看第 ${n} 格 ${esc(f.caption || '')}">${picture(f.src, { sizes: cls === 'fr-wide' ? '(max-width: 860px) 100vw, 80vw' : '(max-width: 860px) 100vw, 50vw', alt: f.caption || '', eager: n === 1 })}</a><figcaption>${edge(n)}<span class="cap">${esc(f.caption || '')}</span></figcaption></figure>`;
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
  const meta = [['画格', String(fr.length)], ...s.meta];
  return `${head({ page: 'series', title: s.zh, desc: s.statement.zh || site.description })}
<main id="main" class="series">
<header class="s-head">
<h1 class="s-title" data-split><span class="line"><span>${esc(s.zh)}</span></span></h1>
<p class="s-en">${esc(s.en)}</p>
<dl class="s-meta">${meta.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
</header>
${s.statement.zh || s.statement.en ? `<div class="s-statement">${s.statement.zh ? `<p class="zh" data-words>${esc(s.statement.zh)}</p>` : ''}${s.statement.en ? `<p class="en">${esc(s.statement.en)}</p>` : ''}</div>` : '<div class="s-gap"></div>'}
<div class="frames" data-gallery>${body}</div>
${series.length > 1 ? `<nav class="s-next" aria-label="下一个系列"><a href="${seriesHref(next)}"><span class="k">下一卷</span><span class="s-next-txt"><span class="t">${esc(next.zh)}</span><span class="e">${esc(next.en)}</span></span>${picture(next.frames[0].src, { sizes: '(max-width: 860px) 92vw, 40vw' })}</a></nav>` : ''}
<p class="counter" aria-hidden="true" data-counter><span data-cur>1</span><span class="of">/ ${fr.length}</span></p>
</main>
${footer()}`;
}

// ── Films ───────────────────────────────────────────────────
function filmsPage() {
  return `${head({ page: 'films', title: '影像', desc: `${site.title}的短片、Vlog 与幕后。`, theme: 'room' })}
<main id="main" class="films-page">
<header class="page-head"><h1 data-split><span class="line"><span>影像</span></span></h1><p class="lede">短片、Vlog 与幕后，在 B站 更新。点开即可在这里播放。</p></header>
${filmGrid('h2')}
</main>
${playerMarkup()}
${footer()}`;
}

// ── About ───────────────────────────────────────────────────
function aboutPage() {
  return `${head({ page: 'about', title: '关于', desc: about.intro[0] || site.description })}
<main id="main" class="about">
<header class="page-head"><h1 data-split><span class="line"><span>关于</span></span></h1></header>
<div class="ab-grid">
<div class="ab-moon" data-about-moon>${moonSVG({ id: 'am', cls: 'ab-svg' })}</div>
<div class="ab-text">${about.intro.map((t) => `<p>${esc(t)}</p>`).join('')}</div>
</div>
${about.services.length ? `<section class="ab-services" aria-labelledby="h-svc"><h2 id="h-svc">可以一起做的事</h2>
<dl>${about.services.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl></section>` : ''}
<section class="ab-contact" aria-labelledby="h-ct"><h2 id="h-ct">联系</h2>
<p class="ab-lede">告诉我们想拍什么、在哪里、大概什么时候，我们会尽快回复。</p>
<div class="ab-ways">
${contactLines(true)}
</div>
${contact.email ? `<p class="ab-hint">点击即可复制。也可以直接<a href="mailto:${esc(contact.email)}">写一封邮件</a>。</p>` : ''}
</section>
</main>
${footer({ compact: true })}`;
}

function notFound() {
  return `${head({ page: 'nf', title: '没有找到', desc: '页面不存在' })}
<main id="main" class="nf">
<div class="nf-moon">${moonSVG({ id: 'nm', cls: 'nf-svg' })}</div>
<h1>这里只有夜色。</h1>
<p>你要找的页面不在这卷胶片里。</p>
<p><a class="more" href="index.html">回到首页</a></p>
</main>
${footer({ compact: true })}`;
}

const out = path.join(ROOT, 'site');
const pages = {
  'index.html': home(),
  'works.html': works(),
  'films.html': filmsPage(),
  'about.html': aboutPage(),
  '404.html': notFound(),
};
series.forEach((s, i) => (pages[seriesHref(s)] = seriesPage(s, i)));
for (const f of (await fs.readdir(out)).filter((f) => f.endsWith('.html'))) await fs.unlink(path.join(out, f));
for (const [f, html] of Object.entries(pages)) await fs.writeFile(path.join(out, f), html);
console.log('pages:', Object.keys(pages).join(' '));
