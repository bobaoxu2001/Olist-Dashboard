# Data Scale-Up Plan (If Olist Core Dataset Feels Too Small)

This project already uses a real production-like dataset with ~100k orders.  
If you want to scale complexity further, integrate additional public datasets below.

## 1) Olist Marketing Funnel Dataset (Kaggle)

Source:
- Olist marketing funnel / closed deals datasets on Kaggle.

Value:
- Extends analytics from conversion pipeline to actual orders.
- Enables seller acquisition funnel metrics (MQL -> won seller -> order performance).

Potential joins:
- `seller_id` joins to existing seller dimension/facts.

## 2) Brazilian Macro + Demographic Context

Sources:
- IBGE population/economic datasets by state/city.
- Central Bank of Brazil macro indicators (inflation, rates).

Value:
- Build normalized demand metrics (orders per 100k population).
- Explain temporal variations in spending and payment behavior.

Potential joins:
- `customer_state`, `customer_city`, and monthly time keys.

## 3) Public Holiday / Event Calendars

Sources:
- Brazil public holidays datasets (national/state-level).

Value:
- Model seasonality pressure on logistics and customer ratings.
- Separate operational delays caused by predictable peak periods.

Potential joins:
- `dim_time.full_date` and `customer_state`.

## Suggested Scale-Up Phases

1. Add seller funnel data and create `fact_seller_funnel`.
2. Add macro demographics to create `dim_region_macro`.
3. Add holiday/event flags to `dim_time`.
4. Publish a fourth dashboard tab: "Forecasting & Scenario Planning".
