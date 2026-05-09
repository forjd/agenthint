use std::collections::HashMap;
use std::path::Path;
use std::process::Command;

mod generated_rules;

#[derive(Debug, Clone, PartialEq)]
pub struct AgentHintResult {
    pub is_agent: bool,
    pub agent: Option<String>,
    pub confidence: f32,
    pub signals: Vec<String>,
}

impl AgentHintResult {
    pub fn no_agent() -> Self {
        Self {
            is_agent: false,
            agent: None,
            confidence: 0.0,
            signals: Vec::new(),
        }
    }
}

#[derive(Debug, Clone)]
pub struct DetectAgentOptions {
    pub env: HashMap<String, String>,
    pub stdin_is_tty: Option<bool>,
    pub stdout_is_tty: Option<bool>,
    pub check_filesystem: bool,
    pub check_parent_process: bool,
    pub parent_process_name: Option<String>,
}

impl Default for DetectAgentOptions {
    fn default() -> Self {
        Self {
            env: std::env::vars().collect(),
            stdin_is_tty: None,
            stdout_is_tty: None,
            check_filesystem: true,
            check_parent_process: true,
            parent_process_name: None,
        }
    }
}

pub fn detect_agent() -> AgentHintResult {
    detect_agent_with_options(DetectAgentOptions::default())
}

pub fn detect_agent_with_options(options: DetectAgentOptions) -> AgentHintResult {
    if is_truthy(options.env.get("AGENTHINT_DISABLE")) {
        return AgentHintResult {
            is_agent: false,
            agent: None,
            confidence: 1.0,
            signals: vec!["env:AGENTHINT_DISABLE".to_string()],
        };
    }

    if is_truthy(options.env.get("AGENTHINT_FORCE")) {
        return AgentHintResult {
            is_agent: true,
            agent: Some(
                normalize_agent_name(options.env.get("AGENTHINT_AGENT"))
                    .unwrap_or_else(|| "unknown".to_string()),
            ),
            confidence: 1.0,
            signals: vec!["env:AGENTHINT_FORCE".to_string()],
        };
    }

    if let Some(result) = from_ai_agent_env_var(&options.env) {
        return result;
    }

    let matches = detection_matches(&options.env);
    if let Some(best) = matches.first() {
        return AgentHintResult {
            is_agent: true,
            agent: Some(best.agent.clone()),
            confidence: best.confidence,
            signals: matches
                .iter()
                .flat_map(|agent_match| agent_match.signals.clone())
                .collect(),
        };
    }

    if options.check_filesystem && Path::new("/opt/.devin").exists() {
        return AgentHintResult {
            is_agent: true,
            agent: Some("devin".to_string()),
            confidence: 0.9,
            signals: vec!["file:/opt/.devin".to_string()],
        };
    }

    if let Some(result) = from_parent_process(&options) {
        return result;
    }

    let tty_signals = tty_hints(&options);
    if !tty_signals.is_empty() {
        return AgentHintResult {
            is_agent: false,
            agent: None,
            confidence: 0.2,
            signals: tty_signals,
        };
    }

    AgentHintResult::no_agent()
}

pub fn format_explanation(result: &AgentHintResult) -> String {
    let status = if result.is_agent {
        "agent runtime likely detected"
    } else {
        "agent runtime not detected"
    };
    let agent = result
        .agent
        .as_ref()
        .map(|agent| format!("\nagent: {agent}"))
        .unwrap_or_default();
    let signals = if result.signals.is_empty() {
        "\nsignals: none".to_string()
    } else {
        format!("\nsignals: {}", result.signals.join(", "))
    };

    format!(
        "{status}{agent}\nconfidence: {:.2}{signals}",
        result.confidence
    )
}

pub fn format_doctor(result: &AgentHintResult) -> String {
    let status = if result.is_agent {
        "agent runtime likely detected"
    } else {
        "agent runtime not detected"
    };
    let agent = result.agent.as_deref().unwrap_or("none");
    let signals = if result.signals.is_empty() {
        "none".to_string()
    } else {
        result.signals.join(", ")
    };
    let setup = if result.signals.iter().any(|signal| signal == "env:AI_AGENT") {
        "setup: AI_AGENT is set; this is the preferred explicit convention.".to_string()
    } else if result.is_agent {
        format!(
            "setup: detection is heuristic. Prefer setting AI_AGENT for a stable explicit signal.\nhint: {}",
            setup_hint(agent)
        )
    } else {
        "setup: no agent signal was detected.\nhint: agents should set AI_AGENT=<agent-name> before invoking tools.".to_string()
    };

    format!(
        "agenthint doctor\n\nstatus: {status}\nagent: {agent}\nconfidence: {:.2}\nsignals: {signals}\n\n{setup}\n\nsecurity: use this as a UX hint only, not as a trust boundary.",
        result.confidence
    )
}

