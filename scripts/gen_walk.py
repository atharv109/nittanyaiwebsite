"""The two claims the home page's custody walk follows, from runs/matchengine.db and the needs handoff.

Usage: python scripts/gen_walk.py    Writes src/data/walk.json. Exits non-zero if a claim is missing.
"""
import json
import sqlite3
import sys
from pathlib import Path
from urllib.parse import urlparse

SITE = Path(__file__).resolve().parents[1]
db = sqlite3.connect(SITE.parent / 'runs' / 'matchengine.db')
db.row_factory = sqlite3.Row

# (company_id, excerpt prefix, verified). Filings text uses narrow no-break spaces, so match on normalized spaces.
TESLA = ('tsla', 'Tesla completed its investment of approximately $2.00 billion to acquire shares of Class A common stock of SpaceX')
BLOOM_FIELD_WORDS = 'fuel cell'  # the field is chosen by meaning: field synthesis renames fields between runs
BLOOM_TOPIC = 'Solid oxide fuel cells'  # the need topic the page follows into matches.json


def fail(msg):
    sys.exit(f'gen_walk: {msg}')


def norm(s):
    return ' '.join(s.replace(' ', ' ').replace(' ', ' ').split())


def claim(cid, prefix, among=None):
    # among: restrict to these evidence ids (the same headline can be stored at several URLs)
    rows = [r for r in db.execute('select * from evidence where company_id = ? and verified = 1', (cid,))
            if (prefix is None or norm(r['excerpt']).startswith(prefix)) and (among is None or r['evidence_id'] in among)]
    texts = {norm(r['excerpt']) for r in rows}
    if len(texts) != 1:  # copies of ONE headline at several URLs are fine; two different claims are not
        fail(f'expected 1 verified {cid} claim ({prefix or "cited by the field"}), found {len(texts)} distinct')
    r = sorted(rows, key=lambda x: x['evidence_id'])[0]
    v = json.loads(r['verdicts'] or '{}')
    by = v.get('verified_by') or []
    url = r['source_url']
    return {
        'evidenceId': r['evidence_id'], 'excerpt': r['excerpt'], 'implication': r['implication'],
        'url': url, 'host': urlparse(url).hostname.removeprefix('www.') if url.startswith('http') else None,
        'source': r['source'], 'published': r['published'][:10], 'eventDate': r['event_date'],
        'kind': r['kind'], 'uncertainty': r['uncertainty'],
        'fidelity': v.get('fidelity'), 'factCheck': v.get('fact_check'),
        'factCheckConfidence': v.get('fact_check_confidence'),
        'verifiedBy': [by] if isinstance(by, str) else by,
        'droppedInference': v.get('dropped_inference'), 'copies': len(rows),
    }


def company(cid):  # the company table stores ids as names; the page takes display names from matches.json
    n, ver = db.execute('select count(*), sum(verified) from evidence where company_id = ?', (cid,)).fetchone()
    return {'id': cid, 'claims': n, 'verified': ver or 0}


tesla = claim(*TESLA)
if (tesla['fidelity'], tesla['factCheck']) != ('substring', 'overreach'):
    fail(f"Tesla claim verdicts changed: {tesla['fidelity']}, {tesla['factCheck']}")

# Judge dimensions whose justification cites this purchase (latest score row for the company).
score = db.execute("select dims, final, capped from score where opportunity_id like 'tsla%' order by rowid desc").fetchone()
if not score:
    fail('no Tesla score row')
cited_in = [d['dim'] for d in json.loads(score['dims']) if 'SpaceX' in str(d['justification'])]

# Tesla's faculty matches come from its tagged needs (the handoff file gen_matches.py reads). Does any cite this claim?
NEEDS = Path(sys.argv[1]) if len(sys.argv) > 1 else SITE.parent / 'handoff' / 'company_needs.real.jsonl'
needs = [json.loads(l) for l in NEEDS.read_text(encoding='utf-8').splitlines() if l.strip()]
tsla_needs = [n for n in needs if n['company']['company_id'] == 'tsla']
citing = sum(1 for n in tsla_needs if any(e['evidence_id'] == tesla['evidenceId'] for e in n['evidence']))

# The fuel-cell field that cites the Bloom headline, then the copy of the headline that field cites.
candidates = [r for r in db.execute('select field, evidence_ids, latest_date from investment_field where company_id = ?',
                                    ('bloom-energy',)) if BLOOM_FIELD_WORDS in r['field'].lower()]
if not candidates:
    fail(f'no bloom-energy investment field mentioning {BLOOM_FIELD_WORDS!r}')
f = candidates[0]
ids = json.loads(f['evidence_ids'])
bloom = claim('bloom-energy', None, among=set(ids))  # the claim the field cites, whatever it is this run
if bloom['factCheck'] not in ('fact', 'overreach'):
    fail(f"Bloom claim fact check changed: {bloom['factCheck']}")
BLOOM_FIELD = f['field']
same = sum(1 for i in ids if db.execute('select excerpt from evidence where evidence_id = ?', (i,)).fetchone()[0]
           == bloom['excerpt'])

out = {
    'tesla': {'company': company('tsla'), 'claim': tesla,
              'judge': {'score': score['final'], 'capped': bool(score['capped']), 'citedIn': cited_in},
              'needs': {'total': len(tsla_needs), 'citingClaim': citing}},
    'bloom': {'company': company('bloom-energy'), 'claim': bloom,
              'field': {'name': BLOOM_FIELD, 'claims': len(ids), 'latest': f['latest_date'][:10]},
              'topic': BLOOM_TOPIC},
}
(SITE / 'src' / 'data' / 'walk.json').write_text(json.dumps(out, indent=1, ensure_ascii=False), encoding='utf-8')
print(f"tesla: {tesla['fidelity']}/{tesla['factCheck']} ({tesla['factCheckConfidence']}), judge cites it in {cited_in}, {citing} of {len(tsla_needs)} needs cite it; "
      f"bloom: {bloom['factCheck']}, field {BLOOM_FIELD!r} cites {len(ids)} claims")
