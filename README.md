# 🎵 Lagu Sion + SDA Hymnal

A comprehensive scraper and search tool for Indonesian Lagu Sion hymnal songs with their English translations and SDA Hymnal equivalents from https://play.lagusion.org/

## ✨ Features

- ✅ Pulls all 525 songs from Lagu Sion Plus (Edisi Baru)
- 📝 Extracts lyrics, translations, composer, and arranger information
- 📖 Maps each song to its **SDA Hymnal**, **LS Edisi Lama**, and **LS Toba Lama** equivalents (number + title)
- 💾 Stores data in both JSON and SQLite for easy searching
- 🔍 Full-text search across lyrics, titles, composers, and hymnal numbers
- 🌐 Web app with **bilingual side-by-side reading** — Indonesian and English verses in parallel
- 📇 English title index transcribed from the printed hymnal (pp. 561–567), reconciled against the DB
- ⚡ Fast — uses the site's own JSON + correlation API (no headless browser needed)

## 🔧 How It Works

The data comes from two public endpoints on play.lagusion.org:

1. **`/assets/songs_4.json`** — the full song list (Edisi Baru) with lyrics & metadata.
2. **`POST /route/cerita/`** with `data=<song_id>` — returns correlated songs in other
   books. The `album_id` field identifies the book:
   `1` = SDA Hymnal, `2` = LS Edisi Lama, `4` = LS Edisi Baru, `7` = LS Toba Lama.

The scraper fetches the song list, then queries the correlation endpoint for every song
(in parallel) and records the matching SDA Hymnal / Edisi Lama / Toba Lama number & title.

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Scrape the Website
Downloads all songs, lyrics, and **all hymnal mappings** (takes ~1-2 minutes):
```bash
npm run scrape
```

This creates:
- `lagu_sion.json` - Complete song data in JSON format
- `lagu_sion.db` - SQLite database for querying

> Tip: `npm run scrape:fast` grabs songs + lyrics only (no mappings) in a few seconds.

## 🔍 Usage Options

### Option 1: Command-Line Search (Fastest)
```bash
node search.js "tuhan"          # Search by Indonesian title
node search.js "jehovah"        # Search by English title
node search.js "82"             # Search by song # or SDA Hymnal #
node search.js "isaac watts"    # Search by composer
node search.js "puji"           # Search by lyrics
```

Each result shows the song's SDA Hymnal, Edisi Lama, and Toba Lama equivalents.

### Option 2: Web App (Most User-Friendly)
```bash
npm install   # first time only
npm start
```

Then open **http://localhost:3000**.

- **Unified search** across *both* hymnals — 525 Indonesian songs and 695 English hymns.
  Results are ranked: an exact hymn number beats a title hit, which beats a lyrics hit.
  Filter to one book with the **Both hymnals / Lagu Sion / SDA Hymnal** buttons.
- **Bilingual reading view** — for the 394 cross-referenced songs the Indonesian and English
  verses sit side by side, split verse by verse. Where the two books have a different number
  of verses the view says so, rather than implying a line-by-line translation.
- **Browse** either hymnal, optionally limited to cross-referenced songs.
- **Deep links** — `#/ls/35` and `#/sda/545` address a hymn directly, so pages are shareable
  and the back button works.
- Light/dark theme, mobile layout, and a print stylesheet that drops the chrome.

Keyboard: <kbd>/</kbd> focuses search, <kbd>Esc</kbd> clears it.

### Option 3: JSON Direct Access
```bash
cat lagu_sion.json | grep -i "tuhan"
```

## 📊 Database Schema

The SQLite database has a `songs` table with these columns:

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Unique row ID |
| source_id | INTEGER | Internal lagusion.org song id |
| number | INTEGER | Song number in LS Edisi Baru |
| title | TEXT | Indonesian title |
| lyrics | TEXT | Full lyrics in Indonesian |
| english_title | TEXT | English translation |
| composer | TEXT | Composer name |
| arranger | TEXT | Arranger name |
| music_notation | TEXT | Music notation (e.g., "2#=D 4/4") |
| sda_hymnal_num | INTEGER | **SDA Hymnal number** |
| sda_hymnal_title | TEXT | **SDA Hymnal title** |
| old_edition_num | INTEGER | LS Edisi Lama number |
| old_edition_title | TEXT | LS Edisi Lama title |
| toba_edition_num | INTEGER | LS Toba Lama number |
| toba_edition_title | TEXT | LS Toba Lama title |
| created_at | TIMESTAMP | When song was added |

## 📄 Example Data

### JSON Structure
```json
{
  "source_id": 1,
  "number": 1,
  "title": "Di Hadapan Hadirat-Mu",
  "lyrics": "Verse 1:\nDi hadapan hadirat-Mu...",
  "english_title": "Before Behovah's Awful Throne",
  "composer": "Isaac Watts",
  "arranger": "John Hatton",
  "music_notation": "2#=D 4/4",
  "sda_hymnal_num": 82,
  "sda_hymnal_title": "Before Jehovah's Awful Throne",
  "old_edition_num": 1,
  "old_edition_title": "Di Hadapan Hadirat-hu",
  "toba_edition_num": 1,
  "toba_edition_title": "Puji Jahowa Na Marasi Roha"
}
```

## 💡 Examples

### Find all songs by Isaac Watts
```bash
node search.js "isaac watts"
```

### Search for songs about "puji" (praise)
```bash
node search.js "puji"
```

### Find the SDA Hymnal equivalent of a song
```bash
# First find the song
node search.js "tuhan"
# Then look for "SDA Hymnal" line in the output
```

### Export search results
```bash
node search.js "tuhan" > results.txt
```

## 🛠️ Advanced Usage

### Use as a Node.js Module
```javascript
const sqlite3 = require('sqlite3');

const db = new sqlite3.Database('./lagu_sion.db');
db.all('SELECT * FROM songs WHERE title LIKE ?', ['%tuhan%'], 
  (err, rows) => {
    console.log(rows);
    db.close();
  }
);
```

### Query the API (when server is running)
```bash
# Ranked search across both hymnals; scope = all | ls | sda
curl "http://localhost:3000/api/search?q=tuhan&scope=all"

# Lightweight lists (no lyrics in the payload)
curl "http://localhost:3000/api/songs"
curl "http://localhost:3000/api/sda"

# A hymn with its counterpart and verse-by-verse pairing
curl "http://localhost:3000/api/songs/35"   # by Lagu Sion number
curl "http://localhost:3000/api/sda/545"    # by SDA Hymnal number

# Corpus counts, and a random pick
curl "http://localhost:3000/api/stats"
curl "http://localhost:3000/api/random"
```

## 📝 Notes

- The scraper uses the site's own JSON endpoints — no headless browser needed
- The web server is **Express.js** over a single read-only SQLite connection
- The UI lives in `public/` (plain HTML/CSS/JS, no build step)
- All data is stored locally
- **Lyrics are gitignored.** Only titles, hymn numbers and mappings are tracked, since the
  hymnal texts and Indonesian translations are under copyright. Run the scraper to build
  `lagu_sion.db` locally.

## 🔒 License

MIT

## 🤝 Contributing

To improve the scraper or fix issues:
1. Fork this project
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📞 Support

If you encounter issues:
1. Make sure Node.js 14+ is installed
2. Clear old data: `rm lagu_sion.db lagu_sion.json`
3. Run scraper again: `npm run scrape`
4. Check for error messages in the console
