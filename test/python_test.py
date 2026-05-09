import json
import unittest
from pathlib import Path

from agenthint import detect_agent, format_json


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


if __name__ == "__main__":
    unittest.main()
