// Writes the static HTML pages into site/ from content/site.mjs and content/photos.json.
import fs from 'node:fs/promises';
import path from 'node:path';
import { site, contact, socials, series, films, about } from '../content/site.mjs';
import { moonSVG } from './moon.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const photos = JSON.parse(await fs.readFile(path.join(ROOT, 'content/photos.json'), 'utf8'));

const esc = (s = '') => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const seriesHref = (s) => `series-${s.slug}.html`;

function photo(slug, n) {
  const p = (photos[slug] || [])[n - 1];
  if (!p) throw new Error(`missing photo ${slug}/${n}`);
  return p;
}

function picture(slug, n, { sizes = '100vw', alt = '', cls = '', eager = false } = {}) {
  const p = photo(slug, n);
  const set = (ext) => p.widths.map((w) => `photos/${slug}/${p.base}-${w}.${ext} ${w}w`).join(', ');
  const fallback = `photos/${slug}/${p.base}-${p.widths[p.widths.length - 1]}.jpg`;
  return `<picture class="ph ${cls}" style="--ar:${p.w}/${p.h};--pc:${p.color}"><source type="image/webp" srcset="${set('webp')}" sizes="${sizes}"><img class="dev" src="${fallback}" srcset="${set('jpg')}" sizes="${sizes}" width="${p.w}" height="${p.h}" alt="${esc(alt)}" loading="${eager ? 'eager' : 'lazy'}" decoding="async"></picture>`;
}

const edge = (n) => `<span class="edge">${site.edgeCode}<i>▸ ${n}</i><i>${n}A</i></span>`;

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
<a class="brand" href="index.html" aria-label="${site.title} 首页">${moonSVG({ id: 'hm', cls: 'brand-moon' })}<span class="brand-en">${site.name}</span><span class="brand-zh">${site.nameZh}</span></a>
<nav class="nav" aria-label="主导航">${link('works.html', '作品', 'works')}${link('films.html', '影像', 'films')}${link('about.html', '关于', 'about')}</nav>
</header>`;
}

function footer() {
  const soc = socials.filter((s) => s.url);
  return `<footer class="ftr" data-ftr>
<div class="ftr-inner">
<div class="ftr-moon">${moonSVG({ id: 'fm', cls: 'ftr-svg' })}</div>
<div class="ftr-main">
<p class="ftr-word"><span class="fw-en">${site.name}</span><span class="fw-zh">${site.nameZh}</span></p>
<div class="ftr-contact">
<p><span class="k">微信</span><button type="button" class="copy" data-copy="${esc(contact.wechat)}">${esc(contact.wechat)}</button></p>
<p><span class="k">邮箱</span><button type="button" class="copy" data-copy="${esc(contact.email)}">${esc(contact.email)}</button></p>
${soc.length ? `<p class="ftr-soc">${soc.map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a>`).join('')}</p>` : ''}
</div>
<p class="ftr-copy">${esc(contact.copyright)}</p>
${site.samples ? `<p class="ftr-credit">${esc(site.sampleCredit)}</p>` : ''}
</div>
</div>
<p class="sr-only" aria-live="polite" data-live></p>
</footer>
</body>
</html>`;
}

// ── Home ────────────────────────────────────────────────────
function home() {
  const totalFrames = series.reduce((a, s) => a + photos[s.slug].length, 0);
  const list = series
    .map((s) => {
      const p = photo(s.slug, 1);
      const cover = `photos/${s.slug}/${p.base}-${p.widths[0]}.webp`;
      return `<li><a href="${seriesHref(s)}" data-cover="${cover}" data-ar="${p.w}/${p.h}"><span class="sl-zh">${esc(s.zh)}</span><span class="sl-en">${esc(s.en)}</span><span class="sl-n">${photos[s.slug].length} 格</span></a></li>`;
    })
    .join('');
  let k = 0;
  const picks = series.flatMap((s) => photos[s.slug].slice(0, 4).map((p) => [s, p.n]));
  const strip = picks
    .map(([s, n]) => {
      k += 1;
      return `<figure class="sf"><a href="${seriesHref(s)}#f${n}" aria-label="${esc(s.zh)} 第 ${n} 格">${picture(s.slug, n, { sizes: '(max-width: 760px) 70vw, 34vw', alt: s.frames[n - 1]?.caption || '' })}</a><figcaption>${edge(k)}</figcaption></figure>`;
    })
    .join('');
  return `${head({ page: 'home', title: '' })}
<div class="pre" data-pre aria-hidden="true">
<div class="pre-moon">${moonSVG({ id: 'pm', cls: 'pre-svg' })}</div>
<p class="pre-word"><span>${site.name}</span><span>${site.nameZh}</span></p>
</div>
<main id="main">
<section class="hero" data-hero>
<div class="hero-moon" data-hero-moon>${moonSVG({ id: 'hero', cls: 'hero-svg', label: 'Quietime 月亮标志' })}</div>
<div class="hero-text">
<h1 class="hero-title"><span class="sr-only">${site.title}：</span>${site.statement.zh.map((l) => `<span class="line"><span>${esc(l)}</span></span>`).join('')}</h1>
<p class="hero-en">${esc(site.statement.en)}</p>
</div>
<p class="hero-cue" aria-hidden="true"><span class="cue-dot"></span>向下</p>
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
${playerMarkup()}

<section class="about-teaser" aria-labelledby="h-about">
<h2 id="h-about" class="sr-only">关于</h2>
<p class="big-quote">${esc(about.intro[0])}</p>
<p class="more-wrap"><a class="more" href="about.html">关于工作室</a></p>
</section>
</main>
${footer()}`;
}

