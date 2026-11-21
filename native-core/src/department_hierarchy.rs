//! Organizational department forest within an office. Parent links never grant
//! authority, relocate staff, change work scope, or cascade lifecycle changes.
use super::{fail, safe_id, Department, OfficeSnapshot, Result};
use serde_json::{json, Value};
use std::collections::HashMap;

const MAX_DEPARTMENTS: usize = 16_000;

/// Linear, iterative validation: each edge is resolved once and each node is
/// colored once. `change` validates a prospective relation without cloning or
/// mutating the stored snapshot, including at the maximum supported depth.
fn validate_relations(
    departments: &[Department],
    change: Option<(&str, Option<&str>)>,
) -> Result<()> {
    if departments.len() > MAX_DEPARTMENTS {
        return Err(fail("OFFICE_STATE_INVALID", "Department hierarchy exceeds bounds"));
    }
    let mut index = HashMap::with_capacity(departments.len());
    for (i, department) in departments.iter().enumerate() {
        if !safe_id(&department.id) || index.insert(department.id.as_str(), i).is_some() {
            return Err(fail("OFFICE_STATE_INVALID", "Department hierarchy has invalid or duplicate identities"));
        }
    }
    let mut parents = Vec::with_capacity(departments.len());
    for department in departments {
        let parent_id = match change {
            Some((id, parent)) if id == department.id => parent,
            _ => department.parent_department_id.as_deref(),
        };
        let parent = if let Some(id) = parent_id {
            if !safe_id(id) {
                return Err(fail("OFFICE_STATE_INVALID", "Department parent identifier is invalid"));
            }
            let parent_index = *index.get(id).ok_or_else(|| fail("OFFICE_STATE_INVALID", "Department parent is missing"))?;
            let parent = &departments[parent_index];
            if parent.id == department.id {
                return Err(fail("OFFICE_STATE_INVALID", "Department cannot be its own parent"));
            }
            if parent.company_id != department.company_id || parent.office_id != department.office_id {
                return Err(fail("OFFICE_STATE_INVALID", "Department parent must belong to the same company and office"));
            }
            Some(parent_index)
        } else {
            None
        };
        parents.push(parent);
    }
    // 0: unseen, 1: on this traversal's path, 2: already known to reach a root.
    let mut colors = vec![0u8; departments.len()];
    let mut path = Vec::new();
    for start in 0..departments.len() {
        if colors[start] != 0 { continue; }
        path.clear();
        let mut cursor = Some(start);
        while let Some(current) = cursor {
            match colors[current] {
                1 => return Err(fail("OFFICE_STATE_INVALID", "Department hierarchy contains a cycle")),
                2 => break,
                _ => { colors[current] = 1; path.push(current); cursor = parents[current]; }
            }
        }
        for &current in &path { colors[current] = 2; }
    }
    Ok(())
}

pub fn validate_department_forest(state: &OfficeSnapshot) -> Result<()> {
    validate_relations(&state.departments, None)
}

