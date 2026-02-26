"""Run lightweight validations against the built warehouse."""

from __future__ import annotations

import argparse
from pathlib import Path

import duckdb


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Validate Olist warehouse models.")
    parser.add_argument(
        "--db-path",
        default="data/warehouse/olist.duckdb",
        help="DuckDB database file created by run_pipeline.py",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    db_path = Path(args.db_path)
    if not db_path.exists():
        raise FileNotFoundError(f"Warehouse file not found: {db_path.resolve()}")

    conn = duckdb.connect(database=str(db_path))
    try:
        required_objects = [
            "mart.dim_customer",
            "mart.dim_product",
            "mart.dim_time",
            "mart.dim_review",
            "mart.dim_seller",
            "mart.fact_orders",
            "mart.fact_order_items",
            "mart.vw_exec_summary_monthly",
            "mart.vw_ops_state_bottlenecks",
            "mart.vw_csat_delay_impact",
            "mart.data_quality_checks",
        ]

        for object_name in required_objects:
            conn.execute(f"SELECT 1 FROM {object_name} LIMIT 1;")
            print(f"[ok] object exists and queryable: {object_name}")

        failed = conn.execute(
            """
            SELECT check_name, observed_value
            FROM mart.data_quality_checks
            WHERE passed = FALSE
            ORDER BY check_name
            """
        ).fetchall()
        if failed:
            print("[fail] data quality checks:")
            for check_name, observed_value in failed:
                print(f" - {check_name}: {observed_value}")
            raise RuntimeError("Quality check failures detected.")

        null_purchase_dates = conn.execute(
            "SELECT COUNT(*) FROM mart.fact_orders WHERE purchase_date_key IS NULL"
        ).fetchone()[0]
        print(f"[ok] null purchase_date_key count = {null_purchase_dates}")

        print("[done] warehouse validation successful")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
