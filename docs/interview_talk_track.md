# Interview Talk Track (Project Story)

## 1) Problem Statement

An e-commerce platform has data spread across orders, payments, logistics, products, and reviews.  
Leadership needs one source of truth to answer:
- Where growth comes from,
- Where operations are leaking value,
- Why customer satisfaction drops.

## 2) Delivery Scope

- Integrated 9 raw CSV sources into a warehouse.
- Designed star schema with explicit facts and dimensions.
- Built dashboard-ready semantic views for 3 stakeholder perspectives:
  - Executive,
  - Operations,
  - Customer Insight.

## 3) Technical Highlights

- Layered modeling (`raw` -> `stg` -> `mart`) in DuckDB SQL.
- Reusable staging aggregates (order items, payments, review dedupe).
- Data quality checks embedded in pipeline.
- Exports for BI in parquet/csv to keep dashboard tooling flexible.

## 4) Business Insights Angle

- Identify high-value categories using contribution proxy.
- Pinpoint state-level bottlenecks with severe delay rates.
- Quantify the relationship between late delivery and one-star reviews.

## 5) Action Recommendations

- Prioritize logistics improvements in high-delay states.
- Introduce SLA alerts for orders projected to exceed +5 day delay.
- Track payment mix shifts and associated low-score rates.
