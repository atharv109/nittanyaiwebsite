// Fig 1: the chain-of-custody sorting machine. Build-time only (Node): emits the SVG card and the
// data the live script needs. Every count comes from pipeline.json and runs.json; nothing is typed in.
import * as k from "./kit/iso-kit.mjs";
import * as G from "./kit/lathe.mjs";
import * as A from "./kit/audit.mjs";

export const W = 820;
export const H = 410;
const AZIMUTH = 62;
const n = (x) => x.toLocaleString("en-US");

// World plan (units ~ px). x runs with the flow, y toward the viewer, z up.
const BASE = { x: -296, y: -80, w: 592, d: 160, r: 8 };
const BELT = { x0: -272, x1: 152, y: 15, top: 30 };
const RAIL = { z0: 14, z1: 30 };
const FULL = 30; // fill height that stands for every claim the run wrote
const BIN_Y = 36;
const BIN = { d: 24, h: 20, wall: 1.4 };
const S1 = -20; // quote check head
const S2 = 70; // fact check head
const PRESS = -150;
const GATE = -92;
const PAN_L = 174;
const PAN_R = 230;
const PIVOT = [(PAN_L + PAN_R) / 2, 0, 70];

export function buildCustody({ pipe, runs }) {
  const P = k.fitProjection(
    [...k.boxCorners(BASE, -17, 0), [-270, -30, 126], [-206, 30, 126], [PRESS, -36, 120], [PIVOT[0], 0, 80]],
    W, H, { pad: 18, azimuth: AZIMUTH },
  );
  const V = G.viewOf(P);
  const at = (p) => k.iso(p, P);
  const path3 = (pts, closed = false) => k.pathOf(pts.map(at), closed);
  const S = (paths, style) => k.solidSvg(paths, style);
  const Ln = (d, style) => k.lineSvg(d, style);
  const Dots = (pts, style) => k.dotsSvg(pts, style);

  const R = A.recorder(P);
  const put = (name, ref, svg, shapes = [], opts = {}) => R.put({ name, at: ref, svg, shapes, piece: "machine", ...opts });

  function box(name, [x0, y0, z0], [x1, y1, z1], style = {}, { r = 0.6, steps = 3, bevel = 0, extra = "", inner = "", bias = 0, attrs = "" } = {}) {
    const plan = { x: x0, y: y0, w: x1 - x0, d: y1 - y0, r };
    const shape = R.solid(A.slab(plan, z0, z1 - z0, { name }, steps));
    put(name, [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], S(k.slabOf(plan, z0, z1 - z0, P, steps, bevel), { tone: "mid", ...style, inner }) + extra, [shape], { bias, attrs });
    return plan;
  }
  function cyl(name, cx, cy, r, z, h, style = {}, { extra = "", inner = "", bias = 0, steps = 28, bevel = 0, attrs = "" } = {}) {
    const shape = R.solid(A.cylinder(cx, cy, r, z, h, { name }));
    put(name, [cx, cy, z + h / 2], S(k.cylinder(cx, cy, r, z, h, P, steps, bevel), { tone: "mid", ...style, inner }) + extra, [shape], { bias, attrs });
  }
  function prism(name, F, poly, s0, s1, style = {}, { extra = "", inner = "", bias = 0, attrs = "" } = {}) {
    const shape = R.solid(A.prism(F, poly, s0, s1, { name }));
    const cu = poly.reduce((a, p) => a + p[0], 0) / poly.length;
    const cv = poly.reduce((a, p) => a + p[1], 0) / poly.length;
    const c = G.add3(G.add3(G.add3(F.o, G.mul3(F.a, (s0 + s1) / 2)), G.mul3(F.u, cu)), G.mul3(F.v, cv));
    put(name, c, S(G.prismOf(F, poly, s0, s1, P), { tone: "mid", ...style, inner }) + extra, [shape], { bias, attrs });
  }
  function disc(name, F, s0, s1, r, style = {}, { extra = "", inner = "", bias = 0, attrs = "" } = {}) {
    const shape = R.solid(A.disc(F, s0, s1, r, { name }));
    put(name, G.add3(F.o, G.mul3(F.a, (s0 + s1) / 2)), S(G.disc(s0, s1, r, F, P), { tone: "mid", ...style, inner }) + extra, [shape], { bias, attrs });
  }
  const FX = (o) => G.frameOf(o, [1, 0, 0], [0, 1, 0], [0, 0, 1]); // prisms along x, polygon in (y, z)
  const FY = (o) => G.frameOf(o, [0, 1, 0], [1, 0, 0], [0, 0, 1]); // along y, polygon in (x, z)
  const screw = (pts, z, ring = 1.6) => Ln(pts.map(([x, y]) => k.ring(x, y, ring, z, P, 14)).join(""), { tone: "lo" }) + Dots(pts.map(([x, y]) => at([x, y, z])), { size: 0.45 });
  const faceRect = (y, x0, x1, z0, z1) => path3([[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]], true);

  // ---------------- truth ----------------
  const fid = pipe.fidelity;
  const quoted = fid.substring + fid.entailed + fid.unsupported;
  const fill = (count) => Math.max(0.6, (FULL * count) / pipe.claims);
  const perDoc = Math.round(pipe.claims / pipe.documents);
  const feeding = pipe.collectors.filter((c) => c.claims > 0);
  const dry = pipe.collectors.filter((c) => !c.claims);
  const topClaims = Math.max(...feeding.map((c) => c.claims));

  // ---------------- base ----------------
  const FOOT_Z = -17;
  const feet = [[-262, -58], [0, -58], [262, -58], [-262, 58], [0, 58], [262, 58]];
  for (const [x, y] of feet) {
    cyl("stand.foot.flange", x, y, 7, FOOT_Z, 1.6, { tone: "lo" });
    cyl("stand.foot", x, y, 5.4, FOOT_Z + 1.6, 3.4, { tone: "mid" });
  }
  const groove = k.planOutline(k.insetPlan(BASE, 5), 0, P);
  const corners = k.corners(BASE, 11);
  const strip = { x: -230, y: BASE.y + BASE.d - 12, w: 500, d: 7, r: 1 };
  box("stand.plate", [BASE.x, BASE.y, -12], [BASE.x + BASE.w, BASE.y + BASE.d, 0], { tone: "mid" }, { r: BASE.r, steps: 8, bevel: 1.6 });
  // groove, corner screws, ruler and label plate are engraved on the plate top: drawn right after it
  const plateDecor = Ln(groove, { tone: "lo" }) + screw(corners, 0, 2.2);
  R.items[R.items.length - 1].svg += plateDecor;
  box("stand.ruler", [strip.x, strip.y, 0], [strip.x + strip.w, strip.y + strip.d, 0.6], { tone: "lo", crease: "none" }, { r: 1,
    extra: (() => {
      const t = k.topTicks(strip.x + 4, strip.x + strip.w - 4, 4, 5, strip.y + 0.01, 0.6, [2, 3.6], P);
      return Ln(t.minor, { tone: "lo" }) + Ln(t.major, { tone: "mid" }) + Dots([at([strip.x + 2, strip.y + 3.5, 0.6]), at([strip.x + strip.w - 2, strip.y + 3.5, 0.6])], { size: 0.45 });
    })() });
  const LABEL = { x: -282, y: 44, w: 34, d: 22 };
  box("stand.label", [LABEL.x, LABEL.y, 0], [LABEL.x + LABEL.w, LABEL.y + LABEL.d, 0.8], { tone: "lo" }, { r: 1.5,
    extra: Ln(k.planOutline(k.insetPlan({ ...LABEL, r: 1.5 }, 1.6), 0.8, P), { tone: "faint" })
      + Ln([[6, 26], [6, 20], [6, 23]].map(([dx, len], i) => k.lineOnTop([LABEL.x + dx, LABEL.y + 7 + i * 4], [LABEL.x + dx + len, LABEL.y + 7 + i * 4], 0.8, P)).join(""), { tone: "lo", free: true })
      + Dots([at([LABEL.x + 3.2, LABEL.y + 3.2, 0.8]), at([LABEL.x + LABEL.w - 3.2, LABEL.y + LABEL.d - 3.2, 0.8])], { size: 0.45 }) });

  // ---------------- belt ----------------
  const legsX = [-262, -196, -120, -40, 30, 104, 144];
  for (const x of legsX) for (const y of [BELT.y, -BELT.y - 5]) box("belt.leg", [x - 3, y, 0], [x + 3, y + 5, RAIL.z0], { tone: "mid" }, { r: 0.6, extra: Dots([at([x, y + 2.5, RAIL.z0])], { size: 0.4 }) });
  box("belt.rail.back", [BELT.x0 - 4, -BELT.y - 5, RAIL.z0], [BELT.x1 + 4, -BELT.y, RAIL.z1], { tone: "mid" }, { r: 0.8, bevel: 0.4 });
  const CLEAT = 10;
  const cleats = [];
  for (let x = BELT.x0 + CLEAT / 2; x < BELT.x1; x += CLEAT) cleats.push(k.lineOnTop([x, -BELT.y], [x, BELT.y], RAIL.z1, P));
  box("belt.surface", [BELT.x0, -BELT.y, RAIL.z1 - 4], [BELT.x1, BELT.y, RAIL.z1], { tone: "lo" }, { r: 0.4, steps: 2,
    extra: Ln(cleats.join(""), { tone: "faint", className: "cm-cleats" }) });
  const railFront = box("belt.rail.front", [BELT.x0 - 4, BELT.y, RAIL.z0], [BELT.x1 + 4, BELT.y + 5, RAIL.z1], { tone: "mid" }, { r: 0.8, bevel: 0.4,
    inner: Ln(k.sideSeam({ x: BELT.x0 - 4, y: BELT.y, w: BELT.x1 - BELT.x0 + 8, d: 5, r: 0.8 }, RAIL.z0 + 5, P, 3), { tone: "faint" }) });
  for (const x of [BELT.x0 + 4, BELT.x1 - 4]) {
    const F = G.frameAlong([x, BELT.y + 5, RAIL.z1 - 6], [0, 1, 0]);
    disc("belt.roller.boss", F, 0, 1.6, 3.4, { tone: "mid" }, { extra: Dots([at([x, BELT.y + 6.6, RAIL.z1 - 6])], { size: 0.55, tone: "hi" }) });
  }
  for (let x = BELT.x0 + 30; x < BELT.x1 - 10; x += 56) R.items.find((it) => it.name === "belt.rail.front").svg += Dots([at([x, BELT.y + 5, RAIL.z1 - 3])], { size: 0.4 });

  // ---------------- hopper with ten collector chutes ----------------
  const HOP = { x0: -270, x1: -206, y0: -30, y1: 30, z: 96 };
  for (const [x, y] of [[-266, -26], [-210, -26], [-266, 26], [-210, 26]]) cyl("hopper.post", x, y, 2.4, 2.4, HOP.z - 2.4, { tone: "mid" }, { inner: Ln(k.sideArc(x, y, 2.4, 40, P, 12), { tone: "faint" }) });
  for (const [x, y] of [[-266, -26], [-210, -26], [-266, 26], [-210, 26]]) cyl("hopper.post.shoe", x, y, 4, 0, 2.4, { tone: "lo" });
  {
    const xl = (zz) => -246 + ((zz - 62) / 34) * -20, xr = (zz) => -230 + ((zz - 62) / 34) * 20;
    const rivets = [];
    for (let f = 0.12; f < 0.95; f += 0.152) rivets.push(at([xl(90) + (xr(90) - xl(90)) * f, 24, 90]));
    prism("hopper.funnel", FY([0, -24, 0]), [[-266, HOP.z], [-246, 62], [-230, 62], [-210, HOP.z]], 0, 48, { tone: "mid" },
      { inner: Ln(path3([[xl(84), 24, 84], [xr(84), 24, 84]]) + path3([[xl(70), 24, 70], [xr(70), 24, 70]]), { tone: "faint" }), extra: Dots(rivets, { size: 0.4 }) });
  }
  box("hopper.neck", [-246, -12, 44], [-230, 12, 62], { tone: "mid" }, { r: 0.8, inner: Ln(k.sideSeam({ x: -246, y: -12, w: 16, d: 24, r: 0.8 }, 53, P, 3), { tone: "faint" }) });
  box("hopper.rim", [HOP.x0, HOP.y0, HOP.z], [HOP.x1, HOP.y1, HOP.z + 4], { tone: "mid" }, { r: 1.2, bevel: 0.5,
    extra: screw([[HOP.x0 + 3.5, HOP.y0 + 3.5], [HOP.x1 - 3.5, HOP.y0 + 3.5], [HOP.x0 + 3.5, HOP.y1 - 3.5], [HOP.x1 - 3.5, HOP.y1 - 3.5]], HOP.z + 4, 1.3) });
  const CH = { w: 10, d: 11, h: 22 };
  const chuteTop = HOP.z + 4 + CH.h;
  const chuteData = [];
  pipe.collectors.slice(0, 10).forEach((c, i) => {
    const live = c.claims > 0;
    const idx = live ? feeding.indexOf(c) : dry.indexOf(c);
    const x0 = HOP.x0 + 3 + idx * 12;
    const y0 = live ? 4 : -22;
    const plan = { x: x0, y: y0, w: CH.w, d: CH.d, r: 0.8 };
    const z0 = HOP.z + 4;
    let extra = "";
    if (live) {
      // sight glass on the front face: the level is this collector's share of the top collector's claims
      const lvl = Math.max(0.6, ((CH.h - 6) * c.claims) / topClaims);
      const wx0 = x0 + 3, wx1 = x0 + CH.w - 3, wz0 = z0 + 3, wz1 = z0 + CH.h - 3;
      extra += `<path class="cm-glass" d="${faceRect(y0 + CH.d, wx0, wx1, wz0, wz1)}"/>`;
      extra += `<path class="cm-level" d="${faceRect(y0 + CH.d, wx0, wx1, wz0, wz0 + lvl)}"/>`;
      extra += Ln(faceRect(y0 + CH.d, wx0, wx1, wz0, wz1), { tone: "lo" });
      extra += Ln(k.planOutline(k.insetPlan(plan, 1.2), chuteTop, P, 2), { tone: "lo" });
      chuteData.push({ name: c.name, claims: c.claims });
    } else {
      extra += Ln(k.planOutline(k.insetPlan(plan, 1.2), chuteTop, P, 2), { tone: "faint" });
    }
    box(`hopper.chute.${c.key}`, [x0, y0, z0], [x0 + CH.w, y0 + CH.d, chuteTop], { tone: live ? "hi" : "mid", crease: live ? "lo" : "faint" }, { r: 0.8, extra });
    if (live) {
      // a document standing in the open mouth
      box(`hopper.doc.${c.key}`, [x0 + 2, y0 + 3, chuteTop], [x0 + CH.w - 2, y0 + 4.2, chuteTop + 6 - (i % 2) * 2], { tone: "hi", crease: "lo" }, { r: 0.2, steps: 2,
        extra: Ln([1.2, 2.6].map((dz) => path3([[x0 + 3.2, y0 + 4.2, chuteTop + 5 - (i % 2) * 2 - dz], [x0 + CH.w - 3.6 + (dz > 2 ? -1 : 0), y0 + 4.2, chuteTop + 5 - (i % 2) * 2 - dz]])).join(""), { tone: "lo", free: true }) });
    } else {
      // shut: a shutter plate screwed over the mouth
      box(`hopper.shutter.${c.key}`, [x0 - 0.4, y0 - 0.4, chuteTop], [x0 + CH.w + 0.4, y0 + CH.d + 0.4, chuteTop + 1.2], { tone: "lo" }, { r: 0.8,
        extra: Dots([at([x0 + 2, y0 + 2, chuteTop + 1.2]), at([x0 + CH.w - 2, y0 + CH.d - 2, chuteTop + 1.2])], { size: 0.4 }) });
    }
  });

  // ---------------- stamping press (the extractor) ----------------
  box("press.foot", [PRESS - 22, -48, 0], [PRESS + 22, -24, 6], { tone: "lo" }, { r: 1.5, bevel: 0.6, extra: screw([[PRESS - 17, -43], [PRESS + 17, -43], [PRESS - 17, -29], [PRESS + 17, -29]], 6, 1.4) });
  box("press.column", [PRESS - 10, -38, 6], [PRESS + 10, -26, 102], { tone: "mid" }, { r: 1, bevel: 0.6,
    inner: Ln(k.sideSeam({ x: PRESS - 10, y: -38, w: 20, d: 12, r: 1 }, 40, P, 3) + k.sideSeam({ x: PRESS - 10, y: -38, w: 20, d: 12, r: 1 }, 76, P, 3), { tone: "faint" }) });
  prism("press.gusset", FX([PRESS - 3, 0, 0]), [[-26, 100], [-26, 84], [-12, 100]], 0, 6, { tone: "mid" });
  box("press.arm", [PRESS - 12, -38, 102], [PRESS + 12, 12, 118], { tone: "mid" }, { r: 1.4, bevel: 0.6,
    extra: Dots([[2, 106], [2, 114], [7, 106], [7, 114]].map(([y, zz]) => at([PRESS + 12, y, zz])), { size: 0.45 }) + screw([[PRESS - 8, -34], [PRESS + 8, -34], [PRESS - 8, 8], [PRESS + 8, 8]], 118, 1.3) });
  // counter on the arm's front face: claims written so far
  const CW = { x0: PRESS - 9, x1: PRESS + 9, z0: 105, z1: 115, y: 12 };
  const counterText = `<g transform="${k.sideMatrix([CW.x0 + 1.2, CW.y + 0.01], CW.z0 + 2.3, P, "left")}"><text class="cm-digits" font-size="5.6" x="0" y="0" textLength="${(CW.x1 - CW.x0 - 2.4).toFixed(1)}" lengthAdjust="spacingAndGlyphs">${n(pipe.claims).replace(",", "")}</text></g>`;
  R.items[R.items.length - 1].svg += `<path class="cm-window" d="${faceRect(CW.y + 0.01, CW.x0, CW.x1, CW.z0, CW.z1)}"/>` + counterText + Ln(faceRect(CW.y + 0.01, CW.x0, CW.x1, CW.z0, CW.z1), { tone: "mid" });
  const housingF = G.frameOf([PRESS, 0, 102], [0, 0, -1], [1, 0, 0], [0, 1, 0]);
  disc("press.housing", housingF, 0, 18, 8, { tone: "mid" }, { inner: Ln(G.arcOf(housingF, 9, 8, P), { tone: "faint" }) });
  disc("press.gland", housingF, 18, 21, 5.6, { tone: "lo" });
  // flywheel on the arm's open side
  const flyF = G.frameOf([PRESS + 12, -22, 110], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
  disc("press.flywheel.hub", flyF, 0, 3, 3, { tone: "mid" });
  disc("press.flywheel", flyF, 3, 6, 15, { tone: "mid" }, { extra: Ln(G.circleOf(flyF, 6, 11.5, P, 48), { tone: "faint" }) });
  disc("press.flywheel.cap", flyF, 6, 7.4, 3.2, { tone: "hi", crease: "lo" });
  const flyO = at(G.pointOf(flyF, 6, 0, 0));
  const pu = at(G.add3(G.pointOf(flyF, 6, 0, 0), flyF.u)), pv = at(G.add3(G.pointOf(flyF, 6, 0, 0), flyF.v));
  const flyMatrix = [pu[0] - flyO[0], pu[1] - flyO[1], pv[0] - flyO[0], pv[1] - flyO[1], flyO[0], flyO[1]].map((v) => +v.toFixed(4));
  const spokes = Array.from({ length: 5 }, (_, i) => { const a = (i / 5) * Math.PI * 2; return `M${(Math.cos(a) * 3.2).toFixed(2)} ${(Math.sin(a) * 3.2).toFixed(2)}L${(Math.cos(a) * 11.5).toFixed(2)} ${(Math.sin(a) * 11.5).toFixed(2)}`; }).join("");
  R.items.find((it) => it.name === "press.flywheel").svg += `<g data-part="fly" transform="matrix(${flyMatrix.join(" ")})"><path class="iso-line cm-spokes" data-tone="lo" d="${spokes}"/></g>`;

  // ram: one rod out of the gland, with its die; moved as one group by the live script
  const RAM = { from: 21, to: 44, r: 3.2, stroke: 26 };
  const ram = G.rodOut(housingF, RAM.from, RAM.to, RAM.r, P, { stroke: RAM.stroke });
  const dieZ = 102 - RAM.to;
  const diePlan = { x: PRESS - 8, y: -8, w: 16, d: 16, r: 1 };
  const ramSvg = `<clipPath id="cm-ram"><path data-hold d="${ram.clip}"/></clipPath><g clip-path="url(#cm-ram)">${S(ram.paths, { tone: "hi", crease: "lo" })}</g>`
    + S(k.slabOf(diePlan, dieZ - 5, 5, P, 3, 0.5), { tone: "hi", crease: "lo" })
    + Ln(k.planOutline(k.insetPlan(diePlan, 2), dieZ, P, 3), { tone: "faint" });
  put("press.ram", [PRESS, 0, dieZ], `<g data-part="ram">${ramSvg}</g>`, [R.solid(A.slide(housingF, RAM.from, RAM.to, RAM.r, { name: "press.ram.rod" })), R.solid(A.slab(diePlan, dieZ - 5, 5, { name: "press.die" }))]);

  // documents waiting on the belt between hopper and press
  const docAt = (x) => {
    const plan = { x: x - 6, y: -8, w: 12, d: 16, r: 0.6 };
    box("belt.doc", [plan.x, plan.y, BELT.top], [plan.x + plan.w, plan.y + plan.d, BELT.top + 1.2], { tone: "hi", crease: "lo" }, { r: 0.6, steps: 2,
      extra: Ln([[2, 8], [2, 6.4], [2, 7.4]].map(([dx, len], i) => k.lineOnTop([plan.x + dx, plan.y + 4 + i * 3], [plan.x + dx + len, plan.y + 4 + i * 3], BELT.top + 1.2, P)).join(""), { tone: "lo", free: true }) });
  };
  docAt(-238);
  docAt(-200);

  // ---------------- tags: built once, used for the waiting stream and the lit tag ----------------
  const TAG = [[-6, -3.6], [3.6, -3.6], [6.4, 0], [3.6, 3.6], [-6, 3.6]];
  const tagPaths = (F) => G.prismOf(F, TAG, 0, 0.9, P);
  const hole = (F, x, y) => {
    const o = G.add3(G.add3(G.add3(F.o, G.mul3(F.a, 0.9)), G.mul3(F.u, x)), G.mul3(F.v, y));
    return G.circleOf(G.frameOf(o, F.a, F.u, F.v), 0, 0.8, P, 14);
  };
  const tagFrame = (o, slope = 0) => {
    // slope tilts the tag about x: positive falls toward +y (a front chute)
    const c = Math.cos(slope), s = Math.sin(slope);
    return G.frameOf(o, [0, -s, c], [1, 0, 0], [0, c, s]);
  };
  const tagItem = (name, o, slope = 0) => {
    const F = tagFrame(o, slope);
    const shape = R.solid(A.prism(F, TAG, 0, 0.9, { name }));
    put(name, G.add3(o, [0, 0, 0.45]), S(tagPaths(F), { tone: "hi", crease: "lo" }) + Ln(hole(F, 3.4, 0), { tone: "lo" }), [shape]);
  };
  // a stream of fresh tags leaving the press, perDoc per document
  for (let i = 0; i < perDoc - 1; i++) tagItem("belt.tag", [PRESS + 22 + i * 15, (i % 2 ? 4 : -4), BELT.top]);

  // ---------------- receptacles ----------------
  function bin(name, x0, count, { y0 = BIN_Y, d = BIN.d, h = BIN.h, z0 = 0, w = 26, legs = false, cls } = {}) {
    const x1 = x0 + w, y1 = y0 + d, t = BIN.wall;
    const wall = cls ? { className: cls } : {};
    if (legs) {
      for (const lx of [x0 + 4, x1 - 4]) for (const ly of [y0 + 4, y1 - 4]) cyl(`${name}.leg`, lx, ly, 1.4, 0, z0, { tone: "mid" });
    }
    box(`${name}.floor`, [x0, y0, z0], [x1, y1, z0 + t], { ...wall, tone: "lo" }, { r: 0.8 });
    box(`${name}.back`, [x0, y0, z0 + t], [x1, y0 + t, z0 + h], { ...wall, tone: "mid" }, { r: 0.3, steps: 2 });
    box(`${name}.left`, [x0, y0 + t, z0 + t], [x0 + t, y1 - t, z0 + h], { ...wall, tone: "mid" }, { r: 0.3, steps: 2 });
    const level = z0 + t + fill(count);
    const pile = [[0.32, 0.38, 0.4], [0.68, 0.52, -0.5], [0.45, 0.64, 1.2]].filter((_, i) => count > 0 && i < 1 + Math.min(2, Math.floor(fill(count) / 3)));
    box(`${name}.fill`, [x0 + t, y0 + t, z0 + t], [x1 - t, y1 - t, level], { tone: "lo", crease: "faint", className: "cm-pile" }, { r: 0.3, steps: 2,
      extra: pile.map(([fx, fy, rot]) => {
        const c = [x0 + t + fx * (w - 2 * t), y0 + t + fy * (d - 2 * t)], cs = Math.cos(rot), sn = Math.sin(rot);
        return Ln(k.onTop(TAG.map(([u, v]) => [c[0] + u * cs - v * sn, c[1] + u * sn + v * cs]), level, P, true), { tone: "mid" });
      }).join("") });
    box(`${name}.right`, [x1 - t, y0 + t, z0 + t], [x1, y1 - t, z0 + h], { ...wall, tone: "mid" }, { r: 0.3, steps: 2 });
    box(`${name}.front`, [x0, y1 - t, z0 + t], [x1, y1, z0 + h], { ...wall, tone: "mid" }, { r: 0.3, steps: 2, bevel: 0.3,
      extra: Ln(k.lineOnTop([x0 + 4, y1 - t / 2], [x1 - 4, y1 - t / 2], z0 + h, P), { tone: "faint" }) });
    return { x0, x1, y0, y1, level, top: z0 + h };
  }
  function frontChute(name, x0, x1) {
    // from the front rail top down onto the bin's back wall
    const poly = [[BELT.y + 5, BELT.top], [BIN_Y + 1.4, BIN.h + 1.5], [BIN_Y + 1.4, BIN.h], [BELT.y + 5, BELT.top - 1.5]];
    prism(`${name}.plate`, FX([0, 0, 0]), poly, x0, x1, { tone: "mid", className: "cm-chute" });
    for (const x of [x0, x1 - 1.2]) prism(`${name}.lip`, FX([0, 0, 0]), [[BELT.y + 5, BELT.top + 2.2], [BIN_Y + 1.4, BIN.h + 3.7], [BIN_Y + 1.4, BIN.h + 1.5], [BELT.y + 5, BELT.top]], x, x + 1.2, { tone: "mid" });
  }

  // ---------------- gate (normalize: quote overlap and boilerplate) ----------------
  for (const y of [-30, 24]) box("gate.post", [GATE - 4, y, 0], [GATE + 4, y + 6, 50], { tone: "mid" }, { r: 0.8, bevel: 0.4 });
  box("gate.bar", [GATE - 4, -30, 50], [GATE + 4, 30, 56], { tone: "mid" }, { r: 0.8, bevel: 0.4, extra: Dots([-27, 27].map((y) => at([GATE, y, 56])), { size: 0.45 }) });
  for (const y of [-9, 9]) cyl("gate.knuckle", GATE, y, 1.8, 46, 4, { tone: "mid" });
  put("gate.flap", [GATE, 0, 40], `<g data-part="flap">${S(k.slabOf({ x: GATE - 1, y: -14, w: 2, d: 28, r: 0.4 }, 33, 13, P, 2, 0.3), { tone: "hi", crease: "lo" })}${Ln([-8, -4, 0, 4, 8].map((y) => k.segment([GATE + 1, y, 33], [GATE + 1, y, 37.5], P)).join(""), { tone: "lo" })}</g>`,
    [R.solid(A.slab({ x: GATE - 1, y: -14, w: 2, d: 28, r: 0.4 }, 33, 13, { name: "gate.flap" }, 2))]);
  const GB = bin("gate.bin", GATE + 10, 0, { w: 24 });
  frontChute("gate.chute", GATE + 11, GATE + 33);

  // ---------------- station 1: quote check ----------------
  // a ruler on each bridge with a slider set to the share that station keeps
  function scaleStrip(name, x, z, share) {
    const st = { x: x - 3, y: -26, w: 5, d: 44, r: 0.6 };
    const t = k.topTicks(st.y + 2, st.y + st.d - 2, 2, 5, st.x + 0.01, z + 0.5, [1.4, 2.6], P, "y");
    box(`${name}.ruler`, [st.x, st.y, z], [st.x + st.w, st.y + st.d, z + 0.5], { tone: "lo", crease: "none" }, { r: 0.6, extra: Ln(t.minor, { tone: "lo" }) + Ln(t.major, { tone: "mid" }) });
    const y = st.y + 2 + share * (st.d - 4);
    box(`${name}.slider`, [x - 4, y - 1.3, z + 0.5], [x + 3.4, y + 1.3, z + 2.4], { tone: "hi", crease: "lo" }, { r: 0.4, steps: 2 });
  }
  function bridge(name, x, top) {
    for (const y of [-32, 24]) box(`${name}.post`, [x - 5, y, 0], [x + 5, y + 8, top], { tone: "mid" }, { r: 0.8, bevel: 0.4,
      inner: Ln(k.sideSeam({ x: x - 5, y, w: 10, d: 8, r: 0.8 }, 12, P, 3), { tone: "faint" }) });
    box(`${name}.bar`, [x - 6, -32, top], [x + 6, 32, top + 8], { tone: "mid" }, { r: 1, bevel: 0.5, extra: Dots([-28, 28].map((y) => at([x, y, top + 8])), { size: 0.45 }) });
  }
  bridge("s1", S1, 66);
  scaleStrip("s1", S1, 74, (fid.substring + fid.entailed) / quoted);
  const s1F = G.frameOf([S1, 0, 66], [0, 0, -1], [1, 0, 0], [0, 1, 0]);
  disc("s1.head", s1F, 0, 12, 7.5, { tone: "mid" }, { inner: Ln(G.arcOf(s1F, 4, 7.5, P), { tone: "faint" }) });
  disc("s1.lamp", s1F, 12, 14, 9, { tone: "lo" }, { extra: Dots(G.dotsOf(s1F, 14, 7.6, 12, P, { fade: [0.04, 0.42] }), { size: 0.4, tone: "mid" }) });
  const LENS = { from: 14, to: 22, r: 4.4, stroke: 12 };
  const lens = G.rodOut(s1F, LENS.from, LENS.to, LENS.r, P, { stroke: LENS.stroke });
  put("s1.lens", G.pointOf(s1F, LENS.to, 0, 0), `<g data-part="lens"><clipPath id="cm-lens"><path data-hold d="${lens.clip}"/></clipPath><g clip-path="url(#cm-lens)">${S(lens.paths, { tone: "hi", crease: "lo" })}</g></g>`,
    [R.solid(A.slide(s1F, LENS.from, LENS.to, LENS.r, { name: "s1.lens" }))]);
  // a tick scale on the bar's open face: kept by the quote check, out of all quoted claims
  const B1 = bin("s1.bin", S1 + 13, fid.unsupported, { w: 26 });
  frontChute("s1.chute", S1 + 14, S1 + 38);

  // ---------------- station 2: fact or inference ----------------
  bridge("s2", S2, 66);
  scaleStrip("s2", S2, 74, pipe.verified / (pipe.factConfirmed + pipe.overreachMed + pipe.overreachHigh));
  const s2F = G.frameOf([S2, 0, 66], [0, 0, -1], [1, 0, 0], [0, 1, 0]);
  disc("s2.head", s2F, 0, 9, 6.5, { tone: "mid" }, { inner: Ln(G.arcOf(s2F, 4.5, 6.5, P), { tone: "faint" }) });
  disc("s2.cap", s2F, 9, 11, 4, { tone: "lo" });
  const PROBE = { from: 11, to: 26, r: 1.6, stroke: 9 };
  const probe = G.rodOut(s2F, PROBE.from, PROBE.to, PROBE.r, P, { stroke: PROBE.stroke });
  const padPlan = { x: S2 - 4, y: -4, w: 8, d: 8, r: 3.9 };
  const padZ = 66 - PROBE.to;
  put("s2.probe", G.pointOf(s2F, PROBE.to, 0, 0), `<g data-part="probe"><clipPath id="cm-probe"><path data-hold d="${probe.clip}"/></clipPath><g clip-path="url(#cm-probe)">${S(probe.paths, { tone: "hi", crease: "lo" })}</g>${S(k.cylinder(S2, 0, 4, padZ - 2, 2, P, 24), { tone: "hi", crease: "lo" })}</g>`,
    [R.solid(A.slide(s2F, PROBE.from, PROBE.to, PROBE.r, { name: "s2.probe" })), R.solid(A.cylinder(S2, 0, 4, padZ - 2, 2, { name: "s2.pad" }))]);
  const B2 = bin("s2.bin", S2 + 13, pipe.overreachHigh, { w: 26 });
  frontChute("s2.chute", S2 + 14, S2 + 38);
  // amber side tray at the back: kept, uncertainty raised
  const TRAY = { x0: S2 + 8, w: 30, y0: -64, d: 22, z0: 16, h: 9 };
  const TR = bin("s2.tray", TRAY.x0, pipe.overreachMed, { y0: TRAY.y0, d: TRAY.d, h: TRAY.h, z0: TRAY.z0, w: TRAY.w, legs: true, cls: "cm-amber" });
  {
    const poly = [[-BELT.y - 5, BELT.top], [-BELT.y - 5, BELT.top - 1.5], [TRAY.y0 + TRAY.d - 1.4, TRAY.z0 + TRAY.h], [TRAY.y0 + TRAY.d - 1.4, TRAY.z0 + TRAY.h + 1.5]];
    prism("s2.backchute", FX([0, 0, 0]), poly, TRAY.x0 + 3, TRAY.x0 + TRAY.w - 3, { tone: "mid" });
  }

  // ---------------- judge: the balance ----------------
  box("scale.plinth", [PIVOT[0] - 22, -18, 0], [PIVOT[0] + 22, 18, 6], { tone: "lo" }, { r: 2, bevel: 0.6, extra: screw([[PIVOT[0] - 17, -13], [PIVOT[0] + 17, -13], [PIVOT[0] - 17, 13], [PIVOT[0] + 17, 13]], 6, 1.4) });
  cyl("scale.pillar.collar", PIVOT[0], 0, 6, 6, 4, { tone: "mid" });
  cyl("scale.pillar", PIVOT[0], 0, 3.2, 10, PIVOT[2] - 6 - 10, { tone: "mid", crease: "none" }, { inner: Ln(k.sideArc(PIVOT[0], 0, 3.2, 30, P, 12) + k.sideArc(PIVOT[0], 0, 3.2, 48, P, 12), { tone: "faint" }) });
  box("scale.fork", [PIVOT[0] - 4, -5, PIVOT[2] - 6], [PIVOT[0] + 4, 5, PIVOT[2] - 1.5], { tone: "mid" }, { r: 1 });
  // the beam is redrawn by the live script as it tilts; here at rest
  const BEAM = { half: (PAN_R - PAN_L) / 2, t: 3, d: 4 };
  const beamPoly = [[-BEAM.d / 2, 0], [BEAM.d / 2, 0], [BEAM.d / 2, BEAM.t], [-BEAM.d / 2, BEAM.t]];
  const beamFrame = (tilt) => { const c = Math.cos(tilt), s = Math.sin(tilt); return G.frameOf([PIVOT[0], 0, PIVOT[2] - 1.5], [c, 0, s], [0, 1, 0], [-s, 0, c]); };
  prism("scale.beam", beamFrame(0), beamPoly, -BEAM.half - 2, BEAM.half + 2, { tone: "mid" }, { attrs: ` data-part="beam"` });
  // pans hang from yokes at the beam ends; each pan set moves as one
  const PAN = { r: 13, z: 22 };
  function pan(name, x, load) {
    const yz = PIVOT[2] - 1.5;
    const tag = ` data-move="${name}"`;
    box(`${name}.yoke`, [x - 2, -12, yz + BEAM.t], [x + 2, 12, yz + BEAM.t + 2], { tone: "mid" }, { r: 0.6, attrs: tag });
    for (const y of [-11, 11]) cyl(`${name}.rod${y < 0 ? ".back" : ".front"}`, x, y, 0.6, PAN.z + 2, yz + BEAM.t - PAN.z - 2, { tone: "mid", crease: "none" }, { steps: 12, attrs: tag });
    cyl(`${name}.pan`, x, 0, PAN.r, PAN.z, 2, { tone: "hi", crease: "lo" }, { steps: 56, bevel: 0.5, attrs: tag, extra: Ln(k.ring(x, 0, PAN.r - 2.4, PAN.z + 2, P, 48), { tone: "faint" }) });
    load(tag);
  }
  pan("panL", PAN_L, (tag) => {
    // verified tags weighed so far, stacked to the shared fill scale
    const hgt = fill(pipe.verified);
    cyl("panL.stack", PAN_L, 0, 7.5, PAN.z + 2, hgt, { tone: "hi", crease: "lo" }, { steps: 32, attrs: tag, inner: Ln([0.33, 0.66].map((f) => k.sideArc(PAN_L, 0, 7.5, PAN.z + 2 + hgt * f, P, 20)).join(""), { tone: "faint" }) });
  });
  pan("panR", PAN_R, (tag) => {
    cyl("panR.weight", PAN_R, 0, 5, PAN.z + 2, 6, { tone: "mid" }, { attrs: tag, bevel: 0.4 });
    cyl("panR.knob", PAN_R, 0, 1.8, PAN.z + 8, 2.4, { tone: "mid" }, { attrs: tag });
  });
  // pointer plate on the pillar: the beam's pointer swings over it
  const PL = { x0: PIVOT[0] - 9, x1: PIVOT[0] + 9, z0: 30, z1: 40, y: 3.2 };
  box("scale.dialplate", [PL.x0, 3.2, PL.z0], [PL.x1, 5, PL.z1], { tone: "hi", crease: "lo" }, { r: 0.4, steps: 2,
    extra: Ln(k.sideTicks(PL.x0 + 1, PL.x1 - 1, 2, 4, 5, PL.z1, [1.4, 2.6], P).minor, { tone: "lo" }) + Ln(k.sideTicks(PL.x0 + 1, PL.x1 - 1, 2, 4, 5, PL.z1, [1.4, 2.6], P).major, { tone: "mid" }) });
  const pointerD = (tilt) => {
    const top = [PIVOT[0], 5.6, PIVOT[2] - 3], len = PIVOT[2] - 3 - (PL.z1 - 3);
    return path3([top, [PIVOT[0] + Math.sin(tilt) * len, 5.6, PIVOT[2] - 3 - Math.cos(tilt) * len]]);
  };

  // ---------------- outbox: sealed, not sent ----------------
  const OB = { x0: 248, x1: 286, y0: -22, y1: 22 };
  box("outbox.body", [OB.x0, OB.y0, 0], [OB.x1, OB.y1, 32], { tone: "mid" }, { r: 1.5, bevel: 0.6,
    inner: Ln(k.sideSeam({ x: OB.x0, y: OB.y0, w: OB.x1 - OB.x0, d: OB.y1 - OB.y0, r: 1.5 }, 6, P, 3), { tone: "faint" }),
    extra: k.faceTextSvg(k.sideMatrix([(OB.x0 + OB.x1) / 2, OB.y1 + 0.01], 16, P, "left"), "not sent", { size: 4.2, tone: "mid", anchor: "middle" })
      + Ln(faceRect(OB.y1 + 0.01, OB.x0 + 6, OB.x1 - 6, 11, 20), { tone: "lo" }) });
  box("outbox.lid", [OB.x0 - 1, OB.y0 - 1, 32], [OB.x1 + 1, OB.y1 + 1, 35], { tone: "mid" }, { r: 2, bevel: 0.5,
    extra: Ln(k.planOutline({ x: OB.x0 + 8, y: -1.2, w: OB.x1 - OB.x0 - 16, d: 2.4, r: 1.2 }, 35, P, 3), { tone: "lo" }) + screw([[OB.x0 + 3.5, OB.y0 + 3.5], [OB.x1 - 3.5, OB.y0 + 3.5], [OB.x0 + 3.5, OB.y1 - 3.5], [OB.x1 - 3.5, OB.y1 - 3.5]], 35, 1.2) });
  box("outbox.hasp", [(OB.x0 + OB.x1) / 2 - 3, OB.y1 + 1, 24], [(OB.x0 + OB.x1) / 2 + 3, OB.y1 + 2, 35], { tone: "mid" }, { r: 0.4, steps: 2 });
  const sealF = G.frameAlong([(OB.x0 + OB.x1) / 2, OB.y1 + 2, 26.5], [0, 1, 0]);
  disc("outbox.seal", sealF, 0, 1.6, 3.8, { tone: "hi", crease: "lo" }, { attrs: ` class="cm-seal"`, extra: Ln(G.circleOf(sealF, 1.6, 2.4, P, 24), { tone: "lo" }) });

  // ---------------- order ----------------
  A.settle(R, P);
  R.items.sort((a, b) => a.key - b.key);
  const idx = (name) => R.items.findIndex((it) => it.name === name);
  const after = (...names) => Math.max(...names.map(idx));
  const slots = new Map();
  const addSlot = (index, name) => slots.set(index, (slots.get(index) ?? "") + `<g data-slot="${name}"></g>`);
  slots.set(after("belt.surface"), `<g data-slot="belt">__TAG__</g>`);
  for (const b of ["gate.bin", "s1.bin", "s2.bin"]) {
    addSlot(after(`${b.split(".")[0]}.chute.plate`, "belt.rail.front"), `${b.split(".")[0]}.chute`);
    addSlot(after(`${b}.back`, `${b}.fill`, `${b}.left`, `${b}.right`), b);
  }
  addSlot(after("s2.backchute"), "s2.backchute");
  addSlot(after("s2.tray.back", "s2.tray.fill", "s2.tray.left", "s2.tray.right"), "s2.tray");
  addSlot(after("panL.pan", "panL.stack", "panL.rod.back"), "panL");
  slots.set(after("scale.dialplate", "scale.pillar", "scale.fork"), (slots.get(after("scale.dialplate", "scale.pillar", "scale.fork")) ?? "") + `<path data-part="pointer" class="iso-line" data-tone="hi" data-free="end" style="stroke-width:.9" d="${pointerD(0)}"/>`);
  const groups = R.items.map((it, i) => `<g class="it" data-name="${it.name}"${it.attrs ?? ""}>${it.svg}</g>${slots.get(i) ?? ""}`);

  // the lit tag: three poses (flat, down a front chute, down the back chute)
  const frontSlope = Math.atan2(BELT.top - BIN.h - 1.5, BIN_Y + 1.4 - BELT.y - 5);
  const backSlope = -Math.atan2(BELT.top - TRAY.z0 - TRAY.h, -BELT.y - 5 - (TRAY.y0 + TRAY.d - 1.4));
  const litTag = (slope) => { const F = tagFrame([0, 0, 0], slope); return S(tagPaths(F), { tone: "hi", crease: "lo", lit: true }) + Ln(hole(F, 3.4, 0), { tone: "lit" }); };
  const tagGroup = `<g data-part="tag" class="cm-tag" transform="${k.translateAlong(P, [S2, 0, BELT.top])}"><g data-pose="flat">${litTag(0)}</g><g data-pose="front" style="display:none">${litTag(frontSlope)}</g><g data-pose="back" style="display:none">${litTag(backSlope)}</g></g>`;

  // ---------------- callouts: numbered stations (match the step list under the card) and bin contents ----------------
  // anchor = world point on the part; lx, ly = screen point of the label; side = which way the text runs
  const STATIONS = [
    [1, "Collect", [-270, 0, 104], 62, 34, "start"],
    [2, "Extract", [PRESS, -6, 118], 262, 26, "start"],
    [3, "Gate", [GATE, 0, 56], 326, 108, "start"],
    [4, "Quote check", [S1, 0, 74], 414, 98, "start"],
    [5, "Fact check", [S2, 0, 74], 512, 126, "start"],
    [6, "Judge", [PIVOT[0], 0, PIVOT[2]], 648, 170, "start"],
    [7, "Outbox", [(OB.x0 + OB.x1) / 2, 0, 35], 724, 228, "start"],
  ];
  const BINS = [
    ["boilerplate, dead pages", [GATE + 22, BIN_Y + BIN.d, 0], 292, 318],
    [`quote not in source · ${n(fid.unsupported)}`, [S1 + 26, BIN_Y + BIN.d, 0], 374, 344],
    [`inference dropped, quote kept · ${n(pipe.overreachHigh)}`, [S2 + 26, BIN_Y + BIN.d, 0], 470, 370],
    [`flagged uncertain · ${n(pipe.overreachMed)}`, [TRAY.x0 + TRAY.w, TRAY.y0, TRAY.z0 + TRAY.h], 586, 196],
  ];
  const f1 = (v) => v.toFixed(1);
  const callouts = STATIONS.map(([num, label, anchor, lx, ly, side]) => {
    const [ax, ay] = at(anchor);
    const dir = side === "end" ? -1 : 1;
    return `<g class="cm-callout" data-step="${num}"><path class="cm-leader" d="M${f1(ax)} ${f1(ay)}L${lx} ${ly}"/><circle class="cm-dot-end" cx="${f1(ax)}" cy="${f1(ay)}" r="1.6"/>`
      + `<g transform="translate(${lx} ${ly})"><g class="cm-marker"><circle r="8"/><text class="cm-num" y="3.4" text-anchor="middle">${num}</text></g></g>`
      + `<text class="cm-label" x="${lx + dir * 13}" y="${ly + 4}" text-anchor="${side}">${label}</text></g>`;
  }).join("") + BINS.map(([label, anchor, lx, ly]) => {
    const [ax, ay] = at(anchor);
    return `<g class="cm-binlabel"><path class="cm-leader" d="M${f1(ax)} ${f1(ay)}L${lx} ${ly - 9}"/><circle class="cm-dot-end" cx="${f1(ax)}" cy="${f1(ay)}" r="1.4"/>`
      + `<text class="cm-label cm-small" x="${lx}" y="${ly}" text-anchor="middle">${label}</text></g>`;
  }).join("");

  const svg = k.figureSvg({
    width: W, height: H,
    label: `A sorting machine on a bench, in seven numbered stations. 1 Collect: a hopper with ten collector chutes, five of them shut. 2 Extract: a stamping press turns each document into about ${perDoc} claim tags. 3 Gate, 4 Quote check and 5 Fact check each drop failing tags down a chute into a labelled bin; the fact check also has an amber side tray for tags kept with raised uncertainty. 6 Judge: a balance weighs the tags that pass. 7 Outbox: a sealed box engraved not sent ends the line.`,
    body: [`<path class="iso-halo" d="${k.haloOf(BASE, -17, 12, P)}"/>`, groups.join("").replace("__TAG__", tagGroup), callouts],
  });

  // ---------------- route of the lit tag (world points) ----------------
  const z = BELT.top;
  const route = {
    start: [PRESS, 0, z],
    gate: [GATE, 0, z],
    s1: [S1, 0, z],
    s1Out: { x: S1 + 26, chute: [[S1 + 26, BELT.y + 5, z], [S1 + 26, BIN_Y + 1.4, BIN.h + 1.5]], bin: [S1 + 26, BIN_Y + 12, B1.level] },
    s2: [S2, 0, z],
    s2Out: { x: S2 + 26, chute: [[S2 + 26, BELT.y + 5, z], [S2 + 26, BIN_Y + 1.4, BIN.h + 1.5]], bin: [S2 + 26, BIN_Y + 12, B2.level] },
    tray: { x: TRAY.x0 + TRAY.w / 2, chute: [[TRAY.x0 + TRAY.w / 2, -BELT.y - 5, z], [TRAY.x0 + TRAY.w / 2, TRAY.y0 + TRAY.d - 1.4, TRAY.z0 + TRAY.h]], bin: [TRAY.x0 + TRAY.w / 2, TRAY.y0 + TRAY.d / 2, TR.level] },
    end: [BELT.x1 - 4, 0, z],
    pan: [PAN_L, 0, PAN.z + 2 + fill(pipe.verified)],
  };
  void GB;

  const beamFrames = {};
  const data = {
    P,
    route,
    lens: LENS.stroke, probe: PROBE.stroke, ram: RAM.stroke,
    ramTravel: dieZ - 5 - (BELT.top + 1.2),
    lensTravel: 66 - LENS.to - (BELT.top + 0.9) - 1,
    probeTravel: padZ - 2 - (BELT.top + 0.9),
    flapLift: 7,
    flyMatrix,
    pointer: { top: [PIVOT[0], 5.6, PIVOT[2] - 3], len: PIVOT[2] - 3 - (PL.z1 - 3) },
    cleat: CLEAT, belt: { x0: BELT.x0, x1: BELT.x1, y: BELT.y, z: RAIL.z1 },
    beam: { pivot: [PIVOT[0], 0, PIVOT[2] - 1.5], half: BEAM.half + 2, t: BEAM.t, d: BEAM.d, arm: BEAM.half },
    counts: {
      documents: pipe.documents, claims: pipe.claims, perDoc,
      verbatim: fid.substring, paraphrase: fid.entailed, unsupported: fid.unsupported, quoted,
      confirmed: pipe.factConfirmed, raised: pipe.overreachMed, rejected: pipe.overreachHigh,
      verified: pipe.verified, scored: runs.totals.scored, sent: 0,
      feeding: feeding.length, dry: dry.length,
    },
  };
  void beamFrames; void pointerD; void chuteData; void railFront; void beamFrame;

  const readout0 = `fact check · ${n(pipe.factConfirmed)} confirmed`;
  const plate = k.plateHtml({
    fig: "Fig 1",
    title: "How a claim earns its receipt",
    hint: "Watch one tag pass the two inspections",
    readout: readout0,
    keys: [
      { mark: "lit", label: "The tag being inspected" },
      { mark: "raised", label: `Bin, tray and pan levels are drawn to one scale of all ${n(pipe.claims)} claims` },
    ],
    caption: "Every count is from the October 26 and 27 run",
    body: `<div class="iso-stage cm-stage" tabindex="0" role="slider" aria-label="Sorting machine. Left and right arrows move the tag between stations; Enter sends the next tag." aria-valuemin="0" aria-valuemax="5" aria-valuenow="3" aria-valuetext="${readout0}">${svg}<span class="sr-only" role="status" aria-live="polite" data-status></span></div><script type="application/json" data-cm>${JSON.stringify(data)}</script>`,
  });
  return { plate, data, R, P };
}
