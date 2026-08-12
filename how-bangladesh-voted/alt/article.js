/* ==========================================================================
   Page controller: load the data, draw the charts, drive the scrollytelling.
   ========================================================================== */

import {
  openingMap, religionGradient, turnoutByPlace, youthQuintiles,
  womenRanges, turnoutGapPairs, localTiers, localMap, isNarrow
} from './charts.js';

// a restored scroll position lands the reader mid-scrollytell with the wrong
// frame showing, so the page always opens at the top
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

const load = name =>
  fetch(`data/${name}.json`, { cache: 'no-store' }).then(r => {
    if (!r.ok) throw new Error(`${name}: HTTP ${r.status}`);
    return r.json();
  });

const fmt = n => n.toLocaleString('en-US');

/* ---------------------------------------------------------- responsive */
/* Redraw a chart only when it crosses the narrow/wide boundary. Charts are
   sized in viewBox units, so ordinary resizing costs nothing; it is only the
   change of layout profile that needs a rebuild. */
function responsive(host, draw) {
  if (!host) return;
  let narrow = null;
  const apply = () => {
    const now = isNarrow(host);
    if (now === narrow) return;
    narrow = now;
    draw(now);
  };
  apply();
  let timer;
  addEventListener('resize', () => {
    clearTimeout(timer);
    timer = setTimeout(apply, 150);
  }, { passive: true });
  return apply;
}

/* ------------------------------------------------------- reading progress */
function initReadbar() {
  const bar = document.querySelector('.readbar');
  const fill = bar && bar.querySelector('span');
  const hero = document.querySelector('.hero');
  if (!fill) return;
  // a plain scroll listener, like the scrollytelling: one style write per event
  const update = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    fill.style.width = `${max > 0 ? Math.min(100, Math.max(0, (scrollY / max) * 100)) : 0}%`;
    // the bar stays out of the way of the headline
    bar.classList.toggle('is-visible', !hero || scrollY > hero.offsetHeight * 0.6);
  };
  addEventListener('scroll', update, { passive: true });
  addEventListener('resize', update, { passive: true });
  update();
}

/* --------------------------------------------------- segmented control */
function buildSwitch(host, options, draw) {
  const buttons = options.map(o => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = o.label;
    b.dataset.key = o.key;
    host.append(b);
    return b;
  });
  const select = key => {
    buttons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.key === key)));
    draw(key);
  };
  host.addEventListener('click', event => {
    const b = event.target.closest('button');
    if (b) select(b.dataset.key);
  });
  select(options[0].key);
}

/* ------------------------------------------------------- scrollytelling */
function initScrolly(section, views, captions, headings) {
  const steps = [...section.querySelectorAll('.step')];
  const title = headings && document.querySelector(headings[0]);
  const sub = headings && document.querySelector(headings[1]);
  let current = null;

  const apply = step => {
    const view = step.dataset.view;
    if (view === current) return;
    current = view;
    steps.forEach(s => s.classList.toggle('is-active', s === step));
    views[view]?.();
    const caption = captions[view];
    if (caption && title && sub) { title.textContent = caption[0]; sub.textContent = caption[1]; }
  };

  section.classList.add('is-ready');

  // A plain scroll handler rather than IntersectionObserver, and the rule is
  // "the last card the reader has actually reached" rather than "the nearest
  // card". The difference is the whole complaint about early cards.
  //
  // Nearest-card hands over at the midpoint between two cards, which on
  // screen-height steps means the incoming card takes the graphic while it is
  // still at the very bottom edge — the graphic changes under a card the reader
  // has not begun. An IntersectionObserver watching the step WRAPPER is worse
  // again: a wrapper is most of a screen tall, so it fires when its invisible
  // top edge crosses the trigger, with the card still a screen below.
  //
  // Here a card takes over only once its own centre has risen past the reading
  // line, so the graphic can never lead the text. It measures the card, not the
  // wrapper, and it behaves the same scrolling up as down.
  const READING_LINE = 0.62;
  const centreOf = step => {
    const box = (step.querySelector('.step-card') || step).getBoundingClientRect();
    return box.top + box.height / 2;
  };
  const pick = () => {
    const line = innerHeight * READING_LINE;
    let best = steps[0];
    for (const step of steps) {
      if (centreOf(step) <= line) best = step;
    }
    apply(best);
  };
  addEventListener('scroll', pick, { passive: true });
  addEventListener('resize', pick, { passive: true });
  apply(steps[0]);
  pick();
}

