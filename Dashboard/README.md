# Dashboard Delivery Package

This folder defines how to build a 3-tab BI dashboard directly from warehouse outputs.

## Data source options

1. Connect BI tool to `data/warehouse/olist.duckdb`.
2. Or import exported files from `data/exports/`:
   - `vw_exec_summary_monthly`
   - `vw_exec_payment_mix`
   - `vw_exec_category_performance`
   - `vw_ops_state_bottlenecks`
   - `vw_ops_monthly_logistics`
   - `vw_csat_delay_impact`
   - `vw_csat_state_payment_driver`

## Tabs

1. Executive Summary
2. Supply Chain & Operations
3. Customer Satisfaction

See:
- `kpi_dictionary.md`
- `powerbi_build_guide.md`
- `tableau_build_guide.md`
- `mockup_layout.md`
