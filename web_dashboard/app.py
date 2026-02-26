from __future__ import annotations

from pathlib import Path
from typing import Dict

import duckdb
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DB_PATH = PROJECT_ROOT / "data/warehouse/olist.duckdb"
DEFAULT_EXPORT_DIR = PROJECT_ROOT / "data/exports"


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
    "state_geo_centroid": """
        SELECT customer_state, geo_lat, geo_lng
        FROM mart.vw_state_geo_centroid
    """,
    "csat_kpis": """
        SELECT avg_review_score, one_star_rate, low_score_rate
        FROM mart.vw_csat_kpis
    """,
}

EXPORT_FILE_MAP = {
    "exec_monthly": "vw_exec_summary_monthly",
    "exec_payment_mix": "vw_exec_payment_mix",
    "exec_category_perf": "vw_exec_category_performance",
    "ops_state_bottlenecks": "vw_ops_state_bottlenecks",
    "ops_monthly": "vw_ops_monthly_logistics",
    "csat_delay_impact": "vw_csat_delay_impact",
    "csat_state_payment": "vw_csat_state_payment_driver",
    "review_distribution": "vw_review_distribution",
    "state_geo_centroid": "vw_state_geo_centroid",
    "csat_kpis": "vw_csat_kpis",
}


st.set_page_config(
    page_title="Olist Online Dashboard",
    page_icon="📊",
    layout="wide",
)


def _load_from_db(db_path: Path) -> Dict[str, pd.DataFrame]:
    data: Dict[str, pd.DataFrame] = {}
    with duckdb.connect(str(db_path)) as conn:
        for name, query in QUERY_MAP.items():
            data[name] = conn.execute(query).df()
    return data


def _load_from_exports(export_dir: Path) -> Dict[str, pd.DataFrame]:
    data: Dict[str, pd.DataFrame] = {}
    missing = []
    for name in QUERY_MAP:
        csv_path = export_dir / f"{EXPORT_FILE_MAP[name]}.csv"
        if not csv_path.exists():
            missing.append(csv_path.name)
            continue
        data[name] = pd.read_csv(csv_path)

    if missing:
        missing_list = ", ".join(missing)
        raise FileNotFoundError(
            "Could not load from exports. Missing files: "
            f"{missing_list}. Run ETL_Scripts/run_pipeline.py first."
        )

    return data


@st.cache_data(show_spinner=False)
def load_datasets(db_path_str: str, export_dir_str: str) -> Dict[str, pd.DataFrame]:
    db_path = Path(db_path_str)
    export_dir = Path(export_dir_str)
    if db_path.exists():
        return _load_from_db(db_path)
    return _load_from_exports(export_dir)


def _weighted_average(
    frame: pd.DataFrame, value_col: str, weight_col: str
) -> float | None:
    if frame.empty:
        return None
    total_weight = frame[weight_col].sum()
    if total_weight == 0:
        return None
    return float((frame[value_col] * frame[weight_col]).sum() / total_weight)


def render_header() -> None:
    st.title("Olist Online Dashboard")
    st.caption(
        "E-commerce Consumer Insights & Operations | "
        "消费者洞察与供应链效率在线看板"
    )


def render_sidebar() -> tuple[str, str]:
    st.sidebar.header("Settings")
    db_path = st.sidebar.text_input("DuckDB Path", str(DEFAULT_DB_PATH))
    export_dir = st.sidebar.text_input("Export Directory", str(DEFAULT_EXPORT_DIR))
    st.sidebar.info(
        "If DuckDB file is unavailable, app will try to load CSV exports from data/exports."
    )
    if st.sidebar.button("Refresh Data"):
        st.cache_data.clear()
        st.rerun()
    return db_path, export_dir


