from __future__ import annotations

import sys

from agenthint import (
    detect_agent,
    format_doctor,
    format_doctor_json,
    format_explanation,
    format_init,
    format_json,
)


def main() -> None:
    args = sys.argv[1:]

    if len(args) == 1 and args[0] in {"-h", "--help"}:
        print_help()
        raise SystemExit(0)

    if args[:1] == ["init"]:
        if len(args) != 2 or not args[1].strip() or args[1].startswith("-"):
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


def print_help() -> None:
    print(
        """agenthint

Detect whether the current process is probably running under an AI agent.

Usage:
  agenthint             Exit 0 if an agent is likely detected, otherwise 1
  agenthint init <name> Print the recommended AI_AGENT value
  agenthint doctor      Print detection details and setup advice
  agenthint doctor --json
                        Print detection details and setup advice as JSON
  agenthint --json      Print the structured detection result
  agenthint --explain   Print a short human-readable explanation
  agenthint --help      Show this help"""
    )


def print_usage_error(message: str) -> None:
    print(message, file=sys.stderr)
    raise SystemExit(2)


if __name__ == "__main__":
    main()
