# Symmetry & Proportion Protocols

Contents: shared vocabulary · classification protocol (7 frieze / 17 wallpaper) · color-symmetry criteria · the Alhambra census dispute · documented-proportion register · golden-ratio folklore control.

## Shared mathematical vocabulary

- **Frieze (border) groups: 7. Wallpaper (plane crystallographic) groups: 17.** Classification proved by Fedorov (1891) and Pólya (1924). Recognition procedure and notation: Doris Schattschneider, "The Plane Symmetry Groups: Their Recognition and Notation," *American Mathematical Monthly* 85 (1978): 439–450. Definitive reference: Grünbaum & Shephard, *Tilings and Patterns* (W. H. Freeman, 1987; 2nd ed. Dover 2016).
- **Transformations:** rigid isometries (translation, rotation, reflection, glide reflection), similarity/dilation, and grid-based affine constructions — the working set for ornament analysis and for the SVG labs.
- **Tilings:** isohedral tilings (93 IH types; Kaplan's Tactile library, repo case, BSD-3-Clause, pinned), substitution/Penrose tilings (de Bruijn 1981), girih/polygonal strapwork. **Modern classification does not imply historical makers classified** — it is an analytical lens; say so every time.
- Modern notation (crystallographic symbols, orbifold notation, IH incidence symbols) is never attributed to historical makers' intentions.

## Classification protocol (declare criteria first)

A group verdict without a criteria statement is rejected. Before any count, declare:

1. **Color handling:** is a symmetry that permutes colors counted as a symmetry of the colored pattern (color-symmetry group), or is the underlying uncolored pattern classified? State which. The Alhambra debate turned exactly on this. Standard anthropological protocol: Washburn & Crowe, *Symmetries of Culture* (University of Washington Press, 1988); field application: *Symmetry Comes of Age* (2004).
2. **Extension rule:** is the verdict about a single tile/block, a finite panel, or the idealized infinitely extended pattern? Finite fragments underdetermine the group; state the assumption.
3. **Census followed:** which published count is being followed when the literature disagrees (see Alhambra below).
4. **Recognition procedure:** apply the Schattschneider (1978) flowchart (highest rotation order → reflection axes → glide relations) and record the path taken, not just the verdict.
5. **Tolerance:** geometric tests carry an explicit numeric tolerance; no raw `==` on coordinates (coordinate with computational-geometry-engineering).

Disputed or unclassifiable cases are reported as disputed/unclassifiable with provenance — fail-stop beats invention.

## The Alhambra census dispute (teach the history, not a flattened number)

| Census | Count of 17 | Note |
|---|---|---|
| Müller 1944 (Zürich dissertation) | 11 | first group-theoretic study of the Alhambra ornament |
| Grünbaum, Grünbaum & Shephard 1986 (*Comp. & Math. with Appl.* 12B: 641–653) | at most 13 | stricter color-symmetry handling |
| Pérez-Gómez 1987 | claims the missing four | contested |
| Grünbaum 2006 (*Notices of the AMS* 53(6): 670–673) | challenge | rejects loose classification and color handling |
| Bodner 2013 (*Bridges 2013*: 225–232) | 14 | explicit criteria stated |

**Panel rule:** the popular claim "the Alhambra contains all 17 wallpaper groups" is contested. Output reports the range with criteria and cites the census followed.

## Quasiperiodicity claims (mandatory counterweights)

Lu & Steinhardt 2007 (*Science* 315: 1106–1110) proposed girih-tile near-quasicrystallinity at Darb-i Imam (Isfahan, 1453). Never state this without: Makovicky's comment and the authors' reply (*Science* 318 (2007): 1383) and Cromwell, "Cognitive Bias and Claims of Quasiperiodicity in Traditional Islamic Patterns," *Mathematical Intelligencer* 37(4) (2015): 30–44. The claim is disputed; present the dispute.

## Documented-proportion register (the only allowed proportion evidence)

Proportion claims require a treatise, drawing, canon grid, workshop manual, inscription, or consistent metrological study — never a ratio fitted onto a photograph.

| System | Document | Region/period | Notes |
|---|---|---|---|
| Robins canon grid | grids surviving on unfinished reliefs; Robins, *Proportion and Style in Ancient Egyptian Art* (1994) | dynastic Egypt | 18 squares hairline-to-sole (Old/Middle Kingdom standing figures); 21 squares (Third Intermediate/Late); Amarna canon shows documented change (c. 1353–1336 BCE) |
| ad quadratum pinnacle procedure | Roriczer, *Büchlein von der Fialen Gerechtigkeit* (Regensburg, 1486); facsimile/transcription in Shelby (1977) | Regensburg lodge | explicit rotation-of-squares; implemented as lab L4 |
| Lodge geometry debate | Ackerman 1949 (Milan Cathedral, 1390s) | Lombard vs. northern masters | square- vs. triangle-based rules argued and recorded — plural systems, no secret canon |
| Villard portfolio | BnF MS fr. 19093 (c. 1225–35) | Picard lodge context | teaching aids, not construction documents |
| Topkapı Scroll | Topkapı Palace Museum Library MS H.1956; Necipoğlu (1995) | Timurid/Turkmen, 15th–16th c. | girih/muqarnas as annotated 2D projections |
| al-khatt al-mansub | later manuals crediting Ibn Muqla (d. 940, Baghdad); Tabbaa 1991 | Abbasid Iraq | rhombic nib-dot module; alif + circle |
| Roman modular practice | Wilson Jones, *Principles of Roman Architecture* (2000) — metrological/survey argument | Roman, late Republic–High Empire | whole-number modules and √2-type relations; explicitly not golden ratio |
| Egyptian seked / modular planning | Rossi (2004) | dynastic Egypt | whole-number slopes against esoteric readings |
| Mughal grid-and-module planning | Koch (1991, 2006) plan analyses | Mughal Agra/Delhi, 1526–1707 | documented grids; no primary evidence for "Taj golden ratio" |

## Golden-ratio folklore control

George Markowsky, "Misconceptions about the Golden Ratio," *College Mathematics Journal* 23 (1992): 2–19 (doi:10.1080/07468342.1992.11973428), plus Mario Livio, *The Golden Ratio* (2002). Claims about the Parthenon, pyramids, Nautilus, or "universal aesthetic phi" are folklore. Any golden-ratio/Fibonacci assertion in art or architecture fails review unless a primary design document shows it. The mathematics-research skill's safety note governs recurrence/priority history; coordinate formal claims there.
