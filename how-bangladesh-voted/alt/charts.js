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

const fmt = n => n.toLocaleString('en-US');
const pct = (n, d = 1) => `${n.toFixed(d)}%`;

/* ------------------------------------------------------------------ tooltip */
let tipEl;
export function hover(node, html) {
  if (!tipEl) {
    tipEl = document.createElement('div');
    tipEl.className = 'tip';
    document.body.appendChild(tipEl);
  }
  node.classList.add('hoverable');
  const show = event => {
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
  };
  node.addEventListener('mouseenter', show);
  node.addEventListener('mousemove', show);
  node.addEventListener('mouseleave', () => { tipEl.style.opacity = '0'; });
}

/* ===========================================================================
   1. KHULNA-5 — the scrollytelling map.
   One seat, 18 unions, drawn in equirectangular projection scaled to fit.
   Views: who led · Hindu share · the running total that decides the seat.
   =========================================================================== */
export function khulna5Map(host, shapes, data) {
  const W = 1000, H = 620;
  const s = svg(host, W, H);
  const byUnion = new Map(data.unions.map(u => [u.union, u]));

  // fit the projection to the drawn box, leaving room for the waterfall panel
  const mapW = 600, pad = 26;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const f of shapes) for (const poly of f.polys) for (const ring of poly) {
    for (const [x, y] of ring) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  const midLat = (minY + maxY) / 2;
  const kx = Math.cos(midLat * Math.PI / 180);
  const spanX = (maxX - minX) * kx, spanY = maxY - minY;
  const scale = Math.min((mapW - pad * 2) / spanX, (H - pad * 2) / spanY);
  const ox = pad + ((mapW - pad * 2) - spanX * scale) / 2;
  const oy = pad + ((H - pad * 2) - spanY * scale) / 2;
  const px = x => ox + (x - minX) * kx * scale;
  const py = y => oy + (maxY - y) * scale;

  const pathFor = f => f.polys.map(poly => poly.map(ring =>
    ring.map(([x, y], i) => `${i ? 'L' : 'M'}${px(x).toFixed(1)},${py(y).toFixed(1)}`).join('') + 'Z'
  ).join('')).join('');

  // map and labels ride together: the pair slides left only when the
  // waterfall panel needs the right half of the frame
  const wrap = el('g', {}, s);
  wrap.style.transition = 'transform 700ms cubic-bezier(.4,0,.2,1)';
  const mapG = el('g', {}, wrap);
  const paths = new Map();
  for (const f of shapes) {
    const u = byUnion.get(f.union);
    const p = el('path', { d: pathFor(f), stroke: C.white, 'stroke-width': 1.1, fill: C.neutral }, mapG);
    paths.set(f.union, p);
    if (u) {
      hover(p, `<b>${u.union}</b><br>${fmt(u.reg)} registered · ${pct(u.turnout)} turnout<br>
        BNP ${pct(u.bnpPct)} · Jamaat ${pct(u.jamPct)}<br>
        ${u.hindu.toFixed(0)}% inferred Hindu`);
    }
  }

  // centroid labels for the five that decide the seat
  const labelG = el('g', {}, wrap);
  const centroid = f => {
    let sx = 0, sy = 0, n = 0;
    for (const ring of f.polys[0]) for (const [x, y] of ring) { sx += px(x); sy += py(y); n++; }
    return [sx / n, sy / n];
  };
  const labels = new Map();
  for (const f of shapes) {
    const [cx, cy] = centroid(f);
    const t = el('text', {
      x: cx, y: cy, 'text-anchor': 'middle', class: 'series-label',
      fill: C.ink, opacity: 0, 'paint-order': 'stroke',
      stroke: C.white, 'stroke-width': 3.5, 'stroke-linejoin': 'round'
    }, labelG);
    t.textContent = f.union;
    labels.set(f.union, t);
  }

  /* --- the waterfall panel: unions ordered by margin, running total --- */
  const panelX = mapW + 40, panelW = W - panelX - 30;
  const panel = el('g', { opacity: 0 }, s);
  const wf = data.waterfall;
  const maxAbs = Math.max(...wf.map(d => Math.abs(d.cum)), 30000);
  const rowH = (H - 90) / wf.length;
  const zeroX = panelX + panelW * 0.42;
  const wScale = v => (v / maxAbs) * (panelW * 0.5);

  el('text', { x: panelX, y: 24, class: 'series-label', fill: C.ink }, panel)
    .textContent = 'Running margin, best BNP union first';
  el('line', { x1: zeroX, x2: zeroX, y1: 36, y2: H - 42, class: 'zeroline' }, panel);

  wf.forEach((d, i) => {
    const y = 46 + i * rowH;
    const x0 = Math.min(zeroX, zeroX + wScale(d.cum));
    const w = Math.abs(wScale(d.cum));
    const bar = el('rect', {
      x: x0, y, width: Math.max(w, 1), height: rowH - 3,
      fill: d.cum > 0 ? C.bnp : C.jam,
      opacity: d.decisive ? 1 : 0.42
    }, panel);
    hover(bar, `<b>after ${d.union}</b><br>this union ${d.margin > 0 ? '+' : ''}${fmt(d.margin)}<br>
      running total ${d.cum > 0 ? '+' : ''}${fmt(d.cum)}`);
    const labelRight = d.cum > 0;
    const lab = el('text', {
      x: labelRight ? x0 + w + 6 : x0 - 6, y: y + rowH / 2 + 1,
      'text-anchor': labelRight ? 'start' : 'end',
      class: 'tick-label', fill: d.decisive ? C.ink : C.muted,
      'font-weight': d.decisive ? 600 : 400, 'dominant-baseline': 'middle'
    }, panel);
    lab.textContent = d.union;
  });

  // the two moments that carry the argument
  const annotate = (index, text, colour) => {
    const y = 46 + index * rowH + rowH / 2;
    const d = wf[index];
    const tipX = zeroX + wScale(d.cum);
    el('line', {
      x1: tipX, x2: zeroX + wScale(-24000), y1: y, y2: y,
      stroke: colour, 'stroke-width': 1, 'stroke-dasharray': '3 2', opacity: 0.7
    }, panel);
    el('text', {
      x: zeroX + wScale(-24000) - 4, y: y - 4, 'text-anchor': 'end',
      class: 'value-label', fill: colour
    }, panel).textContent = text;
  };
  const lastOther = wf.map(d => d.decisive).lastIndexOf(false);
  annotate(lastOther, `Jamaat ahead by ${fmt(Math.abs(wf[lastOther].cum))}`, C.jamInk);
  const crossing = wf.findIndex(d => d.cum > 0);
  if (crossing > -1) annotate(crossing, 'BNP moves ahead', C.bnpInk);

  el('text', {
    x: zeroX, y: H - 22, 'text-anchor': 'middle', class: 'value-label', fill: C.bnpInk
  }, panel).textContent = `BNP wins the seat by ${fmt(data.seat.margin)}`;

  // The projection is already fitted to the frame height, so the spare room in
  // the centred views is horizontal only: slide, never scale, or the map
  // overflows top and bottom.
  const setFrame = centred => {
    wrap.setAttribute('transform', `translate(${centred ? (W - mapW) / 2 : 0},0)`);
  };

  /* --- colour scales --- */
  const hinduScale = v => {
    // Violet, deliberately: composition is not a party, and shading it in
    // either party's hue would let the reader infer a vote from a demographic.
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
    const cap = 9500, t = Math.min(Math.abs(m) / cap, 1);
    const mix = (a, b) => a.map((c, i) => Math.round(c + t * (b[i] - c)));
    const base = [235, 235, 235];
    return `rgb(${(m > 0 ? mix(base, [43, 99, 103]) : mix(base, [185, 89, 10])).join(',')})`;
  };

  const views = {
    lead(dur = 600) {
      for (const [name, p] of paths) {
        const u = byUnion.get(name);
        p.style.transition = `fill ${dur}ms ease`;
        p.setAttribute('fill', !u ? C.neutral : u.margin > 0 ? C.bnp : C.jam);
      }
      labels.forEach(t => t.setAttribute('opacity', 0));
      panel.setAttribute('opacity', 0);
      setFrame(true);
    },
    margin(dur = 600) {
      for (const [name, p] of paths) {
        const u = byUnion.get(name);
        p.style.transition = `fill ${dur}ms ease`;
        p.setAttribute('fill', u ? marginScale(u.margin) : C.neutral);
      }
      labels.forEach(t => t.setAttribute('opacity', 0));
      panel.setAttribute('opacity', 0);
      setFrame(true);
    },
    hindu(dur = 600) {
      for (const [name, p] of paths) {
        const u = byUnion.get(name);
        p.style.transition = `fill ${dur}ms ease`;
        p.setAttribute('fill', u ? hinduScale(u.hindu) : C.neutral);
      }
      labels.forEach((t, name) => {
        const u = byUnion.get(name);
        t.setAttribute('opacity', u && u.hindu > 50 ? 1 : 0);
        t.setAttribute('fill', C.ink);
      });
      panel.setAttribute('opacity', 0);
      setFrame(true);
    },
    decisive(dur = 600) {
      for (const [name, p] of paths) {
        const u = byUnion.get(name);
        p.style.transition = `fill ${dur}ms ease`;
        if (!u) { p.setAttribute('fill', C.neutral); continue; }
        p.setAttribute('fill', u.hindu > 50 ? C.bnp : u.margin > 0 ? C.bnpWash : C.jamWash);
      }
      labels.forEach((t, name) => {
        const u = byUnion.get(name);
        t.setAttribute('opacity', u && u.hindu > 50 ? 1 : 0);
        t.setAttribute('fill', C.white);
      });
      panel.setAttribute('opacity', 1);
      setFrame(false);
    }
  };
  setFrame(true);
  views.lead(0);
  return views;
}

