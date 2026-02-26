function fmtCurrency(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "N/A";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

function fmtCurrency2(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "N/A";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  }).format(value);
}

function fmtNumber(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "N/A";
  return new Intl.NumberFormat("en-US").format(Math.round(value));
}

function fmtPct(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "N/A";
  return `${(value * 100).toFixed(1)}%`;
}

function safeDiv(a, b) {
  if (!b) return null;
  return a / b;
}

function activateTabs() {
  const buttons = document.querySelectorAll(".tab-btn");
  const panels = document.querySelectorAll(".tab-panel");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buttons.forEach((b) => b.classList.remove("active"));
      panels.forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(btn.dataset.tab).classList.add("active");
      window.dispatchEvent(new Event("resize"));
    });
  });
}

function weightedAvg(rows, valueKey, weightKey) {
  let weightedSum = 0;
  let totalWeight = 0;
  rows.forEach((r) => {
    const v = Number(r[valueKey]);
    const w = Number(r[weightKey]);
    if (!Number.isNaN(v) && !Number.isNaN(w)) {
      weightedSum += v * w;
      totalWeight += w;
    }
  });
  return totalWeight > 0 ? weightedSum / totalWeight : null;
}

function renderExecutive(data) {
  const monthly = data.exec_monthly || [];
  const payment = data.exec_payment_mix || [];
  const categories = data.exec_category_perf || [];
  const kpis = data.exec_kpis?.[0] || {};

  document.getElementById("exec-kpi-gmv").textContent = fmtCurrency(kpis.total_gmv);
  document.getElementById("exec-kpi-orders").textContent = fmtNumber(kpis.total_orders);
  document.getElementById("exec-kpi-aov").textContent = fmtCurrency2(kpis.aov);
  document.getElementById("exec-kpi-yoy").textContent = fmtPct(kpis.latest_yoy_order_growth_pct);

  Plotly.newPlot(
    "exec-monthly-chart",
    [
      {
        x: monthly.map((d) => d.month_start),
        y: monthly.map((d) => d.gmv),
        type: "scatter",
        mode: "lines+markers",
        name: "GMV",
      },
      {
        x: monthly.map((d) => d.month_start),
        y: monthly.map((d) => d.order_count),
        type: "scatter",
        mode: "lines+markers",
        name: "Orders",
        yaxis: "y2",
      },
    ],
    {
      title: "Monthly GMV and Order Volume",
      yaxis: { title: "GMV (BRL)" },
      yaxis2: { title: "Orders", overlaying: "y", side: "right" },
      margin: { t: 40, r: 20, l: 40, b: 40 },
      legend: { orientation: "h" },
    },
    { responsive: true }
  );

  Plotly.newPlot(
    "exec-payment-chart",
    [
      {
        labels: payment.map((d) => d.payment_type),
        values: payment.map((d) => d.order_count),
        type: "pie",
        hole: 0.4,
      },
    ],
    {
      title: "Payment Mix",
      margin: { t: 40, r: 10, l: 10, b: 10 },
    },
    { responsive: true }
  );

  const topCategories = [...categories]
    .sort((a, b) => Number(b.category_gmv) - Number(a.category_gmv))
    .slice(0, 12);
  Plotly.newPlot(
    "exec-category-chart",
    [
      {
        x: topCategories.map((d) => d.product_category),
        y: topCategories.map((d) => d.contribution_margin_proxy),
        type: "bar",
        marker: { color: "#2563eb" },
      },
    ],
    {
      title: "Top Categories by Contribution Margin Proxy",
      xaxis: { title: "Category" },
      yaxis: { title: "Contribution Margin Proxy" },
      margin: { t: 50, r: 20, l: 40, b: 120 },
    },
    { responsive: true }
  );
}

