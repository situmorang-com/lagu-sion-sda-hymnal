#!/usr/bin/env python3
"""
Re-crawl correlations for every Lagu Sion Edisi Baru song (album 4).

For each LS song this calls POST /route/cerita/ and records the matching
song in every other book:

    album_id 1 = SDA Hymnal
    album_id 2 = LS Edisi Lama
    album_id 4 = LS Edisi Baru  (self)
    album_id 7 = LS Toba Lama

Results are written to correlations_raw.json as they arrive, so the crawl is
resumable: re-running skips any song already present in that file.

Responses contain raw newlines inside lyric fields, so json.loads() needs
strict=False -- plain json.load() raises "Invalid control character".
"""

import json
import os
import sqlite3
import time
import urllib.parse
import urllib.request

BASE = "https://play.lagusion.org"
ENDPOINT = f"{BASE}/route/cerita/"
OUT = "correlations_raw.json"
DB = "lagu_sion.db"

DELAY = 0.35          # seconds between requests -- be polite
TIMEOUT = 30
RETRIES = 3

ALBUMS = {"1": "sda", "2": "old", "7": "toba"}

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
      "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36")


def fetch(song_id):
    """POST one song id, return the parsed result list (or None on failure)."""
    body = urllib.parse.urlencode({"data": str(song_id)}).encode()
    req = urllib.request.Request(
        ENDPOINT,
        data=body,
        headers={
            "User-Agent": UA,
            "X-Requested-With": "XMLHttpRequest",
            "Referer": BASE + "/",
            "Content-Type": "application/x-www-form-urlencoded",
        },
    )
    for attempt in range(RETRIES):
        try:
            with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
                raw = r.read().decode("utf-8", "replace")
            return json.loads(raw, strict=False).get("result") or []
        except Exception as e:
            if attempt == RETRIES - 1:
                print(f"  ! {song_id} failed after {RETRIES} tries: {e}")
                return None
            time.sleep(2 * (attempt + 1))


def main():
    done = {}
    if os.path.exists(OUT):
        done = json.load(open(OUT))
        print(f"resuming -- {len(done)} already crawled")

    db = sqlite3.connect(DB)
    songs = db.execute(
        "select source_id, number, title from songs order by number"
    ).fetchall()
    db.close()

    todo = [s for s in songs if str(s[0]) not in done]
    print(f"{len(songs)} LS songs, {len(todo)} to crawl\n")

    for i, (sid, num, title) in enumerate(todo, 1):
        result = fetch(sid)
        if result is None:
            continue

        found = {}
        for row in result:
            album = str(row.get("album_id"))
            if album in ALBUMS and str(row.get("id")) != str(sid):
                found[ALBUMS[album]] = {
                    "num": row.get("sort"),
                    "title": row.get("title"),
                }

        done[str(sid)] = {"ls_num": num, "ls_title": title, **found}

        marks = "".join(k[0].upper() if k in found else "-"
                        for k in ("sda", "old", "toba"))
        print(f"[{i:3}/{len(todo)}] LS {num:3} {title[:34]:36} {marks}")

        if i % 25 == 0:
            json.dump(done, open(OUT, "w"), ensure_ascii=False, indent=1)

        time.sleep(DELAY)

    json.dump(done, open(OUT, "w"), ensure_ascii=False, indent=1)
    print(f"\ndone -- {len(done)} songs written to {OUT}")


if __name__ == "__main__":
    main()
