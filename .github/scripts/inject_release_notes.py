#!/usr/bin/env python3
import subprocess, os, re, json, sys
from datetime import date

# JSON wird ohne Zeilenumbrüche serialisiert (json.dumps mit separators), daher kein re.DOTALL nötig
PLACEHOLDER_RE = re.compile(r'<!-- RELEASE_NOTES_DATA:.*? -->')

NEW_KEYWORDS     = ['add', 'neu', 'hinzugefügt', 'erstellt', 'feature']
FIXED_KEYWORDS   = ['fix', 'bug', 'fehler', 'behoben', 'korrigiert']

# Conventional-Commit-Prefixe haben Vorrang vor freier Schlüsselwortsuche,
# damit z. B. "add fix for X" korrekt als "Neu" (feat/add) klassifiziert wird.
NEW_PREFIXES   = ('feat', 'add', 'neu', 'feature')
FIXED_PREFIXES = ('fix', 'bugfix', 'bug')

def classify(msg):
    m = msg.lower().strip()
    head_match = re.match(r'[a-zäöü]+', m)
    head = head_match.group(0) if head_match else ''
    if head in NEW_PREFIXES:
        return 'Neu'
    if head in FIXED_PREFIXES:
        return 'Behoben'
    # Fallback: Schlüsselwörter an Wortgrenzen (verhindert Treffer im Wortinneren)
    if any(re.search(r'\b' + kw, m) for kw in FIXED_KEYWORDS):
        return 'Behoben'
    if any(re.search(r'\b' + kw, m) for kw in NEW_KEYWORDS):
        return 'Neu'
    return 'Geändert'

def encode_for_comment(json_str):
    """Kodiert '<' und '>' als \\uXXXX, damit die in einen HTML-Kommentar
    eingebettete JSON-Zeichenkette den Kommentar nicht vorzeitig mit '-->'
    beenden kann. JSON.parse dekodiert die Escapes wieder korrekt."""
    return json_str.replace('<', '\\u003c').replace('>', '\\u003e')

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
    json_str = encode_for_comment(json.dumps(data, separators=(',', ':'), ensure_ascii=False))
    new_comment = f'<!-- RELEASE_NOTES_DATA:{json_str} -->'
    # Ersatz als Funktion übergeben, damit Backslashes in json_str nicht als
    # Regex-Rückverweise (\1, \g<...>) interpretiert werden.
    new_html = PLACEHOLDER_RE.sub(lambda _: new_comment, html)

    with open(html_path, 'w', encoding='utf-8') as f:
        f.write(new_html)

    print(f'Injected {len(entries)} entries.')

if __name__ == '__main__':
    main()
