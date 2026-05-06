use agenthint::{detect_agent, format_doctor, format_explanation, format_init, to_json};

fn main() {
    let args = std::env::args().skip(1).collect::<Vec<_>>();

    if args.iter().any(|arg| arg == "-h" || arg == "--help") {
        print_help();
        std::process::exit(0);
    }

    let result = detect_agent();

    if let Some(init_index) = args.iter().position(|arg| arg == "init") {
        println!(
            "{}",
            format_init(args.get(init_index + 1).map(String::as_str))
        );
        std::process::exit(0);
    } else if args.iter().any(|arg| arg == "doctor") {
        println!("{}", format_doctor(&result));
    } else if args.iter().any(|arg| arg == "--json") {
        println!("{}", to_json(&result));
    } else if args.iter().any(|arg| arg == "--explain") {
        println!("{}", format_explanation(&result));
    }

    std::process::exit(if result.is_agent { 0 } else { 1 });
}

fn print_help() {
    println!(
        "agenthint

Detect whether the current process is probably running under an AI agent.

Usage:
  agenthint             Exit 0 if an agent is likely detected, otherwise 1
  agenthint init <name> Print the recommended AI_AGENT value
  agenthint doctor      Print detection details and setup advice
  agenthint --json      Print the structured detection result
  agenthint --explain   Print a short human-readable explanation
  agenthint --help      Show this help"
    );
}