def render_exec_tab(data: Dict[str, pd.DataFrame]) -> None:
    st.subheader("Executive Summary")

    monthly = data["exec_monthly"].copy()
    monthly["month_start"] = pd.to_datetime(monthly["month_start"])

    payment_mix = data["exec_payment_mix"].copy()
    category_perf = data["exec_category_perf"].copy()

    total_gmv = monthly["gmv"].sum()
    total_orders = monthly["order_count"].sum()
    overall_aov = total_gmv / total_orders if total_orders else 0
    latest_yoy = monthly["yoy_order_growth_pct"].dropna()
    latest_yoy_value = latest_yoy.iloc[-1] if not latest_yoy.empty else None

    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Total GMV", f"R${total_gmv:,.0f}")
    c2.metric("Total Orders", f"{int(total_orders):,}")
    c3.metric("AOV", f"R${overall_aov:,.2f}")
    c4.metric(
        "Latest YoY Order Growth",
        "N/A" if latest_yoy_value is None else f"{latest_yoy_value:.1%}",
    )

    trend_fig = go.Figure()
    trend_fig.add_trace(
        go.Scatter(
            x=monthly["month_start"],
            y=monthly["gmv"],
            mode="lines+markers",
            name="GMV",
            yaxis="y1",
        )
    )
    trend_fig.add_trace(
        go.Scatter(
            x=monthly["month_start"],
            y=monthly["order_count"],
            mode="lines+markers",
            name="Order Count",
            yaxis="y2",
        )
    )
    trend_fig.update_layout(
        title="Monthly GMV & Orders",
        xaxis_title="Month",
        yaxis=dict(title="GMV (R$)"),
        yaxis2=dict(title="Orders", overlaying="y", side="right"),
        legend=dict(orientation="h"),
        margin=dict(l=10, r=10, t=40, b=10),
    )

    top_category = category_perf.sort_values("category_gmv", ascending=False).head(12)
    category_fig = px.bar(
        top_category,
        x="product_category",
        y="contribution_margin_proxy",
        hover_data=["category_gmv", "category_freight", "order_count"],
        title="Top Categories by Contribution Margin Proxy",
    )
    category_fig.update_layout(xaxis_title="Category", yaxis_title="Contribution Proxy")

    payment_fig = px.pie(
        payment_mix,
        values="order_count",
        names="payment_type",
        title="Payment Mix by Order Count",
        hole=0.4,
    )

    left, right = st.columns([2, 1])
    left.plotly_chart(trend_fig, use_container_width=True)
    right.plotly_chart(payment_fig, use_container_width=True)
    st.plotly_chart(category_fig, use_container_width=True)

    with st.expander("View executive source data"):
        st.dataframe(monthly, use_container_width=True)


def render_ops_tab(data: Dict[str, pd.DataFrame]) -> None:
    st.subheader("Supply Chain & Operations")

    ops_state = data["ops_state_bottlenecks"].copy()
    ops_monthly = data["ops_monthly"].copy()
    geo_state = data["state_geo_centroid"].copy()

    ops_monthly["month_start"] = pd.to_datetime(ops_monthly["month_start"])

    avg_delivery_days = _weighted_average(ops_state, "avg_delivery_days", "order_count")
    on_time_rate = _weighted_average(ops_state, "on_time_rate", "order_count")
    freight_ratio = _weighted_average(
        ops_state, "avg_freight_to_gmv_ratio", "order_count"
    )

    c1, c2, c3 = st.columns(3)
    c1.metric(
        "Avg Delivery Days",
        "N/A" if avg_delivery_days is None else f"{avg_delivery_days:.2f}",
    )
    c2.metric("On-Time Rate", "N/A" if on_time_rate is None else f"{on_time_rate:.1%}")
    c3.metric(
        "Freight / GMV Ratio",
        "N/A" if freight_ratio is None else f"{freight_ratio:.1%}",
    )

    state_map = ops_state.merge(geo_state, on="customer_state", how="left")
    state_map = state_map.dropna(subset=["geo_lat", "geo_lng"])

    map_fig = px.scatter_geo(
        state_map,
        lat="geo_lat",
        lon="geo_lng",
        size="order_count",
        color="severe_delay_rate",
        hover_name="customer_state",
        hover_data={
            "avg_delivery_days": ":.2f",
            "avg_delay_days": ":.2f",
            "on_time_rate": ":.2%",
            "order_count": ":,",
            "geo_lat": False,
            "geo_lng": False,
        },
        color_continuous_scale="Reds",
        title="State Logistics Bottlenecks (bubble size = order volume)",
    )
    map_fig.update_layout(margin=dict(l=10, r=10, t=40, b=10))

    top_delay_states = ops_state.sort_values(
        "severe_delay_rate", ascending=False
    ).head(12)
    delay_bar = px.bar(
        top_delay_states,
        x="customer_state",
        y="severe_delay_rate",
        hover_data=["avg_delay_days", "on_time_rate", "order_count"],
        title="Top States by Severe Delay Rate",
    )
    delay_bar.update_layout(yaxis_tickformat=".0%")

    monthly_fig = go.Figure()
    monthly_fig.add_trace(
        go.Scatter(
            x=ops_monthly["month_start"],
            y=ops_monthly["avg_delivery_days"],
            mode="lines+markers",
            name="Avg Delivery Days",
        )
    )
    monthly_fig.add_trace(
        go.Scatter(
            x=ops_monthly["month_start"],
            y=ops_monthly["avg_delay_days"],
            mode="lines+markers",
            name="Avg Delay Days",
        )
    )
    monthly_fig.add_trace(
        go.Scatter(
            x=ops_monthly["month_start"],
            y=ops_monthly["on_time_rate"],
            mode="lines+markers",
            name="On-Time Rate",
            yaxis="y2",
        )
    )
    monthly_fig.update_layout(
        title="Monthly Logistics Trend",
        xaxis_title="Month",
        yaxis=dict(title="Days"),
        yaxis2=dict(title="On-Time Rate", overlaying="y", side="right", tickformat=".0%"),
        legend=dict(orientation="h"),
        margin=dict(l=10, r=10, t=40, b=10),
    )

    left, right = st.columns(2)
    left.plotly_chart(map_fig, use_container_width=True)
    right.plotly_chart(delay_bar, use_container_width=True)
    st.plotly_chart(monthly_fig, use_container_width=True)

    with st.expander("View operations source data"):
        st.dataframe(ops_state, use_container_width=True)


