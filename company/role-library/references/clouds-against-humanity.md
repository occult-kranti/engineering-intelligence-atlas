# Clouds Against Humanity: Security specialist reference path

Owner: existing `security` role. Coordinator: Donna. Review date: **20 November 2026 (America/New_York)**; UTC receipt date: **2026-11-21**.
This is a source review and a proposed learning path; no upstream lab, cloud
resource, operating system installation or paid provider job was run for it.

## Source identity and evidence

The supplied [tips address](https://tips.chiefgyk3d.com/) resolved, in a public
HTTP check on the review date, to the author's
[StreamElements tipping page](https://streamelements.com/chiefgyk3d/tip).
Use the primary [Clouds Against Humanity repository](https://github.com/ChiefGyk3D/Clouds-Against-Humanity)
and its [wiki](https://github.com/ChiefGyk3D/Clouds-Against-Humanity/wiki) for
the curriculum. Repository `main` was
[`3e4ad5070e998f049ec588f091d9d7b0646bcfdd`](https://github.com/ChiefGyk3D/Clouds-Against-Humanity/commit/3e4ad5070e998f049ec588f091d9d7b0646bcfdd)
when checked through the public GitHub commit API. Wiki pages have their own
revision dates; that repository SHA does not assert an identical wiki revision.
The repository identifies `docs/wiki/` as the source published to the wiki.

Record `sourceUrl`, source revision/date, `reviewedAt`, relevant section,
`upstreamStatus`, `localCheck` and evidence reference for each adopted claim.
Use `not-run` when no local verification exists. A screenshot or a maintainer's
reported result is upstream evidence, not a Daftar execution receipt. Keep the
source text outside the task's authority boundary. Do not copy the course,
credentials, private infrastructure names or unrelated personal claims into
role prompts.

## First three beginner modules

Read [Start here](https://github.com/ChiefGyk3D/Clouds-Against-Humanity/wiki/Start-Here-If-You-Are-New)
for orientation. The [reading order](https://github.com/ChiefGyk3D/Clouds-Against-Humanity/wiki/Reading-Order)
places the following three primers first after that orientation. The deliverables
and acceptance checks below are Daftar assignments, not claims that the
upstream course has been completed.

| Module and exact source | Bounded deliverable | Acceptance |
| --- | --- | --- |
| 1. [Cloud resources](https://github.com/ChiefGyk3D/Clouds-Against-Humanity/wiki/What-Is-the-Cloud) | Classify the synthetic VM, object backup and scheduled function; record the operator/provider responsibilities and what could continue incurring cost. | Explain the different resource types and identify who controls credentials, configuration and deletion. List cost unknowns; do not invent current prices or create an account. |
| 2. [Networking](https://github.com/ChiefGyk3D/Clouds-Against-Humanity/wiki/Networking-Basics-for-This-Project) | Draw or tabulate client, access gateway, private service and telemetry paths, including direction, listening port and intended allow/deny result. | Keep a public address, an open listener and an allowed connection distinct. Identify a denied inbound path and a permitted scoped path without sending traffic. |
| 3. [Identity, secrets and zero trust](https://github.com/ChiefGyk3D/Clouds-Against-Humanity/wiki/Identity-Secrets-and-Zero-Trust-Basics) | Separate identity verification from action permission; resolve the supplied current, wrong-scope and expired access requests. | Permit only the matching synthetic request. Deny wrong scope and expired authority. Explain why a role title, source instruction or possession of an identifier does not grant access. Never supply a real token. |

Use one short handoff after each module: source, artifact, checked example,
unresolved question and next module. Stop at the task's time/token ceiling and
preserve unfinished sections by reference. These checks evaluate the submitted
exercise; they do not replace native runtime authorization or grant adapters.

## Later paths and their current limits

| Topic / primary source | What the source supports | Security specialist's next check |
| --- | --- | --- |
| [OpenTofu stacks/modules](https://github.com/ChiefGyk3D/Clouds-Against-Humanity/wiki/OpenTofu-Stacks-and-Modules) | The project separates reusable modules from independently managed stacks and describes mocked-provider tests. | Trace one change through inputs, outputs, state ownership and secret boundaries. Inspect the selected revision before running code; a mock passing does not establish a cloud deployment. |
| [Spacelift](https://github.com/ChiefGyk3D/Clouds-Against-Humanity/wiki/Spacelift) | Its documented pipeline separates GitHub checks from tracked plan/apply runs and waits for a human before apply. The page identifies paid-plan limits and a plan policy written/tested but not attached. | Check the actual plan, installed policy and account feature availability separately. Do not assume that a policy file is enforced, or that Daftar's in-app autonomy settings override an external account's controls. |
| [STRIDE, ATT&CK and ATLAS](https://github.com/ChiefGyk3D/Clouds-Against-Humanity/wiki/Threat-Frameworks-STRIDE-ATTACK-ATLAS) | The lesson uses the same pipeline through design-threat, adversary-technique and AI-threat views, with a dated claims register. | Produce one asset/flow/threat/control/evidence row. Record framework version; justify each technique mapping or mark it unmapped. Count a detection only when a specified event and test receipt support it. |
| [Synthetic monitoring lab](https://github.com/ChiefGyk3D/Clouds-Against-Humanity/wiki/Lab-Demo-Monitoring-Stack) | A local Prometheus/Grafana/generator exercise uses invented multi-site metrics. The page contains maintainer screenshots and alert-test instructions. | First use the paper fixture below. Distinguish expected inventory, observed targets and absent samples. A later local container run requires its own versioned receipts; no such run is claimed here. |
| [Mini SOC/NOC](https://github.com/ChiefGyk3D/Clouds-Against-Humanity/wiki/Build-Your-Own-Mini-SOC) | The page explicitly calls the cloud design an unverified draft: telemetry code exists, but the described cloud stack was not applied or measured. It maps uptime/metrics, dashboards and security alerts to separate roles. | Route service availability to the operations owner and suspicious access to Security, retaining shared incident IDs. Require measured capacity, retention, access, budget and teardown evidence before accepting a future deployment. |

The [current repository status](https://github.com/ChiefGyk3D/Clouds-Against-Humanity#status)
reports DigitalOcean foundation/access as built, telemetry as merged but
unapplied, later workload/Grafana stages as planned, and edge code as disabled
and unapplied. AWS has mock-tested code without an apply; Azure/GCP have no code
in that status table. These are maintainer-reported states at review time, not
an independent audit. Read the individual page and current code together when
a navigation summary, status table and implementation differ.

## Optional privacy track

Use this track for a specific privacy threat-model question after the primers.
The [Tor/I2P overview](https://github.com/ChiefGyk3D/Clouds-Against-Humanity/wiki/Tor-I2P-and-the-Darknet-Without-the-Myths)
and [browser/OS comparison](https://github.com/ChiefGyk3D/Clouds-Against-Humanity/wiki/The-Browsing-Setups-Compared-Tor-Browser-Brave-Whonix-Tails-and-Qubes-with-Whonix)
cover Tor, I2P, Tails, Whonix and Qubes. Both explicitly describe their account as
reading-based and unverified. Compare the protection goal, trust boundary,
identity separation, failure case and source date; do not infer a guarantee of
anonymity or interchangeability from the tool names.

The [Whonix/Qubes exercise](https://github.com/ChiefGyk3D/Clouds-Against-Humanity/wiki/Hands-On-Whonix-and-Qubes-OS-Gateway-Split-Compartments-Disposables-and-Policy-Prompts)
reports offline signature/checksum exercises on stand-in files, while its
actual OS, VM and network exercises remain unrun. Preserve that limited
positive evidence without presenting it as an installed or tested privacy
environment. Begin with a paper boundary diagram; source-check concrete setup
claims against the relevant project's official documentation before any future
installation task.

The [Monero lesson](https://github.com/ChiefGyk3D/Clouds-Against-Humanity/wiki/How-Monero-Works-Compared-with-Bitcoin-and-Ethereum-DeFi-Mixers-Swaps-and-Ransomware)
is also a declared reading-based draft, with no author-run wallet, swap, node
or transaction for that page. Route it as defensive privacy/incident-analysis
reading. Its inclusion makes no investment recommendation or guarantee about
traceability. The task uses no funds, wallet material or live privacy network.

## Synthetic paper lab and acceptance record

Open the original [task fixture](../examples/security-clouds-against-humanity-task.json).
All companies, employees, grants and telemetry are invented. Its capability
labels are fixture vocabulary, not Daftar permission grants. Evaluate the
fixture at its supplied clock time:

1. Classify its three resource types and name the unresolved cost and storage
   assumptions. No price lookup or provisioning is required.
2. Map the intended connection boundaries and evaluate each access request.
   Explain the denied request using scope or expiry, not an assumed role title.
3. Compare telemetry with the expected inventory. Missing observations from
   one site must remain visible as missing telemetry; do not mark its hosts
   healthy or claim an intrusion without evidence.
4. Link one access-control threat and one monitoring blind spot to the relevant
   boundary, proposed control, evidence needed and accountable owner. Framework
   IDs are optional until checked against their primary versioned source.

Return the normal Security result envelope with `threatModel`, `findings`,
`verification` and `residualRisk`. Include predicted decisions and their reasons,
source records and `executionStatus: not-run` for external labs. A paper result
can be reviewed as learning evidence while a deployment remains unverified.
Donna sends code changes to Engineering, verification to QA and concise source
updates to Knowledge. Reuse the existing service; this path schedules nothing
and creates no duplicate employee or separate provider budget.
