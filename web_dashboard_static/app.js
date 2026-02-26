let RAW_DATA = null;
let META = null;

const APP_STATE = {
  selectedCategory: null,
  selectedState: null,
  selectedCell: null,
};

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

function fmtFixed(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) return "N/A";
  return Number(value).toFixed(digits);
}

function safeDiv(a, b) {
  if (!b) return null;
  return a / b;
}

function clampInt(value, minVal, maxVal, fallback) {
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(maxVal, Math.max(minVal, n));
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

function selectAllOptions(selectEl) {
  Array.from(selectEl.options).forEach((option) => {
    option.selected = true;
  });
}

function setSelectValues(selectEl, values) {
  const valueSet = new Set(values);
  Array.from(selectEl.options).forEach((option) => {
    option.selected = valueSet.has(option.value);
  });
}

function setTab(tabId) {
  const buttons = document.querySelectorAll(".tab-btn");
  const panels = document.querySelectorAll(".tab-panel");
  buttons.forEach((b) => b.classList.remove("active"));
  panels.forEach((p) => p.classList.remove("active"));
  const targetBtn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
  if (targetBtn) targetBtn.classList.add("active");
  const targetPanel = document.getElementById(tabId);
  if (targetPanel) targetPanel.classList.add("active");
  window.dispatchEvent(new Event("resize"));
}

function activateTabs() {
  const buttons = document.querySelectorAll(".tab-btn");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => setTab(btn.dataset.tab));
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

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderDetailTable(containerId, columns, rows, emptyMessage) {
  const container = document.getElementById(containerId);
  if (!rows || rows.length === 0) {
    container.innerHTML = `<div class="empty-note">${escapeHtml(emptyMessage)}</div>`;
    return;
  }

  const headerHtml = columns
    .map((col) => `<th>${escapeHtml(col.label)}</th>`)
    .join("");
  const bodyHtml = rows
    .map((row) => {
      const tds = columns
        .map((col) => {
          const raw = row[col.key];
          const display = col.format ? col.format(raw) : raw;
          return `<td>${escapeHtml(display === null || display === undefined ? "N/A" : display)}</td>`;
        })
        .join("");
      return `<tr>${tds}</tr>`;
    })
    .join("");

  container.innerHTML = `
    <div class="detail-table-wrap">
      <table class="detail-table">
        <thead><tr>${headerHtml}</tr></thead>
        <tbody>${bodyHtml}</tbody>
      </table>
    </div>
  `;
}

function getUiConfig() {
  const execRankMode = document.getElementById("exec-rank-mode").value;
  const opsRankMode = document.getElementById("ops-rank-mode").value;
  const execTopN = clampInt(document.getElementById("exec-top-n").value, 3, 30, 12);
  const opsTopN = clampInt(document.getElementById("ops-top-n").value, 3, 30, 12);

  document.getElementById("exec-top-n").value = String(execTopN);
  document.getElementById("ops-top-n").value = String(opsTopN);

  return { execRankMode, opsRankMode, execTopN, opsTopN };
}

function getCurrentFilters() {
  const country = document.getElementById("filter-country").value;
  const grain = document.getElementById("filter-grain").value;
  const startInput = document.getElementById("filter-start-date");
  const endInput = document.getElementById("filter-end-date");
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

  let startDate = startInput.value || META.min_date;
  let endDate = endInput.value || META.max_date;
  if (startDate > endDate) {
    const tmp = startDate;
    startDate = endDate;
    endDate = tmp;
    startInput.value = startDate;
    endInput.value = endDate;
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

function getRankedRows(rows, metricKey, mode, n) {
  const ranked = [...rows].filter((row) => row[metricKey] !== null && row[metricKey] !== undefined);
  ranked.sort((a, b) => toNumber(a[metricKey]) - toNumber(b[metricKey]));
  if (mode === "top") ranked.reverse();
  return ranked.slice(0, n);
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
        payment_installments_sum: 0,
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
    acc.payment_installments_sum += toNumber(row.payment_installments_sum);
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
      avg_installments: safeDiv(row.payment_installments_sum, row.order_count),
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

function aggregateBySellerForState(rows, state) {
  const map = new Map();
  rows.filter((row) => row.customer_state === state).forEach((row) => {
    const key = row.seller_state || "UNKNOWN";
    if (!map.has(key)) {
      map.set(key, { seller_state: key, order_count: 0, severe_delay_count: 0 });
    }
    const acc = map.get(key);
    acc.order_count += toNumber(row.order_count);
    acc.severe_delay_count += toNumber(row.severe_delay_count);
  });
  return Array.from(map.values())
    .map((row) => ({
      ...row,
      severe_delay_rate: safeDiv(row.severe_delay_count, row.order_count),
    }))
    .sort((a, b) => toNumber(b.severe_delay_rate) - toNumber(a.severe_delay_rate));
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
        weight_g_sum: 0,
        volume_cm3_sum: 0,
        review_score_sum: 0,
        review_count: 0,
      });
    }
    const acc = map.get(key);
    acc.item_count += toNumber(row.item_count);
    acc.order_count += toNumber(row.order_count);
    acc.category_gmv += toNumber(row.category_gmv);
    acc.category_freight += toNumber(row.category_freight);
    acc.contribution_margin_proxy += toNumber(row.contribution_margin_proxy);
    acc.weight_g_sum += toNumber(row.weight_g_sum);
    acc.volume_cm3_sum += toNumber(row.volume_cm3_sum);
    acc.review_score_sum += toNumber(row.review_score_sum);
    acc.review_count += toNumber(row.review_count);
  });
  return Array.from(map.values())
    .map((row) => ({
      ...row,
      avg_item_price: safeDiv(row.category_gmv, row.item_count),
      avg_weight_g: safeDiv(row.weight_g_sum, row.item_count),
      avg_volume_cm3: safeDiv(row.volume_cm3_sum, row.item_count),
      avg_review_score: safeDiv(row.review_score_sum, row.review_count),
    }))
    .sort((a, b) => b.category_gmv - a.category_gmv);
}

