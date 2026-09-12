import json
import subprocess
import sys
import unittest
from importlib.resources import files
from pathlib import Path

from agenthint import detect_agent, format_json


def run_cli(args, env):
    python_path = str(Path("python").resolve())
    subprocess_env = {"PYTHONPATH": python_path, **env}

    return subprocess.run(
        [sys.executable, "-m", "agenthint.cli", *args],
        env=subprocess_env,
        text=True,
        capture_output=True,
        check=False,
    )


class AgentHintPythonTest(unittest.TestCase):
    def test_matches_shared_detection_fixtures(self):
        fixtures = json.loads(Path("fixtures/detection-cases.json").read_text())

        for fixture in fixtures:
            with self.subTest(fixture["name"]):
                result = detect_agent(env=fixture["env"], check_filesystem=False, check_parent_process=False)

                self.assertEqual(result.is_agent, fixture["isAgent"])
                self.assertEqual(result.agent, fixture["agent"])
                self.assertEqual(result.confidence, fixture["confidence"])
                self.assertEqual(result.signals, fixture["signals"])

    def test_detects_parent_process(self):
        result = detect_agent(
            env={},
            check_filesystem=False,
            parent_process_name="/usr/local/bin/codex",
        )

        self.assertTrue(result.is_agent)
        self.assertEqual(result.agent, "codex")
        self.assertEqual(result.confidence, 0.55)
        self.assertEqual(result.signals, ["process:parent:codex"])

    def test_prefers_earliest_rule_on_ties(self):
        result = detect_agent(
            env={"CURSOR_AGENT": "1", "GEMINI_CLI": "true"},
            check_filesystem=False,
            check_parent_process=False,
        )

        self.assertEqual(result.agent, "cursor")
        self.assertEqual(result.confidence, 0.92)

    def test_sorts_prefix_signals(self):
        result = detect_agent(
            env={"AIDER_ZZZ": "1", "AIDER_MODEL": "sonnet", "AIDER_AAA": "1"},
            check_filesystem=False,
            check_parent_process=False,
        )

        self.assertEqual(result.signals, ["env:AIDER_AAA", "env:AIDER_MODEL", "env:AIDER_ZZZ"])

    def test_ignores_whitespace_only_values(self):
        result = detect_agent(
            env={"CODEX_HOME": "   "},
            check_filesystem=False,
            check_parent_process=False,
        )

        self.assertFalse(result.is_agent)
        self.assertIsNone(result.agent)

    def test_includes_cowork_classifier(self):
        result = detect_agent(
            env={"CLAUDE_CODE": "1", "CLAUDE_CODE_IS_COWORK": "1"},
            check_filesystem=False,
            check_parent_process=False,
        )

        self.assertEqual(result.agent, "cowork")
        self.assertEqual(result.signals, ["env:CLAUDE_CODE", "env:CLAUDE_CODE_IS_COWORK"])

    def test_normalizes_exe_case_insensitively(self):
        result = detect_agent(
            env={},
            check_filesystem=False,
            parent_process_name="/usr/local/bin/Codex.EXE",
        )

        self.assertEqual(result.agent, "codex")
        self.assertEqual(result.signals, ["process:parent:codex"])

    def test_truthy_overrides_case_insensitive(self):
        forced = detect_agent(env={"AGENTHINT_FORCE": "True"})
        disabled = detect_agent(env={"AGENTHINT_DISABLE": "YES", "CODEX_HOME": "/tmp/codex"})

        self.assertTrue(forced.is_agent)
        self.assertFalse(disabled.is_agent)

    def test_json_uses_camel_case_shape(self):
        result = detect_agent(env={"AI_AGENT": "codex"})

        self.assertEqual(
            json.loads(format_json(result)),
            {
                "isAgent": True,
                "agent": "codex",
                "confidence": 0.98,
                "signals": ["env:AI_AGENT"],
            },
        )

    def test_cli_matches_shared_fixtures(self):
        fixtures = json.loads(Path("fixtures/cli-cases.json").read_text())

        for fixture in fixtures:
            with self.subTest(fixture["name"]):
                result = run_cli(fixture["args"], fixture["env"])

                self.assertEqual(result.returncode, fixture["status"])

                if fixture.get("stdout") is not None:
                    self.assertEqual(result.stdout, fixture["stdout"])

                for expected in fixture.get("stdoutContains", []):
                    self.assertIn(expected, result.stdout)

    def test_cli_rejects_invalid_usage(self):
        result = run_cli(["bogus"], {})

        self.assertEqual(result.returncode, 2)
        self.assertEqual(result.stdout, "")
        self.assertIn("invalid usage: bogus", result.stderr)

    def test_cli_treats_non_leading_init_as_invalid_usage(self):
        result = run_cli(["foo", "init", "bar"], {})

        self.assertEqual(result.returncode, 2)
        self.assertIn("invalid usage: foo init bar", result.stderr)

    def test_package_includes_detection_rules(self):
        rules = json.loads(files("agenthint").joinpath("detection-rules.json").read_text(encoding="utf8"))

        self.assertIn("environmentRules", rules)
        self.assertIn("parentProcessRules", rules)


if __name__ == "__main__":
    unittest.main()
