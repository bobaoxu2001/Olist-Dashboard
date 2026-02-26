let RAW_DATA = null;
let META = null;

const DELAY_BUCKET_ORDER = [
  "on_time_or_early",
  "late_1_2_days",
  "late_3_5_days",
  "late_over_5_days",
  "unknown",
];

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

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

function normalizeDate(dateValue) {
  return String(dateValue).slice(0, 10);
}

function truncateByGrain(dateStr, grain) {
  if (grain === "day") return dateStr;
  if (grain === "month") return `${dateStr.slice(0, 7)}-01`;
  return `${dateStr.slice(0, 4)}-01-01`;
}

function formatPeriodLabel(periodKey, grain) {
  if (grain === "day") return periodKey;
  if (grain === "month") return periodKey.slice(0, 7);
  return periodKey.slice(0, 4);
}

function shiftOneYear(periodKey) {
  const dt = new Date(`${periodKey}T00:00:00Z`);
  dt.setUTCFullYear(dt.getUTCFullYear() - 1);
  return dt.toISOString().slice(0, 10);
}

function getSelectedValues(selectEl) {
  return Array.from(selectEl.selectedOptions).map((option) => option.value);
}

function selectAllOptions(selectEl) {
  Array.from(selectEl.options).forEach((option) => {
    option.selected = true;
  });
}

function fillMultiSelect(selectEl, values) {
  selectEl.innerHTML = "";
  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    option.selected = true;
    selectEl.appendChild(option);
  });
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

function showNoData(divId, title, message) {
  Plotly.newPlot(
    divId,
    [],
    {
      title,
      xaxis: { visible: false },
      yaxis: { visible: false },
      annotations: [
        {
          text: message,
          x: 0.5,
          y: 0.5,
          xref: "paper",
          yref: "paper",
          showarrow: false,
          font: { size: 14, color: "#64748b" },
        },
      ],
      margin: { t: 50, r: 20, l: 20, b: 20 },
    },
    { responsive: true }
  );
}

function getCurrentFilters() {
  const country = document.getElementById("filter-country").value;
  const grain = document.getElementById("filter-grain").value;
  const startDate = document.getElementById("filter-start-date").value;
  const endDate = document.getElementById("filter-end-date").value;
  const stateSelect = document.getElementById("filter-states");
  const paymentSelect = document.getElementById("filter-payments");

  let selectedStates = getSelectedValues(stateSelect);
  let selectedPayments = getSelectedValues(paymentSelect);

  if (selectedStates.length === 0) {
    selectAllOptions(stateSelect);
    selectedStates = getSelectedValues(stateSelect);
  }
  if (selectedPayments.length === 0) {
    selectAllOptions(paymentSelect);
    selectedPayments = getSelectedValues(paymentSelect);
  }

  return {
    country,
    grain,
    startDate,
    endDate,
    stateSet: new Set(selectedStates),
    paymentSet: new Set(selectedPayments),
  };
}

function rowPassesFilter(row, filters) {
  const rowDate = normalizeDate(row.purchase_date);
  if (filters.startDate && rowDate < filters.startDate) return false;
  if (filters.endDate && rowDate > filters.endDate) return false;
  if (filters.country && row.country !== filters.country) return false;
  if (!filters.stateSet.has(row.customer_state)) return false;
  if (!filters.paymentSet.has(row.payment_type)) return false;
  return true;
}

