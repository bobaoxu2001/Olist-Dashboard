# Power BI Build Guide

## 1) Load data

### Option A: DuckDB (recommended)
- Use an ODBC DuckDB connector and load `mart` views/tables.

### Option B: Flat files
- Import CSV or Parquet files from `data/exports`.

## 2) Create report pages

## Page 1 - Executive Summary

Visuals:
- KPI cards: GMV, Orders, AOV, YoY Growth.
- Line chart: monthly GMV + orders (`vw_exec_summary_monthly`).
- Donut chart: payment mix (`vw_exec_payment_mix`).
- Bar chart: category contribution proxy (`vw_exec_category_performance`).

Suggested slicers:
- Month
- Product category
- Payment type

## Page 2 - Supply Chain & Operations

Visuals:
- KPI cards: Avg Delivery Days, On-Time Rate, Freight/GMV Ratio.
- Filled map: `customer_state` with `severe_delay_rate` from `vw_ops_state_bottlenecks`.
- Scatter: state-level `avg_delay_days` vs `avg_freight_to_gmv_ratio`.
- Trend line: monthly operations metrics from `vw_ops_monthly_logistics`.

## Page 3 - Customer Satisfaction

Visuals:
- Histogram/column: review distribution.
- Clustered bar: `delay_bucket` vs `avg_review_score` and `one_star_rate`.
- Heatmap: `customer_state` x `payment_type` low score rate (`vw_csat_state_payment_driver`).

Key message:
- highlight whether `late_over_5_days` has the worst one-star and low-score rates.

## 3) DAX measures (if needed)

If you import row-level fact tables, add:

```DAX
GMV = SUM(fact_orders[gmv])
Orders = DISTINCTCOUNT(fact_orders[order_id])
AOV = DIVIDE([GMV], [Orders])
OnTimeRate = 1 - AVERAGE(fact_orders[is_late_delivery])
OneStarRate = AVERAGEX(fact_orders, IF(fact_orders[review_score] = 1, 1, 0))
```

When importing pre-aggregated views, prefer direct fields to reduce report complexity.