/* ===========================================================================
   2. THE RELIGION GRADIENT — a slope of party share across Hindu-share bands.
   =========================================================================== */
export function religionGradient(host, bins) {
  const W = 900, H = 420, mL = 58, mR = 130, mT = 22, mB = 52;
  const s = svg(host, W, H);
  const iw = W - mL - mR, ih = H - mT - mB;
  const x = i => mL + (i + 0.5) * (iw / bins.length);
  const y = v => mT + ih - (v / 80) * ih;

  for (let v = 0; v <= 80; v += 20) {
    el('line', { x1: mL, x2: mL + iw, y1: y(v), y2: y(v), class: 'gridline' }, s);
    el('text', { x: mL - 10, y: y(v) + 4, 'text-anchor': 'end', class: 'tick-label' }, s)
      .textContent = `${v}%`;
  }

  const line = (key, colour) => {
    const d = bins.map((b, i) => `${i ? 'L' : 'M'}${x(i)},${y(b[key])}`).join('');
    el('path', { d, fill: 'none', stroke: colour, 'stroke-width': 3, 'stroke-linejoin': 'round' }, s);
    bins.forEach((b, i) => {
      const dot = el('circle', { cx: x(i), cy: y(b[key]), r: 5, fill: colour, stroke: C.white, 'stroke-width': 1.6 }, s);
      hover(dot, `<b>${b.band} Hindu</b><br>${fmt(b.centres)} centres · ${fmt(b.reg)} registered<br>
        BNP ${pct(b.bnp)} · Jamaat ${pct(b.jam)}<br>turnout ${pct(b.turnout)}`);
    });
    const last = bins[bins.length - 1];
    el('text', {
      x: mL + iw + 12, y: y(last[key]) + 4, class: 'series-label', fill: colour
    }, s).textContent = `${key === 'bnp' ? 'BNP' : 'Jamaat'} ${pct(last[key], 0)}`;
  };
  line('jam', C.jam);
  line('bnp', C.bnp);

  bins.forEach((b, i) => {
    el('text', { x: x(i), y: H - mB + 20, 'text-anchor': 'middle', class: 'tick-label' }, s)
      .textContent = b.band;
  });
  el('text', {
    x: mL + iw / 2, y: H - 8, 'text-anchor': 'middle', class: 'tick-label', fill: C.muted
  }, s).textContent = 'Estimated Hindu share of the polling centre’s electorate →';
}

