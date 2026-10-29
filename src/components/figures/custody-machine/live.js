// Fig 1 live behaviour. One pure function of time (poseAt) places the lit tag and every moving part;
// the tour advances time on the GSAP ticker, the pointer scrubs it, keys step between stations.
import { gsap } from "gsap";
import { iso, translateAlong, holdStill, solidSvg, pathOf } from "./kit/iso-kit.mjs";
import { frameOf, prismOf } from "./kit/lathe.mjs";

const fmt = (x) => x.toLocaleString("en-US");
const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const lerp3 = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];

// Fates in tour order: most tags that reach the end pass both inspections.
const FATES = ["pass", "raised", "fact", "pass", "quote"];
// seconds of "collect" before the press stamps, so step 1 has its own moment
const LEAD = 1.0;

function timeline(D, fate) {
  const r = D.route, c = D.counts;
  const keys = []; // { t, pos, pose, slot, phase }
  let t = 0;
  const go = (dur, pos, extra = {}) => { t += dur; keys.push({ t, pos, pose: "flat", slot: "belt", ...extra }); };
  const words = {
    collect: `collect · ${fmt(c.documents)} documents from ${c.feeding} collectors`,
    press: `press · ${fmt(c.documents)} documents, ${fmt(c.claims)} claims`,
    belt: `belt · about ${c.perDoc} tags per document`,
    gate: "gate · quote overlap and boilerplate",
    quote: `quote check · ${fmt(c.verbatim + c.paraphrase)} of ${fmt(c.quoted)} kept`,
    quoteOut: `quote check · ${fmt(c.unsupported)} unsupported, out`,
    fact: `fact check · ${fmt(c.confirmed)} confirmed`,
    raised: `fact check · ${fmt(c.raised)} kept, uncertainty raised`,
    factOut: `fact check · ${fmt(c.rejected)} quotes kept, inference dropped`,
    judge: `judge · ${fmt(c.verified)} verified weighed`,
    outbox: `outbox · ${fmt(c.scored)} scored · ${fmt(c.sent)} sent`,
  };
  keys.push({ t: 0, pos: r.start, pose: "flat", slot: "belt", phase: words.collect, stop: "collect" });
  go(LEAD, r.start, { phase: words.collect });
  go(0.01, r.start, { phase: words.press, stop: "press" });
  go(1.0, r.start, { phase: words.press });
  go(1.1, r.gate, { phase: words.belt });
  go(0.2, r.gate, { phase: words.gate, stop: "gate" });
  go(1.3, r.s1, { phase: words.gate });
  go(1.4, r.s1, { phase: fate === "quote" ? words.quote : words.quote, stop: "s1", inspect: "lens" });
  const out = (o, slotName, pose, phase) => {
    go(0.7, [o.x, 0, r.s1[2]], { phase });
    go(0.45, o.chute[0], { phase, slot: `${slotName}.chute` });
    go(0.55, o.chute[1], { phase, pose, slot: `${slotName}.chute` });
    go(0.3, o.bin, { phase, slot: slotName.includes("tray") ? "s2.tray" : `${slotName}.bin`, stop: "out" });
    go(1.6, o.bin, { phase, slot: slotName.includes("tray") ? "s2.tray" : `${slotName}.bin`, fade: true });
  };
  // which numbered station (figure callouts and the step list) each phase belongs to
  const stepOf = new Map([
    [words.collect, 1], [words.press, 2], [words.belt, 2], [words.gate, 3], [words.quote, 4], [words.quoteOut, 4],
    [words.fact, 5], [words.raised, 5], [words.factOut, 5], [words.judge, 6], [words.outbox, 7],
  ]);
  if (fate === "quote") { out(r.s1Out, "s1", "front", words.quoteOut); return { keys, T: t, words, stepOf }; }
  go(1.4, r.s2, { phase: words.quote });
  go(1.4, r.s2, { phase: fate === "raised" ? words.raised : fate === "fact" ? words.factOut : words.fact, stop: "s2", inspect: "probe" });
  // Overreach no longer removes a tag: at medium the tag goes on with raised
  // uncertainty, at high its inference is dropped and the verbatim quote goes on.
  // Both reach the judge; the bin and tray only show how many of each there were.
  const s2Phase = fate === "raised" ? words.raised : fate === "fact" ? words.factOut : words.fact;
  go(1.3, r.end, { phase: s2Phase });
  go(0.35, [r.end[0] + 8, 0, r.end[2] - 1], { phase: words.judge, slot: "panL" });
  go(0.35, r.pan, { phase: words.judge, slot: "panL", land: true, stop: "out" });
  go(1.6, r.pan, { phase: words.judge, slot: "panL" });
  go(1.6, r.pan, { phase: words.outbox, slot: "panL", fade: true });
  return { keys, T: t, words, stepOf };
}

