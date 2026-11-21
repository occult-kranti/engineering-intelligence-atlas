import type { Role } from './types';

export const ROLES: Role[] = [
  {
    "function": "Leadership & governance",
    "name": "Chief Technology Officer / VP Engineering",
    "mission": "Align technical strategy, organization, investment, and risk with company outcomes",
    "outputs": "Technology strategy; org design; budget/investment; succession; executive risk decisions",
    "skills": "Org design; business acumen; technical judgment; governance; communication",
    "senior": "Sets multi-year strategy and builds leaders across domains",
    "interfaces": "CEO; product; security; finance; people; legal",
    "source": "https://sfia-online.org/en/sfia-9"
  },
  {
    "function": "Leadership & governance",
    "name": "Director of Engineering",
    "mission": "Build a multi-team engineering area with predictable outcomes and durable capability",
    "outputs": "Area roadmap; org/capacity design; delivery and operational health; leadership bench",
    "skills": "Multi-team leadership; planning; technical literacy; cross-functional negotiation",
    "senior": "Shapes several teams and develops managers/staff ICs",
    "interfaces": "VP; EMs; product/design directors; TPM; security",
    "source": "https://sfia-online.org/en/sfia-9"
  },
  {
    "function": "Leadership & governance",
    "name": "Engineering Manager",
    "mission": "Create a healthy team that delivers and operates valuable software",
    "outputs": "Capacity/roadmap; hiring; performance/growth; delivery system; incident/process ownership",
    "skills": "People leadership; technical decision brokerage; planning; feedback; risk management",
    "senior": "Improves team system and develops senior owners rather than personally making every decision",
    "interfaces": "PM; tech lead; designer; QA; SRE; security",
    "source": "https://sfia-online.org/en/sfia-9"
  },
  {
    "function": "Architecture & technical leadership",
    "name": "Staff / Principal Engineer",
    "mission": "Provide multi-team technical direction and leverage without relying on line authority",
    "outputs": "ADRs/RFCs; reference implementations; migration strategy; design review; mentoring",
    "skills": "Systems design; domain depth; writing; influence; risk and tradeoff analysis",
    "senior": "Staff aligns teams; principal shapes company/domain technical bets",
    "interfaces": "EM; architects; product; platform; security; SRE",
    "source": "https://dropbox.github.io/dbx-career-framework/"
  },
  {
    "function": "Architecture & technical leadership",
    "name": "Software / Solutions Architect",
    "mission": "Translate needs and constraints into evolvable system and integration decisions",
    "outputs": "Reference architecture; NFRs; ADRs; integration contracts; migration/fitness review",
    "skills": "Domain modeling; distributed systems; security; data; cost; communication",
    "senior": "Guides architecture across domains and governs by evidence rather than approval theater",
    "interfaces": "Product; engineering; platform; security; data; SRE",
    "source": "https://sfia-online.org/en/sfia-9"
  },
  {
    "function": "Product & program",
    "name": "Product Manager",
    "mission": "Own problem selection, customer value, viability, and outcome priorities",
    "outputs": "Problem narrative/PRD; prioritization; outcome metrics; discovery plan; launch tradeoffs",
    "skills": "Customer/domain knowledge; business judgment; analytics; prioritization; writing",
    "senior": "Handles portfolio ambiguity and aligns multiple value streams",
    "interfaces": "Design; tech lead; EM; data; research; go-to-market",
    "source": "https://sfia-online.org/en/sfia-9"
  },
  {
    "function": "Product & program",
    "name": "Technical Program Manager",
    "mission": "Drive complex cross-team programs and dependencies to completion",
    "outputs": "Dependency/risk register; integrated plan; decision log; launch coordination",
    "skills": "Systems thinking; dependency management; communication; technical fluency",
    "senior": "Resolves multi-org dependencies and establishes program governance",
    "interfaces": "PM; EM; architects; QA; release; security",
    "source": "https://sfia-online.org/en/sfia-9"
  },
  {
    "function": "Product & program",
    "name": "Release / Delivery Manager",
    "mission": "Coordinate safe releases where multiple systems or regulatory gates must align",
    "outputs": "Release plan; readiness evidence; rollback; change record; communications",
    "skills": "Progressive delivery; risk; incident coordination; CI/CD literacy",
    "senior": "Designs organization-level release and deprecation coordination",
    "interfaces": "Engineering; QA; SRE; security; support; product",
    "source": "https://sfia-online.org/en/sfia-9"
  },
  {
    "function": "Software engineering",
    "name": "Backend Engineer",
    "mission": "Build and operate services, APIs, workflows, and persistence",
    "outputs": "Service code; API contracts; tests; dashboards/SLOs; runbooks; migration plans",
    "skills": "One language deeply; data modeling; concurrency; APIs; testing; distributed-system failure handling",
    "senior": "Leads multi-service architecture, reliability, and migration tradeoffs",
    "interfaces": "Frontend; data; platform; SRE; security; product",
    "source": "https://www.amazon.jobs/en/search"
  },
  {
    "function": "Software engineering",
    "name": "Frontend Engineer",
    "mission": "Build and operate accessible, performant browser experiences",
    "outputs": "Semantic UI; components; tests; performance budgets; telemetry; accessibility evidence",
    "skills": "HTML/CSS/JavaScript/TypeScript; framework literacy; state/data; accessibility; testing",
    "senior": "Sets web architecture, design-system, performance, and accessibility direction",
    "interfaces": "Design; backend; QA; accessibility; product",
    "source": "https://www.w3.org/WAI/planning/arrm/"
  },
  {
    "function": "Software engineering",
    "name": "Full-stack Engineer",
    "mission": "Deliver end-to-end product features spanning client, server, and data",
    "outputs": "Full features; API/UI contracts; tests; telemetry; deployment and documentation",
    "skills": "Web/UI; backend; SQL; auth; testing; deployment; debugging across layers",
    "senior": "Leads product-slice architecture and knows when specialist depth is needed",
    "interfaces": "Design; product; platform; data; security; QA",
    "source": "https://www.amazon.jobs/en/search"
  },
  {
    "function": "Software engineering",
    "name": "Mobile Engineer",
    "mission": "Ship reliable iOS/Android experiences under platform and store constraints",
    "outputs": "Mobile features; offline/sync; tests; crash/performance telemetry; staged release",
    "skills": "Kotlin/Swift or cross-platform; lifecycle; networking; accessibility; release engineering",
    "senior": "Owns mobile architecture, performance, release, and cross-platform strategy",
    "interfaces": "Design; backend; QA; release; security; support",
    "source": "https://sfia-online.org/en/sfia-9"
  },
  {
    "function": "Software engineering",
    "name": "API / Integration Engineer",
    "mission": "Design durable contracts between products, services, and partners",
    "outputs": "OpenAPI/AsyncAPI schemas; versioning; auth; contract tests; deprecation policy",
    "skills": "HTTP/REST; events; auth; schema validation; compatibility; documentation",
    "senior": "Sets contract governance and ecosystem integration strategy",
    "interfaces": "Backend; frontend; partners; security; docs; data",
    "source": "https://spec.openapis.org/oas/latest.html"
  },
  {
    "function": "Quality engineering",
    "name": "QA Analyst / Quality Engineer",
    "mission": "Use risk-based evaluation to expose product and system quality risks",
    "outputs": "Test strategy; exploratory findings; acceptance evidence; defect analysis; release-risk input",
    "skills": "Test design; domain learning; risk analysis; communication; automation literacy",
    "senior": "Shapes org quality strategy and high-risk evaluation",
    "interfaces": "Engineering; product; design; SRE; security; support",
    "source": "https://sfia-online.org/en/sfia-9"
  },
  {
    "function": "Quality engineering",
    "name": "SDET / Software Engineer in Test",
    "mission": "Engineer test infrastructure and automation that improve delivery confidence",
    "outputs": "Test architecture; CI suites; fixtures/data; contract/E2E tests; flaky-test reduction",
    "skills": "Programming; test design; CI/CD; API/UI automation; observability",
    "senior": "Owns test platforms and cross-team quality mechanisms",
    "interfaces": "Engineering; QA; platform; release; SRE",
    "source": "https://abseil.io/resources/swe-book"
  },
  {
    "function": "Quality engineering",
    "name": "Performance Engineer",
    "mission": "Find and prevent latency, throughput, resource, and scalability failures",
    "outputs": "Performance model/budgets; profiles; load tests; capacity recommendations; regression gates",
    "skills": "Profiling; networking; runtimes; databases; statistics; field/lab measurement",
    "senior": "Leads cross-system performance and capacity strategy",
    "interfaces": "Backend; frontend; SRE; data; platform; product",
    "source": "https://web.dev/articles/vitals"
  },
  {
    "function": "Support & knowledge",
    "name": "Support Engineer",
    "mission": "Resolve complex customer technical issues and feed reproducible signals into engineering",
    "outputs": "Reproductions; escalations; KB articles; defect trends; customer communication",
    "skills": "Debugging; logs/traces; product/domain knowledge; communication; scripting",
    "senior": "Builds diagnostic tooling and systemic product improvements",
    "interfaces": "Engineering; product; docs; SRE; customer success",
    "source": "https://sfia-online.org/en/sfia-9"
  },
  {
    "function": "Support & knowledge",
    "name": "Technical Writer / Documentation Engineer",
    "mission": "Make products and platforms learnable, discoverable, accurate, and maintainable",
    "outputs": "Tutorials; how-tos; reference; API docs; runbooks; docs-as-code pipeline",
    "skills": "Information architecture; audience analysis; technical learning; editing; versioning",
    "senior": "Owns knowledge architecture and cross-product content governance",
    "interfaces": "Engineering; product; design; support; accessibility",
    "source": "https://diataxis.fr/"
  },
  {
    "function": "AI & research",
    "name": "Research Scientist",
    "mission": "Advance knowledge through rigorous, reproducible research and communicate evidence",
    "outputs": "Hypotheses; experiments; papers/technical reports; artifacts; research roadmap",
    "skills": "Scientific method; math/statistics; domain depth; experimentation; writing; research ethics",
    "senior": "Sets research directions and mentors across ambitious uncertain programs",
    "interfaces": "Research engineering; product; data; security; policy",
    "source": "https://www.nist.gov/itl/ai-risk-management-framework"
  },
  {
    "function": "AI & research",
    "name": "Research Engineer",
    "mission": "Engineer scalable, reproducible systems for research and transition findings into use",
    "outputs": "Research code; benchmarks; data/training pipelines; prototypes; reproducible artifacts",
    "skills": "Software engineering; ML systems; distributed compute; evaluation; experiment discipline",
    "senior": "Leads large research infrastructure and research-to-production architecture",
    "interfaces": "Research scientists; ML/platform; data; product",
    "source": "https://www.nist.gov/itl/ai-risk-management-framework"
  },
  {
    "function": "AI & research",
    "name": "Applied Scientist",
    "mission": "Adapt or invent models to solve measured product/business problems",
    "outputs": "Problem formulation; model prototypes; offline/online evaluation; production collaboration",
    "skills": "ML theory; statistics; programming; experimentation; domain and product judgment",
    "senior": "Owns ambiguous modeling portfolios and cross-functional technical direction",
    "interfaces": "Product; MLE; data; research; design",
    "source": "https://www.amazon.jobs/en/search"
  },
  {
    "function": "AI & ML engineering",
    "name": "Machine Learning Engineer",
    "mission": "Productionize model training, inference, evaluation, and monitoring",
    "outputs": "Model pipelines/services; evaluation; deployment; monitoring; retraining runbooks",
    "skills": "Python; ML/DL frameworks; software engineering; data; deployment; monitoring",
    "senior": "Leads production ML architecture, quality, cost, and reliability",
    "interfaces": "Applied science; data; MLOps; backend; product",
    "source": "https://www.nist.gov/itl/ai-risk-management-framework"
  },
  {
    "function": "AI & ML engineering",
    "name": "AI / LLM Application Engineer",
    "mission": "Build useful products on probabilistic foundation-model capabilities",
    "outputs": "LLM features; tool integrations; RAG; structured outputs; eval suites; fallback/UX",
    "skills": "Software engineering; prompting/context; retrieval; agents; evaluation; security; observability",
    "senior": "Owns AI system architecture, evaluation strategy, autonomy boundaries, and cost/latency",
    "interfaces": "Product; design; security; data; platform; research",
    "source": "https://www.nist.gov/itl/ai-risk-management-framework"
  },
  {
    "function": "AI & ML engineering",
    "name": "AI Evaluation / Safety Engineer",
    "mission": "Measure model/system behavior and reduce material deployment risks",
    "outputs": "Eval harnesses; task sets; adversarial tests; failure analysis; release evidence",
    "skills": "Statistics; evaluation design; model behavior; red-team methods; data quality; reporting",
    "senior": "Sets evaluation strategy and launch-risk governance across AI systems",
    "interfaces": "Research; MLE; security; policy; product; SRE",
    "source": "https://www.nist.gov/itl/ai-risk-management-framework"
  },
  {
    "function": "Data & analytics",
    "name": "Data Scientist",
    "mission": "Improve decisions through statistical analysis, modeling, and experiments",
    "outputs": "Analyses; experiment designs/readouts; models; decision narratives; reusable datasets",
    "skills": "SQL; statistics; causal inference; Python/R; visualization; communication",
    "senior": "Leads ambiguous decision problems and measurement strategy",
    "interfaces": "Product; research; data engineering; design; leadership",
    "source": "https://sfia-online.org/en/sfia-9"
  },
  {
    "function": "Data & analytics",
    "name": "Data Engineer",
    "mission": "Deliver reliable, governed, documented data products and pipelines",
    "outputs": "Batch/stream pipelines; schemas; quality SLAs; lineage; access controls; runbooks",
    "skills": "SQL; programming; modeling; orchestration; distributed data; privacy; operations",
    "senior": "Owns data-platform architecture and cross-domain data contracts",
    "interfaces": "Analytics; ML; backend; security; product",
    "source": "https://sfia-online.org/en/sfia-9"
  },
  {
    "function": "Data & analytics",
    "name": "Analytics Engineer",
    "mission": "Transform raw data into tested, semantic, decision-ready datasets",
    "outputs": "Versioned transformations; metrics/semantic layer; tests; documentation; dashboards",
    "skills": "SQL; dimensional modeling; dbt-style workflows; metrics governance; communication",
    "senior": "Owns metric semantics and analytics engineering standards",
    "interfaces": "Data science; BI; product; data engineering",
    "source": "https://sfia-online.org/en/sfia-9"
  },
  {
    "function": "AI & data platform",
    "name": "MLOps / ML Platform Engineer",
    "mission": "Provide self-service infrastructure for model development, deployment, and operation",
    "outputs": "Model CI/CD; registry; serving; feature/eval infrastructure; GPU/platform automation",
    "skills": "Kubernetes/cloud; IaC; ML lifecycle; observability; security; developer experience",
    "senior": "Owns ML platform product strategy and multi-team reliability/cost",
    "interfaces": "MLE; research; platform; SRE; security; data",
    "source": "https://www.nist.gov/itl/ai-risk-management-framework"
  },
  {
    "function": "Responsible technology",
    "name": "Responsible AI / AI Governance Engineer",
    "mission": "Translate AI policy and risk into technical controls, evidence, and operating practice",
    "outputs": "AI inventory; risk assessments; control libraries; review evidence; incident/decommission workflow",
    "skills": "AI lifecycle; policy; evaluation; privacy/security; documentation; stakeholder facilitation",
    "senior": "Shapes enterprise AI governance and assures independence of challenge",
    "interfaces": "AI teams; legal; privacy; security; product; audit",
    "source": "https://www.nist.gov/itl/ai-risk-management-framework"
  },
  {
    "function": "Platform & infrastructure",
    "name": "Platform Engineer",
    "mission": "Build internal self-service products that reduce delivery cognitive load",
    "outputs": "Golden paths; templates; IaC modules; IDP capabilities; docs; service SLOs",
    "skills": "Cloud/Kubernetes; APIs; IaC; product management; developer experience; operations",
    "senior": "Owns platform product strategy and organization-wide adoption/evolution",
    "interfaces": "Stream teams; DevEx; security; SRE; product",
    "source": "https://sfia-online.org/en/sfia-9"
  },
  {
    "function": "Platform & infrastructure",
    "name": "Cloud / Infrastructure Engineer",
    "mission": "Engineer secure, cost-aware compute, network, storage, and environment foundations",
    "outputs": "Cloud architecture; IaC; network/identity baselines; capacity/cost controls; recovery",
    "skills": "Cloud; networking; OS; automation; IAM; security; cost and capacity",
    "senior": "Sets multi-region/org infrastructure and resilience strategy",
    "interfaces": "Platform; security; SRE; backend; finance",
    "source": "https://sfia-online.org/en/sfia-9"
  },
  {
    "function": "Platform & infrastructure",
    "name": "DevOps / CI-CD Engineer",
    "mission": "Automate and improve the path from change to verified production release",
    "outputs": "Pipelines; artifact/provenance; deployment automation; rollback; pipeline observability",
    "skills": "CI/CD; scripting; containers; testing; supply-chain security; release strategy",
    "senior": "Owns delivery-platform architecture and organization-wide flow improvements",
    "interfaces": "Engineering; platform; security; QA; SRE",
    "source": "https://csrc.nist.gov/Projects/ssdf"
  },
  {
    "function": "Reliability",
    "name": "Site Reliability Engineer",
    "mission": "Apply engineering to reliability, SLOs, incident learning, and toil reduction",
    "outputs": "SLO/error-budget policy; automation; on-call design; postmortems; capacity/resilience work",
    "skills": "Systems; observability; incident command; distributed failure; automation; negotiation",
    "senior": "Leads reliability programs and high-risk cross-service recovery",
    "interfaces": "Stream teams; product; platform; security; support",
    "source": "https://sre.google/workbook/table-of-contents/"
  },
  {
    "function": "Platform & infrastructure",
    "name": "Network / Systems Engineer",
    "mission": "Build and operate dependable network and operating-system foundations",
    "outputs": "Network/system designs; DNS/LB/connectivity; automation; monitoring; recovery evidence",
    "skills": "TCP/IP; DNS; TLS; Linux; routing; load balancing; troubleshooting; security",
    "senior": "Leads complex network/system architecture and failure-domain design",
    "interfaces": "Cloud; SRE; security; platform; backend",
    "source": "https://sfia-online.org/en/sfia-9"
  },
  {
    "function": "Data infrastructure",
    "name": "Database Engineer / DBA",
    "mission": "Protect data availability, integrity, performance, backup, and recovery",
    "outputs": "Schema/migration review; tuning; backup/restore tests; replication; capacity/runbooks",
    "skills": "Transactions; indexing; storage; SQL; replication; recovery; observability",
    "senior": "Owns database architecture and organization-wide data resilience",
    "interfaces": "Backend; data; SRE; security; platform",
    "source": "https://sfia-online.org/en/sfia-9"
  },
  {
    "function": "Developer experience",
    "name": "Developer Experience Engineer",
    "mission": "Improve feedback loops, cognitive load, and flow across engineering work",
    "outputs": "Build/test acceleration; local/dev environments; DevEx research; workflow metrics; tooling",
    "skills": "Developer research; build systems; platform; UX; measurement; communication",
    "senior": "Sets organization-wide developer experience and productivity strategy",
    "interfaces": "Platform; engineering; QA; docs; security",
    "source": "https://sfia-online.org/en/sfia-9"
  },
  {
    "function": "Security leadership",
    "name": "CISO / Security Director",
    "mission": "Govern security risk, independence, strategy, and organizational capability",
    "outputs": "Risk appetite; security strategy; policy; investment; board/executive reporting; assurance",
    "skills": "Security governance; engineering literacy; risk; incident leadership; communication",
    "senior": "Owns enterprise security strategy and independent challenge",
    "interfaces": "CTO; legal; privacy; audit; product; engineering",
    "source": "https://niccs.cisa.gov/tools/nice-framework"
  },
  {
    "function": "Security engineering",
    "name": "Security Architect",
    "mission": "Design secure system boundaries and reusable security patterns",
    "outputs": "Threat architecture; control patterns; security ADRs; assurance review; exceptions",
    "skills": "Security architecture; cloud/application/data; IAM; cryptography; tradeoff writing",
    "senior": "Sets cross-org security architecture and high-risk exception direction",
    "interfaces": "Engineering; CISO; AppSec; cloud; privacy; SRE",
    "source": "https://niccs.cisa.gov/tools/nice-framework"
  },
  {
    "function": "Security engineering",
    "name": "Application / Product Security Engineer",
    "mission": "Integrate threat modeling, secure design, verification, and remediation into products",
    "outputs": "Threat models; code/design review; ASVS tests; vulnerability triage; developer guidance",
    "skills": "Secure coding; web/mobile; OWASP; SAST/DAST/SCA; APIs; communication",
    "senior": "Leads product security strategy and high-risk design partnerships",
    "interfaces": "Product; engineering; QA; platform; privacy",
    "source": "https://owasp.org/www-project-application-security-verification-standard/"
  },
  {
    "function": "Security engineering",
    "name": "Cloud Security Engineer",
    "mission": "Create secure-by-default cloud identities, configurations, guardrails, and detection",
    "outputs": "Cloud baselines; IAM policy; IaC controls; posture metrics; incident support",
    "skills": "AWS/Azure/GCP; IAM; networking; IaC; cloud telemetry; scripting",
    "senior": "Owns organization-wide cloud security patterns and exception risk",
    "interfaces": "Cloud; IAM; AppSec; SOC; platform; compliance",
    "source": "https://niccs.cisa.gov/tools/nice-framework"
  },
  {
    "function": "Security engineering",
    "name": "IAM / Identity Engineer",
    "mission": "Engineer authentication, authorization, identity lifecycle, and least privilege",
    "outputs": "Identity architecture; SSO/OIDC/OAuth; RBAC/ABAC; secrets/workload identity; audits",
    "skills": "IAM protocols; directories; PKI; policy; automation; access-risk analysis",
    "senior": "Sets identity architecture and high-assurance access strategy",
    "interfaces": "Security; IT; cloud; application; privacy; support",
    "source": "https://niccs.cisa.gov/tools/nice-framework"
  },
  {
    "function": "Security engineering",
    "name": "Security Software Engineer",
    "mission": "Build production software for security services and controls",
    "outputs": "Security services/libraries; detection/control APIs; tests; SLOs; documentation",
    "skills": "Software engineering; distributed systems; security domain; data; operations",
    "senior": "Leads high-assurance security platforms and cross-team adoption",
    "interfaces": "AppSec; IAM; detection; platform; SRE",
    "source": "https://niccs.cisa.gov/tools/nice-framework"
  },
  {
    "function": "Security operations",
    "name": "Detection Engineer",
    "mission": "Convert threat knowledge and telemetry into tested, maintainable detections",
    "outputs": "Detection-as-code; test cases; coverage map; tuning; response handoff",
    "skills": "Logs/query languages; attacker behavior; scripting; CI; false-positive analysis",
    "senior": "Owns detection strategy, coverage, and measurement across environments",
    "interfaces": "SOC; threat intel; IR; cloud; data; engineering",
    "source": "https://niccs.cisa.gov/tools/nice-framework"
  },
  {
    "function": "Security operations",
    "name": "SOC / Security Analyst",
    "mission": "Monitor, triage, investigate, and escalate security signals within defined scope",
    "outputs": "Case records; triage; investigation timeline; escalation; shift/handoff notes",
    "skills": "Security telemetry; networking; OS; analysis; communication; evidence handling",
    "senior": "Leads complex investigations and improves triage/detection quality",
    "interfaces": "Detection; IR; threat intel; IT; engineering",
    "source": "https://niccs.cisa.gov/tools/nice-framework"
  },
  {
    "function": "Security operations",
    "name": "Incident Responder",
    "mission": "Coordinate and execute containment, eradication, recovery, and learning",
    "outputs": "Incident command; timeline; containment evidence; communications; post-incident actions",
    "skills": "IR process; forensics; systems; decision-making; legal/comms interfaces",
    "senior": "Leads severe/cross-org incidents and resilience improvements",
    "interfaces": "SOC; DFIR; legal; executives; engineering; support",
    "source": "https://niccs.cisa.gov/tools/nice-framework"
  },
  {
    "function": "Security operations",
    "name": "DFIR / Forensics Engineer",
    "mission": "Acquire, preserve, examine, and report digital evidence with defensible provenance",
    "outputs": "Custody log; verified images/copies; timelines; analysis report; retained evidence",
    "skills": "File systems; memory; logs; hashing; chain of custody; tool validation",
    "senior": "Leads complex forensic methodology and evidence-quality assurance",
    "interfaces": "IR; legal; HR; SOC; privacy; reverse engineering",
    "source": "https://nvlpubs.nist.gov/nistpubs/legacy/sp/nistspecialpublication800-86.pdf"
  },
  {
    "function": "Security operations",
    "name": "Threat Intelligence Analyst",
    "mission": "Produce decision-relevant intelligence from sourced, evaluated evidence",
    "outputs": "Collection plan; source evaluation; actor/campaign analysis; briefs; detection leads",
    "skills": "OSINT; analytical tradecraft; link analysis; writing; languages/domain context",
    "senior": "Sets intelligence priorities and strategic threat assessments",
    "interfaces": "SOC; detection; IR; leadership; game security",
    "source": "https://niccs.cisa.gov/tools/nice-framework"
  },
  {
    "function": "Security assurance",
    "name": "Vulnerability Management Engineer",
    "mission": "Discover, prioritize, and drive remediation of exposures using risk evidence",
    "outputs": "Asset/vuln inventory; scan operations; prioritization; remediation metrics; exception records",
    "skills": "CVE/CVSS; scanning; asset context; scripting; patch/change processes",
    "senior": "Owns exposure-management strategy and systemic remediation",
    "interfaces": "IT; cloud; AppSec; engineering; compliance",
    "source": "https://niccs.cisa.gov/tools/nice-framework"
  },
  {
    "function": "Security assurance",
    "name": "Offensive Security / Red Team Engineer",
    "mission": "Evaluate defenses through explicitly authorized, scoped adversarial testing",
    "outputs": "Rules of engagement; findings; reproduction evidence; risk ratings; defensive validation",
    "skills": "Security assessment; coding; reporting; safety controls; scope discipline",
    "senior": "Designs organization-level adversarial evaluation and purple-team learning",
    "interfaces": "AppSec; SOC; detection; legal; engineering",
    "source": "https://niccs.cisa.gov/tools/nice-framework"
  },
  {
    "function": "Security research",
    "name": "Malware Analyst / Reverse Engineer",
    "mission": "Determine artifact behavior, capabilities, provenance clues, and defensive controls",
    "outputs": "Hashes/custody; static/dynamic findings; capabilities; IOCs; detections; limitations",
    "skills": "Assembly; OS internals; static/dynamic tools; debugging; evidence; safe lab practice",
    "senior": "Leads complex analysis methodology and defensive research programs",
    "interfaces": "DFIR; detection; IR; threat intel; legal; AppSec",
    "source": "https://niccs.cisa.gov/tools/nice-framework"
  },
  {
    "function": "Privacy & cryptography",
    "name": "Privacy Engineer",
    "mission": "Translate privacy requirements into data architecture and technical controls",
    "outputs": "Data maps; minimization; consent/retention controls; privacy threat models; tests",
    "skills": "Data systems; privacy risk; identity; security; policy-to-code; measurement",
    "senior": "Sets organization-wide privacy architecture and high-risk review",
    "interfaces": "Legal; product; data; security; design",
    "source": "https://niccs.cisa.gov/tools/nice-framework"
  },
  {
    "function": "Privacy & cryptography",
    "name": "Cryptography / Security Protocol Engineer",
    "mission": "Design and operate sound cryptographic and protocol services using reviewed primitives",
    "outputs": "Protocol designs; key/certificate lifecycle; libraries/services; test vectors; operational runbooks",
    "skills": "Applied cryptography; TLS/PKI; key management; distributed systems; secure coding",
    "senior": "Owns high-assurance protocol architecture and cryptographic agility",
    "interfaces": "Security; platform; backend; IAM; compliance",
    "source": "https://niccs.cisa.gov/tools/nice-framework"
  },
  {
    "function": "Security governance",
    "name": "Security GRC / Compliance Engineer",
    "mission": "Make security obligations, controls, evidence, and exceptions operational and auditable",
    "outputs": "Control map; evidence automation; risk register; assessments; remediation tracking",
    "skills": "Frameworks; control design; audit evidence; automation; communication",
    "senior": "Owns enterprise control strategy and continuous assurance",
    "interfaces": "CISO; legal; engineering; IT; privacy; audit",
    "source": "https://www.nist.gov/cyberframework"
  },
  {
    "function": "Game direction & production",
    "name": "Game / Creative Director",
    "mission": "Align player experience, creative vision, scope, and craft decisions across disciplines",
    "outputs": "Creative vision; experience pillars; scope decisions; reviews; milestone quality bar",
    "skills": "Game craft; leadership; communication; portfolio judgment; production and audience understanding",
    "senior": "Owns whole-title or portfolio creative direction and cross-discipline alignment",
    "interfaces": "Design; engineering; art; audio; production; publishing",
    "source": "https://job-boards.greenhouse.io/rockstargames"
  },
  {
    "function": "Game design",
    "name": "Game Designer",
    "mission": "Design mechanics, rules, loops, progression, content, and player experience against intent",
    "outputs": "GDD/system specs; prototypes; tuning models; playtest actions; shipped mechanics",
    "skills": "Game literacy; systems thinking; prototyping; communication; player psychology; iteration",
    "senior": "Owns major systems/portfolio craft and mentors designers through evidence",
    "interfaces": "Product; engineering; art; UX; research; production",
    "source": "https://job-boards.greenhouse.io/rockstargames"
  },
  {
    "function": "Game design",
    "name": "Technical Game Designer",
    "mission": "Bridge design intent and hands-on implementation through playable technical prototypes",
    "outputs": "Mechanic/system implementation; technical design docs; Blueprint/script prototypes; tuning tools",
    "skills": "Engine literacy; scripting/Blueprints; system design; debugging; design communication",
    "senior": "Leads complex prototype-to-production systems and technical design standards",
    "interfaces": "Gameplay; design; tools; UX; QA; production",
    "source": "https://job-boards.greenhouse.io/rockstargames"
  },
  {
    "function": "Game design",
    "name": "Level / Mission Designer",
    "mission": "Create spaces, encounters, pacing, objectives, and environmental storytelling",
    "outputs": "Level layouts; encounter scripts; metrics/model tests; playtest revisions; documentation",
    "skills": "Spatial design; scripting; pacing; navigation; player readability; engine tools",
    "senior": "Owns critical content pipelines and cross-mission experience quality",
    "interfaces": "Game design; art; gameplay; narrative; audio; QA",
    "source": "https://job-boards.greenhouse.io/rockstargames"
  },
  {
    "function": "Game design",
    "name": "Systems / Economy Designer",
    "mission": "Design balanced interacting systems, progression, rewards, and virtual economies",
    "outputs": "System/economy models; simulations; tuning rules; exploit/abuse analysis; live adjustments",
    "skills": "Math/statistics; systems thinking; spreadsheets/code; player behavior; experimentation",
    "senior": "Owns complex game-wide economy/systemic health and live balancing",
    "interfaces": "Game design; data; engineering; product; live ops",
    "source": "https://job-boards.greenhouse.io/rockstargames"
  },
  {
    "function": "Game design",
    "name": "Narrative Designer",
    "mission": "Integrate story, character, dialogue, choice, and pacing with interactive play",
    "outputs": "Narrative systems; scripts; branching/state design; implementation; editorial review",
    "skills": "Interactive writing; narrative structure; scripting; collaboration; localization awareness",
    "senior": "Leads narrative systems and whole-title story integration",
    "interfaces": "Creative direction; design; cinematic; audio; localization",
    "source": "https://job-boards.greenhouse.io/rockstargames"
  },
  {
    "function": "Game engineering",
    "name": "Gameplay Engineer",
    "mission": "Implement responsive, reliable gameplay mechanics, AI interaction, controls, and state",
    "outputs": "Gameplay code; networking/input behavior; tests; tuning hooks; debugging/profiling",
    "skills": "C++/engine language; 3D math; state systems; animation/physics; debugging; optimization",
    "senior": "Leads gameplay architecture and cross-mechanic technical direction",
    "interfaces": "Design; animation; engine; QA; online; audio",
    "source": "https://job-boards.greenhouse.io/rockstargames"
  },
  {
    "function": "Game engineering",
    "name": "Engine / Graphics Programmer",
    "mission": "Build rendering, engine, optimization, and platform capabilities within strict performance budgets",
    "outputs": "Renderer/engine features; GPU/CPU optimization; platform support; profiling; technical docs",
    "skills": "C++; graphics API; shaders; 3D math; concurrency; profiling; hardware constraints",
    "senior": "Owns rendering/engine roadmap and cross-title performance architecture",
    "interfaces": "Art; tech art; gameplay; platform; QA; tools",
    "source": "https://job-boards.greenhouse.io/rockstargames"
  },
  {
    "function": "Game engineering",
    "name": "Game Tools / Build Engineer",
    "mission": "Accelerate content and code workflows through reliable tools, builds, and pipelines",
    "outputs": "Editor/pipeline tools; build automation; asset validation; CI; release reproducibility",
    "skills": "C++/C#/Python; build systems; CI/CD; UX for creators; asset pipelines",
    "senior": "Owns studio-wide creator workflow and build reliability strategy",
    "interfaces": "All crafts; platform; QA; release; IT",
    "source": "https://job-boards.greenhouse.io/rockstargames"
  },
  {
    "function": "Game art & audio",
    "name": "Technical Artist",
    "mission": "Bridge art direction and real-time engine constraints through tools, shaders, and pipelines",
    "outputs": "Shader/material work; asset pipelines; rigging/tooling; performance guidance; validation",
    "skills": "DCC tools; scripting; shaders; geometry/animation; optimization; collaboration",
    "senior": "Sets multi-team art technology and pipeline strategy",
    "interfaces": "Art; graphics; animation; tools; QA; design",
    "source": "https://job-boards.greenhouse.io/rockstargames"
  },
  {
    "function": "Game art & audio",
    "name": "Game Audio Designer / Programmer",
    "mission": "Design and implement adaptive sound, dialogue, music behavior, and spatial audio",
    "outputs": "Audio assets/systems; middleware integration; mixing; implementation; accessibility options",
    "skills": "Audio craft; middleware/engine; scripting; spatialization; debugging; collaboration",
    "senior": "Owns whole-title audio systems and cross-craft technical direction",
    "interfaces": "Design; narrative; engineering; accessibility; QA",
    "source": "https://job-boards.greenhouse.io/rockstargames"
  },
  {
    "function": "Player experience",
    "name": "Game UI/UX Designer",
    "mission": "Make game mechanics, navigation, status, and actions understandable and low-friction",
    "outputs": "Player flows; HUD/UI states; prototypes; accessibility annotations; usability findings",
    "skills": "Interaction/visual design; game literacy; prototyping; console/PC/mobile input; accessibility",
    "senior": "Owns portfolio/title experience cohesion and cross-disciplinary UX leadership",
    "interfaces": "Game design; UI engineering; research; accessibility; production",
    "source": "https://www.w3.org/WAI/planning/arrm/"
  },
  {
    "function": "Player experience",
    "name": "Player / Games User Researcher",
    "mission": "Evaluate player understanding, experience, accessibility, and behavior using rigorous methods",
    "outputs": "Research plans; playtests; synthesis; decision briefs; longitudinal insight repository",
    "skills": "Research methods; game literacy; statistics/qualitative synthesis; ethics; recruitment",
    "senior": "Leads research strategy from concept through live operation",
    "interfaces": "Design; product; data; production; accessibility",
    "source": "https://www.w3.org/WAI/planning/arrm/"
  },
  {
    "function": "Game direction & production",
    "name": "Game Producer / Production Lead",
    "mission": "Align scope, people, dependencies, milestones, and quality without disconnecting craft teams",
    "outputs": "Production plan; risk/dependency log; milestone reviews; outsourcing coordination; launch plan",
    "skills": "Game development lifecycle; planning; communication; risk; vendor/team coordination",
    "senior": "Leads multi-team/studio production and portfolio tradeoffs",
    "interfaces": "All crafts; publishing; QA; leadership; legal",
    "source": "https://job-boards.greenhouse.io/rockstargames"
  },
  {
    "function": "Game quality",
    "name": "Game QA / Playtest Engineer",
    "mission": "Evaluate functionality, content, balance, compatibility, and player-risk across the game lifecycle",
    "outputs": "Test strategy; playtest findings; compatibility/performance evidence; regression; release risk",
    "skills": "Game test design; debugging; platforms; automation; communication; exploratory testing",
    "senior": "Owns studio quality strategy, test technology, and live regression learning",
    "interfaces": "All crafts; player research; release; support",
    "source": "https://job-boards.greenhouse.io/rockstargames"
  },
  {
    "function": "Game online & safety",
    "name": "Online Services / LiveOps Engineer",
    "mission": "Build and operate identity, matchmaking, sessions, inventory, telemetry, and live-service capabilities",
    "outputs": "Online services; SLOs; live configuration; incident/runbooks; deployment and capacity",
    "skills": "Backend/distributed systems; networking; databases; observability; live operations",
    "senior": "Owns global online architecture and live-service reliability",
    "interfaces": "Gameplay; platform; SRE; security; product; support",
    "source": "https://sre.google/workbook/table-of-contents/"
  },
  {
    "function": "Game online & safety",
    "name": "Anti-Cheat / Game Security Engineer",
    "mission": "Protect players and game integrity through authorized analysis, detection, and mitigation",
    "outputs": "Cheat/vuln analysis; mitigations; detections; telemetry; incident evidence; safe tooling",
    "skills": "C/C++; reverse engineering; client/server security; data; debugging; authorization discipline",
    "senior": "Leads game-integrity strategy and cross-title defensive capabilities",
    "interfaces": "Security; gameplay; online; data; legal; support",
    "source": "https://job-boards.greenhouse.io/rockstargames"
  },
  {
    "function": "Game online & safety",
    "name": "Game Data / LiveOps Analyst",
    "mission": "Measure player behavior, content performance, experiments, and live-game health",
    "outputs": "Metrics; dashboards; experiments; economy/retention analysis; tuning recommendations",
    "skills": "SQL; statistics; game systems; experimentation; visualization; communication",
    "senior": "Leads game measurement strategy and high-stakes live decisions",
    "interfaces": "Design; product; engineering; research; live ops",
    "source": "https://sfia-online.org/en/sfia-9"
  },
  {
    "function": "Additive manufacturing",
    "name": "DfAM / Additive Manufacturing Engineer",
    "mission": "Design parts and processes that exploit additive manufacturing while meeting engineering requirements",
    "outputs": "DfAM analysis; material/process selection; build strategy; tolerance/post-processing plan; qualification evidence",
    "skills": "Materials; AM processes; CAD; mechanics; tolerances; cost; testing; standards",
    "senior": "Owns qualified process/part families and engineering release criteria",
    "interfaces": "Design; materials; manufacturing; quality; safety; supply chain",
    "source": "https://www.iso.org/committee/629086/x/catalogue/p/1/u/0/w/0/d/0"
  },
  {
    "function": "Additive manufacturing",
    "name": "AM Process / Applications Engineer",
    "mission": "Develop and stabilize reliable additive-manufacturing process parameters and applications",
    "outputs": "DOE/process maps; build files; parameter evidence; root-cause analysis; production runbooks",
    "skills": "AM process physics; materials; statistics/DOE; slicing; machine operation; data analysis",
    "senior": "Owns process qualification and cross-machine/material transfer",
    "interfaces": "AM engineering; operations; quality; materials; safety",
    "source": "https://www.iso.org/committee/629086/x/catalogue/p/1/u/0/w/0/d/0"
  },
  {
    "function": "Additive manufacturing",
    "name": "AM Quality / Validation Engineer",
    "mission": "Establish evidence that additive parts and processes meet specified requirements",
    "outputs": "Inspection/test plans; calibration evidence; nonconformance/RCA; traceability; qualification reports",
    "skills": "Metrology; quality systems; materials testing; statistics; standards; documentation",
    "senior": "Owns validation strategy and independent release evidence",
    "interfaces": "Engineering; manufacturing; regulatory; suppliers; customers",
    "source": "https://www.iso.org/committee/629086/x/catalogue/p/1/u/0/w/0/d/0"
  },
  {
    "function": "CAD & print systems",
    "name": "CAD / Computational Design Engineer",
    "mission": "Create parametric, constraint-driven models and automated design workflows",
    "outputs": "Parametric CAD; code-CAD libraries; design automation; units/tolerances; validation tests",
    "skills": "B-rep/CSG; Python/C#/C++; geometry; product design; version control",
    "senior": "Owns reusable design platforms and complex geometric automation",
    "interfaces": "Product design; geometry; manufacturing; software; QA",
    "source": "https://www.cgal.org/"
  },
  {
    "function": "CAD & print systems",
    "name": "Slicing / Print-Process Engineer",
    "mission": "Translate validated geometry into reviewed machine-specific build instructions",
    "outputs": "Slicer profiles; toolpath/build review; dry-run evidence; material/machine settings; rollback",
    "skills": "Slicing; G-code/toolpaths; materials; machine behavior; testing; version control",
    "senior": "Owns qualified slicer/process profiles and production troubleshooting",
    "interfaces": "AM; firmware; operations; quality; safety",
    "source": "https://www.iso.org/committee/629086/x/catalogue/p/1/u/0/w/0/d/0"
  },
  {
    "function": "CAD & print systems",
    "name": "3D Printer Embedded / Firmware Engineer",
    "mission": "Develop safe motion, sensing, control, and printer firmware/configuration",
    "outputs": "Firmware changes; configuration review; hardware tests; safety evidence; release/rollback",
    "skills": "Embedded C/C++; motion control; MCU/RTOS; thermal safety; electronics; debugging",
    "senior": "Owns firmware/control architecture and high-risk hardware validation",
    "interfaces": "Hardware; print process; safety; manufacturing; quality",
    "source": "https://github.com/MarlinFirmware/Marlin"
  },
  {
    "function": "3D content & spatial UX",
    "name": "Blender / 3D Designer",
    "mission": "Create purposeful models, materials, lighting, scenes, animation, and export-ready assets",
    "outputs": "Models/scenes; geometry-node systems; renders/animations; optimized exports; documentation",
    "skills": "Mesh modeling; PBR/NPR; lighting; rigging/animation; Blender; visual storytelling",
    "senior": "Owns visual direction and reusable production pipelines",
    "interfaces": "Product/design; technical art; engineering; architecture; marketing",
    "source": "https://www.blender.org/about/license/"
  },
  {
    "function": "3D content & spatial UX",
    "name": "3D UI/UX / Spatial Interaction Designer",
    "mission": "Design understandable, accessible interactions for spatial, XR, and 3D interfaces",
    "outputs": "Spatial flows; prototypes; input/depth/feedback specs; 2D fallback; accessibility/usability evidence",
    "skills": "Interaction design; 3D literacy; XR ergonomics; prototyping; user research; motion/accessibility",
    "senior": "Owns cross-product spatial UX standards and research strategy",
    "interfaces": "Product; XR engineering; research; accessibility; visual design",
    "source": "https://www.w3.org/TR/WCAG22/"
  },
  {
    "function": "Real-time 3D & XR",
    "name": "Real-time 3D / WebXR Engineer",
    "mission": "Build performant interactive 3D experiences across target devices and browsers",
    "outputs": "Real-time scenes; WebGL/WebGPU/WebXR features; profiling; asset pipeline; fallback and tests",
    "skills": "JavaScript/TypeScript; Three.js/Babylon; graphics; device constraints; networking; accessibility",
    "senior": "Owns real-time 3D architecture, performance, and cross-device strategy",
    "interfaces": "3D design; platform; product; accessibility; QA",
    "source": "https://github.com/mrdoob/three.js"
  },
  {
    "function": "Real-time 3D & XR",
    "name": "Simulation / Animation / Pipeline Technical Director",
    "mission": "Build time-varying simulation, animation, and content-pipeline systems with reproducible outputs",
    "outputs": "Simulation/animation setups; USD/VDB pipelines; automation; validation; render/build documentation",
    "skills": "Physics-based animation; scripting; scene composition; volumes; debugging; production workflow",
    "senior": "Owns complex pipeline architecture and cross-production technical direction",
    "interfaces": "3D art; engineering; research; production; QA",
    "source": "https://www.openvdb.org/"
  },
  {
    "function": "BIM & information management",
    "name": "4D/5D BIM Specialist",
    "mission": "Link model elements to schedule, cost, and planning information for decision support",
    "outputs": "4D schedule model; 5D cost/QTO links; information requirements; validation; coordination reports",
    "skills": "BIM; scheduling; estimating; data mapping; IFC/CDE; communication",
    "senior": "Owns integrated planning/cost information strategy and data quality",
    "interfaces": "Architecture; construction; planning; cost; information management",
    "source": "https://www.buildingsmart.org/standards/"
  },
  {
    "function": "Architecture",
    "name": "Architect / Architectural Designer",
    "mission": "Develop safe, functional, contextual, and code-aware designs from brief through delivery",
    "outputs": "Brief/site analysis; concepts; drawings/models; coordination; specifications; review evidence",
    "skills": "Design; building systems; codes; sustainability; communication; professional judgment",
    "senior": "Owns complex projects and multidisciplinary technical/creative direction",
    "interfaces": "Clients; engineering; planning; construction; heritage; BIM",
    "source": "https://www.riba.com/work/finance-and-business-management/plan-of-work"
  },
  {
    "function": "Architecture & heritage",
    "name": "Conservation Architect / Built-Heritage Specialist",
    "mission": "Evaluate and intervene in heritage assets with significance, evidence, and minimal harm",
    "outputs": "Significance assessment; documentation; conservation plan; reversible interventions; provenance/community record",
    "skills": "Architectural history; materials/pathology; conservation charters; documentation; stakeholder engagement",
    "senior": "Leads complex conservation methodology and independent ethical review",
    "interfaces": "Custodians; communities; archaeologists; architects; regulators",
    "source": "https://www.icomos.org/en/charters-and-texts"
  },
  {
    "function": "Architecture & computation",
    "name": "Computational Designer / Design Technologist",
    "mission": "Apply parametric, algorithmic, and data-driven methods to architectural design and delivery",
    "outputs": "Parametric models; scripts/plugins; design options; geometric rationalization; validation",
    "skills": "Grasshopper/Rhino or equivalent; Python/C#; geometry; BIM; fabrication; communication",
    "senior": "Owns practice-wide computational design standards and difficult geometry",
    "interfaces": "Architecture; fabrication; BIM; engineering; software",
    "source": "https://www.cgal.org/"
  },
  {
    "function": "BIM & information management",
    "name": "BIM / Information Manager",
    "mission": "Govern model-based information requirements, exchange, quality, and common-data workflows",
    "outputs": "EIR/BEP support; CDE workflows; IFC/IDS/BCF checks; handover evidence; training",
    "skills": "ISO 19650; openBIM; IFC; information management; QA; stakeholder coordination",
    "senior": "Owns organizational information-management and open-standards strategy",
    "interfaces": "Architecture; engineering; construction; owners; software",
    "source": "https://www.buildingsmart.org/standards/"
  },
  {
    "function": "Architecture & computation",
    "name": "Architectural Geometry Specialist",
    "mission": "Rationalize complex architectural geometry for structure, fabrication, assembly, and cost",
    "outputs": "Panelization/rationalization; geometric constraints; tolerance strategy; fabrication evidence; reusable algorithms",
    "skills": "Differential/computational geometry; meshes; optimization; fabrication; numerical robustness",
    "senior": "Leads high-complexity geometry and research-to-practice translation",
    "interfaces": "Architecture; structure; facade; fabrication; software",
    "source": "https://www.cgal.org/"
  },
  {
    "function": "Architecture & heritage",
    "name": "Architectural Historian / Researcher",
    "mission": "Produce source-grounded interpretations of buildings, traditions, texts, and cultural contexts",
    "outputs": "Literature/source review; chronology; field/documentation analysis; publications; provenance notes",
    "skills": "Historical methods; languages/sources as needed; architectural analysis; writing; research ethics",
    "senior": "Leads cross-cultural research programs and peer/public scholarship",
    "interfaces": "Conservation; museums; universities; communities; design",
    "source": "https://www.icomos.org/en/charters-and-texts"
  },
  {
    "function": "Geometry & numerical engineering",
    "name": "Geometry Processing Engineer",
    "mission": "Engineer robust mesh, CAD, reconstruction, and geometry-processing algorithms and tools",
    "outputs": "Algorithms/libraries; mesh repair; predicates; tests; benchmarks; documentation",
    "skills": "Computational geometry; C++/Python; topology; numerical methods; validation",
    "senior": "Owns critical geometry kernels and cross-product robustness strategy",
    "interfaces": "CAD; graphics; manufacturing; architecture; research",
    "source": "https://www.cgal.org/"
  },
  {
    "function": "Geometry & numerical engineering",
    "name": "Computational Geometer / Applied Mathematician",
    "mission": "Develop and analyze geometric models, algorithms, and numerical methods with correctness evidence",
    "outputs": "Proofs/analysis; algorithms; simulations; reproducible code; papers/technical reports",
    "skills": "Discrete/computational/differential geometry; algorithms; numerical analysis; writing",
    "senior": "Leads novel methods and rigorous cross-domain mathematical direction",
    "interfaces": "Research; engineering; graphics; architecture; manufacturing",
    "source": "https://www.cgal.org/"
  },
  {
    "function": "Simulation & validation",
    "name": "CAE / FEA / CFD Validation Engineer",
    "mission": "Evaluate physical behavior with verified models, appropriate solvers, and empirical validation",
    "outputs": "Analysis plan; meshes/models; verification/validation; uncertainty; engineering report",
    "skills": "Mechanics/physics; numerical methods; FEA/CFD; testing; statistics; documentation",
    "senior": "Owns high-consequence simulation strategy and independent validation",
    "interfaces": "Design; materials; manufacturing; safety; research",
    "source": "https://www.nafems.org/"
  },
  {
    "function": "Agent governance & research",
    "name": "Agent Research Director / Orchestration Lead",
    "mission": "Coordinate specialist agents and evidence to produce auditable research and engineering outcomes",
    "outputs": "Research plan; delegation contracts; source/evidence matrix; synthesis; conflict/termination log; evaluation",
    "skills": "Research methods; agent orchestration; evaluation; risk/security; technical writing; leadership",
    "senior": "Owns multi-domain research quality and controlled agent-system strategy",
    "interfaces": "Domain leads; security; engineering; product; legal; users",
    "source": "https://agentskills.io/specification"
  },
  {
    "function": "Agent governance & research",
    "name": "Agent Skill Engineer / Evaluator",
    "mission": "Design, test, secure, version, and measure reusable skills and plugin/agent workflows",
    "outputs": "Skill specs; eval cases; permission manifest; provenance/license review; regression/security reports",
    "skills": "Prompt/workflow design; software testing; agent evaluation; supply-chain security; documentation",
    "senior": "Owns organizational skill quality, portability, and lifecycle governance",
    "interfaces": "Agent platform; security; domain experts; product; compliance",
    "source": "https://agentskills.io/specification"
  },
  {
    "function": "Agent governance & research",
    "name": "Agent Security / Prompt-Injection Researcher",
    "mission": "Evaluate and reduce instruction, tool, skill, and orchestration attack surfaces with controlled research",
    "outputs": "Threat model; adversarial evals; permission analysis; mitigations; coordinated disclosure evidence",
    "skills": "LLM security; prompt injection; tool/MCP/skills; evaluation; sandboxing; research ethics",
    "senior": "Leads agent-security research and organization-wide control validation",
    "interfaces": "Agent engineering; AppSec; research; legal; platform",
    "source": "https://genai.owasp.org/"
  },
  {
    "function": "Research & responsible growth",
    "name": "Behavioral / Research Psychologist",
    "mission": "Study human behavior, cognition, motivation, learning, and wellbeing with valid research methods",
    "outputs": "Research questions; ethical study design; validated measures; analysis; limitations and harm review",
    "skills": "Psychological science; statistics; research ethics; experimental design; communication",
    "senior": "Leads rigorous behavioral research and challenges unsupported psychological claims",
    "interfaces": "Product; UX research; data; legal; community; leadership",
    "source": "https://www.acm.org/code-of-ethics"
  },
  {
    "function": "Research & responsible growth",
    "name": "Product Psychology / Behavioral Design Lead",
    "mission": "Translate evidence about behavior into helpful, non-manipulative product and service choices",
    "outputs": "Behavioral hypotheses; ethical journey/mechanic review; experiments; harm and dark-pattern audit",
    "skills": "Behavioral science; UX; experimentation; accessibility; ethics; measurement",
    "senior": "Owns organization-wide ethical behavior-design standards and evidence quality",
    "interfaces": "Product; design; research; legal; marketing; data",
    "source": "https://www.acm.org/code-of-ethics"
  },
  {
    "function": "Marketing & growth",
    "name": "Marketing Engineer / Marketing Technologist",
    "mission": "Build and operate reliable marketing data, automation, attribution, and experimentation infrastructure",
    "outputs": "Marketing architecture; event/data pipelines; consent-aware automation; integrations; measurement reports",
    "skills": "APIs; data/analytics; automation; privacy; experimentation; web technologies",
    "senior": "Owns cross-channel marketing technology, data quality, and governance",
    "interfaces": "Marketing; data; engineering; privacy; product; sales",
    "source": "https://sfia-online.org/en/sfia-9"
  },
  {
    "function": "Marketing & growth",
    "name": "Growth Product Manager",
    "mission": "Improve activation, adoption, retention, and sustainable reach through ethical product experiments",
    "outputs": "Growth model; experiment backlog; funnel evidence; lifecycle analysis; learning repository",
    "skills": "Product management; statistics; UX/research; analytics; experimentation; economics",
    "senior": "Owns portfolio-level growth learning and long-term trust/quality tradeoffs",
    "interfaces": "Product; design; data; engineering; marketing; support",
    "source": "https://www.acm.org/code-of-ethics"
  },
  {
    "function": "Marketing & growth",
    "name": "Social Media / Content Lead",
    "mission": "Plan and publish accurate, useful, audience-appropriate content with accountable review",
    "outputs": "Editorial strategy; content calendar; sourced assets; channel adaptations; response/learning log",
    "skills": "Writing; audience research; platform literacy; visual/verbal judgment; accessibility; crisis response",
    "senior": "Owns multi-channel editorial quality, reputation, and evidence-based learning",
    "interfaces": "Marketing; design; research; legal; community; product",
    "source": "https://www.acm.org/code-of-ethics"
  },
  {
    "function": "Community & developer relations",
    "name": "Community / Developer Relations Manager",
    "mission": "Build reciprocal learning, contribution, support, and advocacy relationships with users and developers",
    "outputs": "Community programs; events/content; contribution pathways; feedback synthesis; health metrics",
    "skills": "Communication; technical empathy; facilitation; moderation; accessibility; program evaluation",
    "senior": "Owns regional/domain community strategy and durable contributor leadership",
    "interfaces": "Engineering; product; support; marketing; research; legal",
    "source": "https://sfia-online.org/en/sfia-9"
  },
  {
    "function": "Brand & communications",
    "name": "Brand / Communications Designer",
    "mission": "Create coherent, truthful visual and verbal identity across products and campaigns",
    "outputs": "Brand system; messaging hierarchy; design assets; editorial guidelines; accessibility and usage review",
    "skills": "Visual/verbal design; typography; audience research; content design; brand governance",
    "senior": "Owns organization-wide identity system and cross-channel coherence",
    "interfaces": "Marketing; product; design; leadership; legal; community",
    "source": "https://sfia-online.org/en/sfia-9"
  },
  {
    "function": "Market & customer research",
    "name": "Market Research / Competitive Intelligence Analyst",
    "mission": "Produce sourced, unbiased evidence about customers, competitors, markets, and adoption constraints",
    "outputs": "Research plan; source/evidence matrix; market analysis; competitor comparisons; uncertainty report",
    "skills": "Research methods; statistics; industry analysis; citation discipline; writing; ethics",
    "senior": "Owns strategic market-learning programs and challenges weak assumptions",
    "interfaces": "Product; leadership; marketing; sales; data; legal",
    "source": "https://sfia-online.org/en/sfia-9"
  },
  {
    "function": "Sales & solutions",
    "name": "Sales Engineer / Solutions Consultant",
    "mission": "Connect customer technical needs to feasible, honestly scoped product solutions and adoption outcomes",
    "outputs": "Discovery; demos/prototypes; technical evaluation; solution scope; handoff and success criteria",
    "skills": "Domain engineering; communication; requirement analysis; estimation; negotiation; documentation",
    "senior": "Owns complex solution architecture and cross-functional customer evidence",
    "interfaces": "Sales; product; engineering; security; legal; customer success",
    "source": "https://sfia-online.org/en/sfia-9"
  },
  {
    "function": "Legal, trust & policy",
    "name": "Legal / Policy / Compliance Specialist",
    "mission": "Identify and operationalize applicable legal, regulatory, contractual, and policy obligations",
    "outputs": "Requirement/risk register; review guidance; contract/policy evidence; escalation; compliance monitoring",
    "skills": "Applicable legal/domain knowledge; research; risk; writing; cross-functional judgment",
    "senior": "Owns organization-level policy strategy and independent challenge within professional scope",
    "interfaces": "Leadership; engineering; security; privacy; marketing; people",
    "source": "https://www.acm.org/code-of-ethics"
  },
  {
    "function": "People & organization",
    "name": "Talent Acquisition / People Operations Specialist",
    "mission": "Build fair, accessible, role-relevant hiring and employee-support processes",
    "outputs": "Workforce plan; structured hiring operations; candidate experience; onboarding; records and process audit",
    "skills": "Role analysis; interviewing operations; employment-process literacy; accessibility; confidentiality",
    "senior": "Owns organization-wide hiring quality, fairness, and people-process improvement",
    "interfaces": "Hiring managers; legal; finance; leadership; employees",
    "source": "https://sfia-online.org/en/sfia-9"
  },
  {
    "function": "Finance & operations",
    "name": "Finance / Operations Analyst",
    "mission": "Make budget, unit-cost, procurement, capacity, and operating constraints visible and reliable",
    "outputs": "Budget/scenarios; cost model; vendor/procurement records; operating dashboard; variance analysis",
    "skills": "Finance/accounting literacy; spreadsheets/data; forecasting; controls; communication",
    "senior": "Owns organization-level resource allocation analysis and financial controls",
    "interfaces": "Leadership; engineering; product; legal; procurement; people",
    "source": "https://sfia-online.org/en/sfia-9"
  },
  {
    "function": "Customer outcomes",
    "name": "Customer Success Manager",
    "mission": "Help customers achieve declared outcomes and feed adoption barriers back into the company",
    "outputs": "Success plans; onboarding; outcome reviews; health/risk signals; renewal/expansion evidence",
    "skills": "Customer/domain knowledge; project management; communication; analytics; problem solving",
    "senior": "Owns portfolio-level customer outcomes and systemic adoption improvements",
    "interfaces": "Sales; product; support; engineering; research; marketing",
    "source": "https://sfia-online.org/en/sfia-9"
  },
  {
    "function": "Trust & safety",
    "name": "Trust, Safety & Ethics Program Manager",
    "mission": "Establish review, escalation, and learning systems for harm, abuse, integrity, and responsible operations",
    "outputs": "Risk scenarios; policy/controls; incident review; harm metrics; transparency and remediation records",
    "skills": "Risk assessment; research; policy; incident facilitation; accessibility; ethics",
    "senior": "Owns organization-wide trust/safety strategy and independent review",
    "interfaces": "Legal; security; product; research; community; leadership",
    "source": "https://www.acm.org/code-of-ethics"
  },
  {
    "function": "Knowledge & capability",
    "name": "Knowledge Transfer / Learning Systems Manager",
    "mission": "Ensure project knowledge, skills, decisions, and operational practice remain discoverable and transferable",
    "outputs": "Knowledge architecture; onboarding/learning paths; evidence-linked repository; handoff exercises; freshness review",
    "skills": "Information architecture; learning science; technical writing; research; facilitation; metrics",
    "senior": "Owns organization-wide knowledge durability and capability-transfer programs",
    "interfaces": "All disciplines; docs; people; research; engineering; support",
    "source": "https://sfia-online.org/en/sfia-9"
  }
];
