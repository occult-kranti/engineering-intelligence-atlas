---
name: music-theory-production-engineering
description: Source-grounded music theory, audio production, and rights engineering. Use for tuning/temperament questions in ratios and cents with priority accuracy (Zhu Zaiyu 1584, Stevin independent); dated Western harmony/counterpoint/rhythm/form/timbre; culturally specific theory (Hindustani raga/tala, Carnatic, maqam, Javanese/Balinese gamelan, Northern Ewe rhythm) in named community context with anti-homogenization critique; notation/MIDI/MEI/MusicXML/SMuFL encoding; DSP/synthesis/DAW engineering with license-aware tool choice; MIR and reproducible evaluation (mir_eval-cited metrics, BS.1770/EBU R128, BS.1116/MUSHRA); and rights/provenance gates for sampling, voice/likeness, and AI content (Bridgeport–VMG Salsoul circuit split, ELVIS Act, USCO AI reports). Ships deterministic stdlib scripts and original generated fixtures (MusicXML, MIDI, PCM WAV) with full provenance.
---

# Music Theory & Production Engineering

One evidence base serving three specialist charter contexts (music-theory-research-director, audio-dsp-production-engineer, creative-rights-reproducibility-editor). Numeric discipline on tuning, dated/regionalized theory, license-aware production, and rights gates that report unsettled law as unsettled.

**Point-in-time baseline: 2026-11-21.** All repo pins, licenses, standards pages, and legal statuses were verified on that date (inspection record: `references/music_theory_audio_repo_cases.json`). Versions, licenses, lifecycle states, and legal statuses drift — **re-verify time-sensitive facts at point of use** before citing them in a deliverable.

## Step 1 — Select the role context

| Context | Mission | Primary references |
|---|---|---|
| **Music Theory Research Director** | Theory answers with ratios/cents, dated conventions, named cultural contexts, priority-accurate history | theory_foundations, culturally_specific_theory, repo_casebook |
| **Audio DSP & Production Engineer** | Build/evaluate audio pipelines with declared parameters, license-aware engines, reproducible metrics | dsp_and_formats, evaluation_and_rights, modern_labs, repo_casebook |
| **Creative Rights & Reproducibility Editor** | Gate deliverables on rights/licensing/provenance/reproducibility; unsettled law reported as unsettled; never legal advice | evaluation_and_rights, repo_casebook |

Per-context missions, resources, and measurable evaluations: `references/music_theory_role_resources.json`. Charters live outside this skill (`scientific-research-library/agents/`); do not modify them from here.

## Step 2 — Route the task

| Task shape | Read |
|---|---|
| Acoustics, psychoacoustics, loudness standards; tuning/temperament math and history; Western harmony/counterpoint/rhythm/form/timbre; notation and MIDI/data formats | [references/theory_foundations.md](references/theory_foundations.md) |
| Raga/tala, maqam, gamelan, West African rhythm — or any claim about a specific tradition | [references/culturally_specific_theory.md](references/culturally_specific_theory.md) |
| DSP, synthesis methods, plugin/engine landscape, DAW interchange, dependency license postures | [references/dsp_and_formats.md](references/dsp_and_formats.md) |
| MIR metrics, listening-test standards, reproducibility contract; copyright/sampling/voice/likeness/AI provenance gates | [references/evaluation_and_rights.md](references/evaluation_and_rights.md) |
| Hands-on labs M1–M7 with measurable acceptance tests | [references/modern_labs.md](references/modern_labs.md) |
| Repo precedents (13 cases: pinned commits, verified licenses, lifecycle) | [references/repo_casebook.md](references/repo_casebook.md) + [references/music_theory_audio_repo_cases.json](references/music_theory_audio_repo_cases.json) |

## Step 3 — Apply the standing rules (fail review on violation)

