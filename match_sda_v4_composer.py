#!/usr/bin/env python3
"""
Fourth-pass SDA matching, keyed on composer rather than title.

Earlier passes matched titles and produced mostly noise, because an Indonesian
translation's English title is often a loose paraphrase. Composer is far more
discriminating: it is what exposed the v2 false positive, where LS 296 scored
0.80 against SDA 238 but is credited to W. C. Martin while SDA 238 is John
Newton's hymn.

Both books are now in the database (songs.composer 497/525,
sda_songs.composer 317/695), so this needs no new scraping.

Strategy: for each unmapped LS song, find SDA hymns sharing a composer
surname, then rank those few candidates by title/first-line similarity. A
shared surname plus any title agreement is far stronger evidence than title
similarity alone across all 695.

Writes candidates for review. Nothing is applied automatically.
"""

import csv
import re
import sqlite3
from difflib import SequenceMatcher

STOP = {"the", "a", "an", "of", "and", "to", "my", "o", "is", "in", "on", "for"}
NOISE = {"jr", "sr", "dr", "mr", "mrs", "st", "rev"}


def norm(s):
    s = (s or "").lower().replace("&", "and")
    s = re.sub(r"\(.*?\)", " ", s)          # drop "(1983-18260)" style junk
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def surnames(person):
    """Last alphabetic token(s) of a credit, lowercased. Handles initials."""
    n = norm(person)
    if not n:
        return set()
    parts = [p for p in n.split() if len(p) > 2 and p not in NOISE]
    return {parts[-1]} if parts else set()


def title_score(a, b):
    na, nb = norm(a), norm(b)
    if not na or not nb:
        return 0.0
    ratio = SequenceMatcher(None, na, nb).ratio()
    ta = {t for t in na.split() if t not in STOP}
    tb = {t for t in nb.split() if t not in STOP}
    jacc = len(ta & tb) / len(ta | tb) if (ta and tb) else 0.0
    return max(ratio, jacc)


def main():
    db = sqlite3.connect("lagu_sion.db")
    db.row_factory = sqlite3.Row

    sda = db.execute("""select number, title, first_line, composer, arranger
                        from sda_songs""").fetchall()
    taken = {r[0] for r in db.execute(
        "select distinct sda_hymnal_num from songs where sda_hymnal_num is not null")}

    # index SDA hymns by composer AND arranger surname -- translations often
    # credit whichever of the two the Indonesian editors had to hand
    by_name = {}
    for h in sda:
        for who in (h["composer"], h["arranger"]):
            for s in surnames(who):
                by_name.setdefault(s, set()).add(h["number"])
    sda_by_num = {h["number"]: h for h in sda}

    unmapped = db.execute("""select number, title, english_title, composer, arranger
                             from songs where sda_hymnal_num is null
                             order by number""").fetchall()

    rows = []
    for ls in unmapped:
        keys = surnames(ls["composer"]) | surnames(ls["arranger"])
        cands = set()
        for k in keys:
            cands |= by_name.get(k, set())
        if not cands:
            continue

        for num in cands:
            h = sda_by_num[num]
            t = max(title_score(ls["english_title"] or "", h["title"]),
                    title_score(ls["english_title"] or "", h["first_line"] or ""))
            shared = (surnames(ls["composer"]) | surnames(ls["arranger"])) & \
                     (surnames(h["composer"]) | surnames(h["arranger"]))
            rows.append({
                "ls_number": ls["number"], "ls_title": ls["title"],
                "ls_english_title": ls["english_title"],
                "ls_composer": ls["composer"], "ls_arranger": ls["arranger"],
                "sda_num": num, "sda_title": h["title"],
                "sda_composer": h["composer"], "sda_arranger": h["arranger"],
                "shared_surname": ",".join(sorted(shared)),
                "title_score": round(t, 3),
                "sda_already_used": "yes" if num in taken else "no",
            })

    # best candidate per LS song
    best = {}
    for r in rows:
        k = r["ls_number"]
        if k not in best or r["title_score"] > best[k]["title_score"]:
            best[k] = r
    out = sorted(best.values(), key=lambda r: -r["title_score"])

    if out:
        with open("sda_match_v4_composer.csv", "w", newline="") as f:
            w = csv.DictWriter(f, fieldnames=list(out[0].keys()))
            w.writeheader()
            w.writerows(out)

    print(f"unmapped LS songs                 : {len(unmapped)}")
    print(f"  with a usable composer/arranger : {sum(1 for r in unmapped if surnames(r['composer']) | surnames(r['arranger']))}")
    print(f"  sharing a surname with some SDA : {len(best)}")
    print(f"  raw candidate pairs             : {len(rows)}")
    print("\nranked by title agreement (surname already matches):")
    for r in out[:20]:
        dup = " [SDA# used]" if r["sda_already_used"] == "yes" else ""
        print(f"  t={r['title_score']:.2f} [{r['shared_surname']:12}] "
              f"LS {r['ls_number']:3} {(r['ls_english_title'] or r['ls_title'])[:30]:32}"
              f" -> SDA {r['sda_num']:3} {r['sda_title'][:30]}{dup}")


if __name__ == "__main__":
    main()