/* ===========================================================================
   3. TURNOUT BY PLACE — three bars, the plainest chart in the piece.
   =========================================================================== */
export function turnoutByPlace(host, rows, national) {
  const W = 760, H = 260, mL = 108, mR = 90, mT = 16, mB = 42;
  const s = svg(host, W, H);
  const iw = W - mL - mR, ih = H - mT - mB;
  const x = v => mL + (v / 70) * iw;
  const rowH = ih / rows.length;

  for (let v = 0; v <= 70; v += 10) {
    el('line', { x1: x(v), x2: x(v), y1: mT, y2: mT + ih, class: 'gridline' }, s);
    el('text', { x: x(v), y: H - mB + 18, 'text-anchor': 'middle', class: 'tick-label' }, s)
      .textContent = `${v}%`;
  }
  // the national line is the comparison the reader actually wants
  el('line', {
    x1: x(national), x2: x(national), y1: mT - 4, y2: mT + ih,
    stroke: C.ink, 'stroke-width': 1.25, 'stroke-dasharray': '4 3'
  }, s);
  el('text', { x: x(national), y: mT - 8, 'text-anchor': 'middle', class: 'tick-label', fill: C.ink }, s)
    .textContent = `national ${pct(national)}`;

  rows.forEach((r, i) => {
    const cy = mT + i * rowH + rowH / 2;
    const bh = Math.min(30, rowH - 16);
    const bar = el('rect', {
      x: mL, y: cy - bh / 2, width: Math.max(x(r.turnout) - mL, 1), height: bh,
      fill: i === 2 ? C.jam : C.bnp, opacity: i === 2 ? 1 : 0.9
    }, s);
    hover(bar, `<b>${r.label}</b><br>${pct(r.turnout)} turnout<br>${fmt(r.reg)} registered · ${fmt(r.centres)} centres`);
    el('text', { x: mL - 12, y: cy + 4, 'text-anchor': 'end', class: 'cat-label', 'font-weight': 600 }, s)
      .textContent = r.label;
    el('text', { x: x(r.turnout) + 8, y: cy + 4, class: 'value-label' }, s)
      .textContent = pct(r.turnout);
  });
}

