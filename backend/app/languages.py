"""Canonical language catalogue - the single source of truth for the judge.

Consumed directly by app.piston for execution/validation, and served via
GET /api/languages for the frontend's language selector, Monaco config, and
starter code. Do not duplicate this list anywhere else.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class LanguageSpec:
    slug: str
    display_name: str
    piston_language: str
    version: str
    monaco_id: str
    file_name: str
    starter_template: str
    time_limit_multiplier: float = 1.0
    stable: bool = True
    blocked_reason: str | None = None


LANGUAGES: tuple[LanguageSpec, ...] = (
    LanguageSpec(
        slug="c",
        display_name="C",
        piston_language="c",
        version="10.2.0",
        monaco_id="c",
        file_name="main.c",
        starter_template=(
            "#include <stdio.h>\n#include <stdlib.h>\n\nint main() {\n    // TODO\n    return 0;\n}"
        ),
    ),
    LanguageSpec(
        slug="cpp",
        display_name="C++",
        piston_language="c++",
        version="10.2.0",
        monaco_id="cpp",
        file_name="main.cpp",
        starter_template=(
            "#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n"
            "    ios_base::sync_with_stdio(false);\n    cin.tie(NULL);\n\n"
            "    // TODO\n\n    return 0;\n}"
        ),
    ),
    LanguageSpec(
        slug="python",
        display_name="Python 3",
        piston_language="python",
        version="3.12.0",
        monaco_id="python",
        file_name="main.py",
        starter_template="# TODO",
        time_limit_multiplier=3.0,
    ),
    LanguageSpec(
        slug="java",
        display_name="Java",
        piston_language="java",
        version="15.0.2",
        monaco_id="java",
        file_name="Main.java",
        starter_template=(
            "import java.util.*;\nimport java.io.*;\n\npublic class Main {\n"
            "    public static void main(String[] args) throws IOException {\n"
            "        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));\n"
            "        // TODO\n    }\n}"
        ),
        time_limit_multiplier=2.0,
    ),
    LanguageSpec(
        slug="kotlin",
        display_name="Kotlin",
        piston_language="kotlin",
        version="1.8.20",
        monaco_id="kotlin",
        file_name="main.kt",
        starter_template=(
            "import java.util.Scanner\n\nfun main() {\n    val sc = Scanner(System.`in`)\n    // TODO\n}"
        ),
        time_limit_multiplier=2.0,
    ),
    LanguageSpec(
        slug="rust",
        display_name="Rust",
        piston_language="rust",
        version="1.68.2",
        monaco_id="rust",
        file_name="main.rs",
        starter_template=(
            "use std::io::{self, BufRead};\n\nfn main() {\n    let stdin = io::stdin();\n    // TODO\n}"
        ),
    ),
    LanguageSpec(
        slug="go",
        display_name="Go",
        piston_language="go",
        version="1.16.2",
        monaco_id="go",
        file_name="main.go",
        starter_template=(
            'package main\n\nimport (\n    "bufio"\n    "fmt"\n    "os"\n)\n\n'
            "func main() {\n    reader := bufio.NewReader(os.Stdin)\n    _ = reader\n    fmt.Println()\n}"
        ),
    ),
    LanguageSpec(
        slug="javascript",
        display_name="JavaScript",
        piston_language="javascript",
        version="20.11.1",
        monaco_id="javascript",
        file_name="main.js",
        starter_template=(
            "const lines = require('fs').readFileSync('/dev/stdin', 'utf8').split('\\n');\n"
            "let i = 0;\n\n// TODO"
        ),
        time_limit_multiplier=2.0,
    ),
    LanguageSpec(
        slug="typescript",
        display_name="TypeScript",
        piston_language="typescript",
        version="5.0.3",
        monaco_id="typescript",
        file_name="main.ts",
        starter_template=(
            "// @ts-nocheck - the sandbox has no @types/node, so this keeps require()/fs usable\n"
            "const lines = require('fs').readFileSync('/dev/stdin', 'utf8').split('\\n');\n"
            "let i = 0;\n\n// TODO"
        ),
        time_limit_multiplier=2.0,
    ),
    LanguageSpec(
        slug="zig",
        display_name="Zig",
        piston_language="zig",
        version="0.10.1",
        monaco_id="plaintext",
        file_name="main.zig",
        starter_template='const std = @import("std");\n\npub fn main() !void {\n    // TODO\n}',
        stable=False,
        blocked_reason=(
            "Installed (0.10.1) and runs, but cold-compiles even a trivial program in "
            "~12-15s of CPU time on this host, right at Piston's own 15s package-level "
            "compile_timeout ceiling for zig (see limit_overrides in its pkg-info.json) - "
            "confirmed by direct /api/v2/execute testing, both with a real stdin-reading "
            "program (timed out) and a minimal hello-world (13816ms, barely under the cap). "
            "Since judging recompiles once per test case, this is unusable in practice, not "
            "just slow. Blocked until Piston ships a faster build or raises the package cap."
        ),
    ),
    LanguageSpec(
        slug="pypy",
        display_name="PyPy",
        piston_language="pypy",
        version="",
        monaco_id="python",
        file_name="main.py",
        starter_template="# TODO",
        time_limit_multiplier=3.0,
        stable=False,
        blocked_reason=(
            "Piston (engineer-man/piston) does not publish a pypy/pypy3 package in its "
            "package repository (GET /api/v2/packages) in any version - confirmed by "
            "listing every language in the repo index. There is no runtime to install; "
            "this isn't a stability issue, PyPy simply cannot run on Piston today."
        ),
    ),
)

LANGUAGES_BY_SLUG: dict[str, LanguageSpec] = {lang.slug: lang for lang in LANGUAGES}

STABLE_LANGUAGES: tuple[LanguageSpec, ...] = tuple(lang for lang in LANGUAGES if lang.stable)
