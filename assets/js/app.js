/* Portfólio Kauan — JavaScript puro: shorts (TikTok), vídeos do YouTube, filtros, busca,
   player em modal, tema, menu mobile, animações. Sem bibliotecas externas. */
(() => {
'use strict';

const $ = (sel) => document.querySelector(sel);
const FALLBACK = JSON.parse($('#fallback-projects').textContent);
let projects = FALLBACK.slice();
let filter = 'todos';
let lastFocus = null;
let toastTimer;

/* ---------- Utilidades ---------- */
const el = (tag, props = {}, ...children) => {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children.filter(Boolean));
  return node;
};
const pad = (n) => String(n).padStart(2, '0');
const fmtViews = (n) => n >= 1e6 ? (n / 1e6).toFixed(1).replace('.', ',').replace(',0', '') + 'M'
  : n >= 1e3 ? (n >= 1e5 ? Math.round(n / 1e3) : (n / 1e3).toFixed(1).replace('.', ',').replace(',0', '')) + 'K'
  : String(n);
const sumViews = (list) => list.reduce((s, p) => s + (p.views || 0), 0);
const isShort = (p) => p.platform === 'tiktok';
const watchUrl = (p) => isShort(p)
  ? `https://www.tiktok.com/@${encodeURIComponent(p.author || '')}/video/${encodeURIComponent(p.videoId)}`
  : `https://www.youtube.com/watch?v=${encodeURIComponent(p.videoId)}`;
const embedUrl = (p) => isShort(p)
  ? `https://www.tiktok.com/player/v1/${encodeURIComponent(p.videoId)}?embed_from=oembed&music_info=1&description=1&autoplay=1`
  : `https://www.youtube-nocookie.com/embed/${encodeURIComponent(p.videoId)}?autoplay=1&rel=0`;

function notify(message) {
  const t = $('#toast');
  t.textContent = message;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}
async function copyText(value) {
  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(value);
    else {
      const n = el('textarea', { value });
      n.style.cssText = 'position:fixed;opacity:0';
      document.body.append(n); n.select();
      const ok = document.execCommand('copy'); n.remove();
      if (!ok) throw new Error('copy');
    }
    notify('Copiado para a área de transferência.');
  } catch { notify('Não foi possível copiar. Selecione o texto manualmente.'); }
}

/* ---------- Shorts (TikTok) ---------- */
const GRADIENTS = [
  'linear-gradient(160deg,#0f3a4a,#0a0f1c 70%)',
  'linear-gradient(160deg,#3a1d5c,#0a0f1c 70%)',
  'linear-gradient(160deg,#4a1630,#0a0f1c 70%)',
  'linear-gradient(160deg,#173d2a,#0a0f1c 70%)',
  'linear-gradient(160deg,#3d3214,#0a0f1c 70%)'
];
function shortCard(p, i) {
  const card = el('article', { className: 'short reveal is-visible' });
  card.style.setProperty('--g', GRADIENTS[i % GRADIENTS.length]);
  const bg = el('div', { className: 'short-bg' });
  if (p.thumbnail) {
    const img = el('img', { src: p.thumbnail, alt: '', loading: 'lazy', referrerPolicy: 'no-referrer' });
    img.addEventListener('error', () => img.remove());
    bg.append(img);
  }
  const deco = p.thumbnail ? null : el('div', { className: 'short-deco', textContent: pad(i + 1), ariaHidden: 'true' });
  const btn = el('button', { className: 'short-btn', type: 'button' },
    el('div', { className: 'short-top' },
      el('span', { className: 'chip', textContent: '♪ TikTok' }),
      p.views
        ? el('span', { className: 'chip chip-views', textContent: `👁 ${fmtViews(p.views)}`, title: `${p.views.toLocaleString('pt-BR')} visualizações` })
        : el('span', { className: 'short-num', textContent: `#${pad(i + 1)}` })),
    el('span', { className: 'short-play', textContent: '▶', ariaHidden: 'true' }),
    el('div', { className: 'short-meta' },
      el('small', { textContent: p.categoryLabel || 'TikTok' }),
      el('span', { className: 'short-title', textContent: p.status === 'confirmado' ? p.title : 'Edição de vídeo curto · 9:16' }),
      el('strong', { textContent: p.author ? `@${p.author}` : 'TikTok' })));
  btn.setAttribute('aria-label', `Assistir short: ${p.title}`);
  btn.addEventListener('click', () => openVideo(p));
  card.append(...[bg, deco, btn].filter(Boolean));
  return card;
}
function renderShorts() {
  const shorts = projects.filter(isShort);
  $('#shorts-grid').replaceChildren(...shorts.map(shortCard));
  updateRailButtons();
}

