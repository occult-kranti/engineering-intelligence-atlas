# Repository Casebook — 13 Inspected Audio/Music Repositories

Inspection record: `music_theory_audio_repo_cases.json` (this directory). Method: read-only GitHub API inspection (license endpoint + raw LICENSE file reads + commit listing) on **2026-11-21**. No code was downloaded or executed. License choices matter doubly in audio: copyleft engines (Csound LGPL-2.1, SuperCollider GPL-3.0, Essentia AGPL-3.0, pedalboard GPL-3.0) impose different obligations than permissive libraries (Tone.js MIT, music21 BSD-3-Clause, librosa ISC, mir_eval MIT) — this is a product-architecture input, recorded per case. Re-verify pins, licenses, and lifecycle at point of use.

| # | Repo | Category | License (as verified) | Pinned commit | Lifecycle |
|---|---|---|---|---|---|
| 1 | [Tonejs/Tone.js](https://github.com/Tonejs/Tone.js) | web-audio-framework | MIT | `b48d2990b92e` (2026-11-20) | active — frequent automated version releases |
| 2 | [WebAudio/web-audio-api](https://github.com/WebAudio/web-audio-api) | standards-source | W3C Software and Document License (GitHub: NOASSERTION) | `42e974ad6a62` (2026-11-17) | active — v1.1-era maintenance (errata like coneGain vector fix observed) |
| 3 | [w3c/musicxml](https://github.com/w3c/musicxml) | notation-standard | no repo-level LICENSE file (verified at root listing 2026-11-21); governed by W3C Music Notation Community Group agreements — treat spec text under W3C document terms and record this when excerpting | `5602eeeaa208` (2026-11-17) | active — MusicXML 4.x maintenance |
| 4 | [cuthbertLab/music21](https://github.com/cuthbertLab/music21) | computational-musicology | BSD-3-Clause | `40e95ae567fe` (2026-11-18) | active — long-lived academic project (copyright 2006–2026 per LICENSE) |
| 5 | [musescore/MuseScore](https://github.com/musescore/MuseScore) | notation-editor | GPL-3.0 with font exception (bundled fonts under GNU Freefont with embedding exception) | `08d70c1a6ae0` (2026-11-20) | active — high-volume development |
| 6 | [csound/csound](https://github.com/csound/csound) | synthesis-engine | LGPL-2.1 | `357926f8572f` (2026-11-20) | active — continuous opcode-level maintenance |
| 7 | [supercollider/supercollider](https://github.com/supercollider/supercollider) | synthesis-engine | GPL-3.0 | `a1cbc78df43d` (2026-11-20) | active |
| 8 | [MTG/essentia](https://github.com/MTG/essentia) | mir-library | AGPL-3.0 (with upstream contribution terms; also historically available under commercial license from UPF) | `df27f949d782` (2026-11-18) | active (Universitat Pompeu Fabra Music Technology Group) |
| 9 | [librosa/librosa](https://github.com/librosa/librosa) | mir-library | ISC | `6b624ff6edf2` (2026-11-20) | active |
| 10 | [craffel/mir_eval](https://github.com/craffel/mir_eval) | evaluation-metrics | MIT | `862261303e42` (2026-11-12) | active maintenance (modernized packaging 2026-11) |
| 11 | [0xfe/vexflow](https://github.com/0xfe/vexflow) | notation-rendering | MIT text (GitHub: NOASSERTION due to header wording) | `a0c4d47a6baa` (2025-03-05) | slow/maintenance — last default-branch commit 2025-03; SMuFL-based rendering mature |
| 12 | [surge-synthesizer/tuning-library](https://github.com/surge-synthesizer/tuning-library) | microtuning | MIT | `d6fcc08f938c` (2026-10-19) | active — maintained by the Surge Synth Team (open-source synth organization) |
| 13 | [spotify/pedalboard](https://github.com/spotify/pedalboard) | audio-effects | GPL-3.0 | `ef2aa99cfd1f` (2026-11-09) | active (Spotify Audio Intelligence Lab) |

## Case details

### tonejs — Tonejs/Tone.js

- **URL:** https://github.com/Tonejs/Tone.js
- **Category:** web-audio-framework
- **License:** MIT — LICENSE.md read (file SHA 9368a0276030d8dc22200bdc3071ffa77ae0c393) (verified 2026-11-21)
- **Pinned commit:** `b48d2990b92e8c1068ea912a43dd5fd3ac6f64c3` (2026-11-20) — automated release commit v15.5.73
- **Lifecycle:** active — frequent automated version releases
- **Demonstrates:** Web Audio scheduling and graph abstraction for the browser: transport/lookahead scheduling, synth/effect units; reference for lab M2.
- **Implementation lessons:**
  - AudioContext sample-accurate timing comes from the Web Audio clock, not setTimeout — Tone.Transport exists precisely because naive JS scheduling drifts.
  - MIT posture makes it safe for commercial web deliverables; still record version pin + NOTICE.
  - Version cadence is high: pin exact version (v15.x) in lab fixtures, and declare AudioContext sample rate in every test.

### webaudio-spec — WebAudio/web-audio-api

- **URL:** https://github.com/WebAudio/web-audio-api
- **Category:** standards-source
- **License:** W3C Software and Document License (GitHub: NOASSERTION) — LICENSE.md read — 'All documents in this Repository are licensed by contributors under the W3C Software and Document License' (verified 2026-11-21)
- **Pinned commit:** `42e974ad6a627b8791e75e876dd00a181929ab7f` (2026-11-17)
- **Lifecycle:** active — v1.1-era maintenance (errata like coneGain vector fix observed)
- **Demonstrates:** The normative browser audio graph API (nodes, AudioWorklet, automation timelines) maintained as inspectable spec text with public issue discussion.
- **Implementation lessons:**
  - Quote API behavior by spec version + section; errata land between formal publications — the repo is the living document.
  - AudioWorklet runs off the main thread: messaging latency and 128-frame render quantum belong in lab acceptance tests.
  - Spec issues are public: implementation conformance differs across browsers — test, don't assume.

### musicxml — w3c/musicxml

- **URL:** https://github.com/w3c/musicxml
- **Category:** notation-standard
- **License:** no repo-level LICENSE file (verified at root listing 2026-11-21); governed by W3C Music Notation Community Group agreements — treat spec text under W3C document terms and record this when excerpting — root listing + README read (verified 2026-11-21)
- **Pinned commit:** `5602eeeaa20845681eb623e0e834cc939cb37d74` (2026-11-17)
- **Lifecycle:** active — MusicXML 4.x maintenance
- **Demonstrates:** The interchange format for Western notation between notation editors, analysis tools, and renderers; XSD schema in-repo makes validation teachable (lab M3).
- **Implementation lessons:**
  - Interchange ≠ semantics: MusicXML carries notation and much performance data, but round-trips through different editors can alter layout/voice assignment — acceptance-test the musical content, not the file hash.
  - Origins: Michael Good / Recordare → MakeMusic → donated to the W3C CG (2015); a licensing-governance example of a de facto standard moving to a standards body.
  - Absence of repo LICENSE is a finding: cite the CG page and W3C terms, not an assumed open license.

### music21 — cuthbertLab/music21

- **URL:** https://github.com/cuthbertLab/music21
- **Category:** computational-musicology
- **License:** BSD-3-Clause — LICENSE file read (file SHA 50acd0e546aea784886e62b8a16f3e0e8900dd00) (verified 2026-11-21)
- **Pinned commit:** `40e95ae567fe8b8e35317447dc74d5cdbb2fb83d` (2026-11-18)
- **Lifecycle:** active — long-lived academic project (copyright 2006–2026 per LICENSE)
- **Demonstrates:** Symbolic music analysis in Python: streams/parts/measures, corpus of encoded works, Roman-numeral and species-counterpoint tooling; the workhorse for harmony/counterpoint verification in labs.
- **Implementation lessons:**
  - The bundled corpus has its own rights posture — scores encoded from editions may carry edition rights; check before redistributing derived encodings.
  - Analytical output is a hypothesis about a score, not a property of it: report method (e.g., key-finding algorithm + parameters) with every analysis.
  - BSD posture + active maintainer makes it a safe default dependency; pin major version (v9+ API changes exist historically).

### musescore — musescore/MuseScore

- **URL:** https://github.com/musescore/MuseScore
- **Category:** notation-editor
- **License:** GPL-3.0 with font exception (bundled fonts under GNU Freefont with embedding exception) — LICENSE.txt read (file SHA 6d802f72be583b9df9102f85815f5c1e6cac2222) (verified 2026-11-21)
- **Pinned commit:** `08d70c1a6ae0f5553603507c32e6db5379ad75d9` (2026-11-20)
- **Lifecycle:** active — high-volume development
- **Demonstrates:** Full engraving application with headless CLI (batch convert MusicXML→PDF/PNG/audio): reference renderer for lab M3 fixtures; also the font-exception pattern that keeps document embedding unencumbered.
- **Implementation lessons:**
  - GPL-3.0 governs the application; scores you author are your works (output is not a derivative of the program), and the font exception explicitly keeps embedded-font documents non-GPL — quote this distinction in rights reviews.
  - Headless conversion is version-sensitive: pin MuseScore version for reproducible rendering fixtures.
  - musescore.com (the sharing platform) has separate terms from the GPL application — never conflate the two in rights discussions.

### csound — csound/csound

- **URL:** https://github.com/csound/csound
- **Category:** synthesis-engine
- **License:** LGPL-2.1 — GitHub license API (verified 2026-11-21)
- **Pinned commit:** `357926f8572f9892ea234841d4d3f4cef2ef2e00` (2026-11-20)
- **Lifecycle:** active — continuous opcode-level maintenance
- **Demonstrates:** Composer-programmer synthesis language with decades of documented opcodes; embeddable engine (Csound API) used inside games, mobile apps, and plugins.
- **Implementation lessons:**
  - LGPL-2.1 permits embedding via dynamic linking in proprietary hosts; static-link or engine modifications trigger source obligations — architecture decision to record.
  - Orchestra/score text files are inspectable artifacts: ideal for reproducible synthesis labs (seed + sr + ksmps declared).
  - Opcode numerical behavior can differ across versions/platforms; acceptance tests must declare sample rate and control-rate.

### supercollider — supercollider/supercollider

- **URL:** https://github.com/supercollider/supercollider
- **Category:** synthesis-engine
- **License:** GPL-3.0 — GitHub license API (verified 2026-11-21)
- **Pinned commit:** `a1cbc78df43dfb48641fe9f290c0477e854b4459` (2026-11-20)
- **Lifecycle:** active
- **Demonstrates:** scsynth server + sclang client architecture (OSC protocol between them): the canonical client/server live-coding and generative-audio engine.
- **Implementation lessons:**
  - GPL-3.0 is strong copyleft: distributing sclang/scsynth derivatives (including some plugin-bundled apps) carries source obligations; scsynth's OSC interface lets GPL engine and proprietary client coexist across a protocol boundary — a recurring licensing pattern.
  - Server/client split demonstrates protocol-based isolation for both latency and license reasons.
  - UGen graph state is process-local: reproducibility requires scd source + version + seed, never just a bounced file.

### essentia — MTG/essentia

- **URL:** https://github.com/MTG/essentia
- **Category:** mir-library
- **License:** AGPL-3.0 (with upstream contribution terms; also historically available under commercial license from UPF) — GitHub license API (verified 2026-11-21)
- **Pinned commit:** `df27f949d7827a43b4afc216fd5c788454b0f8a4` (2026-11-18)
- **Lifecycle:** active (Universitat Pompeu Fabra Music Technology Group)
- **Demonstrates:** Industrial-strength MIR feature extraction and inference (incl. ONNX model zoo): reference algorithms for tonal/rhythm/timbre descriptors (Bogdanov et al., ACM MM 2013).
- **Implementation lessons:**
  - AGPL-3.0 extends copyleft to network use: a SaaS calling Essentia must offer source — this single fact changes product architecture; permissive alternative for closed products is librosa.
  - Pretrained model files carry their own licenses separate from the code license — check per model before shipping.
  - Descriptor definitions are versioned algorithms: cite Essentia version + algorithm parameters in MIR reports.

### librosa — librosa/librosa

- **URL:** https://github.com/librosa/librosa
- **Category:** mir-library
- **License:** ISC — GitHub license API (verified 2026-11-21)
- **Pinned commit:** `6b624ff6edf22ec19ceff1df5ec03013902ab763` (2026-11-20)
- **Lifecycle:** active
- **Demonstrates:** The permissive Python MIR baseline (McFee et al., SciPy 2015): spectral features, onset/beat/tempo, CQT/chroma; teaching reference for MIR labs.
- **Implementation lessons:**
  - ISC posture makes it the safe default when AGPL/GPL engines are excluded; state this choice explicitly in architecture notes.
  - Defaults matter (hop length, n_fft, centering): feature comparability across studies requires declaring them — reproducibility contract §17.
  - NumPy/SciPy version drift changes numerics at the margins; pin the environment for benchmark fixtures.

### mir-eval — craffel/mir_eval

- **URL:** https://github.com/craffel/mir_eval
- **Category:** evaluation-metrics
- **License:** MIT — LICENSE.txt read (file SHA ae0c0b8eb2b3ac302264f925c4c58892c7759722); note GitHub's license API returned null for this repo — file inspection beats API detection (verified 2026-11-21)
- **Pinned commit:** `862261303e42a24bb7eec6333df03d7100af5f93` (2026-11-12) — packaging modernization to pyproject; mir_eval.separation module removed in 0.9.0dev — API-surface lesson
- **Lifecycle:** active maintenance (modernized packaging 2026-11)
- **Demonstrates:** Transparent reference implementations of MIR metrics (Raffel et al., ISMIR 2014): the citation unit for 'how was this score computed' in every MIR claim.
- **Implementation lessons:**
  - Metrics have definitions with parameters (tolerance windows etc.): report metric + parameterization, never a bare number.
  - Module removal in a minor version (separation, load_wav) shows even slow libraries break APIs — pin versions and read changelogs.
  - License-file presence did not register in GitHub's API: verification protocol must include file reads, not just the API.

### vexflow — 0xfe/vexflow

- **URL:** https://github.com/0xfe/vexflow
- **Category:** notation-rendering
- **License:** MIT text (GitHub: NOASSERTION due to header wording) — LICENSE read via license API — verbatim MIT permission text (verified 2026-11-21)
- **Pinned commit:** `a0c4d47a6baa0e0b85a6b56876bd1ba057b6bc31` (2025-03-05)
- **Lifecycle:** slow/maintenance — last default-branch commit 2025-03; SMuFL-based rendering mature
- **Demonstrates:** Browser notation engraving with SMuFL fonts: the render layer for web notation labs and education apps (used widely, e.g., in practice platforms).
- **Implementation lessons:**
  - Slow commit cadence + heavy downstream use = pin version and treat as stable dependency; do not assume active security patching.
  - Rendering correctness is font-dependent (SMuFL metadata): declare font + version in fixtures.
  - NOASSERTION again resolved by file read — third instance confirming the protocol.

### tuning-library — surge-synthesizer/tuning-library

- **URL:** https://github.com/surge-synthesizer/tuning-library
- **Category:** microtuning
- **License:** MIT — GitHub license API (verified 2026-11-21)
- **Pinned commit:** `d6fcc08f938cc2ad812b82f83e59e2b4070afdb7` (2026-10-19) — bugfix + added ASAN/UBSAN CI — memory-safety practice lesson
- **Lifecycle:** active — maintained by the Surge Synth Team (open-source synth organization)
- **Demonstrates:** Maintained C++ implementation of Scala .scl/.kbm microtuning formats: the practical bridge from tuning theory (§12) to instruments; used across the open synth ecosystem.
- **Implementation lessons:**
  - Tuning data is data: keyboard mapping (.kbm) vs. scale (.scl) separation is the teaching point for 'reference pitch + map' discipline.
  - The recent ASAN/UBSAN addition models the memory-safety bar for audio code handling untrusted files (user-supplied .scl files are untrusted input).
  - MIT posture enables embedding in commercial synths — the ecosystem's reason for choosing it.

### pedalboard — spotify/pedalboard

- **URL:** https://github.com/spotify/pedalboard
- **Category:** audio-effects
- **License:** GPL-3.0 — GitHub license API (verified 2026-11-21)
- **Pinned commit:** `ef2aa99cfd1f3e8fa7b253756036fdbcf229eec6` (2026-11-09)
- **Lifecycle:** active (Spotify Audio Intelligence Lab)
- **Demonstrates:** Pythonic audio effects over JUCE internals, with VST3/AU plugin loading: deterministic offline processing for dataset augmentation and QC pipelines.
- **Implementation lessons:**
  - GPL-3.0 (chosen because JUCE modules used under GPL) propagates: including pedalboard in a distributed product or internal tooling that is conveyed triggers copyleft — record before adoption.
  - Loading third-party VST3 plugins inherits each plugin's license — plugin wrappers do not launder proprietary terms.
  - Offline render APIs make bit-exact regression tests possible: freeze parameters, buffer size, and sample rate in the fixture.