function poseAt(D, line, t) {
  const { keys } = line;
  let i = keys.findIndex((k) => k.t >= t);
  if (i <= 0) i = Math.max(1, i < 0 ? keys.length - 1 : 1);
  const a = keys[i - 1], b = keys[i];
  const f = ease((t - a.t) / Math.max(1e-6, b.t - a.t));
  const pos = lerp3(a.pos, b.pos, f);
  const s = {
    pos, pose: b.pose, slot: b.slot, phase: b.phase, opacity: 1,
    ram: 0, lens: 0, probe: 0, flap: 0, tilt: 0,
  };
  s.step = line.stepOf.get(b.phase) ?? 0;
  // the press stamps at the start of every tag, after the collect lead-in
  const tp = t - LEAD;
  if (tp > 0 && tp < 1) s.ram = Math.sin(Math.PI * Math.min(1, tp / 0.9)) ** 2;
  s.opacity = tp < 0.45 ? 0 : 1;
  if (b.fade) s.opacity = 1 - ease((t - (b.t - 0.5)) / 0.5);
  if (b.inspect) {
    const u = (t - a.t) / (b.t - a.t);
    const press = ease(u / 0.3) * (1 - ease((u - 0.7) / 0.3));
    s[b.inspect] = press;
  }
  if (s.slot === "belt") s.flap = ease(1 - Math.abs(pos[0] - D.route.gate[0]) / 14);
  // the balance: tilts when the tag lands, settles, and swings back as the tag leaves
  const land = keys.find((k) => k.land);
  if (land && t > land.t - 0.05) {
    const age = t - (land.t - 0.05);
    const target = (2.2 * Math.PI) / 180;
    let tilt = target * (1 - Math.exp(-age * 3.2) * Math.cos(age * 7));
    const end = line.T - 0.5;
    if (t > end) tilt *= 1 - ease((t - end) / 0.5);
    s.tilt = tilt;
  }
  return s;
}

