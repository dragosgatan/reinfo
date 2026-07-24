"""Tests for the reinfo CLI. httpx is mocked directly - the backend itself is
tested in backend/tests/test_device_auth.py."""

import json
from pathlib import Path
from unittest.mock import patch

import httpx

from reinfo import config
from reinfo.main import cli


def test_whoami_not_logged_in(runner):
    result = runner.invoke(cli, ["whoami"])
    assert result.exit_code == 1
    assert "reinfo login" in result.output


def test_whoami_logged_in(runner, json_response):
    config.save_credentials(
        config.Credentials(token="reinfo_x", username="alice", api_url="https://api.reinfo.ro")
    )
    with patch(
        "httpx.get",
        return_value=json_response(
            {"username": "alice", "role": "student", "display_name": "Alice"}
        ),
    ):
        result = runner.invoke(cli, ["whoami"])
    assert result.exit_code == 0
    assert "alice" in result.output


def test_whoami_json_mode(runner, json_response):
    config.save_credentials(
        config.Credentials(token="reinfo_x", username="alice", api_url="https://api.reinfo.ro")
    )
    with patch(
        "httpx.get",
        return_value=json_response(
            {"username": "alice", "role": "student", "display_name": "Alice"}
        ),
    ):
        result = runner.invoke(cli, ["--json", "whoami"])
    assert result.exit_code == 0
    assert json.loads(result.output)["username"] == "alice"


def test_login_device_flow_success(runner, json_response):
    start_resp = json_response(
        {
            "device_code": "dc-1",
            "user_code": "ABCD-EFGH",
            "verification_uri": "https://reinfo.ro/cli-auth",
            "verification_uri_complete": "https://reinfo.ro/cli-auth?code=ABCD-EFGH",
            "expires_in": 600,
            "interval": 5,
        }
    )
    poll_resp = json_response({"status": "approved", "token": "reinfo_abc", "username": "bob"})

    with (
        patch("httpx.post", side_effect=[start_resp, poll_resp]),
        patch("webbrowser.open"),
        patch("time.sleep"),
    ):
        result = runner.invoke(cli, ["login"])

    assert result.exit_code == 0
    assert "bob" in result.output
    saved = config.load_credentials()
    assert saved is not None
    assert saved.token == "reinfo_abc"
    assert saved.username == "bob"


def test_login_polls_through_pending_states(runner, json_response):
    start_resp = json_response(
        {
            "device_code": "dc-1",
            "user_code": "ABCD-EFGH",
            "verification_uri": "https://reinfo.ro/cli-auth",
            "verification_uri_complete": "https://reinfo.ro/cli-auth?code=ABCD-EFGH",
            "expires_in": 600,
            "interval": 5,
        }
    )
    pending_resp = json_response({"status": "pending"})
    approved_resp = json_response({"status": "approved", "token": "reinfo_abc", "username": "bob"})

    with (
        patch("httpx.post", side_effect=[start_resp, pending_resp, pending_resp, approved_resp]),
        patch("webbrowser.open"),
        patch("time.sleep"),
    ):
        result = runner.invoke(cli, ["login"])

    assert result.exit_code == 0
    assert config.load_credentials().token == "reinfo_abc"


def test_login_denied(runner, json_response):
    start_resp = json_response(
        {
            "device_code": "dc-1",
            "user_code": "ABCD-EFGH",
            "verification_uri": "https://reinfo.ro/cli-auth",
            "verification_uri_complete": "https://reinfo.ro/cli-auth?code=ABCD-EFGH",
            "expires_in": 600,
            "interval": 5,
        }
    )
    denied_resp = json_response({"status": "denied"})

    with (
        patch("httpx.post", side_effect=[start_resp, denied_resp]),
        patch("webbrowser.open"),
        patch("time.sleep"),
    ):
        result = runner.invoke(cli, ["login"])

    assert result.exit_code == 1
    assert config.load_credentials() is None


def test_submit_to_completion_ac(runner, json_response, tmp_path):
    config.save_credentials(
        config.Credentials(token="reinfo_x", username="alice", api_url="https://api.reinfo.ro")
    )
    solution = tmp_path / "sol.py"
    solution.write_text("print(42)\n")

    submit_resp = json_response({"id": "sub-1"})
    final_resp = json_response({"id": "sub-1", "verdict": "AC", "score": 100})

    fake_sse_lines = [
        'data: {"submission_id": "sub-1", "verdict": "pending", "score": 0, "job_status": "queued"}',
        'data: {"submission_id": "sub-1", "verdict": "AC", "score": 100, "job_status": "done"}',
    ]

    class _FakeStreamResp:
        status_code = 200

        def iter_lines(self):
            return iter(fake_sse_lines)

        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

    with (
        patch("httpx.post", return_value=submit_resp),
        patch("httpx.get", return_value=final_resp),
        patch("httpx.stream", return_value=_FakeStreamResp()),
    ):
        result = runner.invoke(cli, ["submit", "two-sum", str(solution), "--lang", "python"])

    assert result.exit_code == 0
    assert "AC" in result.output


