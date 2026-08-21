#!/usr/bin/env python3
"""
Second-pass SDA matching for the 133 Lagu Sion songs the correlation API
left unmapped.

The original match_sda.py compared each LS english_title against SDA *titles*
only. This pass adds the signal that data never had: the SDA first line
(`second_line`), pulled from getter/songs_album/ for all 695 hymns.

Hymns are routinely catalogued under a title in one book and under their
opening line in another, so english_title -> first_line catches pairs that
title -> title cannot.

Scoring per candidate is max(sequence ratio, token overlap), taken against
both the SDA title and its first line, keeping whichever scores higher.

Nothing is written to the database. Output is two CSVs for human review,
because a wrong hymn mapping is worse than a missing one -- someone
following it in a service turns to the wrong page.
"""

import csv
import json
import re
import sqlite3
from difflib import SequenceMatcher

AUTO = 0.95   # near-certain
STRONG = 0.85
REVIEW = 0.72  # floor worth a human look

STOP = {"the", "a", "an", "of", "and", "to", "my", "o", "is", "in", "on", "for"}


def norm(s):
    s = (s or "").lower().replace("&", "and")
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def toks(s):
    return {t for t in norm(s).split() if t not in STOP}


def score(a, b):
    """Blend character-level ratio with token overlap; either can carry a match."""
    na, nb = norm(a), norm(b)
    if not na or not nb:
        return 0.0
    ratio = SequenceMatcher(None, na, nb).ratio()
    ta, tb = toks(a), toks(b)
    jacc = len(ta & tb) / len(ta | tb) if (ta and tb) else 0.0
    return max(ratio, jacc)


def main():
    book = {}
    for sid, r in json.load(open("sda_hymnal_695.json"))["songs"].items():
        book[int(r["sort"])] = {
            "title": r["title"],
            "first_line": (r.get("second_line") or "").strip(),
        }

    db = sqlite3.connect("lagu_sion.db")
    db.row_factory = sqlite3.Row
    unmapped = db.execute(
        "select number, title, english_title from songs "
        "where sda_hymnal_num is null order by number"
    ).fetchall()
    taken = {r[0] for r in db.execute(
        "select distinct sda_hymnal_num from songs where sda_hymnal_num is not null")}

    results = []
    for row in unmapped:
        et = (row["english_title"] or "").strip()
        if not et:
            continue

        best = (0.0, None, None)
        for num, b in book.items():
            s_title = score(et, b["title"])
            s_line = score(et, b["first_line"])
            s, field = (s_title, "title") if s_title >= s_line else (s_line, "first_line")
            if s > best[0]:
                best = (s, num, field)

        s, num, field = best
        if s < REVIEW or num is None:
            continue
        results.append({
            "ls_number": row["number"],
            "ls_title": row["title"],
            "ls_english_title": et,
            "sda_num": num,
            "sda_title": book[num]["title"],
            "sda_first_line": book[num]["first_line"],
            "score": round(s, 3),
            "matched_on": field,
            "sda_already_used": "yes" if num in taken else "no",
        })

    results.sort(key=lambda r: -r["score"])
    auto = [r for r in results if r["score"] >= AUTO]
    strong = [r for r in results if AUTO > r["score"] >= STRONG]
    maybe = [r for r in results if STRONG > r["score"] >= REVIEW]

    cols = list(results[0].keys()) if results else []
    for name, rows in (("sda_match_v2_accept.csv", auto + strong),
                       ("sda_match_v2_review.csv", maybe)):
        with open(name, "w", newline="") as f:
            w = csv.DictWriter(f, fieldnames=cols)
            w.writeheader()
            w.writerows(rows)

    print(f"unmapped LS songs considered : {len([r for r in unmapped if r['english_title']])}")
    print(f"  auto   (>={AUTO})          : {len(auto)}")
    print(f"  strong ({STRONG}-{AUTO})       : {len(strong)}")
    print(f"  review ({REVIEW}-{STRONG})       : {len(maybe)}")
    print(f"  matched via first_line     : {sum(1 for r in results if r['matched_on']=='first_line')}")
    print(f"  points at an already-used SDA #: {sum(1 for r in results if r['sda_already_used']=='yes')}")
    print("\ntop candidates:")
    for r in (auto + strong)[:15]:
        flag = " [dup]" if r["sda_already_used"] == "yes" else ""
        print(f"  {r['score']:.3f} [{r['matched_on']:10}] LS {r['ls_number']:3} "
              f"{r['ls_english_title'][:34]:36} -> SDA {r['sda_num']:3} {r['sda_title'][:34]}{flag}")


if __name__ == "__main__":
    main()
