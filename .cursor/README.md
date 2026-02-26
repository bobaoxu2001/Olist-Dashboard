# Cloud Agent Environment

This repository uses `.cursor/environment.json` to bootstrap cloud agents with:

- Python 3
- `duckdb`
- `pandas`
- `pyarrow`
- `kaggle`

The install command runs automatically when a new cloud agent environment is prepared.

## Notes

- The Kaggle package installs its executable under `~/.local/bin` in many environments.
- If `kaggle` is not directly on PATH, you can still use:

```bash
python3 -m kaggle.cli --help
```
