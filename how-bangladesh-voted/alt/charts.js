/* ==========================================================================
   Charts for "How Bangladesh Voted".
   Plain SVG, no chart library: every mark is placed deliberately, the way a
   newspaper graphics desk would place it. Each builder takes its data and a
   host element and returns nothing — the page wires them up in article.js.
   ========================================================================== */

const NS = 'http://www.w3.org/2000/svg';

export const C = {
  bnp: '#367b7f', bnpInk: '#2b6367', bnpPale: '#a6c5c6', bnpWash: '#eef4f4',
  jam: '#f28124', jamInk: '#b9590a', jamPale: '#f9c79e', jamWash: '#fdf3ea',
  other: '#7b5ea7', otherInk: '#5c4480', indep: '#8a8f92',
  neutral: '#ebebeb', rule: '#ddd8d2', grid: '#eeeae5',
  ink: '#16130f', body: '#35302a', muted: '#77706a', white: '#ffffff'
};

export const el = (name, attrs = {}, parent = null) => {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) {
    if (v !== null && v !== undefined) node.setAttribute(k, v);
  }
  if (parent) parent.appendChild(node);
  return node;
};

const svg = (host, w, h) => {
  host.innerHTML = '';
  return el('svg', { viewBox: `0 0 ${w} ${h}`, role: 'img' }, host);
};

/* Narrow layouts are not the wide ones scaled down. An SVG scales its type with
   its viewBox, so a 900-unit chart squeezed into a 355px phone renders 11.5px
   labels at under 5px. Below this width the charts rebuild on a viewBox roughly
   the size of the screen, which keeps type at its intended size, and drop or
   restack whatever no longer fits. */
export const NARROW_AT = 560;
export const widthOf = host => host.getBoundingClientRect().width || 900;
export const isNarrow = host => widthOf(host) < NARROW_AT;

const fmt = n => n.toLocaleString('en-US');
const pct = (n, d = 1) => `${n.toFixed(d)}%`;

/* ------------------------------------------------------------------ tooltip */
let tipEl;
export function showTip(event, html) {
  if (!tipEl) {
    tipEl = document.createElement('div');
    tipEl.className = 'tip';
    document.body.appendChild(tipEl);
  }
  tipEl.innerHTML = html;
  tipEl.style.opacity = '1';
  const pad = 14;
  const box = tipEl.getBoundingClientRect();
  let x = event.clientX + pad;
  let y = event.clientY + pad;
  if (x + box.width > window.innerWidth - 8) x = event.clientX - box.width - pad;
  if (y + box.height > window.innerHeight - 8) y = event.clientY - box.height - pad;
  tipEl.style.left = `${x}px`;
  tipEl.style.top = `${y}px`;
}
export const hideTip = () => { if (tipEl) tipEl.style.opacity = '0'; };

export function hover(node, html) {
  node.classList.add('hoverable');
  const show = event => showTip(event, html);
  node.addEventListener('mouseenter', show);
  node.addEventListener('mousemove', show);
  node.addEventListener('mouseleave', hideTip);
}

/* ===========================================================================
   1. THE OPENING MAP — national seats, then a zoom into Khulna-5.
   Both layers share one projection, so the descent from the country to the
   seat is a real zoom rather than a cut between two maps. Views:
   national · locate · unions · margin · Hindu share · the running total.
   =========================================================================== */
