# Theory Foundations — Acoustics, Tuning, Dated Western Theory, Notation & Formats

Source: `civilization_design_music_research.md` Part II §§11–13, 15 (panel report, 2026-11-21). Every claim below is dated/regionalized. URLs verified live 2026-11-21 unless noted; re-verify at point of use.

## 1. Acoustics and psychoacoustics

**Core texts**
- Neville Fletcher & Thomas Rossing, *The Physics of Musical Instruments* (2nd ed., Springer, 1998).
- Thomas Rossing, F. Richard Moore & Paul Wheeler, *The Science of Sound* (3rd ed., 2002).
- Brian C. J. Moore, *An Introduction to the Psychology of Hearing* (6th ed., Brill, 2012).
- Eberhard Zwicker & Hugo Fastl, *Psychoacoustics: Facts and Models* (2nd ed., Springer, 1999) — critical bands, masking, loudness models.

**Standards (cite the current revision)**
- ISO 226:2023, equal-loudness-level contours — cite the **2023 revision**, not the Fletcher–Munson curves as the current standard. https://www.iso.org/standard/83117.html
- ITU-R BS.1770-5 loudness algorithm and EBU R128 for program loudness (LUFS) in delivery. https://www.itu.int/rec/R-REC-BS.1770/ and https://tech.ebu.ch/docs/r/r128.pdf
- AES standards: https://www.aes.org/publications/standards/

**Key quantitative facts the panel uses**
- Harmonic series as integer frequency ratios (the acoustic basis for just intonation; timbre-dependent — see Sethares below).
- Just-noticeable-difference values are context-dependent; always state test conditions when quoting one.
- Room acoustics via Sabine/Eyring reverberation formulas **with stated assumptions**; ISO 3382 governs measurement.

**Standing rule:** psychoacoustics ≠ aesthetics. Perceptual findings (consonance, loudness, masking) constrain but do not legislate musical value.

## 2. Tuning and temperament — numeric discipline

**Formula:** cents = 1200·log2(f2/f1). Known vectors (bundled script `scripts/ratio_cents.py --self-test` verifies these to 0.001 cent):

| Interval | Ratio | Cents |
|---|---|---|
| Octave | 2:1 | 1200.000 |
| Just fifth | 3:2 | 701.955 |
| Just major third | 5:4 | 386.314 |
| Syntonic comma | 81:80 | 21.506 |
| Pythagorean comma | 531441:524288 | 23.460 |
| 12-TET semitone | 2^(1/12) | 100.000 |

Any temperament description states **which comma(s) it distributes and where** (e.g., quarter-comma meantone narrows fifths to flatten the syntonic comma; well temperaments distribute the Pythagorean comma unequally, giving key-color variation; 12-TET distributes it uniformly, making all fifths ~1.955¢ narrow).

**History with priority accuracy (no diffusionism either direction)**
- **Zhu Zaiyu (朱載堉)**, Ming prince, published equal-temperament calculations in *Lülü jingyi* (1584 preface; calculations documented earlier in the 1580s) — the earliest documented computation of equal temperament to high precision. Source: Fritz A. Kuttner, "Prince Chu Tsai-Yü's Life and Work: A Re-Evaluation of His Contribution to Equal Temperament Theory," *Ethnomusicology* 19(2) (1975): 163–206.
- **Simon Stevin**, *Van de Spiegheling der Singconst* (c. 1585–1605, unpublished until 1884) — the **independent** European computation. Neither implies the other; no diffusionist claim.

**Reference works**
- J. Murray Barbour, *Tuning and Temperament: A Historical Survey* (1951; Dover 2004) — uncited tuning history fails review without this level of anchoring.
- William Sethares, *Tuning, Timbre, Spectrum, Scale* (2nd ed., Springer, 2005) — the timbre–consonance interaction that justifies non-12-tone systems on acoustic grounds.
- Harry Partch, *Genesis of a Music* (2nd ed., 1974) — documented idiosyncratic just-intonation practice; his 43-tone system is his own instrument-bound practice, **not** "natural tuning."

**Well temperament ≠ equal temperament.** Owen Jorgensen, *Tuning* (1991); the Barnes/Lindley debate on Bach's WTC tunings (John Barnes, "Bach's Keyboard Temperament: Internal Evidence from the Well-Tempered Clavier," *Early Music* 7(2) (1979): 236–249). Any claim about "Bach's temperament" must be labeled **hypothesis** — there is no surviving Bach tuning instruction. Kellner's squiggle hypothesis is popular folklore-level: never cite as settled.

