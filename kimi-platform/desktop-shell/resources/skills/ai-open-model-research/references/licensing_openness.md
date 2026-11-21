# AI Open-Model Research — Licensing and Openness

Compiled 2026-11-20 from `sota_open_model_landscape.md` §1, §8. License terms change per revision — re-read the LICENSE file at the pinned revision before any adoption decision. Classifications here are informational, not legal advice.

## Contents

1. The O0–O7 openness spectrum — 2. Structural rules — 3. License traps to check at pin time — 4. Selection gate order — 5. Re-verification triggers

## 1. The O0–O7 openness spectrum

"Open" is an eight-position spectrum, not a binary. An artifact's tier can differ for its code, weights, and data — record the most restrictive relevant component and note splits explicitly. Never conflate "open weights" with "open source."

| Tier | Name | Definition | Representative artifacts (2026-11-20 snapshot) |
|---|---|---|---|
| O0 | Full open source | Weights + training code + training data open under permissive terms | SmolLM3-3B, OLMo 3 7B (language); Molmo2, OpenCUA (MIT incl. AgentNet data); Boltz-1/2, BoltzGen, Evo 2 (incl. 8.8T-bp OpenGenome2), ACE2, AIFS (CC-BY weights + Apache Anemoi), Biomni, Walrus |
| O1 | Open weights + open code, permissive | Apache-2.0/MIT-class; data/recipe undisclosed | Qwen3.x line, DeepSeek V3.2/V4.x (MIT), gpt-oss-120b/20b, GLM-5.3-Flash (MIT), Gemma 4, Mistral Small 4; Qwen3-VL, Z-Image Turbo, Qwen-Image-2512, Wan2.2, Qwen3-ASR/TTS, PaddleOCR-VL-1.6, GLM-OCR (MIT); TRELLIS.2 (MIT), TripoSR, openpi π0/π0.5, OpenVLA, GR00T N-series, Matrix-Game, V-JEPA 2 |
| O2 | Open weights, custom conditional license | Permissive-style but with revenue/MAU/MaaS triggers or security-review clauses | Kimi K3.1 Pro (extra terms >$20M rev or >100M MAU), GLM-5.3 ($10B-revenue MaaS security review), Mistral Large 4 (Ecosystem OWL; MaaS needs separate license), Muse Spark Open (>$20M/yr API providers), NVIDIA OpenMDW-1.1 artifacts (Nemotron 3 Ultra, VoiceChat) |
| O3 | Revenue-capped / territory-restricted community | Free below a revenue threshold or excluded jurisdictions | FLUX 3 Image Klein (free <$5M), LTX-2.5 (paid ≥$10M), SD3.5 (<$1M), MiniMax H3 / H3-Image (exclude US/EU/UK/KR), Hunyuan3D 2.1 (excludes EU/UK/South Korea; 1M-MAU cap; no training non-Hunyuan models on outputs) |
| O4 | Non-commercial / research-only | No commercial use of weights (output terms may vary) | MiniMax M3 (non-commercial by default), Qwen-Image-2.1 (Qwen Research License), FLUX.2 [dev] & [klein] 9B, YuE2 (CC BY-NC 4.0), Breeze TTS 2, LingBot-World 2.0 (CC BY-NC-SA), Nucleotide Transformer v1/v2, XTTS v2, Holo4-27B, Fish Speech 1.5 (CC-BY-NC-SA) |
| O5 | Gated | Download requires application, license acceptance, or consent flow | AlphaFold 3 weights (academic/non-commercial, non-redistributable), Meta UMA (FAIR Chemistry License application), AlphaGenome weights, SAM 3D Objects/Body, NVIDIA PersonaPlex-7B, Pocket TTS cloning repo (consent terms), Chandra OCR 2 (modified OpenRAIL-M) |
| O6 | Hosted-only (no weights) | API/service access only | Wan 2.5/2.6/2.7 (verified no weights 2026-10-05), FLUX 3, Qwen-Image-3.0, Qwen3.8-Max/Qwen4-Max, MiniMax M3 API tiers, UI-TARS-2, Chai-2, Kosmos, Google AI Co-Scientist, AlphaEvolve, AlphaProof/AlphaGeometry 2 |
| O7 | Quarantined (project policy) | Verified-uninstallable or unverifiable artifacts that must not ship | Nonexistent official GGUF (HF 404 for `Qwen/Qwen3-Coder-30B-A3B-Instruct-GGUF`); community quants lacking pinned `.src_sha` provenance; needs-re-verification list (Qwen3-TTS, Qwen-Image 2.1, FLUX 3 [klein], Qwen3.5/3.8, Gemma 4, SAM 3D, Devstral Small 2) — must not ship until card-level verification; TripoSR and TRELLIS.2 reference-only under no-remote-code policy |