function aggregateByPeriod(rows, grain) {
  const map = new Map();
  rows.forEach((row) => {
    const key = truncateByGrain(normalizeDate(row.purchase_date), grain);
    if (!map.has(key)) {
      map.set(key, {
        period_key: key,
        gmv: 0,
        order_count: 0,
        freight_value: 0,
        late_count: 0,
        severe_delay_count: 0,
        delivery_days_sum: 0,
        delivery_days_count: 0,
        delay_days_sum: 0,
        delay_days_count: 0,
        review_score_sum: 0,
        review_count: 0,
        one_star_count: 0,
        low_score_count: 0,
      });
    }
    const acc = map.get(key);
    acc.gmv += toNumber(row.gmv);
    acc.order_count += toNumber(row.order_count);
    acc.freight_value += toNumber(row.freight_value);
    acc.late_count += toNumber(row.late_count);
    acc.severe_delay_count += toNumber(row.severe_delay_count);
    acc.delivery_days_sum += toNumber(row.delivery_days_sum);
    acc.delivery_days_count += toNumber(row.delivery_days_count);
    acc.delay_days_sum += toNumber(row.delay_days_sum);
    acc.delay_days_count += toNumber(row.delay_days_count);
    acc.review_score_sum += toNumber(row.review_score_sum);
    acc.review_count += toNumber(row.review_count);
    acc.one_star_count += toNumber(row.one_star_count);
    acc.low_score_count += toNumber(row.low_score_count);
  });

  return Array.from(map.values())
    .sort((a, b) => a.period_key.localeCompare(b.period_key))
    .map((row) => ({
      ...row,
      period_label: formatPeriodLabel(row.period_key, grain),
      aov: safeDiv(row.gmv, row.order_count),
      on_time_rate: safeDiv(row.order_count - row.late_count, row.order_count),
      severe_delay_rate: safeDiv(row.severe_delay_count, row.order_count),
      avg_delivery_days: safeDiv(row.delivery_days_sum, row.delivery_days_count),
      avg_delay_days: safeDiv(row.delay_days_sum, row.delay_days_count),
      freight_to_gmv_ratio: safeDiv(row.freight_value, row.gmv),
      avg_review_score: safeDiv(row.review_score_sum, row.review_count),
      one_star_rate: safeDiv(row.one_star_count, row.review_count),
      low_score_rate: safeDiv(row.low_score_count, row.review_count),
    }));
}

function aggregateByState(rows) {
  const map = new Map();
  rows.forEach((row) => {
    const key = row.customer_state;
    if (!map.has(key)) {
      map.set(key, {
        customer_state: key,
        order_count: 0,
        gmv: 0,
        freight_value: 0,
        late_count: 0,
        severe_delay_count: 0,
        delivery_days_sum: 0,
        delivery_days_count: 0,
        delay_days_sum: 0,
        delay_days_count: 0,
        review_score_sum: 0,
        review_count: 0,
        one_star_count: 0,
        low_score_count: 0,
      });
    }
    const acc = map.get(key);
    acc.order_count += toNumber(row.order_count);
    acc.gmv += toNumber(row.gmv);
    acc.freight_value += toNumber(row.freight_value);
    acc.late_count += toNumber(row.late_count);
    acc.severe_delay_count += toNumber(row.severe_delay_count);
    acc.delivery_days_sum += toNumber(row.delivery_days_sum);
    acc.delivery_days_count += toNumber(row.delivery_days_count);
    acc.delay_days_sum += toNumber(row.delay_days_sum);
    acc.delay_days_count += toNumber(row.delay_days_count);
    acc.review_score_sum += toNumber(row.review_score_sum);
    acc.review_count += toNumber(row.review_count);
    acc.one_star_count += toNumber(row.one_star_count);
    acc.low_score_count += toNumber(row.low_score_count);
  });

  return Array.from(map.values()).map((row) => ({
    ...row,
    on_time_rate: safeDiv(row.order_count - row.late_count, row.order_count),
    severe_delay_rate: safeDiv(row.severe_delay_count, row.order_count),
    avg_delivery_days: safeDiv(row.delivery_days_sum, row.delivery_days_count),
    avg_delay_days: safeDiv(row.delay_days_sum, row.delay_days_count),
    avg_freight_to_gmv_ratio: safeDiv(row.freight_value, row.gmv),
    avg_review_score: safeDiv(row.review_score_sum, row.review_count),
    low_score_rate: safeDiv(row.low_score_count, row.review_count),
  }));
}

function aggregateByPayment(rows) {
  const map = new Map();
  rows.forEach((row) => {
    const key = row.payment_type;
    if (!map.has(key)) {
      map.set(key, { payment_type: key, order_count: 0, gmv: 0 });
    }
    const acc = map.get(key);
    acc.order_count += toNumber(row.order_count);
    acc.gmv += toNumber(row.gmv);
  });
  return Array.from(map.values()).sort((a, b) => b.order_count - a.order_count);
}