/* Carrossel */
const rail = $('#shorts-grid');
const prevBtn = $('#shorts-prev');
const nextBtn = $('#shorts-next');
function updateRailButtons() {
  const max = rail.scrollWidth - rail.clientWidth - 2;
  prevBtn.disabled = rail.scrollLeft <= 2;
  nextBtn.disabled = rail.scrollLeft >= max;
}
const step = () => (rail.firstElementChild?.getBoundingClientRect().width || 240) + 18;
prevBtn.addEventListener('click', () => rail.scrollBy({ left: -step(), behavior: 'smooth' }));
nextBtn.addEventListener('click', () => rail.scrollBy({ left: step(), behavior: 'smooth' }));
rail.addEventListener('scroll', updateRailButtons, { passive: true });
window.addEventListener('resize', updateRailButtons);

/* ---------- YouTube ---------- */
function projectCard(p, index) {
  const poster = el('div', { className: 'poster' });
  const img = el('img', {
    loading: 'lazy',
    alt: `Miniatura do vídeo: ${p.title}`,
    src: `https://i.ytimg.com/vi/${encodeURIComponent(p.videoId)}/hqdefault.jpg`
  });
  img.addEventListener('error', () => { img.src = `assets/img/${p.poster || 'projeto04.svg'}`; }, { once: true });
  const play = el('button', { className: 'play', type: 'button' }, el('span', { className: 'play-ico', textContent: '▶', ariaHidden: 'true' }));
  play.setAttribute('aria-label', `Assistir: ${p.title}`);
  play.addEventListener('click', () => openVideo(p));
  poster.append(img, play, el('span', { className: 'chip', textContent: '▶ YouTube' }));

  const copy = el('button', { className: 'copy-link', type: 'button', textContent: 'Copiar link' });
  copy.addEventListener('click', () => copyText(watchUrl(p)));
  const body = el('div', { className: 'project-body' },
    el('div', { className: 'project-kicker' },
      el('span', { textContent: `Projeto ${pad(index + 1)}` }),
      el('span', { textContent: p.views ? `${p.categoryLabel} · ${fmtViews(p.views)} views` : p.categoryLabel })),
    el('h3', { textContent: p.title }),
    el('div', { className: 'project-bottom' },
      el('a', { className: 'ext-link', href: watchUrl(p), target: '_blank', rel: 'noopener noreferrer', textContent: 'Abrir no YouTube ↗' }),
      copy));
  return el('article', { className: 'project' }, poster, body);
}
const search = $('#project-search');
const chips = [...document.querySelectorAll('[data-filter]')];
function renderYoutube() {
  const term = search.value.toLocaleLowerCase('pt-BR').trim();
  const long = projects.filter((p) => !isShort(p));
  const visible = long.filter((p) =>
    (filter === 'todos' || p.category === filter) &&
    [p.title, p.categoryLabel].some((t) => String(t).toLocaleLowerCase('pt-BR').includes(term)));
  $('#project-grid').replaceChildren(...visible.map((p) => projectCard(p, long.indexOf(p))));
  $('#empty-results').hidden = visible.length !== 0;
}
function render() {
  renderShorts();
  renderYoutube();
  const vs = fmtViews(sumViews(projects.filter(isShort))) + '+';
  const vl = fmtViews(sumViews(projects.filter((p) => !isShort(p)))) + '+';
  $('#stat-views-short').textContent = vs; $('#total-views-short').textContent = vs;
  $('#stat-views-long').textContent = vl; $('#total-views-long').textContent = vl;
}
chips.forEach((chip) => chip.addEventListener('click', () => {
  filter = chip.dataset.filter;
  chips.forEach((b) => b.setAttribute('aria-pressed', String(b === chip)));
  renderYoutube();
}));
search.addEventListener('input', renderYoutube);
$('#random-project').addEventListener('click', () => {
  if (projects.length) openVideo(projects[Math.floor(Math.random() * projects.length)]);
});

