use agenthint::{
    detect_agent, format_doctor, format_doctor_json, format_explanation, format_help, format_init,
    sanitize_for_display, to_json, trim_whitespace,
};

fn main() {
    let args = std::env::args().skip(1).collect::<Vec<_>>();

    if args.len() == 1 && (args[0] == "-h" || args[0] == "--help") {
        println!("{}", format_help());
        std::process::exit(0);
    }

    if args.len() == 1 && args[0] == "--version" {
        println!("agenthint {}", env!("CARGO_PKG_VERSION"));
        std::process::exit(0);
    }

    if args.first().is_some_and(|arg| arg == "init") {
        if args.len() != 2 || trim_whitespace(&args[1]).is_empty() || args[1].starts_with('-') {
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

fn print_usage_error(message: &str) -> ! {
    eprintln!("{}", sanitize_for_display(message));
    std::process::exit(2);
}
