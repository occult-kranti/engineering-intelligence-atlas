//! Owner command receipts live in the same atomic state transaction as the command.
//! A lost HTTP acknowledgement can therefore be retried without rehiring/requeueing.
use super::*;
use sha2::{Digest, Sha256};

const MAX_RECEIPTS: usize = 10000;
const MAX_COMMAND_BYTES: usize = 262144;
// Up to 60k cloud text units may need six bytes each when JSON-escaped.
// This data-only import envelope remains below the core's 1MiB request cap.
const MAX_CLOUD_MESSAGE_COMMAND_BYTES: usize = 524288;
const LOCAL_ARTIFACT_EVIDENCE: &str = "[local artifact omitted from cloud]";

fn cloud_projection(state: &OfficeSnapshot) -> Result<Value> {
    let mut value = serde_json::to_value(state)
        .map_err(|_| fail("OFFICE_STATE_INVALID", "State cannot be serialized"))?;
    let fields = [
        "schemaVersion",
        "activeCompanyId",
        "companies",
        "offices",
        "departments",
        "employees",
        "jobs",
        "schedules",
        "cache",
        "knowledge",
        "events",
        "lastAction",
        "policy",
        "budget",
        "chatThreads",
        "goals",
        "checkpoints",
        "blueprints",
        "portfolio",
        "decisionPanels",
        "authority",
    ];
    value
        .as_object_mut()
        .unwrap()
        .retain(|key, _| fields.contains(&key.as_str()));
    // Backup can change the root and basename, so neither is a portable identity.
    // Keep this rule identical to cloudEvidence in the TypeScript projection.
    fn redact_evidence(value: &mut Value) {
        match value {
            Value::String(text) => {
                let reference = text.trim_start_matches(|c: char| {
                    matches!(c, '\t' | '\n' | '\r' | '\u{000c}' | '\u{000b}' | ' ')
                });
                let bytes = reference.as_bytes();
                if reference.starts_with('/')
                    || reference.starts_with("\\\\")
                    || reference
                        .get(..5)
                        .is_some_and(|prefix| prefix.eq_ignore_ascii_case("file:"))
                    || (bytes.len() >= 3
                        && bytes[0].is_ascii_alphabetic()
                        && bytes[1] == b':'
                        && matches!(bytes[2], b'/' | b'\\'))
                {
                    *text = LOCAL_ARTIFACT_EVIDENCE.into();
                }
            }
            Value::Array(items) => {
                for item in items {
                    redact_evidence(item);
                }
            }
            _ => {}
        }
    }
    fn redact(value: &mut Value) {
        match value {
            Value::Object(map) => {
                for (key, child) in map.iter_mut() {
                    if [
                        "leaseToken",
                        "workerId",
                        "artifactUri",
                        "pendingReservation",
                        "lastAction",
                    ]
                    .contains(&key.as_str())
                    {
                        *child = Value::Null;
                    } else if key == "remoteReceipts" {
                        *child = json!([]);
                    } else {
                        if key == "evidence" {
                            redact_evidence(child);
                        }
                        redact(child);
                    }
                }
            }
            Value::Array(items) => {
                for child in items {
                    redact(child);
                }
            }
            _ => {}
        }
    }
    redact(&mut value);
    Ok(value)
}

fn canonical_sync_value(value: &Value) -> String {
    match value {
        Value::Null => "n".into(),
        Value::Bool(v) => if *v { "t" } else { "f" }.into(),
        Value::Number(v) => {
            let f = v.as_f64().unwrap_or(0.0);
            format!(
                "d{:016x}",
                if f == 0.0 {
                    0.0_f64.to_bits()
                } else {
                    f.to_bits()
                }
            )
        }
        Value::String(v) => serde_json::to_string(v).unwrap(),
        Value::Array(v) => format!(
            "[{}]",
            v.iter()
                .map(canonical_sync_value)
                .collect::<Vec<_>>()
                .join(",")
        ),
        Value::Object(v) => format!(
            "{{{}}}",
            v.iter()
                .map(|(key, child)| format!(
                    "{}:{}",
                    serde_json::to_string(key).unwrap(),
                    canonical_sync_value(child)
                ))
                .collect::<Vec<_>>()
                .join(",")
        ),
    }
}

