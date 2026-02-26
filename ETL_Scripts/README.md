# ETL Scripts

This folder contains the pipeline that builds the Olist warehouse from raw CSV files.

## Prerequisites

- Python 3.10+
- CSV files in `data/raw/` (see `data/README.md`)

Install dependencies:

```bash
python3 -m pip install -r ETL_Scripts/requirements.txt
```

## Run full pipeline

```bash
python3 ETL_Scripts/run_pipeline.py \
  --raw-dir data/raw \
  --db-path data/warehouse/olist.duckdb \
  --export-dir data/exports
```

## Validate warehouse

```bash
python3 ETL_Scripts/validate_warehouse.py --db-path data/warehouse/olist.duckdb
```

## SQL model order

1. `sql/10_staging.sql`
2. `sql/20_dimensions.sql`
3. `sql/30_facts.sql`
4. `sql/40_dashboard_views.sql`
5. `sql/50_quality_checks.sql`
