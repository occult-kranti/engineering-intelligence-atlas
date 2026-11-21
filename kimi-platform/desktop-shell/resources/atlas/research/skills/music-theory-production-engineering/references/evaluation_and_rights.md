# Evaluation (MIR, Listening Tests, Loudness) and Rights/Provenance Gates

Source: `civilization_design_music_research.md` Part II §§17–18 (2026-11-21). **This file is an evidence map for the rights gate, not legal advice.** Jurisdiction is always stated; contested or unresolved items are labeled; legal questions route to counsel.

## Part A — Music information retrieval and reproducible evaluation

**Textbook:** Meinard Müller, *Fundamentals of Music Processing* (2nd ed., Springer, 2021) — open access, https://link.springer.com/book/10.1007/978-3-030-69808-9, with the accompanying FMP Python notebooks.

**Libraries (repo cases; license posture is architecture):**
- librosa (ISC) — McFee et al., "librosa: Audio and Music Signal Analysis in Python," *Proc. SciPy* 2015, https://doi.org/10.25080/Majora-7b98e3ed-003
- Essentia (**AGPL-3.0** — network-use copyleft) — Bogdanov et al., "Essentia: An Audio Analysis Library for Music Information Retrieval," *ACM MM* 2013, https://doi.org/10.1145/2502081.2502229
- mir_eval (MIT) — Raffel et al., "mir_eval: A Transparent Implementation of Common MIR Metrics," ISMIR 2014 — the evaluation-metrics reference implementation.

**Datasets with license posture:**
- MAESTRO (Hawthorne et al., ICLR 2019) — **CC BY-NC-SA 4.0: non-commercial research use only.**
- FMA (Defferrard et al., ICASSP 2017).
- GTZAN — widely used but documented faults: Bob Sturm, "The GTZAN dataset: Its contents, its faults, their effects on evaluation," *Computer Music Journal* 38(1) (2014): 50–66 — **required reading before any genre-classification claim.**
- OpenSLR / NSynth — CC BY 4.0.
- RWC — licensed/restricted; **do not redistribute.**

**Perceptual evaluation standards:**
- ITU-R BS.1116-3 (critical listening, small impairments); ITU-R BS.1534-3 (MUSHRA); ABX for discrimination.
- PEAQ (ITU-R BS.1387) as an objective estimate of basic audio quality — state its known limits; ViSQOL v3 (Chinen et al., 2020, open source) for speech/audio quality.
- Human listening tests need a consent protocol and disclosed subject selection/training; **report confidence intervals, not single means.**
- **Honesty rule for this skill:** the bundled `scripts/wav_metrics.py` computes sample-domain RMS / peak / DC offset only. It is **not** a BS.1770 LUFS meter and **not** a true-peak meter. LUFS claims require a fully implemented BS.1770 chain (K-weighting, gating); true-peak requires oversampling per BS.1770. Do not fabricate either.

**Reproducibility contract for audio results:** dataset version + split, exact metric implementation (cite mir_eval or pin your own), tool versions, sample rates, seeds, loudness normalization state (BS.1770), and failure cases. ML-based audio claims additionally need train/test leakage checks and dataset-license compatibility review.

## Part B — Rights gates (US-centric baseline; always name jurisdiction)

### B.1 Rights architecture (US)

- Two distinct copyrights per recorded song: the **musical work** (composition) and the **sound recording** (master). 17 U.S.C. §§ 102, 106, 114.
- Compulsory mechanical licensing for compositions: 17 U.S.C. § 115, restructured by the **Music Modernization Act (2018)** creating the Mechanical Licensing Collective (MLC), https://www.themlc.com/. Public performance via PROs (ASCAP/BMI/SESAC/GMR) under consent-decree oversight.
- Synchronization, sampling clearance, and master use are **negotiated licenses** — there is no compulsory sampling license.

