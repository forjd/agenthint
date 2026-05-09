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
        best = max(matches, key=lambda match: match["confidence"])
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


def format_doctor(result: AgentHintResult) -> str:
    lines = [
        "agenthint doctor",
        "",
        f"status: {'agent runtime likely detected' if result.is_agent else 'agent runtime not detected'}",
        f"agent: {result.agent or 'none'}",
        f"confidence: {result.confidence:.2f}",
        f"signals: {', '.join(result.signals) if result.signals else 'none'}",
        "",
    ]

    setup = _setup_advice(result)
    if setup["kind"] == "explicit":
        lines.append(setup["message"])
    else:
        lines.append(setup["message"])
        lines.append(f"hint: {setup['hint']}")

    lines.append("")
    lines.append("security: use this as a UX hint only, not as a trust boundary.")

    return "\n".join(lines)


def format_doctor_json(result: AgentHintResult) -> str:
    return json.dumps(
        {
            "status": "agent runtime likely detected" if result.is_agent else "agent runtime not detected",
            "agent": result.agent,
            "confidence": result.confidence,
            "signals": result.signals,
            "setup": _setup_advice(result, json_shape=True),
            "security": "use this as a UX hint only, not as a trust boundary",
        },
        indent=2,
    )


def format_init(agent: str | None) -> str:
    normalized = _normalize_agent_name(agent)

    if normalized is None:
        return "\n".join(
            [
                "agenthint init",
                "",
                "Usage:",
                "  agenthint init <agent-name>",
                "",
                "Example:",
                "  agenthint init codex",
            ]
        )

    return "\n".join(
        [
            f"AI_AGENT={normalized}",
            "",
            "Use this value in the environment used for agent tool calls.",
        ]
    )


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
            agent = "cowork" if rule["agent"] == "claude-code" and _present(env, ["CLAUDE_CODE_IS_COWORK"]) else rule["agent"]
            matches.append({"agent": agent, "confidence": rule["confidence"], "signals": signals})

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


def _setup_advice(result: AgentHintResult, *, json_shape: bool = False) -> dict[str, str]:
    if "env:AI_AGENT" in result.signals:
        message = "AI_AGENT is set; this is the preferred explicit convention."
        return {"kind": "explicit", "message": message} if json_shape else {"kind": "explicit", "message": f"setup: {message}"}

    if result.is_agent and result.agent is not None:
        message = "Detection is heuristic. Prefer setting AI_AGENT for a stable explicit signal."
        return {
            "kind": "heuristic",
            "message": message if json_shape else f"setup: {message[:1].lower()}{message[1:]}",
            "hint": _setup_hint(result.agent),
        }

    message = "No agent signal was detected."
    return {
        "kind": "missing",
        "message": message if json_shape else f"setup: {message.lower()}",
        "hint": "Agents should set AI_AGENT=<agent-name> before invoking tools.",
    }


def _setup_hint(agent: str) -> str:
    hints = {
        "codex": "Set AI_AGENT=codex in AGENTS.md instructions or the shell environment used for tool calls.",
        "claude-code": "Set AI_AGENT=claude-code in a PreToolUse hook or shell wrapper.",
        "cursor": "Set AI_AGENT=cursor in Cursor agent hooks or workspace shell configuration.",
        "gemini": "Set AI_AGENT=gemini in Gemini CLI hook or shell configuration.",
        "copilot": "Set AI_AGENT=github-copilot-cli for Copilot CLI or AI_AGENT=github-copilot for Copilot agents.",
        "windsurf": "Set AI_AGENT=windsurf in .windsurfrules or the workspace shell environment.",
        "cline": "Set AI_AGENT=cline in .clinerules or the Cline shell environment.",
        "roo-code": "Set AI_AGENT=roo-code in Roo Code rules or shell environment.",
        "kilocode": "Set AI_AGENT=kilocode in .kilocode rules or shell environment.",
        "opencode": "Set AI_AGENT=opencode in an OpenCode plugin or shell environment.",
        "openclaw": "Set AI_AGENT=openclaw in an OpenClaw plugin or shell environment.",
        "antigravity": "Set AI_AGENT=antigravity in .agents rules or shell environment.",
    }

    return hints.get(agent, f"Set AI_AGENT={agent} in the agent's tool-call environment.")


def _rules() -> dict[str, object]:
    return json.loads(files("agenthint").joinpath("detection-rules.json").read_text(encoding="utf8"))


__all__ = [
    "AgentHintResult",
    "detect_agent",
    "format_doctor",
    "format_doctor_json",
    "format_explanation",
    "format_init",
    "format_json",
]
