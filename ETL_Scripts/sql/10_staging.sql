-- 10_staging.sql
-- Type casting, cleaning, and reusable aggregates.

CREATE OR REPLACE TABLE stg.orders AS
SELECT
    NULLIF(TRIM(order_id), '') AS order_id,
    NULLIF(TRIM(customer_id), '') AS customer_id,
    LOWER(NULLIF(TRIM(order_status), '')) AS order_status,
    TRY_STRPTIME(NULLIF(TRIM(order_purchase_timestamp), ''), '%Y-%m-%d %H:%M:%S') AS order_purchase_ts,
    TRY_STRPTIME(NULLIF(TRIM(order_approved_at), ''), '%Y-%m-%d %H:%M:%S') AS order_approved_ts,
    TRY_STRPTIME(NULLIF(TRIM(order_delivered_carrier_date), ''), '%Y-%m-%d %H:%M:%S') AS order_delivered_carrier_ts,
    TRY_STRPTIME(NULLIF(TRIM(order_delivered_customer_date), ''), '%Y-%m-%d %H:%M:%S') AS order_delivered_customer_ts,
    TRY_STRPTIME(NULLIF(TRIM(order_estimated_delivery_date), ''), '%Y-%m-%d %H:%M:%S') AS order_estimated_delivery_ts
FROM raw.orders;

CREATE OR REPLACE TABLE stg.customers AS
SELECT
    NULLIF(TRIM(customer_id), '') AS customer_id,
    NULLIF(TRIM(customer_unique_id), '') AS customer_unique_id,
    TRY_CAST(NULLIF(TRIM(customer_zip_code_prefix), '') AS INTEGER) AS customer_zip_code_prefix,
    LOWER(NULLIF(TRIM(customer_city), '')) AS customer_city,
    UPPER(NULLIF(TRIM(customer_state), '')) AS customer_state
FROM raw.customers;

CREATE OR REPLACE TABLE stg.geolocation AS
SELECT
    TRY_CAST(NULLIF(TRIM(geolocation_zip_code_prefix), '') AS INTEGER) AS geolocation_zip_code_prefix,
    TRY_CAST(NULLIF(TRIM(geolocation_lat), '') AS DOUBLE) AS geolocation_lat,
    TRY_CAST(NULLIF(TRIM(geolocation_lng), '') AS DOUBLE) AS geolocation_lng,
    LOWER(NULLIF(TRIM(geolocation_city), '')) AS geolocation_city,
    UPPER(NULLIF(TRIM(geolocation_state), '')) AS geolocation_state
FROM raw.geolocation;

CREATE OR REPLACE TABLE stg.geolocation_lookup AS
SELECT
    geolocation_zip_code_prefix,
    AVG(geolocation_lat) AS geo_lat,
    AVG(geolocation_lng) AS geo_lng,
    MIN(geolocation_city) AS geolocation_city,
    MIN(geolocation_state) AS geolocation_state
FROM stg.geolocation
WHERE geolocation_zip_code_prefix IS NOT NULL
GROUP BY geolocation_zip_code_prefix;

CREATE OR REPLACE TABLE stg.products AS
SELECT
    NULLIF(TRIM(p.product_id), '') AS product_id,
    COALESCE(
        NULLIF(TRIM(t.product_category_name_english), ''),
        NULLIF(TRIM(p.product_category_name), ''),
        'unknown'
    ) AS product_category,
    TRY_CAST(NULLIF(TRIM(p.product_name_lenght), '') AS INTEGER) AS product_name_length,
    TRY_CAST(NULLIF(TRIM(p.product_description_lenght), '') AS INTEGER) AS product_description_length,
    TRY_CAST(NULLIF(TRIM(p.product_photos_qty), '') AS INTEGER) AS product_photos_qty,
    TRY_CAST(NULLIF(TRIM(p.product_weight_g), '') AS DOUBLE) AS product_weight_g,
    TRY_CAST(NULLIF(TRIM(p.product_length_cm), '') AS DOUBLE) AS product_length_cm,
    TRY_CAST(NULLIF(TRIM(p.product_height_cm), '') AS DOUBLE) AS product_height_cm,
    TRY_CAST(NULLIF(TRIM(p.product_width_cm), '') AS DOUBLE) AS product_width_cm
FROM raw.products p
LEFT JOIN raw.product_category_name_translation t
    ON p.product_category_name = t.product_category_name;

CREATE OR REPLACE TABLE stg.sellers AS
SELECT
    NULLIF(TRIM(seller_id), '') AS seller_id,
    TRY_CAST(NULLIF(TRIM(seller_zip_code_prefix), '') AS INTEGER) AS seller_zip_code_prefix,
    LOWER(NULLIF(TRIM(seller_city), '')) AS seller_city,
    UPPER(NULLIF(TRIM(seller_state), '')) AS seller_state
FROM raw.sellers;

