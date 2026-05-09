from __future__ import annotations

import sys

from agenthint import detect_agent, format_explanation, format_json


def main() -> None:
    args = sys.argv[1:]

    if "-h" in args or "--help" in args:
        print_help()
        raise SystemExit(0)

    result = detect_agent()

    if "--json" in args:
        print(format_json(result))
    elif "--explain" in args:
        print(format_explanation(result))

    raise SystemExit(0 if result.is_agent else 1)


def print_help() -> None:
    print(
        """agenthint

Detect whether the current process is probably running under an AI agent.

Usage:
  agenthint             Exit 0 if an agent is likely detected, otherwise 1
  agenthint --json      Print the structured detection result
  agenthint --explain   Print a short human-readable explanation
  agenthint --help      Show this help"""
    )


if __name__ == "__main__":
    main()
