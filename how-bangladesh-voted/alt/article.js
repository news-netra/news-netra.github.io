/* ==========================================================================
   Page controller: load the data, draw the charts, drive the scrollytelling.
   ========================================================================== */

import {
  khulna5Map, religionGradient, turnoutByPlace, youthQuintiles,
  womenSlopes, turnoutGapPairs, localTiers
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

/* -------------------------------------------------------- Khulna-5 table */
function buildTable(host, data) {
  const cols = [
    ['union', 'Union', v => v],
    ['reg', 'Registered', fmt],
    ['turnout', 'Turnout', v => `${v}%`],
    ['hindu', 'Hindu %', v => v.toFixed(1)],
    ['coverage', 'Cov.', v => `${v}%`],
    ['bnp', 'BNP', fmt],
    ['jam', 'Jamaat', fmt],
    ['bnpPct', 'BNP %', v => v.toFixed(1)],
    ['jamPct', 'Jamaat %', v => v.toFixed(1)],
    ['margin', 'Margin', v => `${v > 0 ? '+' : '−'}${fmt(Math.abs(v))}`]
  ];
  const head = `<thead><tr>${cols.map(c => `<th>${c[1]}</th>`).join('')}<th>Led by</th></tr></thead>`;
  const body = data.unions.map(u => {
    const cells = cols.map(([key, , f]) => {
      const cls = key === 'margin' ? (u.margin > 0 ? 'lead-bnp' : 'lead-jam') : '';
      return `<td class="${cls}">${f(u[key])}</td>`;
    }).join('');
    const led = u.margin > 0
      ? '<td class="lead-bnp">BNP</td>'
      : '<td class="lead-jam">Jamaat</td>';
    return `<tr>${cells}${led}</tr>`;
  }).join('');
  const s = data.seat;
  const foot = `<tfoot><tr>
    <td>Seat</td><td>${fmt(s.reg)}</td><td>${s.turnout}%</td><td>${s.hindu.toFixed(1)}</td>
    <td>—</td><td>${fmt(s.bnp)}</td><td>${fmt(s.jam)}</td>
    <td>${(100 * s.bnp / s.valid).toFixed(1)}</td><td>${(100 * s.jam / s.valid).toFixed(1)}</td>
    <td>+${fmt(s.margin)}</td><td>BNP</td></tr></tfoot>`;
  host.innerHTML = head + `<tbody>${body}</tbody>` + foot;
}

/* ------------------------------------------------------- scrollytelling */
function initScrolly(section, views, captions) {
  const steps = [...section.querySelectorAll('.step')];
  const title = document.querySelector('#k5-title');
  const sub = document.querySelector('#k5-sub');
  let current = null;

  const apply = step => {
    const view = step.dataset.view;
    if (view === current) return;
    current = view;
    steps.forEach(s => s.classList.toggle('is-active', s === step));
    views[view]?.();
    const caption = captions[view];
    if (caption) { title.textContent = caption[0]; sub.textContent = caption[1]; }
  };

  section.classList.add('is-ready');

  // A plain scroll handler rather than IntersectionObserver: the step whose
  // card sits nearest the middle of the viewport wins. Four elements is
  // cheap to measure, and this behaves identically everywhere.
  const pick = () => {
    const mid = innerHeight / 2;
    let best = null;
    let bestDist = Infinity;
    for (const step of steps) {
      const box = step.getBoundingClientRect();
      if (box.bottom < 0 || box.top > innerHeight) continue;
      const dist = Math.abs(box.top + box.height / 2 - mid);
      if (dist < bestDist) { bestDist = dist; best = step; }
    }
    if (best) apply(best);
  };
  addEventListener('scroll', pick, { passive: true });
  addEventListener('resize', pick, { passive: true });
  apply(steps[0]);
  pick();
}

/* ------------------------------------------------------------------ boot */
async function main() {
  try {
    const [k5, shapes, religion, turnout, youth, women, tiers] = await Promise.all([
      load('khulna5'), load('khulna5_shapes'), load('religion'),
      load('turnout'), load('youth'), load('women'), load('local_tiers')
    ]);

    const views = khulna5Map(document.querySelector('#k5-map'), shapes, k5);
    initScrolly(document.querySelector('#scrolly-khulna'), views, {
      lead: ['Khulna-5, union by union', 'Who led each of the seat’s 18 unions'],
      margin: ['The size of each lead', 'Darker means a wider margin for the leading party'],
      hindu: ['Estimated Hindu share of the roll', 'Darker means a larger inferred Hindu electorate'],
      decisive: ['The five unions that decided the seat', 'Adding unions one at a time, largest BNP margin first']
    });

    buildTable(document.querySelector('#k5-table'), k5);
    religionGradient(document.querySelector('#religion-chart'), religion.bins);
    turnoutByPlace(document.querySelector('#turnout-chart'), turnout.byPlace, turnout.national);
    youthQuintiles(document.querySelector('#youth-chart'), youth.quintiles);
    turnoutGapPairs(document.querySelector('#gap-chart'), women.pairs);
    womenSlopes(document.querySelector('#women-chart'), women.byPlace);
    localTiers(document.querySelector('#tiers-chart'), tiers);

    // charts are sized in viewBox units, so a resize only needs a redraw for
    // the ones whose layout depends on the container's aspect
    let t;
    addEventListener('resize', () => {
      clearTimeout(t);
      t = setTimeout(() => {
        womenSlopes(document.querySelector('#women-chart'), women.byPlace);
      }, 180);
    }, { passive: true });
  } catch (error) {
    document.body.insertAdjacentHTML('afterbegin',
      `<div role="alert" style="padding:1rem;font-family:system-ui;color:#b9590a">
        Could not load the analysis data: ${error.message}</div>`);
    console.error(error);
  }
}

main();
