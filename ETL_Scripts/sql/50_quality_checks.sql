-- 50_quality_checks.sql
-- Persist quality checks for pipeline gating and monitoring.

CREATE OR REPLACE TABLE mart.data_quality_checks AS
WITH checks AS (
    SELECT
        'fact_orders_not_empty' AS check_name,
        (SELECT COUNT(*) > 0 FROM mart.fact_orders) AS passed,
        CAST((SELECT COUNT(*) FROM mart.fact_orders) AS VARCHAR) AS observed_value
    UNION ALL
    SELECT
        'fact_order_items_not_empty',
        (SELECT COUNT(*) > 0 FROM mart.fact_order_items),
        CAST((SELECT COUNT(*) FROM mart.fact_order_items) AS VARCHAR)
    UNION ALL
    SELECT
        'fact_orders_unique_order_id',
        (
            SELECT COUNT(*) = COUNT(DISTINCT order_id)
            FROM mart.fact_orders
            WHERE order_id IS NOT NULL
        ),
        (
            SELECT
                CAST(COUNT(*) AS VARCHAR) || '/' || CAST(COUNT(DISTINCT order_id) AS VARCHAR)
            FROM mart.fact_orders
            WHERE order_id IS NOT NULL
        )
    UNION ALL
    SELECT
        'fact_orders_review_score_between_1_and_5',
        (
            SELECT COUNT(*)
            FROM mart.fact_orders
            WHERE review_score IS NOT NULL
              AND (review_score < 1 OR review_score > 5)
        ) = 0,
        CAST(
            (
                SELECT COUNT(*)
                FROM mart.fact_orders
                WHERE review_score IS NOT NULL
                  AND (review_score < 1 OR review_score > 5)
            ) AS VARCHAR
        )
    UNION ALL
    SELECT
        'fact_orders_non_negative_payment_value',
        (
            SELECT COUNT(*)
            FROM mart.fact_orders
            WHERE payment_value < 0
        ) = 0,
        CAST(
            (
                SELECT COUNT(*)
                FROM mart.fact_orders
                WHERE payment_value < 0
            ) AS VARCHAR
        )
    UNION ALL
    SELECT
        'fact_orders_customer_sk_null_ratio_lt_5pct',
        (
            SELECT
                COALESCE(SUM(CASE WHEN customer_sk IS NULL THEN 1 ELSE 0 END), 0)::DOUBLE
                / NULLIF(COUNT(*), 0)
            FROM mart.fact_orders
        ) < 0.05,
        CAST(
            (
                SELECT
                    COALESCE(SUM(CASE WHEN customer_sk IS NULL THEN 1 ELSE 0 END), 0)::DOUBLE
                    / NULLIF(COUNT(*), 0)
                FROM mart.fact_orders
            ) AS VARCHAR
        )
    UNION ALL
    SELECT
        'dim_time_not_empty',
        (SELECT COUNT(*) > 0 FROM mart.dim_time),
        CAST((SELECT COUNT(*) FROM mart.dim_time) AS VARCHAR)
)
SELECT
    check_name,
    passed,
    observed_value,
    CURRENT_TIMESTAMP AS checked_at
FROM checks
ORDER BY check_name;