/* ---------- Modal ---------- */
const modal = $('#video-modal');
const modalBox = $('#modal-box');
const modalPlayer = $('#modal-player');
const modalClose = $('#modal-close');
function openVideo(p) {
  lastFocus = document.activeElement;
  $('#modal-title').textContent = isShort(p) ? `@${p.author} · TikTok` : p.title;
  const ext = $('#modal-external');
  ext.href = watchUrl(p);
  ext.textContent = isShort(p) ? 'Abrir no TikTok ↗' : 'Abrir no YouTube ↗';
  modalBox.classList.toggle('vertical', isShort(p));
  const iframe = el('iframe', {
    src: embedUrl(p),
    allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen',
    allowFullscreen: true,
    title: `Vídeo: ${p.title}`,
    referrerPolicy: 'strict-origin-when-cross-origin'
  });
  modalPlayer.replaceChildren(iframe);
  modal.hidden = false;
  document.body.classList.add('no-scroll');
  modalClose.focus();
}
function closeVideo() {
  modal.hidden = true;
  modalPlayer.replaceChildren();
  document.body.classList.remove('no-scroll');
  lastFocus?.focus?.();
}
modalClose.addEventListener('click', closeVideo);
modal.addEventListener('click', (e) => { if (e.target === modal) closeVideo(); });
document.addEventListener('keydown', (e) => {
  if (modal.hidden) return;
  if (e.key === 'Escape') closeVideo();
  if (e.key === 'Tab') { // mantém o foco dentro do modal
    const f = [...modal.querySelectorAll('button, a[href], iframe')];
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});

/* ---------- Tema ---------- */
const themeBtn = $('#theme-toggle');
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeBtn.textContent = theme === 'dark' ? '☀' : '☾';
  themeBtn.title = theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro';
  document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#06090f' : '#f4f7fb';
}
applyTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');
themeBtn.addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  try { localStorage.setItem('kauan-theme', next); } catch {}
});

/* ---------- Menu mobile ---------- */
const nav = $('#nav');
const menuBtn = $('#menu-toggle');
function setMenu(open) {
  nav.classList.toggle('open', open);
  menuBtn.setAttribute('aria-expanded', String(open));
  menuBtn.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
}
menuBtn.addEventListener('click', () => setMenu(!nav.classList.contains('open')));
nav.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });

/* ---------- Scroll: progresso, header, link ativo ---------- */
const progress = $('#scroll-progress');
const topbar = $('#topbar');
let ticking = false;
function onScroll() {
  const max = document.documentElement.scrollHeight - innerHeight;
  progress.style.width = (max > 0 ? (scrollY / max) * 100 : 0) + '%';
  topbar.classList.toggle('scrolled', scrollY > 10);
  ticking = false;
}
addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
onScroll();