export function openingMap(host, national, shapes, data) {
  const W = 1000, H = 620, mapW = 600, pad = 22;
  const s = svg(host, W, H);
  const byUnion = new Map(data.unions.map(u => [u.union, u]));

  /* --- one projection for the whole country, shared by both layers, so the
         zoom from the national map into Khulna-5 is geometrically continuous
         rather than a cut between two separately fitted maps --- */
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const seat of national.seats) for (const poly of seat.polys) for (const ring of poly) {
    for (const [x, y] of ring) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  const kx = Math.cos(((minY + maxY) / 2) * Math.PI / 180);
  const scale = Math.min((mapW - pad * 2) / ((maxX - minX) * kx), (H - pad * 2) / (maxY - minY));
  const ox = pad + ((mapW - pad * 2) - (maxX - minX) * kx * scale) / 2;
  const oy = pad + ((H - pad * 2) - (maxY - minY) * scale) / 2;
  const px = x => ox + (x - minX) * kx * scale;
  const py = y => oy + (maxY - y) * scale;
  const toPath = polys => polys.map(poly => poly.map(ring =>
    ring.map(([x, y], i) => `${i ? 'L' : 'M'}${px(x).toFixed(1)},${py(y).toFixed(1)}`).join('') + 'Z'
  ).join('')).join('');

  const PARTY = {
    BNP: C.bnp, Jamaat: C.jam, Independent: C.indep, NCP: C.other,
    Khelafat: '#a8761f', IAB: '#326891', GOP: '#8a8f92',
    BJP: '#8a8f92', Ganasamhati: '#8a8f92', Jamiat: '#a8761f'
  };

  /* --- layers --- */
  const clipId = `map-clip-${Math.round(performance.now())}`;
  const clipRect = el('rect', { x: 0, y: 0, width: W, height: H },
    el('clipPath', { id: clipId }, el('defs', {}, s)));
  const clipped = el('g', { 'clip-path': `url(#${clipId})` }, s);
  const zoomable = el('g', {}, clipped);
  zoomable.style.transition = 'transform 1100ms cubic-bezier(.45,.02,.2,1)';
  const natG = el('g', {}, zoomable);
  const unionG = el('g', { opacity: 0 }, zoomable);
  const badgeG = el('g', { opacity: 0 }, zoomable);

  const seatPaths = new Map();
  for (const seat of national.seats) {
    const p = el('path', {
      d: toPath(seat.polys), fill: seat.party ? PARTY[seat.party] || C.neutral : C.neutral,
      stroke: C.white, 'stroke-width': 0.5, 'vector-effect': 'non-scaling-stroke'
    }, natG);
    seatPaths.set(seat.cid, p);
  }

  const unionPaths = new Map();
  for (const f of shapes) {
    const u = byUnion.get(f.union);
    const p = el('path', {
      d: toPath(f.polys), fill: C.neutral, stroke: C.white,
      'stroke-width': 1, 'vector-effect': 'non-scaling-stroke'
    }, unionG);
    unionPaths.set(f.union, p);
  }

  /* --- the zoom: fit Khulna-5's own bounds inside the map box --- */
  let k5x0 = Infinity, k5x1 = -Infinity, k5y0 = Infinity, k5y1 = -Infinity;
  for (const f of shapes) for (const poly of f.polys) for (const ring of poly) {
    for (const [x, y] of ring) {
      const X = px(x), Y = py(y);
      if (X < k5x0) k5x0 = X; if (X > k5x1) k5x1 = X;
      if (Y < k5y0) k5y0 = Y; if (Y > k5y1) k5y1 = Y;
    }
  }
  const zoomK = Math.min((mapW - pad * 2) / (k5x1 - k5x0), (H - pad * 2) / (k5y1 - k5y0));
  const k5cx = (k5x0 + k5x1) / 2, k5cy = (k5y0 + k5y1) / 2;

  // badges sit inside the zoomed group but counter-scale, so an "H" is the
  // same size on screen whatever the zoom level
  const centroid = f => {
    let sx = 0, sy = 0, n = 0;
    for (const [x, y] of f.polys[0][0]) { sx += px(x); sy += py(y); n++; }
    return [sx / n, sy / n];
  };
  const badges = [];
  for (const f of shapes) {
    const u = byUnion.get(f.union);
    if (!u || u.hindu <= 50) continue;
    const [cx, cy] = centroid(f);
    const g = el('g', {}, badgeG);
    el('circle', { r: 11, fill: C.white, stroke: C.otherInk, 'stroke-width': 2 }, g);
    el('text', {
      'text-anchor': 'middle', y: 4, fill: C.otherInk,
      style: 'font-family:var(--sans);font-size:13px;font-weight:700'
    }, g).textContent = 'H';
    badges.push({ g, cx, cy });
  }

  // opacity alone cannot pick one small seat out of 300, so the locate step
  // also drops a ring on Khulna-5, sized in screen units at every zoom level
  const locator = el('g', { opacity: 0 }, zoomable);
  const locRing = el('circle', {
    fill: 'none', stroke: C.ink, 'stroke-width': 2, r: 34
  }, locator);
  el('text', {
    'text-anchor': 'middle', y: -44, fill: C.ink,
    style: 'font-family:var(--sans);font-size:13px;font-weight:700'
  }, locator).textContent = 'Khulna-5';

  let frameShift = 0;
  const setView = (zoomed, shifted) => {
    frameShift = shifted ? 0 : (W - mapW) / 2;
    const k = zoomed ? zoomK : 1;
    const cx = zoomed ? k5cx : mapW / 2;
    const cy = zoomed ? k5cy : H / 2;
    zoomable.setAttribute('transform',
      `translate(${frameShift + mapW / 2 - cx * k}, ${H / 2 - cy * k}) scale(${k})`);
    for (const b of badges) {
      b.g.setAttribute('transform', `translate(${b.cx},${b.cy}) scale(${1 / k})`);
    }
    locator.setAttribute('transform', `translate(${k5cx},${k5cy}) scale(${1 / k})`);
    clipRect.setAttribute('width', shifted ? mapW + 12 : W);
  };

  /* --- the waterfall panel.
     Each bar is one union's OWN contribution, spanning from the running total
     before it to the running total after, and coloured by which party actually
     won that union. Colouring by the sign of the running total instead would
     paint Magurkhali orange — a union the BNP took 76.9 to 21.7 — which reads
     as a Jamaat win. Position carries the accumulation; colour carries the
     result; the two must not be crossed. --- */
  const panelX = mapW + 24, labelW = 104;
  const plotX0 = panelX + labelW, plotX1 = W - 26;
  const panel = el('g', { opacity: 0 }, s);
  const wf = data.waterfall;
  const cums = wf.map(d => d.cum);
  const lo = Math.min(0, ...cums) * 1.06, hi = Math.max(0, ...cums) * 1.35;
  const wx = v => plotX0 + ((v - lo) / (hi - lo)) * (plotX1 - plotX0);
  const rowH = (H - 84) / wf.length;

  el('line', { x1: wx(0), x2: wx(0), y1: 34, y2: H - 46, class: 'zeroline' }, panel);
  el('text', { x: wx(0), y: 26, 'text-anchor': 'middle', class: 'tick-label', fill: C.muted }, panel)
    .textContent = 'level';

  wf.forEach((d, i) => {
    const y = 42 + i * rowH;
    const prev = i ? wf[i - 1].cum : 0;
    const x0 = Math.min(wx(prev), wx(d.cum));
    const w = Math.abs(wx(d.cum) - wx(prev));
    // colour = who won this union, never the sign of the running total
    const wonByBnp = d.margin > 0;
    el('rect', {
      x: x0, y, width: Math.max(w, 1.5), height: rowH - 4,
      fill: wonByBnp ? C.bnp : C.jam, opacity: d.decisive ? 1 : 0.5
    }, panel);
    if (i < wf.length - 1) {
      el('line', {
        x1: wx(d.cum), x2: wx(d.cum), y1: y + rowH - 4, y2: y + rowH,
        stroke: C.rule, 'stroke-width': 1
      }, panel);
    }
    el('text', {
      x: panelX + labelW - 8, y: y + rowH / 2, 'text-anchor': 'end',
      class: 'tick-label', fill: d.decisive ? C.ink : C.muted,
      'font-weight': d.decisive ? 600 : 400, 'dominant-baseline': 'middle'
    }, panel).textContent = d.union + (d.decisive ? '  H' : '');
  });

  // the two moments the seat turns on
  const mark = (index, text, colour, dy) => {
    const y = 42 + index * rowH + rowH / 2 + dy;
    el('line', {
      x1: panelX + labelW, x2: plotX1, y1: y, y2: y,
      stroke: colour, 'stroke-width': 1, 'stroke-dasharray': '3 2', opacity: 0.65
    }, panel);
    el('text', {
      x: plotX1, y: y - 5, 'text-anchor': 'end', class: 'value-label', fill: colour,
      'paint-order': 'stroke', stroke: C.white, 'stroke-width': 3.5,
      'stroke-linejoin': 'round'
    }, panel).textContent = text;
  };
  const lastOther = wf.map(d => d.decisive).lastIndexOf(false);
  mark(lastOther, `Jamaat ahead by ${fmt(Math.abs(wf[lastOther].cum))}`, C.jamInk, rowH / 2);
  const crossing = wf.findIndex(d => d.cum > 0);
  if (crossing > -1) mark(crossing, 'BNP moves ahead', C.bnpInk, -rowH / 2);

  el('text', {
    x: plotX1, y: H - 26, 'text-anchor': 'end', class: 'value-label', fill: C.bnpInk,
    'paint-order': 'stroke', stroke: C.white, 'stroke-width': 3.5, 'stroke-linejoin': 'round'
  }, panel).textContent = `BNP wins the seat by ${fmt(data.seat.margin)}`;

  const legend = el('g', {}, panel);
  [['BNP won this union', C.bnp], ['Jamaat won this union', C.jam]].forEach(([label, colour], i) => {
    el('rect', { x: panelX + i * 168, y: H - 12, width: 10, height: 10, fill: colour }, legend);
    el('text', { x: panelX + i * 168 + 15, y: H - 3, class: 'tick-label' }, legend).textContent = label;
  });

  /* --- colour scales --- */
  const hinduScale = v => {
    // violet, deliberately: composition is not a party, and shading it in
    // either party's hue would let a reader infer a vote from a demographic
    const stops = [[0, [246, 244, 247]], [25, [216, 205, 228]], [50, [155, 130, 186]], [90, [70, 48, 110]]];
    for (let i = 1; i < stops.length; i++) {
      if (v <= stops[i][0]) {
        const [v0, c0] = stops[i - 1], [v1, c1] = stops[i];
        const t = (v - v0) / (v1 - v0);
        return `rgb(${c0.map((c, k) => Math.round(c + t * (c1[k] - c))).join(',')})`;
      }
    }
    return `rgb(${stops[stops.length - 1][1].join(',')})`;
  };
  const marginScale = m => {
    const t = Math.min(Math.abs(m) / 9500, 1);
    const mix = (a, b) => a.map((c, i) => Math.round(c + t * (b[i] - c)));
    const base = [235, 235, 235];
    return `rgb(${(m > 0 ? mix(base, [43, 99, 103]) : mix(base, [185, 89, 10])).join(',')})`;
  };

  const paintUnions = fn => {
    for (const [name, p] of unionPaths) {
      const u = byUnion.get(name);
      p.style.transition = 'fill 600ms ease';
      p.setAttribute('fill', u ? fn(u) : C.neutral);
    }
  };
  const fadeNational = (opacity, highlightK5) => {
    for (const [cid, p] of seatPaths) {
      p.style.transition = 'opacity 500ms ease, fill 500ms ease';
      p.setAttribute('opacity', highlightK5 && cid === national.khulna5Cid ? 1 : opacity);
    }
  };

  const views = {
    national() {
      locator.setAttribute('opacity', 0);
      fadeNational(1, false);
      unionG.setAttribute('opacity', 0);
      badgeG.setAttribute('opacity', 0);
      panel.setAttribute('opacity', 0);
      setView(false, false);
    },
    locate() {
      fadeNational(0.28, true);
      locator.setAttribute('opacity', 1);
      unionG.setAttribute('opacity', 0);
      badgeG.setAttribute('opacity', 0);
      panel.setAttribute('opacity', 0);
      setView(false, false);
    },
    unions() {
      locator.setAttribute('opacity', 0);
      fadeNational(0, false);
      paintUnions(u => u.margin > 0 ? C.bnp : C.jam);
      unionG.setAttribute('opacity', 1);
      badgeG.setAttribute('opacity', 0);
      panel.setAttribute('opacity', 0);
      setView(true, false);
    },
    margin() {
      locator.setAttribute('opacity', 0);
      fadeNational(0, false);
      paintUnions(u => marginScale(u.margin));
      unionG.setAttribute('opacity', 1);
      badgeG.setAttribute('opacity', 0);
      panel.setAttribute('opacity', 0);
      setView(true, false);
    },
    hindu() {
      locator.setAttribute('opacity', 0);
      fadeNational(0, false);
      paintUnions(u => hinduScale(u.hindu));
      unionG.setAttribute('opacity', 1);
      badgeG.setAttribute('opacity', 1);
      panel.setAttribute('opacity', 0);
      setView(true, false);
    },
    decisive() {
      locator.setAttribute('opacity', 0);
      fadeNational(0, false);
      paintUnions(u => u.hindu > 50 ? C.bnp : u.margin > 0 ? C.bnpWash : C.jamWash);
      unionG.setAttribute('opacity', 1);
      badgeG.setAttribute('opacity', 1);
      panel.setAttribute('opacity', 1);
      setView(true, true);
    }
  };
  views.national();
  return views;
}

/* ===========================================================================
   2. THE RELIGION GRADIENT — a slope of party share across Hindu-share bands.
   =========================================================================== */