function renderOps(data) {
  const states = data.ops_state_bottlenecks || [];
  const monthly = data.ops_monthly || [];
  const geo = data.state_geo_centroid || [];
  const kpis = data.ops_kpis?.[0] || {};

  document.getElementById("ops-kpi-delivery").textContent =
    kpis.avg_delivery_days !== null && kpis.avg_delivery_days !== undefined
      ? Number(kpis.avg_delivery_days).toFixed(2)
      : "N/A";
  document.getElementById("ops-kpi-ontime").textContent = fmtPct(kpis.on_time_rate);
  document.getElementById("ops-kpi-freight").textContent = fmtPct(
    kpis.avg_freight_to_gmv_ratio
  );

  const geoMap = {};
  geo.forEach((g) => {
    geoMap[g.customer_state] = g;
  });
  const mapRows = states
    .map((s) => ({
      ...s,
      geo_lat: geoMap[s.customer_state]?.geo_lat,
      geo_lng: geoMap[s.customer_state]?.geo_lng,
    }))
    .filter((r) => r.geo_lat !== undefined && r.geo_lng !== undefined);

  Plotly.newPlot(
    "ops-map-chart",
    [
      {
        type: "scattergeo",
        mode: "markers",
        lat: mapRows.map((d) => d.geo_lat),
        lon: mapRows.map((d) => d.geo_lng),
        text: mapRows.map(
          (d) =>
            `${d.customer_state}<br>Severe delay: ${fmtPct(d.severe_delay_rate)}<br>Orders: ${fmtNumber(
              d.order_count
            )}`
        ),
        hoverinfo: "text",
        marker: {
          size: mapRows.map((d) => Math.max(8, Math.sqrt(Number(d.order_count) / 8))),
          color: mapRows.map((d) => Number(d.severe_delay_rate)),
          colorscale: "Reds",
          colorbar: { title: "Severe Delay Rate" },
          sizemode: "diameter",
          line: { width: 0.5, color: "#ffffff" },
        },
      },
    ],
    {
      title: "State Logistics Bottlenecks",
      geo: {
        scope: "south america",
        projection: { type: "mercator" },
        center: { lat: -14, lon: -52 },
        lataxis: { range: [-35, 6] },
        lonaxis: { range: [-75, -30] },
      },
      margin: { t: 40, r: 10, l: 10, b: 10 },
    },
    { responsive: true }
  );

  const topDelay = [...states]
    .sort((a, b) => Number(b.severe_delay_rate) - Number(a.severe_delay_rate))
    .slice(0, 12);
  Plotly.newPlot(
    "ops-delay-chart",
    [
      {
        x: topDelay.map((d) => d.customer_state),
        y: topDelay.map((d) => d.severe_delay_rate),
        type: "bar",
        marker: { color: "#ef4444" },
      },
    ],
    {
      title: "Top States by Severe Delay Rate",
      yaxis: { tickformat: ".0%", title: "Severe Delay Rate" },
      xaxis: { title: "State" },
      margin: { t: 40, r: 20, l: 40, b: 60 },
    },
    { responsive: true }
  );

  Plotly.newPlot(
    "ops-monthly-chart",
    [
      {
        x: monthly.map((d) => d.month_start),
        y: monthly.map((d) => d.avg_delivery_days),
        type: "scatter",
        mode: "lines+markers",
        name: "Avg Delivery Days",
      },
      {
        x: monthly.map((d) => d.month_start),
        y: monthly.map((d) => d.avg_delay_days),
        type: "scatter",
        mode: "lines+markers",
        name: "Avg Delay Days",
      },
      {
        x: monthly.map((d) => d.month_start),
        y: monthly.map((d) => d.on_time_rate),
        type: "scatter",
        mode: "lines+markers",
        name: "On-Time Rate",
        yaxis: "y2",
      },
    ],
    {
      title: "Monthly Logistics Trend",
      yaxis: { title: "Days" },
      yaxis2: { title: "On-Time Rate", overlaying: "y", side: "right", tickformat: ".0%" },
      margin: { t: 40, r: 20, l: 40, b: 40 },
      legend: { orientation: "h" },
    },
    { responsive: true }
  );
}

