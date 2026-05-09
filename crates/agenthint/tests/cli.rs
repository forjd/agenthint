use std::collections::HashMap;
use std::process::Command;

use serde_json::Value;

fn fixture_path(name: &str) -> String {
    format!("{}/../../fixtures/{name}", env!("CARGO_MANIFEST_DIR"))
}

#[test]
fn cli_matches_shared_fixtures() {
    let fixtures: Value =
        serde_json::from_str(&std::fs::read_to_string(fixture_path("cli-cases.json")).unwrap())
            .unwrap();
    let fixtures = fixtures.as_array().unwrap();

    for fixture in fixtures {
        let name = fixture["name"].as_str().unwrap();
        let args = fixture["args"]
            .as_array()
            .unwrap()
            .iter()
            .map(|arg| arg.as_str().unwrap())
            .collect::<Vec<_>>();
        let env = fixture["env"]
            .as_object()
            .unwrap()
            .iter()
            .map(|(key, value)| (key.as_str(), value.as_str().unwrap()))
            .collect::<HashMap<_, _>>();

        let output = Command::new(env!("CARGO_BIN_EXE_agenthint"))
            .args(args)
            .env_clear()
            .envs(env)
            .output()
            .unwrap();

        assert_eq!(
            output.status.code(),
            Some(fixture["status"].as_i64().unwrap() as i32),
            "{name}"
        );

        let stdout = String::from_utf8(output.stdout).unwrap();

        if let Some(expected) = fixture["stdout"].as_str() {
            assert_eq!(stdout, expected, "{name}");
        }

        if let Some(expected_values) = fixture["stdoutContains"].as_array() {
            for expected in expected_values {
                assert!(stdout.contains(expected.as_str().unwrap()), "{name}");
            }
        }
    }
}

#[test]
fn cli_rejects_invalid_usage() {
    let output = Command::new(env!("CARGO_BIN_EXE_agenthint"))
        .arg("bogus")
        .env_clear()
        .output()
        .unwrap();

    assert_eq!(output.status.code(), Some(2));
    assert!(output.stdout.is_empty());
    assert!(
        String::from_utf8(output.stderr)
            .unwrap()
            .contains("invalid usage: bogus")
    );
}
