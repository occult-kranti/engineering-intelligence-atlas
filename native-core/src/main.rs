//! One bounded JSON request on stdin, one JSON response on stdout.
//! No network, model calls, source execution, or shell interpreter.
use std::io::{self, Read, Write};

fn main() {
    let mut input = Vec::new();
    let read = io::stdin()
        .take(atlas_core::MAX_REQUEST_BYTES + 1)
        .read_to_end(&mut input);
    let response = match read {
        Err(_) => atlas_core::error_response("INPUT_ERROR", "Could not read request"),
        Ok(_) if input.len() as u64 > atlas_core::MAX_REQUEST_BYTES => {
            atlas_core::error_response("REQUEST_TOO_LARGE", "Request exceeds 1 MiB")
        }
        Ok(_) => match serde_json::from_slice::<atlas_core::Request>(&input) {
            Err(_) => {
                atlas_core::error_response("INVALID_REQUEST", "Expected one valid JSON command")
            }
            Ok(request) => {
                let office = request.command.starts_with("office_")
                    || request.command.starts_with("control_");
                match atlas_core::execute(request) {
                    Ok(snapshot) => {
                        let mut value = serde_json::to_value(&snapshot).unwrap_or_default();
                        let response = if office {
                            value.get("office").cloned().unwrap_or_default()
                        } else {
                            if let Some(map) = value.as_object_mut() {
                                map.remove("office");
                            }
                            value
                        };
                        serde_json::json!({ "ok": true, "snapshot": response })
                    }
                    Err(error) => atlas_core::error_response(error.code, &error.message),
                }
            }
        },
    };
    // stderr stays empty in ordinary failure cases; protocol errors remain structured.
    let _ = writeln!(io::stdout(), "{}", response);
}