function renderCsat(data) {
  const delayImpact = data.csat_delay_impact || [];
  const reviewDist = data.review_distribution || [];
  const statePayment = data.csat_state_payment || [];
  const csatKpis = data.csat_kpis?.[0] || {};

  document.getElementById("csat-kpi-score").textContent =
    csatKpis.avg_review_score !== null && csatKpis.avg_review_score !== undefined
      ? Number(csatKpis.avg_review_score).toFixed(2)
      : "N/A";
  document.getElementById("csat-kpi-one-star").textContent = fmtPct(csatKpis.one_star_rate);
  document.getElementById("csat-kpi-low-score").textContent = fmtPct(csatKpis.low_score_rate);

  Plotly.newPlot(
    "csat-review-chart",
    [
      {
        x: reviewDist.map((d) => d.review_score),
        y: reviewDist.map((d) => d.review_count),
        type: "bar",
        marker: { color: "#16a34a" },
      },
    ],
    {
      title: "Review Score Distribution",
      xaxis: { title: "Review Score" },
      yaxis: { title: "Count" },
      margin: { t: 40, r: 20, l: 40, b: 50 },
    },
    { responsive: true }
  );

  Plotly.newPlot(
    "csat-delay-chart",
    [
      {
        x: delayImpact.map((d) => d.delay_bucket),
        y: delayImpact.map((d) => d.avg_review_score),
        type: "bar",
        name: "Avg Review Score",
      },
      {
        x: delayImpact.map((d) => d.delay_bucket),
        y: delayImpact.map((d) => d.one_star_rate),
        type: "bar",
        name: "One-Star Rate",
        yaxis: "y2",
      },
      {
        x: delayImpact.map((d) => d.delay_bucket),
        y: delayImpact.map((d) => d.low_score_rate),
        type: "bar",
        name: "Low-Score Rate",
        yaxis: "y2",
      },
    ],
    {
      title: "Delay Bucket vs Customer Sentiment",
      barmode: "group",
      yaxis: { title: "Avg Review Score" },
      yaxis2: { title: "Rate", overlaying: "y", side: "right", tickformat: ".0%" },
      margin: { t: 40, r: 20, l: 40, b: 70 },
    },
    { responsive: true }
  );

  const states = [...new Set(statePayment.map((d) => d.customer_state))].sort();
  const payments = [...new Set(statePayment.map((d) => d.payment_type))].sort();
  const matrix = states.map((state) =>
    payments.map((pay) => {
      const row = statePayment.find(
        (r) => r.customer_state === state && r.payment_type === pay
      );
      return row ? Number(row.low_score_rate) : null;
    })
  );
  Plotly.newPlot(
    "csat-heatmap-chart",
    [
      {
        type: "heatmap",
        x: payments,
        y: states,
        z: matrix,
        colorscale: "Reds",
        colorbar: { title: "Low-Score Rate" },
      },
    ],
    {
      title: "Low-Score Rate Heatmap by State and Payment Type",
      xaxis: { title: "Payment Type" },
      yaxis: { title: "State" },
      margin: { t: 45, r: 20, l: 60, b: 80 },
    },
    { responsive: true }
  );

  const over5 = delayImpact.find((d) => d.delay_bucket === "late_over_5_days");
  const ontime = delayImpact.find((d) => d.delay_bucket === "on_time_or_early");
  const insightNode = document.getElementById("csat-insight");
  if (over5 && ontime) {
    const oneStarLift = safeDiv(over5.one_star_rate, ontime.one_star_rate);
    insightNode.innerHTML =
      "<strong>Actionable insight:</strong> Orders delayed over 5 days show " +
      `${fmtPct(over5.one_star_rate)} one-star rate vs ${fmtPct(
        ontime.one_star_rate
      )} for on-time/early deliveries` +
      (oneStarLift ? ` (${oneStarLift.toFixed(1)}x higher).` : ".");
  } else {
    insightNode.textContent = "Actionable insight unavailable for current data package.";
  }
}

async function loadData() {
  const res = await fetch("./data/dashboard_data.json");
  if (!res.ok) {
    throw new Error(`Failed to load data package: ${res.status}`);
  }
  return res.json();
}

async function init() {
  activateTabs();
  try {
    const payload = await loadData();
    renderExecutive(payload);
    renderOps(payload);
    renderCsat(payload);
    document.getElementById(
      "last-updated"
    ).textContent = `Data package generated at ${payload.generated_at} (UTC).`;
  } catch (error) {
    console.error(error);
    alert(
      "Dashboard failed to load packaged data. Please regenerate data/dashboard_data.json."
    );
  }
}

init();