function playerMarkup() {
  return `<div class="player" data-player hidden role="dialog" aria-modal="true" aria-label="视频播放">
<div class="player-box"><div class="player-frame" data-player-frame></div>
<div class="player-bar"><a data-player-link href="#" target="_blank" rel="noopener">在 B站 打开</a><button type="button" data-player-close>关闭</button></div></div>
</div>`;
}

function filmGrid() {
  return `<div class="film-grid">${films
    .map((f) => {
      const [slug, n] = f.still.split('/');
      const ready = Boolean(f.bvid);
      return `<article class="film">
<button type="button" class="film-btn" ${ready ? `data-bvid="${esc(f.bvid)}"` : 'aria-disabled="true"'} aria-label="${ready ? '播放' : '整理中'}：${esc(f.zh)}">${picture(slug, +n, { sizes: '(max-width: 760px) 92vw, 30vw', alt: '' })}<span class="film-state">${ready ? '播放' : '整理中'}</span></button>
<h3>${esc(f.zh)}</h3><p>${esc(f.en)}<span>${esc(f.kind)}</span></p>
</article>`;
    })
    .join('')}</div>`;
}

// ── Works ───────────────────────────────────────────────────
function works() {
  const list = series
    .map((s, i) => {
      const n = photos[s.slug].length;
      return `<article class="ws ${i % 2 ? 'ws-r' : ''}">
<a class="ws-img" href="${seriesHref(s)}" aria-label="进入系列 ${esc(s.zh)}">${picture(s.slug, 1, { sizes: '(max-width: 760px) 92vw, 52vw', alt: s.frames[0]?.caption || '' })}</a>
<div class="ws-text"><h2><a href="${seriesHref(s)}">${esc(s.zh)}</a></h2><p class="ws-en">${esc(s.en)}</p><p class="ws-st">${esc(s.statement.zh)}</p><p class="ws-n">${n} 格</p></div>
</article>`;
    })
    .join('');
  const sheets = series
    .map((s) => {
      const cells = photos[s.slug]
        .map(
          (p) =>
            `<a class="sc" href="${seriesHref(s)}#f${p.n}" data-full="photos/${s.slug}/${p.base}-${p.widths[p.widths.length - 1]}.webp" aria-label="${esc(s.zh)} 第 ${p.n} 格">${picture(s.slug, p.n, { sizes: '(max-width: 760px) 45vw, 18vw', alt: s.frames[p.n - 1]?.caption || '' })}<span class="sc-n">${p.n}</span></a>`,
        )
        .join('');
      return `<section class="sheet"><h2>${esc(s.zh)}<span>${esc(s.en)}</span></h2><div class="sheet-grid">${cells}</div></section>`;
    })
    .join('');
  return `${head({ page: 'works', title: '作品', desc: `Quietime 静夜工作室的摄影系列：${series.map((s) => s.zh).join('、')}。` })}
<main id="main" class="works">
<header class="page-head"><h1>作品</h1>
<div class="toggle" role="group" aria-label="查看方式"><button type="button" aria-pressed="true" data-view="list">系列</button><button type="button" aria-pressed="false" data-view="sheet">印样</button></div>
</header>
${site.samples ? `<p class="sample-note">当前展示的是示例影像，Quietime 的作品正在整理。</p>` : ''}
<div class="w-list" data-panel="list">${list}</div>
<div class="w-sheet" data-panel="sheet" hidden>${sheets}<div class="loupe" data-loupe aria-hidden="true"></div></div>
</main>
${footer()}`;
}

