from __future__ import annotations

import json as jsonlib
import sys
import time
import webbrowser
from dataclasses import dataclass
from pathlib import Path

import click

from reinfo import __version__
from reinfo.client import ApiError, NetworkError, ReinfoClient
from reinfo.config import (
    Credentials,
    clear_credentials,
    resolve_api_url,
    resolve_token,
    save_credentials,
)
from reinfo.i18n import t


@dataclass
class Ctx:
    client: ReinfoClient
    json_mode: bool
    locale: str
    api_url: str


def _fail(ctx: Ctx, key: str, **kwargs: object) -> None:
    click.secho(t(key, ctx.locale, **kwargs), fg="red", err=True)
    sys.exit(1)


def _handle_api_error(ctx: Ctx, exc: Exception) -> None:
    if isinstance(exc, ApiError):
        click.secho(
            t("api_error", ctx.locale, status=exc.status_code, detail=exc.detail),
            fg="red",
            err=True,
        )
    elif isinstance(exc, NetworkError):
        click.secho(
            t("network_error", ctx.locale, url=exc.url, error=exc.error), fg="red", err=True
        )
    else:
        click.secho(str(exc), fg="red", err=True)
    sys.exit(1)


def _print(ctx: Ctx, data: object, text: str | None = None) -> None:
    if ctx.json_mode:
        click.echo(jsonlib.dumps(data, default=str))
    else:
        click.echo(text if text is not None else str(data))


@click.group()
@click.option("--json", "json_mode", is_flag=True, default=False, help="Output raw JSON.")
@click.option(
    "--locale",
    type=click.Choice(["ro", "en"]),
    default="ro",
    show_default=True,
    help="Output language.",
)
@click.option("--api-url", default=None, help="Override the reinfo API base URL.")
@click.version_option(__version__, prog_name="reinfo")
@click.pass_context
def cli(click_ctx: click.Context, json_mode: bool, locale: str, api_url: str | None) -> None:
    """reinfo - command-line client for reinfo.ro"""
    resolved_url = resolve_api_url(api_url)
    token = resolve_token()
    click_ctx.obj = Ctx(
        client=ReinfoClient(resolved_url, token),
        json_mode=json_mode,
        locale=locale,
        api_url=resolved_url,
    )


@cli.command()
@click.pass_obj
def login(ctx: Ctx) -> None:
    """log in via the browser (device authorization flow)"""
    try:
        start = ctx.client.post_json("/api/auth/device/start")
    except (ApiError, NetworkError) as exc:
        _handle_api_error(ctx, exc)
        return

    device_code = start["device_code"]
    user_code = start["user_code"]
    verification_uri_complete = start["verification_uri_complete"]
    interval = start["interval"]
    expires_in = start["expires_in"]

    click.echo(t("login_code", ctx.locale, code=user_code))
    click.echo(t("login_url", ctx.locale, url=verification_uri_complete))
    click.echo(t("login_start", ctx.locale))
    webbrowser.open(verification_uri_complete)
    click.echo(t("login_waiting", ctx.locale))

    deadline = time.monotonic() + expires_in
    while time.monotonic() < deadline:
        time.sleep(interval)
        try:
            poll = ctx.client.post_json("/api/auth/device/poll", {"device_code": device_code})
        except (ApiError, NetworkError) as exc:
            _handle_api_error(ctx, exc)
            return

        status = poll["status"]
        if status == "pending":
            continue
        if status == "denied":
            _fail(ctx, "login_denied")
            return
        if status == "expired":
            _fail(ctx, "login_expired")
            return
        if status == "approved":
            save_credentials(
                Credentials(token=poll["token"], username=poll["username"], api_url=ctx.api_url)
            )
            if ctx.json_mode:
                _print(ctx, {"username": poll["username"], "status": "ok"})
            else:
                click.secho(t("login_success", ctx.locale, username=poll["username"]), fg="green")
            return

    _fail(ctx, "login_expired")


@cli.command()
@click.pass_obj
def logout(ctx: Ctx) -> None:
    """forget the stored cli credentials (does not revoke the token server-side)"""
    clear_credentials()
    _print(ctx, {"status": "ok"}, t("logout_success", ctx.locale))


@cli.command()
@click.pass_obj
def whoami(ctx: Ctx) -> None:
    """show the currently logged-in user"""
    if not ctx.client.token:
        _fail(ctx, "not_logged_in")
        return
    try:
        me = ctx.client.get("/api/auth/me")
    except (ApiError, NetworkError) as exc:
        _handle_api_error(ctx, exc)
        return
    if ctx.json_mode:
        _print(ctx, me)
    else:
        click.echo(f"{me['username']} ({me['role']}) - {me['display_name']}")