## 2. Structural rules

- **O0 is rare and concentrated** — two small language models, scientific computing (weather, proteins, genomics), one VLM family. No frontier-scale LLM discloses training data.
- **The license–quality relationship inverts by domain** — in image/video the strongest open weights are non-permissive (H3-Image Elo 1066, territory-excluded; Qwen-Image-2.1 Elo 1047, research-only), while the strongest unconditionally permissive stack sits ~100–230 Elo lower; in OCR and English ASR permissive sub-1.5B specialists top the independent boards outright. The permissive tier, not the arena leaderboard, is the operative frontier for most builders.
- **Quarantine is a first-class tier, not an oversight** — exclusion-by-policy of exactly-verified artifacts (wrong provenance, dead license links, remote-code requirements) is the standard to adopt.
- **Permissiveness can regress mid-family or mid-life** — Mistral Large 4 moved Apache-2.0 → custom OWL with a MaaS clause; Gemma 4 moved custom → Apache-2.0; LingBot-World v1 Apache → v2 CC BY-NC-SA. Re-check at every pin.

## 3. License traps to check at pin time

- **Sibling splits** — artifacts in one family routinely carry different licenses: FLUX.2 [klein] 4B Apache vs 9B non-commercial; LingBot-World v1 Apache vs v2 CC BY-NC-SA. Classify each artifact, never the family.
- **Territorial exclusions** — MiniMax H3/H3-Image exclude US/EU/UK/KR; Hunyuan3D 2.1 excludes EU/UK/South Korea. "Open-weight" can be unusable in the user's jurisdiction regardless of technical merit.
- **Revenue/MAU/MaaS triggers** — Kimi (>$20M revenue or >100M MAU), GLM-5.3 ($10B MaaS security review), Muse (>$20M/yr API providers), LTX-2.5 (≥$10M), MinerU2.5-Pro (>100M MAU/$20M). Match the trigger against the user's actual use case.
- **Dead license links / metadata-only declarations** — Qwen3-Coder-Next declares Apache-2.0 in card metadata but ships no LICENSE file and its card license_link is dead [R]. A declaration without a license text is a finding, not a clearance.
- **Dual inheritance** — Foundation-Sec-8B carries Meta Llama 3.1 Community terms (base) plus Cisco Apache-2.0 (modifications); review NOTICE files.
- **Gating masks hashes** — gated repos (e.g., FLUX.1-schnell) mask LFS sha256 for anonymous clients; hash-verification happens only after the user's own authenticated download.
- **Namespace resurrection** — deleted registry namespaces are re-registerable; confirm the repo still exists and is the official publisher. Prefer official org repos; treat established quantizers (unsloth, bartowski) as such but require pinned base-model provenance (`.src_sha`).
- **Maintenance status** — retired or quiet repos (Chatterbox retired Aug 2026, Kokoro unmaintained since Jan 2025, UI-TARS quiet since Nov 2025) are supply-chain and support risks independent of license.

## 4. Selection gate order

License before benchmarks. Recommended order for any adoption recommendation:

1. **Task classification** → model class (see [modality_map.md](modality_map.md)).
2. **Openness gate** — default to O1 (Apache/MIT open weights); prefer O0 where it exists. O2–O5 require explicit per-model license acknowledgment with the license text displayed to the user. O6 routes to the hosted/provider seam. O7 is blocked.
3. **Hardware-fit gate** — see [hardware_safety.md](hardware_safety.md).
4. **Evidence gate** — see [evaluation.md](evaluation.md).
5. **Safety gate** — see [hardware_safety.md](hardware_safety.md).
6. **Pinned, quarantine-staged delivery** — explicit-consent download at the pinned revision, sha256 verification, quarantine staging before activation, no remote model code.

A model that fails gate 2 is excluded regardless of scores at gate 4. Always end commercial-adoption recommendations with: "read the license text at the pinned revision."

## 5. Re-verification triggers

Raise a re-verification alert when any of these change materially: license text or tier, pinned revision/SHA, gating status, leaderboard position, runtime support (llama.cpp/vLLM for novel architectures), or repo maintenance activity. Mark stale findings for re-verification rather than silently aging them.