// ── Series ──────────────────────────────────────────────────
function seriesPage(s, i) {
  const list = photos[s.slug];
  const next = series[(i + 1) % series.length];
  const data = list.map((p) => ({
    src: `photos/${s.slug}/${p.base}-${p.widths[p.widths.length - 1]}.webp`,
    w: p.w,
    h: p.h,
    cap: s.frames[p.n - 1]?.caption || '',
    exif: p.exif,
  }));
  let body = '';
  for (let k = 0; k < list.length; k++) {
    const p = list[k];
    const f = s.frames[k] || { layout: 'right', caption: '' };
    const fig = (q, fr, cls) =>
      `<figure class="fr ${cls}${q.h > q.w ? ' is-tall' : ''}" id="f${q.n}" data-frame="${q.n}"${q.h > q.w ? ` style="--maxw:calc(78vh * ${q.w} / ${q.h})"` : ''}><button type="button" class="fr-open" data-lb="${q.n - 1}" aria-label="放大查看第 ${q.n} 格 ${esc(fr.caption)}">${picture(s.slug, q.n, { sizes: cls === 'fr-wide' ? '(max-width: 760px) 100vw, 80vw' : '(max-width: 760px) 100vw, 50vw', alt: fr.caption, eager: k === 0 })}</button><figcaption>${edge(q.n)}<span class="cap">${esc(fr.caption)}</span></figcaption></figure>`;
    if (f.layout === 'pair' && list[k + 1] && (s.frames[k + 1] || {}).layout === 'pair') {
      body += `<div class="fr-pair">${fig(p, f, 'fr-p')}${fig(list[k + 1], s.frames[k + 1], 'fr-p')}</div>`;
      k += 1;
    } else {
      body += fig(p, f, `fr-${f.layout === 'pair' ? 'right' : f.layout}`);
    }
  }
  return `${head({ page: 'series', title: s.zh, desc: s.statement.zh })}
<main id="main" class="series">
<header class="s-head">
<h1 class="s-title"><span class="line"><span>${esc(s.zh)}</span></span></h1>
<p class="s-en">${esc(s.en)}</p>
<dl class="s-meta">${s.meta.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
</header>
<div class="s-statement"><p class="zh" data-words>${esc(s.statement.zh)}</p><p class="en">${esc(s.statement.en)}</p></div>
${site.samples ? `<p class="sample-note">示例影像，Quietime 的作品正在整理。</p>` : ''}
<div class="frames">${body}</div>
<nav class="s-next" aria-label="下一个系列"><a href="${seriesHref(next)}"><span class="k">下一卷</span><span class="t">${esc(next.zh)}</span><span class="e">${esc(next.en)}</span>${picture(next.slug, 1, { sizes: '(max-width: 760px) 92vw, 40vw', alt: '' })}</a></nav>
<p class="counter" aria-hidden="true" data-counter><span data-cur>1</span><span class="of">/ ${list.length}</span></p>
</main>
<script type="application/json" id="frames-data">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>
${footer()}`;
}

// ── Films ───────────────────────────────────────────────────
function filmsPage() {
  return `${head({ page: 'films', title: '影像', desc: 'Quietime 静夜工作室的短片、Vlog 与幕后。', theme: 'room' })}
<main id="main" class="films-page">
<header class="page-head"><h1>影像</h1><p class="lede">短片、Vlog 与幕后，在 B站 更新。点开即可在这里播放。</p></header>
${filmGrid()}
</main>
${playerMarkup()}
${footer()}`;
}

// ── About ───────────────────────────────────────────────────
function aboutPage() {
  return `${head({ page: 'about', title: '关于', desc: about.intro[0] })}
<main id="main" class="about">
<header class="page-head"><h1>关于</h1></header>
<div class="ab-grid">
<div class="ab-moon" data-about-moon>${moonSVG({ id: 'am', cls: 'ab-svg' })}</div>
<div class="ab-text">${about.intro.map((t) => `<p>${esc(t)}</p>`).join('')}</div>
</div>
<section class="ab-services" aria-labelledby="h-svc"><h2 id="h-svc">可以一起做的事</h2>
<dl>${about.services.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl></section>
<section class="ab-contact" aria-labelledby="h-ct"><h2 id="h-ct">联系</h2>
<p class="ab-lede">告诉我们想拍什么、在哪里、大概什么时候，我们会在两天内回复。</p>
<div class="ab-ways">
<p><span class="k">微信</span><button type="button" class="copy big" data-copy="${esc(contact.wechat)}">${esc(contact.wechat)}</button></p>
<p><span class="k">邮箱</span><button type="button" class="copy big" data-copy="${esc(contact.email)}">${esc(contact.email)}</button></p>
</div>
<p class="ab-hint">点击即可复制。也可以直接<a href="mailto:${esc(contact.email)}">写一封邮件</a>。</p>
</section>
</main>
${footer()}`;
}

function notFound() {
  return `${head({ page: 'nf', title: '没有找到', desc: '页面不存在' })}
<main id="main" class="nf">
<div class="nf-moon">${moonSVG({ id: 'nm', cls: 'nf-svg' })}</div>
<h1>这里只有夜色。</h1>
<p>你要找的页面不在这卷胶片里。</p>
<p><a class="more" href="index.html">回到首页</a></p>
</main>
${footer()}`;
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