pub fn format_doctor_json(result: &AgentHintResult) -> String {
    let status = if result.is_agent {
        "agent runtime likely detected"
    } else {
        "agent runtime not detected"
    };
    let agent = result
        .agent
        .as_ref()
        .map(|agent| format!("\"{}\"", escape_json(agent)))
        .unwrap_or_else(|| "null".to_string());
    let signals = result
        .signals
        .iter()
        .map(|signal| format!("\"{}\"", escape_json(signal)))
        .collect::<Vec<_>>()
        .join(",\n    ");
    let setup = doctor_setup_json(result);

    format!(
        "{{\n  \"status\": \"{status}\",\n  \"agent\": {agent},\n  \"confidence\": {},\n  \"signals\": [{}],\n  \"setup\": {setup},\n  \"security\": \"use this as a UX hint only, not as a trust boundary\"\n}}",
        format_confidence(result.confidence),
        if signals.is_empty() {
            String::new()
        } else {
            format!("\n    {signals}\n  ")
        }
    )
}

fn doctor_setup_json(result: &AgentHintResult) -> String {
    if result.signals.iter().any(|signal| signal == "env:AI_AGENT") {
        return "{\n    \"kind\": \"explicit\",\n    \"message\": \"AI_AGENT is set; this is the preferred explicit convention.\"\n  }".to_string();
    }

    if result.is_agent {
        let agent = result.agent.as_deref().unwrap_or("unknown");
        return format!(
            "{{\n    \"kind\": \"heuristic\",\n    \"message\": \"Detection is heuristic. Prefer setting AI_AGENT for a stable explicit signal.\",\n    \"hint\": \"{}\"\n  }}",
            escape_json(&setup_hint(agent))
        );
    }

    "{\n    \"kind\": \"missing\",\n    \"message\": \"No agent signal was detected.\",\n    \"hint\": \"Agents should set AI_AGENT=<agent-name> before invoking tools.\"\n  }"
        .to_string()
}

pub fn format_init(agent: Option<&str>) -> String {
    let Some(agent) = normalize_agent_name(agent.map(|value| value.to_string()).as_ref()) else {
        return [
            "agenthint init",
            "",
            "Usage:",
            "  agenthint init <agent-name>",
            "",
            "Example:",
            "  agenthint init codex",
        ]
        .join("\n");
    };

    [
        format!("AI_AGENT={agent}"),
        String::new(),
        "Use this value in the environment used for agent tool calls.".to_string(),
    ]
    .join("\n")
}

pub fn to_json(result: &AgentHintResult) -> String {
    let agent = result
        .agent
        .as_ref()
        .map(|agent| format!("\"{}\"", escape_json(agent)))
        .unwrap_or_else(|| "null".to_string());
    let signals = result
        .signals
        .iter()
        .map(|signal| format!("\"{}\"", escape_json(signal)))
        .collect::<Vec<_>>()
        .join(",\n    ");

    format!(
        "{{\n  \"isAgent\": {},\n  \"agent\": {},\n  \"confidence\": {},\n  \"signals\": [{}]\n}}",
        result.is_agent,
        agent,
        format_confidence(result.confidence),
        if signals.is_empty() {
            String::new()
        } else {
            format!("\n    {signals}\n  ")
        }
    )
}

#[derive(Debug, Clone)]
struct AgentMatch {
    agent: String,
    confidence: f32,
    signals: Vec<String>,
}

fn from_ai_agent_env_var(env: &HashMap<String, String>) -> Option<AgentHintResult> {
    let value = env.get("AI_AGENT")?.trim();
    if value.is_empty() {
        return None;
    }

    Some(AgentHintResult {
        is_agent: true,
        agent: Some(
            normalize_agent_name(Some(&value.to_string())).unwrap_or_else(|| value.to_string()),
        ),
        confidence: 0.98,
        signals: vec!["env:AI_AGENT".to_string()],
    })
}

