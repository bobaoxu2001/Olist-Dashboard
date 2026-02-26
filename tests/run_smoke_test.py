"""Smoke test for ETL pipeline using tiny fixture CSVs."""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

import duckdb


def main() -> None:
    project_root = Path(__file__).resolve().parents[1]
    fixture_dir = project_root / "tests" / "fixtures" / "olist_sample_raw"
    temp_dir = project_root / "tests" / ".tmp"
    db_path = temp_dir / "olist_smoke.duckdb"
    export_dir = temp_dir / "exports"

    if temp_dir.exists():
        shutil.rmtree(temp_dir)
    temp_dir.mkdir(parents=True, exist_ok=True)

    cmd = [
        sys.executable,
        str(project_root / "ETL_Scripts" / "run_pipeline.py"),
        "--raw-dir",
        str(fixture_dir),
        "--db-path",
        str(db_path),
        "--export-dir",
        str(export_dir),
    ]
    print(f"[smoke] running pipeline: {' '.join(cmd)}")
    subprocess.run(cmd, check=True)

    conn = duckdb.connect(str(db_path))
    try:
        fact_orders_count = conn.execute(
            "SELECT COUNT(*) FROM mart.fact_orders"
        ).fetchone()[0]
        if fact_orders_count != 2:
            raise AssertionError(f"Expected 2 fact_orders rows, got {fact_orders_count}")

        one_star_late_over_5 = conn.execute(
            """
            SELECT one_star_rate
            FROM mart.vw_csat_delay_impact
            WHERE delay_bucket = 'late_over_5_days'
            """
        ).fetchone()
        if one_star_late_over_5 is None:
            raise AssertionError("Missing late_over_5_days bucket in vw_csat_delay_impact")
        if abs(one_star_late_over_5[0] - 1.0) > 1e-9:
            raise AssertionError(
                "Expected one_star_rate=1.0 for late_over_5_days in fixture data"
            )

        print("[smoke] pipeline smoke test passed")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