def render_csat_tab(data: Dict[str, pd.DataFrame]) -> None:
    st.subheader("Customer Satisfaction")

    csat_delay = data["csat_delay_impact"].copy()
    csat_state_payment = data["csat_state_payment"].copy()
    review_distribution = data["review_distribution"].copy()
    csat_kpis = data["csat_kpis"].copy()

    avg_review = float(csat_kpis["avg_review_score"].iloc[0])
    one_star = float(csat_kpis["one_star_rate"].iloc[0])
    low_score = float(csat_kpis["low_score_rate"].iloc[0])

    c1, c2, c3 = st.columns(3)
    c1.metric("Avg Review Score", f"{avg_review:.2f}")
    c2.metric("One-Star Rate", f"{one_star:.1%}")
    c3.metric("Low-Score Rate (<=2)", f"{low_score:.1%}")

    delay_fig = px.bar(
        csat_delay,
        x="delay_bucket",
        y=["avg_review_score", "one_star_rate", "low_score_rate"],
        barmode="group",
        title="Delay Bucket vs Customer Sentiment",
    )
    delay_fig.update_layout(yaxis_title="Rate / Score")

    review_dist_fig = px.bar(
        review_distribution,
        x="review_score",
        y="review_count",
        title="Review Score Distribution",
    )

    heatmap_frame = (
        csat_state_payment.pivot_table(
            index="customer_state",
            columns="payment_type",
            values="low_score_rate",
            aggfunc="mean",
        )
        .reset_index()
        .melt(id_vars="customer_state", var_name="payment_type", value_name="low_score_rate")
    )
    heatmap_fig = px.density_heatmap(
        heatmap_frame,
        x="payment_type",
        y="customer_state",
        z="low_score_rate",
        color_continuous_scale="Reds",
        title="Low-Score Rate Heatmap by State & Payment Type",
    )
    heatmap_fig.update_layout(xaxis_title="Payment Type", yaxis_title="State")

    left, right = st.columns(2)
    left.plotly_chart(review_dist_fig, use_container_width=True)
    right.plotly_chart(delay_fig, use_container_width=True)
    st.plotly_chart(heatmap_fig, use_container_width=True)

    with st.expander("View customer satisfaction source data"):
        st.dataframe(csat_state_payment, use_container_width=True)


def main() -> None:
    render_header()
    db_path_str, export_dir_str = render_sidebar()

    try:
        data = load_datasets(db_path_str, export_dir_str)
    except Exception as exc:  # pragma: no cover
        st.error(f"Failed to load datasets: {exc}")
        st.info(
            "Run ETL first:\n"
            "python3 ETL_Scripts/run_pipeline.py --raw-dir data/raw "
            "--db-path data/warehouse/olist.duckdb --export-dir data/exports"
        )
        return

    tab_exec, tab_ops, tab_csat = st.tabs(
        ["Executive Summary", "Supply Chain & Operations", "Customer Satisfaction"]
    )
    with tab_exec:
        render_exec_tab(data)
    with tab_ops:
        render_ops_tab(data)
    with tab_csat:
        render_csat_tab(data)


if __name__ == "__main__":
    main()