function aggregateCategoryByState(rows, selectedCategory) {
  const map = new Map();
  rows
    .filter((row) => row.product_category === selectedCategory)
    .forEach((row) => {
      const key = row.customer_state;
      if (!map.has(key)) {
        map.set(key, {
          customer_state: key,
          order_count: 0,
          category_gmv: 0,
          contribution_margin_proxy: 0,
          item_count: 0,
          review_score_sum: 0,
          review_count: 0,
          weight_g_sum: 0,
        });
      }
      const acc = map.get(key);
      acc.order_count += toNumber(row.order_count);
      acc.category_gmv += toNumber(row.category_gmv);
      acc.contribution_margin_proxy += toNumber(row.contribution_margin_proxy);
      acc.item_count += toNumber(row.item_count);
      acc.review_score_sum += toNumber(row.review_score_sum);
      acc.review_count += toNumber(row.review_count);
      acc.weight_g_sum += toNumber(row.weight_g_sum);
    });

  return Array.from(map.values()).map((row) => ({
    ...row,
    avg_item_price: safeDiv(row.category_gmv, row.item_count),
    avg_review_score: safeDiv(row.review_score_sum, row.review_count),
    avg_weight_kg: safeDiv(row.weight_g_sum, row.item_count ? row.item_count * 1000 : 0),
  }));
}

function aggregateStateByCategory(rows, selectedState) {
  const map = new Map();
  rows
    .filter((row) => row.customer_state === selectedState)
    .forEach((row) => {
      const key = row.product_category;
      if (!map.has(key)) {
        map.set(key, {
          product_category: key,
          order_count: 0,
          category_gmv: 0,
          contribution_margin_proxy: 0,
          item_count: 0,
          review_score_sum: 0,
          review_count: 0,
          weight_g_sum: 0,
        });
      }
      const acc = map.get(key);
      acc.order_count += toNumber(row.order_count);
      acc.category_gmv += toNumber(row.category_gmv);
      acc.contribution_margin_proxy += toNumber(row.contribution_margin_proxy);
      acc.item_count += toNumber(row.item_count);
      acc.review_score_sum += toNumber(row.review_score_sum);
      acc.review_count += toNumber(row.review_count);
      acc.weight_g_sum += toNumber(row.weight_g_sum);
    });

  return Array.from(map.values()).map((row) => ({
    ...row,
    avg_item_price: safeDiv(row.category_gmv, row.item_count),
    avg_review_score: safeDiv(row.review_score_sum, row.review_count),
    avg_weight_kg: safeDiv(row.weight_g_sum, row.item_count ? row.item_count * 1000 : 0),
  }));
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
    if (!map.has(key)) map.set(key, { review_score: key, review_count: 0 });
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
  return Array.from(map.values())
    .map((row) => ({
      ...row,
      low_score_rate: safeDiv(row.low_score_count, row.review_count),
    }))
    .sort((a, b) => toNumber(b.low_score_rate) - toNumber(a.low_score_rate));
}