/* ===========================================================================
   4. THE YOUTH QUINTILES — grouped bars, within-constituency ranking.
   =========================================================================== */
export function youthQuintiles(host, quintiles) {
  const W = 900, H = 400, mL = 58, mR = 116, mT = 26, mB = 78;
  const s = svg(host, W, H);
  const iw = W - mL - mR, ih = H - mT - mB;
  const bandW = iw / quintiles.length;
  const y = v => mT + ih - (v / 60) * ih;

  for (let v = 0; v <= 60; v += 15) {
    el('line', { x1: mL, x2: mL + iw, y1: y(v), y2: y(v), class: 'gridline' }, s);
    el('text', { x: mL - 10, y: y(v) + 4, 'text-anchor': 'end', class: 'tick-label' }, s)
      .textContent = `${v}%`;
  }

  quintiles.forEach((q, i) => {
    const bx = mL + i * bandW;
    const bw = (bandW - 18) / 2;
    [['bnp', C.bnp, 'BNP'], ['jam', C.jam, 'Jamaat']].forEach(([key, colour, name], k) => {
      const bar = el('rect', {
        x: bx + 9 + k * bw, y: y(q[key]), width: bw - 3, height: mT + ih - y(q[key]), fill: colour
      }, s);
      hover(bar, `<b>Quintile ${q.quintile} — ${name}</b><br>${pct(q[key])} of the valid vote<br>
        ${fmt(q.centres)} centres · ${pct(q.youngShare)} of the roll too young for 2008<br>turnout ${pct(q.turnout)}`);
      el('text', {
        x: bx + 9 + k * bw + (bw - 3) / 2, y: y(q[key]) - 7, 'text-anchor': 'middle', class: 'value-label'
      }, s).textContent = q[key].toFixed(1);
    });
    el('text', { x: bx + bandW / 2, y: H - mB + 20, 'text-anchor': 'middle', class: 'tick-label' }, s)
      .textContent = `Q${q.quintile}`;
    // the gap is the story: it narrows monotonically as the electorate gets younger
    el('text', {
      x: bx + bandW / 2, y: H - mB + 42, 'text-anchor': 'middle',
      class: 'value-label', fill: C.bnpInk
    }, s).textContent = `+${q.lead.toFixed(1)}`;
  });

  el('text', { x: mL + iw + 12, y: H - mB + 42, class: 'tick-label', fill: C.bnpInk }, s)
    .textContent = 'BNP lead';
  el('text', { x: mL, y: H - 14, class: 'tick-label', fill: C.muted }, s)
    .textContent = '← fewest young voters';
  el('text', { x: mL + iw, y: H - 14, 'text-anchor': 'end', class: 'tick-label', fill: C.muted }, s)
    .textContent = 'most young voters →';
}

