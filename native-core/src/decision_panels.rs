//! Donna's bounded decision panels. Expert definitions are reusable employees;
//! a round becomes ordinary dependency-linked jobs, never an invented review.
use super::*;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PanelMember {
    pub employee_id: String,
    pub role_key: String,
    pub service_contract_id: Option<String>,
    pub selection: String,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PanelDecision {
    pub id: String,
    pub round: u64,
    pub verdict: String,
    pub summary: String,
    pub evidence: Vec<String>,
    pub created_at: String,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DecisionPanel {
    pub id: String,
    pub company_id: String,
    pub scope: Scope,
    pub title: String,
    pub task: String,
    pub focus: String,
    pub status: String,
    pub members: Vec<PanelMember>,
    pub round: u64,
    pub max_rounds: u64,
    /// maxUsd is the whole panel ceiling; tokens/minutes bound each request.
    pub limits: Limits,
    pub goal_ids: Vec<String>,
    pub roadmap_item_ids: Vec<String>,
    pub decisions: Vec<PanelDecision>,
    pub created_at: String,
    pub updated_at: String,
}

fn role_title(key: &str) -> Option<&'static str> {
    Some(match key {
        "engineering" => "Engineering architect",
        "frontend-extensions" => "Frontend and extension engineer",
        "backend" => "Backend and API engineer",
        "database-cache" => "Database and cache engineer",
        "github-release" => "GitHub release steward",
        "qa" => "Independent acceptance reviewer",
        "security" => "Security and privacy reviewer",
        "research-knowledge" => "Evidence research lead",
        "knowledge" => "Knowledge curator",
        "design-architecture" => "Design and architecture lead",
        "math-geometry" => "Mathematics and geometry reviewer",
        "music-arts" => "Music and arts specialist",
        "hackathon" => "Hackathon prototype lead",
        "newton" => "Newton analysis and synthesis lens",
        "tesla" => "Tesla mechanism and resonance lens",
        "research-skeptic" => "Research skeptic and evidence reviewer",
        "resonance-advisor" => "Resonance research advisor",
        "paired-research" => "Paired forward and reverse research coordinator",
        "figma-design-systems" => "Figma and open design interoperability engineer",
        "directory-steward" => "Application directory and integration steward",
        _ => return None,
    })
}
fn canonical_role(key: &str) -> &str {
    match key.strip_prefix("shared:").unwrap_or(key) {
        "code-engineer" => "engineering",
        "blueprint-steward" => "design-architecture",
        "qa-lead" => "qa",
        "knowledge-curator" => "knowledge",
        "github-steward" => "github-release",
        other => other,
    }
}
fn default_roles(focus: &str) -> Option<Vec<String>> {
    Some(
        match focus {
            "software" => vec!["engineering", "design-architecture", "security", "qa"],
            "design" => vec!["design-architecture", "frontend-extensions", "qa"],
            "research" => vec!["newton", "tesla", "research-skeptic"],
            "data" => vec!["database-cache", "security", "research-knowledge"],
            _ => return None,
        }
        .into_iter()
        .map(String::from)
        .collect(),
    )
}
fn panel_decode<T: serde::de::DeserializeOwned>(v: &Value, label: &str) -> Result<T> {
    serde_json::from_value(v.clone()).map_err(|_| fail("INVALID_INPUT", format!("Invalid {label}")))
}

impl OfficeSnapshot {
    fn panel_goal_scope(&self, panel: &DecisionPanel) -> Result<Scope> {
        self.company(&panel.company_id)?;
        if panel.scope.kind == "group" {
            let group = self
                .portfolio
                .groups
                .iter()
                .find(|g| g.id == panel.scope.id)
                .ok_or_else(|| fail("NOT_FOUND", "Panel group not found"))?;
            if !group.company_ids.contains(&panel.company_id) {
                return Err(fail(
                    "SCOPE_MISMATCH",
                    "The coordinating company must belong to the panel group",
                ));
            }
            if group.status != "active" {
                return Err(fail("SCOPE_PAUSED", "The panel group is paused"));
            }
            // A group labels the decision, not an implicit cross-company data grant.
            return Ok(Scope {
                kind: "company".into(),
                id: panel.company_id.clone(),
            });
        }
        if !["company", "office", "department"].contains(&panel.scope.kind.as_str())
            || self.scope_company(&panel.scope)? != panel.company_id
        {
            return Err(fail(
                "SCOPE_MISMATCH",
                "Panel scope must belong to its coordinating company",
            ));
        }
        Ok(panel.scope.clone())
    }
    fn panel_goal(&self, panel: &DecisionPanel) -> Result<Goal> {
        Ok(Goal {
            id: id("goal"),
            company_id: panel.company_id.clone(),
            scope: self.panel_goal_scope(panel)?,
            title: panel.title.clone(),
            description: panel.task.clone(),
            mode: "execute".into(),
            status: "planned".into(),
            max_iterations: 1,
            iteration: 0,
            job_ids: vec![],
            steps: vec![],
            run_settings: GoalRunSettings::default(),
            created_at: now(),
            updated_at: now(),
            stop_reason: None,
            source_request_id: None, request_sha256: None, source_message_id: None,
        })
    }
    fn panel_hire_or_reuse(&mut self, panel: &DecisionPanel, key: &str) -> Result<PanelMember> {
        let goal = self.panel_goal(panel)?;
        // Prefer already contracted specialists over new local duplicates. The
        // existing assignment validator checks the exact recipient scope.
        for contract in &self.portfolio.contracts {
            if contract.status != "active" || contract.recipient_company_id != panel.company_id {
                continue;
            }
            for employee_id in &contract.employee_ids {
                let employee = self.staff(employee_id)?;
                if employee.status == "active"
                    && employee
                        .assignment_key
                        .as_deref()
                        .is_some_and(|k| canonical_role(k) == key)
                    && self
                        .goal_employee_scope(&goal, employee_id, Some(&contract.id))
                        .is_ok()
                {
                    return Ok(PanelMember {
                        employee_id: employee_id.clone(),
                        role_key: key.into(),
                        service_contract_id: Some(contract.id.clone()),
                        selection: "reused".into(),
                    });
                }
            }
        }
        if let Some(employee) = self.employees.iter().find(|e| {
            e.status == "active"
                && e.company_id.as_deref() == Some(&panel.company_id)
                && e.assignment_key
                    .as_deref()
                    .is_some_and(|k| canonical_role(k) == key)
                && self.goal_employee_scope(&goal, &e.id, None).is_ok()
        }) {
            return Ok(PanelMember {
                employee_id: employee.id.clone(),
                role_key: key.into(),
                service_contract_id: None,
                selection: "reused".into(),
            });
        }
        let office = match goal.scope.kind.as_str() {
            "office" => goal.scope.id.clone(),
            "department" => self
                .departments
                .iter()
                .find(|d| d.id == goal.scope.id)
                .unwrap()
                .office_id
                .clone(),
            _ => self
                .offices
                .iter()
                .find(|o| o.company_id == panel.company_id && o.status == "active")
                .ok_or_else(|| fail("SCOPE_PAUSED", "Panel company has no active office"))?
                .id
                .clone(),
        };
        let department = (goal.scope.kind == "department").then(|| goal.scope.id.clone());
        let title = role_title(key).ok_or_else(|| fail("INVALID_INPUT", "Unknown panel role"))?;
        let employee_id = self.add_staff(
            &panel.company_id,
            Some(office),
            department,
            title,
            title,
            "specialist",
            vec!["skills/agent-research-director/SKILL.md".into()],
            None,
        )?;
        self.employees
            .iter_mut()
            .find(|e| e.id == employee_id)
            .unwrap()
            .assignment_key = Some(key.into());
        self.log(
            "donna",
            "panel-role-hired",
            &employee_id,
            format!("Created reusable {key} definition for a bounded decision panel"),
        );
        Ok(PanelMember {
            employee_id,
            role_key: key.into(),
            service_contract_id: None,
            selection: "hired".into(),
        })
    }
    pub(super) fn sync_decision_panels(&mut self) -> bool {
        let mut changed = false;
        for panel in &mut self.decision_panels {
            if panel.status == "running"
                && panel
                    .goal_ids
                    .last()
                    .and_then(|id| self.goals.iter().find(|g| &g.id == id))
                    .is_some_and(|g| ["completed", "needs-review"].contains(&g.status.as_str()))
            {
                panel.status = "review".into();
                panel.updated_at = now();
                changed = true;
            }
        }
        changed
    }
    pub(super) fn validate_decision_panels(&self) -> Result<()> {
        if self.decision_panels.len() > 2000 {
            return Err(fail("CAPACITY", "Decision panel history reached its limit"));
        }
        let mut ids = HashSet::new();
        for panel in &self.decision_panels {
            if !safe_id(&panel.id)
                || !ids.insert(&panel.id)
                || self.company(&panel.company_id).is_err()
                || !["company", "office", "department", "group"]
                    .contains(&panel.scope.kind.as_str())
                || !safe_id(&panel.scope.id)
                || default_roles(&panel.focus).is_none()
                || !["draft", "running", "review", "decided", "paused"]
                    .contains(&panel.status.as_str())
                || !(1..=5).contains(&panel.max_rounds)
                || panel.round > panel.max_rounds
                || panel.goal_ids.len() as u64 != panel.round
                || panel.decisions.len() > panel.max_rounds as usize
                || !(1..=5).contains(&panel.members.len())
                || panel.roadmap_item_ids.len() > 30
                || !panel.limits.max_usd.is_finite()
                || !(0.0..=1000.0).contains(&panel.limits.max_usd)
                || !(1..=1000000).contains(&panel.limits.max_tokens)
                || !panel.limits.max_minutes.is_finite()
                || !(0.01..=1440.0).contains(&panel.limits.max_minutes)
            {
                return Err(fail(
                    "OFFICE_STATE_INVALID",
                    "Invalid decision panel definition",
                ));
            }
            bounded_text(&panel.title, 200, "panel title")?;
            bounded_text(&panel.task, 12000, "panel task")?;
            timestamp(&panel.created_at)?;
            timestamp(&panel.updated_at)?;
            let mut members = HashSet::new();
            for member in &panel.members {
                if !members.insert(&member.employee_id)
                    || self.staff(&member.employee_id).is_err()
                    || role_title(&member.role_key).is_none()
                    || !["reused", "hired"].contains(&member.selection.as_str())
                    || member
                        .service_contract_id
                        .as_ref()
                        .is_some_and(|id| !self.portfolio.contracts.iter().any(|c| &c.id == id))
                {
                    return Err(fail(
                        "OFFICE_STATE_INVALID",
                        "Invalid decision panel member",
                    ));
                }
            }
            let mut goals = HashSet::new();
            for goal in &panel.goal_ids {
                if !goals.insert(goal)
                    || !self.goals.iter().any(|g| {
                        &g.id == goal && g.company_id == panel.company_id && g.max_iterations == 1
                    })
                {
                    return Err(fail("OFFICE_STATE_INVALID", "Invalid panel round goal"));
                }
            }
            let mut rounds = HashSet::new();
            for decision in &panel.decisions {
                if !safe_id(&decision.id)
                    || decision.round == 0
                    || decision.round > panel.round
                    || !rounds.insert(decision.round)
                    || !["accepted", "revise", "defer", "reject"]
                        .contains(&decision.verdict.as_str())
                    || decision.evidence.is_empty()
                    || decision.evidence.len() > 20
                {
                    return Err(fail(
                        "OFFICE_STATE_INVALID",
                        "Invalid panel decision evidence",
                    ));
                }
                bounded_text(&decision.summary, 6000, "decision summary")?;
                for evidence in &decision.evidence {
                    bounded_text(evidence, 300, "decision evidence")?;
                }
                timestamp(&decision.created_at)?;
            }
        }
        Ok(())
    }
    pub(super) fn apply_decision_panel(&mut self, action: &str, p: &Value) -> Result<bool> {
        if ![
            "convene_panel",
            "start_panel_round",
            "record_panel_decision",
            "pause_panel",
            "resume_panel",
        ]
        .contains(&action)
        {
            return Ok(false);
        }
        // Local commands may fail during scope/authorization validation. Preserve
        // the whole prior state even for direct in-process callers on failure.
        let mut next = self.clone();
        next.panel_command(action, p)?;
        next.sync_goal_checkpoints()?;
        next.sync_decision_panels();
        next.refresh_budget();
        next.validate()?;
        *self = next;
        Ok(true)
    }
    fn panel_command(&mut self, action: &str, p: &Value) -> Result<()> {
        if action == "convene_panel" {
            if self.decision_panels.len() >= 2000 {
                return Err(fail(
                    "CAPACITY",
                    "Decision panel history is full; export before creating more",
                ));
            }
            let company_id = string(p, "companyId", 100)?;
            let scope = p
                .get("scope")
                .map(|v| panel_decode(v, "panel scope"))
                .transpose()?
                .unwrap_or(Scope {
                    kind: "company".into(),
                    id: company_id.clone(),
                });
            let focus = opt_string(p, "focus", 30)?.unwrap_or_else(|| "software".into());
            let defaults = default_roles(&focus)
                .ok_or_else(|| fail("INVALID_INPUT", "Unknown panel focus"))?;
            let roles = if p.get("roleKeys").is_some() {
                strings(p, "roleKeys", 5)?
            } else {
                defaults
            };
            if roles.is_empty()
                || roles.iter().collect::<HashSet<_>>().len() != roles.len()
                || roles.iter().any(|r| role_title(r).is_none())
            {
                return Err(fail(
                    "INVALID_INPUT",
                    "Select one to five distinct supported expert roles",
                ));
            }
            let stamp = now();
            let mut panel = DecisionPanel {
                id: id("panel"),
                company_id,
                scope,
                title: string(p, "title", 200)?,
                task: string(p, "task", 12000)?,
                focus,
                status: "draft".into(),
                members: vec![],
                round: 0,
                max_rounds: if p.get("maxRounds").is_some() {
                    integer(p, "maxRounds", 1, 5)?
                } else {
                    1
                },
                limits: Limits {
                    max_usd: if p.get("maxUsd").is_some() {
                        number(p, "maxUsd", 0.0, 1000.0)?
                    } else {
                        2.0
                    },
                    max_tokens: if p.get("maxTokens").is_some() {
                        integer(p, "maxTokens", 1, 1000000)?
                    } else {
                        60000
                    },
                    max_minutes: if p.get("maxMinutes").is_some() {
                        number(p, "maxMinutes", 0.01, 1440.0)?
                    } else {
                        10.0
                    },
                },
                goal_ids: vec![],
                roadmap_item_ids: strings(p, "roadmapItemIds", 30)?,
                decisions: vec![],
                created_at: stamp.clone(),
                updated_at: stamp,
            };
            self.panel_goal_scope(&panel)?;
            if panel
                .roadmap_item_ids
                .iter()
                .any(|id| !self.roadmap_visible_to_company(id, &panel.company_id))
            {
                return Err(fail(
                    "SCOPE_MISMATCH",
                    "Panel roadmap references must be visible to the coordinating company",
                ));
            }
            for role in roles {
                panel.members.push(self.panel_hire_or_reuse(&panel, &role)?);
            }
            self.log(
                "donna",
                "panel-convened",
                &panel.id,
                format!(
                    "Prepared {} scoped expert definitions; no provider request was made",
                    panel.members.len()
                ),
            );
            self.last_action = Some(
                json!({"panelId":panel.id,"memberCount":panel.members.len(),"source":"local"}),
            );
            self.decision_panels.push(panel);
            return Ok(());
        }
        let panel_id = string(p, "panelId", 100)?;
        let index = self
            .decision_panels
            .iter()
            .position(|x| x.id == panel_id)
            .ok_or_else(|| fail("NOT_FOUND", "Decision panel not found"))?;
        let mut panel = self.decision_panels[index].clone();
        match action {
            "start_panel_round" => {
                if panel.status != "draft" || panel.round >= panel.max_rounds {
                    return Err(fail(
                        "INVALID_TRANSITION",
                        "A panel needs a draft or explicit revise decision and remaining rounds",
                    ));
                }
                if panel.round > 0
                    && panel
                        .decisions
                        .last()
                        .is_none_or(|d| d.round != panel.round || d.verdict != "revise")
                {
                    return Err(fail(
                        "REVIEW_REQUIRED",
                        "Record the previous round's decision before another round",
                    ));
                }
                if self.goals.len() >= 2000 {
                    return Err(fail("CAPACITY", "Goal history is full"));
                }
                let mut goal = self.panel_goal(&panel)?;
                let mut settings = p
                    .get("runSettings")
                    .map(|v| panel_decode::<GoalRunSettings>(v, "panel run settings"))
                    .transpose()?
                    .unwrap_or_default();
                if !settings.allowed_tools.is_empty() {
                    return Err(fail(
                        "PANEL_READ_ONLY",
                        "Panel reviews do not grant publishing or execution tools",
                    ));
                }
                let committed: f64 = self
                    .jobs
                    .iter()
                    .filter(|j| {
                        j.goal_id
                            .as_ref()
                            .is_some_and(|id| panel.goal_ids.contains(id))
                    })
                    .map(|j| j.usage.cost_usd)
                    .sum();
                let remaining = (panel.limits.max_usd - committed).max(0.0);
                if settings.mode == "provider" && settings.provider != "ollama" && remaining <= 1e-9
                {
                    return Err(fail(
                        "PANEL_BUDGET",
                        "Panel budget is exhausted; all reports and decisions are retained",
                    ));
                }
                settings.max_usd = (panel.limits.max_usd / panel.max_rounds as f64).min(remaining)
                    / (panel.members.len() + 1) as f64;
                settings.max_tokens = panel.limits.max_tokens;
                settings.max_minutes = panel.limits.max_minutes;
                goal.run_settings = settings;
                self.validate_run_settings(&goal)?;
                let transfers = strings(p, "knowledgeTransferIds", 50)?;
                self.validate_knowledge_access(&panel.company_id, &transfers)?;
                let feedback = panel
                    .decisions
                    .last()
                    .map(|d| {
                        format!(
                            "Previous review verdict: {}. Feedback: {}. Evidence: {}.",
                            d.verdict,
                            d.summary,
                            d.evidence.join("; ")
                        )
                    })
                    .unwrap_or_default();
                let brief = format!("Decision panel: {}\nTask: {}\n{}\nScope: {} / {}. Coordinating company: {}. Only supplied company context and explicitly granted knowledge may be used. A group label grants no sibling company access. Return concise conclusions, evidence, alternatives, acceptance checks, unresolved objections and next action. Do not expose private chain-of-thought. AI research lenses are not the historical person's participation or human peer review. Model recommendations are not executed changes or proof.", panel.title, panel.task, feedback, panel.scope.kind, panel.scope.id, panel.company_id);
                for (n, member) in panel.members.iter().enumerate() {
                    let employee = self.staff(&member.employee_id)?;
                    if employee.status != "active" {
                        return Err(fail("SCOPE_PAUSED", "A selected expert is paused or fired; preserve the record and convene a new panel"));
                    }
                    self.goal_employee_scope(
                        &goal,
                        &member.employee_id,
                        member.service_contract_id.as_deref(),
                    )?;
                    goal.steps.push(GoalStep {
                        id: format!("expert-{}", n + 1), title: role_title(&member.role_key).unwrap().into(), employee_id: member.employee_id.clone(),
                        goal: format!("{brief}\nYour lens: {}. Work independently of the other current-round expert reports. Identify one concrete recommendation and the strongest reason it could fail.", role_title(&member.role_key).unwrap()),
                        depends_on: vec![], service_contract_id: member.service_contract_id.clone(), knowledge_transfer_ids: transfers.clone(), reviewer_employee_id: None, reviewer_service_contract_id: None, estimate: None, review_estimate: None,
                    });
                }
                let dependencies = goal.steps.iter().map(|s| s.id.clone()).collect();
                goal.steps.push(GoalStep {
                    id: "donna-synthesis".into(), title: "Donna — compare evidence and record a recommendation".into(), employee_id: "donna".into(),
                    goal: format!("{brief}\nYou are Donna, the decision panel moderator. Read the supplied expert artifacts, merge duplicate proposals, preserve disagreements and distinguish accepted recommendations from evidence gaps. Return a small roadmap with owners, dependencies, verification checks and proposed budgets, plus accepted/rejected/deferred options. Do not claim the owner accepted the result; the decision ledger is a separate explicit step."),
                    depends_on: dependencies, service_contract_id: None, knowledge_transfer_ids: transfers, reviewer_employee_id: None, reviewer_service_contract_id: None, estimate: None, review_estimate: None,
                });
                self.assign_goal_reviewers(&mut goal)?;
                self.validate_goal_steps(&goal)?;
                let goal_id = goal.id.clone();
                self.goals.push(goal);
                self.apply_governance(
                    "execute_goal",
                    &json!({"goalId":goal_id,"reviewed":boolean(p,"reviewed",false)?}),
                )?;
                for job in self
                    .jobs
                    .iter_mut()
                    .filter(|j| j.goal_id.as_deref() == Some(&goal_id))
                {
                    job.limits.max_minutes = panel.limits.max_minutes;
                }
                panel.round += 1;
                panel.status = "running".into();
                panel.goal_ids.push(goal_id.clone());
                self.last_action = Some(
                    json!({"panelId":panel.id,"goalId":goal_id,"round":panel.round,"jobIds":self.goals.last().unwrap().job_ids,"source":"queued"}),
                );
                self.log("donna", "panel-round-enqueued", &panel.id, "Queued independent expert reviews followed by Donna synthesis; provider requests still require worker admission".into());
            }
            "record_panel_decision" => {
                if panel.status != "review" {
                    return Err(fail(
                        "PANEL_NOT_READY",
                        "Wait for the panel round to settle before recording its decision",
                    ));
                }
                let verdict = string(p, "verdict", 20)?;
                if !["accepted", "revise", "defer", "reject"].contains(&verdict.as_str()) {
                    return Err(fail("INVALID_INPUT", "Unknown panel verdict"));
                }
                if verdict == "revise" && panel.round >= panel.max_rounds {
                    return Err(fail("ITERATION_LIMIT", "Panel reached its round limit; retain this decision and create a new bounded panel if needed"));
                }
                let goal = self
                    .goals
                    .iter()
                    .find(|g| Some(&g.id) == panel.goal_ids.last())
                    .unwrap();
                if verdict == "accepted"
                    && (goal.status != "completed"
                        || goal.job_ids.iter().any(|id| {
                            self.jobs
                                .iter()
                                .find(|j| &j.id == id)
                                .is_none_or(|j| j.status != "completed" || j.artifact_uri.is_none())
                        }))
                {
                    return Err(fail(
                        "EVIDENCE_REQUIRED",
                        "Accepting a panel requires completed expert and synthesis artifacts",
                    ));
                }
                let evidence = strings(p, "evidence", 20)?;
                if evidence.is_empty() {
                    return Err(fail("EVIDENCE_REQUIRED", "Record at least one evidence reference, including failed work when relevant"));
                }
                let decision = PanelDecision {
                    id: id("decision"),
                    round: panel.round,
                    verdict: verdict.clone(),
                    summary: string(p, "summary", 6000)?,
                    evidence,
                    created_at: now(),
                };
                self.log("owner", "panel-decision-recorded", &panel.id, format!("Recorded {verdict} for round {}; model proposals do not publish themselves", panel.round));
                self.last_action =
                    Some(json!({"panelId":panel.id,"decisionId":decision.id,"verdict":verdict}));
                panel.decisions.push(decision);
                panel.status = if verdict == "revise" {
                    "draft"
                } else {
                    "decided"
                }
                .into();
            }
            "pause_panel" | "resume_panel" => {
                if action == "pause_panel" {
                    if panel.status == "decided" || panel.status == "paused" {
                        return Err(fail(
                            "INVALID_TRANSITION",
                            "Only an open unpaused panel can pause",
                        ));
                    }
                    if panel.status == "running" {
                        self.apply_governance(
                            "pause_goal",
                            &json!({"goalId":panel.goal_ids.last().unwrap()}),
                        )?;
                    }
                    panel.status = "paused".into();
                } else {
                    if panel.status != "paused" {
                        return Err(fail("INVALID_TRANSITION", "Only a paused panel can resume"));
                    }
                    let last = panel
                        .goal_ids
                        .last()
                        .and_then(|id| self.goals.iter().find(|g| &g.id == id))
                        .cloned();
                    panel.status = if let Some(goal) = last {
                        if panel
                            .decisions
                            .last()
                            .is_some_and(|d| d.round == panel.round && d.verdict == "revise")
                        {
                            "draft"
                        } else if goal.status == "paused" {
                            self.apply_governance("resume_goal", &json!({"goalId":goal.id}))?;
                            "running"
                        } else if ["completed", "needs-review"].contains(&goal.status.as_str()) {
                            "review"
                        } else {
                            "running"
                        }
                    } else {
                        "draft"
                    }
                    .into();
                }
                self.last_action = Some(json!({"panelId":panel.id,"status":panel.status}));
            }
            _ => unreachable!(),
        }
        panel.updated_at = now();
        self.decision_panels[index] = panel;
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
    fn panel(s: &mut OfficeSnapshot, focus: &str, rounds: u64) -> String {
        s.apply(&json!({"action":"convene_panel","companyId":"atlas","title":"Bounded product decision","task":"Compare implementation choices with a failure check and ownership.","focus":focus,"maxRounds":rounds,"maxUsd":2,"maxTokens":2000,"maxMinutes":7})).unwrap();
        s.last_action.as_ref().unwrap()["panelId"]
            .as_str()
            .unwrap()
            .into()
    }
    fn finish_round(s: &mut OfficeSnapshot) {
        loop {
            s.apply(&json!({"action":"claim_job","workerId":"fixture-worker"}))
                .unwrap();
            let Some(job) = s
                .last_action
                .as_ref()
                .and_then(|v| v["jobId"].as_str())
                .map(String::from)
            else {
                break;
            };
            let lease = s.last_action.as_ref().unwrap()["leaseToken"]
                .as_str()
                .unwrap()
                .to_string();
            s.apply(&json!({"action":"finish_job","jobId":job,"leaseToken":lease,"status":"completed","inputTokens":10,"outputTokens":10,"costUsd":0.01,"artifactUri":"/tmp/fixture-evidence.md","artifactSha256":"a".repeat(64),"summary":"Fixture expert report; no live provider was called."})).unwrap();
            let pair = s.jobs.iter().find(|j| j.id == job).unwrap().pair.clone().unwrap();
            if pair.phase == "review" {
                s.apply(&json!({"action":"record_step_review","jobId":job,"leaseToken":lease,"primaryJobId":pair.primary_job_id,"primaryArtifactSha256":"a".repeat(64),"reviewArtifactSha256":"a".repeat(64),"primaryArtifactComplete":true,"verdict":"accepted","summary":"Independent fixture review","evidenceRefs":["fixture:complete-artifact"]})).unwrap();
            }
        }
    }
    #[test]
    fn convening_reuses_roles_without_dispatch_and_old_states_default_empty() {
        let mut s = state();
        let id = panel(&mut s, "software", 1);
        assert!(s.jobs.is_empty());
        let initial = s.employees.len();
        assert_eq!(
            s.decision_panels[0]
                .members
                .iter()
                .filter(|m| m.selection == "hired")
                .count(),
            1
        );
        let first_ids: Vec<_> = s.decision_panels[0]
            .members
            .iter()
            .map(|m| m.employee_id.clone())
            .collect();
        panel(&mut s, "software", 1);
        assert_eq!(s.employees.len(), initial);
        assert_eq!(
            s.decision_panels[1]
                .members
                .iter()
                .map(|m| m.employee_id.clone())
                .collect::<Vec<_>>(),
            first_ids
        );
        assert!(s.decision_panels[1]
            .members
            .iter()
            .all(|m| m.selection == "reused"));
        assert_eq!(s.decision_panels[0].id, id);
        let mut old = serde_json::to_value(state()).unwrap();
        old.as_object_mut().unwrap().remove("decisionPanels");
        let restored: OfficeSnapshot = serde_json::from_value(old).unwrap();
        assert!(restored.decision_panels.is_empty());
        restored.validate().unwrap();
    }
    #[test]
    fn research_lenses_are_explicit_permanent_roles_and_do_not_resume_paused_staff() {
        let mut s = state();
        panel(&mut s, "research", 1);
        assert_eq!(
            s.decision_panels[0]
                .members
                .iter()
                .map(|m| m.role_key.as_str())
                .collect::<Vec<_>>(),
            vec!["newton", "tesla", "research-skeptic"]
        );
        let newton = s.decision_panels[0].members[0].employee_id.clone();
        s.apply(&json!({"action":"pause_employee","employeeId":newton}))
            .unwrap();
        panel(&mut s, "research", 1);
        assert_ne!(s.decision_panels[1].members[0].employee_id, newton);
        assert_eq!(s.staff(&newton).unwrap().status, "paused");
        assert_eq!(
            s.staff(&s.decision_panels[1].members[0].employee_id)
                .unwrap()
                .assignment_key
                .as_deref(),
            Some("newton")
        );
    }
    #[test]
    fn scoped_contracts_are_reused_and_revocation_blocks_round_creation() {
        let mut s = state();
        s.apply(&json!({"action":"optimize_portfolio","preset":"standard","pauseRedundant":true,"groups":[{"id":"products","name":"Products","description":"Fixture","companyIds":["atlas"]}]}))
            .unwrap();
        let id = panel(&mut s, "software", 1);
        let borrowed = s.decision_panels[0]
            .members
            .iter()
            .find(|m| m.role_key == "engineering")
            .unwrap()
            .clone();
        assert!(borrowed.service_contract_id.is_some());
        let contract = s
            .portfolio
            .contracts
            .iter_mut()
            .find(|c| Some(&c.id) == borrowed.service_contract_id.as_ref())
            .unwrap();
        contract.status = "revoked".into();
        let goals = s.goals.len();
        assert!(s
            .apply(&json!({"action":"start_panel_round","panelId":id}))
            .is_err());
        assert_eq!(s.goals.len(), goals);
        assert!(s.jobs.is_empty());
    }
    #[test]
    fn group_labels_do_not_authorize_other_company_scope_or_knowledge() {
        let mut s = state();
        s.apply(&json!({"action":"create_company","id":"other","name":"Other"}))
            .unwrap();
        s.apply(&json!({"action":"upsert_portfolio_group","id":"research","name":"Research","description":"Fixture group","companyIds":["other"]})).unwrap();
        let employees = s.employees.len();
        let result = s.apply(&json!({"action":"convene_panel","companyId":"atlas","scope":{"kind":"group","id":"research"},"title":"Scope check","task":"No implicit group access","focus":"research"}));
        assert_eq!(result.unwrap_err().code, "SCOPE_MISMATCH");
        assert_eq!(s.employees.len(), employees);
        s.apply(&json!({"action":"upsert_portfolio_group","id":"research","name":"Research","description":"Fixture group","companyIds":["atlas","other"]})).unwrap();
        s.apply(&json!({"action":"convene_panel","companyId":"atlas","scope":{"kind":"group","id":"research"},"title":"Scope check","task":"No implicit group access","focus":"research"})).unwrap();
        let id = s.decision_panels[0].id.clone();
        assert_eq!(s.apply(&json!({"action":"start_panel_round","panelId":id,"knowledgeTransferIds":["missing-transfer"]})).unwrap_err().code,"KNOWLEDGE_NOT_GRANTED");
        s.apply(&json!({"action":"start_panel_round","panelId":id}))
            .unwrap();
        assert!(s.jobs.iter().all(|j| j.company_id == "atlas"
            && j.knowledge_transfer_ids.is_empty()
            && j.allowed_tools.is_empty()));
    }
    #[test]
    fn provider_round_requires_authorization_and_builds_parallel_then_moderator_dag() {
        let mut s = state();
        let id = panel(&mut s, "software", 2);
        let settings = json!({"mode":"provider","provider":"anthropic","model":"fixture-model","authorized":false,"maxTokens":99999,"maxUsd":999,"maxMinutes":999,"priceRates":{"inputUsdPerMillion":1,"outputUsdPerMillion":2}});
        assert_eq!(
            s.apply(&json!({"action":"start_panel_round","panelId":id,"runSettings":settings}))
                .unwrap_err()
                .code,
            "REVIEW_REQUIRED"
        );
        assert!(s.jobs.is_empty() && s.goals.is_empty());
        s.apply(&json!({"action":"start_panel_round","panelId":id,"runSettings":settings,"reviewed":true})).unwrap();
        let goal = &s.goals[0];
        assert_eq!(goal.max_iterations, 1);
        assert_eq!(s.jobs.len(), 10);
        assert_eq!(
            s.jobs.iter().filter(|j| j.dependencies.is_empty()).count(),
            4
        );
        let moderator = s.jobs.iter().find(|j| j.employee_id == "donna").unwrap();
        assert_eq!(moderator.dependencies.len(), 4);
        assert!(s.jobs.iter().all(|j| j.authorized
            && j.allowed_tools.is_empty()
            && j.limits.max_tokens == if j.pair.as_ref().unwrap().phase == "primary" { 1200 } else { 800 }
            && j.limits.max_minutes == 7.0));
        assert!((s.jobs.iter().map(|j| j.limits.max_usd).sum::<f64>() - 1.0).abs() < 1e-9);
        assert!(s
            .apply(&json!({"action":"start_panel_round","panelId":id}))
            .is_err());
    }
    #[test]
    fn decision_requires_settled_artifacts_then_explicit_revision_before_next_round() {
        let mut s = state();
        let id = panel(&mut s, "design", 2);
        s.apply(&json!({"action":"start_panel_round","panelId":id}))
            .unwrap();
        assert_eq!(s.apply(&json!({"action":"record_panel_decision","panelId":id,"verdict":"accepted","summary":"Not yet","evidence":["fixture"]})).unwrap_err().code,"PANEL_NOT_READY");
        finish_round(&mut s);
        assert_eq!(s.decision_panels[0].status, "review");
        assert_eq!(s.apply(&json!({"action":"record_panel_decision","panelId":id,"verdict":"accepted","summary":"Missing citations","evidence":[]})).unwrap_err().code,"EVIDENCE_REQUIRED");
        s.apply(&json!({"action":"record_panel_decision","panelId":id,"verdict":"revise","summary":"Recheck keyboard ownership and narrow blueprint interaction","evidence":["/tmp/fixture-evidence.md"]})).unwrap();
        assert_eq!(s.decision_panels[0].status, "draft");
        s.apply(&json!({"action":"tick_goals"})).unwrap();
        assert_eq!(s.goals.len(), 1);
        s.apply(&json!({"action":"start_panel_round","panelId":id}))
            .unwrap();
        assert_eq!(s.goals.len(), 2);
        assert!(s.goals[1].steps[0]
            .goal
            .contains("Recheck keyboard ownership"));
        finish_round(&mut s);
        assert_eq!(s.apply(&json!({"action":"record_panel_decision","panelId":id,"verdict":"revise","summary":"Beyond limit","evidence":["fixture"]})).unwrap_err().code,"ITERATION_LIMIT");
        s.apply(&json!({"action":"record_panel_decision","panelId":id,"verdict":"accepted","summary":"Accepted the bounded design recommendation; implementation verification remains a separate task.","evidence":["/tmp/fixture-evidence.md"]})).unwrap();
        assert_eq!(s.decision_panels[0].status, "decided");
        s.validate().unwrap();
    }
    #[test]
    fn pause_retains_inflight_work_and_resume_does_not_rebill_it() {
        let mut s = state();
        let id = panel(&mut s, "research", 1);
        s.apply(&json!({"action":"start_panel_round","panelId":id}))
            .unwrap();
        s.apply(&json!({"action":"claim_job","workerId":"fixture-worker"}))
            .unwrap();
        let running = s.last_action.as_ref().unwrap()["jobId"]
            .as_str()
            .unwrap()
            .to_string();
        let lease = s.last_action.as_ref().unwrap()["leaseToken"]
            .as_str()
            .unwrap()
            .to_string();
        s.apply(&json!({"action":"pause_panel","panelId":id}))
            .unwrap();
        assert_eq!(
            s.jobs.iter().find(|j| j.id == running).unwrap().status,
            "running"
        );
        assert!(s
            .jobs
            .iter()
            .filter(|j| j.id != running)
            .all(|j| j.status == "paused"));
        s.apply(&json!({"action":"finish_job","jobId":running,"leaseToken":lease,"status":"completed","inputTokens":10,"outputTokens":10,"costUsd":0.01,"artifactUri":"/tmp/fixture-evidence.md","artifactSha256":"a".repeat(64)})).unwrap();
        assert_eq!(s.decision_panels[0].status, "paused");
        s.apply(&json!({"action":"resume_panel","panelId":id}))
            .unwrap();
        assert_eq!(
            s.jobs.iter().find(|j| j.id == running).unwrap().status,
            "completed"
        );
        finish_round(&mut s);
        assert_eq!(s.decision_panels[0].status, "review");
        assert_eq!(s.jobs.len(), 8);
    }
    #[test]
    fn department_scope_and_read_only_tools_are_enforced() {
        let mut s = state();
        let department = s.departments[0].id.clone();
        s.apply(&json!({"action":"convene_panel","companyId":"atlas","scope":{"kind":"department","id":department},"title":"Department review","task":"Inspect the component","focus":"research","roleKeys":["newton"]})).unwrap();
        let id = s.decision_panels[0].id.clone();
        assert_eq!(
            s.staff(&s.decision_panels[0].members[0].employee_id)
                .unwrap()
                .department_id
                .as_deref(),
            Some(department.as_str())
        );
        let settings = json!({"mode":"manual","provider":"anthropic","model":"","authorized":false,"maxTokens":20,"maxUsd":1,"maxMinutes":1,"priceRates":{"inputUsdPerMillion":null,"outputUsdPerMillion":null},"allowedTools":["github.publish_changes"]});
        assert_eq!(
            s.apply(&json!({"action":"start_panel_round","panelId":id,"runSettings":settings}))
                .unwrap_err()
                .code,
            "PANEL_READ_ONLY"
        );
        s.apply(&json!({"action":"start_panel_round","panelId":id}))
            .unwrap();
        assert!(s
            .jobs
            .iter()
            .all(|j| j.department_id.as_deref() == Some(department.as_str())));
    }
}
