# Static Public Dashboard (No Streamlit Cloud Required)

This dashboard is a static website that can be opened directly from a CDN link.

## Included interactions

- Date granularity switch: **Daily / Monthly / Yearly**
- Date range filter: start/end date
- State multi-select filter
- Payment type multi-select filter
- Cross-tab synchronized filters (Executive / Ops / CSAT update together)
- KPI cards + dynamic insight cards recomputed per filter scope

## Why this exists

If `share.streamlit.io` is blocked for your current network/IP, this static site
provides a public online dashboard without requiring Streamlit Community Cloud.

## Build data package

1. Ensure warehouse exists:

```bash
python3 ETL_Scripts/run_pipeline.py --raw-dir data/raw --db-path data/warehouse/olist.duckdb --export-dir data/exports
```

2. Generate packaged JSON:

```bash
python3 web_dashboard_static/generate_data.py \
  --db-path data/warehouse/olist.duckdb \
  --output-path web_dashboard_static/data/dashboard_data.json
```

## Open online

After pushing to GitHub main branch, open:

```text
https://cdn.jsdelivr.net/gh/bobaoxu2001/Olist-Dashboard@main/web_dashboard_static/index.html
```

This serves the dashboard directly from jsDelivr using your GitHub repo.

If jsDelivr caches an older `@main`, use commit-pinned URL format:

```text
https://cdn.jsdelivr.net/gh/bobaoxu2001/Olist-Dashboard@<commit_sha>/web_dashboard_static/index.html
```

Alternative CDN:

```text
https://rawcdn.githack.com/bobaoxu2001/Olist-Dashboard/<commit_sha>/web_dashboard_static/index.html
```