function aggregateCategory(rows) {
  const map = new Map();
  rows.forEach((row) => {
    const key = row.product_category;
    if (!map.has(key)) {
      map.set(key, {
        product_category: key,
        item_count: 0,
        order_count: 0,
        category_gmv: 0,
        category_freight: 0,
        contribution_margin_proxy: 0,
      });
    }
    const acc = map.get(key);
    acc.item_count += toNumber(row.item_count);
    acc.order_count += toNumber(row.order_count);
    acc.category_gmv += toNumber(row.category_gmv);
    acc.category_freight += toNumber(row.category_freight);
    acc.contribution_margin_proxy += toNumber(row.contribution_margin_proxy);
  });
  return Array.from(map.values())
    .map((row) => ({
      ...row,
      avg_item_price: safeDiv(row.category_gmv, row.item_count),
    }))
    .sort((a, b) => b.category_gmv - a.category_gmv);
}

function aggregateDelayBucket(rows) {
  const map = new Map();
  rows.forEach((row) => {
    const key = row.delay_bucket;
    if (!map.has(key)) {
      map.set(key, {
        delay_bucket: key,
        order_count: 0,
        review_score_sum: 0,
        review_count: 0,
        one_star_count: 0,
        low_score_count: 0,
      });
    }
    const acc = map.get(key);
    acc.order_count += toNumber(row.order_count);
    acc.review_score_sum += toNumber(row.review_score_sum);
    acc.review_count += toNumber(row.review_count);
    acc.one_star_count += toNumber(row.one_star_count);
    acc.low_score_count += toNumber(row.low_score_count);
  });

  return Array.from(map.values())
    .map((row) => ({
      ...row,
      avg_review_score: safeDiv(row.review_score_sum, row.review_count),
      one_star_rate: safeDiv(row.one_star_count, row.review_count),
      low_score_rate: safeDiv(row.low_score_count, row.review_count),
    }))
    .sort(
      (a, b) => DELAY_BUCKET_ORDER.indexOf(a.delay_bucket) - DELAY_BUCKET_ORDER.indexOf(b.delay_bucket)
    );
}

function aggregateReviewDistribution(rows) {
  const map = new Map();
  rows.forEach((row) => {
    const key = Number(row.review_score);
    if (!map.has(key)) {
      map.set(key, { review_score: key, review_count: 0 });
    }
    map.get(key).review_count += toNumber(row.review_count);
  });
  return Array.from(map.values()).sort((a, b) => a.review_score - b.review_score);
}

function aggregateStatePayment(rows) {
  const map = new Map();
  rows.forEach((row) => {
    const key = `${row.customer_state}|${row.payment_type}`;
    if (!map.has(key)) {
      map.set(key, {
        customer_state: row.customer_state,
        payment_type: row.payment_type,
        order_count: 0,
        review_count: 0,
        low_score_count: 0,
      });
    }
    const acc = map.get(key);
    acc.order_count += toNumber(row.order_count);
    acc.review_count += toNumber(row.review_count);
    acc.low_score_count += toNumber(row.low_score_count);
  });
  return Array.from(map.values()).map((row) => ({
    ...row,
    low_score_rate: safeDiv(row.low_score_count, row.review_count),
  }));
}

function computeOverallMetrics(periodRows) {
  if (periodRows.length === 0) {
    return {
      total_gmv: null,
      total_orders: null,
      aov: null,
      on_time_rate: null,
      avg_delivery_days: null,
      avg_delay_days: null,
      freight_to_gmv_ratio: null,
      avg_review_score: null,
      one_star_rate: null,
      low_score_rate: null,
    };
  }

  const total = periodRows.reduce(
    (acc, row) => {
      acc.gmv += row.gmv;
      acc.order_count += row.order_count;
      acc.freight_value += row.freight_value;
      acc.late_count += row.late_count;
      acc.delivery_days_sum += row.delivery_days_sum;
      acc.delivery_days_count += row.delivery_days_count;
      acc.delay_days_sum += row.delay_days_sum;
      acc.delay_days_count += row.delay_days_count;
      acc.review_score_sum += row.review_score_sum;
      acc.review_count += row.review_count;
      acc.one_star_count += row.one_star_count;
      acc.low_score_count += row.low_score_count;
      return acc;
    },
    {
      gmv: 0,
      order_count: 0,
      freight_value: 0,
      late_count: 0,
      delivery_days_sum: 0,
      delivery_days_count: 0,
      delay_days_sum: 0,
      delay_days_count: 0,
      review_score_sum: 0,
      review_count: 0,
      one_star_count: 0,
      low_score_count: 0,
    }
  );

  return {
    total_gmv: total.gmv,
    total_orders: total.order_count,
    aov: safeDiv(total.gmv, total.order_count),
    on_time_rate: safeDiv(total.order_count - total.late_count, total.order_count),
    avg_delivery_days: safeDiv(total.delivery_days_sum, total.delivery_days_count),
    avg_delay_days: safeDiv(total.delay_days_sum, total.delay_days_count),
    freight_to_gmv_ratio: safeDiv(total.freight_value, total.gmv),
    avg_review_score: safeDiv(total.review_score_sum, total.review_count),
    one_star_rate: safeDiv(total.one_star_count, total.review_count),
    low_score_rate: safeDiv(total.low_score_count, total.review_count),
  };
}

