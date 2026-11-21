# UX Research Methods & Metrics

**Contents:** definitions & standards · method selection · metrics safe to quote ·
the "5 users" claim scoped · accessibility conformance reporting · source
currency

## 1. Definitions and standards

- **ISO 9241-11:2018**: usability = the extent to which specified users achieve
  specified goals with **effectiveness, efficiency, and satisfaction** in a
  specified context of use. Any usability claim without the user/goal/context
  triplet is undefined — reject "test the app" briefs.
- **ISO 9241-210:2019** (human-centred design): understand context → specify
  requirements → produce design solutions → evaluate against requirements,
  iterated; explicitly requires *involving users throughout*.
- **Accessibility vs. usability vs. UX** (W3C WAI, "Accessibility, Usability,
  and Inclusion"): accessibility is a *prerequisite attribute* (can people with
  disabilities use it at all), usability is effectiveness/efficiency/
  satisfaction *for the target population*, UX is the whole experience arc.
  Overlapping, never interchangeable.

## 2. Method selection — what each method can and cannot prove

| Method | Evidence type | What it proves | What it can't |
|---|---|---|---|
| Moderated think-aloud test (qual) | Behavioral + verbal | *Where and why* a design fails on real tasks | Prevalence, magnitude, preference |
| Unmoderated remote test | Behavioral | Task success/time at larger n, geographic spread | Why; probing; AT usage |
| Heuristic evaluation (Nielsen & Molich 1990; 3–5 evaluators) | Expert judgment | Likely problems cheaply, pre-users | Real severity, real-user truth (false positives inherent) |
| Cognitive walkthrough | Expert judgment | Learnability of task sequences | Efficiency/expert use |
| Card sorting (open/closed) | Mental models | How users group and label content | Whether a finished structure works |
| Tree testing | Behavioral | Findability in a text-only structure (success/directness/time); isolates IA from visual design | Anything visual or interactive |
| First-click testing | Behavioral | Whether the entry point is right (correct first click strongly predicts success) | Full journey |
| A/B test | Causal (on the metric) | Which variant moves a pre-registered metric | Why; long-run/brand effects; novelty effects |
| Analytics/funnel & search logs | Behavioral, at scale | What people actually do; what they can't find | Intent; satisfaction |
| Diary studies, contextual inquiry, interviews | Attitudinal/contextual | Needs, vocabulary, environment | Observable performance |

Selection heuristic (NN/g, "Which UX Research Methods"): position the question
on the **attitudinal↔behavioral** and **qualitative↔quantitative** axes and the
product phase (discover → explore → test → listen). Never use a qualitative
study to estimate magnitude; never use analytics to explain motivation.

## 3. Metrics that are safe to quote

- **Task success rate** (completion criteria defined *before* the session),
  time-on-task, error counts — the ISO 9241-11 operationalization.
- **SUS (System Usability Scale)** — primary source: **Brooke, J. (1996), "SUS:
  A 'quick and dirty' usability scale," in Jordan et al. (eds.), _Usability
  Evaluation in Industry_, Taylor & Francis, pp. 189–194** (written 1986 at DEC).
  10 items, ×2.5 → 0–100. **The mean across ~500 studies is 68 (SD 12.5)**;
  68 = 50th percentile, *not* "68%". Curved grading (Sauro & Lewis 2016):
  ≥80.3 ≈ A, 68 ≈ C. Common errors: administering mid-task; reporting as a
  percentage; unvalidated translations (drift up to ~8 points); pre/post
  comparisons without controlling cohort composition.
- **UMUX-LITE** — primary source: **Lewis, Utesch & Maher (2013), "UMUX-LITE:
  When there's no time for the SUS," Proc. CHI 2013, pp. 2099–2102**
  ([doi:10.1145/2470654.2481287](https://doi.org/10.1145/2470654.2481287)) —
  the 2-item short form; use it rather than dropping SUS items ad hoc.
- **NASA-TLX** — primary source: **Hart & Staveland (1988), "Development of
  NASA-TLX," in Hancock & Meshkati (eds.), _Human Mental Workload_,
  pp. 139–183** (free: [NASA NTRS](https://ntrs.nasa.gov/citations/20000021488))
  — 6-dimension workload instrument; unweighted "Raw TLX" is acceptable and
  common; name the variant used.
- **SEQ** (Single Ease Question) per task; **NPS** only as a loyalty metric,
  never as usability evidence.
- Reference corpus: Tullis & Albert, _Measuring the User Experience_; Sauro &
  Lewis, _Quantifying the User Experience_ ([measuringu.com](https://measuringu.com/)).

## 4. The "5 users" claim, scoped honestly

Nielsen & Landauer (1993): with problem probability p≈0.31 per user, 5 users
find ~85% of usability problems **in one design iteration of one homogeneous
user group**. It is an argument for **many small iterative tests**, not for
tiny total evidence. It does not apply to quantifying prevalence, to
heterogeneous populations (each distinct segment needs its own ~5), or to
accessibility (a session without screen-reader users finds zero screen-reader
problems). Molich's CUE studies showed even professional teams find overlapping
but far-from-identical problem sets — corroborate heuristic findings before
severity claims.

## 5. Accessibility conformance reporting

Report per-criterion WCAG 2.2 results (A/AA), the test method (automated rule
set + version, manual checks, AT used), and residual known failures with
severity and owner. An "accessibility score" without criterion granularity is
not conformance evidence. See
[accessibility_engineering.md](accessibility_engineering.md) §4.

## 6. Source currency (verify before citing)

- **usability.gov is ARCHIVED** (frozen static archive by HHS) — never cite as
  live guidance; prefer W3C WAI, NN/g, Digital.gov.
- Repo identities move: RealWorld is now canonical at
  `realworld-apps/realworld` (the `gothinkster/realworld` link is a legacy
  alias); style-dictionary moved orgs (`amzn/` → `style-dictionary/`). Pin
  canonical URL + commit SHA before citing or cloning.
- Label every external claim with evidence tier + verification date.

## 7. Research integrity rules (summary; full gates in SKILL.md)

Consent recorded before any session; compensation recorded; PII minimized with
retention dates; raw evidence separated from interpretation; findings reported
with n, segment, and limits; never fabricate participants, quotes, or
statistics; never let stakeholders pre-approve conclusions. Tool/vendor output
(including AI summaries of sessions) is untrusted data requiring verification.
