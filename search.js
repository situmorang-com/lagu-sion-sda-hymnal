const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

const DB_PATH = './lagu_sion.db';
const JSON_PATH = './lagu_sion.json';

function searchSongs(query) {
  return new Promise((resolve, reject) => {
    // Try to search in JSON first if it exists
    if (fs.existsSync(JSON_PATH)) {
      try {
        const data = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
        const q = query.toLowerCase();
        const results = data.filter(song =>
          song.title?.toLowerCase().includes(q) ||
          song.lyrics?.toLowerCase().includes(q) ||
          song.english_title?.toLowerCase().includes(q) ||
          song.composer?.toLowerCase().includes(q) ||
          song.sda_hymnal_title?.toLowerCase().includes(q) ||
          String(song.sda_hymnal_num || '') === query ||
          String(song.number || '') === query
        );
        resolve(results);
        return;
      } catch (e) {
        console.log('JSON search failed, trying database...');
      }
    }

    // Fall back to database search
    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        reject(new Error('Database not found. Please run "npm run scrape" first.'));
        return;
      }

      db.all(
        `SELECT * FROM songs WHERE
         title LIKE ? OR
         lyrics LIKE ? OR
         english_title LIKE ? OR
         composer LIKE ? OR
         sda_hymnal_title LIKE ? OR
         number = ?
         ORDER BY number ASC`,
        [`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`, parseInt(query) || -1],
        (err, rows) => {
          db.close();
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  });
}

function displayResults(results) {
  if (results.length === 0) {
    console.log('\n❌ No songs found matching your search.\n');
    return;
  }

  console.log(`\n✅ Found ${results.length} matching song(s):\n`);
  console.log('═'.repeat(80));

  results.forEach((song, idx) => {
    console.log(`\n${idx + 1}. 🎵 ${song.title || 'Unknown'}`);
    console.log('─'.repeat(80));

    if (song.number) console.log(`   Song #: ${song.number}`);
    if (song.english_title) console.log(`   English: ${song.english_title}`);
    if (song.composer) console.log(`   Composer: ${song.composer}`);
    if (song.arranger) console.log(`   Arranger: ${song.arranger}`);
    if (song.music_notation) console.log(`   Notation: ${song.music_notation}`);

    if (song.sda_hymnal_title) {
      const num = song.sda_hymnal_num ? `#${song.sda_hymnal_num} ` : '';
      console.log(`\n   📖 SDA Hymnal: ${num}${song.sda_hymnal_title}`);
    }
    if (song.old_edition_title) {
      const num = song.old_edition_num ? `#${song.old_edition_num} ` : '';
      console.log(`   📕 LS Edisi Lama: ${num}${song.old_edition_title}`);
    }
    if (song.toba_edition_title) {
      const num = song.toba_edition_num ? `#${song.toba_edition_num} ` : '';
      console.log(`   📗 LS Toba Lama: ${num}${song.toba_edition_title}`);
    }

    if (song.lyrics) {
      const preview = song.lyrics.substring(0, 150).replace(/\n/g, ' ');
      console.log(`\n   Lyrics: ${preview}${song.lyrics.length > 150 ? '...' : ''}`);
    }
  });

  console.log('\n' + '═'.repeat(80) + '\n');
}

// Main
const query = process.argv[2];
if (!query) {
  console.log('\n🎵 Lagu Sion Song Search\n');
  console.log('Usage: node search.js "search term"\n');
  console.log('Examples:');
  console.log('  node search.js "tuhan"              (search by Indonesian title)');
  console.log('  node search.js "jehovah"            (search by English title)');
  console.log('  node search.js "82"                 (search by song number)');
  console.log('  node search.js "isaac watts"        (search by composer)');
  console.log('  node search.js "puji"               (search by lyrics)\n');
  process.exit(1);
}

console.log(`🔍 Searching for: "${query}"\n`);

searchSongs(query)
  .then(displayResults)
  .catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
  });
