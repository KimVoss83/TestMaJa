#!/usr/bin/env python3
"""Tests für inject_release_notes.py — mit `python3 test_inject_release_notes.py` ausführbar."""
import json, re, importlib.util, os, sys

_here = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location(
    'inject_release_notes', os.path.join(_here, 'inject_release_notes.py'))
mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(mod)


def test_classify_prefix_priority():
    # "add fix ..." muss als Neu (feat/add-Prefix) gelten, nicht als Behoben
    assert mod.classify('add fix for broken export') == 'Neu'
    assert mod.classify('feat: Tutorial hinzugefügt') == 'Neu'
    assert mod.classify('fix: JSON-Speichern korrigiert') == 'Behoben'
    assert mod.classify('bug: Absturz beim Laden') == 'Behoben'


def test_classify_fallback_keywords():
    assert mod.classify('Leitungs-Doppelklick behoben') == 'Behoben'
    assert mod.classify('Neue Legende erstellt') == 'Neu'
    assert mod.classify('chore: update release notes') == 'Geändert'


def test_classify_word_boundary():
    # "fix" darf nicht im Wortinneren treffen (z. B. "prefix", "suffix")
    assert mod.classify('Umbau: prefix-Handling vereinheitlicht') == 'Geändert'


def test_encode_for_comment_neutralizes_terminator():
    payload = json.dumps({'entries': [{'msg': 'evil --> <script>alert(1)</script>'}]},
                         separators=(',', ':'), ensure_ascii=False)
    encoded = mod.encode_for_comment(payload)
    assert '-->' not in encoded
    assert '<' not in encoded and '>' not in encoded
    # In einen HTML-Kommentar eingebettet bleibt genau EIN Terminator übrig
    comment = f'<!-- RELEASE_NOTES_DATA:{encoded} -->'
    assert comment.count('-->') == 1
    # JSON.parse-Äquivalent: die \uXXXX-Escapes dekodieren zurück
    assert json.loads(encoded) == json.loads(payload)


def test_resub_backslash_safe():
    # Ein Ersatzstring mit \1 / \g darf von re.sub nicht als Rückverweis
    # interpretiert werden (Grund für den lambda-Ersatz in main()).
    placeholder_re = re.compile(r'<!-- RELEASE_NOTES_DATA:.*? -->')
    html = 'A<!-- RELEASE_NOTES_DATA:old -->B'
    tricky = '<!-- RELEASE_NOTES_DATA:{"m":"\\1 \\g<0>"} -->'
    out = placeholder_re.sub(lambda _: tricky, html)
    assert out == 'A' + tricky + 'B'


if __name__ == '__main__':
    failures = 0
    for name, fn in sorted(globals().items()):
        if name.startswith('test_') and callable(fn):
            try:
                fn()
                print(f'  ok   {name}')
            except AssertionError as e:
                failures += 1
                print(f'  FAIL {name}: {e}')
    print(f'\n{"PASSED" if not failures else str(failures) + " FAILED"}')
    sys.exit(1 if failures else 0)
