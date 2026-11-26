# Python environments for Daftar and Yuga development

Daftar's editor extension and backend run with Node and the native Rust helper.
A Python `venv` isolates project Python packages. It does not contain VS Code,
Rust/Cargo, Blender, Godot, Unreal or the GPU driver, and it is not a sandbox for
untrusted code. Blender and the game engines retain their application runtimes.

## Select the Python on the execution host

The VS Code machine setting `atlas.pythonPath` selects an absolute Python 3
executable on the extension host. For Remote-SSH, that is a path on the remote
machine. The setting is used when starting a new Daftar runtime, not when attaching
to an already-running private runtime. Changing it requires a deliberate restart
of the runtime that owns the workspace. Existing jobs and Python environments are
not rewritten by changing a setting.

Direct daemon and systemd deployments use the trusted startup variable:

```dotenv
DAFTAR_PYTHON_PATH=/absolute/path/to/python3
```

The tmux launcher accepts this key in its private `--env-file`, or an explicit
`start --python /absolute/path/to/python3` option. VS Code uses the explicit option.
For a new session, `--python` takes precedence over the env-file and the supervisor
saves the explicit choice or its absence in private configuration before starting
the daemon. Later env-file changes do not add or replace that override. An absent
override leaves the runtime's normal default selection in effect. Existing sessions retain their recorded
configuration when another editor attaches. Older supervisor records without a
saved Python field retain their original env-file behavior.

The launcher does not source the file as shell code or inherit ambient Python
settings. The selected interpreter needs standard-library `venv` and bundled
`ensurepip`. A missing or invalid explicit interpreter fails instead of falling
back to a different Python. The path is operator configuration, not an argument
accepted from a model or workbench request.

When no path is configured, portable environment creation retains its `python3`,
then `python` PATH discovery. Managed host jobs retain the existing Linux
`/usr/bin/python3` default. Specify the path to remove that ambiguity.

## Portable environment creation

Open **Models & system → Python environments** in the office. Name the environment,
review the creation, and submit. The environment is created under the connected
runtime's application data directory, `venvs/<name>`. It is not necessarily on the
computer displaying the office.

For an owner-authenticated workbench client, the same operation is:

```json
{
  "id": "yuga-python-tools-create-1",
  "method": "createVenv",
  "args": [{
    "name": "yuga-python-tools",
    "confirmed": true,
    "installHuggingFaceHub": false
  }]
}
```

Send it through `POST /v1/workbench/call` using the existing protected runtime
credential. The reply returns `jobId`, `path`, `pythonPath` and `pending: true`.
Submission is not successful installation. Inspect `getJobStatus` for that job ID
until it is `succeeded`, `failed` or `cancelled`. Replaying the same request ID and
body returns its original receipt rather than creating another environment.

Use the returned absolute `pythonPath` to run Python and pip. POSIX environments
use `bin/python`; Windows environments use `Scripts/python.exe`. Do not construct
one platform's path on another, and do not use a bare `pip` command. Shell
activation is optional and is not used by Daftar. For example, with the real
returned path substituted:

```sh
/absolute/returned/venv/bin/python -I -m pip --require-virtualenv --version
```

The new acceptance test installs a tiny generated wheel from a local file using
`--no-index --no-deps`. It executes the installed module, verifies the package is
inside the selected venv and invisible to base Python, then uninstalls it. This
proves actual installation/execution without downloading project dependencies.
It does not certify arbitrary requirements or model packages.

The portable proof checks package directories for both Python base prefixes,
normalizing case and real paths. It excludes only the exact base-root entries:
Windows can legitimately use those roots for standard-library modules. The base
`Lib/site-packages` directories still count as leakage and remain forbidden.

## Managed Python execution

The Compute controls offer **Prepare a managed Python environment**, **Run a Python
source file**, and **Inspect environment jobs**. This is a separate maintained
environment registry, with company/employee attribution and inherited host policy.
The existing managed host runner requires Linux, tmux and explicit host-control
opt-in plus an eligible grant; portable venv creation does not require that host
runner.

Preparation uses `POST /v1/environments/prepare`:

```json
{
  "id": "yuga-managed-python-create-1",
  "companyId": "<current-company-id>",
  "employeeId": "<current-eligible-employee-id>",
  "environmentId": "yuga-python-1"
}
```

