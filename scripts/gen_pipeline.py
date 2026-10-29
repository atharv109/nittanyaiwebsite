"""Per-stage counts for the home page's pipeline section, from runs/matchengine.db.

Usage: python scripts/gen_pipeline.py    Writes src/data/pipeline.json.
"""
import json
import sqlite3
from collections import Counter
from pathlib import Path

SITE = Path(__file__).resolve().parents[1]
db = sqlite3.connect(SITE.parent / 'runs' / 'matchengine.db')
q = lambda sql: db.execute(sql).fetchall()

# Every collector the engine has, in README order, with the source key it stamps.
COLLECTORS = [
    ('filings', 'SEC filings', 'SEC EDGAR 10-K, 10-Q and 8-K text, scoped by company'),
    ('news_rss', 'News', 'Company newsrooms and Google News RSS, resolved to the real publisher'),
    ('openalex', 'Publications', 'OpenAlex papers co-authored by company and university researchers'),
    ('linkedin_company_employees', 'LinkedIn', 'Company employee pages, read-only, rate-capped'),
    ('catalyst', 'Market catalysts', 'Stock moves and earnings dates. Timing only, never evidence of research need'),
    ('careers', 'Job boards', 'Greenhouse and Lever postings; PhD and research roles signal a need'),
    ('uspto', 'Patents', 'Patent filings by assignee'),
    ('innovation', 'Grants and SBIR', 'Federal innovation awards'),
    ('psu', 'Penn State engagement', 'Licensing, sponsorship and partnership announcements'),
    ('social', 'Social', 'Company and executive posts on X'),
]

docs = dict(q('select coalesce(source, ""), count(distinct source_url) from evidence group by 1'))
claims = dict(q('select coalesce(source, ""), count(*) from evidence group by 1'))
verified = dict(q('select coalesce(source, ""), sum(verified) from evidence group by 1'))

fid, fc, unchecked = Counter(), Counter(), 0
for v, ver in q('select verdicts, verified from evidence'):
    d = json.loads(v or '{}')
    fid[d.get('fidelity')] += 1
    if d.get('fact_check'):
        fc[(d['fact_check'], d.get('fact_check_confidence'))] += 1
    elif d.get('fidelity') == 'entailed':
        unchecked += 1

total, n_verified, stale = q('select count(*), sum(verified), sum(stale) from evidence')[0]
out = {
    'collectors': [{'key': k, 'name': n, 'what': w, 'docs': docs.get(k, 0), 'claims': claims.get(k, 0),
                    'verified': verified.get(k, 0) or 0} for k, n, w in COLLECTORS],
    'untagged': {'docs': docs.get('', 0), 'claims': claims.get('', 0), 'verified': verified.get('', 0) or 0},
    'documents': q('select count(distinct source_url) from evidence')[0][0],
    'claims': total,
    'kind': dict(q('select kind, count(*) from evidence group by kind')),
    'fidelity': {'substring': fid['substring'], 'entailed': fid['entailed'], 'unsupported': fid['unsupported']},
    'overreachHigh': sum(n for (k, c), n in fc.items() if k == 'overreach' and c == 'high'),
    'overreachMed': sum(n for (k, c), n in fc.items() if k == 'overreach' and c in ('med', 'low')),
    'factConfirmed': sum(n for (k, c), n in fc.items() if k == 'fact'),
    'entailedUnchecked': unchecked,
    'verified': n_verified,
    'stale': stale,
    'corroborated': q("select count(*) from evidence where collaborating_urls not in ('', '[]')")[0][0],
    'signals': dict(q('select kind, count(*) from signal_events group by kind')),
    'fields': q('select count(*), count(distinct company_id) from investment_field')[0],
    'alumni': q('select count(*) from alumnus')[0][0],
}
(SITE / 'src' / 'data' / 'pipeline.json').write_text(json.dumps(out, indent=1), encoding='utf-8')
print(f"{out['documents']} docs -> {total} claims -> {n_verified} verified; "
      f"{sum(1 for c in out['collectors'] if c['claims'])}/{len(COLLECTORS)} collectors returned data")
