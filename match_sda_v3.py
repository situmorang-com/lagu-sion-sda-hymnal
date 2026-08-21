#!/usr/bin/env python3
"""
Third-pass SDA matching, using clean English titles from an independent source.

match_sda_v2.py matched on lagusion.org's own english_title field, which is
OCR-damaged ("Before Behovah's Awful Throne", "A Wonderful Savior is Iesus").
Bad keys produce bad matches.

hymnalaccompanist.com published an English-title index of Lagu Sion Edisi Lama,
recovered here from the Wayback Machine (the live site is down). Its numbering
matches our old_edition_num exactly, verified on known pairs, and its titles are
clean. That gives 122 of the 133 unmapped songs a better key.

Candidates are still written out for review rather than applied. A wrong hymn
mapping sends someone to the wrong page mid-service.
"""

import csv
import json
import re
import sqlite3
from difflib import SequenceMatcher

STRONG = 0.85
REVIEW = 0.72
STOP = {"the", "a", "an", "of", "and", "to", "my", "o", "is", "in", "on", "for"}


def norm(s):
    s = (s or "").lower().replace("&", "and")
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def toks(s):
    return {t for t in norm(s).split() if t not in STOP}


def score(a, b):
    na, nb = norm(a), norm(b)
    if not na or not nb:
        return 0.0
    ratio = SequenceMatcher(None, na, nb).ratio()
    ta, tb = toks(a), toks(b)
    jacc = len(ta & tb) / len(ta | tb) if (ta and tb) else 0.0
    return max(ratio, jacc)


def main():
    book = {int(r["sort"]): {"title": r["title"],
                             "first_line": (r.get("second_line") or "").strip()}
            for r in json.load(open("sda_hymnal_695.json"))["songs"].values()}
    ha = {int(k): v for k, v in json.load(open("ha_old_edition_english.json")).items()}

    db = sqlite3.connect("lagu_sion.db")
    db.row_factory = sqlite3.Row
    unmapped = db.execute(
        "select number, title, english_title, old_edition_num from songs "
        "where sda_hymnal_num is null order by number").fetchall()
    taken = {r[0] for r in db.execute(
        "select distinct sda_hymnal_num from songs where sda_hymnal_num is not null")}

    results = []
    for row in unmapped:
        keys = []
        clean = ha.get(row["old_edition_num"]) if row["old_edition_num"] else None
        if clean:
            keys.append(("hymnalaccompanist", clean))
        if (row["english_title"] or "").strip():
            keys.append(("lagusion", row["english_title"].strip()))
        if not keys:
            continue

        best = (0.0, None, None, None, None)
        for src, key in keys:
            for num, b in book.items():
                st, sl = score(key, b["title"]), score(key, b["first_line"])
                s, field = (st, "title") if st >= sl else (sl, "first_line")
                if s > best[0]:
                    best = (s, num, field, src, key)

        s, num, field, src, key = best
        if num is None or s < REVIEW:
            continue
        results.append({
            "ls_number": row["number"], "ls_title": row["title"],
            "key_used": key, "key_source": src,
            "sda_num": num, "sda_title": book[num]["title"],
            "sda_first_line": book[num]["first_line"],
            "score": round(s, 3), "matched_on": field,
            "sda_already_used": "yes" if num in taken else "no",
        })

    results.sort(key=lambda r: -r["score"])
    strong = [r for r in results if r["score"] >= STRONG]
    maybe = [r for r in results if r["score"] < STRONG]

    if results:
        cols = list(results[0].keys())
        for name, rows in (("sda_match_v3_strong.csv", strong),
                           ("sda_match_v3_review.csv", maybe)):
            with open(name, "w", newline="") as f:
                w = csv.DictWriter(f, fieldnames=cols)
                w.writeheader()
                w.writerows(rows)

    print(f"unmapped songs with a usable key : "
          f"{sum(1 for r in unmapped if ha.get(r['old_edition_num']) or r['english_title'])}")
    print(f"  keys from hymnalaccompanist    : {sum(1 for r in results if r['key_source']=='hymnalaccompanist')}")
    print(f"  strong (>={STRONG})              : {len(strong)}")
    print(f"  review ({REVIEW}-{STRONG})           : {len(maybe)}")
    print("\nstrong candidates:")
    for r in strong:
        dup = " [SDA# already used]" if r["sda_already_used"] == "yes" else ""
        print(f"  {r['score']:.3f} [{r['matched_on']:10}] LS {r['ls_number']:3} "
              f"{r['key_used'][:36]:38} -> SDA {r['sda_num']:3} {r['sda_title'][:32]}{dup}")


if __name__ == "__main__":
    main()
