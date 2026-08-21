#!/usr/bin/env python3
"""
Load the full SDA Hymnal into lagu_sion.db from sda_hymnal_695.json.

Creates two tables and leaves the existing `songs` table untouched:

  sda_songs   one row per hymn (1-695), with composer/arranger parsed out of
              the additional_info_one HTML blob, plus the full lyrics flattened
              into one text column for easy searching
  sda_verses  one row per verse block (2,446 total), for structured access

Composer/arranger live inside an HTML fragment shaped like

    <p>English: Praise To The Lord<br />Composer: Joachim Neander<br />
       Arranger: Wm. S. Bennett<br />1b = F 3/4</p>

and are only present on 330 of the 695 hymns -- the rest genuinely ship
without attribution in this source, so those columns stay NULL rather than
being guessed at.

Some entries carry a trailing scripture reference in a second paragraph; that
is kept in `scripture`. The raw blob is preserved in `additional_info_raw` so
nothing is lost to the parser.

Safe to re-run: both tables are dropped and rebuilt.
"""

import html
import json
import re
import sqlite3

SRC = "sda_hymnal_695.json"
DB = "lagu_sion.db"


def blob_to_lines(blob):
    """HTML fragment -> list of clean text lines."""
    if not blob:
        return []
    t = re.sub(r"<br\s*/?>", "\n", blob, flags=re.I)
    t = re.sub(r"</p\s*>", "\n", t, flags=re.I)
    t = re.sub(r"<[^>]+>", "", t)
    t = html.unescape(t).replace("\xa0", " ")
    return [ln.strip() for ln in t.split("\n") if ln.strip()]


def parse_info(blob):
    """Pull english title, composer, arranger, notation and scripture out."""
    out = {"english_title": None, "composer": None, "arranger": None,
           "notation": None, "scripture": None}
    extras = []
    for line in blob_to_lines(blob):
        # Label may carry an empty value ("Composer:" with nothing after it) --
        # that means the source has no attribution, so record NULL and move on
        # rather than letting the bare label fall through into `scripture`.
        m = re.match(r"(English|Composer|Arranger)\s*:\s*(.*)", line, re.I)
        if m:
            key = m.group(1).lower()
            val = m.group(2).strip()
            out["english_title" if key == "english" else key] = val or None
        # Key/time signature, written variously as "1b = F 3/4", "2#=D 3/2",
        # "3B=Eb 4/4" or just "C 3/4".
        elif re.match(r"^(?:\d*\s*[#bB]?\s*=\s*)?[A-G][#bB]?\s+\d+\s*/\s*\d+$", line):
            out["notation"] = line
        else:
            extras.append(line)
    if extras:
        out["scripture"] = " ".join(extras)
    return out


def main():
    data = json.load(open(SRC))["songs"]
    db = sqlite3.connect(DB)
    c = db.cursor()

    c.executescript("""
        drop table if exists sda_verses;
        drop table if exists sda_songs;

        create table sda_songs (
            number              integer primary key,   -- hymn no. 1-695
            source_id           integer,               -- lagusion internal id
            title               text not null,
            first_line          text,
            english_title       text,
            composer            text,
            arranger            text,
            basic_notes         text,                  -- e.g. "F 3/4"
            notation            text,                  -- e.g. "1b = F 3/4"
            scripture           text,
            chorus              text,                  -- the `reff` field
            lyrics              text,                  -- all verses joined
            verse_count         integer,
            thumbnail           text,
            additional_info_raw text
        );

        create table sda_verses (
            sda_number   integer not null references sda_songs(number),
            seq          integer not null,
            verse_label  text,
            lyrics       text,
            primary key (sda_number, seq)
        );

        create index idx_sda_title  on sda_songs(title);
        create index idx_sda_comp   on sda_songs(composer);
    """)

    n_songs = n_verses = 0
    for r in data.values():
        num = int(r["sort"])
        info = parse_info(r.get("additional_info_one"))
        verses = r.get("verse") or []
        lyrics = "\n\n".join(
            f"Verse {v.get('verse')}:\n{(v.get('lyrics') or '').strip()}"
            for v in verses)

        artist = (r.get("artist") or "").strip()
        c.execute("""insert into sda_songs values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""", (
            num,
            int(r["id"]),
            r["title"],
            (r.get("second_line") or "").strip() or None,
            info["english_title"],
            info["composer"] or (artist if artist not in ("", "-") else None),
            info["arranger"],
            (r.get("basic_notes") or "").strip() or None,
            info["notation"],
            info["scripture"],
            (r.get("reff") or "").strip() or None,
            lyrics or None,
            len(verses),
            r.get("thumbnail"),
            r.get("additional_info_one"),
        ))
        n_songs += 1

        for i, v in enumerate(verses, 1):
            c.execute("insert into sda_verses values (?,?,?,?)",
                      (num, i, str(v.get("verse")), (v.get("lyrics") or "").strip()))
            n_verses += 1

    db.commit()

    q = lambda s: c.execute(s).fetchone()[0]
    print(f"sda_songs  : {n_songs} rows")
    print(f"sda_verses : {n_verses} rows")
    print(f"  composer   populated : {q('select count(*) from sda_songs where composer is not null')}")
    print(f"  arranger   populated : {q('select count(*) from sda_songs where arranger is not null')}")
    print(f"  english    populated : {q('select count(*) from sda_songs where english_title is not null')}")
    print(f"  notation   populated : {q('select count(*) from sda_songs where notation is not null')}")
    print(f"  scripture  populated : {q('select count(*) from sda_songs where scripture is not null')}")
    print(f"  chorus     populated : {q('select count(*) from sda_songs where chorus is not null')}")
    print(f"  lyrics     populated : {q('select count(*) from sda_songs where lyrics is not null')}")
    db.close()


if __name__ == "__main__":
    main()
