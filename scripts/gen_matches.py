"""Company -> PSU faculty matches for the site, from the two handoff files.

score(company, faculty) = sum over the company's needs, over topics shared with the
faculty member, of  need_topic_weight * (need_strength / 5) * depth * activity, where
depth = min(1, papers in the topic / 10) and activity = min(1, works since 2022 / 5).
Topic SHARE (papers in topic / all papers) was tried first: it ranked one-paper and
h-index-0 authors above prolific faculty, whose papers spread across many topics.
Authors with no recent works score 0 and are counted as inactive.
Every term is kept in the output so the page can show the arithmetic.

Usage: python scripts/gen_matches.py [company_needs.jsonl] [faculty_profiles.jsonl]
Writes src/data/matches.json.
"""
import json
import sys
from collections import defaultdict
from pathlib import Path

SITE = Path(__file__).resolve().parents[1]
REPO = SITE.parent
NEEDS = Path(sys.argv[1]) if len(sys.argv) > 1 else REPO / 'handoff' / 'company_needs.real.jsonl'
FAC = Path(sys.argv[2]) if len(sys.argv) > 2 else REPO / 'handoff' / 'faculty_profiles.real.jsonl'
TOP_N = 6
ACTIVE_SINCE = 2024  # last publication year at or after this counts as active
FULL_ACTIVITY_WORKS = 5  # works since 2022 that earn the full activity weight
FULL_DEPTH_WORKS = 10    # papers in the topic that earn the full depth weight


def depth(f, share):
    return min(1.0, share * (f.get("works_total") or 0) / FULL_DEPTH_WORKS)


def activity(f):
    return min(1.0, (f['works_last_5y'] or 0) / FULL_ACTIVITY_WORKS)


def read_jsonl(p):
    return [json.loads(l) for l in p.read_text(encoding='utf-8').splitlines() if l.strip()]


needs = read_jsonl(NEEDS)
faculty = read_jsonl(FAC)
topics = json.loads((REPO / 'handoff' / 'topics.json').read_text(encoding='utf-8'))

by_topic = defaultdict(list)  # topic_id -> [(faculty, weight, OpenAlex topic label)]
for f in faculty:
    for t in f['topics']:
        by_topic[t['topic_id']].append((f, t['weight'], t.get('oa_label')))

companies = {}
demand = defaultdict(set)  # topic_id -> company ids that need it
for n in needs:
    c = n['company']['company_id']
    companies.setdefault(c, {'name': n['company']['name'], 'needs': []})['needs'].append(n)
    for t in n['need']['topics']:
        demand[t['topic_id']].add(c)

out_companies = {}
for cid, c in companies.items():
    rows, inactive = {}, set()
    for n in c['needs']:
        strength = (n['need']['strength'] or 0) / 5
        for nt in n['need']['topics']:
            for f, fw, oa in by_topic.get(nt['topic_id'], []):
                act = activity(f)
                if not act:
                    inactive.add(f['faculty_id'])
                    continue
                dep = round(depth(f, fw), 3)
                term = nt['weight'] * strength * dep * act
                r = rows.setdefault(f['faculty_id'], {'faculty': f, 'score': 0.0, 'terms': []})
                r['score'] += term
                r['terms'].append({'topic': nt['label'], 'needWeight': nt['weight'],
                                   'strength': n['need']['strength'], 'facultyWeight': fw, 'oaLabel': oa,
                                   'depth': dep, 'topicPapers': round(fw * (f.get('works_total') or 0)), 'activity': act, 'term': round(term, 4), 'need': n['need']['summary']})
    ranked = sorted(rows.values(), key=lambda r: (-r['score'], -(r['faculty']['works_last_5y'] or 0)))

    def card(r, terms=None):
        return {
            'id': r['faculty']['faculty_id'], 'name': r['faculty']['name'],
            'department': r['faculty']['department'], 'score': round(r['score'], 4),
            'hIndex': r['faculty']['h_index'], 'works5y': r['faculty']['works_last_5y'],
            'lastPub': r['faculty']['last_pub_year'],
            'active': (r['faculty']['last_pub_year'] or 0) >= ACTIVE_SINCE,
            'industryCollabs': r['faculty'].get('prior_industry_collabs'),
            'terms': terms if terms is not None else r['terms'],
        }

    # The overall top N can all sit on one topic; keep the best researcher per need topic too.
    top_by_topic = {}
    for label in {t['topic'] for r in ranked for t in r['terms']}:
        on = [(sum(t['term'] for t in r['terms'] if t['topic'] == label), r) for r in ranked]
        best = max((x for x in on if x[0] > 0), key=lambda x: (x[0], x[1]['faculty']['works_last_5y'] or 0))
        top_by_topic[label] = card(best[1], [t for t in best[1]['terms'] if t['topic'] == label])
    out_companies[cid] = {
        'name': c['name'],
        'needTopics': sorted({t['label'] for n in c['needs'] for t in n['need']['topics']}),
        'unmatchedTopics': sorted({t['label'] for n in c['needs'] for t in n['need']['topics']
                                   if not by_topic.get(t['topic_id'])}),
        'matches': [card(r) for r in ranked[:TOP_N]],
        'topByTopic': top_by_topic,
        'matchCount': len(ranked),
        'inactiveCount': len(inactive),
    }

coverage = [{'id': tid, 'label': label, 'faculty': len(by_topic.get(tid, [])),
             'companies': sorted(demand.get(tid, []))} for tid, label in topics.items()]

nulls = {k: sum(1 for f in faculty if f.get(k) is None)
         for k in ('department', 'active_grants', 'patents', 'prior_industry_collabs', 'open_to_industry')}
out = {
    'source': {'needs': NEEDS.name, 'faculty': FAC.name, 'needCount': len(needs),
               'facultyCount': len(faculty),
               'synthetic': any(r.get('synthetic') for r in needs + faculty)},
    'nulls': nulls,
    'inactiveFaculty': sum(1 for f in faculty if not activity(f)),
    'copubLinked': sum(1 for n in needs if n['psu_links']['copub_faculty_ids']),
    'coverage': coverage,
    'companies': out_companies,
}
dest = SITE / 'src' / 'data' / 'matches.json'
dest.write_text(json.dumps(out, indent=1, ensure_ascii=False), encoding='utf-8')
matched = sum(1 for c in out_companies.values() if c['matches'])
print(f'{len(faculty)} faculty, {len(needs)} needs -> {dest.name}: '
      f'{matched}/{len(out_companies)} companies have a faculty match; '
      f'{sum(1 for x in coverage if x["faculty"])}/{len(coverage)} topics have faculty')
