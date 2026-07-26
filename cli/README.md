# reinfo

Command-line client and Python helper for [reinfo.ro](https://reinfo.ro) -
submit solutions, check status, scaffold problems, and work with AI/dataset
problems from your terminal or notebook.

## Install

```
pip install reinfo-cli

# for the dataset helper (get_dataset / submit_predictions), which needs pandas:
pip install reinfo-cli[dataset]
```

## Usage

```
reinfo login                          # opens your browser to authorize this machine
reinfo whoami                         # show the logged-in account
reinfo problems                       # list problems
reinfo init two-sum --lang cpp        # scaffold ./two-sum with the statement + a starter file
reinfo submit two-sum solution.cpp --lang cpp
reinfo status                         # your most recent submission
reinfo status <submission-id>         # a specific submission
```

Every command accepts `--json` for machine-readable output and `--locale ro|en`
for the output language (Romanian by default). `reinfo --help` and
`reinfo <command> --help` list all options.

### Credentials

`reinfo login` uses a device-authorization flow: it prints a short code, opens
your browser to confirm it on your already-logged-in reinfo.ro session, and
stores the issued token in `~/.reinfo/credentials.json` (readable only by you).
No password ever touches the CLI.

For CI or scripting, skip `login` entirely and set `REINFO_TOKEN` - generate a
token via the browser flow once, then export it as a secret. `REINFO_API_URL`
overrides the API base URL (useful for pointing at a local dev backend).

### Dataset helper

```python
import reinfo

data = reinfo.get_dataset("titanic-survival")  # cached ~/.reinfo/cache/, 6h TTL
data.train, data.test, data.sample_submission  # pandas DataFrames

predictions = data.sample_submission.copy()
predictions["target"] = 0

result = reinfo.submit_predictions("titanic-survival", predictions)
print(result["verdict"], result["score"])
```

`submit_predictions` validates the DataFrame's columns and row count against
the problem's requirements before uploading, and polls until the submission
is judged (raises `reinfo.DatasetError` on timeout or `reinfo.ValidationError`
on bad input). Uses the same `reinfo login` credentials as the CLI.

## Development

```
cd cli
uv venv
uv pip install -e ".[dev]"
pytest
ruff check .
```
