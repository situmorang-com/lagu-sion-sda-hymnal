/* Lagu Sion + SDA Hymnal — client */

const $ = sel => document.querySelector(sel);

const els = {
  q: $('#q'),
  stats: $('#stats'),
  heroStats: $('#heroStats'),
  home: $('#home'),
  results: $('#results'),
  resultsList: $('#resultsList'),
  resultsCount: $('#resultsCount'),
  detail: $('#detail'),
  browseList: $('#browseList'),
  browseHeading: $('#browseHeading'),
  onlyPaired: $('#onlyPaired'),
  scopebar: $('#scopebar'),
  themeBtn: $('#themeBtn'),
  randomBtn: $('#randomBtn')
};

// One scope drives both the search and the index below it.
const state = {
  scope: 'all',
  lists: { ls: null, sda: null },
  searchSeq: 0
};

const BOOKS = {
  ls:  { label: 'Lagu Sion',  full: 'Lagu Sion (Edisi Baru)' },
  sda: { label: 'SDA Hymnal', full: 'SDA Hymnal' }
};

const booksInScope = () => (state.scope === 'all' ? ['ls', 'sda'] : [state.scope]);

/** Does this row have a counterpart in the other book? */
const isPaired = row => (row.kind === 'ls' ? row.sda_hymnal_num : row.ls_num);

/* ------------------------------------------------------------------ util */

const api = url => fetch(url).then(r => {
  if (!r.ok) return r.json().then(e => Promise.reject(new Error(e.error || r.statusText)));
  return r.json();
});

/** Build an element. Text is set via textContent, so data can never inject markup. */
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function show(view) {
  for (const v of [els.home, els.results, els.detail]) v.classList.add('hidden');
  view.classList.remove('hidden');
}

function spinner(container) {
  container.replaceChildren(el('div', 'spinner'));
}

function empty(container, message) {
  container.replaceChildren(el('div', 'empty', message));
}

/* ----------------------------------------------------------------- cards */

function card(item) {
  const isLs = item.kind !== 'sda';
  const node = el('button', 'card');
  node.type = 'button';

  const num = el('span', `num ${isLs ? 'ls' : 'sda'}`, isLs ? 'LS ' : 'SDA ');
  num.append(el('b', null, String(item.number)));
  node.append(num);

  const body = el('div', 'card-body');
  body.append(el('div', 'card-title', item.title || 'Untitled'));

  // On the hymnal side first_line is the opening line of the preview, so the
  // preview replaces it rather than repeating it.
  if (isLs && item.english_title) body.append(el('div', 'card-sub', item.english_title));
  const opening = item.preview || (!isLs ? item.first_line : null);
  if (opening) body.append(el('div', 'card-preview', opening));

  const meta = el('div', 'card-meta');
  if (item.composer) meta.append(el('span', null, item.composer));
  if (!isLs && item.verse_count) {
    meta.append(el('span', null, `${item.verse_count} verse${item.verse_count > 1 ? 's' : ''}`));
  }
  // The cross-reference reads both ways: LS rows point at the hymnal, and
  // hymnal rows point back at Lagu Sion.
  if (isLs && item.sda_hymnal_num) {
    meta.append(el('span', 'pair-chip sda', `SDA ${item.sda_hymnal_num}`));
  }
  if (!isLs && item.ls_num) {
    const extra = item.ls_count > 1 ? ` +${item.ls_count - 1}` : '';
    meta.append(el('span', 'pair-chip ls', `LS ${item.ls_num} · ${item.ls_title}${extra}`));
  }
  if (meta.childElementCount) body.append(meta);

  node.append(body);
  node.addEventListener('click', () => {
    location.hash = `#/${isLs ? 'ls' : 'sda'}/${item.number}`;
  });
  return node;
}

function renderCards(container, items, emptyMessage) {
  if (!items.length) return empty(container, emptyMessage);
  const frag = document.createDocumentFragment();
  for (const item of items) frag.append(card(item));
  container.replaceChildren(frag);
}

/* ---------------------------------------------------------------- search */

let searchTimer;

function onSearchInput() {
  clearTimeout(searchTimer);
  const q = els.q.value.trim();
  if (!q) {
    show(els.home);
    return;
  }
  show(els.results);
  spinner(els.resultsList);
  searchTimer = setTimeout(() => runSearch(q), 200);
}

