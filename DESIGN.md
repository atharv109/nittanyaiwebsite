# Chain of Custody — design notes

## Brief
- **Subject:** Nittany AI matchmaking engine (company signals → verified claims → judge score → PSU people).
- **Audience:** PSU Corporate Engagement staff. They use the site as a working tool: pick a company,
  see why, see who at Penn State fits, and see what was not checked.
- **Job:** trust in 10 seconds, a decision in 2 minutes. Data is the Oct 26–27 snapshot (frozen).
- **Theatre:** one signature moment, no loader, no GL. Craft in type, layout, hover and transition.

## Concept card
```
Idea:        Every number on this site carries its receipt, and you can watch one receipt get made.
Metaphor:    an evidence ledger / chain of custody (a tag that is stamped at each hand-off)
Signature:   "Custody walk" on home: one real verified claim (Bloom Energy, SEC filing) rides a
             sticky stage through five stations as you scroll; each station stamps the tag
             (fetched → contained → verified by → cited by judge → drafted, not sent).
             Recipe: pinned chapters (sticky stage + data-state), motion.md.
Emotion:     calm certainty; "this thing cannot make things up"
Motion verb: stamp and settle (short travel, a hard landing, no bounce)
Screenshot:  the tag half-way down the stage with three stamps on it and two blank slots
```

## System
- **Palette** (kept from v1, tokens in `global.css`): ground #fafaf8, raised #fff, ink #101214,
  muted #5a5f66, line #e2e2df, accent #2360d6, verified #0a7d4e, quarantined #9a4a00. Dark set mirrors.
  Stamps use verified (green) and quarantined (amber) only; blue is "interactive / in progress".
- **Type:** Outfit Variable (display + body), JetBrains Mono (ledger: ids, dates, counts, stamps).
  h1 clamp(34px, 5.2vw, 64px), tracking -0.03em. Body 16–17 px, 1.55.
- **Grid:** 12 col, max 1120 px, gutter clamp(16px, 2vw, 32px). Left edges align to col 1; ledger
  numbers right-align in tabular figures.
- **Shape:** radius 0 everywhere except stamps (2 px). 1 px rules, no shadows.
- **Motion:** engine eases (`expo.out` in, `expo.inOut` transitions, `power3.out` UI). Page transition:
  a ground-colored sheet wipes up 0.55 s and lifts 0.6 s (a page turning in the ledger).
  Hovers: nav underline draw; company rows: a left custody rule draws + arrow travels 6 px;
  CTA: ink fill from the pointer side. Inline links keep an underline at rest.
- **Idle:** still at rest, by decision. This is a working tool for staff; the custody walk and the
  hovers carry the life. (`idleMotion: false` is expected.)

## Composition
```
HOME   [h1 2/3 width | ledger totals column]           hero, split
       [sticky tag stage | 5 station chapters]           signature, sticky two-col
       [figure (anatomy): custody sorting machine]       inside "The whole engine", above the collector table
       [6 rules as a numbered ledger table]              table rows, full width
       [CTA band: results + faculty]                     band
RESULTS [h1 + totals strip] [ranked ledger rows w/ faculty count] [pending w/ reasons]
DOSSIER [score aside | dims, sources, evidence, final call, PSU faculty match, alumni]
FACULTY [h1] [topic supply/demand grid 40 cells] [what is missing list] [per-company matches]
404    [one line, two links]
```

## Genericness test
- Pipeline as five boxes with arrows is what any model draws → replaced by a single real claim
  being stamped (content is the animation).
- Results as cards with shadows → ledger rows, rules only, tabular numbers.

## Fig 1 (anatomy)
Object mapping: one lit claim tag rides a sorting machine (hopper of ten collector chutes, stamping press,
normalize gate, quote check, fact check with an amber side tray, balance, sealed outbox), and every bin, tray and
pan level is drawn to one scale of all claims, read from pipeline.json and runs.json at build time.
Source: src/components/figures/custody-machine/ (`node build.mjs --audit` proves the geometry).
