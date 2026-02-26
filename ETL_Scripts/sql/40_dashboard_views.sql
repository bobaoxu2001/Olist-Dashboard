-- 40_dashboard_views.sql
-- Dashboard-ready semantic views.

CREATE OR REPLACE VIEW mart.vw_exec_summary_monthly AS
WITH monthly AS (
    SELECT
        DATE_TRUNC('month', t.full_date)::DATE AS month_start,
        SUM(f.gmv) AS gmv,
        COUNT(*) AS order_count,
        SUM(f.gmv) / NULLIF(COUNT(*), 0) AS aov,
        AVG(f.payment_installments) AS avg_payment_installments
    FROM mart.fact_orders f
    LEFT JOIN mart.dim_time t
        ON f.purchase_date_key = t.date_key
    WHERE COALESCE(f.order_status, 'unknown') NOT IN ('canceled', 'unavailable')
      AND f.purchase_date_key IS NOT NULL
    GROUP BY DATE_TRUNC('month', t.full_date)::DATE
)
SELECT
    month_start,
    gmv,
    order_count,
    aov,
    avg_payment_installments,
    LAG(order_count, 12) OVER (ORDER BY month_start) AS prior_year_order_count,
    CASE
        WHEN LAG(order_count, 12) OVER (ORDER BY month_start) IS NULL THEN NULL
        WHEN LAG(order_count, 12) OVER (ORDER BY month_start) = 0 THEN NULL
        ELSE
            (order_count - LAG(order_count, 12) OVER (ORDER BY month_start))
            / LAG(order_count, 12) OVER (ORDER BY month_start)
    END AS yoy_order_growth_pct
FROM monthly
ORDER BY month_start;

CREATE OR REPLACE VIEW mart.vw_exec_payment_mix AS
SELECT
    main_payment_type AS payment_type,
    COUNT(*) AS order_count,
    SUM(gmv) AS gmv,
    SUM(payment_value) AS payment_value,
    COUNT(*)::DOUBLE / NULLIF(SUM(COUNT(*)) OVER (), 0) AS order_share_pct
FROM mart.fact_orders
WHERE COALESCE(order_status, 'unknown') NOT IN ('canceled', 'unavailable')
GROUP BY main_payment_type
ORDER BY order_count DESC;

CREATE OR REPLACE VIEW mart.vw_exec_category_performance AS
SELECT
    COALESCE(product_category, 'unknown') AS product_category,
    COUNT(DISTINCT order_id) AS order_count,
    SUM(item_price) AS category_gmv,
    SUM(item_freight_value) AS category_freight,
    SUM(item_contribution_margin_proxy) AS contribution_margin_proxy,
    AVG(item_price) AS avg_item_price
FROM mart.fact_order_items
GROUP BY COALESCE(product_category, 'unknown')
ORDER BY category_gmv DESC;

CREATE OR REPLACE VIEW mart.vw_ops_state_bottlenecks AS
SELECT
    COALESCE(customer_state, 'UNKNOWN') AS customer_state,
    COUNT(*) AS order_count,
    AVG(delivery_days) AS avg_delivery_days,
    AVG(delay_days) AS avg_delay_days,
    1 - AVG(CASE WHEN is_late_delivery = 1 THEN 1.0 ELSE 0.0 END) AS on_time_rate,
    AVG(freight_to_gmv_ratio) AS avg_freight_to_gmv_ratio,
    AVG(CASE WHEN delay_days >= 5 THEN 1.0 ELSE 0.0 END) AS severe_delay_rate
FROM mart.fact_orders
WHERE delivery_days IS NOT NULL
GROUP BY COALESCE(customer_state, 'UNKNOWN')
ORDER BY severe_delay_rate DESC, avg_delay_days DESC;

