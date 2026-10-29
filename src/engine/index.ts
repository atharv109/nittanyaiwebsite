// Engine core (trimmed from the awwwards engine: no loader, no GL, no smooth scroll, no cursor).
// The Astro adapter calls boot() once, leave() -> cleanup() before a swap, enter() after it.
// Page code hooks in with onPage(fn): fn runs inside a gsap.context, so its tweens and
// ScrollTriggers are reverted on navigation. Return a cleanup for listeners you add.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(ScrollTrigger, SplitText);

export const prefersReducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export const isTouch = () => matchMedia('(hover: none), (pointer: coarse)').matches;
export const ease = { out: 'expo.out', inOut: 'expo.inOut', soft: 'power3.out' } as const;

export type PageFn = (page: { intro: gsap.core.Timeline; path: string }) => void | (() => void);
const pageFns = new Set<PageFn>();
const cleanups: (() => void)[] = [];
let ctx: gsap.Context | null = null;
let intro: gsap.core.Timeline | null = null;
let ready = false;
let booted = false;

export function onPage(fn: PageFn) {
  pageFns.add(fn);
  if (ready) runPageFn(fn);
  return () => { pageFns.delete(fn); };
}

function runPageFn(fn: PageFn) {
  ctx?.add(() => {
    const c = fn({ intro: intro!, path: location.pathname });
    if (typeof c === 'function') cleanups.push(c);
  });
}

export function syncFlags() {
  const h = document.documentElement.classList;
  h.add('js', 'is-booted');
  h.toggle('motion', !prefersReducedMotion());
}

// data-split on headings (masked line rise), data-reveal on blocks, data-intro = play on page entrance.
function initReveals() {
  const tl = gsap.timeline({ paused: true });
  if (prefersReducedMotion()) return tl;
  document.querySelectorAll<HTMLElement>('[data-split]').forEach((el) => {
    const isIntro = el.hasAttribute('data-intro');
    const delay = parseFloat(el.dataset.delay || '0');
    const s = { tween: undefined as gsap.core.Tween | undefined, done: false, requested: false };
    SplitText.create(el, {
      type: 'lines', mask: 'lines', autoSplit: true, linesClass: 'split-line',
      onSplit(self) {
        gsap.set(el, { visibility: 'visible' });
        if (s.done) return;
        s.tween = gsap.from(self.lines, {
          yPercent: 110, duration: 1.1, stagger: 0.07, ease: ease.out, delay,
          paused: isIntro && !s.requested, onComplete: () => { s.done = true; },
          scrollTrigger: isIntro ? undefined : { trigger: el, start: 'top 88%', once: true },
        });
        return s.tween;
      },
    });
    if (isIntro) tl.add(() => { s.requested = true; s.tween?.play(); }, 0);
  });
  document.querySelectorAll<HTMLElement>('[data-reveal]').forEach((el) => {
    const isIntro = el.hasAttribute('data-intro');
    gsap.set(el, { visibility: 'visible' });
    const t = gsap.fromTo(el, { y: 14, autoAlpha: 0 }, {
      y: 0, autoAlpha: 1, duration: 0.9, ease: ease.out, delay: parseFloat(el.dataset.delay || '0'),
      paused: isIntro, scrollTrigger: isIntro ? undefined : { trigger: el, start: 'top 92%', once: true },
    });
    if (isIntro) tl.add(() => { t.play(); }, 0);
  });
  return tl;
}

function initPage() {
  syncFlags();
  ctx = gsap.context(() => { intro = initReveals(); });
  ready = true;
  pageFns.forEach(runPageFn);
  requestAnimationFrame(() => ScrollTrigger.refresh());
}

export function boot() {
  if (booted) return;
  booted = true;
  initPage();
  intro?.play();
}

// Page transition: a ground-colored sheet slides up over the page (a ledger page turning),
// then lifts off the new one. Reduced motion: a short cross-fade of the same sheet.
const sheet = () => document.querySelector<HTMLElement>('#curtain .curtain__panel');

export async function leave() {
  const s = sheet();
  if (!s) return;
  gsap.set('#curtain', { autoAlpha: 1 });
  if (prefersReducedMotion()) await gsap.fromTo(s, { opacity: 0, yPercent: 0 }, { opacity: 1, duration: 0.15 });
  else await gsap.fromTo(s, { yPercent: 100, opacity: 1 }, { yPercent: 0, duration: 0.55, ease: ease.inOut });
}

export function cleanup() {
  if (!ready) return;
  ready = false;
  cleanups.splice(0).forEach((c) => c());
  ctx?.revert();
  ctx = null;
}

export async function enter() {
  if (!booted) return;
  cleanup();
  scrollTo(0, 0);
  initPage();
  const s = sheet();
  if (s) {
    if (prefersReducedMotion()) await gsap.to(s, { opacity: 0, duration: 0.15 });
    else await gsap.to(s, { yPercent: -100, duration: 0.6, ease: ease.inOut });
    gsap.set('#curtain', { autoAlpha: 0 });
  }
  intro?.play();
}