export function religionGradient(host, data) {
  const n = isNarrow(host);
  // on a phone the series labels move off the right-hand end and sit above the
  // plot, which is the whole of that 132-unit margin recovered
  const W = n ? 380 : 900, H = n ? 380 : 440;
  const mL = n ? 34 : 54, mR = n ? 14 : 132, mT = n ? 46 : 20, mB = n ? 56 : 62;
  const s = svg(host, W, H);
  const pts = data.points;
  const iw = W - mL - mR, ih = H - mT - mB;
  const x = v => mL + (v / 100) * iw;
  const y = v => mT + ih - (v / 90) * ih;

  for (let v = 0; v <= 80; v += 20) {
    el('line', { x1: mL, x2: mL + iw, y1: y(v), y2: y(v), class: 'gridline' }, s);
    el('text', { x: mL - 10, y: y(v) + 4, 'text-anchor': 'end', class: 'tick-label' }, s)
      .textContent = `${v}%`;
  }

  // the band between the two main parties is the finding: 7 points to 66
  const band = pts.map(p => `${x(p.x)},${y(p.bnp)}`).join(' ') + ' ' +
    pts.slice().reverse().map(p => `${x(p.x)},${y(p.jam)}`).join(' ');
  el('polygon', { points: band, fill: C.ink, opacity: 0.05 }, s);

  const LEG = [0, 58, 132];   // narrow: a legend row instead of end labels
  const line = (key, colour, label, width = 3) => {
    el('path', {
      d: pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.x)},${y(p[key])}`).join(''),
      fill: 'none', stroke: colour, 'stroke-width': width,
      'stroke-linejoin': 'round', 'stroke-linecap': 'round'
    }, s);
    for (const p of pts) {
      const dot = el('circle', {
        cx: x(p.x), cy: y(p[key]), r: 3.2, fill: colour,
        stroke: C.white, 'stroke-width': 1.2
      }, s);
      hover(dot, `<b>${p.lo}–${p.hi}% Hindu</b><br>
        BNP ${pct(p.bnp)} · Jamaat ${pct(p.jam)} · everyone else ${pct(p.oth)}<br>
        ${fmt(p.centres)} centres · ${fmt(p.reg)} registered`);
    }
    const last = pts[pts.length - 1];
    el('text', {
      x: n ? mL + LEG.shift() : mL + iw + 10,
      y: n ? mT - 18 : y(last[key]) + 4, class: 'series-label', fill: colour
    }, s).textContent = label;
  };
  line('oth', C.indep, n ? 'Others' : 'Everyone else', 2.2);
  line('jam', C.jam, 'Jamaat');
  line('bnp', C.bnp, 'BNP');

  const endNote = (p, dx, anchor) => {
    el('text', {
      x: x(p.x) + dx, y: y((p.bnp + p.jam) / 2) + 4, 'text-anchor': anchor,
      class: 'value-label', fill: C.body, 'paint-order': 'stroke',
      stroke: C.white, 'stroke-width': 3.5, 'stroke-linejoin': 'round'
    }, s).textContent = `${p.gap.toFixed(0)} pts apart`;
  };
  endNote(pts[0], 14, 'start');
  endNote(pts[pts.length - 1], -12, 'end');

  // where other candidates overtake Jamaat — the reason the BNP line dips at
  // the very top without Jamaat gaining anything back
  const cross = pts.findIndex(p => p.oth > p.jam && p.x > 50);
  if (cross > -1) {
    const p = pts[cross];
    // above the lines, not below: the axis labels live under there
    el('line', {
      x1: x(p.x), x2: x(p.x), y1: y(p.oth) - 8, y2: y(p.oth) - 36,
      stroke: C.muted, 'stroke-width': 1, 'stroke-dasharray': '3 2'
    }, s);
    el('text', {
      x: x(p.x) - 7, y: y(p.oth) - 40, 'text-anchor': 'end',
      class: 'tick-label', fill: C.body, 'paint-order': 'stroke',
      stroke: C.white, 'stroke-width': 3.5, 'stroke-linejoin': 'round'
    }, s).textContent = 'others overtake Jamaat';
  }

  for (let v = 0; v <= 100; v += n ? 25 : 20) {
    el('text', { x: x(v), y: mT + ih + 20, 'text-anchor': 'middle', class: 'tick-label' }, s)
      .textContent = `${v}%`;
  }
  el('text', {
    x: n ? mL : mL + iw / 2, y: mT + ih + 40, 'text-anchor': n ? 'start' : 'middle',
    class: 'tick-label', fill: C.muted
  }, s).textContent = n ? 'Hindu share of the centre’s roll →'
    : 'Estimated Hindu share of the polling centre’s electorate →';
}

/* ===========================================================================
   3. TURNOUT BY PLACE — three bars, the plainest chart in the piece.
   =========================================================================== */
export function turnoutByPlace(host, data) {
  const n = isNarrow(host);
  // two panels side by side will not survive a phone, so on narrow they stack:
  // the second panel is offset down the page instead of across it
  const W = n ? 380 : 940, H = n ? 700 : 430, mT = 44, mB = n ? 30 : 54;
  const s = svg(host, W, H);
  const panelW = n ? W : W / 2, mL = n ? 116 : 148, mR = n ? 42 : 66;
  const iw = panelW - mL - mR;
  const ih = n ? 250 : H - mT - mB;
  const x0 = 0;
  // Turnout is not a party measure, so it gets its own bright pair, chosen to
  // sit outside every hue the piece assigns to a party: not teal (BNP), orange
  // (Jamaat), violet (NCP), blue (IAB), ochre (Khelafat) or grey (independents).
  const BAR = '#4c56a8', BAR_LOW = '#e0457b';

  const panel = (ox, title, rows, key, sublabel) => {
    // on narrow, `ox` shifts the panel DOWN rather than across
    const x = v => (n ? mL : ox + mL) + (v / 70) * iw;
    const y0 = n ? mT + ox : mT;
    const lx = n ? mL : ox + mL;
    const rowH = ih / rows.length;

    el('text', { x: lx, y: y0 - 20, class: 'series-label', fill: C.ink }, s)
      .textContent = title;

    for (let v = 0; v <= 70; v += (n ? 20 : 10)) {
      el('line', { x1: x(v), x2: x(v), y1: y0, y2: y0 + ih, class: 'gridline' }, s);
      el('text', { x: x(v), y: y0 + ih + 18, 'text-anchor': 'middle', class: 'tick-label' }, s)
        .textContent = `${v}%`;
    }
    // the national rate is the comparison a reader actually wants
    el('line', {
      x1: x(data.national), x2: x(data.national), y1: y0 - 12, y2: y0 + ih,
      stroke: C.ink, 'stroke-width': 1.25, 'stroke-dasharray': '4 3'
    }, s);
    el('text', {
      x: x(data.national), y: y0 - 17, 'text-anchor': 'middle', class: 'tick-label', fill: C.ink
    }, s).textContent = `national ${data.national}%`;

    const lowest = Math.min(...rows.map(r => r[key]));
    rows.forEach((r, i) => {
      const cy = y0 + i * rowH + rowH / 2;
      const bh = Math.min(26, rowH - 18);
      const isLowest = r[key] === lowest;
      const bar = el('rect', {
        x: x(0), y: cy - bh / 2, width: Math.max(x(r[key]) - x(0), 1), height: bh,
        fill: isLowest ? BAR_LOW : BAR, opacity: isLowest ? 1 : 0.9
      }, s);
      hover(bar, r.tip);
      el('text', {
        x: lx - 12, y: cy + (r.sub ? -1 : 4), 'text-anchor': 'end',
        class: 'cat-label', 'font-weight': 600, fill: C.ink
      }, s).textContent = r.label;
      if (r.sub) {
        el('text', {
          x: lx - 12, y: cy + 13, 'text-anchor': 'end', class: 'tick-label'
        }, s).textContent = r.sub;
      }
      el('text', { x: x(r[key]) + 8, y: cy + 4, class: 'value-label' }, s)
        .textContent = `${r[key].toFixed(1)}%`;
    });
  };

  panel(x0, 'Where the polling centre was', data.byPlace.map(r => ({
    label: r.label, v: r.turnout,
    tip: `<b>${r.label}</b><br>${pct(r.turnout)} turnout<br>${fmt(r.reg)} registered · ${fmt(r.centres)} centres`
  })), 'v');

  // Seats grouped by how close the race was. Labelling these "closest fifth"
  // and "most lopsided fifth" asks the reader to hold a statistical construct
  // in mind; the margin itself is the thing they actually understand.
  const margin = data.byMargin.map(r => ({
    label: n ? `Won by ${Math.round(r.medianMargin)} pts` : `Won by about ${Math.round(r.medianMargin)} points`,
    sub: `${r.seats} seats`,
    v: r.turnout,
    tip: `<b>${r.seats} seats</b><br>typical winning margin ${r.medianMargin} points<br>turnout ${pct(r.turnout)}`
  }));
  panel(n ? 330 : panelW, 'How close the race was', margin, 'v');
}

/* ===========================================================================
   4. THE YOUTH GRADIENT — one chart, two findings. Centres are ranked into
   fifths by how much of their roll was too young to have voted in 2008, and
   the ranking is done separately inside each kind of place. Every line falls,
   which is the age effect; the lines never touch, which is the place effect.
   =========================================================================== */
export function youthQuintiles(host, quintiles, byPlace) {
  /* Centres are ranked into fifths by how much of their roll was too young to
     have voted in 2008, and the ranking is done separately inside each kind of
     place. Every line falls, which is the age effect; the city line stays below
     the other two, which is the place effect. */
  const n = isNarrow(host);
  // the three series names sit at the right end on desktop; on a phone that
  // margin is a third of the chart, so they move to a legend row on top
  const W = n ? 380 : 900, H = n ? 400 : 470;
  const mL = n ? 34 : 62, mR = n ? 40 : 132, mT = n ? 54 : 34, mB = n ? 82 : 94;
  const s = svg(host, W, H);
  const iw = W - mL - mR, ih = H - mT - mB;
  const bandW = iw / 5;
  const cx = q => mL + (q - 1) * bandW + bandW / 2;
  const y = v => mT + ih - (v / 19) * ih;

  for (let v = 0; v <= 15; v += 5) {
    el('line', { x1: mL, x2: mL + iw, y1: y(v), y2: y(v), class: 'gridline' }, s);
    el('text', { x: mL - 10, y: y(v) + 4, 'text-anchor': 'end', class: 'tick-label' }, s)
      .textContent = v === 0 ? (n ? '0' : 'Level') : `+${v}`;
  }
  el('line', { x1: mL, x2: mL + iw, y1: y(0), y2: y(0), class: 'zeroline' }, s);
  // left-aligned in both profiles: right-aligned to the axis it is wider than
  // its own gutter and spills off the canvas
  el('text', {
    x: 2, y: n ? mT - 54 : mT - 12, class: 'tick-label', fill: C.muted
  }, s).textContent = 'BNP’s lead';

  // The measure plotted is the BNP's margin in all three lines, so they are
  // weights of one colour rather than three competing hues. Cities carry the
  // most weight because the city line is the departure from the pattern.
  const STYLE = {
    'Big cities': { colour: '#2c6b6f', width: 3.6, r: 5.4 },
    'Small towns': { colour: '#5d9ba0', width: 2.8, r: 4.4 },
    'Villages': { colour: '#8ab5b8', width: 2.8, r: 4.4 }
  };

  const pairs = byPlace;
  for (const series of byPlace) {
    const st = STYLE[series.label] || { colour: C.muted, width: 2.8, r: 4.4 };
    const pts = series.points;
    el('path', {
      d: pts.map((p, i) => `${i ? 'L' : 'M'}${cx(p.quintile)},${y(p.lead)}`).join(' '),
      fill: 'none', stroke: st.colour, 'stroke-width': st.width,
      'stroke-linejoin': 'round', 'stroke-linecap': 'round'
    }, s);

    for (const p of pts) {
      const dot = el('circle', {
        cx: cx(p.quintile), cy: y(p.lead), r: st.r,
        fill: st.colour, stroke: C.white, 'stroke-width': 1.5
      }, s);
      hover(dot, `<b>${series.label}, quintile ${p.quintile} of 5</b><br>
        BNP ${pct(p.bnp)} · Jamaat ${pct(p.jam)} — a lead of ${pct(p.lead)}<br>
        ${fmt(p.centres)} centres · ${pct(p.youngShare)} of the roll too young for 2008`);
    }

    // .value-label carries a fill in the stylesheet, which beats a presentation
    // attribute — these have to be set inline to inherit their line's colour
    const first = pts[0], last = pts[pts.length - 1];
    if (!n) {
      el('text', {
        x: cx(first.quintile) - 12, y: y(first.lead) + 4, 'text-anchor': 'end',
        class: 'value-label', style: `fill:${st.colour}`
      }, s).textContent = `+${first.lead.toFixed(1)}`;
      el('text', {
        x: mL + iw + 12, y: y(last.lead), class: 'series-label', style: `fill:${st.colour}`
      }, s).textContent = series.label;
    } else {
      // one legend row above the plot instead of labels at the line ends
      const i = pairs.indexOf(series);
      const lx = mL + i * ((iw + 30) / 3);
      el('rect', { x: lx, y: mT - 40, width: 10, height: 10, fill: st.colour }, s);
      el('text', { x: lx + 14, y: mT - 31, class: 'tick-label', fill: C.body }, s)
        .textContent = series.label;
    }
    el('text', {
      x: mL + iw + (n ? 6 : 12), y: y(last.lead) + (n ? 4 : 16),
      class: 'value-label', style: `fill:${st.colour}`
    }, s).textContent = `+${last.lead.toFixed(1)}`;
  }

  for (let q = 1; q <= 5; q += 1) {
    el('text', { x: cx(q), y: mT + ih + 24, 'text-anchor': 'middle', class: 'tick-label' }, s)
      .textContent = `Q${q}`;
    const pooled = quintiles.find(v => v.quintile === q);
    if (pooled) {
      el('text', { x: cx(q), y: mT + ih + 41, 'text-anchor': 'middle', class: 'tick-label', fill: C.muted }, s)
        .textContent = `${pooled.youngShare.toFixed(0)}% young`;
    }
  }
  el('text', { x: mL, y: mT + ih + 66, class: 'tick-label', fill: C.muted }, s)
    .textContent = '← fewest young voters';
  el('text', {
    x: mL + iw, y: mT + ih + 66, 'text-anchor': 'end', class: 'tick-label', fill: C.muted
  }, s).textContent = 'most young voters →';
  el('text', {
    x: n ? mL : mL + iw / 2, y: mT + ih + (n ? 74 : 86),
    'text-anchor': n ? 'start' : 'middle', class: 'tick-label', fill: C.muted
  }, s).textContent = n ? 'Fifths ranked within constituency and place'
    : 'Fifths ranked within each constituency, separately for each kind of place';
}

/* ===========================================================================
   5. THE WOMEN'S VOTE — slopes from men-only to women-only centres,
      plus the participation gap as a distribution.
   =========================================================================== */
export function womenRanges(host, panels) {
  /* A range chart on one shared axis. Each mark runs from a party's share at
     men-only centres (hollow) to its share at women-only centres (filled), so
     the length IS the shift and the direction IS who gained.

     Three things carry the scroll from step to step, because opacity alone is
     too quiet to read as a change: a tint band slides down to sit behind the
     active row, the row's ranges draw themselves outward from the men's dot in
     the direction of the shift, and rows already read stay at usable ink rather
     than fading away — so the reader can still compare them against the row
     they are on. Drawn once; steps only change attributes. */
  const n = isNarrow(host);
  // the row names move above their own rows, freeing the 172-unit gutter
  const W = n ? 380 : 920, H = n ? 470 : 470;
  const mL = n ? 34 : 172, mR = n ? 52 : 96, mT = n ? 48 : 52, mB = n ? 48 : 50;
  const s = svg(host, W, H);
  const iw = W - mL - mR, ih = H - mT - mB;
  const LO = 29, HI = 55;
  const x = v => mL + ((v - LO) / (HI - LO)) * iw;
  const bandH = ih / panels.length;
  const rowY = i => mT + i * bandH + bandH / 2;

  // the moving highlight: the single clearest signal that the step changed
  const bandG = el('g', { style: 'transition: transform 520ms cubic-bezier(.4,0,.2,1)' }, s);
  el('rect', {
    x: Math.max(0, mL - 158), y: -bandH / 2 + 2,
    width: n ? W : iw + 158 + 78, height: bandH - 4, fill: '#f4f0eb'
  }, bandG);

  for (let v = 30; v <= HI; v += 5) {
    el('line', { x1: x(v), x2: x(v), y1: mT - 16, y2: mT + ih + 6, class: 'gridline' }, s);
    el('text', { x: x(v), y: mT + ih + 26, 'text-anchor': 'middle', class: 'tick-label' }, s)
      .textContent = `${v}%`;
  }
  el('text', { x: x(LO), y: mT + ih + 44, class: 'tick-label', fill: C.muted }, s)
    .textContent = 'share of the valid vote';

  const EASE = 'cubic-bezier(.4,0,.2,1)';
  const rows = panels.map((p, i) => {
    const cy = rowY(i);
    const head = el('g', { style: `transition: opacity 420ms ${EASE}`, opacity: 0.36 }, s);
    const g = el('g', { style: `transition: opacity 420ms ${EASE}`, opacity: 0 }, s);

    if (n) {
      el('text', { x: mL, y: cy - 30, class: 'cat-label', 'font-weight': 600, fill: C.ink }, head)
        .textContent = p.label;
      el('text', { x: mL + iw + mR - 6, y: cy - 30, 'text-anchor': 'end', class: 'tick-label' }, head)
        .textContent = p.note || `${fmt(p.menCentres + p.womenCentres)} centres`;
    } else {
      el('text', { x: mL - 22, y: cy - 4, 'text-anchor': 'end', class: 'cat-label', 'font-weight': 600, fill: C.ink }, head)
        .textContent = p.label;
      el('text', { x: mL - 22, y: cy + 13, 'text-anchor': 'end', class: 'tick-label' }, head)
        .textContent = p.note || `${fmt(p.menCentres + p.womenCentres)} centres`;
    }

    const marks = [['Bnp', C.bnp, C.bnpInk, 'BNP', -15], ['Jam', C.jam, C.jamInk, 'Jamaat', 15]]
      .map(([key, colour, ink, name, dy]) => {
        const a = p[`men${key}`], b = p[`women${key}`], ry = cy + dy;
        const len = Math.abs(x(b) - x(a));
        const mark = el('g', {}, g);
        // drawn men -> women, so the dash reveal runs in the direction of the shift
        const line = el('line', {
          x1: x(a), x2: x(b), y1: ry, y2: ry, stroke: colour, 'stroke-width': 3.4,
          'stroke-linecap': 'round', 'stroke-dasharray': len || 0.01,
          'stroke-dashoffset': len, style: `transition: stroke-dashoffset 620ms ${EASE}, stroke-width 300ms`
        }, mark);
        el('circle', { cx: x(a), cy: ry, r: 4.8, fill: C.white, stroke: colour, 'stroke-width': 2.4 }, mark);
        // the filled dot travels from the men's position to the women's
        const travel = el('g', {
          style: `transition: transform 620ms ${EASE}`, transform: `translate(${x(a) - x(b)},0)`
        }, mark);
        const dot = el('circle', { cx: x(b), cy: ry, r: 5.6, fill: colour }, travel);
        hover(mark, `<b>${p.label} — ${name}</b><br>men-only centres ${pct(a)}<br>
          women-only centres ${pct(b)}<br>shift ${b - a > 0 ? '+' : ''}${(b - a).toFixed(1)} pts`);

        const left = Math.min(a, b), right = Math.max(a, b);
        const lo = el('text', { x: x(left) - 11, y: ry + 4, 'text-anchor': 'end', class: 'value-label', style: `fill:${ink}` }, mark);
        lo.textContent = (left === a ? a : b).toFixed(1);
        const hiT = el('text', { x: x(right) + 11, y: ry + 4, class: 'value-label', style: `fill:${ink}` }, mark);
        hiT.textContent = (right === b ? b : a).toFixed(1);
        // Which end is which, said at the end rather than in a key. Mono keeps
        // the two words the same optical weight and small enough to read as an
        // annotation on the mark rather than as another data label. Where the
        // shift is small the two dots nearly touch, so the tags swing outward
        // instead of centring and running into each other.
        const tight = Math.abs(x(b) - x(a)) < 44;
        const tag = (at, word) => {
          const leftward = x(at) <= (x(a) + x(b)) / 2;
          el('text', {
            x: tight ? x(at) + (leftward ? -8 : 8) : x(at), y: ry + 12,
            'text-anchor': tight ? (leftward ? 'end' : 'start') : 'middle',
            class: 'micro', fill: C.muted
          }, mark).textContent = word;
        };
        tag(a, 'men');
        tag(b, 'women');
        return { line, travel, dot, len };
      });

    const shift = p.jamShift;
    const shiftLabel = el('text', {
      x: n ? mL + iw + mR - 6 : W - mR + 62, y: n ? cy + 30 : cy + 4,
      'text-anchor': 'end', class: 'value-label',
      style: `fill:${shift > 0 ? C.jamInk : C.bnpInk}; transition: font-size 300ms`
    }, g);
    shiftLabel.textContent = n
      ? `${shift > 0 ? '+' : '−'}${Math.abs(shift).toFixed(1)} ${shift > 0 ? 'Jam' : 'BNP'}`
      : `${shift > 0 ? '+' : '−'}${Math.abs(shift).toFixed(1)} to ${shift > 0 ? 'Jamaat' : 'BNP'}`;
    return { head, g, marks, shiftLabel };
  });

  const show = active => () => {
    bandG.setAttribute('transform', `translate(0,${rowY(active)})`);
    rows.forEach(({ head, g, marks, shiftLabel }, i) => {
      const state = i > active ? 'ahead' : i === active ? 'now' : 'read';
      head.setAttribute('opacity', state === 'now' ? 1 : state === 'read' ? 0.62 : 0.36);
      // rows already read stay legible: the comparison is the point of one axis
      g.setAttribute('opacity', state === 'ahead' ? 0 : state === 'now' ? 1 : 0.5);
      shiftLabel.style.fontSize = state === 'now' ? '13px' : '11.5px';
      for (const m of marks) {
        m.line.setAttribute('stroke-dashoffset', state === 'ahead' ? m.len : 0);
        m.line.setAttribute('stroke-width', state === 'now' ? 4.6 : 3);
        m.travel.setAttribute('transform', state === 'ahead' ? m.travel.getAttribute('transform') : 'translate(0,0)');
        m.dot.setAttribute('r', state === 'now' ? 6.2 : 5);
      }
    });
  };
  return Object.fromEntries(panels.map((p, i) => [p.key, show(i)]));
}

export function turnoutGapPairs(host, pairs, viewKey = 'all') {
  /* One number per pair — the women's turnout minus the men's — on a single
     horizontal axis. The mass piling up left of zero IS the headline share.
     Switching to a Hindu-share band redraws the same axis and the same bins for
     that subset, with the full distribution kept behind as a grey silhouette so
     the shift is a comparison rather than a memory test. Bars are the share of
     that group's pairs, not counts, so the views are directly comparable.
     No statistic is computed here: every number printed comes from women.json. */
  const view = pairs.views.find(v => v.key === viewKey) || pairs.views[0];
  const base = pairs.views[0];
  const n = isNarrow(host);
  const W = n ? 380 : 900, H = n ? 400 : 424;
  const mL = n ? 40 : 118, mR = n ? 16 : 34;
  const s = svg(host, W, H);
  const iw = W - mL - mR;
  const { lo, hi, step, peak } = pairs.axis;
  const x = v => mL + ((v - lo) / (hi - lo)) * iw;

  const SHOUT = 44, HTOP = 96, hT = 196, HBOT = HTOP + hT;
  const y = share => HBOT - (share / peak) * hT;
  const neg = v => (v < 0 ? `−${Math.abs(v).toFixed(1)}` : v.toFixed(1));

  const LESS = '#e0457b', MORE = '#4c56a8';

  // the half-plane left of zero is a named place, not a direction to infer
  el('rect', {
    x: x(lo), y: HTOP - 14, width: x(0) - x(lo), height: hT + 14, fill: LESS, opacity: 0.05
  }, s);

  for (let v = lo; v <= hi; v += 4) {
    if (v === 0) continue;
    el('line', { x1: x(v), x2: x(v), y1: HTOP - 14, y2: HBOT, class: 'gridline' }, s);
  }
  for (let p = 5; p <= 20; p += 5) {
    el('line', { x1: x(lo), x2: x(hi), y1: y(p), y2: y(p), class: 'gridline' }, s);
    el('text', { x: x(lo) - 8, y: y(p) + 4, 'text-anchor': 'end', class: 'tick-label' }, s)
      .textContent = `${p}%`;
  }
  if (n) {
    el('text', { x: x(lo), y: HTOP - 12, class: 'tick-label', fill: C.muted }, s)
      .textContent = 'share of the group’s pairs';
  } else {
    el('text', { x: x(lo) - 8, y: HTOP - 24, 'text-anchor': 'end', class: 'tick-label', fill: C.muted }, s)
      .textContent = 'share of the';
    el('text', { x: x(lo) - 8, y: HTOP - 10, 'text-anchor': 'end', class: 'tick-label', fill: C.muted }, s)
      .textContent = 'group’s pairs';
  }

  // the full distribution, kept behind as a silhouette to compare against
  if (view.key !== 'all') {
    let d = `M${x(lo)},${y(0)}`;
    for (const b of base.hist) d += ` L${x(b.x)},${y(b.share)} L${x(b.x + step)},${y(b.share)}`;
    d += ` L${x(hi)},${y(0)}`;
    el('path', { d, fill: 'none', stroke: '#a9a29b', 'stroke-width': 1.4, 'stroke-dasharray': '4 3' }, s);
    el('text', { x: x(hi), y: HTOP - 6, 'text-anchor': 'end', class: 'tick-label', fill: '#8d8781' }, s)
      .textContent = '- - - all 3,834 pairs, for comparison';
  }

  const barW = iw / view.hist.length;
  for (const b of view.hist) {
    if (b.n === 0) continue;
    const bar = el('rect', {
      x: x(b.x) + 0.8, y: y(b.share), width: Math.max(barW - 1.6, 0.8),
      height: HBOT - y(b.share), fill: b.x < 0 ? LESS : MORE, opacity: 0.9
    }, s);
    const side = b.x < 0
      ? `${Math.abs(b.x + step)}–${Math.abs(b.x)} points fewer women`
      : `${b.x}–${b.x + step} points more women`;
    hover(bar, `<b>${fmt(b.n)} pair${b.n === 1 ? '' : 's'}</b> — ${pct(b.share)} of this group<br>${side}`);
  }

  for (let v = lo; v <= hi; v += 4) {
    el('text', { x: x(v), y: HBOT + 42, 'text-anchor': 'middle', class: 'tick-label' }, s)
      .textContent = v === 0 ? '0' : (v > 0 ? `+${v}` : `−${Math.abs(v)}`);
  }
  // the end bars are catch-alls; admit it on the face, not in the caption
  el('text', {
    x: x(lo) + barW / 2, y: HBOT + 58, 'text-anchor': 'middle', class: 'tick-label', fill: C.muted
  }, s).textContent = n ? '◂' : '◂ and beyond';
  el('text', {
    x: x(hi) - barW / 2, y: HBOT + 58, 'text-anchor': 'middle', class: 'tick-label', fill: C.muted
  }, s).textContent = n ? '▸' : 'and beyond ▸';
  el('text', { x: x(lo), y: HBOT + 82, class: 'tick-label', fill: C.muted }, s)
    .textContent = 'women’s turnout minus men’s, in percentage points';

  // zero: the only reference that matters
  el('line', { x1: x(0), x2: x(0), y1: SHOUT - 30, y2: HBOT + 6, stroke: C.ink, 'stroke-width': 1.6 }, s);
  el('text', {
    x: x(0), y: SHOUT - 38, 'text-anchor': 'middle', class: 'tick-label', 'font-weight': 600
  }, s).textContent = 'equal turnout';

  const shout = (tx, anchor, colour, big, small) => {
    el('text', {
      x: tx, y: SHOUT, 'text-anchor': anchor, class: 'series-label',
      style: `fill:${colour};font-size:15px`
    }, s).textContent = big;
    el('text', {
      x: tx, y: SHOUT + 19, 'text-anchor': anchor, class: 'tick-label', fill: C.muted
    }, s).textContent = small;
  };
  const what = view.key === 'all'
    ? `of the ${fmt(view.pairs)} pairs`
    : `of the ${fmt(view.pairs)} pairs here`;
  shout(x(0) - 14, 'end', LESS, n ? '← fewer women' : '← fewer women voted',
    n ? `${view.shareBelow}% of pairs` : `in ${view.shareBelow}% ${what}`);
  shout(x(0) + 14, 'start', MORE, n ? 'more →' : 'more women voted →',
    n ? `${100 - view.shareBelow}%` : `in ${100 - view.shareBelow}%`);

  // the average, marked on the axis it belongs to
  el('path', { d: `M${x(view.gap)},${HBOT - 1} l-5.5,-9 l11,0 z`, fill: C.ink }, s);
  el('text', {
    x: x(view.gap), y: HBOT + 17, 'text-anchor': 'middle', class: 'value-label'
  }, s).textContent = `average ${neg(view.gap)}`;

  const d = el('desc', {}, s);
  d.textContent = `Distribution of the turnout gap across ${fmt(view.pairs)} matched pairs of `
    + `single-sex polling centres (${view.label}). Women's turnout was lower in `
    + `${view.shareBelow}% of these pairs, by ${Math.abs(view.gap)} points on average. `
    + `Men's turnout ${view.menTurnout}%, women's ${view.womenTurnout}%.`;
  s.insertBefore(d, s.firstChild);
}

/* ===========================================================================
   6. THE LOCAL TIERS — stacked shares of leadership, tier by tier.
   =========================================================================== */
export function localTiers(host, tiers) {
  const n = isNarrow(host);
  // the tier name moves above its own bar rather than beside it, and the
  // right-hand annotation column goes
  const W = n ? 380 : 900, H = n ? 400 : 330;
  const mL = n ? 6 : 116, mR = n ? 6 : 128, mT = n ? 26 : 26, mB = n ? 40 : 44;
  const s = svg(host, W, H);
  const iw = W - mL - mR, ih = H - mT - mB;
  const rowH = ih / tiers.length;
  const colour = party => ({
    BNP: C.bnp, Jamaat: C.jam, Independent: C.indep, NCP: C.other,
    KM: '#a8761f', IAB: '#326891', GOP: '#8a8f92', Jamiat: '#a8761f'
  }[party] || C.neutral);

  tiers.forEach((t, i) => {
    const cy = mT + i * rowH + (n ? 22 : 8);
    const bh = Math.min(34, rowH - (n ? 40 : 22));
    let acc = 0;
    const shown = t.leaders.filter(l => l.pct >= 0.4);
    const restPct = 100 - shown.reduce((a, l) => a + l.pct, 0);
    [...shown, ...(restPct > 0.2 ? [{ party: 'Others', units: null, pct: restPct }] : [])]
      .forEach(l => {
        const w = (l.pct / 100) * iw;
        const seg = el('rect', {
          x: mL + acc, y: cy, width: Math.max(w - 0.8, 0.8), height: bh,
          fill: l.party === 'Others' ? C.neutral : colour(l.party)
        }, s);
        hover(seg, `<b>${t.tier} — ${l.party}</b><br>${l.units !== null ? `led ${fmt(l.units)} of ${fmt(t.total)}` : 'remaining units'}<br>${pct(l.pct)}`);
        if (w > (n ? 34 : 46)) {
          el('text', {
            x: mL + acc + w / 2, y: cy + bh / 2 + 4, 'text-anchor': 'middle',
            class: 'value-label', fill: l.party === 'Others' ? C.body : C.white
          }, s).textContent = `${l.pct.toFixed(0)}%`;
        }
        acc += w;
      });
    if (n) {
      // name above the bar, and the close-unit count folded into the same line
      el('text', { x: mL, y: cy - 8, class: 'cat-label', 'font-weight': 600, fill: C.ink }, s)
        .textContent = t.tier;
      el('text', { x: mL + iw, y: cy - 8, 'text-anchor': 'end', class: 'tick-label' }, s)
        .textContent = `${fmt(t.total)} units · ${fmt(t.close)} within 5 pts`;
    } else {
      el('text', { x: mL - 12, y: cy + bh / 2 + 5, 'text-anchor': 'end', class: 'cat-label', 'font-weight': 600 }, s)
        .textContent = t.tier;
      el('text', { x: mL - 12, y: cy + bh / 2 + 19, 'text-anchor': 'end', class: 'tick-label' }, s)
        .textContent = `${fmt(t.total)} units`;
      // the number that matters for the local elections to come
      el('text', { x: mL + iw + 14, y: cy + bh / 2 - 2, class: 'value-label', fill: C.ink }, s)
        .textContent = `${fmt(t.close)}`;
      el('text', { x: mL + iw + 14, y: cy + bh / 2 + 13, class: 'tick-label' }, s)
        .textContent = `within 5 pts`;
    }
  });
}

/* ===========================================================================
   7. THE LOCAL VERDICT MAP — one geometry, five tiers.

   The country is drawn once, from the finest units, and each scrollytelling
   step only recolours it. A coarser tier is produced by filling every unit
   with its PARENT's result and setting the stroke to match the fill, which
   erases the interior boundaries; a finer tier restores a hairline stroke and
   gives each unit its own result. Nothing is re-projected or re-pathed, so the
   steps cross-fade instead of redrawing.
   =========================================================================== */
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const CODE = new Int8Array(128).fill(-1);
for (let i = 0; i < B64.length; i += 1) CODE[B64.charCodeAt(i)] = i;

/* zigzag varint, 5 bits per character, high bit continues */
function readInts(str) {
  const out = [];
  let val = 0, shift = 0;
  for (let i = 0; i < str.length; i += 1) {
    const c = CODE[str.charCodeAt(i)];
    val += (c & 31) * Math.pow(2, shift);
    if (c & 32) { shift += 5; continue; }
    out.push(val & 1 ? -(val + 1) / 2 : val / 2);
    val = 0; shift = 0;
  }
  return out;
}

function decodeArcs(blob) {
  const arcs = [];
  let px = 0, py = 0;
  for (const part of blob.split('|')) {
    const n = readInts(part);
    const pts = new Int32Array(n.length);
    px += n[0]; py += n[1];
    let x = px, y = py;
    pts[0] = x; pts[1] = y;
    for (let i = 2; i < n.length; i += 2) {
      x += n[i]; y += n[i + 1];
      pts[i] = x; pts[i + 1] = y;
    }
    arcs.push(pts);
  }
  return arcs;
}

export function localMap(host, geo, meta) {
  // Bangladesh is portrait at this projection (about 0.71 wide for 1 tall), so
  // the graphic column has spare width beside the map: the key lives there
  // rather than floating over the country.
  const n = isNarrow(host);
  // the 152-unit key column is a third of a phone screen, so on narrow the map
  // takes the full width and the key sits beneath it
  const GUTTER = n ? 0 : 152, PAD = n ? 6 : 14, H = n ? 620 : 860;
  const [x0, y0, x1, y1] = geo.bbox;
  const q = geo.quant;
  // equirectangular with a cosine correction at the country's mid-latitude
  const k = Math.cos(((y0 + y1) / 2) * Math.PI / 180);
  const mapH = H - PAD * 2 - (n ? 96 : 0);
  const mapW = mapH * ((x1 - x0) * k) / (y1 - y0);
  const W = GUTTER + mapW + PAD;
  const s = svg(host, Math.round(W), H);
  const left = GUTTER + (n ? (W - GUTTER - PAD - mapW) / 2 : 0);
  const px = gx => left + (gx / q) * mapW;
  const py = gy => PAD + (n ? 70 : 0) + mapH - (gy / q) * mapH;

  const arcs = decodeArcs(geo.arcs);
  const shapes = geo.shapes.split('\n');

  const path = spec => {
    let d = '';
    for (const poly of spec.split('~')) {
      for (const ring of poly.split(';')) {
        if (!ring) continue;
        let cur = 0, started = false;
        for (const delta of readInts(ring)) {
          cur += delta;
          const rev = cur < 0;
          const arc = arcs[rev ? ~cur : cur];
          const n = arc.length;
          // consecutive arcs in a ring share an endpoint; emitting it twice
          // doubles the path string for nothing
          if (rev) {
            for (let i = n - 2 - (started ? 2 : 0); i >= 0; i -= 2) {
              d += (started ? 'L' : 'M') + px(arc[i]).toFixed(1) + ',' + py(arc[i + 1]).toFixed(1);
              started = true;
            }
          } else {
            for (let i = started ? 2 : 0; i < n; i += 2) {
              d += (started ? 'L' : 'M') + px(arc[i]).toFixed(1) + ',' + py(arc[i + 1]).toFixed(1);
              started = true;
            }
          }
        }
        if (started) d += 'Z';
      }
    }
    return d;
  };

  const U = meta.units;
  const NONE = '#d9d4cf';       // result not declared
  const WILD = '#c3d0be';       // no resident voters: forest, cantonment
  const HOLD = '#e7e2dc';       // a tier that has not been broken out yet
  const FILL = [C.bnp, C.jam, '#7d6ba7', '#7d6ba7', '#7d6ba7', '#7d6ba7', '#7d6ba7', NONE, WILD];
  const HAIR = 'rgba(255,255,255,.6)';

  const frag = document.createDocumentFragment();
  const nodes = shapes.map((spec, i) => {
    const node = el('path', { d: path(spec), 'stroke-width': 0.5 });
    node.__i = i;                       // O(1) hit-test on 5,375 nodes
    frag.append(node);
    return node;
  });
  // clip to the MAP AREA, not the whole canvas: when the map zooms it would
  // otherwise flood the gutter the key and the tally live in
  const clipId = `vmap-${Math.round(performance.now())}`;
  el('rect', {
    x: left - 2, y: PAD + (n ? 60 : 0) - 2, width: mapW + 4, height: mapH + 4
  }, el('clipPath', { id: clipId }, el('defs', {}, s)));
  const clipped = el('g', { 'clip-path': `url(#${clipId})` }, s);
  const zoomable = el('g', {
    style: 'transition: transform 1100ms cubic-bezier(.45,.02,.2,1)'
  }, clipped);
  const plate = el('g', { 'shape-rendering': 'geometricPrecision' }, zoomable);
  plate.append(frag);

  // Upazila and city outlines, drawn from the arcs the topology says separate
  // two different parents. The dissolved tiers need this: without it a block of
  // one colour has no visible internal structure, and the reader cannot see
  // that it is made of upazilas at all.
  let edge = '';
  let at = 0;
  for (const delta of readInts(geo.edges)) {
    at += delta;
    const arc = arcs[at];
    for (let i = 0; i < arc.length; i += 2) {
      edge += (i ? 'L' : 'M') + px(arc[i]).toFixed(1) + ',' + py(arc[i + 1]).toFixed(1);
    }
  }
  const borders = el('path', {
    d: edge, fill: 'none', stroke: C.white, 'stroke-width': 0.9,
    'stroke-linejoin': 'round', 'stroke-linecap': 'round', 'pointer-events': 'none',
    'vector-effect': 'non-scaling-stroke'
  }, zoomable);

  // hover reads whichever tier is showing, so the tooltip never disagrees
  let tier = 'upazila';
  const TIERS = {
    seat: { rows: meta.seats, of: U.seat, label: 'constituency' },
    upazila: { rows: meta.upazilas, of: U.uz, label: 'upazila' },
    city: { rows: meta.cities, of: U.cc, label: 'city corporation' }
  };
  const TYPE = ['union', 'municipality', 'city ward'];
  plate.addEventListener('mousemove', event => {
    const i = event.target.__i;
    if (i === undefined) return;
    const t = TIERS[tier];
    const row = t && t.of[i] >= 0 ? t.rows[t.of[i]] : null;
    if (row) {
      showTip(event, `<b>${row.name}</b><br>${row.sub} · ${fmt(row.units)} units<br>
        ${meta.parties[row.w]}${row.w < 7 ? ` by ${pct(row.mg)}` : ''}<br>
        ${fmt(row.reg)} voters${row.to ? ` · turnout ${pct(row.to)}` : ''}`);
    } else {
      const w = U.w[i];
      showTip(event, `<b>${U.n[i]}</b><br>${U.d[i]} · ${TYPE[U.t[i]]}<br>
        ${meta.parties[w]}${w < 7 ? ` by ${pct(U.mg[i])}` : ''}<br>
        ${fmt(U.tv[i])} voters${U.to[i] ? ` · turnout ${pct(U.to[i])}` : ''}`);
    }
  });
  plate.addEventListener('mouseleave', hideTip);

  /* ---- a magnifier on the capital's cities ------------------------------- */
  /* Twelve city corporations hold a tenth of the electorate and perhaps a
     hundredth of the map. At national scale the step that colours them and the
     step that breaks them into wards look almost identical, so the reader is
     asked to believe a change they cannot see. The ring marks where to look and
     the next step goes there. */
  const CAPITAL = ['Dhaka North City Corporation', 'Dhaka South City Corporation',
    'Gazipur City Corporation', 'Narayanganj City Corporation'];
  const capitalIdx = new Set(
    meta.cities.map((c, i) => (CAPITAL.includes(c.name) ? i : -1)).filter(i => i >= 0)
  );
  let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
  nodes.forEach((node, i) => {
    if (!capitalIdx.has(U.cc[i])) return;
    const b = node.getBBox();
    bx0 = Math.min(bx0, b.x); by0 = Math.min(by0, b.y);
    bx1 = Math.max(bx1, b.x + b.width); by1 = Math.max(by1, b.y + b.height);
  });
  const ringX = (bx0 + bx1) / 2, ringY = (by0 + by1) / 2;
  const ringR = Math.max(bx1 - bx0, by1 - by0) / 2 + 8;

  const ring = el('g', { opacity: 0, style: 'transition: opacity 420ms ease' }, zoomable);
  el('circle', {
    cx: ringX, cy: ringY, r: ringR, fill: 'none', stroke: C.ink,
    'stroke-width': 1.4, 'vector-effect': 'non-scaling-stroke'
  }, ring);

  // the zoom itself: fit that ring into the map area
  // `k` upstream is the projection's cosine correction; this is the zoom factor
  const zoomK = Math.min(mapW, mapH) / (ringR * 1.9);
  const zoomTo = on => {
    if (!on) { zoomable.setAttribute('transform', 'translate(0,0) scale(1)'); return; }
    const cx = left + mapW / 2, cy = PAD + (n ? 70 : 0) + mapH / 2;
    zoomable.setAttribute('transform',
      `translate(${cx - zoomK * ringX},${cy - zoomK * ringY}) scale(${zoomK})`);
  };

  /* ---- the Sundarbans, named rather than left as a hole ------------------ */
  const wildX = px(((89.42 - x0) / (x1 - x0)) * q);
  const wildY = py(((21.98 - y0) / (y1 - y0)) * q);
  // the callout points left on desktop; on a phone there is no room to its
  // left, so it swings out to the right instead
  const dir = n ? 1 : -1;
  const wild = el('g', {}, s);
  el('line', {
    x1: wildX + dir * 4, x2: wildX + dir * 52, y1: wildY, y2: wildY + 30,
    stroke: '#8d9a86', 'stroke-width': 1
  }, wild);
  el('text', {
    x: wildX + dir * 56, y: wildY + 34, 'text-anchor': n ? 'start' : 'end',
    class: 'tick-label', fill: '#6f7c68'
  }, wild).textContent = 'The Sundarbans';
  el('text', {
    x: wildX + dir * 56, y: wildY + 48, 'text-anchor': n ? 'start' : 'end',
    class: 'tick-label', fill: '#8d9a86'
  }, wild).textContent = 'no resident voters';

  /* ---- legend ----------------------------------------------------------- */
  const tally = el('text', {
    x: 0, y: n ? 30 : 62, class: 'series-label',
    style: `font-size:${n ? 26 : 34}px;letter-spacing:-.02em`, fill: C.ink
  }, s);
  const tallySub = el('text', { x: n ? 0 : 0, y: n ? 46 : 82, class: 'tick-label', fill: C.muted }, s);
  const tallySub2 = el('text', { x: 0, y: n ? 60 : 98, class: 'tick-label', fill: C.muted }, s);
  if (n) {
    tally.setAttribute('text-anchor', 'start');
    tallySub.setAttribute('x', 92); tallySub.setAttribute('y', 22);
    tallySub2.setAttribute('x', 92); tallySub2.setAttribute('y', 36);
  }

  const legend = el('g', {}, s);
  const KEYS = [['BNP', C.bnp], ['Jamaat', C.jam], ['Another party', '#7d6ba7'],
    ['Not yet broken out', HOLD], ['No result declared', NONE], ['No resident voters', WILD]];
  KEYS.forEach(([label, colour], i) => {
    // two columns beneath the map on a phone, one column beside it otherwise
    const lx = n ? (i % 2) * 186 : 0;
    const ly = n ? H - 76 + Math.floor(i / 2) * 20 : 168 + i * 22;
    el('rect', { x: lx, y: ly - 10, width: 12, height: 12, fill: colour }, legend);
    el('text', { x: lx + 19, y: ly, class: 'tick-label', fill: C.body }, legend).textContent = label;
  });

  /* ---- the five tiers --------------------------------------------------- */
  const paint = (fillOf, hair) => {
    for (let i = 0; i < nodes.length; i += 1) {
      const f = fillOf(i);
      nodes[i].setAttribute('fill', f);
      nodes[i].setAttribute('stroke', hair(i) ? HAIR : f);
    }
  };
  const own = i => FILL[U.w[i]];
  // A forest with no voters does not acquire a verdict by being inside an
  // upazila that has one. Units with no result of their own keep their own
  // colour at every tier, so the Sundarbans never gets painted as if it voted.
  const blank = i => U.w[i] >= 7;

  const setTally = (n, what, more) => {
    tally.textContent = fmt(n);
    tallySub.textContent = what;
    tallySub2.textContent = more || '';
  };

  const showBorders = width => borders.setAttribute('stroke-width', width);
  const setRing = on => ring.setAttribute('opacity', on ? 1 : 0);

  return {
    upazila: () => {
      tier = 'upazila';
      paint(i => (blank(i) ? own(i) : U.uz[i] >= 0 ? FILL[meta.upazilas[U.uz[i]].w] : HOLD), () => false);
      showBorders(1.1); setRing(false); zoomTo(false); wild.setAttribute('opacity', 1);
      setTally(meta.counts.upazilas, 'upazilas', 'cities held back');
    },
    city: () => {
      tier = 'city';
      paint(i => (blank(i) ? own(i) : U.cc[i] >= 0 ? FILL[meta.cities[U.cc[i]].w]
        : U.uz[i] >= 0 ? FILL[meta.upazilas[U.uz[i]].w] : own(i)), () => false);
      showBorders(1.1); setRing(true); zoomTo(false); wild.setAttribute('opacity', 1);
      setTally(meta.counts.cities, 'city corporations', 'now shown separately');
    },
    urban: () => {
      tier = null;
      paint(i => (!blank(i) && U.t[i] === 0 && U.uz[i] >= 0
        ? FILL[meta.upazilas[U.uz[i]].w] : own(i)), i => U.t[i] !== 0);
      showBorders(1.1); setRing(false); zoomTo(false); wild.setAttribute('opacity', 1);
      setTally(meta.counts.wards + meta.counts.municipalities, 'city wards and', 'municipalities');
    },
    // inside the ring: cities as whole units, close enough to be a place
    capital: () => {
      tier = 'city';
      paint(i => (blank(i) ? own(i) : U.cc[i] >= 0 ? FILL[meta.cities[U.cc[i]].w]
        : U.uz[i] >= 0 ? FILL[meta.upazilas[U.uz[i]].w] : own(i)), () => false);
      showBorders(1.1); setRing(true); zoomTo(true); wild.setAttribute('opacity', 0);
      setTally(4, 'cities around', 'the capital');
    },
    // the same frame, broken into wards: the change is now unmissable
    wards: () => {
      tier = null;
      paint(i => (!blank(i) && U.t[i] === 0 && U.uz[i] >= 0
        ? FILL[meta.upazilas[U.uz[i]].w] : own(i)), i => U.t[i] !== 0);
      showBorders(1.1); setRing(true); zoomTo(true); wild.setAttribute('opacity', 0);
      setTally(meta.counts.wards, 'city wards', 'across the twelve cities');
    },
    union: () => {
      tier = null;
      paint(own, () => true);
      // the units carry their own hairlines now, so the upazila skeleton only
      // needs to stay legible over the top of them
      showBorders(0.8); setRing(false); zoomTo(false); wild.setAttribute('opacity', 1);
      setTally(meta.counts.verdicts, 'local verdicts', 'in one election');
    }
  };
}

/* ===========================================================================
   8. WHOSE VOTE — the same measure across five kinds of centre.

   The piece's argument turns on a sentence saying these electorates did not
   move together, while every graphic before it shows only the Hindu half. One
   stacked row per kind of centre makes the divergence structural rather than
   asserted: the share sitting outside both major parties runs from 18 per cent
   nationally to 83 in Chakma-majority centres, and the BNP's own share falls
   from 69 to 14 between the two kinds of place a single word would have
   lumped together.
   =========================================================================== */
export function minorityRows(host, data) {
  const n = isNarrow(host);
  const W = n ? 380 : 900, H = n ? 460 : 380;
  const mL = n ? 8 : 250, mR = n ? 8 : 34, mT = n ? 34 : 40, mB = n ? 34 : 46;
  const s = svg(host, W, H);
  const iw = W - mL - mR, ih = H - mT - mB;
  const rowH = ih / data.rows.length;
  const OTHER = '#7b5ea7';

  for (let v = 0; v <= 100; v += 25) {
    const gx = mL + (v / 100) * iw;
    el('line', { x1: gx, x2: gx, y1: mT - 8, y2: mT + ih, class: 'gridline' }, s);
    el('text', { x: gx, y: mT + ih + 20, 'text-anchor': 'middle', class: 'tick-label' }, s)
      .textContent = `${v}%`;
  }

  data.rows.forEach((r, i) => {
    const top = mT + i * rowH + (n ? 26 : 0);
    const bh = Math.min(30, rowH - (n ? 44 : 26));
    const cy = top + bh / 2;
    let acc = 0;
    [['bnp', C.bnp, 'BNP'], ['jam', C.jam, 'Jamaat'], ['oth', OTHER, 'Everyone else']]
      .forEach(([key, colour, name]) => {
        const w = (r[key] / 100) * iw;
        const seg = el('rect', { x: mL + acc, y: top, width: Math.max(w, 0.6), height: bh, fill: colour }, s);
        hover(seg, `<b>${r.label} — ${name}</b><br>${pct(r[key])} of the valid vote<br>
          ${fmt(r.centres)} centres · ${fmt(r.reg)} registered`);
        if (w > 44) {
          el('text', {
            x: mL + acc + w / 2, y: cy + 4, 'text-anchor': 'middle',
            class: 'value-label', fill: C.white
          }, s).textContent = r[key].toFixed(1);
        }
        acc += w;
      });

    if (n) {
      el('text', { x: mL, y: top - 14, class: 'cat-label', 'font-weight': 600, fill: C.ink }, s)
        .textContent = r.label;
      el('text', { x: mL + iw, y: top - 14, 'text-anchor': 'end', class: 'tick-label' }, s)
        .textContent = `${fmt(r.centres)} centres`;
    } else {
      el('text', { x: mL - 14, y: cy - 2, 'text-anchor': 'end', class: 'cat-label', 'font-weight': 600, fill: C.ink }, s)
        .textContent = r.label;
      el('text', { x: mL - 14, y: cy + 13, 'text-anchor': 'end', class: 'tick-label' }, s)
        .textContent = `${r.sub} · ${fmt(r.centres)} centres`;
    }
  });

  el('text', { x: mL, y: mT - (n ? 22 : 20), class: 'tick-label', fill: C.muted }, s)
    .textContent = 'Share of the valid vote →';
}