**Sampling case law is circuit-split — report it as such:**
- *Grand Upright Music v. Warner Bros.*, 780 F. Supp. 182 (S.D.N.Y. 1991) — early injunction-era case; historical context, not a general rule.
- *Bridgeport Music v. Dimension Films*, 410 F.3d 792 (6th Cir. 2005) — "get a license or do not sample": **no de minimis defense** for digital sampling of sound recordings in the Sixth Circuit. Opinion via Justia: https://law.justia.com/cases/federal/appellate-courts/F3/410/792/574458/
- *VMG Salsoul v. Ciccone*, 824 F.3d 871 (9th Cir. 2016) — de minimis **is** available for sound-recording sampling in the Ninth Circuit. The split is **unresolved as of 2026-11-21.**
- *Newton v. Diamond*, 388 F.3d 1189 (9th Cir. 2004) — composition vs. recording distinction: recording licensed, composition claim failed as de minimis/unoriginal.
- Fair use remains a separate, fact-specific defense in all circuits: *Campbell v. Acuff-Rose Music*, 510 U.S. 569 (1994) (transformativeness).

**Prohibited shortcuts (block on sight, with sourced correction):** "X seconds is safe" (no such rule exists in either circuit); "changing pitch/tempo makes it legal"; "non-commercial = fair use"; "crediting the artist = permission."

### B.2 Voice, likeness, and AI-era persona rights

- Right-of-publicity anchors: *Midler v. Ford Motor Co.*, 849 F.2d 460 (9th Cir. 1988) (sound-alike vocal imitation); *Waits v. Frito-Lay*, 978 F.2d 1093 (9th Cir. 1992).
- **Tennessee ELVIS Act** (Ensuring Likeness, Voice, and Image Security Act of 2024, Tenn. Pub. Ch. 588, HB 2091; signed 2024-03-21, effective 2024-07-01): adds voice (including simulations) to the protected property right; liability for distributing tools whose primary purpose is producing an identifiable person's voice/likeness without authorization; standing extended to exclusive licensees. Official text: https://www.capitol.tn.gov/Bills/113/Bill/HB2091.pdf
- **California 2024 digital-replica statutes** (AB 1836 — deceased personalities; AB 2602 — living performers' contract protections): verify current codified text before citing; statutory interpretation belongs to counsel.
- **Federal NO FAKES Act** — introduced, **not enacted** as of 2026-11-21; do not cite as law.
- **US Copyright Office AI reports:** "Copyright and Artificial Intelligence" Part 2 (Copyrightability, Jan 2025): prompts alone do not confer human authorship; human authorship remains required. Part 3 (Generative AI Training, pre-publication 2025) addresses training-data questions without resolving them. https://www.copyright.gov/ai/ . *Thaler v. Perlmutter* (D.C. Cir. 2025) affirmed the human-authorship requirement. Pending litigation (e.g., RIAA members v. Suno/Udio, filed 2024) is **unresolved** — outcomes must not be asserted.

### B.3 Licensing and provenance practice (operational gates)

- **Provenance log for every artifact:** for each input asset record {source URL + retrieval date, rights holder, license type + exact version, permission scope, attribution string, alterations allowed}. The bundled fixtures' own log is `fixtures/provenance.json` — use it as the template.
- **Sample libraries:** record the EULA; many "royalty-free" libraries prohibit use in AI training or in derived sample packs — check per-product terms.
- **Creative Commons discipline:** CC0 ≠ CC BY ≠ CC BY-NC ≠ CC BY-SA ≠ CC BY-ND; NC bars commercial use; SA conditions derivatives; ND bars adaptation. Public-domain status of an underlying work does not license a modern recording/photograph of it.
- **AI-generated content gate:** disclose AI involvement; check ELVIS-Act-style persona rules if any voice/likeness is emulated; record model/tool name and version; check the generator's terms for commercial use and training-data representations. Do not claim copyright registrability for unassisted AI output (USCO Part 2 position).
- **Content credentials:** C2PA manifests for provenance attestation, https://c2pa.org/ — recommended, not yet universally adopted.
- **EU angle (name jurisdiction):** EU AI Act (Regulation (EU) 2024/1689) transparency obligations phase in through 2026–2027; Article 53 GPAI duties applied from August 2025 with enforcement ramping — check the current application timeline before asserting obligations.

### B.4 Legal verify-at-use rule

Case law evolves, bills get enacted, licenses change terms. Every legal-status statement in a deliverable must carry a **verification date** and a re-check instruction; statuses recorded here are the 2026-11-21 baseline. Unsettled law stays labeled unsettled: certainty theater fails review.
