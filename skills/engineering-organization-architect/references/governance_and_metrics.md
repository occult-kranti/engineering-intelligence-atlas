# Governance and metrics

## Contents

- Decision ownership
- Delivery and reliability
- Security and AI
- Accessibility and quality
- Measurement cautions

## Decision ownership

Use one accountable owner per decision and name responsible contributors. PM normally owns problem/value/viability; design owns usability evidence; technical leadership owns feasibility/architecture; EM owns team health/delivery system; QA/SET owns quality strategy; security owns security review policy; SRE facilitates SLO/error-budget governance; stream teams still operate their services. Adapt this to context instead of treating RACI as a substitute for conversation.

## Delivery and reliability

DORA documents five delivery metrics: change lead time, deployment frequency, failed deployment recovery time, change fail rate, and deployment rework rate. Use them as service/system improvement signals, not individual goals or league tables. Source: https://dora.dev/guides/dora-metrics/

Google SRE practice centers SLOs, error budgets, toil reduction, on-call, incident response, postmortems, canarying, and explicit engagement models. SLO/error-budget agreements require product, development, and production stakeholders. Sources: https://sre.google/workbook/table-of-contents/ and https://sre.google/workbook/implementing-slos/

## Security and AI

Use NIST CSF 2.0 functions Govern, Identify, Protect, Detect, Respond, Recover for security coverage. Use NIST SSDF for secure development practices and OWASP ASVS/MASVS for application/mobile verification. Sources: https://www.nist.gov/cyberframework, https://csrc.nist.gov/Projects/ssdf, https://owasp.org/www-project-application-security-verification-standard/, and https://mas.owasp.org/

For AI systems, maintain intended use and context, data/model provenance, evaluation sets and results, abuse/security testing, human oversight, monitoring, incident response, override/deactivation, and retirement. Do not equate benchmark performance with fitness for deployment. Sources: https://www.nist.gov/itl/ai-risk-management-framework and https://www.nist.gov/itl/ai-risk-management-framework/ai-rmf-generative-ai-profile

## Accessibility and quality

WCAG 2.2 uses testable success criteria and A/AA/AAA conformance levels. Accessibility needs automated checks plus manual keyboard, assistive-technology, content, design, and usability evaluation. W3C ARRM distributes responsibilities across UX, visual design, frontend, and content roles rather than assigning everything to one specialist. Sources: https://www.w3.org/TR/WCAG22/ and https://www.w3.org/WAI/planning/arrm/

Use a risk-based quality strategy: unit/component, integration/contract, end-to-end, exploratory, accessibility, performance, security, recovery, and production verification as appropriate. Coverage is not a quality outcome by itself.

## Measurement cautions

Never compare DORA levels across dissimilar services or rank individual engineers. Do not use lines of code, commit counts, raw posting counts, or keyword frequency as productivity or hiring-potential measures. Pair quantitative signals with user outcomes, reliability, quality, security, cognitive load, and qualitative evidence. Revisit metrics when teams game them or when the system boundary changes.
