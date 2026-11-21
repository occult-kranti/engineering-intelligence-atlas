//! Company parent/child hierarchy. Pure data and validation: no implicit authority
//! inheritance, staffing changes or cascade pause.
use super::{fail, safe_id, OfficeSnapshot, Result};
use serde_json::{json, Value};
use std::collections::{HashMap, HashSet};

const MAX_COMPANIES: usize = 2000;

/// Validate that company parents form a forest: every parent exists, ids are safe,
/// and no self or indirect cycle exists. Traversal is bounded by the company limit.
pub fn validate_company_forest(state: &OfficeSnapshot) -> Result<()> {
    if state.companies.len() > MAX_COMPANIES {
        return Err(fail("OFFICE_STATE_INVALID", "Company hierarchy exceeds bounds"));
    }
    let parents: HashMap<&str, Option<&str>> = state
        .companies
        .iter()
        .map(|c| (c.id.as_str(), c.parent_company_id.as_deref()))
        .collect();
    for (id, parent) in &parents {
        if let Some(p) = parent {
            if !safe_id(p) || !parents.contains_key(p) {
                return Err(fail(
                    "OFFICE_STATE_INVALID",
                    "Company parent is missing or invalid",
                ));
            }
            if p == id {
                return Err(fail("OFFICE_STATE_INVALID", "Company cannot be its own parent"));
            }
        }
    }
    for start in parents.keys() {
        let mut seen: HashSet<&str> = HashSet::new();
        let mut cursor: Option<&str> = Some(start);
        let mut steps = 0usize;
        while let Some(current) = cursor {
            steps += 1;
            if steps > MAX_COMPANIES + 1 || !seen.insert(current) {
                return Err(fail(
                    "OFFICE_STATE_INVALID",
                    "Company hierarchy contains a cycle",
                ));
            }
            cursor = parents.get(current).copied().flatten();
        }
    }
    Ok(())
}

