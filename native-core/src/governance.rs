//! Additive durable governance: admission budgets, scoped conversations, bounded
//! goal graphs and spatial ownership. No credentials or provider calls live here.
use super::*;

// The hosted API retains at most 60,000 JavaScript string units per reply.
// Preserve those records exactly, including non-ASCII and escaped line endings.
// Local chat creation retains its smaller, printable 12,000-byte contract.
const MAX_CLOUD_MESSAGE_BYTES: usize = 240_000;
const MAX_CLOUD_MESSAGE_UTF16_UNITS: usize = 60_000;
fn cloud_message_text(value: &str) -> Result<()> {
    if value.trim().is_empty()
        || value.len() > MAX_CLOUD_MESSAGE_BYTES
        || value.encode_utf16().count() > MAX_CLOUD_MESSAGE_UTF16_UNITS
    {
        return Err(fail(
            "INVALID_INPUT",
            "Cloud message exceeds 60,000 text units or 240,000 UTF-8 bytes; the full cloud record is preserved",
        ));
    }
    Ok(())
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BudgetPolicy {
    pub hard_cap_usd: f64,
    pub hard_cap_tokens: Option<u64>,
    pub warning_percent: f64,
}
impl Default for BudgetPolicy {
    fn default() -> Self {
        Self {
            hard_cap_usd: 10.0,
            hard_cap_tokens: None,
            warning_percent: 80.0,
        }
    }
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Policy {
    pub approval_mode: String,
    pub dispatch_paused: bool,
    pub budget: BudgetPolicy,
}
impl Default for Policy {
    fn default() -> Self {
        Self {
            approval_mode: "review".into(),
            dispatch_paused: false,
            budget: BudgetPolicy::default(),
        }
    }
}
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BudgetSummary {
    pub observed_usd: f64,
    pub estimated_usd: f64,
    pub reserved_usd: f64,
    pub committed_usd: f64,
    pub remaining_usd: f64,
    pub committed_tokens: u64,
    pub remaining_tokens: Option<u64>,
    pub warning: bool,
    pub at_cap: bool,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExternalAttempt {
    pub attempt_id: String,
    pub source: String,
    pub reserved_usd: f64,
    pub max_tokens: u64,
    pub usage: Usage,
    pub cost_status: String,
    pub settled: bool,
    pub created_at: String,
    pub updated_at: String,
}
#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Scope {
    pub kind: String,
    pub id: String,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessage {
    pub id: String,
    pub role: String,
    pub content: String,
    pub created_at: String,
    pub source: String,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatThread {
    pub id: String,
    pub scope: Scope,
    pub messages: Vec<ChatMessage>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GoalStep {
    pub id: String,
    pub title: String,
    pub employee_id: String,
    pub goal: String,
    pub depends_on: Vec<String>,
    #[serde(default)]
    pub service_contract_id: Option<String>,
    #[serde(default)]
    pub knowledge_transfer_ids: Vec<String>,
    #[serde(default)]
    pub reviewer_employee_id: Option<String>,
    #[serde(default)]
    pub reviewer_service_contract_id: Option<String>,
    #[serde(default)]
    pub estimate: Option<WorkEstimate>,
    #[serde(default)]
    pub review_estimate: Option<WorkEstimate>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct WorkEstimate {
    pub optimistic_minutes: f64,
    pub likely_minutes: f64,
    pub pessimistic_minutes: f64,
}
impl WorkEstimate {
    pub(super) fn validate(&self) -> Result<()> {
        if [self.optimistic_minutes, self.likely_minutes, self.pessimistic_minutes]
            .iter().any(|v| !v.is_finite() || !(0.01..=1440.0).contains(v))
            || self.optimistic_minutes > self.likely_minutes
            || self.likely_minutes > self.pessimistic_minutes {
            return Err(fail("INVALID_ESTIMATE", "Estimates must satisfy 0.01 <= optimistic <= likely <= pessimistic <= 1440 minutes"));
        }
        Ok(())
    }
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GoalRunSettings {
    pub mode: String,
    pub provider: String,
    pub model: String,
    pub authorized: bool,
    pub max_tokens: u64,
    pub max_usd: f64,
    pub max_minutes: f64,
    pub price_rates: Rates,
    #[serde(default)]
    pub allowed_tools: Vec<String>,
}
impl Default for GoalRunSettings {
    fn default() -> Self {
        Self {
            mode: "manual".into(),
            provider: "anthropic".into(),
            model: String::new(),
            authorized: false,
            max_tokens: 4000,
            max_usd: 1.0,
            max_minutes: 15.0,
            price_rates: Rates {
                input_usd_per_million: None,
                output_usd_per_million: None,
            },
            allowed_tools: vec![],
        }
    }
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Goal {
    pub id: String,
    pub company_id: String,
    pub scope: Scope,
    pub title: String,
    pub description: String,
    pub mode: String,
    pub status: String,
    pub max_iterations: u64,
    pub iteration: u64,
    pub job_ids: Vec<String>,
    pub steps: Vec<GoalStep>,
    pub run_settings: GoalRunSettings,
    pub created_at: String,
    pub updated_at: String,
    #[serde(default)]
    pub stop_reason: Option<String>,
    #[serde(default)]
    pub source_request_id: Option<String>,
    #[serde(default)]
    pub request_sha256: Option<String>,
    #[serde(default)]
    pub source_message_id: Option<String>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Checkpoint {
    pub id: String,
    pub goal_id: String,
    pub job_id: Option<String>,
    pub iteration: u64,
    pub summary: String,
    pub artifact_uri: Option<String>,
    pub created_at: String,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Room {
    pub id: String,
    pub name: String,
    pub department_id: Option<String>,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Desk {
    pub id: String,
    pub room_id: String,
    pub employee_id: String,
    pub x: f64,
    pub y: f64,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Whiteboard {
    pub id: String,
    pub room_id: String,
    pub owner_employee_id: String,
    pub title: String,
    pub goal_ids: Vec<String>,
    pub job_ids: Vec<String>,
    #[serde(default)]
    pub roadmap_item_ids: Vec<String>,
    pub x: f64,
    pub y: f64,
    #[serde(default)]
    pub revision: u64,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Blueprint {
    pub id: String,
    pub company_id: String,
    pub office_id: String,
    pub rooms: Vec<Room>,
    pub desks: Vec<Desk>,
    pub whiteboards: Vec<Whiteboard>,
    #[serde(default)]
    pub revision: u64,
}

fn decode<T: serde::de::DeserializeOwned>(v: &Value, label: &str) -> Result<T> {
    serde_json::from_value(v.clone()).map_err(|_| fail("INVALID_INPUT", format!("Invalid {label}")))
}
pub(super) fn terminal(status: &str) -> bool {
    [
        "completed",
        "failed",
        "cancelled",
        "budget-exhausted",
        "needs-review",
    ]
    .contains(&status)
}
fn coordinate(v: f64) -> bool {
    v.is_finite() && (0.0..=1.0).contains(&v)
}
fn shortened(value: String, limit: usize) -> String {
    if value.len() <= limit {
        return value;
    }
    let mut end = limit;
    while !value.is_char_boundary(end) {
        end -= 1;
    }
    value[..end].to_string()
}

impl OfficeSnapshot {
    fn summarize_budget(&self) -> BudgetSummary {
        let mut result = BudgetSummary::default();
        for (usage, status) in self
            .jobs
            .iter()
            .map(|j| (&j.usage, j.cost_status.as_str()))
            .chain(
                self.external_attempts
                    .iter()
                    .map(|a| (&a.usage, a.cost_status.as_str())),
            )
        {
            match status {
                "reserved" => result.reserved_usd += usage.cost_usd,
                "observed" => result.observed_usd += usage.cost_usd,
                "estimated" => result.estimated_usd += usage.cost_usd,
                _ => continue,
            }
            result.committed_tokens = result
                .committed_tokens
                .saturating_add(usage.input_tokens)
                .saturating_add(usage.output_tokens);
        }
        result.committed_usd = result.observed_usd + result.estimated_usd + result.reserved_usd;
        result.remaining_usd = (self.policy.budget.hard_cap_usd - result.committed_usd).max(0.0);
        result.remaining_tokens = self
            .policy
            .budget
            .hard_cap_tokens
            .map(|cap| cap.saturating_sub(result.committed_tokens));
        let fraction = self.policy.budget.warning_percent / 100.0;
        result.warning = result.committed_usd >= self.policy.budget.hard_cap_usd * fraction
            || self
                .policy
                .budget
                .hard_cap_tokens
                .is_some_and(|cap| result.committed_tokens as f64 >= cap as f64 * fraction);
        result.at_cap = result.committed_usd + 1e-9 >= self.policy.budget.hard_cap_usd
            || result.remaining_tokens == Some(0);
        result
    }
    pub(super) fn refresh_budget(&mut self) {
        self.budget = self.summarize_budget();
    }
    fn can_reserve(&self, usd: f64, tokens: u64) -> bool {
        let b = self.summarize_budget();
        !self.policy.dispatch_paused
            && b.committed_usd + usd <= self.policy.budget.hard_cap_usd + 1e-9
            && self
                .policy
                .budget
                .hard_cap_tokens
                .is_none_or(|cap| b.committed_tokens.saturating_add(tokens) <= cap)
    }
    /// No provider call has happened yet. A blocked reservation returns a durable
    /// waiting state, without finishing the work or discarding its goal/checkpoint.
    pub(super) fn admit_job_reservation(
        &mut self,
        job_id: &str,
        lease: &str,
        usd: f64,
        input: u64,
        output: u64,
    ) -> Result<bool> {
        let job = self
            .jobs
            .iter()
            .find(|j| j.id == job_id)
            .ok_or_else(|| fail("NOT_FOUND", "Job not found"))?;
        if job.status != "running" || job.lease_token.as_deref() != Some(lease) {
            return Err(fail(
                "STALE_LEASE",
                "Reservation requires the current running lease",
            ));
        }
        if job.reservation.is_some() {
            return Ok(true);
        }
        self.portfolio_allows_dispatch(job)
            .map_err(|reason| fail("DISPATCH_PERMISSION_REVOKED", reason))?;
        if self.can_reserve(usd, input + output) {
            return Ok(true);
        }
        let job = self.jobs.iter_mut().find(|j| j.id == job_id).unwrap();
        job.status = "waiting-budget".into();
        job.pending_reservation = Some(Reservation {
            input_tokens: input,
            max_output_tokens: output,
            cost_usd: usd,
        });
        job.started_at = None;
        job.worker_id = None;
        job.lease_token = None;
        job.lease_expires_at = None;
        job.error = Some("Waiting for global budget admission; no provider call was made and all work is retained".into());
        job.updated_at = now();
        self.last_action = Some(json!({"jobId":job_id,"reserved":false,"reason":"global-budget"}));
        self.log(
            "system",
            "budget-wait",
            job_id,
            "New provider request paused before dispatch; existing reserved calls may finish"
                .into(),
        );
        self.refresh_budget();
        Ok(false)
    }
    pub(super) fn requeue_waiting_admission(&mut self) -> bool {
        let eligible: Vec<_> = self
            .jobs
            .iter()
            .filter(|j| j.status == "waiting-budget" && j.reservation.is_none())
            .filter(|j| {
                j.pending_reservation.as_ref().is_some_and(|r| {
                    self.can_reserve(
                        r.cost_usd,
                        r.input_tokens.saturating_add(r.max_output_tokens),
                    )
                })
            })
            .map(|j| j.id.clone())
            .collect();
        for job in &mut self.jobs {
            if eligible.contains(&job.id) {
                job.status = "queued".into();
                job.error = None;
                job.updated_at = now();
            }
        }
        !eligible.is_empty()
    }
    pub(super) fn governance_allows_dispatch(&self, job: &Job) -> std::result::Result<(), String> {
        if self.policy.dispatch_paused {
            return Err("Global dispatch is paused; existing reserved calls may finish".into());
        }
        if job.mode == "provider" {
            let b = self.summarize_budget();
            if (job.provider != "ollama" && b.remaining_usd <= 1e-9)
                || b.remaining_tokens == Some(0)
            {
                return Err(
                    "Global budget is at its cap; queued work and checkpoints are retained".into(),
                );
            }
        }
        Ok(())
    }
    pub(super) fn scope_company(&self, scope: &Scope) -> Result<String> {
        match scope.kind.as_str() {
            "company" => Ok(self.company(&scope.id)?.id.clone()),
            "office" => Ok(self.office(&scope.id)?.company_id.clone()),
            "department" => self
                .departments
                .iter()
                .find(|d| d.id == scope.id)
                .map(|d| d.company_id.clone())
                .ok_or_else(|| fail("NOT_FOUND", "Department not found")),
            "employee" => Ok(self
                .staff(&scope.id)?
                .company_id
                .clone()
                .unwrap_or_else(|| self.active_company_id.clone())),
            _ => Err(fail("INVALID_INPUT", "Unknown conversation or goal scope")),
        }
    }
    pub(super) fn goal_employee_scope(
        &self,
        goal: &Goal,
        employee_id: &str,
        contract_id: Option<&str>,
    ) -> Result<(String, Option<String>)> {
        let employee = self.staff(employee_id)?;
        let scope_office = match goal.scope.kind.as_str() {
            "office" => Some(goal.scope.id.clone()),
            "department" => Some(
                self.departments
                    .iter()
                    .find(|d| d.id == goal.scope.id)
                    .ok_or_else(|| fail("NOT_FOUND", "Department not found"))?
                    .office_id
                    .clone(),
            ),
            "employee" => self.staff(&goal.scope.id)?.office_id.clone(),
            _ => None,
        };
        if goal.scope.kind == "employee" && employee_id != goal.scope.id {
            return Err(fail(
                "SCOPE_MISMATCH",
                "Employee-scoped goals must stay with that employee",
            ));
        }
        let contract = contract_id
            .map(|id| {
                self.portfolio
                    .contracts
                    .iter()
                    .find(|c| c.id == id)
                    .ok_or_else(|| {
                        fail(
                            "SERVICE_CONTRACT_REQUIRED",
                            "Goal service contract does not exist",
                        )
                    })
            })
            .transpose()?;
        let office = scope_office
            .or_else(|| contract.and_then(|c| c.recipient_office_id.clone()))
            .or_else(|| {
                if contract.is_none() {
                    employee.office_id.clone()
                } else {
                    None
                }
            })
            .or_else(|| {
                self.offices
                    .iter()
                    .find(|o| o.company_id == goal.company_id)
                    .map(|o| o.id.clone())
            })
            .ok_or_else(|| fail("NOT_FOUND", "Goal company has no office"))?;
        let department = if goal.scope.kind == "department" {
            Some(goal.scope.id.clone())
        } else if let Some(contract) = contract {
            contract.recipient_department_id.clone()
        } else {
            employee.department_id.clone()
        };
        self.validate_worker_assignment(
            &goal.company_id,
            &office,
            department.as_deref(),
            employee_id,
            contract_id,
            &goal.run_settings.allowed_tools,
        )?;
        Ok((office, department))
    }
    pub(super) fn bootstrap_directors(&mut self, company_id: &str) -> Result<()> {
        self.company(company_id)?;
        if self.portfolio.ceo.shared_services_company_id.as_deref() == Some(company_id) {
            return Ok(());
        }
        let office = self
            .offices
            .iter()
            .find(|o| o.company_id == company_id)
            .ok_or_else(|| fail("NOT_FOUND", "Company has no office"))?
            .id
            .clone();
        let roles = [
            (
                "subdirector",
                "Subdirector",
                "Company subdirector",
                "skills/agent-research-director/SKILL.md",
            ),
            (
                "blueprint-steward",
                "Blueprint steward",
                "Office blueprint and ownership steward",
                "skills/engineering-organization-architect/SKILL.md",
            ),
            (
                "knowledge-curator",
                "Knowledge curator",
                "Evidence and knowledge curator",
                "skills/agent-research-director/SKILL.md",
            ),
            (
                "qa-lead",
                "QA lead",
                "Quality and evidence reviewer",
                "skills/defensive-reverse-engineering/SKILL.md",
            ),
            (
                "github-steward",
                "GitHub steward",
                "GitHub repository steward",
                "skills/engineering-organization-architect/SKILL.md",
            ),
            (
                "code-engineer",
                "Code engineer",
                "Implementation engineer",
                "skills/local-model-runtime-engineering/SKILL.md",
            ),
        ];
        for (key, name, role, skill) in roles {
            if self.employees.iter().any(|e| {
                e.company_id.as_deref() == Some(company_id)
                    && e.assignment_key.as_deref() == Some(key)
            }) {
                continue;
            }
            let staff_id = self.add_staff(
                company_id,
                Some(office.clone()),
                None,
                name,
                role,
                "specialist",
                vec![skill.into()],
                None,
            )?;
            self.employees
                .iter_mut()
                .find(|e| e.id == staff_id)
                .unwrap()
                .assignment_key = Some(key.into());
        }
        self.ensure_blueprint(&office)?;
        Ok(())
    }
    /// Called on load as well as mutation. Older v1 documents gain fields through
    /// serde defaults; only actual missing definitions/checkpoints cause a write.
    pub fn migrate_governance(&mut self) -> Result<bool> {
        let before = (
            self.employees.len(),
            self.blueprints.len(),
            self.checkpoints.len(),
        );
        for company in self
            .companies
            .iter()
            .map(|c| c.id.clone())
            .collect::<Vec<_>>()
        {
            self.bootstrap_directors(&company)?;
        }
        let changed = self.sync_goal_checkpoints()?
            | self.requeue_waiting_admission()
            | self.sync_decision_panels();
        self.refresh_budget();
        Ok(changed
            || before
                != (
                    self.employees.len(),
                    self.blueprints.len(),
                    self.checkpoints.len(),
                ))
    }
    pub(super) fn ensure_blueprint(&mut self, office_id: &str) -> Result<String> {
        if let Some(b) = self.blueprints.iter().find(|b| b.office_id == office_id) {
            return Ok(b.id.clone());
        }
        if self.blueprints.len() >= 5000 {
            return Err(fail("CAPACITY", "Blueprint limit reached"));
        }
        let office = self.office(office_id)?.clone();
        let departments: Vec<_> = self
            .departments
            .iter()
            .filter(|d| d.office_id == office_id)
            .take(20)
            .cloned()
            .collect();
        let count = departments.len() + 1;
        let columns = 3usize.min(count);
        let rows = count.div_ceil(columns);
        let mut rooms = vec![];
        for i in 0..count {
            let department = departments.get(i);
            rooms.push(Room {
                id: id("room"),
                name: department
                    .map(|d| d.name.clone())
                    .unwrap_or_else(|| "Director office".into()),
                department_id: department.map(|d| d.id.clone()),
                x: (i % columns) as f64 / columns as f64,
                y: (i / columns) as f64 / rows as f64,
                width: 0.94 / columns as f64,
                height: 0.94 / rows as f64,
            });
        }
        let mut desks = vec![];
        for (i, employee) in self
            .employees
            .iter()
            .filter(|e| e.office_id.as_deref() == Some(office_id))
            .take(200)
            .enumerate()
        {
            let room = rooms
                .iter()
                .find(|r| r.department_id == employee.department_id)
                .unwrap_or_else(|| rooms.last().unwrap());
            desks.push(Desk {
                id: id("desk"),
                room_id: room.id.clone(),
                employee_id: employee.id.clone(),
                x: 0.1 + (i % 4) as f64 * 0.22,
                y: 0.2 + ((i / 4) % 4) as f64 * 0.18,
            });
        }
        let whiteboards = vec![Whiteboard {
            id: id("whiteboard"),
            room_id: rooms.last().unwrap().id.clone(),
            owner_employee_id: office.assistant_id.clone(),
            title: "Goals and handoffs".into(),
            goal_ids: vec![],
            job_ids: vec![],
            roadmap_item_ids: vec![],
            x: 0.1,
            y: 0.05,
            revision: 0,
        }];
        let blueprint_id = id("blueprint");
        self.blueprints.push(Blueprint {
            id: blueprint_id.clone(),
            company_id: office.company_id,
            office_id: office.id,
            rooms,
            desks,
            whiteboards,
            revision: 0,
        });
        Ok(blueprint_id)
    }
    fn validate_blueprint(&self, b: &Blueprint) -> Result<()> {
        if self.office(&b.office_id)?.company_id != b.company_id
            || !safe_id(&b.id)
            || b.rooms.is_empty()
            || b.rooms.len() > 100
            || b.desks.len() > 1000
            || b.whiteboards.len() > 200
            || b.revision > 9_007_199_254_740_991
        {
            return Err(fail("INVALID_INPUT", "Invalid blueprint scope or capacity"));
        }
        let mut ids = HashSet::new();
        for room in &b.rooms {
            if !safe_id(&room.id)
                || !ids.insert(room.id.as_str())
                || !coordinate(room.x)
                || !coordinate(room.y)
                || !coordinate(room.width)
                || !coordinate(room.height)
                || room.width <= 0.0
                || room.height <= 0.0
                || room.x + room.width > 1.000001
                || room.y + room.height > 1.000001
            {
                return Err(fail(
                    "INVALID_INPUT",
                    "Room coordinates must stay inside the normalized office canvas",
                ));
            }
            bounded_text(&room.name, 150, "room name")?;
            if room.department_id.as_ref().is_some_and(|d| {
                !self
                    .departments
                    .iter()
                    .any(|x| &x.id == d && x.office_id == b.office_id)
            }) {
                return Err(fail(
                    "SCOPE_MISMATCH",
                    "Room department belongs to another office",
                ));
            }
        }
        let room_ids = ids.clone();
        let mut employee_ids = HashSet::new();
        for desk in &b.desks {
            let employee = self.staff(&desk.employee_id)?;
            if !safe_id(&desk.id)
                || !ids.insert(desk.id.as_str())
                || !room_ids.contains(desk.room_id.as_str())
                || !employee_ids.insert(desk.employee_id.as_str())
                || !coordinate(desk.x)
                || !coordinate(desk.y)
                || ((employee
                    .company_id
                    .as_ref()
                    .is_some_and(|c| c != &b.company_id)
                    || employee
                        .office_id
                        .as_ref()
                        .is_some_and(|o| o != &b.office_id))
                    && !self.service_layout_member(&employee.id, &b.company_id, &b.office_id))
            {
                return Err(fail(
                    "SCOPE_MISMATCH",
                    "Invalid desk ownership or room position",
                ));
            }
        }
        for board in &b.whiteboards {
            let employee = self.staff(&board.owner_employee_id)?;
            if !safe_id(&board.id)
                || !ids.insert(board.id.as_str())
                || !room_ids.contains(board.room_id.as_str())
                || !coordinate(board.x)
                || !coordinate(board.y)
                || ((employee
                    .company_id
                    .as_ref()
                    .is_some_and(|c| c != &b.company_id)
                    || employee
                        .office_id
                        .as_ref()
                        .is_some_and(|o| o != &b.office_id))
                    && !self.service_layout_member(&employee.id, &b.company_id, &b.office_id))
                || board.goal_ids.len() > 100
                || board.job_ids.len() > 100
                || board.roadmap_item_ids.len() > 100
                || board.revision > 9_007_199_254_740_991
            {
                return Err(fail(
                    "SCOPE_MISMATCH",
                    "Invalid whiteboard ownership or position",
                ));
            }
            bounded_text(&board.title, 200, "whiteboard title")?;
            if board.goal_ids.iter().any(|g| {
                !self
                    .goals
                    .iter()
                    .any(|x| &x.id == g && x.company_id == b.company_id)
            }) || board.job_ids.iter().any(|j| {
                !self
                    .jobs
                    .iter()
                    .any(|x| &x.id == j && x.company_id == b.company_id)
            }) || board
                .roadmap_item_ids
                .iter()
                .any(|r| !self.roadmap_visible_to_company(r, &b.company_id))
            {
                return Err(fail(
                    "SCOPE_MISMATCH",
                    "Whiteboard links must belong to this company",
                ));
            }
        }
        Ok(())
    }
    pub(super) fn validate_goal_steps(&self, goal: &Goal) -> Result<()> {
        if goal.steps.len() > 12 {
            return Err(fail("CAPACITY", "A goal plan may contain at most 12 steps"));
        }
        let mut ids = HashSet::new();
        for step in &goal.steps {
            if !safe_id(&step.id) || !ids.insert(step.id.as_str()) || step.depends_on.len() > 12 {
                return Err(fail("INVALID_INPUT", "Invalid or duplicate goal step"));
            }
            bounded_text(&step.title, 200, "step title")?;
            bounded_text(&step.goal, 18000, "step goal")?;
            self.goal_employee_scope(goal, &step.employee_id, step.service_contract_id.as_deref())?;
            self.validate_knowledge_access(&goal.company_id, &step.knowledge_transfer_ids)?;
            for estimate in [&step.estimate, &step.review_estimate].into_iter().flatten() { estimate.validate()?; }
            if step.reviewer_employee_id.as_ref().is_some_and(|id| id == &step.employee_id) {
                return Err(fail("PAIR_REQUIRED", "A logical step needs a distinct helper/reviewer"));
            }
        }
        // Kahn traversal accepts a DAG in any submitted order.
        let mut completed = HashSet::new();
        while completed.len() < goal.steps.len() {
            let previous = completed.len();
            for step in &goal.steps {
                if step.depends_on.iter().any(|d| !ids.contains(d.as_str())) {
                    return Err(fail("INVALID_DEPENDENCY", "Missing goal step dependency"));
                }
                if step
                    .depends_on
                    .iter()
                    .all(|d| completed.contains(d.as_str()))
                {
                    completed.insert(step.id.as_str());
                }
            }
            if previous == completed.len() {
                return Err(fail("INVALID_DEPENDENCY", "Goal plan contains a cycle"));
            }
        }
        Ok(())
    }
    pub(super) fn paired_primary(&self, goal: &Goal, step: &GoalStep) -> Result<Job> {
        let (office, department) = self.goal_employee_scope(goal, &step.employee_id, step.service_contract_id.as_deref())?;
        let r = &goal.run_settings;
        let mut job = self.job_from(&json!({"companyId":goal.company_id,"officeId":office,"departmentId":department,"employeeId":step.employee_id,"serviceContractId":step.service_contract_id,
            "goal":step.goal,"mode":r.mode,"provider":r.provider,"model":r.model,"authorized":r.authorized,"maxTokens":r.max_tokens,"maxUsd":r.max_usd,"maxMinutes":5,
            "priceRates":r.price_rates,"allowedTools":r.allowed_tools,"knowledgeTransferIds":step.knowledge_transfer_ids,"idempotencyKey":"pair-validation"}))?;
        job.goal_id = Some(goal.id.clone());
        Ok(job)
    }
    pub(super) fn assign_goal_reviewers(&self, goal: &mut Goal) -> Result<()> {
        if goal.scope.kind == "employee" {
            return Err(fail("PAIR_REQUIRED", "Employee-only goals cannot borrow a reviewer implicitly. Select an explicitly authorized office or department workflow with two employees"));
        }
        for index in 0..goal.steps.len() {
            let primary = self.paired_primary(goal, &goal.steps[index])?;
            let (employee, contract) = self.choose_reviewer(&primary, goal.steps[index].reviewer_employee_id.as_deref(), goal.steps[index].reviewer_service_contract_id.as_deref())?;
            goal.steps[index].reviewer_employee_id = Some(employee);
            goal.steps[index].reviewer_service_contract_id = contract;
        }
        Ok(())
    }
    pub(super) fn require_paired_steps(&self, goal: &Goal) -> Result<()> {
        if goal.scope.kind == "employee" { return Err(fail("PAIR_REQUIRED", "Employee-only goals cannot execute without an explicitly authorized paired scope; select an office or department workflow")); }
        if goal.run_settings.max_tokens < 2 { return Err(fail("PAIR_BUDGET", "A logical step must fund both primary and review token allowances")); }
        for step in &goal.steps {
            let employee = step.reviewer_employee_id.as_deref().ok_or_else(|| fail("PAIR_REQUIRED", "Every logical step must name a distinct helper/reviewer"))?;
            let primary = self.paired_primary(goal, step)?;
            self.choose_reviewer(&primary, Some(employee), step.reviewer_service_contract_id.as_deref())?;
        }
        Ok(())
    }
    pub(super) fn validate_run_settings(&self, goal: &Goal) -> Result<()> {
        let r = &goal.run_settings;
        if !["manual", "provider"].contains(&r.mode.as_str())
            || !["anthropic", "openai", "ollama"].contains(&r.provider.as_str())
            || r.model.len() > 200
            || (r.mode == "provider" && r.model.trim().is_empty())
            || r.max_tokens == 0
            || r.max_tokens > 1000000
            || !r.max_usd.is_finite()
            || !(0.0..=1000.0).contains(&r.max_usd)
            || !r.max_minutes.is_finite()
            || !(0.01..=1440.0).contains(&r.max_minutes)
        {
            return Err(fail("INVALID_INPUT", "Invalid goal run settings"));
        }
        for rate in [
            r.price_rates.input_usd_per_million,
            r.price_rates.output_usd_per_million,
        ]
        .into_iter()
        .flatten()
        {
            if !rate.is_finite() || !(0.0..=100000.0).contains(&rate) {
                return Err(fail("INVALID_INPUT", "Invalid goal price rate"));
            }
        }
        if r.allowed_tools.len() > 30 {
            return Err(fail(
                "INVALID_INPUT",
                "At most 30 explicit tool capabilities may be assigned",
            ));
        }
        for tool in &r.allowed_tools {
            bounded_text(tool, 300, "tool capability")?;
        }
        Ok(())
    }
    fn start_goal_iteration(&mut self, goal_index: usize) -> Result<()> {
        let mut goal = self.goals[goal_index].clone();
        if goal.mode != "execute" {
            return Err(fail(
                "PLAN_ONLY",
                "Change goal to execute mode explicitly before dispatch",
            ));
        }
        if goal.steps.is_empty() {
            return Err(fail("PLAN_REQUIRED", "Plan the goal before execution"));
        }
        if goal.iteration >= goal.max_iterations {
            return Err(fail(
                "ITERATION_LIMIT",
                "Goal reached its configured iteration limit; all checkpoints were retained",
            ));
        }
        if goal
            .job_ids
            .iter()
            .filter_map(|id| self.jobs.iter().find(|j| &j.id == id))
            .any(|j| !terminal(&j.status))
        {
            return Err(fail(
                "GOAL_BUSY",
                "Finish or cancel the current iteration before creating another",
            ));
        }
        if goal.job_ids.iter().filter_map(|id| self.jobs.iter().find(|j| &j.id == id))
            .any(|j| j.started_at.is_some() && !j.usage_recorded) {
            return Err(fail("UNSETTLED_ATTEMPT", "Reconcile the prior attempt before starting another iteration; uncertain execution must not be rerun"));
        }
        self.validate_goal_steps(&goal)?;
        self.require_paired_steps(&goal)?;
        self.validate_run_settings(&goal)?;
        if goal.run_settings.mode == "provider"
            && !goal.run_settings.authorized
            && self.policy.approval_mode != "autonomous"
        {
            return Err(fail(
                "REVIEW_REQUIRED",
                "Review mode requires explicit authorization for this goal's provider requests",
            ));
        }
        if self.jobs.len() + goal.steps.len() * 2 > 5000 {
            return Err(fail(
                "CAPACITY",
                "Queue history cannot fit this goal iteration",
            ));
        }
        // Earlier attempts are evidence lineage, never success prerequisites for a
        // deliberately requested repair. Failed leaves must not poison the new DAG.
        let previous_handoffs: Vec<String> = self.jobs.iter()
            .filter(|j| j.goal_id.as_deref() == Some(&goal.id) && j.goal_iteration == Some(goal.iteration))
            .filter(|j| j.pair.as_ref().is_some_and(|p| p.phase == "review") && self.job_accepted(j))
            .map(|j| j.id.clone()).collect();
        goal.iteration += 1;
        let mut jobs: HashMap<String, String> = HashMap::new();
        while jobs.len() < goal.steps.len() {
            for step in &goal.steps {
                if jobs.contains_key(&step.id)
                    || !step.depends_on.iter().all(|d| jobs.contains_key(d))
                {
                    continue;
                }
                let (office, department) = self.goal_employee_scope(
                    &goal,
                    &step.employee_id,
                    step.service_contract_id.as_deref(),
                )?;
                let dependencies: Vec<_> = if step.depends_on.is_empty() {
                    previous_handoffs.clone()
                } else {
                    step.depends_on.iter().map(|d| jobs[d].clone()).collect()
                };
                let r = &goal.run_settings;
                let job_id = self.enqueue_pair(&json!({"companyId":goal.company_id,"officeId":office,"departmentId":department,"employeeId":step.employee_id,
                    "goal":format!("{}\nGoal iteration {} of {}. Use supplied earlier handoffs as evidence; improve unresolved findings without pretending to run unavailable tools.",step.goal,goal.iteration,goal.max_iterations),"mode":r.mode,"provider":r.provider,"model":r.model,"authorized":r.authorized,
                    "maxTokens":r.max_tokens,"maxUsd":r.max_usd,"maxMinutes":5,"priceRates":r.price_rates,
                    "reviewerEmployeeId":step.reviewer_employee_id,"reviewerServiceContractId":step.reviewer_service_contract_id,
                    "allowedTools":r.allowed_tools,
                    "serviceContractId":step.service_contract_id,"knowledgeTransferIds":step.knowledge_transfer_ids,
                    "dependencies":dependencies,"idempotencyKey":format!("goal:{}:{}:{}",goal.id,goal.iteration,step.id)}), Some((&goal.id, goal.iteration, &step.id)))?;
                let review_id = self.jobs.iter().find(|j| j.id == job_id).unwrap().pair.as_ref().unwrap().review_job_id.clone();
                jobs.insert(step.id.clone(), review_id.clone());
                goal.job_ids.push(job_id);
                goal.job_ids.push(review_id);
            }
        }
        goal.status = "running".into();
        goal.updated_at = now();
        goal.stop_reason = None;
        self.last_action = Some(
            json!({"goalId":goal.id,"iteration":goal.iteration,"jobIds":jobs.values().collect::<Vec<_>>()}),
        );
        self.log("donna", "goal-iteration-enqueued", &goal.id, format!("Created iteration {} of {} with {} dependency-linked jobs; provider admission is still required", goal.iteration, goal.max_iterations, goal.steps.len()));
        self.goals[goal_index] = goal;
        Ok(())
    }
    pub(super) fn sync_goal_checkpoints(&mut self) -> Result<bool> {
        let mut changed = false;
        let mut messages = vec![];
        for job in &self.jobs {
            let Some(goal_id) = &job.goal_id else {
                continue;
            };
            if !terminal(&job.status)
                || self
                    .checkpoints
                    .iter()
                    .any(|c| c.job_id.as_deref() == Some(&job.id))
            {
                continue;
            }
            // Accounting settlements must never roll back because optional chat
            // or derived checkpoint capacity is full. The job itself retains the
            // complete artifact reference, evidence summary and usage record.
            if self.checkpoints.len() >= 20000 {
                continue;
            }
            self.checkpoints.push(Checkpoint {
                id: id("checkpoint"),
                goal_id: goal_id.clone(),
                job_id: Some(job.id.clone()),
                iteration: job.goal_iteration.unwrap_or(0),
                summary: job
                    .summary
                    .clone()
                    .or_else(|| job.error.clone())
                    .unwrap_or_else(|| format!("Job {}: {}", job.id, job.status)),
                artifact_uri: job.artifact_uri.clone(),
                created_at: now(),
            });
            changed = true;
            if let Some(goal) = self.goals.iter().find(|g| &g.id == goal_id) {
                let provider = job.mode == "provider"
                    && job.reservation.is_some()
                    && job.summary.is_some()
                    && job.artifact_uri.is_some();
                let content = format!(
                    "{} · iteration {} · {}\n{}{}",
                    self.staff(&job.employee_id)
                        .map(|e| e.name.as_str())
                        .unwrap_or("Employee"),
                    job.goal_iteration.unwrap_or(0),
                    job.status,
                    job.summary
                        .as_deref()
                        .or(job.error.as_deref())
                        .unwrap_or("Result recorded in the job ledger."),
                    job.artifact_uri
                        .as_ref()
                        .map(|a| format!("\nArtifact: {a}"))
                        .unwrap_or_default()
                );
                messages.push((goal.scope.clone(), content, provider));
            }
        }
        let accepted_jobs: HashSet<String> = self.jobs.iter().filter(|j| self.job_accepted(j)).map(|j| j.id.clone()).collect();
        for goal in &mut self.goals {
            if goal.status != "running" && !(goal.status == "needs-review" && goal.stop_reason.as_deref() == Some("review-pending")) {
                continue;
            }
            let current: Vec<_> = self
                .jobs
                .iter()
                .filter(|j| {
                    j.goal_id.as_deref() == Some(&goal.id)
                        && j.goal_iteration == Some(goal.iteration)
                })
                .collect();
            if !current.is_empty() && current.iter().all(|j| terminal(&j.status)) {
                let accepted = current.iter().all(|j| j.status == "completed" && accepted_jobs.contains(&j.id));
                goal.status = if accepted {
                    "completed"
                } else {
                    "needs-review"
                }
                .into();
                goal.updated_at = now();
                changed = true;
                if goal.status == "needs-review" {
                    goal.stop_reason = Some(if current.iter().all(|j| j.status == "completed") && current.iter().all(|j| j.review_failure.is_none() && j.review.as_ref().is_none_or(|r| r.verdict == "accepted")) { "review-pending" } else { "review-required" }.into());
                } else if goal.iteration >= goal.max_iterations {
                    goal.stop_reason = Some("iteration-limit".into());
                }
            }
        }
        for (scope, content, provider) in messages {
            // A full conversation does not erase a settled result or its charge.
            let _ = self.append_chat(
                scope,
                content,
                if provider { "assistant" } else { "system" },
                if provider { "provider" } else { "local" },
            );
        }
        Ok(changed)
    }
    fn append_chat(
        &mut self,
        scope: Scope,
        content: String,
        role: &str,
        source: &str,
    ) -> Result<String> {
        self.scope_company(&scope)?;
        if source == "cloud" {
            cloud_message_text(&content)?;
        } else {
            bounded_text(&content, 12000, "message")?;
        }
        if self
            .chat_threads
            .iter()
            .map(|t| t.messages.len())
            .sum::<usize>()
            >= 10000
        {
            return Err(fail(
                "CAPACITY",
                "Conversation capacity reached; existing messages were retained",
            ));
        }
        let index = if let Some(i) = self.chat_threads.iter().position(|t| t.scope == scope) {
            i
        } else {
            if self.chat_threads.len() >= 5000 {
                return Err(fail("CAPACITY", "Conversation scope limit reached"));
            }
            self.chat_threads.push(ChatThread {
                id: id("thread"),
                scope,
                messages: vec![],
            });
            self.chat_threads.len() - 1
        };
        if self.chat_threads[index].messages.len() >= 2000 {
            return Err(fail(
                "CAPACITY",
                "This conversation reached 2000 messages; export it before adding more",
            ));
        }
        let message_id = id("message");
        self.chat_threads[index].messages.push(ChatMessage {
            id: message_id.clone(),
            role: role.into(),
            content,
            created_at: now(),
            source: source.into(),
        });
        Ok(message_id)
    }
    pub(super) fn apply_governance(&mut self, action: &str, p: &Value) -> Result<bool> {
        match action {
            "configure_policy" => {
                let mut policy = self.policy.clone();
                if let Some(mode) = opt_string(p, "approvalMode", 30)? {
                    if !["review", "autonomous"].contains(&mode.as_str()) {
                        return Err(fail("INVALID_INPUT", "Unknown approval mode"));
                    }
                    policy.approval_mode = mode;
                }
                if p.get("dispatchPaused").is_some() {
                    policy.dispatch_paused = boolean(p, "dispatchPaused", false)?;
                }
                if p.get("hardCapUsd").is_some() {
                    policy.budget.hard_cap_usd = number(p, "hardCapUsd", 0.0, 1000000.0)?;
                }
                if p.get("warningPercent").is_some() {
                    policy.budget.warning_percent = number(p, "warningPercent", 1.0, 100.0)?;
                }
                if let Some(value) = p.get("hardCapTokens") {
                    policy.budget.hard_cap_tokens = if value.is_null() {
                        None
                    } else {
                        Some(integer(p, "hardCapTokens", 0, 1000000000000)?)
                    };
                }
                self.policy = policy;
                self.requeue_waiting_admission();
                self.log("owner", action, "global-policy", "Updated application admission policy. Reservations already in flight remain valid; checkpoints and accounting history are retained".into());
                self.last_action = Some(json!({"updated":true}));
            }
            "reserve_external" => {
                let attempt_id = string(p, "attemptId", 200)?;
                let source = string(p, "source", 100)?;
                let cost = number(p, "reservedUsd", 0.0, 1000000.0)?;
                let tokens = integer(p, "maxTokens", 1, 1000000000)?;
                if let Some(existing) = self
                    .external_attempts
                    .iter()
                    .find(|a| a.attempt_id == attempt_id)
                {
                    if existing.source != source
                        || (existing.reserved_usd - cost).abs() > 1e-9
                        || existing.max_tokens != tokens
                    {
                        return Err(fail(
                            "ALREADY_RESERVED",
                            "Attempt identifier already represents a different reservation",
                        ));
                    }
                    self.last_action = Some(
                        json!({"attemptId":attempt_id,"reserved":!existing.settled,"reason":if existing.settled {"already-settled"} else {"existing-reservation"}}),
                    );
                } else if !self.can_reserve(cost, tokens) {
                    self.last_action = Some(
                        json!({"attemptId":attempt_id,"reserved":false,"reason":"global-budget"}),
                    );
                } else {
                    if self.external_attempts.len() >= 10000 {
                        return Err(fail(
                            "CAPACITY",
                            "External attempt ledger reached its limit; no request was admitted",
                        ));
                    }
                    let stamp = now();
                    self.external_attempts.push(ExternalAttempt {
                        attempt_id: attempt_id.clone(),
                        source,
                        reserved_usd: cost,
                        max_tokens: tokens,
                        usage: Usage {
                            input_tokens: tokens,
                            output_tokens: 0,
                            cost_usd: cost,
                        },
                        cost_status: "reserved".into(),
                        settled: false,
                        created_at: stamp.clone(),
                        updated_at: stamp,
                    });
                    self.last_action = Some(json!({"attemptId":attempt_id,"reserved":true}));
                    self.log(
                        "worker",
                        action,
                        &attempt_id,
                        "Reserved shared application budget for a managed project or chat request"
                            .into(),
                    );
                }
            }
            "settle_external" => {
                let attempt_id = string(p, "attemptId", 200)?;
                let input = integer(p, "inputTokens", 0, 1000000000)?;
                let output = integer(p, "outputTokens", 0, 1000000000)?;
                let cost = number(p, "costUsd", 0.0, 1000000.0)?;
                let status = string(p, "costStatus", 20)?;
                if !["observed", "estimated"].contains(&status.as_str()) {
                    return Err(fail(
                        "INVALID_INPUT",
                        "Settlement requires observed or estimated evidence",
                    ));
                }
                let attempt = self
                    .external_attempts
                    .iter_mut()
                    .find(|a| a.attempt_id == attempt_id)
                    .ok_or_else(|| fail("NOT_FOUND", "Reservation not found"))?;
                if attempt.settled
                    && (attempt.usage.input_tokens != input
                        || attempt.usage.output_tokens != output
                        || (attempt.usage.cost_usd - cost).abs() > 1e-9
                        || attempt.cost_status != status)
                {
                    return Err(fail(
                        "ALREADY_SETTLED",
                        "This attempt was already settled; accounting cannot be overwritten",
                    ));
                }
                attempt.usage = Usage {
                    input_tokens: input,
                    output_tokens: output,
                    cost_usd: cost,
                };
                attempt.cost_status = status;
                attempt.settled = true;
                attempt.updated_at = now();
                self.last_action = Some(json!({"attemptId":attempt_id,"settled":true}));
                self.log("worker", action, &attempt_id, "Recorded actual or conservatively estimated provider usage in the shared ledger".into());
            }
            "approve_job" => {
                let job_id = string(p, "jobId", 100)?;
                let job = self
                    .jobs
                    .iter_mut()
                    .find(|j| j.id == job_id)
                    .ok_or_else(|| fail("NOT_FOUND", "Job not found"))?;
                if job.started_at.is_some() || terminal(&job.status) {
                    return Err(fail(
                        "INVALID_TRANSITION",
                        "Only undispatched work can be approved",
                    ));
                }
                job.authorized = true;
                job.updated_at = now();
                self.log(
                    "owner",
                    action,
                    &job_id,
                    "Owner approved this job within its existing fixed limits".into(),
                );
            }
            "bootstrap_directors" => {
                let company_id = string(p, "companyId", 100)?;
                self.bootstrap_directors(&company_id)?;
                self.last_action = Some(json!({"companyId":company_id,"bootstrapped":true}));
            }
            "post_chat" | "post_assistant_message" => {
                let scope: Scope = decode(p.get("scope").unwrap_or(&Value::Null), "scope")?;
                let content = string(p, "content", 12000)?;
                let message_id = self.append_chat(
                    scope,
                    content,
                    if action == "post_chat" {
                        "user"
                    } else {
                        "assistant"
                    },
                    if action == "post_chat" {
                        "user"
                    } else {
                        "provider"
                    },
                )?;
                self.last_action = Some(json!({"messageId":message_id}));
            }
            "import_cloud_message" => {
                // Data-only ingestion: a saved website message cannot start a
                // provider, create a goal, or settle native usage accounting.
                let message_id = string(p, "id", 100)?;
                if message_id
                    .strip_prefix("cloud-")
                    .and_then(|value| Uuid::parse_str(value).ok())
                    .is_none()
                {
                    return Err(fail("INVALID_INPUT", "Expected a cloud message UUID"));
                }
                let scope: Scope = decode(p.get("scope").unwrap_or(&Value::Null), "scope")?;
                self.scope_company(&scope)?;
                let role = string(p, "role", 20)?;
                if !["user", "assistant"].contains(&role.as_str()) {
                    return Err(fail("INVALID_INPUT", "Unsupported cloud message role"));
                }
                let content = p
                    .get("content")
                    .and_then(Value::as_str)
                    .ok_or_else(|| fail("INVALID_INPUT", "Missing cloud message content"))?
                    .to_owned();
                cloud_message_text(&content)?;
                let created_at = string(p, "createdAt", 64)?;
                timestamp(&created_at)?;
                if let Some((thread, message)) = self.chat_threads.iter().find_map(|thread| {
                    thread
                        .messages
                        .iter()
                        .find(|m| m.id == message_id)
                        .map(|m| (thread, m))
                }) {
                    if thread.scope != scope
                        || message.role != role
                        || message.content != content
                        || message.created_at != created_at
                        || message.source != "cloud"
                    {
                        return Err(fail(
                            "REMOTE_RECEIPT_MISMATCH",
                            "Cloud message identity already has different content",
                        ));
                    }
                    self.last_action = Some(json!({"messageId":message_id,"imported":false}));
                } else {
                    let local_id = self.append_chat(scope, content, &role, "cloud")?;
                    let saved = self
                        .chat_threads
                        .iter_mut()
                        .flat_map(|thread| &mut thread.messages)
                        .find(|message| message.id == local_id)
                        .expect("append_chat added the message");
                    saved.id = message_id.clone();
                    saved.created_at = created_at;
                    self.last_action = Some(json!({"messageId":message_id,"imported":true}));
                }
            }
            "create_paired_workflow" => {
                let request_id = string(p, "requestId", 100)?;
                if !safe_id(&request_id) { return Err(fail("INVALID_INPUT", "Invalid workflow request ID")); }
                let mut semantic = p.clone();
                semantic.as_object_mut().ok_or_else(|| fail("INVALID_INPUT", "Expected workflow object"))?.remove("action");
                let digest = format!("{:x}", Sha256::digest(serde_json::to_vec(&semantic).map_err(|_| fail("INVALID_INPUT", "Invalid workflow payload"))?));
                if let Some(existing) = self.goals.iter().find(|g| g.source_request_id.as_deref() == Some(&request_id)) {
                    if existing.request_sha256.as_deref() != Some(&digest) { return Err(fail("WORKFLOW_IDEMPOTENCY_CONFLICT", "This request ID already identifies a different workflow; use its original body to recover the receipt")); }
                    self.last_action = Some(json!({"goalId":existing.id,"messageId":existing.source_message_id,"planned":true,"started":existing.iteration > 0,"jobIds":existing.job_ids,"replayed":true}));
                    return Ok(true);
                }
                let scope: Scope = decode(p.get("scope").unwrap_or(&Value::Null), "scope")?;
                let content = string(p, "content", 12000)?;
                let execute = boolean(p, "execute", false)?;
                // The user brief, plan and optional bounded dispatch commit together.
                // This candidate is discarded on any planning, scope or budget error.
                let extra = opt_string(p, "description", 16000)?.unwrap_or_default();
                let durable_brief = if extra.is_empty() || extra == content { content.clone() }
                    else { format!("Source brief:\n{content}\n\nAdditional context:\n{extra}") };
                bounded_text(&durable_brief, 16000, "combined source brief and description")?;
                let mut goal_payload = p.clone();
                goal_payload["description"] = json!(durable_brief);
                let mut candidate = self.clone();
                let message_id = candidate.append_chat(scope, content, "user", "user")?;
                candidate.apply_governance("create_goal", &goal_payload)?;
                let goal_id = candidate.last_action.as_ref().and_then(|a| a["goalId"].as_str()).unwrap().to_owned();
                candidate.apply_governance("plan_goal", &json!({"goalId":goal_id}))?;
                if execute { candidate.apply_governance("execute_goal", &json!({"goalId":goal_id}))?; }
                let goal = candidate.goals.iter_mut().find(|g| g.id == goal_id).unwrap();
                goal.source_request_id = Some(request_id);
                goal.request_sha256 = Some(digest);
                goal.source_message_id = Some(message_id.clone());
                candidate.last_action = Some(json!({"goalId":goal_id,"messageId":message_id,"planned":true,"started":goal.iteration > 0,"jobIds":goal.job_ids,"replayed":false}));
                *self = candidate;
            }
            "create_goal" => {
                if self.goals.len() >= 2000 {
                    return Err(fail(
                        "CAPACITY",
                        "Goal registry reached 2000; all existing goals were retained",
                    ));
                }
                let scope: Scope = decode(p.get("scope").unwrap_or(&Value::Null), "scope")?;
                let company = self.scope_company(&scope)?;
                let mode = opt_string(p, "mode", 20)?.unwrap_or_else(|| "plan".into());
                if !["plan", "execute"].contains(&mode.as_str()) {
                    return Err(fail("INVALID_INPUT", "Goal mode must be plan or execute"));
                }
                let settings = match p.get("runSettings") {
                    None | Some(Value::Null) => GoalRunSettings::default(),
                    Some(v) => decode(v, "goal run settings")?,
                };
                let stamp = now();
                let goal = Goal {
                    id: id("goal"),
                    company_id: company,
                    scope,
                    title: string(p, "title", 200)?,
                    description: opt_string(p, "description", 16000)?.unwrap_or_default(),
                    mode,
                    status: "draft".into(),
                    max_iterations: if p.get("maxIterations").is_some() {
                        integer(p, "maxIterations", 1, 10)?
                    } else {
                        1
                    },
                    iteration: 0,
                    job_ids: vec![],
                    steps: vec![],
                    run_settings: settings,
                    created_at: stamp.clone(),
                    updated_at: stamp,
                    stop_reason: None,
                    source_request_id: None, request_sha256: None, source_message_id: None,
                };
                self.validate_run_settings(&goal)?;
                self.last_action = Some(json!({"goalId":goal.id}));
                self.log(
                    "donna",
                    action,
                    &goal.id,
                    "Created a durable goal with explicit iteration and per-request limits".into(),
                );
                self.goals.push(goal);
            }
            "plan_goal" | "set_goal_plan" => {
                let goal_id = string(p, "goalId", 100)?;
                let index = self
                    .goals
                    .iter()
                    .position(|g| g.id == goal_id)
                    .ok_or_else(|| fail("NOT_FOUND", "Goal not found"))?;
                let mut goal = self.goals[index].clone();
                if goal.iteration > 0 {
                    return Err(fail(
                        "IMMUTABLE_PLAN",
                        "Started goal plans are immutable; create a new goal for a changed plan",
                    ));
                }
                if let Some(mode) = opt_string(p, "mode", 20)? {
                    if !["plan", "execute"].contains(&mode.as_str()) {
                        return Err(fail("INVALID_INPUT", "Unknown goal mode"));
                    }
                    goal.mode = mode;
                }
                if let Some(settings) = p.get("runSettings") {
                    goal.run_settings = decode(settings, "goal run settings")?;
                }
                self.validate_run_settings(&goal)?;
                if action == "set_goal_plan" {
                    goal.steps = decode(p.get("steps").unwrap_or(&Value::Null), "goal steps")?;
                } else {
                    let candidates: Vec<(String, Option<String>)> = if goal.scope.kind == "employee"
                    {
                        vec![(goal.scope.id.clone(), None)]
                    } else {
                        [
                            "subdirector",
                            "code-engineer",
                            "qa-lead",
                            "knowledge-curator",
                        ]
                        .into_iter()
                        .filter_map(|key| {
                            let service_key = match key {
                                "code-engineer" => Some("engineering"),
                                "qa-lead" => Some("security"),
                                "knowledge-curator" => Some("research-knowledge"),
                                _ => None,
                            };
                            if let Some(service_key) = service_key {
                                let borrowed = self
                                    .portfolio
                                    .contracts
                                    .iter()
                                    .filter(|c| {
                                        c.recipient_company_id == goal.company_id
                                            && c.status == "active"
                                    })
                                    .filter(|c| {
                                        self.portfolio.services.iter().any(|s| {
                                            s.id == c.service_id
                                                && s.key == service_key
                                                && s.status == "active"
                                        })
                                    })
                                    .find_map(|c| {
                                        c.employee_ids
                                            .iter()
                                            .find(|e| {
                                                self.staff(e).is_ok_and(|e| e.status == "active")
                                                    && self
                                                        .goal_employee_scope(&goal, e, Some(&c.id))
                                                        .is_ok()
                                            })
                                            .map(|e| (e.clone(), Some(c.id.clone())))
                                    });
                                if borrowed.is_some() {
                                    return borrowed;
                                }
                            }
                            self.employees
                                .iter()
                                .find(|e| {
                                    e.company_id.as_deref() == Some(&goal.company_id)
                                        && e.assignment_key.as_deref() == Some(key)
                                        && e.status == "active"
                                })
                                .filter(|e| self.goal_employee_scope(&goal, &e.id, None).is_ok())
                                .map(|e| (e.id.clone(), None))
                        })
                        .collect()
                    };
                    let candidates = if candidates.is_empty() {
                        vec![(
                            match goal.scope.kind.as_str() {
                                "office" => self.office(&goal.scope.id)?.assistant_id.clone(),
                                "department" => self
                                    .departments
                                    .iter()
                                    .find(|d| d.id == goal.scope.id)
                                    .unwrap()
                                    .assistant_id
                                    .clone(),
                                _ => self.company(&goal.company_id)?.assistant_id.clone(),
                            },
                            None,
                        )]
                    } else {
                        candidates
                    };
                    goal.steps = candidates.iter().enumerate().map(|(i, (employee, contract))| GoalStep { id: format!("step-{}", i + 1), title: shortened(format!("{} — {}", self.staff(employee).unwrap().name, goal.title), 200), employee_id: employee.clone(), goal: format!("{}\n{}\nResponsibility: {}. Produce conclusions, evidence and a concise handoff. Do not invent completed work or expose hidden reasoning.", goal.title, goal.description, self.staff(employee).unwrap().role), depends_on: if i == 0 { vec![] } else { vec![format!("step-{i}")] }, service_contract_id: contract.clone(), knowledge_transfer_ids: vec![], reviewer_employee_id: None, reviewer_service_contract_id: None, estimate: None, review_estimate: None }).collect();
                }
                if action == "plan_goal" { self.assign_goal_reviewers(&mut goal)?; }
                self.validate_goal_steps(&goal)?;
                self.require_paired_steps(&goal)?;
                if goal.steps.is_empty() {
                    return Err(fail("INVALID_INPUT", "A plan needs at least one step"));
                }
                goal.status = "planned".into();
                goal.updated_at = now();
                self.append_chat(goal.scope.clone(), format!("Local planner created {} assigned steps for “{}”, with a maximum of {} iteration(s). No model request has been made.", goal.steps.len(), goal.title, goal.max_iterations), "system", "local")?;
                self.goals[index] = goal;
                self.last_action = Some(json!({"goalId":goal_id,"planned":true,"source":"local"}));
            }
            "execute_goal" | "advance_goal" => {
                let goal_id = string(p, "goalId", 100)?;
                let reviewed = boolean(p, "reviewed", false)?;
                let index = self
                    .goals
                    .iter()
                    .position(|g| g.id == goal_id)
                    .ok_or_else(|| fail("NOT_FOUND", "Goal not found"))?;
                if action == "execute_goal" && self.goals[index].iteration != 0 {
                    return Err(fail(
                        "ALREADY_STARTED",
                        "Use an explicit advance with a reason for the next bounded iteration",
                    ));
                }
                if action == "advance_goal" {
                    let reason = string(p, "reason", 4000)?;
                    if self.goals[index].iteration == 0 {
                        return Err(fail(
                            "INVALID_TRANSITION",
                            "Start the first goal iteration before advancing",
                        ));
                    }
                    if self.checkpoints.len() >= 20000 {
                        return Err(fail("CAPACITY", "Checkpoint limit reached"));
                    }
                    self.checkpoints.push(Checkpoint {
                        id: id("checkpoint"),
                        goal_id: goal_id.clone(),
                        job_id: None,
                        iteration: self.goals[index].iteration,
                        summary: format!("Owner requested another iteration: {reason}"),
                        artifact_uri: None,
                        created_at: now(),
                    });
                }
                // An explicit owner approval applies to this iteration. Copy it
                // into the created immutable jobs without silently authorizing
                // all future iterations of an otherwise unapproved goal.
                let previously_authorized = self.goals[index].run_settings.authorized;
                if reviewed {
                    self.goals[index].run_settings.authorized = true;
                }
                let result = self.start_goal_iteration(index);
                self.goals[index].run_settings.authorized = previously_authorized;
                result?;
                if reviewed {
                    self.log(
                        "owner",
                        "goal-iteration-approved",
                        &goal_id,
                        format!(
                            "Explicitly approved iteration {} within its existing fixed limits",
                            self.goals[index].iteration
                        ),
                    );
                }
            }
            "tick_goals" => {
                let mut advanced = vec![];
                if self.policy.approval_mode == "autonomous" && !self.policy.dispatch_paused {
                    for i in 0..self.goals.len() {
                        let goal = &self.goals[i];
                        if goal.mode != "execute"
                            || goal.run_settings.mode != "provider"
                            || goal.status != "completed"
                            || goal.iteration == 0
                            || goal.iteration >= goal.max_iterations
                            || goal.stop_reason.as_deref() == Some("time-target")
                        {
                            continue;
                        }
                        if self.summarize_budget().at_cap {
                            self.goals[i].stop_reason = Some("global-budget".into());
                            continue;
                        }
                        let first = goal
                            .job_ids
                            .iter()
                            .filter_map(|id| self.jobs.iter().find(|j| &j.id == id))
                            .filter_map(|j| timestamp(&j.created_at).ok())
                            .min();
                        if first.is_some_and(|start| {
                            OffsetDateTime::now_utc() - start
                                >= Duration::milliseconds(
                                    (goal.run_settings.max_minutes * 60000.0) as i64,
                                )
                        }) {
                            let goal_id = goal.id.clone();
                            self.goals[i].stop_reason = Some("time-target".into());
                            self.log("system", "goal-target-reached", &goal_id, "Soft time target reached between iterations. No in-flight call was killed; all checkpoints remain available".into());
                            continue;
                        }
                        let goal_id = goal.id.clone();
                        match self.start_goal_iteration(i) {
                            Ok(()) => advanced.push(goal_id),
                            Err(error) => {
                                self.goals[i].status = "needs-review".into();
                                self.goals[i].stop_reason = Some(error.code.into());
                                self.log("system", "goal-loop-blocked", &goal_id, error.message);
                            }
                        }
                        if advanced.len() >= 10 {
                            break;
                        }
                    }
                }
                self.last_action = Some(json!({"advancedGoalIds":advanced}));
            }
            "pause_goal" | "resume_goal" => {
                let goal_id = string(p, "goalId", 100)?;
                let goal = self
                    .goals
                    .iter_mut()
                    .find(|g| g.id == goal_id)
                    .ok_or_else(|| fail("NOT_FOUND", "Goal not found"))?;
                if action == "resume_goal" && goal.status != "paused" {
                    return Err(fail("INVALID_TRANSITION", "Only paused goals can resume"));
                }
                goal.status = if action == "pause_goal" {
                    "paused"
                } else if goal.iteration > 0 {
                    "running"
                } else {
                    "planned"
                }
                .into();
                goal.updated_at = now();
                goal.stop_reason = if action == "pause_goal" {
                    Some("owner-paused".into())
                } else {
                    None
                };
                for job in self
                    .jobs
                    .iter_mut()
                    .filter(|j| j.goal_id.as_deref() == Some(&goal_id) && j.started_at.is_none())
                {
                    if action == "pause_goal"
                        && ["queued", "waiting-budget"].contains(&job.status.as_str())
                    {
                        job.status = "paused".into();
                    } else if action == "resume_goal" && job.status == "paused" {
                        job.status = "queued".into();
                    }
                }
                self.log("owner", action, &goal_id, "Updated future goal dispatch; reserved calls and completed checkpoints are retained".into());
            }
            "checkpoint_goal" => {
                let goal_id = string(p, "goalId", 100)?;
                let goal = self
                    .goals
                    .iter()
                    .find(|g| g.id == goal_id)
                    .ok_or_else(|| fail("NOT_FOUND", "Goal not found"))?;
                if self.checkpoints.len() >= 20000 {
                    return Err(fail("CAPACITY", "Checkpoint limit reached"));
                }
                let checkpoint_id = id("checkpoint");
                self.checkpoints.push(Checkpoint {
                    id: checkpoint_id.clone(),
                    goal_id,
                    job_id: None,
                    iteration: goal.iteration,
                    summary: string(p, "summary", 4000)?,
                    artifact_uri: opt_string(p, "artifactUri", 3000)?,
                    created_at: now(),
                });
                self.last_action = Some(json!({"checkpointId":checkpoint_id}));
            }
            "ensure_blueprint" => {
                let office = string(p, "officeId", 100)?;
                let blueprint = self.ensure_blueprint(&office)?;
                self.last_action = Some(json!({"blueprintId":blueprint}));
            }
            "save_blueprint" => {
                let mut blueprint: Blueprint =
                    decode(p.get("blueprint").unwrap_or(&Value::Null), "blueprint")?;
                self.validate_blueprint(&blueprint)?;
                let index = self
                    .blueprints
                    .iter()
                    .position(|b| b.office_id == blueprint.office_id)
                    .ok_or_else(|| fail("NOT_FOUND", "Create the office blueprint first"))?;
                if self.blueprints[index].id != blueprint.id {
                    return Err(fail("IMMUTABLE_ID", "Blueprint identity is immutable"));
                }
                blueprint.revision = next_revision(p, Some(self.blueprints[index].revision))?;
                for board in &mut blueprint.whiteboards {
                    if let Some(previous) = self.blueprints[index].whiteboards.iter().find(|b| b.id == board.id) {
                        if board.revision != previous.revision { return Err(fail("STALE_REVISION", "A whiteboard changed since this blueprint was loaded")); }
                        board.revision = next_revision(&json!({"expectedRevision":board.revision}), Some(previous.revision))?;
                    } else if board.revision != 0 { return Err(fail("STALE_REVISION", "A new whiteboard starts at revision zero")); }
                }
                for desk in &blueprint.desks {
                    if !self.blueprints[index].desks.iter().any(|old| {
                        old.id == desk.id
                            && old.employee_id == desk.employee_id
                            && old.room_id == desk.room_id
                    }) {
                        self.validate_layout_assignment(
                            &blueprint,
                            &desk.room_id,
                            &desk.employee_id,
                        )?;
                    }
                }
                for board in &blueprint.whiteboards {
                    if !self.blueprints[index].whiteboards.iter().any(|old| {
                        old.id == board.id
                            && old.owner_employee_id == board.owner_employee_id
                            && old.room_id == board.room_id
                    }) {
                        self.validate_layout_assignment(
                            &blueprint,
                            &board.room_id,
                            &board.owner_employee_id,
                        )?;
                    }
                }
                self.last_action = Some(json!({"blueprintId":blueprint.id}));
                self.blueprints[index] = blueprint;
            }
            "upsert_room" | "place_employee" | "upsert_whiteboard" => {
                let office = string(p, "officeId", 100)?;
                self.ensure_blueprint(&office)?;
                let index = self
                    .blueprints
                    .iter()
                    .position(|b| b.office_id == office)
                    .unwrap();
                let mut b = self.blueprints[index].clone();
                let entity;
                if action == "upsert_room" {
                    entity = opt_string(p, "id", 100)?.unwrap_or_else(|| id("room"));
                    let room = Room {
                        id: entity.clone(),
                        name: string(p, "name", 150)?,
                        department_id: opt_string(p, "departmentId", 100)?,
                        x: number(p, "x", 0.0, 1.0)?,
                        y: number(p, "y", 0.0, 1.0)?,
                        width: if p.get("width").is_some() {
                            number(p, "width", 0.01, 1.0)?
                        } else {
                            0.3
                        },
                        height: if p.get("height").is_some() {
                            number(p, "height", 0.01, 1.0)?
                        } else {
                            0.3
                        },
                    };
                    if let Some(r) = b.rooms.iter_mut().find(|r| r.id == entity) {
                        *r = room;
                    } else {
                        b.rooms.push(room);
                    }
                } else if action == "place_employee" {
                    let employee = string(p, "employeeId", 100)?;
                    entity = b
                        .desks
                        .iter()
                        .find(|d| d.employee_id == employee)
                        .map(|d| d.id.clone())
                        .unwrap_or_else(|| id("desk"));
                    let desk = Desk {
                        id: entity.clone(),
                        employee_id: employee,
                        room_id: string(p, "roomId", 100)?,
                        x: number(p, "x", 0.0, 1.0)?,
                        y: number(p, "y", 0.0, 1.0)?,
                    };
                    self.validate_layout_assignment(&b, &desk.room_id, &desk.employee_id)?;
                    if let Some(d) = b.desks.iter_mut().find(|d| d.id == entity) {
                        *d = desk;
                    } else {
                        b.desks.push(desk);
                    }
                } else {
                    entity = opt_string(p, "id", 100)?.unwrap_or_else(|| id("whiteboard"));
                    let revision = next_revision(p, b.whiteboards.iter().find(|w| w.id == entity).map(|w| w.revision))?;
                    let board = Whiteboard {
                        id: entity.clone(),
                        room_id: string(p, "roomId", 100)?,
                        owner_employee_id: string(p, "ownerEmployeeId", 100)?,
                        title: string(p, "title", 200)?,
                        goal_ids: strings(p, "goalIds", 100)?,
                        job_ids: strings(p, "jobIds", 100)?,
                        roadmap_item_ids: strings(p, "roadmapItemIds", 100)?,
                        x: number(p, "x", 0.0, 1.0)?,
                        y: number(p, "y", 0.0, 1.0)?,
                        revision,
                    };
                    self.validate_layout_assignment(&b, &board.room_id, &board.owner_employee_id)?;
                    if let Some(w) = b.whiteboards.iter_mut().find(|w| w.id == entity) {
                        *w = board;
                    } else {
                        b.whiteboards.push(board);
                    }
                }
                b.revision = next_revision(&json!({"expectedRevision":b.revision}), Some(b.revision))?;
                self.validate_blueprint(&b)?;
                self.blueprints[index] = b;
                self.last_action = Some(json!({"id":entity}));
            }
            "record_github_activity" => {
                let company = string(p, "companyId", 100)?;
                self.company(&company)?;
                let summary = string(p, "summary", 1000)?;
                let evidence = string(p, "evidenceUrl", 1000)?;
                if !evidence.starts_with("https://github.com/")
                    && !evidence.starts_with("https://api.github.com/")
                {
                    return Err(fail(
                        "INVALID_INPUT",
                        "GitHub evidence must use an official GitHub URL",
                    ));
                }
                self.log(
                    "github-steward",
                    action,
                    &company,
                    format!("{summary} — {evidence}"),
                );
            }
            _ => return Ok(false),
        }
        self.sync_goal_checkpoints()?;
        self.sync_decision_panels();
        self.requeue_waiting_admission();
        self.refresh_budget();
        Ok(true)
    }
    pub(super) fn validate_governance(&self) -> Result<()> {
        if !["review", "autonomous"].contains(&self.policy.approval_mode.as_str())
            || !self.policy.budget.hard_cap_usd.is_finite()
            || !(0.0..=1000000.0).contains(&self.policy.budget.hard_cap_usd)
            || !(1.0..=100.0).contains(&self.policy.budget.warning_percent)
            || self
                .policy
                .budget
                .hard_cap_tokens
                .is_some_and(|t| t > 1000000000000)
            || self.external_attempts.len() > 10000
            || self.chat_threads.len() > 5000
            || self.goals.len() > 2000
            || self.checkpoints.len() > 20000
            || self.blueprints.len() > 5000
        {
            return Err(fail(
                "OFFICE_STATE_INVALID",
                "Invalid governance policy or collection bound",
            ));
        }
        let mut attempts = HashSet::new();
        for a in &self.external_attempts {
            if !attempts.insert(&a.attempt_id)
                || !["reserved", "observed", "estimated"].contains(&a.cost_status.as_str())
                || !a.usage.cost_usd.is_finite()
                || a.usage.cost_usd < 0.0
                || !a.reserved_usd.is_finite()
                || a.reserved_usd < 0.0
                || a.max_tokens == 0
            {
                return Err(fail(
                    "OFFICE_STATE_INVALID",
                    "Invalid external attempt accounting",
                ));
            }
        }
        let mut scopes = HashSet::new();
        let mut messages = 0;
        for thread in &self.chat_threads {
            self.scope_company(&thread.scope)?;
            if !scopes.insert(&thread.scope) || thread.messages.len() > 2000 {
                return Err(fail(
                    "OFFICE_STATE_INVALID",
                    "Duplicate conversation scope or excessive history",
                ));
            }
            messages += thread.messages.len();
            for message in &thread.messages {
                if !["user", "assistant", "system"].contains(&message.role.as_str())
                    || !["user", "local", "provider", "cloud"].contains(&message.source.as_str())
                {
                    return Err(fail("OFFICE_STATE_INVALID", "Invalid message provenance"));
                }
                if message.source == "cloud" {
                    cloud_message_text(&message.content)?;
                } else {
                    bounded_text(&message.content, 12000, "message")?;
                }
            }
        }
        if messages > 10000 {
            return Err(fail(
                "OFFICE_STATE_INVALID",
                "Conversation history exceeds capacity",
            ));
        }
        let goal_ids: HashSet<_> = self.goals.iter().map(|g| &g.id).collect();
        if goal_ids.len() != self.goals.len() {
            return Err(fail("OFFICE_STATE_INVALID", "Duplicate goal identity"));
        }
        let mut workflow_requests = HashSet::new();
        for goal in &self.goals {
            self.company(&goal.company_id)?;
            if !(goal.scope.kind == "employee" && goal.scope.id == "donna")
                && self.scope_company(&goal.scope)? != goal.company_id
            {
                return Err(fail(
                    "SCOPE_MISMATCH",
                    "Goal scope belongs to another company",
                ));
            }
            if !safe_id(&goal.id)
                || !["plan", "execute"].contains(&goal.mode.as_str())
                || ![
                    "draft",
                    "planned",
                    "running",
                    "paused",
                    "completed",
                    "needs-review",
                ]
                .contains(&goal.status.as_str())
                || !(1..=10).contains(&goal.max_iterations)
                || goal.iteration > goal.max_iterations
                || goal.job_ids.len() > 240
            {
                return Err(fail("OFFICE_STATE_INVALID", "Invalid bounded goal"));
            }
            self.validate_run_settings(goal)?;
            match (&goal.source_request_id, &goal.request_sha256, &goal.source_message_id) {
                (None, None, None) => {},
                (Some(request), Some(digest), Some(message)) if safe_id(request) && workflow_requests.insert(request)
                    && digest.len() == 64 && digest.bytes().all(|c| c.is_ascii_hexdigit())
                    && self.chat_threads.iter().any(|t| t.scope == goal.scope && t.messages.iter().any(|m| &m.id == message && m.role == "user" && m.source == "user")) => {},
                _ => return Err(fail("OFFICE_STATE_INVALID", "Invalid immutable paired workflow receipt")),
            }
            // Historical plans retain fired employee references; only dispatch
            // validates present availability. Structural links remain immutable.
            for step in &goal.steps {
                self.staff(&step.employee_id)?;
                if let Some(reviewer) = &step.reviewer_employee_id { self.staff(reviewer)?; if reviewer == &step.employee_id { return Err(fail("OFFICE_STATE_INVALID", "A step cannot review itself")); } }
                if let Some(estimate) = &step.estimate { estimate.validate()?; }
                if let Some(estimate) = &step.review_estimate { estimate.validate()?; }
            }
            if goal.job_ids.iter().any(|j| {
                !self.jobs.iter().any(|x| {
                    &x.id == j
                        && x.goal_id.as_ref() == Some(&goal.id)
                        && x.company_id == goal.company_id
                })
            }) {
                return Err(fail("OFFICE_STATE_INVALID", "Broken goal job reference"));
            }
        }
        for checkpoint in &self.checkpoints {
            if !goal_ids.contains(&checkpoint.goal_id)
                || checkpoint.job_id.as_ref().is_some_and(|j| {
                    !self
                        .jobs
                        .iter()
                        .any(|x| &x.id == j && x.goal_id.as_ref() == Some(&checkpoint.goal_id))
                })
            {
                return Err(fail("OFFICE_STATE_INVALID", "Broken checkpoint reference"));
            }
        }
        let mut offices = HashSet::new();
        for b in &self.blueprints {
            if !offices.insert(&b.office_id) {
                return Err(fail("OFFICE_STATE_INVALID", "Duplicate office blueprint"));
            }
            self.validate_blueprint(b)?;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn state() -> OfficeSnapshot {
        let company: Company = serde_json::from_value(json!({"id":"atlas","name":"Atlas","repoUrl":"https://github.com/example/atlas","owner":"example","repo":"atlas","githubStatus":"unchecked"})).unwrap();
        OfficeSnapshot::seeded(&company, &[]).unwrap()
    }
    fn job(s: &mut OfficeSnapshot, key: &str) -> String {
        s.apply(&json!({"action":"enqueue_job","companyId":"atlas","officeId":s.offices[0].id,"employeeId":"donna","goal":"Evidence review","mode":"manual","maxTokens":100,"maxUsd":1,"maxMinutes":5,"idempotencyKey":key})).unwrap();
        s.last_action.as_ref().unwrap()["jobId"]
            .as_str()
            .unwrap()
            .into()
    }
    fn claim(s: &mut OfficeSnapshot) -> (String, String) {
        s.apply(&json!({"action":"claim_job","workerId":"test-worker"}))
            .unwrap();
        let result = s.last_action.as_ref().unwrap();
        (
            result["jobId"].as_str().unwrap().into(),
            result["leaseToken"].as_str().unwrap().into(),
        )
    }
    fn finish(s: &mut OfficeSnapshot, job: &str, lease: &str) {
        s.apply(&json!({"action":"finish_job","jobId":job,"leaseToken":lease,"status":"completed","inputTokens":10,"outputTokens":10,"costUsd":0.1,"costStatus":"observed","summary":"Verified result and evidence.","artifactUri":"/tmp/test-result.md","artifactSha256":"a".repeat(64)})).unwrap();
    }
    fn finish_review(s: &mut OfficeSnapshot, primary: &str) {
        let (review, lease) = claim(s);
        assert_eq!(s.jobs.iter().find(|j| j.id == review).unwrap().pair.as_ref().unwrap().primary_job_id, primary);
        s.apply(&json!({"action":"reserve_job","jobId":review,"leaseToken":lease,"inputTokens":10,"maxOutputTokens":20,"costUsd":0.1})).unwrap();
        finish(s, &review, &lease);
        s.apply(&json!({"action":"record_step_review","jobId":review,"leaseToken":lease,"primaryJobId":primary,"primaryArtifactSha256":"a".repeat(64),"reviewArtifactSha256":"a".repeat(64),"primaryArtifactComplete":true,"verdict":"accepted","summary":"Independently verified the complete fixture artifact","evidenceRefs":["fixture:verified"]})).unwrap();
    }
    fn finish_pair(s: &mut OfficeSnapshot, primary: &str, lease: &str) {
        finish(s, primary, lease);
        finish_review(s, primary);
    }
    fn goal(s: &mut OfficeSnapshot, mode: &str, provider: bool, iterations: u64) -> String {
        s.apply(&json!({"action":"create_goal","scope":{"kind":"office","id":s.offices[0].id},"title":"Inspect the repository","mode":mode,"maxIterations":iterations,"runSettings":{"mode":if provider {"provider"} else {"manual"},"provider":"anthropic","model":if provider {"test-model"} else {""},"authorized":false,"maxTokens":100,"maxUsd":1,"maxMinutes":15,"priceRates":{"inputUsdPerMillion":1,"outputUsdPerMillion":1}}})).unwrap();
        let goal = s.last_action.as_ref().unwrap()["goalId"]
            .as_str()
            .unwrap()
            .to_string();
        s.apply(&json!({"action":"set_goal_plan","goalId":goal,"steps":[{"id":"inspect","title":"Inspect","employeeId":"donna","reviewerEmployeeId":s.offices[0].assistant_id,"goal":"Inspect repository evidence","dependsOn":[]}]}))
            .unwrap();
        goal
    }
    #[test]
    fn migration_adds_persistent_definitions_once_and_preserves_old_records() {
        let s = state();
        let old_ids: Vec<_> = s.employees.iter().map(|e| e.id.clone()).collect();
        let mut old = serde_json::to_value(&s).unwrap();
        for key in [
            "policy",
            "budget",
            "externalAttempts",
            "chatThreads",
            "goals",
            "checkpoints",
            "blueprints",
        ] {
            old.as_object_mut().unwrap().remove(key);
        }
        let mut migrated: OfficeSnapshot = serde_json::from_value(old).unwrap();
        assert!(migrated.migrate_governance().unwrap());
        assert!(!migrated.migrate_governance().unwrap());
        assert_eq!(migrated.policy.budget.hard_cap_usd, 10.0);
        assert_eq!(
            migrated
                .employees
                .iter()
                .map(|e| e.id.clone())
                .collect::<Vec<_>>(),
            old_ids
        );
        assert_eq!(migrated.blueprints.len(), 1);
        migrated.validate().unwrap();
    }
    #[test]
    fn global_reservations_pause_new_calls_and_allow_in_flight_settlement() {
        let mut s = state();
        s.apply(&json!({"action":"configure_policy","hardCapUsd":1,"warningPercent":50}))
            .unwrap();
        job(&mut s, "first");
        job(&mut s, "second");
        let (first, lease) = claim(&mut s);
        s.apply(&json!({"action":"reserve_job","jobId":first,"leaseToken":lease,"inputTokens":10,"maxOutputTokens":20,"costUsd":0.6})).unwrap();
        let (second, second_lease) = claim(&mut s);
        s.apply(&json!({"action":"reserve_job","jobId":second,"leaseToken":second_lease,"inputTokens":10,"maxOutputTokens":20,"costUsd":0.6})).unwrap();
        assert_eq!(s.last_action.as_ref().unwrap()["reserved"], false);
        assert_eq!(s.jobs.iter().find(|j| j.id == second).unwrap().status, "waiting-budget");
        assert!(s.jobs.iter().find(|j| j.id == second).unwrap().started_at.is_none());
        assert!(s.budget.warning);
        assert_eq!(s.budget.reserved_usd, 0.6);
        s.apply(&json!({"action":"configure_policy","hardCapUsd":0.2,"dispatchPaused":true}))
            .unwrap();
        assert_eq!(s.jobs[0].status, "running");
        finish(&mut s, &first, &lease);
        assert_eq!(s.jobs[0].status, "completed");
        assert_eq!(s.budget.observed_usd, 0.1);
        assert!(s.jobs[0].artifact_uri.is_some());
        s.apply(&json!({"action":"configure_policy","hardCapUsd":1,"dispatchPaused":false}))
            .unwrap();
        finish_review(&mut s, &first);
        assert_eq!(claim(&mut s).0, second);
        s.validate().unwrap();
    }
    #[test]
    fn external_and_employee_usage_share_token_caps_and_idempotent_settlement() {
        let mut s = state();
        s.apply(&json!({"action":"configure_policy","hardCapTokens":80}))
            .unwrap();
        let reserve = json!({"action":"reserve_external","attemptId":"project-1","source":"projects","reservedUsd":0.2,"maxTokens":50});
        s.apply(&reserve).unwrap();
        s.apply(&reserve).unwrap();
        assert_eq!(s.external_attempts.len(), 1);
        job(&mut s, "queue");
        let (j, lease) = claim(&mut s);
        s.apply(&json!({"action":"reserve_job","jobId":j,"leaseToken":lease,"inputTokens":10,"maxOutputTokens":30,"costUsd":0.1})).unwrap();
        assert_eq!(s.jobs[0].status, "waiting-budget");
        assert_eq!(s.budget.committed_tokens, 50);
        let settle = json!({"action":"settle_external","attemptId":"project-1","inputTokens":10,"outputTokens":10,"costUsd":0.05,"costStatus":"observed"});
        s.apply(&settle).unwrap();
        s.apply(&settle).unwrap();
        assert_eq!(s.budget.committed_tokens, 20);
        assert_eq!(s.budget.observed_usd, 0.05);
        assert_eq!(s.apply(&json!({"action":"settle_external","attemptId":"project-1","inputTokens":0,"outputTokens":0,"costUsd":0,"costStatus":"observed"})).unwrap_err().code, "ALREADY_SETTLED");
        s.apply(&reserve).unwrap();
        assert_eq!(s.last_action.unwrap()["reserved"], false);
    }
    #[test]
    fn autonomous_mode_is_explicit_and_never_fakes_a_provider_reply() {
        let mut s = state();
        let g = goal(&mut s, "execute", true, 1);
        assert_eq!(
            s.apply(&json!({"action":"execute_goal","goalId":g}))
                .unwrap_err()
                .code,
            "REVIEW_REQUIRED"
        );
        assert!(s.jobs.is_empty());
        assert!(s.chat_threads[0]
            .messages
            .iter()
            .all(|m| m.source == "local"));
        s.apply(&json!({"action":"configure_policy","approvalMode":"autonomous"}))
            .unwrap();
        s.apply(&json!({"action":"execute_goal","goalId":g}))
            .unwrap();
        let (j, lease) = claim(&mut s);
        s.apply(&json!({"action":"reserve_job","jobId":j,"leaseToken":lease,"inputTokens":10,"maxOutputTokens":20,"costUsd":0.2})).unwrap();
        finish_pair(&mut s, &j, &lease);
        assert_eq!(s.goals[0].status, "completed");
        assert_eq!(s.checkpoints.len(), 2);
        assert_eq!(
            s.chat_threads[0].messages.last().unwrap().source,
            "provider"
        );
        s.migrate_governance().unwrap();
        assert_eq!(s.checkpoints.len(), 2);
        assert_eq!(s.chat_threads[0].messages.len(), 3);
        s.validate().unwrap();
    }
    #[test]
    fn explicit_review_approves_only_the_requested_goal_iteration() {
        let mut s = state();
        let g = goal(&mut s, "execute", true, 2);
        assert_eq!(
            s.apply(&json!({"action":"execute_goal","goalId":g,"reviewed":false}))
                .unwrap_err()
                .code,
            "REVIEW_REQUIRED"
        );
        assert!(s.jobs.is_empty());
        s.apply(&json!({"action":"execute_goal","goalId":g,"reviewed":true}))
            .unwrap();
        assert_eq!(s.jobs.len(), 2);
        assert!(s.jobs[0].authorized);
        assert!(!s.goals[0].run_settings.authorized);
        let (j, lease) = claim(&mut s);
        finish_pair(&mut s, &j, &lease);
        assert_eq!(s.apply(&json!({"action":"advance_goal","goalId":g,"reason":"Review the handoff","reviewed":false})).unwrap_err().code, "REVIEW_REQUIRED");
        assert_eq!(s.jobs.len(), 2);
        s.apply(&json!({"action":"advance_goal","goalId":g,"reason":"Review the handoff","reviewed":true})).unwrap();
        assert_eq!(s.jobs.len(), 4);
        assert!(s.jobs[2].authorized && s.jobs[3].authorized);
        assert_eq!(s.goals[0].iteration, 2);
        assert!(!s.goals[0].run_settings.authorized);
        s.validate().unwrap();
    }
    #[test]
    fn conversation_scope_is_single_durable_thread_and_donna_keeps_goal_company() {
        let mut s = state();
        for message in ["First", "Second"] {
            s.apply(&json!({"action":"post_chat","scope":{"kind":"employee","id":"donna"},"content":message})).unwrap();
        }
        assert_eq!(s.chat_threads.len(), 1);
        assert_eq!(s.chat_threads[0].messages.len(), 2);
        let g = goal(&mut s, "plan", false, 1);
        s.apply(&json!({"action":"create_company","name":"Second","repoUrl":"https://github.com/example/second"})).unwrap();
        assert_eq!(
            s.goals.iter().find(|x| x.id == g).unwrap().company_id,
            "atlas"
        );
        s.validate().unwrap();
    }
    #[test]
    fn bounded_autonomous_iterations_use_previous_handoffs_and_stop_at_limit() {
        let mut s = state();
        s.apply(&json!({"action":"configure_policy","approvalMode":"autonomous"}))
            .unwrap();
        let g = goal(&mut s, "execute", true, 2);
        s.apply(&json!({"action":"execute_goal","goalId":g}))
            .unwrap();
        let (j, lease) = claim(&mut s);
        finish_pair(&mut s, &j, &lease);
        s.apply(&json!({"action":"tick_goals"})).unwrap();
        assert_eq!(s.goals[0].iteration, 2);
        assert_eq!(s.jobs[2].dependencies, vec![s.jobs[1].id.clone()]);
        assert_eq!(s.jobs[2].limits.max_minutes, 5.0);
        let (j2, lease2) = claim(&mut s);
        finish_pair(&mut s, &j2, &lease2);
        s.apply(&json!({"action":"tick_goals"})).unwrap();
        assert_eq!(s.jobs.len(), 4);
        assert_eq!(s.goals[0].stop_reason.as_deref(), Some("iteration-limit"));
        assert_eq!(
            s.apply(&json!({"action":"advance_goal","goalId":g,"reason":"Another pass"}))
                .unwrap_err()
                .code,
            "ITERATION_LIMIT"
        );
        s.validate().unwrap();
    }
    #[test]
    fn time_target_stops_between_iterations_without_erasing_completed_artifacts() {
        let mut s = state();
        s.apply(&json!({"action":"configure_policy","approvalMode":"autonomous"}))
            .unwrap();
        let g = goal(&mut s, "execute", true, 2);
        s.apply(&json!({"action":"execute_goal","goalId":g}))
            .unwrap();
        let (j, lease) = claim(&mut s);
        finish_pair(&mut s, &j, &lease);
        s.jobs[0].created_at = "2020-01-01T00:00:00Z".into();
        s.apply(&json!({"action":"tick_goals"})).unwrap();
        assert_eq!(s.jobs.len(), 2);
        assert_eq!(s.goals[0].stop_reason.as_deref(), Some("time-target"));
        assert!(s.jobs[0].artifact_uri.is_some());
        assert_eq!(s.checkpoints.len(), 2);
    }
    #[test]
    fn goal_graph_rejects_cycles_and_plan_mode_has_no_dispatch() {
        let mut s = state();
        let g = goal(&mut s, "plan", false, 1);
        assert_eq!(
            s.apply(&json!({"action":"execute_goal","goalId":g}))
                .unwrap_err()
                .code,
            "PLAN_ONLY"
        );
        assert_eq!(s.apply(&json!({"action":"set_goal_plan","goalId":g,"steps":[{"id":"a","title":"a","employeeId":"donna","goal":"inspect","dependsOn":["b"]},{"id":"b","title":"b","employeeId":"donna","goal":"review","dependsOn":["a"]}]})).unwrap_err().code, "INVALID_DEPENDENCY");
        assert!(s.jobs.is_empty());
    }
    #[test]
    fn synthesized_plan_titles_are_bounded_without_losing_the_full_brief() {
        let mut s = state();
        let title = "Long goal title ".repeat(12);
        let description = "Complete user brief. ".repeat(700);
        s.apply(&json!({"action":"create_goal","scope":{"kind":"company","id":"atlas"},"title":title,"description":description,"mode":"execute"})).unwrap();
        let g = s.last_action.as_ref().unwrap()["goalId"]
            .as_str()
            .unwrap()
            .to_string();
        s.apply(&json!({"action":"plan_goal","goalId":g})).unwrap();
        assert!(s.goals[0]
            .steps
            .iter()
            .all(|step| step.title.len() <= 200 && step.goal.contains(&description)));
        s.apply(&json!({"action":"execute_goal","goalId":g}))
            .unwrap();
        s.validate().unwrap();
    }
    #[test]
    fn released_reservation_admits_waiting_work_without_a_policy_edit() {
        let mut s = state();
        s.apply(&json!({"action":"configure_policy","hardCapUsd":1}))
            .unwrap();
        job(&mut s, "first");
        job(&mut s, "second");
        let (first, lease) = claim(&mut s);
        s.apply(&json!({"action":"reserve_job","jobId":first,"leaseToken":lease,"inputTokens":10,"maxOutputTokens":20,"costUsd":0.6})).unwrap();
        let (second, second_lease) = claim(&mut s);
        s.apply(&json!({"action":"reserve_job","jobId":second,"leaseToken":second_lease,"inputTokens":10,"maxOutputTokens":20,"costUsd":0.6})).unwrap();
        s.migrate_governance().unwrap();
        assert_eq!(s.jobs.iter().find(|j| j.id == second).unwrap().status, "waiting-budget");
        finish(&mut s, &first, &lease);
        assert_eq!(s.jobs.iter().find(|j| j.id == second).unwrap().status, "queued");
        finish_review(&mut s, &first);
        assert_eq!(claim(&mut s).0, second);
    }
    #[test]
    fn pausing_a_goal_stops_future_steps_without_interrupting_reserved_work() {
        let mut s = state();
        let g = goal(&mut s, "execute", false, 1);
        s.apply(&json!({"action":"execute_goal","goalId":g}))
            .unwrap();
        let (j, lease) = claim(&mut s);
        s.apply(&json!({"action":"reserve_job","jobId":j,"leaseToken":lease,"inputTokens":10,"maxOutputTokens":20,"costUsd":0.2})).unwrap();
        s.apply(&json!({"action":"pause_goal","goalId":g})).unwrap();
        assert_eq!(s.jobs[0].status, "running");
        finish(&mut s, &j, &lease);
        assert_eq!(s.goals[0].status, "paused");
        assert_eq!(s.checkpoints.len(), 1);
        assert_eq!(s.budget.observed_usd, 0.1);
        s.apply(&json!({"action":"resume_goal","goalId":g}))
            .unwrap();
        assert_ne!(s.goals[0].status, "completed");
        finish_review(&mut s, &j);
        assert_eq!(s.goals[0].status, "completed");
    }
    #[test]
    fn blueprint_positions_and_ownership_cannot_cross_company_boundaries() {
        let mut s = state();
        let office = s.offices[0].id.clone();
        let room = s.blueprints[0].rooms[0].id.clone();
        s.apply(&json!({"action":"create_company","name":"Other","repoUrl":"https://github.com/example/other"})).unwrap();
        let employee = s
            .employees
            .iter()
            .find(|e| e.company_id.as_deref() == Some(&s.active_company_id))
            .unwrap()
            .id
            .clone();
        assert_eq!(s.apply(&json!({"action":"place_employee","officeId":office,"roomId":room,"employeeId":employee,"x":0.2,"y":0.2})).unwrap_err().code, "SCOPE_MISMATCH");
        assert_eq!(s.apply(&json!({"action":"upsert_room","officeId":office,"name":"Outside","x":0.9,"y":0.2,"width":0.2,"height":0.2})).unwrap_err().code, "INVALID_INPUT");
        s.apply(&json!({"action":"place_employee","officeId":office,"roomId":room,"employeeId":"donna","x":0.4,"y":0.3})).unwrap();
        assert!(s.blueprints[0]
            .desks
            .iter()
            .any(|d| d.employee_id == "donna" && d.x == 0.4));
        s.validate().unwrap();
    }
    #[test]
    fn private_catalog_provenance_and_default_staffing_are_preserved() {
        let mut s = state();
        let import = json!({"action":"import_repositories","repositories":[{"name":"Private fixture","repoUrl":"https://github.com/example/private-fixture","source":"github-authenticated-api","visibility":"private","defaultBranch":"trunk"}]});
        s.apply(&import).unwrap();
        let count = s.employees.len();
        s.apply(&import).unwrap();
        assert_eq!(s.employees.len(), count);
        let company = s.companies.last().unwrap();
        assert_eq!(company.source, "github-authenticated-api");
        assert_eq!(company.visibility.as_deref(), Some("private"));
        assert_eq!(company.default_branch.as_deref(), Some("trunk"));
        assert_eq!(
            s.employees
                .iter()
                .filter(
                    |e| e.company_id.as_deref() == Some(&company.id) && e.assignment_key.is_some()
                )
                .count(),
            6
        );
        assert_eq!(s.apply(&json!({"action":"import_repositories","repositories":[{"name":"Bad source","repoUrl":"https://github.com/example/nope","source":"github-public-api","visibility":"private"}]})).unwrap_err().code, "INVALID_INPUT");
        s.validate().unwrap();
    }
}
