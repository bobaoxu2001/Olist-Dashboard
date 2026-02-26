# Tableau Build Guide

## Data connection

Use either:
- DuckDB mart tables/views, or
- exported files under `data/exports`.

## Worksheet mapping

## Executive Summary
- `Exec_KPI_Cards` from `vw_exec_summary_monthly`
- `Exec_Monthly_Trend` from `vw_exec_summary_monthly`
- `Exec_Payment_Mix` from `vw_exec_payment_mix`
- `Exec_Category_Perf` from `vw_exec_category_performance`

## Operations
- `Ops_State_Map` from `vw_ops_state_bottlenecks`
- `Ops_Logistics_Trend` from `vw_ops_monthly_logistics`
- `Ops_State_Scatter` from `vw_ops_state_bottlenecks`

## Customer Satisfaction
- `CSAT_Delay_Impact` from `vw_csat_delay_impact`
- `CSAT_State_Payment_Heatmap` from `vw_csat_state_payment_driver`

## Dashboard actions

- Add global date filter (month_start / purchase month).
- Add click action from state map to state detail sheet.
- Add highlight action from delay bucket to review score details.

## Formatting tips

- Keep number formats consistent:
  - ratios as percentages with 1 decimal.
  - financial metrics in BRL notation (if desired).
- Use red color scale for severe delay and low score risk.
