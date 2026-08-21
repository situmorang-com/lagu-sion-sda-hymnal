const https = require('https');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = './lagu_sion.db';
const JSON_PATH = './lagu_sion.json';

// Album IDs used by lagusion.org
const ALBUM = {
  EDISI_BARU: '4',
  EDISI_LAMA: '2',
  TOBA_LAMA: '7',
  SDA_HYMNAL: '1'
};

const CONCURRENCY = 8; // parallel correlation requests

function fetchJSON(filePath) {
  return new Promise((resolve, reject) => {
    https.get(`https://play.lagusion.org${filePath}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

// POST to route/cerita/ to get correlations for a song id
function fetchCorrelations(songId) {
  return new Promise((resolve, reject) => {
    const postData = `data=${encodeURIComponent(songId)}`;
    const req = https.request({
      hostname: 'play.lagusion.org',
      path: '/route/cerita/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
        'X-Requested-With': 'XMLHttpRequest'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed.result || []);
        } catch (e) {
          resolve([]); // tolerate non-JSON responses
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function initDatabase() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) return reject(err);
      db.serialize(() => {
        db.run('DROP TABLE IF EXISTS songs', () => {
          db.run(`
            CREATE TABLE songs (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              source_id INTEGER,
              number INTEGER,
              title TEXT NOT NULL,
              lyrics TEXT,
              english_title TEXT,
              composer TEXT,
              arranger TEXT,
              music_notation TEXT,
              sda_hymnal_num INTEGER,
              sda_hymnal_title TEXT,
              old_edition_num INTEGER,
              old_edition_title TEXT,
              toba_edition_num INTEGER,
              toba_edition_title TEXT,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
          `, (err) => {
            if (err) console.error('Table creation error:', err);
            resolve(db);
          });
        });
      });
    });
  });
}

function insertSong(db, song) {
  return new Promise((resolve) => {
    db.run(
      `INSERT INTO songs (
        source_id, number, title, lyrics, english_title, composer, arranger, music_notation,
        sda_hymnal_num, sda_hymnal_title, old_edition_num, old_edition_title,
        toba_edition_num, toba_edition_title
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        song.source_id, song.number, song.title, song.lyrics, song.english_title,
        song.composer, song.arranger, song.music_notation,
        song.sda_hymnal_num, song.sda_hymnal_title,
        song.old_edition_num, song.old_edition_title,
        song.toba_edition_num, song.toba_edition_title
      ],
      (err) => {
        if (err) console.error(`Insert error for "${song.title}":`, err.message);
        resolve();
      }
    );
  });
}

function parseBaseData(songObj) {
  const data = {
    title: (songObj.title || 'Unknown').trim(),
    lyrics: '',
    english_title: '',
    composer: '',
    arranger: '',
    music_notation: ''
  };

  if (Array.isArray(songObj.verse)) {
    data.lyrics = songObj.verse
      .map(v => `${v.verse ? 'Verse ' + v.verse + ':\n' : ''}${v.lyrics || ''}`)
      .join('\n\n')
      .trim();
  }

  const info = songObj.additional_info_one || '';
  const english = info.match(/English:\s*([^<\n]+)/);
  if (english) data.english_title = english[1].trim();
  const composer = info.match(/Composer:\s*([^<\n]+)/);
  if (composer) data.composer = composer[1].trim();
  const arranger = info.match(/Arranger:\s*([^<\n]+)/);
  if (arranger) data.arranger = arranger[1].trim();
  const notation = info.match(/(\d#[^<\n]+\d+\/\d+)/);
  if (notation) data.music_notation = notation[1].trim();

  return data;
}

function applyCorrelations(song, correlations) {
  for (const c of correlations) {
    const num = parseInt(c.sort, 10) || null;
    const title = (c.title || '').trim();
    switch (String(c.album_id)) {
      case ALBUM.SDA_HYMNAL:
        song.sda_hymnal_num = num;
        song.sda_hymnal_title = title;
        break;
      case ALBUM.EDISI_LAMA:
        song.old_edition_num = num;
        song.old_edition_title = title;
        break;
      case ALBUM.TOBA_LAMA:
        song.toba_edition_num = num;
        song.toba_edition_title = title;
        break;
    }
  }
}

// Process an array of tasks with limited concurrency
async function runPool(items, worker, concurrency) {
  let index = 0;
  const results = new Array(items.length);
  async function next() {
    while (index < items.length) {
      const current = index++;
      results[current] = await worker(items[current], current);
    }
  }
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, next);
  await Promise.all(runners);
  return results;
}

async function scrape() {
  let db;
  try {
    console.log('🎵 Lagu Sion + SDA Hymnal Scraper (correlations via API)\n');
    console.log('🚀 Initializing database...');
    db = await initDatabase();

    console.log('📥 Fetching song data (songs_4.json)...');
    const songsData = await fetchJSON('/assets/songs_4.json');
    const entries = Object.entries(songsData);
    console.log(`✅ Got ${entries.length} songs\n`);

    console.log('📍 Fetching correlations from route/cerita/ (parallel)...\n');

    let done = 0;
    const songs = await runPool(entries, async ([songNum, songObj]) => {
      const song = {
        source_id: parseInt(songObj.id, 10) || null,
        number: parseInt(songNum, 10),
        ...parseBaseData(songObj),
        sda_hymnal_num: null, sda_hymnal_title: '',
        old_edition_num: null, old_edition_title: '',
        toba_edition_num: null, toba_edition_title: ''
      };

      try {
        const correlations = await fetchCorrelations(songObj.id);
        applyCorrelations(song, correlations);
      } catch (e) {
        // network hiccup — leave mappings empty
      }

      done++;
      if (done % 20 === 0 || done === entries.length) {
        const pct = Math.round((done / entries.length) * 100);
        process.stdout.write(`  ✅ ${done}/${entries.length} (${pct}%)\r`);
      }
      return song;
    }, CONCURRENCY);

    console.log('\n\n💾 Writing to database...');
    for (const song of songs) {
      await insertSong(db, song);
    }

    fs.writeFileSync(JSON_PATH, JSON.stringify(songs, null, 2));

    const withSDA = songs.filter(s => s.sda_hymnal_title).length;
    const withOld = songs.filter(s => s.old_edition_title).length;
    const withToba = songs.filter(s => s.toba_edition_title).length;

    console.log(`\n📊 Mapping Summary:`);
    console.log(`   - SDA Hymnal mappings: ${withSDA}/${songs.length}`);
    console.log(`   - Edisi Lama mappings: ${withOld}/${songs.length}`);
    console.log(`   - Toba Lama mappings:  ${withToba}/${songs.length}`);

    console.log(`\n✅ Done!`);
    console.log(`📁 JSON: ${JSON_PATH}`);
    console.log(`📊 Database: ${DB_PATH}`);
    console.log(`\n🌐 Start the web UI with: npm start\n`);
  } catch (error) {
    console.error('❌ Scraping error:', error);
    process.exit(1);
  } finally {
    if (db) db.close();
  }
}

scrape().catch(console.error);
