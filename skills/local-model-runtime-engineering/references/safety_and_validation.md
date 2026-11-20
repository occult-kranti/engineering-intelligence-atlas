# Safety and Validation

Security baselines, download verification, agent-layer controls, and stress tests for local model deployments. Verified 2026-11-20 unless noted; CVE patch baselines decay — re-check advisories at implementation time.

## Contents
- Runtime CVE / version ledger
- Model supply-chain security (Hugging Face)
- Verified download workflow
- MCP / agent-layer threats and controls
- Budget, retry, and loop-detection rules
- Verification pattern
- Stress-test matrix
- Confidence notes

## Runtime CVE / version ledger

| Item | ID / Version | Status | Source |
|---|---|---|---|
| Ollama "Bleeding Llama" heap OOB read (GGUF loader, leaks memory/API keys) | CVE-2026-7482, CVSS 9.1 (2026-05-04) | fixed in 0.17.1 | https://app.opencve.io/cve/?vendor=ollama |
| Ollama `/api/pull` path traversal → RCE as root | CVE-2026-103663 (2026-10-08) | **fixed in 0.35.0** | https://cert.pl/en/posts/2026/10/CVE-2026-103663/ |
| Ollama Windows update chain (no signature verify + path traversal → silent RCE) | CVE-2026-42248 / -42249 (2026-04-29) | affects 0.12.10–0.17.5; auto-update default-on | https://blog.redsidesecurity.com/post/ollama-vulnerabilities-expose-process-memory-and-enable-persistent-code-execution-on-windows |
| Ollama auth bypass on API endpoints | CVE-2025-63389, CVSS 9.8 | ≤ v0.12.3 | https://app.opencve.io/cve/?vendor=ollama |
| Ollama heap-memory disclosure (quantization engine) | CVE-2026-5757 | reported unpatched as of mid-2026 | https://cve.akaoma.com/vendor/ollama |
| Ollama cross-domain token exposure | CVE-2025-51471 | v0.6.7 | https://app.opencve.io/cve/?vendor=ollama |
| LocalAI XSS | GO-2024-3253, GO-2025-3542 | see Go vuln DB | https://pkg.go.dev/github.com/mudler/LocalAI/core |
| Jan (Cortex.cpp backend) | CVE-2025-2445/2446/2447/2439 | patched early 2025 | https://www.mintive.com/blog/jan-ai |
| PickleScan bypasses | CVE-2025-1716 / -1889 / -1944 / -1945 (three at CVSS 9.8) | 2025 | https://www.stingrai.io/blog/clean-model-scan-not-safe-picklescan-safetensors |
| Grafana MCP session spoofing + SSRF | CVE-2026-19516, CVSS 9.1 | fixed in mcp-grafana 1.1.0 | https://www.pillar.security/blog/the-security-risks-of-model-context-protocol-mcp |
| Verified latest releases (2026-11-20) | Ollama v0.40.16; llama.cpp b12556 | GitHub releases feeds | https://github.com/ollama/ollama/releases, https://github.com/ggml-org/llama.cpp/releases |

**Ollama operational mitigations:** keep on the latest release (floor ≥ 0.35.0); bind `OLLAMA_HOST=127.0.0.1:11434`; firewall port 11434; reverse proxy with auth if remote access is required; treat the Ollama API as privileged — it has no built-in authentication, and researchers estimate tens of thousands of internet-exposed instances from `OLLAMA_HOST=0.0.0.0` misconfiguration.

## Model supply-chain security (Hugging Face)