impl OfficeSnapshot {
    pub fn sync_state_hash(&self) -> Result<String> {
        Ok(format!(
            "{:x}",
            Sha256::digest(canonical_sync_value(&cloud_projection(self)?).as_bytes())
        ))
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteCommandReceipt {
    pub id: String,
    pub command_sha256: String,
    pub applied_at: String,
}

fn permitted(action: &str) -> bool {
    matches!(
        action,
        "create_company"
            | "rename_company"
            | "set_company_parent"
            | "select_company"
            | "create_office"
            | "create_department"
            | "hire_employee"
            | "pause_employee"
            | "resume_employee"
            | "fire_employee"
            | "pause_company"
            | "resume_company"
            | "pause_office"
            | "resume_office"
            | "pause_department"
            | "resume_department"
            | "enqueue_job"
            | "cancel_job"
            | "pause_job"
            | "resume_job"
            | "create_schedule"
            | "pause_schedule"
            | "resume_schedule"
            | "configure_cache"
            | "clear_cache"
            | "add_knowledge"
            | "configure_policy"
            | "approve_job"
            | "bootstrap_directors"
            | "post_chat"
            | "import_cloud_message"
            | "create_goal"
            | "plan_goal"
            | "set_goal_plan"
            | "execute_goal"
            | "pause_goal"
            | "resume_goal"
            | "checkpoint_goal"
            | "ensure_blueprint"
            | "save_blueprint"
            | "upsert_room"
            | "place_employee"
            | "upsert_whiteboard"
            | "configure_ceo"
            | "upsert_portfolio_group"
            | "ensure_shared_services"
            | "optimize_portfolio"
            | "contract_service"
            | "share_knowledge"
            | "upsert_roadmap_item"
            | "convene_panel"
            | "start_panel_round"
            | "record_panel_decision"
            | "pause_panel"
            | "resume_panel"
            | "grant_authority"
            | "promote_employee"
            | "revoke_authority"
            | "set_authority_enforcement"
            | "rebuild_office_index"
            | "apply_employee_command"
    )
}

impl OfficeSnapshot {
    pub fn validate_remote_receipts(&self) -> Result<()> {
        if self.remote_receipts.len() > MAX_RECEIPTS {
            return Err(fail(
                "OFFICE_STATE_INVALID",
                "Remote command receipt bound exceeded",
            ));
        }
        let mut ids = HashSet::new();
        for receipt in &self.remote_receipts {
            if !safe_id(&receipt.id)
                || !ids.insert(&receipt.id)
                || receipt.command_sha256.len() != 64
                || !receipt
                    .command_sha256
                    .bytes()
                    .all(|c| c.is_ascii_hexdigit())
            {
                return Err(fail(
                    "OFFICE_STATE_INVALID",
                    "Invalid remote command receipt",
                ));
            }
            timestamp(&receipt.applied_at)?;
        }
        Ok(())
    }

    pub fn apply_remote_command(&mut self, action: &str, p: &Value) -> Result<bool> {
        if action != "apply_remote_command" {
            return Ok(false);
        }
        let remote_id = string(p, "id", 100)?;
        if !safe_id(&remote_id) {
            return Err(fail("INVALID_INPUT", "Invalid remote command ID"));
        }
        let command = p
            .get("command")
            .filter(|v| v.is_object())
            .ok_or_else(|| fail("INVALID_INPUT", "Missing remote command"))?;
        let action_name = string(command, "action", 50)?;
        if !permitted(&action_name) {
            return Err(fail(
                "REMOTE_ACTION_DENIED",
                "This action requires the local managed adapter",
            ));
        }
        // serde_json's default map is sorted by key, making reordered JSON equivalent.
        let canonical = serde_json::to_vec(command)
            .map_err(|_| fail("INVALID_INPUT", "Invalid remote command JSON"))?;
        let max_bytes = if action_name == "import_cloud_message" {
            MAX_CLOUD_MESSAGE_COMMAND_BYTES
        } else {
            MAX_COMMAND_BYTES
        };
        if canonical.len() > max_bytes {
            return Err(fail(
                "CAPACITY",
                "Remote command exceeds its bounded envelope",
            ));
        }
        let digest = format!("{:x}", Sha256::digest(&canonical));
        if let Some(receipt) = self.remote_receipts.iter().find(|r| r.id == remote_id) {
            if receipt.command_sha256 != digest {
                return Err(fail(
                    "REMOTE_RECEIPT_MISMATCH",
                    "Remote command ID was already used with a different payload",
                ));
            }
            self.last_action = Some(json!({"remoteCommandId":remote_id,"replayed":true}));
            return Ok(true);
        }
        if let Some(expected) = opt_string(p, "expectedStateHash", 64)? {
            if expected.len() != 64
                || !expected.bytes().all(|c| c.is_ascii_hexdigit())
                || expected != self.sync_state_hash()?
            {
                return Err(fail(
                    "CONFLICT",
                    "Local workspace changed after the cloud command was prepared",
                ));
            }
        }
        if self.remote_receipts.len() >= MAX_RECEIPTS {
            return Err(fail("CAPACITY", "Remote receipt history is full; export/archive through a reviewed migration before admitting more commands"));
        }
        let mut candidate = self.clone();
        candidate.apply(command)?;
        candidate.remote_receipts.push(RemoteCommandReceipt {
            id: remote_id.clone(),
            command_sha256: digest,
            applied_at: now(),
        });
        candidate.validate()?;
        let result = candidate.last_action.take();
        candidate.last_action =
            Some(json!({"remoteCommandId":remote_id,"replayed":false,"result":result}));
        *self = candidate;
        Ok(true)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn fixture() -> OfficeSnapshot {
        let value: Value =
            serde_json::from_str(include_str!("../../company/preview-state.json")).unwrap();
        serde_json::from_value(value["office"].clone()).unwrap()
    }
    #[test]
    fn repeat_after_roundtrip_preserves_single_effect() {
        let mut state = fixture();
        let before = state.companies.len();
        let command = json!({"action":"apply_remote_command","id":"cloud-command-one","command":{"action":"create_company","name":"Remote company","id":"remote-company"}});
        state.apply(&command).unwrap();
        state = serde_json::from_str(&serde_json::to_string(&state).unwrap()).unwrap();
        state.apply(&command).unwrap();
        assert_eq!(state.companies.len(), before + 1);
        assert_eq!(state.remote_receipts.len(), 1);
        assert_eq!(state.last_action.as_ref().unwrap()["replayed"], true);
    }
    #[test]
    fn remote_set_company_parent_attach_detach_replay_and_errors() {
        let mut state = fixture();
        state
            .apply(&json!({"action":"create_company","name":"Remote child","id":"remote-child"}))
            .unwrap();
        let parent = state.active_company_id.clone();
        let wrap = |id: &str, parent_value: Value| {
            json!({"action":"apply_remote_command","id":id,"command":{"action":"set_company_parent","companyId":"remote-child","parentCompanyId":parent_value}})
        };
        let attach = wrap("remote-parent-attach", json!(parent));
        state.apply(&attach).unwrap();
        let receipts = state.remote_receipts.len();
        let events = state.events.len();
        state.apply(&attach).unwrap();
        assert_eq!(state.remote_receipts.len(), receipts);
        assert_eq!(state.events.len(), events);
        assert_eq!(
            state
                .companies
                .iter()
                .find(|c| c.id == "remote-child")
                .unwrap()
                .parent_company_id
                .as_deref(),
            Some(parent.as_str())
        );
        state
            .apply(&wrap("remote-parent-detach", Value::Null))
            .unwrap();
        assert!(state
            .companies
            .iter()
            .find(|c| c.id == "remote-child")
            .unwrap()
            .parent_company_id
            .is_none());
        // Missing field is an error and consumes no receipt.
        let receipts = state.remote_receipts.len();
        let missing = json!({"action":"apply_remote_command","id":"remote-parent-missing","command":{"action":"set_company_parent","companyId":"remote-child"}});
        assert!(state.apply(&missing).is_err());
        // Self-parent (cycle) is an error and creates no receipt.
        let cyc = wrap("remote-parent-cycle", json!("remote-child"));
        assert!(state.apply(&cyc).is_err());
        assert_eq!(state.remote_receipts.len(), receipts);
        // Stale expected hash conflicts before mutation.
        let stale = json!({"action":"apply_remote_command","id":"remote-parent-stale","expectedStateHash":"0".repeat(64),"command":{"action":"set_company_parent","companyId":"remote-child","parentCompanyId":parent}});
        assert_eq!(state.apply(&stale).unwrap_err().code, "CONFLICT");
        assert_eq!(state.remote_receipts.len(), receipts);
    }
    #[test]
    fn reused_id_with_changed_payload_is_rejected() {
        let mut state = fixture();
        state.apply(&json!({"action":"apply_remote_command","id":"cloud-id","command":{"action":"select_company","companyId":state.active_company_id}})).unwrap();
        let before = serde_json::to_value(&state).unwrap();
        let result = state.apply(&json!({"action":"apply_remote_command","id":"cloud-id","command":{"action":"create_company","name":"Tampered"}}));
        assert_eq!(result.unwrap_err().code, "REMOTE_RECEIPT_MISMATCH");
        assert_eq!(state.remote_receipts.len(), 1);
        assert_eq!(
            serde_json::to_value(&state.companies).unwrap(),
            before["companies"]
        );
    }
    #[test]
    fn worker_and_nested_actions_cannot_cross_remote_boundary() {
        for action in [
            "apply_remote_command",
            "claim_job",
            "reserve_job",
            "finish_job",
            "settle_external",
            "github_operation",
            "import_repositories",
            "post_assistant_message",
        ] {
            let mut state = fixture();
            let result = state.apply(&json!({"action":"apply_remote_command","id":"remote-1","command":{"action":action}}));
            assert_eq!(result.unwrap_err().code, "REMOTE_ACTION_DENIED");
            assert!(state.remote_receipts.is_empty());
        }
    }
    #[test]
    fn validation_failure_does_not_consume_receipt_or_partially_change_state() {
        let mut state = fixture();
        let before = state.companies.len();
        let result = state.apply(&json!({"action":"apply_remote_command","id":"remote-invalid","command":{"action":"create_company","name":"Bad","repoUrl":"https://not-github.invalid/x"}}));
        assert!(result.is_err());
        assert_eq!(state.companies.len(), before);
        assert!(state.remote_receipts.is_empty());
    }
    #[test]
    fn receipts_are_never_evicted_to_admit_a_replay() {
        let mut state = fixture();
        for i in 0..MAX_RECEIPTS {
            state.remote_receipts.push(RemoteCommandReceipt {
                id: format!("r-{i}"),
                command_sha256: "0".repeat(64),
                applied_at: now(),
            });
        }
        let result = state.apply(&json!({"action":"apply_remote_command","id":"overflow","command":{"action":"select_company","companyId":state.active_company_id}}));
        assert_eq!(result.unwrap_err().code, "CAPACITY");
        assert_eq!(state.remote_receipts.len(), MAX_RECEIPTS);
    }
    #[test]
    fn stale_snapshot_hash_conflicts_before_mutation() {
        let mut state = fixture();
        let old_hash = state.sync_state_hash().unwrap();
        state.companies[0].name = "Changed locally".into();
        let before = state.companies.len();
        let result=state.apply(&json!({"action":"apply_remote_command","id":"stale-command","expectedStateHash":old_hash,"command":{"action":"create_company","name":"Should not exist"}}));
        assert_eq!(result.unwrap_err().code, "CONFLICT");
        assert_eq!(state.companies.len(), before);
        assert!(state.remote_receipts.is_empty());
    }
    #[test]
    fn relocated_evidence_has_a_stable_projection_without_rewriting_chat_or_sources() {
        let company: Company = serde_json::from_value(json!({"id":"portable","name":"Portable fixture","repoUrl":"https://github.com/example/portable","owner":"example","repo":"portable","githubStatus":"unchecked"})).unwrap();
        let mut state = OfficeSnapshot::seeded(&company, &[]).unwrap();
        state.apply(&json!({"action":"convene_panel","companyId":"portable","title":"Portable evidence","task":"Test synthetic references","focus":"software","roleKeys":["qa"],"maxRounds":1})).unwrap();
        let panel_id = state.decision_panels[0].id.clone();
        state
            .apply(&json!({"action":"start_panel_round","panelId":panel_id}))
            .unwrap();
        for _ in 0..3 {
            state
                .apply(&json!({"action":"claim_job","workerId":"synthetic-worker"}))
                .unwrap();
            let Some(job_id) = state
                .last_action
                .as_ref()
                .and_then(|a| a["jobId"].as_str())
                .map(str::to_owned)
            else {
                break;
            };
            let lease = state.last_action.as_ref().unwrap()["leaseToken"]
                .as_str()
                .unwrap()
                .to_owned();
            state.apply(&json!({"action":"finish_job","jobId":job_id,"leaseToken":lease,"status":"completed","inputTokens":0,"outputTokens":0,"costUsd":0,"artifactUri":"/old/office-artifacts/job-hash.md"})).unwrap();
        }
        let evidence = json!([
            "/old/office-artifacts/job-hash.md",
            "file:///old/file.md",
            "C:\\Private\\file.md",
            "\\\\server\\private\\file.md",
            " \tFILE:///old/file.md",
            "https://example.org/report?file=/tmp/reference.md",
            "project/reference.md"
        ]);
        state.apply(&json!({"action":"record_panel_decision","panelId":panel_id,"verdict":"accepted","summary":"/old/private/summary.md","evidence":evidence})).unwrap();
        state.apply(&json!({"action":"post_chat","scope":{"kind":"company","id":"portable"},"content":"/old/office-artifacts/job-hash.md"})).unwrap();
        state.validate().unwrap();
        let before = serde_json::to_value(&state).unwrap();
        let projected = cloud_projection(&state).unwrap();
        let actual = projected["decisionPanels"][0]["decisions"][0]["evidence"]
            .as_array()
            .unwrap();
        assert!(actual[..5]
            .iter()
            .all(|value| value == LOCAL_ARTIFACT_EVIDENCE));
        assert_eq!(&actual[5..], &evidence.as_array().unwrap()[5..]);
        assert_eq!(
            projected["decisionPanels"][0]["decisions"][0]["summary"],
            "/old/private/summary.md"
        );
        assert_eq!(projected["chatThreads"], before["chatThreads"]);
        assert!(state
            .chat_threads
            .iter()
            .flat_map(|thread| &thread.messages)
            .any(|message| message.content == "/old/office-artifacts/job-hash.md"));
        assert_eq!(serde_json::to_value(&state).unwrap(), before);
        let original_hash = state.sync_state_hash().unwrap();
        for (index, item) in state.decision_panels[0].decisions[0].evidence[..5]
            .iter_mut()
            .enumerate()
        {
            *item = format!("/restored/office-artifacts/content-hash-{index}.md");
        }
        assert_eq!(state.sync_state_hash().unwrap(), original_hash);
        state.decision_panels[0].decisions[0].evidence[5] =
            "https://example.org/different-source".into();
        assert_ne!(state.sync_state_hash().unwrap(), original_hash);
    }
    #[test]
    fn cloud_messages_are_durable_data_only_and_cannot_change_identity() {
        let mut state = fixture();
        let before_jobs = serde_json::to_value(&state.jobs).unwrap();
        let before_goals = serde_json::to_value(&state.goals).unwrap();
        let before_budget = serde_json::to_value(&state.budget).unwrap();
        let scope = json!({"kind":"company","id":state.active_company_id});
        let command = json!({"action":"import_cloud_message","id":"cloud-00000000-0000-4000-8000-000000000001","scope":scope,"role":"assistant","content":"Saved website result; no local provider dispatch.","createdAt":"2026-11-21T00:00:00.000Z"});
        let request = json!({"action":"apply_remote_command","id":"cloud-chat-00000000-0000-4000-8000-000000000001","expectedStateHash":state.sync_state_hash().unwrap(),"command":command});
        state.apply(&request).unwrap();
        state = serde_json::from_str(&serde_json::to_string(&state).unwrap()).unwrap();
        state.apply(&request).unwrap();
        assert_eq!(state.chat_threads.len(), 1);
        assert_eq!(state.chat_threads[0].messages.len(), 1);
        let message = &state.chat_threads[0].messages[0];
        assert_eq!(message.id, command["id"].as_str().unwrap());
        assert_eq!(message.created_at, "2026-11-21T00:00:00.000Z");
        assert_eq!(message.source, "cloud");
        assert_eq!(message.role, "assistant");
        assert_eq!(serde_json::to_value(&state.jobs).unwrap(), before_jobs);
        assert_eq!(serde_json::to_value(&state.goals).unwrap(), before_goals);
        assert_eq!(serde_json::to_value(&state.budget).unwrap(), before_budget);
        let mut tampered = command.clone();
        tampered["content"] = json!("Changed website result");
        let error = state.apply(&json!({"action":"apply_remote_command","id":"new-envelope-same-message","command":tampered})).unwrap_err();
        assert_eq!(error.code, "REMOTE_RECEIPT_MISMATCH");
        assert_eq!(state.remote_receipts.len(), 1);
        assert_eq!(
            state.chat_threads[0].messages[0].content,
            command["content"].as_str().unwrap()
        );
        state.validate().unwrap();
    }
    #[test]
    fn malformed_cloud_messages_do_not_consume_receipts_or_change_conversations() {
        let mut state = fixture();
        let command = json!({"action":"import_cloud_message","id":"cloud-00000000-0000-4000-8000-000000000001","scope":{"kind":"company","id":state.active_company_id},"role":"user","content":"A brief","createdAt":"2026-11-21T00:00:00.000Z"});
        for (key, invalid) in [
            ("id", json!("message-untrusted")),
            ("role", json!("system")),
            ("createdAt", json!("tomorrow")),
            ("content", json!("🎼".repeat(30001))),
            ("scope", json!({"kind":"company","id":"missing-company"})),
        ] {
            let mut bad = command.clone();
            bad[key] = invalid;
            assert!(state.apply(&json!({"action":"apply_remote_command","id":"invalid-cloud-message","command":bad})).is_err());
            assert!(state.chat_threads.is_empty());
            assert!(state.remote_receipts.is_empty());
        }
    }
    #[test]
    fn full_cloud_text_survives_utf8_and_json_escape_expansion() {
        let mut state = fixture();
        let scope = json!({"kind":"company","id":state.active_company_id});
        let full_unicode = format!("{}{}\r\n", "漢".repeat(45_000), "🎼".repeat(5_000));
        let full_escaped = format!("{}\r\n", "\0".repeat(59_998));
        for (index, content) in [full_unicode, full_escaped].into_iter().enumerate() {
            let command = json!({"action":"import_cloud_message","id":format!("cloud-00000000-0000-4000-8000-00000000000{}", index+5),"scope":scope,"role":"assistant","content":content,"createdAt":"2026-11-21T00:00:00.000Z"});
            if index == 1 {
                assert!(serde_json::to_vec(&command).unwrap().len() > MAX_COMMAND_BYTES);
            }
            state.apply(&json!({"action":"apply_remote_command","id":format!("full-cloud-message-{index}"),"command":command})).unwrap();
            state = serde_json::from_str(&serde_json::to_string(&state).unwrap()).unwrap();
            assert_eq!(state.chat_threads[0].messages[index].content, content);
            state.validate().unwrap();
        }
        // The larger cloud records do not relax local authored message limits.
        assert!(state
            .apply(&json!({"action":"post_chat","scope":scope,"content":"漢".repeat(5000)}))
            .is_err());
        assert_eq!(state.chat_threads[0].messages.len(), 2);
    }
}