function computeOverallMetrics(periodRows) {
  if (periodRows.length === 0) {
    return {
      total_gmv: null,
      total_orders: null,
      aov: null,
      avg_installments: null,
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
      acc.payment_installments_sum += row.payment_installments_sum;
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
      payment_installments_sum: 0,
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
    avg_installments: safeDiv(total.payment_installments_sum, total.order_count),
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
    if (prevVal && prevVal > 0) return (curr.order_count - prevVal) / prevVal;
  }
  return null;
}

function updateFilterSummary(filters, filteredOrderRows) {
  const summary = document.getElementById("filter-summary");
  summary.textContent =
    `Date ${filters.startDate} to ${filters.endDate} | ` +
    `States ${filters.stateSet.size}/${META.states.length} | ` +
    `Payments ${filters.paymentSet.size}/${META.payment_types.length} | ` +
    `Grouped rows ${fmtNumber(filteredOrderRows.length)}`;
}

function attachClickHandler(divId, handler) {
  const div = document.getElementById(divId);
  if (!div) return;
  if (typeof div.removeAllListeners === "function") {
    div.removeAllListeners("plotly_click");
  }
  div.on("plotly_click", handler);
}

function renderExecutive(aggregates, uiConfig, grain) {
  const { ordersPeriod, overall, paymentAgg, categoryAgg, categoryByStateRows } = aggregates;
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
    renderDetailTable(
      "exec-drilldown-table",
      [],
      [],
      "No category drill-down rows under current filters."
    );
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

  const rankedCategories = getRankedRows(
    categoryAgg,
    "contribution_margin_proxy",
    uiConfig.execRankMode,
    uiConfig.execTopN
  );
  if (!APP_STATE.selectedCategory || !categoryAgg.some((r) => r.product_category === APP_STATE.selectedCategory)) {
    APP_STATE.selectedCategory = rankedCategories[0]?.product_category || null;
  }
  const barColors = rankedCategories.map((row) =>
    row.product_category === APP_STATE.selectedCategory ? "#1d4ed8" : "#3b82f6"
  );
  Plotly.newPlot(
    "exec-category-chart",
    [
      {
        x: rankedCategories.map((d) => d.product_category),
        y: rankedCategories.map((d) => d.contribution_margin_proxy),
        type: "bar",
        marker: { color: barColors },
      },
    ],
    {
      title: `${uiConfig.execRankMode === "top" ? "Top" : "Bottom"} ${uiConfig.execTopN} Categories by Contribution Margin`,
      xaxis: { title: "Category" },
      yaxis: { title: "Contribution Margin Proxy" },
      margin: { t: 50, r: 20, l: 40, b: 120 },
    },
    { responsive: true }
  );
  attachClickHandler("exec-category-chart", (evt) => {
    const clicked = evt?.points?.[0]?.x;
    if (clicked) {
      APP_STATE.selectedCategory = clicked;
      applyAndRender();
    }
  });

  const topCategory = rankedCategories[0];
  const topPayment = paymentAgg[0];
  const insight = document.getElementById("exec-insight");
  if (topCategory && topPayment) {
    insight.innerHTML =
      `<strong>Executive insight:</strong> ${uiConfig.execRankMode === "top" ? "Leading" : "Weakest"} category is ` +
      `<strong>${topCategory.product_category}</strong> (contribution ${fmtCurrency(
        topCategory.contribution_margin_proxy
      )}). Dominant payment method is <strong>${topPayment.payment_type}</strong> (` +
      `${fmtPct(safeDiv(topPayment.order_count, overall.total_orders))} of orders). ` +
      `Average installments in scope: ${fmtFixed(overall.avg_installments, 2)}.`;
  } else {
    insight.textContent = "Executive insight unavailable for current filters.";
  }

  const selectedCategoryRows = getRankedRows(
    categoryByStateRows,
    "contribution_margin_proxy",
    "top",
    15
  );
  document.getElementById("exec-selected-category").textContent = APP_STATE.selectedCategory
    ? `Selected category: ${APP_STATE.selectedCategory}`
    : "Click a category bar to inspect state-level detail.";
  renderDetailTable(
    "exec-drilldown-table",
    [
      { key: "customer_state", label: "State" },
      { key: "order_count", label: "Orders", format: fmtNumber },
      { key: "category_gmv", label: "Category GMV", format: fmtCurrency },
      { key: "contribution_margin_proxy", label: "Contribution", format: fmtCurrency },
      { key: "avg_item_price", label: "Avg Item Price", format: fmtCurrency2 },
      { key: "avg_review_score", label: "Avg Review", format: (v) => fmtFixed(v, 2) },
      { key: "avg_weight_kg", label: "Avg Weight (kg)", format: (v) => fmtFixed(v, 2) },
    ],
    selectedCategoryRows,
    "No state-level rows for selected category."
  );
}

function renderOps(aggregates, uiConfig, grain) {
  const {
    ordersPeriod,
    overall,
    stateAgg,
    stateGeo,
    stateByCategoryRows,
    sellerRiskRows,
  } = aggregates;
  document.getElementById("ops-kpi-delivery").textContent =
    overall.avg_delivery_days === null ? "N/A" : overall.avg_delivery_days.toFixed(2);
  document.getElementById("ops-kpi-ontime").textContent = fmtPct(overall.on_time_rate);
  document.getElementById("ops-kpi-freight").textContent = fmtPct(overall.freight_to_gmv_ratio);

  if (stateAgg.length === 0) {
    showNoData("ops-map-chart", "State Bottleneck Map", "No records under current filters.");
    showNoData("ops-delay-chart", "State Delay Ranking", "No records under current filters.");
    showNoData("ops-trend-chart", "Operations Trend", "No records under current filters.");
    document.getElementById("ops-insight").textContent =
      "No operations insight available for current filters.";
    renderDetailTable(
      "ops-drilldown-table",
      [],
      [],
      "No state drill-down rows under current filters."
    );
    return;
  }

  const rankedStates = getRankedRows(
    stateAgg,
    "severe_delay_rate",
    uiConfig.opsRankMode,
    uiConfig.opsTopN
  );
  if (!APP_STATE.selectedState || !stateAgg.some((r) => r.customer_state === APP_STATE.selectedState)) {
    APP_STATE.selectedState = rankedStates[0]?.customer_state || null;
  }

  const geoMap = {};
  stateGeo.forEach((g) => {
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
          customdata: mapRows.map((d) => d.customer_state),
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
    attachClickHandler("ops-map-chart", (evt) => {
      const state = evt?.points?.[0]?.customdata;
      if (state) {
        APP_STATE.selectedState = state;
        applyAndRender();
      }
    });
  } else {
    showNoData("ops-map-chart", "State Bottleneck Map", "No geolocation points for current filters.");
  }

  const barColors = rankedStates.map((row) =>
    row.customer_state === APP_STATE.selectedState ? "#991b1b" : "#ef4444"
  );
  Plotly.newPlot(
    "ops-delay-chart",
    [
      {
        x: rankedStates.map((d) => d.customer_state),
        y: rankedStates.map((d) => d.severe_delay_rate),
        type: "bar",
        marker: { color: barColors },
      },
    ],
    {
      title: `${uiConfig.opsRankMode === "top" ? "Top" : "Bottom"} ${uiConfig.opsTopN} States by Severe Delay Rate`,
      yaxis: { title: "Severe Delay Rate", tickformat: ".0%" },
      margin: { t: 45, r: 20, l: 40, b: 60 },
    },
    { responsive: true }
  );
  attachClickHandler("ops-delay-chart", (evt) => {
    const state = evt?.points?.[0]?.x;
    if (state) {
      APP_STATE.selectedState = state;
      applyAndRender();
    }
  });

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

  const selectedStateDetail = getRankedRows(stateByCategoryRows, "contribution_margin_proxy", "top", 15);
  document.getElementById("ops-selected-state").textContent = APP_STATE.selectedState
    ? `Selected state: ${APP_STATE.selectedState}`
    : "Click a state on the bar chart or map to inspect category detail.";
  renderDetailTable(
    "ops-drilldown-table",
    [
      { key: "product_category", label: "Category" },
      { key: "order_count", label: "Orders", format: fmtNumber },
      { key: "category_gmv", label: "Category GMV", format: fmtCurrency },
      { key: "contribution_margin_proxy", label: "Contribution", format: fmtCurrency },
      { key: "avg_item_price", label: "Avg Item Price", format: fmtCurrency2 },
      { key: "avg_review_score", label: "Avg Review", format: (v) => fmtFixed(v, 2) },
      { key: "avg_weight_kg", label: "Avg Weight (kg)", format: (v) => fmtFixed(v, 2) },
    ],
    selectedStateDetail,
    "No category rows for selected state."
  );

  const selectedStateAgg = stateAgg.find((row) => row.customer_state === APP_STATE.selectedState);
  const highestRiskSeller = sellerRiskRows[0];
  const opsInsight = document.getElementById("ops-insight");
  if (selectedStateAgg) {
    opsInsight.innerHTML =
      `<strong>Operations insight:</strong> Selected state <strong>${selectedStateAgg.customer_state}</strong> ` +
      `has severe-delay rate ${fmtPct(selectedStateAgg.severe_delay_rate)} and on-time rate ${fmtPct(
        selectedStateAgg.on_time_rate
      )}. ` +
      (highestRiskSeller
        ? `Highest-risk seller lane is seller state <strong>${highestRiskSeller.seller_state}</strong> (${fmtPct(
            highestRiskSeller.severe_delay_rate
          )} severe delay).`
        : "");
  } else {
    opsInsight.textContent = "Operations insight unavailable for current filters.";
  }
}

function renderCsat(aggregates) {
  const { overall, delayBucketAgg, reviewDistAgg, statePaymentAgg, orderDetailRows } = aggregates;
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
    renderDetailTable("csat-drilldown-table", [], [], "No CSAT detail rows under current filters.");
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
  attachClickHandler("csat-heatmap-chart", (evt) => {
    const state = evt?.points?.[0]?.y;
    const payment = evt?.points?.[0]?.x;
    if (state && payment) {
      APP_STATE.selectedCell = { state, payment };
      applyAndRender();
    }
  });

  if (
    !APP_STATE.selectedCell ||
    !statePaymentAgg.some(
      (row) =>
        row.customer_state === APP_STATE.selectedCell.state &&
        row.payment_type === APP_STATE.selectedCell.payment
    )
  ) {
    const fallback = statePaymentAgg.find((row) => toNumber(row.order_count) >= 25) || statePaymentAgg[0];
    APP_STATE.selectedCell = fallback
      ? { state: fallback.customer_state, payment: fallback.payment_type }
      : null;
  }

  const selectedRows = APP_STATE.selectedCell
    ? orderDetailRows
        .filter(
          (row) =>
            row.customer_state === APP_STATE.selectedCell.state &&
            row.payment_type === APP_STATE.selectedCell.payment
        )
        .sort((a, b) => toNumber(b.delay_days) - toNumber(a.delay_days))
        .slice(0, 20)
    : [];
  document.getElementById("csat-selected-cell").textContent = APP_STATE.selectedCell
    ? `Selected cell: ${APP_STATE.selectedCell.state} × ${APP_STATE.selectedCell.payment}`
    : "Click the heatmap to inspect selected state/payment risk detail.";
  renderDetailTable(
    "csat-drilldown-table",
    [
      { key: "order_id", label: "Order ID" },
      { key: "purchase_date", label: "Date" },
      { key: "top_product_category", label: "Top Category" },
      { key: "seller_state", label: "Seller State" },
      { key: "delay_days", label: "Delay Days", format: (v) => fmtFixed(v, 1) },
      { key: "delivery_days", label: "Delivery Days", format: (v) => fmtFixed(v, 1) },
      { key: "review_score", label: "Review", format: (v) => fmtFixed(v, 0) },
      { key: "gmv", label: "GMV", format: fmtCurrency2 },
    ],
    selectedRows,
    "No order-level CSAT detail rows for selected state/payment."
  );

  const over5 = delayBucketAgg.find((d) => d.delay_bucket === "late_over_5_days");
  const onTime = delayBucketAgg.find((d) => d.delay_bucket === "on_time_or_early");
  const selectedCellAgg = APP_STATE.selectedCell
    ? statePaymentAgg.find(
        (row) =>
          row.customer_state === APP_STATE.selectedCell.state &&
          row.payment_type === APP_STATE.selectedCell.payment
      )
    : null;
  const csatInsight = document.getElementById("csat-insight");
  if (over5 && onTime) {
    const lift = safeDiv(over5.one_star_rate, onTime.one_star_rate);
    csatInsight.innerHTML =
      `<strong>CSAT insight:</strong> delayed over 5 days -> one-star ${fmtPct(
        over5.one_star_rate
      )}, on-time/early -> ${fmtPct(onTime.one_star_rate)}` +
      (lift ? ` (${lift.toFixed(1)}x higher). ` : ". ") +
      (selectedCellAgg
        ? `Selected risk cell ${APP_STATE.selectedCell.state} × ${APP_STATE.selectedCell.payment}: ` +
          `${fmtPct(selectedCellAgg.low_score_rate)} low-score rate over ${fmtNumber(
            selectedCellAgg.order_count
          )} orders.`
        : "");
  } else {
    csatInsight.textContent = "CSAT insight unavailable for current filters.";
  }
}

function buildAggregates(filters) {
  const filteredOrders = RAW_DATA.orders_base.filter((row) => rowPassesFilter(row, filters));
  const filteredCategory = RAW_DATA.category_base.filter((row) => rowPassesFilter(row, filters));
  const filteredDelay = RAW_DATA.delay_bucket_base.filter((row) => rowPassesFilter(row, filters));
  const filteredReview = RAW_DATA.review_score_base.filter((row) => rowPassesFilter(row, filters));
  const filteredOrderDetail = RAW_DATA.order_detail_base.filter((row) =>
    rowPassesFilter(row, filters)
  );

  const ordersPeriod = aggregateByPeriod(filteredOrders, filters.grain);
  const overall = computeOverallMetrics(ordersPeriod);
  const paymentAgg = aggregateByPayment(filteredOrders);
  const categoryAgg = aggregateCategory(filteredCategory);
  const stateAgg = aggregateByState(filteredOrders);
  const delayBucketAgg = aggregateDelayBucket(filteredDelay);
  const reviewDistAgg = aggregateReviewDistribution(filteredReview);
  const statePaymentAgg = aggregateStatePayment(filteredOrders);

  const categoryByStateRows = APP_STATE.selectedCategory
    ? aggregateCategoryByState(filteredCategory, APP_STATE.selectedCategory)
    : [];
  const stateByCategoryRows = APP_STATE.selectedState
    ? aggregateStateByCategory(filteredCategory, APP_STATE.selectedState)
    : [];
  const sellerRiskRows = APP_STATE.selectedState
    ? aggregateBySellerForState(filteredOrders, APP_STATE.selectedState)
    : [];

  return {
    filteredOrdersCount: filteredOrders.length,
    ordersPeriod,
    overall,
    paymentAgg,
    categoryAgg,
    stateAgg,
    delayBucketAgg,
    reviewDistAgg,
    statePaymentAgg,
    orderDetailRows: filteredOrderDetail,
    categoryByStateRows,
    stateByCategoryRows,
    sellerRiskRows,
    stateGeo: RAW_DATA.state_geo,
  };
}

function applyAndRender() {
  const filters = getCurrentFilters();
  const uiConfig = getUiConfig();
  const aggregates = buildAggregates(filters);
  updateFilterSummary(filters, aggregates.filteredOrdersCount);

  if (!APP_STATE.selectedCategory && aggregates.categoryAgg.length > 0) {
    APP_STATE.selectedCategory = aggregates.categoryAgg[0].product_category;
    aggregates.categoryByStateRows = aggregateCategoryByState(
      RAW_DATA.category_base.filter((row) => rowPassesFilter(row, filters)),
      APP_STATE.selectedCategory
    );
  }
  if (!APP_STATE.selectedState && aggregates.stateAgg.length > 0) {
    APP_STATE.selectedState = aggregates.stateAgg[0].customer_state;
    aggregates.stateByCategoryRows = aggregateStateByCategory(
      RAW_DATA.category_base.filter((row) => rowPassesFilter(row, filters)),
      APP_STATE.selectedState
    );
    aggregates.sellerRiskRows = aggregateBySellerForState(
      RAW_DATA.orders_base.filter((row) => rowPassesFilter(row, filters)),
      APP_STATE.selectedState
    );
  }

  renderExecutive(aggregates, uiConfig, filters.grain);
  renderOps(aggregates, uiConfig, filters.grain);
  renderCsat(aggregates);
}

function resetFilters() {
  document.getElementById("filter-country").value = "Brazil";
  document.getElementById("filter-grain").value = "month";
  document.getElementById("filter-start-date").value = META.min_date;
  document.getElementById("filter-end-date").value = META.max_date;
  selectAllOptions(document.getElementById("filter-states"));
  selectAllOptions(document.getElementById("filter-payments"));
  document.getElementById("exec-rank-mode").value = "top";
  document.getElementById("ops-rank-mode").value = "top";
  document.getElementById("exec-top-n").value = "12";
  document.getElementById("ops-top-n").value = "12";
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

function getWorstStateGlobal() {
  const byState = aggregateByState(RAW_DATA.orders_base);
  const candidates = byState.filter((row) => toNumber(row.order_count) >= 80);
  const target = (candidates.length > 0 ? candidates : byState).sort(
    (a, b) => toNumber(b.severe_delay_rate) - toNumber(a.severe_delay_rate)
  )[0];
  return target?.customer_state || null;
}

function getHighestRiskCellGlobal() {
  const byStatePayment = aggregateStatePayment(RAW_DATA.orders_base);
  const candidates = byStatePayment.filter((row) => toNumber(row.order_count) >= 60);
  const target = (candidates.length > 0 ? candidates : byStatePayment).sort(
    (a, b) => toNumber(b.low_score_rate) - toNumber(a.low_score_rate)
  )[0];
  if (!target) return null;
  return { state: target.customer_state, payment: target.payment_type };
}

function applyStoryline(mode) {
  resetFilters();
  APP_STATE.selectedCategory = null;
  APP_STATE.selectedState = null;
  APP_STATE.selectedCell = null;

  if (mode === "exec") {
    setTab("exec-tab");
    document.getElementById("filter-grain").value = "month";
  } else if (mode === "ops") {
    setTab("ops-tab");
    document.getElementById("filter-grain").value = "month";
    const worstState = getWorstStateGlobal();
    if (worstState) {
      setSelectValues(document.getElementById("filter-states"), [worstState]);
      APP_STATE.selectedState = worstState;
    }
  } else if (mode === "csat") {
    setTab("csat-tab");
    document.getElementById("filter-grain").value = "month";
    const riskCell = getHighestRiskCellGlobal();
    if (riskCell) {
      setSelectValues(document.getElementById("filter-states"), [riskCell.state]);
      setSelectValues(document.getElementById("filter-payments"), [riskCell.payment]);
      APP_STATE.selectedCell = riskCell;
    }
  } else {
    setTab("exec-tab");
  }

  applyAndRender();
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

    document.getElementById("apply-filters-btn").addEventListener("click", () => applyAndRender());
    document.getElementById("reset-filters-btn").addEventListener("click", () => {
      resetFilters();
      APP_STATE.selectedCategory = null;
      APP_STATE.selectedState = null;
      APP_STATE.selectedCell = null;
      applyAndRender();
    });
    document.getElementById("filter-grain").addEventListener("change", () => applyAndRender());
    document.getElementById("exec-rank-mode").addEventListener("change", () => applyAndRender());
    document.getElementById("ops-rank-mode").addEventListener("change", () => applyAndRender());
    document.getElementById("exec-top-n").addEventListener("change", () => applyAndRender());
    document.getElementById("ops-top-n").addEventListener("change", () => applyAndRender());

    document.getElementById("story-exec-btn").addEventListener("click", () => applyStoryline("exec"));
    document.getElementById("story-ops-btn").addEventListener("click", () => applyStoryline("ops"));
    document.getElementById("story-csat-btn").addEventListener("click", () => applyStoryline("csat"));
    document.getElementById("story-reset-btn").addEventListener("click", () => applyStoryline("reset"));

    document.getElementById(
      "last-updated"
    ).textContent = `Data package generated at ${RAW_DATA.generated_at} (UTC). Ctrl/Cmd + click for multi-select filters.`;

    applyAndRender();
  } catch (error) {
    console.error(error);
    alert(
      "Dashboard failed to load packaged data. Please regenerate web_dashboard_static/data/dashboard_data.json."
    );
  }
}

init();
