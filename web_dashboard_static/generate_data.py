"""Build packaged JSON data for static online dashboard."""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List

import duckdb
import pandas as pd


QUERY_MAP = {
    "exec_monthly": """
        SELECT month_start, gmv, order_count, aov, yoy_order_growth_pct
        FROM mart.vw_exec_summary_monthly
        ORDER BY month_start
    """,
    "exec_payment_mix": """
        SELECT payment_type, order_count, gmv, payment_value, order_share_pct
        FROM mart.vw_exec_payment_mix
    """,
    "exec_category_perf": """
        SELECT product_category, order_count, category_gmv, category_freight, contribution_margin_proxy, avg_item_price
        FROM mart.vw_exec_category_performance
        ORDER BY category_gmv DESC
    """,
    "ops_state_bottlenecks": """
        SELECT customer_state, order_count, avg_delivery_days, avg_delay_days, on_time_rate, avg_freight_to_gmv_ratio, severe_delay_rate
        FROM mart.vw_ops_state_bottlenecks
    """,
    "ops_monthly": """
        SELECT month_start, order_count, avg_delivery_days, avg_delay_days, on_time_rate, avg_freight_to_gmv_ratio
        FROM mart.vw_ops_monthly_logistics
        ORDER BY month_start
    """,
    "state_geo_centroid": """
        SELECT customer_state, geo_lat, geo_lng
        FROM mart.vw_state_geo_centroid
    """,
    "csat_delay_impact": """
        SELECT delay_bucket, review_count, avg_review_score, one_star_rate, low_score_rate
        FROM mart.vw_csat_delay_impact
    """,
    "csat_state_payment": """
        SELECT customer_state, payment_type, order_count, avg_delay_days, avg_review_score, low_score_rate
        FROM mart.vw_csat_state_payment_driver
    """,
    "review_distribution": """
        SELECT review_score, review_count
        FROM mart.vw_review_distribution
    """,
    "csat_kpis": """
        SELECT avg_review_score, one_star_rate, low_score_rate
        FROM mart.vw_csat_kpis
    """,
    "exec_kpis": """
        WITH latest_month AS (
            SELECT yoy_order_growth_pct
            FROM mart.vw_exec_summary_monthly
            WHERE yoy_order_growth_pct IS NOT NULL
            ORDER BY month_start DESC
            LIMIT 1
        )
        SELECT
            SUM(gmv) AS total_gmv,
            COUNT(*) AS total_orders,
            SUM(gmv) / NULLIF(COUNT(*), 0) AS aov,
            (SELECT yoy_order_growth_pct FROM latest_month) AS latest_yoy_order_growth_pct
        FROM mart.fact_orders
        WHERE COALESCE(order_status, 'unknown') NOT IN ('canceled', 'unavailable')
    """,
    "ops_kpis": """
        SELECT
            AVG(delivery_days) AS avg_delivery_days,
            1 - AVG(CASE WHEN is_late_delivery = 1 THEN 1.0 ELSE 0.0 END) AS on_time_rate,
            AVG(freight_to_gmv_ratio) AS avg_freight_to_gmv_ratio
        FROM mart.fact_orders
        WHERE delivery_days IS NOT NULL
    """,
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate JSON package for static dashboard."
    )
    parser.add_argument(
        "--db-path",
        default="data/warehouse/olist.duckdb",
        help="Path to warehouse DuckDB file.",
    )
    parser.add_argument(
        "--output-path",
        default="web_dashboard_static/data/dashboard_data.json",
        help="Output JSON path.",
    )
    return parser.parse_args()


def dataframe_to_records(df: pd.DataFrame) -> List[dict]:
    normalized = df.copy()
    for col in normalized.columns:
        if pd.api.types.is_datetime64_any_dtype(normalized[col]):
            normalized[col] = normalized[col].dt.strftime("%Y-%m-%d")
    normalized = normalized.where(pd.notnull(normalized), None)
    return normalized.to_dict(orient="records")


def main() -> None:
    args = parse_args()
    db_path = Path(args.db_path)
    output_path = Path(args.output_path)

    if not db_path.exists():
        raise FileNotFoundError(
            f"DuckDB warehouse file not found: {db_path}. Run ETL pipeline first."
        )

    payload: Dict[str, object] = {
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"),
    }
    with duckdb.connect(str(db_path)) as conn:
        for name, query in QUERY_MAP.items():
            payload[name] = dataframe_to_records(conn.execute(query).df())

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))

    print(f"[done] wrote dashboard data package: {output_path}")


if __name__ == "__main__":
    main()