function computeLatestYoY(periodRows) {
  if (periodRows.length === 0) return null;
  const orderMap = new Map(periodRows.map((row) => [row.period_key, row.order_count]));
  for (let i = periodRows.length - 1; i >= 0; i -= 1) {
    const curr = periodRows[i];
    const prevKey = shiftOneYear(curr.period_key);
    const prevVal = orderMap.get(prevKey);
    if (prevVal && prevVal > 0) {
      return (curr.order_count - prevVal) / prevVal;
    }
  }
  return null;
}

function updateFilterSummary(filters, filteredOrdersCount) {
  const summary = document.getElementById("filter-summary");
  summary.textContent =
    `Date ${filters.startDate} to ${filters.endDate} | ` +
    `States ${filters.stateSet.size}/${META.states.length} | ` +
    `Payments ${filters.paymentSet.size}/${META.payment_types.length} | ` +
    `Rows ${fmtNumber(filteredOrdersCount)}`;
}

function renderExecutive(ordersPeriod, paymentAgg, categoryAgg, grain, overall) {
  document.getElementById("exec-kpi-gmv").textContent = fmtCurrency(overall.total_gmv);
  document.getElementById("exec-kpi-orders").textContent = fmtNumber(overall.total_orders);
  document.getElementById("exec-kpi-aov").textContent = fmtCurrency2(overall.aov);
  document.getElementById("exec-kpi-yoy").textContent = fmtPct(computeLatestYoY(ordersPeriod));

  if (ordersPeriod.length === 0) {
    showNoData("exec-trend-chart", "Order and GMV Trend", "No records under current filters.");
    showNoData("exec-payment-chart", "Payment Mix", "No records under current filters.");
    showNoData("exec-category-chart", "Category Performance", "No records under current filters.");
    document.getElementById("exec-insight").textContent =
      "No executive insight available for current filters.";
    return;
  }

  Plotly.newPlot(
    "exec-trend-chart",
    [
      {
        x: ordersPeriod.map((d) => d.period_label),
        y: ordersPeriod.map((d) => d.gmv),
        type: "scatter",
        mode: "lines+markers",
        name: "GMV",
      },
      {
        x: ordersPeriod.map((d) => d.period_label),
        y: ordersPeriod.map((d) => d.order_count),
        type: "scatter",
        mode: "lines+markers",
        name: "Orders",
        yaxis: "y2",
      },
    ],
    {
      title: `GMV and Order Trend (${grain})`,
      yaxis: { title: "GMV (BRL)" },
      yaxis2: { title: "Orders", overlaying: "y", side: "right" },
      margin: { t: 45, r: 20, l: 40, b: 60 },
      legend: { orientation: "h" },
    },
    { responsive: true }
  );

  Plotly.newPlot(
    "exec-payment-chart",
    [
      {
        labels: paymentAgg.map((d) => d.payment_type),
        values: paymentAgg.map((d) => d.order_count),
        type: "pie",
        hole: 0.42,
      },
    ],
    {
      title: "Payment Mix by Filtered Orders",
      margin: { t: 45, r: 10, l: 10, b: 10 },
    },
    { responsive: true }
  );

  const topCategories = categoryAgg.slice(0, 12);
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

  const topCategory = topCategories[0];
  const topPayment = paymentAgg[0];
  const insight = document.getElementById("exec-insight");
  if (topCategory && topPayment) {
    insight.innerHTML =
      `<strong>Executive insight:</strong> Under current filters, <strong>${topCategory.product_category}</strong> ` +
      `is the largest category by contribution proxy (${fmtCurrency(topCategory.contribution_margin_proxy)}), while ` +
      `<strong>${topPayment.payment_type}</strong> is the dominant payment method (` +
      `${fmtPct(safeDiv(topPayment.order_count, overall.total_orders))} of orders).`;
  } else {
    insight.textContent = "Executive insight unavailable for current filters.";
  }
}