CREATE OR REPLACE TABLE stg.order_items AS
SELECT
    NULLIF(TRIM(order_id), '') AS order_id,
    TRY_CAST(NULLIF(TRIM(order_item_id), '') AS INTEGER) AS order_item_id,
    NULLIF(TRIM(product_id), '') AS product_id,
    NULLIF(TRIM(seller_id), '') AS seller_id,
    TRY_STRPTIME(NULLIF(TRIM(shipping_limit_date), ''), '%Y-%m-%d %H:%M:%S') AS shipping_limit_ts,
    TRY_CAST(NULLIF(TRIM(price), '') AS DOUBLE) AS price,
    TRY_CAST(NULLIF(TRIM(freight_value), '') AS DOUBLE) AS freight_value
FROM raw.order_items;

CREATE OR REPLACE TABLE stg.order_payments AS
SELECT
    NULLIF(TRIM(order_id), '') AS order_id,
    TRY_CAST(NULLIF(TRIM(payment_sequential), '') AS INTEGER) AS payment_sequential,
    LOWER(NULLIF(TRIM(payment_type), '')) AS payment_type,
    TRY_CAST(NULLIF(TRIM(payment_installments), '') AS INTEGER) AS payment_installments,
    TRY_CAST(NULLIF(TRIM(payment_value), '') AS DOUBLE) AS payment_value
FROM raw.order_payments;

CREATE OR REPLACE TABLE stg.order_reviews AS
SELECT
    NULLIF(TRIM(review_id), '') AS review_id,
    NULLIF(TRIM(order_id), '') AS order_id,
    TRY_CAST(NULLIF(TRIM(review_score), '') AS INTEGER) AS review_score,
    NULLIF(TRIM(review_comment_title), '') AS review_comment_title,
    NULLIF(TRIM(review_comment_message), '') AS review_comment_message,
    TRY_STRPTIME(NULLIF(TRIM(review_creation_date), ''), '%Y-%m-%d %H:%M:%S') AS review_creation_ts,
    TRY_STRPTIME(NULLIF(TRIM(review_answer_timestamp), ''), '%Y-%m-%d %H:%M:%S') AS review_answer_ts
FROM raw.order_reviews;

CREATE OR REPLACE TABLE stg.order_reviews_latest AS
WITH ranked_reviews AS (
    SELECT
        *,
        ROW_NUMBER() OVER (
            PARTITION BY order_id
            ORDER BY review_answer_ts DESC NULLS LAST, review_creation_ts DESC NULLS LAST
        ) AS rn
    FROM stg.order_reviews
    WHERE order_id IS NOT NULL
)
SELECT
    review_id,
    order_id,
    review_score,
    review_comment_title,
    review_comment_message,
    review_creation_ts,
    review_answer_ts
FROM ranked_reviews
WHERE rn = 1;

CREATE OR REPLACE TABLE stg.order_items_agg AS
SELECT
    order_id,
    COUNT(*) AS item_count,
    COUNT(DISTINCT product_id) AS distinct_product_count,
    COUNT(DISTINCT seller_id) AS seller_count,
    SUM(COALESCE(price, 0)) AS gross_merchandise_value,
    SUM(COALESCE(freight_value, 0)) AS total_freight_value,
    SUM(COALESCE(price, 0) + COALESCE(freight_value, 0)) AS order_value_including_freight
FROM stg.order_items
WHERE order_id IS NOT NULL
GROUP BY order_id;

CREATE OR REPLACE TABLE stg.order_payments_agg AS
WITH ranked_payments AS (
    SELECT
        *,
        ROW_NUMBER() OVER (
            PARTITION BY order_id
            ORDER BY payment_value DESC NULLS LAST, payment_sequential ASC NULLS LAST
        ) AS rn
    FROM stg.order_payments
    WHERE order_id IS NOT NULL
)
SELECT
    order_id,
    SUM(COALESCE(payment_value, 0)) AS total_payment_value,
    MAX(COALESCE(payment_installments, 0)) AS max_payment_installments,
    AVG(COALESCE(payment_installments, 0)) AS avg_payment_installments,
    MAX(CASE WHEN rn = 1 THEN payment_type END) AS main_payment_type,
    COUNT(*) AS payment_transaction_count
FROM ranked_payments
GROUP BY order_id;

CREATE OR REPLACE TABLE stg.order_primary_seller AS
WITH seller_rank AS (
    SELECT
        order_id,
        seller_id,
        SUM(COALESCE(price, 0)) AS seller_gmv,
        ROW_NUMBER() OVER (
            PARTITION BY order_id
            ORDER BY SUM(COALESCE(price, 0)) DESC, seller_id
        ) AS rn
    FROM stg.order_items
    WHERE order_id IS NOT NULL
      AND seller_id IS NOT NULL
    GROUP BY order_id, seller_id
)
SELECT
    order_id,
    seller_id AS primary_seller_id,
    seller_gmv
FROM seller_rank
WHERE rn = 1;

CREATE OR REPLACE TABLE stg.order_seller_agg AS
SELECT
    ia.order_id,
    ia.seller_count,
    ps.primary_seller_id,
    s.seller_state AS primary_seller_state
FROM stg.order_items_agg ia
LEFT JOIN stg.order_primary_seller ps
    ON ia.order_id = ps.order_id
LEFT JOIN stg.sellers s
    ON ps.primary_seller_id = s.seller_id;
