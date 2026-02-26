# Data Folder Guide

## Raw source

Place the following CSV files from Kaggle into `data/raw/`:

1. `olist_customers_dataset.csv`
2. `olist_geolocation_dataset.csv`
3. `olist_order_items_dataset.csv`
4. `olist_order_payments_dataset.csv`
5. `olist_order_reviews_dataset.csv`
6. `olist_orders_dataset.csv`
7. `olist_products_dataset.csv`
8. `olist_sellers_dataset.csv`
9. `product_category_name_translation.csv`

Dataset link:  
https://www.kaggle.com/datasets/olistbr/brazilian-ecommerce

## Generated artifacts

- `data/warehouse/olist.duckdb`: local warehouse.
- `data/exports/*.parquet` and `*.csv`: mart exports for BI tools.

Both output directories are git-ignored.