impl OfficeSnapshot {
    /// Owner command: set or clear a company's parent. Validates before mutating.
    pub(super) fn set_company_parent(&mut self, p: &Value) -> Result<()> {
        let company_id = p
            .get("companyId")
            .and_then(Value::as_str)
            .ok_or_else(|| fail("INVALID_INPUT", "Missing companyId"))?
            .to_string();
        let new_parent: Option<String> = match p.get("parentCompanyId") {
            None => return Err(fail("INVALID_INPUT", "Missing parentCompanyId")),
            Some(Value::Null) => None,
            Some(Value::String(v)) => Some(v.clone()),
            Some(_) => return Err(fail("INVALID_INPUT", "Invalid parentCompanyId")),
        };
        if !safe_id(&company_id) {
            return Err(fail("INVALID_INPUT", "Invalid companyId"));
        }
        let old_parent = self.company(&company_id)?.parent_company_id.clone();
        if let Some(parent) = &new_parent {
            if !safe_id(parent) {
                return Err(fail("INVALID_INPUT", "Invalid parentCompanyId"));
            }
            self.company(parent)?;
        }
        if old_parent == new_parent {
            self.last_action = Some(json!({
                "companyId": company_id,
                "parentCompanyId": new_parent,
                "changed": false
            }));
            return Ok(());
        }
        // Validate on a trial copy of the relation so state is untouched on failure.
        let mut trial = self.companies.clone();
        trial
            .iter_mut()
            .find(|c| c.id == company_id)
            .unwrap()
            .parent_company_id = new_parent.clone();
        {
            let mut probe = self.clone();
            probe.companies = trial;
            validate_company_forest(&probe)?;
        }
        self.companies
            .iter_mut()
            .find(|c| c.id == company_id)
            .unwrap()
            .parent_company_id = new_parent.clone();
        let summary = format!(
            "Company parent changed from {} to {}",
            old_parent.as_deref().unwrap_or("none"),
            new_parent.as_deref().unwrap_or("none")
        );
        self.log("owner", "set_company_parent", &company_id, summary);
        self.last_action = Some(json!({
            "companyId": company_id,
            "oldParentCompanyId": old_parent,
            "parentCompanyId": new_parent,
            "changed": true
        }));
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::super::*;
    use serde_json::json;

    fn office() -> OfficeSnapshot {
        let c: Company = serde_json::from_value(json!({"id":"engineering-intelligence-atlas","name":"Atlas","repoUrl":"https://github.com/occult-kranti/engineering-intelligence-atlas","owner":"occult-kranti","repo":"engineering-intelligence-atlas","githubStatus":"unchecked"})).unwrap();
        OfficeSnapshot::seeded(&c, &[]).unwrap()
    }
    fn with_companies(n: usize) -> (OfficeSnapshot, Vec<String>) {
        let mut s = office();
        let mut ids = vec![s.active_company_id.clone()];
        for i in 1..n {
            s.apply(&json!({"action":"create_company","name":format!("Co {i}")}))
                .unwrap();
            ids.push(s.last_action.as_ref().unwrap()["companyId"].as_str().unwrap().into());
        }
        (s, ids)
    }
    fn parent_of(s: &OfficeSnapshot, id: &str) -> Option<String> {
        s.companies.iter().find(|c| c.id == id).unwrap().parent_company_id.clone()
    }
    fn set(s: &mut OfficeSnapshot, c: &str, p: Value) -> Result<()> {
        s.apply(&json!({"action":"set_company_parent","companyId":c,"parentCompanyId":p}))
    }

    #[test]
    fn old_json_without_parent_loads() {
        let s = office();
        let mut v = serde_json::to_value(&s).unwrap();
        for c in v["companies"].as_array_mut().unwrap() {
            c.as_object_mut().unwrap().remove("parentCompanyId");
        }
        let back: OfficeSnapshot = serde_json::from_value(v).unwrap();
        back.validate().unwrap();
        assert!(back.companies.iter().all(|c| c.parent_company_id.is_none()));
    }

    #[test]
    fn attach_reparent_detach() {
        let (mut s, ids) = with_companies(3);
        set(&mut s, &ids[1], json!(ids[0])).unwrap();
        assert_eq!(parent_of(&s, &ids[1]).as_deref(), Some(ids[0].as_str()));
        set(&mut s, &ids[1], json!(ids[2])).unwrap();
        assert_eq!(parent_of(&s, &ids[1]).as_deref(), Some(ids[2].as_str()));
        let la = s.last_action.as_ref().unwrap();
        assert_eq!(la["oldParentCompanyId"], json!(ids[0]));
        assert_eq!(la["changed"], json!(true));
        set(&mut s, &ids[1], Value::Null).unwrap();
        assert_eq!(parent_of(&s, &ids[1]), None);
        s.validate().unwrap();
    }

    #[test]
    fn missing_null_and_wrong_type() {
        let (mut s, ids) = with_companies(2);
        let before = serde_json::to_value(&s).unwrap();
        assert_eq!(
            s.apply(&json!({"action":"set_company_parent","companyId":ids[1]})).unwrap_err().code,
            "INVALID_INPUT"
        );
        assert_eq!(set(&mut s, &ids[1], json!(5)).unwrap_err().code, "INVALID_INPUT");
        assert_eq!(
            s.apply(&json!({"action":"set_company_parent","parentCompanyId":null})).unwrap_err().code,
            "INVALID_INPUT"
        );
        assert_eq!(set(&mut s, &ids[1], json!("unknown-company")).unwrap_err().code, "NOT_FOUND");
        let _ = before;
        assert_eq!(parent_of(&s, &ids[1]), None);
        set(&mut s, &ids[1], Value::Null).unwrap();
        assert_eq!(s.last_action.as_ref().unwrap()["changed"], json!(false));
    }

    #[test]
    fn self_and_three_node_cycle_rejected() {
        let (mut s, ids) = with_companies(3);
        assert!(set(&mut s, &ids[0], json!(ids[0])).is_err());
        set(&mut s, &ids[1], json!(ids[0])).unwrap();
        set(&mut s, &ids[2], json!(ids[1])).unwrap();
        assert!(set(&mut s, &ids[0], json!(ids[2])).is_err());
        assert_eq!(parent_of(&s, &ids[0]), None);
        s.validate().unwrap();
    }

    #[test]
    fn malformed_restored_parent_fails_validation() {
        let (mut s, ids) = with_companies(2);
        s.companies[1].parent_company_id = Some("missing".into());
        assert!(s.validate().is_err());
        s.companies[1].parent_company_id = Some("bad/id".into());
        assert!(s.validate().is_err());
        s.companies[1].parent_company_id = Some(ids[1].clone());
        assert!(s.validate().is_err());
        s.companies[1].parent_company_id = Some(ids[0].clone());
        s.companies[0].parent_company_id = Some(ids[1].clone());
        assert!(s.validate().is_err());
    }

    #[test]
    fn rejected_operation_leaves_state_unchanged() {
        let (mut s, ids) = with_companies(2);
        set(&mut s, &ids[1], json!(ids[0])).unwrap();
        let events = s.events.len();
        assert!(set(&mut s, &ids[0], json!(ids[1])).is_err());
        assert_eq!(parent_of(&s, &ids[0]), None);
        assert_eq!(parent_of(&s, &ids[1]).as_deref(), Some(ids[0].as_str()));
        assert_eq!(s.events.len(), events);
    }

    #[test]
    fn serialization_preserves_parent() {
        let (mut s, ids) = with_companies(2);
        set(&mut s, &ids[1], json!(ids[0])).unwrap();
        let v = serde_json::to_value(&s).unwrap();
        let c = v["companies"].as_array().unwrap().iter().find(|c| c["id"] == json!(ids[1])).unwrap();
        assert_eq!(c["parentCompanyId"], json!(ids[0]));
        let back: OfficeSnapshot = serde_json::from_value(v).unwrap();
        assert_eq!(parent_of(&back, &ids[1]).as_deref(), Some(ids[0].as_str()));
    }

    #[test]
    fn repeated_assignment_is_not_changed() {
        let (mut s, ids) = with_companies(2);
        set(&mut s, &ids[1], json!(ids[0])).unwrap();
        let events = s.events.len();
        set(&mut s, &ids[1], json!(ids[0])).unwrap();
        assert_eq!(s.last_action.as_ref().unwrap()["changed"], json!(false));
        assert_eq!(s.events.len(), events);
    }

    #[test]
    fn reimport_preserves_parent() {
        let (mut s, ids) = with_companies(1);
        let cmd = json!({"action":"import_repositories","repositories":[{"name":"Second","repoUrl":"https://github.com/occult-kranti/second"}]});
        s.apply(&cmd).unwrap();
        let second = s.last_action.as_ref().unwrap()["companyIds"][0].as_str().unwrap().to_string();
        set(&mut s, &second, json!(ids[0])).unwrap();
        s.apply(&cmd).unwrap();
        assert_eq!(parent_of(&s, &second).as_deref(), Some(ids[0].as_str()));
    }
}