def test_submit_wa_exits_nonzero(runner, json_response, tmp_path):
    config.save_credentials(
        config.Credentials(token="reinfo_x", username="alice", api_url="https://api.reinfo.ro")
    )
    solution = tmp_path / "sol.py"
    solution.write_text("print(1)\n")

    submit_resp = json_response({"id": "sub-2"})
    final_resp = json_response({"id": "sub-2", "verdict": "WA", "score": 0})

    class _FakeStreamResp:
        status_code = 200

        def iter_lines(self):
            return iter(['data: {"job_status": "done", "verdict": "WA", "score": 0}'])

        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

    with (
        patch("httpx.post", return_value=submit_resp),
        patch("httpx.get", return_value=final_resp),
        patch("httpx.stream", return_value=_FakeStreamResp()),
    ):
        result = runner.invoke(cli, ["submit", "two-sum", str(solution), "--lang", "python"])

    assert result.exit_code == 1
    assert "WA" in result.output


def test_submit_requires_login(runner, tmp_path):
    solution = tmp_path / "sol.py"
    solution.write_text("print(1)\n")
    result = runner.invoke(cli, ["submit", "two-sum", str(solution), "--lang", "python"])
    assert result.exit_code == 1
    assert "reinfo login" in result.output


def test_status_defaults_to_most_recent(runner, json_response):
    config.save_credentials(
        config.Credentials(token="reinfo_x", username="alice", api_url="https://api.reinfo.ro")
    )
    listing_resp = json_response({"items": [{"id": "sub-9"}], "total": 1})
    detail_resp = json_response({"id": "sub-9", "verdict": "AC", "score": 100})

    with patch("httpx.get", side_effect=[listing_resp, detail_resp]):
        result = runner.invoke(cli, ["status"])

    assert result.exit_code == 0
    assert "sub-9" in result.output
    assert "AC" in result.output


def test_status_with_no_submissions(runner, json_response):
    config.save_credentials(
        config.Credentials(token="reinfo_x", username="alice", api_url="https://api.reinfo.ro")
    )
    listing_resp = json_response({"items": [], "total": 0})

    with patch("httpx.get", return_value=listing_resp):
        result = runner.invoke(cli, ["status"])

    assert result.exit_code == 1


def test_init_scaffolds_statement_and_starter_file(runner, json_response):
    problem_resp = json_response(
        {
            "slug": "two-sum",
            "title": "Two Sum",
            "statement_md": "Find two numbers.",
            "input_format": "n and array",
            "output_format": "indices",
        }
    )
    languages_resp = json_response(
        [
            {
                "slug": "python",
                "display_name": "Python 3",
                "monaco_id": "python",
                "file_name": "main.py",
                "starter_template": "# TODO",
                "version": "3.12.0",
                "stable": True,
                "blocked_reason": None,
            }
        ]
    )

    with runner.isolated_filesystem():
        with patch("httpx.get", side_effect=[problem_resp, languages_resp]):
            result = runner.invoke(cli, ["init", "two-sum", "--lang", "python"])

        assert result.exit_code == 0
        assert Path("two-sum/statement.md").exists()
        assert Path("two-sum/main.py").read_text() == "# TODO"
        assert "Two Sum" in Path("two-sum/statement.md").read_text()


def test_init_unsupported_language(runner, json_response):
    problem_resp = json_response(
        {
            "slug": "two-sum",
            "title": "Two Sum",
            "statement_md": "x",
            "input_format": "x",
            "output_format": "x",
        }
    )
    languages_resp = json_response([])

    with runner.isolated_filesystem():
        with patch("httpx.get", side_effect=[problem_resp, languages_resp]):
            result = runner.invoke(cli, ["init", "two-sum", "--lang", "cobol"])

        assert result.exit_code == 1


def test_logout_clears_credentials(runner):
    config.save_credentials(
        config.Credentials(token="reinfo_x", username="alice", api_url="https://api.reinfo.ro")
    )
    result = runner.invoke(cli, ["logout"])
    assert result.exit_code == 0
    assert config.load_credentials() is None


def test_api_error_surfaces_detail(runner):
    config.save_credentials(
        config.Credentials(token="reinfo_x", username="alice", api_url="https://api.reinfo.ro")
    )
    error_resp = httpx.Response(
        status_code=404,
        json={"detail": "Utilizatorul nu a fost găsit"},
        request=httpx.Request("GET", "https://api.reinfo.ro/"),
    )
    with patch("httpx.get", return_value=error_resp):
        result = runner.invoke(cli, ["whoami"])
    assert result.exit_code == 1
    assert "404" in result.output


def test_network_error_message(runner):
    config.save_credentials(
        config.Credentials(token="reinfo_x", username="alice", api_url="https://api.reinfo.ro")
    )
    with patch("httpx.get", side_effect=httpx.ConnectError("boom")):
        result = runner.invoke(cli, ["whoami"])
    assert result.exit_code == 1
    assert "boom" in result.output
