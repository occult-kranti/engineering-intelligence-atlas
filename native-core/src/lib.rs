use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashSet;
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write};
use std::path::{Component, Path, PathBuf};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use time::{format_description::well_known::Rfc3339, OffsetDateTime};
pub mod office;

pub const MAX_REQUEST_BYTES: u64 = 1_048_576;
const MAX_STATE_BYTES: u64 = 64 * 1_048_576;
const MAX_FILES: usize = 10_000;
const MAX_ENTRIES: usize = 50_000;
const MAX_DEPTH: usize = 32;
const INDEX_DEADLINE: Duration = Duration::from_secs(5);

#[derive(Debug)]
pub struct CoreError {
    pub code: &'static str,
    pub message: String,
}
type Result<T> = std::result::Result<T, CoreError>;
fn fail(code: &'static str, message: impl Into<String>) -> CoreError {
    CoreError {
        code,
        message: message.into(),
    }
}
pub fn error_response(code: &str, message: &str) -> Value {
    serde_json::json!({"ok": false, "code": code, "error": message})
}
fn now() -> String {
    OffsetDateTime::now_utc()
        .format(&Rfc3339)
        .unwrap_or_default()
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Request {
    pub command: String,
    pub state_dir: PathBuf,
    pub seed_dir: PathBuf,
    #[serde(default)]
    pub repository_root: Option<PathBuf>,
    #[serde(default)]
    pub payload: Value,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Company {
    pub id: String,
    pub name: String,
    pub repo_url: String,
    pub owner: String,
    pub repo: String,
    #[serde(default)]
    pub default_branch: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub registered_at: Option<String>,
    #[serde(default)]
    pub last_checked_at: Option<String>,
    pub github_status: String,
    #[serde(default)]
    pub github_error: Option<String>,
    #[serde(default)]
    pub stars: Option<u64>,
    #[serde(default)]
    pub open_issues: Option<u64>,
    #[serde(default)]
    pub pushed_at: Option<String>,
    #[serde(default)]
    pub head_sha: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Employee {
    pub id: String,
    pub name: String,
    pub role: String,
    pub role_path: String,
    pub skill_path: String,
    pub status: String,
    #[serde(default)]
    pub last_result: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "kebab-case")]
pub enum TaskStatus {
    Todo,
    InProgress,
    Blocked,
    Done,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub id: String,
    pub title: String,
    pub owner_id: String,
    pub status: TaskStatus,
    pub priority: String,
    pub milestone: String,
    #[serde(default)]
    pub evidence: Option<String>,
    pub updated_at: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Milestone {
    pub id: String,
    pub title: String,
    pub description: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Activity {
    pub id: String,
    pub at: String,
    pub employee_id: String,
    pub kind: String,
    pub message: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct IndexedFile {
    pub path: String,
    pub bytes: u64,
    pub kind: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RepositoryIndex {
    pub root: String,
    pub file_count: usize,
    pub total_bytes: u64,
    pub skipped_count: usize,
    pub truncated: bool,
    pub elapsed_ms: u128,
    pub workers: usize,
    pub generated_at: String,
    pub files: Vec<IndexedFile>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    pub schema_version: u32,
    pub company: Company,
    pub employees: Vec<Employee>,
    pub tasks: Vec<Task>,
    pub milestones: Vec<Milestone>,
    pub activity: Vec<Activity>,
    pub index: Option<RepositoryIndex>,
    #[serde(default)]
    pub office: Option<office::OfficeSnapshot>,
}

#[derive(Deserialize)]
struct Roadmap {
    tasks: Vec<Task>,
    milestones: Vec<Milestone>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Registration {
    repo_url: String,
    owner: String,
    repo: String,
    default_branch: String,
    description: Option<String>,
    stars: u64,
    open_issues: u64,
    pushed_at: Option<String>,
    head_sha: Option<String>,
    checked_at: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct GithubFailure {
    ok: bool,
    error: String,
    checked_at: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct TaskUpdate {
    id: String,
    status: TaskStatus,
    #[serde(default)]
    evidence: Option<String>,
}

fn bounded_text(value: &str, max: usize, label: &str) -> Result<()> {
    if value.trim().is_empty()
        || value.len() > max
        || value
            .chars()
            .any(|c| c == '\0' || (c.is_control() && c != '\n' && c != '\t'))
    {
        return Err(fail(
            "INVALID_INPUT",
            format!("{label} must contain 1..{max} printable bytes"),
        ));
    }
    Ok(())
}

fn safe_id(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 100
        && value
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, b'-' | b'_' | b'.'))
        && value != "."
        && value != ".."
}

fn safe_relative(value: &str) -> bool {
    !value.is_empty()
        && !value.contains('\\')
        && Path::new(value)
            .components()
            .all(|c| matches!(c, Component::Normal(_)))
}

/// Refuse symlinks in configured paths, including parent components. No caller-supplied
/// path is interpreted as a command, and the desktop bridge does not expose raw paths.
fn absolute_without_symlinks(path: &Path) -> Result<()> {
    if !path.is_absolute() {
        return Err(fail("INVALID_PATH", "Expected an absolute path"));
    }
    let mut cursor = PathBuf::new();
    for component in path.components() {
        if matches!(component, Component::ParentDir | Component::CurDir) {
            return Err(fail(
                "INVALID_PATH",
                "Parent/current directory components are not allowed",
            ));
        }
        cursor.push(component.as_os_str());
        match fs::symlink_metadata(&cursor) {
            Ok(meta) if meta.file_type().is_symlink() => {
                return Err(fail(
                    "SYMLINK_REFUSED",
                    "Configured paths must not contain symlinks",
                ))
            }
            Err(err) if err.kind() != std::io::ErrorKind::NotFound => {
                return Err(fail("IO_ERROR", "Could not inspect configured path"))
            }
            _ => {}
        }
    }
    Ok(())
}

fn read_json<T: serde::de::DeserializeOwned>(path: &Path, max: u64) -> Result<T> {
    absolute_without_symlinks(path)?;
    let meta = fs::symlink_metadata(path)
        .map_err(|_| fail("STATE_READ_ERROR", "Required state or seed file is missing"))?;
    if !meta.is_file() || meta.len() > max {
        return Err(fail(
            "STATE_READ_ERROR",
            "State or seed is not a bounded regular file",
        ));
    }
    let mut bytes = Vec::new();
    File::open(path)
        .map_err(|_| fail("STATE_READ_ERROR", "Could not open state or seed"))?
        .take(max + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| fail("STATE_READ_ERROR", "Could not read state or seed"))?;
    if bytes.len() as u64 > max {
        return Err(fail("STATE_READ_ERROR", "State or seed exceeds size limit"));
    }
    serde_json::from_slice(&bytes).map_err(|_| {
        fail(
            "STATE_CORRUPT",
            "State or seed JSON is invalid; original file preserved",
        )
    })
}

fn validate_snapshot(snapshot: &Snapshot) -> Result<()> {
    if snapshot.schema_version != 1 {
        return Err(fail("STATE_VERSION", "Unsupported company state version"));
    }
    let company = &snapshot.company;
    if !safe_id(&company.id)
        || !safe_id(&company.owner)
        || !safe_id(&company.repo)
        || company.repo_url != format!("https://github.com/{}/{}", company.owner, company.repo)
        || !["unchecked", "verified", "error"].contains(&company.github_status.as_str())
    {
        return Err(fail("STATE_INVALID", "Invalid company identity or status"));
    }
    bounded_text(&company.name, 200, "company name")?;
    if snapshot.employees.is_empty()
        || snapshot.employees.len() > 150
        || snapshot.tasks.len() > 500
        || snapshot.milestones.len() > 50
        || snapshot.activity.len() > 200
    {
        return Err(fail(
            "STATE_INVALID",
            "Company roster, roadmap or activity exceeds its bounds",
        ));
    }
    let mut employees = HashSet::new();
    for employee in &snapshot.employees {
        if !safe_id(&employee.id)
            || !employees.insert(employee.id.as_str())
            || !safe_relative(&employee.role_path)
            || !safe_relative(&employee.skill_path)
            || !["ready", "running", "blocked"].contains(&employee.status.as_str())
        {
            return Err(fail(
                "STATE_INVALID",
                "Invalid or duplicate employee or skill path",
            ));
        }
        bounded_text(&employee.name, 150, "employee name")?;
    }
    let milestones: HashSet<&str> = snapshot.milestones.iter().map(|m| m.id.as_str()).collect();
    if milestones.len() != snapshot.milestones.len() {
        return Err(fail("STATE_INVALID", "Duplicate milestones"));
    }
    let mut tasks = HashSet::new();
    for task in &snapshot.tasks {
        if !safe_id(&task.id)
            || !tasks.insert(task.id.as_str())
            || !employees.contains(task.owner_id.as_str())
            || !["P0", "P1", "P2"].contains(&task.priority.as_str())
            || !milestones.contains(task.milestone.as_str())
        {
            return Err(fail(
                "STATE_INVALID",
                "Invalid or duplicate task, owner or milestone",
            ));
        }
        bounded_text(&task.title, 400, "task title")?;
        if let Some(evidence) = &task.evidence {
            bounded_text(evidence, 2000, "evidence")?;
        }
    }
    if snapshot
        .index
        .as_ref()
        .is_some_and(|index| index.files.len() > MAX_FILES)
    {
        return Err(fail("STATE_INVALID", "Repository index exceeds file limit"));
    }
    if let Some(office) = &snapshot.office {
        office.validate()?;
    }
    Ok(())
}

fn load_seed(seed_dir: &Path) -> Result<Snapshot> {
    absolute_without_symlinks(seed_dir)?;
    let company: Company = read_json(
        &seed_dir.join("engineering-intelligence-atlas.json"),
        MAX_REQUEST_BYTES,
    )?;
    let employees = read_json(&seed_dir.join("team.json"), MAX_REQUEST_BYTES)?;
    let mut roadmap: Roadmap = read_json(&seed_dir.join("roadmap.json"), MAX_REQUEST_BYTES)?;
    if company.github_status != "verified" {
        for task in roadmap
            .tasks
            .iter_mut()
            .filter(|task| task.id == "github-register")
        {
            task.status = TaskStatus::Todo;
            task.evidence = None;
        }
    }
    let snapshot = Snapshot {
        schema_version: 1,
        company,
        employees,
        tasks: roadmap.tasks,
        milestones: roadmap.milestones,
        activity: vec![],
        index: None,
        office: None,
    };
    validate_snapshot(&snapshot)?;
    Ok(snapshot)
}

fn private_options() -> OpenOptions {
    let mut options = OpenOptions::new();
    options.read(true).write(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    options
}

fn save_state(path: &Path, snapshot: &Snapshot) -> Result<()> {
    let bytes = serde_json::to_vec_pretty(snapshot)
        .map_err(|_| fail("STATE_WRITE_ERROR", "Could not serialize company state"))?;
    if bytes.len() as u64 > MAX_STATE_BYTES {
        return Err(fail("STATE_WRITE_ERROR", "Company state exceeds 64 MiB"));
    }
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let temp = path.with_file_name(format!(".company-{}-{nonce}.tmp", std::process::id()));
    let result = (|| -> std::io::Result<()> {
        let mut file = private_options().create_new(true).open(&temp)?;
        file.write_all(&bytes)?;
        file.sync_all()?;
        fs::rename(&temp, path)?;
        #[cfg(unix)]
        if let Some(parent) = path.parent() {
            File::open(parent)?.sync_all()?;
        }
        Ok(())
    })();
    if result.is_err() {
        let _ = fs::remove_file(temp);
        return Err(fail(
            "STATE_WRITE_ERROR",
            "Atomic company state update failed",
        ));
    }
    Ok(())
}

fn event(snapshot: &mut Snapshot, employee_id: &str, kind: &str, message: String) {
    let at = now();
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    snapshot.activity.push(Activity {
        id: format!("event-{}-{nonce}", std::process::id()),
        at,
        employee_id: employee_id.into(),
        kind: kind.into(),
        message,
    });
    if snapshot.activity.len() > 200 {
        snapshot.activity.drain(..snapshot.activity.len() - 200);
    }
}

fn validate_timestamp(timestamp: &str) -> Result<()> {
    OffsetDateTime::parse(timestamp, &Rfc3339)
        .map_err(|_| fail("INVALID_INPUT", "checkedAt must be an RFC3339 timestamp"))?;
    Ok(())
}

pub fn execute(request: Request) -> Result<Snapshot> {
    if ![
        "snapshot",
        "register_company",
        "record_github_check",
        "update_task",
        "index_repository",
        "office_snapshot",
        "office_command",
        "control_snapshot",
        "control_command",
    ]
    .contains(&request.command.as_str())
    {
        return Err(fail("UNKNOWN_COMMAND", "Unsupported company command"));
    }
    absolute_without_symlinks(&request.state_dir)?;
    fs::create_dir_all(&request.state_dir).map_err(|_| {
        fail(
            "STATE_WRITE_ERROR",
            "Could not create company state directory",
        )
    })?;
    let lock_path = request.state_dir.join("company-state.lock");
    absolute_without_symlinks(&lock_path)?;
    let lock = private_options()
        .create(true)
        .truncate(false)
        .open(lock_path)
        .map_err(|_| fail("STATE_LOCK_ERROR", "Could not open company lock"))?;
    // OS lock is released even if this process is killed. Fail immediately when
    // another Electron/MCP writer owns it: no busy polling and no stale lockfiles.
    lock.try_lock().map_err(|_| {
        fail(
            "STATE_BUSY",
            "Company state is busy; retry this action when the other action finishes",
        )
    })?;
    let state_path = request.state_dir.join("company-state.json");
    absolute_without_symlinks(&state_path)?;
    let fresh = !state_path.exists();
    let mut snapshot: Snapshot = if fresh {
        load_seed(&request.seed_dir)?
    } else {
        read_json(&state_path, MAX_STATE_BYTES)?
    };
    validate_snapshot(&snapshot)?;
    let mut office_changed = false;
    if request.command.starts_with("office_") || request.command.starts_with("control_") {
        if snapshot.office.is_none() {
            snapshot.office = Some(office::OfficeSnapshot::seeded(
                &snapshot.company,
                &snapshot.employees,
            )?);
            office_changed = true;
        }
        office_changed |= snapshot.office.as_mut().unwrap().expire_leases();
        office_changed |= snapshot.office.as_mut().unwrap().migrate_governance()?;
        office_changed |= snapshot.office.as_mut().unwrap().migrate_portfolio();
    }
    match request.command.as_str() {
        "snapshot" => {}
        "office_snapshot" | "control_snapshot" => {}
        "office_command" | "control_command" => {
            snapshot.office.as_mut().unwrap().apply(&request.payload)?;
        }
        "register_company" => {
            let data: Registration = serde_json::from_value(request.payload)
                .map_err(|_| fail("INVALID_INPUT", "Invalid verified repository metadata"))?;
            validate_timestamp(&data.checked_at)?;
            if !safe_id(&data.owner)
                || !safe_id(&data.repo)
                || data.repo_url != format!("https://github.com/{}/{}", data.owner, data.repo)
            {
                return Err(fail(
                    "INVALID_INPUT",
                    "Repository must be a canonical public GitHub owner/repo URL",
                ));
            }
            bounded_text(&data.default_branch, 255, "default branch")?;
            if data.description.as_ref().is_some_and(|d| d.len() > 2000) {
                return Err(fail("INVALID_INPUT", "Repository description is too long"));
            }
            if data.head_sha.as_ref().is_some_and(|sha| {
                ![40, 64].contains(&sha.len()) || !sha.bytes().all(|c| c.is_ascii_hexdigit())
            }) {
                return Err(fail("INVALID_INPUT", "Invalid commit SHA"));
            }
            // A workspace carries a company-specific team and roadmap. Never silently
            // reassign that roadmap to another repository via a URL field.
            if !data.owner.eq_ignore_ascii_case(&snapshot.company.owner)
                || !data.repo.eq_ignore_ascii_case(&snapshot.company.repo)
            {
                return Err(fail(
                    "WRONG_COMPANY",
                    "Repository does not match this company workspace",
                ));
            }
            let is_new = snapshot.company.registered_at.is_none();
            let company = &mut snapshot.company;
            company.repo_url = data.repo_url;
            company.owner = data.owner;
            company.repo = data.repo;
            company.default_branch = Some(data.default_branch);
            company.description = data.description;
            company.registered_at.get_or_insert(data.checked_at.clone());
            company.last_checked_at = Some(data.checked_at.clone());
            company.github_status = "verified".into();
            company.github_error = None;
            company.stars = Some(data.stars);
            company.open_issues = Some(data.open_issues);
            company.pushed_at = data.pushed_at;
            company.head_sha = data.head_sha;
            let result = format!(
                "Verified public GitHub repository {}/{}; default branch {}",
                company.owner,
                company.repo,
                company.default_branch.as_deref().unwrap_or("")
            );
            if let Some(employee) = snapshot.employees.iter_mut().find(|e| e.id == "github") {
                employee.status = "ready".into();
                employee.last_result = Some(result.clone());
            }
            if let Some(task) = snapshot
                .tasks
                .iter_mut()
                .find(|t| t.id == "github-register")
            {
                task.status = TaskStatus::Done;
                task.evidence = Some(format!(
                    "{} at {}",
                    snapshot.company.repo_url, data.checked_at
                ));
                task.updated_at = data.checked_at;
            }
            event(
                &mut snapshot,
                "github",
                if is_new {
                    "company-registered"
                } else {
                    "repository-refreshed"
                },
                result,
            );
        }
        "record_github_check" => {
            let data: GithubFailure = serde_json::from_value(request.payload)
                .map_err(|_| fail("INVALID_INPUT", "Invalid failed check record"))?;
            if data.ok {
                return Err(fail(
                    "INVALID_INPUT",
                    "Use register_company with verified metadata for a successful check",
                ));
            }
            validate_timestamp(&data.checked_at)?;
            bounded_text(&data.error, 500, "GitHub error")?;
            snapshot.company.github_status = "error".into();
            snapshot.company.github_error = Some(data.error.clone());
            snapshot.company.last_checked_at = Some(data.checked_at);
            if let Some(employee) = snapshot.employees.iter_mut().find(|e| e.id == "github") {
                employee.status = "blocked".into();
                employee.last_result = Some(data.error.clone());
            }
            event(
                &mut snapshot,
                "github",
                "repository-check-failed",
                data.error,
            );
        }
        "update_task" => {
            let update: TaskUpdate = serde_json::from_value(request.payload)
                .map_err(|_| fail("INVALID_INPUT", "Invalid task update"))?;
            if update.id == "github-register" {
                return Err(fail(
                    "AUTOMATED_TASK",
                    "Repository registration status is set only by a verified GitHub check",
                ));
            }
            if let Some(evidence) = &update.evidence {
                bounded_text(evidence, 2000, "evidence")?;
            }
            if update.status == TaskStatus::Done && update.evidence.is_none() {
                return Err(fail(
                    "EVIDENCE_REQUIRED",
                    "Marking a task done requires completion evidence",
                ));
            }
            let task = snapshot
                .tasks
                .iter_mut()
                .find(|t| t.id == update.id)
                .ok_or_else(|| fail("TASK_NOT_FOUND", "Task not found"))?;
            task.status = update.status;
            if update.evidence.is_some() {
                task.evidence = update.evidence;
            }
            task.updated_at = now();
            let message = format!(
                "Owner updated task: {} ({})",
                task.title,
                serde_json::to_value(&task.status)
                    .unwrap_or_default()
                    .as_str()
                    .unwrap_or("")
            );
            event(&mut snapshot, "owner", "task-updated", message);
        }
        "index_repository" => {
            let root = request.repository_root.as_ref().ok_or_else(|| {
                fail(
                    "NO_REPOSITORY",
                    "No local repository checkout is configured",
                )
            })?;
            let index = index_repository(root, MAX_FILES)?;
            let message = format!(
                "Indexed {} local files ({} bytes); {} workers{}",
                index.file_count,
                index.total_bytes,
                index.workers,
                if index.truncated {
                    "; bounded partial inventory"
                } else {
                    ""
                }
            );
            snapshot.index = Some(index);
            event(&mut snapshot, "github", "repository-indexed", message);
        }
        _ => unreachable!(),
    }
    validate_snapshot(&snapshot)?;
    if fresh
        || office_changed
        || !["snapshot", "office_snapshot", "control_snapshot"].contains(&request.command.as_str())
    {
        save_state(&state_path, &snapshot)?;
    }
    Ok(snapshot)
}

fn excluded(name: &str) -> bool {
    [
        ".git",
        "node_modules",
        "target",
        "dist",
        "build",
        "release",
        "coverage",
        ".cache",
        ".venv",
        "venv",
        ".next",
        "__pycache__",
    ]
    .contains(&name)
        || (name == ".env" || (name.starts_with(".env.") && name != ".env.example"))
}

fn kind(path: &Path) -> String {
    match path
        .extension()
        .and_then(|x| x.to_str())
        .unwrap_or("")
        .to_ascii_lowercase()
        .as_str()
    {
        "rs" => "Rust",
        "ts" | "tsx" => "TypeScript",
        "js" | "mjs" | "cjs" => "JavaScript",
        "md" | "txt" | "rst" => "Documentation",
        "json" | "yml" | "yaml" | "toml" => "Configuration",
        "py" => "Python",
        "java" => "Java",
        "html" | "css" => "Web",
        _ => "Asset",
    }
    .into()
}

/// Deterministic, bounded traversal with 1..8 native workers for metadata. No file
/// contents are read and all symlinks are excluded. This is an inventory, not a scan
/// proving code safe, and it never runs repositories or model code.
pub fn index_repository(root: &Path, max_files: usize) -> Result<RepositoryIndex> {
    absolute_without_symlinks(root)?;
    let root = fs::canonicalize(root)
        .map_err(|_| fail("NO_REPOSITORY", "Local repository directory is unavailable"))?;
    if !root.is_dir() {
        return Err(fail(
            "NO_REPOSITORY",
            "Local repository root must be a directory",
        ));
    }
    let started = Instant::now();
    let limit = max_files.clamp(1, MAX_FILES);
    let mut directories = vec![(root.clone(), 0usize)];
    let mut candidates = Vec::new();
    let mut skipped = 0usize;
    let mut visited = 0usize;
    let mut truncated = false;
    'walk: while let Some((directory, depth)) = directories.pop() {
        if started.elapsed() > INDEX_DEADLINE || visited >= MAX_ENTRIES {
            truncated = true;
            break;
        }
        if depth > MAX_DEPTH {
            skipped += 1;
            truncated = true;
            continue;
        }
        let safe = fs::symlink_metadata(&directory)
            .map(|m| !m.file_type().is_symlink())
            .unwrap_or(false)
            && fs::canonicalize(&directory)
                .map(|p| p.starts_with(&root))
                .unwrap_or(false);
        if !safe {
            skipped += 1;
            continue;
        }
        let entries = match fs::read_dir(&directory) {
            Ok(entries) => entries,
            Err(_) => {
                skipped += 1;
                continue;
            }
        };
        let mut sorted = Vec::new();
        for entry in entries {
            visited += 1;
            if visited > MAX_ENTRIES || started.elapsed() > INDEX_DEADLINE {
                truncated = true;
                break;
            }
            match entry {
                Ok(entry) => sorted.push(entry),
                Err(_) => skipped += 1,
            }
        }
        sorted.sort_by_key(|entry| entry.file_name());
        for entry in sorted {
            let name = entry.file_name();
            if excluded(&name.to_string_lossy()) {
                skipped += 1;
                continue;
            }
            let ty = match entry.file_type() {
                Ok(ty) => ty,
                Err(_) => {
                    skipped += 1;
                    continue;
                }
            };
            if ty.is_symlink() {
                skipped += 1;
                continue;
            }
            if ty.is_dir() {
                directories.push((entry.path(), depth + 1));
            } else if ty.is_file() {
                if candidates.len() >= limit {
                    truncated = true;
                    break 'walk;
                }
                candidates.push(entry.path());
            } else {
                skipped += 1;
            }
        }
    }
    let workers = std::thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(1)
        .clamp(1, 8)
        .min(candidates.len().max(1));
    let chunk = candidates.len().div_ceil(workers).max(1);
    let files = std::thread::scope(|scope| {
        let mut handles = Vec::new();
        for paths in candidates.chunks(chunk) {
            let root = &root;
            handles.push(scope.spawn(move || {
                paths
                    .iter()
                    .filter_map(|path| {
                        if started.elapsed() > INDEX_DEADLINE {
                            return None;
                        }
                        let meta = fs::symlink_metadata(path).ok()?;
                        if !meta.is_file() || meta.file_type().is_symlink() {
                            return None;
                        }
                        // Resolve before reporting metadata to exclude directory swaps
                        // that would redirect an entry beyond the chosen repository.
                        if !fs::canonicalize(path).ok()?.starts_with(root) {
                            return None;
                        }
                        let relative = path
                            .strip_prefix(root)
                            .ok()?
                            .to_string_lossy()
                            .replace('\\', "/");
                        Some(IndexedFile {
                            path: relative,
                            bytes: meta.len(),
                            kind: kind(path),
                        })
                    })
                    .collect::<Vec<_>>()
            }));
        }
        let mut files = Vec::new();
        for handle in handles {
            files.extend(handle.join().unwrap_or_default());
        }
        files
    });
    let mut files = files;
    skipped += candidates.len().saturating_sub(files.len());
    if started.elapsed() > INDEX_DEADLINE {
        truncated = true;
    }
    files.sort_by(|a, b| a.path.cmp(&b.path));
    Ok(RepositoryIndex {
        root: root.display().to_string(),
        file_count: files.len(),
        total_bytes: files.iter().map(|f| f.bytes).sum(),
        skipped_count: skipped,
        truncated,
        elapsed_ms: started.elapsed().as_millis(),
        workers,
        generated_at: now(),
        files,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    struct Fixture {
        root: PathBuf,
    }
    impl Fixture {
        fn new() -> Self {
            let root = std::env::temp_dir().join(format!(
                "atlas-core-test-{}-{}",
                std::process::id(),
                SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap()
                    .as_nanos()
            ));
            fs::create_dir_all(root.join("seed")).unwrap();
            fs::write(root.join("seed/engineering-intelligence-atlas.json"), serde_json::json!({"id":"engineering-intelligence-atlas","name":"Engineering Intelligence Atlas","owner":"occult-kranti","repo":"engineering-intelligence-atlas","repoUrl":"https://github.com/occult-kranti/engineering-intelligence-atlas","githubStatus":"unchecked"}).to_string()).unwrap();
            fs::write(root.join("seed/team.json"), serde_json::json!([{"id":"github","name":"GitHub employee","role":"Repository steward","rolePath":"roles/platform-engineer/README.md","skillPath":"skills/agent-research-director/SKILL.md","status":"ready"}]).to_string()).unwrap();
            fs::write(root.join("seed/roadmap.json"), serde_json::json!({"milestones":[{"id":"release","title":"Release","description":"Verify the release"}],"tasks":[{"id":"github-register","title":"Register repository","ownerId":"github","status":"todo","priority":"P0","milestone":"release","updatedAt":"2026-11-20T00:00:00Z"},{"id":"test-release","title":"Test release","ownerId":"github","status":"todo","priority":"P0","milestone":"release","updatedAt":"2026-11-20T00:00:00Z"}]}).to_string()).unwrap();
            Self { root }
        }
        fn request(&self, command: &str, payload: Value) -> Request {
            Request {
                command: command.into(),
                state_dir: self.root.join("state"),
                seed_dir: self.root.join("seed"),
                repository_root: None,
                payload,
            }
        }
    }
    impl Drop for Fixture {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.root);
        }
    }

    #[test]
    fn fresh_state_is_unchecked_and_persists() {
        let fixture = Fixture::new();
        let state = execute(fixture.request("snapshot", Value::Null)).unwrap();
        assert_eq!(state.company.github_status, "unchecked");
        assert!(state.company.registered_at.is_none());
        assert!(fixture.root.join("state/company-state.json").is_file());
    }
    #[test]
    fn shipped_development_registration_does_not_verify_a_fresh_install() {
        let fixture = Fixture::new();
        let roadmap_path = fixture.root.join("seed/roadmap.json");
        let mut roadmap: Value = serde_json::from_slice(&fs::read(&roadmap_path).unwrap()).unwrap();
        for task in roadmap["tasks"].as_array_mut().unwrap() {
            task["status"] = serde_json::json!("done");
            task["evidence"] = serde_json::json!("Development release verification");
        }
        fs::write(&roadmap_path, serde_json::to_vec(&roadmap).unwrap()).unwrap();
        let state = execute(fixture.request("snapshot", Value::Null)).unwrap();
        assert_eq!(state.tasks[0].status, TaskStatus::Todo);
        assert!(state.tasks[0].evidence.is_none());
        assert_eq!(state.tasks[1].status, TaskStatus::Done);
        assert_eq!(state.company.github_status, "unchecked");
    }
    #[test]
    fn registration_requires_metadata_and_sets_first_task() {
        let fixture = Fixture::new();
        let payload = serde_json::json!({"owner":"occult-kranti","repo":"engineering-intelligence-atlas","repoUrl":"https://github.com/occult-kranti/engineering-intelligence-atlas","defaultBranch":"main","description":null,"stars":1,"openIssues":0,"pushedAt":null,"headSha":"0123456789012345678901234567890123456789","checkedAt":"2026-11-20T00:00:00Z"});
        let state = execute(fixture.request("register_company", payload)).unwrap();
        assert_eq!(state.company.github_status, "verified");
        assert_eq!(state.tasks[0].status, TaskStatus::Done);
        assert_eq!(state.activity[0].kind, "company-registered");
        let again = execute(fixture.request("snapshot", Value::Null)).unwrap();
        assert_eq!(again.company.head_sha, state.company.head_sha);
        assert_eq!(again.tasks[0].status, TaskStatus::Done);
    }
    #[test]
    fn github_failure_never_fakes_verification() {
        let fixture = Fixture::new();
        let state = execute(fixture.request("record_github_check", serde_json::json!({"ok":false,"error":"GitHub API unavailable","checkedAt":"2026-11-20T00:00:00Z"}))).unwrap();
        assert_eq!(state.company.github_status, "error");
        assert!(state.company.registered_at.is_none());
        assert_eq!(state.tasks[0].status, TaskStatus::Todo);
    }
    #[test]
    fn task_updates_are_persistent_and_cannot_forge_registration() {
        let fixture = Fixture::new();
        assert_eq!(
            execute(fixture.request(
                "update_task",
                serde_json::json!({"id":"github-register","status":"done"})
            ))
            .unwrap_err()
            .code,
            "AUTOMATED_TASK"
        );
        execute(fixture.request("update_task",serde_json::json!({"id":"test-release","status":"in-progress","evidence":"Owner started verification"}))).unwrap();
        assert_eq!(
            execute(fixture.request("snapshot", Value::Null))
                .unwrap()
                .tasks[1]
                .status,
            TaskStatus::InProgress
        );
        assert_eq!(
            execute(fixture.request(
                "update_task",
                serde_json::json!({"id":"nope","status":"done","evidence":"Recorded check"})
            ))
            .unwrap_err()
            .code,
            "TASK_NOT_FOUND"
        );
        assert_eq!(
            execute(fixture.request(
                "update_task",
                serde_json::json!({"id":"test-release","status":"done"})
            ))
            .unwrap_err()
            .code,
            "EVIDENCE_REQUIRED"
        );
    }
    #[test]
    fn corrupt_state_is_preserved_instead_of_reset() {
        let fixture = Fixture::new();
        execute(fixture.request("snapshot", Value::Null)).unwrap();
        let path = fixture.root.join("state/company-state.json");
        fs::write(&path, "not JSON").unwrap();
        assert_eq!(
            execute(fixture.request("snapshot", Value::Null))
                .unwrap_err()
                .code,
            "STATE_CORRUPT"
        );
        assert_eq!(fs::read_to_string(path).unwrap(), "not JSON");
    }
    #[test]
    fn concurrent_access_is_bounded_and_lock_releases() {
        let fixture = Fixture::new();
        execute(fixture.request("snapshot", Value::Null)).unwrap();
        let lock = private_options()
            .open(fixture.root.join("state/company-state.lock"))
            .unwrap();
        lock.lock().unwrap();
        let started = Instant::now();
        assert_eq!(
            execute(fixture.request("snapshot", Value::Null))
                .unwrap_err()
                .code,
            "STATE_BUSY"
        );
        assert!(started.elapsed() < Duration::from_secs(1));
        drop(lock);
        assert!(execute(fixture.request("snapshot", Value::Null)).is_ok());
    }
    #[test]
    fn index_is_bounded_sorted_and_excludes_generated_and_secret_files() {
        let fixture = Fixture::new();
        let repo = fixture.root.join("repo");
        fs::create_dir_all(repo.join("node_modules")).unwrap();
        fs::write(repo.join("a.rs"), "123").unwrap();
        fs::write(repo.join("b.md"), "12345").unwrap();
        fs::write(repo.join(".env"), "secret").unwrap();
        fs::write(repo.join("node_modules/no.js"), "no").unwrap();
        let index = index_repository(&repo, 100).unwrap();
        assert_eq!(index.file_count, 2);
        assert_eq!(index.total_bytes, 8);
        assert_eq!(index.files[0].kind, "Rust");
        assert_eq!(index.skipped_count, 2);
        assert!(!index.truncated);
        let bounded = index_repository(&repo, 1).unwrap();
        assert_eq!(bounded.file_count, 1);
        assert!(bounded.truncated);
    }
    #[cfg(unix)]
    #[test]
    fn symlinks_cannot_escape_index_or_state() {
        use std::os::unix::fs::symlink;
        let fixture = Fixture::new();
        let repo = fixture.root.join("repo");
        fs::create_dir_all(&repo).unwrap();
        fs::write(fixture.root.join("outside"), "outside").unwrap();
        symlink(fixture.root.join("outside"), repo.join("escape")).unwrap();
        let index = index_repository(&repo, 100).unwrap();
        assert_eq!(index.file_count, 0);
        assert_eq!(index.skipped_count, 1);
        fs::create_dir_all(fixture.root.join("state")).unwrap();
        symlink(
            fixture.root.join("outside"),
            fixture.root.join("state/company-state.json"),
        )
        .unwrap();
        assert_eq!(
            execute(fixture.request("snapshot", Value::Null))
                .unwrap_err()
                .code,
            "SYMLINK_REFUSED"
        );
    }
    #[test]
    fn rejects_unknown_commands_and_path_traversal() {
        let fixture = Fixture::new();
        assert_eq!(
            execute(fixture.request("shell", Value::Null))
                .unwrap_err()
                .code,
            "UNKNOWN_COMMAND"
        );
        let mut request = fixture.request("snapshot", Value::Null);
        request.state_dir = fixture.root.join("../outside");
        assert_eq!(execute(request).unwrap_err().code, "INVALID_PATH");
    }
}
