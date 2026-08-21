const https = require('https');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const url = require('url');

const DB_PATH = './lagu_sion.db';
const JSON_PATH = './lagu_sion.json';

async function fetchJSON(filePath) {
  return new Promise((resolve, reject) => {
    https.get(`https://play.lagusion.org${filePath}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function initDatabase() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) reject(err);

      db.serialize(() => {
        db.run('DROP TABLE IF EXISTS songs', () => {
          db.run(`
            CREATE TABLE songs (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              number INTEGER,
              edition INTEGER,
              title TEXT NOT NULL,
              lyrics TEXT,
              english_title TEXT,
              composer TEXT,
              arranger TEXT,
              music_notation TEXT,
              sda_hymnal_title TEXT,
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

function insertSong(db, number, edition, songData) {
  return new Promise((resolve) => {
    db.run(
      `INSERT INTO songs (
        number, edition, title, lyrics, english_title, composer, arranger, music_notation, sda_hymnal_title
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        number,
        edition,
        songData.title,
        songData.lyrics,
        songData.english_title,
        songData.composer,
        songData.arranger,
        songData.music_notation,
        songData.sda_hymnal_title
      ],
      (err) => {
        if (err) console.error(`Insert error for "${songData.title}":`, err.message);
        resolve();
      }
    );
  });
}

function parseSongData(songObj) {
  const data = {
    title: songObj.title || 'Unknown',
    lyrics: '',
    english_title: '',
    composer: '',
    arranger: '',
    music_notation: '',
    sda_hymnal_title: ''
  };

  // Extract lyrics from verses
  if (songObj.verse && Array.isArray(songObj.verse)) {
    data.lyrics = songObj.verse
      .map(v => `${v.verse ? 'Verse ' + v.verse + ':\n' : ''}${v.lyrics || ''}`)
      .join('\n\n');
  }

  // Parse additional info
  if (songObj.additional_info_one) {
    const info = songObj.additional_info_one;

    // Extract English title
    const englishMatch = info.match(/English:\s*([^<\n]+)/);
    if (englishMatch) data.english_title = englishMatch[1].trim();

    // Extract Composer
    const composerMatch = info.match(/Composer:\s*([^<\n]+)/);
    if (composerMatch) data.composer = composerMatch[1].trim();

    // Extract Arranger
    const arrangerMatch = info.match(/Arranger:\s*([^<\n]+)/);
    if (arrangerMatch) data.arranger = arrangerMatch[1].trim();

    // Extract music notation
    const notationMatch = info.match(/(\d#[^<\n]+\d+\/\d+)/);
    if (notationMatch) data.music_notation = notationMatch[1].trim();
  }

  return data;
}

async function scrape() {
  let db;
  const allSongs = [];

  try {
    console.log('🎵 Lagu Sion + SDA Hymnal Scraper (Direct JSON)\n');
    console.log('🚀 Initializing database...');
    db = await initDatabase();

    const editions = [
      { num: 4, name: 'Edisi Baru (Current Edition)' },
      { num: 1, name: 'Edisi Lama (Old Edition)' },
      { num: 2, name: 'Edition 2' },
      { num: 3, name: 'Edition 3' },
      { num: 5, name: 'Edition 5' }
    ];

    for (const edition of editions) {
      console.log(`\n📥 Fetching ${edition.name} (songs_${edition.num}.json)...`);

      try {
        const songsData = await fetchJSON(`/assets/songs_${edition.num}.json`);
        console.log(`✅ Got ${Object.keys(songsData).length} songs`);

        for (const [songNum, songObj] of Object.entries(songsData)) {
          const songData = parseSongData(songObj);
          allSongs.push({
            number: parseInt(songNum),
            edition: edition.num,
            editionName: edition.name,
            ...songData
          });

          await insertSong(db, parseInt(songNum), edition.num, songData);

          if (parseInt(songNum) % 50 === 0) {
            process.stdout.write(`  ✅ Processed ${songNum} songs...\r`);
          }
        }

        console.log(`  ✅ Edition ${edition.num}: ${Object.keys(songsData).length} songs added`);

      } catch (err) {
        console.log(`  ⚠️  Failed to fetch edition ${edition.num}: ${err.message}`);
      }
    }

    // Deduplicate by title (keep first occurrence)
    const seen = new Set();
    const uniqueSongs = allSongs.filter(song => {
      if (seen.has(song.title)) return false;
      seen.add(song.title);
      return true;
    });

    console.log(`\n💾 Saving ${uniqueSongs.length} unique songs to JSON...`);
    fs.writeFileSync(JSON_PATH, JSON.stringify(uniqueSongs, null, 2));

    console.log(`\n✅ Scraping complete!`);
    console.log(`📁 JSON: ${JSON_PATH} (${uniqueSongs.length} songs)`);
    console.log(`📊 Database: ${DB_PATH}`);
    console.log(`\n🔍 Try searching with: node search.js "your search term"`);
    console.log(`🌐 Or start web UI with: npm start\n`);

  } catch (error) {
    console.error('❌ Scraping error:', error);
    process.exit(1);
  } finally {
    if (db) db.close();
  }
}

scrape().catch(console.error);
