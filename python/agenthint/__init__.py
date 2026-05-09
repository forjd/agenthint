from __future__ import annotations

import json
import os
import subprocess
from dataclasses import dataclass
from importlib.resources import files
from pathlib import Path
from typing import Callable, Mapping

AgentName = str

TRUE_VALUES = {"1", "true", "yes", "on"}
PARENT_CONFIDENCE = 0.55


@dataclass(frozen=True)
class AgentHintResult:
    is_agent: bool
    agent: AgentName | None
    confidence: float
    signals: list[str]

    def to_dict(self) -> dict[str, object]:
        return {
            "isAgent": self.is_agent,
            "agent": self.agent,
            "confidence": self.confidence,
            "signals": self.signals,
        }


def detect_agent(
    *,
    env: Mapping[str, str] | None = None,
    stdout_is_tty: bool | None = None,
    stdin_is_tty: bool | None = None,
    check_filesystem: bool = True,
    check_parent_process: bool = True,
    parent_process_name: str | None = None,
    file_exists: Callable[[str], bool] = os.path.exists,
) -> AgentHintResult:
    env = os.environ if env is None else env

    if _is_truthy(env.get("AGENTHINT_DISABLE")):
        return AgentHintResult(False, None, 1, ["env:AGENTHINT_DISABLE"])

    if _is_truthy(env.get("AGENTHINT_FORCE")):
        return AgentHintResult(
            True,
            _normalize_agent_name(env.get("AGENTHINT_AGENT")) or "unknown",
            1,
            ["env:AGENTHINT_FORCE"],
        )

    ai_agent = _from_ai_agent(env)
    if ai_agent is not None:
        return ai_agent

    matches = _detection_matches(env)
    if matches:
        best = matches[0]
        return AgentHintResult(True, best["agent"], best["confidence"], [signal for match in matches for signal in match["signals"]])

    if check_filesystem and file_exists("/opt/.devin"):
        return AgentHintResult(True, "devin", 0.9, ["file:/opt/.devin"])

    parent_result = _from_parent_process(check_parent_process, parent_process_name)
    if parent_result is not None:
        return parent_result

    tty_signals: list[str] = []
    if stdout_is_tty is False:
        tty_signals.append("stdio:stdout-not-tty")
    if stdin_is_tty is False:
        tty_signals.append("stdio:stdin-not-tty")
    if tty_signals:
        return AgentHintResult(False, None, 0.2, tty_signals)

    return AgentHintResult(False, None, 0, [])


def format_explanation(result: AgentHintResult) -> str:
    status = "agent runtime likely detected" if result.is_agent else "agent runtime not detected"
    agent = f"\nagent: {result.agent}" if result.agent else ""
    signals = ", ".join(result.signals) if result.signals else "none"
    return f"{status}{agent}\nconfidence: {result.confidence:.2f}\nsignals: {signals}"


def format_json(result: AgentHintResult) -> str:
    return json.dumps(result.to_dict(), indent=2)


def _from_ai_agent(env: Mapping[str, str]) -> AgentHintResult | None:
    value = env.get("AI_AGENT")
    if value is None or not value.strip():
        return None

    return AgentHintResult(True, _normalize_agent_name(value) or value.strip(), 0.98, ["env:AI_AGENT"])


def _detection_matches(env: Mapping[str, str]) -> list[dict[str, object]]:
    rules = _rules()
    matches: list[dict[str, object]] = []

    for rule in rules["environmentRules"]:
        signals = _present(env, rule["names"])
        if signals:
            matches.append({"agent": rule["agent"], "confidence": rule["confidence"], "signals": signals})

        if rule["agent"] == "opencode":
            claude_signals = _present(env, ["CLAUDECODE", "CLAUDE_CODE", "CLAUDECODE_CWD"])
            if claude_signals:
                agent = "cowork" if _present(env, ["CLAUDE_CODE_IS_COWORK"]) else "claude-code"
                matches.append({"agent": agent, "confidence": 0.9, "signals": claude_signals})

    for rule in rules["prefixRules"]:
        signals = _prefix_present(env, rule["prefix"])
        if signals:
            matches.append({"agent": rule["agent"], "confidence": rule["confidence"], "signals": signals})

    return matches


def _from_parent_process(check_parent_process: bool, parent_process_name: str | None) -> AgentHintResult | None:
    if not check_parent_process:
        return None

    name = _normalize_process_name(parent_process_name or _parent_process_name())
    if name is None:
        return None

    for rule in _rules()["parentProcessRules"]:
        if name in rule["names"]:
            return AgentHintResult(True, rule["agent"], PARENT_CONFIDENCE, [f"process:parent:{name}"])

    return None


def _parent_process_name() -> str | None:
    ppid = os.getppid()
    if ppid <= 0:
        return None

    proc_path = Path(f"/proc/{ppid}/comm")
    try:
        value = proc_path.read_text(encoding="utf8").strip()
        if value:
            return value
    except OSError:
        pass

    try:
        return subprocess.run(
            ["ps", "-o", "comm=", "-p", str(ppid)],
            check=True,
            capture_output=True,
            text=True,
        ).stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        return None


def _present(env: Mapping[str, str], names: list[str]) -> list[str]:
    return [f"env:{name}" for name in names if env.get(name)]


def _prefix_present(env: Mapping[str, str], prefix: str) -> list[str]:
    return [f"env:{name}" for name, value in env.items() if name.startswith(prefix) and value]


def _is_truthy(value: str | None) -> bool:
    return value is not None and value.lower() in TRUE_VALUES


def _normalize_agent_name(value: str | None) -> str | None:
    if value is None or not value.strip():
        return None

    normalized = value.strip()
    if normalized in {"github-copilot", "github-copilot-cli"}:
        return "copilot"
    if normalized.startswith("claude-code"):
        return "claude-code"
    if normalized in {"roo", "roo-code"}:
        return "roo-code"
    if normalized in {"kilo-code", "kilocode"}:
        return "kilocode"
    if normalized in {"mistral-vibe", "vibe"}:
        return "mistral-vibe"
    return normalized


def _normalize_process_name(value: str | None) -> str | None:
    if value is None or not value.strip():
        return None
    return Path(value.strip()).name.removesuffix(".exe").lower()


def _rules() -> dict[str, object]:
    return json.loads(files("agenthint").joinpath("detection-rules.json").read_text(encoding="utf8"))


__all__ = ["AgentHintResult", "detect_agent", "format_explanation", "format_json"]
