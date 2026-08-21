const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = './lagu_sion.db';

app.use(express.static('public'));
app.use(express.json());

// Middleware to check if database exists
app.use((req, res, next) => {
  if (!fs.existsSync(DB_PATH)) {
    return res.status(500).json({
      error: 'Database not found. Please run "npm run scrape" first.'
    });
  }
  next();
});

// API: Search songs
app.get('/api/search', (req, res) => {
  const query = req.query.q || '';

  if (!query.trim()) {
    return res.json({ results: [] });
  }

  const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) return res.status(500).json({ error: err.message });

    const searchQuery = `%${query}%`;
    const asNum = parseInt(query) || -1;
    db.all(
      `SELECT * FROM songs WHERE
       title LIKE ? OR
       lyrics LIKE ? OR
       english_title LIKE ? OR
       composer LIKE ? OR
       sda_hymnal_title LIKE ? OR
       number = ? OR
       sda_hymnal_num = ?
       ORDER BY number ASC
       LIMIT 200`,
      [searchQuery, searchQuery, searchQuery, searchQuery, searchQuery, asNum, asNum],
      (err, rows) => {
        db.close();
        if (err) return res.status(500).json({ error: err.message });
        res.json({ results: rows || [] });
      }
    );
  });
});

// API: Get all songs
app.get('/api/songs', (req, res) => {
  const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) return res.status(500).json({ error: err.message });

    db.all('SELECT * FROM songs ORDER BY number ASC', (err, rows) => {
      db.close();
      if (err) return res.status(500).json({ error: err.message });
      res.json({ songs: rows || [] });
    });
  });
});

// API: Get song by number
app.get('/api/songs/:number', (req, res) => {
  const number = req.params.number;

  const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) return res.status(500).json({ error: err.message });

    db.get('SELECT * FROM songs WHERE number = ?', [number], (err, row) => {
      db.close();
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(404).json({ error: 'Song not found' });
      res.json(row);
    });
  });
});

// Serve HTML
app.get('/', (req, res) => {
  res.send(getHtml());
});

function getHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lagu Sion + SDA Hymnal</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh; padding: 20px; color: #333;
    }
    .container {
      max-width: 1000px; margin: 0 auto; background: white;
      border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.2); overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white; padding: 32px 20px; text-align: center;
    }
    .header h1 { font-size: 2.2em; margin-bottom: 6px; }
    .header p { opacity: 0.9; }
    .tabs { display: flex; background: #f0f1f5; border-bottom: 1px solid #e0e0e0; }
    .tab {
      flex: 1; padding: 16px; text-align: center; cursor: pointer;
      font-weight: 600; color: #777; transition: all 0.2s; border-bottom: 3px solid transparent;
    }
    .tab:hover { background: #e8eaf2; }
    .tab.active { color: #667eea; border-bottom-color: #667eea; background: white; }
    .panel { display: none; }
    .panel.active { display: block; }
    .toolbar { padding: 20px; background: #f8f9fa; border-bottom: 1px solid #e0e0e0; }
    .toolbar input {
      width: 100%; padding: 14px 18px; font-size: 1.05em;
      border: 2px solid #ddd; border-radius: 6px; transition: all 0.2s;
    }
    .toolbar input:focus {
      outline: none; border-color: #667eea; box-shadow: 0 0 8px rgba(102,126,234,0.3);
    }
    .count { padding: 10px 20px; color: #888; font-size: 0.9em; background: #fafbfc; }
    .results { padding: 16px 20px; max-height: 65vh; overflow-y: auto; }
    .song-item {
      padding: 18px; border: 1px solid #e6e6e6; border-radius: 8px; margin-bottom: 14px; transition: all 0.2s;
    }
    .song-item:hover { border-color: #667eea; box-shadow: 0 2px 12px rgba(102,126,234,0.15); }
    .song-head { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
    .song-number {
      background: #667eea; color: white; padding: 3px 10px; border-radius: 20px;
      font-weight: bold; font-size: 0.85em; white-space: nowrap;
    }
    .song-title { font-size: 1.2em; font-weight: 700; }
    .song-english { color: #777; font-style: italic; margin-top: 4px; }
    .song-info { color: #888; font-size: 0.9em; margin-top: 6px; }
    .mappings { margin-top: 12px; display: flex; flex-direction: column; gap: 6px; }
    .map {
      padding: 8px 12px; border-radius: 6px; font-size: 0.9em; font-weight: 500;
      display: flex; gap: 8px; align-items: baseline;
    }
    .map .label { font-weight: 700; min-width: 110px; }
    .map.sda { background: #fff3cd; border-left: 4px solid #ffc107; color: #856404; }
    .map.lama { background: #e2f0fb; border-left: 4px solid #4a90d9; color: #1c5a8a; }
    .map.toba { background: #e6f7ec; border-left: 4px solid #34c759; color: #1c7a3e; }
    .lyrics {
      background: #f7f7f9; padding: 12px 14px; border-radius: 6px; margin-top: 12px;
      color: #555; font-size: 0.9em; line-height: 1.5; white-space: pre-wrap; display: none;
    }
    .lyrics.show { display: block; }
    .toggle-lyrics {
      margin-top: 10px; background: none; border: 1px solid #667eea; color: #667eea;
      padding: 5px 12px; border-radius: 5px; cursor: pointer; font-size: 0.85em;
    }
    .toggle-lyrics:hover { background: #667eea; color: white; }
    .empty { text-align: center; color: #999; padding: 50px 20px; }
    .empty .emoji { font-size: 3em; margin-bottom: 10px; }
    .spinner {
      border: 4px solid #f0f0f0; border-top: 4px solid #667eea; border-radius: 50%;
      width: 32px; height: 32px; animation: spin 1s linear infinite; margin: 30px auto;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .filter-row { display: flex; gap: 10px; align-items: center; margin-top: 10px; }
    .filter-row label { font-size: 0.9em; color: #555; display: flex; gap: 5px; align-items: center; cursor: pointer; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎵 Lagu Sion + SDA Hymnal</h1>
      <p>Search Indonesian hymns and find their SDA Hymnal equivalents</p>
    </div>

    <div class="tabs">
      <div class="tab active" data-tab="search">🔍 Search</div>
      <div class="tab" data-tab="browse">📚 Browse All Songs</div>
    </div>

    <!-- SEARCH PANEL -->
    <div class="panel active" id="panel-search">
      <div class="toolbar">
        <input type="text" id="searchInput" placeholder="Search by title, lyrics, composer, song # or SDA Hymnal #...">
      </div>
      <div id="searchResults" class="results"></div>
    </div>

    <!-- BROWSE PANEL -->
    <div class="panel" id="panel-browse">
      <div class="toolbar">
        <input type="text" id="filterInput" placeholder="Filter the full list...">
        <div class="filter-row">
          <label><input type="checkbox" id="onlySda"> Only show songs with an SDA Hymnal match</label>
        </div>
      </div>
      <div class="count" id="browseCount"></div>
      <div id="browseResults" class="results"></div>
    </div>

  </div>

  <script>
    let allSongs = [];

    function mappingHtml(song) {
      let html = '';
      if (song.sda_hymnal_title) {
        const n = song.sda_hymnal_num ? '#' + song.sda_hymnal_num + ' ' : '';
        html += '<div class="map sda"><span class="label">📖 SDA Hymnal</span><span>' + n + esc(song.sda_hymnal_title) + '</span></div>';
      }
      if (song.old_edition_title) {
        const n = song.old_edition_num ? '#' + song.old_edition_num + ' ' : '';
        html += '<div class="map lama"><span class="label">📕 Edisi Lama</span><span>' + n + esc(song.old_edition_title) + '</span></div>';
      }
      if (song.toba_edition_title) {
        const n = song.toba_edition_num ? '#' + song.toba_edition_num + ' ' : '';
        html += '<div class="map toba"><span class="label">📗 Toba Lama</span><span>' + n + esc(song.toba_edition_title) + '</span></div>';
      }
      return html ? '<div class="mappings">' + html + '</div>' : '';
    }

    function esc(s) {
      return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    function songCard(song) {
      const lyrics = song.lyrics ? esc(song.lyrics) : '';
      return '<div class="song-item">' +
        '<div class="song-head">' +
          '<span class="song-number">LS #' + song.number + '</span>' +
          '<span class="song-title">' + esc(song.title || 'Unknown') + '</span>' +
        '</div>' +
        (song.english_title ? '<div class="song-english">"' + esc(song.english_title) + '"</div>' : '') +
        (song.composer ? '<div class="song-info">Composer: ' + esc(song.composer) + (song.arranger ? ' &bull; Arranger: ' + esc(song.arranger) : '') + (song.music_notation ? ' &bull; ' + esc(song.music_notation) : '') + '</div>' : '') +
        mappingHtml(song) +
        (lyrics ? '<button class="toggle-lyrics" onclick="this.nextElementSibling.classList.toggle(\\'show\\'); this.textContent = this.nextElementSibling.classList.contains(\\'show\\') ? \\'Hide lyrics\\' : \\'Show lyrics\\';">Show lyrics</button><div class="lyrics">' + lyrics + '</div>' : '') +
      '</div>';
    }

    function renderInto(el, songs, emptyMsg) {
      if (!songs.length) {
        el.innerHTML = '<div class="empty"><div class="emoji">🔍</div><p>' + emptyMsg + '</p></div>';
        return;
      }
      el.innerHTML = songs.map(songCard).join('');
    }

    // --- Tabs ---
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById('panel-' + tab.dataset.tab).classList.add('active');
        if (tab.dataset.tab === 'browse' && allSongs.length === 0) loadAllSongs();
      });
    });

    // --- Search ---
    const searchInput = document.getElementById('searchInput');
    const searchResults = document.getElementById('searchResults');
    let searchTimeout;
    searchInput.addEventListener('input', e => {
      clearTimeout(searchTimeout);
      const q = e.target.value.trim();
      if (!q) { searchResults.innerHTML = ''; return; }
      searchResults.innerHTML = '<div class="spinner"></div>';
      searchTimeout = setTimeout(() => {
        fetch('/api/search?q=' + encodeURIComponent(q))
          .then(r => r.json())
          .then(d => renderInto(searchResults, d.results, 'No songs found matching "' + esc(q) + '"'))
          .catch(err => searchResults.innerHTML = '<div class="empty">Error: ' + esc(err.message) + '</div>');
      }, 250);
    });

    // --- Browse all ---
    const browseResults = document.getElementById('browseResults');
    const browseCount = document.getElementById('browseCount');
    const filterInput = document.getElementById('filterInput');
    const onlySda = document.getElementById('onlySda');

    function applyBrowseFilter() {
      const q = filterInput.value.trim().toLowerCase();
      let list = allSongs;
      if (onlySda.checked) list = list.filter(s => s.sda_hymnal_title);
      if (q) {
        list = list.filter(s =>
          (s.title || '').toLowerCase().includes(q) ||
          (s.english_title || '').toLowerCase().includes(q) ||
          (s.composer || '').toLowerCase().includes(q) ||
          (s.sda_hymnal_title || '').toLowerCase().includes(q) ||
          String(s.number) === q ||
          String(s.sda_hymnal_num || '') === q
        );
      }
      browseCount.textContent = list.length + ' of ' + allSongs.length + ' songs';
      renderInto(browseResults, list, 'No songs match your filter');
    }

    function loadAllSongs() {
      browseResults.innerHTML = '<div class="spinner"></div>';
      fetch('/api/songs')
        .then(r => r.json())
        .then(d => { allSongs = d.songs || []; applyBrowseFilter(); })
        .catch(err => browseResults.innerHTML = '<div class="empty">Error: ' + esc(err.message) + '</div>');
    }

    filterInput.addEventListener('input', applyBrowseFilter);
    onlySda.addEventListener('change', applyBrowseFilter);
  </script>
</body>
</html>`;
}

app.listen(PORT, () => {
  console.log(`\n🎵 Lagu Sion Search Server`);
  console.log(`📖 http://localhost:${PORT}`);
  console.log(`\nMake sure to run "npm run scrape" first to populate the database.\n`);
});