function renderOps(ordersPeriod, stateAgg, geoRows, grain, overall) {
  document.getElementById("ops-kpi-delivery").textContent =
    overall.avg_delivery_days === null ? "N/A" : overall.avg_delivery_days.toFixed(2);
  document.getElementById("ops-kpi-ontime").textContent = fmtPct(overall.on_time_rate);
  document.getElementById("ops-kpi-freight").textContent = fmtPct(overall.freight_to_gmv_ratio);

  if (stateAgg.length === 0) {
    showNoData("ops-map-chart", "State Bottleneck Map", "No records under current filters.");
    showNoData("ops-delay-chart", "Top Delay States", "No records under current filters.");
    showNoData("ops-trend-chart", "Operations Trend", "No records under current filters.");
    document.getElementById("ops-insight").textContent =
      "No operations insight available for current filters.";
    return;
  }

  const geoMap = {};
  geoRows.forEach((g) => {
    geoMap[g.customer_state] = g;
  });
  const mapRows = stateAgg
    .map((row) => ({
      ...row,
      geo_lat: geoMap[row.customer_state]?.geo_lat,
      geo_lng: geoMap[row.customer_state]?.geo_lng,
    }))
    .filter((row) => row.geo_lat !== undefined && row.geo_lng !== undefined);

  if (mapRows.length > 0) {
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
              `${d.customer_state}<br>Severe delay: ${fmtPct(
                d.severe_delay_rate
              )}<br>On-time: ${fmtPct(d.on_time_rate)}<br>Orders: ${fmtNumber(d.order_count)}`
          ),
          hoverinfo: "text",
          marker: {
            size: mapRows.map((d) => Math.max(8, Math.sqrt(d.order_count / 8))),
            color: mapRows.map((d) => d.severe_delay_rate),
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
        margin: { t: 45, r: 10, l: 10, b: 10 },
      },
      { responsive: true }
    );
  } else {
    showNoData("ops-map-chart", "State Bottleneck Map", "No geolocation points for current filters.");
  }

  const topDelay = [...stateAgg]
    .sort((a, b) => (b.severe_delay_rate || 0) - (a.severe_delay_rate || 0))
    .slice(0, 12);
  Plotly.newPlot(
    "ops-delay-chart",
    [
      {
        x: topDelay.map((d) => d.customer_state),
        y: topDelay.map((d) => d.severe_delay_rate),
        type: "bar",
        marker: { color: "#dc2626" },
      },
    ],
    {
      title: "Top States by Severe Delay Rate",
      yaxis: { title: "Severe Delay Rate", tickformat: ".0%" },
      margin: { t: 45, r: 20, l: 40, b: 60 },
    },
    { responsive: true }
  );

  Plotly.newPlot(
    "ops-trend-chart",
    [
      {
        x: ordersPeriod.map((d) => d.period_label),
        y: ordersPeriod.map((d) => d.avg_delivery_days),
        type: "scatter",
        mode: "lines+markers",
        name: "Avg Delivery Days",
      },
      {
        x: ordersPeriod.map((d) => d.period_label),
        y: ordersPeriod.map((d) => d.avg_delay_days),
        type: "scatter",
        mode: "lines+markers",
        name: "Avg Delay Days",
      },
      {
        x: ordersPeriod.map((d) => d.period_label),
        y: ordersPeriod.map((d) => d.on_time_rate),
        type: "scatter",
        mode: "lines+markers",
        name: "On-Time Rate",
        yaxis: "y2",
      },
    ],
    {
      title: `Operations Trend (${grain})`,
      yaxis: { title: "Days" },
      yaxis2: { title: "On-Time Rate", overlaying: "y", side: "right", tickformat: ".0%" },
      margin: { t: 45, r: 20, l: 40, b: 60 },
      legend: { orientation: "h" },
    },
    { responsive: true }
  );

  const worstState = topDelay[0];
  const opsInsight = document.getElementById("ops-insight");
  if (worstState) {
    opsInsight.innerHTML =
      `<strong>Operations insight:</strong> <strong>${worstState.customer_state}</strong> is the current bottleneck ` +
      `with severe-delay rate ${fmtPct(worstState.severe_delay_rate)} and on-time rate ${fmtPct(
        worstState.on_time_rate
      )}. Prioritize carrier SLA and route optimization in this state.`;
  } else {
    opsInsight.textContent = "Operations insight unavailable for current filters.";
  }
}

