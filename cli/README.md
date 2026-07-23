# reinfo

Command-line client for [reinfo.ro](https://reinfo.ro) - submit solutions, check
status, and scaffold problems from your terminal.

## Install

```
pip install reinfo
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

## Development

```
cd cli
uv venv
uv pip install -e ".[dev]"
pytest
ruff check .
```
