# Host control checkpoint

This checkpoint adds owner-operated Linux shell jobs to the existing native-backed
headless runtime. It is separate from the released 0.8.0 binaries and from the
published Blueprint World prototype. The next product priority is a complete
VS Code workbench using the same office backend and renderer.

## Implemented path

SSH/tmux supervisor → authenticated HTTP runtime → explicit host policy and native
scope validation → durable job specification → detached tmux/Node runner → bounded
output and terminal receipt. The same owner operations are available through the
CLI and seven stdio MCP tools. Host control starts off and requires process opt-in
plus explicit grants. Ordinary provider workers remain a separate paused control.

The owner can select a company-wide grant or one eligible employee. Current company,
office, department and shared-service records are rechecked before dispatch. These
selectors are attribution and policy under one owner credential, not independent
employee authentication or hostile-tenant isolation.

## Independent review and repairs

An independent reviewer reproduced three defects and the corresponding repairs
passed regression checks:

- A failed atomic policy write left speculative authority in memory. Persistence
  uncertainty now fences every operation until the controller is reopened and
  durable state is reconciled. Tests fail writes before and after rename, including
  a post-launch write; no execution is repeated.
- Killing the detached supervisor could leave bash alive while releasing capacity.
  Uncertain/interrupted work now reserves capacity and does not report EOF. Managed
  cancellation verifies the original process group before releasing its slot.
- MCP display sanitization changed credential-shaped but valid IDs. Host identifiers
  now round-trip unchanged; human-readable text and command output retain redaction.

## Local checks

The combined Node suite has **100 tests: 97 passed, zero failed, three explicit
real-tmux skips**. The Python Vast diagnostic suite has **26 passing tests**. Ten
additional native Rust → HTTP → actual stdio MCP smoke checks passed. Portable
TypeScript compilation, JavaScript syntax and `git diff --check` passed.

The executor denies `socket(AF_UNIX, SOCK_STREAM)` with `EPERM`. The tmux executable
was independently downloaded from Debian, verified against its published SHA-256,
and responds to `tmux -V`, but those facts do not establish a working tmux session.
Actual detached Node/bash runner lifecycle checks passed separately. GitHub CI sets
`DAFTAR_REQUIRE_TMUX=1`: real tmux startup, daemon/client replacement, cancellation,
unrelated-session preservation and exact-once replay must pass without these skips.
The CI outcome is recorded separately from this local checkpoint.

Meaningful edge coverage includes 32 concurrent same-ID submissions, 256 retained
receipts and prompt stop-all, changed-body conflict, stale revisions, grant
revocation, paused or fired employees, malformed and oversized input, symlinked
state, process-owner locks, output overflow, timeouts, descendant cleanup, invalid
UTF-8 and monotonic byte offsets. These are bounded stress and recovery checks,
not a claim that arbitrary commands are isolated or that every future workload is
free of resource leaks.

## Vast and ChatGPT status

The supplied Vast credential authenticated against the canonical v1 instances
endpoint. The returned account view contained no instances. The user subsequently
confirmed that the instance had been stopped after connecting successfully from
their laptop's VS Code. No instance was started, rented, modified or destroyed by
this implementation run; live GPU, remote installation and model execution remain
unverified here. The existing SSH connection on the user's laptop is separate from
this executor's access.

The read-only `deploy/vast-status.py` command returns only allowlisted metadata,
rejects redirects, bounds responses, and never emits the API key or raw instance
secrets. Its metadata is explicitly not a live `nvidia-smi` report.

The stdio MCP bridge is implemented and locally tested. An account-authorized
ChatGPT MCP/tunnel connection has not been registered in this chat. The SSH and
Secure MCP Tunnel runbooks preserve that distinction.

## Authorship and cost

The host engine, adapters and launcher were implemented by local delegated agents
and reviewed independently. Claude Sonnet supplied the initial Vast status utility
and tests; local review tightened credential-file revalidation, exact endpoint
handling, hostname validation and response errors. The completed request recorded
1,080 input tokens, 6,629 output tokens and **$0.068450** in token-derived accounting.
The existing $20 incremental workstream now accounts for **$0.515332**; its remaining
ceiling is **$19.484668**. No earlier uncertain provider reservation was cleared.

## Operator entry points

- [SSH/tmux setup and auto-control](../deploy/SSH_TMUX_AUTOCONTROL.md)
- [Runtime API](../headless-runtime/README.md)
- [MCP setup](../tools/DAFTAR_RUNTIME_MCP.md)
- [Shared model pool](../deploy/MODEL_POOL.md)