fn detection_matches(env: &HashMap<String, String>) -> Vec<AgentMatch> {
    let mut matches = Vec::new();

    for rule in generated_rules::ENVIRONMENT_RULES {
        push_present(&mut matches, env, rule.agent, rule.confidence, rule.names);

        if rule.agent == "opencode" {
            let claude_signals = present(env, &["CLAUDECODE", "CLAUDE_CODE", "CLAUDECODE_CWD"]);
            if !claude_signals.is_empty() {
                let agent = if present(env, &["CLAUDE_CODE_IS_COWORK"]).is_empty() {
                    "claude-code"
                } else {
                    "cowork"
                };
                matches.push(AgentMatch {
                    agent: agent.to_string(),
                    confidence: 0.9,
                    signals: claude_signals,
                });
            }
        }
    }

    for rule in generated_rules::PREFIX_RULES {
        push_prefix(&mut matches, env, rule.agent, rule.confidence, rule.prefix);
    }

    matches
}

fn from_parent_process(options: &DetectAgentOptions) -> Option<AgentHintResult> {
    if !options.check_parent_process {
        return None;
    }

    let raw_name = options
        .parent_process_name
        .clone()
        .or_else(parent_process_name)?;
    let name = normalize_process_name(&raw_name)?;
    let agent = agent_from_process_name(&name)?;

    Some(AgentHintResult {
        is_agent: true,
        agent: Some(agent.to_string()),
        confidence: 0.55,
        signals: vec![format!("process:parent:{name}")],
    })
}

fn parent_process_name() -> Option<String> {
    let ppid_output = Command::new("ps")
        .args(["-o", "ppid=", "-p", &std::process::id().to_string()])
        .output()
        .ok()?;

    if !ppid_output.status.success() {
        return None;
    }

    let ppid = String::from_utf8(ppid_output.stdout).ok()?;
    let ppid = ppid.trim();

    if ppid.is_empty() {
        return None;
    }

    let proc_path = format!("/proc/{ppid}/comm");

    if let Ok(value) = std::fs::read_to_string(proc_path) {
        let trimmed = value.trim();
        if !trimmed.is_empty() {
            return Some(trimmed.to_string());
        }
    }

    let output = Command::new("ps")
        .args(["-o", "comm=", "-p", ppid])
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let value = String::from_utf8(output.stdout).ok()?;
    let trimmed = value.trim();

    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

fn normalize_process_name(value: &str) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return None;
    }

    let file_name = Path::new(trimmed).file_name()?.to_string_lossy();
    let lower = file_name.to_lowercase();

    Some(lower.strip_suffix(".exe").unwrap_or(&lower).to_string())
}

fn agent_from_process_name(name: &str) -> Option<&'static str> {
    generated_rules::PARENT_PROCESS_RULES
        .iter()
        .find(|rule| rule.names.contains(&name))
        .map(|rule| rule.agent)
}

fn push_present(
    matches: &mut Vec<AgentMatch>,
    env: &HashMap<String, String>,
    agent: &str,
    confidence: f32,
    names: &[&str],
) {
    let signals = present(env, names);
    if !signals.is_empty() {
        matches.push(AgentMatch {
            agent: agent.to_string(),
            confidence,
            signals,
        });
    }
}

fn push_prefix(
    matches: &mut Vec<AgentMatch>,
    env: &HashMap<String, String>,
    agent: &str,
    confidence: f32,
    prefix: &str,
) {
    let signals = prefix_present(env, prefix);
    if !signals.is_empty() {
        matches.push(AgentMatch {
            agent: agent.to_string(),
            confidence,
            signals,
        });
    }
}

fn present(env: &HashMap<String, String>, names: &[&str]) -> Vec<String> {
    names
        .iter()
        .filter(|name| env.get(**name).is_some_and(|value| !value.is_empty()))
        .map(|name| format!("env:{name}"))
        .collect()
}

fn prefix_present(env: &HashMap<String, String>, prefix: &str) -> Vec<String> {
    env.iter()
        .filter(|(name, value)| name.starts_with(prefix) && !value.is_empty())
        .map(|(name, _)| format!("env:{name}"))
        .collect()
}

