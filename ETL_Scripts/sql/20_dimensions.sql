-- 20_dimensions.sql
-- Build dimensional models.

CREATE OR REPLACE TABLE mart.dim_customer AS
SELECT
    ROW_NUMBER() OVER (ORDER BY c.customer_id) AS customer_sk,
    c.customer_id,
    c.customer_unique_id,
    c.customer_zip_code_prefix,
    c.customer_city,
    c.customer_state,
    g.geo_lat,
    g.geo_lng
FROM stg.customers c
LEFT JOIN stg.geolocation_lookup g
    ON c.customer_zip_code_prefix = g.geolocation_zip_code_prefix
WHERE c.customer_id IS NOT NULL;

CREATE OR REPLACE TABLE mart.dim_product AS
SELECT
    ROW_NUMBER() OVER (ORDER BY p.product_id) AS product_sk,
    p.product_id,
    LOWER(COALESCE(p.product_category, 'unknown')) AS product_category,
    p.product_name_length,
    p.product_description_length,
    p.product_photos_qty,
    p.product_weight_g,
    p.product_length_cm,
    p.product_height_cm,
    p.product_width_cm,
    CASE
        WHEN p.product_length_cm IS NOT NULL
         AND p.product_height_cm IS NOT NULL
         AND p.product_width_cm IS NOT NULL
        THEN p.product_length_cm * p.product_height_cm * p.product_width_cm
        ELSE NULL
    END AS product_volume_cm3
FROM stg.products p
WHERE p.product_id IS NOT NULL;

CREATE OR REPLACE TABLE mart.dim_review AS
SELECT
    ROW_NUMBER() OVER (ORDER BY r.order_id) AS review_sk,
    r.order_id,
    r.review_id,
    r.review_score,
    r.review_comment_title,
    r.review_comment_message,
    LENGTH(COALESCE(r.review_comment_message, '')) AS review_message_length,
    CASE WHEN COALESCE(r.review_score, 0) <= 2 THEN 1 ELSE 0 END AS is_low_score
FROM stg.order_reviews_latest r
WHERE r.order_id IS NOT NULL;

CREATE OR REPLACE TABLE mart.dim_seller AS
SELECT
    ROW_NUMBER() OVER (ORDER BY s.seller_id) AS seller_sk,
    s.seller_id,
    s.seller_zip_code_prefix,
    s.seller_city,
    s.seller_state
FROM stg.sellers s
WHERE s.seller_id IS NOT NULL;

CREATE OR REPLACE TABLE mart.dim_time AS
WITH all_dates AS (
    SELECT CAST(order_purchase_ts AS DATE) AS dt
    FROM stg.orders
    WHERE order_purchase_ts IS NOT NULL
    UNION
    SELECT CAST(order_approved_ts AS DATE) AS dt
    FROM stg.orders
    WHERE order_approved_ts IS NOT NULL
    UNION
    SELECT CAST(order_delivered_carrier_ts AS DATE) AS dt
    FROM stg.orders
    WHERE order_delivered_carrier_ts IS NOT NULL
    UNION
    SELECT CAST(order_delivered_customer_ts AS DATE) AS dt
    FROM stg.orders
    WHERE order_delivered_customer_ts IS NOT NULL
    UNION
    SELECT CAST(order_estimated_delivery_ts AS DATE) AS dt
    FROM stg.orders
    WHERE order_estimated_delivery_ts IS NOT NULL
),
bounds AS (
    SELECT
        COALESCE(MIN(dt), DATE '2016-01-01') AS min_date,
        COALESCE(MAX(dt), DATE '2018-12-31') AS max_date
    FROM all_dates
),
calendar AS (
    SELECT
        day::DATE AS full_date
    FROM bounds,
    GENERATE_SERIES(bounds.min_date, bounds.max_date, INTERVAL 1 DAY) AS t(day)
)
SELECT
    CAST(STRFTIME(full_date, '%Y%m%d') AS INTEGER) AS date_key,
    full_date,
    CAST(EXTRACT(YEAR FROM full_date) AS INTEGER) AS year_num,
    CAST(EXTRACT(QUARTER FROM full_date) AS INTEGER) AS quarter_num,
    CAST(EXTRACT(MONTH FROM full_date) AS INTEGER) AS month_num,
    STRFTIME(full_date, '%Y-%m') AS year_month,
    CAST(EXTRACT(DAY FROM full_date) AS INTEGER) AS day_of_month,
    STRFTIME(full_date, '%A') AS day_name,
    CASE WHEN STRFTIME(full_date, '%w') IN ('0', '6') THEN 1 ELSE 0 END AS is_weekend,
    CASE WHEN STRFTIME(full_date, '%m') IN ('11', '12') THEN 1 ELSE 0 END AS is_peak_season
FROM calendar
ORDER BY full_date;