1. **Theory is descriptive, not universal.** Western common-practice harmony is one documented tradition, not the physics of music. Culturally specific theory is taught only in named regional/community context from tradition-internal or peer-reviewed sources — never homogenized into "world music theory."
2. **Psychoacoustics ≠ aesthetics.** Perceptual findings (consonance, loudness, masking) constrain but do not legislate musical value.
3. **Tuning claims are numeric.** State ratios/cents with reference pitch and temperament; "pure" and "natural" are banned as unqualified terms.
4. **Every audio artifact has a provenance chain:** source recordings/samples with license state, synthesis parameters/seeds, processing chain with tool versions, evaluation protocol, rights status of output.
5. **Legal uncertainty is reported as legal uncertainty.** US sampling law is circuit-split; AI-training litigation is unresolved; nothing here is legal advice — route rights decisions to counsel.

## Step 4 — Run the deterministic toolchain (stdlib only; no external audio/code execution)

| Script | Purpose |
|---|---|
| `scripts/ratio_cents.py` | Ratio↔cents conversion and 12-TET comparison; `--self-test` verifies known vectors (3:2 = 701.955¢, syntonic comma 81:80 = 21.506¢, Pythagorean comma = 23.460¢) to 0.001¢ |
| `scripts/generate_fixtures.py` | Deterministically regenerates the original fixtures (MusicXML, MIDI, PCM WAVs) byte-for-byte; provenance in `fixtures/provenance.json` |
| `scripts/validate_fixtures.py` | Parses and validates the MusicXML (well-formed partwise structure), MIDI (SMF header/track/event stream), and WAV fixtures |
| `scripts/wav_metrics.py` | PCM WAV **RMS / peak / DC-offset** metrics. Explicitly **NOT** LUFS/BS.1770 and **NOT** true-peak — those are not implemented here; do not claim them from this output |
| `scripts/validate_casebook.py` | Casebook JSON↔Markdown consistency, relative-link existence, no absolute paths, URL shape |
| `scripts/run_all_tests.py` | Runs all of the above as the acceptance suite |

## Hard gates (any violation blocks the deliverable)

- No universalizing language: "music is a universal language," "all cultures share the pentatonic scale," "African rhythm is polymetric," "gamelan is pentatonic equal temperament," single "maqam tuning" — all fail on sight (see culturally_specific_theory.md for the required critiques).
- No uncited tuning history: temperament claims need Barbour/primary anchoring; "Bach's temperament" always labeled hypothesis; Kellner squiggle never cited as settled.
- No audio deliverable without a provenance log; no unlicensed samples; no redistribution of restricted datasets (e.g., RWC); MAESTRO is CC BY-NC-SA — research use only.
- No perceptual-quality claims without the applicable ITU-R method (BS.1116/BS.1534) and disclosed listener protocol; PEAQ/ViSQOL labeled as estimates with known limits. No fabricated listening-test results and no LUFS/true-peak claims from tools that do not implement BS.1770/true-peak.
- Block "X seconds is safe," "crediting is permission," "pitch-shifting makes sampling legal," "NO FAKES is law," "AI output is registrable" claims wherever they appear, with sourced corrections.
- Copyleft code (Essentia AGPL-3.0, SuperCollider/pedalboard GPL-3.0, Csound LGPL-2.1) in distributed/closed deliverables requires a recorded license-architecture decision before adoption, not at release.

## Output contract

1. Every theory claim is dated/regionalized; Western common-practice conventions are labeled as conventions with alternatives named.
2. Every tuning statement carries ratios/cents and reference pitch; temperament histories carry priority and hypothesis labels (Zhu Zaiyu 1584 priority; Bach-temperament hypotheses).
3. Culturally specific theory only in named regional/community context with tradition-internal or peer-reviewed sources and the required critique attached.
4. Every audio artifact carries: provenance log (inputs + licenses), tool/version pins, seeds, sample rate, loudness state, and evaluation protocol with metric implementation cited.
5. Legal posture statements name jurisdiction and label unsettled law (sampling circuit split; AI-training litigation; NO FAKES unenacted); persona/voice uses route through the rights gate.
6. Code dependencies pass license review before inclusion in deliverables (repo-case license postures are the starting register).
