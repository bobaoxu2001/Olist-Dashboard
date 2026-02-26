# Static Public Dashboard (No Streamlit Cloud Required)

This dashboard is a static website that can be opened directly from a CDN link.

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
