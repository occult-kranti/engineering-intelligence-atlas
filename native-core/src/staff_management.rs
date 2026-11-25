//! Editing saved staff definitions never changes their identity, lifecycle,
//! scope or grants. Permanent assistants retain the ownership of their scopes.
use super::*;

impl OfficeSnapshot {
    pub(super) fn validate_staff_ownership(&self, employees: &HashMap<&str, &Staff>) -> Result<()> {
        let donna = employees.get("donna")
            .ok_or_else(|| fail("OFFICE_STATE_INVALID", "Donna is missing"))?;
        if donna.kind != "assistant" || donna.company_id.is_some()
            || donna.office_id.is_some() || donna.department_id.is_some()
            || !["active", "paused"].contains(&donna.status.as_str())
        {
            return Err(fail("OFFICE_STATE_INVALID", "Donna must remain the permanent global assistant"));
        }
        let owns = |id: &str, company: &str, office: Option<&str>, department: Option<&str>| {
            employees.get(id).is_some_and(|staff| {
                staff.kind == "assistant" && staff.status != "fired"
                    && staff.company_id.as_deref() == Some(company)
                    && staff.office_id.as_deref() == office
                    && staff.department_id.as_deref() == department
            })
        };
        for company in &self.companies {
            if !owns(&company.assistant_id, &company.id, None, None) {
                return Err(fail("OFFICE_STATE_INVALID", "Company assistant ownership is inconsistent"));
            }
        }
        for office in &self.offices {
            if !owns(&office.assistant_id, &office.company_id, Some(&office.id), None) {
                return Err(fail("OFFICE_STATE_INVALID", "Office assistant ownership is inconsistent"));
            }
        }
        for department in &self.departments {
            if !owns(&department.assistant_id, &department.company_id,
                Some(&department.office_id), Some(&department.id))
            {
                return Err(fail("OFFICE_STATE_INVALID", "Department assistant ownership is inconsistent"));
            }
        }
        Ok(())
    }

    pub(super) fn update_employee(&mut self, p: &Value) -> Result<()> {
        let fields = p.as_object().ok_or_else(|| fail("INVALID_INPUT", "Missing employee update"))?;
        if fields.keys().any(|key| !["action", "employeeId", "name", "role", "skillPaths"].contains(&key.as_str())) {
            return Err(fail("INVALID_INPUT", "Employee edits only accept name, role and skillPaths; identity, scope, lifecycle and grants use their own commands"));
        }
        if !["name", "role", "skillPaths"].iter().any(|key| fields.contains_key(*key)) {
            return Err(fail("INVALID_INPUT", "Provide at least one employee definition field"));
        }
        let employee_id = string(p, "employeeId", 100)?;
        let staff = self.staff(&employee_id)?;
        if staff.status == "fired" {
            return Err(fail("TERMINAL_STATE", "A fired employee definition is historical; hire a new definition"));
        }
        let name = if p.get("name").is_some() { string(p, "name", 150)? } else { staff.name.clone() };
        let role = if p.get("role").is_some() { string(p, "role", 200)? } else { staff.role.clone() };
        let skill_paths = if p.get("skillPaths").is_some() {
            if !p["skillPaths"].is_array() {
                return Err(fail("INVALID_INPUT", "skillPaths must be an array"));
            }
            let paths = strings(p, "skillPaths", 20)?;
            if paths.iter().any(|path| !safe_relative(path) || !path.starts_with("skills/") || !path.ends_with("/SKILL.md"))
                || paths.iter().collect::<HashSet<_>>().len() != paths.len()
            {
                return Err(fail("INVALID_INPUT", "Skills must be distinct repository-relative skills/.../SKILL.md references"));
            }
            paths
        } else { staff.skill_paths.clone() };
        // Validate the entire edit before taking the mutable reference.
        let changed = staff.name != name || staff.role != role || staff.skill_paths != skill_paths;
        if changed {
            let staff = self.employees.iter_mut().find(|e| e.id == employee_id).unwrap();
            staff.name = name;
            staff.role = role;
            staff.skill_paths = skill_paths;
            staff.updated_at = now();
            self.log("owner", "update_employee", &employee_id,
                "Updated employee definition; identity, ownership, lifecycle, work and grants were retained".into());
        }
        self.last_action = Some(json!({"employeeId":employee_id,"changed":changed}));
        Ok(())
    }

