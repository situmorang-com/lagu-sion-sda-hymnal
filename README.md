# 🎵 Lagu Sion + SDA Hymnal

A comprehensive scraper and search tool for Indonesian Lagu Sion hymnal songs with their English translations and SDA Hymnal equivalents from https://play.lagusion.org/

## ✨ Features

- ✅ Pulls all 525 songs from Lagu Sion Plus (Edisi Baru)
- 📝 Extracts lyrics, translations, composer, and arranger information
- 📖 Maps each song to its **SDA Hymnal**, **LS Edisi Lama**, and **LS Toba Lama** equivalents (number + title)
- 💾 Stores data in both JSON and SQLite for easy searching
- 🔍 Full-text search across lyrics, titles, composers, and hymnal numbers
- 🌐 Web interface with **Search** and **Browse All Songs** tabs
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

### Option 2: Web Interface (Most User-Friendly)
```bash
npm start
```

Then open **http://localhost:3000**. The interface has two tabs:

- **🔍 Search** — real-time search as you type, with hymnal mappings highlighted.
- **📚 Browse All Songs** — the complete list of all 525 songs, with a filter box and an
  "only show songs with an SDA Hymnal match" checkbox. Each song has a *Show lyrics* toggle.

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
# Search
curl "http://localhost:3000/api/search?q=tuhan"

# Get all songs
curl "http://localhost:3000/api/songs"

# Get specific song
curl "http://localhost:3000/api/songs/1"
```

## 📝 Notes

- The scraper uses **Puppeteer** to handle JavaScript-rendered content
- First run takes 5-10 minutes as it navigates through all songs
- Subsequent searches are instant (data is cached)
- The web server uses **Express.js** for the REST API
- All data is stored locally, no external dependencies needed for searching

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
