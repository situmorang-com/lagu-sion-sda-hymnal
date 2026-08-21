const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'lagu_sion.db');

if (!fs.existsSync(DB_PATH)) {
  console.error(`\nDatabase not found at ${DB_PATH}`);
  console.error('Run "npm run scrape" first to build it.\n');
  process.exit(1);
}

// One shared read-only connection for the life of the process.
const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY, err => {
  if (err) {
    console.error(`Could not open ${DB_PATH}: ${err.message}`);
    process.exit(1);
  }
});

const all = (sql, params = []) =>
  new Promise((resolve, reject) =>
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || []))));

const get = (sql, params = []) =>
  new Promise((resolve, reject) =>
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row))));

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/** Wrap an async route so a rejected promise becomes a 500 instead of a hang. */
const route = handler => (req, res) =>
  handler(req, res).catch(err => {
    console.error(`${req.method} ${req.originalUrl} failed:`, err.message);
    res.status(500).json({ error: err.message });
  });

// Columns worth sending for a list; lyrics are deliberately excluded so the
// browse payload stays small.
const LS_LIST_COLS = `number, title, english_title, composer, arranger,
  sda_hymnal_num, sda_hymnal_title, old_edition_num, old_edition_title,
  toba_edition_num, toba_edition_title`;
const SDA_LIST_COLS = `number, title, first_line, composer, arranger, verse_count`;

/** Split a Lagu Sion lyric blob into verse blocks on blank lines. */
function splitBlocks(lyrics) {
  return String(lyrics || '')
    .replace(/\r\n/g, '\n')
    .trim()
    .split(/\n\s*\n/)
    .map(b => b.trim())
    .filter(Boolean);
}

// ---------------------------------------------------------------- stats

app.get('/api/stats', route(async (req, res) => {
  const ls = await get(`select count(*) n, sum(sda_hymnal_num is not null) mapped from songs`);
  const sda = await get(`select count(*) n from sda_songs`);
  const verses = await get(`select count(*) n from sda_verses`);
  res.json({
    ls: ls.n, lsMapped: ls.mapped, lsUnmapped: ls.n - ls.mapped,
    sda: sda.n, verses: verses.n
  });
}));

// ---------------------------------------------------------------- search

/*
 * Ranked search across both hymnals. Rank is lowest-is-best so an exact hymn
 * number beats a title hit, which beats a lyrics hit; without this a search
 * for "3" buried LS 3 under every song whose lyrics contain a 3.
 */
app.get('/api/search', route(async (req, res) => {
  const q = String(req.query.q || '').trim();
  const scope = ['all', 'ls', 'sda'].includes(req.query.scope) ? req.query.scope : 'all';
  const limit = Math.min(parseInt(req.query.limit, 10) || 60, 200);
  if (!q) return res.json({ results: [], query: q });

  const like = `%${q}%`;
  const starts = `${q}%`;
  const asNum = /^\d+$/.test(q) ? parseInt(q, 10) : -1;
  const results = [];

  if (scope === 'all' || scope === 'ls') {
    const rows = await all(
      `select ${LS_LIST_COLS},
              case
                when number = ?1 then 0
                when sda_hymnal_num = ?1 then 1
                when title like ?3 collate nocase then 2
                when english_title like ?3 collate nocase then 3
                when title like ?2 collate nocase then 4
                when english_title like ?2 collate nocase then 5
                when sda_hymnal_title like ?2 collate nocase then 6
                when composer like ?2 collate nocase then 7
                else 8
              end rank
       from songs
       where number = ?1 or sda_hymnal_num = ?1
          or title like ?2 collate nocase
          or english_title like ?2 collate nocase
          or sda_hymnal_title like ?2 collate nocase
          or composer like ?2 collate nocase
          or lyrics like ?2 collate nocase
       order by rank, number
       limit ?4`,
      [asNum, like, starts, limit]
    );
    for (const r of rows) results.push({ kind: 'ls', ...r });
  }

  if (scope === 'all' || scope === 'sda') {
    const rows = await all(
      `select ${SDA_LIST_COLS},
              case
                when number = ?1 then 0
                when title like ?3 collate nocase then 2
                when first_line like ?3 collate nocase then 3
                when title like ?2 collate nocase then 4
                when first_line like ?2 collate nocase then 5
                when composer like ?2 collate nocase then 7
                else 8
              end rank
       from sda_songs
       where number = ?1
          or title like ?2 collate nocase
          or first_line like ?2 collate nocase
          or composer like ?2 collate nocase
          or lyrics like ?2 collate nocase
       order by rank, number
       limit ?4`,
      [asNum, like, starts, limit]
    );
    for (const r of rows) results.push({ kind: 'sda', ...r });
  }

  results.sort((a, b) => a.rank - b.rank || a.number - b.number);
  res.json({ query: q, scope, count: results.length, results: results.slice(0, limit) });
}));

// ---------------------------------------------------------------- lists

app.get('/api/songs', route(async (req, res) => {
  res.json({ songs: await all(`select ${LS_LIST_COLS} from songs order by number`) });
}));

app.get('/api/sda', route(async (req, res) => {
  res.json({ songs: await all(`select ${SDA_LIST_COLS} from sda_songs order by number`) });
}));

// ---------------------------------------------------------------- detail

/** Build the bilingual payload shared by both detail endpoints. */
async function buildPair(lsRow, sdaRow) {
  const blocks = lsRow ? splitBlocks(lsRow.lyrics) : [];
  const verses = sdaRow
    ? await all(
        `select seq, verse_label, lyrics from sda_verses where sda_number = ? order by seq`,
        [sdaRow.number])
    : [];

  const rows = [];
  const n = Math.max(blocks.length, verses.length);
  for (let i = 0; i < n; i++) {
    rows.push({
      label: verses[i]?.verse_label || String(i + 1),
      id: blocks[i] || null,
      en: verses[i]?.lyrics || null
    });
  }

  return {
    ls: lsRow || null,
    sda: sdaRow || null,
    verses: rows,
    chorus: sdaRow?.chorus || null,
    // Positional pairing only — flag it so the UI can warn rather than imply
    // the two columns are a verified line-by-line translation.
    aligned: Boolean(lsRow && sdaRow) && blocks.length === verses.length,
    lsBlocks: blocks.length,
    sdaVerses: verses.length
  };
}

app.get('/api/songs/:number', route(async (req, res) => {
  const ls = await get(`select * from songs where number = ?`, [req.params.number]);
  if (!ls) return res.status(404).json({ error: 'Song not found' });
  const sda = ls.sda_hymnal_num
    ? await get(`select * from sda_songs where number = ?`, [ls.sda_hymnal_num])
    : null;
  res.json(await buildPair(ls, sda));
}));

app.get('/api/sda/:number', route(async (req, res) => {
  const sda = await get(`select * from sda_songs where number = ?`, [req.params.number]);
  if (!sda) return res.status(404).json({ error: 'Hymn not found' });
  const ls = await get(`select * from songs where sda_hymnal_num = ?`, [sda.number]);
  res.json(await buildPair(ls || null, sda));
}));

app.get('/api/random', route(async (req, res) => {
  const row = await get(`select number from songs order by random() limit 1`);
  res.json({ number: row ? row.number : 1 });
}));

// SPA fallback: any unmatched non-API GET returns the shell.
app.get(/^(?!\/api\/).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const server = app.listen(PORT, () => {
  console.log(`\n  Lagu Sion + SDA Hymnal`);
  console.log(`  http://localhost:${PORT}\n`);
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => server.close(() => db.close(() => process.exit(0))));
}