impl OfficeSnapshot {
    pub(super) fn set_department_parent(&mut self, command: &Value) -> Result<()> {
        let department_id = command.get("departmentId").and_then(Value::as_str)
            .filter(|id| safe_id(id)).ok_or_else(|| fail("INVALID_INPUT", "Missing or invalid departmentId"))?;
        let new_parent = match command.get("parentDepartmentId") {
            Some(Value::Null) => None,
            Some(Value::String(parent)) if safe_id(parent) => Some(parent.clone()),
            _ => return Err(fail("INVALID_INPUT", "Missing or invalid parentDepartmentId")),
        };
        let child_index = self.departments.iter().position(|d| d.id == department_id)
            .ok_or_else(|| fail("NOT_FOUND", "Department not found"))?;
        let child = &self.departments[child_index];
        let old_parent = child.parent_department_id.clone();
        if let Some(parent_id) = &new_parent {
            let parent = self.departments.iter().find(|d| &d.id == parent_id)
                .ok_or_else(|| fail("NOT_FOUND", "Parent department not found"))?;
            if parent.id == child.id {
                return Err(fail("INVALID_INPUT", "Department cannot be its own parent"));
            }
            if parent.company_id != child.company_id || parent.office_id != child.office_id {
                return Err(fail("SCOPE_MISMATCH", "Parent department must belong to the same company and office"));
            }
        }
        validate_relations(&self.departments, Some((department_id, new_parent.as_deref())))?;
        if old_parent == new_parent {
            self.last_action = Some(json!({"departmentId":department_id,"parentDepartmentId":new_parent,"changed":false}));
            return Ok(());
        }
        self.departments[child_index].parent_department_id = new_parent.clone();
        self.log("owner", "set_department_parent", department_id,
            format!("Department parent changed from {} to {}", old_parent.as_deref().unwrap_or("none"), new_parent.as_deref().unwrap_or("none")));
        self.last_action = Some(json!({"departmentId":department_id,"oldParentDepartmentId":old_parent,"parentDepartmentId":new_parent,"changed":true}));
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use super::super::Company;

    fn state() -> OfficeSnapshot {
        let company: Company = serde_json::from_value(json!({"id":"atlas","name":"Atlas","repoUrl":"https://github.com/occult-kranti/engineering-intelligence-atlas","owner":"occult-kranti","repo":"engineering-intelligence-atlas","githubStatus":"unchecked"})).unwrap();
        OfficeSnapshot::seeded(&company, &[]).unwrap()
    }
    fn three() -> (OfficeSnapshot, Vec<String>) {
        let mut s = state(); let office = s.offices[0].id.clone();
        s.apply(&json!({"action":"create_department","officeId":office,"name":"Third"})).unwrap();
        let ids = s.departments.iter().filter(|d| d.office_id == office).take(3).map(|d| d.id.clone()).collect();
        (s, ids)
    }
    fn set(s: &mut OfficeSnapshot, child: &str, parent: Value) -> Result<()> {
        s.apply(&json!({"action":"set_department_parent","departmentId":child,"parentDepartmentId":parent}))
    }
    fn parent(s: &OfficeSnapshot, child: &str) -> Option<String> {
        s.departments.iter().find(|d| d.id == child).unwrap().parent_department_id.clone()
    }

    #[test]
    fn old_json_and_roundtrip_keep_organizational_parent_optional() {
        let (mut s, ids) = three(); let mut old = serde_json::to_value(&s).unwrap();
        for d in old["departments"].as_array_mut().unwrap() { d.as_object_mut().unwrap().remove("parentDepartmentId"); }
        let restored: OfficeSnapshot = serde_json::from_value(old).unwrap(); restored.validate().unwrap();
        assert!(restored.departments.iter().all(|d| d.parent_department_id.is_none()));
        set(&mut s, &ids[1], json!(ids[0])).unwrap();
        let restored: OfficeSnapshot = serde_json::from_value(serde_json::to_value(&s).unwrap()).unwrap();
        restored.validate().unwrap(); assert_eq!(parent(&restored, &ids[1]), Some(ids[0].clone()));
    }

    #[test]
    fn attach_reparent_detach_are_explicit_and_do_not_copy_staff_or_permissions() {
        let (mut s, ids) = three();
        let staff = serde_json::to_value(&s.employees).unwrap(); let grants = serde_json::to_value(&s.authority.grants).unwrap();
        set(&mut s, &ids[1], json!(ids[0])).unwrap();
        set(&mut s, &ids[1], json!(ids[2])).unwrap();
        assert_eq!(s.last_action.as_ref().unwrap()["oldParentDepartmentId"], json!(ids[0]));
        let events = s.events.len(); set(&mut s, &ids[1], json!(ids[2])).unwrap();
        assert_eq!(s.last_action.as_ref().unwrap()["changed"], false); assert_eq!(s.events.len(), events);
        set(&mut s, &ids[1], Value::Null).unwrap(); assert_eq!(parent(&s, &ids[1]), None);
        assert_eq!(serde_json::to_value(&s.employees).unwrap(), staff);
        assert_eq!(serde_json::to_value(&s.authority.grants).unwrap(), grants);
        s.validate().unwrap();
    }

    #[test]
    fn invalid_inputs_self_cycle_and_missing_parent_do_not_mutate_relations() {
        let (mut s, ids) = three();
        set(&mut s, &ids[1], json!(ids[0])).unwrap(); set(&mut s, &ids[2], json!(ids[1])).unwrap();
        let before = serde_json::to_value(&s).unwrap();
        for command in [
            json!({"departmentId":ids[0]}),
            json!({"departmentId":ids[0],"parentDepartmentId":42}),
            json!({"departmentId":ids[0],"parentDepartmentId":""}),
            json!({"departmentId":ids[0],"parentDepartmentId":"missing"}),
            json!({"departmentId":ids[0],"parentDepartmentId":ids[0]}),
            json!({"departmentId":ids[0],"parentDepartmentId":ids[2]}),
            json!({"departmentId":"../invalid","parentDepartmentId":null}),
        ] {
            assert!(s.set_department_parent(&command).is_err());
            assert_eq!(serde_json::to_value(&s).unwrap(), before);
        }
    }

    #[test]
    fn cross_office_and_cross_company_parents_are_rejected() {
        let (mut s, ids) = three();
        s.apply(&json!({"action":"create_office","companyId":"atlas","name":"Other office"})).unwrap();
        let office = s.last_action.as_ref().unwrap()["officeId"].as_str().unwrap().to_owned();
        s.apply(&json!({"action":"create_department","officeId":office,"name":"Other team"})).unwrap();
        let other = s.last_action.as_ref().unwrap()["departmentId"].as_str().unwrap().to_owned();
        assert_eq!(set(&mut s, &ids[0], json!(other)).unwrap_err().code, "SCOPE_MISMATCH");
        s.apply(&json!({"action":"create_company","id":"foreign","name":"Foreign"})).unwrap();
        let foreign = s.departments.iter().find(|d| d.company_id == "foreign").unwrap().id.clone();
        assert_eq!(set(&mut s, &ids[0], json!(foreign)).unwrap_err().code, "SCOPE_MISMATCH");
        assert_eq!(parent(&s, &ids[0]), None);
    }

    #[test]
    fn restored_dangling_self_and_cycle_fail_validation() {
        let (mut s, ids) = three();
        let index = s.departments.iter().position(|d| d.id == ids[0]).unwrap();
        for bad in ["missing", "bad/id", ids[0].as_str()] {
            s.departments[index].parent_department_id = Some(bad.into()); assert!(s.validate().is_err());
        }
        s.departments[index].parent_department_id = Some(ids[1].clone());
        s.departments.iter_mut().find(|d| d.id == ids[1]).unwrap().parent_department_id = Some(ids[0].clone());
        assert!(s.validate().is_err());
    }

    #[test]
    fn sixteen_thousand_deep_links_validate_without_recursion_and_cycles_are_bounded() {
        let mut s = state(); let template = s.departments[0].clone();
        s.departments = (0..MAX_DEPARTMENTS).map(|i| { let mut d = template.clone(); d.id = format!("d-{i}"); d.parent_department_id = if i == 0 { None } else { Some(format!("d-{}", i - 1)) }; d }).collect();
        validate_department_forest(&s).unwrap();
        s.departments[0].parent_department_id = Some(format!("d-{}", MAX_DEPARTMENTS - 1));
        assert!(validate_department_forest(&s).is_err());
        s.departments[0].parent_department_id = None;
        let mut extra = template; extra.id = "too-many".into(); s.departments.push(extra);
        assert!(validate_department_forest(&s).is_err());
    }

    #[test]
    fn remote_replay_has_one_effect_and_a_stale_hash_cannot_reparent() {
        let (mut s, ids) = three();
        let envelope = json!({"action":"apply_remote_command","id":"department-parent-once","expectedStateHash":s.sync_state_hash().unwrap(),"command":{"action":"set_department_parent","departmentId":ids[1],"parentDepartmentId":ids[0]}});
        s.apply(&envelope).unwrap(); let events = s.events.len();
        s.apply(&envelope).unwrap(); assert_eq!(s.events.len(), events); assert_eq!(s.remote_receipts.len(), 1);
        assert_eq!(parent(&s, &ids[1]), Some(ids[0].clone()));
        let stale = json!({"action":"apply_remote_command","id":"department-parent-stale","expectedStateHash":"0".repeat(64),"command":{"action":"set_department_parent","departmentId":ids[1],"parentDepartmentId":ids[2]}});
        assert!(s.apply(&stale).is_err()); assert_eq!(parent(&s, &ids[1]), Some(ids[0].clone()));
    }
}