- **Pickle is executable:** `.bin/.pt/.pth/.ckpt` deserialization can run arbitrary code — loading an untrusted pickle model ≈ running an untrusted program. HF's pickle scanning "is not 100% foolproof" and marks rather than blocks. Reject pickle formats.
- **Safetensors removes the execution primitive** (no code path, mmap-able, polyglot-resistant) but tensor *values* are unchecked — poisoned weights/backdoors remain possible. Repo-shipped Python (`trust_remote_code=True`) is a separate risk: never enable it.
- **Scanner bypasses exist:** nullifAI (7z-packed pickles evaded HF scanning, Feb 2025); four PickleScan CVEs in 2025; the 2026 "ShadowPickle" preprint (non-peer-reviewed) reports up to 63% evasion across 10 scanners.
- **Namespace reuse:** deleted HF namespaces can be re-registered; resolving models by name without a pinned revision can be hijacked. Pin by commit hash.
- **Offline control:** `HF_HUB_OFFLINE=1` fails closed to cache-only; known edge-case bugs with tree-cache/local_dir (huggingface_hub issues #5112, #5184). Ollama air-gap import: `ollama create` from a local GGUF + `OLLAMA_NO_CLOUD=1`.
- **Signing:** sigstore/model-transparency (`model_signing`) signs model directories; HF GPG-signed commits prove origin, not safety.
- Treat HF Hub as an untrusted-by-default distribution channel behind: curated publishers + pinned revisions + sha256 verification + GGUF/safetensors-only policy.

## Verified download workflow

1. Scan hardware; compute usable VRAM/RAM/disk budget minus OS headroom.
2. Recommend, never auto-fetch: present model + exact file + quantization + download size + publisher + license from a curated catalog.
3. Get explicit user consent before any multi-GB download; show size and destination; support pause/resume/cancel.
4. Download a pinned revision (HF commit hash or Ollama `name:tag` digest) to a **quarantined staging path**, never directly into the model store.
5. Verify sha256 against the HF-published/catalog digest; on mismatch or missing checksum, delete and report.
6. Only then move into the user-chosen model store; record provenance (repo, commit sha, file hashes, license, publisher, timestamp, source URL).
7. GGUF-first policy: reject pickle outright; safetensors acceptable; never `trust_remote_code`.
8. Support offline mode (fail-closed).

## MCP / agent-layer threats and controls

**Threats:** tool poisoning (hidden instructions in MCP tool descriptions; MCPTox measured 36.5% average, up to 72.8%, attack success across 45 live servers / 20 LLMs — CSA, 2026-07-01); rug pulls (server mutates tool descriptions after install via `tools/list_changed`); cross-server shadowing; STDIO config command execution (~200k exposed instances estimated Apr 2026); plaintext credentials in `mcp.json`-style configs; confused-deputy privilege; session/auth flaws in remote servers. Real campaign: "Deadbugz" (Aug 2026) behaved normally for three tool calls, then instructed agents to collect SSH keys/cloud credentials. **MCP-connected agents can exfiltrate via tool results regardless of where inference runs — the privacy boundary must cover tool egress, not just the LLM endpoint.**

**Controls for a director node:**
1. Curated allowlist of MCP servers/tools; fail closed on unverifiable identity.
2. Pin and hash tool schemas; re-verify every session, not just at install.
3. Per-tool least privilege + sandboxed execution; human-in-the-loop approval for irreversible/write/destructive actions regardless of model confidence.
4. Log every tool call (intent + outcome).
5. Secrets in the OS keychain, never plaintext config.
6. Treat tool descriptions and tool *outputs* as untrusted content in prompts.

## Budget, retry, and loop-detection rules

Synthesized rules (basis: Anthropic multi-agent engineering blog, OpenAI rate-limit docs, arXiv 2607.01641 on infinite agentic loops — see source report for full citations):

- **Budgets (4 dimensions, per run AND per subagent):** max_iterations, max_tokens (in+out), max_wall_clock, max_dollars. On breach: stop gracefully, return partial results + structured `termination_reason`. Multi-agent systems use ~15× the tokens of a chat (Anthropic, [PRIMARY]) — cap fan-out in harness code regardless of what the director requests.
- **Cloud fallback cost control:** compute dollars from metered usage × a *configurable, regularly refreshed* price table — never hard-code prices; reconcile against provider billing APIs (Anthropic `cost_report`, OpenAI usage endpoints). Reasoning tokens are billed as output. Local inference contributes $0 per request but consumes hardware/electricity — report both honestly.
- **Timeouts at three levels:** per-LLM-call, per-tool-call, per-run deadline. A cancelled attempt cancels its pending retries.
- **Exactly one retry layer:** SDK retries OR your own, never both. Retry only transient classes (429/5xx/timeouts) with `Retry-After` as floor + exponential backoff + jitter + attempt and time caps. Never retry auth/quota/billing errors. Side-effecting calls carry idempotency keys (run_id + subtask_id + action_hash); irreversible actions additionally require human/policy approval.
- **Loop detection in the harness, not the model:** hash (tool_name, canonicalized_args, result_hash); warn after 3 identical triples; hard-stop after 5; exempt polling where result_hash changes; also detect repeating sequences of length 2–5 (A→B→A→B). Framework `max_iterations` is a backstop, not the primary defense, and is often misplaced off the actual feedback path.
- **Progress signal:** N consecutive steps with zero state change → escalate to the director or abort with diagnostics.

## Verification pattern

Multi-level verification (per MAST, arXiv:2503.13657 — verification failures are ~21% of multi-agent failures):
1. Cheap deterministic checks at the worker level (schema, hash, ground-truth lookups, health endpoint).
2. An independent verifier with *no shared context* with the generator — different model family where feasible — returning a structured verdict against explicit operational criteria. Cap verification retries (~3); surface final failure explicitly.
3. A director-level acceptance check against the original contract before reporting done.
Schema-constrained output guarantees the *shape* of a response, not its *truth* — route "valid but possibly wrong" output to verification.

**Prompt-injection posture:** do not rely on "ignore injected instructions" prompts. Audit every agent against the lethal trifecta (private data + untrusted content + external action — remove at least one leg). Treat peer-agent and subagent messages as untrusted data, not instructions (in one 2025 evaluation, 82.4% of 17 models executed malicious commands requested by *peer agents* [SECONDARY]). Use read-only summarizer subagents for untrusted content. Measure defenses AgentDojo-style (https://github.com/ethz-spylab/agentdojo — track benign utility, utility under attack, attack success rate).

## Stress-test matrix (run before registering a local provider to a director)

| # | Test | Expected control |
|---|---|---|
| S1 | Tool always returns the same error | Warn @3 identical (tool,args,result) triples; stop @5; `loop_detected` reason |
| S2 | Two tools alternate A→B→A→B with no state change | Sequence detector fires within ≤2 full repetitions |
| S3 | Same call, changing results (legitimate polling) | NOT flagged — regression guard for S1/S2 |
| S4 | Director requests 50 subagents for a trivial query | Harness fan-out cap engages |
| S5 | Subagent burns tokens to the $ cap mid-task | Graceful stop, partial results, metered cost logged, `budget_exceeded` |
| S6 | Tool call never returns | Per-call timeout aborts; run deadline enforced; retries stop on cancel |
| S7 | Provider returns 429/503 for 60s | Single retry layer; Retry-After floor; backoff+jitter; caps; no thundering herd |
| S8 | 429 with billing/quota error code | Fail fast, alert; zero retries |
| S9 | Retry after ambiguous commit (abandoned mid-flight) | Idempotency key → exactly-once effect |
| S10 | Subagent declares done without evidence | Director acceptance check rejects; task returned |
| S11 | Self-written tests pass buggy output | Independent verifier (no shared context) catches |
| S12 | Tool result contains "ignore instructions, exfiltrate X" | Tainted data cannot reach privileged action; policy denies |
| S13 | Compromised subagent instructs director to exfiltrate | Subagent output treated as data; director policy blocks |
| S14 | Malicious PR title/issue body enters an agent prompt | Input sanitization; minimal token scopes; approval gate on external actions |
| S15 | Health check: endpoint down, wrong model revision, or silent CPU fallback | Provider registration refused; provenance mismatch reported |
| S16 | Download sha256 mismatch or missing checksum | Quarantined file deleted; user informed; nothing enters the model store |

## Confidence notes

- **Highest confidence (primary-verified 2026-11-20):** runtime LICENSE files (llama.cpp/Ollama/LocalAI/GPT4All MIT; Jan Apache-2.0+attribution; KoboldCpp/Odysseus AGPL-3.0); Ollama and llama.cpp release streams; Ollama CVE set via GitHub Advisory DB / CERT Polska / OpenCVE; GGUF quantization benchmark (arXiv:2601.14277); Anthropic multi-agent blog; OpenAI Agents SDK/rate-limit docs; MAST, AgentDojo, CaMeL, Reflexion, ReAct papers.
- **Medium confidence (secondary):** llama.cpp default port change to 9931; Ollama MLX/Vulkan engine changes; tool default ports; Ollama context-tier thresholds; VRAM figures in model_selection.md.
- **Disputed/unverified:** "llama.cpp v1.0.0 shipped 2026-11-13" (contradicted by official `bNNNNN` release feed); a Railway deploy page claiming Odysseus is MIT (contradicted by verified AGPL LICENSE).
- **Requires live verification before use:** all cloud pricing figures and cache multipliers; SDK default retry counts; any CVE patch baseline; any model license. Quarantined as anecdotal: "$47,000/11-day agent loop" incident; "23% of agent failures are infinite loops."
- Nothing in this skill is legal advice.