fn tty_hints(options: &DetectAgentOptions) -> Vec<String> {
    let mut signals = Vec::new();

    if options.stdout_is_tty == Some(false) {
        signals.push("stdio:stdout-not-tty".to_string());
    }

    if options.stdin_is_tty == Some(false) {
        signals.push("stdio:stdin-not-tty".to_string());
    }

    signals
}

fn is_truthy(value: Option<&String>) -> bool {
    value.is_some_and(|value| matches!(value.to_lowercase().as_str(), "1" | "true" | "yes" | "on"))
}

fn normalize_agent_name(value: Option<&String>) -> Option<String> {
    let normalized = value?.trim();
    if normalized.is_empty() {
        return None;
    }

    match normalized {
        "github-copilot" | "github-copilot-cli" => Some("copilot".to_string()),
        "roo" | "roo-code" => Some("roo-code".to_string()),
        "kilo-code" | "kilocode" => Some("kilocode".to_string()),
        "mistral-vibe" | "vibe" => Some("mistral-vibe".to_string()),
        _ if normalized.starts_with("claude-code") => Some("claude-code".to_string()),
        _ => Some(normalized.to_string()),
    }
}

fn setup_hint(agent: &str) -> String {
    match agent {
        "codex" => {
            "Set AI_AGENT=codex in AGENTS.md instructions or the shell environment used for tool calls."
        }
        "claude-code" => "Set AI_AGENT=claude-code in a PreToolUse hook or shell wrapper.",
        "cursor" => "Set AI_AGENT=cursor in Cursor agent hooks or workspace shell configuration.",
        "gemini" => "Set AI_AGENT=gemini in Gemini CLI hook or shell configuration.",
        "copilot" => {
            "Set AI_AGENT=github-copilot-cli for Copilot CLI or AI_AGENT=github-copilot for Copilot agents."
        }
        "windsurf" => "Set AI_AGENT=windsurf in .windsurfrules or the workspace shell environment.",
        "cline" => "Set AI_AGENT=cline in .clinerules or the Cline shell environment.",
        "roo-code" => "Set AI_AGENT=roo-code in Roo Code rules or shell environment.",
        "kilocode" => "Set AI_AGENT=kilocode in .kilocode rules or shell environment.",
        "opencode" => "Set AI_AGENT=opencode in an OpenCode plugin or shell environment.",
        "openclaw" => "Set AI_AGENT=openclaw in an OpenClaw plugin or shell environment.",
        "antigravity" => "Set AI_AGENT=antigravity in .agents rules or shell environment.",
        _ => return format!("Set AI_AGENT={agent} in the agent's tool-call environment."),
    }
    .to_string()
}

fn escape_json(value: &str) -> String {
    value
        .chars()
        .flat_map(|character| match character {
            '"' => "\\\"".chars().collect::<Vec<_>>(),
            '\\' => "\\\\".chars().collect::<Vec<_>>(),
            '\n' => "\\n".chars().collect::<Vec<_>>(),
            '\r' => "\\r".chars().collect::<Vec<_>>(),
            '\t' => "\\t".chars().collect::<Vec<_>>(),
            _ => vec![character],
        })
        .collect()
}

