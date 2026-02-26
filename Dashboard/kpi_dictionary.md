# KPI Dictionary

## Executive Summary

### GMV
- Definition: `SUM(fact_orders.gmv)`
- Meaning: gross merchandise value before costs.

### Order Count
- Definition: `COUNT(fact_orders.order_id)`

### AOV
- Definition: `SUM(gmv) / COUNT(order_id)`

### YoY Order Growth %
- Definition: `(Orders_t - Orders_t-12) / Orders_t-12`

### Payment Mix %
- Definition: `order_count_by_payment_type / total_order_count`

### Contribution Margin Proxy
- Definition: `gmv - freight_value`
- Note: proxy only (COGS unavailable in Olist public dataset).

## Supply Chain & Operations

### Avg Delivery Days
- Definition: average of `delivery_days`
- Formula source: delivered date - purchase date.

### On-Time Rate
- Definition: `1 - AVG(is_late_delivery)`

### Avg Delay Days
- Definition: average of `delay_days` where late deliveries are positive.

### Severe Delay Rate
- Definition: `% of orders with delay_days >= 5`

### Freight / GMV Ratio
- Definition: `AVG(freight_to_gmv_ratio)`

## Customer Satisfaction

### Avg Review Score
- Definition: `AVG(review_score)` (1 to 5)

### One-Star Rate
- Definition: `% of reviews with score = 1`

### Low Score Rate
- Definition: `% of reviews with score <= 2`

### Delay Impact
- Definition: review metrics segmented by delay bucket:
  - on_time_or_early
  - late_1_2_days
  - late_3_5_days
  - late_over_5_days
