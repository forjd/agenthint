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

    def test_package_includes_detection_rules(self):
        rules = json.loads(files("agenthint").joinpath("detection-rules.json").read_text(encoding="utf8"))

        self.assertIn("environmentRules", rules)
        self.assertIn("parentProcessRules", rules)


if __name__ == "__main__":
    unittest.main()
