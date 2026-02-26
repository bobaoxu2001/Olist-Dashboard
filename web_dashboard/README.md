# Online Website Dashboard (Streamlit)

This directory contains a deployable web dashboard built with Streamlit.

## What it includes

- Executive Summary tab
- Supply Chain & Operations tab
- Customer Satisfaction tab

The app reads from:

1. `data/warehouse/olist.duckdb` (preferred), or
2. `data/exports/*.csv` (fallback).

## Local run

```bash
python3 -m pip install -r requirements.txt
python3 ETL_Scripts/run_pipeline.py --raw-dir data/raw --db-path data/warehouse/olist.duckdb --export-dir data/exports
streamlit run web_dashboard/app.py
```

## Deploy to Streamlit Community Cloud

1. Push repo to GitHub (already done in this project).
2. Go to https://share.streamlit.io and click **New app**.
3. Select:
   - Repository: `bobaoxu2001/Olist-Dashboard`
   - Branch: `main`
   - Main file path: `web_dashboard/app.py`
4. Deploy.

### Data for deployment

For production-like data on cloud deployment:
- include a generated DuckDB/CSV export as deployment artifact, or
- configure a secure fetch/build step in your cloud environment before startup.

Without warehouse data, the app will show a clear error message and ETL command guidance.