export function mountCustody(root, { reduced = false } = {}) {
  const stage = root.querySelector(".cm-stage");
  const svg = stage?.querySelector("svg");
  const json = root.querySelector("script[data-cm]");
  if (!stage || !svg || !json) return () => {};
  const D = JSON.parse(json.textContent);
  const P = D.P;
  const readout = root.querySelector("[data-readout]");
  const status = root.querySelector("[data-status]");
  const tag = svg.querySelector('[data-part="tag"]');
  const poses = Object.fromEntries([...tag.querySelectorAll("[data-pose]")].map((g) => [g.dataset.pose, g]));
  const slots = Object.fromEntries([...svg.querySelectorAll("[data-slot]")].map((g) => [g.dataset.slot, g]));
  const ram = svg.querySelector('[data-part="ram"]');
  const lens = svg.querySelector('[data-part="lens"]');
  const probe = svg.querySelector('[data-part="probe"]');
  const flap = svg.querySelector('[data-part="flap"]');
  const fly = svg.querySelector('[data-part="fly"]');
  const cleats = svg.querySelector(".cm-cleats");
  const beam = svg.querySelector('[data-part="beam"]');
  const pointer = svg.querySelector('[data-part="pointer"]');
  const panL = [...svg.querySelectorAll('[data-move="panL"]')];
  const panR = [...svg.querySelectorAll('[data-move="panR"]')];
  const B = D.beam;
  const beamPoly = [[-B.d / 2, 0], [B.d / 2, 0], [B.d / 2, B.t], [-B.d / 2, B.t]];

  let fateIndex = 0;
  let line = timeline(D, FATES[0]);
  // the still frame: a passing tag under the fact check probe
  const stillT = () => { const k = line.keys.find((k) => k.stop === "s2"); return k ? k.t - (k.t - line.keys[line.keys.indexOf(k) - 1].t) * 0.8 : line.T / 2; };
  let t = reduced ? stillT() : 0.5, target = t, touring = !reduced, visible = false, running = false, idle = 0;
  let lastSlot = null, lastPose = null, lastTilt = null, lastPhase = "", lastStep = -1;
  const callouts = [...svg.querySelectorAll(".cm-callout")];
  const stepButtons = [...root.querySelectorAll("[data-cm-step]")];

  const write = (s) => {
    if (s.slot !== lastSlot) { slots[s.slot]?.appendChild(tag); lastSlot = s.slot; }
    if (s.pose !== lastPose) { for (const [k, g] of Object.entries(poses)) g.style.display = k === s.pose ? "" : "none"; lastPose = s.pose; }
    let pos = s.pos;
    const dz = Math.sin(s.tilt) * B.arm;
    if (s.slot === "panL") pos = [pos[0], pos[1], pos[2] - dz];
    tag.setAttribute("transform", translateAlong(P, pos));
    tag.style.opacity = s.opacity < 1 ? s.opacity.toFixed(3) : "";
    const move = (el, v) => { const tr = translateAlong(P, v); el.setAttribute("transform", tr); const m = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(tr); holdStill(el, [+m[1], +m[2]]); };
    move(ram, [0, 0, -s.ram * D.ramTravel]);
    move(lens, [0, 0, -s.lens * D.lensTravel]);
    move(probe, [0, 0, -s.probe * D.probeTravel]);
    flap.setAttribute("transform", translateAlong(P, [0, 0, s.flap * D.flapLift]));
    // belt indexes with the tag; the flywheel turns with the press
    const beltX = s.slot === "belt" ? s.pos[0] : lastBelt;
    lastBelt = beltX;
    if (beltX !== lastCleat) {
      lastCleat = beltX;
      const b = D.belt, off = ((beltX % D.cleat) + D.cleat) % D.cleat;
      let d = "";
      for (let x = b.x0 + off + D.cleat / 2 - D.cleat; x < b.x1; x += D.cleat) {
        if (x < b.x0 + 0.5 || x > b.x1 - 0.5) continue;
        d += pathOf([iso([x, -b.y, b.z], P), iso([x, b.y, b.z], P)]);
      }
      cleats.setAttribute("d", d);
    }
    const m = D.flyMatrix;
    fly.setAttribute("transform", `matrix(${m.join(" ")}) rotate(${((t + fateIndex * line.T) * 40) % 360})`);
    if (s.tilt !== lastTilt) {
      const c = Math.cos(s.tilt), sn = Math.sin(s.tilt);
      const F = frameOf(B.pivot, [c, 0, sn], [0, 1, 0], [-sn, 0, c]);
      beam.innerHTML = solidSvg(prismOf(F, beamPoly, -B.half, B.half, P), { tone: "mid" });
      for (const el of panL) el.setAttribute("transform", translateAlong(P, [0, 0, -dz]));
      for (const el of panR) el.setAttribute("transform", translateAlong(P, [0, 0, dz]));
      const p = D.pointer;
      pointer.setAttribute("d", pathOf([iso(p.top, P), iso([p.top[0] + Math.sin(s.tilt) * p.len, p.top[1], p.top[2] - Math.cos(s.tilt) * p.len], P)]));
      lastTilt = s.tilt;
    }
    if (s.step !== lastStep) {
      lastStep = s.step;
      for (const g of callouts) g.classList.toggle("is-on", +g.dataset.step === s.step);
      for (const b of stepButtons) {
        const on = +b.dataset.cmStep === s.step;
        b.classList.toggle("is-on", on);
        if (on) b.setAttribute("aria-current", "step"); else b.removeAttribute("aria-current");
      }
    }
    if (s.phase !== lastPhase) {
      lastPhase = s.phase;
      if (readout) readout.textContent = s.phase;
      stage.setAttribute("aria-valuetext", s.phase);
    }
  };
  let lastBelt = D.route.start[0], lastCleat = null;

  const step = (time, deltaTime) => {
    const dt = Math.min(deltaTime / 1000, 1 / 30);
    if (touring) {
      t += dt;
      if (t >= line.T) { fateIndex = (fateIndex + 1) % FATES.length; line = timeline(D, FATES[fateIndex]); t = 0; lastSlot = null; }
      target = t;
    } else {
      t = reduced ? target : t + (target - t) * (1 - Math.exp(-dt / 0.2));
      if (Math.abs(target - t) < 1e-3) t = target;
    }
    write(poseAt(D, line, t));
    if (!touring && t === target) stop();
  };
  const start = () => { if (!running && visible) { running = true; gsap.ticker.add(step); } };
  const stop = () => { if (running) { running = false; gsap.ticker.remove(step); } };
  const steer = (next) => {
    touring = false;
    target = Math.max(0, Math.min(line.T - 0.001, next));
    clearTimeout(idle);
    if (!reduced) idle = setTimeout(() => { touring = true; start(); }, 3600);
    start();
  };
  const stops = () => line.keys.filter((k) => k.stop).map((k) => (k.inspect ? (k.t + line.keys[line.keys.indexOf(k) - 1].t) / 2 : k.t));

  const onMove = (e) => {
    if (e.pointerType === "touch") return;
    const box = svg.getBoundingClientRect();
    const share = Math.max(0, Math.min(1, ((e.clientX - box.left) / box.width - 0.1) / 0.8));
    steer(share * line.T);
  };
  const onKey = (e) => {
    const list = stops();
    const here = list.findIndex((v) => v > target + 0.05);
    let next = null;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") next = here < 0 ? list[list.length - 1] : list[here];
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") { const prev = list.filter((v) => v < target - 0.05); next = prev.length ? prev[prev.length - 1] : 0; }
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = list[list.length - 1];
    if (e.key === "Enter" || e.key === " ") {
      fateIndex = (fateIndex + 1) % FATES.length; line = timeline(D, FATES[fateIndex]); lastSlot = null;
      t = 0.5; next = reduced ? stillT() : 0.5;
    }
    if (next === null) return;
    e.preventDefault();
    steer(next);
    if (status) status.textContent = poseAt(D, line, next).phase;
  };
  const onTap = (e) => {
    if (e.pointerType !== "touch") return;
    const list = stops();
    const here = list.findIndex((v) => v > target + 0.05);
    steer(here < 0 ? 0 : list[here]);
  };
  const onFocus = () => { if (status) status.textContent = lastPhase; };
  // a step in the list jumps the tag to that station; a tag thrown out at the quote check never
  // reaches 5 to 7, so those steps switch to a tag that passes
  const onStep = (e) => {
    const want = +e.currentTarget.dataset.cmStep;
    if (!line.keys.some((k) => line.stepOf.get(k.phase) === want)) {
      fateIndex = 0; line = timeline(D, FATES[0]); lastSlot = null;
    }
    const i = line.keys.findIndex((k) => line.stepOf.get(k.phase) === want && k.stop);
    const k = i >= 0 ? line.keys[i] : line.keys.find((k) => line.stepOf.get(k.phase) === want);
    steer(k.inspect ? (k.t + line.keys[i - 1].t) / 2 : k.t + 0.02);
  };
  for (const b of stepButtons) b.addEventListener("click", onStep);
  stage.addEventListener("pointermove", onMove);
  stage.addEventListener("pointerup", onTap);
  stage.addEventListener("keydown", onKey);
  stage.addEventListener("focus", onFocus);
  const io = new IntersectionObserver((entries) => {
    visible = entries[entries.length - 1].isIntersecting;
    if (visible) start(); else stop();
  }, { rootMargin: "120px 0px" });
  io.observe(stage);
  write(poseAt(D, line, t));

  return () => {
    stop();
    clearTimeout(idle);
    io.disconnect();
    stage.removeEventListener("pointermove", onMove);
    stage.removeEventListener("pointerup", onTap);
    stage.removeEventListener("keydown", onKey);
    stage.removeEventListener("focus", onFocus);
    for (const b of stepButtons) b.removeEventListener("click", onStep);
  };
}
