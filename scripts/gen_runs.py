#!/usr/bin/env python3
"""Generate src/data/runs.json for the presentation site from runs/matchengine.db.

Same extraction rules as the dossier builders (fail-closed, ISO-or-null,
verified-only top-25 evidence, real verifier records). Run from repo root:
  python website/scripts/gen_runs.py
"""
import json
import re
import sqlite3
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DB = ROOT / 'runs' / 'matchengine.db'
OUT = ROOT / 'website' / 'src' / 'data' / 'runs.json'

META = {
 'aapl': ('Apple Inc.', 'AAPL', 'Vision Pro / vision'),
 'air-products': ('Air Products', 'APD', 'NEOM hydrogen'),
 'amazon': ('Amazon.com, Inc.', 'AMZN', 'AI / Anthropic'),
 'bloom-energy': ('Bloom Energy', 'BE', 'energy / fuel cells'),
 'cat': ('Caterpillar Inc.', 'CAT', '793 EV mining'),
 'corning': ('Corning Incorporated', 'GLW', 'materials / glass'),
 'deere': ('Deere & Company', 'DE', 'Bear Flag autonomy'),
 'f': ('Ford Motor Company', 'F', 'Blue Oval / electrification'),
 'ge-vernova': ('GE Vernova', 'GEV', 'energy infrastructure'),
 'gm': ('General Motors', 'GM', 'Ultium'),
 'googl': ('Alphabet Inc.', 'GOOGL', 'AI / Anthropic'),
 'ibm': ('International Business Machines', 'IBM', 'quantum computing'),
 'intc': ('Intel Corporation', 'INTC', 'foundry'),
 'msft': ('Microsoft Corporation', 'MSFT', 'AI / OpenAI'),
 'tsla': ('Tesla, Inc.', 'TSLA', 'Dojo / AI'),
 'xom': ('Exxon Mobil Corporation', 'XOM', 'lithium'),
}
SRC_LABEL = {'filings': 'SEC filings', 'catalyst': 'market catalyst', 'openalex': 'publications',
             'news': 'news RSS', 'careers': 'job boards', 'innovation': 'grants/SBIR',
             'psu': 'PSU news', 'linkedin_company_employees': 'LinkedIn employees',
             'linkedin_post': 'LinkedIn posts', 'movement': 'LinkedIn movement',
             'market': 'market data', 'uspto': 'patents', 'social': 'social'}


def as_list(v):
    if isinstance(v, list):
        return [str(i) for i in v if str(i).strip()]
    if isinstance(v, str) and v.strip():
        return [v.strip()]
    return []


c = sqlite3.connect(str(DB)); c.row_factory = sqlite3.Row
total_ev, total_ver = 0, 0
rows = []
for comp, (name, ticker, area) in META.items():
    ev = c.execute('select count(*) from evidence where company_id=?', (comp,)).fetchone()[0]
    ver = c.execute('select count(*) from evidence where company_id=? and verified=1', (comp,)).fetchone()[0]
    fresh = c.execute("select count(*) from evidence where company_id=? and event_date >= '2026-07-28' and length(event_date)=10", (comp,)).fetchone()[0]
    total_ev += ev; total_ver += ver
    by_source = {}
    for r in c.execute('select source, count(*), sum(case when verified=1 then 1 else 0 end) from evidence where company_id=? group by source', (comp,)):
        by_source[r[0]] = {'total': r[1], 'verified': r[2], 'label': SRC_LABEL.get(r[0], r[0])}
    sr = c.execute('select final, capped, dims, dissent from score where opportunity_id like ? order by rowid', (comp + '%',)).fetchall()
    dims, dissent, score, capped = [], None, None, None
    if sr:
        last = sr[-1]
        score, capped, dissent = last['final'], bool(last['capped']), last['dissent']
        dims = [{'dim': d['dim'], 'score': d['score'], 'justification': str(d['justification'])} for d in json.loads(last['dims'])]
    fields = [{'name': r[0], 'date': (r[1] or '')[:10]}
              for r in c.execute('select field, latest_date from investment_field where company_id=? order by latest_date desc limit 6', (comp,))]
    alumni = []
    for r in c.execute('select name, role, relevance, route from alumnus where company_id=?', (comp,)):
        try: rel = json.loads(r['relevance'] or '{}')
        except Exception: rel = {}
        if rel:
            alumni.append({'name': r['name'], 'role': r['role'], 'route': r['route'],
                           'total': rel.get('total'), 'area': rel.get('area'), 'dims': rel.get('dims')})
    evidence = []
    for r in c.execute("""select source, source_url, event_date, published, implication, excerpt, verdicts from evidence
        where company_id=? and verified=1
        order by coalesce(nullif(length(event_date),0),0) desc, event_date desc, published desc, rowid desc limit 25""", (comp,)):
        try: v = json.loads(r['verdicts'] or '{}')
        except Exception: v = {}
        d = (r['event_date'] or r['published'] or '')[:10]
        evidence.append({'source': SRC_LABEL.get(r['source'], r['source']), 'sourceKey': r['source'],
                         'url': r['source_url'], 'date': d if len(d) == 10 else None,
                         'verifiedBy': as_list(v.get('verified_by')),
                         'excerpt': re.sub(r'\s+', ' ', r['excerpt'] or '').strip()[:280],
                         'implication': re.sub(r'\s+', ' ', r['implication'] or '').strip()[:220]})
    rows.append({'cid': comp, 'name': name, 'ticker': ticker, 'area': area, 'pending': score is None,
                 'ev': ev, 'verified': ver, 'fresh': fresh, 'bySource': by_source, 'score': score,
                 'capped': capped, 'dissent': dissent, 'dims': dims, 'fields': fields,
                 'alumni': alumni, 'evidence': evidence})
c.close()
rows.sort(key=lambda r: -(r['score'] if r['score'] is not None else -1))
ranked = [r for r in rows if r['score'] is not None]
pending = [r for r in rows if r['score'] is None]
scores = [r['score'] for r in ranked]
uncapped = sum(1 for r in ranked if not r['capped'])
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps({
    'generatedAt': date.today().isoformat(),
    'totals': {'scored': len(ranked), 'pending': len(pending), 'documents': total_ev,
               'verified': total_ver, 'uncapped': uncapped,
               'median': sorted(scores)[len(scores)//2] if scores else None},
    'ranked': ranked, 'pending': pending,
}, ensure_ascii=False, indent=1), encoding='utf-8')
print(f'wrote {OUT} - {len(ranked)} ranked + {len(pending)} pending, docs {total_ev:,}, verified {total_ver:,}')