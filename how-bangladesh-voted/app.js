(() => {
  "use strict";

  const d3ref = window.d3;
  const topojsonRef = window.topojson;
  const tooltip = document.getElementById("chart-tooltip");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const number = new Intl.NumberFormat("en-US");
  const oneDecimal = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

  const state = {
    national: null,
    units: null,
    unitResults: {},
    khulnaRows: [],
    khulnaStep: 0,
    womenStep: 0,
  };

  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const colors = {
    bnp: css("--bnp"),
    bnpDark: css("--bnp-dark"),
    bnpPale: css("--bnp-pale"),
    jamaat: css("--jamaat"),
    jamaatDark: css("--jamaat-dark"),
    jamaatPale: css("--jamaat-pale"),
    other: css("--other"),
    otherDark: css("--other-dark"),
    ink: css("--ink"),
    body: css("--body"),
    muted: css("--muted"),
    line: css("--line"),
    grid: css("--grid"),
    wash: css("--wash"),
    male: css("--male"),
    female: css("--female"),
  };

  const partyColor = (party) => {
    const p = String(party || "").toLowerCase();
    if (p.includes("bnp")) return colors.bnp;
    if (p.includes("jamaat")) return colors.jamaat;
    return colors.other;
  };

  const unitResult = (feature) => {
    const properties = feature?.properties || {};
    return state.unitResults[properties.k] || {
      w: null,
      mg: null,
      to: null,
    };
  };

  const mountWidth = (selector, fallback = 900) => {
    const node = typeof selector === "string" ? document.querySelector(selector) : selector;
    return Math.max(320, Math.round(node?.getBoundingClientRect().width || fallback));
  };

  const clearMount = (selector) => {
    const node = typeof selector === "string" ? document.querySelector(selector) : selector;
    if (node) node.replaceChildren();
    return node;
  };

  const showTooltip = (event, html) => {
    if (!tooltip) return;
    tooltip.innerHTML = html;
    tooltip.classList.add("is-visible");
    moveTooltip(event);
  };

  const moveTooltip = (event) => {
    if (!tooltip || !tooltip.classList.contains("is-visible")) return;
    const gap = 14;
    const box = tooltip.getBoundingClientRect();
    let left = event.clientX + gap;
    let top = event.clientY + gap;
    if (left + box.width > window.innerWidth - 8) left = event.clientX - box.width - gap;
    if (top + box.height > window.innerHeight - 8) top = event.clientY - box.height - gap;
    tooltip.style.left = `${Math.max(8, left)}px`;
    tooltip.style.top = `${Math.max(8, top)}px`;
  };

  const hideTooltip = () => tooltip?.classList.remove("is-visible");

  const addLoading = () => {
    document.querySelectorAll(".graphic-mount").forEach((node) => {
      if (!node.children.length) node.innerHTML = '<div class="loading-note">Loading the result map…</div>';
    });
  };

  const addError = (message) => {
    document.querySelectorAll(".graphic-mount").forEach((node) => {
      if (node.querySelector(".loading-note")) {
        node.innerHTML = `<div class="error-note">${message}</div>`;
      }
    });
  };

  function renderMinorityChart() {
    if (!d3ref) return;
    const node = clearMount("#minority-chart");
    if (!node) return;
    const width = mountWidth(node);
    const mobile = width < 620;
    const height = mobile ? 290 : 310;
    const margin = { top: 16, right: 22, bottom: 34, left: mobile ? 112 : 180 };
    const innerWidth = width - margin.left - margin.right;

    const rows = [
      { label: "Hindu-majority", n: 1053, BNP: 69.3, Jamaat: 14.5, Outside: 16.2 },
      { label: "Chakma-majority", n: 47, BNP: 14.3, Jamaat: 2.8, Outside: 82.9 },
      { label: "Tripura-majority", n: 19, BNP: 36.9, Jamaat: 4.6, Outside: 58.5 },
    ];

    const svg = d3ref.select(node).append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("role", "img")
      .attr("aria-label", "Stacked bars comparing BNP, Jamaat and other vote shares at Hindu-, Chakma- and Tripura-majority polling centres.");

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
    const x = d3ref.scaleLinear().domain([0, 100]).range([0, innerWidth]);
    const y = d3ref.scaleBand().domain(rows.map((d) => d.label)).range([0, height - margin.top - margin.bottom]).padding(0.38);
    const keys = ["BNP", "Jamaat", "Outside"];
    const stack = d3ref.stack().keys(keys)(rows);

    g.append("g")
      .attr("class", "grid")
      .call(d3ref.axisBottom(x).tickValues([0, 25, 50, 75, 100]).tickSize(height - margin.top - margin.bottom).tickFormat(""))
      .call((axis) => axis.select(".domain").remove());

    g.selectAll("g.series")
      .data(stack)
      .join("g")
      .attr("class", "series")
      .attr("fill", (d) => d.key === "BNP" ? colors.bnp : d.key === "Jamaat" ? colors.jamaat : colors.other)
      .selectAll("rect")
      .data((d) => d.map((segment) => ({ ...segment, key: d.key })))
      .join("rect")
      .attr("x", (d) => x(d[0]))
      .attr("y", (d) => y(d.data.label))
      .attr("width", (d) => Math.max(0, x(d[1]) - x(d[0])))
      .attr("height", y.bandwidth())
      .on("pointerenter", (event, d) => showTooltip(event, `<strong>${d.data.label}</strong>${d.key === "Outside" ? "Outside BNP/Jamaat" : d.key}: ${oneDecimal.format(d.data[d.key])}%`))
      .on("pointermove", moveTooltip)
      .on("pointerleave", hideTooltip);

    g.selectAll("g.segment-label")
      .data(stack.flatMap((series) => series.map((segment) => ({ ...segment, key: series.key }))))
      .join("text")
      .attr("class", "chart-value")
      .attr("x", (d) => x((d[0] + d[1]) / 2))
      .attr("y", (d) => y(d.data.label) + y.bandwidth() / 2 + 4)
      .attr("text-anchor", "middle")
      .attr("fill", (d) => (d[1] - d[0]) > 18 ? "white" : colors.ink)
      .style("font-size", mobile ? "10px" : "11px")
      .text((d) => (d[1] - d[0]) >= (mobile ? 10 : 7) ? `${oneDecimal.format(d[1] - d[0])}%` : "");

    g.selectAll("text.row-label")
      .data(rows)
      .join("text")
      .attr("class", "chart-label row-label")
      .attr("x", -12)
      .attr("y", (d) => y(d.label) + y.bandwidth() / 2 - 2)
      .attr("text-anchor", "end")
      .style("font-weight", 600)
      .text((d) => d.label);

    g.selectAll("text.row-count")
      .data(rows)
      .join("text")
      .attr("class", "chart-note row-count")
      .attr("x", -12)
      .attr("y", (d) => y(d.label) + y.bandwidth() / 2 + 13)
      .attr("text-anchor", "end")
      .text((d) => `${number.format(d.n)} centres`);

    g.append("g")
      .attr("class", "axis")
      .attr("transform", `translate(0,${height - margin.top - margin.bottom})`)
      .call(d3ref.axisBottom(x).tickValues([0, 25, 50, 75, 100]).tickFormat((d) => `${d}%`).tickSizeOuter(0));

    const legend = svg.append("g").attr("transform", `translate(${margin.left},${height - 3})`);
    const legendItems = [
      ["BNP", colors.bnp],
      ["Jamaat", colors.jamaat],
      ["Outside BNP/Jamaat", colors.other],
    ];
    let offset = 0;
    legendItems.forEach(([label, fill]) => {
      const item = legend.append("g").attr("transform", `translate(${offset},0)`);
      item.append("rect").attr("x", 0).attr("y", -9).attr("width", 9).attr("height", 9).attr("fill", fill);
      item.append("text").attr("class", "chart-note").attr("x", 14).attr("y", 0).text(label);
      offset += mobile ? (label.length * 5.4 + 28) : (label.length * 6 + 34);
    });
  }

  function renderTurnoutChart() {
    if (!d3ref) return;
    const node = clearMount("#turnout-chart");
    if (!node) return;
    const width = mountWidth(node);
    const stacked = width < 720;
    const height = stacked ? 510 : 310;
    const panels = [
      {
        title: "By settlement",
        data: [
          { label: "Rural unions", value: 61.8 },
          { label: "Municipalities", value: 59.9 },
          { label: "City corporations", value: 47.0 },
        ],
      },
      {
        title: "By competitiveness",
        data: [
          { label: "Seats under 1 point", value: 64.1 },
          { label: "Closest fifth", value: 61.8 },
          { label: "Most lopsided fifth", value: 57.3 },
        ],
      },
    ];

    const svg = d3ref.select(node).append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("role", "img")
      .attr("aria-label", "Turnout was lower in cities and in the most lopsided constituencies.");

    panels.forEach((panel, index) => {
      const panelWidth = stacked ? width : width / 2;
      const panelHeight = stacked ? height / 2 : height;
      const tx = stacked ? 0 : index * panelWidth;
      const ty = stacked ? index * panelHeight : 0;
      const margin = { top: 38, right: 30, bottom: 35, left: width < 520 ? 120 : 146 };
      const innerWidth = panelWidth - margin.left - margin.right;
      const innerHeight = panelHeight - margin.top - margin.bottom;
      const g = svg.append("g").attr("transform", `translate(${tx + margin.left},${ty + margin.top})`);
      const x = d3ref.scaleLinear().domain([40, 68]).range([0, innerWidth]);
      const y = d3ref.scaleBand().domain(panel.data.map((d) => d.label)).range([0, innerHeight]).padding(0.46);

      svg.append("text")
        .attr("class", "chart-label")
        .attr("x", tx + panelWidth / 2)
        .attr("y", ty + 16)
        .attr("text-anchor", "middle")
        .style("font-weight", 700)
        .text(panel.title);

      g.append("g")
        .attr("class", "grid")
        .call(d3ref.axisBottom(x).tickValues([40, 50, 60]).tickSize(innerHeight).tickFormat(""))
        .call((axis) => axis.select(".domain").remove());

      g.selectAll("line.value-line")
        .data(panel.data)
        .join("line")
        .attr("class", "value-line")
        .attr("x1", x(40))
        .attr("x2", (d) => x(d.value))
        .attr("y1", (d) => y(d.label) + y.bandwidth() / 2)
        .attr("y2", (d) => y(d.label) + y.bandwidth() / 2)
        .attr("stroke", colors.bnpPale)
        .attr("stroke-width", Math.max(8, y.bandwidth() * 0.66));

      g.selectAll("circle.value-dot")
        .data(panel.data)
        .join("circle")
        .attr("class", "value-dot")
        .attr("cx", (d) => x(d.value))
        .attr("cy", (d) => y(d.label) + y.bandwidth() / 2)
        .attr("r", 5.5)
        .attr("fill", colors.bnpDark);

      g.selectAll("text.value")
        .data(panel.data)
        .join("text")
        .attr("class", "chart-value value")
        .attr("x", (d) => x(d.value) + 10)
        .attr("y", (d) => y(d.label) + y.bandwidth() / 2 + 4)
        .text((d) => `${oneDecimal.format(d.value)}%`);

      g.selectAll("text.category")
        .data(panel.data)
        .join("text")
        .attr("class", "chart-label category")
        .attr("x", -10)
        .attr("y", (d) => y(d.label) + y.bandwidth() / 2 + 4)
        .attr("text-anchor", "end")
        .text((d) => d.label);

      g.append("g")
        .attr("class", "axis")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(d3ref.axisBottom(x).tickValues([40, 50, 60]).tickFormat((d) => `${d}%`).tickSizeOuter(0));
    });
  }

  function renderYouthChart() {
    if (!d3ref) return;
    const node = clearMount("#youth-chart");
    if (!node) return;
    const width = mountWidth(node);
    const height = 250;
    const margin = { top: 8, right: 48, bottom: 36, left: width < 530 ? 118 : 154 };
    const data = [
      { label: "Big cities", value: 2.6 },
      { label: "Municipalities", value: 4.7 },
      { label: "Rural unions", value: 7.1 },
    ];

    const svg = d3ref.select(node).append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("role", "img")
      .attr("aria-label", "The BNP lead over Jamaat at younger-heavy centres was 2.6 points in big cities, 4.7 in municipalities and 7.1 in rural unions.");
    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    const x = d3ref.scaleLinear().domain([0, 8]).range([0, innerWidth]);
    const y = d3ref.scaleBand().domain(data.map((d) => d.label)).range([0, innerHeight]).padding(0.5);

    g.append("g")
      .attr("class", "grid")
      .call(d3ref.axisBottom(x).tickValues([0, 2, 4, 6, 8]).tickSize(innerHeight).tickFormat(""))
      .call((axis) => axis.select(".domain").remove());

    g.selectAll("rect.bar")
      .data(data)
      .join("rect")
      .attr("class", "bar")
      .attr("x", x(0))
      .attr("y", (d) => y(d.label))
      .attr("height", y.bandwidth())
      .attr("width", (d) => x(d.value))
      .attr("fill", colors.bnp);

    g.selectAll("text.category")
      .data(data)
      .join("text")
      .attr("class", "chart-label category")
      .attr("x", -12)
      .attr("y", (d) => y(d.label) + y.bandwidth() / 2 + 4)
      .attr("text-anchor", "end")
      .text((d) => d.label);

    g.selectAll("text.value")
      .data(data)
      .join("text")
      .attr("class", "chart-value value")
      .attr("x", (d) => x(d.value) + 8)
      .attr("y", (d) => y(d.label) + y.bandwidth() / 2 + 4)
      .text((d) => `+${oneDecimal.format(d.value)} pts`);

    g.append("g")
      .attr("class", "axis")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(d3ref.axisBottom(x).tickValues([0, 2, 4, 6, 8]).tickFormat((d) => d === 0 ? "Tied" : `+${d}`).tickSizeOuter(0));
  }

  const womenData = [
    { label: "Rural unions", male: 31.4, female: 33.7, note: "+2.3" },
    { label: "Municipalities", male: 30.9, female: 33.3, note: "+2.4" },
    { label: "Big cities", male: 31.0, female: 30.5, note: "−0.5" },
    { label: "Khulna division", male: 45.7, female: 50.7, note: "+5.0" },
  ];

  function renderWomenChart(activeIndex = state.womenStep) {
    if (!d3ref) return;
    state.womenStep = activeIndex;
    const node = clearMount("#women-viz");
    if (!node) return;
    const width = mountWidth(node);
    const height = Math.max(350, Math.min(560, node.getBoundingClientRect().height || 480));
    const margin = { top: 28, right: width < 600 ? 48 : 92, bottom: 58, left: width < 600 ? 122 : 178 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    const x = d3ref.scaleLinear().domain([28, 52]).range([0, innerWidth]);
    const y = d3ref.scaleBand().domain(womenData.map((d) => d.label)).range([0, innerHeight]).padding(0.56);

    const svg = d3ref.select(node).append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("role", "img")
      .attr("aria-label", "Dumbbell chart comparing Jamaat vote shares at male- and female-only polling centres by settlement type and in Khulna division.");
    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    g.append("g")
      .attr("class", "grid")
      .call(d3ref.axisBottom(x).tickValues([30, 35, 40, 45, 50]).tickSize(innerHeight).tickFormat(""))
      .call((axis) => axis.select(".domain").remove());

    const row = g.selectAll("g.women-row")
      .data(womenData)
      .join("g")
      .attr("class", "women-row")
      .attr("opacity", (_, i) => i === activeIndex ? 1 : 0.16);

    row.append("line")
      .attr("x1", (d) => x(d.male))
      .attr("x2", (d) => x(d.female))
      .attr("y1", (d) => y(d.label) + y.bandwidth() / 2)
      .attr("y2", (d) => y(d.label) + y.bandwidth() / 2)
      .attr("stroke", colors.ink)
      .attr("stroke-width", 1.5);

    row.append("circle")
      .attr("cx", (d) => x(d.male))
      .attr("cy", (d) => y(d.label) + y.bandwidth() / 2)
      .attr("r", 6)
      .attr("fill", colors.male);

    row.append("circle")
      .attr("cx", (d) => x(d.female))
      .attr("cy", (d) => y(d.label) + y.bandwidth() / 2)
      .attr("r", 6)
      .attr("fill", colors.female);

    row.append("text")
      .attr("class", "chart-label")
      .attr("x", -12)
      .attr("y", (d) => y(d.label) + y.bandwidth() / 2 + 4)
      .attr("text-anchor", "end")
      .style("font-weight", (_, i) => i === activeIndex ? 700 : 400)
      .text((d) => d.label);

    row.append("text")
      .attr("class", "chart-value")
      .attr("x", (d) => Math.min(innerWidth + 10, Math.max(x(d.male), x(d.female)) + 13))
      .attr("y", (d) => y(d.label) + y.bandwidth() / 2 + 4)
      .text((d) => `${d.note} pts`);

    if (womenData[activeIndex]) {
      const d = womenData[activeIndex];
      const yy = y(d.label) + y.bandwidth() / 2;
      g.append("text")
        .attr("class", "chart-note")
        .attr("x", x(d.male))
        .attr("y", yy - 13)
        .attr("text-anchor", "middle")
        .attr("fill", colors.male)
        .text(`${oneDecimal.format(d.male)}% men`);
      g.append("text")
        .attr("class", "chart-note")
        .attr("x", x(d.female))
        .attr("y", yy + 21)
        .attr("text-anchor", "middle")
        .attr("fill", colors.female)
        .text(`${oneDecimal.format(d.female)}% women`);
    }

    g.append("g")
      .attr("class", "axis")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(d3ref.axisBottom(x).tickValues([30, 35, 40, 45, 50]).tickFormat((d) => `${d}%`).tickSizeOuter(0));

    const legend = svg.append("g").attr("transform", `translate(${margin.left},${height - 12})`);
    [["Male-only centres", colors.male], ["Female-only centres", colors.female]].forEach(([label, fill], i) => {
      const item = legend.append("g").attr("transform", `translate(${i * (width < 520 ? 132 : 160)},0)`);
      item.append("circle").attr("r", 5).attr("cy", -3).attr("fill", fill);
      item.append("text").attr("class", "chart-note").attr("x", 11).text(label);
    });
  }

  function projectionFor(features, width, height, padding = 20) {
    // The supplied TopoJSON uses standard GeoJSON ring winding. A planar D3
    // identity projection preserves that winding (and is effectively
    // distortion-free at Bangladesh's scale), avoiding the spherical
    // complement that geoMercator would otherwise draw for these polygons.
    return d3ref.geoIdentity().reflectY(true).fitExtent([[padding, padding], [width - padding, height - padding]], {
      type: "FeatureCollection",
      features,
    });
  }

  function drawNationalSeatMap(svg, features, width, height, focusOnly = false) {
    const projection = projectionFor(features, width, height, Math.min(width, height) * 0.05);
    const path = d3ref.geoPath(projection);
    const khulna = features.find((feature) => feature.properties?.n === "Khulna-5");
    const mapGroup = svg.append("g");

    mapGroup.selectAll("path")
      .data(features)
      .join("path")
      .attr("class", "map-boundary")
      .attr("d", path)
      .attr("fill", (d) => focusOnly
        ? (d === khulna ? colors.bnp : colors.grid)
        : partyColor(d.properties?.w))
      .attr("stroke", focusOnly ? "white" : "white")
      .attr("stroke-width", focusOnly ? 0.6 : 0.32)
      .attr("opacity", (d) => focusOnly && d !== khulna ? 0.68 : 1)
      .on("pointerenter", (event, d) => {
        const p = d.properties || {};
        showTooltip(event, `<strong>${p.n || "Constituency"}</strong>${p.w || "No declared winner"}<br>${oneDecimal.format(p.to || 0)}% turnout`);
      })
      .on("pointermove", moveTooltip)
      .on("pointerleave", hideTooltip);

    if (khulna && focusOnly) {
      mapGroup.append("path")
        .datum(khulna)
        .attr("d", path)
        .attr("fill", "none")
        .attr("stroke", colors.ink)
        .attr("stroke-width", 2.2)
        .attr("class", "map-boundary");
      const [cx, cy] = path.centroid(khulna);
      const rightSide = cx < width * 0.55;
      const tx = rightSide ? Math.min(width - 110, cx + 72) : Math.max(110, cx - 72);
      const ty = Math.max(60, cy - 38);
      mapGroup.append("line")
        .attr("x1", cx).attr("y1", cy)
        .attr("x2", tx).attr("y2", ty)
        .attr("stroke", colors.ink).attr("stroke-width", 1);
      mapGroup.append("text")
        .attr("class", "map-label")
        .attr("x", tx).attr("y", ty - 6)
        .attr("text-anchor", rightSide ? "start" : "end")
        .style("font-weight", 700)
        .text("Khulna-5");
      mapGroup.append("text")
        .attr("class", "chart-note")
        .attr("x", tx).attr("y", ty + 10)
        .attr("text-anchor", rightSide ? "start" : "end")
        .text("BNP +3,311");
    }

    return { projection, path };
  }

  const hinduMajority = new Set(["Magurkhali", "Rangpur", "Bhandarpara", "Gutudia", "Shovna"]);

  function khulnaFeatures() {
    if (!state.units) return [];
    return topojsonRef.feature(state.units, state.units.objects.data).features
      .filter((feature) => feature.properties?.c === "খুলনা-৫" && feature.properties?.t === "u");
  }

  function drawKhulnaUnionMap(svg, features, rows, width, height, highlightHindu) {
    const mapWidth = width < 720 ? width : width * 0.68;
    const projection = projectionFor(features, mapWidth, height, Math.min(mapWidth, height) * 0.08);
    const path = d3ref.geoPath(projection);
    const rowByName = new Map(rows.map((row) => [row.union, row]));
    const mapGroup = svg.append("g");

    mapGroup.selectAll("path.union")
      .data(features)
      .join("path")
      .attr("class", "union map-boundary")
      .attr("d", path)
      .attr("fill", (d) => partyColor(rowByName.get(d.properties?.n)?.lead || d.properties?.w))
      .attr("stroke", (d) => highlightHindu && hinduMajority.has(d.properties?.n) ? colors.ink : "white")
      .attr("stroke-width", (d) => highlightHindu && hinduMajority.has(d.properties?.n) ? 2.8 : 0.8)
      .on("pointerenter", (event, d) => {
        const p = d.properties || {};
        const row = rowByName.get(p.n);
        const hindu = row ? `${oneDecimal.format(+row.hindu)}% inferred Hindu` : "Composition unavailable";
        const margin = row ? `${row.lead} ${number.format(Math.abs(+row.margin))}` : p.w;
        showTooltip(event, `<strong>${p.n}</strong>${hindu}<br>${margin}`);
      })
      .on("pointermove", moveTooltip)
      .on("pointerleave", hideTooltip);

    if (mapWidth > 500) {
      mapGroup.selectAll("text.union-name")
        .data(features)
        .join("text")
        .attr("class", "map-label union-name")
        .attr("x", (d) => path.centroid(d)[0])
        .attr("y", (d) => path.centroid(d)[1] + 3)
        .attr("text-anchor", "middle")
        .style("font-size", "8.5px")
        .style("font-weight", 600)
        .style("pointer-events", "none")
        .text((d) => d.properties?.n);
    }

    if (highlightHindu) {
      const marked = features.filter((d) => hinduMajority.has(d.properties?.n));
      const marker = mapGroup.selectAll("g.h-marker")
        .data(marked)
        .join("g")
        .attr("class", "h-marker")
        .attr("transform", (d) => `translate(${path.centroid(d)})`)
        .style("pointer-events", "none");
      marker.append("circle").attr("r", 9).attr("fill", colors.ink);
      marker.append("text")
        .attr("y", 3.5)
        .attr("text-anchor", "middle")
        .attr("fill", "white")
        .style("font", "700 8px var(--ui)")
        .text("H");
    }

    if (width >= 720) {
      const ledgerX = width * 0.74;
      const ledgerWidth = width * 0.22;
      const values = highlightHindu
        ? [
            { label: "5 Hindu-majority unions", value: 22209, fill: colors.bnp, result: "BNP +22,209" },
            { label: "Other 13 unions", value: 18898, fill: colors.jamaat, result: "Jamaat +18,898" },
            { label: "Seat result", value: 3311, fill: colors.bnpDark, result: "BNP +3,311" },
          ]
        : [
            { label: "BNP-led unions", value: 8, fill: colors.bnp, result: "8" },
            { label: "Jamaat-led unions", value: 10, fill: colors.jamaat, result: "10" },
          ];
      const maxValue = d3ref.max(values, (d) => d.value);
      const x = d3ref.scaleLinear().domain([0, maxValue]).range([0, ledgerWidth]);
      const yStart = highlightHindu ? height * 0.25 : height * 0.32;
      const rowGap = highlightHindu ? 104 : 122;

      const ledger = svg.append("g").attr("transform", `translate(${ledgerX},${yStart})`);
      ledger.append("text")
        .attr("class", "chart-label")
        .attr("y", -32)
        .style("font-weight", 700)
        .text(highlightHindu ? "Net advantage" : "Unions led");
      const item = ledger.selectAll("g.ledger-row")
        .data(values)
        .join("g")
        .attr("class", "ledger-row")
        .attr("transform", (_, i) => `translate(0,${i * rowGap})`);
      item.append("text").attr("class", "chart-label").attr("y", 0).text((d) => d.label);
      item.append("rect")
        .attr("x", 0).attr("y", 13)
        .attr("height", 16)
        .attr("width", (d) => Math.max(4, x(d.value)))
        .attr("fill", (d) => d.fill);
      item.append("text")
        .attr("class", "chart-value")
        .attr("x", 0).attr("y", 49)
        .text((d) => d.result);
    }
  }

  function renderKhulnaStep(step = state.khulnaStep) {
    state.khulnaStep = step;
    if (!d3ref || !topojsonRef || !state.national) return;
    const node = clearMount("#khulna-viz");
    if (!node) return;
    const width = mountWidth(node);
    const height = Math.max(360, Math.round(node.getBoundingClientRect().height || 600));
    const svg = d3ref.select(node).append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("role", "img");
    const nationalFeatures = topojsonRef.feature(state.national, state.national.objects.data).features
      .filter((feature) => feature.properties?.w);
    const title = document.getElementById("khulna-stage-title");
    const subtitle = document.getElementById("khulna-stage-subtitle");

    if (step === 0) {
      title.textContent = "A landslide made of local contests";
      subtitle.textContent = "Leading party in the 297 constituencies with declared results";
      drawNationalSeatMap(svg, nationalFeatures, width, height, false);
      const legend = svg.append("g").attr("transform", `translate(${Math.max(18, width - 190)},${height - 52})`);
      [["BNP", colors.bnp], ["Jamaat", colors.jamaat], ["Other", colors.other]].forEach(([label, fill], i) => {
        const item = legend.append("g").attr("transform", `translate(0,${i * 17})`);
        item.append("rect").attr("width", 10).attr("height", 10).attr("fill", fill);
        item.append("text").attr("class", "chart-note").attr("x", 16).attr("y", 9).text(label);
      });
    } else if (step === 1) {
      title.textContent = "One close seat inside the landslide";
      subtitle.textContent = "Khulna-5 was decided by 3,311 votes";
      drawNationalSeatMap(svg, nationalFeatures, width, height, true);
    } else {
      const features = khulnaFeatures();
      title.textContent = step === 2 ? "The winner lost most of the constituency’s unions" : "Five unions produced the winning margin";
      subtitle.textContent = step === 2 ? "Leading party in Khulna-5’s 18 unions" : "H marks the five conservative Hindu-majority unions";
      drawKhulnaUnionMap(svg, features, state.khulnaRows, width, height, step === 3);
    }
  }

  function renderLocalMap() {
    if (!d3ref || !topojsonRef || !state.units) return;
    const node = clearMount("#local-map");
    if (!node) return;
    const width = mountWidth(node);
    const height = Math.max(430, Math.min(760, Math.round(width * 0.62)));
    const features = topojsonRef.feature(state.units, state.units.objects.data).features
      .filter((feature) => ["u", "m", "cc"].includes(feature.properties?.t) && state.unitResults[feature.properties?.k]);
    const projection = projectionFor(features, width, height, Math.min(width, height) * 0.04);
    const path = d3ref.geoPath(projection);
    const svg = d3ref.select(node).append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("role", "img")
      .attr("aria-label", "Map of leading parties in mapped unions, municipalities and city corporation wards across Bangladesh.");

    svg.append("g")
      .selectAll("path")
      .data(features)
      .join("path")
      .attr("class", "map-boundary")
      .attr("d", path)
      .attr("fill", (d) => partyColor(unitResult(d).w))
      .attr("stroke", "white")
      .attr("stroke-width", 0.22)
      .on("pointerenter", (event, d) => {
        const p = d.properties || {};
        const result = unitResult(d);
        const type = p.t === "u" ? "Union" : p.t === "m" ? "Municipality" : "City ward";
        showTooltip(event, `<strong>${p.n || type}</strong>${type} · ${p.d || ""}<br>${result.w || "No result"}${Number.isFinite(+result.mg) ? ` · ${oneDecimal.format(+result.mg)}-point margin` : ""}`);
      })
      .on("pointermove", moveTooltip)
      .on("pointerleave", hideTooltip);
  }

  function renderLocalTiers() {
    if (!d3ref) return;
    const node = clearMount("#local-tier-chart");
    if (!node) return;
    const width = mountWidth(node);
    const mobile = width < 620;
    const height = mobile ? 310 : 245;
    const margin = { top: 10, right: 20, bottom: 32, left: mobile ? 98 : 152 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    const data = [
      { label: "Unions", BNP: 67, Jamaat: 23, Other: 10 },
      { label: "Municipalities", BNP: 71, Jamaat: 21, Other: 8 },
      { label: "Upazilas", BNP: 73, Jamaat: 21, Other: 6 },
      { label: "City wards", BNP: 73, Jamaat: 22, Other: 5 },
    ];
    const svg = d3ref.select(node).append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("role", "img")
      .attr("aria-label", "The BNP led about two-thirds to three-quarters of mapped local administrative units, while Jamaat led about one-fifth.");
    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
    const x = d3ref.scaleLinear().domain([0, 100]).range([0, innerWidth]);
    const y = d3ref.scaleBand().domain(data.map((d) => d.label)).range([0, innerHeight]).padding(0.42);
    const stack = d3ref.stack().keys(["BNP", "Jamaat", "Other"])(data);

    g.selectAll("g.series")
      .data(stack)
      .join("g")
      .attr("fill", (d) => d.key === "BNP" ? colors.bnp : d.key === "Jamaat" ? colors.jamaat : colors.other)
      .selectAll("rect")
      .data((series) => series.map((segment) => ({ ...segment, key: series.key })))
      .join("rect")
      .attr("x", (d) => x(d[0]))
      .attr("y", (d) => y(d.data.label))
      .attr("width", (d) => x(d[1]) - x(d[0]))
      .attr("height", y.bandwidth());

    g.selectAll("text.category")
      .data(data)
      .join("text")
      .attr("class", "chart-label category")
      .attr("x", -12)
      .attr("y", (d) => y(d.label) + y.bandwidth() / 2 + 4)
      .attr("text-anchor", "end")
      .text((d) => d.label);

    g.selectAll("text.bnp-value")
      .data(data)
      .join("text")
      .attr("class", "chart-value bnp-value")
      .attr("x", (d) => x(d.BNP) - 8)
      .attr("y", (d) => y(d.label) + y.bandwidth() / 2 + 4)
      .attr("text-anchor", "end")
      .attr("fill", "white")
      .text((d) => `${d.BNP}%`);

    g.selectAll("text.jamaat-value")
      .data(data)
      .join("text")
      .attr("class", "chart-value jamaat-value")
      .attr("x", (d) => x(d.BNP + d.Jamaat / 2))
      .attr("y", (d) => y(d.label) + y.bandwidth() / 2 + 4)
      .attr("text-anchor", "middle")
      .attr("fill", colors.ink)
      .text((d) => `${d.Jamaat}%`);

    g.append("g")
      .attr("class", "axis")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(d3ref.axisBottom(x).tickValues([0, 25, 50, 75, 100]).tickFormat((d) => `${d}%`).tickSizeOuter(0));
  }

  function renderReversalChart() {
    if (!d3ref) return;
    const node = clearMount("#reversal-chart");
    if (!node) return;
    const width = mountWidth(node);
    const stacked = width < 720;
    const height = stacked ? 520 : 310;
    const examples = [
      {
        name: "Badarganj · Rangpur-2",
        rows: [
          { label: "Surrounding unions", BNP: 31.9, Jamaat: 53.8, Other: 14.3 },
          { label: "Municipality", BNP: 50.0, Jamaat: 41.5, Other: 8.5 },
        ],
      },
      {
        name: "Bakshiganj · Jamalpur-1",
        rows: [
          { label: "Surrounding unions", BNP: 53.1, Jamaat: 44.3, Other: 2.6 },
          { label: "Municipality", BNP: 39.4, Jamaat: 57.0, Other: 3.6 },
        ],
      },
    ];
    const svg = d3ref.select(node).append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("role", "img")
      .attr("aria-label", "In Badarganj, Jamaat led the surrounding unions while the BNP led the municipality. Bakshiganj showed the reverse.");

    examples.forEach((example, index) => {
      const panelWidth = stacked ? width : width / 2;
      const panelHeight = stacked ? height / 2 : height;
      const tx = stacked ? 0 : index * panelWidth;
      const ty = stacked ? index * panelHeight : 0;
      const margin = { top: 50, right: 22, bottom: 32, left: width < 520 ? 120 : 146 };
      const innerWidth = panelWidth - margin.left - margin.right;
      const innerHeight = panelHeight - margin.top - margin.bottom;
      const x = d3ref.scaleLinear().domain([0, 100]).range([0, innerWidth]);
      const y = d3ref.scaleBand().domain(example.rows.map((d) => d.label)).range([0, innerHeight]).padding(0.55);
      const stack = d3ref.stack().keys(["BNP", "Jamaat", "Other"])(example.rows);
      const g = svg.append("g").attr("transform", `translate(${tx + margin.left},${ty + margin.top})`);

      svg.append("text")
        .attr("class", "chart-label")
        .attr("x", tx + panelWidth / 2)
        .attr("y", ty + 20)
        .attr("text-anchor", "middle")
        .style("font-weight", 700)
        .text(example.name);

      g.selectAll("g.series")
        .data(stack)
        .join("g")
        .attr("fill", (d) => d.key === "BNP" ? colors.bnp : d.key === "Jamaat" ? colors.jamaat : colors.other)
        .selectAll("rect")
        .data((series) => series.map((segment) => ({ ...segment, key: series.key })))
        .join("rect")
        .attr("x", (d) => x(d[0]))
        .attr("y", (d) => y(d.data.label))
        .attr("width", (d) => x(d[1]) - x(d[0]))
        .attr("height", y.bandwidth());

      g.selectAll("text.category")
        .data(example.rows)
        .join("text")
        .attr("class", "chart-label category")
        .attr("x", -10)
        .attr("y", (d) => y(d.label) + y.bandwidth() / 2 + 4)
        .attr("text-anchor", "end")
        .text((d) => d.label);

      g.selectAll("text.leader")
        .data(example.rows)
        .join("text")
        .attr("class", "chart-value leader")
        .attr("x", (d) => d.BNP > d.Jamaat ? x(d.BNP / 2) : x(d.BNP + d.Jamaat / 2))
        .attr("y", (d) => y(d.label) + y.bandwidth() / 2 + 4)
        .attr("text-anchor", "middle")
        .attr("fill", (d) => d.BNP > d.Jamaat ? "white" : colors.ink)
        .text((d) => `${d.BNP > d.Jamaat ? "BNP" : "Jamaat"} ${oneDecimal.format(Math.max(d.BNP, d.Jamaat))}%`);

      g.append("g")
        .attr("class", "axis")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(d3ref.axisBottom(x).tickValues([0, 25, 50, 75, 100]).tickFormat((d) => `${d}%`).tickSizeOuter(0));
    });
  }

  function setupScrolly(selector, callback) {
    const root = document.querySelector(selector);
    if (!root) return;
    const steps = [...root.querySelectorAll(".scrolly-step")];
    if (!steps.length) return;
    const activate = (index) => {
      steps.forEach((step, i) => step.classList.toggle("is-active", i === index));
      callback(index);
    };
    activate(0);
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) activate(Number(entry.target.dataset.step || 0));
      });
    }, { rootMargin: "-34% 0px -52% 0px", threshold: 0 });
    steps.forEach((step) => observer.observe(step));
  }

  function setupProgress() {
    const bar = document.querySelector(".story-bar");
    const progress = document.querySelector(".story-bar__progress span");
    const hero = document.querySelector(".hero");
    let scheduled = false;
    const update = () => {
      const scrollTop = window.scrollY;
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      if (progress) progress.style.width = `${Math.min(100, Math.max(0, scrollTop / max * 100))}%`;
      if (bar && hero) bar.classList.toggle("is-visible", scrollTop > hero.offsetHeight * 0.62);
      scheduled = false;
    };
    window.addEventListener("scroll", () => {
      if (!scheduled) {
        scheduled = true;
        requestAnimationFrame(update);
      }
    }, { passive: true });
    update();
  }

  function setupChapterTracker() {
    const label = document.querySelector(".story-bar__chapter");
    const sections = [...document.querySelectorAll("[data-chapter]")];
    if (!label || !sections.length) return;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) label.textContent = visible.target.dataset.chapter;
    }, { rootMargin: "-20% 0px -65% 0px", threshold: [0, 0.1, 0.5] });
    sections.forEach((section) => observer.observe(section));
  }

  function renderAll() {
    renderMinorityChart();
    renderTurnoutChart();
    renderYouthChart();
    renderWomenChart(state.womenStep);
    renderKhulnaStep(state.khulnaStep);
    renderLocalMap();
    renderLocalTiers();
    renderReversalChart();
  }

  async function init() {
    if (!d3ref || !topojsonRef) {
      addError("The chart libraries did not load. Check the network connection and reload.");
      return;
    }
    addLoading();
    setupProgress();
    setupChapterTracker();

    try {
      const [national, units, unitResults, khulnaRows] = await Promise.all([
        d3ref.json("./constituencies.topojson"),
        d3ref.json("./units.topojson"),
        d3ref.json("./local-unit-results.json"),
        d3ref.csv("./khulna5_unions.csv", (row) => ({
          ...row,
          hindu: +row.hindu,
          margin: +row.margin,
          bnp_p: +row.bnp_p,
          jam_p: +row.jam_p,
        })),
      ]);
      state.national = national;
      state.units = units;
      state.unitResults = unitResults;
      state.khulnaRows = khulnaRows;

      setupScrolly("#khulna-scrolly", renderKhulnaStep);
      setupScrolly("#women-scrolly", renderWomenChart);
      renderAll();

      let resizeTimer;
      window.addEventListener("resize", () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(renderAll, reducedMotion ? 0 : 180);
      });
    } catch (error) {
      console.error(error);
      addError("The article text is available, but its local data files could not be loaded. Open this page through the project’s local server.");
    }
  }

  init();
})();
