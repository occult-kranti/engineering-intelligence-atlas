//! Portfolio organization never merges repository identities or grants implicit
//! access to another company's knowledge. Shared workers retain their IDs and
//! need a live, scoped service contract before accepting recipient work.
use super::*;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CeoConfiguration {
    pub enabled: bool,
    pub title: String,
    pub focus_group_id: Option<String>,
    pub shared_services_company_id: Option<String>,
    pub updated_at: String,
}
impl Default for CeoConfiguration {
    fn default() -> Self {
        Self {
            enabled: false,
            title: "CEO / Portfolio".into(),
            focus_group_id: None,
            shared_services_company_id: None,
            updated_at: now(),
        }
    }
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PortfolioGroup {
    pub id: String,
    pub name: String,
    pub description: String,
    pub company_ids: Vec<String>,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SharedService {
    pub id: String,
    pub key: String,
    pub name: String,
    pub company_id: String,
    pub office_id: String,
    pub department_id: String,
    pub employee_ids: Vec<String>,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
    #[serde(default)]
    pub retired_employee_ids: Vec<String>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServiceContract {
    pub id: String,
    pub service_id: String,
    pub recipient_company_id: String,
    pub recipient_office_id: Option<String>,
    pub recipient_department_id: Option<String>,
    pub employee_ids: Vec<String>,
    pub allowed_tools: Vec<String>,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeTransfer {
    pub id: String,
    pub source_company_id: String,
    pub recipient_company_id: String,
    pub knowledge_id: String,
    pub status: String,
    pub purpose: String,
    pub created_at: String,
    pub updated_at: String,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PortfolioRoadmapItem {
    pub id: String,
    pub scope: Scope,
    pub title: String,
    pub description: String,
    pub owner_employee_id: String,
    #[serde(default)]
    pub reviewer_employee_id: Option<String>,
    #[serde(default)]
    pub reviewer_service_contract_id: Option<String>,
    #[serde(default)]
    pub estimate: Option<WorkEstimate>,
    #[serde(default)]
    pub review_estimate: Option<WorkEstimate>,
    #[serde(default)]
    pub revision: u64,
    pub department_id: Option<String>,
    pub service_contract_id: Option<String>,
    pub status: String,
    pub dependencies: Vec<String>,
    pub goal_ids: Vec<String>,
    pub job_ids: Vec<String>,
    pub evidence: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PortfolioRecommendation {
    pub employee_id: String,
    pub service_id: String,
    pub reason: String,
}
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Portfolio {
    #[serde(default)]
    pub schema_version: u32,
    pub ceo: CeoConfiguration,
    pub groups: Vec<PortfolioGroup>,
    pub services: Vec<SharedService>,
    pub contracts: Vec<ServiceContract>,
    pub transfers: Vec<KnowledgeTransfer>,
    pub roadmap: Vec<PortfolioRoadmapItem>,
    pub recommendations: Vec<PortfolioRecommendation>,
}

struct Specialty {
    key: &'static str,
    name: &'static str,
    role: &'static str,
    reuse: &'static str,
    skills: &'static [&'static str],
}
const SPECIALTIES: &[Specialty] = &[
    Specialty {
        key: "engineering",
        name: "Engineering",
        role: "Shared engineering and implementation specialist",
        reuse: "code-engineer",
        skills: &[
            "skills/local-model-runtime-engineering/SKILL.md",
            "skills/engineering-organization-architect/SKILL.md",
        ],
    },
    Specialty {
        key: "design-architecture",
        name: "Design & Architecture",
        role: "Shared design, architecture and spatial systems specialist",
        reuse: "blueprint-steward",
        skills: &[
            "skills/architecture-and-built-heritage-research/SKILL.md",
            "skills/spatial-3d-production-engineering/SKILL.md",
        ],
    },
    Specialty {
        key: "research-knowledge",
        name: "Research & Knowledge",
        role: "Shared evidence research and knowledge specialist",
        reuse: "knowledge-curator",
        skills: &[
            "skills/agent-research-director/SKILL.md",
            "skills/ai-open-model-research/SKILL.md",
        ],
    },
    Specialty {
        key: "security",
        name: "Security",
        role: "Shared defensive security and quality specialist",
        reuse: "qa-lead",
        skills: &["skills/defensive-reverse-engineering/SKILL.md"],
    },
    Specialty {
        key: "hackathon",
        name: "Hackathon",
        role: "Shared hackathon planning and prototype specialist",
        reuse: "hackathon",
        skills: &[
            "skills/engineering-organization-architect/SKILL.md",
            "skills/game-reconstruction-engineering/SKILL.md",
        ],
    },
    Specialty {
        key: "music-arts",
        name: "Music & Arts",
        role: "Shared music, audio and arts specialist",
        reuse: "music",
        skills: &[
            "skills/ai-open-model-research/SKILL.md",
            "skills/spatial-3d-production-engineering/SKILL.md",
        ],
    },
];
fn optional_description(p: &Value) -> Result<String> {
    match p.get("description") {
        None | Some(Value::Null) => Ok(String::new()),
        Some(Value::String(v)) if v.is_empty() => Ok(String::new()),
        _ => string(p, "description", 4000),
    }
}
fn unique_strings(p: &Value, key: &str, max: usize) -> Result<Vec<String>> {
    let result = strings(p, key, max)?;
    if result.iter().collect::<HashSet<_>>().len() != result.len() {
        return Err(fail("INVALID_INPUT", format!("Duplicate {key}")));
    }
    Ok(result)
}

impl OfficeSnapshot {
    pub fn migrate_portfolio(&mut self) -> bool {
        if self.portfolio.schema_version == 0 {
            self.portfolio.schema_version = 1;
            self.portfolio.ceo.updated_at = now();
            true
        } else {
            false
        }
    }
    fn upsert_group(&mut self, p: &Value) -> Result<String> {
        let name = string(p, "name", 200)?;
        let group_id = opt_string(p, "id", 100)?
            .or_else(|| {
                self.portfolio
                    .groups
                    .iter()
                    .find(|g| g.name == name)
                    .map(|g| g.id.clone())
            })
            .unwrap_or_else(|| id("group"));
        if !safe_id(&group_id) {
            return Err(fail("INVALID_INPUT", "Invalid portfolio group identity"));
        }
        let company_ids = unique_strings(p, "companyIds", 2000)?;
        for company in &company_ids {
            self.company(company)?;
        }
        let status = opt_string(p, "status", 20)?.unwrap_or_else(|| {
            self.portfolio
                .groups
                .iter()
                .find(|g| g.id == group_id)
                .map(|g| g.status.clone())
                .unwrap_or_else(|| "active".into())
        });
        if !["active", "paused"].contains(&status.as_str()) {
            return Err(fail("INVALID_INPUT", "Invalid group status"));
        }
        let stamp = now();
        let mut group = PortfolioGroup {
            id: group_id.clone(),
            name,
            description: optional_description(p)?,
            company_ids,
            status,
            created_at: stamp.clone(),
            updated_at: stamp,
        };
        if let Some(existing) = self.portfolio.groups.iter_mut().find(|g| g.id == group_id) {
            group.created_at = existing.created_at.clone();
            *existing = group;
        } else {
            if self.portfolio.groups.len() >= 100 {
                return Err(fail(
                    "CAPACITY",
                    "At most 100 portfolio groups are supported",
                ));
            }
            self.portfolio.groups.push(group);
        }
        Ok(group_id)
    }
    fn ensure_services(&mut self, p: &Value) -> Result<()> {
        let preset = opt_string(p, "preset", 50)?.unwrap_or_else(|| "standard".into());
        if preset != "standard" {
            return Err(fail("INVALID_INPUT", "Unknown shared service preset"));
        }
        if let Some(assignments) = p.get("assignments") {
            let values = assignments.as_object().ok_or_else(|| {
                fail(
                    "INVALID_INPUT",
                    "Service assignments must map known service keys to employee IDs",
                )
            })?;
            if values
                .keys()
                .any(|k| !SPECIALTIES.iter().any(|s| s.key == k))
            {
                return Err(fail("INVALID_INPUT", "Unknown service assignment key"));
            }
        }
        let company_id = if let Some(existing) = &self.portfolio.ceo.shared_services_company_id {
            self.company(existing)?;
            existing.clone()
        } else {
            let fixed = if self
                .companies
                .iter()
                .any(|c| c.id == "atlas-shared-services")
            {
                None
            } else {
                Some("atlas-shared-services".into())
            };
            let company = self.add_company("Shared Services", None, fixed, false)?;
            self.companies
                .iter_mut()
                .find(|c| c.id == company)
                .unwrap()
                .source = "shared-services".into();
            self.portfolio.ceo.shared_services_company_id = Some(company.clone());
            company
        };
        let office = self
            .offices
            .iter()
            .find(|o| o.company_id == company_id)
            .ok_or_else(|| fail("NOT_FOUND", "Shared Services office is missing"))?
            .id
            .clone();
        for specialty in SPECIALTIES {
            let existing = self
                .portfolio
                .services
                .iter()
                .find(|s| s.key == specialty.key)
                .cloned();
            let department = if let Some(service) = &existing {
                service.department_id.clone()
            } else if let Some(department) = self.departments.iter().find(|d| {
                d.office_id == office
                    && (d.name == specialty.name
                        || (specialty.key == "research-knowledge" && d.name == "Research"))
            }) {
                let department_id = department.id.clone();
                self.departments
                    .iter_mut()
                    .find(|d| d.id == department_id)
                    .unwrap()
                    .name = specialty.name.into();
                department_id
            } else {
                self.add_department(&office, specialty.name)?
            };
            let explicit = p.get("assignments").and_then(|v| v.get(specialty.key));
            let employee_ids = if let Some(value) = explicit {
                let employees = unique_strings(&json!({"employees":value}), "employees", 20)?;
                if employees.is_empty() {
                    return Err(fail(
                        "INVALID_INPUT",
                        "A shared service requires at least one explicit employee",
                    ));
                }
                for employee in &employees {
                    let staff = self.staff(employee)?;
                    if staff.kind != "specialist"
                        || staff.company_id.is_none()
                        || staff.status == "fired"
                    {
                        return Err(fail("INVALID_INPUT", "Shared service assignments require existing, non-fired specialist records"));
                    }
                }
                employees
            } else if let Some(service) = &existing {
                service.employee_ids.clone()
            } else {
                let shared_key = format!("shared:{}", specialty.key);
                let reusable = self
                    .employees
                    .iter()
                    .find(|e| {
                        e.kind == "specialist"
                            && e.status == "active"
                            && e.assignment_key.as_deref() == Some(shared_key.as_str())
                    })
                    .or_else(|| {
                        self.employees.iter().find(|e| {
                            e.kind == "specialist"
                                && e.status == "active"
                                && e.assignment_key.as_deref() == Some(specialty.reuse)
                        })
                    })
                    .map(|e| e.id.clone());
                if let Some(employee) = reusable {
                    vec![employee]
                } else {
                    let employee = self.add_staff(
                        &company_id,
                        Some(office.clone()),
                        Some(department.clone()),
                        specialty.name,
                        specialty.role,
                        "specialist",
                        specialty.skills.iter().map(|p| p.to_string()).collect(),
                        None,
                    )?;
                    self.employees
                        .iter_mut()
                        .find(|e| e.id == employee)
                        .unwrap()
                        .assignment_key = Some(shared_key);
                    vec![employee]
                }
            };
            let stamp = now();
            if let Some(service) = self
                .portfolio
                .services
                .iter_mut()
                .find(|s| s.key == specialty.key)
            {
                if service.employee_ids != employee_ids {
                    for employee in &service.employee_ids {
                        if !employee_ids.contains(employee)
                            && !service.retired_employee_ids.contains(employee)
                        {
                            service.retired_employee_ids.push(employee.clone());
                        }
                    }
                    if service.retired_employee_ids.len() > 1000 {
                        return Err(fail(
                            "CAPACITY",
                            "Service assignment history reached its bound",
                        ));
                    }
                    for contract in self
                        .portfolio
                        .contracts
                        .iter_mut()
                        .filter(|c| c.service_id == service.id && c.status == "active")
                    {
                        contract.status = "paused".into();
                        contract.updated_at = stamp.clone();
                    }
                    service.employee_ids = employee_ids;
                    service.updated_at = stamp;
                }
            } else {
                self.portfolio.services.push(SharedService {
                    id: id("service"),
                    key: specialty.key.into(),
                    name: specialty.name.into(),
                    company_id: company_id.clone(),
                    office_id: office.clone(),
                    department_id: department,
                    employee_ids,
                    status: "active".into(),
                    created_at: stamp.clone(),
                    updated_at: stamp,
                    retired_employee_ids: vec![],
                });
            }
        }
        self.ensure_blueprint(&office)?;
        let services: Vec<_> = self
            .portfolio
            .services
            .iter()
            .filter(|s| s.office_id == office)
            .cloned()
            .collect();
        let blueprint = self
            .blueprints
            .iter_mut()
            .find(|b| b.office_id == office)
            .unwrap();
        for service in services {
            let room = if let Some(room) = blueprint
                .rooms
                .iter()
                .find(|r| r.department_id.as_deref() == Some(&service.department_id))
            {
                room.id.clone()
            } else {
                let room_id = id("room");
                blueprint.rooms.push(Room {
                    id: room_id.clone(),
                    name: service.name,
                    department_id: Some(service.department_id),
                    x: 0.05,
                    y: 0.05,
                    width: 0.3,
                    height: 0.3,
                });
                room_id
            };
            for (i, employee) in service.employee_ids.iter().enumerate() {
                if !blueprint.desks.iter().any(|d| &d.employee_id == employee) {
                    blueprint.desks.push(Desk {
                        id: id("desk"),
                        room_id: room.clone(),
                        employee_id: employee.clone(),
                        x: 0.15 + (i % 4) as f64 * 0.2,
                        y: 0.25 + (i / 4) as f64 * 0.1,
                    });
                }
            }
        }
        Ok(())
    }
    fn upsert_contract(&mut self, p: &Value) -> Result<String> {
        let service_id = string(p, "serviceId", 100)?;
        let service = self
            .portfolio
            .services
            .iter()
            .find(|s| s.id == service_id)
            .ok_or_else(|| fail("NOT_FOUND", "Shared service not found"))?
            .clone();
        let company = string(p, "recipientCompanyId", 100)?;
        self.company(&company)?;
        let office = opt_string(p, "recipientOfficeId", 100)?;
        let department = opt_string(p, "recipientDepartmentId", 100)?;
        if office.as_ref().is_some_and(|o| {
            !self
                .offices
                .iter()
                .any(|x| &x.id == o && x.company_id == company)
        }) {
            return Err(fail(
                "SCOPE_MISMATCH",
                "Contract recipient office belongs to another company",
            ));
        }
        if department.as_ref().is_some_and(|d| {
            !self.departments.iter().any(|x| {
                &x.id == d && x.company_id == company && Some(&x.office_id) == office.as_ref()
            })
        }) {
            return Err(fail(
                "SCOPE_MISMATCH",
                "Contract department requires its matching recipient office",
            ));
        }
        let contract_id = opt_string(p, "id", 100)?
            .or_else(|| {
                self.portfolio
                    .contracts
                    .iter()
                    .find(|c| {
                        c.service_id == service_id
                            && c.recipient_company_id == company
                            && c.recipient_office_id == office
                            && c.recipient_department_id == department
                    })
                    .map(|c| c.id.clone())
            })
            .unwrap_or_else(|| id("contract"));
        if !safe_id(&contract_id) {
            return Err(fail("INVALID_INPUT", "Invalid service contract identity"));
        }
        let previous = self
            .portfolio
            .contracts
            .iter()
            .find(|c| c.id == contract_id)
            .cloned();
        if previous.as_ref().is_some_and(|c| {
            c.service_id != service_id
                || c.recipient_company_id != company
                || c.recipient_office_id != office
                || c.recipient_department_id != department
        }) {
            return Err(fail(
                "IMMUTABLE_SCOPE",
                "Contract service and recipient scope are immutable",
            ));
        }
        let employees = if p.get("employeeIds").is_some() {
            unique_strings(p, "employeeIds", 20)?
        } else {
            previous
                .as_ref()
                .map(|c| c.employee_ids.clone())
                .unwrap_or_else(|| service.employee_ids.clone())
        };
        if employees.is_empty() || employees.iter().any(|e| !service.employee_ids.contains(e)) {
            return Err(fail(
                "INVALID_INPUT",
                "Contract employees must be members of this shared service",
            ));
        }
        let tools = if p.get("allowedTools").is_some() {
            unique_strings(p, "allowedTools", 30)?
        } else {
            previous
                .as_ref()
                .map(|c| c.allowed_tools.clone())
                .unwrap_or_default()
        };
        let status = opt_string(p, "status", 20)?.unwrap_or_else(|| {
            previous
                .as_ref()
                .map(|c| c.status.clone())
                .unwrap_or_else(|| "active".into())
        });
        if !["active", "paused", "revoked"].contains(&status.as_str()) {
            return Err(fail("INVALID_INPUT", "Invalid service contract status"));
        }
        let stamp = now();
        let contract = ServiceContract {
            id: contract_id.clone(),
            service_id,
            recipient_company_id: company,
            recipient_office_id: office,
            recipient_department_id: department,
            employee_ids: employees,
            allowed_tools: tools,
            status,
            created_at: previous
                .as_ref()
                .map(|c| c.created_at.clone())
                .unwrap_or_else(|| stamp.clone()),
            updated_at: stamp,
        };
        if let Some(c) = self
            .portfolio
            .contracts
            .iter_mut()
            .find(|c| c.id == contract_id)
        {
            *c = contract;
        } else {
            if self.portfolio.contracts.len() >= 12000 {
                return Err(fail("CAPACITY", "Service contract capacity reached"));
            }
            self.portfolio.contracts.push(contract);
        }
        Ok(contract_id)
    }
    pub(super) fn validate_worker_assignment(
        &self,
        company: &str,
        office: &str,
        department: Option<&str>,
        employee_id: &str,
        contract_id: Option<&str>,
        tools: &[String],
    ) -> Result<()> {
        let employee = self.staff(employee_id)?;
        if employee.status == "fired" {
            return Err(fail("SCOPE_MISMATCH", "Employee is fired"));
        }
        if let Some(contract_id) = contract_id {
            let contract = self
                .portfolio
                .contracts
                .iter()
                .find(|c| c.id == contract_id)
                .ok_or_else(|| {
                    fail(
                        "SERVICE_CONTRACT_REQUIRED",
                        "Shared worker requires an explicit service contract",
                    )
                })?;
            let service = self
                .portfolio
                .services
                .iter()
                .find(|s| s.id == contract.service_id)
                .ok_or_else(|| fail("SERVICE_CONTRACT_REQUIRED", "Contract service is missing"))?;
            if contract.status != "active" || service.status != "active" {
                return Err(fail(
                    "SERVICE_CONTRACT_INACTIVE",
                    "Shared service contract is paused or revoked",
                ));
            }
            if contract.recipient_company_id != company
                || contract
                    .recipient_office_id
                    .as_ref()
                    .is_some_and(|o| o != office)
                || contract
                    .recipient_department_id
                    .as_ref()
                    .is_some_and(|d| Some(d.as_str()) != department)
                || !contract.employee_ids.iter().any(|e| e == employee_id)
                || !service.employee_ids.iter().any(|e| e == employee_id)
            {
                return Err(fail(
                    "SCOPE_MISMATCH",
                    "Service contract does not cover this worker and recipient scope",
                ));
            }
            if tools.iter().any(|t| !contract.allowed_tools.contains(t)) {
                return Err(fail(
                    "TOOL_NOT_CONTRACTED",
                    "A job requested a tool outside its service contract",
                ));
            }
            return Ok(());
        }
        if employee.company_id.as_ref().is_some_and(|c| c != company)
            || employee.office_id.as_ref().is_some_and(|o| o != office)
            || employee
                .department_id
                .as_ref()
                .is_some_and(|d| Some(d.as_str()) != department)
        {
            return Err(fail(
                "SERVICE_CONTRACT_REQUIRED",
                "Cross-scope worker requires an active explicit service contract",
            ));
        }
        Ok(())
    }
    pub(super) fn validate_knowledge_access(&self, company: &str, ids: &[String]) -> Result<()> {
        if ids.len() > 50 || ids.iter().collect::<HashSet<_>>().len() != ids.len() {
            return Err(fail(
                "INVALID_INPUT",
                "Invalid knowledge transfer references",
            ));
        }
        for transfer_id in ids {
            let transfer = self
                .portfolio
                .transfers
                .iter()
                .find(|t| &t.id == transfer_id)
                .ok_or_else(|| {
                    fail(
                        "KNOWLEDGE_NOT_GRANTED",
                        "Knowledge transfer reference does not exist",
                    )
                })?;
            if transfer.status != "granted"
                || transfer.recipient_company_id != company
                || !self.knowledge.iter().any(|k| {
                    k.id == transfer.knowledge_id && k.company_id == transfer.source_company_id
                })
            {
                return Err(fail(
                    "KNOWLEDGE_NOT_GRANTED",
                    "Knowledge is not explicitly granted to this company",
                ));
            }
        }
        Ok(())
    }
    pub(super) fn portfolio_allows_dispatch(&self, job: &Job) -> std::result::Result<(), String> {
        self.validate_worker_assignment(
            &job.company_id,
            &job.office_id,
            job.department_id.as_deref(),
            &job.employee_id,
            job.service_contract_id.as_deref(),
            &job.allowed_tools,
        )
        .map_err(|e| e.message)?;
        self.validate_knowledge_access(&job.company_id, &job.knowledge_transfer_ids)
            .map_err(|e| e.message)?;
        if self
            .portfolio
            .groups
            .iter()
            .any(|g| g.status == "paused" && g.company_ids.contains(&job.company_id))
        {
            return Err("A portfolio group containing this company is paused".into());
        }
        let employee = self.staff(&job.employee_id).map_err(|e| e.message)?;
        if employee.company_id.as_ref().is_some_and(|company| {
            self.portfolio
                .groups
                .iter()
                .any(|g| g.status == "paused" && g.company_ids.contains(company))
        }) {
            return Err("Shared worker's portfolio group is paused".into());
        }
        if employee.company_id.as_ref().is_some_and(|c| {
            self.companies
                .iter()
                .find(|x| &x.id == c)
                .is_none_or(|x| x.status != "active")
        }) || employee.office_id.as_ref().is_some_and(|o| {
            self.offices
                .iter()
                .find(|x| &x.id == o)
                .is_none_or(|x| x.status != "active")
        }) || employee.department_id.as_ref().is_some_and(|d| {
            self.departments
                .iter()
                .find(|x| &x.id == d)
                .is_none_or(|x| x.status != "active")
        }) {
            return Err("Shared worker's home hierarchy is paused".into());
        }
        if let Some(contract_id) = &job.service_contract_id {
            let contract = self
                .portfolio
                .contracts
                .iter()
                .find(|c| &c.id == contract_id)
                .unwrap();
            let service = self
                .portfolio
                .services
                .iter()
                .find(|s| s.id == contract.service_id)
                .unwrap();
            if self
                .portfolio
                .groups
                .iter()
                .any(|g| g.status == "paused" && g.company_ids.contains(&service.company_id))
            {
                return Err("Shared service portfolio group is paused".into());
            }
            if self
                .company(&service.company_id)
                .map_err(|e| e.message)?
                .status
                != "active"
                || self
                    .office(&service.office_id)
                    .map_err(|e| e.message)?
                    .status
                    != "active"
                || self
                    .departments
                    .iter()
                    .find(|d| d.id == service.department_id)
                    .is_none_or(|d| d.status != "active")
            {
                return Err("Shared service hierarchy is paused".into());
            }
        }
        Ok(())
    }
    pub(super) fn service_layout_member(
        &self,
        employee: &str,
        company: &str,
        office: &str,
    ) -> bool {
        self.portfolio.services.iter().any(|s| {
            s.company_id == company
                && s.office_id == office
                && s.employee_ids
                    .iter()
                    .chain(s.retired_employee_ids.iter())
                    .any(|e| e == employee)
        }) || self.portfolio.contracts.iter().any(|c| {
            c.recipient_company_id == company
                && c.recipient_office_id.as_ref().is_none_or(|o| o == office)
                && c.employee_ids.iter().any(|e| e == employee)
        })
    }
    pub(super) fn validate_layout_assignment(
        &self,
        blueprint: &Blueprint,
        room_id: &str,
        employee_id: &str,
    ) -> Result<()> {
        let room = blueprint
            .rooms
            .iter()
            .find(|r| r.id == room_id)
            .ok_or_else(|| fail("NOT_FOUND", "Layout room not found"))?;
        let employee = self.staff(employee_id)?;
        if employee
            .company_id
            .as_ref()
            .is_none_or(|c| c == &blueprint.company_id)
            && employee
                .office_id
                .as_ref()
                .is_none_or(|o| o == &blueprint.office_id)
        {
            return Ok(());
        }
        if self.portfolio.services.iter().any(|s| {
            s.company_id == blueprint.company_id
                && s.office_id == blueprint.office_id
                && s.employee_ids.iter().any(|e| e == employee_id)
        }) {
            return Ok(());
        }
        let contract = self
            .portfolio
            .contracts
            .iter()
            .find(|c| {
                c.status == "active"
                    && c.recipient_company_id == blueprint.company_id
                    && c.recipient_office_id
                        .as_ref()
                        .is_none_or(|o| o == &blueprint.office_id)
                    && c.recipient_department_id
                        .as_ref()
                        .is_none_or(|d| Some(d) == room.department_id.as_ref())
                    && c.employee_ids.iter().any(|e| e == employee_id)
            })
            .ok_or_else(|| {
                fail(
                    "SCOPE_MISMATCH",
                    "New cross-company layout ownership requires an active scoped contract",
                )
            })?;
        self.validate_worker_assignment(
            &blueprint.company_id,
            &blueprint.office_id,
            room.department_id.as_deref(),
            employee_id,
            Some(&contract.id),
            &[],
        )
    }
    fn roadmap_scope_companies(&self, scope: &Scope) -> Result<Vec<String>> {
        match scope.kind.as_str() {
            "company" => Ok(vec![self.company(&scope.id)?.id.clone()]),
            "group" => self
                .portfolio
                .groups
                .iter()
                .find(|g| g.id == scope.id)
                .map(|g| g.company_ids.clone())
                .ok_or_else(|| fail("NOT_FOUND", "Portfolio group not found")),
            "global" if scope.id == "portfolio" => {
                Ok(self.companies.iter().map(|c| c.id.clone()).collect())
            }
            _ => Err(fail(
                "INVALID_INPUT",
                "Roadmap scope must name a company, group or global portfolio",
            )),
        }
    }
    pub(super) fn roadmap_visible_to_company(&self, item_id: &str, company: &str) -> bool {
        self.portfolio
            .roadmap
            .iter()
            .find(|r| r.id == item_id)
            .is_some_and(|r| {
                self.roadmap_scope_companies(&r.scope)
                    .is_ok_and(|companies| companies.iter().any(|c| c == company))
            })
    }
    fn upsert_roadmap(&mut self, p: &Value) -> Result<String> {
        let scope: Scope = serde_json::from_value(p.get("scope").cloned().unwrap_or(Value::Null))
            .map_err(|_| fail("INVALID_INPUT", "Invalid roadmap scope"))?;
        let companies = self.roadmap_scope_companies(&scope)?;
        let title = string(p, "title", 200)?;
        let item_id = opt_string(p, "id", 100)?
            .or_else(|| {
                self.portfolio
                    .roadmap
                    .iter()
                    .find(|r| r.scope == scope && r.title == title)
                    .map(|r| r.id.clone())
            })
            .unwrap_or_else(|| id("roadmap"));
        if !safe_id(&item_id) {
            return Err(fail("INVALID_INPUT", "Invalid roadmap identity"));
        }
        let previous = self
            .portfolio
            .roadmap
            .iter()
            .find(|r| r.id == item_id)
            .cloned();
        if previous.as_ref().is_some_and(|r| r.scope != scope) {
            return Err(fail(
                "IMMUTABLE_SCOPE",
                "Roadmap scope cannot be moved across tenants",
            ));
        }
        let revision = next_revision(p, previous.as_ref().map(|r| r.revision))?;
        let reviewer_employee_id = opt_string(p, "reviewerEmployeeId", 100)?;
        let reviewer_service_contract_id = opt_string(p, "reviewerServiceContractId", 100)?;
        let estimate: Option<WorkEstimate> = p.get("estimate").filter(|v| !v.is_null()).map(|v| serde_json::from_value(v.clone()).map_err(|_| fail("INVALID_ESTIMATE", "Invalid production estimate"))).transpose()?;
        let review_estimate: Option<WorkEstimate> = p.get("reviewEstimate").filter(|v| !v.is_null()).map(|v| serde_json::from_value(v.clone()).map_err(|_| fail("INVALID_ESTIMATE", "Invalid review estimate"))).transpose()?;
        for value in [&estimate, &review_estimate].into_iter().flatten() { value.validate()?; }
        let owner = string(p, "ownerEmployeeId", 100)?;
        let employee = self.staff(&owner)?;
        if employee.status == "fired" {
            return Err(fail(
                "INVALID_INPUT",
                "Assign roadmap work to an available employee",
            ));
        }
        let department = opt_string(p, "departmentId", 100)?;
        let contract = opt_string(p, "serviceContractId", 100)?;
        if scope.kind == "company" && employee.company_id.as_ref().is_some_and(|c| c != &scope.id) {
            let agreement = contract
                .as_ref()
                .and_then(|id| self.portfolio.contracts.iter().find(|c| &c.id == id))
                .ok_or_else(|| {
                    fail(
                        "SERVICE_CONTRACT_REQUIRED",
                        "Cross-company roadmap ownership requires a service contract",
                    )
                })?;
            let office = agreement
                .recipient_office_id
                .clone()
                .or_else(|| {
                    self.offices
                        .iter()
                        .find(|o| o.company_id == scope.id)
                        .map(|o| o.id.clone())
                })
                .ok_or_else(|| fail("NOT_FOUND", "Company office missing"))?;
            self.validate_worker_assignment(
                &scope.id,
                &office,
                department
                    .as_deref()
                    .or(agreement.recipient_department_id.as_deref()),
                &owner,
                Some(&agreement.id),
                &[],
            )?;
        }
        if let Some(department_id) = &department {
            let d = self
                .departments
                .iter()
                .find(|d| &d.id == department_id)
                .ok_or_else(|| fail("NOT_FOUND", "Roadmap department missing"))?;
            if !companies.contains(&d.company_id)
                && !(scope.kind != "company"
                    && self.portfolio.ceo.shared_services_company_id.as_deref()
                        == Some(&d.company_id))
            {
                return Err(fail(
                    "SCOPE_MISMATCH",
                    "Roadmap department is outside its scope",
                ));
            }
        }
        let reviewer = reviewer_employee_id.as_deref().ok_or_else(|| fail("PAIR_REQUIRED", "Roadmap work requires a distinct helper/reviewer"))?;
        let review_employee = self.staff(reviewer)?;
        if reviewer == owner || review_employee.status != "active" { return Err(fail("PAIR_REQUIRED", "Roadmap owner and active reviewer must be different employees")); }
        let pair_company = if scope.kind == "company" { scope.id.clone() } else {
            employee.company_id.clone().or_else(|| review_employee.company_id.clone())
                .filter(|company| companies.contains(company))
                .ok_or_else(|| fail("PAIR_REQUIRED", "Select paired employees inside a concrete company covered by this roadmap scope"))?
        };
        let pair_office = contract.as_ref().and_then(|id| self.portfolio.contracts.iter().find(|c| &c.id == id)).and_then(|c| c.recipient_office_id.clone())
            .or_else(|| employee.office_id.clone().filter(|id| self.offices.iter().any(|o| &o.id == id && o.company_id == pair_company)))
            .or_else(|| self.offices.iter().find(|o| o.company_id == pair_company).map(|o| o.id.clone()))
            .ok_or_else(|| fail("PAIR_REQUIRED", "Roadmap pair needs an existing office"))?;
        self.validate_worker_assignment(&pair_company, &pair_office, department.as_deref(), &owner, contract.as_deref(), &[])?;
        self.validate_worker_assignment(&pair_company, &pair_office, department.as_deref(), reviewer, reviewer_service_contract_id.as_deref(), &[])?;
        let status = opt_string(p, "status", 30)?.unwrap_or_else(|| {
            previous
                .as_ref()
                .map(|r| r.status.clone())
                .unwrap_or_else(|| "planned".into())
        });
        if !["planned", "in-progress", "blocked", "done"].contains(&status.as_str()) {
            return Err(fail("INVALID_INPUT", "Invalid roadmap status"));
        }
        let dependencies = unique_strings(p, "dependencies", 100)?;
        let goals = unique_strings(p, "goalIds", 100)?;
        let jobs = unique_strings(p, "jobIds", 100)?;
        for dependency in &dependencies {
            let d = self
                .portfolio
                .roadmap
                .iter()
                .find(|d| &d.id == dependency)
                .ok_or_else(|| fail("INVALID_DEPENDENCY", "Roadmap dependency not found"))?;
            if dependency == &item_id
                || (scope.kind != "global"
                    && !self
                        .roadmap_scope_companies(&d.scope)?
                        .iter()
                        .any(|c| companies.contains(c)))
            {
                return Err(fail("INVALID_DEPENDENCY", "Roadmap dependency is self-referential or outside the selected portfolio scope"));
            }
            if status == "done" && d.status != "done" {
                return Err(fail(
                    "DEPENDENCY_PENDING",
                    "Complete roadmap dependencies before marking this item done",
                ));
            }
        }
        if goals.iter().any(|g| {
            !self
                .goals
                .iter()
                .any(|x| &x.id == g && companies.contains(&x.company_id))
        }) || jobs.iter().any(|j| {
            !self
                .jobs
                .iter()
                .any(|x| &x.id == j && companies.contains(&x.company_id))
        }) {
            return Err(fail(
                "SCOPE_MISMATCH",
                "Linked work must belong to the roadmap scope",
            ));
        }
        let evidence = opt_string(p, "evidence", 4000)?;
        if status == "done" && evidence.is_none() {
            return Err(fail(
                "EVIDENCE_REQUIRED",
                "Completed roadmap items require evidence",
            ));
        }
        if status == "done" {
            if goals.is_empty() && jobs.is_empty() { return Err(fail("REVIEW_EVIDENCE_REQUIRED", "Completed roadmap work must link actual accepted paired execution")); }
            for goal_id in &goals {
                let goal = self.goals.iter().find(|g| &g.id == goal_id).unwrap();
                let current: Vec<_> = self.jobs.iter().filter(|j| j.goal_id.as_deref() == Some(goal_id) && j.goal_iteration == Some(goal.iteration)).collect();
                if goal.status != "completed" || current.is_empty() || current.iter().any(|j| !self.job_accepted(j)) { return Err(fail("REVIEW_EVIDENCE_REQUIRED", "Linked goal has not passed its paired reviews")); }
            }
            if jobs.iter().any(|id| self.jobs.iter().find(|j| &j.id == id).is_none_or(|j| !self.job_accepted(j))) { return Err(fail("REVIEW_EVIDENCE_REQUIRED", "Linked job has not passed its paired review")); }
        }
        let stamp = now();
        let roadmap = PortfolioRoadmapItem {
            id: item_id.clone(),
            scope,
            title,
            description: optional_description(p)?,
            owner_employee_id: owner,
            reviewer_employee_id,
            reviewer_service_contract_id,
            estimate,
            review_estimate,
            revision,
            department_id: department,
            service_contract_id: contract,
            status,
            dependencies,
            goal_ids: goals,
            job_ids: jobs,
            evidence,
            created_at: previous
                .as_ref()
                .map(|r| r.created_at.clone())
                .unwrap_or_else(|| stamp.clone()),
            updated_at: stamp,
        };
        // Validate a candidate graph before replacing persisted progress.
        let mut candidate = self.portfolio.roadmap.clone();
        if let Some(index) = candidate.iter().position(|r| r.id == item_id) {
            candidate[index] = roadmap;
        } else {
            if candidate.len() >= 20000 {
                return Err(fail("CAPACITY", "Portfolio roadmap capacity reached"));
            }
            candidate.push(roadmap);
        }
        validate_roadmap_dag(&candidate)?;
        self.portfolio.roadmap = candidate;
        Ok(item_id)
    }
    fn optimize_recommendations(&mut self, pause: bool) -> usize {
        let companies: HashSet<_> = self
            .portfolio
            .groups
            .iter()
            .flat_map(|g| g.company_ids.iter().cloned())
            .collect();
        let shared: HashSet<_> = self
            .portfolio
            .services
            .iter()
            .flat_map(|s| s.employee_ids.iter().cloned())
            .collect();
        self.portfolio.recommendations.clear();
        let mut paused = 0;
        for employee in &mut self.employees {
            if employee.kind != "specialist"
                || employee.status == "fired"
                || shared.contains(&employee.id)
                || employee
                    .company_id
                    .as_ref()
                    .is_none_or(|c| !companies.contains(c))
            {
                continue;
            }
            let Some(specialty) = SPECIALTIES
                .iter()
                .find(|s| employee.assignment_key.as_deref() == Some(s.reuse))
            else {
                continue;
            };
            let Some(service) = self
                .portfolio
                .services
                .iter()
                .find(|s| s.key == specialty.key)
            else {
                continue;
            };
            let contracted = self.portfolio.contracts.iter().any(|c| {
                c.service_id == service.id
                    && c.status == "active"
                    && Some(&c.recipient_company_id) == employee.company_id.as_ref()
            });
            if !contracted {
                continue;
            }
            let owns_work = self.jobs.iter().any(|j| j.employee_id == employee.id)
                || self
                    .goals
                    .iter()
                    .any(|g| g.steps.iter().any(|s| s.employee_id == employee.id || s.reviewer_employee_id.as_ref() == Some(&employee.id)))
                || self
                    .portfolio
                    .roadmap
                    .iter()
                    .any(|r| r.owner_employee_id == employee.id || r.reviewer_employee_id.as_ref() == Some(&employee.id))
                || self.blueprints.iter().any(|b| {
                    b.whiteboards
                        .iter()
                        .any(|w| w.owner_employee_id == employee.id)
                });
            let reason = if owns_work {
                "Retained: this employee owns recorded work or evidence; shared service is available for future assignments"
            } else if pause {
                if employee.status == "active" {
                    employee.status = "paused".into();
                    employee.updated_at = now();
                    paused += 1;
                }
                "Paused idle duplicate assignment; original identity and history remain intact"
            } else {
                "Idle duplicate specialty can use this shared service; no employee was paused automatically"
            };
            if self.portfolio.recommendations.len() < 3000 {
                self.portfolio
                    .recommendations
                    .push(PortfolioRecommendation {
                        employee_id: employee.id.clone(),
                        service_id: service.id.clone(),
                        reason: reason.into(),
                    });
            }
        }
        paused
    }
    pub(super) fn apply_portfolio(&mut self, action: &str, p: &Value) -> Result<bool> {
        match action {
            "configure_ceo" => {
                if p.get("enabled").is_some() {
                    self.portfolio.ceo.enabled = boolean(p, "enabled", false)?;
                }
                if let Some(title) = opt_string(p, "title", 200)? {
                    self.portfolio.ceo.title = title;
                }
                if p.get("focusGroupId").is_some() {
                    let group = opt_string(p, "focusGroupId", 100)?;
                    if group
                        .as_ref()
                        .is_some_and(|g| !self.portfolio.groups.iter().any(|x| &x.id == g))
                    {
                        return Err(fail("NOT_FOUND", "Focused portfolio group does not exist"));
                    }
                    self.portfolio.ceo.focus_group_id = group;
                }
                self.portfolio.ceo.updated_at = now();
                self.last_action = Some(json!({"configured":true}));
                self.log("owner", action, "portfolio", "Updated CEO portfolio view. Provider approval, tenant access and budget controls were unchanged".into());
            }
            "upsert_portfolio_group" => {
                let group_id = self.upsert_group(p)?;
                self.last_action = Some(json!({"groupId":group_id}));
                self.log("owner", action, &group_id, "Saved an explicit collection of companies; repository identities and progress remain intact".into());
            }
            "ensure_shared_services" | "optimize_portfolio" => {
                let previous_employees: HashSet<_> =
                    self.employees.iter().map(|e| e.id.clone()).collect();
                let previous_companies = self.companies.len();
                let previous_departments = self.departments.len();
                let previous_contracts = self.portfolio.contracts.len();
                if action == "optimize_portfolio" {
                    if let Some(groups) = p.get("groups") {
                        let groups =
                            groups
                                .as_array()
                                .filter(|a| a.len() <= 100)
                                .ok_or_else(|| {
                                    fail(
                                        "INVALID_INPUT",
                                        "At most 100 explicit groups may be optimized",
                                    )
                                })?;
                        for group in groups {
                            self.upsert_group(group)?;
                        }
                    }
                }
                let selected = self.active_company_id.clone();
                self.ensure_services(p)?;
                self.active_company_id = selected;
                let companies: HashSet<_> = self
                    .portfolio
                    .groups
                    .iter()
                    .flat_map(|g| g.company_ids.iter().cloned())
                    .filter(|c| Some(c) != self.portfolio.ceo.shared_services_company_id.as_ref())
                    .collect();
                if action == "optimize_portfolio" {
                    for company in &companies {
                        for service in self.portfolio.services.clone() {
                            self.upsert_contract(&json!({"serviceId":service.id,"recipientCompanyId":company,"employeeIds":service.employee_ids}))?;
                        }
                    }
                }
                let paused = if action == "optimize_portfolio" {
                    self.optimize_recommendations(boolean(p, "pauseRedundant", false)?)
                } else {
                    0
                };
                let shared: HashSet<_> = self
                    .portfolio
                    .services
                    .iter()
                    .flat_map(|s| s.employee_ids.iter().cloned())
                    .collect();
                self.last_action = Some(
                    json!({"sharedServicesCompanyId":self.portfolio.ceo.shared_services_company_id,"groupCount":self.portfolio.groups.len(),"groupedCompanyCount":companies.len(),"serviceCount":self.portfolio.services.len(),"sharedEmployeeCount":shared.len(),"reusedEmployeeCount":shared.intersection(&previous_employees).count(),"createdEmployeeCount":self.employees.len()-previous_employees.len(),"createdCompanyCount":self.companies.len()-previous_companies,"createdDepartmentCount":self.departments.len()-previous_departments,"createdContractCount":self.portfolio.contracts.len()-previous_contracts,"contractCount":self.portfolio.contracts.len(),"recommendationCount":self.portfolio.recommendations.len(),"pausedEmployeeCount":paused,"modelRequests":0}),
                );
                self.log("owner", action, "portfolio", "Prepared shared assignments and explicit contracts without deleting companies, copying worker identities, transferring knowledge or making model requests".into());
            }
            "contract_service" => {
                let contract = self.upsert_contract(p)?;
                self.last_action = Some(json!({"contractId":contract}));
                self.log("owner", action, &contract, "Saved scoped service permission. Paused/revoked contracts block new dispatch; existing accounting remains settleable".into());
            }
            "share_knowledge" => {
                let knowledge_id = string(p, "knowledgeId", 100)?;
                let knowledge = self
                    .knowledge
                    .iter()
                    .find(|k| k.id == knowledge_id)
                    .ok_or_else(|| fail("NOT_FOUND", "Source knowledge record not found"))?;
                let recipient = string(p, "recipientCompanyId", 100)?;
                self.company(&recipient)?;
                if recipient == knowledge.company_id {
                    return Err(fail(
                        "INVALID_INPUT",
                        "Knowledge transfer must name a different recipient company",
                    ));
                }
                let status = string(p, "status", 20)?;
                if !["requested", "granted", "revoked"].contains(&status.as_str()) {
                    return Err(fail("INVALID_INPUT", "Unknown knowledge transfer status"));
                }
                if status == "granted" && !boolean(p, "reviewed", false)? {
                    return Err(fail(
                        "REVIEW_REQUIRED",
                        "Grant this named knowledge reference explicitly before sharing it",
                    ));
                }
                let transfer_id = opt_string(p, "id", 100)?
                    .or_else(|| {
                        self.portfolio
                            .transfers
                            .iter()
                            .find(|t| {
                                t.knowledge_id == knowledge_id
                                    && t.recipient_company_id == recipient
                            })
                            .map(|t| t.id.clone())
                    })
                    .unwrap_or_else(|| id("transfer"));
                if !safe_id(&transfer_id) {
                    return Err(fail("INVALID_INPUT", "Invalid transfer identity"));
                }
                let existing = self
                    .portfolio
                    .transfers
                    .iter()
                    .find(|t| t.id == transfer_id)
                    .cloned();
                if existing.as_ref().is_some_and(|t| {
                    t.knowledge_id != knowledge_id || t.recipient_company_id != recipient
                }) {
                    return Err(fail(
                        "IMMUTABLE_SCOPE",
                        "Knowledge source and recipient are immutable",
                    ));
                }
                let stamp = now();
                let transfer = KnowledgeTransfer {
                    id: transfer_id.clone(),
                    source_company_id: knowledge.company_id.clone(),
                    recipient_company_id: recipient,
                    knowledge_id,
                    status: if status == "requested"
                        && existing.as_ref().is_some_and(|t| t.status == "granted")
                    {
                        "granted".into()
                    } else {
                        status
                    },
                    purpose: string(p, "purpose", 2000)?,
                    created_at: existing
                        .as_ref()
                        .map(|t| t.created_at.clone())
                        .unwrap_or_else(|| stamp.clone()),
                    updated_at: stamp,
                };
                if let Some(t) = self
                    .portfolio
                    .transfers
                    .iter_mut()
                    .find(|t| t.id == transfer_id)
                {
                    *t = transfer;
                } else {
                    if self.portfolio.transfers.len() >= 10000 {
                        return Err(fail("CAPACITY", "Knowledge transfer capacity reached"));
                    }
                    self.portfolio.transfers.push(transfer);
                }
                self.last_action = Some(json!({"transferId":transfer_id}));
                self.log("owner", action, &transfer_id, "Stored a named knowledge permission reference; no source-company context was copied".into());
            }
            "upsert_roadmap_item" => {
                let item = self.upsert_roadmap(p)?;
                self.last_action = Some(json!({"roadmapItemId":item}));
                self.log("owner", action, &item, "Saved owned roadmap progress and dependency references with completion evidence".into());
            }
            _ => return Ok(false),
        }
        self.migrate_portfolio();
        self.refresh_budget();
        Ok(true)
    }
    pub(super) fn validate_portfolio(&self) -> Result<()> {
        let p = &self.portfolio;
        if p.schema_version > 1
            || p.groups.len() > 100
            || p.services.len() > 100
            || p.contracts.len() > 12000
            || p.transfers.len() > 10000
            || p.roadmap.len() > 20000
            || p.recommendations.len() > 3000
        {
            return Err(fail(
                "OFFICE_STATE_INVALID",
                "Invalid portfolio version or collection bounds",
            ));
        }
        bounded_text(&p.ceo.title, 200, "CEO title")?;
        if p.ceo
            .focus_group_id
            .as_ref()
            .is_some_and(|g| !p.groups.iter().any(|x| &x.id == g))
            || p.ceo
                .shared_services_company_id
                .as_ref()
                .is_some_and(|c| !self.companies.iter().any(|x| &x.id == c))
        {
            return Err(fail(
                "OFFICE_STATE_INVALID",
                "Portfolio configuration references missing records",
            ));
        }
        let mut ids = HashSet::new();
        for group in &p.groups {
            if !safe_id(&group.id)
                || !ids.insert(&group.id)
                || !["active", "paused"].contains(&group.status.as_str())
                || group.company_ids.len() > 2000
                || group.company_ids.iter().collect::<HashSet<_>>().len() != group.company_ids.len()
                || group
                    .company_ids
                    .iter()
                    .any(|c| !self.companies.iter().any(|x| &x.id == c))
            {
                return Err(fail(
                    "OFFICE_STATE_INVALID",
                    "Invalid portfolio group membership",
                ));
            }
        }
        let mut service_keys = HashSet::new();
        for service in &p.services {
            if !safe_id(&service.id)
                || !ids.insert(&service.id)
                || !service_keys.insert(&service.key)
                || !SPECIALTIES.iter().any(|s| s.key == service.key)
                || !["active", "paused"].contains(&service.status.as_str())
                || service.employee_ids.is_empty()
                || service.employee_ids.len() > 20
                || !self.departments.iter().any(|d| {
                    d.id == service.department_id
                        && d.company_id == service.company_id
                        && d.office_id == service.office_id
                })
                || service.employee_ids.iter().any(|e| {
                    !self
                        .employees
                        .iter()
                        .any(|x| &x.id == e && x.kind == "specialist")
                })
            {
                return Err(fail(
                    "OFFICE_STATE_INVALID",
                    "Invalid shared service hierarchy or members",
                ));
            }
        }
        for contract in &p.contracts {
            if !safe_id(&contract.id)
                || !ids.insert(&contract.id)
                || !p.services.iter().any(|s| s.id == contract.service_id)
                || !self
                    .companies
                    .iter()
                    .any(|c| c.id == contract.recipient_company_id)
                || !["active", "paused", "revoked"].contains(&contract.status.as_str())
                || contract.employee_ids.is_empty()
                || contract.employee_ids.len() > 20
                || contract.allowed_tools.len() > 30
                || contract
                    .employee_ids
                    .iter()
                    .any(|e| !self.employees.iter().any(|x| &x.id == e))
                || contract.recipient_office_id.as_ref().is_some_and(|o| {
                    !self
                        .offices
                        .iter()
                        .any(|x| &x.id == o && x.company_id == contract.recipient_company_id)
                })
                || contract.recipient_department_id.as_ref().is_some_and(|d| {
                    !self.departments.iter().any(|x| {
                        &x.id == d
                            && Some(&x.office_id) == contract.recipient_office_id.as_ref()
                            && x.company_id == contract.recipient_company_id
                    })
                })
            {
                return Err(fail(
                    "OFFICE_STATE_INVALID",
                    "Invalid service contract reference or recipient scope",
                ));
            }
        }
        for transfer in &p.transfers {
            if !safe_id(&transfer.id)
                || !ids.insert(&transfer.id)
                || !["requested", "granted", "revoked"].contains(&transfer.status.as_str())
                || transfer.source_company_id == transfer.recipient_company_id
                || !self
                    .companies
                    .iter()
                    .any(|c| c.id == transfer.recipient_company_id)
                || !self.knowledge.iter().any(|k| {
                    k.id == transfer.knowledge_id && k.company_id == transfer.source_company_id
                })
            {
                return Err(fail(
                    "OFFICE_STATE_INVALID",
                    "Invalid knowledge transfer reference",
                ));
            }
        }
        for roadmap in &p.roadmap {
            for value in [&roadmap.estimate, &roadmap.review_estimate].into_iter().flatten() { value.validate()?; }
            if roadmap.revision > 9_007_199_254_740_991 || roadmap.reviewer_employee_id.as_ref().is_some_and(|id| id == &roadmap.owner_employee_id || !self.employees.iter().any(|e| &e.id == id))
                || roadmap.reviewer_service_contract_id.as_ref().is_some_and(|id| !p.contracts.iter().any(|c| &c.id == id)) { return Err(fail("OFFICE_STATE_INVALID", "Invalid roadmap pair or revision")); }
            let companies = self.roadmap_scope_companies(&roadmap.scope)?;
            if !safe_id(&roadmap.id)
                || !ids.insert(&roadmap.id)
                || !["planned", "in-progress", "blocked", "done"].contains(&roadmap.status.as_str())
                || (roadmap.status == "done" && roadmap.evidence.is_none())
                || !self
                    .employees
                    .iter()
                    .any(|e| e.id == roadmap.owner_employee_id)
                || roadmap
                    .department_id
                    .as_ref()
                    .is_some_and(|d| !self.departments.iter().any(|x| &x.id == d))
                || roadmap
                    .service_contract_id
                    .as_ref()
                    .is_some_and(|c| !p.contracts.iter().any(|x| &x.id == c))
                || roadmap.goal_ids.iter().any(|g| {
                    !self
                        .goals
                        .iter()
                        .any(|x| &x.id == g && companies.contains(&x.company_id))
                })
                || roadmap.job_ids.iter().any(|j| {
                    !self
                        .jobs
                        .iter()
                        .any(|x| &x.id == j && companies.contains(&x.company_id))
                })
            {
                return Err(fail(
                    "OFFICE_STATE_INVALID",
                    "Invalid owned roadmap reference",
                ));
            }
        }
        for job in &self.jobs {
            if job.service_contract_id.as_ref().is_some_and(|c| {
                !p.contracts
                    .iter()
                    .any(|x| &x.id == c && x.recipient_company_id == job.company_id)
            }) || job.knowledge_transfer_ids.len() > 50
                || job.knowledge_transfer_ids.iter().any(|t| {
                    !p.transfers
                        .iter()
                        .any(|x| &x.id == t && x.recipient_company_id == job.company_id)
                })
            {
                return Err(fail(
                    "OFFICE_STATE_INVALID",
                    "Job contains an invalid portfolio permission reference",
                ));
            }
        }
        validate_roadmap_dag(&p.roadmap)
    }
}

fn validate_roadmap_dag(items: &[PortfolioRoadmapItem]) -> Result<()> {
    let indexes: HashMap<_, _> = items
        .iter()
        .enumerate()
        .map(|(i, r)| (r.id.as_str(), i))
        .collect();
    if indexes.len() != items.len() {
        return Err(fail("INVALID_DEPENDENCY", "Duplicate roadmap identity"));
    }
    let mut indegree = vec![0; items.len()];
    let mut children = vec![vec![]; items.len()];
    for (i, item) in items.iter().enumerate() {
        if item.dependencies.len() > 100 {
            return Err(fail("INVALID_DEPENDENCY", "Too many roadmap dependencies"));
        }
        for dep in &item.dependencies {
            let parent = *indexes
                .get(dep.as_str())
                .ok_or_else(|| fail("INVALID_DEPENDENCY", "Missing roadmap dependency"))?;
            indegree[i] += 1;
            children[parent].push(i);
        }
    }
    let mut ready: VecDeque<_> = indegree
        .iter()
        .enumerate()
        .filter_map(|(i, n)| (*n == 0).then_some(i))
        .collect();
    let mut visited = 0;
    while let Some(i) = ready.pop_front() {
        visited += 1;
        for child in &children[i] {
            indegree[*child] -= 1;
            if indegree[*child] == 0 {
                ready.push_back(*child);
            }
        }
    }
    if visited != items.len() {
        return Err(fail(
            "INVALID_DEPENDENCY",
            "Portfolio roadmap contains a dependency cycle",
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    fn state() -> OfficeSnapshot {
        let company: Company = serde_json::from_value(json!({"id":"alpha","name":"Alpha","repoUrl":"https://github.com/example/alpha","owner":"example","repo":"alpha","githubStatus":"unchecked"})).unwrap();
        let mut state = OfficeSnapshot::seeded(&company, &[]).unwrap();
        state.apply(&json!({"action":"create_company","id":"beta","name":"Beta","repoUrl":"https://github.com/example/beta"})).unwrap();
        state
    }
    fn optimize(s: &mut OfficeSnapshot, pause: bool) {
        s.apply(&json!({"action":"optimize_portfolio","preset":"standard","pauseRedundant":pause,"groups":[{"id":"products","name":"Products","description":"Explicit fixture grouping","companyIds":["alpha","beta"]}]})).unwrap();
    }
    fn borrowed(s: &OfficeSnapshot) -> (String, String, String) {
        let service = s
            .portfolio
            .services
            .iter()
            .find(|s| s.key == "engineering")
            .unwrap();
        let contract = s
            .portfolio
            .contracts
            .iter()
            .find(|c| c.service_id == service.id && c.recipient_company_id == "beta")
            .unwrap();
        (
            service.id.clone(),
            contract.id.clone(),
            service.employee_ids[0].clone(),
        )
    }
    fn request(s: &OfficeSnapshot, key: &str) -> Value {
        let (_, contract, employee) = borrowed(s);
        json!({"action":"enqueue_job","companyId":"beta","officeId":s.offices.iter().find(|o| o.company_id=="beta").unwrap().id,"employeeId":employee,"serviceContractId":contract,"goal":"Review only the recipient company's task context","mode":"manual","maxTokens":100,"maxUsd":1,"maxMinutes":5,"idempotencyKey":key})
    }
    fn contract_status(s: &mut OfficeSnapshot, status: &str) {
        let (service, contract, _) = borrowed(s);
        s.apply(&json!({"action":"contract_service","id":contract,"serviceId":service,"recipientCompanyId":"beta","status":status})).unwrap();
    }
    fn claim(s: &mut OfficeSnapshot) -> (String, String) {
        s.apply(&json!({"action":"claim_job","workerId":"fixture-worker"}))
            .unwrap();
        let r = s.last_action.as_ref().unwrap();
        (
            r["jobId"].as_str().unwrap().into(),
            r["leaseToken"].as_str().unwrap().into(),
        )
    }
    #[test]
    fn optimization_is_idempotent_and_reuses_worker_ids_without_merging_repositories() {
        let mut s = state();
        let original: HashSet<_> = s.employees.iter().map(|e| e.id.clone()).collect();
        let repos: Vec<_> = s.companies.iter().map(|c| c.repo_url.clone()).collect();
        optimize(&mut s, false);
        s.validate().unwrap();
        assert_eq!(s.portfolio.services.len(), 6);
        assert_eq!(s.portfolio.contracts.len(), 12);
        assert_eq!(s.companies.len(), 3);
        assert!(s.portfolio.services.iter().any(|s| s.key == "music-arts"));
        assert!(s.portfolio.services.iter().any(|s| s.key == "hackathon"));
        assert!(
            s.portfolio
                .services
                .iter()
                .filter(|s| original.contains(&s.employee_ids[0]))
                .count()
                >= 4
        );
        let employee_ids: Vec<_> = s.employees.iter().map(|e| e.id.clone()).collect();
        let service_ids: Vec<_> = s.portfolio.services.iter().map(|s| s.id.clone()).collect();
        optimize(&mut s, false);
        s.migrate_governance().unwrap();
        assert_eq!(
            s.employees.iter().map(|e| e.id.clone()).collect::<Vec<_>>(),
            employee_ids
        );
        assert_eq!(
            s.portfolio
                .services
                .iter()
                .map(|s| s.id.clone())
                .collect::<Vec<_>>(),
            service_ids
        );
        assert_eq!(
            s.companies
                .iter()
                .take(2)
                .map(|c| c.repo_url.clone())
                .collect::<Vec<_>>(),
            repos
        );
        assert!(s.jobs.is_empty());
        assert!(s.knowledge.is_empty());
        assert_eq!(s.last_action.as_ref().unwrap()["modelRequests"], 0);
        s.apply(&json!({"action":"configure_ceo","enabled":true,"focusGroupId":"products"}))
            .unwrap();
        assert_eq!(s.policy.approval_mode, "review");
        assert_eq!(s.policy.budget.hard_cap_usd, 10.0);
        s.validate().unwrap();
    }
    #[test]
    fn shared_dispatch_requires_live_contract_and_revocation_preserves_settlement() {
        let mut s = state();
        optimize(&mut s, false);
        let (_, contract, employee) = borrowed(&s);
        let mut without = request(&s, "no-contract");
        without.as_object_mut().unwrap().remove("serviceContractId");
        assert_eq!(
            s.apply(&without).unwrap_err().code,
            "SERVICE_CONTRACT_REQUIRED"
        );
        let queued = request(&s, "contracted");
        s.apply(&queued).unwrap();
        assert_eq!(s.jobs[0].employee_id, employee);
        contract_status(&mut s, "paused");
        s.apply(&json!({"action":"claim_job","workerId":"fixture"}))
            .unwrap();
        assert!(s.last_action.as_ref().unwrap()["jobId"].is_null());
        assert_eq!(s.jobs[0].status, "queued");
        contract_status(&mut s, "active");
        let (job, lease) = claim(&mut s);
        contract_status(&mut s, "revoked");
        assert_eq!(s.apply(&json!({"action":"reserve_job","jobId":job,"leaseToken":lease,"inputTokens":10,"maxOutputTokens":20,"costUsd":0.2})).unwrap_err().code, "DISPATCH_PERMISSION_REVOKED");
        contract_status(&mut s, "active");
        s.apply(&json!({"action":"reserve_job","jobId":job,"leaseToken":lease,"inputTokens":10,"maxOutputTokens":20,"costUsd":0.2})).unwrap();
        contract_status(&mut s, "revoked");
        s.apply(&json!({"action":"finish_job","jobId":job,"leaseToken":lease,"status":"completed","inputTokens":10,"outputTokens":5,"costUsd":0.05,"costStatus":"observed","summary":"Recipient deliverable saved","artifactUri":"/tmp/recipient-result.md"})).unwrap();
        assert_eq!(s.jobs[0].status, "completed");
        assert_eq!(s.jobs[0].usage.cost_usd, 0.05);
        assert!(s.jobs[0].artifact_uri.is_some());
        optimize(&mut s, false);
        assert_eq!(
            s.portfolio
                .contracts
                .iter()
                .find(|c| c.id == contract)
                .unwrap()
                .status,
            "revoked"
        );
        s.validate().unwrap();
    }
    #[test]
    fn shared_hierarchy_and_tool_scope_are_checked_at_dispatch() {
        let mut s = state();
        optimize(&mut s, false);
        let mut payload = request(&s, "tool");
        payload["allowedTools"] = json!(["github.publish_changes"]);
        assert_eq!(s.apply(&payload).unwrap_err().code, "TOOL_NOT_CONTRACTED");
        s.apply(&request(&s, "safe")).unwrap();
        let service = s
            .portfolio
            .services
            .iter()
            .find(|x| x.key == "engineering")
            .unwrap()
            .clone();
        s.apply(&json!({"action":"pause_department","departmentId":service.department_id}))
            .unwrap();
        s.apply(&json!({"action":"claim_job","workerId":"fixture"}))
            .unwrap();
        assert!(s.last_action.as_ref().unwrap()["jobId"].is_null());
        s.apply(&json!({"action":"resume_department","departmentId":service.department_id}))
            .unwrap();
        let home = s
            .staff(&service.employee_ids[0])
            .unwrap()
            .office_id
            .clone()
            .unwrap();
        s.apply(&json!({"action":"pause_office","officeId":home}))
            .unwrap();
        s.apply(&json!({"action":"claim_job","workerId":"fixture"}))
            .unwrap();
        assert!(s.last_action.as_ref().unwrap()["jobId"].is_null());
        s.apply(&json!({"action":"resume_office","officeId":home}))
            .unwrap();
        s.apply(&json!({"action":"upsert_portfolio_group","id":"products","name":"Products","companyIds":["alpha","beta"],"status":"paused"})).unwrap();
        s.apply(&json!({"action":"claim_job","workerId":"fixture"}))
            .unwrap();
        assert!(s.last_action.as_ref().unwrap()["jobId"].is_null());
        s.validate().unwrap();
    }
    fn knowledge(s: &mut OfficeSnapshot) -> String {
        s.apply(&json!({"action":"add_knowledge","companyId":"alpha","title":"Synthetic private result","summary":"A deliberately selected fixture result","artifactUri":"/tmp/fixture-evidence.md"})).unwrap();
        let knowledge = s.last_action.as_ref().unwrap()["knowledgeId"]
            .as_str()
            .unwrap()
            .to_string();
        s.apply(&json!({"action":"share_knowledge","knowledgeId":knowledge,"recipientCompanyId":"beta","purpose":"Reuse the named evidence only","status":"requested"})).unwrap();
        s.last_action.as_ref().unwrap()["transferId"]
            .as_str()
            .unwrap()
            .into()
    }
    fn grant(s: &mut OfficeSnapshot, transfer: &str, status: &str) {
        let knowledge = s
            .portfolio
            .transfers
            .iter()
            .find(|t| t.id == transfer)
            .unwrap()
            .knowledge_id
            .clone();
        s.apply(&json!({"action":"share_knowledge","id":transfer,"knowledgeId":knowledge,"recipientCompanyId":"beta","purpose":"Use this one evidence reference","status":status,"reviewed":true})).unwrap();
    }
    #[test]
    fn knowledge_is_reference_only_and_must_be_selected_and_granted() {
        let mut s = state();
        optimize(&mut s, false);
        let transfer = knowledge(&mut s);
        let mut payload = request(&s, "knowledge");
        payload["knowledgeTransferIds"] = json!([transfer]);
        assert_eq!(s.apply(&payload).unwrap_err().code, "KNOWLEDGE_NOT_GRANTED");
        let knowledge = s.portfolio.transfers[0].knowledge_id.clone();
        assert_eq!(s.apply(&json!({"action":"share_knowledge","knowledgeId":knowledge,"recipientCompanyId":"beta","purpose":"Request","status":"granted"})).unwrap_err().code, "REVIEW_REQUIRED");
        grant(&mut s, &transfer, "granted");
        assert_eq!(s.knowledge.len(), 1);
        assert!(serde_json::to_value(&s.portfolio.transfers[0])
            .unwrap()
            .get("summary")
            .is_none());
        s.apply(&payload).unwrap();
        let (job, lease) = claim(&mut s);
        grant(&mut s, &transfer, "revoked");
        assert_eq!(s.apply(&json!({"action":"reserve_job","jobId":job,"leaseToken":lease,"inputTokens":10,"maxOutputTokens":20,"costUsd":0.1})).unwrap_err().code, "DISPATCH_PERMISSION_REVOKED");
        s.validate().unwrap();
    }
    #[test]
    fn paused_schedules_and_goal_steps_preserve_explicit_contract_and_transfer_ids() {
        let mut s = state();
        optimize(&mut s, false);
        let transfer = knowledge(&mut s);
        grant(&mut s, &transfer, "granted");
        let (_, contract, employee) = borrowed(&s);
        let mut template = request(&s, "template");
        template["knowledgeTransferIds"] = json!([transfer]);
        s.apply(&json!({"action":"create_schedule","companyId":"beta","name":"Paused review","enabled":false,"everyMinutes":0,"nextRunAt":"2020-01-01T00:00:00Z","jobTemplate":template})).unwrap();
        s.apply(&json!({"action":"tick_schedules"})).unwrap();
        assert!(s.jobs.is_empty());
        s.apply(&json!({"action":"resume_schedule","scheduleId":s.schedules[0].id}))
            .unwrap();
        s.apply(&json!({"action":"tick_schedules"})).unwrap();
        assert_eq!(
            s.jobs[0].service_contract_id.as_deref(),
            Some(contract.as_str())
        );
        assert_eq!(s.jobs[0].knowledge_transfer_ids, vec![transfer.clone()]);
        s.apply(&json!({"action":"create_goal","scope":{"kind":"company","id":"beta"},"title":"Shared goal","mode":"execute"})).unwrap();
        let goal = s.last_action.as_ref().unwrap()["goalId"]
            .as_str()
            .unwrap()
            .to_string();
        s.apply(&json!({"action":"set_goal_plan","goalId":goal,"steps":[{"id":"review","title":"Review","employeeId":employee,"reviewerEmployeeId":s.offices.iter().find(|o| o.company_id == "beta").unwrap().assistant_id,"serviceContractId":contract,"knowledgeTransferIds":[transfer],"goal":"Use only selected references","dependsOn":[]}]})).unwrap();
        s.apply(&json!({"action":"execute_goal","goalId":goal}))
            .unwrap();
        let job = s
            .jobs
            .iter()
            .find(|j| j.goal_id.as_deref() == Some(goal.as_str()))
            .unwrap();
        assert_eq!(job.service_contract_id.as_deref(), Some(contract.as_str()));
        assert_eq!(job.knowledge_transfer_ids.len(), 1);
        s.validate().unwrap();
    }
    #[test]
    fn optimizer_keeps_owned_progress_and_only_pauses_idle_duplicate_assignments() {
        let mut s = state();
        let beta_code = s
            .employees
            .iter()
            .find(|e| {
                e.company_id.as_deref() == Some("beta")
                    && e.assignment_key.as_deref() == Some("code-engineer")
            })
            .unwrap()
            .id
            .clone();
        let beta_qa = s
            .employees
            .iter()
            .find(|e| {
                e.company_id.as_deref() == Some("beta")
                    && e.assignment_key.as_deref() == Some("qa-lead")
            })
            .unwrap()
            .id
            .clone();
        let office = s
            .offices
            .iter()
            .find(|o| o.company_id == "beta")
            .unwrap()
            .id
            .clone();
        s.apply(&json!({"action":"enqueue_job","companyId":"beta","officeId":office,"employeeId":beta_code,"reviewerEmployeeId":s.offices.iter().find(|o| o.id == office).unwrap().assistant_id,"goal":"Existing owned work","mode":"manual","maxTokens":100,"maxUsd":0,"maxMinutes":1,"idempotencyKey":"existing"})).unwrap();
        let job = s.jobs[0].id.clone();
        optimize(&mut s, true);
        assert_eq!(s.staff(&beta_code).unwrap().status, "active");
        assert_eq!(s.staff(&beta_qa).unwrap().status, "paused");
        assert_eq!(s.jobs[0].id, job);
        assert_eq!(s.jobs[0].status, "queued");
        assert!(s
            .portfolio
            .recommendations
            .iter()
            .any(|r| r.employee_id == beta_code && r.reason.starts_with("Retained")));
        s.apply(&json!({"action":"create_goal","scope":{"kind":"company","id":"beta"},"title":"Future shared work","mode":"plan"})).unwrap();
        let goal = s.last_action.as_ref().unwrap()["goalId"]
            .as_str()
            .unwrap()
            .to_string();
        s.apply(&json!({"action":"plan_goal","goalId":goal}))
            .unwrap();
        assert!(s
            .goals
            .last()
            .unwrap()
            .steps
            .iter()
            .any(|step| step.service_contract_id.is_some()));
        s.validate().unwrap();
    }
    #[test]
    fn optimizer_retains_queued_and_planned_reviewers_but_pauses_unassigned_duplicates() {
        for assignment in ["queued-review", "planned-step", "roadmap"] {
            let mut s = state();
            let reviewer = s.employees.iter().find(|e| e.company_id.as_deref() == Some("beta") && e.assignment_key.as_deref() == Some("qa-lead")).unwrap().id.clone();
            let idle = s.employees.iter().find(|e| e.company_id.as_deref() == Some("beta") && e.assignment_key.as_deref() == Some("knowledge-curator")).unwrap().id.clone();
            let office = s.offices.iter().find(|o| o.company_id == "beta").unwrap().id.clone();
            match assignment {
                "queued-review" => { s.apply(&json!({"action":"enqueue_job","companyId":"beta","officeId":office,"employeeId":"donna","reviewerEmployeeId":reviewer,"goal":"Owned paired work","mode":"manual","maxTokens":100,"maxUsd":0,"maxMinutes":1,"idempotencyKey":"review-owned"})).unwrap(); },
                "planned-step" => {
                    s.apply(&json!({"action":"create_goal","scope":{"kind":"office","id":office},"title":"Review assignment before dispatch","mode":"plan"})).unwrap();
                    let goal = s.last_action.as_ref().unwrap()["goalId"].as_str().unwrap().to_owned();
                    s.apply(&json!({"action":"set_goal_plan","goalId":goal,"steps":[{"id":"work","title":"Planned owned work","employeeId":"donna","reviewerEmployeeId":reviewer,"goal":"Produce reviewed evidence","dependsOn":[]}]})).unwrap();
                },
                "roadmap" => { s.apply(&json!({"action":"upsert_roadmap_item","id":"review-owned-outcome","scope":{"kind":"company","id":"beta"},"title":"Owned review outcome","ownerEmployeeId":"donna","reviewerEmployeeId":reviewer,"status":"planned"})).unwrap(); },
                _ => unreachable!(),
            }
            optimize(&mut s, true);
            assert_eq!(s.staff(&reviewer).unwrap().status, "active", "Reviewer assignment {assignment} must remain available");
            assert_eq!(s.staff(&idle).unwrap().status, "paused", "Unassigned duplicate must still be paused for {assignment}");
            assert!(s.portfolio.recommendations.iter().any(|r| r.employee_id == reviewer && r.reason.starts_with("Retained")));
            s.validate().unwrap();
        }
    }
    #[test]
    fn owned_roadmaps_validate_dependencies_evidence_and_contracted_whiteboards() {
        let mut s = state();
        optimize(&mut s, false);
        let (_, contract, employee) = borrowed(&s);
        let reviewer = s.offices.iter().find(|o| o.company_id == "beta").unwrap().assistant_id.clone();
        let req = request(&s, "completed-roadmap-work");
        s.apply(&req).unwrap();
        let primary = s.last_action.as_ref().unwrap()["jobId"].as_str().unwrap().to_owned();
        for _ in 0..2 {
            s.apply(&json!({"action":"claim_job","workerId":"fixture"})).unwrap();
            let job = s.last_action.as_ref().unwrap()["jobId"].as_str().unwrap().to_owned();
            let lease = s.last_action.as_ref().unwrap()["leaseToken"].as_str().unwrap().to_owned();
            s.apply(&json!({"action":"finish_job","jobId":job,"leaseToken":lease,"status":"completed","inputTokens":0,"outputTokens":0,"costUsd":0,"artifactUri":"/fixture/roadmap.md","artifactSha256":"a".repeat(64)})).unwrap();
            if s.jobs.iter().find(|j| j.id == job).unwrap().pair.as_ref().unwrap().phase == "review" {
                s.apply(&json!({"action":"record_step_review","jobId":job,"leaseToken":lease,"primaryJobId":primary,"primaryArtifactSha256":"a".repeat(64),"reviewArtifactSha256":"a".repeat(64),"primaryArtifactComplete":true,"verdict":"accepted","summary":"Complete fixture review","evidenceRefs":["fixture:roadmap"]})).unwrap();
            }
        }
        s.apply(&json!({"action":"upsert_roadmap_item","id":"global","scope":{"kind":"global","id":"portfolio"},"title":"Portfolio gate","ownerEmployeeId":"donna","reviewerEmployeeId":reviewer,"jobIds":[primary],"status":"done","evidence":"Fixture gate passed"})).unwrap();
        let item = json!({"action":"upsert_roadmap_item","id":"company-work","scope":{"kind":"company","id":"beta"},"title":"Company delivery","ownerEmployeeId":employee,"reviewerEmployeeId":reviewer,"jobIds":[primary],"serviceContractId":contract,"status":"done","dependencies":["global"],"evidence":"Fixture artifact retained"});
        s.apply(&item).unwrap();
        let mut cycle = json!({"action":"upsert_roadmap_item","expectedRevision":0,"id":"global","scope":{"kind":"global","id":"portfolio"},"title":"Portfolio gate","ownerEmployeeId":"donna","reviewerEmployeeId":reviewer,"jobIds":[primary],"status":"done","evidence":"Fixture gate passed","dependencies":["company-work"]});
        assert_eq!(s.apply(&cycle).unwrap_err().code, "INVALID_DEPENDENCY");
        cycle["dependencies"] = json!([]);
        cycle.as_object_mut().unwrap().remove("evidence");
        assert_eq!(s.apply(&cycle).unwrap_err().code, "EVIDENCE_REQUIRED");
        let blueprint = s
            .blueprints
            .iter()
            .find(|b| b.company_id == "beta")
            .unwrap()
            .clone();
        let board = json!({"action":"upsert_whiteboard","officeId":blueprint.office_id,"roomId":blueprint.rooms[0].id,"ownerEmployeeId":employee,"title":"Owned delivery","roadmapItemIds":["global","company-work"],"x":0.2,"y":0.2});
        s.apply(&board).unwrap();
        contract_status(&mut s, "revoked");
        s.validate().unwrap();
        assert!(s.apply(&board).is_err());
        assert_eq!(
            s.portfolio
                .roadmap
                .iter()
                .find(|r| r.id == "company-work")
                .unwrap()
                .status,
            "done"
        );
    }
    #[test]
    fn old_state_migrates_portfolio_defaults_without_losing_progress() {
        let s = state();
        let ids: Vec<_> = s.employees.iter().map(|e| e.id.clone()).collect();
        let mut old = serde_json::to_value(s).unwrap();
        old.as_object_mut().unwrap().remove("portfolio");
        let mut restored: OfficeSnapshot = serde_json::from_value(old).unwrap();
        assert!(restored.migrate_portfolio());
        assert!(!restored.migrate_portfolio());
        assert!(!restored.portfolio.ceo.enabled);
        assert!(restored.portfolio.contracts.is_empty());
        assert_eq!(
            restored
                .employees
                .iter()
                .map(|e| e.id.clone())
                .collect::<Vec<_>>(),
            ids
        );
        restored.validate().unwrap();
    }
}