/* ------------------------------------------------------------------ boot */
async function main() {
  initReadbar();
  try {
    const [national, k5, shapes, religion, turnout, youth, women, tiers, mapGeo, mapMeta] =
      await Promise.all([
        load('national'), load('khulna5'), load('khulna5_shapes'), load('religion'),
        load('turnout'), load('youth'), load('women'), load('local_tiers'),
        load('map_geo'), load('map_meta')
      ]);

    const views = openingMap(document.querySelector('#k5-map'), national, shapes, k5);
    initScrolly(document.querySelector('#scrolly-khulna'), views, {
      national: ['The parliamentary map', 'Winner of each of the 297 declared seats'],
      locate: ['One close seat', 'Khulna-5 was decided by 3,311 votes'],
      unions: ['Eighteen local verdicts', 'Who led each of Khulna-5’s 18 unions'],
      margin: ['The size of each lead', 'Darker means a wider margin for the leading party'],
      hindu: ['Where Hindu voters are the majority', 'Shaded by the estimated Hindu share of each union’s roll'],
      decisive: ['The five unions that decided the seat', 'Adding the other 13 first, then the five marked H']
    }, ['#k5-title', '#k5-sub']);

    const $ = q => document.querySelector(q);
    responsive($('#religion-chart'), () => religionGradient($('#religion-chart'), religion));
    responsive($('#turnout-chart'), () => turnoutByPlace($('#turnout-chart'), turnout));
    responsive($('#youth-chart'), () => youthQuintiles($('#youth-chart'), youth.quintiles, youth.byPlace));
    let gapView = 'all';
    const drawGap = () => turnoutGapPairs($('#gap-chart'), women.pairs, gapView);
    buildSwitch(
      $('#gap-switch'),
      women.pairs.views.map(v => ({ key: v.key, label: v.short })),
      key => { gapView = key; drawGap(); }
    );
    responsive($('#gap-chart'), drawGap);
    const womenPanels = [
      { key: 'village', ...women.byPlace.find(p => p.label === 'Villages') },
      { key: 'town', ...women.byPlace.find(p => p.label === 'Small towns') },
      { key: 'city', ...women.byPlace.find(p => p.label === 'Big cities') },
      { key: 'khulna', label: 'Khulna division', note: '29 seats', ...women.khulna }
    ];
    const SUB = 'Each bar runs from a party’s share at men-only centres to its share at women-only centres serving the same places';
    initScrolly(
      document.querySelector('#scrolly-women'),
      womenRanges($('#women-chart'), womenPanels),
      {
        village: ['Jamaat gained among women in the villages', SUB],
        town: ['And in the small towns, by almost exactly as much', SUB],
        city: ['In the big cities the movement reverses', SUB],
        khulna: ['In the south-west it is not a drift but a gulf', SUB]
      },
      ['#wom-title', '#wom-sub']
    );
    responsive($('#tiers-chart'), () => localTiers($('#tiers-chart'), tiers));

    const C = mapMeta.counts;
    initScrolly(
      document.querySelector('#scrolly-map'),
      localMap(document.querySelector('#verdict-map'), mapGeo, mapMeta),
      {
        upazila: ['The same election, by upazila', `${fmt(C.upazilas)} sub-districts. City corporations are held back — they sit outside the upazila system`],
        city: ['The twelve city corporations', 'Each city as a single unit, coloured by its own count'],
        urban: ['Cities split into wards, towns pulled out', `${fmt(C.wards)} city wards and ${fmt(C.municipalities)} municipalities`],
        union: [`${fmt(C.verdicts)} local verdicts`, `${fmt(C.unions)} unions, ${fmt(C.municipalities)} municipalities and ${fmt(C.wards)} city wards`]
      },
      ['#map-title', '#map-sub']
    );

  } catch (error) {
    document.body.insertAdjacentHTML('afterbegin',
      `<div role="alert" style="padding:1rem;font-family:system-ui;color:#b9590a">
        Could not load the analysis data: ${error.message}</div>`);
    console.error(error);
  }
}

main();
