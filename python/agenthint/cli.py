from __future__ import annotations

import sys

from agenthint import (
    detect_agent,
    format_doctor,
    format_doctor_json,
    format_explanation,
    format_init,
    format_json,
    help_text,
    package_version,
    sanitize_for_display,
    trim_whitespace,
)


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        except (OSError, ValueError):
            pass

    args = sys.argv[1:]

    if len(args) == 1 and args[0] in {"-h", "--help"}:
        print(help_text())
        raise SystemExit(0)

    if len(args) == 1 and args[0] == "--version":
        print(f"agenthint {package_version()}")
        raise SystemExit(0)

    if args[:1] == ["init"]:
        if len(args) != 2 or not trim_whitespace(args[1]) or args[1].startswith("-"):
            print_usage_error(format_init(None))

        print(format_init(args[1]))
        raise SystemExit(0)

    valid_args = (
        not args
        or (len(args) == 1 and args[0] in {"--json", "--explain", "doctor"})
        or (len(args) == 2 and args == ["doctor", "--json"])
    )

    if not valid_args:
        print_usage_error(f"invalid usage: {' '.join(args)}")

    result = detect_agent()

    if args[:1] == ["doctor"]:
        print(format_doctor_json(result) if args[1:] == ["--json"] else format_doctor(result))
    elif args[:1] == ["--json"]:
        print(format_json(result))
    elif args[:1] == ["--explain"]:
        print(format_explanation(result))

    raise SystemExit(0 if result.is_agent else 1)


def print_usage_error(message: str) -> None:
    print(sanitize_for_display(message), file=sys.stderr)
    raise SystemExit(2)


if __name__ == "__main__":
    main()