/* ===========================================================================
   5. THE WOMEN'S VOTE — slopes from men-only to women-only centres,
      plus the participation gap as a distribution.
   =========================================================================== */
export function womenSlopes(host, byPlace) {
  const W = 860, H = 400, mT = 34, mB = 52;
  const s = svg(host, W, H);
  const panelW = W / byPlace.length;
  const ih = H - mT - mB;
  const all = byPlace.flatMap(p => [p.menJam, p.womenJam, p.menBnp, p.womenBnp]);
  const lo = Math.floor(Math.min(...all) / 5) * 5 - 2;
  const hi = Math.ceil(Math.max(...all) / 5) * 5 + 2;
  const y = v => mT + ih - ((v - lo) / (hi - lo)) * ih;

  byPlace.forEach((p, i) => {
    const x0 = i * panelW + 66, x1 = (i + 1) * panelW - 62;
    if (i) el('line', { x1: i * panelW, x2: i * panelW, y1: mT - 14, y2: mT + ih, stroke: C.grid }, s);
    el('text', {
      x: (x0 + x1) / 2, y: mT - 16, 'text-anchor': 'middle', class: 'series-label', fill: C.ink
    }, s).textContent = p.label;

    [['Jam', C.jam, C.jamInk, 'Jamaat'], ['Bnp', C.bnp, C.bnpInk, 'BNP']].forEach(([key, colour, ink, name]) => {
      const a = p[`men${key}`], b = p[`women${key}`];
      const g = el('g', {}, s);
      el('line', { x1: x0, x2: x1, y1: y(a), y2: y(b), stroke: colour, 'stroke-width': 3 }, g);
      el('circle', { cx: x0, cy: y(a), r: 5, fill: colour, stroke: C.white, 'stroke-width': 1.6 }, g);
      el('circle', { cx: x1, cy: y(b), r: 5, fill: colour, stroke: C.white, 'stroke-width': 1.6 }, g);
      el('text', { x: x0 - 9, y: y(a) + 4, 'text-anchor': 'end', class: 'value-label', fill: ink }, g)
        .textContent = a.toFixed(1);
      el('text', { x: x1 + 9, y: y(b) + 4, class: 'value-label', fill: ink }, g)
        .textContent = b.toFixed(1);
      hover(g, `<b>${p.label} — ${name}</b><br>men-only centres ${pct(a)}<br>women-only centres ${pct(b)}<br>
        shift ${(b - a) > 0 ? '+' : ''}${(b - a).toFixed(1)} pts`);
    });
    el('text', { x: x0, y: mT + ih + 20, 'text-anchor': 'middle', class: 'tick-label' }, s).textContent = 'men';
    el('text', { x: x1, y: mT + ih + 20, 'text-anchor': 'middle', class: 'tick-label' }, s).textContent = 'women';
    const shift = p.jamShift;
    el('text', {
      x: (x0 + x1) / 2, y: mT + ih + 40, 'text-anchor': 'middle',
      class: 'value-label', fill: shift > 0 ? C.jamInk : C.bnpInk
    }, s).textContent = `${Math.abs(shift).toFixed(1)} pts to ${shift > 0 ? 'Jamaat' : 'BNP'}`;
  });
}

