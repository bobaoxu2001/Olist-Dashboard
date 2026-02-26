-- 30_facts.sql
-- Build fact tables at order and order-item grain.

CREATE OR REPLACE TABLE mart.fact_orders AS
WITH base AS (
    SELECT
        o.order_id,
        o.customer_id,
        o.order_status,
        o.order_purchase_ts,
        o.order_approved_ts,
        o.order_delivered_carrier_ts,
        o.order_delivered_customer_ts,
        o.order_estimated_delivery_ts,
        ia.item_count,
        ia.distinct_product_count,
        ia.seller_count,
        ia.gross_merchandise_value,
        ia.total_freight_value,
        ia.order_value_including_freight,
        pa.total_payment_value,
        pa.max_payment_installments,
        pa.avg_payment_installments,
        pa.main_payment_type,
        pa.payment_transaction_count,
        rv.review_id,
        rv.review_score,
        rv.review_creation_ts,
        os.primary_seller_id,
        os.primary_seller_state
    FROM stg.orders o
    LEFT JOIN stg.order_items_agg ia
        ON o.order_id = ia.order_id
    LEFT JOIN stg.order_payments_agg pa
        ON o.order_id = pa.order_id
    LEFT JOIN stg.order_reviews_latest rv
        ON o.order_id = rv.order_id
    LEFT JOIN stg.order_seller_agg os
        ON o.order_id = os.order_id
)
SELECT
    ROW_NUMBER() OVER (ORDER BY b.order_id) AS order_sk,
    b.order_id,
    dc.customer_sk,
    ds.seller_sk AS primary_seller_sk,
    dr.review_sk,
    b.review_id,
    CAST(STRFTIME(CAST(b.order_purchase_ts AS DATE), '%Y%m%d') AS INTEGER) AS purchase_date_key,
    CAST(STRFTIME(CAST(b.order_approved_ts AS DATE), '%Y%m%d') AS INTEGER) AS approved_date_key,
    CAST(STRFTIME(CAST(b.order_delivered_customer_ts AS DATE), '%Y%m%d') AS INTEGER) AS delivered_date_key,
    CAST(STRFTIME(CAST(b.order_estimated_delivery_ts AS DATE), '%Y%m%d') AS INTEGER) AS estimated_delivery_date_key,
    b.order_status,
    dc.customer_state,
    b.primary_seller_state,
    COALESCE(b.item_count, 0) AS item_count,
    COALESCE(b.distinct_product_count, 0) AS distinct_product_count,
    COALESCE(b.seller_count, 0) AS seller_count,
    COALESCE(b.gross_merchandise_value, 0) AS gmv,
    COALESCE(b.total_freight_value, 0) AS freight_value,
    COALESCE(
        b.order_value_including_freight,
        COALESCE(b.gross_merchandise_value, 0) + COALESCE(b.total_freight_value, 0)
    ) AS order_value_including_freight,
    COALESCE(b.total_payment_value, 0) AS payment_value,
    COALESCE(b.main_payment_type, 'unknown') AS main_payment_type,
    COALESCE(b.max_payment_installments, 0) AS payment_installments,
    b.avg_payment_installments,
    COALESCE(b.payment_transaction_count, 0) AS payment_transaction_count,
    b.review_score,
    CASE WHEN b.review_score = 1 THEN 1 ELSE 0 END AS is_one_star,
    CASE WHEN COALESCE(b.review_score, 0) <= 2 AND b.review_score IS NOT NULL THEN 1 ELSE 0 END AS is_low_score,
    CASE WHEN b.review_score IS NULL THEN 0 ELSE 1 END AS has_review,
    CASE
        WHEN b.order_purchase_ts IS NOT NULL AND b.order_delivered_customer_ts IS NOT NULL
        THEN DATE_DIFF('day', CAST(b.order_purchase_ts AS DATE), CAST(b.order_delivered_customer_ts AS DATE))
        ELSE NULL
    END AS delivery_days,
    CASE
        WHEN b.order_purchase_ts IS NOT NULL AND b.order_estimated_delivery_ts IS NOT NULL
        THEN DATE_DIFF('day', CAST(b.order_purchase_ts AS DATE), CAST(b.order_estimated_delivery_ts AS DATE))
        ELSE NULL
    END AS promised_delivery_days,
    CASE
        WHEN b.order_estimated_delivery_ts IS NOT NULL AND b.order_delivered_customer_ts IS NOT NULL
        THEN DATE_DIFF('day', CAST(b.order_estimated_delivery_ts AS DATE), CAST(b.order_delivered_customer_ts AS DATE))
        ELSE NULL
    END AS raw_delay_days,
    CASE
        WHEN b.order_estimated_delivery_ts IS NOT NULL
         AND b.order_delivered_customer_ts IS NOT NULL
         AND DATE_DIFF('day', CAST(b.order_estimated_delivery_ts AS DATE), CAST(b.order_delivered_customer_ts AS DATE)) > 0
        THEN DATE_DIFF('day', CAST(b.order_estimated_delivery_ts AS DATE), CAST(b.order_delivered_customer_ts AS DATE))
        ELSE 0
    END AS delay_days,
    CASE
        WHEN b.order_estimated_delivery_ts IS NOT NULL
         AND b.order_delivered_customer_ts IS NOT NULL
         AND DATE_DIFF('day', CAST(b.order_estimated_delivery_ts AS DATE), CAST(b.order_delivered_customer_ts AS DATE)) > 0
        THEN 1
        ELSE 0
    END AS is_late_delivery,
    CASE
        WHEN COALESCE(b.gross_merchandise_value, 0) = 0 THEN NULL
        ELSE COALESCE(b.total_freight_value, 0) / NULLIF(b.gross_merchandise_value, 0)
    END AS freight_to_gmv_ratio,
    COALESCE(b.gross_merchandise_value, 0) - COALESCE(b.total_freight_value, 0) AS contribution_margin_proxy
FROM base b
LEFT JOIN mart.dim_customer dc
    ON b.customer_id = dc.customer_id
LEFT JOIN mart.dim_seller ds
    ON b.primary_seller_id = ds.seller_id
LEFT JOIN mart.dim_review dr
    ON b.order_id = dr.order_id
WHERE b.order_id IS NOT NULL;

CREATE OR REPLACE TABLE mart.fact_order_items AS
SELECT
    ROW_NUMBER() OVER (ORDER BY oi.order_id, oi.order_item_id) AS order_item_sk,
    oi.order_id,
    oi.order_item_id,
    fo.order_sk,
    fo.customer_sk,
    fo.purchase_date_key,
    fo.delivered_date_key,
    fo.estimated_delivery_date_key,
    dp.product_sk,
    ds.seller_sk,
    oi.seller_id,
    COALESCE(dp.product_category, 'unknown') AS product_category,
    oi.price AS item_price,
    oi.freight_value AS item_freight_value,
    COALESCE(oi.price, 0) + COALESCE(oi.freight_value, 0) AS item_total_value,
    COALESCE(oi.price, 0) - COALESCE(oi.freight_value, 0) AS item_contribution_margin_proxy,
    fo.review_score,
    fo.delay_days,
    fo.is_late_delivery
FROM stg.order_items oi
LEFT JOIN mart.fact_orders fo
    ON oi.order_id = fo.order_id
LEFT JOIN mart.dim_product dp
    ON oi.product_id = dp.product_id
LEFT JOIN mart.dim_seller ds
    ON oi.seller_id = ds.seller_id
WHERE oi.order_id IS NOT NULL;
