"""Build the Olist warehouse and export dashboard-ready datasets."""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import Iterable

import duckdb


RAW_FILE_TO_TABLE = {
    "olist_customers_dataset.csv": "customers",
    "olist_geolocation_dataset.csv": "geolocation",
    "olist_order_items_dataset.csv": "order_items",
    "olist_order_payments_dataset.csv": "order_payments",
    "olist_order_reviews_dataset.csv": "order_reviews",
    "olist_orders_dataset.csv": "orders",
    "olist_products_dataset.csv": "products",
    "olist_sellers_dataset.csv": "sellers",
    "product_category_name_translation.csv": "product_category_name_translation",
}

SQL_MODEL_FILES = [
    "10_staging.sql",
    "20_dimensions.sql",
    "30_facts.sql",
    "40_dashboard_views.sql",
    "50_quality_checks.sql",
]

EXPORT_OBJECTS = [
    "mart.dim_customer",
    "mart.dim_product",
    "mart.dim_review",
    "mart.dim_seller",
    "mart.dim_time",
    "mart.fact_orders",
    "mart.fact_order_items",
    "mart.vw_exec_summary_monthly",
    "mart.vw_exec_payment_mix",
    "mart.vw_exec_category_performance",
    "mart.vw_ops_state_bottlenecks",
    "mart.vw_ops_monthly_logistics",
    "mart.vw_csat_delay_impact",
    "mart.vw_csat_state_payment_driver",
    "mart.vw_review_distribution",
    "mart.vw_state_geo_centroid",
    "mart.vw_csat_kpis",
    "mart.data_quality_checks",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build Olist warehouse in DuckDB.")
    parser.add_argument(
        "--raw-dir",
        default="data/raw",
        help="Directory containing Olist CSV files.",
    )
    parser.add_argument(
        "--db-path",
        default="data/warehouse/olist.duckdb",
        help="Output DuckDB file path.",
    )
    parser.add_argument(
        "--export-dir",
        default="data/exports",
        help="Output directory for BI exports (parquet + csv).",
    )
    parser.add_argument(
        "--allow-quality-failures",
        action="store_true",
        help="Do not fail the run even if quality checks fail.",
    )
    return parser.parse_args()


def quote_path(path: Path) -> str:
    return path.as_posix().replace("'", "''")


def ensure_required_files(raw_dir: Path) -> None:
    missing = [name for name in RAW_FILE_TO_TABLE if not (raw_dir / name).exists()]
    if missing:
        missing_list = "\n - ".join(missing)
        raise FileNotFoundError(
            "Missing required raw files in "
            f"{raw_dir.resolve()}:\n - {missing_list}"
        )


def create_schemas(conn: duckdb.DuckDBPyConnection) -> None:
    conn.execute("CREATE SCHEMA IF NOT EXISTS raw;")
    conn.execute("CREATE SCHEMA IF NOT EXISTS stg;")
    conn.execute("CREATE SCHEMA IF NOT EXISTS mart;")


def load_raw_tables(conn: duckdb.DuckDBPyConnection, raw_dir: Path) -> None:
    for file_name, table_name in RAW_FILE_TO_TABLE.items():
        file_path = raw_dir / file_name
        quoted_file = quote_path(file_path)
        conn.execute(
            f"""
            CREATE OR REPLACE TABLE raw.{table_name} AS
            SELECT *
            FROM read_csv_auto(
                '{quoted_file}',
                header = true,
                all_varchar = true,
                sample_size = -1
            );
            """
        )
        print(f"[raw] loaded raw.{table_name} <- {file_name}")


def execute_models(conn: duckdb.DuckDBPyConnection, model_paths: Iterable[Path]) -> None:
    for model_path in model_paths:
        sql_text = model_path.read_text(encoding="utf-8")
        conn.execute(sql_text)
        print(f"[model] executed {model_path.name}")


def export_objects(conn: duckdb.DuckDBPyConnection, export_dir: Path) -> None:
    export_dir.mkdir(parents=True, exist_ok=True)
    for object_name in EXPORT_OBJECTS:
        short_name = object_name.split(".")[1]
        parquet_path = export_dir / f"{short_name}.parquet"
        csv_path = export_dir / f"{short_name}.csv"
        quoted_parquet = quote_path(parquet_path)
        quoted_csv = quote_path(csv_path)

        conn.execute(
            f"COPY (SELECT * FROM {object_name}) TO '{quoted_parquet}' (FORMAT PARQUET);"
        )
        conn.execute(
            f"COPY (SELECT * FROM {object_name}) TO '{quoted_csv}' (HEADER, DELIMITER ',');"
        )
        print(f"[export] {object_name} -> {short_name}.parquet/.csv")


def run_quality_gate(conn: duckdb.DuckDBPyConnection, allow_failures: bool) -> None:
    failed_checks = conn.execute(
        """
        SELECT check_name, observed_value
        FROM mart.data_quality_checks
        WHERE passed = FALSE
        ORDER BY check_name
        """
    ).fetchall()

    if failed_checks:
        print("[quality] failed checks detected:")
        for check_name, observed_value in failed_checks:
            print(f" - {check_name}: {observed_value}")
        if not allow_failures:
            raise RuntimeError(
                "Warehouse quality checks failed. Re-run with "
                "--allow-quality-failures to bypass."
            )
    else:
        print("[quality] all checks passed")


def print_run_summary(conn: duckdb.DuckDBPyConnection) -> None:
    summary = conn.execute(
        """
        SELECT 'dim_customer' AS model_name, COUNT(*) AS row_count FROM mart.dim_customer
        UNION ALL
        SELECT 'dim_product', COUNT(*) FROM mart.dim_product
        UNION ALL
        SELECT 'dim_time', COUNT(*) FROM mart.dim_time
        UNION ALL
        SELECT 'dim_review', COUNT(*) FROM mart.dim_review
        UNION ALL
        SELECT 'fact_orders', COUNT(*) FROM mart.fact_orders
        UNION ALL
        SELECT 'fact_order_items', COUNT(*) FROM mart.fact_order_items
        ORDER BY model_name;
        """
    ).fetchall()

    print("[summary] row counts:")
    for model_name, row_count in summary:
        print(f" - {model_name}: {row_count}")


def main() -> None:
    args = parse_args()
    raw_dir = Path(args.raw_dir)
    db_path = Path(args.db_path)
    export_dir = Path(args.export_dir)
    sql_dir = Path(__file__).resolve().parent / "sql"

    ensure_required_files(raw_dir)
    db_path.parent.mkdir(parents=True, exist_ok=True)

    model_paths = [sql_dir / model_name for model_name in SQL_MODEL_FILES]
    for model_path in model_paths:
        if not model_path.exists():
            raise FileNotFoundError(f"Missing SQL model file: {model_path}")

    conn = duckdb.connect(database=str(db_path))
    try:
        create_schemas(conn)
        load_raw_tables(conn, raw_dir)
        execute_models(conn, model_paths)
        run_quality_gate(conn, allow_failures=args.allow_quality_failures)
        export_objects(conn, export_dir)
        print_run_summary(conn)
    finally:
        conn.close()

    print("[done] warehouse build complete")


if __name__ == "__main__":
    main()