CREATE OR REPLACE VIEW mart.vw_ops_monthly_logistics AS
SELECT
    DATE_TRUNC('month', t.full_date)::DATE AS month_start,
    COUNT(*) AS order_count,
    AVG(f.delivery_days) AS avg_delivery_days,
    AVG(f.delay_days) AS avg_delay_days,
    1 - AVG(CASE WHEN f.is_late_delivery = 1 THEN 1.0 ELSE 0.0 END) AS on_time_rate,
    AVG(f.freight_to_gmv_ratio) AS avg_freight_to_gmv_ratio
FROM mart.fact_orders f
LEFT JOIN mart.dim_time t
    ON f.purchase_date_key = t.date_key
WHERE f.purchase_date_key IS NOT NULL
  AND f.delivery_days IS NOT NULL
GROUP BY DATE_TRUNC('month', t.full_date)::DATE
ORDER BY month_start;

CREATE OR REPLACE VIEW mart.vw_csat_delay_impact AS
WITH bucketed AS (
    SELECT
        CASE
            WHEN delay_days IS NULL THEN 'unknown'
            WHEN delay_days <= 0 THEN 'on_time_or_early'
            WHEN delay_days BETWEEN 1 AND 2 THEN 'late_1_2_days'
            WHEN delay_days BETWEEN 3 AND 5 THEN 'late_3_5_days'
            ELSE 'late_over_5_days'
        END AS delay_bucket,
        review_score
    FROM mart.fact_orders
    WHERE review_score IS NOT NULL
)
SELECT
    delay_bucket,
    COUNT(*) AS review_count,
    AVG(review_score) AS avg_review_score,
    AVG(CASE WHEN review_score = 1 THEN 1.0 ELSE 0.0 END) AS one_star_rate,
    AVG(CASE WHEN review_score <= 2 THEN 1.0 ELSE 0.0 END) AS low_score_rate
FROM bucketed
GROUP BY delay_bucket
ORDER BY
    CASE delay_bucket
        WHEN 'on_time_or_early' THEN 1
        WHEN 'late_1_2_days' THEN 2
        WHEN 'late_3_5_days' THEN 3
        WHEN 'late_over_5_days' THEN 4
        ELSE 5
    END;

CREATE OR REPLACE VIEW mart.vw_csat_state_payment_driver AS
SELECT
    COALESCE(customer_state, 'UNKNOWN') AS customer_state,
    COALESCE(main_payment_type, 'unknown') AS payment_type,
    COUNT(*) AS order_count,
    AVG(delay_days) AS avg_delay_days,
    AVG(review_score) AS avg_review_score,
    AVG(CASE WHEN review_score <= 2 THEN 1.0 ELSE 0.0 END) AS low_score_rate
FROM mart.fact_orders
WHERE review_score IS NOT NULL
GROUP BY
    COALESCE(customer_state, 'UNKNOWN'),
    COALESCE(main_payment_type, 'unknown')
ORDER BY order_count DESC;

CREATE OR REPLACE VIEW mart.vw_review_distribution AS
SELECT
    review_score,
    COUNT(*) AS review_count
FROM mart.fact_orders
WHERE review_score IS NOT NULL
GROUP BY review_score
ORDER BY review_score;

CREATE OR REPLACE VIEW mart.vw_state_geo_centroid AS
SELECT
    customer_state,
    AVG(geo_lat) AS geo_lat,
    AVG(geo_lng) AS geo_lng
FROM mart.dim_customer
WHERE customer_state IS NOT NULL
  AND geo_lat IS NOT NULL
  AND geo_lng IS NOT NULL
GROUP BY customer_state;

CREATE OR REPLACE VIEW mart.vw_csat_kpis AS
SELECT
    AVG(review_score) AS avg_review_score,
    AVG(CASE WHEN review_score = 1 THEN 1.0 ELSE 0.0 END) AS one_star_rate,
    AVG(CASE WHEN review_score <= 2 THEN 1.0 ELSE 0.0 END) AS low_score_rate
FROM mart.fact_orders
WHERE review_score IS NOT NULL;