function runSearch(q) {
  const seq = ++state.searchSeq;
  els.resultsCount.textContent = 'Searching…';
  api(`/api/search?q=${encodeURIComponent(q)}&scope=${state.scope}`)
    .then(data => {
      if (seq !== state.searchSeq) return; // a newer keystroke won
      els.resultsCount.textContent =
        `${data.count} result${data.count === 1 ? '' : 's'} for “${data.query}”`;
      renderCards(els.resultsList, data.results, `Nothing found for “${q}”`);
    })
    .catch(err => {
      if (seq !== state.searchSeq) return;
      els.resultsCount.textContent = '';
      empty(els.resultsList, `Search failed: ${err.message}`);
    });
}

/* ---------------------------------------------------------------- browse */

function loadBrowse() {
  const missing = booksInScope().filter(b => !state.lists[b]);
  if (!missing.length) return renderBrowse();
  spinner(els.browseList);
  Promise.all(missing.map(book =>
    api(book === 'ls' ? '/api/songs' : '/api/sda')
      .then(data => { state.lists[book] = data.songs.map(s => ({ ...s, kind: book })); })))
    .then(renderBrowse)
    .catch(err => empty(els.browseList, `Could not load list: ${err.message}`));
}

function renderBrowse() {
  const books = booksInScope();
  const onlyPaired = els.onlyPaired.checked;
  const groups = books.map(book => {
    const rows = state.lists[book] || [];
    return { book, rows: onlyPaired ? rows.filter(isPaired) : rows };
  });

  const total = groups.reduce((n, g) => n + g.rows.length, 0);
  els.browseHeading.textContent = onlyPaired
    ? `Browse · ${total} cross-referenced`
    : `Browse · ${total}`;

  if (!total) return empty(els.browseList, 'Nothing to show');

  const frag = document.createDocumentFragment();
  for (const g of groups) {
    // Only label the sections when both books are on screen at once.
    if (groups.length > 1) {
      const head = el('div', 'group-head');
      head.append(el('span', null, BOOKS[g.book].full));
      head.append(el('span', 'group-count', String(g.rows.length)));
      frag.append(head);
    }
    for (const item of g.rows) frag.append(card(item));
  }
  els.browseList.replaceChildren(frag);
}

/* ---------------------------------------------------------------- detail */

function verseRow(label, indonesian, english, bilingual) {
  const row = el('div', 'verse');
  row.append(el('div', 'verse-n', label));
  if (indonesian !== undefined) {
    row.append(indonesian
      ? el('div', 'verse-text', indonesian)
      : el('div', 'verse-text missing', '—'));
  }
  if (bilingual) {
    row.append(english
      ? el('div', 'verse-text en', english)
      : el('div', 'verse-text en missing', '—'));
  }
  return row;
}

function renderDetail(data) {
  const { ls, sda, verses, refrain, aligned, lsBlocks, sdaVerses } = data;
  const bilingual = Boolean(ls && sda);
  const primary = ls || sda;

  // A server still running pre-rebuild code answers with a bare song row and
  // no ls/sda keys. Say so plainly instead of throwing on primary.title.
  if (!primary) {
    empty(els.detail,
      'This looks like an older server process — restart it (npm start) to pick up the current code.');
    return;
  }

  const wrap = document.createDocumentFragment();

  const back = el('button', 'back', '← Back');
  back.type = 'button';
  back.addEventListener('click', () => history.back());
  wrap.append(back);

  // --- heading
  const head = el('div', 'detail-head');
  head.append(el('h1', null, primary.title));
  if (ls && ls.english_title) head.append(el('div', 'sub', ls.english_title));
  else if (sda && sda.first_line) head.append(el('div', 'sub', sda.first_line));

  const meta = el('div', 'detail-meta');
  const tag = (label, value, onClick) => {
    const t = el('span', onClick ? 'tag link' : 'tag');
    t.append(el('b', null, label), document.createTextNode(' ' + value));
    if (onClick) t.addEventListener('click', onClick);
    meta.append(t);
  };

  if (ls) tag('LS', String(ls.number));
  if (sda) tag('SDA', `${sda.number} · ${sda.title}`, ls
    ? () => { location.hash = `#/sda/${sda.number}`; }
    : null);
  if (ls && !sda && ls.sda_hymnal_num) tag('SDA', String(ls.sda_hymnal_num));
  if (ls && ls.old_edition_num) tag('Edisi Lama', String(ls.old_edition_num));
  if (ls && ls.toba_edition_num) tag('Toba', String(ls.toba_edition_num));
  if (primary.composer) tag('Composer', primary.composer);
  if (primary.arranger) tag('Arranger', primary.arranger);
  if (ls && ls.music_notation) tag('Key', ls.music_notation);
  if (sda && sda.scripture) tag('Scripture', sda.scripture);
  head.append(meta);
  wrap.append(head);

  // --- alignment caveat
  if (bilingual && !aligned) {
    wrap.append(el('div', 'notice',
      `Verse counts differ (${lsBlocks} Indonesian block${lsBlocks === 1 ? '' : 's'}, ` +
      `${sdaVerses} English verse${sdaVerses === 1 ? '' : 's'}), so the columns are lined up ` +
      `by position and may not correspond.`));
  } else if (bilingual) {
    wrap.append(el('div', 'notice',
      'Columns are paired by position, not by a verified line-by-line translation.'));
  }

  // --- verses
  const sheet = el('div', bilingual ? 'sheet' : 'sheet single');
  const header = el('div', 'cols-head');
  header.append(el('span', null, ''), el('span', null, ls ? 'Indonesian' : 'English'));
  if (bilingual) header.append(el('span', null, 'English'));
  sheet.append(header);

  if (!verses.length) {
    sheet.append(el('div', 'empty', 'No lyrics stored for this hymn.'));
  } else {
    for (const v of verses) {
      sheet.append(verseRow(v.label, ls ? v.id : v.en, v.en, bilingual));
    }
  }

  if (refrain && (refrain.id || refrain.en)) {
    const row = verseRow('Refrain', ls ? refrain.id : refrain.en, refrain.en, bilingual);
    row.classList.add('chorus');
    sheet.append(row);
  }
  wrap.append(sheet);

  els.detail.replaceChildren(wrap);
  show(els.detail);
  window.scrollTo(0, 0);
}

