//! Timeboxed in-app delegation. Grants narrow existing adapters; they never
//! mint OS credentials, override service contracts, or authorize hidden tools.
use super::*;

const MAX_GRANTS: usize = 10_000;
const MAX_LEDGER: usize = 20_000;
const MAX_INDEX: usize = 150_000;
pub const AUTHORITY_CAPABILITIES: &[&str] = &[
    "team.manage",
    "work.manage",
    "knowledge.manage",
    "layout.manage",
    "roadmap.manage",
    "cache.manage",
    "authority.manage",
    "provider.run",
    "github.read_repository",
    "github.publish_changes",
];

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthorityGrant {
    pub id: String,
    pub employee_id: String,
    pub scope: Scope,
    pub preset: String,
    pub capabilities: Vec<String>,
    #[serde(rename = "type")]
    pub grant_type: String,
    pub title: Option<String>,
    pub issuer: String,
    pub granted_at: String,
    pub expires_at: String,
    pub revoked_at: Option<String>,
    pub reason: String,
    pub revoked_by: Option<String>,
    pub revoke_reason: Option<String>,
    #[serde(default)]
    pub parent_grant_ids: Vec<String>,
}

#[cfg(test)]
mod tests {
    use super::*;
    fn state() -> OfficeSnapshot {
        let company:Company=serde_json::from_value(json!({"id":"atlas","name":"Atlas","repoUrl":"https://github.com/occult-kranti/engineering-intelligence-atlas","owner":"occult-kranti","repo":"engineering-intelligence-atlas","githubStatus":"unchecked"})).unwrap();
        OfficeSnapshot::seeded(&company, &[]).unwrap()
    }
    fn grant(
        s: &mut OfficeSnapshot,
        employee: &str,
        scope: Value,
        capabilities: Value,
        issuer: &str,
        expires: OffsetDateTime,
    ) -> String {
        s.apply(&json!({"action":"grant_authority","employeeId":employee,"scope":scope,"preset":"partial","capabilities":capabilities,"expiresAt":at(expires),"issuer":issuer,"reason":"Bounded fixture delegation"})).unwrap();
        s.last_action.as_ref().unwrap()["grantId"]
            .as_str()
            .unwrap()
            .into()
    }
    fn hire(s: &mut OfficeSnapshot) -> String {
        s.apply(&json!({"action":"hire_employee","companyId":"atlas","officeId":s.offices[0].id,"name":"Scoped manager","role":"Engineer"})).unwrap();
        s.last_action.as_ref().unwrap()["employeeId"]
            .as_str()
            .unwrap()
            .into()
    }
    fn provider_job(s: &mut OfficeSnapshot) -> String {
        s.apply(&json!({"action":"enqueue_job","companyId":"atlas","officeId":s.offices[0].id,"employeeId":"donna","goal":"Bounded provider test","mode":"provider","provider":"anthropic","model":"fixture-model","authorized":true,"maxTokens":100,"maxUsd":1,"maxMinutes":5,"priceRates":{"inputUsdPerMillion":1,"outputUsdPerMillion":1},"idempotencyKey":"authority-provider-fixture"})).unwrap();
        s.last_action.as_ref().unwrap()["jobId"]
            .as_str()
            .unwrap()
            .into()
    }
    fn two_companies() -> (OfficeSnapshot, String) {
        let mut s = state();
        s.apply(&json!({"action":"create_company","name":"Child","id":"child-co"}))
            .unwrap();
        s.apply(&json!({"action":"create_company","name":"Other","id":"other-co"}))
            .unwrap();
        let employee = hire(&mut s);
        (s, employee)
    }
    fn reparent(employee: &str, child: &str, parent: Value) -> Value {
        json!({"action":"apply_employee_command","employeeId":employee,"command":{"action":"set_company_parent","companyId":child,"parentCompanyId":parent}})
    }
    fn company_grant(s: &mut OfficeSnapshot, employee: &str, company: &str, expires: OffsetDateTime) -> String {
        grant(
            s,
            employee,
            json!({"kind":"company","id":company}),
            json!(["team.manage"]),
            "owner",
            expires,
        )
    }
    fn parent_of(s: &OfficeSnapshot, id: &str) -> Option<String> {
        s.companies
            .iter()
            .find(|c| c.id == id)
            .unwrap()
            .parent_company_id
            .clone()
    }
    #[test]
    fn reparent_requires_child_and_every_affected_parent_grant() {
        let (mut s, e) = two_companies();
        let soon = OffsetDateTime::now_utc() + Duration::hours(1);
        company_grant(&mut s, &e, "child-co", soon);
        assert_eq!(
            s.apply(&reparent(&e, "child-co", json!("atlas"))).unwrap_err().code,
            "AUTHORITY_DENIED"
        );
        assert_eq!(parent_of(&s, "child-co"), None);
        let (mut s, e) = two_companies();
        company_grant(&mut s, &e, "atlas", soon);
        assert_eq!(
            s.apply(&reparent(&e, "child-co", json!("atlas"))).unwrap_err().code,
            "AUTHORITY_DENIED"
        );
        assert_eq!(parent_of(&s, "child-co"), None);
    }
    #[test]
    fn all_affected_grants_allow_reparent_detach_and_update_index() {
        let (mut s, e) = two_companies();
        let soon = OffsetDateTime::now_utc() + Duration::hours(1);
        for c in ["child-co", "atlas", "other-co"] {
            company_grant(&mut s, &e, c, soon);
        }
        s.apply(&reparent(&e, "child-co", json!("atlas"))).unwrap();
        assert_eq!(parent_of(&s, "child-co").as_deref(), Some("atlas"));
        let entry = |s: &OfficeSnapshot| {
            s.authority
                .index
                .iter()
                .find(|i| i.id == "company:child-co")
                .unwrap()
                .clone()
        };
        assert_eq!(entry(&s).parent_id.as_deref(), Some("atlas"));
        assert_eq!(entry(&s).company_id.as_deref(), Some("child-co"));
        s.apply(&reparent(&e, "child-co", json!("other-co"))).unwrap();
        assert_eq!(entry(&s).parent_id.as_deref(), Some("other-co"));
        s.apply(&reparent(&e, "child-co", Value::Null)).unwrap();
        assert_eq!(entry(&s).parent_id, None);
        assert!(s
            .authority
            .ledger
            .iter()
            .any(|l| l.actor == e && l.action == "set_company_parent" && l.target_id == "child-co"));
    }
    #[test]
    fn detach_needs_old_parent_grant() {
        let (mut s, e) = two_companies();
        s.apply(&json!({"action":"set_company_parent","companyId":"child-co","parentCompanyId":"atlas"}))
            .unwrap();
        let soon = OffsetDateTime::now_utc() + Duration::hours(1);
        company_grant(&mut s, &e, "child-co", soon);
        assert_eq!(
            s.apply(&reparent(&e, "child-co", Value::Null)).unwrap_err().code,
            "AUTHORITY_DENIED"
        );
        assert_eq!(parent_of(&s, "child-co").as_deref(), Some("atlas"));
        company_grant(&mut s, &e, "atlas", soon);
        s.apply(&reparent(&e, "child-co", Value::Null)).unwrap();
        assert_eq!(parent_of(&s, "child-co"), None);
    }
    #[test]
    fn expired_or_revoked_extra_grant_denies_reparent() {
        let (mut s, e) = two_companies();
        let soon = OffsetDateTime::now_utc() + Duration::hours(1);
        company_grant(&mut s, &e, "child-co", soon);
        let parent_grant = company_grant(&mut s, &e, "atlas", soon);
        s.apply(&json!({"action":"revoke_authority","grantId":parent_grant,"reason":"Fixture stop"}))
            .unwrap();
        assert_eq!(
            s.apply(&reparent(&e, "child-co", json!("atlas"))).unwrap_err().code,
            "AUTHORITY_DENIED"
        );
        let (mut s, e) = two_companies();
        company_grant(&mut s, &e, "child-co", soon);
        let g = company_grant(&mut s, &e, "atlas", soon);
        let i = s.authority.grants.iter().position(|x| x.id == g).unwrap();
        s.authority.grants[i].expires_at = at(OffsetDateTime::now_utc() - Duration::seconds(1));
        s.authority.grants[i].granted_at = at(OffsetDateTime::now_utc() - Duration::hours(1));
        assert_eq!(
            s.apply(&reparent(&e, "child-co", json!("atlas"))).unwrap_err().code,
            "AUTHORITY_DENIED"
        );
        assert_eq!(parent_of(&s, "child-co"), None);
    }
    #[test]
    fn parent_company_grant_does_not_authorize_child_company_command() {
        let (mut s, e) = two_companies();
        s.apply(&json!({"action":"set_company_parent","companyId":"child-co","parentCompanyId":"atlas"}))
            .unwrap();
        company_grant(&mut s, &e, "atlas", OffsetDateTime::now_utc() + Duration::hours(1));
        assert_eq!(
            s.apply(&json!({"action":"apply_employee_command","employeeId":e,"command":{"action":"rename_company","companyId":"child-co","name":"Renamed"}}))
                .unwrap_err()
                .code,
            "AUTHORITY_DENIED"
        );
    }
    fn department_reparent(employee: &str, child: &str, parent: Value) -> Value {
        json!({"action":"apply_employee_command","employeeId":employee,"command":{"action":"set_department_parent","departmentId":child,"parentDepartmentId":parent}})
    }
    fn department_state() -> (OfficeSnapshot, String, Vec<String>) {
        let mut s = state(); let office_id = s.offices[0].id.clone();
        s.apply(&json!({"action":"create_department","officeId":office_id,"name":"Third"})).unwrap();
        let ids = s.departments.iter().filter(|d| d.office_id == office_id).take(3).map(|d| d.id.clone()).collect();
        let employee = hire(&mut s); (s, employee, ids)
    }
    fn department_grant(s: &mut OfficeSnapshot, employee: &str, department: &str, expires: OffsetDateTime) -> String {
        grant(s, employee, json!({"kind":"department","id":department}), json!(["team.manage"]), "owner", expires)
    }
    #[test]
    fn department_reparent_requires_child_old_and_new_parent_authority() {
        let (mut s, employee, ids) = department_state(); let expires = OffsetDateTime::now_utc() + Duration::hours(1);
        department_grant(&mut s, &employee, &ids[1], expires);
        assert_eq!(s.apply(&department_reparent(&employee, &ids[1], json!(ids[0]))).unwrap_err().code, "AUTHORITY_DENIED");
        let old_grant = department_grant(&mut s, &employee, &ids[0], expires);
        s.apply(&department_reparent(&employee, &ids[1], json!(ids[0]))).unwrap();
        assert_eq!(s.apply(&department_reparent(&employee, &ids[1], json!(ids[2]))).unwrap_err().code, "AUTHORITY_DENIED");
        department_grant(&mut s, &employee, &ids[2], expires);
        s.apply(&json!({"action":"revoke_authority","grantId":old_grant,"reason":"Stop old-parent access"})).unwrap();
        assert_eq!(s.apply(&department_reparent(&employee, &ids[1], json!(ids[2]))).unwrap_err().code, "AUTHORITY_DENIED");
        assert_eq!(s.apply(&department_reparent(&employee, &ids[1], Value::Null)).unwrap_err().code, "AUTHORITY_DENIED");
        assert_eq!(s.departments.iter().find(|d| d.id == ids[1]).unwrap().parent_department_id.as_deref(), Some(ids[0].as_str()));
    }
    #[test]
    fn department_all_grants_allow_reparent_and_index_falls_back_to_office_on_detach() {
        let (mut s, employee, ids) = department_state(); let expires = OffsetDateTime::now_utc() + Duration::hours(1);
        for department in &ids { department_grant(&mut s, &employee, department, expires); }
        let key = format!("department:{}", ids[1]);
        s.apply(&department_reparent(&employee, &ids[1], json!(ids[0]))).unwrap();
        assert_eq!(s.authority.index.iter().find(|i| i.id == key).unwrap().parent_id.as_deref(), Some(ids[0].as_str()));
        s.apply(&department_reparent(&employee, &ids[1], json!(ids[2]))).unwrap();
        assert_eq!(s.authority.index.iter().find(|i| i.id == key).unwrap().parent_id.as_deref(), Some(ids[2].as_str()));
        s.apply(&department_reparent(&employee, &ids[1], Value::Null)).unwrap();
        let office_id = &s.departments.iter().find(|d| d.id == ids[1]).unwrap().office_id;
        assert_eq!(s.authority.index.iter().find(|i| i.id == key).unwrap().parent_id.as_deref(), Some(office_id.as_str()));
        assert!(s.authority.ledger.iter().any(|l| l.actor == employee && l.action == "set_department_parent" && l.target_id == ids[1]));
    }
    #[test]
    fn department_parent_grant_never_inherits_to_child_and_expired_parent_blocks_reparent() {
        let (mut s, employee, ids) = department_state(); let expires = OffsetDateTime::now_utc() + Duration::hours(1);
        s.apply(&json!({"action":"set_department_parent","departmentId":ids[1],"parentDepartmentId":ids[0]})).unwrap();
        let parent_grant = department_grant(&mut s, &employee, &ids[0], expires);
        assert_eq!(s.apply(&json!({"action":"apply_employee_command","employeeId":employee,"command":{"action":"pause_department","departmentId":ids[1]}})).unwrap_err().code, "AUTHORITY_DENIED");
        department_grant(&mut s, &employee, &ids[1], expires);
        let grant = s.authority.grants.iter_mut().find(|g| g.id == parent_grant).unwrap();
        grant.granted_at = at(OffsetDateTime::now_utc() - Duration::hours(1));
        grant.expires_at = at(OffsetDateTime::now_utc() - Duration::seconds(1));
        assert_eq!(s.apply(&department_reparent(&employee, &ids[1], Value::Null)).unwrap_err().code, "AUTHORITY_DENIED");
    }
    #[test]
    fn historic_state_migrates_index_without_inventing_permissions() {
        let original = state();
        let ids: Vec<_> = original.employees.iter().map(|e| e.id.clone()).collect();
        let mut old = serde_json::to_value(&original).unwrap();
        old.as_object_mut().unwrap().remove("authority");
        let mut restored: OfficeSnapshot = serde_json::from_value(old).unwrap();
        assert!(restored.authority.grants.is_empty());
        assert!(restored.authority.managed_employee_ids.is_empty());
        assert!(restored.refresh_authority_index().unwrap());
        assert!(!restored.refresh_authority_index().unwrap());
        assert_eq!(
            restored
                .employees
                .iter()
                .map(|e| e.id.clone())
                .collect::<Vec<_>>(),
            ids
        );
        assert!(restored
            .authority
            .index
            .iter()
            .any(|e| e.kind == "company" && e.entity_id == "atlas"));
        restored.validate().unwrap();
    }
    #[test]
    fn scoped_grants_expire_and_revoke_without_falling_back_to_legacy_dispatch() {
        let mut s = state();
        let clock = OffsetDateTime::now_utc();
        let grant_id = grant(
            &mut s,
            "donna",
            json!({"kind":"company","id":"atlas"}),
            json!(["provider.run"]),
            "owner",
            clock + Duration::minutes(5),
        );
        let job_id = provider_job(&mut s);
        let job = s.jobs.iter().find(|j| j.id == job_id).unwrap();
        assert!(s
            .authority_allows_dispatch(job, clock + Duration::seconds(1))
            .is_ok());
        assert!(s
            .authority_allows_dispatch(job, clock + Duration::minutes(6))
            .is_err());
        s.apply(&json!({"action":"revoke_authority","grantId":grant_id,"reason":"Fixture stop","issuer":"owner"})).unwrap();
        s.apply(&json!({"action":"claim_job","workerId":"fixture","mode":"provider"}))
            .unwrap();
        assert!(s.last_action.as_ref().unwrap()["jobId"].is_null());
        assert!(s.authority.managed_employee_ids.contains(&"donna".into()));
        assert_eq!(s.jobs[0].status, "queued");
        assert!(s.jobs[0].error.as_ref().unwrap().contains("authority"));
    }
    #[test]
    fn donna_delegation_is_bounded_by_parents_scope_capabilities_and_lifetime() {
        let mut s = state();
        let employee = hire(&mut s);
        let clock = OffsetDateTime::now_utc();
        let parent = grant(
            &mut s,
            "donna",
            json!({"kind":"company","id":"atlas"}),
            json!(["authority.manage", "team.manage"]),
            "owner",
            clock + Duration::hours(2),
        );
        let office_id = s.offices[0].id.clone();
        let child = grant(
            &mut s,
            &employee,
            json!({"kind":"office","id":office_id}),
            json!(["team.manage"]),
            "donna",
            clock + Duration::hours(1),
        );
        assert_eq!(
            s.authority
                .grants
                .iter()
                .find(|g| g.id == child)
                .unwrap()
                .parent_grant_ids,
            vec![parent.clone()]
        );
        let command = json!({"action":"apply_employee_command","employeeId":employee,"command":{"action":"create_department","officeId":s.offices[0].id,"name":"Delegated department"}});
        let before = s.departments.len();
        s.apply(&command).unwrap();
        assert_eq!(s.departments.len(), before + 1);
        assert!(s
            .authority
            .ledger
            .iter()
            .any(|e| e.actor == employee && e.action == "create_department"));
        for payload in [
            json!({"employeeId":"donna","scope":{"kind":"company","id":"atlas"},"capabilities":["team.manage"],"expiresAt":at(clock+Duration::hours(1))}),
            json!({"employeeId":employee,"scope":{"kind":"company","id":"atlas"},"capabilities":["provider.run"],"expiresAt":at(clock+Duration::hours(1))}),
            json!({"employeeId":employee,"scope":{"kind":"company","id":"atlas"},"capabilities":["team.manage"],"expiresAt":at(clock+Duration::hours(3))}),
        ] {
            let mut bad = payload;
            bad["action"] = json!("grant_authority");
            bad["preset"] = json!("partial");
            bad["issuer"] = json!("donna");
            bad["reason"] = json!("Must be denied");
            assert_eq!(s.apply(&bad).unwrap_err().code, "AUTHORITY_DENIED");
        }
        s.apply(&json!({"action":"revoke_authority","grantId":parent,"reason":"Revoke parent","issuer":"owner"})).unwrap();
        assert_eq!(s.apply(&command).unwrap_err().code, "AUTHORITY_DENIED");
        assert_eq!(s.departments.len(), before + 1);
        assert!(s.authority.managed_employee_ids.contains(&employee));
        let mut corrupted = s.clone();
        let index = corrupted
            .authority
            .grants
            .iter()
            .position(|g| g.id == parent)
            .unwrap();
        corrupted.authority.grants[index].parent_grant_ids = vec![child];
        assert!(corrupted.validate().is_err());
    }
    #[test]
    fn employee_commands_cannot_escape_scope_or_enable_provider_work_from_management_only() {
        let mut s = state();
        let employee = hire(&mut s);
        let clock = OffsetDateTime::now_utc();
        grant(
            &mut s,
            &employee,
            json!({"kind":"company","id":"atlas"}),
            json!(["team.manage", "work.manage"]),
            "owner",
            clock + Duration::hours(1),
        );
        s.apply(&json!({"action":"create_company","name":"Other","id":"other"}))
            .unwrap();
        assert_eq!(s.apply(&json!({"action":"apply_employee_command","employeeId":employee,"command":{"action":"rename_company","companyId":"other","name":"Forbidden"}})).unwrap_err().code,"AUTHORITY_DENIED");
        assert_eq!(s.apply(&json!({"action":"apply_employee_command","employeeId":employee,"command":{"action":"create_goal","scope":{"kind":"company","id":"atlas"},"title":"Should not dispatch","runSettings":{"mode":"provider"}}})).unwrap_err().code,"AUTHORITY_DENIED");
        for action in [
            "configure_policy",
            "configure_cache",
            "claim_job",
            "apply_remote_command",
            "apply_employee_command",
            "set_authority_enforcement",
        ] {
            assert!(s.apply(&json!({"action":"apply_employee_command","employeeId":employee,"command":{"action":action}})).is_err());
        }
    }
    #[test]
    fn promotion_is_temporary_and_rename_preserves_repository_and_restored_history() {
        let mut s = state();
        let employee = hire(&mut s);
        let role = s.staff(&employee).unwrap().role.clone();
        let repo = s.companies[0].repo_url.clone();
        s.apply(&json!({"action":"promote_employee","employeeId":employee,"scope":{"kind":"company","id":"atlas"},"preset":"full","title":"Acting director","expiresAt":at(OffsetDateTime::now_utc()+Duration::hours(1)),"issuer":"owner","reason":"Temporary assignment"})).unwrap();
        assert_eq!(s.staff(&employee).unwrap().role, role);
        assert_eq!(s.authority.grants[0].grant_type, "promotion");
        s.apply(&json!({"action":"rename_company","companyId":"atlas","name":"Daftar"}))
            .unwrap();
        s = serde_json::from_str(&serde_json::to_string(&s).unwrap()).unwrap();
        s.validate().unwrap();
        assert_eq!(s.companies[0].id, "atlas");
        assert_eq!(s.companies[0].repo_url, repo);
        assert_eq!(s.companies[0].name, "Daftar");
        assert!(s
            .authority
            .ledger
            .iter()
            .any(|e| e.action == "rename_company"));
        assert!(s
            .authority
            .index
            .iter()
            .any(|e| e.kind == "company" && e.entity_id == "atlas" && e.title == "Daftar"));
    }
    #[test]
    fn revocation_between_claim_and_dispatch_blocks_calls_but_keeps_inflight_settlement() {
        let mut s = state();
        let grant_id = grant(
            &mut s,
            "donna",
            json!({"kind":"company","id":"atlas"}),
            json!(["provider.run"]),
            "owner",
            OffsetDateTime::now_utc() + Duration::hours(1),
        );
        let job_id = provider_job(&mut s);
        s.apply(&json!({"action":"claim_job","workerId":"fixture","mode":"provider"}))
            .unwrap();
        let lease = s.last_action.as_ref().unwrap()["leaseToken"]
            .as_str()
            .unwrap()
            .to_owned();
        s.apply(&json!({"action":"reserve_job","jobId":job_id,"leaseToken":lease,"inputTokens":10,"maxOutputTokens":20,"costUsd":0.1})).unwrap();
        s.apply(&json!({"action":"check_worker_authority","jobId":job_id,"leaseToken":lease,"capability":"provider.run"})).unwrap();
        assert_eq!(s.last_action.as_ref().unwrap()["allowed"], true);
        s.apply(&json!({"action":"revoke_authority","grantId":grant_id,"reason":"Stop future side effects"})).unwrap();
        assert_eq!(s.apply(&json!({"action":"check_worker_authority","jobId":job_id,"leaseToken":lease,"capability":"provider.run"})).unwrap_err().code,"AUTHORITY_DENIED");
        assert_eq!(s.jobs[0].status, "running");
        assert!(s.jobs[0].reservation.is_some());
        s.apply(&json!({"action":"finish_job","jobId":job_id,"leaseToken":lease,"status":"completed","inputTokens":10,"outputTokens":10,"costUsd":0.05,"artifactUri":"/tmp/retained-artifact.md","summary":"Already dispatched result retained"})).unwrap();
        assert_eq!(s.jobs[0].status, "completed");
        assert_eq!(s.jobs[0].usage.cost_usd, 0.05);
        assert!(s.jobs[0].artifact_uri.is_some());
        assert!(!serde_json::to_string(&s.authority.index)
            .unwrap()
            .contains("/tmp/retained-artifact.md"));
    }
    #[test]
    fn exact_cap_reservation_keeps_authority_before_first_dispatch_but_blocks_new_claims() {
        let mut s = state();
        s.apply(&json!({"action":"configure_policy","hardCapUsd":0.1,"hardCapTokens":30})).unwrap();
        let job_id = provider_job(&mut s);
        s.apply(&json!({"action":"enqueue_job","companyId":"atlas","officeId":s.offices[0].id,"employeeId":"donna","goal":"Another provider job","mode":"provider","provider":"anthropic","model":"fixture-model","authorized":true,"maxTokens":100,"maxUsd":1,"maxMinutes":5,"priceRates":{"inputUsdPerMillion":1,"outputUsdPerMillion":1},"idempotencyKey":"after-exact-cap"})).unwrap();
        s.apply(&json!({"action":"claim_job","workerId":"fixture","mode":"provider"})).unwrap();
        let lease = s.last_action.as_ref().unwrap()["leaseToken"].as_str().unwrap().to_owned();
        s.apply(&json!({"action":"reserve_job","jobId":job_id,"leaseToken":lease,"inputTokens":10,"maxOutputTokens":20,"costUsd":0.1})).unwrap();
        assert!(s.budget.at_cap);
        s.apply(&json!({"action":"check_worker_authority","jobId":job_id,"leaseToken":lease,"capability":"provider.run"})).unwrap();
        assert_eq!(s.last_action.as_ref().unwrap()["allowed"],true);
        s.apply(&json!({"action":"claim_job","workerId":"next","mode":"provider"})).unwrap();
        assert!(s.last_action.as_ref().unwrap()["jobId"].is_null());
        assert_eq!(s.jobs[1].status,"queued"); s.validate().unwrap();
    }
    #[test]
    fn reserved_authority_survives_admission_pause_but_grant_and_scope_checks_remain_live() {
        let mut s = state();
        let permission = grant(&mut s,"donna",json!({"kind":"company","id":"atlas"}),json!(["provider.run"]),"owner",OffsetDateTime::now_utc()+Duration::hours(1));
        let job_id = provider_job(&mut s);
        s.apply(&json!({"action":"claim_job","workerId":"fixture","mode":"provider"})).unwrap();
        let lease = s.last_action.as_ref().unwrap()["leaseToken"].as_str().unwrap().to_owned();
        s.apply(&json!({"action":"reserve_job","jobId":job_id,"leaseToken":lease,"inputTokens":10,"maxOutputTokens":20,"costUsd":0.1})).unwrap();
        s.apply(&json!({"action":"configure_policy","hardCapUsd":0,"hardCapTokens":1,"dispatchPaused":true})).unwrap();
        let check=json!({"action":"check_worker_authority","jobId":job_id,"leaseToken":lease,"capability":"provider.run"});
        s.apply(&check).unwrap(); assert_eq!(s.last_action.as_ref().unwrap()["allowed"],true);
        let mut revoked=s.clone(); revoked.apply(&json!({"action":"revoke_authority","grantId":permission,"reason":"Stop current authority"})).unwrap();
        assert_eq!(revoked.apply(&check).unwrap_err().code,"AUTHORITY_DENIED");
        let mut expired=s.clone(); expired.authority.grants.iter_mut().find(|g|g.id==permission).unwrap().expires_at="2020-01-01T00:00:00Z".into();
        assert_eq!(expired.apply(&check).unwrap_err().code,"AUTHORITY_DENIED");
        for change in [json!({"action":"pause_employee","employeeId":"donna"}),json!({"action":"pause_company","companyId":"atlas"})] {
            let mut stopped=s.clone(); stopped.apply(&change).unwrap();
            assert_eq!(stopped.apply(&check).unwrap_err().code,"STALE_LEASE");
        }
        s.apply(&json!({"action":"finish_job","jobId":job_id,"leaseToken":lease,"status":"completed","inputTokens":10,"outputTokens":10,"costUsd":0.05,"artifactUri":"/tmp/reserved-result.md"})).unwrap();
        assert_eq!(s.jobs[0].status,"completed"); assert_eq!(s.budget.observed_usd,0.05); s.validate().unwrap();
    }
    #[test]
    fn unreserved_running_claim_does_not_bypass_a_new_dispatch_pause() {
        let mut s=state(); let job_id=provider_job(&mut s);
        s.apply(&json!({"action":"claim_job","workerId":"fixture","mode":"provider"})).unwrap();
        let lease=s.last_action.as_ref().unwrap()["leaseToken"].as_str().unwrap().to_owned();
        s.apply(&json!({"action":"configure_policy","dispatchPaused":true})).unwrap();
        assert_eq!(s.apply(&json!({"action":"check_worker_authority","jobId":job_id,"leaseToken":lease,"capability":"provider.run"})).unwrap_err().code,"AUTHORITY_DENIED");
        assert!(s.jobs[0].reservation.is_none()); s.validate().unwrap();
    }
    #[test]
    fn cloud_commands_recheck_authority_but_completed_receipts_remain_noops_after_revocation() {
        let mut s = state();
        let employee = hire(&mut s);
        let grant_id = grant(
            &mut s,
            &employee,
            json!({"kind":"company","id":"atlas"}),
            json!(["team.manage"]),
            "owner",
            OffsetDateTime::now_utc() + Duration::hours(1),
        );
        let command = json!({"action":"apply_employee_command","employeeId":employee,"command":{"action":"create_department","officeId":s.offices[0].id,"name":"Remote delegated work"}});
        let request = json!({"action":"apply_remote_command","id":"authority-remote-command","command":command});
        let before = s.departments.len();
        s.apply(&request).unwrap();
        assert_eq!(s.departments.len(), before + 1);
        s.apply(&json!({"action":"revoke_authority","grantId":grant_id,"reason":"End delegation"}))
            .unwrap();
        s.apply(&request).unwrap();
        assert_eq!(s.departments.len(), before + 1);
        assert_eq!(s.last_action.as_ref().unwrap()["replayed"], true);
        assert_eq!(s.apply(&json!({"action":"apply_remote_command","id":"later-cloud-command","command":command})).unwrap_err().code,"AUTHORITY_DENIED");
        assert_eq!(s.remote_receipts.len(), 1);
    }
    #[test]
    fn layout_authority_uses_the_mutated_office_not_a_supplied_blueprint_alias() {
        let mut s = state();
        let employee = hire(&mut s);
        let first = s.offices[0].id.clone();
        s.apply(&json!({"action":"ensure_blueprint","officeId":first}))
            .unwrap();
        let blueprint = s
            .blueprints
            .iter()
            .find(|b| b.office_id == first)
            .unwrap()
            .id
            .clone();
        s.apply(&json!({"action":"create_office","companyId":"atlas","name":"Other office"}))
            .unwrap();
        let second = s.last_action.as_ref().unwrap()["officeId"]
            .as_str()
            .unwrap()
            .to_owned();
        grant(
            &mut s,
            &employee,
            json!({"kind":"office","id":first}),
            json!(["layout.manage"]),
            "owner",
            OffsetDateTime::now_utc() + Duration::hours(1),
        );
        let room = json!({"action":"upsert_room","officeId":first,"name":"Authorized room","x":0.1,"y":0.1,"width":0.2,"height":0.2});
        s.apply(&json!({"action":"apply_employee_command","employeeId":employee,"command":room}))
            .unwrap();
        let mut escaped = room.clone();
        escaped["officeId"] = json!(second);
        escaped["blueprintId"] = json!(blueprint);
        assert!(s
            .apply(
                &json!({"action":"apply_employee_command","employeeId":employee,"command":escaped})
            )
            .is_err());
        assert!(!s.blueprints.iter().any(|b| b.office_id == second));
        escaped.as_object_mut().unwrap().remove("blueprintId");
        assert_eq!(
            s.apply(
                &json!({"action":"apply_employee_command","employeeId":employee,"command":escaped})
            )
            .unwrap_err()
            .code,
            "AUTHORITY_DENIED"
        );
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthorityLedgerEntry {
    pub id: String,
    pub at: String,
    pub actor: String,
    pub action: String,
    pub target_id: String,
    pub scope: Option<Scope>,
    pub summary: String,
    pub grant_id: Option<String>,
    pub outcome: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OfficeIndexEntry {
    pub id: String,
    pub entity_id: String,
    pub kind: String,
    pub title: String,
    pub company_id: Option<String>,
    pub parent_id: Option<String>,
    pub owner_employee_id: Option<String>,
    pub status: String,
    pub updated_at: String,
    pub related_ids: Vec<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OfficeAuthority {
    pub schema_version: u32,
    pub managed_employee_ids: Vec<String>,
    pub grants: Vec<AuthorityGrant>,
    pub ledger: Vec<AuthorityLedgerEntry>,
    pub index: Vec<OfficeIndexEntry>,
}
impl Default for OfficeAuthority {
    fn default() -> Self {
        Self {
            schema_version: 1,
            managed_employee_ids: vec![],
            grants: vec![],
            ledger: vec![],
            index: vec![],
        }
    }
}

#[derive(Default)]
struct Location {
    company: Option<String>,
    office: Option<String>,
    department: Option<String>,
    employee: Option<String>,
    goal: Option<String>,
}

fn active(grant: &AuthorityGrant, clock: OffsetDateTime) -> bool {
    grant.revoked_at.is_none()
        && timestamp(&grant.granted_at).is_ok_and(|t| t <= clock)
        && timestamp(&grant.expires_at).is_ok_and(|t| t > clock)
}
fn decode<T: serde::de::DeserializeOwned>(value: &Value, label: &str) -> Result<T> {
    serde_json::from_value(value.clone())
        .map_err(|_| fail("INVALID_INPUT", format!("Invalid {label}")))
}
fn required_worker_capabilities(job: &Job) -> Vec<&str> {
    let mut capabilities = vec![if job.mode == "provider" {
        "provider.run"
    } else {
        "work.manage"
    }];
    capabilities.extend(job.allowed_tools.iter().map(String::as_str));
    capabilities
}

impl OfficeSnapshot {
    fn authority_grant_live(&self, grant: &AuthorityGrant, clock: OffsetDateTime) -> bool {
        if !active(grant, clock) {
            return false;
        }
        // Donna's grants are one level below owner grants. An invalid or cyclic
        // stored chain fails closed; neither delegation nor replay broadens it.
        grant.parent_grant_ids.iter().all(|parent_id| {
            self.authority
                .grants
                .iter()
                .find(|parent| &parent.id == parent_id)
                .is_some_and(|parent| {
                    parent.issuer == "owner"
                        && parent.employee_id == "donna"
                        && parent.parent_grant_ids.is_empty()
                        && active(parent, clock)
                })
        })
    }
    fn authority_location(&self, scope: &Scope) -> Result<Location> {
        match scope.kind.as_str() {
            "company" => Ok(Location {
                company: Some(self.company(&scope.id)?.id.clone()),
                ..Location::default()
            }),
            "office" => {
                let item = self.office(&scope.id)?;
                Ok(Location {
                    company: Some(item.company_id.clone()),
                    office: Some(item.id.clone()),
                    ..Location::default()
                })
            }
            "department" => {
                let item = self
                    .departments
                    .iter()
                    .find(|d| d.id == scope.id)
                    .ok_or_else(|| fail("NOT_FOUND", "Authority department not found"))?;
                Ok(Location {
                    company: Some(item.company_id.clone()),
                    office: Some(item.office_id.clone()),
                    department: Some(item.id.clone()),
                    ..Location::default()
                })
            }
            "employee" => {
                let item = self.staff(&scope.id)?;
                Ok(Location {
                    company: item.company_id.clone(),
                    office: item.office_id.clone(),
                    department: item.department_id.clone(),
                    employee: Some(item.id.clone()),
                    ..Location::default()
                })
            }
            "goal" => {
                let item = self
                    .goals
                    .iter()
                    .find(|g| g.id == scope.id)
                    .ok_or_else(|| fail("NOT_FOUND", "Authority goal not found"))?;
                let mut location = self.authority_location(&item.scope)?;
                location.company = Some(item.company_id.clone());
                location.goal = Some(item.id.clone());
                Ok(location)
            }
            _ => Err(fail(
                "INVALID_INPUT",
                "Authority scope must be company, office, department, employee or goal",
            )),
        }
    }
    fn grant_contains_location(grant: &Scope, target: &Location) -> bool {
        match grant.kind.as_str() {
            "company" => target.company.as_ref() == Some(&grant.id),
            "office" => target.office.as_ref() == Some(&grant.id),
            "department" => target.department.as_ref() == Some(&grant.id),
            "employee" => target.employee.as_ref() == Some(&grant.id),
            "goal" => target.goal.as_ref() == Some(&grant.id),
            _ => false,
        }
    }
    fn authority_has(
        &self,
        employee: &str,
        scope: &Scope,
        capability: &str,
        clock: OffsetDateTime,
        through: Option<OffsetDateTime>,
    ) -> Result<bool> {
        let subject = self.staff(employee)?;
        if subject.status != "active" {
            return Ok(false);
        }
        let target = self.authority_location(scope)?;
        Ok(self.authority_has_location(employee, &target, capability, clock, through))
    }
    fn authority_has_location(
        &self,
        employee: &str,
        target: &Location,
        capability: &str,
        clock: OffsetDateTime,
        through: Option<OffsetDateTime>,
    ) -> bool {
        if !self
            .staff(employee)
            .is_ok_and(|staff| staff.status == "active")
        {
            return false;
        }
        self.authority.grants.iter().any(|grant| {
            grant.employee_id == employee
                && self.authority_grant_live(grant, clock)
                && grant.capabilities.iter().any(|c| c == capability)
                && Self::grant_contains_location(&grant.scope, target)
                && through.is_none_or(|end| {
                    timestamp(&grant.expires_at).is_ok_and(|expires| expires >= end)
                })
        })
    }
    fn authority_job_location(job: &Job) -> Location {
        Location {
            company: Some(job.company_id.clone()),
            office: Some(job.office_id.clone()),
            department: job.department_id.clone(),
            employee: Some(job.employee_id.clone()),
            goal: job.goal_id.clone(),
        }
    }
    fn authority_command_location(
        &self,
        action: &str,
        p: &Value,
        scope: &Scope,
    ) -> Result<Location> {
        if ["pause_job", "resume_job", "cancel_job", "approve_job"].contains(&action) {
            let job = self
                .jobs
                .iter()
                .find(|j| p.get("jobId").and_then(Value::as_str) == Some(&j.id))
                .ok_or_else(|| fail("NOT_FOUND", "Job not found"))?;
            return Ok(Self::authority_job_location(job));
        }
        if action == "enqueue_job" {
            return Ok(Self::authority_job_location(&self.job_from(p)?));
        }
        self.authority_location(scope)
    }
    fn authority_dispatch_capabilities(&self, action: &str, p: &Value) -> Vec<String> {
        let mut settings = Vec::new();
        settings.push(p);
        if let Some(value) = p.get("runSettings") {
            settings.push(value);
        }
        if let Some(value) = p.get("jobTemplate") {
            settings.push(value);
        }
        let mut capabilities = Vec::new();
        for value in settings {
            if value.get("mode").and_then(Value::as_str) == Some("provider") {
                capabilities.push("provider.run".into());
            }
            if let Some(tools) = value.get("allowedTools").and_then(Value::as_array) {
                capabilities.extend(tools.iter().filter_map(Value::as_str).map(str::to_owned));
            }
        }
        if ["execute_goal", "resume_goal"].contains(&action) {
            if let Some(goal) = self
                .goals
                .iter()
                .find(|g| p.get("goalId").and_then(Value::as_str) == Some(&g.id))
            {
                if goal.run_settings.mode == "provider" {
                    capabilities.push("provider.run".into());
                }
                capabilities.extend(goal.run_settings.allowed_tools.clone());
            }
        }
        if ["approve_job", "resume_job"].contains(&action) {
            if let Some(job) = self
                .jobs
                .iter()
                .find(|j| p.get("jobId").and_then(Value::as_str) == Some(&j.id))
            {
                if job.mode == "provider" {
                    capabilities.push("provider.run".into());
                }
                capabilities.extend(job.allowed_tools.clone());
            }
        }
        if action == "resume_schedule" {
            if let Some(schedule) = self
                .schedules
                .iter()
                .find(|s| p.get("scheduleId").and_then(Value::as_str) == Some(&s.id))
            {
                capabilities.extend(
                    self.authority_dispatch_capabilities(
                        "schedule-template",
                        &schedule.job_template,
                    ),
                );
            }
        }
        capabilities.sort();
        capabilities.dedup();
        capabilities
    }
    pub(super) fn authority_allows_dispatch(
        &self,
        job: &Job,
        clock: OffsetDateTime,
    ) -> std::result::Result<(), String> {
        if !self
            .authority
            .managed_employee_ids
            .contains(&job.employee_id)
        {
            return Ok(());
        }
        let target = Location {
            company: Some(job.company_id.clone()),
            office: Some(job.office_id.clone()),
            department: job.department_id.clone(),
            employee: Some(job.employee_id.clone()),
            goal: job.goal_id.clone(),
        };
        for capability in required_worker_capabilities(job) {
            if !self.authority.grants.iter().any(|grant| {
                grant.employee_id == job.employee_id
                    && self.authority_grant_live(grant, clock)
                    && grant.capabilities.iter().any(|c| c == capability)
                    && Self::grant_contains_location(&grant.scope, &target)
            }) {
                return Err(format!("Timeboxed authority is missing, expired, revoked or outside this job scope: {capability}"));
            }
        }
        Ok(())
    }
    fn authority_ledger(
        &mut self,
        actor: &str,
        action: &str,
        target: &str,
        scope: Option<Scope>,
        summary: String,
        grant: Option<String>,
    ) -> Result<()> {
        if self.authority.ledger.len() >= MAX_LEDGER {
            return Err(fail("CAPACITY", "Authority ledger is full; export/archive through a reviewed migration. History was retained."));
        }
        self.authority.ledger.push(AuthorityLedgerEntry {
            id: id("authority-event"),
            at: now(),
            actor: actor.into(),
            action: action.into(),
            target_id: target.into(),
            scope,
            summary,
            grant_id: grant,
            outcome: "applied".into(),
        });
        Ok(())
    }
    pub(super) fn authority_audits_owner_action(action: &str) -> bool {
        ![
            "apply_employee_command",
            "apply_remote_command",
            "grant_authority",
            "promote_employee",
            "revoke_authority",
            "set_authority_enforcement",
            "rebuild_office_index",
            "claim_job",
            "reserve_job",
            "finish_job",
            "complete_job",
            "heartbeat_job",
            "get_cache",
            "put_cache",
            "tick_schedules",
            "tick_goals",
            "reserve_external",
            "settle_external",
            "post_assistant_message",
            "record_github_activity",
            "import_cloud_message",
            "check_worker_authority",
        ]
        .contains(&action)
    }
    pub(super) fn authority_prepare_owner_action(&self) -> Result<()> {
        if self.authority.ledger.len() >= MAX_LEDGER {
            Err(fail(
                "CAPACITY",
                "Authority ledger is full; existing history was retained",
            ))
        } else {
            Ok(())
        }
    }
    pub(super) fn authority_record_owner_action(&mut self, action: &str, p: &Value) -> Result<()> {
        let scope = self
            .command_authority_requirement(action, p)
            .ok()
            .map(|(_, scope)| scope);
        let target = scope
            .as_ref()
            .map(|s| s.id.clone())
            .or_else(|| {
                self.last_action.as_ref().and_then(|r| {
                    [
                        "companyId",
                        "officeId",
                        "departmentId",
                        "employeeId",
                        "goalId",
                        "jobId",
                        "panelId",
                        "roadmapItemId",
                    ]
                    .iter()
                    .find_map(|key| r.get(key).and_then(Value::as_str).map(str::to_owned))
                })
            })
            .unwrap_or_else(|| "workspace".into());
        self.authority_ledger(
            "owner",
            action,
            &target,
            scope,
            format!(
                "Owner applied {action}; existing budgets and adapter boundaries remain in force."
            ),
            None,
        )
    }
    fn scoped_payload(&self, p: &Value) -> Result<Scope> {
        for (key, kind) in [
            ("departmentId", "department"),
            ("officeId", "office"),
            ("companyId", "company"),
        ] {
            if let Some(value) = p.get(key).and_then(Value::as_str) {
                let scope = Scope {
                    kind: kind.into(),
                    id: value.into(),
                };
                self.authority_location(&scope)?;
                return Ok(scope);
            }
        }
        Err(fail(
            "INVALID_INPUT",
            "A delegated command needs an explicit valid scope",
        ))
    }
    fn command_authority_requirement(
        &self,
        action: &str,
        p: &Value,
    ) -> Result<(&'static str, Scope)> {
        let scope = |kind: &str, key: &str| -> Result<Scope> {
            let s = Scope {
                kind: kind.into(),
                id: string(p, key, 100)?,
            };
            self.authority_location(&s)?;
            Ok(s)
        };
        match action {
            "rename_company" | "create_office" | "pause_company" | "resume_company"
            | "set_company_parent" => Ok(("team.manage", scope("company", "companyId")?)),
            "create_department" | "pause_office" | "resume_office" | "rename_office" => {
                Ok(("team.manage", scope("office", "officeId")?))
            }
            "pause_department" | "resume_department" | "set_department_parent" | "rename_department" => {
                Ok(("team.manage", scope("department", "departmentId")?))
            }
            "hire_employee" => Ok(("team.manage", self.scoped_payload(p)?)),
            "pause_employee" | "resume_employee" | "fire_employee" | "update_employee" => {
                Ok(("team.manage", scope("employee", "employeeId")?))
            }
            "enqueue_job" => {
                let job = self.job_from(p)?;
                Ok((
                    "work.manage",
                    Scope {
                        kind: if job.department_id.is_some() {
                            "department"
                        } else {
                            "office"
                        }
                        .into(),
                        id: job
                            .department_id
                            .clone()
                            .unwrap_or_else(|| job.office_id.clone()),
                    },
                ))
            }
            "pause_job" | "resume_job" | "cancel_job" | "approve_job" => {
                let j = self
                    .jobs
                    .iter()
                    .find(|j| p.get("jobId").and_then(Value::as_str) == Some(&j.id))
                    .ok_or_else(|| fail("NOT_FOUND", "Job not found"))?;
                Ok((
                    "work.manage",
                    j.goal_id
                        .as_ref()
                        .map(|g| Scope {
                            kind: "goal".into(),
                            id: g.clone(),
                        })
                        .unwrap_or_else(|| Scope {
                            kind: if j.department_id.is_some() {
                                "department"
                            } else {
                                "office"
                            }
                            .into(),
                            id: j
                                .department_id
                                .clone()
                                .unwrap_or_else(|| j.office_id.clone()),
                        }),
                ))
            }
            "create_schedule" => Ok((
                "work.manage",
                self.scoped_payload(p.get("jobTemplate").unwrap_or(p))?,
            )),
            "pause_schedule" | "resume_schedule" => {
                let s = self
                    .schedules
                    .iter()
                    .find(|s| p.get("scheduleId").and_then(Value::as_str) == Some(&s.id))
                    .ok_or_else(|| fail("NOT_FOUND", "Schedule not found"))?;
                Ok(("work.manage", self.scoped_payload(&s.job_template)?))
            }
            "create_goal" | "post_chat" | "upsert_roadmap_item" => {
                let s: Scope = decode(p.get("scope").unwrap_or(&Value::Null), "scope")?;
                self.authority_location(&s)?;
                Ok((
                    if action == "post_chat" {
                        "knowledge.manage"
                    } else if action == "upsert_roadmap_item" {
                        "roadmap.manage"
                    } else {
                        "work.manage"
                    },
                    s,
                ))
            }
            "plan_goal" | "set_goal_plan" | "execute_goal" | "pause_goal" | "resume_goal"
            | "checkpoint_goal" => Ok(("work.manage", scope("goal", "goalId")?)),
            "convene_panel" => {
                let mut s: Scope = decode(p.get("scope").unwrap_or(&Value::Null), "scope")?;
                if s.kind == "group" {
                    s = scope("company", "companyId")?;
                }
                self.authority_location(&s)?;
                Ok(("work.manage", s))
            }
            "start_panel_round" | "record_panel_decision" | "pause_panel" | "resume_panel" => {
                let panel = self
                    .decision_panels
                    .iter()
                    .find(|s| p.get("panelId").and_then(Value::as_str) == Some(&s.id))
                    .ok_or_else(|| fail("NOT_FOUND", "Panel not found"))?;
                let scope = if panel.scope.kind == "group" {
                    Scope {
                        kind: "company".into(),
                        id: panel.company_id.clone(),
                    }
                } else {
                    panel.scope.clone()
                };
                self.authority_location(&scope)?;
                Ok(("work.manage", scope))
            }
            "add_knowledge" => Ok(("knowledge.manage", scope("company", "companyId")?)),
            "clear_cache" => Ok(("cache.manage", scope("company", "companyId")?)),
            "ensure_blueprint" => Ok(("layout.manage", scope("office", "officeId")?)),
            "save_blueprint" => {
                let s = Scope {
                    kind: "office".into(),
                    id: string(p.get("blueprint").unwrap_or(&Value::Null), "officeId", 100)?,
                };
                self.authority_location(&s)?;
                Ok(("layout.manage", s))
            }
            "upsert_room" | "place_employee" | "upsert_whiteboard" => {
                // The actual mutation resolves officeId. A decoration such as
                // blueprintId must never redirect its authority decision.
                let actual = scope("office", "officeId")?;
                if let Some(blueprint_id) = p.get("blueprintId").and_then(Value::as_str) {
                    if !self
                        .blueprints
                        .iter()
                        .any(|b| b.id == blueprint_id && b.office_id == actual.id)
                    {
                        return Err(fail(
                            "SCOPE_MISMATCH",
                            "Blueprint does not belong to the target office",
                        ));
                    }
                }
                Ok(("layout.manage", actual))
            }
            _ => Err(fail(
                "AUTHORITY_DENIED",
                "This action requires the owner or a dedicated managed adapter",
            )),
        }
    }
    pub(super) fn apply_authority(&mut self, action: &str, p: &Value) -> Result<bool> {
        match action {
            "check_worker_authority" => {
                let job_id = string(p, "jobId", 100)?;
                let lease = string(p, "leaseToken", 100)?;
                let capability = string(p, "capability", 100)?;
                let job = self
                    .jobs
                    .iter()
                    .find(|j| j.id == job_id)
                    .ok_or_else(|| fail("NOT_FOUND", "Job not found"))?;
                if job.status != "running" || job.lease_token.as_deref() != Some(&lease) {
                    return Err(fail(
                        "STALE_LEASE",
                        "Authority check requires the live running worker lease",
                    ));
                }
                if capability != "provider.run" && !job.allowed_tools.contains(&capability)
                    || capability == "provider.run" && job.mode != "provider"
                {
                    return Err(fail(
                        "AUTHORITY_DENIED",
                        "This capability is not assigned to the worker job",
                    ));
                }
                let clock = OffsetDateTime::now_utc();
                let authority = if job.cost_status == "reserved"
                    && job.reservation.is_some() && !job.usage_recorded
                {
                    // Reservation already passed global admission. Rechecking
                    // its own committed spend must not cancel this same call.
                    self.current_worker_authority(job, clock)
                } else {
                    self.eligible(job, clock)
                };
                authority.map_err(|reason| fail("AUTHORITY_DENIED", reason))?;
                self.last_action =
                    Some(json!({"jobId":job_id,"capability":capability,"allowed":true}));
            }
            "grant_authority" | "promote_employee" => {
                if self.authority.grants.len() >= MAX_GRANTS {
                    return Err(fail(
                        "CAPACITY",
                        "Authority grant history is full; no history was evicted",
                    ));
                }
                self.authority_prepare_owner_action()?;
                let employee_id = string(p, "employeeId", 100)?;
                let staff = self.staff(&employee_id)?;
                if staff.status == "fired" {
                    return Err(fail(
                        "INVALID_INPUT",
                        "A fired employee cannot receive authority",
                    ));
                }
                let scope: Scope = decode(p.get("scope").unwrap_or(&Value::Null), "scope")?;
                self.authority_location(&scope)?;
                let preset = string(p, "preset", 20)?;
                let capabilities = match preset.as_str() {
                    "full" => AUTHORITY_CAPABILITIES
                        .iter()
                        .map(|c| (*c).to_owned())
                        .collect::<Vec<_>>(),
                    "partial" => strings(p, "capabilities", AUTHORITY_CAPABILITIES.len())?,
                    _ => {
                        return Err(fail(
                            "INVALID_INPUT",
                            "Authority preset must be full or partial",
                        ))
                    }
                };
                if capabilities.is_empty()
                    || capabilities
                        .iter()
                        .any(|c| !AUTHORITY_CAPABILITIES.contains(&c.as_str()))
                    || capabilities.iter().collect::<HashSet<_>>().len() != capabilities.len()
                {
                    return Err(fail(
                        "INVALID_INPUT",
                        "Choose distinct supported in-app authority capabilities",
                    ));
                }
                let expires_at = string(p, "expiresAt", 64)?;
                let expires = timestamp(&expires_at)?;
                let clock = OffsetDateTime::now_utc();
                if expires <= clock || expires > clock + Duration::days(365) {
                    return Err(fail(
                        "INVALID_INPUT",
                        "Authority expiry must be in the future, within 365 days",
                    ));
                }
                let issuer = opt_string(p, "issuer", 100)?.unwrap_or_else(|| "owner".into());
                let mut parent_grant_ids = Vec::new();
                if issuer != "owner" {
                    if issuer == employee_id {
                        return Err(fail(
                            "AUTHORITY_DENIED",
                            "Employees cannot issue authority to themselves",
                        ));
                    }
                    if issuer != "donna"
                        || !self.authority_has(
                            "donna",
                            &scope,
                            "authority.manage",
                            clock,
                            Some(expires),
                        )?
                    {
                        return Err(fail("AUTHORITY_DENIED","Donna needs active delegation authority covering this scope and the complete grant lifetime"));
                    }
                    for capability in &capabilities {
                        if !self.authority_has("donna", &scope, capability, clock, Some(expires))? {
                            return Err(fail(
                                "AUTHORITY_DENIED",
                                "Donna cannot delegate a capability or lifetime she does not hold",
                            ));
                        }
                    }
                    let target = self.authority_location(&scope)?;
                    for capability in std::iter::once("authority.manage")
                        .chain(capabilities.iter().map(String::as_str))
                    {
                        let parent = self
                            .authority
                            .grants
                            .iter()
                            .find(|grant| {
                                grant.employee_id == "donna"
                                    && self.authority_grant_live(grant, clock)
                                    && grant.capabilities.iter().any(|c| c == capability)
                                    && Self::grant_contains_location(&grant.scope, &target)
                                    && timestamp(&grant.expires_at).is_ok_and(|end| end >= expires)
                            })
                            .ok_or_else(|| {
                                fail(
                                    "AUTHORITY_DENIED",
                                    "Delegation parent could not be retained",
                                )
                            })?;
                        if !parent_grant_ids.contains(&parent.id) {
                            parent_grant_ids.push(parent.id.clone());
                        }
                    }
                }
                let title = if action == "promote_employee" {
                    Some(string(p, "title", 200)?)
                } else {
                    None
                };
                let reason = string(p, "reason", 2000)?;
                let grant_id = id("authority");
                self.authority.grants.push(AuthorityGrant {
                    id: grant_id.clone(),
                    employee_id: employee_id.clone(),
                    scope: scope.clone(),
                    preset,
                    capabilities,
                    grant_type: if action == "promote_employee" {
                        "promotion"
                    } else {
                        "permission"
                    }
                    .into(),
                    title,
                    issuer: issuer.clone(),
                    granted_at: at(clock),
                    expires_at,
                    revoked_at: None,
                    reason: reason.clone(),
                    revoked_by: None,
                    revoke_reason: None,
                    parent_grant_ids,
                });
                if !self.authority.managed_employee_ids.contains(&employee_id) {
                    self.authority
                        .managed_employee_ids
                        .push(employee_id.clone());
                }
                self.authority_ledger(
                    &issuer,
                    action,
                    &employee_id,
                    Some(scope),
                    reason,
                    Some(grant_id.clone()),
                )?;
                self.last_action = Some(
                    json!({"grantId":grant_id,"employeeId":employee_id,"requiresGrants":true}),
                );
            }
            "revoke_authority" => {
                self.authority_prepare_owner_action()?;
                let grant_id = string(p, "grantId", 100)?;
                let index = self
                    .authority
                    .grants
                    .iter()
                    .position(|g| g.id == grant_id)
                    .ok_or_else(|| fail("NOT_FOUND", "Authority grant not found"))?;
                let grant = self.authority.grants[index].clone();
                let issuer = opt_string(p, "issuer", 100)?.unwrap_or_else(|| "owner".into());
                let reason = string(p, "reason", 2000)?;
                if issuer != "owner"
                    && (issuer != "donna"
                        || !self.authority_has(
                            "donna",
                            &grant.scope,
                            "authority.manage",
                            OffsetDateTime::now_utc(),
                            None,
                        )?)
                {
                    return Err(fail(
                        "AUTHORITY_DENIED",
                        "Donna lacks current authority to revoke this scoped grant",
                    ));
                }
                if grant.revoked_at.is_none() {
                    self.authority.grants[index].revoked_at = Some(now());
                    self.authority.grants[index].revoked_by = Some(issuer.clone());
                    self.authority.grants[index].revoke_reason = Some(reason.clone());
                    self.authority_ledger(
                        &issuer,
                        action,
                        &grant.employee_id,
                        Some(grant.scope),
                        reason,
                        Some(grant_id.clone()),
                    )?;
                }
                self.last_action = Some(
                    json!({"grantId":grant_id,"revoked":true,"requiresGrants":self.authority.managed_employee_ids.contains(&grant.employee_id)}),
                );
            }
            "set_authority_enforcement" => {
                self.authority_prepare_owner_action()?;
                if opt_string(p, "issuer", 100)?.is_some_and(|issuer| issuer != "owner") {
                    return Err(fail(
                        "AUTHORITY_DENIED",
                        "Only the owner can change grant enforcement",
                    ));
                }
                let employee_id = string(p, "employeeId", 100)?;
                self.staff(&employee_id)?;
                let required = boolean(p, "requireGrants", true)?;
                let reason = string(p, "reason", 2000)?;
                self.authority
                    .managed_employee_ids
                    .retain(|id| id != &employee_id);
                if required {
                    self.authority
                        .managed_employee_ids
                        .push(employee_id.clone());
                }
                self.authority_ledger(
                    "owner",
                    action,
                    &employee_id,
                    Some(Scope {
                        kind: "employee".into(),
                        id: employee_id.clone(),
                    }),
                    reason,
                    None,
                )?;
                self.last_action =
                    Some(json!({"employeeId":employee_id,"requiresGrants":required}));
            }
            "apply_employee_command" => {
                self.authority_prepare_owner_action()?;
                let employee = string(p, "employeeId", 100)?;
                self.staff(&employee)?;
                let command = p
                    .get("command")
                    .filter(|c| c.is_object())
                    .ok_or_else(|| fail("INVALID_INPUT", "Missing delegated command"))?;
                let name = string(command, "action", 50)?;
                if ["grant_authority", "promote_employee", "revoke_authority"]
                    .contains(&name.as_str())
                {
                    if employee != "donna" {
                        return Err(fail(
                            "AUTHORITY_DENIED",
                            "Authority delegation is managed by Donna or the owner",
                        ));
                    }
                    let mut delegated = command.clone();
                    delegated["issuer"] = json!("donna");
                    self.apply_authority(&name, &delegated)?;
                } else {
                    let (capability, scope) = self.command_authority_requirement(&name, command)?;
                    let clock = OffsetDateTime::now_utc();
                    let location = self.authority_command_location(&name, command, &scope)?;
                    if !self.authority_has_location(&employee, &location, capability, clock, None) {
                        return Err(fail("AUTHORITY_DENIED","Employee authority is missing, expired, revoked or outside this command scope"));
                    }
                    if name == "set_company_parent" {
                        let child = self.company(&scope.id)?;
                        let old_parent = child.parent_company_id.clone();
                        let new_parent = match command.get("parentCompanyId") {
                            Some(Value::Null) => None,
                            Some(Value::String(v)) if safe_id(v) => Some(v.clone()),
                            _ => {
                                return Err(fail(
                                    "INVALID_INPUT",
                                    "Missing or invalid parentCompanyId",
                                ))
                            }
                        };
                        if let Some(parent) = &new_parent {
                            self.company(parent)?;
                        }
                        let mut affected: Vec<String> = Vec::new();
                        for parent in [old_parent, new_parent].into_iter().flatten() {
                            if !affected.contains(&parent) {
                                affected.push(parent);
                            }
                        }
                        for parent in affected {
                            let parent_location = Location {
                                company: Some(parent),
                                ..Location::default()
                            };
                            if !self.authority_has_location(
                                &employee,
                                &parent_location,
                                "team.manage",
                                clock,
                                None,
                            ) {
                                return Err(fail(
                                    "AUTHORITY_DENIED",
                                    "Reparenting also requires current scoped team.manage authority on each affected parent company",
                                ));
                            }
                        }
                    } else if name == "set_department_parent" {
                        let child = self.departments.iter().find(|d| d.id == scope.id)
                            .ok_or_else(|| fail("NOT_FOUND", "Department not found"))?;
                        let old_parent = child.parent_department_id.clone();
                        let new_parent = match command.get("parentDepartmentId") {
                            Some(Value::Null) => None,
                            Some(Value::String(v)) if safe_id(v) => Some(v.clone()),
                            _ => return Err(fail("INVALID_INPUT", "Missing or invalid parentDepartmentId")),
                        };
                        if let Some(parent_id) = &new_parent {
                            let parent = self.departments.iter().find(|d| &d.id == parent_id)
                                .ok_or_else(|| fail("NOT_FOUND", "Parent department not found"))?;
                            if parent.company_id != child.company_id || parent.office_id != child.office_id {
                                return Err(fail("SCOPE_MISMATCH", "Parent department must belong to the same company and office"));
                            }
                        }
                        let mut affected = HashSet::new();
                        for parent in [old_parent, new_parent].into_iter().flatten() {
                            if !affected.insert(parent.clone()) { continue; }
                            let parent_location = self.authority_location(&Scope { kind: "department".into(), id: parent })?;
                            if !self.authority_has_location(&employee, &parent_location, "team.manage", clock, None) {
                                return Err(fail("AUTHORITY_DENIED", "Reparenting also requires current scoped team.manage authority on each affected parent department"));
                            }
                        }
                    }
                    for extra in self.authority_dispatch_capabilities(&name, command) {
                        if !self.authority_has_location(&employee, &location, &extra, clock, None) {
                            return Err(fail(
                                "AUTHORITY_DENIED",
                                format!("This operation also requires scoped {extra} authority"),
                            ));
                        }
                    }
                    let mut candidate = self.clone();
                    candidate.apply_inner(command)?;
                    candidate.authority_ledger(&employee,&name,&scope.id,Some(scope.clone()),format!("Employee applied {name} within a live scoped grant; adapter and budget checks remain required."),None)?;
                    candidate.validate()?;
                    *self = candidate;
                }
            }
            "rebuild_office_index" => {
                self.refresh_authority_index()?;
                self.last_action =
                    Some(json!({"indexEntries":self.authority.index.len(),"rebuilt":true}));
            }
            _ => return Ok(false),
        }
        Ok(true)
    }

    pub fn refresh_authority_index(&mut self) -> Result<bool> {
        let mut entries = Vec::new();
        let mut add = |kind: &str,
                       entity: &str,
                       title: &str,
                       company: Option<&str>,
                       parent: Option<&str>,
                       owner: Option<&str>,
                       status: &str,
                       stamp: &str,
                       related: Vec<String>| {
            entries.push(OfficeIndexEntry {
                id: format!("{kind}:{entity}"),
                entity_id: entity.into(),
                kind: kind.into(),
                title: title.chars().take(300).collect(),
                company_id: company.map(str::to_owned),
                parent_id: parent.map(str::to_owned),
                owner_employee_id: owner.map(str::to_owned),
                status: status.into(),
                updated_at: stamp.into(),
                related_ids: related,
            });
        };
        for c in &self.companies {
            add(
                "company",
                &c.id,
                &c.name,
                Some(&c.id),
                c.parent_company_id.as_deref().filter(|p| *p != c.id),
                Some(&c.assistant_id),
                &c.status,
                &c.created_at,
                vec![],
            );
        }
        for o in &self.offices {
            add(
                "office",
                &o.id,
                &o.name,
                Some(&o.company_id),
                Some(&o.company_id),
                Some(&o.assistant_id),
                &o.status,
                &o.created_at,
                vec![],
            );
        }
        for d in &self.departments {
            add(
                "department",
                &d.id,
                &d.name,
                Some(&d.company_id),
                d.parent_department_id.as_deref().filter(|p| *p != d.id).or(Some(d.office_id.as_str())),
                Some(&d.assistant_id),
                &d.status,
                &d.created_at,
                vec![],
            );
        }
        for e in &self.employees {
            add(
                "employee",
                &e.id,
                &format!("{} · {}", e.name, e.role),
                e.company_id.as_deref(),
                e.department_id
                    .as_deref()
                    .or(e.office_id.as_deref())
                    .or(e.company_id.as_deref()),
                Some(&e.id),
                &e.status,
                &e.updated_at,
                e.skill_paths.clone(),
            );
        }
        for g in &self.goals {
            add(
                "goal",
                &g.id,
                &g.title,
                Some(&g.company_id),
                Some(&g.scope.id),
                if g.scope.kind == "employee" {
                    Some(&g.scope.id)
                } else {
                    None
                },
                &g.status,
                &g.updated_at,
                g.job_ids.clone(),
            );
        }
        for j in &self.jobs {
            add(
                "job",
                &j.id,
                &j.goal,
                Some(&j.company_id),
                j.goal_id
                    .as_deref()
                    .or(j.department_id.as_deref())
                    .or(Some(&j.office_id)),
                Some(&j.employee_id),
                &j.status,
                &j.updated_at,
                j.dependencies.clone(),
            );
            if j.artifact_uri.is_some() {
                add(
                    "artifact",
                    &j.id,
                    &format!("Saved artifact · {}", j.goal),
                    Some(&j.company_id),
                    Some(&j.id),
                    Some(&j.employee_id),
                    &j.status,
                    &j.updated_at,
                    vec![j.id.clone()],
                );
            }
        }
        for k in &self.knowledge {
            add(
                "knowledge",
                &k.id,
                &k.title,
                Some(&k.company_id),
                Some(&k.company_id),
                None,
                "saved",
                &k.created_at,
                vec![],
            );
        }
        for r in &self.portfolio.roadmap {
            let location = self.authority_location(&r.scope).ok();
            add(
                "roadmap",
                &r.id,
                &r.title,
                location.as_ref().and_then(|l| l.company.as_deref()),
                Some(&r.scope.id),
                Some(&r.owner_employee_id),
                &r.status,
                &r.updated_at,
                r.dependencies.clone(),
            );
        }
        for event in &self.events {
            add(
                "operation",
                &event.id,
                &format!("{} · {}", event.action, event.summary),
                None,
                Some(&event.entity_id),
                if event.actor == "owner" {
                    None
                } else {
                    Some(&event.actor)
                },
                "recorded",
                &event.at,
                vec![event.entity_id.clone()],
            );
        }
        for g in &self.authority.grants {
            let location = self.authority_location(&g.scope)?;
            add(
                "authority",
                &g.id,
                g.title.as_deref().unwrap_or("Timeboxed permission"),
                location.company.as_deref(),
                Some(&g.scope.id),
                Some(&g.employee_id),
                if g.revoked_at.is_some() {
                    "revoked"
                } else {
                    "timeboxed"
                },
                g.revoked_at.as_deref().unwrap_or(&g.granted_at),
                g.capabilities.clone(),
            );
        }
        for event in &self.authority.ledger {
            let location = event
                .scope
                .as_ref()
                .and_then(|s| self.authority_location(s).ok());
            add(
                "operation",
                &event.id,
                &format!("{} · {}", event.action, event.summary),
                location.as_ref().and_then(|l| l.company.as_deref()),
                Some(&event.target_id),
                if event.actor == "owner" {
                    None
                } else {
                    Some(&event.actor)
                },
                &event.outcome,
                &event.at,
                event.grant_id.iter().cloned().collect(),
            );
        }
        if entries.len() > MAX_INDEX {
            return Err(fail(
                "CAPACITY",
                "Office index capacity reached; source records were retained",
            ));
        }
        entries.sort_by(|a, b| a.id.cmp(&b.id));
        if entries == self.authority.index {
            return Ok(false);
        }
        self.authority.index = entries;
        Ok(true)
    }
    pub(super) fn validate_authority(&self) -> Result<()> {
        let authority = &self.authority;
        if authority.schema_version != 1
            || authority.grants.len() > MAX_GRANTS
            || authority.ledger.len() > MAX_LEDGER
            || authority.index.len() > MAX_INDEX
            || authority
                .managed_employee_ids
                .iter()
                .collect::<HashSet<_>>()
                .len()
                != authority.managed_employee_ids.len()
        {
            return Err(fail(
                "OFFICE_STATE_INVALID",
                "Authority registry version or bounds are invalid",
            ));
        }
        for employee in &authority.managed_employee_ids {
            self.staff(employee)?;
        }
        let mut grant_ids = HashSet::new();
        for grant in &authority.grants {
            self.staff(&grant.employee_id)?;
            self.authority_location(&grant.scope)?;
            if !safe_id(&grant.id)
                || !grant_ids.insert(&grant.id)
                || !["full", "partial"].contains(&grant.preset.as_str())
                || !["permission", "promotion"].contains(&grant.grant_type.as_str())
                || !["owner", "donna"].contains(&grant.issuer.as_str())
                || grant.capabilities.is_empty()
                || grant
                    .capabilities
                    .iter()
                    .any(|c| !AUTHORITY_CAPABILITIES.contains(&c.as_str()))
                || grant.capabilities.iter().collect::<HashSet<_>>().len()
                    != grant.capabilities.len()
            {
                return Err(fail("OFFICE_STATE_INVALID", "Invalid authority grant"));
            }
            if timestamp(&grant.expires_at)? <= timestamp(&grant.granted_at)? {
                return Err(fail(
                    "OFFICE_STATE_INVALID",
                    "Authority grant has an invalid lifetime",
                ));
            }
            if grant.issuer == "owner" && !grant.parent_grant_ids.is_empty()
                || grant.issuer == "donna"
                    && (grant.employee_id == "donna" || grant.parent_grant_ids.is_empty())
                || grant.parent_grant_ids.len() > AUTHORITY_CAPABILITIES.len() + 1
                || grant.parent_grant_ids.iter().collect::<HashSet<_>>().len()
                    != grant.parent_grant_ids.len()
            {
                return Err(fail(
                    "OFFICE_STATE_INVALID",
                    "Invalid authority delegation chain",
                ));
            }
            let target = self.authority_location(&grant.scope)?;
            for parent_id in &grant.parent_grant_ids {
                let parent = authority
                    .grants
                    .iter()
                    .find(|p| &p.id == parent_id)
                    .ok_or_else(|| fail("OFFICE_STATE_INVALID", "Missing authority parent"))?;
                if parent.id == grant.id
                    || parent.issuer != "owner"
                    || parent.employee_id != "donna"
                    || !parent.parent_grant_ids.is_empty()
                    || !Self::grant_contains_location(&parent.scope, &target)
                    || timestamp(&parent.expires_at)? < timestamp(&grant.expires_at)?
                {
                    return Err(fail(
                        "OFFICE_STATE_INVALID",
                        "Authority parent scope or lifetime does not cover its child",
                    ));
                }
            }
            if grant.issuer == "donna" {
                for capability in std::iter::once("authority.manage")
                    .chain(grant.capabilities.iter().map(String::as_str))
                {
                    if !grant.parent_grant_ids.iter().any(|id| {
                        authority.grants.iter().any(|parent| {
                            &parent.id == id && parent.capabilities.iter().any(|c| c == capability)
                        })
                    }) {
                        return Err(fail(
                            "OFFICE_STATE_INVALID",
                            "Delegated authority exceeds parent capabilities",
                        ));
                    }
                }
            }
            bounded_text(&grant.reason, 2000, "authority reason")?;
            if let Some(title) = &grant.title {
                bounded_text(title, 200, "promotion title")?;
            }
            if (grant.grant_type == "promotion") != grant.title.is_some() {
                return Err(fail(
                    "OFFICE_STATE_INVALID",
                    "Promotion title and authority type disagree",
                ));
            }
            if let Some(stamp) = &grant.revoked_at {
                timestamp(stamp)?;
                if grant.revoked_by.is_none() || grant.revoke_reason.is_none() {
                    return Err(fail(
                        "OFFICE_STATE_INVALID",
                        "Revocation audit is incomplete",
                    ));
                }
            }
        }
        let mut ledger_ids = HashSet::new();
        for event in &authority.ledger {
            if !safe_id(&event.id)
                || !ledger_ids.insert(&event.id)
                || !["applied", "denied"].contains(&event.outcome.as_str())
            {
                return Err(fail("OFFICE_STATE_INVALID", "Invalid authority ledger"));
            }
            timestamp(&event.at)?;
            bounded_text(&event.summary, 2500, "authority summary")?;
            if let Some(scope) = &event.scope {
                self.authority_location(scope)?;
            }
            if event
                .grant_id
                .as_ref()
                .is_some_and(|g| !authority.grants.iter().any(|item| &item.id == g))
            {
                return Err(fail(
                    "OFFICE_STATE_INVALID",
                    "Authority ledger references a missing grant",
                ));
            }
        }
        Ok(())
    }
}
