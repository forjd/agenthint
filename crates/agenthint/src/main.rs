use agenthint::{
    detect_agent, format_doctor, format_doctor_json, format_explanation, format_init, to_json,
};

fn main() {
    let args = std::env::args().skip(1).collect::<Vec<_>>();

    if args.len() == 1 && (args[0] == "-h" || args[0] == "--help") {
        print_help();
        std::process::exit(0);
    }

    if args.first().is_some_and(|arg| arg == "init") {
        if args.len() != 2 || args[1].trim().is_empty() || args[1].starts_with('-') {
            print_usage_error(&format_init(None));
        }

        println!("{}", format_init(args.get(1).map(String::as_str)));
        std::process::exit(0);
    }

    let valid_args = args.is_empty()
        || (args.len() == 1 && (args[0] == "--json" || args[0] == "--explain"))
        || (args.len() == 1 && args[0] == "doctor")
        || (args.len() == 2 && args[0] == "doctor" && args[1] == "--json");

    if !valid_args {
        print_usage_error(&format!("invalid usage: {}", args.join(" ")));
    }

    let result = detect_agent();

    if args.first().is_some_and(|arg| arg == "doctor") {
        if args.get(1).is_some_and(|arg| arg == "--json") {
            println!("{}", format_doctor_json(&result));
        } else {
            println!("{}", format_doctor(&result));
        }
    } else if args.first().is_some_and(|arg| arg == "--json") {
        println!("{}", to_json(&result));
    } else if args.first().is_some_and(|arg| arg == "--explain") {
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
  agenthint doctor --json
                        Print detection details and setup advice as JSON
  agenthint --json      Print the structured detection result
  agenthint --explain   Print a short human-readable explanation
  agenthint --help      Show this help"
    );
}

fn print_usage_error(message: &str) -> ! {
    eprintln!("{message}");
    std::process::exit(2);
}