function renderCsat(delayBucketAgg, reviewDistAgg, statePaymentAgg, overall) {
  document.getElementById("csat-kpi-score").textContent =
    overall.avg_review_score === null ? "N/A" : overall.avg_review_score.toFixed(2);
  document.getElementById("csat-kpi-one-star").textContent = fmtPct(overall.one_star_rate);
  document.getElementById("csat-kpi-low-score").textContent = fmtPct(overall.low_score_rate);

  if (reviewDistAgg.length === 0) {
    showNoData("csat-review-chart", "Review Distribution", "No records under current filters.");
    showNoData("csat-delay-chart", "Delay vs Sentiment", "No records under current filters.");
    showNoData("csat-heatmap-chart", "Low-Score Heatmap", "No records under current filters.");
    document.getElementById("csat-insight").textContent =
      "No customer-satisfaction insight available for current filters.";
    return;
  }

  Plotly.newPlot(
    "csat-review-chart",
    [
      {
        x: reviewDistAgg.map((d) => d.review_score),
        y: reviewDistAgg.map((d) => d.review_count),
        type: "bar",
        marker: { color: "#16a34a" },
      },
    ],
    {
      title: "Review Score Distribution",
      xaxis: { title: "Review Score" },
      yaxis: { title: "Count" },
      margin: { t: 45, r: 20, l: 40, b: 50 },
    },
    { responsive: true }
  );

  Plotly.newPlot(
    "csat-delay-chart",
    [
      {
        x: delayBucketAgg.map((d) => d.delay_bucket),
        y: delayBucketAgg.map((d) => d.avg_review_score),
        type: "bar",
        name: "Avg Review Score",
      },
      {
        x: delayBucketAgg.map((d) => d.delay_bucket),
        y: delayBucketAgg.map((d) => d.one_star_rate),
        type: "scatter",
        mode: "lines+markers",
        name: "One-Star Rate",
        yaxis: "y2",
      },
      {
        x: delayBucketAgg.map((d) => d.delay_bucket),
        y: delayBucketAgg.map((d) => d.low_score_rate),
        type: "scatter",
        mode: "lines+markers",
        name: "Low-Score Rate",
        yaxis: "y2",
      },
    ],
    {
      title: "Delay Bucket vs Customer Sentiment",
      yaxis: { title: "Avg Review Score" },
      yaxis2: { title: "Rate", overlaying: "y", side: "right", tickformat: ".0%" },
      margin: { t: 45, r: 20, l: 40, b: 70 },
      legend: { orientation: "h" },
    },
    { responsive: true }
  );

  const states = [...new Set(statePaymentAgg.map((d) => d.customer_state))].sort();
  const payments = [...new Set(statePaymentAgg.map((d) => d.payment_type))].sort();
  const heatMatrix = states.map((state) =>
    payments.map((payment) => {
      const row = statePaymentAgg.find(
        (x) => x.customer_state === state && x.payment_type === payment
      );
      return row ? row.low_score_rate : null;
    })
  );

  Plotly.newPlot(
    "csat-heatmap-chart",
    [
      {
        type: "heatmap",
        x: payments,
        y: states,
        z: heatMatrix,
        colorscale: "Reds",
        colorbar: { title: "Low-Score Rate" },
      },
    ],
    {
      title: "Low-Score Rate Heatmap by State and Payment Type",
      xaxis: { title: "Payment Type" },
      yaxis: { title: "State" },
      margin: { t: 45, r: 20, l: 60, b: 90 },
    },
    { responsive: true }
  );

  const over5 = delayBucketAgg.find((d) => d.delay_bucket === "late_over_5_days");
  const onTime = delayBucketAgg.find((d) => d.delay_bucket === "on_time_or_early");
  const csatInsight = document.getElementById("csat-insight");
  if (over5 && onTime) {
    const lift = safeDiv(over5.one_star_rate, onTime.one_star_rate);
    csatInsight.innerHTML =
      `<strong>CSAT insight:</strong> For this filter scope, orders delayed over 5 days have ` +
      `${fmtPct(over5.one_star_rate)} one-star rate vs ${fmtPct(onTime.one_star_rate)} for on-time/early orders` +
      (lift ? ` (${lift.toFixed(1)}x higher).` : ".");
  } else {
    csatInsight.textContent = "CSAT insight unavailable for current filters.";
  }
}