function loadDetail(kind, number) {
  show(els.detail);
  spinner(els.detail);
  api(`/api/${kind === 'ls' ? 'songs' : 'sda'}/${encodeURIComponent(number)}`)
    .then(renderDetail)
    .catch(err => empty(els.detail, err.message));
}

/* ---------------------------------------------------------------- router */

function router() {
  const m = /^#\/(ls|sda)\/(\d+)$/.exec(location.hash);
  if (m) return loadDetail(m[1], m[2]);
  if (els.q.value.trim()) return show(els.results);
  show(els.home);
}

/* ----------------------------------------------------------------- theme */

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem('theme', theme);
}

/* ------------------------------------------------------------------ init */

applyTheme(
  localStorage.getItem('theme') ||
  (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
);

els.themeBtn.addEventListener('click', () =>
  applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));

els.q.addEventListener('input', onSearchInput);

els.scopebar.addEventListener('click', e => {
  const btn = e.target.closest('.scope');
  if (!btn) return;
  els.scopebar.querySelectorAll('.scope').forEach(b => b.classList.toggle('active', b === btn));
  state.scope = btn.dataset.scope;
  // The scope governs the index as well as the search, so both follow it.
  loadBrowse();
  if (els.q.value.trim()) runSearch(els.q.value.trim());
});

els.onlyPaired.addEventListener('change', renderBrowse);

els.randomBtn.addEventListener('click', () =>
  api('/api/random').then(d => { location.hash = `#/ls/${d.number}`; }));

document.addEventListener('keydown', e => {
  if (e.key === '/' && document.activeElement !== els.q) {
    e.preventDefault();
    els.q.focus();
    els.q.select();
  } else if (e.key === 'Escape') {
    if (els.q.value) {
      els.q.value = '';
      onSearchInput();
    } else if (location.hash) {
      location.hash = '';
    }
    els.q.blur();
  }
});

window.addEventListener('hashchange', router);

// Publish the topbar's real height so the scope bar can stick flush beneath it.
const syncTopbarHeight = () => {
  const bar = document.querySelector('.topbar');
  document.documentElement.style.setProperty('--topbar-h', `${Math.round(bar.getBoundingClientRect().height)}px`);
};
syncTopbarHeight();
addEventListener('resize', syncTopbarHeight);

api('/api/stats')
  .then(s => {
    const line = `${s.ls} Lagu Sion · ${s.sda} SDA Hymnal · ${s.lsMapped} cross-referenced`;
    els.stats.textContent = line;
    els.heroStats.textContent =
      `${s.ls} Indonesian hymns and ${s.sda} English hymns. ` +
      `${s.lsMapped} are cross-referenced and can be read side by side; ` +
      `${s.lsUnmapped} have no SDA equivalent.`;
  })
  .catch(() => { els.heroStats.textContent = 'Could not reach the server.'; });

loadBrowse();
router();