fn format_confidence(confidence: f32) -> String {
    if confidence == 0.0 {
        "0".to_string()
    } else if confidence == 1.0 {
        "1".to_string()
    } else {
        confidence.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::Value;

    fn env(entries: &[(&str, &str)]) -> HashMap<String, String> {
        entries
            .iter()
            .map(|(key, value)| (key.to_string(), value.to_string()))
            .collect()
    }

    fn detect(env: HashMap<String, String>) -> AgentHintResult {
        detect_agent_with_options(DetectAgentOptions {
            env,
            check_filesystem: false,
            ..DetectAgentOptions::default()
        })
    }

    #[test]
    fn matches_shared_detection_fixtures() {
        let fixture_path = format!(
            "{}/../../fixtures/detection-cases.json",
            env!("CARGO_MANIFEST_DIR")
        );
        let fixtures: Value =
            serde_json::from_str(&std::fs::read_to_string(fixture_path).unwrap()).unwrap();
        let fixtures = fixtures.as_array().unwrap();

        for fixture in fixtures {
            let name = fixture["name"].as_str().unwrap();
            let fixture_env = fixture["env"]
                .as_object()
                .unwrap()
                .iter()
                .map(|(key, value)| (key.to_string(), value.as_str().unwrap().to_string()))
                .collect::<HashMap<_, _>>();
            let result = detect(fixture_env);
            let expected_agent = fixture["agent"].as_str();
            let expected_signals = fixture["signals"]
                .as_array()
                .unwrap()
                .iter()
                .map(|signal| signal.as_str().unwrap().to_string())
                .collect::<Vec<_>>();

            assert_eq!(
                result.is_agent,
                fixture["isAgent"].as_bool().unwrap(),
                "{name}"
            );
            assert_eq!(result.agent.as_deref(), expected_agent, "{name}");
            assert_eq!(
                result.confidence,
                fixture["confidence"].as_f64().unwrap() as f32,
                "{name}"
            );
            assert_eq!(result.signals, expected_signals, "{name}");
        }
    }

    #[test]
    fn matches_shared_cli_fixtures() {
        let fixture_path = format!(
            "{}/../../fixtures/cli-cases.json",
            env!("CARGO_MANIFEST_DIR")
        );
        let fixtures: Value =
            serde_json::from_str(&std::fs::read_to_string(fixture_path).unwrap()).unwrap();
        let fixtures = fixtures.as_array().unwrap();

        for fixture in fixtures {
            let name = fixture["name"].as_str().unwrap();
            let args = fixture["args"]
                .as_array()
                .unwrap()
                .iter()
                .map(|arg| arg.as_str().unwrap())
                .collect::<Vec<_>>();
            let fixture_env = fixture["env"]
                .as_object()
                .unwrap()
                .iter()
                .map(|(key, value)| (key.to_string(), value.as_str().unwrap().to_string()))
                .collect::<HashMap<_, _>>();
            let result = detect(fixture_env);
            let output = if args.contains(&"doctor") {
                if args.contains(&"--json") {
                    format!("{}\n", format_doctor_json(&result))
                } else {
                    format!("{}\n", format_doctor(&result))
                }
            } else if args.contains(&"--json") {
                format!("{}\n", to_json(&result))
            } else if args.contains(&"--explain") {
                format!("{}\n", format_explanation(&result))
            } else if let Some(init_index) = args.iter().position(|arg| *arg == "init") {
                format!("{}\n", format_init(args.get(init_index + 1).copied()))
            } else {
                String::new()
            };

            if let Some(expected) = fixture["stdout"].as_str() {
                assert_eq!(output, expected, "{name}");
            }

            if let Some(expected_values) = fixture["stdoutContains"].as_array() {
                for expected in expected_values {
                    assert!(output.contains(expected.as_str().unwrap()), "{name}");
                }
            }
        }
    }

    #[test]
    fn prioritizes_ai_agent() {
        let result = detect(env(&[("AI_AGENT", "custom-agent"), ("CURSOR_AGENT", "1")]));

        assert!(result.is_agent);
        assert_eq!(result.agent.as_deref(), Some("custom-agent"));
        assert_eq!(result.confidence, 0.98);
        assert_eq!(result.signals, vec!["env:AI_AGENT"]);
    }

    #[test]
    fn normalizes_known_aliases() {
        assert_eq!(
            detect(env(&[("AI_AGENT", "github-copilot-cli")]))
                .agent
                .as_deref(),
            Some("copilot")
        );
        assert_eq!(
            detect(env(&[("AI_AGENT", "claude-code/2.1.123/agent")]))
                .agent
                .as_deref(),
            Some("claude-code")
        );
        assert_eq!(
            detect(env(&[("AI_AGENT", "roo")])).agent.as_deref(),
            Some("roo-code")
        );
        assert_eq!(
            detect(env(&[("AI_AGENT", "kilo-code")])).agent.as_deref(),
            Some("kilocode")
        );
        assert_eq!(
            detect(env(&[("AI_AGENT", "vibe")])).agent.as_deref(),
            Some("mistral-vibe")
        );
    }

    #[test]
    fn detects_known_parent_process_names() {
        let result = detect_agent_with_options(DetectAgentOptions {
            env: HashMap::new(),
            check_filesystem: false,
            parent_process_name: Some("/usr/local/bin/codex".to_string()),
            ..DetectAgentOptions::default()
        });

        assert!(result.is_agent);
        assert_eq!(result.agent.as_deref(), Some("codex"));
        assert_eq!(result.confidence, 0.55);
        assert_eq!(result.signals, vec!["process:parent:codex"]);
    }

    #[test]
    fn can_skip_parent_process_checks() {
        let result = detect_agent_with_options(DetectAgentOptions {
            env: HashMap::new(),
            check_filesystem: false,
            check_parent_process: false,
            parent_process_name: Some("codex".to_string()),
            ..DetectAgentOptions::default()
        });

        assert!(!result.is_agent);
        assert_eq!(result.agent, None);
    }

    #[test]
    fn detects_known_environment_signals() {
        let cases = [
            ("cursor", vec![("CURSOR_AGENT", "1")]),
            ("gemini", vec![("GEMINI_CLI", "true")]),
            ("codex", vec![("CODEX_CI", "1")]),
            ("augment-cli", vec![("AUGMENT_AGENT", "true")]),
            ("amp", vec![("AMP_CURRENT_THREAD_ID", "thread")]),
            ("opencode", vec![("OPENCODE_CLIENT", "true")]),
            ("claude-code", vec![("CLAUDECODE", "1")]),
            ("copilot", vec![("COPILOT_CLI", "1")]),
            ("aider", vec![("AIDER_MODEL", "sonnet")]),
            ("replit", vec![("REPL_ID", "id")]),
            ("antigravity", vec![("ANTIGRAVITY_AGENT", "1")]),
            ("pi", vec![("PI_CODING_AGENT", "1")]),
            ("kiro-cli", vec![("KIRO_AGENT_PATH", "/usr/local/bin/kiro")]),
            ("windsurf", vec![("WINDSURF_AGENT", "1")]),
            ("cline", vec![("CLINE_AGENT", "1")]),
            ("roo-code", vec![("ROO_CODE_AGENT", "1")]),
            ("kilocode", vec![("KILOCODE_AGENT", "1")]),
            ("openclaw", vec![("OPENCLAW_AGENT", "1")]),
        ];

        for (agent, entries) in cases {
            let result = detect(env(&entries));
            assert_eq!(result.agent.as_deref(), Some(agent));
        }
    }

    #[test]
    fn detects_cowork_only_with_claude() {
        let cowork = detect(env(&[("CLAUDE_CODE", "1"), ("CLAUDE_CODE_IS_COWORK", "1")]));
        let not_cowork = detect(env(&[("CLAUDE_CODE_IS_COWORK", "1")]));

        assert_eq!(cowork.agent.as_deref(), Some("cowork"));
        assert!(!not_cowork.is_agent);
    }

    #[test]
    fn supports_force_and_disable() {
        let forced = detect(env(&[
            ("AGENTHINT_FORCE", "true"),
            ("AGENTHINT_AGENT", "cursor"),
        ]));
        let disabled = detect(env(&[
            ("AGENTHINT_DISABLE", "1"),
            ("CODEX_HOME", "/tmp/codex"),
        ]));

        assert_eq!(forced.agent.as_deref(), Some("cursor"));
        assert_eq!(forced.confidence, 1.0);
        assert!(!disabled.is_agent);
        assert_eq!(disabled.confidence, 1.0);
    }

    #[test]
    fn reports_low_confidence_stdio_hints() {
        let result = detect_agent_with_options(DetectAgentOptions {
            env: HashMap::new(),
            stdout_is_tty: Some(false),
            stdin_is_tty: Some(false),
            check_filesystem: false,
            ..DetectAgentOptions::default()
        });

        assert!(!result.is_agent);
        assert_eq!(result.confidence, 0.2);
        assert_eq!(
            result.signals,
            vec!["stdio:stdout-not-tty", "stdio:stdin-not-tty"]
        );
    }

    #[test]
    fn formats_json_without_secret_values() {
        let result = detect(env(&[("COPILOT_GITHUB_TOKEN", "secret")]));
        let json = to_json(&result);

        assert!(json.contains("\"agent\": \"copilot\""));
        assert!(json.contains("env:COPILOT_GITHUB_TOKEN"));
        assert!(!json.contains("secret"));
    }

    #[test]
    fn formats_init_advice() {
        assert!(format_init(Some("codex")).contains("AI_AGENT=codex"));
        assert!(format_init(Some("roo")).contains("AI_AGENT=roo-code"));
        assert!(format_init(None).contains("agenthint init <agent-name>"));
    }
}
