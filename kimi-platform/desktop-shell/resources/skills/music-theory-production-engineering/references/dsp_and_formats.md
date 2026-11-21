# DSP, Synthesis, DAW Engineering, and Dependency License Postures

Source: `civilization_design_music_research.md` Part II §16 (2026-11-21) plus the 13-case repo inspection record (`music_theory_audio_repo_cases.json`; human-readable in `repo_casebook.md`). Verified 2026-11-21; re-verify at point of use.

## 1. Texts

- **Free, rigorous:** Julius O. Smith III (CCRMA, Stanford), *Introduction to Digital Filters with Audio Applications* and *Physical Audio Signal Processing*, free at https://ccrma.stanford.edu/~jos/; his *Spectral Audio Signal Processing* (W3K, 2011) likewise free online.
- **Reference:** Udo Zölzer (ed.), *DAFX: Digital Audio Effects* (2nd ed., Wiley, 2011); Joshua Reiss & Andrew McPherson, *Audio Effects: Theory, Implementation and Application* (CRC, 2014); Will Pirkle, *Designing Audio Effect Plugins in C++* (2nd ed., 2019); Vesa Välimäki and colleagues on physical modeling and artificial reverberation.

## 2. Sampling discipline

- Nyquist–Shannon: cite Claude Shannon, "Communication in the Presence of Noise," *Proc. IRE* 37 (1949).
- Aliasing and quantization: dither/noise shaping per Lipshitz, Wannamaker & Vanderkooy, "Quantization and Dither," *JAES* 40(5) (1992).
- **State the sample rate in every artifact and every test.** Declared sample rate is part of the reproducibility contract.

## 3. Synthesis methods (with origin credits)

- **FM:** John Chowning, "The Synthesis of Complex Audio Spectra by Means of Frequency Modulation," *JAES* 21(7) (1973) — the DX7's basis, historically patent-licensed.
- **Subtractive, additive, wavetable:** standard taxonomy per the texts above.
- **Granular:** Curtis Roads, *Microsound* (MIT, 2001).
- **Physical modeling:** Karplus–Strong (1983); Julius O. Smith's digital waveguides.

## 4. Plugin/API landscape — license posture is architecture

License choice changes product design: copyleft engines impose different obligations than permissive libraries, and the decision must be **recorded before adoption** (see repo_casebook.md for the full register with pinned commits).

| Tool | License (verified 2026-11-21) | Architectural consequence |
|---|---|---|
| Web Audio API spec (`WebAudio/web-audio-api`) | W3C Software and Document License | Normative browser graph API (nodes, AudioWorklet, automation timelines); quote behavior by spec version — v1.1-era errata actively landing |
| Tone.js (`Tonejs/Tone.js`) | MIT | Browser scheduling/synth units; safe for commercial web deliverables; pin exact version (high release cadence); Web Audio clock, not setTimeout, for sample-accurate timing |
| JUCE | Dual: GPLv3 / commercial, plus free tier with revenue cap | **Check current terms; do not assume** |
| VST3 SDK | Steinberg proprietary license | Proprietary; review per-use |
| LV2 | Open (ISC-style) | Permissive plugin standard |
| FAUST (`grame-cncm/faust`) | Compiler GPL; **generated DSP code takes the library license** | Verify per-use which license the output carries |
| Pure Data | BSD-style | Permissive patching |
| Csound (`csound/csound`) | LGPL-2.1 | Scriptable synthesis engine; linking obligations for distribution |
| SuperCollider (`supercollider/supercollider`) | GPL-3.0 | Server/synthesis engine; copyleft on distribution |
| Essentia (`MTG/essentia`) | AGPL-3.0 (also historically commercial from UPF) | **Network use triggers source obligations** — a product-architecture decision, not an afterthought |
| librosa (`librosa/librosa`) | ISC | Permissive MIR analysis |
| mir_eval (`mir-evaluation/mir_eval`) | MIT | The transparent metric reference implementation — cite it |
| pedalboard (`spotify/pedalboard`) | GPL-3.0 | Copyleft audio effects for Python |
| MuseScore (`musescore/MuseScore`) | GPL-3.0 with font exception (bundled fonts GNU Freefont with embedding exception) | Notation rendering; font embedding treated specially |
| VexFlow (`0xfe/vexflow`) | MIT text (GitHub NOASSERTION due to header wording) | Browser notation rendering, SMuFL-aware; slow/maintenance lifecycle |
| music21 (`cuthbertLab/music21`) | BSD-3-Clause | Computational analysis; report method+parameters+corpus, not score "properties" |
| `w3c/musicxml` | No repo-level LICENSE; W3C Community Contributor License Agreement governs contributions | Treat spec text under W3C document terms and record this when excerpting |
| `surge-synthesizer/tuning-library` | MIT | Scala .scl/.kbm implementation; ASAN/UBSAN CI is the model for parsing untrusted tuning files |

## 5. DAW reality

- No open standard for full project interchange. AAF/OMF (AMWA) and the newer DAWproject format (Bitwig + PreSonus, open, https://github.com/bitwig/dawproject — **not inspected this pass; verify before citing**) exist for interchange.
- Session reproducibility means **freezing stems + recording plugin versions/settings**, not assuming project portability.

## 6. Untrusted inputs

User-supplied `.scl`/`.kbm`, samples, and plugin files are parsed defensively — tuning-library's ASAN/UBSAN CI is the model. Determinism rule: every render declares sample rate, buffer size, tool versions, and seeds; offline pipelines are regression-tested.
