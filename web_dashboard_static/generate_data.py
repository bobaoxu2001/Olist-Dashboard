"""Build packaged JSON data for the interactive static dashboard."""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List

import duckdb
import pandas as pd


BASE_CLEAN_ORDERS_CTE = """
WITH clean_orders AS (
    SELECT
        f.order_id,
        t.full_date AS purchase_date,
        COALESCE(f.customer_state, 'UNKNOWN') AS customer_state,
        COALESCE(f.primary_seller_state, 'UNKNOWN') AS seller_state,
        COALESCE(f.main_payment_type, 'unknown') AS payment_type,
        'Brazil' AS country,
        f.gmv,
        f.freight_value,
        COALESCE(f.payment_installments, 0) AS payment_installments,
        f.is_late_delivery,
        f.delay_days,
        f.delivery_days,
        f.review_score
    FROM mart.fact_orders f
    JOIN mart.dim_time t
      ON f.purchase_date_key = t.date_key
    WHERE f.purchase_date_key IS NOT NULL
      AND COALESCE(f.order_status, 'unknown') NOT IN ('canceled', 'unavailable')
)
"""


QUERY_MAP = {
    "orders_base": (
        BASE_CLEAN_ORDERS_CTE
        + """
        SELECT
            purchase_date,
            customer_state,
            seller_state,
            payment_type,
            country,
            COUNT(*) AS order_count,
            SUM(gmv) AS gmv,
            SUM(freight_value) AS freight_value,
            SUM(payment_installments) AS payment_installments_sum,
            SUM(CASE WHEN is_late_delivery = 1 THEN 1 ELSE 0 END) AS late_count,
            SUM(CASE WHEN delay_days >= 5 THEN 1 ELSE 0 END) AS severe_delay_count,
            SUM(COALESCE(delivery_days, 0)) AS delivery_days_sum,
            SUM(CASE WHEN delivery_days IS NOT NULL THEN 1 ELSE 0 END) AS delivery_days_count,
            SUM(COALESCE(delay_days, 0)) AS delay_days_sum,
            SUM(CASE WHEN delay_days IS NOT NULL THEN 1 ELSE 0 END) AS delay_days_count,
            SUM(CASE WHEN review_score IS NOT NULL THEN review_score ELSE 0 END) AS review_score_sum,
            SUM(CASE WHEN review_score IS NOT NULL THEN 1 ELSE 0 END) AS review_count,
            SUM(CASE WHEN review_score = 1 THEN 1 ELSE 0 END) AS one_star_count,
            SUM(CASE WHEN review_score <= 2 AND review_score IS NOT NULL THEN 1 ELSE 0 END) AS low_score_count
        FROM clean_orders
        GROUP BY purchase_date, customer_state, seller_state, payment_type, country
        ORDER BY purchase_date, customer_state, seller_state, payment_type
        """
    ),
    "category_base": (
        BASE_CLEAN_ORDERS_CTE
        + """
        SELECT
            co.purchase_date,
            co.customer_state,
            co.payment_type,
            co.country,
            COALESCE(foi.product_category, 'unknown') AS product_category,
            COUNT(*) AS item_count,
            COUNT(DISTINCT foi.order_id) AS order_count,
            SUM(COALESCE(foi.item_price, 0)) AS category_gmv,
            SUM(COALESCE(foi.item_freight_value, 0)) AS category_freight,
            SUM(COALESCE(foi.item_contribution_margin_proxy, 0)) AS contribution_margin_proxy,
            SUM(COALESCE(dp.product_weight_g, 0)) AS weight_g_sum,
            SUM(CASE WHEN co.review_score IS NOT NULL THEN co.review_score ELSE 0 END) AS review_score_sum,
            SUM(CASE WHEN co.review_score IS NOT NULL THEN 1 ELSE 0 END) AS review_count
        FROM mart.fact_order_items foi
        JOIN clean_orders co
          ON foi.order_id = co.order_id
        LEFT JOIN mart.dim_product dp
          ON foi.product_sk = dp.product_sk
        GROUP BY
            co.purchase_date,
            co.customer_state,
            co.payment_type,
            co.country,
            COALESCE(foi.product_category, 'unknown')
        ORDER BY co.purchase_date, co.customer_state, co.payment_type
        """
    ),
    "delay_bucket_base": (
        BASE_CLEAN_ORDERS_CTE
        + """
        SELECT
            purchase_date,
            customer_state,
            payment_type,
            country,
            CASE
                WHEN delay_days IS NULL THEN 'unknown'
                WHEN delay_days <= 0 THEN 'on_time_or_early'
                WHEN delay_days BETWEEN 1 AND 2 THEN 'late_1_2_days'
                WHEN delay_days BETWEEN 3 AND 5 THEN 'late_3_5_days'
                ELSE 'late_over_5_days'
            END AS delay_bucket,
            COUNT(*) AS order_count,
            SUM(CASE WHEN review_score IS NOT NULL THEN review_score ELSE 0 END) AS review_score_sum,
            SUM(CASE WHEN review_score IS NOT NULL THEN 1 ELSE 0 END) AS review_count,
            SUM(CASE WHEN review_score = 1 THEN 1 ELSE 0 END) AS one_star_count,
            SUM(CASE WHEN review_score <= 2 AND review_score IS NOT NULL THEN 1 ELSE 0 END) AS low_score_count
        FROM clean_orders
        GROUP BY purchase_date, customer_state, payment_type, country, delay_bucket
        ORDER BY purchase_date, customer_state, payment_type
        """
    ),
    "review_score_base": (
        BASE_CLEAN_ORDERS_CTE
        + """
        SELECT
            purchase_date,
            customer_state,
            payment_type,
            country,
            review_score,
            COUNT(*) AS review_count
        FROM clean_orders
        WHERE review_score IS NOT NULL
        GROUP BY purchase_date, customer_state, payment_type, country, review_score
        ORDER BY purchase_date, customer_state, payment_type, review_score
        """
    ),
    "order_detail_base": (
        BASE_CLEAN_ORDERS_CTE
        + """
        , order_top_category AS (
            SELECT
                oi.order_id,
                COALESCE(oi.product_category, 'unknown') AS top_product_category,
                SUM(COALESCE(oi.item_price, 0)) AS category_gmv,
                ROW_NUMBER() OVER (
                    PARTITION BY oi.order_id
                    ORDER BY SUM(COALESCE(oi.item_price, 0)) DESC, COALESCE(oi.product_category, 'unknown')
                ) AS rn
            FROM mart.fact_order_items oi
            GROUP BY oi.order_id, COALESCE(oi.product_category, 'unknown')
        )
        SELECT
            co.order_id,
            co.purchase_date,
            co.customer_state,
            co.seller_state,
            co.payment_type,
            co.country,
            co.gmv,
            co.freight_value,
            co.payment_installments,
            co.delivery_days,
            co.delay_days,
            co.review_score,
            COALESCE(otc.top_product_category, 'unknown') AS top_product_category
        FROM clean_orders co
        LEFT JOIN order_top_category otc
          ON co.order_id = otc.order_id
         AND otc.rn = 1
        WHERE co.delay_days >= 5
           OR COALESCE(co.review_score, 5) <= 2
           OR MOD(HASH(co.order_id), 100) < 8
        ORDER BY co.purchase_date, co.order_id
        """
    ),
    "state_geo": """
        SELECT
            customer_state,
            'Brazil' AS country,
            geo_lat,
            geo_lng
        FROM mart.vw_state_geo_centroid
        ORDER BY customer_state
    """,
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate JSON package for interactive static dashboard."
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
    for col_name in normalized.columns:
        if pd.api.types.is_datetime64_any_dtype(normalized[col_name]):
            normalized[col_name] = normalized[col_name].dt.strftime("%Y-%m-%d")
        elif pd.api.types.is_float_dtype(normalized[col_name]):
            normalized[col_name] = normalized[col_name].round(4)
    return json.loads(normalized.to_json(orient="records", date_format="iso"))


def build_meta(orders_base_records: List[dict]) -> Dict[str, object]:
    if not orders_base_records:
        return {
            "countries": ["Brazil"],
            "min_date": None,
            "max_date": None,
            "states": [],
            "seller_states": [],
            "categories": [],
            "payment_types": [],
        }

    dates = sorted({str(row["purchase_date"])[:10] for row in orders_base_records})
    states = sorted({row["customer_state"] for row in orders_base_records})
    seller_states = sorted({row["seller_state"] for row in orders_base_records})
    payment_types = sorted({row["payment_type"] for row in orders_base_records})
    return {
        "countries": ["Brazil"],
        "min_date": dates[0],
        "max_date": dates[-1],
        "states": states,
        "seller_states": seller_states,
        "categories": [],
        "payment_types": payment_types,
    }


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

    payload["meta"] = build_meta(payload["orders_base"])
    payload["meta"]["categories"] = sorted(
        {row["product_category"] for row in payload.get("category_base", [])}
    )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, separators=(",", ":"), allow_nan=False)

    print(f"[done] wrote dashboard data package: {output_path}")


if __name__ == "__main__":
    main()
