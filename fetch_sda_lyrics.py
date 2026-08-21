import json, re, html, os, time
from urllib.request import Request, urlopen
from concurrent.futures import ThreadPoolExecutor, as_completed

urls = {int(k): v for k, v in json.load(open('/tmp/sda_urls.json')).items()}
CACHE = '/tmp/sda_pages'
os.makedirs(CACHE, exist_ok=True)
OUT = '/tmp/sda_lyrics.json'

def extract_lyrics(htmltext):
    m = re.search(r'class="single-post-content[^"]*"[^>]*>(.*)', htmltext, re.S)
    if not m:
        return ''
    body = m.group(1)
    # cut at the obvious end of article/related section
    for marker in ['<footer', 'class="single-related', 'class="post-tags',
                   'class="single-post-author', 'id="comments', '<nav']:
        idx = body.find(marker)
        if idx != -1:
            body = body[:idx]
    txt = html.unescape(re.sub(r'<[^>]+>', '\n', body))
    txt = re.sub(r'[ \t]+', ' ', txt)
    txt = re.sub(r'\n\s*\n+', '\n', txt).strip()
    return txt[:4000]

def fetch(num):
    fn = os.path.join(CACHE, f'{num}.html')
    if os.path.exists(fn) and os.path.getsize(fn) > 1000:
        page = open(fn, encoding='utf-8', errors='ignore').read()
    else:
        req = Request(urls[num], headers={'User-Agent': 'Mozilla/5.0'})
        page = urlopen(req, timeout=30).read().decode('utf-8', 'ignore')
        open(fn, 'w', encoding='utf-8').write(page)
        time.sleep(0.05)
    return num, extract_lyrics(page)

lyrics = {}
errors = []
done = 0
with ThreadPoolExecutor(max_workers=10) as ex:
    futs = {ex.submit(fetch, n): n for n in urls}
    for f in as_completed(futs):
        n = futs[f]
        try:
            num, lyr = f.result()
            lyrics[num] = lyr
        except Exception as e:
            errors.append((n, str(e)[:50]))
        done += 1
        if done % 50 == 0:
            print(f'  fetched {done}/{len(urls)}', flush=True)

json.dump(lyrics, open(OUT, 'w'))
print(f'Done. {len(lyrics)} lyrics saved to {OUT}. Errors: {len(errors)}')
if errors:
    print('First errors:', errors[:5])
