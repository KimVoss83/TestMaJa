#!/usr/bin/env python3
import subprocess, os, re, json, sys
from datetime import date

# JSON wird ohne Zeilenumbrüche serialisiert (json.dumps mit separators), daher kein re.DOTALL nötig
PLACEHOLDER_RE = re.compile(r'<!-- RELEASE_NOTES_DATA:.*? -->')

NEW_KEYWORDS     = ['add', 'neu', 'hinzugefügt', 'erstellt', 'feature']
FIXED_KEYWORDS   = ['fix', 'bug', 'fehler', 'behoben', 'korrigiert']

def classify(msg):
    m = msg.lower()
    if any(re.search(kw, m) for kw in FIXED_KEYWORDS):
        return 'Behoben'
    if any(re.search(kw, m) for kw in NEW_KEYWORDS):
        return 'Neu'
    return 'Geändert'

def get_commits():
    before = os.environ.get('BEFORE_SHA', '')
    if not before or before.startswith('0000000'):
        cmd = ['git', 'log', '--format=%s', 'HEAD']
    else:
        cmd = ['git', 'log', '--format=%s', f'{before}..HEAD']
    result = subprocess.run(cmd, capture_output=True, text=True)
    return result.stdout.strip().splitlines()

def main():
    html_path = 'index-1.html'
    with open(html_path, 'r', encoding='utf-8') as f:
        html = f.read()

    if not PLACEHOLDER_RE.search(html):
        print('ERROR: RELEASE_NOTES_DATA placeholder not found in index-1.html')
        sys.exit(1)

    commits = get_commits()
    entries = []
    for msg in commits:
        msg = msg.strip()
        if not msg:
            continue
        # Filtert sowohl manuelle Merge-Commits als auch GitHub PR-Merges ("Merge pull request #N from ...")
        if msg.startswith('Merge '):
            continue
        if '[skip ci]' in msg:
            continue
        entries.append({'cat': classify(msg), 'msg': msg})

    if not entries:
        print('No relevant commits — skipping.')
        sys.exit(0)

    data = {
        'version': date.today().isoformat(),
        'entries': entries
    }
    json_str = json.dumps(data, separators=(',', ':'), ensure_ascii=False)
    new_comment = f'<!-- RELEASE_NOTES_DATA:{json_str} -->'
    new_html = PLACEHOLDER_RE.sub(new_comment, html)

    with open(html_path, 'w', encoding='utf-8') as f:
        f.write(new_html)

    print(f'Injected {len(entries)} entries.')

if __name__ == '__main__':
    main()