    pub(super) fn rename_staff_scope(&mut self, action: &str, p: &Value) -> Result<()> {
        let (key, label) = if action == "rename_department" { ("departmentId", "department") } else { ("officeId", "office") };
        let scope_id = string(p, key, 100)?;
        let name = string(p, "name", 150)?;
        let saved_name = if action == "rename_department" {
            &mut self.departments.iter_mut().find(|d| d.id == scope_id)
                .ok_or_else(|| fail("NOT_FOUND", "Department not found"))?.name
        } else {
            &mut self.offices.iter_mut().find(|o| o.id == scope_id)
                .ok_or_else(|| fail("NOT_FOUND", "Office not found"))?.name
        };
        let changed = *saved_name != name;
        if changed {
            *saved_name = name;
            self.log("owner", action, &scope_id,
                format!("Renamed {label}; saved ownership, hierarchy, work and permissions were retained"));
        }
        self.last_action = Some(json!({key:scope_id,"changed":changed}));
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn state() -> OfficeSnapshot {
        let company: Company = serde_json::from_value(json!({"id":"atlas","name":"Atlas","repoUrl":"https://github.com/occult-kranti/engineering-intelligence-atlas","owner":"occult-kranti","repo":"engineering-intelligence-atlas","githubStatus":"unchecked"})).unwrap();
        OfficeSnapshot::seeded(&company, &[]).unwrap()
    }
    fn hire(s: &mut OfficeSnapshot, department: Option<String>) -> String {
        s.apply(&json!({"action":"hire_employee","companyId":"atlas","officeId":s.offices[0].id,"departmentId":department,"name":"Backend engineer","role":"Implement and verify"})).unwrap();
        s.last_action.as_ref().unwrap()["employeeId"].as_str().unwrap().into()
    }
    fn grant(s: &mut OfficeSnapshot, employee: &str, scope: Value) -> String {
        s.apply(&json!({"action":"grant_authority","employeeId":employee,"scope":scope,"preset":"partial","capabilities":["team.manage"],"reason":"Scoped staff management test","expiresAt":at(OffsetDateTime::now_utc() + Duration::hours(1))})).unwrap();
        s.last_action.as_ref().unwrap()["grantId"].as_str().unwrap().into()
    }

    #[test]
    fn edit_preserves_ownership_grants_and_identity_and_accepts_paused_staff() {
        let mut s = state(); let d = s.departments[0].id.clone(); let e = hire(&mut s, Some(d));
        grant(&mut s, &e, json!({"kind":"company","id":"atlas"}));
        s.apply(&json!({"action":"pause_employee","employeeId":e})).unwrap();
        let before = s.staff(&e).unwrap().clone(); let grants = serde_json::to_value(&s.authority.grants).unwrap();
        s.apply(&json!({"action":"update_employee","employeeId":e,"name":"Backend reviewer","role":"Review queues and ownership","skillPaths":["skills/agent-research-director/SKILL.md"]})).unwrap();
        let after = s.staff(&e).unwrap();
        assert_eq!(after.name, "Backend reviewer"); assert_eq!(after.role, "Review queues and ownership");
        assert_eq!(after.status, "paused"); assert_eq!(after.kind, before.kind);
        assert_eq!(after.company_id, before.company_id); assert_eq!(after.office_id, before.office_id);
        assert_eq!(after.department_id, before.department_id); assert_eq!(after.assignment_key, before.assignment_key);
        assert_eq!(after.created_at, before.created_at); assert_eq!(serde_json::to_value(&s.authority.grants).unwrap(), grants);
        let after = serde_json::to_value(after).unwrap();
        s.apply(&json!({"action":"update_employee","employeeId":e,"role":"Review queues and ownership"})).unwrap();
        assert_eq!(s.last_action.as_ref().unwrap()["changed"], false);
        assert_eq!(serde_json::to_value(s.staff(&e).unwrap()).unwrap(), after);
        s.validate().unwrap();
    }

    #[test]
    fn definition_edits_fail_before_mutation_and_do_not_revive_fired_staff() {
        let mut s = state(); let e = hire(&mut s, None);
        for patch in [json!({}), json!({"name":null}), json!({"name":""}), json!({"role":42}),
            json!({"role":"x".repeat(201)}), json!({"skillPaths":null}),
            json!({"skillPaths":["skills/../private/SKILL.md"]}), json!({"skillPaths":["file:///private"]}),
            json!({"skillPaths":["skills/test/SKILL.md","skills/test/SKILL.md"]}),
            json!({"companyId":"another","role":"Changed"}), json!({"officeId":null,"name":"Changed"}),
            json!({"departmentId":null,"name":"Changed"}), json!({"status":"active","name":"Changed"}),
            json!({"kind":"assistant","name":"Changed"}), json!({"assignmentKey":"ceo-assistant","name":"Changed"})]
        {
            let before = serde_json::to_value(&s.employees).unwrap();
            let mut command = patch; command["action"] = json!("update_employee"); command["employeeId"] = json!(e);
            assert!(s.apply(&command).is_err(), "{command}");
            assert_eq!(serde_json::to_value(&s.employees).unwrap(), before);
        }
        s.apply(&json!({"action":"fire_employee","employeeId":e})).unwrap();
        assert_eq!(s.apply(&json!({"action":"update_employee","employeeId":e,"role":"Rehired"})).unwrap_err().code,"TERMINAL_STATE");
        assert_eq!(s.staff(&e).unwrap().status,"fired"); s.validate().unwrap();
    }

    #[test]
    fn permanent_assistant_definitions_are_editable_but_ownership_is_fixed() {
        let mut s = state(); let assistants: Vec<_> = s.employees.iter().filter(|e| e.kind == "assistant").map(|e| e.id.clone()).collect();
        for e in assistants {
            s.apply(&json!({"action":"update_employee","employeeId":e,"role":"Coordinate scoped operations"})).unwrap();
            s.apply(&json!({"action":"pause_employee","employeeId":e})).unwrap();
            assert_eq!(s.apply(&json!({"action":"fire_employee","employeeId":e})).unwrap_err().code,"PERMANENT_ASSISTANT");
            s.validate().unwrap();
        }
        let donna = s.staff("donna").unwrap();
        assert!(donna.company_id.is_none() && donna.office_id.is_none() && donna.department_id.is_none());
    }

    #[test]
    fn restored_state_rejects_invalid_donna_and_cross_scope_assistant_ownership() {
        let original = state();
        for alteration in ["fired","specialist","company","office","department"] {
            let mut s = original.clone();
            let company = s.companies[0].id.clone(); let office = s.offices[0].id.clone(); let dept = s.departments[0].id.clone();
            let donna = s.employees.iter_mut().find(|e| e.id == "donna").unwrap();
            match alteration {
                "fired" => donna.status = "fired".into(), "specialist" => donna.kind = "specialist".into(),
                "company" => donna.company_id = Some(company), "office" => donna.office_id = Some(office),
                _ => donna.department_id = Some(dept),
            }
            assert!(s.validate().is_err(),"{alteration}");
        }
        let mut s = original.clone(); s.companies[0].assistant_id = "donna".into(); assert!(s.validate().is_err());
        let mut s = original.clone(); s.offices[0].assistant_id = s.companies[0].assistant_id.clone(); assert!(s.validate().is_err());
        let mut s = original.clone(); s.departments[0].assistant_id = s.departments[1].assistant_id.clone(); assert!(s.validate().is_err());
        let mut s = original.clone(); let e = hire(&mut s, None); s.companies[0].assistant_id = e; assert!(s.validate().is_err());
        let mut s = original.clone(); s.apply(&json!({"action":"create_company","id":"other","name":"Other"})).unwrap();
        s.companies[0].assistant_id = s.companies[1].assistant_id.clone(); assert!(s.validate().is_err());
        original.validate().unwrap();
    }

    #[test]
    fn delegated_edit_and_rename_require_current_matching_team_authority() {
        let mut s = state(); let d = s.departments[0].id.clone(); let e = hire(&mut s, Some(d.clone()));
        let manager = hire(&mut s, None); let other = hire(&mut s, None);
        let authority = grant(&mut s, &manager, json!({"kind":"department","id":d}));
        let delegated = |command: Value| json!({"action":"apply_employee_command","employeeId":manager,"command":command});
        s.apply(&delegated(json!({"action":"update_employee","employeeId":e,"role":"Reviewed backend"}))).unwrap();
        s.apply(&delegated(json!({"action":"rename_department","departmentId":d,"name":"Backend and pipelines"}))).unwrap();
        for command in [json!({"action":"update_employee","employeeId":other,"role":"Outside"}),
            json!({"action":"update_employee","employeeId":"donna","role":"Outside"}),
            json!({"action":"rename_office","officeId":s.offices[0].id,"name":"Outside"})]
        { assert_eq!(s.apply(&delegated(command)).unwrap_err().code,"AUTHORITY_DENIED"); }
        s.apply(&json!({"action":"revoke_authority","grantId":authority,"reason":"End test delegation"})).unwrap();
        assert_eq!(s.apply(&delegated(json!({"action":"update_employee","employeeId":e,"name":"Denied"}))).unwrap_err().code,"AUTHORITY_DENIED");
        s.validate().unwrap();
    }

    #[test]
    fn renamed_scope_retains_children_assistants_grants_and_work_references() {
        let mut s = state(); let d = s.departments[0].id.clone(); let o = s.offices[0].id.clone();
        let staff = serde_json::to_value(&s.employees).unwrap();
        let old_d = s.departments[0].clone(); let old_o = s.offices[0].clone();
        s.apply(&json!({"action":"rename_department","departmentId":d,"name":"Backend"})).unwrap();
        s.apply(&json!({"action":"rename_office","officeId":o,"name":"Delivery office"})).unwrap();
        assert_eq!(s.departments[0].assistant_id,old_d.assistant_id);
        assert_eq!(s.departments[0].office_id,old_d.office_id);
        assert_eq!(s.offices[0].assistant_id,old_o.assistant_id);
        assert_eq!(s.offices[0].company_id,old_o.company_id);
        assert_eq!(serde_json::to_value(&s.employees).unwrap(),staff);
        assert!(s.authority.index.iter().any(|e|e.kind=="department" && e.entity_id==d && e.title=="Backend"));
        s.validate().unwrap();
    }

    #[test]
    fn remote_management_edits_replay_once_and_reject_conflicting_payloads() {
        let mut s = state(); let e = hire(&mut s,None);
        let commands = [json!({"action":"update_employee","employeeId":e,"role":"Backend owner"}),
            json!({"action":"rename_department","departmentId":s.departments[0].id,"name":"Backend"}),
            json!({"action":"rename_office","officeId":s.offices[0].id,"name":"Delivery"})];
        for (index, command) in commands.into_iter().enumerate() {
            let envelope = json!({"action":"apply_remote_command","id":format!("management-{index}"),"expectedStateHash":s.sync_state_hash().unwrap(),"command":command});
            s.apply(&envelope).unwrap(); let ledger = s.authority.ledger.len();
            let mut restored: OfficeSnapshot = serde_json::from_value(serde_json::to_value(&s).unwrap()).unwrap();
            restored.apply(&envelope).unwrap(); assert_eq!(restored.authority.ledger.len(),ledger);
            assert_eq!(restored.last_action.as_ref().unwrap()["replayed"],true);
            let mut mismatch = envelope.clone(); mismatch["command"]["name"] = json!("Conflicting edit");
            assert_eq!(restored.apply(&mismatch).unwrap_err().code,"REMOTE_RECEIPT_MISMATCH");
            s = restored;
        }
        assert_eq!(s.remote_receipts.len(),3); s.validate().unwrap();
    }

    #[test]
    fn firing_cancels_waiting_budget_and_paused_work_without_erasing_history() {
        let mut s = state(); let e = hire(&mut s,None);
        for (i,status) in ["queued","waiting-budget","paused","completed"].into_iter().enumerate() {
            s.apply(&json!({"action":"enqueue_job","companyId":"atlas","officeId":s.offices[0].id,"employeeId":e,"goal":"Lifecycle evidence","mode":"manual","maxTokens":100,"maxUsd":1,"maxMinutes":5,"idempotencyKey":format!("staff-lifecycle-{i}")})).unwrap();
            s.jobs.last_mut().unwrap().status = status.into();
        }
        s.apply(&json!({"action":"fire_employee","employeeId":e})).unwrap();
        assert_eq!(s.jobs.iter().map(|j|j.status.as_str()).collect::<Vec<_>>(),vec!["cancelled","cancelled","cancelled","completed"]);
        assert_eq!(s.employees.iter().filter(|x|x.id==e).count(),1); s.validate().unwrap();
    }

    #[test]
    fn thirty_thousand_staff_validate_and_index_without_duplicate_ownership() {
        let mut s = state(); let e = hire(&mut s,None); let template=s.staff(&e).unwrap().clone();
        while s.employees.len()<30_000 {
            let mut employee = template.clone(); employee.id=format!("stress-employee-{}",s.employees.len());
            s.employees.push(employee);
        }
        s.validate().unwrap(); s.refresh_authority_index().unwrap();
        assert_eq!(s.authority.index.iter().filter(|entry|entry.kind=="employee").count(),30_000);
        let mut extra=template.clone(); extra.id="over-capacity".into(); s.employees.push(extra);
        assert_eq!(s.validate().unwrap_err().code,"OFFICE_STATE_INVALID");
        s.employees.pop(); s.employees.last_mut().unwrap().id="donna".into();
        assert_eq!(s.validate().unwrap_err().code,"OFFICE_STATE_INVALID");
    }
}