@cli.command()
@click.option("--page", default=1, show_default=True)
@click.option("--per-page", default=20, show_default=True)
@click.pass_obj
def problems(ctx: Ctx, page: int, per_page: int) -> None:
    """list problems"""
    try:
        data = ctx.client.get("/api/problems", {"page": page, "per_page": per_page})
    except (ApiError, NetworkError) as exc:
        _handle_api_error(ctx, exc)
        return
    if ctx.json_mode:
        _print(ctx, data)
        return
    for p in data["items"]:
        click.echo(f"{p['slug']:<30} {p['title']:<40} dif:{p['difficulty']}")


@cli.command()
@click.argument("slug")
@click.argument("file", type=click.Path(exists=True, dir_okay=False, path_type=Path))
@click.option("--lang", required=True, help="Language slug (see the site's language list).")
@click.pass_obj
def submit(ctx: Ctx, slug: str, file: Path, lang: str) -> None:
    """submit FILE as a solution to problem SLUG"""
    if not ctx.client.token:
        _fail(ctx, "not_logged_in")
        return

    source_code = file.read_text(encoding="utf-8")

    if not ctx.json_mode:
        click.echo(t("submit_uploading", ctx.locale, slug=slug))
    try:
        submission = ctx.client.post_form(
            f"/api/problems/{slug}/submit", data={"source_code": source_code, "language": lang}
        )
    except (ApiError, NetworkError) as exc:
        _handle_api_error(ctx, exc)
        return

    submission_id = submission["id"]
    if not ctx.json_mode:
        click.echo(t("submit_judging", ctx.locale))

    try:
        for event in ctx.client.stream_sse(f"/api/submissions/{submission_id}/stream"):
            if not ctx.json_mode and event.get("job_status") not in ("done", "failed"):
                click.echo(f"  ... {event.get('verdict')} ({event.get('score', 0)}p)", nl=False)
                click.echo("\r", nl=False)
    except (ApiError, NetworkError) as exc:
        _handle_api_error(ctx, exc)
        return

    try:
        final = ctx.client.get(f"/api/submissions/{submission_id}")
    except (ApiError, NetworkError) as exc:
        _handle_api_error(ctx, exc)
        return

    if ctx.json_mode:
        _print(ctx, final)
    else:
        click.echo(t("submit_done", ctx.locale, verdict=final["verdict"], score=final["score"]))

    sys.exit(0 if final.get("verdict") == "AC" else 1)


@cli.command()
@click.argument("submission_id", required=False)
@click.pass_obj
def status(ctx: Ctx, submission_id: str | None) -> None:
    """show a submission's status, defaults to your most recent submission"""
    if not ctx.client.token:
        _fail(ctx, "not_logged_in")
        return
    try:
        if submission_id:
            data = ctx.client.get(f"/api/submissions/{submission_id}")
        else:
            listing = ctx.client.get("/api/submissions", {"page": 1, "per_page": 1})
            if not listing["items"]:
                _fail(ctx, "submission_not_found")
                return
            data = ctx.client.get(f"/api/submissions/{listing['items'][0]['id']}")
    except (ApiError, NetworkError) as exc:
        _handle_api_error(ctx, exc)
        return

    if ctx.json_mode:
        _print(ctx, data)
    else:
        click.echo(f"{data['id']}: {data['verdict']} ({data['score']}p)")


@cli.command()
@click.argument("slug")
@click.option("--lang", default="python", show_default=True, help="Starter language slug.")
@click.pass_obj
def init(ctx: Ctx, slug: str, lang: str) -> None:
    """scaffold a local folder for problem SLUG with the statement and a starter file"""
    try:
        problem = ctx.client.get(f"/api/problems/{slug}")
    except ApiError as exc:
        if exc.status_code == 404:
            _fail(ctx, "problem_not_found", slug=slug)
            return
        _handle_api_error(ctx, exc)
        return
    except NetworkError as exc:
        _handle_api_error(ctx, exc)
        return

    try:
        languages = ctx.client.get("/api/languages")
    except (ApiError, NetworkError) as exc:
        _handle_api_error(ctx, exc)
        return

    lang_spec = next((lang_item for lang_item in languages if lang_item["slug"] == lang), None)
    if lang_spec is None:
        _fail(ctx, "unsupported_language", lang=lang)
        return

    folder = Path(slug)
    folder.mkdir(parents=True, exist_ok=True)

    statement = (
        f"# {problem['title']}\n\n"
        f"{problem['statement_md']}\n\n"
        f"## Date de intrare\n\n{problem['input_format']}\n\n"
        f"## Date de ieșire\n\n{problem['output_format']}\n"
    )
    (folder / "statement.md").write_text(statement, encoding="utf-8")
    (folder / lang_spec["file_name"]).write_text(lang_spec["starter_template"], encoding="utf-8")

    _print(
        ctx, {"slug": slug, "path": str(folder)}, t("init_done", ctx.locale, slug=slug, path=folder)
    )


if __name__ == "__main__":
    cli()
