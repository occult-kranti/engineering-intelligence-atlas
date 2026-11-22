//! Scoped annotations and budget-held paired improvement work. No provider I/O.
use super::*;

const MAX_NOTES: usize = 2000;
const MAX_SESSIONS: usize = 256;
const MAX_RECEIPTS: usize = 4096;
const FOCUS: [&str; 5] = ["research", "company", "UX", "graphics", "setup"];

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StickyNote {
    pub id: String, pub revision: u64, pub company_id: String, pub office_id: String,
    pub department_id: Option<String>, pub kind: String, pub color: String, pub text: String,
    pub status: String, pub owner_employee_id: Option<String>, pub goal_ids: Vec<String>,
    pub x: f64, pub y: f64, pub created_at: String, pub updated_at: String,
}

#[cfg(test)]
mod tests {
    use super::*;
    fn state() -> OfficeSnapshot {
        let company: Company = serde_json::from_value(json!({"id":"atlas","name":"Atlas","repoUrl":"https://github.com/example/atlas","owner":"example","repo":"atlas","githubStatus":"unchecked"})).unwrap();
        OfficeSnapshot::seeded(&company, &[]).unwrap()
    }
    fn allowance(s: &mut OfficeSnapshot, cap: f64, observed: f64, estimated: f64) {
        s.apply(&json!({"action":"register_improvement_allowance","requestId":"allowance-create","id":"shared-20","capUsd":cap,"carriedObservedUsd":observed,"carriedEstimatedUsd":estimated,"sourceReference":"Owner reviewed test checkpoint; no real spending"})).unwrap();
    }
    fn session_payload(s: &OfficeSnapshot, name: &str) -> Value {
        json!({"action":"create_improvement_session","requestId":format!("create-{name}"),"id":name,"expectedRevision":0,"companyId":s.active_company_id,"officeId":s.offices[0].id,"departmentId":null,
            "allowanceId":"shared-20","title":"Scoped improvement","objective":"Improve the existing evidence and identify one concrete next step.","primaryEmployeeId":"donna","reviewerEmployeeId":s.offices[0].assistant_id,
            "serviceContractId":null,"reviewerServiceContractId":null,"runSettings":{"mode":"provider","provider":"anthropic","model":"fixture","authorized":true,"maxTokens":4000,"maxUsd":1,"maxMinutes":2,
                "priceRates":{"inputUsdPerMillion":null,"outputUsdPerMillion":null},"allowedTools":[]},"allowedRoutes":[{"provider":"anthropic","model":"fixture"}],"continuation":"until-budget","maxCycles":null,"taskNoteIds":[]})
    }
    fn create(s: &mut OfficeSnapshot, name: &str) {
        s.apply(&session_payload(s, name)).unwrap();
        control(s, name, "start", &format!("start-{name}"));
    }
    fn control(s: &mut OfficeSnapshot, name: &str, operation: &str, request: &str) {
        let revision = s.improvement_sessions.iter().find(|x| x.id == name).unwrap().revision;
        s.apply(&json!({"action":"control_improvement_session","sessionId":name,"expectedRevision":revision,"operation":operation,"requestId":request})).unwrap();
    }
    fn route(provider: &str) -> Value {
        json!({"provider":provider,"model":"fixture","priceRates":{"inputUsdPerMillion":if provider=="ollama" {0.0}else{100.0},"outputUsdPerMillion":if provider=="ollama" {0.0}else{100.0}},
            "source":"https://example.test/reviewed-prices","observedAt":now(),"expiresAt":at(OffsetDateTime::now_utc()+Duration::hours(1)),"maxInputTokens":100000,"catalogSha256":"a".repeat(64),"costBasis":"standard-token-rates"})
    }
    fn tick(s: &mut OfficeSnapshot, name: &str) { s.apply(&json!({"action":"tick_improvements","sessionId":name,"selectedRoute":route("anthropic")})).unwrap(); }
    fn claim(s: &mut OfficeSnapshot, name: &str) -> (String, String) {
        s.apply(&json!({"action":"claim_job","workerId":format!("improvement:{name}"),"mode":"provider","improvementSessionId":name})).unwrap();
        let result = s.last_action.as_ref().unwrap();
        (result["jobId"].as_str().unwrap().into(), result["leaseToken"].as_str().unwrap().into())
    }
    fn settle_pair(s: &mut OfficeSnapshot, name: &str, digest: &str, verdict: &str) {
        settle_pair_with_cost(s, name, digest, verdict, 0.0);
    }
    fn settle_pair_with_cost(s: &mut OfficeSnapshot, name: &str, digest: &str, verdict: &str, phase_cost: f64) {
        settle_pair_with_body(s, name, digest, Some(digest), verdict, phase_cost);
    }
    fn settle_pair_with_body(s: &mut OfficeSnapshot, name: &str, digest: &str, body_digest: Option<&str>, verdict: &str, phase_cost: f64) {
        let (primary, lease) = claim(s, name);
        s.apply(&json!({"action":"reserve_job","jobId":primary,"leaseToken":lease,"inputTokens":10,"maxOutputTokens":20,"costUsd":phase_cost})).unwrap();
        s.apply(&json!({"action":"check_worker_authority","jobId":primary,"leaseToken":lease,"capability":"provider.run"})).unwrap();
        s.apply(&json!({"action":"finish_job","jobId":primary,"leaseToken":lease,"status":"completed","inputTokens":10,"outputTokens":20,"costUsd":phase_cost,"artifactUri":"/managed/primary.md","artifactSha256":digest,"deliverableSha256":body_digest})).unwrap();
        let (review, lease) = claim(s, name);
        s.apply(&json!({"action":"reserve_job","jobId":review,"leaseToken":lease,"inputTokens":10,"maxOutputTokens":20,"costUsd":phase_cost})).unwrap();
        s.apply(&json!({"action":"check_worker_authority","jobId":review,"leaseToken":lease,"capability":"provider.run"})).unwrap();
        s.apply(&json!({"action":"finish_job","jobId":review,"leaseToken":lease,"status":"completed","inputTokens":10,"outputTokens":20,"costUsd":phase_cost,"artifactUri":"/managed/review.md","artifactSha256":"b".repeat(64)})).unwrap();
        s.apply(&json!({"action":"record_step_review","jobId":review,"leaseToken":lease,"primaryJobId":primary,"primaryArtifactSha256":digest,"reviewArtifactSha256":"b".repeat(64),"primaryArtifactComplete":true,"verdict":verdict,"summary":"Compared supplied evidence with the full scoped task.","evidenceRefs":["primary-artifact"]})).unwrap();
    }
    fn note(s: &OfficeSnapshot, id: &str) -> Value {
        json!({"action":"upsert_sticky_note","requestId":format!("note-{id}"),"id":id,"expectedRevision":0,"companyId":s.active_company_id,"officeId":s.offices[0].id,"departmentId":null,"kind":"todo","color":"yellow","text":"Preserve the inspected evidence and improve the explicit scope.","status":"open","ownerEmployeeId":"donna","goalIds":[],"x":0.3,"y":0.4})
    }
    #[test]
    fn notes_are_revisioned_scoped_annotations_with_durable_exact_receipts() {
        let mut s = state(); let input = note(&s, "sticky"); s.apply(&input).unwrap();
        assert!(s.jobs.is_empty()); assert_eq!(s.sticky_notes[0].revision, 0);
        s = serde_json::from_value(serde_json::to_value(&s).unwrap()).unwrap(); s.validate().unwrap();
        s.apply(&input).unwrap(); assert_eq!(s.last_action.as_ref().unwrap()["replayed"], true);
        let mut changed = input.clone(); changed["text"] = json!("Changed body");
        assert_eq!(s.apply(&changed).unwrap_err().code, "IMPROVEMENT_IDEMPOTENCY_CONFLICT");
        changed["requestId"] = json!("edit-sticky"); s.apply(&changed).unwrap(); assert_eq!(s.sticky_notes[0].revision, 1);
        changed["requestId"] = json!("stale-sticky"); assert_eq!(s.apply(&changed).unwrap_err().code, "STALE_REVISION");
        let before = serde_json::to_value(&s.sticky_notes).unwrap();
        changed["expectedRevision"] = json!(1); changed["x"] = json!(1.1);
        assert!(s.apply(&changed).is_err()); assert_eq!(serde_json::to_value(&s.sticky_notes).unwrap(), before);
        s.apply(&json!({"action":"archive_sticky_note","requestId":"archive","noteId":"sticky","expectedRevision":1})).unwrap();
        assert_eq!(s.sticky_notes[0].status,"archived"); assert_eq!(s.sticky_notes[0].revision,2);
    }
    #[test]
    fn immutable_allowance_preserves_global_policy_and_counts_reviewed_carry() {
        let mut s = state(); let policy = serde_json::to_value(&s.policy).unwrap(); allowance(&mut s, 20.0, 0.234182, 0.0);
        assert_eq!(serde_json::to_value(&s.policy).unwrap(), policy); assert!(s.external_attempts.is_empty());
        assert!((s.improvement_budget.as_ref().unwrap().remaining_usd - 19.765818).abs() < 1e-9);
        assert_eq!(s.improvement_budget.as_ref().unwrap().effective_remaining_usd,10.0);
        let before = serde_json::to_value(&s.improvement_allowance).unwrap();
        assert_eq!(s.apply(&json!({"action":"register_improvement_allowance","requestId":"new-allowance","id":"reset","capUsd":20,"carriedObservedUsd":0,"carriedEstimatedUsd":0,"sourceReference":"reset"})).unwrap_err().code,"IMPROVEMENT_ALLOWANCE_IMMUTABLE");
        assert_eq!(serde_json::to_value(&s.improvement_allowance).unwrap(), before);
    }
    #[test]
    fn session_creation_is_paused_and_claims_require_the_exact_scoped_worker() {
        let mut s = state(); allowance(&mut s,20.0,0.0,0.0); s.apply(&session_payload(&s,"one")).unwrap();
        tick(&mut s,"one"); assert!(s.jobs.is_empty()); control(&mut s,"one","start","start"); tick(&mut s,"one");
        assert_eq!(s.jobs.len(),2); assert_eq!(s.goals.len(),1); assert!(s.jobs.iter().all(|j| j.improvement_session_id.as_deref()==Some("one")));
        let ids = s.jobs.iter().map(|j| j.id.clone()).collect::<Vec<_>>();
        s = serde_json::from_value(serde_json::to_value(&s).unwrap()).unwrap(); tick(&mut s,"one");
        assert_eq!(s.jobs.iter().map(|j| j.id.clone()).collect::<Vec<_>>(),ids);
        s.apply(&json!({"action":"claim_job","workerId":"ordinary","mode":"provider"})).unwrap();assert!(s.last_action.as_ref().unwrap()["jobId"].is_null());
        assert_eq!(s.apply(&json!({"action":"claim_job","workerId":"other","improvementSessionId":"one"})).unwrap_err().code,"IMPROVEMENT_WORKER_REQUIRED");
        let (job,_) = claim(&mut s,"one"); assert_eq!(job,ids[0]);
        let goal_id=s.goals[0].id.clone();assert_eq!(s.apply(&json!({"action":"advance_goal","goalId":goal_id,"reason":"bypass"})).unwrap_err().code,"IMPROVEMENT_SESSION_OWNS_GOAL");
        s.validate().unwrap();
    }
    #[test]
    fn competing_sessions_hold_both_phases_and_reservation_replaces_only_its_hold() {
        let mut s=state(); allowance(&mut s,0.7,0.0,0.0); create(&mut s,"one");create(&mut s,"two");tick(&mut s,"one");tick(&mut s,"two");
        assert_eq!(s.jobs.len(),2);assert_eq!(s.improvement_sessions[1].status,"waiting-budget");assert!((s.budget.held_usd-0.4).abs()<1e-9);
        let (job,lease)=claim(&mut s,"one");s.apply(&json!({"action":"reserve_job","jobId":job,"leaseToken":lease,"inputTokens":100,"maxOutputTokens":100,"costUsd":0.1})).unwrap();
        assert!((s.budget.held_usd-0.16).abs()<1e-9);assert!((s.budget.reserved_usd-0.1).abs()<1e-9);
        tick(&mut s,"two");assert_eq!(s.jobs.len(),4);assert!((s.improvement_budget.as_ref().unwrap().committed_usd-0.66).abs()<1e-9);
        s.validate().unwrap();
    }
    #[test]
    fn global_limit_and_uncertain_carry_stop_new_cycles_without_claiming_completion() {
        let mut s=state();allowance(&mut s,20.0,0.0,0.0);s.policy.budget.hard_cap_usd=0.3;create(&mut s,"one");tick(&mut s,"one");
        assert!(s.jobs.is_empty());assert_eq!(s.improvement_sessions[0].stop_reason.as_deref(),Some("global-budget"));assert_eq!(s.policy.budget.hard_cap_usd,0.3);
        let mut s=state();allowance(&mut s,20.0,0.0,0.2);create(&mut s,"one");tick(&mut s,"one");
        assert!(s.jobs.is_empty());assert_eq!(s.improvement_sessions[0].status,"needs-review");assert_eq!(s.improvement_sessions[0].stop_reason.as_deref(),Some("uncertain-carried-cost"));
    }
    #[test]
    fn pause_cancel_and_restart_preserve_held_or_dispatched_accounting() {
        let mut s=state();allowance(&mut s,20.0,0.0,0.0);create(&mut s,"one");tick(&mut s,"one");control(&mut s,"one","pause","pause");
        assert!(s.jobs.iter().all(|j|j.status=="paused"));assert!((s.budget.held_usd-0.4).abs()<1e-9);
        s=serde_json::from_value(serde_json::to_value(&s).unwrap()).unwrap();control(&mut s,"one","resume","resume");
        let(job,lease)=claim(&mut s,"one");s.apply(&json!({"action":"reserve_job","jobId":job,"leaseToken":lease,"inputTokens":10,"maxOutputTokens":20,"costUsd":0.1})).unwrap();
        control(&mut s,"one","cancel","cancel");assert_eq!(s.budget.held_usd,0.0);assert!((s.budget.reserved_usd-0.1).abs()<1e-9);
        s.apply(&json!({"action":"finish_job","jobId":job,"leaseToken":lease,"status":"failed","inputTokens":10,"outputTokens":0,"costUsd":0.1,"costStatus":"estimated"})).unwrap();
        assert_eq!(s.jobs[0].status,"cancelled");assert!((s.improvement_budget.as_ref().unwrap().estimated_usd-0.1).abs()<1e-9);
        let rev=s.improvement_sessions[0].revision;assert_eq!(s.apply(&json!({"action":"control_improvement_session","requestId":"restart-cancelled","sessionId":"one","expectedRevision":rev,"operation":"resume"})).unwrap_err().code,"TERMINAL_STATE");
    }
    #[test]
    fn quote_expiry_and_scope_revocation_are_checked_again_before_dispatch() {
        let mut s=state();allowance(&mut s,20.0,0.0,0.0);create(&mut s,"one");tick(&mut s,"one");let(job,lease)=claim(&mut s,"one");
        for job in &mut s.jobs {let q=job.improvement_route.as_mut().unwrap();q.observed_at=at(OffsetDateTime::now_utc()-Duration::hours(2));q.expires_at=at(OffsetDateTime::now_utc()-Duration::hours(1));}
        assert_eq!(s.apply(&json!({"action":"reserve_job","jobId":job,"leaseToken":lease,"inputTokens":10,"maxOutputTokens":20,"costUsd":0.1})).unwrap_err().code,"IMPROVEMENT_DISPATCH_DENIED");
        assert_eq!(s.apply(&json!({"action":"check_worker_authority","jobId":job,"leaseToken":lease,"capability":"provider.run"})).unwrap_err().code,"AUTHORITY_DENIED");assert!(s.jobs[0].reservation.is_none());
        tick(&mut s,"one");assert_eq!(s.improvement_sessions[0].stop_reason.as_deref(),Some("quote-expired"));
        let mut s=state();allowance(&mut s,20.0,0.0,0.0);create(&mut s,"one");tick(&mut s,"one");let reviewer=s.improvement_sessions[0].reviewer_employee_id.clone();
        s.apply(&json!({"action":"pause_employee","employeeId":reviewer})).unwrap();tick(&mut s,"one");assert_eq!(s.improvement_sessions[0].status,"needs-review");assert!(s.jobs.iter().all(|j|j.started_at.is_none()));
    }
    #[test]
    fn accepted_review_advances_with_real_handoff_and_repeated_artifact_stops() {
        let mut s=state();allowance(&mut s,20.0,0.0,0.0);create(&mut s,"one");tick(&mut s,"one");settle_pair(&mut s,"one",&"a".repeat(64),"accepted");
        let first_review=s.jobs[1].id.clone();tick(&mut s,"one");assert_eq!(s.jobs.len(),4);assert_eq!(s.jobs[2].dependencies,vec![first_review]);assert!(s.jobs[2].goal.contains("focus: company"));
        settle_pair(&mut s,"one",&"a".repeat(64),"accepted");tick(&mut s,"one");assert_eq!(s.jobs.len(),4);assert_eq!(s.improvement_sessions[0].stop_reason.as_deref(),Some("repeated-artifact"));
    }
    #[test]
    fn rejected_reviews_and_capacity_are_visible_stops_without_retries_or_partial_pairs() {
        let mut s=state();allowance(&mut s,20.0,0.0,0.0);create(&mut s,"one");tick(&mut s,"one");settle_pair(&mut s,"one",&"a".repeat(64),"revise");tick(&mut s,"one");tick(&mut s,"one");
        assert_eq!(s.jobs.len(),2);assert_eq!(s.improvement_sessions[0].stop_reason.as_deref(),Some("review-required"));
        let mut s=state();allowance(&mut s,20.0,0.0,0.0);create(&mut s,"one");
        for index in 0..2000 {let mut goal=s.improvement_goal(&s.improvement_sessions[0]);goal.id=format!("history-{index}");goal.improvement_session_id=None;s.goals.push(goal);}
        tick(&mut s,"one");assert!(s.jobs.is_empty());assert_eq!(s.budget.held_usd,0.0);assert_eq!(s.improvement_sessions[0].status,"waiting-work");assert_eq!(s.improvement_sessions[0].stop_reason.as_deref(),Some("capacity"));
    }
    #[test]
    fn todo_changes_during_work_are_not_overwritten_by_accepted_old_revision() {
        let mut s=state();allowance(&mut s,20.0,0.0,0.0);s.apply(&note(&s,"todo")).unwrap();let mut config=session_payload(&s,"one");config["taskNoteIds"]=json!(["todo"]);config["continuation"]=json!("backlog");s.apply(&config).unwrap();control(&mut s,"one","start","start");tick(&mut s,"one");
        let mut edit=note(&s,"todo");edit["expectedRevision"]=json!(1);edit["requestId"]=json!("edited-during-work");edit["text"]=json!("A new additional requirement.");edit["goalIds"]=json!(s.sticky_notes[0].goal_ids);s.apply(&edit).unwrap();
        settle_pair(&mut s,"one",&"a".repeat(64),"accepted");tick(&mut s,"one");assert_eq!(s.sticky_notes[0].status,"open");assert_eq!(s.jobs.len(),4);assert!(s.jobs[2].goal.contains("A new additional requirement"));
        settle_pair(&mut s,"one",&"c".repeat(64),"accepted");tick(&mut s,"one");assert_eq!(s.sticky_notes[0].status,"done");assert_eq!(s.improvement_sessions[0].status,"completed");
    }
    #[test]
    fn until_budget_has_no_hidden_hundred_cycle_completion_limit() {
        let mut s=state();allowance(&mut s,20.0,0.0,0.0);let mut input=session_payload(&s,"one");input["runSettings"]["provider"]=json!("ollama");input["allowedRoutes"][0]["provider"]=json!("ollama");s.apply(&input).unwrap();control(&mut s,"one","start","start");
        for index in 0..101 {s.apply(&json!({"action":"tick_improvements","sessionId":"one","selectedRoute":route("ollama")})).unwrap();settle_pair(&mut s,"one",&format!("{index:064x}"),"accepted");}
        assert_eq!(s.improvement_sessions[0].cycle,101);assert_eq!(s.improvement_sessions[0].status,"active");assert_eq!(s.improvement_budget.as_ref().unwrap().committed_usd,0.0);
        let mut s=state();allowance(&mut s,20.0,0.0,0.0);let mut input=session_payload(&s,"one");input["maxCycles"]=json!(1);s.apply(&input).unwrap();control(&mut s,"one","start","start");tick(&mut s,"one");settle_pair(&mut s,"one",&"a".repeat(64),"accepted");tick(&mut s,"one");
        assert_eq!(s.improvement_sessions[0].status,"paused");assert_eq!(s.improvement_sessions[0].stop_reason.as_deref(),Some("cycle-limit"));
    }
    #[test]
    fn unsupported_model_foreign_scope_and_worker_self_grants_fail_closed() {
        let mut s=state();allowance(&mut s,20.0,0.0,0.0);let mut invalid=session_payload(&s,"bad");invalid["reviewerEmployeeId"]=json!("donna");assert!(s.apply(&invalid).is_err());assert!(s.improvement_sessions.is_empty());
        s.apply(&json!({"action":"create_company","id":"foreign","name":"Foreign"})).unwrap();let foreign=s.offices.iter().find(|o|o.company_id=="foreign").unwrap().assistant_id.clone();
        invalid=session_payload(&s,"bad");invalid["companyId"]=json!("atlas");invalid["reviewerEmployeeId"]=json!(foreign);assert!(s.apply(&invalid).is_err());
        s.apply(&json!({"action":"select_company","companyId":"atlas"})).unwrap();
        create(&mut s,"one");let mut quote=route("anthropic");quote["model"]=json!("unapproved");assert_eq!(s.apply(&json!({"action":"tick_improvements","sessionId":"one","selectedRoute":quote})).unwrap_err().code,"IMPROVEMENT_ROUTE_DENIED");assert!(s.jobs.is_empty());
        assert_eq!(s.apply(&json!({"action":"apply_remote_command","id":"owner-tick","command":{"action":"tick_improvements","sessionId":"one","selectedRoute":route("anthropic")}})).unwrap_err().code,"REMOTE_ACTION_DENIED");
        assert_eq!(s.apply(&json!({"action":"apply_employee_command","employeeId":"donna","command":session_payload(&s,"employee-self-start")})).unwrap_err().code,"AUTHORITY_DENIED");
    }
    #[test]
    fn schema_three_survives_restart_and_legacy_fields_default_without_budget_invention() {
        let s=state();assert_eq!(s.schema_version,3);
        for version in [1,2] {let mut value=serde_json::to_value(&s).unwrap();value["schemaVersion"]=json!(version);
            for key in ["stickyNotes","improvementAllowance","improvementBudget","improvementSessions","improvementReceipts"] {value.as_object_mut().unwrap().remove(key);}
            let mut old:OfficeSnapshot=serde_json::from_value(value).unwrap();old.validate().unwrap();old.apply(&json!({"action":"configure_policy","dispatchPaused":true})).unwrap();
            assert_eq!(old.schema_version,3);assert!(old.improvement_allowance.is_none());assert!(old.improvement_sessions.is_empty());assert_eq!(old.policy.budget.hard_cap_usd,10.0);
        }
    }
    #[test]
    fn exact_global_cap_allows_its_reserved_pair_but_not_another_admission() {
        let mut s=state(); allowance(&mut s,20.0,0.0,0.0);s.policy.budget.hard_cap_usd=0.4;s.policy.budget.hard_cap_tokens=Some(4000);
        create(&mut s,"one");tick(&mut s,"one");assert!((s.budget.committed_usd-0.4).abs()<1e-9);assert_eq!(s.budget.remaining_tokens,Some(0));
        let (job,lease)=claim(&mut s,"one");
        s.apply(&json!({"action":"reserve_job","jobId":job,"leaseToken":lease,"inputTokens":1200,"maxOutputTokens":1200,"costUsd":0.24})).unwrap();
        s.apply(&json!({"action":"check_worker_authority","jobId":job,"leaseToken":lease,"capability":"provider.run"})).unwrap();
        assert!((s.budget.committed_usd-0.4).abs()<1e-9);assert_eq!(s.budget.committed_tokens,4000);
        create(&mut s,"two");tick(&mut s,"two");assert_eq!(s.jobs.len(),2);assert_eq!(s.improvement_sessions[1].stop_reason.as_deref(),Some("global-budget"));
    }
    #[test]
    fn competing_sessions_control_restart_and_observed_settlement_keep_one_parent_ceiling() {
        let mut s=state();allowance(&mut s,2.0,0.0,0.0);
        fn check(s:&OfficeSnapshot) {
            let total=s.improvement_budget.as_ref().unwrap();assert!(total.committed_usd<=2.0+1e-9);
            assert!((total.committed_usd-total.observed_usd-total.estimated_usd-total.reserved_usd-total.held_usd).abs()<1e-9);
            assert!((s.budget.committed_usd-total.committed_usd).abs()<1e-9);s.validate().unwrap();
        }
        for index in 0..20 {
            let name=format!("contender-{index}");let mut input=session_payload(&s,&name);input["maxCycles"]=json!(1);
            s.apply(&input).unwrap();control(&mut s,&name,"start",&format!("start-{index}"));tick(&mut s,&name);check(&s);
        }
        assert_eq!(s.jobs.len(),10);assert!((s.budget.held_usd-2.0).abs()<1e-9);
        s.apply(&json!({"action":"claim_job","workerId":"ordinary","mode":"provider"})).unwrap();assert!(s.last_action.as_ref().unwrap()["jobId"].is_null());
        assert_eq!(s.apply(&json!({"action":"claim_job","workerId":"improvement:contender-1","improvementSessionId":"contender-0","mode":"provider"})).unwrap_err().code,"IMPROVEMENT_WORKER_REQUIRED");
        for index in 0..20 {
            let name=format!("contender-{index}");tick(&mut s,&name);check(&s);
            if index%4==0 {control(&mut s,&name,"cancel",&format!("cancel-{index}"));}
            else {
                if index%4==1 {
                    let held=s.budget.held_usd;control(&mut s,&name,"pause",&format!("pause-{index}"));
                    s=serde_json::from_value(serde_json::to_value(&s).unwrap()).unwrap();assert_eq!(s.budget.held_usd,held);
                    control(&mut s,&name,"resume",&format!("resume-{index}"));
                }
                settle_pair_with_cost(&mut s,&name,&format!("{index:064x}"),"accepted",0.02);tick(&mut s,&name);
                assert_eq!(s.improvement_sessions[index].stop_reason.as_deref(),Some("cycle-limit"));
            }
            check(&s);
        }
        assert!((s.improvement_budget.as_ref().unwrap().observed_usd-0.6).abs()<1e-9);assert_eq!(s.budget.held_usd,0.0);assert_eq!(s.budget.reserved_usd,0.0);
    }
    #[test]
    fn sticky_unicode_capacity_and_frozen_kind_have_explicit_non_destructive_failures() {
        let mut s=state();let mut input=note(&s,"unicode");input["text"]=json!("🧭".repeat(1000));s.apply(&input).unwrap();
        let mut too_long=input.clone();too_long["id"]=json!("too-long");too_long["requestId"]=json!("too-long");too_long["text"]=json!("🧭".repeat(1001));assert!(s.apply(&too_long).is_err());
        let original=s.sticky_notes[0].clone();for index in 1..2000 {let mut n=original.clone();n.id=format!("saved-{index}");s.sticky_notes.push(n);}
        let mut overflow=note(&s,"over-capacity");assert_eq!(s.apply(&overflow).unwrap_err().code,"CAPACITY");assert_eq!(s.sticky_notes.len(),2000);
        input["requestId"]=json!("edit-at-capacity");input["text"]=json!("Existing notes remain editable at capacity.");s.apply(&input).unwrap();assert_eq!(s.sticky_notes[0].revision,1);
        input["requestId"]=json!("stale-at-capacity");assert_eq!(s.apply(&input).unwrap_err().code,"STALE_REVISION");
        allowance(&mut s,20.0,0.0,0.0);let mut session=session_payload(&s,"one");session["taskNoteIds"]=json!(["unicode"]);s.apply(&session).unwrap();
        input["requestId"]=json!("convert-kind");input["expectedRevision"]=json!(1);input["kind"]=json!("comment");assert_eq!(s.apply(&input).unwrap_err().code,"NOTE_KIND_IMMUTABLE");
        overflow["requestId"]=json!("still-full");assert_eq!(s.apply(&overflow).unwrap_err().code,"CAPACITY");s.validate().unwrap();
    }
    #[test]
    fn notes_cannot_link_another_office_goal_and_unknown_cost_blocks_other_sessions() {
        let mut s=state();s.apply(&json!({"action":"create_office","companyId":"atlas","name":"Other office"})).unwrap();let other=s.offices.last().unwrap().id.clone();
        s.apply(&json!({"action":"create_goal","scope":{"kind":"office","id":other},"title":"Other office task","description":"Scoped separately","mode":"plan","maxIterations":1})).unwrap();
        let foreign=s.last_action.as_ref().unwrap()["goalId"].clone();let mut input=note(&s,"cross-office");input["goalIds"]=json!([foreign]);assert_eq!(s.apply(&input).unwrap_err().code,"SCOPE_MISMATCH");assert!(s.sticky_notes.is_empty());
        allowance(&mut s,20.0,0.0,0.0);create(&mut s,"uncertain");tick(&mut s,"uncertain");let(job,lease)=claim(&mut s,"uncertain");
        s.apply(&json!({"action":"reserve_job","jobId":job,"leaseToken":lease,"inputTokens":10,"maxOutputTokens":20,"costUsd":0.1})).unwrap();
        s.apply(&json!({"action":"finish_job","jobId":job,"leaseToken":lease,"status":"failed","inputTokens":10,"outputTokens":0,"costUsd":0.1,"costStatus":"estimated"})).unwrap();
        create(&mut s,"other");tick(&mut s,"other");assert_eq!(s.jobs.len(),2);assert_eq!(s.improvement_sessions[1].stop_reason.as_deref(),Some("uncertain-parent-cost"));
    }
    #[test]
    fn unreserved_or_over_reserved_settlement_retains_charges_and_stops_new_dispatch() {
        for cancel in [true,false] {
            let mut s=state();allowance(&mut s,20.0,0.0,0.0);create(&mut s,"one");tick(&mut s,"one");let(job,lease)=claim(&mut s,"one");
            if cancel {control(&mut s,"one","cancel","cancel");}
            else {s.apply(&json!({"action":"reserve_job","jobId":job,"leaseToken":lease,"inputTokens":10,"maxOutputTokens":20,"costUsd":0.05})).unwrap();}
            let finish=json!({"action":"finish_job","jobId":job,"leaseToken":lease,"status":"completed","inputTokens":10,"outputTokens":20,"costUsd":0.1,"artifactUri":"/managed/charged.md","artifactSha256":"a".repeat(64)});
            s.apply(&finish).unwrap();let reason=if cancel {"unreserved-cost"}else{"reservation-exceeded-cost"};
            assert_eq!(s.last_action.as_ref().unwrap()["budgetInvariant"],reason);assert!(s.policy.dispatch_paused);
            assert_eq!(s.jobs[0].usage.cost_usd,0.1);assert!(s.jobs[0].usage_recorded);assert_eq!(s.jobs[0].cost_status,"observed");
            assert_eq!(s.improvement_budget.as_ref().unwrap().observed_usd,0.1);
            assert_eq!(s.improvement_sessions[0].status,if cancel {"cancelled"}else{"needs-review"});
            assert_eq!(s.goals[0].status,"needs-review");assert_eq!(s.goals[0].stop_reason.as_deref(),Some(if cancel {"owner-cancelled"}else{reason}));
            s.sync_goal_checkpoints().unwrap();s=serde_json::from_value(serde_json::to_value(&s).unwrap()).unwrap();s.validate().unwrap();
            assert_eq!(s.goals[0].stop_reason.as_deref(),Some(if cancel {"owner-cancelled"}else{reason}));
            assert_eq!(s.apply(&finish).unwrap_err().code,"STALE_LEASE");assert_eq!(s.jobs[0].usage.cost_usd,0.1);
            create(&mut s,"two");tick(&mut s,"two");assert_eq!(s.jobs.len(),2);assert_eq!(s.improvement_sessions[1].stop_reason.as_deref(),Some("global-dispatch-paused"));
        }
    }
    #[test]
    fn identical_delivered_body_stops_despite_changed_cycle_artifact_headers() {
        let mut s=state();allowance(&mut s,20.0,0.0,0.0);create(&mut s,"one");tick(&mut s,"one");
        let body="d".repeat(64);
        settle_pair_with_body(&mut s,"one",&"a".repeat(64),Some(&body),"accepted",0.01);tick(&mut s,"one");
        assert_eq!(s.jobs.len(),4);assert_eq!(s.improvement_sessions[0].recent_artifact_sha256s,vec![body.clone()]);
        settle_pair_with_body(&mut s,"one",&"c".repeat(64),Some(&body),"accepted",0.01);
        assert_ne!(s.jobs[0].artifact_sha256,s.jobs[2].artifact_sha256);
        assert_eq!(s.jobs[0].deliverable_sha256,s.jobs[2].deliverable_sha256);
        assert_eq!(s.jobs[3].review.as_ref().unwrap().primary_artifact_sha256,"c".repeat(64));
        s=serde_json::from_value(serde_json::to_value(&s).unwrap()).unwrap();tick(&mut s,"one");
        assert_eq!(s.jobs.len(),4);assert_eq!(s.improvement_sessions[0].status,"needs-review");
        assert_eq!(s.improvement_sessions[0].stop_reason.as_deref(),Some("repeated-artifact"));
        assert!((s.improvement_budget.as_ref().unwrap().observed_usd-0.04).abs()<1e-9);s.validate().unwrap();
    }
    #[test]
    fn missing_deliverable_digest_preserves_completed_review_but_cannot_advance() {
        let mut s=state();allowance(&mut s,20.0,0.0,0.0);create(&mut s,"one");tick(&mut s,"one");
        settle_pair_with_body(&mut s,"one",&"a".repeat(64),None,"accepted",0.01);tick(&mut s,"one");
        assert_eq!(s.jobs.len(),2);assert!(s.jobs.iter().all(|j|j.usage_recorded&&j.status=="completed"));
        assert_eq!(s.jobs[1].review.as_ref().unwrap().verdict,"accepted");
        assert_eq!(s.improvement_sessions[0].stop_reason.as_deref(),Some("missing-deliverable-digest"));
        assert!(s.improvement_sessions[0].recent_artifact_sha256s.is_empty());
        assert!((s.improvement_budget.as_ref().unwrap().observed_usd-0.02).abs()<1e-9);
        s=serde_json::from_value(serde_json::to_value(&s).unwrap()).unwrap();tick(&mut s,"one");assert_eq!(s.jobs.len(),2);s.validate().unwrap();
    }
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImprovementAllowance {
    pub id: String, pub cap_usd: f64, pub carried_observed_usd: f64,
    pub carried_estimated_usd: f64, pub source_reference: String, pub created_at: String,
}
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImprovementBudget {
    pub cap_usd: f64, pub carried_observed_usd: f64, pub carried_estimated_usd: f64,
    pub observed_usd: f64, pub estimated_usd: f64, pub reserved_usd: f64, pub held_usd: f64,
    pub committed_usd: f64, pub remaining_usd: f64, pub effective_remaining_usd: f64,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ImprovementAllowedRoute { pub provider: String, pub model: String }
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ImprovementRoute {
    pub provider: String, pub model: String, pub price_rates: Rates,
    pub source: String, pub observed_at: String, pub expires_at: String,
    pub max_input_tokens: u64, pub catalog_sha256: String, pub cost_basis: String,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImprovementSession {
    pub id: String, pub revision: u64, pub company_id: String, pub office_id: String,
    pub department_id: Option<String>, pub allowance_id: String, pub title: String,
    pub objective: String, pub primary_employee_id: String, pub reviewer_employee_id: String,
    pub service_contract_id: Option<String>, pub reviewer_service_contract_id: Option<String>,
    pub run_settings: GoalRunSettings, pub allowed_routes: Vec<ImprovementAllowedRoute>,
    pub continuation: String, pub max_cycles: Option<u64>, pub task_note_ids: Vec<String>,
    pub cycle: u64, pub active_goal_id: Option<String>, pub goal_ids: Vec<String>,
    pub active_note_id: Option<String>, pub active_note_revision: Option<u64>,
    pub status: String, pub stop_reason: Option<String>, pub recent_artifact_sha256s: Vec<String>,
    pub created_at: String, pub updated_at: String,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImprovementReceipt {
    pub id: String, pub request_sha256: String, pub action: String, pub result: Value, pub at: String,
}
fn canonical_id(p: &Value, key: &str) -> Result<String> {
    let value = string(p, key, 100)?;
    if !safe_id(&value) { return Err(fail("INVALID_INPUT", format!("Invalid {key}"))); }
    Ok(value)
}
fn revision(p: &Value, actual: u64) -> Result<()> {
    let expected = p.get("expectedRevision").and_then(Value::as_u64)
        .ok_or_else(|| fail("REVISION_REQUIRED", "Read and supply the entity revision"))?;
    if expected != actual { return Err(fail("STALE_REVISION", "The record changed; retain your draft and reload the current revision")); }
    Ok(())
}
fn sha(value: &str) -> bool { value.len() == 64 && value.bytes().all(|c| c.is_ascii_hexdigit()) }
fn task_scope(company: &str, office: &str, department: Option<&str>) -> Scope {
    let _ = company;
    Scope { kind: if department.is_some() { "department" } else { "office" }.into(), id: department.unwrap_or(office).into() }
}
fn note_matches_session(note: &StickyNote, session: &ImprovementSession) -> bool {
    note.company_id == session.company_id && note.office_id == session.office_id && note.department_id == session.department_id && note.kind == "todo"
}
impl ImprovementRoute {
    fn validate(&self, tokens: u64, current: Option<OffsetDateTime>) -> Result<()> {
        if !["anthropic", "openai", "ollama"].contains(&self.provider.as_str()) || self.model.trim().is_empty()
            || self.model.len() > 200 || self.cost_basis != "standard-token-rates" || !sha(&self.catalog_sha256)
            || self.max_input_tokens == 0 || self.max_input_tokens > 1_000_000_000 || tokens > self.max_input_tokens {
            return Err(fail("IMPROVEMENT_QUOTE_INVALID", "The explicit model quote does not cover the complete pair allocation"));
        }
        bounded_text(&self.source, 1000, "quote source")?;
        let observed = timestamp(&self.observed_at)?; let expires = timestamp(&self.expires_at)?;
        if expires <= observed || expires - observed > Duration::days(7)
            || current.is_some_and(|clock| expires <= clock || observed > clock + Duration::minutes(5)) {
            return Err(fail("IMPROVEMENT_QUOTE_EXPIRED", "A current bounded pricing quote is required before dispatch"));
        }
        for rate in [self.price_rates.input_usd_per_million, self.price_rates.output_usd_per_million] {
            if rate.is_none_or(|r| !r.is_finite() || r < 0.0 || r > 100000.0 || (self.provider != "ollama" && r == 0.0) || (self.provider == "ollama" && r != 0.0)) {
                return Err(fail("IMPROVEMENT_QUOTE_INVALID", "Hosted quotes need positive rates; local Ollama has zero provider-token cost"));
            }
        }
        Ok(())
    }
}
impl OfficeSnapshot {
    pub(super) fn apply_improvements(&mut self, action: &str, p: &Value) -> Result<bool> {
        if !["upsert_sticky_note", "archive_sticky_note", "register_improvement_allowance", "create_improvement_session", "control_improvement_session", "tick_improvements"].contains(&action) { return Ok(false); }
        let tick = action == "tick_improvements";
        let request = if tick { None } else { Some(canonical_id(p, "requestId")?) };
        let digest = format!("{:x}", Sha256::digest(serde_json::to_vec(p).map_err(|_| fail("INVALID_INPUT", "Invalid mutation"))?));
        if let Some(id) = &request {
            if let Some(receipt) = self.improvement_receipts.iter().find(|r| &r.id == id) {
                if receipt.request_sha256 != digest { return Err(fail("IMPROVEMENT_IDEMPOTENCY_CONFLICT", "Request identity already belongs to different work")); }
                let mut result = receipt.result.clone(); result["replayed"] = json!(true); self.last_action = Some(result); return Ok(true);
            }
            if self.improvement_receipts.len() >= MAX_RECEIPTS { return Err(fail("CAPACITY", "Improvement receipt capacity reached; no history was evicted")); }
        }
        let mut candidate = self.clone(); candidate.schema_version = 3;
        candidate.improvement_mutation(action, p)?;
        candidate.refresh_budget(); candidate.validate_improvements()?;
        if let Some(id) = request {
            let mut result = candidate.last_action.clone().unwrap_or_else(|| json!({}));
            result["requestId"] = json!(id); result["replayed"] = json!(false);
            candidate.improvement_receipts.push(ImprovementReceipt { id, request_sha256: digest, action: action.into(), result: result.clone(), at: now() });
            candidate.last_action = Some(result);
        }
        *self = candidate; Ok(true)
    }
    fn improvement_mutation(&mut self, action: &str, p: &Value) -> Result<()> {
        match action {
            "register_improvement_allowance" => {
                if self.improvement_allowance.is_some() { return Err(fail("IMPROVEMENT_ALLOWANCE_IMMUTABLE", "The parent allowance cannot be replaced, increased or reset")); }
                let allowance = ImprovementAllowance { id: canonical_id(p, "id")?, cap_usd: number(p, "capUsd", f64::MIN_POSITIVE, 20.0)?,
                    carried_observed_usd: number(p, "carriedObservedUsd", 0.0, 20.0)?, carried_estimated_usd: number(p, "carriedEstimatedUsd", 0.0, 20.0)?,
                    source_reference: string(p, "sourceReference", 1000)?, created_at: now() };
                if allowance.carried_observed_usd + allowance.carried_estimated_usd > allowance.cap_usd + 1e-9 { return Err(fail("IMPROVEMENT_BUDGET", "Carried commitments exceed the immutable parent allowance")); }
                self.last_action = Some(json!({"allowanceId":allowance.id})); self.improvement_allowance = Some(allowance);
            }
            "upsert_sticky_note" => {
                let id = canonical_id(p, "id")?; let previous = self.sticky_notes.iter().find(|n| n.id == id).cloned();
                revision(p, previous.as_ref().map_or(0, |n| n.revision))?;
                if previous.is_none() && self.sticky_notes.len() >= MAX_NOTES { return Err(fail("CAPACITY", "Sticky note capacity reached")); }
                let stamp = now();
                let note = StickyNote { id, revision: previous.as_ref().map_or(0, |n| n.revision + 1), company_id: canonical_id(p, "companyId")?, office_id: canonical_id(p, "officeId")?,
                    department_id: opt_string(p, "departmentId", 100)?, kind: string(p, "kind", 20)?, color: string(p, "color", 20)?, text: string(p, "text", 4000)?, status: string(p, "status", 20)?,
                    owner_employee_id: opt_string(p, "ownerEmployeeId", 100)?, goal_ids: serde_json::from_value(p.get("goalIds").cloned().unwrap_or_else(|| json!([]))).map_err(|_| fail("INVALID_INPUT", "Invalid note links"))?,
                    x: number(p, "x", 0.0, 1.0)?, y: number(p, "y", 0.0, 1.0)?, created_at: previous.as_ref().map_or_else(|| stamp.clone(), |n| n.created_at.clone()), updated_at: stamp };
                self.improvement_location(&note.company_id, &note.office_id, note.department_id.as_deref(), true)?;
                if previous.as_ref().is_some_and(|n| n.company_id != note.company_id || n.office_id != note.office_id || n.department_id != note.department_id) { return Err(fail("SCOPE_MISMATCH", "A note's canonical scope is immutable")); }
                if previous.as_ref().is_some_and(|n| n.kind != note.kind) && self.improvement_sessions.iter().any(|s| s.task_note_ids.contains(&note.id)) {
                    return Err(fail("NOTE_KIND_IMMUTABLE", "This todo belongs to a frozen session backlog; create a separate comment instead of changing its kind"));
                }
                if let Some(owner) = &note.owner_employee_id { self.validate_worker_assignment(&note.company_id, &note.office_id, note.department_id.as_deref(), owner, None, &[])?; }
                self.note_links(&note)?;
                self.last_action = Some(json!({"noteId":note.id,"revision":note.revision}));
                if let Some(index) = self.sticky_notes.iter().position(|n| n.id == note.id) { self.sticky_notes[index] = note; } else { self.sticky_notes.push(note); }
            }
            "archive_sticky_note" => {
                let id = canonical_id(p, "noteId")?; let note = self.sticky_notes.iter_mut().find(|n| n.id == id).ok_or_else(|| fail("NOT_FOUND", "Sticky note not found"))?;
                revision(p, note.revision)?; note.status = "archived".into(); note.revision += 1; note.updated_at = now();
                self.last_action = Some(json!({"noteId":note.id,"revision":note.revision,"archived":true}));
            }
            "create_improvement_session" => {
                revision(p, 0)?; let id = canonical_id(p, "id")?;
                if self.improvement_sessions.iter().any(|s| s.id == id) { return Err(fail("ALREADY_EXISTS", "Session identity is already bound; retain its receipt")); }
                if self.improvement_sessions.len() >= MAX_SESSIONS { return Err(fail("CAPACITY", "Improvement session capacity reached")); }
                let stamp = now();
                let session = ImprovementSession { id, revision: 0, company_id: canonical_id(p, "companyId")?, office_id: canonical_id(p, "officeId")?, department_id: opt_string(p, "departmentId", 100)?,
                    allowance_id: canonical_id(p, "allowanceId")?, title: string(p, "title", 200)?, objective: match p.get("objective") { None | Some(Value::Null) => String::new(), Some(Value::String(text)) => text.clone(), _ => return Err(fail("INVALID_INPUT", "Objective must be text")) },
                    primary_employee_id: canonical_id(p, "primaryEmployeeId")?, reviewer_employee_id: canonical_id(p, "reviewerEmployeeId")?,
                    service_contract_id: opt_string(p, "serviceContractId", 100)?, reviewer_service_contract_id: opt_string(p, "reviewerServiceContractId", 100)?,
                    run_settings: serde_json::from_value(p.get("runSettings").cloned().unwrap_or(Value::Null)).map_err(|_| fail("INVALID_INPUT", "Explicit session run settings are required"))?,
                    allowed_routes: serde_json::from_value(p.get("allowedRoutes").cloned().unwrap_or(Value::Null)).map_err(|_| fail("INVALID_INPUT", "Explicit candidate routes are required"))?,
                    continuation: opt_string(p, "continuation", 30)?.unwrap_or_else(|| "until-budget".into()),
                    max_cycles: match p.get("maxCycles") { None | Some(Value::Null) => None, _ => Some(integer(p, "maxCycles", 1, 1000)?) },
                    task_note_ids: serde_json::from_value(p.get("taskNoteIds").cloned().unwrap_or_else(|| json!([]))).map_err(|_| fail("INVALID_INPUT", "Invalid scoped backlog"))?,
                    cycle: 0, active_goal_id: None, goal_ids: vec![], active_note_id: None, active_note_revision: None, status: "paused".into(), stop_reason: Some("owner-start-required".into()),
                    recent_artifact_sha256s: vec![], created_at: stamp.clone(), updated_at: stamp };
                if self.improvement_allowance.as_ref().is_none_or(|a| a.id != session.allowance_id) { return Err(fail("IMPROVEMENT_ALLOWANCE_REQUIRED", "Register and select the existing immutable parent allowance")); }
                if session.allowed_routes.first().is_none_or(|r| r.provider != session.run_settings.provider || r.model != session.run_settings.model) {
                    return Err(fail("IMPROVEMENT_ROUTE_DENIED", "Initial run settings must name the first explicit candidate; this is not a pricing quote"));
                }
                self.improvement_scope_authorized(&session)?;
                self.last_action = Some(json!({"sessionId":session.id,"revision":0,"status":"paused"})); self.improvement_sessions.push(session);
            }
            "control_improvement_session" => {
                let id = canonical_id(p, "sessionId")?; let index = self.improvement_sessions.iter().position(|s| s.id == id).ok_or_else(|| fail("NOT_FOUND", "Improvement session not found"))?;
                let session = self.improvement_sessions[index].clone(); revision(p, session.revision)?;
                let operation = string(p, "operation", 20)?;
                if session.status == "cancelled" { return Err(fail("TERMINAL_STATE", "Cancelled sessions cannot restart or reset their parent budget")); }
                if let Some(reason) = p.get("reason") { if !reason.is_null() { string(p, "reason", 1000)?; } }
                match operation.as_str() {
                    "start" | "resume" => {
                        if session.status != "paused" { return Err(fail("INVALID_TRANSITION", "Only a paused session can start or resume")); }
                        self.improvement_scope_authorized(&session)?;
                        if self.jobs.iter().any(|j| j.improvement_session_id.as_deref() == Some(&id) && j.started_at.is_some() && !j.usage_recorded) {
                            return Err(fail("UNSETTLED_ATTEMPT", "Wait for the existing attempt to settle; it is never restarted as a fresh call"));
                        }
                        self.set_improvement_status(index, "active", None);
                        for job in self.jobs.iter_mut().filter(|j| j.improvement_session_id.as_deref() == Some(&id) && j.status == "paused" && j.started_at.is_none()) { job.status = "queued".into(); job.updated_at = now(); }
                    }
                    "pause" | "cancel" => {
                        self.set_improvement_status(index, if operation == "pause" { "paused" } else { "cancelled" }, Some(if operation == "pause" { "owner-paused" } else { "owner-cancelled" }));
                        if operation == "cancel" {
                            if let Some(goal) = self.goals.iter_mut().find(|g| session.active_goal_id.as_deref() == Some(&g.id)) {
                                goal.status = "needs-review".into(); goal.stop_reason = Some("owner-cancelled".into()); goal.updated_at = now();
                            }
                        }
                        for job in self.jobs.iter_mut().filter(|j| j.improvement_session_id.as_deref() == Some(&id) && !governance::terminal(&j.status)) {
                            if operation == "cancel" { job.status = "cancelled".into(); job.finished_at = Some(now()); if job.reservation.is_none() { job.budget_hold_usd = 0.0; } }
                            else if job.started_at.is_none() { job.status = "paused".into(); }
                            job.updated_at = now();
                        }
                    }
                    _ => return Err(fail("INVALID_INPUT", "Unknown improvement control operation")),
                }
                let s = &self.improvement_sessions[index]; self.last_action = Some(json!({"sessionId":s.id,"revision":s.revision,"status":s.status}));
            }
            "tick_improvements" => {
                let id = canonical_id(p, "sessionId")?;
                let index = self.improvement_sessions.iter().position(|s| s.id == id).ok_or_else(|| fail("NOT_FOUND", "Improvement session not found"))?;
                let route: ImprovementRoute = serde_json::from_value(p.get("selectedRoute").cloned().unwrap_or(Value::Null)).map_err(|_| fail("IMPROVEMENT_QUOTE_INVALID", "The worker must supply its current discovered route quote"))?;
                self.tick_improvement(index, &route)?;
                let s = &self.improvement_sessions[index]; self.last_action = Some(json!({"sessionId":s.id,"revision":s.revision,"status":s.status,"stopReason":s.stop_reason,"cycle":s.cycle,"goalId":s.active_goal_id}));
            }
            _ => unreachable!(),
        }
        Ok(())
    }
    fn tick_improvement(&mut self, index: usize, route: &ImprovementRoute) -> Result<()> {
        if !["active", "waiting-work", "waiting-budget"].contains(&self.improvement_sessions[index].status.as_str()) { return Ok(()); }
        self.sync_goal_checkpoints()?; self.refresh_budget();
        let session = self.improvement_sessions[index].clone();
        if let Err(error) = self.improvement_scope_authorized(&session) { self.set_improvement_status(index, "needs-review", Some(&error.code)); return Ok(()); }
        if self.policy.dispatch_paused { self.set_improvement_status(index, "waiting-budget", Some("global-dispatch-paused")); return Ok(()); }
        if let Some(goal_id) = &session.active_goal_id {
            let jobs: Vec<_> = self.jobs.iter().filter(|j| j.goal_id.as_ref() == Some(goal_id)).cloned().collect();
            if jobs.len() != 2 { self.set_improvement_status(index, "needs-review", Some("pair-missing")); return Ok(()); }
            if jobs.iter().any(|j| j.cost_status == "estimated" || (j.started_at.is_some() && !j.usage_recorded && governance::terminal(&j.status))) {
                self.set_improvement_status(index, "needs-review", Some("uncertain-cost")); return Ok(());
            }
            if jobs.iter().any(|j| j.review_failure.is_some() || j.review.as_ref().is_some_and(|r| r.verdict != "accepted") || ["failed", "cancelled", "budget-exhausted", "needs-review"].contains(&j.status.as_str())) {
                self.set_improvement_status(index, "needs-review", Some("review-required")); return Ok(());
            }
            if !jobs.iter().all(|j| j.status == "completed" && self.job_accepted(j)) {
                if jobs.iter().any(|j| j.improvement_route.as_ref().is_none_or(|q| q.validate(session.run_settings.max_tokens, Some(OffsetDateTime::now_utc())).is_err())) {
                    self.set_improvement_status(index, "needs-review", Some("quote-expired"));
                } else { self.set_improvement_status(index, "active", None); }
                return Ok(());
            }
            let primary = jobs.iter().find(|j| j.pair.as_ref().is_some_and(|p| p.phase == "primary")).unwrap();
            let Some(digest) = primary.deliverable_sha256.clone() else { self.set_improvement_status(index, "needs-review", Some("missing-deliverable-digest")); return Ok(()); };
            if session.recent_artifact_sha256s.contains(&digest) { self.set_improvement_status(index, "needs-review", Some("repeated-artifact")); return Ok(()); }
            if let Some(note_id) = &session.active_note_id {
                if let Some(note) = self.sticky_notes.iter_mut().find(|n| &n.id == note_id && Some(n.revision) == session.active_note_revision && n.status == "open") {
                    note.status = "done".into(); note.revision += 1; note.updated_at = now();
                }
            }
            let s = &mut self.improvement_sessions[index]; s.recent_artifact_sha256s.push(digest);
            if s.recent_artifact_sha256s.len() > 32 { s.recent_artifact_sha256s.remove(0); }
            s.active_goal_id = None; s.active_note_id = None; s.active_note_revision = None; s.revision += 1; s.updated_at = now();
        }
        let session = self.improvement_sessions[index].clone();
        if session.max_cycles.is_some_and(|limit| session.cycle >= limit) { self.set_improvement_status(index, "paused", Some("cycle-limit")); return Ok(()); }
        if self.jobs.len() + 2 > 5000 || self.goals.len() >= 2000 || self.checkpoints.len() + 2 > 20000 {
            self.set_improvement_status(index, "waiting-work", Some("capacity")); return Ok(());
        }
        let pending: Vec<_> = session.task_note_ids.iter().filter_map(|id| self.sticky_notes.iter().find(|n| &n.id == id && n.status == "open")).cloned().collect();
        let note = pending.iter().find(|n| !n.goal_ids.iter().any(|id| self.goals.iter().find(|g| &g.id == id).is_some_and(|g| g.job_ids.iter().any(|j| self.jobs.iter().find(|x| &x.id == j).is_some_and(|x| !governance::terminal(&x.status)))))).cloned();
        if note.is_none() && !pending.is_empty() { self.set_improvement_status(index, "waiting-work", Some("backlog-already-assigned")); return Ok(()); }
        if note.is_none() && session.continuation == "backlog" { self.set_improvement_status(index, "completed", Some("backlog-complete")); return Ok(()); }
        if note.is_none() && session.objective.trim().is_empty() { self.set_improvement_status(index, "waiting-work", Some("no-scoped-work")); return Ok(()); }
        if let Err(error) = route.validate(session.run_settings.max_tokens, Some(OffsetDateTime::now_utc())) { self.set_improvement_status(index, "needs-review", Some(&error.code)); return Ok(()); }
        if !session.allowed_routes.iter().any(|r| r.provider == route.provider && r.model == route.model) { return Err(fail("IMPROVEMENT_ROUTE_DENIED", "The selected model was not in the owner's frozen candidate set")); }
        let quoted = session.run_settings.max_tokens as f64 * route.price_rates.input_usd_per_million.unwrap().max(route.price_rates.output_usd_per_million.unwrap()) / 1_000_000.0;
        let max_usd = quoted.min(session.run_settings.max_usd);
        let budget = self.summarize_improvement_budget().unwrap();
        if budget.carried_estimated_usd > 0.0 { self.set_improvement_status(index, "needs-review", Some("uncertain-carried-cost")); return Ok(()); }
        if self.jobs.iter().any(|j| j.improvement_session_id.is_some() && (j.cost_status == "estimated" || (j.started_at.is_some() && !j.usage_recorded && governance::terminal(&j.status)))) {
            self.set_improvement_status(index, "needs-review", Some("uncertain-parent-cost")); return Ok(());
        }
        if budget.committed_usd + max_usd > budget.cap_usd + 1e-9 || (route.provider != "ollama" && max_usd <= 0.0) {
            self.set_improvement_status(index, "waiting-budget", Some("parent-allowance")); return Ok(());
        }
        if !self.can_reserve(max_usd, session.run_settings.max_tokens) { self.set_improvement_status(index, "waiting-budget", Some("global-budget")); return Ok(()); }
        let mut next = self.clone();
        match next.materialize_improvement(index, route, note.as_ref(), max_usd) {
            Ok(()) => { *self = next; },
            Err(error) => { self.set_improvement_status(index, if error.code == "CAPACITY" { "waiting-work" } else { "needs-review" }, Some(&error.code)); }
        }
        Ok(())
    }
    fn materialize_improvement(&mut self, index: usize, route: &ImprovementRoute, note: Option<&StickyNote>, max_usd: f64) -> Result<()> {
        let session = self.improvement_sessions[index].clone(); let cycle = session.cycle + 1;
        let focus = FOCUS[((cycle - 1) % FOCUS.len() as u64) as usize];
        let task = format!("Owner objective:\n{}\n\nScoped task:\n{}\n\nImprovement cycle {cycle}; focus: {focus}. Use the previous accepted evidence to identify a concrete useful improvement or unresolved gap within this scope. Do not repeat an unchanged deliverable. Report what was actually applied separately from proposals; never claim code, tests, deployment or GPU work ran without evidence. Stay within the existing tools, scope and budget; if no useful work remains, return a blocked handoff.",
            session.objective, note.map_or("Continue the stated objective using the accepted prior evidence.", |n| n.text.as_str()));
        bounded_text(&task, 16000, "complete improvement task")?;
        let dependencies = session.goal_ids.last().and_then(|id| self.goals.iter().find(|g| &g.id == id))
            .and_then(|g| g.job_ids.iter().filter_map(|id| self.jobs.iter().find(|j| &j.id == id)).find(|j| j.pair.as_ref().is_some_and(|p| p.phase == "review") && self.job_accepted(j)))
            .map(|j| vec![j.id.clone()]).unwrap_or_default();
        let mut settings = session.run_settings.clone(); settings.provider = route.provider.clone(); settings.model = route.model.clone(); settings.price_rates = route.price_rates.clone(); settings.max_usd = max_usd;
        self.apply_governance("create_goal", &json!({"scope":task_scope(&session.company_id, &session.office_id, session.department_id.as_deref()),"title":session.title,"description":task,"mode":"execute","maxIterations":1,"runSettings":settings}))?;
        let goal_id = self.last_action.as_ref().unwrap()["goalId"].as_str().unwrap().to_owned();
        let mut step = self.improvement_goal(&session).steps.remove(0); step.goal = task.clone();
        self.apply_governance("set_goal_plan", &json!({"goalId":goal_id,"steps":[step]}))?;
        let primary_id = self.enqueue_pair(&json!({"companyId":session.company_id,"officeId":session.office_id,"departmentId":session.department_id,"employeeId":session.primary_employee_id,
            "reviewerEmployeeId":session.reviewer_employee_id,"serviceContractId":session.service_contract_id,"reviewerServiceContractId":session.reviewer_service_contract_id,
            "goal":task,"mode":"provider","provider":route.provider,"model":route.model,"authorized":settings.authorized,"allowedTools":settings.allowed_tools,"dependencies":dependencies,
            "maxTokens":settings.max_tokens,"maxUsd":max_usd,"maxMinutes":(settings.max_minutes / 2.0).max(0.01).min(5.0),"priceRates":route.price_rates,
            "idempotencyKey":format!("improvement:{}:{cycle}",session.id)}), Some((&goal_id, 1, "improvement")))?;
        let review_id = self.jobs.iter().find(|j| j.id == primary_id).unwrap().pair.as_ref().unwrap().review_job_id.clone();
        for job in self.jobs.iter_mut().filter(|j| j.id == primary_id || j.id == review_id) {
            job.improvement_session_id = Some(session.id.clone()); job.improvement_route = Some(route.clone()); job.budget_hold_usd = job.limits.max_usd;
        }
        let goal = self.goals.iter_mut().find(|g| g.id == goal_id).unwrap(); goal.improvement_session_id = Some(session.id.clone());
        goal.iteration = 1; goal.status = "running".into(); goal.job_ids = vec![primary_id, review_id];
        let mut note_revision = None;
        if let Some(note) = note {
            let target = self.sticky_notes.iter_mut().find(|n| n.id == note.id).unwrap();
            if target.goal_ids.len() >= 100 { return Err(fail("CAPACITY", "Sticky note goal-link history is full")); }
            target.goal_ids.push(goal_id.clone()); target.revision += 1; target.updated_at = now(); note_revision = Some(target.revision);
        }
        let s = &mut self.improvement_sessions[index]; s.cycle = cycle; s.active_goal_id = Some(goal_id.clone()); s.goal_ids.push(goal_id);
        s.active_note_id = note.map(|n| n.id.clone()); s.active_note_revision = note_revision; s.revision += 1;
        s.status = "active".into(); s.stop_reason = None; s.updated_at = now();
        self.refresh_budget(); self.validate_improvements()?; Ok(())
    }
    fn improvement_location(&self, company: &str, office: &str, department: Option<&str>, active: bool) -> Result<()> {
        let c = self.company(company)?; let o = self.office(office)?;
        if o.company_id != company || (active && (c.status != "active" || o.status != "active")) {
            return Err(fail("SCOPE_MISMATCH", "Improvement work requires its canonical active company and office"));
        }
        if let Some(id) = department {
            let d = self.departments.iter().find(|d| d.id == id).ok_or_else(|| fail("NOT_FOUND", "Department not found"))?;
            if d.company_id != company || d.office_id != office || (active && d.status != "active") {
                return Err(fail("SCOPE_MISMATCH", "Department must stay in this company and office"));
            }
        }
        Ok(())
    }
    fn improvement_goal(&self, session: &ImprovementSession) -> Goal {
        Goal { id: "session-validation".into(), company_id: session.company_id.clone(),
            scope: task_scope(&session.company_id, &session.office_id, session.department_id.as_deref()),
            title: session.title.clone(), description: session.objective.clone(), mode: "execute".into(), status: "planned".into(),
            max_iterations: 1, iteration: 0, job_ids: vec![], steps: vec![GoalStep { id: "improvement".into(), title: session.title.clone(),
                employee_id: session.primary_employee_id.clone(), goal: "Improve within the explicit owner objective and report evidence.".into(), depends_on: vec![],
                service_contract_id: session.service_contract_id.clone(), knowledge_transfer_ids: vec![],
                reviewer_employee_id: Some(session.reviewer_employee_id.clone()), reviewer_service_contract_id: session.reviewer_service_contract_id.clone(),
                estimate: None, review_estimate: None }], run_settings: session.run_settings.clone(), created_at: now(), updated_at: now(), stop_reason: None,
            source_request_id: None, request_sha256: None, source_message_id: None, improvement_session_id: Some(session.id.clone()) }
    }
    fn improvement_scope_authorized(&self, session: &ImprovementSession) -> Result<()> {
        self.improvement_location(&session.company_id, &session.office_id, session.department_id.as_deref(), true)?;
        if session.primary_employee_id == session.reviewer_employee_id { return Err(fail("PAIR_REQUIRED", "A distinct existing reviewer is required")); }
        let goal = self.improvement_goal(session);
        self.validate_run_settings(&goal)?;
        if goal.run_settings.mode != "provider" || (!goal.run_settings.authorized && self.policy.approval_mode != "autonomous") {
            return Err(fail("REVIEW_REQUIRED", "Session provider execution must have explicit owner authorization"));
        }
        if session.run_settings.max_minutes < 0.02 { return Err(fail("PAIR_BUDGET", "Both phases need at least0.01 minutes within the original pair limit")); }
        self.require_paired_steps(&goal)?;
        for (employee, contract, tools) in [(&session.primary_employee_id, session.service_contract_id.as_deref(), session.run_settings.allowed_tools.as_slice()),
            (&session.reviewer_employee_id, session.reviewer_service_contract_id.as_deref(), &[][..])] {
            self.validate_worker_assignment(&session.company_id, &session.office_id, session.department_id.as_deref(), employee, contract, tools)?;
        }
        Ok(())
    }
    pub(super) fn summarize_improvement_budget(&self) -> Option<ImprovementBudget> {
        let allowance = self.improvement_allowance.as_ref()?;
        let mut b = ImprovementBudget { cap_usd: allowance.cap_usd, carried_observed_usd: allowance.carried_observed_usd,
            carried_estimated_usd: allowance.carried_estimated_usd, ..Default::default() };
        for job in self.jobs.iter().filter(|j| j.improvement_session_id.is_some()) {
            b.held_usd += job.budget_hold_usd;
            match job.cost_status.as_str() { "observed" => b.observed_usd += job.usage.cost_usd,
                "estimated" => b.estimated_usd += job.usage.cost_usd, "reserved" => b.reserved_usd += job.usage.cost_usd, _ => {} }
        }
        b.committed_usd = b.carried_observed_usd + b.carried_estimated_usd + b.observed_usd + b.estimated_usd + b.reserved_usd + b.held_usd;
        b.remaining_usd = (b.cap_usd - b.committed_usd).max(0.0);
        b.effective_remaining_usd = b.remaining_usd.min(self.summarize_budget().remaining_usd);
        Some(b)
    }
    pub(super) fn improvement_held_tokens(job: &Job) -> u64 {
        if job.improvement_session_id.is_some() && job.reservation.is_none() && !job.usage_recorded && !governance::terminal(&job.status) { job.limits.max_tokens } else { 0 }
    }
    pub(super) fn can_reserve_improvement_job(&self, job: &Job, usd: f64, tokens: u64) -> bool {
        if job.improvement_session_id.is_none() { return self.can_reserve(usd, tokens); }
        let global = self.summarize_budget(); let Some(parent) = self.summarize_improvement_budget() else { return false; };
        !self.policy.dispatch_paused && global.committed_usd - job.budget_hold_usd + usd <= self.policy.budget.hard_cap_usd + 1e-9
            && parent.committed_usd - job.budget_hold_usd + usd <= parent.cap_usd + 1e-9
            && self.policy.budget.hard_cap_tokens.is_none_or(|cap| global.committed_tokens.saturating_sub(Self::improvement_held_tokens(job)).saturating_add(tokens) <= cap)
    }
    pub(super) fn validate_improvement_claim(&self, session_id: Option<&str>, worker: &str) -> Result<()> {
        if let Some(id) = session_id {
            if worker != format!("improvement:{id}") || !self.improvement_sessions.iter().any(|s| s.id == id) {
                return Err(fail("IMPROVEMENT_WORKER_REQUIRED", "Use the exact scoped improvement worker identity"));
            }
        } else if worker.starts_with("improvement:") { return Err(fail("IMPROVEMENT_WORKER_REQUIRED", "The scoped worker must supply its session ID")); }
        Ok(())
    }
    pub(super) fn improvement_allows_dispatch(&self, job: &Job, clock: OffsetDateTime) -> std::result::Result<(), String> {
        let Some(id) = &job.improvement_session_id else {
            if job.budget_hold_usd != 0.0 || job.improvement_route.is_some() { return Err("Orphan improvement budget metadata".into()); }
            return Ok(());
        };
        let session = self.improvement_sessions.iter().find(|s| &s.id == id).ok_or("Improvement session is missing")?;
        if session.status != "active" || session.active_goal_id != job.goal_id { return Err("Improvement session is paused, stopped, or does not own this active goal".into()); }
        self.improvement_scope_authorized(session).map_err(|e| e.message)?;
        let route = job.improvement_route.as_ref().ok_or("Session job has no frozen price quote")?;
        route.validate(session.run_settings.max_tokens, Some(clock)).map_err(|e| e.message)?;
        if !session.allowed_routes.iter().any(|r| r.provider == route.provider && r.model == route.model)
            || job.provider != route.provider || job.model != route.model || job.company_id != session.company_id
            || job.office_id != session.office_id || job.department_id != session.department_id
            || job.worker_id.as_ref().is_some_and(|w| w != &format!("improvement:{id}")) {
            return Err("Session route, assignment or worker differs from its immutable contract".into());
        }
        let expected = if job.pair.as_ref().is_some_and(|p| p.phase == "review") { &session.reviewer_employee_id } else { &session.primary_employee_id };
        if &job.employee_id != expected { return Err("Session employee differs from its frozen pair".into()); }
        Ok(())
    }
    pub(super) fn guard_improvement_owned_work(&self, action: &str, p: &Value) -> Result<()> {
        if ["plan_goal", "set_goal_plan", "execute_goal", "advance_goal", "pause_goal", "resume_goal"].contains(&action)
            && self.goals.iter().any(|g| g.improvement_session_id.is_some() && p.get("goalId").and_then(Value::as_str) == Some(&g.id)) {
            return Err(fail("IMPROVEMENT_SESSION_OWNS_GOAL", "Use the session controls; its immutable paired work cannot be forked or resumed separately"));
        }
        if ["resume_job", "approve_job"].contains(&action) && self.jobs.iter().any(|j| j.improvement_session_id.is_some() && p.get("jobId").and_then(Value::as_str) == Some(&j.id)) {
            return Err(fail("IMPROVEMENT_SESSION_OWNS_GOAL", "Use the session controls to resume eligible undispatched work"));
        }
        Ok(())
    }
    fn set_improvement_status(&mut self, index: usize, status: &str, reason: Option<&str>) {
        let s = &mut self.improvement_sessions[index];
        if s.status != status || s.stop_reason.as_deref() != reason { s.status = status.into(); s.stop_reason = reason.map(str::to_owned); s.revision += 1; s.updated_at = now(); }
    }
    pub(super) fn record_improvement_settlement_breach(&mut self, job_id: &str, reason: &str) {
        let Some(job) = self.jobs.iter_mut().find(|j| j.id == job_id) else { return; };
        let Some(session_id) = job.improvement_session_id.clone() else { return; };
        let goal_id = job.goal_id.clone();
        if job.status != "cancelled" { job.status = "needs-review".into(); }
        job.error = Some(format!("Improvement budget invariant: {reason}. Reported usage is preserved; new dispatch is paused pending owner review."));
        self.policy.dispatch_paused = true;
        if let Some(index) = self.improvement_sessions.iter().position(|s| s.id == session_id) {
            if self.improvement_sessions[index].status != "cancelled" { self.set_improvement_status(index, "needs-review", Some(reason)); }
        }
        if let Some(goal) = self.goals.iter_mut().find(|g| goal_id.as_deref() == Some(&g.id)) {
            goal.status = "needs-review".into();
            if goal.stop_reason.as_deref() != Some("owner-cancelled") { goal.stop_reason = Some(reason.into()); }
            goal.updated_at = now();
        }
        self.log("worker", "improvement-budget-invariant", job_id, format!("{reason}: charge preserved and new global dispatch paused; no budget was reset"));
    }
    fn note_links(&self, note: &StickyNote) -> Result<()> {
        if note.goal_ids.len() > 100 || note.goal_ids.iter().collect::<HashSet<_>>().len() != note.goal_ids.len() { return Err(fail("CAPACITY", "At most100 unique scoped goal links are allowed")); }
        for id in &note.goal_ids {
            let goal = self.goals.iter().find(|g| &g.id == id).ok_or_else(|| fail("NOT_FOUND", "Linked goal is missing"))?;
            let goal_office = match goal.scope.kind.as_str() {
                "office" => Some(goal.scope.id.as_str()),
                "department" => self.departments.iter().find(|d| d.id == goal.scope.id).map(|d| d.office_id.as_str()),
                "employee" => self.employees.iter().find(|e| e.id == goal.scope.id).and_then(|e| e.office_id.as_deref()),
                _ => None,
            };
            if goal.company_id != note.company_id || goal_office != Some(note.office_id.as_str()) || note.department_id.as_ref().is_some_and(|department| goal.scope.kind != "department" || &goal.scope.id != department) {
                return Err(fail("SCOPE_MISMATCH", "Sticky work links cannot cross their company, office or department"));
            }
        }
        Ok(())
    }
    pub(super) fn validate_improvements(&self) -> Result<()> {
        if self.sticky_notes.len() > MAX_NOTES || self.improvement_sessions.len() > MAX_SESSIONS || self.improvement_receipts.len() > MAX_RECEIPTS {
            return Err(fail("OFFICE_STATE_INVALID", "Improvement registry exceeds its durable bounds"));
        }
        for ids in [self.sticky_notes.iter().map(|n| &n.id).collect::<Vec<_>>(), self.improvement_sessions.iter().map(|s| &s.id).collect(), self.improvement_receipts.iter().map(|r| &r.id).collect()] {
            if ids.iter().any(|id| !safe_id(id)) || ids.iter().collect::<HashSet<_>>().len() != ids.len() { return Err(fail("OFFICE_STATE_INVALID", "Improvement identities are invalid or duplicated")); }
        }
        if let Some(a) = &self.improvement_allowance {
            if !safe_id(&a.id) || !a.cap_usd.is_finite() || a.cap_usd <= 0.0 || a.cap_usd > 20.0
                || [a.carried_observed_usd, a.carried_estimated_usd].iter().any(|x| !x.is_finite() || *x < 0.0)
                || a.carried_observed_usd + a.carried_estimated_usd > a.cap_usd + 1e-9 { return Err(fail("OFFICE_STATE_INVALID", "Invalid immutable improvement allowance")); }
            bounded_text(&a.source_reference, 1000, "allowance source")?; timestamp(&a.created_at)?;
        }
        for note in &self.sticky_notes {
            self.improvement_location(&note.company_id, &note.office_id, note.department_id.as_deref(), false)?;
            bounded_text(&note.text, 4000, "sticky text")?;
            if !["comment", "todo"].contains(&note.kind.as_str()) || !["yellow", "blue", "green", "pink", "purple", "gray"].contains(&note.color.as_str())
                || !["open", "done", "archived"].contains(&note.status.as_str()) || [note.x, note.y].iter().any(|x| !x.is_finite() || !(0.0..=1.0).contains(x)) {
                return Err(fail("OFFICE_STATE_INVALID", "Invalid sticky note"));
            }
            if let Some(owner) = &note.owner_employee_id { self.staff(owner)?; }
            self.note_links(note)?; timestamp(&note.created_at)?; timestamp(&note.updated_at)?;
        }
        for s in &self.improvement_sessions {
            self.improvement_location(&s.company_id, &s.office_id, s.department_id.as_deref(), false)?;
            if self.improvement_allowance.as_ref().is_none_or(|a| a.id != s.allowance_id)
                || !["paused", "active", "waiting-work", "waiting-budget", "needs-review", "completed", "cancelled"].contains(&s.status.as_str())
                || !["until-budget", "backlog"].contains(&s.continuation.as_str()) || s.max_cycles.is_some_and(|c| c == 0 || c > 1000)
                || s.goal_ids.len() > 2000 || s.cycle != s.goal_ids.len() as u64 || s.task_note_ids.len() > 128 || s.recent_artifact_sha256s.len() > 32
                || s.recent_artifact_sha256s.iter().any(|h| !sha(h)) || s.primary_employee_id == s.reviewer_employee_id
                || s.run_settings.max_tokens < 2 || s.run_settings.max_minutes < 0.02 {
                return Err(fail("OFFICE_STATE_INVALID", "Invalid improvement session lineage or allowance"));
            }
            bounded_text(&s.title, 200, "session title")?;
            if s.objective.len() > 12000 || s.objective.contains('\0') { return Err(fail("OFFICE_STATE_INVALID", "Invalid session objective")); }
            self.staff(&s.primary_employee_id)?; self.staff(&s.reviewer_employee_id)?; self.validate_run_settings(&self.improvement_goal(s))?;
            if s.allowed_routes.is_empty() || s.allowed_routes.len() > 16 || s.allowed_routes.iter().any(|r| !["anthropic", "openai", "ollama"].contains(&r.provider.as_str()) || r.model.trim().is_empty() || r.model.len() > 200)
                || s.allowed_routes.iter().map(|r| (&r.provider, &r.model)).collect::<HashSet<_>>().len() != s.allowed_routes.len() {
                return Err(fail("OFFICE_STATE_INVALID", "Invalid immutable candidate routes"));
            }
            if s.task_note_ids.iter().collect::<HashSet<_>>().len() != s.task_note_ids.len() || s.task_note_ids.iter().any(|id| self.sticky_notes.iter().find(|n| &n.id == id).is_none_or(|n| !note_matches_session(n, s))) {
                return Err(fail("OFFICE_STATE_INVALID", "Invalid scoped improvement backlog"));
            }
            if s.goal_ids.iter().any(|id| self.goals.iter().find(|g| &g.id == id).is_none_or(|g| g.improvement_session_id.as_deref() != Some(&s.id) || g.company_id != s.company_id))
                || s.active_goal_id.as_ref().is_some_and(|id| !s.goal_ids.contains(id)) { return Err(fail("OFFICE_STATE_INVALID", "Broken improvement goal ownership")); }
            timestamp(&s.created_at)?; timestamp(&s.updated_at)?;
        }
        for goal in &self.goals {
            if let Some(id) = &goal.improvement_session_id {
                if !self.improvement_sessions.iter().any(|s| &s.id == id && s.goal_ids.contains(&goal.id)) { return Err(fail("OFFICE_STATE_INVALID", "Orphan improvement goal")); }
            }
        }
        for job in &self.jobs {
            if !job.budget_hold_usd.is_finite() || job.budget_hold_usd < 0.0 || job.budget_hold_usd > job.limits.max_usd + 1e-9 { return Err(fail("OFFICE_STATE_INVALID", "Invalid improvement budget hold")); }
            if let Some(id) = &job.improvement_session_id {
                let session = self.improvement_sessions.iter().find(|s| &s.id == id).ok_or_else(|| fail("OFFICE_STATE_INVALID", "Orphan improvement job"))?;
                let goal = self.goals.iter().find(|g| Some(&g.id) == job.goal_id.as_ref()).ok_or_else(|| fail("OFFICE_STATE_INVALID", "Missing improvement goal"))?;
                let route = job.improvement_route.as_ref().ok_or_else(|| fail("OFFICE_STATE_INVALID", "Missing immutable model quote"))?;
                route.validate(session.run_settings.max_tokens, None)?;
                let review = job.pair.as_ref().is_some_and(|p| p.phase == "review");
                let primary_tokens = ((session.run_settings.max_tokens * 3) / 5).max(1).min(session.run_settings.max_tokens - 1);
                let quoted = session.run_settings.max_tokens as f64 * route.price_rates.input_usd_per_million.unwrap().max(route.price_rates.output_usd_per_million.unwrap()) / 1_000_000.0;
                let pair_usd = quoted.min(session.run_settings.max_usd);
                if goal.improvement_session_id != job.improvement_session_id || job.company_id != session.company_id || job.office_id != session.office_id
                    || job.department_id != session.department_id || job.provider != route.provider || job.model != route.model
                    || !session.allowed_routes.iter().any(|r| r.provider == route.provider && r.model == route.model)
                    || job.employee_id != if review { &session.reviewer_employee_id } else { &session.primary_employee_id }.as_str()
                    || job.service_contract_id != if review { session.reviewer_service_contract_id.clone() } else { session.service_contract_id.clone() }
                    || job.allowed_tools != if review { vec![] } else { session.run_settings.allowed_tools.clone() }
                    || job.authorized != session.run_settings.authorized || job.mode != "provider"
                    || job.limits.max_tokens != if review { session.run_settings.max_tokens - primary_tokens } else { primary_tokens }
                    || (job.limits.max_usd - pair_usd * if review { 0.4 } else { 0.6 }).abs() > 1e-9
                    || job.price_rates.input_usd_per_million != route.price_rates.input_usd_per_million || job.price_rates.output_usd_per_million != route.price_rates.output_usd_per_million
                    || (job.budget_hold_usd > 0.0 && (job.reservation.is_some() || job.usage_recorded)) {
                    return Err(fail("OFFICE_STATE_INVALID", "Improvement job differs from its frozen contract"));
                }
            } else if job.budget_hold_usd != 0.0 || job.improvement_route.is_some() || self.goals.iter().any(|g| g.improvement_session_id.is_some() && Some(&g.id) == job.goal_id.as_ref()) {
                return Err(fail("OFFICE_STATE_INVALID", "Missing session identity on budget-governed work"));
            }
        }
        for receipt in &self.improvement_receipts { if !sha(&receipt.request_sha256) || !receipt.result.is_object() { return Err(fail("OFFICE_STATE_INVALID", "Invalid improvement mutation receipt")); } timestamp(&receipt.at)?; }
        Ok(())
    }
}