export function turnoutGapPairs(host, pairs) {
  const W = 860, H = 360, mL = 54, mR = 150, mT = 24, mB = 46;
  const s = svg(host, W, H);
  const iw = W - mL - mR, ih = H - mT - mB;
  const x0 = mL + iw * 0.24, x1 = mL + iw * 0.76;
  const y = v => mT + ih - (v / 100) * ih;

  for (let v = 0; v <= 100; v += 25) {
    el('line', { x1: mL, x2: mL + iw, y1: y(v), y2: y(v), class: 'gridline' }, s);
    el('text', { x: mL - 10, y: y(v) + 4, 'text-anchor': 'end', class: 'tick-label' }, s)
      .textContent = `${v}%`;
  }
  // every line is one real pair of centres serving the same houses
  const g = el('g', { opacity: 0.16 }, s);
  for (const p of pairs.sample) {
    el('line', {
      x1: x0, x2: x1, y1: y(p.m), y2: y(p.f),
      stroke: p.f < p.m ? C.jamInk : C.bnp, 'stroke-width': 0.7
    }, g);
  }
  const meanM = pairs.sample.reduce((a, p) => a + p.m, 0) / pairs.sample.length;
  const meanF = pairs.sample.reduce((a, p) => a + p.f, 0) / pairs.sample.length;
  el('line', { x1: x0, x2: x1, y1: y(meanM), y2: y(meanF), stroke: C.ink, 'stroke-width': 3 }, s);
  el('circle', { cx: x0, cy: y(meanM), r: 6, fill: C.ink }, s);
  el('circle', { cx: x1, cy: y(meanF), r: 6, fill: C.ink }, s);
  el('text', { x: x0, y: mT + ih + 22, 'text-anchor': 'middle', class: 'tick-label', 'font-weight': 600 }, s)
    .textContent = 'men’s centre';
  el('text', { x: x1, y: mT + ih + 22, 'text-anchor': 'middle', class: 'tick-label', 'font-weight': 600 }, s)
    .textContent = 'women’s centre';

  const bx = mL + iw + 24;
  el('text', { x: bx, y: mT + 6, class: 'series-label', fill: C.ink }, s)
    .textContent = 'Gap by Hindu share';
  pairs.byHindu.forEach((b, i) => {
    const cy = mT + 30 + i * 42;
    const w = (Math.abs(b.gap) / 11) * 92;
    const bar = el('rect', { x: bx, y: cy, width: Math.max(w, 1), height: 15, fill: C.jamInk, opacity: 0.85 }, s);
    hover(bar, `<b>${b.band} Hindu</b><br>${fmt(b.pairs)} pairs<br>women’s turnout ${b.gap.toFixed(1)} pts lower`);
    el('text', { x: bx, y: cy - 4, class: 'tick-label' }, s).textContent = b.band;
    el('text', { x: bx + w + 6, y: cy + 12, class: 'value-label' }, s).textContent = b.gap.toFixed(1);
  });
}

/* ===========================================================================
   6. THE LOCAL TIERS — stacked shares of leadership, tier by tier.
   =========================================================================== */
export function localTiers(host, tiers) {
  const W = 900, H = 330, mL = 116, mR = 128, mT = 26, mB = 44;
  const s = svg(host, W, H);
  const iw = W - mL - mR, ih = H - mT - mB;
  const rowH = ih / tiers.length;
  const colour = party => ({
    BNP: C.bnp, Jamaat: C.jam, Independent: C.indep, NCP: C.other,
    KM: '#a8761f', IAB: '#326891', GOP: '#8a8f92', Jamiat: '#a8761f'
  }[party] || C.neutral);

  tiers.forEach((t, i) => {
    const cy = mT + i * rowH + 8;
    const bh = Math.min(34, rowH - 22);
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
        if (w > 46) {
          el('text', {
            x: mL + acc + w / 2, y: cy + bh / 2 + 4, 'text-anchor': 'middle',
            class: 'value-label', fill: l.party === 'Others' ? C.body : C.white
          }, s).textContent = `${l.pct.toFixed(0)}%`;
        }
        acc += w;
      });
    el('text', { x: mL - 12, y: cy + bh / 2 + 5, 'text-anchor': 'end', class: 'cat-label', 'font-weight': 600 }, s)
      .textContent = t.tier;
    el('text', { x: mL - 12, y: cy + bh / 2 + 19, 'text-anchor': 'end', class: 'tick-label' }, s)
      .textContent = `${fmt(t.total)} units`;
    // the number that matters for the local elections to come
    el('text', { x: mL + iw + 14, y: cy + bh / 2 - 2, class: 'value-label', fill: C.ink }, s)
      .textContent = `${fmt(t.close)}`;
    el('text', { x: mL + iw + 14, y: cy + bh / 2 + 13, class: 'tick-label' }, s)
      .textContent = `within 5 pts`;
  });
}