Use actual IDs from the current native workspace. Inspect the original operation
ID with `POST /v1/environments/inspect`; manual host policy requires its existing
approval step. Only a verified environment becomes `ready`.

Execution uses `/v1/environments/run` with a new stable operation ID, the same
company/environment IDs, an eligible employee, bounded Python source in `command`,
an absolute `cwd`, and explicit `timeoutSeconds` / `maxOutputBytes` limits. The
`command` field is Python source, not a shell command. `cwd` is the job working
directory; it does not establish an OS access boundary. Approval and scope checks
remain active before host dispatch.

Managed environments use copied interpreters and exclude system site-packages.
Daftar verifies the actual prefix, base prefix, isolated mode, user-site setting,
base-site visibility, interpreter hash and configuration hash before every run.
Python's `-I` alone does not override `include-system-site-packages = true`, so the
configuration is checked explicitly.

An enabled/missing/duplicate system-site option fails with `ENVIRONMENT_INVALID`.
Other changes to newly pinned `pyvenv.cfg` bytes fail with `ENVIRONMENT_CHANGED`.
Prepare a new environment ID after deliberate configuration changes; no automatic
repair or overwrite is performed. Older receipts without a configuration hash
remain usable only after current isolation checks pass. Installed packages are
not frozen by the interpreter/configuration hashes; review dependency changes
through normal owner-approved work.

## What has and has not been tested

The focused source tests exercise actual environment creation through the managed
service and the portable native workbench, offline pip installation/execution,
receipt replay, a disabled user site, rejection of system-site leakage,
configuration changes and legacy receipts. They preserve native scope and host
approval checks. The managed source fixture uses the real host controller and job
runner with an injected direct process launcher, so it does not certify tmux.
Six portable-proof fixtures exercise Windows and POSIX path layouts, including
package leakage through either base prefix. They check the classifier on the
current host; they do not substitute for execution in the Windows CI job.

The persistent-interpreter regression executes the real supervisor CLI, private
configuration reader and daemon child launch with a local tmux simulator. It checks
explicit paths with spaces/quotes, precedence, captured defaults, legacy records,
unchanged existing-session configuration and rejected ambient settings. The real
tmux and installed VS Code tests additionally check the selected interpreter;
their post-change CI result must be reviewed separately from the simulator proof.

The managed suite also ran under the downloaded VS Code 1.147.0 Electron binary
in Node mode, without a graphical session. The trusted managed wrapper explicitly
selects Node mode after the host shell's environment scrub. The suite verifies
that ordinary shell jobs and the Python child do not inherit that mode variable.
This checks the Electron-to-shell-to-wrapper handoff as well as actual venv
preparation, offline package execution and configuration rejection.

The sibling design-installer wrapper has the same explicit Node-mode handoff.
Its focused suite ran under both Node and the downloaded Electron binary using
a deliberately invalid local manifest. The real wrapper rejected that manifest
before installation or network work. APT and artifact transfers use injected
fixtures in the remaining design tests; these checks did not install design apps.

The installed VSIX stress runner uses the same offline package acceptance helper
against an environment returned by the installed package's runtime. Graphical
VS Code and persistent tmux acceptance require a machine that permits their display
and Unix sockets. Windows-specific acceptance must come from the Windows job;
Linux source tests do not establish it. See the current package validation receipt
for which gates actually ran.

The [source acceptance receipt](PYTHON_VENV_VALIDATION_2026-11-26.json) records
commands, separate suite counts, source hashes, the reproduced pre-fix defect and
the explicit tmux skip. Those counts are not added together as unique coverage.

Python environments are disposable and are not copied into Git. Recreate them at
their destination from the reviewed interpreter and dependency definitions.

## Primary references

- [Python 3.12 virtual environments](https://docs.python.org/3.12/library/venv.html)
  explains package isolation, explicit interpreter use, platform paths and
  recreation instead of relocation.
- [Python ensurepip](https://docs.python.org/3.12/library/ensurepip.html) documents
  bootstrapping pip from bundled components without Internet access.

Implementation and acceptance: [portable creator](../desktop-shell/src/main/venv.ts),
[managed service](../headless-runtime/managed-environments.mjs),
[offline installation probe](../scripts/venv-acceptance.mjs).