const navLinks = [...nav.querySelectorAll('a[href^="#"]')];
if ('IntersectionObserver' in window) {
  const spy = new IntersectionObserver((entries) => entries.forEach((en) => {
    if (en.isIntersecting) navLinks.forEach((a) => a.classList.toggle('active', a.getAttribute('href') === '#' + en.target.id));
  }), { rootMargin: '-45% 0px -50% 0px' });
  document.querySelectorAll('main section[id]').forEach((s) => spy.observe(s));

  const reveal = new IntersectionObserver((entries) => entries.forEach((en) => {
    if (en.isIntersecting) { en.target.classList.add('is-visible'); reveal.unobserve(en.target); }
  }), { threshold: 0.08 });
  document.querySelectorAll('.reveal').forEach((n) => reveal.observe(n));
} else {
  document.querySelectorAll('.reveal').forEach((n) => n.classList.add('is-visible'));
}

/* Brilho que segue o mouse nos cards de serviço */
document.querySelectorAll('.service').forEach((card) => card.addEventListener('pointermove', (e) => {
  const r = card.getBoundingClientRect();
  card.style.setProperty('--mx', `${e.clientX - r.left}px`);
  card.style.setProperty('--my', `${e.clientY - r.top}px`);
}));

/* ---------- Hero: legenda animada + forma de onda ---------- */
const words = [...document.querySelectorAll('.caption-demo span')];
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (words.length) {
  if (reduce) words.forEach((w) => w.classList.add('on'));
  else {
    let tick = 0; // mostra palavra por palavra e segura a frase completa por alguns ciclos
    setInterval(() => {
      if (tick === 0) words.forEach((x) => x.classList.remove('on'));
      if (tick < words.length) words[tick].classList.add('on');
      tick = (tick + 1) % (words.length + 4);
    }, 420);
  }
}
const wave = document.querySelector('.tl-row.wave');
if (wave) for (let i = 0; i < 64; i++) {
  const b = document.createElement('b');
  b.style.setProperty('--h', `${20 + Math.abs(Math.sin(i * 0.55) * Math.cos(i * 0.17)) * 80}%`);
  wave.append(b);
}

/* ---------- Contato / rodapé ---------- */
$('#copy-whatsapp').addEventListener('click', () => copyText('22996003777'));
$('#year').textContent = String(new Date().getFullYear());

/* ---------- Dados ---------- */
render();

// Rodando pelo servidor Java ou Python, os dados vêm da API /api/projects.
if (location.protocol.startsWith('http')) {
  fetch('/api/projects', { cache: 'no-store' })
    .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
    .then((data) => {
      if (Array.isArray(data) && data.length && data.every((x) => typeof x.videoId === 'string' && typeof x.title === 'string')) {
        projects = data; render(); enrich();
      }
    })
    .catch(() => {});
}

// Busca título/miniatura reais via oEmbed (TikTok e noembed para YouTube). Se falhar, mantém o que já existe.
async function getJSON(url, ms = 4000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try { const r = await fetch(url, { signal: c.signal }); return r.ok ? await r.json() : null; }
  catch { return null; } finally { clearTimeout(t); }
}
let enriching = false;
async function enrich() {
  if (enriching || !navigator.onLine) return;
  enriching = true;
  const pending = projects.filter((p) => p.status === 'pendente' || (isShort(p) && !p.thumbnail));
  await Promise.all(pending.map(async (p) => {
    const api = isShort(p)
      ? 'https://www.tiktok.com/oembed?url=' + encodeURIComponent(watchUrl(p))
      : 'https://noembed.com/embed?url=' + encodeURIComponent(watchUrl(p));
    const d = await getJSON(api);
    if (!d || d.error) return;
    if (typeof d.title === 'string' && d.title.trim()) {
      p.title = d.title.trim().replace(/\s+/g, ' ').slice(0, 140);
      p.status = 'confirmado';
    }
    if (isShort(p) && typeof d.thumbnail_url === 'string' && d.thumbnail_url.startsWith('https://')) p.thumbnail = d.thumbnail_url;
    if (isShort(p) && !p.author && d.author_unique_id) p.author = d.author_unique_id;
  }));
  enriching = false;
  render();
}
enrich();
})();