**Modern tool lesson:** Scala `.scl`/`.kbm` (Manuel Op de Coul's Scala program) is the de facto exchange format for microtonal tunings; `surge-synthesizer/tuning-library` (MIT — repo case) is its maintained open implementation.

## 3. Harmony, counterpoint, rhythm, form, timbre (Western tradition, dated)

Teach each as a documented historical style/school, never as universal rule.

- **Counterpoint:** Johann Joseph Fux, *Gradus ad Parnassum* (1725; Alfred Mann's English translation, *The Study of Counterpoint*, 1943/1965) — species method as documented 18th-century pedagogy. Knud Jeppesen, *Counterpoint: The Polyphonic Vocal Style of the Sixteenth Century* (1939 English ed.) for Palestrina-style analysis.
- **Harmony:** Walter Piston, *Harmony* (5th ed., 1987). Open-access alternative: *Open Music Theory* (2nd ed., 2022, Vanderbilt University Library, CC BY-SA), https://viva.pressbooks.pub/openmusictheory/ — a genuinely open textbook with integrated workbook.
- **Schenkerian analysis:** Heinrich Schenker, *Der freie Satz* (1935; English *Free Composition*, Oster trans., 1979) — influential, contested, and ideologically loaded in origin; teach as one analytical school **with its critics** (Journal of Music Theory critiques; musicology-of-the-canon literature).
- **Rhythm/meter:** Justin London, *Hearing in Time* (2nd ed., Oxford, 2012) — meter as entrainment, cross-culturally careful. Grosvenor Cooper & Leonard B. Meyer, *The Rhythmic Structure of Music* (1960) for grouping.
- **Form:** William Caplin, *Classical Form* (Oxford, 1998). Lerdahl & Jackendoff, *A Generative Theory of Tonal Music* (MIT, 1983) — landmark but not empirically settled; label as theory.
- **Mathematical rhythm analysis (modern, credited):** Godfried T. Toussaint, "The Euclidean Algorithm Generates Traditional Musical Rhythms," *Bridges 2005*: 47–56, and *The Geometry of Musical Rhythm* (2nd ed., CRC Press, 2019). Bjorklund's accelerator algorithm (2003) rediscovered as generating maximally-even patterns matching documented timelines (e.g., the Cuban tresillo E(3,8), the 12/8 bell-pattern E(5,12) family). **Attribution discipline:** Toussaint's cultural attributions come from ethnomusicological literature and must not be flattened into "all cultures share one rhythm" (see culturally_specific_theory.md §5). Demaine et al., "The Distance Geometry of Music," *Computational Geometry* 42(5) (2009): 429–454 for rhythm similarity measures.
- **Timbre:** John M. Grey, "Multidimensional Perceptual Scaling of Musical Timbres," *JASA* 61(5) (1977): 1270–1277 — the classic timbre-space study. Stephen McAdams & Bruno Giordano, "The Perception of Musical Timbre," in *The Oxford Handbook of Music Psychology* (2nd ed., 2016).

## 4. Notation, MIDI, and data formats

- **Common Western notation engraving:** Kurt Stone, *Music Notation in the Twentieth Century* (1980); Elaine Gould, *Behind Bars* (Faber, 2011) — the current engraving standard.
- **MusicXML 4.x:** W3C Music Notation Community Group, https://www.w3.org/2021/06/musicxml40/ and repo `w3c/musicxml` (repo case; **no repo-level LICENSE** — governed by W3C Community Contributor License Agreement; MusicXML 4.0 Recommendation published 2021). Originated by Michael Good (Recordare → MakeMusic), donated to the W3C CG in 2015.
- **MEI (Music Encoding Initiative):** TEI-style XML for scholarly encoding, https://music-encoding.org/ — the scholarly-edition choice.
- **Humdrum `**kern`:** Craig Stuart Sapp's toolkit for computational analysis, https://www.humdrum.org/.
- **SMuFL** (Standard Music Font Layout; SIL OFL font metadata standard), https://w3c.github.io/smufl/latest/ — with the Bravura reference font.
- **MIDI:** MIDI 1.0 Detailed Specification (MIDI Manufacturers Association, 1996 ed., at https://midi.org/specs); MIDI 2.0 core spec + MIDI-CI + MPE (MPE is the MIDI 1.0-era per-note-expression convention adopted into the MIDI 2.0 ecosystem). **Teaching rule:** MIDI encodes performance events, not audio; note numbers are convention — middle C = 60 in the common numbering, and you must state the convention.
- **Audio formats/codecs:** WAV/BWF (EBU Tech 3285), FLAC (lossless, RFC 9639), MP3/AAC/Opus with stated bitrates; Opus = RFC 6716, royalty-free, the modern open choice.

## 5. Banned phrasings in this skill's outputs

- "Pure"/"natural" tuning or intervals without ratio/cent values and reference pitch.
- "Better sounding" without a cited listening-test result (and its method).
- Universalizing: "music is a universal language," "all cultures share the pentatonic scale."
- "Bach's temperament" without a hypothesis label.
- Any tuning statement without reference pitch and temperament name.