function applyAndRender() {
  const filters = getCurrentFilters();

  const filteredOrders = RAW_DATA.orders_base.filter((row) => rowPassesFilter(row, filters));
  const filteredCategory = RAW_DATA.category_base.filter((row) =>
    rowPassesFilter(row, filters)
  );
  const filteredDelay = RAW_DATA.delay_bucket_base.filter((row) =>
    rowPassesFilter(row, filters)
  );
  const filteredReview = RAW_DATA.review_score_base.filter((row) =>
    rowPassesFilter(row, filters)
  );

  updateFilterSummary(filters, filteredOrders.length);

  const ordersPeriod = aggregateByPeriod(filteredOrders, filters.grain);
  const overall = computeOverallMetrics(ordersPeriod);
  const paymentAgg = aggregateByPayment(filteredOrders);
  const categoryAgg = aggregateCategory(filteredCategory);
  const stateAgg = aggregateByState(filteredOrders);
  const delayBucketAgg = aggregateDelayBucket(filteredDelay);
  const reviewDistAgg = aggregateReviewDistribution(filteredReview);
  const statePaymentAgg = aggregateStatePayment(filteredOrders);

  renderExecutive(ordersPeriod, paymentAgg, categoryAgg, filters.grain, overall);
  renderOps(ordersPeriod, stateAgg, RAW_DATA.state_geo, filters.grain, overall);
  renderCsat(delayBucketAgg, reviewDistAgg, statePaymentAgg, overall);
}

function resetFilters() {
  document.getElementById("filter-country").value = "Brazil";
  document.getElementById("filter-grain").value = "month";
  document.getElementById("filter-start-date").value = META.min_date;
  document.getElementById("filter-end-date").value = META.max_date;
  selectAllOptions(document.getElementById("filter-states"));
  selectAllOptions(document.getElementById("filter-payments"));
}

function initializeFilters(meta) {
  const startInput = document.getElementById("filter-start-date");
  const endInput = document.getElementById("filter-end-date");
  startInput.min = meta.min_date;
  startInput.max = meta.max_date;
  endInput.min = meta.min_date;
  endInput.max = meta.max_date;
  startInput.value = meta.min_date;
  endInput.value = meta.max_date;

  fillMultiSelect(document.getElementById("filter-states"), meta.states);
  fillMultiSelect(document.getElementById("filter-payments"), meta.payment_types);
}

async function loadData() {
  const response = await fetch("./data/dashboard_data.json");
  if (!response.ok) {
    throw new Error(`Failed to load data package: ${response.status}`);
  }
  return response.json();
}

async function init() {
  activateTabs();
  try {
    RAW_DATA = await loadData();
    META = RAW_DATA.meta;
    initializeFilters(META);

    document
      .getElementById("apply-filters-btn")
      .addEventListener("click", () => applyAndRender());
    document.getElementById("reset-filters-btn").addEventListener("click", () => {
      resetFilters();
      applyAndRender();
    });
    document.getElementById("filter-grain").addEventListener("change", () => applyAndRender());

    document.getElementById(
      "last-updated"
    ).textContent = `Data package generated at ${RAW_DATA.generated_at} (UTC). Use Ctrl/Cmd + click for multi-select filters.`;

    applyAndRender();
  } catch (error) {
    console.error(error);
    alert(
      "Dashboard failed to load packaged data. Please regenerate web_dashboard_static/data/dashboard_data.json."
    );
  }
}

init();
