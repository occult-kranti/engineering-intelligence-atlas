//! Durable company hierarchy and bounded work queue. Definitions are not processes.
//! Only trusted adapters perform network/model calls. This module never does.
use super::{bounded_text, fail, now, safe_id, safe_relative, Company, Employee, Result};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet, VecDeque};
use time::{format_description::well_known::Rfc3339, Duration, OffsetDateTime};
use uuid::Uuid;
#[path = "company_hierarchy.rs"]
mod company_hierarchy;
#[path = "department_hierarchy.rs"]
mod department_hierarchy;
#[path = "governance.rs"]
mod governance;
pub use governance::*;
#[path = "portfolio.rs"]
mod portfolio;
pub use portfolio::*;
#[path = "decision_panels.rs"]
mod decision_panels;
pub use decision_panels::*;
#[path = "remote_commands.rs"]
mod remote_commands;
pub use remote_commands::*;
#[path = "authority.rs"]
mod authority;
pub use authority::*;
#[path = "improvements.rs"]
mod improvements;
pub use improvements::*;

fn id(prefix: &str) -> String {
    format!("{prefix}-{}", Uuid::new_v4())
}
fn timestamp(value: &str) -> Result<OffsetDateTime> {
    OffsetDateTime::parse(value, &Rfc3339)
        .map_err(|_| fail("INVALID_INPUT", "Expected an RFC3339 timestamp"))
}
fn at(value: OffsetDateTime) -> String {
    value.format(&Rfc3339).unwrap_or_default()
}
fn string(p: &Value, key: &str, max: usize) -> Result<String> {
    let v = p
        .get(key)
        .and_then(Value::as_str)
        .ok_or_else(|| fail("INVALID_INPUT", format!("Missing {key}")))?;
    bounded_text(v, max, key)?;
    Ok(v.into())
}
fn opt_string(p: &Value, key: &str, max: usize) -> Result<Option<String>> {
    match p.get(key) {
        None | Some(Value::Null) => Ok(None),
        Some(Value::String(v)) => {
            bounded_text(v, max, key)?;
            Ok(Some(v.clone()))
        }
        _ => Err(fail("INVALID_INPUT", format!("Invalid {key}"))),
    }
}
fn number(p: &Value, key: &str, min: f64, max: f64) -> Result<f64> {
    let v = p
        .get(key)
        .and_then(Value::as_f64)
        .ok_or_else(|| fail("INVALID_INPUT", format!("Missing numeric {key}")))?;
    if !v.is_finite() || v < min || v > max {
        return Err(fail("INVALID_INPUT", format!("{key} is out of range")));
    }
    Ok(v)
}
fn integer(p: &Value, key: &str, min: u64, max: u64) -> Result<u64> {
    let v = p
        .get(key)
        .and_then(Value::as_u64)
        .ok_or_else(|| fail("INVALID_INPUT", format!("Missing integer {key}")))?;
    if v < min || v > max {
        return Err(fail("INVALID_INPUT", format!("{key} is out of range")));
    }
    Ok(v)
}
fn strings(p: &Value, key: &str, max: usize) -> Result<Vec<String>> {
    match p.get(key) {
        None | Some(Value::Null) => Ok(vec![]),
        Some(Value::Array(a)) if a.len() <= max => a
            .iter()
            .map(|v| {
                let s = v
                    .as_str()
                    .ok_or_else(|| fail("INVALID_INPUT", format!("Invalid {key}")))?;
                bounded_text(s, 300, key)?;
                Ok(s.into())
            })
            .collect(),
        _ => Err(fail("INVALID_INPUT", format!("Invalid {key}"))),
    }
}
fn boolean(p: &Value, key: &str, default: bool) -> Result<bool> {
    match p.get(key) {
        None => Ok(default),
        Some(Value::Bool(v)) => Ok(*v),
        _ => Err(fail("INVALID_INPUT", format!("Invalid {key}"))),
    }
}
fn next_revision(p: &Value, previous: Option<u64>) -> Result<u64> {
    match previous {
        Some(revision) => {
            let expected = p.get("expectedRevision").and_then(Value::as_u64)
                .ok_or_else(|| fail("REVISION_REQUIRED", "Updating this saved entity requires its draft-base expectedRevision"))?;
            if expected != revision { return Err(fail("STALE_REVISION", "This entity changed after the draft was opened; reload and reconcile the saved revision")); }
            revision.checked_add(1).filter(|r| *r <= 9_007_199_254_740_991)
                .ok_or_else(|| fail("CAPACITY", "Entity revision capacity reached"))
        }
        None => {
            if p.get("expectedRevision").is_some_and(|v| v.as_u64() != Some(0)) { return Err(fail("STALE_REVISION", "A new entity starts at revision zero")); }
            Ok(0)
        }
    }
}
fn canonical_repo(raw: &str) -> Result<String> {
    let rest = raw
        .trim_end_matches('/')
        .strip_prefix("https://github.com/")
        .ok_or_else(|| {
            fail(
                "INVALID_INPUT",
                "Repository must use https://github.com/owner/repo",
            )
        })?;
    let parts: Vec<_> = rest.split('/').collect();
    if parts.len() != 2 || !parts.iter().all(|x| safe_id(x)) {
        return Err(fail("INVALID_INPUT", "Invalid repository URL"));
    }
    Ok(format!("https://github.com/{}/{}", parts[0], parts[1]))
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OfficeCompany {
    pub id: String,
    pub name: String,
    pub repo_url: Option<String>,
    pub status: String,
    pub assistant_id: String,
    pub created_at: String,
    pub source: String,
    pub imported_at: Option<String>,
    pub github_status: String,
    #[serde(default)]
    pub visibility: Option<String>,
    #[serde(default)]
    pub default_branch: Option<String>,
    #[serde(default)]
    pub parent_company_id: Option<String>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Office {
    pub id: String,
    pub company_id: String,
    pub name: String,
    pub status: String,
    pub assistant_id: String,
    pub created_at: String,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Department {
    pub id: String,
    pub company_id: String,
    pub office_id: String,
    pub name: String,
    pub status: String,
    pub assistant_id: String,
    pub created_at: String,
    #[serde(default)]
    pub parent_department_id: Option<String>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Staff {
    pub id: String,
    pub company_id: Option<String>,
    pub office_id: Option<String>,
    pub department_id: Option<String>,
    pub name: String,
    pub role: String,
    pub kind: String,
    pub status: String,
    pub skill_paths: Vec<String>,
    pub created_at: String,
    pub updated_at: String,
    #[serde(default)]
    pub assignment_key: Option<String>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Limits {
    pub max_tokens: u64,
    pub max_usd: f64,
    pub max_minutes: f64,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Rates {
    pub input_usd_per_million: Option<f64>,
    pub output_usd_per_million: Option<f64>,
}
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Usage {
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub cost_usd: f64,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Reservation {
    pub input_tokens: u64,
    pub max_output_tokens: u64,
    pub cost_usd: f64,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Job {
    pub id: String,
    pub company_id: String,
    pub office_id: String,
    pub department_id: Option<String>,
    pub employee_id: String,
    pub goal: String,
    pub mode: String,
    pub provider: String,
    pub model: String,
    pub authorized: bool,
    pub allowed_tools: Vec<String>,
    pub dependencies: Vec<String>,
    pub context_hash: Option<String>,
    pub cache_key: Option<String>,
    pub prompt_version: String,
    pub status: String,
    pub limits: Limits,
    pub price_rates: Rates,
    pub usage: Usage,
    pub cost_status: String,
    pub reservation: Option<Reservation>,
    #[serde(default)]
    pub pending_reservation: Option<Reservation>,
    #[serde(default)]
    pub improvement_session_id: Option<String>,
    #[serde(default)]
    pub improvement_route: Option<ImprovementRoute>,
    #[serde(default)]
    pub budget_hold_usd: f64,
    pub usage_recorded: bool,
    pub created_at: String,
    pub updated_at: String,
    pub due_at: String,
    pub started_at: Option<String>,
    pub finished_at: Option<String>,
    pub worker_id: Option<String>,
    pub lease_token: Option<String>,
    pub lease_expires_at: Option<String>,
    pub artifact_uri: Option<String>,
    pub summary: Option<String>,
    pub error: Option<String>,
    pub idempotency_key: String,
    #[serde(default)]
    pub goal_id: Option<String>,
    #[serde(default)]
    pub goal_iteration: Option<u64>,
    #[serde(default)]
    pub service_contract_id: Option<String>,
    #[serde(default)]
    pub knowledge_transfer_ids: Vec<String>,
    #[serde(default)]
    pub pair: Option<JobPair>,
    #[serde(default)]
    pub request_sha256: Option<String>,
    #[serde(default)]
    pub artifact_sha256: Option<String>,
    /// Hash of the complete delivered model body, excluding artifact bookkeeping.
    /// The full artifact digest remains the paired-review integrity identity.
    #[serde(default)]
    pub deliverable_sha256: Option<String>,
    #[serde(default)]
    pub review: Option<StepReview>,
    #[serde(default)]
    pub review_failure: Option<ReviewFailure>,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct JobPair {
    pub step_id: String,
    pub phase: String,
    pub peer_employee_id: String,
    pub primary_job_id: String,
    pub review_job_id: String,
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ReviewFailure {
    pub reason: String,
    pub summary: String,
    pub recorded_at: String,
}
fn review_failure_reason(reason: &str) -> bool {
    ["malformed-output", "input-budget", "artifact-mismatch", "recording-unconfirmed"].contains(&reason)
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct StepReview {
    pub verdict: String,
    pub primary_artifact_sha256: String,
    pub review_artifact_sha256: String,
    pub primary_artifact_complete: bool,
    pub summary: String,
    pub evidence_refs: Vec<String>,
    pub recorded_at: String,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Schedule {
    pub id: String,
    pub company_id: String,
    pub name: String,
    pub enabled: bool,
    pub every_minutes: u64,
    pub next_run_at: String,
    pub last_enqueued_at: Option<String>,
    pub job_template: Value,
    #[serde(default)]
    pub last_error: Option<String>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CacheEntry {
    pub key: String,
    pub company_id: String,
    pub artifact_uri: String,
    pub bytes: u64,
    pub created_at: String,
    pub expires_at: String,
    #[serde(default)]
    pub content_sha256: Option<String>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Cache {
    pub enabled: bool,
    pub max_entries: usize,
    pub ttl_minutes: u64,
    pub entries: Vec<CacheEntry>,
    pub hits: u64,
    pub misses: u64,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Knowledge {
    pub id: String,
    pub company_id: String,
    pub title: String,
    pub summary: String,
    pub artifact_uri: String,
    pub created_at: String,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Event {
    pub id: String,
    pub at: String,
    pub actor: String,
    pub action: String,
    pub entity_id: String,
    pub summary: String,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OfficeSnapshot {
    pub schema_version: u32,
    pub active_company_id: String,
    pub companies: Vec<OfficeCompany>,
    pub offices: Vec<Office>,
    pub departments: Vec<Department>,
    pub employees: Vec<Staff>,
    pub jobs: Vec<Job>,
    pub schedules: Vec<Schedule>,
    pub cache: Cache,
    pub knowledge: Vec<Knowledge>,
    pub events: Vec<Event>,
    pub last_action: Option<Value>,
    #[serde(default)]
    pub policy: Policy,
    #[serde(default)]
    pub budget: BudgetSummary,
    #[serde(default)]
    pub external_attempts: Vec<ExternalAttempt>,
    #[serde(default)]
    pub chat_threads: Vec<ChatThread>,
    #[serde(default)]
    pub goals: Vec<Goal>,
    #[serde(default)]
    pub checkpoints: Vec<Checkpoint>,
    #[serde(default)]
    pub blueprints: Vec<Blueprint>,
    #[serde(default)]
    pub portfolio: Portfolio,
    #[serde(default)]
    pub decision_panels: Vec<DecisionPanel>,
    #[serde(default)]
    pub remote_receipts: Vec<RemoteCommandReceipt>,
    #[serde(default)]
    pub authority: OfficeAuthority,
    #[serde(default)]
    pub sticky_notes: Vec<StickyNote>,
    #[serde(default)]
    pub improvement_allowance: Option<ImprovementAllowance>,
    #[serde(default)]
    pub improvement_budget: Option<ImprovementBudget>,
    #[serde(default)]
    pub improvement_sessions: Vec<ImprovementSession>,
    #[serde(default)]
    pub improvement_receipts: Vec<ImprovementReceipt>,
}

impl OfficeSnapshot {
    pub fn validate(&self) -> Result<()> {
        if ![1, 2, 3].contains(&self.schema_version)
            || self.companies.is_empty()
            || self.companies.len() > 2000
            || self.offices.len() > 5000
            || self.departments.len() > 16000
            || self.employees.len() > 30000
            || self.jobs.len() > 5000
            || self.schedules.len() > 1000
            || self.events.len() > 1000
            || self.knowledge.len() > 5000
            || self.cache.entries.len() > 5000
        {
            return Err(fail(
                "OFFICE_STATE_INVALID",
                "Office state version or collection bounds are invalid",
            ));
        }
        let company_ids: HashSet<_> = self.companies.iter().map(|c| c.id.as_str()).collect();
        let office_ids: HashSet<_> = self.offices.iter().map(|o| o.id.as_str()).collect();
        let department_ids: HashSet<_> = self.departments.iter().map(|d| d.id.as_str()).collect();
        let employee_ids: HashSet<_> = self.employees.iter().map(|e| e.id.as_str()).collect();
        if company_ids.len() != self.companies.len()
            || office_ids.len() != self.offices.len()
            || department_ids.len() != self.departments.len()
            || employee_ids.len() != self.employees.len()
            || !employee_ids.contains("donna")
            || !company_ids.contains(self.active_company_id.as_str())
        {
            return Err(fail(
                "OFFICE_STATE_INVALID",
                "Duplicate or missing office identities",
            ));
        }
        for company in &self.companies {
            if !safe_id(&company.id)
                || !["active", "paused"].contains(&company.status.as_str())
                || !employee_ids.contains(company.assistant_id.as_str())
            {
                return Err(fail("OFFICE_STATE_INVALID", "Invalid company definition"));
            }
            if let Some(url) = &company.repo_url {
                canonical_repo(url)?;
            }
            bounded_text(&company.name, 200, "company name")?;
            if company
                .visibility
                .as_ref()
                .is_some_and(|v| !["public", "private"].contains(&v.as_str()))
            {
                return Err(fail(
                    "OFFICE_STATE_INVALID",
                    "Invalid repository visibility",
                ));
            }
            if let Some(branch) = &company.default_branch {
                bounded_text(branch, 250, "default branch")?;
            }
        }
        for office in &self.offices {
            if !company_ids.contains(office.company_id.as_str())
                || !["active", "paused"].contains(&office.status.as_str())
                || !employee_ids.contains(office.assistant_id.as_str())
            {
                return Err(fail("OFFICE_STATE_INVALID", "Invalid office scope"));
            }
        }
        for department in &self.departments {
            if !self
                .offices
                .iter()
                .any(|o| o.id == department.office_id && o.company_id == department.company_id)
                || !["active", "paused"].contains(&department.status.as_str())
                || !employee_ids.contains(department.assistant_id.as_str())
            {
                return Err(fail("OFFICE_STATE_INVALID", "Invalid department scope"));
            }
        }
        for employee in &self.employees {
            if !["assistant", "specialist"].contains(&employee.kind.as_str())
                || !["active", "paused", "fired"].contains(&employee.status.as_str())
                || employee.skill_paths.len() > 20
                || employee.skill_paths.iter().any(|p| !safe_relative(p))
            {
                return Err(fail("OFFICE_STATE_INVALID", "Invalid employee definition"));
            }
            if let Some(company) = &employee.company_id {
                if !company_ids.contains(company.as_str()) {
                    return Err(fail("OFFICE_STATE_INVALID", "Employee company is missing"));
                }
            } else if employee.id != "donna" {
                return Err(fail(
                    "OFFICE_STATE_INVALID",
                    "Only Donna may have global company scope",
                ));
            }
            if let Some(office) = &employee.office_id {
                if !self
                    .offices
                    .iter()
                    .any(|o| &o.id == office && Some(&o.company_id) == employee.company_id.as_ref())
                {
                    return Err(fail(
                        "OFFICE_STATE_INVALID",
                        "Employee office scope is inconsistent",
                    ));
                }
            }
            if let Some(department) = &employee.department_id {
                if !self.departments.iter().any(|d| {
                    &d.id == department
                        && Some(&d.office_id) == employee.office_id.as_ref()
                        && Some(&d.company_id) == employee.company_id.as_ref()
                }) {
                    return Err(fail(
                        "OFFICE_STATE_INVALID",
                        "Employee department scope is inconsistent",
                    ));
                }
            }
        }
        let jobs: HashMap<_, _> = self
            .jobs
            .iter()
            .enumerate()
            .map(|(i, j)| (j.id.as_str(), i))
            .collect();
        if jobs.len() != self.jobs.len() {
            return Err(fail("OFFICE_STATE_INVALID", "Duplicate job identity"));
        }
        let mut indegree = vec![0usize; self.jobs.len()];
        let mut successors = vec![Vec::new(); self.jobs.len()];
        let mut keys = HashSet::new();
        for (i, job) in self.jobs.iter().enumerate() {
            if !safe_id(&job.id)
                || !company_ids.contains(job.company_id.as_str())
                || !self
                    .offices
                    .iter()
                    .any(|o| o.id == job.office_id && o.company_id == job.company_id)
                || !employee_ids.contains(job.employee_id.as_str())
                || job.dependencies.len() > 100
                || !["manual", "provider"].contains(&job.mode.as_str())
                || !["anthropic", "openai", "ollama"].contains(&job.provider.as_str())
                || ![
                    "queued",
                    "waiting-budget",
                    "running",
                    "paused",
                    "cancelled",
                    "completed",
                    "failed",
                    "budget-exhausted",
                    "needs-review",
                ]
                .contains(&job.status.as_str())
                || !keys.insert((job.company_id.as_str(), job.idempotency_key.as_str()))
            {
                return Err(fail(
                    "OFFICE_STATE_INVALID",
                    "Invalid job identity, lifecycle or hierarchy",
                ));
            }
            if job.limits.max_tokens == 0
                || job.limits.max_tokens > 1000000
                || !job.limits.max_usd.is_finite()
                || !(0.0..=1000.0).contains(&job.limits.max_usd)
                || !job.limits.max_minutes.is_finite()
                || !(0.01..=1440.0).contains(&job.limits.max_minutes)
                || !job.usage.cost_usd.is_finite()
                || job.usage.cost_usd < 0.0
            {
                return Err(fail("OFFICE_STATE_INVALID", "Invalid job budget or usage"));
            }
            if !["none", "reserved", "observed", "estimated"].contains(&job.cost_status.as_str()) {
                return Err(fail("OFFICE_STATE_INVALID", "Invalid cost evidence class"));
            }
            bounded_text(&job.goal, 20000, "goal")?;
            timestamp(&job.due_at)?;
            for dependency in &job.dependencies {
                let parent = *jobs
                    .get(dependency.as_str())
                    .ok_or_else(|| fail("OFFICE_STATE_INVALID", "Missing dependency"))?;
                if self.jobs[parent].company_id != job.company_id {
                    return Err(fail("OFFICE_STATE_INVALID", "Cross-company dependency"));
                }
                indegree[i] += 1;
                successors[parent].push(i);
            }
        }
        let mut ready: VecDeque<_> = indegree
            .iter()
            .enumerate()
            .filter_map(|(i, n)| if *n == 0 { Some(i) } else { None })
            .collect();
        let mut visited = 0;
        while let Some(i) = ready.pop_front() {
            visited += 1;
            for child in &successors[i] {
                indegree[*child] -= 1;
                if indegree[*child] == 0 {
                    ready.push_back(*child);
                }
            }
        }
        if visited != self.jobs.len() {
            return Err(fail(
                "OFFICE_STATE_INVALID",
                "Job dependency graph contains a cycle",
            ));
        }
        if self.cache.max_entries == 0
            || self.cache.max_entries > 5000
            || self.cache.ttl_minutes == 0
            || self.cache.ttl_minutes > 10080
        {
            return Err(fail("OFFICE_STATE_INVALID", "Invalid cache bounds"));
        }
        company_hierarchy::validate_company_forest(self)?;
        department_hierarchy::validate_department_forest(self)?;
        self.validate_governance()?;
        self.validate_portfolio()?;
        self.validate_decision_panels()?;
        self.validate_remote_receipts()?;
        self.validate_authority()?;
        self.validate_pairs()?;
        self.validate_improvements()?;
        Ok(())
    }
    pub fn seeded(company: &Company, specialists: &[Employee]) -> Result<Self> {
        let mut state = Self {
            schema_version: 3,
            active_company_id: company.id.clone(),
            companies: vec![],
            offices: vec![],
            departments: vec![],
            employees: vec![],
            jobs: vec![],
            schedules: vec![],
            cache: Cache {
                enabled: true,
                max_entries: 100,
                ttl_minutes: 60,
                entries: vec![],
                hits: 0,
                misses: 0,
            },
            knowledge: vec![],
            events: vec![],
            last_action: None,
            policy: Policy::default(),
            budget: BudgetSummary::default(),
            external_attempts: vec![],
            chat_threads: vec![],
            goals: vec![],
            checkpoints: vec![],
            blueprints: vec![],
            portfolio: Portfolio::default(),
            decision_panels: vec![],
            remote_receipts: vec![],
            authority: OfficeAuthority::default(),
            sticky_notes: vec![], improvement_allowance: None, improvement_budget: None,
            improvement_sessions: vec![], improvement_receipts: vec![],
        };
        let stamp = now();
        state.employees.push(Staff {
            id: "donna".into(),
            company_id: None,
            office_id: None,
            department_id: None,
            name: "Donna".into(),
            role: "CEO assistant".into(),
            kind: "assistant".into(),
            status: "active".into(),
            skill_paths: vec!["skills/agent-research-director/SKILL.md".into()],
            created_at: stamp.clone(),
            updated_at: stamp,
            assignment_key: Some("ceo-assistant".into()),
        });
        let company_id = state.add_company(
            &company.name,
            Some(company.repo_url.clone()),
            Some(company.id.clone()),
            false,
        )?;
        let office = state
            .offices
            .iter()
            .find(|o| o.company_id == company_id)
            .unwrap()
            .id
            .clone();
        for employee in specialists {
            state.add_staff(
                &company_id,
                Some(office.clone()),
                None,
                &employee.name,
                &employee.role,
                "specialist",
                vec![employee.skill_path.clone()],
                Some(format!("staff-{}", employee.id)),
            )?;
        }
        state.bootstrap_directors(&company_id)?;
        state.refresh_budget();
        state.last_action = None;
        state.events.clear();
        state.refresh_authority_index()?;
        Ok(state)
    }
    fn log(&mut self, actor: &str, action: &str, entity: &str, summary: String) {
        self.events.push(Event {
            id: id("event"),
            at: now(),
            actor: actor.into(),
            action: action.into(),
            entity_id: entity.into(),
            summary,
        });
        if self.events.len() > 1000 {
            self.events.drain(..self.events.len() - 1000);
        }
    }
    fn company(&self, company_id: &str) -> Result<&OfficeCompany> {
        self.companies
            .iter()
            .find(|c| c.id == company_id)
            .ok_or_else(|| fail("NOT_FOUND", "Company not found"))
    }
    fn office(&self, office_id: &str) -> Result<&Office> {
        self.offices
            .iter()
            .find(|o| o.id == office_id)
            .ok_or_else(|| fail("NOT_FOUND", "Office not found"))
    }
    fn staff(&self, employee_id: &str) -> Result<&Staff> {
        self.employees
            .iter()
            .find(|e| e.id == employee_id)
            .ok_or_else(|| fail("NOT_FOUND", "Employee not found"))
    }
    fn add_staff(
        &mut self,
        company_id: &str,
        office_id: Option<String>,
        department_id: Option<String>,
        name: &str,
        role: &str,
        kind: &str,
        skill_paths: Vec<String>,
        fixed_id: Option<String>,
    ) -> Result<String> {
        self.company(company_id)?;
        bounded_text(name, 150, "employee name")?;
        bounded_text(role, 200, "employee role")?;
        if self.employees.len() >= 30000 {
            return Err(fail("CAPACITY", "Employee registry reached its limit"));
        }
        if let Some(office_id) = &office_id {
            if self.office(office_id)?.company_id != company_id {
                return Err(fail("SCOPE_MISMATCH", "Office belongs to another company"));
            }
        }
        if let Some(department_id) = &department_id {
            let d = self
                .departments
                .iter()
                .find(|d| &d.id == department_id)
                .ok_or_else(|| fail("NOT_FOUND", "Department not found"))?;
            if d.company_id != company_id || Some(&d.office_id) != office_id.as_ref() {
                return Err(fail(
                    "SCOPE_MISMATCH",
                    "Department does not belong to this company and office",
                ));
            }
        }
        if skill_paths.len() > 20
            || skill_paths.iter().any(|p| {
                !safe_relative(p) || !p.starts_with("skills/") || !p.ends_with("/SKILL.md")
            })
        {
            return Err(fail(
                "INVALID_INPUT",
                "Skills must be repository-relative skills/.../SKILL.md references",
            ));
        }
        let employee_id = fixed_id.unwrap_or_else(|| id("employee"));
        if self.employees.iter().any(|e| e.id == employee_id) {
            return Err(fail("DUPLICATE_ID", "Employee id already exists"));
        }
        let stamp = now();
        self.employees.push(Staff {
            id: employee_id.clone(),
            company_id: Some(company_id.into()),
            office_id,
            department_id,
            name: name.into(),
            role: role.into(),
            kind: kind.into(),
            status: "active".into(),
            skill_paths,
            created_at: stamp.clone(),
            updated_at: stamp,
            assignment_key: None,
        });
        Ok(employee_id)
    }
    fn add_company(
        &mut self,
        name: &str,
        repo: Option<String>,
        fixed_id: Option<String>,
        imported: bool,
    ) -> Result<String> {
        bounded_text(name, 200, "company name")?;
        let repo = repo.map(|r| canonical_repo(&r)).transpose()?;
        if let Some(url) = &repo {
            if let Some(existing) = self.companies.iter_mut().find(|c| {
                c.repo_url
                    .as_ref()
                    .is_some_and(|x| x.eq_ignore_ascii_case(url))
            }) {
                if imported {
                    existing.github_status = "metadata-reviewed".into();
                    existing.source = "github-public-api".into();
                    existing.imported_at = Some(now());
                }
                return Ok(existing.id.clone());
            }
        }
        if self.companies.len() >= 2000 {
            return Err(fail("CAPACITY", "Company registry reached 2000 companies"));
        }
        let company_id = fixed_id.unwrap_or_else(|| id("company"));
        if !safe_id(&company_id) || self.companies.iter().any(|c| c.id == company_id) {
            return Err(fail(
                "DUPLICATE_ID",
                "Company id is invalid or already exists",
            ));
        }
        let stamp = now();
        self.companies.push(OfficeCompany {
            id: company_id.clone(),
            name: name.into(),
            repo_url: repo,
            status: "active".into(),
            assistant_id: String::new(),
            created_at: stamp.clone(),
            source: if imported {
                "github-public-api"
            } else {
                "owner"
            }
            .into(),
            imported_at: if imported { Some(stamp) } else { None },
            github_status: if imported {
                "metadata-reviewed"
            } else {
                "unchecked"
            }
            .into(),
            visibility: if imported {
                Some("public".into())
            } else {
                None
            },
            default_branch: None,
            parent_company_id: None,
        });
        let assistant = self.add_staff(
            &company_id,
            None,
            None,
            "Company assistant",
            "Shared company assistant",
            "assistant",
            vec!["skills/agent-research-director/SKILL.md".into()],
            None,
        )?;
        self.companies
            .iter_mut()
            .find(|c| c.id == company_id)
            .unwrap()
            .assistant_id = assistant;
        let office_id = self.add_office(&company_id, "Main office")?;
        self.add_department(&office_id, "Engineering")?;
        self.add_department(&office_id, "Research")?;
        self.log(
            "donna",
            "company-created",
            &company_id,
            format!("Created {name} with a shared company assistant, office and two departments"),
        );
        Ok(company_id)
    }
    fn add_office(&mut self, company_id: &str, name: &str) -> Result<String> {
        self.company(company_id)?;
        bounded_text(name, 150, "office name")?;
        if self.offices.len() >= 5000 {
            return Err(fail("CAPACITY", "Office registry reached its limit"));
        }
        let office_id = id("office");
        self.offices.push(Office {
            id: office_id.clone(),
            company_id: company_id.into(),
            name: name.into(),
            status: "active".into(),
            assistant_id: String::new(),
            created_at: now(),
        });
        let assistant = self.add_staff(
            company_id,
            Some(office_id.clone()),
            None,
            "Office assistant",
            "Shared office assistant",
            "assistant",
            vec!["skills/agent-research-director/SKILL.md".into()],
            None,
        )?;
        self.offices
            .iter_mut()
            .find(|o| o.id == office_id)
            .unwrap()
            .assistant_id = assistant;
        Ok(office_id)
    }
    fn add_department(&mut self, office_id: &str, name: &str) -> Result<String> {
        let company_id = self.office(office_id)?.company_id.clone();
        bounded_text(name, 150, "department name")?;
        if self.departments.len() >= 16000 {
            return Err(fail("CAPACITY", "Department registry reached its limit"));
        }
        let department_id = id("department");
        self.departments.push(Department {
            id: department_id.clone(),
            company_id: company_id.clone(),
            office_id: office_id.into(),
            name: name.into(),
            status: "active".into(),
            assistant_id: String::new(),
            created_at: now(),
            parent_department_id: None,
        });
        let assistant = self.add_staff(
            &company_id,
            Some(office_id.into()),
            Some(department_id.clone()),
            &format!("{name} assistant"),
            "Shared department assistant",
            "assistant",
            vec!["skills/agent-research-director/SKILL.md".into()],
            None,
        )?;
        self.departments
            .iter_mut()
            .find(|d| d.id == department_id)
            .unwrap()
            .assistant_id = assistant;
        Ok(department_id)
    }
    fn job_from(&self, p: &Value) -> Result<Job> {
        let company_id = string(p, "companyId", 100)?;
        let office_id = string(p, "officeId", 100)?;
        let department_id = opt_string(p, "departmentId", 100)?;
        let employee_id = string(p, "employeeId", 100)?;
        self.company(&company_id)?;
        if self.office(&office_id)?.company_id != company_id {
            return Err(fail(
                "SCOPE_MISMATCH",
                "Office belongs to a different company",
            ));
        }
        if let Some(department) = &department_id {
            if !self.departments.iter().any(|d| {
                &d.id == department && d.office_id == office_id && d.company_id == company_id
            }) {
                return Err(fail(
                    "SCOPE_MISMATCH",
                    "Department belongs to a different office",
                ));
            }
        }
        let service_contract_id = opt_string(p, "serviceContractId", 100)?;
        let knowledge_transfer_ids = strings(p, "knowledgeTransferIds", 50)?;
        let allowed_tools = strings(p, "allowedTools", 30)?;
        self.validate_worker_assignment(
            &company_id,
            &office_id,
            department_id.as_deref(),
            &employee_id,
            service_contract_id.as_deref(),
            &allowed_tools,
        )?;
        self.validate_knowledge_access(&company_id, &knowledge_transfer_ids)?;
        let mode = opt_string(p, "mode", 20)?.unwrap_or_else(|| "manual".into());
        let provider = opt_string(p, "provider", 20)?.unwrap_or_else(|| "anthropic".into());
        if !["manual", "provider"].contains(&mode.as_str())
            || !["anthropic", "openai", "ollama"].contains(&provider.as_str())
        {
            return Err(fail("INVALID_INPUT", "Invalid execution mode or provider"));
        }
        let model = match p.get("model") {
            None | Some(Value::Null) => String::new(),
            Some(Value::String(v)) if v.len() <= 200 => v.trim().to_string(),
            _ => return Err(fail("INVALID_INPUT", "Invalid model id")),
        };
        if mode == "provider" && model.is_empty() {
            return Err(fail(
                "INVALID_INPUT",
                "Provider jobs require an explicit model id",
            ));
        }
        let dependencies = strings(p, "dependencies", 100)?;
        let unique: HashSet<_> = dependencies.iter().collect();
        if unique.len() != dependencies.len() {
            return Err(fail("INVALID_INPUT", "Duplicate dependencies"));
        }
        for dep in &dependencies {
            if !self
                .jobs
                .iter()
                .any(|j| &j.id == dep && j.company_id == company_id)
            {
                return Err(fail(
                    "INVALID_DEPENDENCY",
                    "Dependencies must already exist in this company",
                ));
            }
        }
        let context_hash = opt_string(p, "contextHash", 128)?;
        if context_hash
            .as_ref()
            .is_some_and(|h| h.len() != 64 || !h.bytes().all(|c| c.is_ascii_hexdigit()))
        {
            return Err(fail(
                "INVALID_INPUT",
                "contextHash must be a SHA-256 hex digest",
            ));
        }
        let rates = p.get("priceRates").cloned().unwrap_or(Value::Null);
        let rate = |key: &str| -> Result<Option<f64>> {
            match rates.get(key) {
                None | Some(Value::Null) => Ok(None),
                Some(v) => {
                    let n = v
                        .as_f64()
                        .ok_or_else(|| fail("INVALID_INPUT", "Invalid price rate"))?;
                    if !n.is_finite() || !(0.0..=100000.0).contains(&n) {
                        return Err(fail("INVALID_INPUT", "Price rate out of range"));
                    }
                    Ok(Some(n))
                }
            }
        };
        let stamp = now();
        let due_at = opt_string(p, "dueAt", 80)?.unwrap_or_else(|| stamp.clone());
        timestamp(&due_at)?;
        Ok(Job {
            id: id("job"),
            company_id,
            office_id,
            department_id,
            employee_id,
            goal: string(p, "goal", 20000)?,
            mode,
            provider,
            model,
            authorized: boolean(p, "authorized", false)?,
            allowed_tools,
            dependencies,
            context_hash,
            cache_key: opt_string(p, "cacheKey", 200)?,
            prompt_version: opt_string(p, "promptVersion", 100)?.unwrap_or_else(|| "v1".into()),
            status: "queued".into(),
            limits: Limits {
                max_tokens: integer(p, "maxTokens", 1, 1000000)?,
                max_usd: number(p, "maxUsd", 0.0, 1000.0)?,
                max_minutes: number(p, "maxMinutes", 0.01, 1440.0)?,
            },
            price_rates: Rates {
                input_usd_per_million: rate("inputUsdPerMillion")?,
                output_usd_per_million: rate("outputUsdPerMillion")?,
            },
            usage: Usage::default(),
            cost_status: "none".into(),
            reservation: None,
            pending_reservation: None,
            improvement_session_id: None, improvement_route: None, budget_hold_usd: 0.0,
            usage_recorded: false,
            created_at: stamp.clone(),
            updated_at: stamp,
            due_at,
            started_at: None,
            finished_at: None,
            worker_id: None,
            lease_token: None,
            lease_expires_at: None,
            artifact_uri: None,
            summary: None,
            error: None,
            idempotency_key: string(p, "idempotencyKey", 200)?,
            goal_id: None,
            goal_iteration: None,
            service_contract_id,
            knowledge_transfer_ids,
            pair: None,
            request_sha256: None,
            artifact_sha256: None,
            deliverable_sha256: None,
            review: None,
            review_failure: None,
        })
    }
    fn enqueue(&mut self, p: &Value) -> Result<String> {
        self.enqueue_pair(p, None)
    }
    fn enqueue_pair(&mut self, p: &Value, work: Option<(&str, u64, &str)>) -> Result<String> {
        let company_id = string(p, "companyId", 100)?;
        let key = string(p, "idempotencyKey", 200)?;
        let mut semantic = p.clone();
        if let Some(object) = semantic.as_object_mut() { object.remove("action"); }
        let digest = format!("{:x}", Sha256::digest(serde_json::to_vec(&semantic).map_err(|_| fail("INVALID_INPUT", "Invalid job request"))?));
        if let Some(job) = self
            .jobs
            .iter()
            .find(|j| j.company_id == company_id && j.idempotency_key == key)
        {
            if job.request_sha256.as_deref() != Some(&digest) {
                return Err(fail("JOB_IDEMPOTENCY_CONFLICT", "This job key belongs to different or legacy work; inspect the original receipt before a deliberate new request"));
            }
            return Ok(job.id.clone());
        }
        if self.jobs.len() + 2 > 5000 {
            return Err(fail(
                "CAPACITY",
                "Queue history reached 5000 jobs; export/archive before adding more",
            ));
        }
        let mut job = self.job_from(p)?;
        if job.limits.max_tokens < 2 {
            return Err(fail("PAIR_BUDGET", "A paired job requires at least two tokens across its primary and review budgets"));
        }
        let reviewer = opt_string(p, "reviewerEmployeeId", 100)?;
        let reviewer_contract = opt_string(p, "reviewerServiceContractId", 100)?;
        let (reviewer, reviewer_contract) = self.choose_reviewer(&job, reviewer.as_deref(), reviewer_contract.as_deref())?;
        let mut review_payload = p.clone();
        review_payload["employeeId"] = json!(reviewer);
        review_payload["serviceContractId"] = json!(reviewer_contract);
        review_payload["allowedTools"] = json!([]);
        review_payload["dependencies"] = json!([]);
        review_payload["goal"] = json!(format!("Review the primary deliverable for this work. Return only structured JSON with verdict (accepted, revise or blocked), summary and evidenceRefs. Cite concrete evidence; do not claim execution or grant permissions.\n{}", job.goal.chars().scan(0usize, |bytes, c| { *bytes += c.len_utf8(); (*bytes <= 18000).then_some(c) }).collect::<String>()));
        review_payload["idempotencyKey"] = json!(format!("pair-review:{digest}"));
        let mut review = self.job_from(&review_payload)?;
        if self.jobs.iter().any(|j| j.company_id == company_id && j.idempotency_key == review.idempotency_key) {
            return Err(fail("JOB_IDEMPOTENCY_CONFLICT", "The paired review identity is already reserved"));
        }
        let total_tokens = job.limits.max_tokens;
        let primary_tokens = ((total_tokens * 3) / 5).max(1).min(total_tokens - 1);
        job.limits.max_tokens = primary_tokens;
        review.limits.max_tokens = total_tokens - primary_tokens;
        let total_usd = job.limits.max_usd;
        job.limits.max_usd = total_usd * 0.6;
        review.limits.max_usd = total_usd - job.limits.max_usd;
        let step_id = work.map(|(_, _, step)| step.to_owned()).unwrap_or_else(|| job.id.clone());
        job.pair = Some(JobPair { step_id: step_id.clone(), phase: "primary".into(), peer_employee_id: review.employee_id.clone(), primary_job_id: job.id.clone(), review_job_id: review.id.clone() });
        review.pair = Some(JobPair { step_id, phase: "review".into(), peer_employee_id: job.employee_id.clone(), primary_job_id: job.id.clone(), review_job_id: review.id.clone() });
        review.dependencies = vec![job.id.clone()];
        job.request_sha256 = Some(digest.clone());
        review.request_sha256 = Some(format!("{:x}", Sha256::digest(format!("review:{digest}"))));
        if let Some((goal, iteration, _)) = work {
            job.goal_id = Some(goal.into()); job.goal_iteration = Some(iteration);
            review.goal_id = Some(goal.into()); review.goal_iteration = Some(iteration);
        }
        let job_id = job.id.clone();
        self.log(
            "donna",
            "job-enqueued",
            &job_id,
            format!("Queued {} job for {}", job.mode, job.employee_id),
        );
        self.jobs.push(job);
        self.jobs.push(review);
        Ok(job_id)
    }
    fn choose_reviewer(&self, primary: &Job, requested: Option<&str>, contract: Option<&str>) -> Result<(String, Option<String>)> {
        if requested.is_none() && contract.is_some() {
            return Err(fail("PAIR_REQUIRED", "Select the reviewer covered by the explicit review service contract"));
        }
        let validate = |employee: &str, contract: Option<&str>| -> Result<()> {
            if employee == primary.employee_id { return Err(fail("PAIR_REQUIRED", "Primary and reviewer must be different employees")); }
            self.validate_worker_assignment(&primary.company_id, &primary.office_id, primary.department_id.as_deref(), employee, contract, &[])?;
            let mut reviewer = primary.clone(); reviewer.employee_id = employee.into(); reviewer.service_contract_id = contract.map(str::to_owned); reviewer.allowed_tools.clear();
            self.active_worker(&reviewer).map_err(|reason| fail("PAIR_REQUIRED", reason))?;
            self.portfolio_allows_dispatch(&reviewer).map_err(|reason| fail("PAIR_REQUIRED", reason))?;
            self.authority_allows_dispatch(&reviewer, OffsetDateTime::now_utc()).map_err(|reason| fail("PAIR_REQUIRED", reason))?;
            Ok(())
        };
        if let Some(employee) = requested { validate(employee, contract)?; return Ok((employee.into(), contract.map(str::to_owned))); }
        let mut candidates: Vec<_> = self.employees.iter().filter(|e| e.company_id.as_deref() == Some(&primary.company_id) && e.status == "active" && e.id != primary.employee_id).collect();
        candidates.sort_by(|a,b| a.id.cmp(&b.id));
        for employee in candidates { if validate(&employee.id, None).is_ok() { return Ok((employee.id.clone(), None)); } }
        Err(fail("PAIR_REQUIRED", "No distinct authorized reviewer exists in this office/department. Hire or explicitly contract one before dispatch; scope was not widened"))
    }
    fn active_worker(&self, job: &Job) -> std::result::Result<(), String> {
        let employee = self.employees.iter().find(|e| e.id == job.employee_id).ok_or("Employee is unavailable")?;
        if employee.status != "active"
            || self.companies.iter().find(|c| c.id == job.company_id).is_none_or(|c| c.status != "active")
            || self.offices.iter().find(|o| o.id == job.office_id).is_none_or(|o| o.status != "active")
            || job.department_id.as_ref().is_some_and(|id| self.departments.iter().find(|d| &d.id == id).is_none_or(|d| d.status != "active"))
            || employee.company_id.as_ref().is_some_and(|id| self.companies.iter().find(|c| &c.id == id).is_none_or(|c| c.status != "active"))
            || employee.office_id.as_ref().is_some_and(|id| self.offices.iter().find(|o| &o.id == id).is_none_or(|o| o.status != "active"))
            || employee.department_id.as_ref().is_some_and(|id| self.departments.iter().find(|d| &d.id == id).is_none_or(|d| d.status != "active")) {
            return Err("An assigned employee or its hierarchy is paused or unavailable".into());
        }
        Ok(())
    }
    fn pair_allows_dispatch(&self, job: &Job) -> std::result::Result<(), String> {
        let pair = job.pair.as_ref().ok_or("PAIR_REQUIRED: legacy unpaired work cannot start; create an explicitly paired workflow")?;
        let peer_id = if pair.phase == "primary" { &pair.review_job_id } else { &pair.primary_job_id };
        let peer = self.jobs.iter().find(|j| &j.id == peer_id).ok_or("Paired assignment is missing")?;
        if pair.phase == "primary" && (!["queued", "waiting-budget"].contains(&peer.status.as_str()) || peer.review_failure.is_some()) {
            return Err("The assigned reviewer is paused, cancelled, completed, or unavailable for this attempt".into());
        }
        self.active_worker(job)?; self.active_worker(peer)?;
        self.portfolio_allows_dispatch(peer)?;
        self.authority_allows_dispatch(peer, OffsetDateTime::now_utc())?;
        Ok(())
    }
    fn dependency_accepted(&self, job: &Job, parent: &Job) -> bool {
        if parent.status != "completed" { return false; }
        if job.pair.as_ref().is_some_and(|p| p.phase == "review" && p.primary_job_id == parent.id) { return true; }
        let Some(pair) = &parent.pair else { return false; };
        let review = if pair.phase == "review" { Some(parent) } else { self.jobs.iter().find(|j| j.id == pair.review_job_id) };
        review.is_some_and(|j| j.status == "completed" && j.review.as_ref().is_some_and(|r| r.verdict == "accepted"))
    }
    pub(super) fn job_accepted(&self, job: &Job) -> bool {
        let Some(pair) = &job.pair else { return false; };
        self.jobs.iter().find(|j| j.id == pair.review_job_id).is_some_and(|j| j.status == "completed" && j.review.as_ref().is_some_and(|r| r.verdict == "accepted"))
    }
    fn validate_pairs(&self) -> Result<()> {
        let digest = |s: &str| s.len() == 64 && s.bytes().all(|c| c.is_ascii_hexdigit());
        for job in &self.jobs {
            if job.request_sha256.as_ref().is_some_and(|s| !digest(s)) || job.artifact_sha256.as_ref().is_some_and(|s| !digest(s)) || job.deliverable_sha256.as_ref().is_some_and(|s| !digest(s)) { return Err(fail("OFFICE_STATE_INVALID", "Invalid paired artifact, deliverable or request digest")); }
            let Some(pair) = &job.pair else {
                if job.review.is_some() || job.review_failure.is_some() { return Err(fail("OFFICE_STATE_INVALID", "Unpaired job cannot carry a review receipt")); }
                continue;
            };
            let primary = self.jobs.iter().find(|j| j.id == pair.primary_job_id).ok_or_else(|| fail("OFFICE_STATE_INVALID", "Primary job is missing"))?;
            let review = self.jobs.iter().find(|j| j.id == pair.review_job_id).ok_or_else(|| fail("OFFICE_STATE_INVALID", "Review job is missing"))?;
            if !safe_id(&pair.step_id) || !["primary", "review"].contains(&pair.phase.as_str()) || primary.id == review.id || primary.employee_id == review.employee_id
                || primary.company_id != review.company_id || primary.office_id != review.office_id || primary.department_id != review.department_id
                || primary.goal_id != review.goal_id || primary.goal_iteration != review.goal_iteration
                || !review.allowed_tools.is_empty() || review.dependencies != vec![primary.id.clone()]
                || (pair.phase == "primary" && (job.id != primary.id || pair.peer_employee_id != review.employee_id))
                || (pair.phase == "review" && (job.id != review.id || pair.peer_employee_id != primary.employee_id))
                || primary.pair.as_ref().is_none_or(|p| p.phase != "primary" || p.primary_job_id != primary.id || p.review_job_id != review.id || p.step_id != pair.step_id)
                || review.pair.as_ref().is_none_or(|p| p.phase != "review" || p.primary_job_id != primary.id || p.review_job_id != review.id || p.step_id != pair.step_id) {
                return Err(fail("OFFICE_STATE_INVALID", "Invalid paired work identities or scope"));
            }
            if let Some(failure) = &job.review_failure {
                if pair.phase != "review" || job.review.is_some() || !job.usage_recorded || !governance::terminal(&job.status) || !review_failure_reason(&failure.reason) {
                    return Err(fail("OFFICE_STATE_INVALID", "Invalid nonaccepting review failure receipt"));
                }
                bounded_text(&failure.summary, 2000, "review failure summary")?;
                timestamp(&failure.recorded_at)?;
            }
            if let Some(record) = &job.review {
                if pair.phase != "review" || primary.status != "completed" || review.status != "completed"
                    || !["accepted", "revise", "blocked"].contains(&record.verdict.as_str())
                    || !digest(&record.primary_artifact_sha256) || !digest(&record.review_artifact_sha256)
                    || primary.artifact_sha256.as_deref() != Some(&record.primary_artifact_sha256) || review.artifact_sha256.as_deref() != Some(&record.review_artifact_sha256)
                    || primary.artifact_uri.is_none() || review.artifact_uri.is_none()
                    || record.evidence_refs.len() > 20 || (record.verdict == "accepted" && (!record.primary_artifact_complete || record.evidence_refs.is_empty())) {
                    return Err(fail("OFFICE_STATE_INVALID", "Invalid review evidence"));
                }
                bounded_text(&record.summary, 4000, "review summary")?;
                for reference in &record.evidence_refs { bounded_text(reference, 300, "review evidence")?; }
                timestamp(&record.recorded_at)?;
            }
        }
        Ok(())
    }
    fn record_step_review(&mut self, p: &Value) -> Result<()> {
        let job_id = string(p, "jobId", 100)?;
        let lease = string(p, "leaseToken", 100)?;
        let primary_id = string(p, "primaryJobId", 100)?;
        let job = self.jobs.iter().find(|j| j.id == job_id).ok_or_else(|| fail("NOT_FOUND", "Review job not found"))?;
        let pair = job.pair.as_ref().ok_or_else(|| fail("PAIR_REQUIRED", "Review job has no paired assignment"))?;
        if pair.phase != "review" || pair.primary_job_id != primary_id || job.lease_token.as_deref() != Some(&lease) {
            return Err(fail("STALE_LEASE", "Review receipt requires the exact completed reviewer lease and primary job"));
        }
        if job.review_failure.is_some() { return Err(fail("REVIEW_RECEIPT_CONFLICT", "This review attempt already has an immutable failure receipt; create an explicitly authorized repair iteration")); }
        let record = StepReview { verdict: string(p, "verdict", 20)?, primary_artifact_sha256: string(p, "primaryArtifactSha256", 64)?, review_artifact_sha256: string(p, "reviewArtifactSha256", 64)?, primary_artifact_complete: boolean(p, "primaryArtifactComplete", false)?, summary: string(p, "summary", 4000)?, evidence_refs: strings(p, "evidenceRefs", 20)?, recorded_at: job.review.as_ref().map(|r| r.recorded_at.clone()).unwrap_or_else(now) };
        if let Some(previous) = &job.review {
            if previous != &record { return Err(fail("REVIEW_RECEIPT_CONFLICT", "This review attempt already has a different immutable verdict")); }
            self.last_action = Some(json!({"jobId":job_id,"verdict":record.verdict,"replayed":true})); return Ok(());
        }
        let primary = self.jobs.iter().find(|j| j.id == primary_id).ok_or_else(|| fail("NOT_FOUND", "Primary job not found"))?;
        if job.status != "completed" || primary.status != "completed" || !job.usage_recorded || !primary.usage_recorded
            || job.artifact_uri.is_none() || primary.artifact_uri.is_none()
            || primary.artifact_sha256.as_deref() != Some(&record.primary_artifact_sha256) || job.artifact_sha256.as_deref() != Some(&record.review_artifact_sha256)
            || !["accepted", "revise", "blocked"].contains(&record.verdict.as_str())
            || (record.verdict == "accepted" && (!record.primary_artifact_complete || record.evidence_refs.is_empty())) {
            return Err(fail("REVIEW_EVIDENCE_REQUIRED", "Review acceptance requires settled distinct jobs, exact artifact hashes, evidence and complete primary coverage"));
        }
        self.pair_allows_dispatch(job).map_err(|s| fail("REVIEW_AUTHORITY_REVOKED", s))?;
        self.portfolio_allows_dispatch(job).map_err(|s| fail("REVIEW_AUTHORITY_REVOKED", s))?;
        self.authority_allows_dispatch(job, OffsetDateTime::now_utc()).map_err(|s| fail("REVIEW_AUTHORITY_REVOKED", s))?;
        let verdict = record.verdict.clone();
        self.jobs.iter_mut().find(|j| j.id == job_id).unwrap().review = Some(record);
        self.log("worker", "step-review-recorded", &job_id, format!("Recorded independent paired review: {verdict}; execution usage remains unchanged"));
        self.last_action = Some(json!({"jobId":job_id,"verdict":verdict,"replayed":false}));
        Ok(())
    }
    fn record_review_failure(&mut self, p: &Value) -> Result<()> {
        let job_id = string(p, "jobId", 100)?;
        let lease = string(p, "leaseToken", 100)?;
        let reason = string(p, "reason", 40)?;
        if !review_failure_reason(&reason) { return Err(fail("INVALID_INPUT", "Unknown review failure reason")); }
        let job = self.jobs.iter().find(|j| j.id == job_id).ok_or_else(|| fail("NOT_FOUND", "Review job not found"))?;
        if job.pair.as_ref().is_none_or(|pair| pair.phase != "review") || job.lease_token.as_deref() != Some(&lease) {
            return Err(fail("STALE_LEASE", "Review failure requires the exact reviewer job and settled lease"));
        }
        if job.review.is_some() { return Err(fail("REVIEW_RECEIPT_CONFLICT", "A review verdict is already recorded and cannot be overwritten by a failure")); }
        let record = ReviewFailure { reason, summary: opt_string(p, "summary", 2000)?.unwrap_or_else(|| "The managed reviewer could not record a valid independent verdict. Explicit repair is required.".into()), recorded_at: job.review_failure.as_ref().map(|r| r.recorded_at.clone()).unwrap_or_else(now) };
        if let Some(previous) = &job.review_failure {
            if previous != &record { return Err(fail("REVIEW_RECEIPT_CONFLICT", "This review attempt already has a different immutable failure receipt")); }
            self.last_action = Some(json!({"jobId":job_id,"failedReview":true,"reason":record.reason,"replayed":true}));
            return Ok(());
        }
        if !job.usage_recorded || !governance::terminal(&job.status) { return Err(fail("REVIEW_SETTLEMENT_REQUIRED", "Settle the review execution before recording its nonaccepting failure")); }
        // Like usage settlement, a nonaccepting failure may be recorded after
        // revocation. It grants no tools, acceptance, retry, or spending authority.
        let reason = record.reason.clone();
        self.jobs.iter_mut().find(|j| j.id == job_id).unwrap().review_failure = Some(record);
        self.log("worker", "step-review-failed", &job_id, format!("Recorded nonaccepting review failure: {reason}; settled usage and artifacts retained"));
        self.last_action = Some(json!({"jobId":job_id,"failedReview":true,"reason":reason,"replayed":false}));
        Ok(())
    }
    fn eligible(&self, job: &Job, clock: OffsetDateTime) -> std::result::Result<(), String> {
        self.pair_allows_dispatch(job)?;
        self.improvement_allows_dispatch(job, clock)?;
        self.governance_allows_dispatch(job)?;
        self.portfolio_allows_dispatch(job)?;
        self.authority_allows_dispatch(job, clock)?;
        if self
            .companies
            .iter()
            .find(|c| c.id == job.company_id)
            .is_none_or(|c| c.status != "active")
        {
            return Err("Company is paused".into());
        }
        if self
            .offices
            .iter()
            .find(|o| o.id == job.office_id)
            .is_none_or(|o| o.status != "active")
        {
            return Err("Office is paused".into());
        }
        if job.department_id.as_ref().is_some_and(|d| {
            self.departments
                .iter()
                .find(|x| &x.id == d)
                .is_none_or(|x| x.status != "active")
        }) {
            return Err("Department is paused".into());
        }
        if self
            .employees
            .iter()
            .find(|e| e.id == job.employee_id)
            .is_none_or(|e| e.status != "active")
        {
            return Err("Employee is paused or fired".into());
        }
        if job.dependencies.iter().any(|d| {
            self.jobs
                .iter()
                .find(|x| &x.id == d)
                .is_none_or(|x| !self.dependency_accepted(job, x))
        }) {
            return Err("Waiting for accepted dependency reviews".into());
        }
        if timestamp(&job.due_at).map(|t| t > clock).unwrap_or(true) {
            return Err("Scheduled for a later time".into());
        }
        if job.mode == "provider" {
            if !job.authorized && self.policy.approval_mode != "autonomous" {
                return Err("Provider dispatch has not been authorized by the owner".into());
            }
            if job.provider != "ollama"
                && (job.limits.max_usd <= 0.0
                    || job
                        .price_rates
                        .input_usd_per_million
                        .is_none_or(|x| x <= 0.0)
                    || job
                        .price_rates
                        .output_usd_per_million
                        .is_none_or(|x| x <= 0.0))
            {
                return Err(
                    "Cloud jobs require a positive spend cap and verified price rates".into(),
                );
            }
        }
        Ok(())
    }
    pub fn expire_leases(&mut self) -> bool {
        let clock = OffsetDateTime::now_utc();
        let mut expired = vec![];
        let mut estimates = vec![];
        let mut blocked = vec![];
        for job in &mut self.jobs {
            let stale = job
                .lease_expires_at
                .as_ref()
                .is_some_and(|t| timestamp(t).map(|d| d <= clock).unwrap_or(true));
            if stale && job.status == "running" {
                job.status = "needs-review".into();
                job.error=Some("Worker lease expired; inspect the attempt before any retry to avoid duplicate charges".into());
                job.updated_at = now();
                expired.push(job.id.clone());
            }
            if stale
                && ["needs-review", "paused", "cancelled"].contains(&job.status.as_str())
                && job.cost_status == "reserved"
                && job.reservation.is_some()
            {
                job.cost_status = "estimated".into();
                job.error=Some("Unsettled provider reservation retained as an estimate; reconcile with billing before retry".into());
                job.updated_at = now();
                estimates.push(job.id.clone());
            }
        }
        // New jobs can depend only on earlier, immutable jobs. Propagate terminal
        // failures in that order without retrying or silently leaving dependents queued.
        let mut statuses: HashMap<String, String> = self
            .jobs
            .iter()
            .map(|j| (j.id.clone(), j.status.clone()))
            .collect();
        for job in &self.jobs {
            if let Some(pair) = &job.pair {
                if self.jobs.iter().find(|j| j.id == pair.review_job_id).is_some_and(|review|
                    review.review_failure.is_some() || review.review.as_ref().is_some_and(|r| r.verdict != "accepted")
                    || ["failed", "cancelled", "budget-exhausted", "needs-review"].contains(&review.status.as_str())) {
                    statuses.insert(job.id.clone(), "needs-review".into());
                }
            }
        }
        for job in &mut self.jobs {
            if job.status == "queued" || job.status == "waiting-budget" {
                if job.pair.as_ref().is_some_and(|pair| pair.phase == "primary") && statuses.get(&job.id).is_some_and(|status| status == "needs-review") {
                    job.status = "needs-review".into();
                    job.error = Some("The assigned review attempt cannot complete; create an explicitly authorized paired repair".into());
                    job.updated_at = now();
                    blocked.push(job.id.clone());
                    continue;
                }
                if let Some(dependency) = job.dependencies.iter().find(|d| {
                    statuses.get(*d).is_some_and(|s| {
                        ["failed", "cancelled", "budget-exhausted", "needs-review"]
                            .contains(&s.as_str())
                    })
                }) {
                    job.status = "needs-review".into();
                    job.error=Some(format!("Dependency {dependency} did not complete; review the handoff before creating a retry"));
                    job.updated_at = now();
                    statuses.insert(job.id.clone(), job.status.clone());
                    blocked.push(job.id.clone());
                }
            }
        }
        let changed = !expired.is_empty() || !estimates.is_empty() || !blocked.is_empty();
        for job in expired {
            self.log(
                "system",
                "lease-expired",
                &job,
                "Attempt needs review; it was not automatically retried".into(),
            );
        }
        for job in estimates {
            self.log("system","reservation-unsettled",&job,"Unsettled reservation is an estimate requiring billing reconciliation; lifecycle state was preserved".into());
        }
        for job in blocked {
            self.log("system","dependency-needs-review",&job,"A terminal prerequisite blocked this job; no downstream provider call was dispatched".into());
        }
        changed
    }
    pub fn apply(&mut self, p: &Value) -> Result<()> {
        let action = string(p, "action", 50)?;
        let audit = Self::authority_audits_owner_action(&action);
        if audit {
            self.authority_prepare_owner_action()?;
        }
        self.apply_inner(p)?;
        self.schema_version = 3;
        if audit {
            self.authority_record_owner_action(&action, p)?;
        }
        self.refresh_authority_index()?;
        Ok(())
    }
    fn apply_inner(&mut self, p: &Value) -> Result<()> {
        self.last_action = None;
        self.expire_leases();
        let action = string(p, "action", 50)?;
        self.guard_improvement_owned_work(&action, p)?;
        if self.apply_authority(&action, p)? {
            return Ok(());
        }
        if self.apply_remote_command(&action, p)? {
            return Ok(());
        }
        if self.apply_improvements(&action, p)? {
            return Ok(());
        }
        if self.apply_decision_panel(&action, p)? {
            return Ok(());
        }
        if self.apply_governance(&action, p)? {
            return Ok(());
        }
        if self.apply_portfolio(&action, p)? {
            return Ok(());
        }
        match action.as_str() {
            "record_step_review" => { self.record_step_review(p)?; }
            "record_review_failure" => { self.record_review_failure(p)?; }
            "set_company_parent" => {
                self.set_company_parent(p)?;
            }
            "rename_company" => {
                let company_id = string(p, "companyId", 100)?;
                let name = string(p, "name", 200)?;
                self.company(&company_id)?;
                self.companies
                    .iter_mut()
                    .find(|c| c.id == company_id)
                    .unwrap()
                    .name = name;
                self.log(
                    "owner",
                    &action,
                    &company_id,
                    "Renamed the company while preserving repository identity and history".into(),
                );
                self.last_action = Some(json!({"companyId":company_id,"renamed":true}));
            }
            "create_company" => {
                let company_id = self.add_company(
                    &string(p, "name", 200)?,
                    opt_string(p, "repoUrl", 300)?,
                    opt_string(p, "id", 100)?,
                    false,
                )?;
                self.active_company_id = company_id.clone();
                self.bootstrap_directors(&company_id)?;
                self.last_action = Some(json!({"companyId":company_id}));
            }
            "import_repositories" => {
                let rows = p
                    .get("repositories")
                    .and_then(Value::as_array)
                    .ok_or_else(|| fail("INVALID_INPUT", "repositories must be an array"))?;
                if rows.len() > 200 {
                    return Err(fail(
                        "CAPACITY",
                        "Import at most 200 repositories per command",
                    ));
                }
                let mut ids = vec![];
                for row in rows {
                    let name = string(row, "name", 200)?;
                    let repo = string(row, "repoUrl", 300)?;
                    let source = opt_string(row, "source", 50)?
                        .unwrap_or_else(|| "github-public-api".into());
                    if !["github-public-api", "github-authenticated-api"].contains(&source.as_str())
                    {
                        return Err(fail(
                            "INVALID_INPUT",
                            "Unsupported repository metadata source",
                        ));
                    }
                    let visibility =
                        opt_string(row, "visibility", 20)?.unwrap_or_else(|| "public".into());
                    if !["public", "private"].contains(&visibility.as_str())
                        || (visibility == "private" && source != "github-authenticated-api")
                    {
                        return Err(fail(
                            "INVALID_INPUT",
                            "Private repository metadata requires an authenticated source",
                        ));
                    }
                    let default_branch = opt_string(row, "defaultBranch", 250)?;
                    let company_id = self.add_company(&name, Some(repo), None, true)?;
                    let company = self
                        .companies
                        .iter_mut()
                        .find(|c| c.id == company_id)
                        .unwrap();
                    company.source = source;
                    company.visibility = Some(visibility);
                    company.default_branch = default_branch;
                    self.bootstrap_directors(&company_id)?;
                    ids.push(company_id);
                }
                if let Some(first) = ids.first() {
                    self.active_company_id = first.clone();
                }
                self.last_action = Some(json!({"companyIds":ids,"imported":rows.len()}));
            }
            "select_company" => {
                let company_id = string(p, "companyId", 100)?;
                self.company(&company_id)?;
                self.active_company_id = company_id;
            }
            "create_office" => {
                let company_id = string(p, "companyId", 100)?;
                let office_id = self.add_office(&company_id, &string(p, "name", 150)?)?;
                self.log(
                    "donna",
                    &action,
                    &office_id,
                    "Created office with a shared assistant".into(),
                );
                self.last_action = Some(json!({"officeId":office_id}));
            }
            "create_department" => {
                let department_id =
                    self.add_department(&string(p, "officeId", 100)?, &string(p, "name", 150)?)?;
                self.log(
                    "donna",
                    &action,
                    &department_id,
                    "Created department with a shared assistant".into(),
                );
                self.last_action = Some(json!({"departmentId":department_id}));
            }
            "set_department_parent" => self.set_department_parent(p)?,
            "hire_employee" => {
                let employee_id = self.add_staff(
                    &string(p, "companyId", 100)?,
                    opt_string(p, "officeId", 100)?,
                    opt_string(p, "departmentId", 100)?,
                    &string(p, "name", 150)?,
                    &string(p, "role", 200)?,
                    "specialist",
                    strings(p, "skillPaths", 20)?,
                    None,
                )?;
                self.log(
                    "donna",
                    &action,
                    &employee_id,
                    "Created a persistent employee definition; no model process was started".into(),
                );
                self.last_action = Some(json!({"employeeId":employee_id}));
            }
            "pause_employee" | "resume_employee" | "fire_employee" => {
                let employee_id = string(p, "employeeId", 100)?;
                let employee = self
                    .employees
                    .iter_mut()
                    .find(|e| e.id == employee_id)
                    .ok_or_else(|| fail("NOT_FOUND", "Employee not found"))?;
                if employee.id == "donna" && action == "fire_employee" {
                    return Err(fail(
                        "PERMANENT_ASSISTANT",
                        "Donna is a permanent assistant; pause her instead",
                    ));
                }
                if employee.kind == "assistant" && action == "fire_employee" {
                    return Err(fail(
                        "PERMANENT_ASSISTANT",
                        "Shared assistants retain scope ownership; pause instead of firing",
                    ));
                }
                if employee.status == "fired" {
                    return Err(fail(
                        "TERMINAL_STATE",
                        "A fired employee cannot be resumed; hire a new definition",
                    ));
                }
                employee.status = match action.as_str() {
                    "pause_employee" => "paused",
                    "resume_employee" => "active",
                    _ => "fired",
                }
                .into();
                employee.updated_at = now();
                if action != "resume_employee" {
                    for job in self.jobs.iter_mut().filter(|j| {
                        j.employee_id == employee_id
                            && (j.status == "queued" || j.status == "running")
                    }) {
                        job.status = if action == "fire_employee" {
                            "cancelled"
                        } else {
                            "paused"
                        }
                        .into();
                        job.updated_at = now();
                        job.error=Some("Employee lifecycle change stopped dispatch; in-flight usage remains accountable".into());
                    }
                }
                self.log(
                    "donna",
                    &action,
                    &employee_id,
                    "Updated employee lifecycle; existing artifacts and usage retained".into(),
                );
            }
            "pause_company" | "resume_company" | "pause_office" | "resume_office"
            | "pause_department" | "resume_department" => {
                let status = if action.starts_with("pause") {
                    "paused"
                } else {
                    "active"
                };
                let entity;
                if action.ends_with("company") {
                    entity = string(p, "companyId", 100)?;
                    self.companies
                        .iter_mut()
                        .find(|c| c.id == entity)
                        .ok_or_else(|| fail("NOT_FOUND", "Company not found"))?
                        .status = status.into();
                } else if action.ends_with("office") {
                    entity = string(p, "officeId", 100)?;
                    self.offices
                        .iter_mut()
                        .find(|o| o.id == entity)
                        .ok_or_else(|| fail("NOT_FOUND", "Office not found"))?
                        .status = status.into();
                } else {
                    entity = string(p, "departmentId", 100)?;
                    self.departments
                        .iter_mut()
                        .find(|d| d.id == entity)
                        .ok_or_else(|| fail("NOT_FOUND", "Department not found"))?
                        .status = status.into();
                }
                if status == "paused" {
                    for job in &mut self.jobs {
                        let matches = if action.ends_with("company") {
                            job.company_id == entity
                        } else if action.ends_with("office") {
                            job.office_id == entity
                        } else {
                            job.department_id.as_deref() == Some(&entity)
                        };
                        if matches && job.status == "running" {
                            job.status = "paused".into();
                            job.updated_at = now();
                            job.error=Some("Parent scope was paused; inspect any in-flight provider attempt before retry".into());
                        }
                    }
                }
                self.log(
                    "donna",
                    &action,
                    &entity,
                    format!("Scope is {status}; dispatch checks the entire hierarchy"),
                );
            }
            "enqueue_job" => {
                if p.get("improvementSessionId").is_some() || p.get("budgetHoldUsd").is_some() || p.get("improvementRoute").is_some() {
                    return Err(fail("IMPROVEMENT_WORKER_REQUIRED", "Session work is created only by the managed improvement tick"));
                }
                let job_id = self.enqueue(p)?;
                let review_id = self.jobs.iter().find(|j| j.id == job_id).and_then(|j| j.pair.as_ref()).map(|p| p.review_job_id.clone());
                self.last_action = Some(json!({"jobId":job_id,"reviewJobId":review_id}));
            }
            "claim_job" => {
                let worker_id = string(p, "workerId", 150)?;
                let mode = opt_string(p, "mode", 20)?;
                let improvement_session_id = opt_string(p, "improvementSessionId", 100)?;
                self.validate_improvement_claim(improvement_session_id.as_deref(), &worker_id)?;
                if mode
                    .as_ref()
                    .is_some_and(|m| !["manual", "provider"].contains(&m.as_str()))
                {
                    return Err(fail("INVALID_INPUT", "Unknown worker mode"));
                }
                let clock = OffsetDateTime::now_utc();
                let mut found = None;
                for i in 0..self.jobs.len() {
                    if self.jobs[i].status != "queued"
                        || mode.as_ref().is_some_and(|m| m != &self.jobs[i].mode)
                        || self.jobs[i].improvement_session_id != improvement_session_id
                    {
                        continue;
                    }
                    match self.eligible(&self.jobs[i], clock) {
                        Ok(()) => {
                            found = Some(i);
                            break;
                        }
                        Err(reason) => self.jobs[i].error = Some(reason),
                    }
                }
                if let Some(i) = found {
                    let job = &mut self.jobs[i];
                    let lease = id("lease");
                    let stamp = at(clock);
                    job.status = "running".into();
                    job.error = None;
                    job.started_at = Some(stamp.clone());
                    job.updated_at = stamp;
                    job.worker_id = Some(worker_id.clone());
                    job.lease_token = Some(lease.clone());
                    job.lease_expires_at = Some(at(clock
                        + Duration::milliseconds(
                            (job.limits.max_minutes.min(5.0) * 60000.0) as i64,
                        )));
                    let job_id = job.id.clone();
                    self.last_action = Some(json!({"jobId":job_id,"leaseToken":lease}));
                    self.log(
                        &worker_id,
                        &action,
                        &job_id,
                        "Atomically claimed one eligible job; no provider call has occurred".into(),
                    );
                } else {
                    self.last_action = Some(json!({"jobId":null}));
                }
            }
            "reserve_job" => {
                let job_id = string(p, "jobId", 100)?;
                let lease = string(p, "leaseToken", 100)?;
                let input = integer(p, "inputTokens", 0, 1000000)?;
                let output = integer(p, "maxOutputTokens", 1, 1000000)?;
                let cost = number(p, "costUsd", 0.0, 1000.0)?;
                let existing = self
                    .jobs
                    .iter()
                    .find(|job| job.id == job_id)
                    .ok_or_else(|| fail("NOT_FOUND", "Job not found"))?;
                if existing.reservation.is_none() {
                    self.improvement_allows_dispatch(existing, OffsetDateTime::now_utc()).map_err(|reason| fail("IMPROVEMENT_DISPATCH_DENIED", reason))?;
                    self.pair_allows_dispatch(existing).map_err(|reason| fail(if existing.pair.is_none() { "PAIR_REQUIRED" } else { "DISPATCH_PERMISSION_REVOKED" }, reason))?;
                    self.authority_allows_dispatch(existing, OffsetDateTime::now_utc())
                        .map_err(|reason| fail("AUTHORITY_DENIED", reason))?;
                }
                let limits = &self
                    .jobs
                    .iter()
                    .find(|j| j.id == job_id)
                    .ok_or_else(|| fail("NOT_FOUND", "Job not found"))?
                    .limits;
                if input + output > limits.max_tokens || cost > limits.max_usd {
                    return Err(fail(
                        "BUDGET_EXHAUSTED",
                        "Worst-case provider reservation exceeds the job budget",
                    ));
                }
                if !self.admit_job_reservation(&job_id, &lease, cost, input, output)? {
                    return Ok(());
                }
                let job = self
                    .jobs
                    .iter_mut()
                    .find(|j| j.id == job_id)
                    .ok_or_else(|| fail("NOT_FOUND", "Job not found"))?;
                if job.status != "running" || job.lease_token.as_deref() != Some(&lease) {
                    return Err(fail(
                        "STALE_LEASE",
                        "Reservation requires the current running lease",
                    ));
                }
                if let Some(existing) = &job.reservation {
                    if existing.input_tokens != input
                        || existing.max_output_tokens != output
                        || (existing.cost_usd - cost).abs() > 1e-9
                    {
                        return Err(fail(
                            "ALREADY_RESERVED",
                            "This attempt already has a different reservation",
                        ));
                    }
                    self.last_action = Some(json!({"jobId":job_id,"reserved":true}));
                    return Ok(());
                }
                if input + output > job.limits.max_tokens || cost > job.limits.max_usd {
                    return Err(fail(
                        "BUDGET_EXHAUSTED",
                        "Worst-case provider reservation exceeds the job budget",
                    ));
                }
                job.reservation = Some(Reservation {
                    input_tokens: input,
                    max_output_tokens: output,
                    cost_usd: cost,
                });
                job.pending_reservation = None;
                job.budget_hold_usd = 0.0;
                job.usage = Usage {
                    input_tokens: input,
                    output_tokens: output,
                    cost_usd: cost,
                };
                job.cost_status = "reserved".into();
                job.updated_at = now();
                self.last_action = Some(json!({"jobId":job_id,"reserved":true}));
                self.log(
                    "worker",
                    &action,
                    &job_id,
                    "Reserved worst-case tokens and cost before provider dispatch".into(),
                );
            }
            "heartbeat_job" => {
                let job_id = string(p, "jobId", 100)?;
                let lease = string(p, "leaseToken", 100)?;
                let job = self
                    .jobs
                    .iter_mut()
                    .find(|j| j.id == job_id)
                    .ok_or_else(|| fail("NOT_FOUND", "Job not found"))?;
                if job.status != "running" || job.lease_token.as_deref() != Some(&lease) {
                    return Err(fail(
                        "STALE_LEASE",
                        "Job is no longer running under this lease",
                    ));
                }
                let clock = OffsetDateTime::now_utc();
                let deadline = timestamp(job.started_at.as_deref().unwrap_or(""))?
                    + Duration::milliseconds((job.limits.max_minutes * 60000.0) as i64);
                job.lease_expires_at = Some(at((clock + Duration::minutes(5)).min(deadline)));
                self.last_action =
                    Some(json!({"jobId":job_id,"leaseExpiresAt":job.lease_expires_at}));
            }
            "finish_job" | "complete_job" => {
                let job_id = string(p, "jobId", 100)?;
                let lease = string(p, "leaseToken", 100)?;
                let requested = string(p, "status", 30)?;
                if !["completed", "failed"].contains(&requested.as_str()) {
                    return Err(fail(
                        "INVALID_INPUT",
                        "Finish status must be completed or failed",
                    ));
                }
                let input = integer(p, "inputTokens", 0, 1000000000)?;
                let output = integer(p, "outputTokens", 0, 1000000000)?;
                let cost = number(p, "costUsd", 0.0, 1000000.0)?;
                let cost_status =
                    opt_string(p, "costStatus", 30)?.unwrap_or_else(|| "observed".into());
                if !["observed", "estimated"].contains(&cost_status.as_str()) {
                    return Err(fail(
                        "INVALID_INPUT",
                        "costStatus must be observed or estimated",
                    ));
                }
                let artifact =
                    opt_string(p, "artifactUri", 3000)?.or(opt_string(p, "artifactPath", 3000)?);
                let artifact_sha256 = opt_string(p, "artifactSha256", 64)?;
                if artifact_sha256.as_ref().is_some_and(|h| h.len() != 64 || !h.bytes().all(|c| c.is_ascii_hexdigit())) { return Err(fail("INVALID_INPUT", "artifactSha256 must be an exact SHA-256 digest")); }
                let deliverable_sha256 = opt_string(p, "deliverableSha256", 64)?;
                if deliverable_sha256.as_ref().is_some_and(|h| h.len() != 64 || !h.bytes().all(|c| c.is_ascii_hexdigit())) { return Err(fail("INVALID_INPUT", "deliverableSha256 must be an exact SHA-256 digest")); }
                let summary = opt_string(p, "summary", 4000)?;
                let error = opt_string(p, "error", 1000)?;
                let job = self
                    .jobs
                    .iter_mut()
                    .find(|j| j.id == job_id)
                    .ok_or_else(|| fail("NOT_FOUND", "Job not found"))?;
                if job.lease_token.as_deref() != Some(&lease) || job.usage_recorded {
                    return Err(fail(
                        "STALE_LEASE",
                        "This attempt cannot be settled twice or with another lease",
                    ));
                }
                let preserve =
                    ["cancelled", "paused", "needs-review"].contains(&job.status.as_str());
                if !preserve && job.status != "running" {
                    return Err(fail("TERMINAL_STATE", "Job is not an unsettled attempt"));
                }
                let clock = OffsetDateTime::now_utc();
                let deadline = timestamp(job.started_at.as_deref().unwrap_or(""))?
                    + Duration::milliseconds((job.limits.max_minutes * 60000.0) as i64);
                let over = input + output > job.limits.max_tokens
                    || cost > job.limits.max_usd
                    || clock > deadline;
                // Provider billing truth must be retained even when the managed
                // caller violated reserve-before-dispatch. Halt new admission
                // instead of rejecting (and thereby hiding) a reported charge.
                let improvement_breach = if job.improvement_session_id.is_some() && cost > 1e-9 {
                    match job.reservation.as_ref() {
                        None => Some("unreserved-cost"),
                        Some(reservation) if cost > reservation.cost_usd + 1e-9 => Some("reservation-exceeded-cost"),
                        _ => None,
                    }
                } else { None };
                job.usage = Usage {
                    input_tokens: input,
                    output_tokens: output,
                    cost_usd: cost,
                };
                job.cost_status = cost_status;
                job.usage_recorded = true;
                job.artifact_uri = artifact;
                job.artifact_sha256 = artifact_sha256;
                job.deliverable_sha256 = deliverable_sha256;
                job.summary = summary;
                if !preserve {
                    job.status = if over {
                        "budget-exhausted".into()
                    } else {
                        requested
                    };
                    job.error = if over {
                        Some(
                            "Observed attempt exceeded its token, cost or elapsed-time budget"
                                .into(),
                        )
                    } else {
                        error
                    };
                }
                job.updated_at = at(clock);
                job.finished_at = Some(at(clock));
                job.budget_hold_usd = 0.0;
                if let Some(reason) = improvement_breach { self.record_improvement_settlement_breach(&job_id, reason); }
                let final_status = self.jobs.iter().find(|j| j.id == job_id).unwrap().status.clone();
                self.last_action = Some(json!({"jobId":job_id,"status":final_status,"budgetInvariant":improvement_breach}));
                self.log("worker","job-settled",&job_id,format!("Usage and artifact recorded; final status {final_status}. A cancellation or pause is never revived."));
            }
            "cancel_job" | "pause_job" | "resume_job" => {
                let job_id = string(p, "jobId", 100)?;
                let job = self
                    .jobs
                    .iter_mut()
                    .find(|j| j.id == job_id)
                    .ok_or_else(|| fail("NOT_FOUND", "Job not found"))?;
                if [
                    "completed",
                    "failed",
                    "cancelled",
                    "budget-exhausted",
                    "needs-review",
                ]
                .contains(&job.status.as_str())
                {
                    return Err(fail("TERMINAL_STATE","Terminal attempts are not retried automatically; create a new authorized job"));
                }
                if action == "resume_job" {
                    if job.status != "paused" {
                        return Err(fail("INVALID_TRANSITION", "Only a paused job can resume"));
                    }
                    if job.started_at.is_some() {
                        return Err(fail("REVIEW_REQUIRED","A dispatched attempt cannot be resumed as a fresh billed call; inspect its result and enqueue a deliberate retry"));
                    }
                    job.status = "queued".into();
                } else {
                    job.status = if action == "cancel_job" {
                        "cancelled"
                    } else {
                        "paused"
                    }
                    .into();
                    if action == "cancel_job" {
                        job.finished_at = Some(now());
                        if job.reservation.is_none() { job.budget_hold_usd = 0.0; }
                    }
                }
                job.updated_at = now();
                self.log(
                    "donna",
                    &action,
                    &job_id,
                    "Dispatch stopped or resumed without erasing usage or artifacts".into(),
                );
            }
            "create_schedule" => {
                if self.schedules.len() >= 1000 {
                    return Err(fail("CAPACITY", "Schedule limit reached"));
                }
                let company_id = string(p, "companyId", 100)?;
                self.company(&company_id)?;
                let mut template = p
                    .get("jobTemplate")
                    .filter(|v| v.is_object())
                    .cloned()
                    .ok_or_else(|| fail("INVALID_INPUT", "jobTemplate must be an object"))?;
                template["companyId"] = json!(company_id);
                template["idempotencyKey"] = json!("schedule-validation");
                self.job_from(&template)?;
                let next = string(p, "nextRunAt", 80)?;
                timestamp(&next)?;
                let schedule_id = id("schedule");
                self.schedules.push(Schedule {
                    id: schedule_id.clone(),
                    company_id,
                    name: string(p, "name", 200)?,
                    enabled: boolean(p, "enabled", true)?,
                    every_minutes: integer(p, "everyMinutes", 0, 10080)?,
                    next_run_at: next,
                    last_enqueued_at: None,
                    job_template: template,
                    last_error: None,
                });
                self.last_action = Some(json!({"scheduleId":schedule_id}));
                self.log("donna",&action,&schedule_id,"Saved a schedule; due jobs enqueue when the local worker is enabled or tick_schedules is requested".into());
            }
            "pause_schedule" | "resume_schedule" => {
                let schedule_id = string(p, "scheduleId", 100)?;
                self.schedules
                    .iter_mut()
                    .find(|s| s.id == schedule_id)
                    .ok_or_else(|| fail("NOT_FOUND", "Schedule not found"))?
                    .enabled = action == "resume_schedule";
                self.log(
                    "donna",
                    &action,
                    &schedule_id,
                    "Updated schedule state".into(),
                );
            }
            "tick_schedules" => {
                let clock = OffsetDateTime::now_utc();
                let due: Vec<_> = self
                    .schedules
                    .iter()
                    .filter(|s| {
                        s.enabled
                            && timestamp(&s.next_run_at).is_ok_and(|t| t <= clock)
                            && self
                                .companies
                                .iter()
                                .any(|c| c.id == s.company_id && c.status == "active")
                    })
                    .take(100)
                    .map(|s| s.id.clone())
                    .collect();
                let mut jobs = vec![];
                for schedule_id in due {
                    let schedule = self
                        .schedules
                        .iter()
                        .find(|s| s.id == schedule_id)
                        .unwrap()
                        .clone();
                    let mut template = schedule.job_template;
                    template["idempotencyKey"] =
                        json!(format!("{}:{}", schedule_id, schedule.next_run_at));
                    template["dueAt"] = json!(at(clock));
                    match self.enqueue(&template) {
                        Ok(job_id) => {
                            jobs.push(job_id);
                            let schedule = self
                                .schedules
                                .iter_mut()
                                .find(|s| s.id == schedule_id)
                                .unwrap();
                            schedule.last_enqueued_at = Some(at(clock));
                            schedule.last_error = None;
                            if schedule.every_minutes == 0 {
                                schedule.enabled = false;
                            } else {
                                schedule.next_run_at =
                                    at(clock + Duration::minutes(schedule.every_minutes as i64));
                            }
                        }
                        Err(error) => {
                            let schedule = self
                                .schedules
                                .iter_mut()
                                .find(|s| s.id == schedule_id)
                                .unwrap();
                            schedule.enabled = false;
                            schedule.last_error = Some(error.message.clone());
                            self.log(
                                "system",
                                "schedule-needs-review",
                                &schedule_id,
                                format!(
                                    "Disabled invalid schedule: {}. Other due schedules continue.",
                                    error.message
                                ),
                            );
                        }
                    }
                }
                self.last_action = Some(json!({"enqueuedJobIds":jobs}));
            }
            "configure_cache" => {
                self.cache.enabled = boolean(p, "enabled", self.cache.enabled)?;
                if p.get("maxEntries").is_some() {
                    self.cache.max_entries = integer(p, "maxEntries", 1, 5000)? as usize;
                }
                if p.get("ttlMinutes").is_some() {
                    self.cache.ttl_minutes = integer(p, "ttlMinutes", 1, 10080)?;
                }
                if self.cache.entries.len() > self.cache.max_entries {
                    self.cache
                        .entries
                        .drain(..self.cache.entries.len() - self.cache.max_entries);
                }
                self.log(
                    "donna",
                    &action,
                    "cache",
                    "Updated bounded cache metadata policy; original artifacts are not deleted"
                        .into(),
                );
            }
            "clear_cache" => {
                let company = opt_string(p, "companyId", 100)?;
                if let Some(company) = &company {
                    self.company(company)?;
                }
                let before = self.cache.entries.len();
                self.cache
                    .entries
                    .retain(|e| company.as_ref().is_some_and(|c| c != &e.company_id));
                self.last_action = Some(json!({"cleared":before-self.cache.entries.len()}));
                self.log(
                    "donna",
                    &action,
                    "cache",
                    "Cleared cache references; original evidence files retained".into(),
                );
            }
            "get_cache" => {
                let company = string(p, "companyId", 100)?;
                self.company(&company)?;
                let key = string(p, "key", 200)?;
                let clock = OffsetDateTime::now_utc();
                self.cache
                    .entries
                    .retain(|e| timestamp(&e.expires_at).is_ok_and(|t| t > clock));
                let entry = if self.cache.enabled {
                    self.cache
                        .entries
                        .iter()
                        .find(|e| e.company_id == company && e.key == key)
                        .cloned()
                } else {
                    None
                };
                if entry.is_some() {
                    self.cache.hits += 1;
                } else {
                    self.cache.misses += 1;
                }
                self.last_action = Some(json!({"hit":entry.is_some(),"entry":entry}));
            }
            "put_cache" => {
                let company = string(p, "companyId", 100)?;
                self.company(&company)?;
                if !self.cache.enabled {
                    return Err(fail("CACHE_DISABLED", "Cache is disabled"));
                }
                let key = string(p, "key", 200)?;
                let artifact = string(p, "artifactUri", 3000)?;
                let content_sha256 = opt_string(p, "contentSha256", 64)?;
                if content_sha256
                    .as_ref()
                    .is_some_and(|h| h.len() != 64 || !h.bytes().all(|c| c.is_ascii_hexdigit()))
                {
                    return Err(fail(
                        "INVALID_INPUT",
                        "Cache contentSha256 must be a SHA-256 hex digest",
                    ));
                }
                let clock = OffsetDateTime::now_utc();
                self.cache.entries.retain(|e| {
                    !(e.company_id == company && e.key == key)
                        && timestamp(&e.expires_at).is_ok_and(|t| t > clock)
                });
                self.cache.entries.push(CacheEntry {
                    key,
                    company_id: company,
                    artifact_uri: artifact,
                    bytes: integer(p, "bytes", 0, 1000000000)?,
                    created_at: at(clock),
                    expires_at: at(clock + Duration::minutes(self.cache.ttl_minutes as i64)),
                    content_sha256,
                });
                if self.cache.entries.len() > self.cache.max_entries {
                    self.cache.entries.remove(0);
                }
                self.last_action = Some(json!({"stored":true}));
            }
            "add_knowledge" => {
                let company = string(p, "companyId", 100)?;
                self.company(&company)?;
                if self.knowledge.len() >= 5000 {
                    return Err(fail("CAPACITY", "Knowledge record limit reached"));
                }
                let knowledge_id = id("knowledge");
                self.knowledge.push(Knowledge {
                    id: knowledge_id.clone(),
                    company_id: company,
                    title: string(p, "title", 200)?,
                    summary: string(p, "summary", 4000)?,
                    artifact_uri: string(p, "artifactUri", 3000)?,
                    created_at: now(),
                });
                self.last_action = Some(json!({"knowledgeId":knowledge_id}));
                self.log(
                    "donna",
                    &action,
                    &knowledge_id,
                    "Stored a concise result summary and evidence reference, not hidden reasoning"
                        .into(),
                );
            }
            _ => return Err(fail("UNKNOWN_ACTION", "Unsupported office action")),
        }
        self.expire_leases();
        self.sync_goal_checkpoints()?;
        self.sync_decision_panels();
        self.requeue_waiting_admission();
        self.refresh_budget();
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn office() -> OfficeSnapshot {
        let c:Company=serde_json::from_value(json!({"id":"engineering-intelligence-atlas","name":"Atlas","repoUrl":"https://github.com/occult-kranti/engineering-intelligence-atlas","owner":"occult-kranti","repo":"engineering-intelligence-atlas","githubStatus":"unchecked"})).unwrap();
        OfficeSnapshot::seeded(&c, &[]).unwrap()
    }
    fn enqueue(s: &mut OfficeSnapshot, key: &str) -> String {
        let o = s.offices[0].id.clone();
        s.apply(&json!({"action":"enqueue_job","companyId":s.active_company_id,"officeId":o,"employeeId":"donna","goal":"Review evidence","mode":"manual","provider":"anthropic","model":"","maxTokens":100,"maxUsd":1,"maxMinutes":5,"idempotencyKey":key})).unwrap();
        s.last_action.as_ref().unwrap()["jobId"]
            .as_str()
            .unwrap()
            .into()
    }
    fn claim(s: &mut OfficeSnapshot) -> (String, String) {
        s.apply(&json!({"action":"claim_job","workerId":"test"}))
            .unwrap();
        let result = s.last_action.as_ref().unwrap();
        (
            result["jobId"].as_str().unwrap().into(),
            result["leaseToken"].as_str().unwrap().into(),
        )
    }
    #[test]
    fn hierarchy_and_idempotent_import() {
        let mut s = office();
        assert!(s.employees.iter().any(|e| e.id == "donna"));
        assert_eq!(s.departments.len(), 2);
        let count = s.companies.len();
        let cmd = json!({"action":"import_repositories","repositories":[{"name":"Second","repoUrl":"https://github.com/occult-kranti/second"}]});
        s.apply(&cmd).unwrap();
        s.apply(&cmd).unwrap();
        assert_eq!(s.companies.len(), count + 1);
        assert_eq!(s.departments.len(), 4);
    }
    #[test]
    fn no_duplicate_enqueue_or_claim() {
        let mut s = office();
        let a = enqueue(&mut s, "key");
        assert_eq!(a, enqueue(&mut s, "key"));
        let (j, _) = claim(&mut s);
        assert_eq!(a, j);
        s.apply(&json!({"action":"claim_job","workerId":"other"}))
            .unwrap();
        assert!(s.last_action.unwrap()["jobId"].is_null());
    }
    #[test]
    fn hierarchy_pause_blocks_claim() {
        let mut s = office();
        enqueue(&mut s, "key");
        let c = s.active_company_id.clone();
        s.apply(&json!({"action":"pause_company","companyId":c}))
            .unwrap();
        s.apply(&json!({"action":"claim_job","workerId":"test"}))
            .unwrap();
        assert!(s.last_action.as_ref().unwrap()["jobId"].is_null());
        s.apply(&json!({"action":"resume_company","companyId":c}))
            .unwrap();
        assert!(!claim(&mut s).0.is_empty());
    }
    #[test]
    fn cancellation_preserves_reserved_and_observed_usage() {
        let mut s = office();
        enqueue(&mut s, "key");
        let (j, l) = claim(&mut s);
        s.apply(&json!({"action":"reserve_job","jobId":j,"leaseToken":l,"inputTokens":20,"maxOutputTokens":30,"costUsd":0.5})).unwrap();
        s.apply(&json!({"action":"cancel_job","jobId":j})).unwrap();
        assert_eq!(s.jobs[0].cost_status, "reserved");
        s.apply(&json!({"action":"finish_job","jobId":j,"leaseToken":l,"status":"completed","inputTokens":20,"outputTokens":10,"costUsd":0.2,"artifactUri":"file:///tmp/result.md"})).unwrap();
        assert_eq!(s.jobs[0].status, "cancelled");
        assert_eq!(s.jobs[0].usage.cost_usd, 0.2);
        assert!(s.jobs[0].usage_recorded);
    }
    #[test]
    fn budgets_and_stale_leases_fail_closed() {
        let mut s = office();
        enqueue(&mut s, "key");
        let (j, l) = claim(&mut s);
        assert_eq!(s.apply(&json!({"action":"reserve_job","jobId":j,"leaseToken":l,"inputTokens":50,"maxOutputTokens":100,"costUsd":0.2})).unwrap_err().code,"BUDGET_EXHAUSTED");
        assert_eq!(s.apply(&json!({"action":"finish_job","jobId":j,"leaseToken":"fake","status":"completed","inputTokens":0,"outputTokens":0,"costUsd":0})).unwrap_err().code,"STALE_LEASE");
        s.jobs[0].lease_expires_at = Some("2020-01-01T00:00:00Z".into());
        s.expire_leases();
        assert_eq!(s.jobs[0].status, "needs-review");
        s.apply(&json!({"action":"claim_job","workerId":"test"}))
            .unwrap();
        assert!(s.last_action.unwrap()["jobId"].is_null());
    }
    #[test]
    fn dependencies_must_exist_and_stay_inside_company() {
        let mut s = office();
        let o = s.offices[0].id.clone();
        assert_eq!(s.apply(&json!({"action":"enqueue_job","companyId":s.active_company_id,"officeId":o,"employeeId":"donna","goal":"g","maxTokens":100,"maxUsd":0,"maxMinutes":1,"idempotencyKey":"x","dependencies":["missing"]})).unwrap_err().code,"INVALID_DEPENDENCY");
    }
    #[test]
    fn cloud_dispatch_requires_authorization_and_prices() {
        let mut s = office();
        enqueue(&mut s, "key");
        s.jobs[0].mode = "provider".into();
        s.jobs[0].model = "chosen-model".into();
        s.apply(&json!({"action":"claim_job","workerId":"test","mode":"provider"}))
            .unwrap();
        assert!(s.last_action.unwrap()["jobId"].is_null());
    }
    #[test]
    fn cache_counts_real_lookup_and_clear_preserves_knowledge() {
        let mut s = office();
        let c = s.active_company_id.clone();
        s.apply(&json!({"action":"put_cache","companyId":c,"key":"hash","artifactUri":"file:///result.md","bytes":10})).unwrap();
        s.apply(&json!({"action":"get_cache","companyId":c,"key":"hash"}))
            .unwrap();
        assert_eq!(s.cache.hits, 1);
        s.apply(&json!({"action":"add_knowledge","companyId":c,"title":"Result","summary":"Evidence summary","artifactUri":"file:///result.md"})).unwrap();
        s.apply(&json!({"action":"clear_cache","companyId":c}))
            .unwrap();
        assert!(s.cache.entries.is_empty());
        assert_eq!(s.knowledge.len(), 1);
    }
    #[test]
    fn donna_cannot_be_fired() {
        let mut s = office();
        assert_eq!(
            s.apply(&json!({"action":"fire_employee","employeeId":"donna"}))
                .unwrap_err()
                .code,
            "PERMANENT_ASSISTANT"
        );
    }
    #[test]
    fn expired_cancelled_reservation_becomes_estimate_without_reviving() {
        let mut s = office();
        enqueue(&mut s, "reservation");
        let (j, l) = claim(&mut s);
        s.apply(&json!({"action":"reserve_job","jobId":j,"leaseToken":l,"inputTokens":20,"maxOutputTokens":30,"costUsd":0.5})).unwrap();
        s.apply(&json!({"action":"cancel_job","jobId":j})).unwrap();
        s.jobs[0].lease_expires_at = Some("2020-01-01T00:00:00Z".into());
        assert!(s.expire_leases());
        assert_eq!(s.jobs[0].status, "cancelled");
        assert_eq!(s.jobs[0].cost_status, "estimated");
        assert_eq!(s.jobs[0].usage.cost_usd, 0.5);
        assert!(!s.expire_leases());
    }
    #[test]
    fn cancelled_prerequisite_moves_dependents_to_review() {
        let mut s = office();
        let parent = enqueue(&mut s, "parent");
        let child = enqueue(&mut s, "child");
        s.jobs
            .iter_mut()
            .find(|j| j.id == child)
            .unwrap()
            .dependencies
            .push(parent.clone());
        s.apply(&json!({"action":"cancel_job","jobId":parent}))
            .unwrap();
        assert_eq!(
            s.jobs.iter().find(|j| j.id == child).unwrap().status,
            "needs-review"
        );
        s.apply(&json!({"action":"claim_job","workerId":"test"}))
            .unwrap();
        assert!(s.last_action.unwrap()["jobId"].is_null());
    }
    #[test]
    fn invalid_schedule_does_not_roll_back_other_due_schedules() {
        let mut s = office();
        let c = s.active_company_id.clone();
        let o = s.offices[0].id.clone();
        s.apply(&json!({"action":"hire_employee","companyId":c,"officeId":o,"name":"Temporary employee","role":"Reviewer"})).unwrap();
        let employee = s.last_action.as_ref().unwrap()["employeeId"]
            .as_str()
            .unwrap()
            .to_string();
        for (target, name) in [(employee.clone(), "Invalidated"), ("donna".into(), "Valid")] {
            s.apply(&json!({"action":"create_schedule","companyId":c,"name":name,"everyMinutes":0,"nextRunAt":"2020-01-01T00:00:00Z","jobTemplate":{"companyId":c,"officeId":o,"employeeId":target,"goal":"Review evidence","mode":"manual","maxTokens":100,"maxUsd":0,"maxMinutes":1}})).unwrap();
        }
        s.apply(&json!({"action":"fire_employee","employeeId":employee}))
            .unwrap();
        s.apply(&json!({"action":"tick_schedules"})).unwrap();
        assert_eq!(s.jobs.len(), 2);
        assert_eq!(s.jobs[0].employee_id, "donna");
        assert!(s.schedules[0].last_error.is_some());
        assert!(!s.schedules[0].enabled);
        assert!(s.schedules[1].last_enqueued_at.is_some());
    }
}


#[cfg(test)]
mod paired_work_tests {
    use super::*;
    fn state() -> OfficeSnapshot {
        let company: Company = serde_json::from_value(json!({"id":"paired","name":"Paired","repoUrl":"https://github.com/example/paired","owner":"example","repo":"paired","githubStatus":"unchecked"})).unwrap();
        OfficeSnapshot::seeded(&company, &[]).unwrap()
    }
    fn request(s: &OfficeSnapshot, key: &str) -> Value {
        json!({"action":"enqueue_job","companyId":"paired","officeId":s.offices[0].id,"employeeId":"donna","reviewerEmployeeId":s.offices[0].assistant_id,"goal":"Inspect a bounded artifact","mode":"manual","maxTokens":100,"maxUsd":1,"maxMinutes":5,"idempotencyKey":key})
    }
    fn enqueue(s: &mut OfficeSnapshot, p: Value) -> (String,String) {
        s.apply(&p).unwrap(); let a=s.last_action.as_ref().unwrap();
        (a["jobId"].as_str().unwrap().into(),a["reviewJobId"].as_str().unwrap().into())
    }
    fn claim(s: &mut OfficeSnapshot) -> Option<(String,String)> {
        s.apply(&json!({"action":"claim_job","workerId":"pair-test"})).unwrap();
        let a=s.last_action.as_ref().unwrap(); a["jobId"].as_str().map(|id|(id.into(),a["leaseToken"].as_str().unwrap().into()))
    }
    fn settle(s: &mut OfficeSnapshot, id: &str, lease: &str, status: &str) {
        let digest=if s.jobs.iter().find(|j|j.id==id).unwrap().pair.as_ref().is_some_and(|p|p.phase=="review") { "b".repeat(64) } else { "a".repeat(64) };
        s.apply(&json!({"action":"finish_job","jobId":id,"leaseToken":lease,"status":status,"inputTokens":5,"outputTokens":5,"costUsd":0.1,"artifactUri":format!("/fixture/{id}.md"),"artifactSha256":digest,"summary":"Fixture evidence"})).unwrap();
    }
    fn review_request(s: &OfficeSnapshot, review: &str, lease: &str) -> Value {
        let j=s.jobs.iter().find(|j|j.id==review).unwrap();
        json!({"action":"record_step_review","jobId":review,"leaseToken":lease,"primaryJobId":j.pair.as_ref().unwrap().primary_job_id,"primaryArtifactSha256":"a".repeat(64),"reviewArtifactSha256":"b".repeat(64),"primaryArtifactComplete":true,"verdict":"accepted","summary":"Checked the complete primary artifact","evidenceRefs":["fixture:result"]})
    }
    fn goal(s: &mut OfficeSnapshot, steps: usize) -> String {
        s.apply(&json!({"action":"create_goal","scope":{"kind":"office","id":s.offices[0].id},"title":"Paired goal","mode":"execute","maxIterations":2,"runSettings":{"mode":"manual","provider":"anthropic","model":"","authorized":false,"maxTokens":100,"maxUsd":1,"maxMinutes":15,"priceRates":{"inputUsdPerMillion":null,"outputUsdPerMillion":null}}})).unwrap();
        let id=s.last_action.as_ref().unwrap()["goalId"].as_str().unwrap().to_owned();
        let steps:Vec<_>=(0..steps).map(|i|json!({"id":format!("step-{i}"),"title":"Work","employeeId":"donna","reviewerEmployeeId":s.offices[0].assistant_id,"goal":"Produce evidence","dependsOn":if i==0 {vec![]}else{vec![format!("step-{}",i-1)]}})).collect();
        s.apply(&json!({"action":"set_goal_plan","goalId":id,"steps":steps})).unwrap();
        id
    }
    #[test]
    fn pairing_creates_real_distinct_read_only_review_and_preserves_total_budget() {
        let mut s=state();let p=request(&s,"pair-1");let (a,b)=enqueue(&mut s,p.clone());
        assert_eq!(s.jobs.len(),2);assert_ne!(s.jobs[0].employee_id,s.jobs[1].employee_id);
        assert_eq!(s.jobs[0].limits.max_tokens+s.jobs[1].limits.max_tokens,100);
        assert!((s.jobs[0].limits.max_usd+s.jobs[1].limits.max_usd-1.0).abs()<1e-9);
        assert!(s.jobs[1].allowed_tools.is_empty());assert_eq!(s.jobs[1].dependencies,vec![a.clone()]);
        assert_eq!(s.jobs[0].pair.as_ref().unwrap().review_job_id,b);s.validate().unwrap();
        enqueue(&mut s,p);assert_eq!(s.jobs.len(),2);
    }
    #[test]
    fn pairing_rejects_same_employee_cross_company_and_changed_key_body() {
        let mut s=state();let p=request(&s,"identity");enqueue(&mut s,p.clone());
        let mut changed=p.clone();changed["goal"]=json!("Different work");assert_eq!(s.apply(&changed).unwrap_err().code,"JOB_IDEMPOTENCY_CONFLICT");
        let mut same=request(&s,"same");same["reviewerEmployeeId"]=json!("donna");assert_eq!(s.apply(&same).unwrap_err().code,"PAIR_REQUIRED");
        s.apply(&json!({"action":"create_company","name":"Foreign"})).unwrap();
        let foreign=s.employees.iter().find(|e|e.company_id.as_deref()!=Some("paired")&&e.id!="donna").unwrap().id.clone();
        let mut cross=request(&s,"cross");cross["reviewerEmployeeId"]=json!(foreign);assert!(s.apply(&cross).is_err());assert_eq!(s.jobs.len(),2);
    }
    #[test]
    fn paired_acceptance_requires_exact_hashes_full_coverage_and_is_idempotent_after_revocation() {
        let mut s=state();let p=request(&s,"review");let (a,b)=enqueue(&mut s,p);
        let (id,lease)=claim(&mut s).unwrap();assert_eq!(id,a);settle(&mut s,&id,&lease,"completed");
        let (id,lease)=claim(&mut s).unwrap();assert_eq!(id,b);settle(&mut s,&id,&lease,"completed");
        assert!(!s.job_accepted(&s.jobs[0]));let good=review_request(&s,&id,&lease);
        let mut wrong=good.clone();wrong["primaryArtifactSha256"]=json!("c".repeat(64));assert_eq!(s.apply(&wrong).unwrap_err().code,"REVIEW_EVIDENCE_REQUIRED");
        let mut partial=good.clone();partial["primaryArtifactComplete"]=json!(false);assert_eq!(s.apply(&partial).unwrap_err().code,"REVIEW_EVIDENCE_REQUIRED");
        s.apply(&good).unwrap();assert!(s.job_accepted(&s.jobs[0]));
        let reviewer=s.jobs[1].employee_id.clone();s.apply(&json!({"action":"pause_employee","employeeId":reviewer})).unwrap();
        s.apply(&good).unwrap();assert_eq!(s.last_action.as_ref().unwrap()["replayed"],true);
        let mut changed=good;changed["verdict"]=json!("revise");assert_eq!(s.apply(&changed).unwrap_err().code,"REVIEW_RECEIPT_CONFLICT");s.validate().unwrap();
    }
    #[test]
    fn dependency_waits_for_review_acceptance_not_just_review_execution() {
        let mut s=state();let p=request(&s,"parent");let (a,b)=enqueue(&mut s,p);
        let mut child=request(&s,"child");child["dependencies"]=json!([a]);let (child,_)=enqueue(&mut s,child);
        let (id,lease)=claim(&mut s).unwrap();settle(&mut s,&id,&lease,"completed");
        let (id,lease)=claim(&mut s).unwrap();assert_eq!(id,b);settle(&mut s,&id,&lease,"completed");
        assert!(claim(&mut s).is_none());let review=review_request(&s,&id,&lease);s.apply(&review).unwrap();
        assert_eq!(claim(&mut s).unwrap().0,child);
    }
    #[test]
    fn reviewer_pause_blocks_claim_and_recheck_without_losing_settlement() {
        let mut s=state();let p=request(&s,"pause");let (a,b)=enqueue(&mut s,p);
        let reviewer=s.jobs.iter().find(|j|j.id==b).unwrap().employee_id.clone();
        s.apply(&json!({"action":"pause_employee","employeeId":reviewer})).unwrap();assert!(claim(&mut s).is_none());
        s.apply(&json!({"action":"resume_employee","employeeId":reviewer})).unwrap();assert!(claim(&mut s).is_none());s.apply(&json!({"action":"resume_job","jobId":b})).unwrap();let (id,lease)=claim(&mut s).unwrap();assert_eq!(id,a);
        s.apply(&json!({"action":"pause_employee","employeeId":reviewer})).unwrap();assert!(s.eligible(s.jobs.iter().find(|j|j.id==id).unwrap(),OffsetDateTime::now_utc()).is_err());
        settle(&mut s,&id,&lease,"completed");assert_eq!(s.jobs[0].status,"completed");assert!(!s.job_accepted(&s.jobs[0]));
    }
    #[test]
    fn legacy_unpaired_work_cannot_start_but_an_existing_attempt_can_settle() {
        let mut s=state();let p=request(&s,"legacy");let (a,_)=enqueue(&mut s,p);
        let (id,lease)=claim(&mut s).unwrap();assert_eq!(id,a);
        s.jobs.truncate(1);s.jobs[0].pair=None;s.jobs[0].request_sha256=None;s.schema_version=1;
        settle(&mut s,&id,&lease,"completed");assert_eq!(s.schema_version,3);assert_eq!(s.jobs[0].status,"completed");
        let mut queued=s.jobs[0].clone();queued.id="legacy-queued".into();queued.idempotency_key="legacy-queued".into();queued.status="queued".into();queued.started_at=None;queued.usage_recorded=false;queued.lease_token=None;s.jobs.push(queued);
        assert!(claim(&mut s).is_none());assert!(s.jobs[1].error.as_deref().unwrap().contains("PAIR_REQUIRED"));s.validate().unwrap();
    }
    #[test]
    fn goal_compiles_two_jobs_per_step_and_accepts_only_all_reviews() {
        let mut s=state();let g=goal(&mut s,2);s.apply(&json!({"action":"execute_goal","goalId":g})).unwrap();
        assert_eq!(s.goals[0].job_ids.len(),4);assert_eq!(s.jobs[2].dependencies,vec![s.jobs[1].id.clone()]);
        for _ in 0..4 { let (id,lease)=claim(&mut s).unwrap();let is_review=s.jobs.iter().find(|j|j.id==id).unwrap().pair.as_ref().unwrap().phase=="review";settle(&mut s,&id,&lease,"completed");if is_review {let review=review_request(&s,&id,&lease);s.apply(&review).unwrap();} }
        assert_eq!(s.goals[0].status,"completed");s.validate().unwrap();
    }
    #[test]
    fn explicit_repair_iteration_does_not_depend_on_failed_prior_leaf() {
        let mut s=state();let g=goal(&mut s,1);s.apply(&json!({"action":"execute_goal","goalId":g})).unwrap();
        let (id,lease)=claim(&mut s).unwrap();settle(&mut s,&id,&lease,"failed");assert_eq!(s.goals[0].status,"needs-review");
        s.apply(&json!({"action":"advance_goal","goalId":g,"reason":"Repair the preserved failed attempt"})).unwrap();
        let (id,_)=claim(&mut s).unwrap();let new=s.jobs.iter().find(|j|j.id==id).unwrap();assert_eq!(new.goal_iteration,Some(2));assert!(new.dependencies.is_empty());
    }
    #[test]
    fn employee_scope_is_not_widened_and_estimates_are_validated() {
        let mut s=state();s.apply(&json!({"action":"create_goal","scope":{"kind":"employee","id":"donna"},"title":"Scoped","mode":"plan"})).unwrap();let id=s.goals[0].id.clone();
        assert_eq!(s.apply(&json!({"action":"plan_goal","goalId":id})).unwrap_err().code,"PAIR_REQUIRED");
        let g=goal(&mut s,1);let before=s.goals.iter().find(|x|x.id==g).unwrap().steps.clone();let mut steps=serde_json::to_value(&before).unwrap();steps[0]["estimate"]=json!({"optimisticMinutes":20,"likelyMinutes":10,"pessimisticMinutes":30});
        assert_eq!(s.apply(&json!({"action":"set_goal_plan","goalId":g,"steps":steps})).unwrap_err().code,"INVALID_ESTIMATE");
    }
    #[test]
    fn whiteboard_revisions_protect_single_and_full_blueprint_edits() {
        let mut s=state();let original=s.blueprints[0].clone();let board=&original.whiteboards[0];
        let mut edit=serde_json::to_value(board).unwrap();edit["action"]=json!("upsert_whiteboard");edit["officeId"]=json!(original.office_id);edit["title"]=json!("New title");
        assert_eq!(s.apply(&edit).unwrap_err().code,"REVISION_REQUIRED");edit["expectedRevision"]=json!(0);s.apply(&edit).unwrap();assert_eq!(s.blueprints[0].whiteboards[0].revision,1);assert_eq!(s.blueprints[0].revision,1);
        assert_eq!(s.apply(&edit).unwrap_err().code,"STALE_REVISION");assert_eq!(s.apply(&json!({"action":"save_blueprint","expectedRevision":0,"blueprint":original})).unwrap_err().code,"STALE_REVISION");
        let current=s.blueprints[0].clone();s.apply(&json!({"action":"save_blueprint","expectedRevision":1,"blueprint":current})).unwrap();assert_eq!(s.blueprints[0].revision,2);assert_eq!(s.blueprints[0].whiteboards[0].revision,2);
    }
    #[test]
    fn roadmap_done_requires_real_accepted_pair_and_revision() {
        let mut s=state();let mut item=json!({"action":"upsert_roadmap_item","id":"outcome","scope":{"kind":"company","id":"paired"},"title":"Outcome","ownerEmployeeId":"donna","reviewerEmployeeId":s.offices[0].assistant_id,"status":"planned"});
        s.apply(&item).unwrap();assert_eq!(s.portfolio.roadmap[0].revision,0);assert_eq!(s.apply(&item).unwrap_err().code,"REVISION_REQUIRED");
        item["expectedRevision"]=json!(0);item["status"]=json!("done");item["evidence"]=json!("A label alone is not acceptance");assert_eq!(s.apply(&item).unwrap_err().code,"REVIEW_EVIDENCE_REQUIRED");
        let p=request(&s,"outcome-work");let (a,_)=enqueue(&mut s,p);for _ in 0..2 {let (id,lease)=claim(&mut s).unwrap();let is_review=s.jobs.iter().find(|j|j.id==id).unwrap().pair.as_ref().unwrap().phase=="review";settle(&mut s,&id,&lease,"completed");if is_review{let r=review_request(&s,&id,&lease);s.apply(&r).unwrap();}}
        item["jobIds"]=json!([a]);s.apply(&item).unwrap();assert_eq!(s.portfolio.roadmap[0].revision,1);assert_eq!(s.portfolio.roadmap[0].status,"done");s.validate().unwrap();
    }
    #[test]
    fn paired_workflow_is_atomic_and_replays_after_restart_without_duplicate_briefs() {
        let mut s = state();
        let mut request = json!({"action":"create_paired_workflow","requestId":"workflow-once","scope":{"kind":"employee","id":"donna"},"title":"One durable brief","content":"Deliver a reviewed artifact","mode":"plan"});
        let before = (s.goals.len(), s.chat_threads.len(), s.jobs.len());
        assert_eq!(s.apply(&request).unwrap_err().code, "PAIR_REQUIRED");
        assert_eq!((s.goals.len(), s.chat_threads.len(), s.jobs.len()), before);
        request["scope"] = json!({"kind":"office","id":s.offices[0].id});
        s.apply(&request).unwrap();
        let receipt = s.last_action.clone().unwrap();
        assert_eq!(receipt["started"], false);
        assert!(s.jobs.is_empty()); assert_eq!(s.goals.len(), 1);
        assert_eq!(s.chat_threads.iter().flat_map(|t| &t.messages).filter(|m| m.role == "user").count(), 1);
        assert!(s.goals[0].steps.iter().all(|step| step.reviewer_employee_id.as_ref().is_some_and(|id| id != &step.employee_id)));
        s = serde_json::from_str(&serde_json::to_string(&s).unwrap()).unwrap();
        let reviewer = s.goals[0].steps[0].reviewer_employee_id.clone().unwrap();
        s.apply(&json!({"action":"pause_employee","employeeId":reviewer})).unwrap();
        s.apply(&request).unwrap();
        assert_eq!(s.last_action.as_ref().unwrap()["goalId"], receipt["goalId"]);
        assert_eq!(s.last_action.as_ref().unwrap()["messageId"], receipt["messageId"]);
        assert_eq!(s.last_action.as_ref().unwrap()["replayed"], true);
        assert_eq!(s.goals.len(), 1);
        request["content"] = json!("Changed brief under the same ID");
        assert_eq!(s.apply(&request).unwrap_err().code, "WORKFLOW_IDEMPOTENCY_CONFLICT");
        assert_eq!(s.chat_threads.iter().flat_map(|t| &t.messages).filter(|m| m.role == "user").count(), 1);
        s.validate().unwrap();
    }
    #[test]
    fn paired_workflow_cannot_escalate_provider_policy_and_creates_real_dag_once() {
        let mut s = state();
        let request = json!({"action":"create_paired_workflow","requestId":"workflow-provider","scope":{"kind":"office","id":s.offices[0].id},"title":"Bounded provider flow","content":"Prepare evidence and review it","mode":"execute","execute":true,"runSettings":{"mode":"provider","provider":"anthropic","model":"fixture","authorized":false,"maxTokens":1000,"maxUsd":1,"maxMinutes":15,"priceRates":{"inputUsdPerMillion":1,"outputUsdPerMillion":1}}});
        assert_eq!(s.apply(&request).unwrap_err().code, "REVIEW_REQUIRED");
        assert!(s.goals.is_empty() && s.chat_threads.is_empty() && s.jobs.is_empty());
        s.apply(&json!({"action":"configure_policy","approvalMode":"autonomous"})).unwrap();
        s.apply(&request).unwrap();
        assert!(s.last_action.as_ref().unwrap()["started"].as_bool().unwrap());
        let count = s.goals[0].steps.len();
        assert_eq!(s.jobs.len(), count * 2);
        assert_eq!(s.jobs.iter().map(|j| j.limits.max_tokens).sum::<u64>(), count as u64 * 1000);
        s.apply(&request).unwrap(); assert_eq!(s.jobs.len(), count * 2); s.validate().unwrap();
    }
    #[test]
    fn reviewer_revocation_between_claim_and_reserve_cannot_start_provider() {
        let mut s = state(); let p = request(&s, "reserve-check"); let (primary, review) = enqueue(&mut s, p);
        let (_, lease) = claim(&mut s).unwrap();
        let reviewer = s.jobs.iter().find(|j| j.id == review).unwrap().employee_id.clone();
        s.apply(&json!({"action":"pause_employee","employeeId":reviewer})).unwrap();
        assert_eq!(s.apply(&json!({"action":"reserve_job","jobId":primary,"leaseToken":lease,"inputTokens":10,"maxOutputTokens":20,"costUsd":0.1})).unwrap_err().code, "DISPATCH_PERMISSION_REVOKED");
        assert!(s.jobs.iter().find(|j| j.id == primary).unwrap().reservation.is_none());
    }
    #[test]
    fn uncertain_prior_execution_blocks_repair_and_rejected_review_blocks_dependents() {
        let mut s = state(); let g = goal(&mut s, 1);
        s.apply(&json!({"action":"execute_goal","goalId":g})).unwrap();
        let (primary, lease) = claim(&mut s).unwrap();
        s.apply(&json!({"action":"reserve_job","jobId":primary,"leaseToken":lease,"inputTokens":10,"maxOutputTokens":20,"costUsd":0.1})).unwrap();
        s.jobs.iter_mut().find(|j| j.id == primary).unwrap().lease_expires_at = Some("2020-01-01T00:00:00Z".into());
        s.apply(&json!({"action":"tick_goals"})).unwrap();
        assert_eq!(s.apply(&json!({"action":"advance_goal","goalId":g,"reason":"Unknown outcome must be reconciled"})).unwrap_err().code, "UNSETTLED_ATTEMPT");
        assert_eq!(s.jobs.len(), 2);
        let mut s = state(); let g = goal(&mut s, 2);
        s.apply(&json!({"action":"execute_goal","goalId":g})).unwrap();
        for _ in 0..2 {
            let (id, lease) = claim(&mut s).unwrap(); let is_review = s.jobs.iter().find(|j| j.id == id).unwrap().pair.as_ref().unwrap().phase == "review";
            settle(&mut s, &id, &lease, "completed");
            if is_review { let mut record = review_request(&s, &id, &lease); record["verdict"] = json!("revise"); s.apply(&record).unwrap(); }
        }
        assert!(claim(&mut s).is_none()); assert_ne!(s.goals[0].status, "completed");
        assert!(s.jobs.iter().filter(|j| j.pair.as_ref().unwrap().step_id == "step-1").all(|j| j.status == "needs-review"));
    }
    #[test]
    fn paired_index_links_boards_steps_reviews_without_artifact_bodies() {
        let mut s = state(); let g = goal(&mut s, 1);
        s.apply(&json!({"action":"execute_goal","goalId":g})).unwrap();
        for _ in 0..2 { let (id, lease) = claim(&mut s).unwrap(); let is_review = s.jobs.iter().find(|j| j.id == id).unwrap().pair.as_ref().unwrap().phase == "review"; settle(&mut s, &id, &lease, "completed"); if is_review {let p = review_request(&s, &id, &lease); s.apply(&p).unwrap();} }
        assert!(s.authority.index.iter().any(|i| i.kind == "whiteboard"));
        let step = s.authority.index.iter().find(|i| i.kind == "goal-step").unwrap();
        assert_eq!(step.parent_id.as_deref(), Some(g.as_str())); assert_eq!(step.owner_employee_id.as_deref(), Some("donna")); assert_eq!(step.reviewer_employee_id.as_deref(), Some(s.offices[0].assistant_id.as_str()));
        let review = s.authority.index.iter().find(|i| i.kind == "review").unwrap(); assert_eq!(review.status, "accepted"); assert_eq!(review.related_ids.len(), 2);
        assert!(!serde_json::to_string(&s.authority.index).unwrap().contains("/fixture/"));
    }

    #[test]
    fn atomic_workflow_keeps_full_source_brief_after_chat_rolloff_with_optional_context() {
        for description in [None, Some("Additional acceptance context")] {
            let mut s = state();
            let brief = format!("{} END_OF_FULL_BRIEF_SENTINEL", "Original source content. ".repeat(60));
            assert!(brief.find("END_OF_FULL_BRIEF_SENTINEL").unwrap() > 900);
            let scope = json!({"kind":"office","id":s.offices[0].id});
            let mut p = json!({"action":"create_paired_workflow","requestId":"full-brief","scope":scope,"title":"Short title","content":brief,"mode":"execute"});
            if let Some(description) = description { p["description"] = json!(description); }
            s.apply(&p).unwrap();
            let goal_id = s.goals[0].id.clone(); let message_id = s.goals[0].source_message_id.clone();
            assert!(s.goals[0].description.contains(&brief));
            if let Some(description) = description { assert!(s.goals[0].description.contains(description)); }
            assert!(s.goals[0].steps.iter().all(|step| step.goal.contains(&brief)));
            for i in 0..9 { s.apply(&json!({"action":"post_chat","scope":scope,"content":format!("Later conversation {i}")})).unwrap(); }
            assert!(s.chat_threads[0].messages.iter().rev().take(6).all(|m| !m.content.contains("END_OF_FULL_BRIEF_SENTINEL")));
            s.apply(&json!({"action":"execute_goal","goalId":goal_id})).unwrap();
            assert!(s.jobs.iter().all(|job| job.goal.contains(&brief)));
            let count = s.jobs.len(); s = serde_json::from_str(&serde_json::to_string(&s).unwrap()).unwrap(); s.apply(&p).unwrap();
            assert_eq!(s.jobs.len(), count); assert_eq!(s.goals[0].source_message_id, message_id); assert_eq!(s.last_action.as_ref().unwrap()["replayed"], true);
            s.validate().unwrap();
        }
    }
    #[test]
    fn atomic_workflow_rejects_oversized_combined_brief_without_partial_records() {
        let mut s = state(); let p = json!({"action":"create_paired_workflow","requestId":"oversized-brief","scope":{"kind":"office","id":s.offices[0].id},"title":"Bounded brief","content":"b".repeat(11000),"description":"d".repeat(8000),"mode":"plan"});
        assert!(s.apply(&p).is_err()); assert!(s.goals.is_empty() && s.jobs.is_empty() && s.chat_threads.is_empty());
    }
    #[test]
    fn cancelled_reviewer_blocks_primary_claim_reservation_and_dispatch_but_not_settlement() {
        let mut s = state(); let p = request(&s, "cancel-before-claim"); let (primary, review) = enqueue(&mut s, p);
        s.apply(&json!({"action":"cancel_job","jobId":review})).unwrap();
        assert!(claim(&mut s).is_none()); assert_eq!(s.jobs.iter().find(|j| j.id == primary).unwrap().status, "needs-review");
        let mut s = state(); let p = request(&s, "cancel-after-claim"); let (primary, review) = enqueue(&mut s, p);
        let (_, lease) = claim(&mut s).unwrap(); s.apply(&json!({"action":"cancel_job","jobId":review})).unwrap();
        assert_eq!(s.apply(&json!({"action":"reserve_job","jobId":primary,"leaseToken":lease,"inputTokens":10,"maxOutputTokens":20,"costUsd":0.1})).unwrap_err().code, "DISPATCH_PERMISSION_REVOKED");
        assert_eq!(s.apply(&json!({"action":"check_worker_authority","jobId":primary,"leaseToken":lease,"capability":"provider.run"})).unwrap_err().code, "AUTHORITY_DENIED");
        settle(&mut s, &primary, &lease, "completed");
        assert_eq!(s.jobs[0].status, "completed"); assert!(s.jobs[0].usage_recorded); assert!(!s.job_accepted(&s.jobs[0])); s.validate().unwrap();
    }
    #[test]
    fn explicit_review_failure_unblocks_repair_without_racing_normal_settlement() {
        let mut s = state(); let goal_id = goal(&mut s, 2); s.apply(&json!({"action":"execute_goal","goalId":goal_id})).unwrap();
        let (primary, lease) = claim(&mut s).unwrap(); settle(&mut s, &primary, &lease, "completed");
        let (review, lease) = claim(&mut s).unwrap();
        let failure = json!({"action":"record_review_failure","jobId":review,"leaseToken":lease,"reason":"malformed-output","summary":"The settled model output did not match the review JSON contract."});
        assert_eq!(s.apply(&failure).unwrap_err().code, "REVIEW_SETTLEMENT_REQUIRED");
        settle(&mut s, &review, &lease, "completed");
        assert_eq!(s.goals[0].status, "running"); assert_eq!(s.jobs[2].status, "queued");
        assert_eq!(s.apply(&json!({"action":"advance_goal","goalId":goal_id,"reason":"Must await explicit review outcome"})).unwrap_err().code, "GOAL_BUSY");
        let artifact = s.jobs[1].artifact_uri.clone(); let cost = s.budget.observed_usd;
        s.apply(&failure).unwrap();
        assert_eq!(s.goals[0].status, "needs-review"); assert_eq!(s.goals[0].stop_reason.as_deref(), Some("review-required"));
        assert_eq!(s.jobs[1].status, "completed"); assert_eq!(s.jobs[1].artifact_uri, artifact); assert_eq!(s.budget.observed_usd, cost); assert!(s.jobs[1].review.is_none());
        assert!(s.jobs[2..].iter().all(|j| j.status == "needs-review"));
        s.apply(&json!({"action":"advance_goal","goalId":goal_id,"reason":"Explicit repair after malformed review"})).unwrap();
        let (next, _) = claim(&mut s).unwrap(); assert_eq!(s.jobs.iter().find(|j| j.id == next).unwrap().goal_iteration, Some(2)); s.validate().unwrap();
    }
    #[test]
    fn review_failure_receipts_are_lease_bound_immutable_and_cannot_replace_acceptance() {
        let mut s = state(); let p = request(&s, "failure-receipt"); let (_, review) = enqueue(&mut s, p);
        let (primary, lease) = claim(&mut s).unwrap(); settle(&mut s, &primary, &lease, "completed");
        let (_, lease) = claim(&mut s).unwrap(); settle(&mut s, &review, &lease, "completed");
        let good = review_request(&s, &review, &lease);
        let failure = json!({"action":"record_review_failure","jobId":review,"leaseToken":lease,"reason":"malformed-output"});
        let mut wrong = failure.clone(); wrong["leaseToken"] = json!("wrong-lease"); assert_eq!(s.apply(&wrong).unwrap_err().code, "STALE_LEASE");
        let mut accepted = s.clone(); accepted.apply(&good).unwrap(); assert_eq!(accepted.apply(&failure).unwrap_err().code, "REVIEW_RECEIPT_CONFLICT"); assert!(accepted.job_accepted(&accepted.jobs[0]));
        let reviewer = s.jobs[1].employee_id.clone(); s.apply(&json!({"action":"pause_employee","employeeId":reviewer})).unwrap();
        s.apply(&failure).unwrap(); let cost = s.budget.observed_usd;
        s = serde_json::from_str(&serde_json::to_string(&s).unwrap()).unwrap(); s.apply(&failure).unwrap();
        assert_eq!(s.last_action.as_ref().unwrap()["replayed"], true); assert_eq!(s.budget.observed_usd, cost);
        assert_eq!(s.apply(&good).unwrap_err().code, "REVIEW_RECEIPT_CONFLICT");
        let mut changed = failure.clone(); changed["reason"] = json!("recording-unconfirmed"); assert_eq!(s.apply(&changed).unwrap_err().code, "REVIEW_RECEIPT_CONFLICT");
        assert_eq!(s.apply(&json!({"action":"apply_remote_command","id":"remote-cannot-fail-review","command":failure})).unwrap_err().code, "REMOTE_ACTION_DENIED");
        s.validate().unwrap(); let mut invalid = s.clone(); invalid.jobs[0].review_failure = invalid.jobs[1].review_failure.clone(); assert!(invalid.validate().is_err());
    }

}
