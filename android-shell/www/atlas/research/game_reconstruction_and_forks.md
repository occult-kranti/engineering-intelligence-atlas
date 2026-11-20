# Game Reconstruction Catalog, Graphics/Engine Software Analysis, and REA Fork Report

**Generated:** 2026-11-20 (UTC) · **Scope:** reverse-engineered and reconstructed games, graphics/engine tooling, and the REA (Reverse Engineer Anything) tool/catalog ecosystem, including a bounded official-API fork analysis.
**Evidence basis:** local verified evidence files only — `.work/games.json`, `.work/awesome_rea_catalog.json`, `.work/awesome_rea_repository_index.json`, `.work/interoperability.json`, `.work/rea_topic_snapshot.json`, `.work/reverse_correction_summary.json`, and `reverse_engineered_software_landscape.xlsx` — plus a small number of *targeted* official GitHub REST API calls (repository metadata and `/forks` endpoints for the two identified REA repositories and one Battle City repository). No indiscriminate re-crawling was performed; no analyzed software was executed. Input-evidence SHA-256 hashes are recorded in [`.work/reverse_correction_summary.json`](https://github.com/reacher-z/Awesome-REA) companion build metadata (`acquisition_hashes_sha256`).

---

## 0. Key counts at a glance

| Metric | Count | Source (evidence tier) |
|---|--:|---|
| Games-catalog records | **3,030** (3,013 games + 17 mods) | `.work/games.json` (Tier 2) |
| Unique game titles covered | 2,911 | `.work/games.json` |
| Browser-playable entries | 42 | `.work/games.json` |
| Games rows with AI-assistance flag | 747 (2,283 unflagged) | `.work/games.json` |
| Games link-check results | 3,028 × HTTP 200; 1 × 401; 1 × 403 | `.work/games.json`, correction summary |
| Curated REA catalog resources | 5,191 (910 tools) | `.work/awesome_rea_catalog.json` (Tier 1) |
| Game-analysis tools (curated catalog filter F1) | 139 tools / 150 rows | `.work/awesome_rea_catalog.json` |
| Graphics/engine tools (filters F2∪F3∪F1-tools union) | 282 unique tools | `.work/awesome_rea_catalog.json` |
| Interoperability catalog rows | 17,667 (6,071 in game category) | `.work/interoperability.json` (Tier 3) |
| Topic snapshot (popularity-biased sample) | 485 repos | `.work/rea_topic_snapshot.json` (Tier 5) |
| In-scope unique projects across all sources | 22,522 | correction summary / workbook |
| `morluto/rea` official metadata | 470,359 stars; **114,893 forks** | GitHub REST API, 2026-11-20 |
| `reacher-z/Awesome-REA` official metadata | 3,222 stars; 537 forks reported / **539 fork objects enumerated** | GitHub REST API, 2026-11-20 |
| REA `/forks` endpoint reliability | intermittent **HTTP 500** (empty body); no complete census possible | GitHub REST API, 2026-11-20 |

> **Non-claims (read first):** stars and fork counts are point-in-time catalog/API metadata — they are **not** quality, correctness, safety, or adoption evidence. Nothing in this report is legal clearance for any reconstruction activity. "Link-checked" means an HTTP status was observed, not that content is accessible or usable. See §6.

---

## 1. Methodology and evidence tiers

### 1.1 Method

1. **Local-evidence-first.** All catalog content comes from the six local evidence files above, which were produced by earlier verified collection passes (hashes pinned in the correction summary). No catalog was re-scraped for this report.
2. **Targeted official-API verification only.** The only live calls were GitHub REST `GET /repos/{owner}/{repo}` and `GET /repos/{owner}/{repo}/forks` for `morluto/rea` (the REA tool), `reacher-z/Awesome-REA` (the REA catalog), and `cyneprepou4uk/NES-Games-Disassembly` (the Battle City case repository). Every HTTP status, including failures, is preserved verbatim in §4.
3. **No deduplication of games rows.** All 3,030 records are reproduced in §2 exactly as exported, including the 14 rows that share one repository root (the Battle City / NES-Games-Disassembly subpath case, §4.4) and the 14 repeated record keys noted in the correction summary. Distinct curated entries are never silently merged.
4. **Filtered subsets are labeled as filters.** Every count in §3 names its filter (F1–F4, I1–I3) and source; no filtered subset is presented as "all software."
5. **No execution.** No repository, binary, ROM, or build script was run. Activity is assessed only from recorded metadata (`last_commit`, `pushed_at`, health labels).

### 1.2 Evidence tiers (inherited from the landscape build)

| Tier | Source file | Records | Meaning |
|---|---|--:|---|
| **Tier 1** — source-reviewed curated catalog | `.work/awesome_rea_catalog.json` ([awesomerea.org](https://awesomerea.org)) | 5,191 | Human-reviewed against primary sources; `verified_at` is a **review date, not activity** |
| **Tier 2** — link-checked games catalog | `.work/games.json` | 3,030 | Per-row HTTP link status; curator scores and AI flags are curator-defined |
| **Tier 3** — community interoperability catalog | `.work/interoperability.json` ([awesome.alexgaoth.com](https://awesome.alexgaoth.com/), [repo](https://github.com/alexgaoth/awesome-reverse-engineered)) | 17,667 | Community curation with activity enrichment |
| **Tier 4** — automated README-scan index | `.work/awesome_rea_repository_index.json` | 3,500 (191 flagged excluded) | Unreviewed machine classification; leads, not facts |
| **Tier 5** — topic-search sample | `.work/rea_topic_snapshot.json` | 485 | Top-100-by-stars × 5 GitHub topics; **popularity-biased, not a census** |

The correction pass (`.work/reverse_correction_summary.json`, 2026-11-20) established: 29,873 source records → 22,711 repository-root groups → 22,522 in-scope unique projects after removing 189 excluded-only Tier-4 projects; 5,139 projects appear in ≥2 sources (corroborated listings, not independent verification).

---

## 2. Full games catalog — 3,013 games + 17 mods

Source: `.work/games.json` (generated 2026-11-19T12:04:56Z). Upstream sources merged by that catalog:
[SamidyFR/Game-Decompilations](https://github.com/SamidyFR/Game-Decompilations) (666 rows), [Quiver Launcher](https://quiverlauncher.com/) (1,081, ≥100-star filter), [unbaked.games](https://unbaked.games/) (2,184, ≥10-star GitHub entries), [CharlotteCross1998/awesome-game-decompilations](https://github.com/CharlotteCross1998/awesome-game-decompilations) (473), [radek-sprta/awesome-game-remakes](https://github.com/radek-sprta/awesome-game-remakes) (277), [portsdr.com](https://portsdr.com/) (260, ≥10 stars), [decomp.dev](https://decomp.dev/), [recompiledgames.com](https://recompiledgames.com/) (37), [recomp.fyi](https://recomp.fyi/) (30, ≥10 stars), [BlueInterlude/awesome-recompilations](https://github.com/BlueInterlude/awesome-recompilations) (23), [X/@RadiantOpti browser list](https://x.com/RadiantOpti/status/2108068632991256995) (21), [bailo167/awesome-game-mashups](https://github.com/bailo167/awesome-game-mashups) (19, CC0, ≥25 stars), r/[recomps](https://www.reddit.com/r/recomps/)/r/decomps (48, hand-picked), manual (2). Source-key counts exceed 3,030 because entries are multi-sourced.

**Legend.** *Stars* = GitHub stars at catalog generation (metadata only). *Last activity* = `last_commit` date. *Link* = observed HTTP status at 2026-11-19 link check; **†** = repository archived. *AI* = curator-set AI-assistance flag. Rows are grouped by reconstruction type, then sorted by platform, then stars.

**Type summary:**

| Type | Rows | AI-flagged | Inactive | Top platforms (n) |
|---|--:|--:|--:|---|
| static-recomp | 1,009 | 464 | 8 | Xbox 360 (241), PS1 (107), N64 (83), PC (80), PS2 (64), og Xbox (61), Switch (60) |
| decompilation | 920 | 82 | 148 | PC (149), N64 (100), PS1 (88), PS2 (81), GameCube (66), GBA (45) |
| engine-remake | 409 | 94 | 45 | PC (239), DOS (11), PS2 (11), Mobile (9) |
| source-port | 364 | 95 | 35 | PC (95), DOS (48), N64 (34), PS4 (31), GameCube (26) |
| disassembly | 238 | 0 | 130 | NES (52), SNES (33), Game Boy (23), GBC (21), GBA (18) |
| browser-port | 57 | 7 | 4 | PC (39) |
| tool | 16 | 4 | 0 | PC (8) |
| mod | 17 | 1 | 0 | PC (15) |
| **Total** | **3,030** | **747** | 370 (games only; mods carry no inactivity flag) | — |

Health labels (active/inactive, cutoff 2024-11-19): 2,643 active / 370 inactive across the 3,013 game rows; with mods counted as health-unknown, the correction summary reports 2,613 active / 356 inactive / 61 unknown across all 3,030 rows (definitions differ by source labeling — both are quoted, not reconciled). Link-check exceptions: `grand-theft-auto-v` returned **401**, `super-mario-64-multiplayer` returned **403**; the upstream `link_ok` flag is `True` for all 3,030 rows, so link-OK must not be read as "accessible." 33 repositories were archived at catalog time.


### 2.1 Static recompilations — 1009 rows

*Console/PC binaries statically recompiled to native code (N64Recomp, XenonRecomp, ReXGlue, ps1/ps2 recomp, ...).*

| # | Title (link = project URL) | Platform | Stars | Last activity | Link | AI |
|--:|---|---|--:|---|:--:|:--:|
| 1 | [Ocarina of Time 3D (TriAevum Recomp)](https://github.com/coccofresco/TriAevum) | 3DS | 741 | 2026-11-12 | 200 | AI |
| 2 | [Metroid: Samus Returns (msr2ds)](https://github.com/gminustwo/msr2ds) | 3DS | 268 | 2026-11-18 | 200 | AI |
| 3 | [The Legend of Zelda: Ocarina of Time 3D (Ocarina ReTuned)](https://github.com/OTPR26/Ocarina-ReTuned) | 3DS | 132 | 2026-11-13 | 200 | — |
| 4 | [Shin Megami Tensei IV (Shin Megami Tensei IV for PC (smt4-recomp))](https://github.com/Invictus-potens/smt4-recomp) | 3DS | 104 | 2026-11-15 | 200 | AI |
| 5 | [Monster Hunter 4 Ultimate (MH4U for Android)](https://github.com/khorne-hub/4u-native) | 3DS | 99 | 2026-11-18 | 200 | — |
| 6 | [Monster Hunter 3 Ultimate (Cha-Cha)](https://github.com/BoyClinton/Cha-Cha) | 3DS | 74 | 2026-11-12 | 200 | — |
| 7 | [Fire Emblem: Awakening (fe-awakening-recomp)](https://github.com/Zelkin1/fe-awakening-recomp) | 3DS | 48 | 2026-11-13 | 200 | AI |
| 8 | [Pilotwings Resort (Woohoo Flight School)](https://github.com/thefixinhixon/woohoo-flight-school) | 3DS | 29 | 2026-11-14 | 200 | AI |
| 9 | [James Pond 2: Codename RoboCod (James Pond 2: Codename RoboCod - Recompiled)](https://github.com/griches/JamesPond2RobocodRecomp) | ami | 25 | 2026-10-28 | 200 | — |
| 10 | [Daytona Arcade Recomp](https://github.com/alphanu1/daytona-arcade-recomp) | Arcade | 257 | 2026-11-05 | 200 | — |
| 11 | [Daytona USA (daytona-xbla-recomp)](https://github.com/Subarasheese/daytona-xbla-recomp) | Arcade | 223 | 2026-07-08 | 200 | — |
| 12 | [Street Fighter Alpha 2 (CPS-2 Recomp)](https://github.com/tmcleroy/cps2recomp) | Arcade | 205 | 2026-11-19 | 200 | AI |
| 13 | [Initial D Arcade Stage 3 (Initial D Arcade Stage 3 Recompiled)](https://github.com/distilledorion-sketch/Initial-D-Arcade-Stage-3-Native-SH-4-Recompilation-WIP-) | Arcade | 176 | 2026-11-07 | 200 | — |
| 14 | [Virtua Fighter 3 (Virtua Fighter 3 Recomp)](https://github.com/mr-finster/vf3-recomp) | Arcade | 123 | 2026-11-15 | 200 | AI |
| 15 | [Virtua Fighter 2 (Virtua Fighter 2 Recomp)](https://github.com/mr-finster/vf2-recomp) | Arcade | 105 | 2026-11-16 | 200 | AI |
| 16 | [Virtua Fighter (Virtua Fighter Recomp)](https://github.com/mr-finster/vf1-recomp) | Arcade | 94 | 2026-11-16 | 200 | AI |
| 17 | [Tekken 3 (Tekken3Recompiled)](https://github.com/FishB0nes98/Tekken3Recompiled) | Arcade | 89 | 2026-09-23 | 200 | — |
| 18 | [Spikeout: Final Edition (Spikeout: Final Edition Recomp)](https://github.com/tastyrepublic/spikeout-recomp) | Arcade | 64 | 2026-11-18 | 200 | AI |
| 19 | [Mario Kart Arcade GP 2 (OpenGP)](https://github.com/OpenGP-dev/OpenGP) | Arcade | 63 | 2026-11-18 | 200 | AI |
| 20 | [Thrill Drive 2 (konami-viper-recomp)](https://github.com/spita90/konami-viper-recomp) | Arcade | 59 | 2026-11-19 | 200 | — |
| 21 | [Ridge Racer](https://github.com/kazuyette/rr-decomp) | Arcade | 50 | 2026-10-10 | 200 | — |
| 22 | [Fate/Unlimited Codes (FateUnlimitedCodesRecomp (fuc-recomp))](https://github.com/elprogramadorloco-arch/fuc-recomp) | Arcade | 37 | 2026-10-17 | 200 | — |
| 23 | [Dead or Alive ++ (Jiggle-or-Physics)](https://github.com/3dge7161/Jiggle-or-Physics) | Arcade | 31 | 2026-10-02 | 200 | — |
| 24 | [Super Hang-On (Super Hang-On Ultimate)](https://github.com/chaotix359/Super-Hang-On-Ultimate) | Arcade | 23 | 2026-11-14 | 200 | AI |
| 25 | [Sega Rally Championship (segarally95-recomp)](https://github.com/xandoxan65/segarally95-recomp) | Arcade | 17 | 2026-10-22 | 200 | — |
| 26 | [The King of Fighters '98 (KOF'98 Recomp)](https://github.com/danilopaulinodasilva/kof98recomp) | Arcade | 17 | 2026-11-03 | 200 | AI |
| 27 | [The Simpsons Arcade Game (simpsonsarcade-ps3)](https://github.com/sp00nznet/simpsonsarcade-ps3) | Arcade | 17 | 2026-10-14 | 200 | — |
| 28 | [Daytona USA (model2recomp)](https://github.com/sp00nznet/model2recomp) | Arcade | 16 | 2026-10-21 | 200 | — |
| 29 | [Emergency Call Ambulance (Emergency Call Ambulance - Static Recompilation)](https://github.com/thefixinhixon/emergency-call-ambulance-recomp) | Arcade | 14 | 2026-11-16 | 200 | AI |
| 30 | [After Burner Climax (After Burner Climax Recompiled)](https://github.com/darkuni/afterburner-climax-recomp) | Arcade | 12 | 2026-10-31 | 200 | — |
| 31 | [The Simpsons Arcade Game](https://github.com/sp00nznet/simpsonsarcade) | Arcade | 12 | 2026-10-14 | 200 | — |
| 32 | [Tekken 6 (Azazel6)](https://github.com/zxyandreay/azazel6) | Arcade | 11 | 2026-11-19 | 200 | — |
| 33 | [Crazy Taxi (crazytaxi (dcrecomp))](https://github.com/sp00nznet/crazytaxi) | Arcade | 10 | 2026-10-21 | 200 | — |
| 34 | [Jurassic Park Arcade (Jurassic Park Arcade Quest)](https://github.com/Lovecore/jurassic-park-arcade-quest) | Arcade | 10 | 2026-10-21 | 200 | — |
| 35 | [Mushihimesama Futari (futari_recomp)](https://github.com/springah/futari_recomp) | Arcade | 10 | 2026-11-15 | 200 | — |
| 36 | [Senjin Aleste (Senjin Aleste native port)](https://github.com/kazuyette/senjin-recomped) | Arcade | 10 | 2026-11-11 | 200 | — |
| 37 | [F-15 II](https://github.com/neuviemeporte/f15se2-re) | DOS | 149 | 2026-09-06 | 200 | — |
| 38 | [Ultima 7 Decomp](https://github.com/Kitrinx/Ultima7_Decomp) | DOS | 104 | 2026-10-24 | 200 | AI |
| 39 | [Underworld Exhumed](https://github.com/abedegno/underworld-exhumed) | DOS | 95 | 2026-11-17 | 200 | — |
| 40 | [Ecstatica (EcstaticaRecompiled)](https://github.com/spacefarergames/EcstaticaRecompiled) | DOS | 46 | 2026-05-20 | 200 | — |
| 41 | [PlayStunts](https://github.com/ACatWithEbola/playstunts) | DOS | 45 | 2026-11-17 | 200 | — |
| 42 | [Betrayal at Krondor](https://github.com/canassa/betrayal-at-krondor) | DOS | 39 | 2026-08-02 | 200 | — |
| 43 | [Doom (DoomSNESRecomp)](https://github.com/Cacodemontube/DoomSNESRecomp) | DOS | 24 | 2026-10-22 | 200 | — |
| 44 | [re-stunts](https://github.com/CommonLoon102/restunts-bb11) | DOS | 23 | 2026-11-19 | 200 | — |
| 45 | [Quarantine (quarantine-recomp)](https://github.com/second-save/quarantine-recomp) | DOS | 21 | 2026-11-04 | 200 | — |
| 46 | [Grand Theft Auto (gta)](https://github.com/sp00nznet/gta) | DOS | 17 | 2026-08-26 | 200 | — |
| 47 | [Theme Park (themepark-recomp)](https://github.com/sp00nznet/themepark-recomp) | DOS | 17 | 2026-11-14 | 200 | — |
| 48 | [Ultima Underworld (uw1-pocketpc-decomp)](https://github.com/Interrupt/ultima-underworld) | DOS | 12 | 2026-11-12 | 200 | — |
| 49 | [TFX (TFX Enhanced)](https://github.com/Buyukcaglar/tfx-enh) | DOS | 10 | 2026-11-08 | 200 | — |
| 50 | [Flycast](https://github.com/flyinghead/flycast) | Dreamcast | 2,661 | 2026-11-13 | 200 | AI |
| 51 | [Sonic Adventure](https://github.com/sonicfreak1337/SARecomp) | Dreamcast | 128 | 2026-10-18 | 200 | AI |
| 52 | [SoulCalibur (voldorium)](https://github.com/enrique363/voldorium) | Dreamcast | 96 | 2026-11-17 | 200 | AI |
| 53 | [Space Channel 5](https://github.com/ZoomiesZaggy/Space-Channel-5) | Dreamcast | 27 | 2026-10-18 | 200 | — |
| 54 | [Sonic Adventure (sa1-psp)](https://github.com/countallegrex/sa1-psp) | Dreamcast | 15 | 2026-10-28 | 200 | — |
| 55 | [Blue Stinger](https://github.com/DCRecomp/BlueStingerRecomp) | Dreamcast | 13 | 2026-11-19 | 200 | — |
| 56 | [Pokémon Fulldex](https://github.com/mamesj/pokemon-fulldex) | DS | 1,190 | 2026-11-18 | 200 | AI |
| 57 | [Metroid Prime Hunters (MetroidPrimeHuntersRecomp)](https://github.com/mstan/MetroidPrimeHuntersRecomp) | DS | 289 | 2026-11-17 | 200 | AI |
| 58 | [Pokémon SoulSilver (ssrecomp)](https://github.com/ClickingMaster/ssrecomp) | DS | 142 | 2026-10-22 | 200 | AI |
| 59 | [Chrono Trigger (Egg of Time)](https://github.com/power-pudu/egg-of-time) | DS | 125 | 2026-11-17 | 200 | AI |
| 60 | [Mario Kart DS (DS Kart Recompiled)](https://github.com/AlonsoTlol/DS-Kart-Recompiled) | DS | 81 | 2026-11-17 | 200 | AI |
| 61 | [Dragon Quest IV: Chapters of the Chosen (DQIV-Recompiled)](https://github.com/GoldieLeGenie/DQIV-Recompiled) | DS | 75 | 2026-10-25 | 200 | — |
| 62 | [Metroid Prime Hunters (HuntersRecomp (AYN Thor))](https://github.com/aabrole/HuntersRecomp) | DS | 48 | 2026-09-06 | 200 | — |
| 63 | [Pokémon Mystery Dungeon: Explorers of Sky (SkyRecompiled)](https://github.com/DarthMDev/pmd-sky-recomp) | DS | 23 | 2026-11-18 | 200 | AI |
| 64 | [Super Mario 64 DS (supermario64dsrecomp)](https://github.com/mstan/supermario64dsrecomp) | DS | 22 | 2026-09-09 | 200 | — |
| 65 | [Dragon Quest IX: Sentinels of the Starry Skies (DQ9-Decomp)](https://github.com/dq9-remastered/DQ9-Remastered) | DS | 21 | 2026-10-30 | 200 | — |
| 66 | [Inazuma Eleven 3: Sekai heno Chousen!! The Ogre (Inazuma Eleven 3: The Ogre — Recomp)](https://github.com/matheus2x/ie3ogre-nds-recomp) | DS | 11 | 2026-11-15 | 200 | AI |
| 67 | [Pokemon RBY / GSC / FRLF / RSE (G1R Deluxe)](https://github.com/bryanthaboi/gen1recomp) | Game Boy | 4,187 | 2026-11-17 | 200 | AI |
| 68 | [GB Enhanced+ (GBE Plus)](https://github.com/shonumi/gbe-plus) | Game Boy | 600 | 2026-10-01 | 200 | — |
| 69 | [Wario Land: Super Mario Land 3 (Bigodão)](https://github.com/GABRIELNNK/Bigodao) | Game Boy | 33 | 2026-11-04 | 200 | AI |
| 70 | [Super Mario Land 2: 6 Golden Coins (SuperMarioLand2Recomp)](https://github.com/mstan/SuperMarioLand2Recomp) | Game Boy | 22 | 2026-11-14 | 200 | — |
| 71 | [Kirby's Dream Land (Kirby-Dream-Land-Recomp)](https://github.com/omegakatana92/Kirby-Dream-Land-Recomp) | Game Boy | 17 | 2026-08-30 | 200 | — |
| 72 | [Pokémon Red and Blue (PokemonRedAndBlueRecomp)](https://github.com/mstan/PokemonRedAndBlueRecomp) | Game Boy | 12 | 2026-07-23 | 200 | — |
| 73 | [Pokémon Yellow (PokemonYellowRecomp)](https://github.com/mstan/PokemonYellowRecomp) | Game Boy | 10 | 2026-07-23 | 200 | — |
| 74 | [Tetris (TetrisGBRecomp)](https://github.com/mstan/TetrisGBRecomp) | Game Boy | 10 | 2026-08-17 | 200 | AI |
| 75 | [Pokemon Gold / Silver / Crystal (Gen2Recomped)](https://github.com/UNDERdecoded/Gen2Recomped) | Game Boy Color | 474 | 2026-11-12 | 200 | — |
| 76 | [Resident Evil Gaiden (Resident Evil Gaiden: Recompiled)](https://github.com/sergiomanzur/regaiden-recomp) | Game Boy Color | 63 | 2026-11-07 | 200 | AI |
| 77 | [The Legend of Zelda: Oracle of Ages (Epoch & Equinox)](https://github.com/ZakyPew/epoch-equinox) | Game Boy Color | 26 | 2026-09-27 | 200 | — |
| 78 | [The Legend of Zelda: The Wind Waker (BlueWake)](https://github.com/chrissotraidis/bluewake) | GameCube | 647 | 2026-11-16 | 200 | AI |
| 79 | [MeleePC](https://github.com/999sian/melee-pc) | GameCube | 612 | 2026-10-20 | 200 | AI |
| 80 | [The Legend of Zelda: The Wind Waker (Wind-Waker-Recomp (BlueWake fork))](https://github.com/elliotttate/Wind-Waker-Recomp) | GameCube | 595 | 2026-10-04 | 200 | — |
| 81 | [Luigi's Mansion (Luigi's Mansion Recompiled)](https://github.com/rob646464/luigis-mansion-recompiled) | GameCube | 359 | 2026-11-12 | 200 | AI |
| 82 | [Eternal Darkness: Sanity's Requiem (Eternal Darkness Recomp)](https://github.com/griches/EternalDarknessRecomp) | GameCube | 215 | 2026-11-06 | 200 | AI |
| 83 | [Super Mario Sunshine (SunPad)](https://github.com/chrissotraidis/sunpad) | GameCube | 203 | 2026-11-14 | 200 | — |
| 84 | [Soulcalibur II (Ring Out)](https://github.com/jackpoison-prog/RingOut) | GameCube | 197 | 2026-11-18 | 200 | AI |
| 85 | [Skies of Arcadia Legends (Skies of Arcadia Legends: Recompiled)](https://github.com/ogdanimal/SkiesOfArcadiaLegends-Recomp) | GameCube | 189 | 2026-10-22 | 200 | AI |
| 86 | [Super Smash Bros. Melee (Melee Unlocked)](https://github.com/Hero88go/melee-unlocked) | GameCube | 172 | 2026-11-19 | 200 | AI |
| 87 | [Super Smash Bros. Melee (FRAY)](https://github.com/PsiLupan/FRAY) | GameCube | 94 | 2020-07-19 | 200 | — |
| 88 | [Sonic Riders (sonic-riders-recomp)](https://github.com/teclilla18/sonic-riders-recomp) | GameCube | 73 | 2026-11-19 | 200 | AI |
| 89 | [Sonic Adventure 2: Battle (OpenSA2)](https://github.com/kittycache9/OpenSA2) | GameCube | 52 | 2026-11-08 | 200 | — |
| 90 | [Metal Gear Solid: The Twin Snakes (msg-twinsnakes-recomp)](https://github.com/alphanu1/msg-twinsnakes-recomp) | GameCube | 44 | 2026-09-26 | 200 | — |
| 91 | [NBA Street V3](https://github.com/recomp-code/street-recomp-v3) | GameCube | 36 | 2026-10-23 | 200 | — |
| 92 | [Wario World (Wario World Recomp)](https://github.com/BigSnek9/wario-world-recomp) | GameCube | 28 | 2026-10-27 | 200 | AI |
| 93 | [Sonic Adventure 2: Battle (sa2-nx)](https://github.com/ChanseyIsTheBest/sa2-nx) | GameCube | 27 | 2026-11-05 | 200 | — |
| 94 | [Mario Kart: Double Dash!! (mariokartdd-recomp)](https://github.com/ethannicholas/mariokartdd-recomp) | GameCube | 23 | 2026-10-22 | 200 | — |
| 95 | [Luigi's Mansion (LM-NX)](https://github.com/StevensND/lm-nx) | GameCube | 18 | 2026-11-01 | 200 | — |
| 96 | [The Legend of Zelda: The Wind Waker (ww (sp00nznet gcrecomp))](https://github.com/sp00nznet/ww) | GameCube | 18 | 2026-08-23 | 200 | — |
| 97 | [Shadow the Hedgehog (STH Recompiled)](https://github.com/FlyinRabit205/STH-Recompiled) | GameCube | 16 | 2026-11-14 | 200 | — |
| 98 | [Harry Potter and the Chamber of Secrets (HPCOS-GC-RECOMP)](https://github.com/ant0-blase/HPCOS-GC-RECOMP) | GameCube | 12 | 2026-11-04 | 200 | — |
| 99 | [Medal of Honor: Frontline (Medal of Honor: Frontline (Recompiled))](https://github.com/goodshepherd23/MOHFrontline-Recomp) | GameCube | 12 | 2026-11-13 | 200 | AI |
| 100 | [Metroid Prime (prime-recomp (ethannicholas))](https://github.com/ethannicholas/prime-recomp) | GameCube | 12 | 2026-10-22 | 200 | — |
| 101 | [Custom Robo (Custom Robo Recomp)](https://github.com/alexander-clawthorne/custom-robo-recomp) | GameCube | 11 | 2026-10-29 | 200 | — |
| 102 | [Harry Potter and the Sorcerer's Stone (GekkoAOT target)](https://github.com/ant0-blase/GekkoAOT) | GameCube | 11 | 2026-11-05 | 200 | — |
| 103 | [Wave Race: Blue Storm (bluestorm-recomp)](https://github.com/ethannicholas/bluestorm-recomp) | GameCube | 11 | 2026-10-28 | 200 | — |
| 104 | [Final Fantasy Tactics Advance (FFTARecomp)](https://github.com/Jorge262007/FFTARecomp) | GBA | 234 | 2026-11-01 | 200 | AI |
| 105 | [MOTHER 3 (MOTHER 3 Recomp)](https://github.com/josiahg2502-glitch/Mother3Recomp) | GBA | 130 | 2026-10-28 | 200 | AI |
| 106 | [Golden Sun (GSRecomp)](https://github.com/Shmargus/GSRecomp) | GBA | 102 | 2026-11-18 | 200 | AI |
| 107 | [Mario Kart: Super Circuit (Mario Kart: Super Circuit Recompiled)](https://github.com/mstan/MarioKartSuperCircuitRecomp) | GBA | 89 | 2026-11-14 | 200 | AI |
| 108 | [Pokemon Emerald (EmeraldRecomp)](https://github.com/mstan/EmeraldRecomp) | GBA | 57 | 2026-11-14 | 200 | AI |
| 109 | [Final Fantasy Tactics Advance (FFTA Recomp)](https://github.com/james2doyle/ffta-recomp) | GBA | 54 | 2026-11-18 | 200 | AI |
| 110 | [Pokemon Emerald 3D (pokeemerald-3d)](https://github.com/tripplyons/pokeemerald-3d) | GBA | 51 | 2026-09-25 | 200 | AI |
| 111 | [Pokemon FireRed (FireRedLeafGreenRecomp)](https://github.com/mstan/FireRedLeafGreenRecomp) | GBA | 42 | 2026-11-06 | 200 | AI |
| 112 | [The Legend of Zelda: The Minish Cap (MinishCapRecomp)](https://github.com/mstan/MinishCapRecomp) | GBA | 41 | 2026-11-17 | 200 | — |
| 113 | [Dragon Ball Z: Buu's Fury (Dragon Ball Z: Buu's Fury Recomp)](https://github.com/mstan/DragonBallZBuusFuryRecomp) | GBA | 39 | 2026-11-16 | 200 | AI |
| 114 | [Mother 3 (Mother3Recomp)](https://github.com/agray0425/Mother3Recomp) | GBA | 33 | 2026-09-24 | 200 | — |
| 115 | [Fire Emblem: The Sacred Stones (SacredStonesRecomp)](https://github.com/Lordingard/SacredStonesRecomp) | GBA | 32 | 2026-10-17 | 200 | — |
| 116 | [Super Mario World: Super Mario Advance 2 (SuperMarioAdvance2Recomp)](https://github.com/mstan/SuperMarioAdvance2Recomp) | GBA | 32 | 2026-11-15 | 200 | AI |
| 117 | [WarioWare: Twisted! (WarioWare: Twisted! Recomp)](https://github.com/mstan/WarioWareTwistedRecomp) | GBA | 30 | 2026-11-06 | 200 | AI |
| 118 | [Super Mario Advance 4: Super Mario Bros. 3 (Super Mario Advance 4 Recomp)](https://github.com/mstan/SuperMarioAdvance4Recomp) | GBA | 29 | 2026-11-16 | 200 | AI |
| 119 | [Pokemon Ruby (RubySapphireRecomp)](https://github.com/mstan/RubySapphireRecomp) | GBA | 28 | 2026-11-11 | 200 | AI |
| 120 | [Mega Man Zero (MegaManZeroRecomp)](https://github.com/mstan/MegaManZeroRecomp) | GBA | 27 | 2026-11-14 | 200 | AI |
| 121 | [Pokémon Mystery Dungeon: Red Rescue Team (pmd-green (Green Rescue Team))](https://github.com/Asphaltian/pmd-green) | GBA | 20 | 2026-10-28 | 200 | — |
| 122 | [Dragon Ball Z: The Legacy of Goku II (Dragon Ball Z: The Legacy of Goku II Recomp)](https://github.com/mstan/DragonBallZLegacyofGokuIIRecomp) | GBA | 19 | 2026-11-16 | 200 | AI |
| 123 | [Sonic Advance (SonicAdvanceRecomp)](https://github.com/smiluredev/SonicAdvanceRecomp) | GBA | 19 | 2026-08-24 | 200 | — |
| 124 | [Yoshi's Island: Super Mario Advance 3 (SMA3 Recomp Android – Yoshi's Island: Super Mario Advance 3 PC port)](https://github.com/Edwin2929/sma3-recomp-android.) | GBA | 19 | 2026-10-30 | 200 | — |
| 125 | [Pokémon FireRed and LeafGreen (PokeRecomp)](https://github.com/sonsegajp/PokeRecomp) | GBA | 16 | 2026-10-14 | 200 | — |
| 126 | [Dragon Ball Z: The Legacy of Goku (DragonBallZLegacyOfGokuRecomp)](https://github.com/mstan/DragonBallZLegacyOfGokuRecomp) | GBA | 14 | 2026-11-11 | 200 | — |
| 127 | [Sonic the Hedgehog 2 (SonicTheHedgehog2Recomp)](https://github.com/mstan/SonicTheHedgehog2Recomp) | Genesis | 44 | 2026-11-19 | 200 | AI |
| 128 | [Streets of Rage (StreetsOfRageProject)](https://github.com/RuiNelson/StreetsOfRageProject) | Genesis | 42 | 2026-11-19 | 200 | — |
| 129 | [Sonic 3 & Knuckles (Sonic3AndKnucklesRecomp)](https://github.com/mstan/Sonic3AndKnucklesRecomp) | Genesis | 35 | 2026-11-19 | 200 | AI |
| 130 | [Sonic the Hedgehog (SonicTheHedgehogRecomp)](https://github.com/mstan/SonicTheHedgehogRecomp) | Genesis | 32 | 2026-11-19 | 200 | — |
| 131 | [Streets of Rage Collection](https://github.com/OriginalSwayze/Streets-of-Rage-Collection-Recomp) | Genesis | 22 | 2026-11-16 | 200 | AI |
| 132 | [Rings of Power (RROP)](https://github.com/kruzeman/RROP) | Genesis | 11 | 2026-11-02 | 200 | — |
| 133 | [Rocksmith 2014 Remastered (RS Re-ARMed)](https://github.com/bbelgg/rs-rearmed) | Mac | 33 | 2026-11-18 | 200 | — |
| 134 | [LEGO The Hobbit (Hobbit Recompiled)](https://github.com/itsdunintime104/HobbitRecompiled) | Mac | 10 | 2026-11-03 | 200 | — |
| 135 | [Sonic the Hedgehog (8-bit) (SonicTheHedgehogSMSRecomp)](https://github.com/mstan/SonicTheHedgehogSMSRecomp) | Master System/Game Gear | 13 | 2026-11-02 | 200 | — |
| 136 | [Castlevania: Grimoire of Souls (Castlevania: Grimoire of Souls Recomp)](https://github.com/BLSNCVS/Castlevania-Grimoire-of-Souls-Recomp) | Mobile | 227 | 2026-11-11 | 200 | — |
| 137 | [CTW-Native](https://github.com/official-kryo-to/ctw-native) | Mobile | 79 | 2026-11-01 | 200 | AI |
| 138 | [Samurai Vs Zombies](https://github.com/Decomp-And-Recomp/Samurai-Vs-Zombies) | Mobile | 28 | 2025-12-04 | 200 | — |
| 139 | [Modern Combat 2: Black Pegasus ( BackStabRecomp)](https://github.com/jessicanataliagta/AndroidRecomp) | Mobile | 23 | 2026-07-31 | 200 | — |
| 140 | [Flappy Bird (reFlappy)](https://github.com/THEN00P/reFlappy) | Mobile | 21 | 2025-09-04 | 200 | — |
| 141 | [BackStab HD (BackStabRecomp)](https://github.com/jessicanataliagta/BackStabRecomp) | Mobile | 14 | 2026-07-31 | 200 | — |
| 142 | [The Legend of Zelda: Majora's Mask (Zelda64Recomp)](https://github.com/Zelda64Recomp/Zelda64Recomp) | N64 | 7,736 | 2026-09-25 | 200 | — |
| 143 | [Banjo-Kazooie (BanjoRecomp)](https://github.com/BanjoRecomp/BanjoRecomp) | N64 | 2,145 | 2026-09-25 | 200 | — |
| 144 | [Mario Kart 64 (MarioKart64Recomp)](https://github.com/sonicdcer/MarioKart64Recomp) | N64 | 640 | 2026-08-11 | 200 | — |
| 145 | [Donkey Kong 64](https://github.com/Rainchus/Donkey-Kong-64-Recompiled) | N64 | 594 | 2026-11-08 | 200 | — |
| 146 | [Star Fox 64 (Starfox 64: Recompiled)](https://github.com/sonicdcer/Starfox64Recomp) | N64 | 408 | 2026-08-11 | 200 | — |
| 147 | [Conker's Bad Fur Day (Conker's Bad Fur Day: Recompiled)](https://github.com/sciaschi/CBFD-Recompiled) | N64 | 346 | 2026-11-19 | 200 | AI |
| 148 | [Mystical Ninja Starring Goemon](https://github.com/klorfmorf/Goemon64Recomp) | N64 | 341 | 2026-09-19 | 200 | — |
| 149 | [Dinosaur Planet](https://github.com/DinosaurPlanetRecomp/dino-recomp) | N64 | 340 | 2026-11-15 | 200 | — |
| 150 | [Bomberman 64](https://github.com/RevoSucks/BM64Recomp) | N64 | 313 | 2026-03-24 | 200 | — |
| 151 | [Quest 64](https://github.com/Rainchus/Quest64-Recomp) | N64 | 290 | 2026-09-29 | 200 | — |
| 152 | [Mega Man 64](https://github.com/MegaMan64Recomp/MegaMan64Recompiled) | N64 | 286 | 2026-04-30 | 200 | — |
| 153 | [Diddy Kong Racing](https://github.com/ThatGuyMcd/DKR-R) | N64 | 267 | 2026-11-17 | 200 | AI |
| 154 | [Perfect Dark (Dab's Mod)](https://github.com/DabDavis/perfect-dark-dabs-mod) | N64 | 232 | 2026-10-21 | 200 | AI |
| 155 | [GoldenEye 007](https://github.com/kholdfuzion/GoldenRecomp) | N64 | 219 | 2026-07-05 | 200 | — |
| 156 | [Duke Nukem: Zero Hour (DNZHRecomp)](https://github.com/sonicdcer/DNZHRecomp) | N64 | 209 | 2025-11-03 | 200 | — |
| 157 | [Conker's Bad Fur Day Reloaded](https://github.com/DahSidiAbdallah/ConkerBFDReloaded) | N64 | 194 | 2026-11-16 | 200 | AI |
| 158 | [Harvest Moon 64](https://github.com/HarvestMoon64Recomp/HarvestMoon64Recomp) | N64 | 184 | 2026-11-09 | 200 | — |
| 159 | [Wave Race 64](https://github.com/elliotttate/wave-race-64-recomp) | N64 | 179 | 2026-09-07 | 200 | AI |
| 160 | [Dr. Mario 64](https://github.com/theboy181/drmario64_recomp_plus) | N64 | 161 | 2025-12-18 | 200 | — |
| 161 | [Castlevania: Legacy of Darkness (Castlevania: Legacy of Darkness Recompilation)](https://github.com/fliperama86/cvlod_recomp) | N64 | 149 | 2026-10-23 | 200 | AI |
| 162 | [Wave Race 64 (RaceWave46)](https://github.com/DomazinUS/RaceWave46) | N64 | 145 | 2026-09-20 | 200 | AI |
| 163 | [Pokemon Snap](https://github.com/JackandBeans/Snap64Recomp) | N64 | 139 | 2026-11-16 | 200 | AI |
| 164 | [Bomberman Hero](https://github.com/RevoSucks/BMHeroRecomp) | N64 | 128 | 2026-05-12 | 200 | — |
| 165 | [Pokemon Stadium (SS Anne)](https://github.com/mstan/PokemonStadiumRecomp) | N64 | 120 | 2026-08-15 | 200† | AI |
| 166 | [Snowboard Kids 2](https://github.com/cdlewis/snowboardkids2-recomp) | N64 | 115 | 2026-10-25 | 200 | — |
| 167 | [Banjo-Kazooie (Banjo: Recompiled [Android Port])](https://github.com/AurelioB/BanjoRecomp-Android) | N64 | 114 | 2026-07-13 | 200 | — |
| 168 | [Space Station Silicon Valley (Space Station Silicon Valley: Recompiled)](https://github.com/Cellenseres/SSSV_Recomp) | N64 | 107 | 2026-04-26 | 200 | — |
| 169 | [Mischief Makers (Trouble Makers)](https://github.com/ThiagoLira/trouble-makers-pc-recomp) | N64 | 106 | 2026-10-05 | 200 | AI |
| 170 | [Road Rash 64 (RoadRash64Recompiled)](https://github.com/linkssy2/RoadRash64Recompiled) | N64 | 105 | 2026-11-12 | 200 | AI |
| 171 | [Wave Race 64 (Wave Race 64: Recompiled)](https://github.com/danielgomesvieira2000/wave-race-64-recomp) | N64 | 100 | 2026-10-15 | 200 | AI |
| 172 | [Sin and Punishment (SnPRecompiled)](https://github.com/wootbeer/snprecomp) | N64 | 95 | 2026-11-07 | 200 | AI |
| 173 | [Ogre Battle 64: Person of Lordly Caliber](https://github.com/lfarroco/ogre-battle-64-recomp) | N64 | 94 | 2026-11-03 | 200 | AI |
| 174 | [The World Is Not Enough (I Could Have Given You the World)](https://github.com/riseio/TWIPE_00Sheven) | N64 | 94 | 2026-10-27 | 200 | AI |
| 175 | [GoldenEye 007 (goldeneye-metal)](https://github.com/ysrdevs/goldeneye-metal) | N64 | 93 | 2026-10-09 | 200 | — |
| 176 | [Pilotwings 64 (Pilotwings 64: Recompiled)](https://github.com/danielgomesvieira2000/pilotwings-64-recomp) | N64 | 84 | 2026-09-17 | 200 | AI |
| 177 | [Rush 2: Extreme Racing USA (Rush 2: Recompiled)](https://github.com/bryantmh/rush2recompiled) | N64 | 80 | 2026-11-18 | 200 | AI |
| 178 | [Beetle Adventure Racing! (Beetle Adventure Racing! Recomp)](https://github.com/danielgomesvieira2000/beetle-adventure-racing-recomp) | N64 | 79 | 2026-09-20 | 200 | AI |
| 179 | [Blast Corps](https://github.com/SlaveOfIDO/blastcorps-recomp) | N64 | 73 | 2026-10-29 | 200 | — |
| 180 | [Chameleon Twist](https://github.com/Rainchus/ChameleonTwist1-JP-Recomp) | N64 | 63 | 2025-03-11 | 200 | — |
| 181 | [Star Wars: Shadows of the Empire (Shadows of the Empire Recompiled)](https://github.com/GTTeancum/SotE-Recomp) | N64 | 62 | 2026-11-14 | 200 | AI |
| 182 | [Yoshi's Story (DinoTale)](https://github.com/wootbeer/dinotale) | N64 | 54 | 2026-11-10 | 200 | AI |
| 183 | [Automobili Lamborghini (Automobili Lamborghini: Recompiled)](https://github.com/alondero/automobililamborghini-recomp) | N64 | 53 | 2026-11-19 | 200 | AI |
| 184 | [WWF No Mercy (WWF No Mercy: Recompiled)](https://github.com/jessetbh/WWFNoMercyRecomp) | N64 | 53 | 2026-11-15 | 200 | AI |
| 185 | [Super Robot Taisen 64 (Marchwind 64)](https://github.com/dyzz/srw64-recomp) | N64 | 51 | 2026-11-19 | 200 | AI |
| 186 | [Kirby and the Crystal Shards](https://github.com/Kirby64Ret/Kirby64Recomp) | N64 | 50 | 2026-09-18 | 200 | — |
| 187 | [AeroGauge (AeroGauge: Recompiled)](https://github.com/alondero/aerogauge-recomp) | N64 | 49 | 2026-11-18 | 200 | AI |
| 188 | [Rocket: Robot on Wheels](https://github.com/ThatGuyMcd/Rocket-R) | N64 | 49 | 2026-10-06 | 200 | AI |
| 189 | [The Legend of Zelda: Majora's Mask (MMRecompRando)](https://github.com/RecompRando/MMRecompRando) | N64 | 48 | 2026-08-04 | 200 | — |
| 190 | [WCW vs. nWo World Tour (WCW vs. nWo World Tour: Recompiled)](https://github.com/jessetbh/WCWvsNWOWorldTourRecomp) | N64 | 48 | 2026-11-15 | 200 | AI |
| 191 | [Jet Force Gemini (Jet Force Gemini: Recompiled)](https://github.com/VibinToast/JetForceGemini-Recompiled) | N64 | 42 | 2026-10-30 | 200 | AI |
| 192 | [Star Wars: Rogue Squadron (RogueSquadron64Recomp)](https://github.com/MikeSemicolonD/RogueSquadron64Recomp) | N64 | 42 | 2026-11-18 | 200 | — |
| 193 | [Killer Instinct Gold (kigold-recomp)](https://github.com/geno55/kigold-recomp) | N64 | 41 | 2026-11-17 | 200 | AI |
| 194 | [Buck Bumble ( project-bumble)](https://github.com/riseio/project-bumble) | N64 | 39 | 2026-09-29 | 200 | — |
| 195 | [Snowboard Kids](https://github.com/cdlewis/snowboardkids-recomp) | N64 | 36 | 2026-10-31 | 200 | AI |
| 196 | [Castlevania 64 (CV64-Recomp)](https://github.com/spacefarergames/CV64-Recomp) | N64 | 34 | 2026-02-15 | 200 | — |
| 197 | [WCW/nWo Revenge (WCW/nWo Revenge: Recompiled)](https://github.com/jessetbh/WCWnWoRevengeRecomp) | N64 | 33 | 2026-11-15 | 200 | AI |
| 198 | [Banjo-Tooie (Banjo-Tooie: Recompiled)](https://github.com/Vidanox/BanjoTooieRecompiled) | N64 | 32 | 2026-10-25 | 200 | AI |
| 199 | [International Superstar Soccer 2000 (Mabecs International Superstar Soccer 2000 Recomp)](https://github.com/Mabec-games/ISS2000-RECOMP) | N64 | 26 | 2026-11-13 | 200 | AI |
| 200 | [Glover (Glover-R)](https://github.com/ThatGuyMcd/Glover-R) | N64 | 25 | 2026-10-06 | 200 | AI |
| 201 | [WWF WrestleMania 2000 (WWF WrestleMania 2000: Recompiled)](https://github.com/jessetbh/WWFWrestleMania2000Recomp) | N64 | 25 | 2026-11-15 | 200 | AI |
| 202 | [GoldenEye 007 (GoldenEye64Recomp)](https://github.com/cblock85/GoldenEye64Recomp) | N64 | 23 | 2026-08-20 | 200 | — |
| 203 | [Mario Kart 64 (MK64Recomp)](https://github.com/arefdsg/MK64Recomp) | N64 | 21 | 2026-09-24 | 200 | — |
| 204 | [Mario Party 3 (MarioParty3-Recomp)](https://github.com/Rainchus/MarioParty3-Recomp) | N64 | 20 | 2025-03-17 | 200 | — |
| 205 | [BattleTanx: Global Assault (BTGARecomp)](https://github.com/wootbeer/btgarecomp) | N64 | 19 | 2026-11-15 | 200 | AI |
| 206 | [Castlevania 64](https://github.com/RevoSucks/CV64Recomp) | N64 | 19 | 2026-10-06 | 200 | — |
| 207 | [GoldenEye 007 (GoldenEye-Recomp-Server (online play for GoldenEye recomp))](https://github.com/SunJaycy/GoldenEye-Recomp-Server) | N64 | 19 | 2026-06-12 | 200 | — |
| 208 | [Quest 64 (Quest 64 Tale: Recompiled)](https://github.com/boricuapab/quest64tale-recompiled) | N64 | 18 | 2026-11-02 | 200 | — |
| 209 | [Blast Corps (Power Dozer)](https://github.com/djultra64/Power-Dozer) | N64 | 17 | 2026-10-23 | 200 | AI |
| 210 | [Tetrisphere (Blocksphere)](https://github.com/djultra64/Blocksphere) | N64 | 16 | 2026-11-13 | 200 | AI |
| 211 | [Pokémon Snap (Pokémon Snap 3DS: Double Take!!)](https://github.com/xXDankeyKongXx/psnap-3ds) | N64 | 15 | 2026-10-27 | 200 | — |
| 212 | [Turok: Rage Wars (PaxDino)](https://github.com/wootbeer/PaxDino) | N64 | 15 | 2026-11-07 | 200 | AI |
| 213 | [Turok: Rage Wars (rage-wars-recompiled)](https://github.com/ArtfulRascal8/rage-wars-recompiled) | N64 | 15 | 2026-10-15 | 200 | — |
| 214 | [Bomberman 64: The Second Attack! (Bomberman 64: The Second Attack! Recompiled)](https://github.com/bdragoncore/pommy-recomp) | N64 | 14 | 2026-10-27 | 200 | — |
| 215 | [Neon Genesis Evangelion (adam-01)](https://github.com/evaa-01/adam) | N64 | 14 | 2026-10-13 | 200 | — |
| 216 | [40 Winks (40 Winks : Dreamcompiled)](https://github.com/DreaXer/40WinksRecomp) | N64 | 13 | 2026-11-08 | 200 | AI |
| 217 | [Pokémon Snap (SnapPad)](https://github.com/chrissotraidis/snappad) | N64 | 12 | 2026-11-14 | 200 | — |
| 218 | [Virtual Pro Wrestling 2: Ōdō Keishō (Virtual Pro Wrestling 2: Recompiled)](https://github.com/jessetbh/VPW2Recomp) | N64 | 12 | 2026-11-15 | 200 | AI |
| 219 | [Virtual Pro Wrestling 64 (Virtual Pro Wrestling 64: Recompiled)](https://github.com/jessetbh/VPW64Recomp) | N64 | 12 | 2026-11-15 | 200 | AI |
| 220 | [The Legend of Zelda: Ocarina of Time (oot-recompiled)](https://github.com/JonB-Dev/oot-recompiled) | N64 | 11 | 2026-10-22 | 200 | — |
| 221 | [Conker's Bad Fur Day](https://github.com/Raihwy3/Conker3DSRecomp) | N64 | 10 | 2026-11-19 | 200 | — |
| 222 | [Battlezone: Rise of the Black Dogs (BZRecomp)](https://github.com/wootbeer/bzrecomp) | N64 | 6 | 2026-11-10 | 200 | AI |
| 223 | [Mario Golf](https://github.com/Rainchus/MarioGolf64) | N64 | 4 | 2026-06-20 | 200 | — |
| 224 | [Super Smash Bros](https://github.com/Smash64Recomp) | N64 | — | — | 200 | — |
| 225 | [Mesen (MesenCE)](https://github.com/nesdev-org/MesenCE) | NES | 667 | 2026-11-15 | 200 | — |
| 226 | [The Legend of Zelda (LegendOfZeldaNESRecomp)](https://github.com/mstan/LegendOfZeldaNESRecomp) | NES | 63 | 2026-11-16 | 200 | AI |
| 227 | [Super Mario Bros. (SuperMarioBrosNESRecomp)](https://github.com/mstan/SuperMarioBrosNESRecomp) | NES | 59 | 2026-11-16 | 200 | AI |
| 228 | [Metroid (MetroidNESRecomp)](https://github.com/mstan/MetroidNESRecomp) | NES | 33 | 2026-11-14 | 200 | — |
| 229 | [Dr. Mario (DrMarioNesRecomp)](https://github.com/mstan/DrMarioNesRecomp) | NES | 19 | 2026-11-06 | 200 | AI |
| 230 | [Duck Hunt (DuckHuntNESRecomp)](https://github.com/mstan/DuckHuntNESRecomp) | NES | 19 | 2026-11-13 | 200 | — |
| 231 | [Faxanadu (FaxanaduRecomp)](https://github.com/mstan/FaxanaduRecomp) | NES | 18 | 2026-11-06 | 200 | — |
| 232 | [Super Mario Bros. (smb (nathsou))](https://github.com/nathsou/smb) | NES | 16 | 2026-11-15 | 200 | — |
| 233 | [Yoshi's Cookie (YoshisCookieRecomp)](https://github.com/mstan/YoshisCookieRecomp) | NES | 15 | 2026-11-06 | 200 | AI |
| 234 | [Yoshi (YoshiNESRecomp)](https://github.com/mstan/YoshiNESRecomp) | NES | 14 | 2026-11-06 | 200 | AI |
| 235 | [Mega Man 3 (Megaman3NESRecomp)](https://github.com/mstan/Megaman3NESRecomp) | NES | 11 | 2026-11-13 | 200 | — |
| 236 | [The Lion King (TLKRecomp)](https://github.com/kinduff/TLKRecomp) | NES | 10 | 2026-11-02 | 200 | — |
| 237 | [Super Mario Bros.](https://github.com/oliveryasuna/smb-recomp) | NES | 4 | 2026-04-12 | 200 | — |
| 238 | [OpenCE](https://github.com/OpenCommunityEdition/OpenCE) | og xbox | 2,021 | 2026-11-16 | 200 | AI |
| 239 | [Black](https://github.com/TGP482/BLACK-XBERecomp) | og xbox | 975 | 2026-10-29 | 200 | — |
| 240 | [Burnout 3: Takedown (Takedawn)](https://github.com/xenophobentx/takedawn) | og xbox | 635 | 2026-11-06 | 200 | AI |
| 241 | [Tom Clancy's Splinter Cell: Double Agent (Splinter Cell: Double Agent - XBE Recomp)](https://github.com/TGP482/SCDA-XBERecomp) | og xbox | 491 | 2026-11-01 | 200 | AI |
| 242 | [Shadow the Hedgehog (Shadow Recompiled)](https://github.com/FoxWorkshop/ShadowRecomp) | og xbox | 404 | 2026-11-19 | 200 | — |
| 243 | [Mortal Kombat: Shaolin Monks (OpenShao)](https://github.com/OAleex/OpenShao) | og xbox | 371 | 2026-11-10 | 200 | AI |
| 244 | [Ninja Gaiden Black (Ninja Gaiden Black Recompiled)](https://github.com/gamboozino/ngbrecomp) | og xbox | 358 | 2026-11-18 | 200 | AI |
| 245 | [Ninja Gaiden II (Ninja Gaiden II Recompiled)](https://github.com/gamboozino/ng2recomp) | og xbox | 292 | 2026-11-19 | 200 | AI |
| 246 | [Def Jam: Fight for NY (Def Jam: Fight for NY - Fan Recomp)](https://github.com/vyanhursky/DefJamFFNY-recomp) | og xbox | 274 | 2026-11-15 | 200 | AI |
| 247 | [Darkwatch (Darkwatch: Darker Edition)](https://github.com/linkssy2/DarkwatchDarkerEdition) | og xbox | 241 | 2026-11-16 | 200 | — |
| 248 | [Mercenaries: Playground of Destruction (Mercenaries Recompiled)](https://github.com/KraftMacAndChee/Mercenaries-Recompiled) | og xbox | 203 | 2026-10-06 | 200 | AI |
| 249 | [007: From Russia with Love (007: From Russia with Love - XBE Recomp)](https://github.com/TGP482/007FRWL-XBERecomp) | og xbox | 184 | 2026-10-29 | 200 | — |
| 250 | [Conker: Live & Reloaded (Conker: Recomped & Reloaded)](https://github.com/Mabec-games/Conker-Recomped-and-Reloaded) | og xbox | 179 | 2026-11-16 | 200 | AI |
| 251 | [Soulcalibur II (Soulcalibur II Recomp)](https://github.com/tmcleroy/soulcalibur2-recomp) | og xbox | 174 | 2026-11-19 | 200 | AI |
| 252 | [SSX Tricky (OpenTricky)](https://github.com/GiZcesi/OpenTricky) | og xbox | 163 | 2026-11-12 | 200 | — |
| 253 | [Red Dead Revolver (RDR-XBERecomp)](https://github.com/TGP482/RDR-XBERecomp) | og xbox | 160 | 2026-11-11 | 200 | AI |
| 254 | [007: Nightfire (007: Nightfire - XBE Recomp)](https://github.com/TGP482/007Nightfire-XBERecomp) | og xbox | 156 | 2026-11-05 | 200 | — |
| 255 | [Urban Chaos: Riot Response (Urban Chaos Riot Response Burner Edition)](https://github.com/linkssy2/UrbanChaosRiotResponseBurnerEdition) | og xbox | 137 | 2026-11-19 | 200 | AI |
| 256 | [Prince of Persia: The Sands of Time (rePOP)](https://github.com/FulGerNet/rePOP) | og xbox | 125 | 2026-11-03 | 200 | AI |
| 257 | [Project Gotham Racing 2 (Project Gotham Racing 2 - XBE Recomp)](https://github.com/hk21x/pgr2-recomp) | og xbox | 124 | 2026-11-18 | 200 | AI |
| 258 | [Dead or Alive 3 (doa3-recomp)](https://github.com/parkerallan/doa3-recomp) | og xbox | 119 | 2026-10-24 | 200 | AI |
| 259 | [The Lord of the Rings: The Two Towers (Two Towers Recomp)](https://github.com/Gumpolas/TooTawersRecomp) | og xbox | 111 | 2026-11-19 | 200 | AI |
| 260 | [007: Everything or Nothing (007: Everything or Nothing - XBE Recomp)](https://github.com/hk21x/007eon-recomp) | og xbox | 109 | 2026-11-18 | 200 | AI |
| 261 | [Midtown Madness 3 (Midtown Madness 3 Recomp)](https://github.com/lakshya16157/midtown-madness-3-PC-Native) | og xbox | 103 | 2026-11-19 | 200 | AI |
| 262 | [SSX 3 (SSX3-recomp)](https://github.com/koenhendriks/SSX3-recomp) | og xbox | 103 | 2026-11-09 | 200 | AI |
| 263 | [Project Gotham Racing (Project Gotham Racing - XBE Recomp)](https://github.com/hk21x/pgr1-recomp) | og xbox | 97 | 2026-11-18 | 200 | AI |
| 264 | [Far Cry Instincts (fci-recomp)](https://github.com/VinceIP/fci-recomp) | og xbox | 93 | 2026-11-14 | 200 | AI |
| 265 | [RalliSport Challenge 2 (RalliSport Challenge 2 — static recompilation)](https://github.com/Mortify7612/RallisportChallenge2-decomp) | og xbox | 91 | 2026-10-28 | 200 | AI |
| 266 | [TimeSplitters 2 (split2-recomp)](https://github.com/phobos665/split2-recomp) | og xbox | 74 | 2026-11-02 | 200 | AI |
| 267 | [Forza Motorsport (Redline Recompiled)](https://github.com/DivxPlays/redline-recompiled) | og xbox | 71 | 2026-11-13 | 200 | AI |
| 268 | [Futurama: The Game (Futurama: The Game: The Recomp)](https://github.com/hiburn8/Futurama-The-Game-The-Recomp) | og xbox | 67 | 2026-11-08 | 200 | AI |
| 269 | [Dead or Alive 3 (DOA3 Recomp)](https://github.com/NoRain211/doa3-re) | og xbox | 63 | 2026-11-17 | 200 | AI |
| 270 | [Red Dead Revolver (Red Dead Revolver Recomp)](https://github.com/dennisabalo18-bot/red-dead-revolver-pc) | og xbox | 63 | 2026-11-05 | 200 | AI |
| 271 | [Bloody Roar Extreme Recomp](https://github.com/bromurok/BloodyRoarExtremeRecomp) | og xbox | 61 | 2026-11-07 | 200 | AI |
| 272 | [The Incredible Hulk: Ultimate Destruction (The Incredible Hulk: Ultimate Destruction (Xbox Recomp))](https://github.com/lookingcoding/hulk-ultimate-destruction-recomp-xbox-ver-) | og xbox | 60 | 2026-11-17 | 200 | AI |
| 273 | [Far Cry Instincts (Far Cry Instincts Recomp)](https://github.com/bassobr/Far-Cry-Instincts-Recomp) | og xbox | 57 | 2026-11-16 | 200 | AI |
| 274 | [Ghost Recon 2 (Ghost Recon 2 Recomp)](https://github.com/ElKev118/ghostrecon2-recomp) | og xbox | 57 | 2026-11-02 | 200 | AI |
| 275 | [True Crime: New York City (True Crime: New York City - Xbox Recomp)](https://github.com/roz1077/true-crime-new-york-city-recomp) | og xbox | 54 | 2026-11-19 | 200 | AI |
| 276 | [Tony Hawk's Pro Skater 2X (THPS 2X Recompiled)](https://github.com/almost-drowned-rat/THPS2X-Recompiled) | og xbox | 45 | 2026-11-18 | 200 | AI |
| 277 | [Colin McRae Rally 2005 (McRae05-XBE-Recomp)](https://github.com/projectedan/McRae05-XBE-Recomp) | og xbox | 42 | 2026-10-28 | 200 | AI |
| 278 | [The Warriors (The Warriors Recomp)](https://github.com/Matt-code-d/TheWarriorsRecomp) | og xbox | 41 | 2026-11-09 | 200 | — |
| 279 | [The Urbz: Sims in the City (Urbz recomp)](https://github.com/abilliontokens/urbz-recomp) | og xbox | 31 | 2026-10-20 | 200 | AI |
| 280 | [BLiNX 2: Masters of Time & Space (blinx2-recomp)](https://github.com/apexJCL/blinx2-recomp) | og xbox | 30 | 2026-11-07 | 200 | AI |
| 281 | [Breakdown (Breakdown-Recompilation)](https://github.com/Heromachine/Breakdown-Recompilation) | og xbox | 28 | 2026-10-08 | 200 | AI |
| 282 | [WWE 2K15 (WWE 2K15 PC)](https://github.com/iMrBurn/wwe2k15-pc) | og xbox | 26 | 2026-11-17 | 200 | AI |
| 283 | [Blood Wake (Blood Wake Recomp)](https://github.com/minimalice92/bloodwake-recomp) | og xbox | 25 | 2026-11-08 | 200 | AI |
| 284 | [Grabbed by the Ghoulies (Ghoulies Recomp)](https://github.com/SeveerJ/Ghoulies_PC_Recomp) | og xbox | 24 | 2026-11-06 | 200 | AI |
| 285 | [Turok: Evolution (EvolutionRecomp)](https://github.com/MarkPremier/EvolutionRecomp) | og xbox | 23 | 2026-10-29 | 200 | AI |
| 286 | [Medal of Honor: Rising Sun (Medal of Honor: Rising Sun XBERecomp)](https://github.com/neonoxd/MOHRS-XBERecomp) | og xbox | 22 | 2026-11-18 | 200 | AI |
| 287 | [Crimson Skies: High Road to Revenge (Crimson Skies Recomp)](https://github.com/saironbusatto/CrimsonSkiesRecomp) | og xbox | 20 | 2026-11-01 | 200 | — |
| 288 | [The Incredible Hulk (The Incredible Hulk Recompiled)](https://github.com/TekRantGaming/incredible-hulk-recompiled) | og xbox | 18 | 2026-11-02 | 200 | AI |
| 289 | [Burnout (Burnout Recompilation)](https://github.com/Heromachine/Burnout-Recompilation) | og xbox | 17 | 2026-10-14 | 200 | AI |
| 290 | [Panzer Dragoon Orta (Orta Recompiled)](https://github.com/almost-drowned-rat/Orta-Recompiled) | og xbox | 17 | 2026-11-18 | 200 | AI |
| 291 | [Spyro: A Hero's Tail (Spyro: A Hero's Tail Recomp)](https://github.com/Starkka15/spyro-aht-pc) | og xbox | 16 | 2026-11-13 | 200 | AI |
| 292 | [The Sims (The Sims - Static Recompilation)](https://github.com/abilliontokens/sims1-recomp) | og xbox | 15 | 2026-10-21 | 200 | AI |
| 293 | [Tiger Woods PGA Tour 2004 (Tiger Woods PGA Tour 2004 - XBE Recomp)](https://github.com/projectedan/TigerWoods2004-XBE-Recomp) | og xbox | 14 | 2026-11-05 | 200 | AI |
| 294 | [Destroy All Humans! (Destroy All Humans! (2005) Recompilation)](https://github.com/Zippingrocks/Destroy-All-Humans-2005-Static-Recompilation) | og xbox | 13 | 2026-10-29 | 200 | AI |
| 295 | [SSX 3 (SSX3-Recomp)](https://github.com/bertibertig/SSX3-Recomp) | og xbox | 13 | 2026-10-26 | 200 | AI |
| 296 | [The Legend of Spyro: A New Beginning (The Legend of Spyro: A New Beginning Recomp)](https://github.com/Starkka15/spyro-anb-pc) | og xbox | 13 | 2026-11-12 | 200 | AI |
| 297 | [Amped 2 (Amped2-Recomp)](https://github.com/bertibertig/Amped2-Recomp) | og xbox | 12 | 2026-10-21 | 200 | AI |
| 298 | [Super Monkey Ball Deluxe (Super Monkey Ball Deluxe - Static Recompilation)](https://github.com/timftw21/smbd-recompilation) | og xbox | 12 | 2026-11-18 | 200 | AI |
| 299 | [Lost (iPodClickWheelRecomps)](https://github.com/DogParty/iPodClickWheelRecomps) | Other | 61 | 2026-09-06 | 200 | — |
| 300 | [Terraria (tModLoader)](https://github.com/tModLoader/tModLoader) | PC | 5,797 | 2026-11-17 | 200 | AI |
| 301 | [SuperTuxKart](https://github.com/supertuxkart/stk-code) | PC | 5,488 | 2026-11-03 | 200 | — |
| 302 | [S.T.A.L.K.E.R. (OpenXRay)](https://github.com/OpenXRay/xray-16) | PC | 3,612 | 2026-11-16 | 200 | AI |
| 303 | [PCem](https://github.com/sarah-walker-pcem/pcem) | PC | 1,955 | 2026-11-19 | 200 | — |
| 304 | [UltraStar Deluxe](https://github.com/UltraStar-Deluxe/USDX) | PC | 1,318 | 2026-11-17 | 200 | — |
| 305 | [Rigs of Rods](https://github.com/RigsOfRods/rigs-of-rods) | PC | 1,297 | 2026-11-01 | 200 | — |
| 306 | [Ultima Online (ClassicUO)](https://github.com/ClassicUO/ClassicUO) | PC | 747 | 2026-09-29 | 200 | AI |
| 307 | [BombSquad (Ballistica)](https://github.com/efroemling/ballistica) | PC | 720 | 2026-11-04 | 200 | AI |
| 308 | [Super Mario War](https://github.com/mmatyas/supermariowar) | PC | 546 | 2026-11-07 | 200 | — |
| 309 | [Need for Speed: Underground 2 (nfsu2-recompiled)](https://github.com/codepdbh/nfsu2-recompiled) | PC | 433 | 2026-11-17 | 200 | — |
| 310 | [Principia](https://github.com/Bithack/principia) | PC | 433 | 2026-11-17 | 200 | — |
| 311 | [OpenTIE](https://github.com/elyosh/OpenTIE) | PC | 366 | 2026-10-04 | 200 | AI |
| 312 | [The Elder Scrolls V: Skyrim (Skyrim for Android)](https://github.com/ttom795/Skyrim_Android) | PC | 333 | 2026-11-19 | 200 | — |
| 313 | [OpenLieroX](https://github.com/openlierox/openlierox) | PC | 304 | 2026-10-27 | 200 | AI |
| 314 | [Need for Speed: Most Wanted (NFSMW-Recompiled)](https://github.com/madelrandel-blip/NFSMW-Recompiled) | PC | 247 | 2026-11-05 | 200 | AI |
| 315 | [Parasite Eve HD Remaster](https://github.com/faligame/Parasite-Eve-HD-Remaster) | PC | 242 | 2026-10-16 | 200 | — |
| 316 | [Command & Conquer: Red Alert 2 (Red Alert 2 and Yuri's Revenge - Static Recompilation)](https://github.com/sp00nznet/redalert2-recomp) | PC | 227 | 2026-10-28 | 200 | AI |
| 317 | [The Return of the King (Athelas)](https://github.com/Shagg88/Athelas) | PC | 216 | 2026-11-18 | 200 | AI |
| 318 | [OpenXWA](https://github.com/elyosh/OpenXWA) | PC | 186 | 2026-11-18 | 200 | AI |
| 319 | [MekHQ](https://github.com/MegaMek/mekhq) | PC | 170 | 2026-11-18 | 200 | AI |
| 320 | [Need for Speed: Most Wanted (Need for Speed Most Wanted Mac)](https://github.com/elforeign/nfs-most-wanted-mac) | PC | 167 | 2026-11-18 | 200 | — |
| 321 | [X-Moto](https://github.com/xmoto/xmoto) | PC | 164 | 2025-08-27 | 200 | — |
| 322 | [Need for Speed: Most Wanted (NFS Most Wanted PC Recompiled (NFS Android Evolved))](https://github.com/codepdbh/nfsmwpc-recompiled) | PC | 159 | 2026-11-17 | 200 | — |
| 323 | [Flame](https://github.com/DiaLight/Flame) | PC | 136 | 2026-11-08 | 200 | — |
| 324 | [OpenXW](https://github.com/elyosh/OpenXW) | PC | 133 | 2026-10-06 | 200 | AI |
| 325 | [ONScripter-EN](https://github.com/Galladite27/ONScripter-EN) | PC | 125 | 2026-01-26 | 200 | — |
| 326 | [Need for Speed: Carbon (NFS-CARBON-360-ANDROID-RECOMP)](https://github.com/codepdbh/NFS-CARBON-360-ANDROID-RECOMP) | PC | 122 | 2026-10-22 | 200 | — |
| 327 | [Roller](https://github.com/FatalDecomp/ROLLER) | PC | 112 | 2026-11-05 | 200 | AI |
| 328 | [The Binding of Isaac (IsaacRecomp)](https://github.com/whylurking/IsaacRecomp) | PC | 96 | 2026-11-16 | 200 | AI |
| 329 | [Need for Speed II: Special Edition (nfs-recompiled)](https://github.com/motor-dev/nfs-recompiled) | PC | 93 | 2026-03-04 | 200 | — |
| 330 | [Championship Manager: Season 01/02 (02: Bosman Edition)](https://github.com/maxevans60/cm0102-bosman-edition) | PC | 89 | 2026-11-17 | 200 | — |
| 331 | [FIFA 09 (FIFA 09 PC)](https://github.com/ChunchunQ/fifa09-recomp) | PC | 89 | 2026-10-22 | 200 | AI |
| 332 | [wc1-re](https://github.com/neuromancer/wc1-re) | PC | 79 | 2026-11-19 | 200 | AI |
| 333 | [The Binding of Isaac: Rebirth (The Browsing of Isaac (tboi.online))](https://github.com/chiikabu/the-browsing-of-isaac) | PC | 72 | 2026-11-16 | 200 | — |
| 334 | [Need for Speed: Carbon (nfs-carbon-recomp)](https://github.com/Sampreeth004/nfs-carbon-recomp) | PC | 69 | 2026-10-07 | 200 | — |
| 335 | [OpenXvT](https://github.com/elyosh/OpenXvT) | PC | 69 | 2026-11-12 | 200 | AI |
| 336 | [Need for Speed: Most Wanted (nfsmw-ios)](https://github.com/bep1s69/nfsmw-ios) | PC | 67 | 2026-11-18 | 200 | — |
| 337 | [Need for Speed III: Hot Pursuit (nfs3recompiled-android)](https://github.com/ZloiKILLER/nfs3recompiled-android) | PC | 65 | 2026-11-19 | 200 | — |
| 338 | [F.E.A.R. (F.E.A.R. 360 Recompiled)](https://github.com/Juansolo457/fear360-recomp) | PC | 61 | 2026-11-06 | 200 | — |
| 339 | [Need for Speed: Carbon (nfs-carbon-mac)](https://github.com/vasist15-source/nfs-carbon-mac) | PC | 51 | 2026-11-12 | 200 | — |
| 340 | [wc2-re](https://github.com/neuromancer/wc2-re) | PC | 47 | 2026-11-18 | 200 | AI |
| 341 | [The Binding of Isaac: Rebirth (repentogxm)](https://github.com/0xl0cal/repentogxm) | PC | 46 | 2026-11-13 | 200 | — |
| 342 | [LEGO Marvel Super Heroes (LEGO Marvel Super Heroes for Android)](https://github.com/ttom795/LMS_Android) | PC | 45 | 2026-10-26 | 200 | — |
| 343 | [Need for Speed: Most Wanted (nfsmw-recomp)](https://github.com/veritr1x/nfsmw-recomp) | PC | 44 | 2026-11-10 | 200 | — |
| 344 | [Silent Hill 3 (sh3-nx, Switch)](https://github.com/cutarev/sh3-nx) | PC | 42 | 2026-10-22 | 200 | AI |
| 345 | [StarCraft (StarCraft64-recomp)](https://github.com/n0madic/StarCraft64-recomp) | PC | 40 | 2026-11-14 | 200 | — |
| 346 | [Stunts (Stunts HD)](https://github.com/mr-finster/stunts-hd) | PC | 40 | 2026-10-30 | 200 | AI |
| 347 | [Master of Magic (ReMoM)](https://github.com/jbalcomb/ReMoM) | PC | 39 | 2026-11-18 | 200 | AI |
| 348 | [Need for Speed: Carbon (NFS Carbon PC - Android Evolved)](https://github.com/codepdbh/nfscarbonpc-androidevolved) | PC | 38 | 2026-11-17 | 200 | — |
| 349 | [Prince of Persia 2: The Shadow and the Flame (prince-of-persia-2-windows)](https://github.com/Supermedo/prince-of-persia-2-windows) | PC | 36 | 2026-09-23 | 200 | AI |
| 350 | [Resident Evil 5: Gold Edition (re5-recompiled)](https://github.com/PedroCavalcanti-coder/RE5-SteamVersion-RecompAndroid) | PC | 35 | 2026-11-07 | 200 | — |
| 351 | [Devil May Cry 3: Special Edition (Devil May Cry 3 Android recomp)](https://github.com/sindufha/Devil-may-cry-3-recomp) | PC | 33 | 2026-10-30 | 200 | — |
| 352 | [Star Wars Episode I: Racer](https://github.com/sp00nznet/racer) | PC | 25 | 2026-10-30 | 200 | — |
| 353 | [F.E.A.R. (F.E.A.R. NX)](https://github.com/infriker/fear-nx) | PC | 24 | 2026-11-06 | 200 | — |
| 354 | [Black & White (bw (sp00nznet))](https://github.com/sp00nznet/bw) | PC | 23 | 2026-10-10 | 200 | — |
| 355 | [LEGO Batman: The Videogame (LBM_Android)](https://github.com/ttom795/LBM_Android) | PC | 23 | 2026-10-26 | 200 | — |
| 356 | [Command & Conquer: Tiberian Sun (tiberiansun-recomp)](https://github.com/sp00nznet/tiberiansun-recomp) | PC | 22 | 2026-10-21 | 200 | — |
| 357 | [Dragon Age: Origins (Dragon Age Origins Recomp Android Duo)](https://github.com/mabencs/Dragon-Age-Origins-Recomp-Android-Duo) | PC | 22 | 2026-11-19 | 200 | — |
| 358 | [Plants vs. Zombies (Plants vs. Zombies: Console Edition)](https://github.com/ITSeniy/pvz-console-edition) | PC | 22 | 2026-10-24 | 200 | — |
| 359 | [X-Men Legends II: Rise of Apocalypse (xmen2)](https://github.com/SomeoneIsWorking/xmen2) | PC | 21 | 2026-11-17 | 200 | — |
| 360 | [Colin McRae: DiRT 2 (DiRT 2 Recompiled)](https://github.com/XITRIX/Dirt-2-Recomp) | PC | 19 | 2026-11-16 | 200 | — |
| 361 | [Max Payne (payne-recomp)](https://github.com/phobos665/payne-recomp) | PC | 19 | 2026-11-02 | 200 | — |
| 362 | [Need for Speed: Carbon (NFS Carbon NX)](https://github.com/zofo007/NFS-Carbon-NX) | PC | 18 | 2026-10-30 | 200 | — |
| 363 | [Final Fantasy XIV (meteor-decomp)](https://github.com/swstegall/meteor-decomp) | PC | 15 | 2026-09-16 | 200 | — |
| 364 | [Alice: Madness Returns (alice-nx)](https://github.com/adumah/alice-nx) | PC | 14 | 2026-11-06 | 200 | — |
| 365 | [Stronghold (pc_decomp_strhld)](https://github.com/phys-winner/pc_decomp_strhld) | PC | 14 | 2026-11-12 | 200 | — |
| 366 | [The Binding of Isaac: Repentance+ (Isaac Switch Native)](https://github.com/antoniotorres02/isaac-switch-native) | PC | 14 | 2026-11-17 | 200 | — |
| 367 | [FlatOut 2 (FlatOut 2 for ARM64 handhelds (PortMaster-style))](https://github.com/badcats72/flatout2-portmaster) | PC | 13 | 2026-11-17 | 200 | — |
| 368 | [heavymetal](https://github.com/sp00nznet/heavymetal) | PC | 13 | 2026-09-27 | 200 | — |
| 369 | [Ys Book I & II (YsRecomp)](https://github.com/Fabiano-Gelain/YsRecomp) | PC | 13 | 2026-11-08 | 200 | AI |
| 370 | [Max Payne (Max Payne Recomp)](https://github.com/aldotoa/max-payne-recomp) | PC | 12 | 2026-11-02 | 200 | — |
| 371 | [Torchlight (torchlight-recomp)](https://github.com/YaPeL/torchlight-recomp) | PC | 12 | 2026-11-05 | 200 | — |
| 372 | [Unreal Tournament (ut99-recomp)](https://github.com/sp00nznet/ut99-recomp) | PC | 12 | 2026-11-03 | 200 | — |
| 373 | [Unreal Tournament 3 (pc_decomp_ut3)](https://github.com/phys-winner/pc_decomp_ut3) | PC | 12 | 2026-11-09 | 200 | — |
| 374 | [1NSANE (1NSANE: Recompiled)](https://github.com/AntAir267/1nsane-recompiled) | PC | 11 | 2026-11-18 | 200 | — |
| 375 | [Diablo III (Rehydrated)](https://github.com/Crypto137/Rehydrated) | PC | 11 | 2026-11-19 | 200 | — |
| 376 | [Populous: The Beginning (OpenPopTB-MacOS)](https://github.com/iagodemacedo/OpenPopTB-MacOS) | PC | 11 | 2026-10-21 | 200 | — |
| 377 | [Need for Speed: Most Wanted (nfsmw-recomp-android)](https://github.com/DEBARSHI-SARKAR/nfsmw-recomp-android) | PC | 10 | 2026-10-18 | 200 | — |
| 378 | [SpaceEngine (SpaceEngine on Apple Silicon)](https://github.com/fpetras/spaceengine-mac) | PC | 10 | 2026-10-14 | 200 | — |
| 379 | [Vette](https://github.com/PlasticCog/Vette2026) | PC | 7 | 2026-10-12 | 200 | AI |
| 380 | [Castlevania: Symphony of the Night (SymphonyRecomp)](https://github.com/BlackLabelHQ/SymphonyRecomp) | PS1 | 1,149 | 2026-11-16 | 200 | — |
| 381 | [Yu-Gi-Oh! Forbidden Memories (Yu-Gi-Oh! Forbidden Memories Recompiled)](https://github.com/krystalgamer/Yu-Gi-Oh-Forbidden-Memories-Recompiled) | PS1 | 324 | 2026-11-10 | 200 | AI |
| 382 | [MediEvil (MediEvilRecomp)](https://github.com/BlackLabelHQ/MediEvilRecomp) | PS1 | 306 | 2026-11-16 | 200 | — |
| 383 | [Parasite Eve 2 HD Remaster](https://github.com/faligame/Parasite-Eve-2-HD-Remaster) | PS1 | 281 | 2026-11-15 | 200 | — |
| 384 | [Syphon Filter (PC Recomp)](https://github.com/Madxbio97/SF-pc-port) | PS1 | 153 | 2026-11-18 | 200 | — |
| 385 | [Yu-Gi-Oh! Forbidden Memories (YuGiOhForbiddenMemoriesRecomp)](https://github.com/Unchiga/YuGiOhForbiddenMemoriesRecomp) | PS1 | 147 | 2026-09-26 | 200 | — |
| 386 | [Valkyrie Profile](https://github.com/Ed1z19/ValkyrieRecomp) | PS1 | 142 | 2026-11-15 | 200 | AI |
| 387 | [Mega Man X4 (MegaManX4Recomp)](https://github.com/mstan/MegaManX4Recomp) | PS1 | 140 | 2026-11-17 | 200 | AI |
| 388 | [Alexbeav's PS1 recomps (psxrecomp-ports)](https://github.com/alexbeavs-ps1-ports/psxrecomp-ports) | PS1 | 129 | 2026-11-15 | 200 | — |
| 389 | [Disney's Hercules (Hercules Recompiled)](https://github.com/obaidr1/hercules-recompiled) | PS1 | 128 | 2026-11-18 | 200 | AI |
| 390 | [Ape Escape](https://github.com/mstan/ApeEscapeRecomp) | PS1 | 106 | 2026-11-17 | 200 | AI |
| 391 | [Einhänder (Einhänder Recompiled)](https://github.com/strider973/Einhander-Recompiled) | PS1 | 104 | 2026-08-29 | 200 | AI |
| 392 | [Crash Bandicoot 2](https://github.com/Zumbo06/Crash2Recomp) | PS1 | 103 | 2026-10-08 | 200 | AI |
| 393 | [Resident Evil 3: Nemesis (Project RE: Visited - Resident Evil 3)](https://github.com/BrazilianHobbyist/Project-RE-Visited-RE3) | PS1 | 101 | 2026-11-12 | 200 | AI |
| 394 | [Bloody Roar 2](https://github.com/novapowers0/BloodyRoar2Recomp) | PS1 | 99 | 2026-10-13 | 200 | — |
| 395 | [King's Field (Verdite2)](https://github.com/Voicedrew11/verdite2) | PS1 | 88 | 2026-11-17 | 200 | AI |
| 396 | [Mega Man X6](https://github.com/mstan/MegaManX6Recomp) | PS1 | 88 | 2026-11-17 | 200 | AI |
| 397 | [Street Fighter Alpha 3 (Street Fighter Alpha 3 Recompiled)](https://github.com/TechnicallyComputers/Street-Fighter-Alpha-3-Recomp) | PS1 | 87 | 2026-10-10 | 200 | AI |
| 398 | [Tomba! (TombaRecomp)](https://github.com/mstan/TombaRecomp) | PS1 | 83 | 2026-11-17 | 200 | AI |
| 399 | [Xenogears (Xenogears Recomp)](https://github.com/OpokXeno/xenogears-recomp) | PS1 | 79 | 2026-11-06 | 200 | AI |
| 400 | [Alien Resurrection (AlienReRecomp)](https://github.com/DiegoDeDios/AlienReRecomp) | PS1 | 77 | 2026-11-07 | 200 | AI |
| 401 | [Mega Man X5 (MegaManX5Recomp)](https://github.com/mstan/MegaManX5Recomp) | PS1 | 67 | 2026-11-19 | 200 | AI |
| 402 | [OpenSpideyPS1](https://github.com/GTTeancum/SpideyPS1recomp) | PS1 | 66 | 2026-11-11 | 200 | AI |
| 403 | [Wipeout XL (Wipeout XL Recompiled)](https://github.com/NJH-1001/Wipeout2K97XL) | PS1 | 60 | 2026-10-23 | 200 | AI |
| 404 | [Medal of Honor (Medal of Honor PSX Recomp)](https://github.com/FractalEngineer/Medal-Of-Honor-PSX-Recomp) | PS1 | 57 | 2026-11-10 | 200 | AI |
| 405 | [Shadow Tower (ReShadowTower)](https://github.com/JFryy/reshadowtower) | PS1 | 52 | 2026-11-14 | 200 | — |
| 406 | [Syphon Filter 2 (syphon-filter-2-recomp)](https://github.com/alexbeavs-ps1-ports/syphon-filter-2-recomp) | PS1 | 52 | 2026-09-30 | 200 | — |
| 407 | [Street Fighter EX Plus Alpha (Plus Alpha Recomp)](https://github.com/guimaraf/plusalpha-recomp) | PS1 | 48 | 2026-11-18 | 200 | — |
| 408 | [Strider 2](https://github.com/strider973/STRIDER-2-Recompiled) | PS1 | 48 | 2026-08-29 | 200 | AI |
| 409 | [Ace Combat 3: Electrosphere Recompiled](https://github.com/sal063/Ace-Combat-3-static-recompilation) | PS1 | 47 | 2026-10-02 | 200 | — |
| 410 | [Colin McRae Rally 2.0](https://github.com/CMR2Decomp/CMR2Decomp) | PS1 | 46 | 2026-09-15 | 200 | — |
| 411 | [Klonoa: Door to Phantomile](https://github.com/TechnicallyComputers/Klonoa-Door-to-Phantomile) | PS1 | 43 | 2026-10-10 | 200 | AI |
| 412 | [Metal Gear Solid (metal-gear-solid-recomp)](https://github.com/alexbeavs-ps1-ports/metal-gear-solid-recomp) | PS1 | 43 | 2026-11-15 | 200 | — |
| 413 | [Castlevania Chronicles (Castlevania Chronicles Recomp)](https://github.com/Spicywonda/castlevania-chronicles-recomp) | PS1 | 41 | 2026-10-12 | 200 | — |
| 414 | [Alien Resurrection (AlienResurrection-Recompilation)](https://github.com/Heromachine/AlienResurrection-Recompilation) | PS1 | 39 | 2026-10-13 | 200 | — |
| 415 | [Parasite Eve (parasite-eve-recomp)](https://github.com/alexbeavs-ps1-ports/parasite-eve-recomp) | PS1 | 39 | 2026-11-15 | 200 | — |
| 416 | [Ape Escape (Ape Escape Recompiled — Enhanced Edition)](https://github.com/nvd123-YT/ApeEscapeRecompiled) | PS1 | 38 | 2026-11-11 | 200 | AI |
| 417 | [Simpsons Wrestling Recompiled](https://github.com/TekRantGaming/simpsons-wrestling-recompiled) | PS1 | 38 | 2026-10-13 | 200 | AI |
| 418 | [Dragon Ball GT: Final Bout (DB-Final-Bout-Recomp)](https://github.com/novapowers0/DB-Final-Bout-Recomp) | PS1 | 35 | 2026-10-19 | 200 | — |
| 419 | [Twisted Metal 4 (TwistedMetal4 Recompiled)](https://github.com/TechnicallyComputers/TwistedMetal4Recomp) | PS1 | 34 | 2026-10-11 | 200 | AI |
| 420 | [Digimon World 2003 (dw2003recomp)](https://github.com/gascarcella/dw2003recomp) | PS1 | 33 | 2026-10-29 | 200 | AI |
| 421 | [Tenchu: Stealth Assassins (Tenchu Recompilation)](https://github.com/Heromachine/Tenchu-SA-Recomp) | PS1 | 33 | 2026-08-24 | 200 | AI |
| 422 | [Gran Turismo 2 (gt2-multiplayer)](https://github.com/ianitsky/gt2-multiplayer) | PS1 | 32 | 2026-09-13 | 200 | — |
| 423 | [Street Fighter EX2 Plus (Street Fighter EX2 Plus Recompiled)](https://github.com/strider973/Street-Fighter-EX2-Plus-Recompiled) | PS1 | 32 | 2026-08-29 | 200 | AI |
| 424 | [Final Fantasy Tactics (Final Fantasy Tactics Recompiled)](https://github.com/NJH-1001/FinFanTacRecomp) | PS1 | 30 | 2026-09-03 | 200 | AI |
| 425 | [Tomba! 2 - The Evil Swine Return (Tomba2Recomp)](https://github.com/mstan/Tomba2Recomp) | PS1 | 29 | 2026-11-17 | 200 | AI |
| 426 | [Ace Combat 3: Electrosphere (ace-combat-3-electrosphere-usa-recomp)](https://github.com/alexbeavs-ps1-ports/ace-combat-3-electrosphere-usa-recomp) | PS1 | 27 | 2026-11-15 | 200 | — |
| 427 | [Vagrant Story (Vagrant Story Recompiled)](https://github.com/riotashley81-jpg/vagrantstory_recomp) | PS1 | 27 | 2026-11-03 | 200 | AI |
| 428 | [Dino Crisis 2 (dino-crisis-2-recomp)](https://github.com/alexbeavs-ps1-ports/dino-crisis-2-recomp) | PS1 | 26 | 2026-11-15 | 200 | — |
| 429 | [Final Fantasy VIII (final-fantasy-viii-recomp)](https://github.com/alexbeavs-ps1-ports/final-fantasy-viii-recomp) | PS1 | 26 | 2026-11-15 | 200 | — |
| 430 | [Metal Gear Solid (mgsone-recomp)](https://github.com/coccofresco/mgsone-recomp) | PS1 | 26 | 2026-10-10 | 200 | — |
| 431 | [Earthworm Jim 2 (Earthworm Jim 2 Recompiled)](https://github.com/elprogramadorloco-arch/jim2-recomp) | PS1 | 24 | 2026-10-03 | 200 | AI |
| 432 | [X-Men Mutant Academy 2 PC](https://github.com/GTTeancum/xmen-mutant-academy-2-pc) | PS1 | 24 | 2026-09-08 | 200 | AI |
| 433 | [Breath of Fire IV (Breath of Fire IV recomp)](https://github.com/plaught-armor/bof4-recomp) | PS1 | 23 | 2026-11-16 | 200 | — |
| 434 | [Die Hard Trilogy (die-hard-trilogy-recomp)](https://github.com/alexbeavs-ps1-ports/die-hard-trilogy-recomp) | PS1 | 23 | 2026-11-15 | 200 | — |
| 435 | [Digimon World 3 (digimon-world-2003-recomp)](https://github.com/alexbeavs-ps1-ports/digimon-world-2003-recomp) | PS1 | 23 | 2026-11-15 | 200 | — |
| 436 | [Legend of Legaia (Legend of Legaia Recompiled)](https://github.com/SamSteProjects/legend-of-legaia-recomp) | PS1 | 23 | 2026-08-27 | 200 | AI |
| 437 | [Toy Story 2: Buzz Lightyear to the Rescue! (ToyStory2Recomp)](https://github.com/PeriBluGaming/ToyStory2Recomp) | PS1 | 23 | 2026-11-09 | 200 | — |
| 438 | [Vigilante 8 (Vigilante-8-recomp)](https://github.com/GTTeancum/Vigilante-8-recomp) | PS1 | 23 | 2026-11-06 | 200 | — |
| 439 | [Breath of Fire III (BreathOfFire3Recomp)](https://github.com/kerokline/BreathOfFire3Recomp) | PS1 | 22 | 2026-09-19 | 200 | — |
| 440 | [Crash Bandicoot 3: Warped (crash-bandicoot-3-warped-recomp)](https://github.com/alexbeavs-ps1-ports/crash-bandicoot-3-warped-recomp) | PS1 | 22 | 2026-11-15 | 200 | — |
| 441 | [Dino Crisis (dino-crisis-recomp)](https://github.com/alexbeavs-ps1-ports/dino-crisis-recomp) | PS1 | 22 | 2026-11-15 | 200 | — |
| 442 | [Final Fantasy IX (final-fantasy-ix-recomp)](https://github.com/alexbeavs-ps1-ports/final-fantasy-ix-recomp) | PS1 | 22 | 2026-11-15 | 200 | — |
| 443 | [Wild 9 (Wild 9 Recompiled)](https://github.com/plinkr/Wild9Recomp) | PS1 | 22 | 2026-11-01 | 200 | AI |
| 444 | [Battle Arena Toshinden (Battle Arena Toshinden Recompiled)](https://github.com/mstan/BattleArenaToshindenRecomp) | PS1 | 20 | 2026-11-06 | 200 | AI |
| 445 | [Digimon World 3 (D-W-3-Recomp)](https://github.com/Xive080/D-W-3-Recomp) | PS1 | 20 | 2026-09-14 | 200 | — |
| 446 | [Disruptor (DisruptorRecomp)](https://github.com/RecompTeam/DisruptorRecomp) | PS1 | 20 | 2026-11-18 | 200 | — |
| 447 | [G-Police (G-Police Recompiled)](https://github.com/Tzeentchnet/g-police-recomp) | PS1 | 20 | 2026-11-05 | 200 | — |
| 448 | [MediEvil II (medievil-ii-recomp)](https://github.com/alexbeavs-ps1-ports/medievil-ii-recomp) | PS1 | 20 | 2026-11-15 | 200 | — |
| 449 | [Mortal Kombat Trilogy (MKTrilogyN64Recomp)](https://github.com/cultofblue/MKTrilogyN64Recomp) | PS1 | 19 | 2026-10-28 | 200 | — |
| 450 | [Resident Evil 3: Nemesis (resident-evil-3-recomp)](https://github.com/alexbeavs-ps1-ports/resident-evil-3-recomp) | PS1 | 19 | 2026-11-15 | 200 | — |
| 451 | [Nightmare Creatures II (nightmare-creatures-ii-recomp)](https://github.com/alexbeavs-ps1-ports/nightmare-creatures-ii-recomp) | PS1 | 18 | 2026-11-15 | 200 | — |
| 452 | [R4: Ridge Racer Type 4 (RidgeRacerType4Recomp)](https://github.com/tetrisgm/RidgeRacerType4Remaster) | PS1 | 18 | 2026-11-19 | 200 | — |
| 453 | [Alundra (Alundra Recompiled)](https://github.com/aitorcachero/alundra-recomp) | PS1 | 17 | 2026-10-26 | 200 | — |
| 454 | [Marvel vs. Capcom: Clash of Super Heroes (Marvel vs. Capcom: Clash of Super Heroes Recompiled)](https://github.com/TechnicallyComputers/Marvel-vs.-Capcom-Clash-of-Super-Heroes-Recomp) | PS1 | 17 | 2026-10-10 | 200 | AI |
| 455 | [Mega Man Legends (mega-man-legends-recomp)](https://github.com/alexbeavs-ps1-ports/mega-man-legends-recomp) | PS1 | 17 | 2026-11-15 | 200 | — |
| 456 | [Point Blank (Point Blank PC Port)](https://github.com/TekRantGaming/point-blank-recompiled) | PS1 | 17 | 2026-10-13 | 200 | AI |
| 457 | [Roll Away (Roll Away PSX PC Port)](https://github.com/Bitsandbreakpoints/roll-away-psx-pc-recomp) | PS1 | 17 | 2026-11-09 | 200 | AI |
| 458 | [Alundra (alundra-recomp)](https://github.com/alexbeavs-ps1-ports/alundra-recomp) | PS1 | 16 | 2026-11-15 | 200 | — |
| 459 | [Bomberman Fantasy Race (Bomberman Fantasy Race Recompiled)](https://github.com/TechnicallyComputers/Bomberman-Fantasy-Race-Recomp) | PS1 | 16 | 2026-10-11 | 200 | AI |
| 460 | [Dance Dance Revolution (ddr-1st-recomp)](https://github.com/bmbelo87/ddr-1st-recomp) | PS1 | 16 | 2026-09-15 | 200 | AI |
| 461 | [Alone in the Dark: The New Nightmare (alone-in-the-dark-the-new-nightmare-recomp)](https://github.com/alexbeavs-ps1-ports/alone-in-the-dark-the-new-nightmare-recomp) | PS1 | 15 | 2026-11-15 | 200 | — |
| 462 | [MediEvil (medievil-recomp)](https://github.com/alexbeavs-ps1-ports/medievil-recomp) | PS1 | 15 | 2026-11-15 | 200 | — |
| 463 | [Bomberman World (Bomberman World Recompiled)](https://github.com/TechnicallyComputers/Bomberman-World-Recomp) | PS1 | 14 | 2026-10-10 | 200 | AI |
| 464 | [Harvest Moon: Back to Nature (backtonature-decompiled)](https://github.com/beruanglaut-com/backtonature-decompiled) | PS1 | 14 | 2026-11-10 | 200 | — |
| 465 | [Hogs of War (Frontschweine Recompiled)](https://github.com/Nero2611/FrontschweineRecomp) | PS1 | 14 | 2026-10-13 | 200 | — |
| 466 | [Muppet RaceMania (Muppet RaceMania Recompiled)](https://github.com/TekRantGaming/muppet-racemania-recompiled) | PS1 | 14 | 2026-10-30 | 200 | AI |
| 467 | [Dragon Valor (Dragon Valor Recompiled)](https://github.com/victor-takai/dragon-valor-recomp) | PS1 | 13 | 2026-11-19 | 200 | AI |
| 468 | [Metal Slug X (Metal Slug X Recompiled)](https://github.com/TechnicallyComputers/Metal-Slug-X-Recomp) | PS1 | 13 | 2026-10-10 | 200 | AI |
| 469 | [Ace Combat 3: Electrosphere (ace-combat-3-electrosphere-recomp)](https://github.com/alexbeavs-ps1-ports/ace-combat-3-electrosphere-recomp) | PS1 | 12 | 2026-11-15 | 200 | — |
| 470 | [Bushido Blade 2 (bushido-blade-2-recomp)](https://github.com/alexbeavs-ps1-ports/bushido-blade-2-recomp) | PS1 | 12 | 2026-11-15 | 200 | — |
| 471 | [Mortal Kombat Trilogy (mortal-kombat-trilogy-recomp)](https://github.com/alexbeavs-ps1-ports/mortal-kombat-trilogy-recomp) | PS1 | 12 | 2026-11-15 | 200 | — |
| 472 | [Wipeout XL (wipeout-xl-recomp)](https://github.com/alexbeavs-ps1-ports/wipeout-xl-recomp) | PS1 | 12 | 2026-11-15 | 200 | — |
| 473 | [Alien Resurrection (alien-resurrection-recomp)](https://github.com/alexbeavs-ps1-ports/alien-resurrection-recomp) | PS1 | 11 | 2026-11-15 | 200 | — |
| 474 | [Colin McRae Rally 2.0 (colin-mcrae-rally-2-0-recomp)](https://github.com/alexbeavs-ps1-ports/colin-mcrae-rally-2-0-recomp) | PS1 | 11 | 2026-11-15 | 200 | — |
| 475 | [Driver (Driver Recompiled (driver-recomp))](https://github.com/alexbeavs-ps1-ports/driver-recomp) | PS1 | 11 | 2026-11-15 | 200 | — |
| 476 | [Jet Moto 2: Championship Edition (Jet Moto 2 Recompiled)](https://github.com/goodshepherd23/JetMoto2-Recomp) | PS1 | 11 | 2026-10-21 | 200 | AI |
| 477 | [PaRappa The Rapper (PaRappaTheRapper Recomp)](https://github.com/kirby1237/PaRappaTheRapperRecomp) | PS1 | 11 | 2026-11-04 | 200 | AI |
| 478 | [Puyo Puyo Box (PuyoPuyoBoxRecomp)](https://github.com/kirby1237/PuyoPuyoBoxRecomp) | PS1 | 11 | 2026-09-07 | 200 | — |
| 479 | [Rampage Through Time (Rampage Through Time Recompiled)](https://github.com/TechnicallyComputers/Rampage---Through-Time-Recomp) | PS1 | 11 | 2026-10-10 | 200 | AI |
| 480 | [Star Wars Episode I: Jedi Power Battles (Star Wars Episode I: Jedi Power Battles Recompiled)](https://github.com/TechnicallyComputers/Star-wars---Episode-I---Jedi-Power-Battles-Recomp) | PS1 | 11 | 2026-10-10 | 200 | AI |
| 481 | [The Lost World: Jurassic Park Special Edition (the-lost-world-jurassic-park-special-edition-recomp)](https://github.com/alexbeavs-ps1-ports/the-lost-world-jurassic-park-special-edition-recomp) | PS1 | 11 | 2026-11-15 | 200 | — |
| 482 | [Blood Omen: Legacy of Kain (blood-omen-legacy-of-kain-recomp)](https://github.com/alexbeavs-ps1-ports/blood-omen-legacy-of-kain-recomp) | PS1 | 10 | 2026-11-15 | 200 | — |
| 483 | [Bomberman Party Edition (Bomberman Party Edition Recomp)](https://github.com/TechnicallyComputers/BombermanPartyEditionRecomp) | PS1 | 10 | 2026-10-10 | 200 | AI |
| 484 | [Duke Nukem: Time to Kill (duke-nukem-time-to-kill-recomp)](https://github.com/MusicMonsterMod/duke-nukem-time-to-kill-recomp) | PS1 | 10 | 2026-11-19 | 200 | — |
| 485 | [Star Wars: Masters of Teräs Käsi (MastersOfTerasKasiRecomp)](https://github.com/TechnicallyComputers/MastersOfTerasKasiRecomp) | PS1 | 10 | 2026-10-10 | 200 | AI |
| 486 | [Suikoden II (suikoden-ii-recomp)](https://github.com/alexbeavs-ps1-ports/suikoden-ii-recomp) | PS1 | 10 | 2026-11-15 | 200 | — |
| 487 | [Grand Theft Auto: Vice City Stories (GTA: Vice City Stories — Native PC port (PS2 static recompilation))](https://github.com/gothamor/gta-vcs-recomp) | PS2 | 718 | 2026-11-14 | 200 | AI |
| 488 | [Gran Turismo 4 (GT4Recomp)](https://github.com/moesuito/gt4-staticrecomp) | PS2 | 611 | 2026-11-11 | 200 | AI |
| 489 | [Ico-PC](https://github.com/nathanialf/ico-pc) | PS2 | 560 | 2026-11-19 | 200 | AI |
| 490 | [God of War (GOW Native PC)](https://github.com/Vnnc1/gow-native-pc) | PS2 | 265 | 2026-11-14 | 200 | AI |
| 491 | [Black (Black-2006-Recomp)](https://github.com/portingpete/Black-2006-Recomp) | PS2 | 251 | 2026-11-17 | 200 | — |
| 492 | [God of War (god-of-war-recomp)](https://github.com/KIexster/god-of-war-recomp) | PS2 | 237 | 2026-11-06 | 200 | — |
| 493 | [Killzone (KillzoneRecomp)](https://github.com/drakolordx7/KillzoneRecomp) | PS2 | 192 | 2026-11-16 | 200† | AI |
| 494 | [Burnout 3: Takedown (burnout3 (xboxrecomp))](https://github.com/sp00nznet/burnout3) | PS2 | 165 | 2026-10-20 | 200 | — |
| 495 | [Ace Combat 5: The Unsung War (Ace Combat 5 Recompilation)](https://github.com/sal063/Ace-Combat-5-Static-recompilation) | PS2 | 149 | 2026-10-24 | 200 | AI |
| 496 | [Resident Evil Outbreak (RE: Outbreak Recomp)](https://github.com/Ninjacornix/reo) | PS2 | 146 | 2026-11-04 | 200 | AI |
| 497 | [Dragon Ball Z: Budokai Tenkaichi 3 (BT3-Recomp)](https://github.com/z3xox/BT3-Recomp) | PS2 | 136 | 2026-10-01 | 200 | — |
| 498 | [DQ8 Recompiled](https://github.com/Sinan-Karakaya/DQ8-Recompiled) | PS2 | 133 | 2026-10-23 | 200 | AI |
| 499 | [PCSX2 (PCSX2 Reliquary)](https://github.com/DiscoStarslayer/pcsx2-reliquary) | PS2 | 129 | 2026-10-29 | 200 | AI |
| 500 | [Midnight Club 3: DUB Edition (mcdub3-nx)](https://github.com/laureladastra/mcdub3-nx) | PS2 | 122 | 2026-11-06 | 200† | — |
| 501 | [God of War II (gow2-recomp (PS3 HD))](https://github.com/andrebrumdev/gow2-recomp) | PS2 | 108 | 2026-10-19 | 200 | — |
| 502 | [Ridge Racer V (Fukami)](https://github.com/danisandoval/fukami) | PS2 | 104 | 2026-10-14 | 200 | AI |
| 503 | [Rogue Galaxy (Rogue Galaxy Recompiled)](https://github.com/victor-takai/rogue-galaxy-recomp) | PS2 | 92 | 2026-11-16 | 200 | AI |
| 504 | [Urban Reign (Urban Reign — PC Port)](https://github.com/thiagordsfx/urban-reign-recomp) | PS2 | 87 | 2026-11-04 | 200 | AI |
| 505 | [Spider-Man 2 (SM2-Recomp)](https://github.com/SirSymo/SM2-Recomp) | PS2 | 78 | 2026-11-03 | 200 | — |
| 506 | [Zone of the Enders (ZOE-Recompiled)](https://github.com/Yaz-Myst/ZOE-Recompiled) | PS2 | 72 | 2026-11-14 | 200 | — |
| 507 | [TimeSplitters 2 (TimeSplitters 2 Recomp)](https://github.com/Destinity13/TimeSplitters-2-Native-Recomp-Windows-Linux-SteamDeck) | PS2 | 68 | 2026-11-18 | 200 | AI |
| 508 | [WWE SmackDown! Here Comes the Pain (Here Comes The Pain Recomp)](https://github.com/BigDaddyJRich/hctp-recomp) | PS2 | 67 | 2026-11-19 | 200 | AI |
| 509 | [TimeSplitters (TimeSplitters (PS2) Static Recompilation)](https://github.com/GTTeancum/Timesplitters) | PS2 | 62 | 2026-11-16 | 200 | AI |
| 510 | [Silent Hill 2 (sh2-nx)](https://github.com/cutarev/sh2-nx) | PS2 | 58 | 2026-11-09 | 200 | — |
| 511 | [Transformers (Transformers Armada: Prelude to Energon)](https://github.com/kayliox/transformers-armada-recomp) | PS2 | 58 | 2026-11-19 | 200 | AI |
| 512 | [.hack//Infection (Recompilation)](https://github.com/dothacktranslate/dothack-recompilation) | PS2 | 57 | 2026-09-14 | 200 | — |
| 513 | [Def Jam Vendetta (Def Jam Vendetta Recompiled)](https://github.com/jcsix694/def-jam-vendetta-recomp) | PS2 | 57 | 2026-11-18 | 200 | — |
| 514 | [Shadow of Rome (Shadow of Rome Recompiled)](https://github.com/Korvonordico/shadow-of-rome-recompiled) | PS2 | 53 | 2026-11-18 | 200 | AI |
| 515 | [Twisted Metal: Black (TMB_Recomp)](https://github.com/TheBozos/TMB_Recomp) | PS2 | 46 | 2026-11-18 | 200 | AI |
| 516 | [God Hand (God Hand Recompiled)](https://github.com/LasVola/godhand-recomp) | PS2 | 44 | 2026-10-20 | 200 | — |
| 517 | [Guitar Hero II (GH Classic)](https://github.com/noahbaxter/GHClassic) | PS2 | 44 | 2026-11-18 | 200 | — |
| 518 | [Dark Cloud 2 (DC2-PS2RECOMP)](https://github.com/Red-tv141/DC2-PS2RECOMP) | PS2 | 43 | 2026-11-17 | 200 | — |
| 519 | [SOCOM II: U.S. Navy SEALs (SOCOM Unzipped)](https://github.com/Scotho/socom-unzipped) | PS2 | 42 | 2026-11-15 | 200 | — |
| 520 | [Resident Evil Outbreak (reo)](https://github.com/sp00nznet/reo) | PS2 | 38 | 2026-10-19 | 200 | — |
| 521 | [Resident Evil Outbreak (Resident Evil Outbreak Recompiled)](https://github.com/RaccoonRecomp/ResidentEvilOutbreakRecompiled) | PS2 | 38 | 2026-10-13 | 200 | — |
| 522 | [Saint Seiya: The Hades (SaintSeiyaRecomp)](https://github.com/matpdev/SaintSeiyaRecomp) | PS2 | 36 | 2026-11-12 | 200 | AI |
| 523 | [War of the Monsters (War of the Monsters Recompiled!)](https://github.com/yanm1103/War_of_the_Monsters_recomp) | PS2 | 34 | 2026-11-18 | 200 | AI |
| 524 | [Burnout Dominator (BurnoutDominatorReversed)](https://github.com/literalynn/BurnoutDominatorReversed) | PS2 | 33 | 2026-11-17 | 200 | — |
| 525 | [Castlevania: Curse of Darkness (Castlevania: Curse of Darkness Recomp)](https://github.com/fasipe/Castlevania-COD-QOL) | PS2 | 32 | 2026-11-17 | 200 | AI |
| 526 | [Def Jam: Fight for NY (defjam_recomp (comoria08))](https://github.com/comoria08/defjam_recomp) | PS2 | 31 | 2026-11-01 | 200 | — |
| 527 | [Dragon Ball Z: Budokai Tenkaichi 3 (DBZ BT4 Recomp)](https://github.com/recomp-code/dbz-bt4-recomp) | PS2 | 31 | 2026-10-28 | 200 | — |
| 528 | [007: Nightfire (007: NightFire Remastered (PC))](https://github.com/papand7/nightfire-recomp) | PS2 | 29 | 2026-11-15 | 200 | — |
| 529 | [Road Trip Adventure (RoadTripAdventure-recomp)](https://github.com/silentsudin/RoadTripAdventure-recomp) | PS2 | 29 | 2026-10-11 | 200 | — |
| 530 | [Def Jam: Fight for NY (FFNY Online)](https://github.com/sweeax-exe/ffny-online) | PS2 | 28 | 2026-11-18 | 200 | — |
| 531 | [King's Field: The Ancient City (KFIV-PC (holyland))](https://github.com/Voicedrew11/darker-reality) | PS2 | 28 | 2026-11-19 | 200 | — |
| 532 | [Valkyrie Profile 2: Silmeria (VP2S_Recomp)](https://github.com/TheBozos/VP2S_Recomp) | PS2 | 26 | 2026-11-19 | 200 | — |
| 533 | [Burnout 3: Takedown (Burnout3Recomp)](https://github.com/mxmstr/Burnout3Recomp) | PS2 | 25 | 2026-05-23 | 200 | — |
| 534 | [Soulcalibur III (SoulCaliburIII_Recomp)](https://github.com/TheBozos/SoulCaliburIII_Recomp) | PS2 | 25 | 2026-11-19 | 200 | — |
| 535 | [Castlevania: Curse of Darkness (Castlevania COD Recomp)](https://github.com/Neguchads/Castlevania-COD-Recomp) | PS2 | 24 | 2026-11-03 | 200 | — |
| 536 | [God of War II (Gow2HD-Windows)](https://github.com/sethlikepie/Gow2HD-Windows) | PS2 | 23 | 2026-10-12 | 200 | — |
| 537 | [Battle Stadium D.O.N (Battle Stadium D.O.N Recomp)](https://github.com/dvilelaf/battlestadium-don) | PS2 | 22 | 2026-11-16 | 200 | AI |
| 538 | [Dragon Ball Z: Budokai Tenkaichi 2 (BT2 Recomp)](https://github.com/oric212/BT2-Recomp) | PS2 | 21 | 2026-11-17 | 200 | AI |
| 539 | [Champions of Norrath (champions-of-norrath (ensapra))](https://github.com/ensapra/champions-of-norrath) | PS2 | 20 | 2026-10-31 | 200 | AI |
| 540 | [SSX Tricky (ssx-tricky-recomp (Linux-first))](https://github.com/reindance/ssx-tricky-recomp) | PS2 | 20 | 2026-10-11 | 200 | — |
| 541 | [Burnout Revenge (Burnout Revenge for Mac)](https://github.com/secretpray/burnout-revenge) | PS2 | 18 | 2026-10-29 | 200 | — |
| 542 | [Crash Twinsanity (Ps2Recomp (menaman123))](https://github.com/menaman123/NativeEE) | PS2 | 17 | 2026-10-24 | 200 | — |
| 543 | [Maximo: Ghosts to Glory (Maximo-GTG)](https://github.com/BioRhythmicStudios/Maximo-GTG) | PS2 | 17 | 2026-11-11 | 200 | AI |
| 544 | [Spider-Man 2 (Spider-Man 2 (Xbox) for Nintendo Switch)](https://github.com/SantiBros/SpiderMan2-2004-NX) | PS2 | 15 | 2026-11-13 | 200 | — |
| 545 | [Devil May Cry (dmc-recomp)](https://github.com/Gui-Tora/dmc-recomp) | PS2 | 14 | 2026-11-18 | 200 | — |
| 546 | [Burnout 3: Takedown (PS5_Burnout3)](https://github.com/griches/PS5_Burnout3) | PS2 | 13 | 2026-10-22 | 200 | — |
| 547 | [Shadow of the Colossus (SotCStaticRecompilation)](https://github.com/InconspicuousCactus/SotCStaticRecompilation) | PS2 | 13 | 2024-06-08 | 200 | — |
| 548 | [Mortal Kombat: Shaolin Monks (Shaolin Monks NX)](https://github.com/Thorhax/ShaolinMonks-NX) | PS2 | 12 | 2026-11-10 | 200 | — |
| 549 | [Medal of Honor: Frontline (MOHFrontline-GC-RECOMP)](https://github.com/ant0-blase/MOHFrontline-GC-RECOMP) | PS2 | 11 | 2026-11-04 | 200 | — |
| 550 | [.hack//Infection (Decompilation)](https://github.com/dothacktranslate/dothack-decompilation) | PS2 | 10 | 2026-09-21 | 200 | — |
| 551 | [Demon's Souls (Soulbrandt)](https://github.com/JonathanDC64/Soulbrandt) | PS3 | 509 | 2026-11-19 | 200 | AI |
| 552 | [inFamous (inFAMOUSreborn)](https://github.com/whompay/inFAMOUSreborn) | PS3 | 508 | 2026-11-17 | 200 | AI |
| 553 | [God of War: Ascension](https://github.com/arnaldolima1/gow-ascension-pc) | PS3 | 451 | 2026-11-10 | 200 | — |
| 554 | [Drakengard 3 (Drakengard 3 Recompiled)](https://github.com/soyjxck/dod3-recomp) | PS3 | 352 | 2026-11-01 | 200 | AI |
| 555 | [Demon's Souls (Demon's Souls Recomp)](https://github.com/timboat/demons-souls-recomp) | PS3 | 246 | 2026-11-16 | 200 | AI |
| 556 | [Resident Evil Code: Veronica X (RE-Code-Veronica-PS3-HD-Recomp-PC)](https://github.com/kastieloficial/RE-Code-Veronica-PS3-HD-Recomp-PC) | PS3 | 232 | 2026-11-14 | 200 | AI |
| 557 | [Ratchet & Clank: Tools of Destruction (Ratchet & Clank: Tools of Destruction Recompiled)](https://github.com/Re-TeRo17/ratchet-tod-recomp) | PS3 | 177 | 2026-11-16 | 200 | — |
| 558 | [Ratchet & Clank: A Crack in Time (RACiT)](https://github.com/HighDrexler/RACiT) | PS3 | 172 | 2026-11-19 | 200 | — |
| 559 | [Killzone 3 (Project Helghast)](https://github.com/undecuple/project-helghast) | PS3 | 171 | 2026-11-19 | 200 | AI |
| 560 | [God of War: Ascension (Ascension-R)](https://github.com/rigaz29/Ascension-R) | PS3 | 167 | 2026-11-19 | 200 | — |
| 561 | [Killzone 2 (Project Pyrrhus)](https://github.com/undecuple/project-pyrrhus) | PS3 | 158 | 2026-11-19 | 200 | AI |
| 562 | [Resistance: Fall of Man (Resistance: Fall of Man: native PC port)](https://github.com/miroslavdanutalexandru-alt/Resistance-Fall-of-Man-Recomp) | PS3 | 126 | 2026-11-11 | 200 | AI |
| 563 | [God of War: Ascension (God of War: Ascension PC)](https://github.com/otavix010/gow-ascension-pc) | PS3 | 106 | 2026-11-19 | 200 | — |
| 564 | [F1 CE PS3 Recomp](https://github.com/mauricristiano95-hub/F1_CE_PS3) | PS3 | 97 | 2026-11-17 | 200 | — |
| 565 | [Folklore (Folklore Recomp)](https://github.com/Mava-b/folklore-decomp) | PS3 | 95 | 2026-11-17 | 200 | AI |
| 566 | [ARMORED CORE for Answer (ARMORED CORE for Answer Recomp)](https://github.com/SulphurS16/ACFA-Port) | PS3 | 93 | 2026-11-14 | 200 | AI |
| 567 | [Gran Turismo 5 Prologue (Project Tourline Prologue)](https://github.com/mathewdouglas/Tourline-Prologue) | PS3 | 49 | 2026-11-10 | 200 | AI |
| 568 | [White Knight Chronicles II (White Knight Chronicles II Recomp)](https://github.com/WK2D/White-Knight-Chronicles-2-Recomp) | PS3 | 34 | 2026-10-22 | 200 | — |
| 569 | [God of War: Ascension (God of War: Ascension Recompiled)](https://github.com/MaChInEgUn3/God-of-War-Ascension-Recompiled) | PS3 | 32 | 2026-11-16 | 200 | — |
| 570 | [Bleach: Soul Resurrección (bleach-soul-resurreccion-recomp)](https://github.com/xPXavierx/bleach-soul-resurreccion-recomp) | PS3 | 31 | 2026-11-15 | 200 | AI |
| 571 | [Killzone HD (Project Vekta)](https://github.com/gustavomorinaga/project-vekta) | PS3 | 31 | 2026-11-19 | 200 | AI |
| 572 | [Resistance: Fall of Man (Resistance: Fall of Man Recomp)](https://github.com/Psyykosis/Resistance-Fall-of-Man-Recomp) | PS3 | 30 | 2026-10-31 | 200 | — |
| 573 | [Haze (Haze Recomp)](https://github.com/zdiemer/haze-recomp) | PS3 | 29 | 2026-10-25 | 200 | AI |
| 574 | [Tony Hawk's Project 8 (Project 8 Plus)](https://github.com/MaxLeiter/project-8-plus) | PS3 | 26 | 2026-10-27 | 200 | AI |
| 575 | [Twisted Metal](https://github.com/sp00nznet/twistedmetal) | PS3 | 24 | 2026-10-03 | 200 | — |
| 576 | [inFAMOUS 2 (infamous2-recomp)](https://github.com/erikomis/infamous2-recomp) | PS3 | 22 | 2026-11-15 | 200 | — |
| 577 | [Shadow of the Colossus (HD)](https://github.com/sp00nznet/shadowofthecolossus) | PS3 | 22 | 2026-10-21 | 200 | — |
| 578 | [flOw](https://github.com/sp00nznet/flow) | PS3 | 20 | 2026-10-14 | 200 | — |
| 579 | [Tokyo Jungle (Tokyo Jungle Recompiled)](https://github.com/sp00nznet/tokyojungle) | PS3 | 17 | 2026-09-06 | 200 | — |
| 580 | [God of War: Ascension (God of War: Ascension for PC)](https://github.com/RichardFontoura/gowa-pc) | PS3 | 14 | 2026-10-17 | 200 | — |
| 581 | [Dragon Ball Z: Budokai HD Collection (DBZ-Budokai-1-HD-Collection)](https://github.com/novapowers0/DBZ-Budokai-1-HD-Collection) | PS3 | 11 | 2026-09-11 | 200 | — |
| 582 | [Lantern Engine](https://github.com/Awakenchan/LanternEngine) | PS4 | 1,832 | 2026-11-17 | 200 | AI |
| 583 | [DriveClub (DriveClub Recomp)](https://github.com/OverkillLabs3/driveclub-recomp) | PS4 | 1,058 | 2026-11-09 | 200 | AI |
| 584 | [Bloodborne (bbhost)](https://github.com/droogie/bbhost) | PS4 | 858 | 2026-11-17 | 200 | AI |
| 585 | [Bloodborne](https://github.com/bloodborne-native/bloodborne-recomp) | PS4 | 44 | 2026-11-03 | 200 | — |
| 586 | [Bloodborne (Bloodborne Android Rebuild Tool)](https://github.com/ducvd89/Bloodborne-android-rebuild-tool) | PS4 | 14 | 2026-10-29 | 200 | — |
| 587 | [PPSSPP](https://github.com/hrydgard/ppsspp) | PSP | 14,947 | 2026-11-19 | 200 | AI |
| 588 | [God of War: Chains of Olympus (PSP Web Recomp)](https://github.com/snuri00/psp-web-recomp) | PSP | 434 | 2026-10-15 | 200 | — |
| 589 | [LCS Recomp](https://github.com/elmasas/lcs-recomp) | PSP | 307 | 2026-11-15 | 200 | AI |
| 590 | [God of War (God of War PSP Recomp)](https://github.com/DrummingBird1/gow-psp-recomp) | PSP | 213 | 2026-11-13 | 200 | AI |
| 591 | [Ace Combat X: Skies of Deception (Ace Combat X Recompilation)](https://github.com/sal063/Ace-Combat-X-Recompilation) | PSP | 105 | 2026-08-28 | 200 | — |
| 592 | [Dissidia 012 Duodecim Final Fantasy (Dissidia012-PC)](https://github.com/VCKing101/Dissidia012-pc) | PSP | 100 | 2026-11-16 | 200 | AI |
| 593 | [God of War: Ghost of Sparta](https://github.com/arnaldolima1/gow-ghost-of-sparta-pc) | PSP | 87 | 2026-10-16 | 200 | — |
| 594 | [Monster Hunter Freedom Unite (Monster Hunter: Freedom Unite Recomp)](https://github.com/PateeerQ/FreedomUniteRecomp) | PSP | 64 | 2026-11-15 | 200 | — |
| 595 | [Grand Theft Auto: Vice City Stories (PSPRecomp-VCS-Android)](https://github.com/codepdbh/PSPRecomp-VCS-Android) | PSP | 55 | 2026-10-22 | 200 | — |
| 596 | [God of War: Chains of Olympus](https://github.com/arnaldolima1/gow-chains-of-olympus-pc) | PSP | 48 | 2026-10-16 | 200 | — |
| 597 | [Metal Gear Solid: Portable Ops (Portable Ops Native)](https://github.com/zexk/portable-ops-native) | PSP | 45 | 2026-11-13 | 200 | — |
| 598 | [Star Wars Battlefront: Renegade Squadron (Star Wars Renegade Squadron Recomp)](https://github.com/GTTeancum/StarWars-RenegadeSquadron-PC) | PSP | 34 | 2026-10-28 | 200 | — |
| 599 | [Ridge Racer (Ridge Racer (PSP) – Static Recomp)](https://github.com/SpeedyJustice2/Ridge-Racer-PSP-Static-Recomp) | PSP | 31 | 2026-11-10 | 200 | AI |
| 600 | [Yu-Gi-Oh! GX Tag Force (Tag Force Recomp (preview))](https://github.com/Artknighty/tagforcerecomp-preview) | PSP | 31 | 2026-11-11 | 200 | — |
| 601 | [Wipeout Pure (pure-recomp)](https://github.com/erreib/pure-recomp) | PSP | 27 | 2026-10-23 | 200 | AI |
| 602 | [Burnout Legends (Burnout Legends for PS Vita)](https://github.com/LAB0ULANGE/BurnoutLegends-Vita) | PSP | 24 | 2026-11-14 | 200 | — |
| 603 | [Phantasy Star Portable 2 Infinity (PSP2I_Recomp)](https://github.com/zmbkilla/PSP2I_Recomp) | PSP | 24 | 2026-10-27 | 200 | — |
| 604 | [Metal Gear Solid: Portable Ops (MGS Portable Ops static recompilation)](https://github.com/ccbury/MGSPOStaticRecomp) | PSP | 23 | 2026-11-04 | 200 | — |
| 605 | [Tekken: Dark Resurrection (PSP Recomp)](https://github.com/gasparegas/tkdr-recomp) | PSP | 19 | 2026-11-01 | 200 | — |
| 606 | [Grand Theft Auto: Liberty City Stories (PSPRecomp-LCS-Android)](https://github.com/codepdbh/PSPRecomp-LCS-Android) | PSP | 18 | 2026-10-22 | 200 | — |
| 607 | [God of War: Chains of Olympus (VibeRecomp-for-GoW-CoO)](https://github.com/Simeony2007/VibeRecomp-for-GoW-CoO) | PSP | 15 | 2026-10-19 | 200 | — |
| 608 | [Saru Get You: Saru Saru Daisakusen (Ape Escape Mind Over Monkey)](https://github.com/jackgllghr/bigmission-recomp) | PSP | 12 | 2026-11-12 | 200 | AI |
| 609 | [Fighters Megamix (Fighters Megamix Recomp)](https://github.com/tmcleroy/fighters-megamix-recomp) | Saturn | 36 | 2026-11-19 | 200 | AI |
| 610 | [Shining Force III (Shining Force III Native)](https://github.com/mattkuhnQAAI/sfiii-native) | Saturn | 19 | 2026-11-18 | 200 | — |
| 611 | [Sonic CD (Little Planet)](https://github.com/carl0srmz/littleplanet) | Sega CD/32X | 55 | 2026-11-19 | 200 | — |
| 612 | [bsnes](https://github.com/bsnes-emu/bsnes) | SNES | 2,018 | 2026-10-07 | 200 | — |
| 613 | [Donkey Kong Country (DKC1Recomp)](https://github.com/elliotttate/DKC1Recomp) | SNES | 307 | 2026-09-15 | 200 | AI |
| 614 | [Mega Man X (Mega Man X SNES Recomp)](https://github.com/mstan/MegaManXSNESRecomp) | SNES | 234 | 2026-11-18 | 200 | AI |
| 615 | [Donkey Kong Country 2: Diddy's Kong Quest (DKC2Recomp)](https://github.com/elliotttate/DKC2Recomp) | SNES | 203 | 2026-09-13 | 200 | AI |
| 616 | [Super Mario World (SuperMarioWorldRecomp)](https://github.com/mstan/SuperMarioWorldRecomp) | SNES | 184 | 2026-11-15 | 200 | AI |
| 617 | [Donkey Kong Country 3: Dixie Kong's Double Trouble! (DKC3Recomp)](https://github.com/elliotttate/DKC3Recomp) | SNES | 165 | 2026-09-13 | 200 | AI |
| 618 | [Super Metroid (SuperMetroidSNESRecomp)](https://github.com/mstan/SuperMetroidRecomp) | SNES | 160 | 2026-11-09 | 200 | AI |
| 619 | [F-Zero (FZeroSNESRecomp)](https://github.com/RetroPortingToolKit/F-ZeroForever) | SNES | 121 | 2026-11-17 | 200 | AI |
| 620 | [The Legend of Zelda: A Link to the Past (ZeldaAlttPSNESRecomp)](https://github.com/mstan/ZeldaAlttPSNESRecomp) | SNES | 77 | 2026-11-06 | 200 | AI |
| 621 | [Earthbound Companion](https://github.com/rages4calm/earthbound-companion) | SNES | 55 | 2026-11-14 | 200 | AI |
| 622 | [Mega Man X2 (MegaManX2SNESRecomp)](https://github.com/mstan/MegaManX2Recomp) | SNES | 53 | 2026-11-06 | 200 | AI |
| 623 | [F-Zero (F-Zero Recomp)](https://github.com/craigshaw/FZeroRecomp) | SNES | 48 | 2026-10-18 | 200 | AI |
| 624 | [International Superstar Soccer Deluxe (ISSD Native)](https://github.com/sergiomanzur/issd-native) | SNES | 45 | 2026-10-22 | 200 | AI |
| 625 | [Starfox Recomp](https://github.com/mstan/StarFoxSNESRecomp) | SNES | 41 | 2026-11-06 | 200 | — |
| 626 | [Dragon Ball Z: Super Saiya Densetsu](https://github.com/JackRushante/DBZ-Super-Saiya-Densetsu-Rust) | SNES | 30 | 2026-11-16 | 200 | AI |
| 627 | [ActRaiser (ActRaiser Recompiled)](https://github.com/DerrickGold/ar-recomp) | SNES | 29 | 2026-11-17 | 200 | AI |
| 628 | [Super Mario RPG: Legend of the Seven Stars (SuperMarioRPGRecomp)](https://github.com/mstan/SuperMarioRPGRecomp) | SNES | 22 | 2026-11-06 | 200 | AI |
| 629 | [Uniracers (Uniracers Recomp)](https://github.com/fselich/redcomp-dream) | SNES | 19 | 2026-10-25 | 200 | AI |
| 630 | [Lufia II: Rise of the Sinistrals (Lufia2SNESRecomp)](https://github.com/Cellenseres/Lufia2SNESRecomp) | SNES | 17 | 2026-11-18 | 200 | — |
| 631 | [Beyond Oasis (Beyond Oasis Recomp)](https://github.com/OriginalSwayze/beyond-oasis-recomp) | SNES | 15 | 2026-11-13 | 200 | AI |
| 632 | [Mega Man X3 (MegamanX3SNESRecomp)](https://github.com/mstan/MegamanX3SNESRecomp) | SNES | 15 | 2026-11-06 | 200 | — |
| 633 | [Super Bomberman (BombermanRecomp)](https://github.com/elliotttate/BombermanRecomp) | SNES | 15 | 2026-08-26 | 200 | — |
| 634 | [Super Mario Kart (super_mario_kart_recompilation)](https://github.com/jvipond/super_mario_kart_recompilation) | SNES | 12 | 2020-03-26 | 200 | — |
| 635 | [Jungle Strike (Jungle-Strike-SNES-Static-Recomp)](https://github.com/Junior-Jones/Jungle-Strike-SNES-Static-Recomp) | SNES | 11 | 2026-11-18 | 200 | — |
| 636 | [TotK Recomp](https://github.com/valentderah/totk-pc-recomp) | Switch | 7,719 | 2026-11-15 | 200 | AI |
| 637 | [The Legend of Zelda: Breath of the Wild (Savage Wind Recomp)](https://github.com/Revivedx/SavageWindRecomp) | Switch | 4,817 | 2026-11-16 | 200 | AI |
| 638 | [The Legend of Zelda: Link's Awakening (LAS Recomp)](https://github.com/peiikai/LASRecomp) | Switch | 2,503 | 2026-11-19 | 200 | AI |
| 639 | [The Legend of Zelda: Breath of the Wild (BOTWRecompAndroid)](https://github.com/mamcjr/BOTWRecompAndroid) | Switch | 979 | 2026-11-18 | 200 | AI |
| 640 | [The Legend of Zelda: Tears of the Kingdom (UltraTears)](https://github.com/kuraeow/ultratears) | Switch | 943 | 2026-11-17 | 200 | AI |
| 641 | [Monster Hunter Generations Ultimate (MHGU Recomp)](https://github.com/morerokk/MHGURecomp) | Switch | 667 | 2026-11-19 | 200 | AI |
| 642 | [Astral Chain (Astral Chain Recomp)](https://github.com/captainj-sparrow/astral-chain-pc-recomp) | Switch | 658 | 2026-11-19 | 200 | AI |
| 643 | [Bayonetta 2 (B2recomp)](https://github.com/K0NL/B2recomp) | Switch | 631 | 2026-10-23 | 200 | AI |
| 644 | [Super Smash Bros. Ultimate (ssbu-recomp)](https://github.com/OpenSmash-Ultimate/ssbu-recomp) | Switch | 618 | 2026-11-13 | 200 | — |
| 645 | [Pokopia (Pokopia Recomp)](https://github.com/drakolordx7/switch2-recomp) | Switch | 526 | 2026-11-04 | 200 | — |
| 646 | [Metroid Dread (Metroid Dread Recomp)](https://github.com/yozander2009-stack/Metroid-Dread-Recomp) | Switch | 451 | 2026-11-19 | 200 | AI |
| 647 | [Super Mario Odyssey (Super Odyssey PC Recomp)](https://github.com/Simon3Sarkis/super-odyssey-pc-recomp) | Switch | 405 | 2026-11-19 | 200 | AI |
| 648 | [Xenoblade Chronicles 2 (XC2 Recomp)](https://github.com/AksharDP/xc2-recomp) | Switch | 378 | 2026-11-19 | 200 | AI |
| 649 | [Animal Crossing: New Horizons (ACNHRecomp)](https://github.com/Nycolazs/ACNHRecomp) | Switch | 365 | 2026-11-17 | 200 | AI |
| 650 | [Xenoblade Chronicles X (XCX Recomp)](https://github.com/jmars125/xcx-recomp) | Switch | 354 | 2026-11-18 | 200 | AI |
| 651 | [Pokémon Legends: Z-A (ZA Recomp)](https://github.com/Hexveil404/PokeZ-ARecomp) | Switch | 342 | 2026-11-18 | 200 | AI |
| 652 | [The Legend of Zelda: Tears of the Kingdom (Weeping of the Empire)](https://github.com/daniel-madrid-07/weeping-of-the-empire) | Switch | 338 | 2026-11-07 | 200 | AI |
| 653 | [Pokémon Let's Go, Pikachu! / Let's Go, Eevee! (Let's Go Recomp)](https://github.com/raulzrrs/letsgo-recomp) | Switch | 315 | 2026-11-18 | 200 | AI |
| 654 | [Metroid Prime Remastered (PrimeRecomp)](https://github.com/gminustwo/primerecomp) | Switch | 313 | 2026-11-19 | 200 | AI |
| 655 | [Super Mario Maker 2](https://github.com/smm2recomp/smm2recomp) | Switch | 291 | 2026-11-18 | 200 | — |
| 656 | [Mario Kart 8 Deluxe (MK8-online)](https://github.com/Vnnc1/MK8-online) | Switch | 214 | 2026-11-16 | 200 | AI |
| 657 | [Super Smash Bros. Ultimate (OpenSmash-Ultimate)](https://github.com/OpenSmash-Ultimate/OpenSmash-Ultimate) | Switch | 212 | 2026-11-18 | 200 | AI |
| 658 | [Xenoblade Chronicles 3 (XC3 Recomp)](https://github.com/jmars125/xc3-recomp) | Switch | 207 | 2026-11-17 | 200 | AI |
| 659 | [Xenoblade Chronicles: Definitive Edition (Monado)](https://github.com/Ivanprestef2/Monado-Reborn) | Switch | 187 | 2026-11-19 | 200 | AI |
| 660 | [The Legend of Zelda: Echoes of Wisdom (EoWRecomp)](https://github.com/Nycolazs/EoWRecomp) | Switch | 156 | 2026-10-21 | 200 | AI |
| 661 | [Super Mario Bros. Wonder (SuperWonders)](https://github.com/vfjoo888/SuperWonders) | Switch | 143 | 2026-11-19 | 200 | AI |
| 662 | [Bayonetta 3 (B3-Express)](https://github.com/LuvAbyss/B3-Express) | Switch | 138 | 2026-11-19 | 200 | AI |
| 663 | [Hyrule Warriors: Definitive Edition (HWDER)](https://github.com/blocker-3/HWDER) | Switch | 133 | 2026-11-01 | 200 | AI |
| 664 | [Metroid Prime 4: Beyond (salsburysteaks)](https://github.com/PlagueDrRiess/salsburysteaks) | Switch | 126 | 2026-11-17 | 200 | AI |
| 665 | [Astral Chain (AstralChain-PC)](https://github.com/Puddz/AstralChain-PC) | Switch | 119 | 2026-11-19 | 200 | AI |
| 666 | [The Legend of Zelda: Link's Awakening (LAS Recomp for Android)](https://github.com/mamcjr/LASRecompAndroid) | Switch | 117 | 2026-11-14 | 200 | AI |
| 667 | [Pokémon Legends: Arceus (Arceuszada)](https://github.com/CarlosExabyte/Arceuszada) | Switch | 114 | 2026-11-02 | 200 | — |
| 668 | [Metroid Prime 4: Beyond (Metroid Prime 4 Recomp)](https://github.com/linuxopt/mp4-recomp) | Switch | 112 | 2026-11-19 | 200 | AI |
| 669 | [Pokémon Legends: Arceus (PokeL-ARecomp)](https://github.com/fabioschmidt01/PokeL-ARecomp) | Switch | 111 | 2026-11-14 | 200 | AI |
| 670 | [The Legend of Zelda: Tears of the Kingdom (totk-recomp)](https://github.com/Muhammad1259-sigma/totk-recomp) | Switch | 111 | 2026-10-20 | 200 | — |
| 671 | [Tomodachi Life (TomodachiLife Recomp)](https://github.com/josiahg2502-glitch/TomodachiLife-recomp) | Switch | 110 | 2026-11-06 | 200 | AI |
| 672 | [The Legend of Zelda: Breath of the Wild (BotW Recompiled)](https://github.com/IshaanKalra2103/BotWRecomp) | Switch | 109 | 2026-10-17 | 200 | — |
| 673 | [Mario Kart 8 Deluxe (Racing 8 DX Recomp)](https://github.com/galarianpikachu2021-hue/Racing-8-DX-Recomp) | Switch | 108 | 2026-11-19 | 200 | AI |
| 674 | [Super Mario Odyssey (OdysseyRecomp)](https://github.com/rwwo8/OdysseyRecomp) | Switch | 102 | 2026-11-17 | 200 | AI |
| 675 | [Super Mario Odyssey (smo-recomp)](https://github.com/Coz-0/smo-recomp) | Switch | 102 | 2026-10-28 | 200 | — |
| 676 | [Pokemon Scarlet & Violet (KarPur)](https://github.com/Grunttanamo/KarPur) | Switch | 99 | 2026-11-18 | 200 | AI |
| 677 | [Super Mario Bros. Wonder (SMW)](https://github.com/iHaiDeeZ/SMW) | Switch | 91 | 2026-10-19 | 200 | — |
| 678 | [Tomodachi Life: Living the Dream (Tomodachi LTD Recomp)](https://github.com/RussoPhone/tomodachi-ltd-recomp) | Switch | 64 | 2026-11-12 | 200 | — |
| 679 | [Pokémon Sword (SwSh Recomp)](https://github.com/raulzrrs/swsh-recomp) | Switch | 63 | 2026-11-18 | 200 | — |
| 680 | [Mario & Luigi: Brothership (Brothership Recomp)](https://github.com/Coaltergeist/Brothership-Recomp) | Switch | 42 | 2026-11-15 | 200 | — |
| 681 | [Yo-kai Watch 4 (YW4 Recomp)](https://github.com/ILFforever/YW4Recomp) | Switch | 38 | 2026-11-19 | 200 | AI |
| 682 | [Metroid Prime 4: Beyond (Metroid Prime 4 PC Recomp)](https://github.com/jaigner-hub/metroid-prime-4-recomp) | Switch | 37 | 2026-11-16 | 200 | AI |
| 683 | [The Legend of Zelda: Breath of the Wild (BOTWRecomp)](https://github.com/vasist15-source/BOTWRecomp) | Switch | 33 | 2026-11-17 | 200 | — |
| 684 | [Astral Chain (AC-Recomp)](https://github.com/swaymun/AC-Recomp) | Switch | 32 | 2026-10-22 | 200 | — |
| 685 | [Fire Emblem: Three Houses (FE3H PC Recomp)](https://github.com/jaigner-hub/fe3h-pc-recomp) | Switch | 27 | 2026-11-01 | 200 | — |
| 686 | [The Legend of Zelda: Breath of the Wild (BOTW (PS4 recomp))](https://github.com/iHaiDeeZ/BOTW) | Switch | 25 | 2026-10-24 | 200 | — |
| 687 | [The Legend of Zelda: Tears of the Kingdom (TOTK-PS4)](https://github.com/iHaiDeeZ/TOTK-PS4) | Switch | 25 | 2026-10-24 | 200 | — |
| 688 | [Pokémon Brilliant Diamond and Shining Pearl (BDSP-Recomp)](https://github.com/Deleter08/BDSP-Recomp) | Switch | 24 | 2026-10-26 | 200 | AI |
| 689 | [Super Mario Bros. 35 (SM35 Recomp)](https://github.com/sm35recomp/sm35recomp) | Switch | 22 | 2026-10-21 | 200 | — |
| 690 | [Cruis'n Blast (cruisn-blast-recomp)](https://github.com/darkuni/cruisn-blast-recomp) | Switch | 21 | 2026-11-16 | 200 | — |
| 691 | [Super Kirby Clash (KirbyRecomp)](https://github.com/xtamqispeak/KirbyRecomp) | Switch | 18 | 2026-10-28 | 200 | — |
| 692 | [Shadow Fight 2 (SF2Recomp)](https://github.com/bipinkrish/sf2recomp) | Switch | 17 | 2026-11-13 | 200 | AI |
| 693 | [The Legend of Zelda: Breath of the Wild (SavageWindRecomp-Android)](https://github.com/deivid22srk/SavageWindRecomp-Android) | Switch | 15 | 2026-10-22 | 200 | — |
| 694 | [Pokémon Sword and Shield (SwSh Recomp)](https://github.com/voerasdotcom/swsh-recomp) | Switch | 14 | 2026-11-08 | 200 | — |
| 695 | [Fire Emblem: Fortune's Weave (fefw-recomp)](https://github.com/GregorioRuiz98/fefw-recomp) | Switch | 12 | 2026-11-10 | 200 | AI |
| 696 | [The Legend of Zelda: Ocarina of Time (Switch 2) (HookLink)](https://github.com/dsi-hub/HookLink) | Switch 2 | 146 | 2026-11-18 | 200 | — |
| 697 | [The Legend of Zelda: Ocarina of Time (Switch 2) (Echora)](https://github.com/Mars7x/echora) | Switch 2 | 34 | 2026-11-19 | 200 | — |
| 698 | [The Legend of Zelda: Ocarina of Time (Switch 2) (oot-pc-recomp)](https://github.com/Chiuauaa/oot-pc-recomp) | Switch 2 | 33 | 2026-11-05 | 200 | — |
| 699 | [Mario Kart World (Mario Kart World Recomp)](https://github.com/adriadam10/mkw-recomp) | switch2 | 1,525 | 2026-11-19 | 200 | AI |
| 700 | [The Legend of Zelda: Ocarina of Time (Ocarina Recomp)](https://github.com/sostenesfreitas/ocarina-recomp) | switch2 | 1,229 | 2026-11-11 | 200 | AI |
| 701 | [Donkey Kong Bananza (DKB Recomp)](https://github.com/Lucas-blip-png/dkb-pc-recomp) | switch2 | 1,215 | 2026-11-19 | 200 | AI |
| 702 | [Pokopia (pokopia-recomp)](https://github.com/Dittobyte/Recompia) | switch2 | 900 | 2026-11-19 | 200 | AI |
| 703 | [Star Fox (SpaceAnimalsRecomp)](https://github.com/SerenityG4K/SpaceAnimalsRecomp) | switch2 | 240 | 2026-11-14 | 200 | AI |
| 704 | [The Legend of Zelda: Ocarina of Time (GreenKid-MV)](https://github.com/adi0900/GreenKid-MV) | switch2 | 127 | 2026-11-14 | 200 | AI |
| 705 | [kart (kart-recomp)](https://github.com/MIXIDtheSilly/kart-recomp) | switch2 | 118 | 2026-11-17 | 200 | AI |
| 706 | [Hyrule Warriors: Age of Calamity (Hyrule Warriors: Age of Imprisonment Recomp)](https://github.com/Alano6678/hwaoi-recomp) | switch2 | 99 | 2026-11-14 | 200 | AI |
| 707 | [Mario's Tennis (MarioTennisVirtualBoyRecomp)](https://github.com/mstan/MarioTennisVirtualBoyRecomp) | Virtual Boy | 23 | 2026-11-13 | 200 | AI |
| 708 | [Super Smash Bros. Brawl (Brawl Recompiled)](https://github.com/josiahg2502-glitch/BrawlRecompiled) | Wii | 239 | 2026-10-31 | 200 | AI |
| 709 | [New Super Mario Bros. Wii (NSMB Wii Multiplayer Decompilation)](https://github.com/WitherBlitz/NSMB-Wii-Recompilation) | Wii | 236 | 2026-11-08 | 200 | AI |
| 710 | [Super Paper Mario (New Super Paper Bros.)](https://github.com/josiahg2502-glitch/NewSuperPaperBros) | Wii | 208 | 2026-11-01 | 200 | AI |
| 711 | [Resident Evil: The Umbrella Chronicles (Resident Evil: The Umbrella Chronicles Recomp)](https://github.com/solleo95/reuc-recomp) | Wii | 192 | 2026-11-15 | 200 | AI |
| 712 | [Kirby's Return to Dream Land (Kirby Wii Recomp)](https://github.com/ExpansionPak/ModernGekko) | Wii | 187 | 2026-09-17 | 200 | — |
| 713 | [Mario Kart Wii (DriftDroid)](https://github.com/dorPXP/driftdroid) | Wii | 172 | 2026-11-06 | 200 | AI |
| 714 | [New Super Mario Bros. Wii (NSMBWiicompiled)](https://github.com/ral1009/NSMBWiicompiled) | Wii | 146 | 2026-11-17 | 200 | AI |
| 715 | [Wario Land: Shake It! (WarioRecomp)](https://github.com/santiagovalencia109/Wario-Land-Shake-It-Native-PC) | Wii | 104 | 2026-11-03 | 200 | AI |
| 716 | [Super Mario Galaxy ( PS4 recomp)](https://github.com/chrissotraidis/galaxypad) | Wii | 101 | 2026-11-14 | 200 | — |
| 717 | [Mario Kart Wii (mkwii-ps5)](https://github.com/Phi1ow/mkwii-ps5) | Wii | 65 | 2026-09-22 | 200 | — |
| 718 | [Sonic and the Black Knight (BlackKnightRecomp)](https://github.com/yunophilia/BlackKnightRecomp) | Wii | 41 | 2026-11-16 | 200 | — |
| 719 | [Super Mario Galaxy (PS5_MarioGalaxy)](https://github.com/griches/PS5_MarioGalaxy) | Wii | 29 | 2026-10-21 | 200 | — |
| 720 | [Wii Party (wiiparty-recomp)](https://github.com/arelkair/wiiparty-recomp) | Wii | 26 | 2026-11-13 | 200 | — |
| 721 | [Muscle March (Muscle March Recomp)](https://github.com/tmcleroy/muscle-march-recomp) | Wii | 21 | 2026-10-15 | 200 | AI |
| 722 | [PokePark Wii: Pikachu's Adventure (PokePark Wiicompiled)](https://github.com/MildRain479/PokePark-Wiicompiled) | Wii | 20 | 2026-11-17 | 200 | AI |
| 723 | [Mario Strikers Charged (Strikers-WiiCompiled)](https://github.com/BlackAndBlue95/Strikers-WiiCompiled) | Wii | 19 | 2026-10-03 | 200 | — |
| 724 | [The Last Story (pc-thelaststory (wiikit))](https://github.com/vs-sr-dev/pc-thelaststory) | Wii | 19 | 2026-11-12 | 200 | — |
| 725 | [New Super Mario Bros. Wii (NSMBWii-3DS-Recomp)](https://github.com/itsinspector/NSMBWii-3DS-Recomp) | Wii | 18 | 2026-10-31 | 200 | — |
| 726 | [Mario Kart Wii (mkw-switch-recomp)](https://github.com/LockingFR/mkw-switch-recomp) | Wii | 14 | 2026-10-11 | 200 | — |
| 727 | [Zelda Wind Waker HD Recomp](https://github.com/ZeldaWWHDRecomp/ZeldaWWHDRecomp) | Wii U | 1,600 | 2026-11-13 | 200 | AI |
| 728 | [Breath of the Wild (BOTW Recompiled)](https://github.com/ryderclanky/BotW-Native) | Wii U | 390 | 2026-10-31 | 200 | — |
| 729 | [The Legend of Zelda: The Wind Waker HD (SwitchWakerHD)](https://github.com/centollOS/SwitchWakerHD) | Wii U | 270 | 2026-11-12 | 200 | AI |
| 730 | [The Legend of Zelda: The Wind Waker HD (TLoZ:TWW HD Recompiled — Android)](https://github.com/GreenNaugahyde/ZeldaWWHDRecompAndroid) | Wii U | 236 | 2026-11-06 | 200 | AI |
| 731 | [New Super Mario Bros. U (nsmbu-recomp)](https://github.com/nsmbu-recomp/nsmbu-recomp) | Wii U | 185 | 2026-11-07 | 200 | AI |
| 732 | [The Legend of Zelda: The Wind Waker HD (Wind Waker HD Recompiled [Android] - Plus)](https://github.com/Nycolazs/WindWakerHD-Android-Plus) | Wii U | 143 | 2026-10-23 | 200 | AI |
| 733 | [Super Smash Bros. for Wii U (Smash 4 PC)](https://github.com/josiahg2502-glitch/Smash4PC) | Wii U | 141 | 2026-11-04 | 200 | AI |
| 734 | [ZeldaWWHDRecompAndroid](https://github.com/SSunnKing/ZeldaWWHDRecompAndroid---ENHANCED) | Wii U | 99 | 2026-10-11 | 200 | AI |
| 735 | [The Legend of Zelda: The Wind Waker HD (Wind Waker HD for PlayStation 5)](https://github.com/griches/PS5_WindWakerHD) | Wii U | 24 | 2026-10-13 | 200 | — |
| 736 | [Dead or Alive Xtreme Beach Volleyball (doaxbv-re)](https://github.com/NoRain211/doaxvb-re) | Xbox | 273 | 2026-11-16 | 200 | — |
| 737 | [007: Nightfire](https://github.com/hk21x/nightfire-recomp) | Xbox | 86 | 2026-11-18 | 200 | AI |
| 738 | [Jet Set Radio Future (JSRF-Recomp)](https://github.com/Miggas/JSRF-Recomp) | Xbox | 83 | 2026-11-16 | 200 | — |
| 739 | [007: Agent Under Fire](https://github.com/hk21x/007-agentunderfire-recomp) | Xbox | 75 | 2026-11-18 | 200 | AI |
| 740 | [X-Men Legends (OpenXML1xbox)](https://github.com/GTTeancum/XML1-recomp) | Xbox | 67 | 2026-11-15 | 200 | — |
| 741 | [The Warriors (The Warriors - XBERecomp)](https://github.com/Antriksh1984/TheWarriors-XBERecomp) | Xbox | 61 | 2026-10-24 | 200 | — |
| 742 | [Burnout 2: Point of Impact](https://github.com/timftw21/burnout2-recompilation) | Xbox | 50 | 2026-11-18 | 200 | AI |
| 743 | [Conker: Live & Reloaded (Live & Recompiled)](https://github.com/giacomozama/live-and-recompiled) | Xbox | 43 | 2026-11-19 | 200 | — |
| 744 | [Genma Onimusha (Genma Onimusha - PC port)](https://github.com/rafaelkenedy/genma-recomp) | Xbox | 42 | 2026-10-30 | 200 | — |
| 745 | [Predator: Concrete Jungle (Concrete-Jungle-PC)](https://github.com/Adolini1715/Concrete-Jungle-PC) | Xbox | 42 | 2026-11-18 | 200 | — |
| 746 | [Jet Set Radio Future](https://github.com/andeecollard/jsrf-recomp) | Xbox | 37 | 2026-09-26 | 200 | — |
| 747 | [Conker: Live & Reloaded (conker-lr-recomp)](https://github.com/rashevskyv/conker-lr-recomp) | Xbox | 36 | 2026-11-06 | 200 | — |
| 748 | [Marvel Nemesis: Rise of the Imperfects (Marvel Nemesis: Rise of the Imperfects - PC Recomp)](https://github.com/15Cyber/marvel-nemesis-recomp) | Xbox | 36 | 2026-10-29 | 200 | — |
| 749 | [Conker: Live & Reloaded](https://github.com/cdetv/conker-live-recompiled) | Xbox | 35 | 2026-11-19 | 200 | AI |
| 750 | [Dead or Alive 2 Ultimate (doa2u-recomp)](https://github.com/parkerallan/doa2u-recomp) | Xbox | 30 | 2026-10-30 | 200 | — |
| 751 | [Midtown Madness 3 (mm3-recomp)](https://github.com/MattSG/mm3-recomp) | Xbox | 29 | 2026-11-17 | 200 | — |
| 752 | [Star Wars: Knights of the Old Republic (kotor-recomp)](https://github.com/sp00nznet/kotor-recomp) | Xbox | 28 | 2026-10-24 | 200 | — |
| 753 | [Tom Clancy's Ghost Recon 2 (summitstrike-recomp)](https://github.com/ElKev118/summitstrike-recomp) | Xbox | 28 | 2026-11-02 | 200 | — |
| 754 | [Auto Modellista (automodellista-recomp)](https://github.com/apexJCL/automodellista-recomp) | Xbox | 26 | 2026-11-07 | 200 | — |
| 755 | [Scooby-Doo! Unmasked (Scooby-Doo: Re-Masked)](https://github.com/josiahg2502-glitch/Scooby-Doo-ReMasked) | Xbox | 24 | 2026-10-18 | 200 | — |
| 756 | [StarCraft: Ghost (scghost-recomp)](https://github.com/aknavj/scghost-recomp) | Xbox | 24 | 2026-10-13 | 200 | — |
| 757 | [Tenchu: Return from Darkness (Tenchu: Return from Darkness - HoloCatt Recomp Project)](https://github.com/Llamapixels/TenchuRFDRecomp) | Xbox | 24 | 2026-11-04 | 200 | — |
| 758 | [Unreal Championship 2: The Liandri Conflict (uc2-recomp)](https://github.com/ClydeyEXE/uc2-recomp) | Xbox | 23 | 2026-11-13 | 200 | — |
| 759 | [MechAssault 2: Lone Wolf (MechAssault 2 PC)](https://github.com/LegendaryXP/Mechassault2-recomp) | Xbox | 17 | 2026-10-25 | 200 | — |
| 760 | [Star Wars: The Clone Wars (StarWars-CloneWars-PC)](https://github.com/GTTeancum/StarWars-CloneWars-PC) | Xbox | 16 | 2026-11-02 | 200 | — |
| 761 | [Jet Set Radio Future (JSRF Unleashed NX)](https://github.com/Eladerino/JetSetRadioFuture-Unleashed-NX) | Xbox | 13 | 2026-11-17 | 200 | — |
| 762 | [Tom Clancy's Splinter Cell: Double Agent (scda-nx)](https://github.com/itouchdennis/scda-nx) | Xbox | 13 | 2026-11-04 | 200 | — |
| 763 | [Brute Force (Brute Force static recompilation)](https://github.com/Tzeentchnet/BruteForce) | Xbox | 12 | 2026-11-14 | 200 | — |
| 764 | [Need for Speed: Underground 2 (reUndr 2)](https://github.com/bystritskiy/reUndr2-ps5) | Xbox | 12 | 2026-11-13 | 200 | — |
| 765 | [Buffy the Vampire Slayer](https://github.com/djrobson5/Hellmouth-buffy-recomp) | Xbox | 10 | 2026-11-19 | 200 | AI |
| 766 | [Lord of the Rings; The Third Age](https://github.com/Revan67/ThirdAge-Recomp) | Xbox | 9 | 2026-10-10 | 200 | AI |
| 767 | [Sonic Unleashed (Unleashed Recompiled)](https://github.com/hedge-dev/UnleashedRecomp) | Xbox 360 | 5,393 | 2026-11-18 | 200 | — |
| 768 | [Skate 3 (Skate 3: Recompiled)](https://github.com/mchughalex/skate3recomp) | Xbox 360 | 1,840 | 2026-07-24 | 200 | — |
| 769 | [Forza Horizon (Pinyon Shift)](https://github.com/arcanite24/pinyon-shift) | Xbox 360 | 1,072 | 2026-11-19 | 200 | AI |
| 770 | [Lost Odyssey (Lost Odyssey Recompiled)](https://github.com/freefrank/LostOdysseyRecomp) | Xbox 360 | 1,007 | 2026-11-18 | 200 | AI |
| 771 | [Sonic the Hedgehog 2006 (Marathon Recompiled)](https://github.com/sonicnext-dev/MarathonRecomp) | Xbox 360 | 962 | 2026-11-19 | 200 | — |
| 772 | [GoldenEye 007 (XBLA) (GoldenEye 007 PC Recompilation)](https://github.com/SunJaycy/GoldenEye-Recomp) | Xbox 360 | 946 | 2026-06-18 | 200 | AI |
| 773 | [Blue Dragon](https://github.com/zolaware/reblue) | Xbox 360 | 926 | 2026-10-05 | 200 | — |
| 774 | [Dante's Inferno (Dante's Inferno Recompiled)](https://github.com/florinp93/hells-gate-recomp) | Xbox 360 | 925 | 2026-11-15 | 200 | AI |
| 775 | [SpeedBreaker](https://github.com/SpeedBreakerProject/speedbreaker) | Xbox 360 | 708 | 2026-11-17 | 200 | AI |
| 776 | [Fable II (Fable II Recompiled)](https://github.com/himdo/Fable-2-Recomp) | Xbox 360 | 695 | 2026-11-19 | 200 | AI |
| 777 | [Ace Combat 6: Fires of Liberation](https://github.com/sal063/AC6_recomp) | Xbox 360 | 605 | 2026-08-22 | 200 | AI |
| 778 | [Gears of War 2, Gears of War 3, Gears of War: Judgment (COGBox)](https://github.com/Shagg88/COGBox) | Xbox 360 | 528 | 2026-11-18 | 200 | AI |
| 779 | [Edge of Time Recomp](https://github.com/goliathret/EdgeOfTimeRecomp) | Xbox 360 | 520 | 2026-10-30 | 200 | — |
| 780 | [Forza Horizon (Forza Horizon 1: ReImagined)](https://github.com/FH1-ReImagined/ForzaHorizon1-ReImagined) | Xbox 360 | 478 | 2026-11-18 | 200 | AI |
| 781 | [Fable II (Fable2Recomp)](https://github.com/Fable2Recomp/Fable2Remake) | Xbox 360 | 461 | 2026-09-12 | 200 | — |
| 782 | [The Simpsons Game](https://github.com/YesterMester/TheSimpsonsGameRecomp) | Xbox 360 | 443 | 2026-11-15 | 200 | — |
| 783 | [Castlevania: Symphony of the Night (NocturneRecomp)](https://github.com/birabittoh/NocturneRecomp) | Xbox 360 | 440 | 2026-11-05 | 200 | AI |
| 784 | [Call of Duty 3 (CoD3Recomp)](https://github.com/FrankHUN88453/CoD3Recomp) | Xbox 360 | 435 | 2026-10-21 | 200 | AI |
| 785 | [The Darkness (The Darkness Recomp)](https://github.com/portingpete/The-Darkness-Recomp) | Xbox 360 | 420 | 2026-11-18 | 200 | AI |
| 786 | [Silent Hill: Downpour (DownpourRecomp)](https://github.com/LittleBitUA/DownpourRecomp) | Xbox 360 | 378 | 2026-09-02 | 200 | AI |
| 787 | [Midnight Club: Los Angeles (LARecomp)](https://github.com/mzzvxm/LARecomp) | Xbox 360 | 354 | 2026-11-19 | 200 | — |
| 788 | [Burnout Revenge (Xerenge)](https://github.com/shipa-2/Xerenge) | Xbox 360 | 352 | 2026-11-18 | 200 | AI |
| 789 | [Condemned 2: Bloodshot (Condemned2Recomp)](https://github.com/psxrestore/Condemned2Recomp) | Xbox 360 | 312 | 2026-11-16 | 200 | — |
| 790 | [King Kong Recompiled](https://github.com/TekRantGaming/king-kong-recompiled) | Xbox 360 | 293 | 2026-11-09 | 200 | AI |
| 791 | [Tekken Tag Tournament 2 (tekken-tag-tournament-2-pc)](https://github.com/shihabal3amri/tekken-tag-tournament-2-pc) | Xbox 360 | 289 | 2026-11-09 | 200 | AI |
| 792 | [Skate 3 (Skate3-Mobile)](https://github.com/Buku313/Skate3-Mobile) | Xbox 360 | 281 | 2026-09-16 | 200 | AI |
| 793 | [Grand Theft Auto V (gtav-recomp)](https://github.com/andrewnakas/gtav-recomp) | Xbox 360 | 271 | 2026-11-03 | 200 | — |
| 794 | [Project Gotham Racing 4](https://github.com/beatrixzy/PGR4-Recomp) | Xbox 360 | 271 | 2026-11-16 | 200 | — |
| 795 | [Call of Duty: Black Ops II (bo2-mac)](https://github.com/adrbn/bo2-mac) | Xbox 360 | 269 | 2026-11-19 | 200 | — |
| 796 | [LEGO Dimensions (DimensionsRecomp)](https://github.com/NeverCookFirst/DimensionsRecomp) | Xbox 360 | 268 | 2026-11-16 | 200† | AI |
| 797 | [Viva Pinata: Trouble In Paradise](https://github.com/SolarCookies/TiP-Recomp) | Xbox 360 | 264 | 2026-11-11 | 200 | — |
| 798 | [Naruto: Rise of a Ninja (Naruto Rise Recomp)](https://github.com/jorjbarbosa/naruto-rise-recomp) | Xbox 360 | 257 | 2026-11-17 | 200 | AI |
| 799 | [Sonic Unleashed (UnleashedRecomp-Android)](https://github.com/SansNope/UnleashedRecomp-Android) | Xbox 360 | 254 | 2026-10-10 | 200 | AI |
| 800 | [Dragon Ball Z: Budokai 3 HD (Budokai 3 HD Recompiled)](https://github.com/novapowers0/DBZ-Budokai-3-HD-Collection) | Xbox 360 | 251 | 2026-11-09 | 200 | AI |
| 801 | [Midnight Club: Los Angeles (mcla-recomp)](https://github.com/holdmysocks/mcla-recomp) | Xbox 360 | 248 | 2026-10-30 | 200 | — |
| 802 | [Banjo-Kazooie Nuts and Bolts](https://github.com/masterspike52/reNut) | Xbox 360 | 245 | 2026-11-12 | 200 | AI |
| 803 | [Midnight Club: Los Angeles Complete Edition (mcla-recomp)](https://github.com/RenanQueiroz/mcla-recomp) | Xbox 360 | 241 | 2026-11-15 | 200 | — |
| 804 | [Eternal Sonata (EternalSonataReprise)](https://github.com/birabittoh/EternalSonataReprise) | Xbox 360 | 214 | 2026-11-09 | 200 | — |
| 805 | [Forza Horizon 2 (FH2 Recompiled)](https://github.com/Gabrick75/fh2-recompiled) | Xbox 360 | 214 | 2026-11-15 | 200 | — |
| 806 | [Call of Duty: Modern Warfare 2 (mw2-recompiled)](https://github.com/PaulCombal/mw2-recompiled) | Xbox 360 | 208 | 2026-11-01 | 200 | — |
| 807 | [Grand Theft Auto IV (Liberty Pro Max)](https://github.com/Awis13/liberty-pro-max) | Xbox 360 | 191 | 2026-11-14 | 200 | — |
| 808 | [Army of Two (Army of Two Recompilation)](https://github.com/OpenPortroid/ArmyOfTwoRecompilation) | Xbox 360 | 189 | 2026-11-14 | 200 | AI |
| 809 | [Deadly Premonition](https://github.com/LittleBitUA/DPRecomp) | Xbox 360 | 189 | 2026-11-18 | 200 | AI |
| 810 | [DoDonPachi SaiDaiOuJou (SDOJ-Recomp)](https://github.com/eandis/SDOJ-Recomp) | Xbox 360 | 188 | 2026-10-31 | 200 | — |
| 811 | [Forza Motorsport 4 (fm4-static-recomp)](https://github.com/i2kiselev/fm4-static-recomp) | Xbox 360 | 163 | 2026-11-15 | 200 | AI |
| 812 | [WWE SmackDown vs. Raw 2007 (SVR07-Recomp)](https://github.com/HollywoodAkeem/SVR07-Recomp) | Xbox 360 | 163 | 2026-05-27 | 200 | — |
| 813 | [The Darkness (Estacado-The-Darkness-Recomp)](https://github.com/invinceble55-wq/Estacado-The-Darkness-Recomp) | Xbox 360 | 157 | 2026-11-06 | 200 | AI |
| 814 | [Crash of the Titans (CrashRecomp: Crash of the Titans, Definitive Edition (PC))](https://github.com/VitoMiguelF/crashott-pc) | Xbox 360 | 156 | 2026-10-31 | 200 | AI |
| 815 | [Forza Motorsport 4 (Forza Motorsport 4 Recompiled)](https://github.com/Alexbeav/fm4-recomp) | Xbox 360 | 146 | 2026-10-15 | 200 | AI |
| 816 | [Metal Gear Rising: Revengeance (Zandatsu)](https://github.com/dfdx047/Zandatsu) | Xbox 360 | 138 | 2026-11-13 | 200 | — |
| 817 | [Gears of War: Judgment (Gears of War: Judgement Recomp)](https://github.com/OverkillLabs3/gears-judgement-recomp) | Xbox 360 | 137 | 2026-10-11 | 200 | AI |
| 818 | [Forza Motorsport 2 (Forza2-Native)](https://github.com/0herculabs/hl360-Forza2) | Xbox 360 | 135 | 2026-10-20 | 200 | AI |
| 819 | [Dragon Ball Z: Budokai (Dragon Ball Z Budokai HD Recompiled)](https://github.com/WistfulHopes/DBZ1) | Xbox 360 | 134 | 2026-02-20 | 200 | — |
| 820 | [Crackdown (Crackdown - PC Port)](https://github.com/saulob/crackdown-xbox360-recompiled) | Xbox 360 | 130 | 2026-10-27 | 200 | AI |
| 821 | [Ridge Racer 6 (Ridge Racer 6 Recompilation)](https://github.com/Sirhalo23/RidgeRacer6-Recompilation) | Xbox 360 | 130 | 2026-10-11 | 200 | AI |
| 822 | [WWE '13 (WWE '13 Recomp)](https://github.com/PromethenDev/wwe13-recomp) | Xbox 360 | 130 | 2026-10-13 | 200 | AI |
| 823 | [Dragon Ball Z: Burst Limit (Dragon Ball Z: Burst Limit Recompiled)](https://github.com/iExplosiveRage/DBZ-Burst-Limit-Recompiled) | Xbox 360 | 129 | 2026-11-18 | 200 | AI |
| 824 | [Grand Theft Auto IV (Theft4)](https://github.com/KoreanSeats1/Theft4) | Xbox 360 | 129 | 2026-10-15 | 200 | — |
| 825 | [Sonic Free Riders (Free Riders Recompiled)](https://github.com/YuutaTsubasa/Free-Riders-Recompiled) | Xbox 360 | 127 | 2026-11-19 | 200 | AI |
| 826 | [Earthworm Jim HD Recompiled](https://github.com/TekRantGaming/earthworm-jim-hd-recompiled) | Xbox 360 | 125 | 2026-10-18 | 200 | AI |
| 827 | [WET (WET Recomp)](https://github.com/Supermedo/wet-recomp) | Xbox 360 | 123 | 2026-10-11 | 200 | AI |
| 828 | [Asura's Wrath (asuras-wrath-recomp)](https://github.com/PauloUbirajara/asuras-wrath-recomp) | Xbox 360 | 122 | 2026-11-08 | 200 | — |
| 829 | [Dead Rising 2: Case Zero (Dead Rising 2: Case Zero Xenon Recomp)](https://github.com/wivi514/Dead_Rising_2_Case_Zero_Xenon_Recomp) | Xbox 360 | 122 | 2026-10-20 | 200 | AI |
| 830 | [Skate 3 (skate3-ios-setup)](https://github.com/andrewnakas/skate3-ios-setup) | Xbox 360 | 122 | 2026-09-24 | 200 | — |
| 831 | [Fight Night Champion (FNCReborn)](https://github.com/whompay/FNCReborn) | Xbox 360 | 121 | 2026-10-07 | 200 | — |
| 832 | [Castlevania: Harmony of Despair (HarmonyRecomp)](https://github.com/Wrexxial/HarmonyRecomp) | Xbox 360 | 120 | 2026-11-09 | 200 | AI |
| 833 | [Dead Rising 2: Case West (Dead Rising 2: Case West Xenon Recomp)](https://github.com/wivi514/Dead_Rising_2_Case_West_Xenon_Recomp) | Xbox 360 | 118 | 2026-10-20 | 200 | AI |
| 834 | [GoldenEye 007 (XBLA remaster) (beanRecomp)](https://github.com/Fable2Recomp/beanRecomp) | Xbox 360 | 117 | 2025-03-19 | 200 | — |
| 835 | [Super Street Fighter II Turbo HD Remix (ssf2t-hd-remix-recompiled)](https://github.com/saulob/ssf2t-hd-remix-recompiled) | Xbox 360 | 117 | 2026-11-07 | 200 | AI |
| 836 | [Marvel Ultimate Alliance (Marvel Ultimate Alliance - PC Port)](https://github.com/saulob/marvel-ultimate-alliance-bundle-recompiled) | Xbox 360 | 114 | 2026-10-29 | 200 | AI |
| 837 | [Project Gotham Racing 4 (PGR4: ReGPU)](https://github.com/zer0ducksgiven/PGR4-ReGPU) | Xbox 360 | 110 | 2026-11-08 | 200 | AI |
| 838 | [Pro Evolution Soccer 2017 (PES 2017 Android)](https://github.com/dzakyraf/pes2017-recomp) | Xbox 360 | 109 | 2026-10-27 | 200 | — |
| 839 | [WWE 2K14 (WWE 2K14 Recomp)](https://github.com/PromethenDev/wwe2k14-recomp) | Xbox 360 | 109 | 2026-11-14 | 200 | AI |
| 840 | [Army of Two (Army Of Two Recomp)](https://github.com/nikolaygorb/ArmyOfTwoRecomp) | Xbox 360 | 108 | 2026-11-05 | 200 | — |
| 841 | [2014 FIFA World Cup Brazil (2014 FIFA World Cup Brazil: Recompiled)](https://github.com/HossEz/fifa-world-cup-2014-recompiled) | Xbox 360 | 105 | 2026-11-17 | 200 | AI |
| 842 | [Dead or Alive 4 Online](https://github.com/dwreckgg/doa4-online) | Xbox 360 | 104 | 2026-11-18 | 200 | — |
| 843 | [Grand Theft Auto IV (GTA IV for PS5)](https://github.com/elripalda/gta4-ps5) | Xbox 360 | 104 | 2026-11-09 | 200 | — |
| 844 | [Splatterhouse (Splatterhouse Recompiled)](https://github.com/0c0de/splatterhouse-decomp) | Xbox 360 | 104 | 2026-10-20 | 200 | AI |
| 845 | [GoldenEye 007 (GoldenEye 007 XBLA PC Recomp)](https://github.com/CaiusCodes/GoldenEye-007-XBLA-PC-Recomp) | Xbox 360 | 97 | 2026-11-18 | 200 | AI |
| 846 | [Tekken 6 (Tekken 6 Recomp)](https://github.com/mahmoud-mess/tekken6-recomp) | Xbox 360 | 94 | 2026-11-11 | 200 | — |
| 847 | [Rayman 3 HD (Rayman 3 HD Recompiled)](https://github.com/MysteriousAeon/rayman3-hd-recompiled) | Xbox 360 | 92 | 2026-11-18 | 200 | AI |
| 848 | [Spider-Man: Edge of Time (Project 2099)](https://github.com/GenryTheFox0/Project-2099) | Xbox 360 | 90 | 2026-10-21 | 200 | AI |
| 849 | [Dead or Alive Xtreme 2 (DOAX2 Recomp)](https://github.com/hibikifukui22/Dead-or-Alive-Xtreme-2-Recompilation) | Xbox 360 | 88 | 2026-11-12 | 200 | AI |
| 850 | [Gears of War 3 (Gears of War 3 — native PC recompilation)](https://github.com/Flippage/gears-of-war-3-recomp) | Xbox 360 | 88 | 2026-10-30 | 200 | AI |
| 851 | [Crash of the Titans (MojoRecomp)](https://github.com/OAleex/MojoRecomp) | Xbox 360 | 85 | 2026-10-06 | 200 | AI |
| 852 | [Forza Motorsport 2 (Forza Motorsport 2 ReGPU)](https://github.com/zer0ducksgiven/Forza-Motorsport-2-ReGPU) | Xbox 360 | 85 | 2026-11-18 | 200 | AI |
| 853 | [Skate 2 (PC port, christianortel)](https://github.com/christianortel/skate2-recompile-pc) | Xbox 360 | 85 | 2026-10-12 | 200 | — |
| 854 | [Kameo: Elements of Power (KameoRePowered)](https://github.com/MaxDeadBear/KameoRePowered) | Xbox 360 | 84 | 2026-10-21 | 200 | — |
| 855 | [Ninja Gaiden II (IzunaRecomp)](https://github.com/YaibaKamikaze/IzunaRecomp) | Xbox 360 | 83 | 2026-11-16 | 200 | AI |
| 856 | [Dragon Age: Origins (Dragon Age: Origins — Recompiled)](https://github.com/96dot/Dragon-Age-Origins-Recomp) | Xbox 360 | 82 | 2026-11-17 | 200 | AI |
| 857 | [50 Cent: Blood on the Sand](https://github.com/nlwstein/skullburglar) | Xbox 360 | 78 | 2026-11-18 | 200 | — |
| 858 | [Project Gotham Racing 4 (pgr4-native)](https://github.com/shaunsingh/pgr4-native) | Xbox 360 | 73 | 2026-10-30 | 200 | AI |
| 859 | [NHL Legacy (NHL Legacy Recomp)](https://github.com/puckhead73/nhl-legacy-recomp) | Xbox 360 | 71 | 2026-07-22 | 200 | AI |
| 860 | [Need for Speed: Carbon (Speedbreaker: Carbon)](https://github.com/SpeedBreakerProject/speedbreaker-carbon) | Xbox 360 | 69 | 2026-11-08 | 200 | AI |
| 861 | [WWE All Stars (WWE All Stars Recomp)](https://github.com/shaneomac1337/WWE-AllStars-Recomp) | Xbox 360 | 66 | 2026-11-07 | 200 | AI |
| 862 | [NBA JAM: On Fire Edition (OpenJam)](https://github.com/GTTeancum/OpenJam) | Xbox 360 | 65 | 2026-11-16 | 200 | AI |
| 863 | [Mortal Kombat vs. DC Universe (MKVDCU-Recomp)](https://github.com/KawaiiBunga/MKVDCU-Recomp) | Xbox 360 | 64 | 2026-11-07 | 200 | — |
| 864 | [Ace Combat 6: Fires of Liberation](https://github.com/Dipshet/GracemeriaRecomp) | Xbox 360 | 61 | 2026-11-18 | 200 | — |
| 865 | [Rock Band 3 (Xbox 360)](https://github.com/ihatecompvir/band3_recomp) | Xbox 360 | 60 | 2026-10-02 | 200 | — |
| 866 | [Tony Hawk's Project 8 (Project8Recomp)](https://github.com/theokyr/Project8Recomp) | Xbox 360 | 59 | 2026-08-24 | 200 | AI |
| 867 | [Guitar Hero: Warriors of Rock (GH: WoR Recompiled)](https://github.com/ronniecloud/re-wor) | Xbox 360 | 57 | 2026-03-06 | 200 | — |
| 868 | [Skate 3 (skate3-android)](https://github.com/andrewnakas/skate3-android) | Xbox 360 | 56 | 2026-09-24 | 200 | — |
| 869 | [SoulCalibur II HD Online (Soulcalibur2HD-recomp)](https://github.com/n0madic/Soulcalibur2HD-recomp) | Xbox 360 | 55 | 2026-10-26 | 200 | — |
| 870 | [Destroy All Humans: Path of the Furon](https://github.com/masterspike52/reDAHM) | Xbox 360 | 54 | 2026-09-21 | 200 | — |
| 871 | [Grand Theft Auto V (SanRecomp)](https://github.com/OZORDI/SanRecomp) | Xbox 360 | 54 | 2026-01-05 | 200 | — |
| 872 | [Perfect Dark (Perfect Dark XBLA PC Recomp)](https://github.com/CaiusCodes/Perfect-Dark-XBLA-PC-Recomp) | Xbox 360 | 54 | 2026-11-18 | 200 | AI |
| 873 | [Infinite Undiscovery (Infinite Undiscovery Recomp)](https://github.com/doc-haz/infinite-undiscovery-recomp) | Xbox 360 | 53 | 2026-10-23 | 200 | AI |
| 874 | [Mass Effect (masseffect-nx)](https://github.com/nebadasSwifty/masseffect-nx) | Xbox 360 | 53 | 2026-10-09 | 200 | — |
| 875 | [Halo: Reach (RecompiledHaloReach)](https://github.com/Dyotson/RecompiledHaloReach) | Xbox 360 | 52 | 2026-10-12 | 200 | — |
| 876 | [Metal Gear Rising: Revengeance (mgr-nx-deko)](https://github.com/tuancapoo/mgr-nx-deko) | Xbox 360 | 52 | 2026-10-23 | 200 | — |
| 877 | [Dragon Ball: Raging Blast 2 (RB2)](https://github.com/WistfulHopes/RB2) | Xbox 360 | 51 | 2026-02-21 | 200 | — |
| 878 | [Halo 3 Delta](https://github.com/twist84/halo3_cache_release_recomp) | Xbox 360 | 51 | 2026-06-22 | 200 | — |
| 879 | [WWE 2K14 (wwe2k14-recomp)](https://github.com/Jarrodfeng/wwe2k14-recomp) | Xbox 360 | 50 | 2026-11-19 | 200 | — |
| 880 | [Call of Duty 3 (project-1944)](https://github.com/zenit2893-cmyk/Call-of-Duty-3-PC-Editon) | Xbox 360 | 49 | 2026-09-25 | 200 | — |
| 881 | [Grand Theft Auto IV (GTA-IV-RECOMP-XBOX-360)](https://github.com/luisxl15/GTA-IV-RECOMP-XBOX-360) | Xbox 360 | 49 | 2026-08-08 | 200 | — |
| 882 | [Crash: Mind over Mutant](https://github.com/Maxilure/MindOver-Recomp) | Xbox 360 | 48 | 2026-11-19 | 200 | AI |
| 883 | [Army of Two: The Devil's Cartel](https://github.com/BrewSparrow/ArmyOfTwoTDC-Recomp) | Xbox 360 | 47 | 2026-11-18 | 200 | — |
| 884 | [El Chavo Kart (Chaves Kart (El Chavo Kart) Recompiled)](https://github.com/saulob/el-chavo-kart-recompiled) | Xbox 360 | 45 | 2026-11-08 | 200 | AI |
| 885 | [Top Spin 4 (Top Spin 4 Recomp)](https://github.com/shaneomac1337/Top-Spin-4-Recomp) | Xbox 360 | 45 | 2026-11-07 | 200 | AI |
| 886 | [The Bourne Conspiracy (bourne-conspiracy-x360-recomp)](https://github.com/thegh0sts/bourne-conspiracy-x360-recomp) | Xbox 360 | 44 | 2026-11-19 | 200 | AI |
| 887 | [WWE SmackDown vs. Raw 2010 (WWE SmackDown vs. Raw 2010 Recomp)](https://github.com/nefariousjosiah/WWE-SVR2010-RECOMP) | Xbox 360 | 43 | 2026-11-07 | 200 | — |
| 888 | [Dead Space 2 (ds2-nx)](https://github.com/VasilkovND/ds2-nx) | Xbox 360 | 42 | 2026-10-27 | 200 | — |
| 889 | [Fable II (FableDroid)](https://github.com/hardsilinder/FableDroid) | Xbox 360 | 42 | 2026-11-02 | 200 | — |
| 890 | [Midnight Club: Los Angeles (Midnight Club L.A. Recompiled)](https://github.com/robertoaraujo77/MC_LA_Recompiled) | Xbox 360 | 42 | 2026-10-28 | 200 | — |
| 891 | [Prototype (Prototype and Prototype 2 for Nintendo Switch)](https://github.com/fungalspores/prototype-switch) | Xbox 360 | 42 | 2026-10-24 | 200 | — |
| 892 | [Crackdown 2](https://github.com/matty45/Crackdown2-Recomp) | Xbox 360 | 41 | 2026-08-07 | 200 | — |
| 893 | [WWE SmackDown vs. Raw 2008 (WWE SmackDown vs. Raw 2008 Recomp)](https://github.com/nefariousjosiah/WWE-SVR2008-RECOMP) | Xbox 360 | 41 | 2026-10-24 | 200 | — |
| 894 | [Forza Horizon (ForzaRecomp)](https://github.com/NerunSmarts/ForzaRecomp) | Xbox 360 | 38 | 2026-10-05 | 200 | — |
| 895 | [Guitar Hero 2](https://github.com/YoshiCrystal9/re-gh2) | Xbox 360 | 38 | 2026-02-22 | 200 | — |
| 896 | [Rumble Roses XX (Rumble Roses XX PC recomp)](https://github.com/JesusTaylo/rumble-roses-xx-recomp) | Xbox 360 | 38 | 2026-10-26 | 200 | — |
| 897 | [Skate (Skate1Recompiled)](https://github.com/cookingwithsimon/Skate1Recompiled) | Xbox 360 | 38 | 2026-11-18 | 200 | AI |
| 898 | [Stuntman: Ignition (Stunt Double: Reignition)](https://github.com/giangra/stuntdouble-reignition) | Xbox 360 | 38 | 2026-10-24 | 200 | AI |
| 899 | [WWE 2K14 (WWE2K14-PC)](https://github.com/itsbybanshee/wwe2k14-pc) | Xbox 360 | 38 | 2026-11-05 | 200 | — |
| 900 | [WWE SmackDown vs. Raw 2009 (WWE SmackDown vs. Raw 2009 Recomp)](https://github.com/nefariousjosiah/WWE-SVR2009-RECOMP) | Xbox 360 | 38 | 2026-11-07 | 200 | — |
| 901 | [Civilization Revolution (ReRevved)](https://github.com/ReRevvedRecomp/rerevved) | Xbox 360 | 37 | 2026-11-19 | 200 | — |
| 902 | [Crackdown](https://github.com/SkiddyToast/Crackdown) | Xbox 360 | 37 | 2026-03-04 | 200 | — |
| 903 | [Hydro Thunder Hurricane (HydroThunderPORT)](https://github.com/monscriser/HydroThunderPORT) | Xbox 360 | 37 | 2026-11-12 | 200 | AI |
| 904 | [Mortal Kombat Komplete Edition (mk9-nx)](https://github.com/Thorhax/mk9-nx) | Xbox 360 | 36 | 2026-11-08 | 200 | — |
| 905 | [Guitar Hero III: Legends of Rock (Guitar-Hero-3-Recomp-)](https://github.com/luisxl15/Guitar-Hero-3-Recomp-) | Xbox 360 | 35 | 2026-08-31 | 200 | — |
| 906 | [Ninja Gaiden II (openNG2)](https://github.com/KamiTK2/openNG2) | Xbox 360 | 35 | 2026-11-05 | 200 | — |
| 907 | [X-Men: Destiny (XMD Recompiled)](https://github.com/florinp93/xmd-recompiled) | Xbox 360 | 35 | 2026-09-02 | 200 | AI |
| 908 | [UFC Undisputed 3 (UFC3ReX)](https://github.com/360recomper/UFC3ReX) | Xbox 360 | 34 | 2026-11-13 | 200 | AI |
| 909 | [Guitar Hero II (reGH2)](https://github.com/jillsandwich1998/reGH2) | Xbox 360 | 33 | 2026-11-06 | 200 | AI |
| 910 | [Dark Souls II (Dark Souls 2 RECOMP ARM64)](https://github.com/alesson000/Dark-Souls-2-RECOMP-ARM64) | Xbox 360 | 32 | 2026-10-23 | 200 | — |
| 911 | [Goldeneye 007](https://github.com/kholdfuzion/beanRecomp) | Xbox 360 | 32 | 2025-03-16 | 200 | — |
| 912 | [Halo 3 (OpenH3M)](https://github.com/GTTeancum/OpenH3M) | Xbox 360 | 31 | 2026-11-18 | 200 | — |
| 913 | [Hydro Thunder Hurricane (Hydro Thunder Hurricane Recompiled)](https://github.com/visibou/htrecomp) | Xbox 360 | 31 | 2026-11-17 | 200 | — |
| 914 | [Superman Returns (Superman Returns Recomp)](https://github.com/MrPowerUp82/superman_returns_recomp) | Xbox 360 | 31 | 2026-11-17 | 200 | AI |
| 915 | [Mass Effect 2 (Lazarus)](https://github.com/VibePorter/Lazarus) | Xbox 360 | 30 | 2026-11-16 | 200 | — |
| 916 | [Tenchu Z (Tenchu Z - HoloCatt Recomp Project)](https://github.com/Llamapixels/TenchuZRecomp) | Xbox 360 | 30 | 2026-10-26 | 200 | — |
| 917 | [Forza Horizon (pinyon-shift-android)](https://github.com/deivid22srk/pinyon-shift-android) | Xbox 360 | 29 | 2026-10-03 | 200 | — |
| 918 | [Real Steel (ReCompiled Steel)](https://github.com/tokeneffortports/ReCompiledSteel) | Xbox 360 | 29 | 2026-10-20 | 200 | AI |
| 919 | [Call of Duty: Black Ops II (bo2-360-nx)](https://github.com/AlvaroEPena/bo2-360-nx) | Xbox 360 | 28 | 2026-11-04 | 200 | — |
| 920 | [Grand Theft Auto IV (LibertyRecomp)](https://github.com/hamishakl/LibertyRecomp) | Xbox 360 | 28 | 2026-10-11 | 200 | — |
| 921 | [Saints Row](https://github.com/sp00nznet/saintsrow) | Xbox 360 | 28 | 2026-11-02 | 200 | — |
| 922 | [UFC Undisputed 3 (UFC3MONS)](https://github.com/monscriser/UFC3MONS) | Xbox 360 | 28 | 2026-11-19 | 200 | — |
| 923 | [Ben 10 Ultimate Alien: Cosmic Destruction (Cosmic Recomp)](https://github.com/ExtremestoneGG/Cosmic-Recompi) | Xbox 360 | 27 | 2026-10-30 | 200 | AI |
| 924 | [Minecraft: Legacy Console Edition (MCX360-EDITION)](https://github.com/DevZer0D4Y/MCX360-EDITION) | Xbox 360 | 27 | 2026-10-15 | 200 | — |
| 925 | [Call of Duty 3 (cod3_REcomp_ (Call of Duty 3 + World at War))](https://github.com/SirCarls/cod3_REcomp_) | Xbox 360 | 26 | 2026-11-16 | 200 | — |
| 926 | [Trials HD (Trials HD Recompiled)](https://github.com/snufflyyy/trials-hd-recompiled) | Xbox 360 | 26 | 2026-10-23 | 200 | — |
| 927 | [WET (WET Recompiled)](https://github.com/zonehammer/wet-recomp) | Xbox 360 | 26 | 2026-11-07 | 200 | AI |
| 928 | [Fracture (Fracture Recomp)](https://github.com/ASarafanov/fracturerecomp) | Xbox 360 | 25 | 2026-10-30 | 200 | AI |
| 929 | [Halo 3 (halo-3-recomp)](https://github.com/george0815/halo-3-recomp) | Xbox 360 | 25 | 2026-11-18 | 200 | — |
| 930 | [WWE SmackDown vs. Raw 2007 (WWE SmackDown vs. Raw 2007 Recomp)](https://github.com/nefariousjosiah/WWE-SVR2007-RECOMP) | Xbox 360 | 25 | 2026-10-24 | 200 | — |
| 931 | [Dragon Ball Z: Burst Limit (Dragon Burst)](https://github.com/dfdx047/Dragon-Burst) | Xbox 360 | 23 | 2026-11-10 | 200 | — |
| 932 | [Import Tuner Challenge (Import Tuner Challenge Static Recompilation)](https://github.com/Spooky098529/ITC-Recomp) | Xbox 360 | 23 | 2026-10-25 | 200 | AI |
| 933 | [Need for Speed: Carbon Collector's Edition (Need for Speed Carbon CE Recomp)](https://github.com/mkalkhoven-po/nfs-carbon-ce-recomp) | Xbox 360 | 23 | 2026-11-17 | 200 | AI |
| 934 | [NeverDead (Neverdeth)](https://github.com/Katzert/Neverdeth) | Xbox 360 | 23 | 2026-11-13 | 200 | — |
| 935 | [Sonic Generations (Sonic-Generations-recomp-android-and-pc-edition)](https://github.com/Player124413/Sonic-Generations-recomp-android-and-pc-edition) | Xbox 360 | 23 | 2026-09-14 | 200 | — |
| 936 | [Test Drive Unlimited](https://github.com/testdriveupgrade/TDURE) | Xbox 360 | 23 | 2026-04-17 | 200 | — |
| 937 | [The Legend of Spyro: Dawn of the Dragon (Spyro: Dawn of the Dragon Recomp)](https://github.com/Minuteworld94/Dawn-of-the-dragon-recomp) | Xbox 360 | 23 | 2026-11-18 | 200 | — |
| 938 | [Tony Hawk's Proving Ground (Proving Ground Recompiled)](https://github.com/Newbie1337x/ProvingGroundRecomp) | Xbox 360 | 23 | 2026-11-11 | 200 | AI |
| 939 | [WWE 2K16 (WWE 2K16 Recomp)](https://github.com/itsbybanshee/wwe2k16-pc) | Xbox 360 | 23 | 2026-11-18 | 200 | — |
| 940 | [Battlefield 1943 / Battlefield: Bad Company](https://github.com/papand7/Battlefield-Recompilation-Project) | Xbox 360 | 22 | 2026-11-19 | 200 | — |
| 941 | [Gears of War (GearsRecomp)](https://github.com/Jauidev/GearsRecomp) | Xbox 360 | 22 | 2026-11-10 | 200 | — |
| 942 | [WWE SmackDown vs. Raw 2011 (SVR2011-Recomp)](https://github.com/shaneomac1337/SVR2011-Recomp) | Xbox 360 | 22 | 2026-10-02 | 200 | — |
| 943 | [Burnout CRASH! (burnout-crash-recomp)](https://github.com/kiesxoxo/burnout-crash-recomp) | Xbox 360 | 21 | 2026-10-08 | 200 | — |
| 944 | [Call of Duty: Black Ops II (bo2-recompiled)](https://github.com/officialmelon/bo2-recompiled) | Xbox 360 | 21 | 2026-04-10 | 200 | — |
| 945 | [Conan (Conan2007Recomp)](https://github.com/crazyriddler/Conan2007Recomp) | Xbox 360 | 21 | 2026-09-27 | 200 | AI |
| 946 | [Dynasty Warriors: Gundam 2 (DWG2Recomp)](https://github.com/Adeelshah001/DWG2Recomp) | Xbox 360 | 21 | 2026-11-15 | 200 | AI |
| 947 | [Max Payne 3 (mp3-nx)](https://github.com/VasilkovND/mp3-nx) | Xbox 360 | 21 | 2026-11-06 | 200 | — |
| 948 | [Max Payne 3 (MP3-PS4)](https://github.com/iHaiDeeZ/MP3-PS4) | Xbox 360 | 21 | 2026-11-13 | 200 | — |
| 949 | [Rayman Legends (Legends-Recomp)](https://github.com/edeegg/Legends-Recomp) | Xbox 360 | 21 | 2026-10-14 | 200 | — |
| 950 | [Sega Superstars Tennis (Sega Superstars Tennis ReMatch)](https://github.com/m1ndcrap/Sega-Superstars-Tennis-ReMatch) | Xbox 360 | 21 | 2026-10-24 | 200 | — |
| 951 | [Madden NFL 08 (Madden NFL 08 Recompiled)](https://github.com/anishchandra24/MaddenNFL08-Recompiled) | Xbox 360 | 20 | 2026-11-15 | 200 | AI |
| 952 | [The Simpsons Game (the-simpsons-game-nx)](https://github.com/R-drg/the-simpsons-game-nx) | Xbox 360 | 20 | 2026-10-06 | 200 | — |
| 953 | [Tom Clancy's Ghost Recon Advanced Warfighter (GRAW 360 Recompiled)](https://github.com/Juansolo457/graw360-recomp) | Xbox 360 | 20 | 2026-11-11 | 200 | — |
| 954 | [Asura's Wrath](https://github.com/otavix010/asuras-wrath-pc) | Xbox 360 | 19 | 2026-11-19 | 200 | — |
| 955 | [Battlefield: Bad Company (Battlefield: Bad Company (Xbox 360 Recomp))](https://github.com/solidussnake95/battlefield-bad-company-xbox360-recomp-) | Xbox 360 | 19 | 2026-11-18 | 200 | — |
| 956 | [Forza Horizon 2 (Forza-Horizon-2-Recomp)](https://github.com/fabioap-cpu/Forza-Horizon-2-Recomp) | Xbox 360 | 19 | 2026-09-03 | 200 | — |
| 957 | [Pac-Man Championship Edition (Pac-Man Championship Edition (2007): native PC port)](https://github.com/jedeyesniv-art/Pacman-CE-PC-Recomp) | Xbox 360 | 19 | 2026-10-21 | 200 | AI |
| 958 | [Tenchu Z (TenchuZ-PC)](https://github.com/8bitninja64/TenchuZ-PC) | Xbox 360 | 19 | 2026-11-17 | 200 | AI |
| 959 | [Call of Duty 3 (COD3 Reborn)](https://github.com/jxnplays/cod3-recomp) | Xbox 360 | 18 | 2026-10-18 | 200 | — |
| 960 | [Dead or Alive 4 (doa4-recomp)](https://github.com/parkerallan/doa4-recomp) | Xbox 360 | 18 | 2026-06-07 | 200 | — |
| 961 | [Dead or Alive Extreme 2](https://github.com/Revan67/DOAX2-Recomp) | Xbox 360 | 18 | 2026-10-09 | 200 | AI |
| 962 | [Dead Space (ds1-nx)](https://github.com/VasilkovND/ds1-nx) | Xbox 360 | 18 | 2026-11-11 | 200 | — |
| 963 | [Dead Space 3 (ds3-nx)](https://github.com/VasilkovND/ds3-nx) | Xbox 360 | 18 | 2026-10-27 | 200 | — |
| 964 | [Rayman Origins (RaymanOriginsRecomp)](https://github.com/XDanfr/RaymanOriginsRecomp) | Xbox 360 | 18 | 2026-09-27 | 200 | — |
| 965 | [Sonic 06 Demo](https://github.com/PranchaD/re-Sonic06Demo) | Xbox 360 | 18 | 2026-02-26 | 200 | — |
| 966 | [Max Payne 3 (Max Payne 3 RePrescribed)](https://github.com/ChaosTheory1075/mp3-ps5) | Xbox 360 | 17 | 2026-11-01 | 200 | — |
| 967 | [Midnight Club: Los Angeles (Midnight-Club-L.A-RECOMP)](https://github.com/luisxl15/Midnight-Club-L.A-RECOMP) | Xbox 360 | 17 | 2026-08-30 | 200 | — |
| 968 | [Vigilante 8 Arcade (vig8)](https://github.com/sp00nznet/vig8) | Xbox 360 | 17 | 2026-10-21 | 200 | — |
| 969 | [3 on 3 NHL Arcade (3on3 Arcade Recomp)](https://github.com/startupandhold/3on3ArcadeRecomp) | Xbox 360 | 16 | 2026-10-28 | 200 | — |
| 970 | [Ace Combat 6: Fires of Liberation (AC6Recomp)](https://github.com/rapidsamphire/AC6Recomp) | Xbox 360 | 16 | 2026-03-28 | 200 | — |
| 971 | [Dead Space 2 (Dead-Space-2-Recomp)](https://github.com/bifftannen1/Dead-Space-2-Recomp) | Xbox 360 | 16 | 2026-10-17 | 200 | — |
| 972 | [The Bigs 2 (The Bigs 2 Recompiled)](https://github.com/mdomangue26/The-Bigs-2-Recompiled) | Xbox 360 | 16 | 2026-11-17 | 200 | AI |
| 973 | [Exit (EXIT Recomp)](https://github.com/FluffyQuack/ReXGlue-EXIT) | Xbox 360 | 15 | 2026-07-07 | 200 | — |
| 974 | [Gears of War 3 (Gears3Recomp)](https://github.com/Jauidev/Gears3Recomp) | Xbox 360 | 15 | 2026-11-10 | 200 | — |
| 975 | [Rumble Roses XX](https://github.com/Revan67/RumbleRosesXX-Recomp) | Xbox 360 | 15 | 2026-10-26 | 200 | AI |
| 976 | [Afro Samurai (Afro Samurai Recomp)](https://github.com/LomoXSoft/AfroSamuraiRecomp) | Xbox 360 | 14 | 2026-11-16 | 200 | — |
| 977 | [Gears of War (gears1)](https://github.com/SomeoneIsWorking/gears1) | Xbox 360 | 14 | 2026-11-10 | 200 | — |
| 978 | [Guardian Heroes (Guardian Heroes recompilation)](https://github.com/rashevskyv/guardian-heroes-recomp-public) | Xbox 360 | 14 | 2026-11-03 | 200 | — |
| 979 | [Metal Gear Rising: Revengeance (MGR-PS4)](https://github.com/iHaiDeeZ/MGR-PS4) | Xbox 360 | 14 | 2026-11-04 | 200 | — |
| 980 | [NHL Legacy Edition (NHL Legacy Native)](https://github.com/csrpfivem/PS3NHLLegacyRecomp) | Xbox 360 | 14 | 2026-11-17 | 200 | — |
| 981 | [OutRun Online Arcade (OutRun Online Arcade Recompiled)](https://github.com/darkuni/outrun-arcade-recomp) | Xbox 360 | 14 | 2026-10-31 | 200 | — |
| 982 | [3 on 3 NHL Arcade (3on3NHL-recomp)](https://github.com/Wndwsqrrl/3on3NHL-recomp) | Xbox 360 | 13 | 2026-10-27 | 200 | — |
| 983 | [Cars Race-O-Rama (Cars-Race-O-Rama-Recompiled)](https://github.com/m1ndcrap/Cars-Race-O-Rama-Recompiled) | Xbox 360 | 13 | 2026-03-21 | 200 | — |
| 984 | [Crackdown 2 (Crackdown 2 Recomp)](https://github.com/pacific-city-recompiled/crackdown-2-recomp) | Xbox 360 | 13 | 2026-11-01 | 200 | AI |
| 985 | [Far Cry 3 (fc3-nx)](https://github.com/barbaruiva25/fc3-nx) | Xbox 360 | 13 | 2026-10-15 | 200 | — |
| 986 | [GoldenEye 007 (XBLA remaster) (GoldenEye-Recomp-rexglue)](https://github.com/SunJaycy/GoldenEye-Recomp-rexglue) | Xbox 360 | 13 | 2026-06-18 | 200 | — |
| 987 | [N3: Ninety-Nine Nights (N3 Recompiled)](https://github.com/WK2D/N3-Ninety-Nine-Nights-Recomp) | Xbox 360 | 13 | 2026-10-22 | 200 | AI |
| 988 | [Resident Evil Code: Veronica X HD (VeronicaRecomp)](https://github.com/psxrestore/VeronicaRecomp) | Xbox 360 | 13 | 2026-10-01 | 200 | — |
| 989 | [The Simpsons Game (the-simpsons-recomp)](https://github.com/portingpete/the-simpsons-recomp) | Xbox 360 | 13 | 2026-10-18 | 200 | — |
| 990 | [WWE 2K14 (WWE 2K14 Recomp)](https://github.com/mikeflare007/wwe2k14-recomp) | Xbox 360 | 13 | 2026-10-15 | 200 | — |
| 991 | [Skate 3 (Skate-3-Recompiled--Work-in-Progress-)](https://github.com/HelmXGaming/Skate-3-Recompiled--Work-in-Progress-) | Xbox 360 | 12 | 2026-05-21 | 200 | — |
| 992 | [Skate 3 (skate3recomp_nx)](https://github.com/SubterraneanHomesickAyan/skate3recomp_nx) | Xbox 360 | 12 | 2026-10-20 | 200 | — |
| 993 | [Test Drive Unlimited (TDURecomp)](https://github.com/testdriveupgrade/TDURecomp) | Xbox 360 | 12 | 2026-04-30 | 200 | — |
| 994 | [Trials HD (Trials HD Recomp)](https://github.com/trev82usa/TrialsHD-Recomp) | Xbox 360 | 12 | 2026-11-17 | 200 | — |
| 995 | [Blue Dragon (reblue)](https://github.com/WeiGustavo/reblue) | Xbox 360 | 11 | 2026-02-19 | 200 | — |
| 996 | [Crystal Defenders (Cristalis)](https://github.com/Claudio5702/Cristalis) | Xbox 360 | 11 | 2026-11-02 | 200 | AI |
| 997 | [Daytona USA (Daytona USA ReXGlue Recompilation)](https://github.com/springah/daytona_recomp) | Xbox 360 | 11 | 2026-10-29 | 200 | AI |
| 998 | [Skate 2 (Skate2Recompiled)](https://github.com/cookingwithsimon/Skate2Recompiled) | Xbox 360 | 11 | 2026-10-11 | 200 | AI |
| 999 | [SSX (2012) (SSX-RexGlue)](https://github.com/pmrazor/SSX-RexGlue) | Xbox 360 | 11 | 2026-10-12 | 200 | — |
| 1000 | [Tekken Tag Tournament 2 (TTT2-PS4)](https://github.com/iHaiDeeZ/TTT2-PS4) | Xbox 360 | 11 | 2026-10-30 | 200 | — |
| 1001 | [Call of Duty 3 (cod3pc)](https://github.com/alekszverr-jpg/cod3pc) | Xbox 360 | 10 | 2026-10-29 | 200 | — |
| 1002 | [Metal Gear Rising: Revengeance (Metal Gear Rising: Revengeance RePlatinum)](https://github.com/ChaosTheory1075/mgr-ps5) | Xbox 360 | 10 | 2026-11-06 | 200 | — |
| 1003 | [Ninja Gaiden II (Ninja's Dawn (ng2recomp))](https://github.com/evil84/Ninja-s-Dawn---A-Ninja-Gaiden-2-Recompilation-Project) | Xbox 360 | 10 | 2026-09-14 | 200 | — |
| 1004 | [Peggle 2 (Peggle 2 for Mac)](https://github.com/macprotips/peggle2-mac) | Xbox 360 | 10 | 2026-11-13 | 200 | — |
| 1005 | [TNA iMPACT! (TNA iMPACT! Recompiled)](https://github.com/dotGrx/TNA-IMPACT-Recomp) | Xbox 360 | 10 | 2026-10-18 | 200 | — |
| 1006 | [Saw II: Flesh & Blood](https://github.com/ant0-blase/Saw2-X360-ReXGlue) | Xbox 360 | 4 | 2026-08-25 | 200† | — |
| 1007 | [Halo 3 (Project Reclaimer)](https://recompiledgames.com/halo-3-project-reclaimer-recompiled) | Xbox 360 | — | — | 200 | — |
| 1008 | [TwinBee PARADISE in Donburi Shima](https://github.com/Jhuyghue/donburi-recomp) | — | 1 | 2026-10-17 | 200 | — |
| 1009 | [Gearhead Garage (native macOS recompilation)](https://github.com/007hacky007/gearhead-garage-macos-arm64) | — | 0 | 2026-11-13 | 200 | AI |

### 2.2 Decompilations — 920 rows

*Source-code reconstructions (matching or functional) of the original game binary.*

| # | Title (link = project URL) | Platform | Stars | Last activity | Link | AI |
|--:|---|---|--:|---|:--:|:--:|
| 1 | [3ds (Azahar)](https://github.com/azahar-emu/azahar) | 3DS | 8,731 | 2026-11-18 | 200 | — |
| 2 | [The Legend of Zelda: Majora's Mask 3D (Project Restoration)](https://github.com/leoetlino/project-restoration) | 3DS | 818 | 2022-01-02 | 200 | — |
| 3 | [Monster Hunter 4 Ultimate (MH4UltimateDC)](https://github.com/CompaLarios18/MH4UltimateDC) | 3DS | 148 | 2026-11-03 | 200 | AI |
| 4 | [Super Mario 3D Land](https://github.com/3dsdecomp/RedPepper) | 3DS | 116 | 2025-05-22 | 200 | — |
| 5 | [The Legend of Zelda: Ocarina of Time 3D](https://github.com/zeldaret/oot3d) | 3DS | 91 | 2026-09-04 | 200 | — |
| 6 | [Monster Hunter 4 Ultimate (mh4u-decomp)](https://github.com/mhvuze/mh4u-decomp) | 3DS | 32 | 2026-11-14 | 200 | — |
| 7 | [Pokemon Moon](https://github.com/gradenGnostic/pokemoon) | 3DS | 28 | 2026-09-16 | 200 | — |
| 8 | [The Legend of Zelda: A Link Between Worlds (albw-decomp-ai)](https://github.com/7akeem0/albw-decomp-ai) | 3DS | 27 | 2026-10-28 | 200 | AI |
| 9 | [Animal Crossing: New Leaf - Welcome amiibo](https://github.com/RedShyGuy/acnl-decomp) | 3DS | 19 | 2026-11-18 | 200 | — |
| 10 | [Mario & Luigi: Dream Team (MILLI4C)](https://github.com/Mario-and-Luigi-3Ds-R-D/MILLI4C) | 3DS | 13 | 2026-08-12 | 200 | — |
| 11 | [Paper Mario: Sticker Star](https://github.com/Darxoon/leaflitter) | 3DS | 12 | 2025-12-09 | 200† | — |
| 12 | [Frontier: Elite II (GLFrontier)](https://github.com/pcercuei/glfrontier) | Amiga | 92 | 2014-03-24 | 200 | — |
| 13 | [Frontier: Elite II (fe2-intro)](https://github.com/watsonmw/fe2-intro) | Amiga | 52 | 2025-01-05 | 200 | — |
| 14 | [Stunt Car Racer (Vesuri stuntcarracer (Framerate Unleashed))](https://github.com/Vesuri/stuntcarracer) | Amiga | 52 | 2026-06-01 | 200 | — |
| 15 | [Stunt Car Racer (stunt-car-racer-ste)](https://github.com/jonathanopalise/stunt-car-racer-ste) | Amiga | 23 | 2021-09-12 | 200 | — |
| 16 | [Speedball 2: Brutal Deluxe (speedball2-re-amiga)](https://github.com/simon-frankau/speedball2-re-amiga) | Amiga | 18 | 2023-05-05 | 200 | — |
| 17 | [Lemmings (Lemmings For Windows 95)](https://github.com/NitrosGits/Lemmings-For-Windows-95) | Amiga | 11 | 2026-11-09 | 200 | — |
| 18 | [Choplifter (ChoplifterReverse (Blondihacks))](https://github.com/blondie7575/ChoplifterReverse) | Apple II | 100 | 2024-10-24 | 200 | — |
| 19 | [Lode Runner (lode_runner_reveng (literate programming))](https://github.com/XekriRedmane/lode_runner_reveng) | Apple II | 98 | 2026-07-09 | 200 | — |
| 20 | [Ultima IV: Quest of the Avatar (u4-decompiled)](https://github.com/ergonomy-joe/u4-decompiled) | Apple II | 83 | 2023-10-05 | 200 | — |
| 21 | [Ultima IV: Quest of the Avatar (u4remasteredA2)](https://github.com/sean-gugler/u4remasteredA2) | Apple II | 78 | 2025-01-25 | 200 | — |
| 22 | [Lode Runner (Piddewitt Loderunner)](https://github.com/Piddewitt/Loderunner) | Apple II | 68 | 2024-04-14 | 200 | — |
| 23 | [Ultima V: Warriors of Destiny (u5d)](https://github.com/wonst719/u5d) | Apple II | 10 | 2026-10-28 | 200 | — |
| 24 | [BizHawk](https://github.com/TASEmulators/BizHawk) | Arcade | 2,825 | 2026-11-10 | 200 | — |
| 25 | [In the Groove (ITGMania)](https://github.com/itgmania/itgmania) | Arcade | 320 | 2026-07-01 | 200 | — |
| 26 | [Namco 2x Systems (Namco 22 Decompile)](https://github.com/spacestate1/namco22-decompile) | Arcade | 301 | 2026-11-08 | 200 | AI |
| 27 | [Street Fighter III: 3rd Strike](https://github.com/crowded-street/3s-decomp) | Arcade | 290 | 2026-04-03 | 200 | — |
| 28 | [Sonic The Fighters](https://github.com/biggestsonicfan/stfdecomp) | Arcade | 110 | 2025-06-07 | 200 | — |
| 29 | [Time Crisis (Time Crisis VR)](https://github.com/DR-89/time-crisis-vr) | Arcade | 93 | 2026-11-13 | 200 | — |
| 30 | [Street Fighter III: 3rd Strike (sfIII3-cps3-decomp)](https://github.com/gibletto/sfIII3-cps3-decomp) | Arcade | 48 | 2026-11-02 | 200 | — |
| 31 | [Sinistar](https://github.com/synamaxmusic/sinistar) | Arcade | 46 | 2025-11-16 | 200 | — |
| 32 | [Gauntlet Legends](https://github.com/Drahsid/gauntlet-legends) | Arcade | 33 | 2026-04-30 | 200 | — |
| 33 | [Gauntlet Dark Legacy](https://github.com/sabishii-bit/Gauntlet-Dark-Legacy-Decompilation) | Arcade | 28 | 2026-09-25 | 200 | — |
| 34 | [Teenage Mutant Ninja Turtles (tmntarcade-decomp)](https://github.com/cheviman/tmntarcade-decomp) | Arcade | 25 | 2026-11-16 | 200 | — |
| 35 | [Jackal (UEFI_Jackal)](https://github.com/MikeWuPing/UEFI_Jackal) | Arcade | 16 | 2026-07-22 | 200 | — |
| 36 | [Virtua Cop 2 (re-virtua-cop-2)](https://github.com/jevarg/re-virtua-cop-2) | Arcade | 15 | 2026-05-19 | 200 | — |
| 37 | [Virtua Fighter 2 (vf2-decomp)](https://github.com/celsowm/vf2-decomp) | Arcade | 15 | 2026-11-02 | 200 | AI |
| 38 | [Green Beret (Paul Hughes ZXSpectrumGreenBeret)](https://github.com/Paulie68000/ZXSpectrumGreenBeret) | Arcade | 12 | 2025-01-03 | 200 | — |
| 39 | [Defender (Defender-Source-Code)](https://github.com/AaronBottegal/Defender-Source-Code) | Arcade | 11 | 2022-01-08 | 200 | — |
| 40 | [Crazy Taxi](https://github.com/consolesplayingconsoles/crazy-taxi-decomp) | Arcade | 10 | 2026-11-17 | 200 | — |
| 41 | [Star Raiders (sidneycadot Atari8bit_StarRaiders)](https://github.com/sidneycadot/Atari8bit_StarRaiders) | Atari 8-bit | 13 | 2013-12-04 | 200 | — |
| 42 | [Rayman (rayman-ps1-decomp)](https://github.com/fuerchter/rayman-ps1-decomp) | Atari Jaguar | 19 | 2026-01-21 | 200 | — |
| 43 | [Lotus Esprit Turbo Challenge (lotus-ste)](https://github.com/jonathanopalise/lotus-ste) | Atari ST | 44 | 2021-04-10 | 200 | — |
| 44 | [Dungeon Master (ReDMCSB (Christophe Fontanel))](https://github.com/gondur/ReDMCSB_Release2) | Atari ST | 13 | 2017-02-27 | 200 | — |
| 45 | [Elite (elite-source-code-commodore-64 (Mark Moxon))](https://github.com/markmoxon/elite-source-code-commodore-64) | BBC Micro/Acorn | 480 | 2026-11-08 | 200 | — |
| 46 | [Elite (elite-source-code-nes)](https://github.com/markmoxon/elite-source-code-nes) | BBC Micro/Acorn | 416 | 2026-11-08 | 200 | — |
| 47 | [Lander (lander-source-code-acorn-archimedes (Mark Moxon))](https://github.com/markmoxon/lander-source-code-acorn-archimedes) | BBC Micro/Acorn | 115 | 2026-11-12 | 200 | — |
| 48 | [Elite (c64-elite-flicker-free (Mark Moxon))](https://github.com/markmoxon/c64-elite-flicker-free) | BBC Micro/Acorn | 98 | 2026-11-08 | 200 | — |
| 49 | [The Sentinel (the-sentinel-source-code-bbc-micro (Mark Moxon))](https://github.com/markmoxon/the-sentinel-source-code-bbc-micro) | BBC Micro/Acorn | 62 | 2026-11-08 | 200 | — |
| 50 | [Aviator (aviator-source-code-bbc-micro (Mark Moxon))](https://github.com/markmoxon/aviator-source-code-bbc-micro) | BBC Micro/Acorn | 60 | 2026-11-08 | 200 | — |
| 51 | [Elite (elite-a-source-code-bbc-micro (Mark Moxon))](https://github.com/markmoxon/elite-a-source-code-bbc-micro) | BBC Micro/Acorn | 60 | 2026-11-13 | 200 | — |
| 52 | [Elite (elite-source-code-bbc-micro-disc (Mark Moxon))](https://github.com/markmoxon/elite-source-code-bbc-micro-disc) | BBC Micro/Acorn | 53 | 2026-11-13 | 200 | — |
| 53 | [Elite (elite-source-code-apple-ii (Mark Moxon))](https://github.com/markmoxon/elite-source-code-apple-ii) | BBC Micro/Acorn | 44 | 2026-11-08 | 200 | — |
| 54 | [Revs (revs-source-code-bbc-micro (Mark Moxon))](https://github.com/markmoxon/revs-source-code-bbc-micro) | BBC Micro/Acorn | 43 | 2026-11-08 | 200 | — |
| 55 | [Elite (elite-source-code-6502-second-processor (Mark Moxon))](https://github.com/markmoxon/elite-source-code-6502-second-processor) | BBC Micro/Acorn | 42 | 2026-11-08 | 200 | — |
| 56 | [Elite (elite-source-code-acorn-electron (Mark Moxon))](https://github.com/markmoxon/elite-source-code-acorn-electron) | BBC Micro/Acorn | 35 | 2026-11-08 | 200 | — |
| 57 | [Elite (elite-source-code-bbc-master (Mark Moxon))](https://github.com/markmoxon/elite-source-code-bbc-master) | BBC Micro/Acorn | 35 | 2026-11-08 | 200 | — |
| 58 | [Repton (ajgbarnes bbc-micro-repton)](https://github.com/ajgbarnes/bbc-micro-repton) | BBC Micro/Acorn | 14 | 2022-12-03 | 200 | — |
| 59 | [Maniac Mansion](https://github.com/pditincho/mm-explained) | Commodore 64/8-bit | 50 | 2025-12-11 | 200 | — |
| 60 | [Uridium (uridium (+ UridiumFraktion))](https://github.com/mwenge/uridium) | Commodore 64/8-bit | 26 | 2026-10-03 | 200 | — |
| 61 | [Attack of the Mutant Camels (Attack of the Mutant Camels (reverse engineer))](https://github.com/C64-Mark/Attack-of-the-Mutant-Camels) | Commodore 64/8-bit | 19 | 2020-04-10 | 200 | — |
| 62 | [Duke Nukem II](https://github.com/lethal-guitar/Duke2Reconstructed) | DOS | 376 | 2025-04-13 | 200 | — |
| 63 | [Starflight](https://github.com/s-macke/starflight-reverse) | DOS | 246 | 2026-03-09 | 200 | — |
| 64 | [SimCity 2000 (sc2kfix)](https://github.com/sc2kfix/sc2kfix) | DOS | 231 | 2026-10-16 | 200 | — |
| 65 | [SkyRoads (SkyRoads-Codex)](https://github.com/ammaarreshi/SkyRoads-Codex) | DOS | 197 | 2026-03-08 | 200 | AI |
| 66 | [Fallout 1](https://github.com/alexbatalov/fallout1-re) | DOS | 182 | 2023-01-30 | 200 | — |
| 67 | [Ultima VII: The Black Gate (UltimaHacks)](https://github.com/JohnGlassmyer/UltimaHacks) | DOS | 167 | 2023-03-09 | 200 | — |
| 68 | [Cosmo's Cosmic Adventure](https://github.com/smitelli/cosmore) | DOS | 147 | 2024-10-23 | 200 | — |
| 69 | [Dangerous Dave in the Haunted Mansion (dangerous-dave-re)](https://github.com/gmegidish/dangerous-dave-re) | DOS | 91 | 2018-02-20 | 200 | — |
| 70 | [Curse of the Azure Bonds (coab)](https://github.com/simeonpilgrim/coab) | DOS | 70 | 2024-02-09 | 200 | — |
| 71 | [Digger (Digger Remastered (sobomax fork))](https://github.com/sobomax/digger) | DOS | 59 | 2026-10-14 | 200 | — |
| 72 | [Ultima VI: The False Prophet (u6-decompiled)](https://github.com/ergonomy-joe/u6-decompiled) | DOS | 59 | 2022-04-07 | 200 | — |
| 73 | [Super ZZT (Reconstruction of Super ZZT)](https://github.com/asiekierka/reconstruction-of-super-zzt) | DOS | 47 | 2025-06-30 | 200 | — |
| 74 | [Final Doom (PSXFINALDOOM-RE)](https://github.com/Erick194/PSXFINALDOOM-RE) | DOS | 41 | 2025-05-30 | 200 | — |
| 75 | [Carmageddon (dethrace-ported-to-web)](https://github.com/Carter54git/dethrace-ported-to-web) | DOS | 39 | 2026-07-05 | 200 | — |
| 76 | [Sid Meier's Civilization (civd)](https://github.com/sjmelia/civd) | DOS | 31 | 2026-11-04 | 200 | — |
| 77 | [Dungeon Master II: Skullkeep (skproject)](https://github.com/gbsphenx/skproject) | DOS | 28 | 2026-11-16 | 200 | — |
| 78 | [Commander Keen in Goodbye, Galaxy! (Keen 4-6 reconstructed source (mirror))](https://github.com/sparky4/keen4-6) | DOS | 26 | 2023-10-07 | 200 | — |
| 79 | [Bedlam 2: Absolute Bedlam](https://github.com/8street/Bedlam2) | DOS | 23 | 2023-02-18 | 200 | — |
| 80 | [Fallout (F1DP)](https://github.com/Edw590/F1DP) | DOS | 23 | 2025-08-10 | 200 | — |
| 81 | [Stunts (Restunts)](https://github.com/4d-stunts/restunts) | DOS | 23 | 2026-08-13 | 200 | — |
| 82 | [Bio Menace](https://github.com/lethal-guitar/BioMenaceDecomp) | DOS | 16 | 2024-12-27 | 200 | — |
| 83 | [MechWarrior 2: 31st Century Combat (demech2)](https://github.com/anpage/demech2) | DOS | 16 | 2026-11-19 | 200 | — |
| 84 | [Grand Theft Auto (gta1_re)](https://github.com/CriminalRETeam/gta1_re) | DOS | 14 | 2026-07-04 | 200 | — |
| 85 | [Redneck Rampage (Redneck-Rampage-RE)](https://github.com/NBlood/Redneck-Rampage-RE) | DOS | 13 | 2026-01-07 | 200 | — |
| 86 | [Duke Nukem (Duke1Decomp)](https://github.com/lethal-guitar/Duke1Decomp) | DOS | 12 | 2024-06-25 | 200 | — |
| 87 | [Transport Tycoon Deluxe (TTDPatch)](https://github.com/ttdpatch/ttdpatch) | DOS | 11 | 2013-10-10 | 200 | — |
| 88 | [KKND: Krush Kill 'n Destroy](https://github.com/Wyrelade/KKND-Decomp) | DOS | 10 | 2026-09-24 | 200 | — |
| 89 | [Stronghold (1993)](https://github.com/NancySadkov/dest) | DOS | 5 | 2024-08-15 | 200 | — |
| 90 | [Prince of Persia 2: The Shadow and the Flame](https://github.com/ToolAssisted-run/SDLPoP2) | DOS | 4 | 2026-11-03 | 200 | — |
| 91 | [Bumpy's Arcade Fantasy](https://github.com/GeReV/bumpy-reverse) | DOS | 2 | 2026-10-07 | 200 | — |
| 92 | [4D Sports Boxing](https://github.com/ToolAssisted-run/Open4DBoxing) | DOS | 1 | 2026-10-24 | 200 | — |
| 93 | [Sword of the Samurai](https://github.com/ToolAssisted-run/OpenSamurai) | DOS | 1 | 2026-10-03 | 200 | — |
| 94 | [Sonic Adventure](https://github.com/reshaped/sonic-adventure) | Dreamcast | 52 | 2026-11-19 | 200 | — |
| 95 | [Resident Evil - Code: Veronica](https://github.com/fmil95/recv-dc-decomp) | Dreamcast | 41 | 2026-01-20 | 200 | — |
| 96 | [Tokyo Bus Guide](https://github.com/lhsazevedo/tbg-decomp) | Dreamcast | 38 | 2026-11-14 | 200 | — |
| 97 | [Virtua Tennis](https://github.com/consolesplayingconsoles/virtua-tennis-decomp) | Dreamcast | 5 | 2026-11-15 | 200 | — |
| 98 | [Zombie Revenge](https://github.com/consolesplayingconsoles/zombie-revenge-decomp) | Dreamcast | 3 | 2026-11-16 | 200 | — |
| 99 | [melonDS](https://github.com/melonDS-emu/melonDS) | DS | 5,229 | 2026-11-18 | 200 | — |
| 100 | [Angband](https://github.com/angband/angband) | DS | 1,583 | 2026-11-17 | 200 | — |
| 101 | [Pokemon HeartGold](https://github.com/pret/pokeheartgold) | DS | 767 | 2026-11-15 | 200 | — |
| 102 | [Kingdom Hearts: Chain of Memories (KH Melon Mix)](https://github.com/vitor251093/KHMelonMix) | DS | 643 | 2026-10-16 | 200 | AI |
| 103 | [Pokemon Platinum](https://github.com/pret/pokeplatinum) | DS | 616 | 2026-11-07 | 200 | — |
| 104 | [Pokemon Diamond](https://github.com/pret/pokediamond) | DS | 552 | 2026-10-11 | 200 | — |
| 105 | [Super Mario 64 DS (sm64ds-decomp)](https://github.com/tangosdev/sm64ds-decomp) | DS | 264 | 2026-11-19 | 200 | — |
| 106 | [Pokemon MD Sky](https://github.com/pret/pmd-sky) | DS | 153 | 2026-11-07 | 200 | — |
| 107 | [Pokemon Platinum (pokeplatinum)](https://github.com/cybervisi0n/pokeplatinum) | DS | 153 | 2026-11-18 | 200 | — |
| 108 | [Pokemon Black / Pokemon White (Eidos)](https://github.com/Project-Holon/eidos) | DS | 123 | 2026-11-19 | 200 | — |
| 109 | [The Legend of Zelda: Phantom Hourglass](https://github.com/zeldaret/ph) | DS | 120 | 2026-10-09 | 200 | — |
| 110 | [Kingdom Hearts 358/2 Days (khdays-decomp)](https://github.com/Yokimitsuro/khdays-decomp) | DS | 111 | 2026-11-05 | 200 | — |
| 111 | [Pokémon Black 2 and White 2 (pokebw2)](https://github.com/fuddlesworth/pokebw2) | DS | 98 | 2026-11-16 | 200 | — |
| 112 | [The Legend of Zelda: Spirit Tracks (st)](https://github.com/zeldaret/st) | DS | 80 | 2026-11-19 | 200 | — |
| 113 | [New Super Mario Bros.](https://github.com/NSMB-Decomp/nsmb) | DS | 75 | 2026-11-01 | 200 | — |
| 114 | [Pokemon Black](https://github.com/squiddonaut/pokeblack) | DS | 70 | 2026-10-17 | 200 | — |
| 115 | [Mario Kart DS](https://github.com/XorTroll/mkds-re) | DS | 68 | 2025-01-24 | 200 | — |
| 116 | [Dragon Quest IX](https://github.com/DQIX/dqix-decomp) | DS | 67 | 2026-11-17 | 200 | — |
| 117 | [Pokémon Mystery Dungeon: Explorers of Sky (pmdsky-debug (symbol database))](https://github.com/UsernameFodder/pmdsky-debug) | DS | 56 | 2026-11-07 | 200 | — |
| 118 | [Sonic Rush Adventure](https://github.com/RushRE/SonicRushAdventure-Decomp) | DS | 48 | 2026-10-27 | 200 | — |
| 119 | [The World Ends with You](https://github.com/Yotona/twewy) | DS | 37 | 2026-10-30 | 200 | — |
| 120 | [Castlevania: Order of Ecclesia](https://github.com/LagoLunatic/ooe) | DS | 36 | 2025-05-04 | 200 | — |
| 121 | [Animal Crossing: Wild World (acww-decomp)](https://github.com/7ucina/acww-decomp) | DS | 28 | 2026-10-14 | 200 | — |
| 122 | [Mario Party DS](https://github.com/mariopartyrd/mariopartyDS) | DS | 28 | 2025-04-17 | 200 | — |
| 123 | [Kingdom Hearts 358/2 Days (khdays-vita)](https://github.com/ggdrn/KH-DAYS-VITA) | DS | 23 | 2026-11-13 | 200 | — |
| 124 | [Kingdom Hearts Re:coded (kh-recoded-decomp)](https://github.com/kh-recoded-decomp/kh-recoded-decomp) | DS | 23 | 2026-11-06 | 200 | — |
| 125 | [Inazuma Eleven 3 - Sekai e no Chousen: The Ogre!!](https://github.com/CacaBueno64/ie3ogres) | DS | 22 | 2026-11-06 | 200 | — |
| 126 | [Dragon Quest IV](https://github.com/GoldieLeGenie/DQIV-DECOMP) | DS | 19 | 2026-10-18 | 200 | — |
| 127 | [Fire Emblem: Shadow Dragon](https://github.com/Eebit/fe11-us) | DS | 17 | 2026-11-02 | 200 | — |
| 128 | [Kingdom Hearts Re:coded (khrecoded-decomp (Yokimitsuro))](https://github.com/Yokimitsuro/khrecoded-decomp) | DS | 17 | 2026-10-05 | 200 | — |
| 129 | [Mario & Luigi - Partners in Time](https://github.com/Rainchus/PartnersInTime-Decomp) | DS | 16 | 2026-09-29 | 200 | — |
| 130 | [The Legend of Zelda: Spirit Tracks](https://github.com/Yanis002/st) | DS | 16 | 2026-11-19 | 200 | — |
| 131 | [Kingdom Hearts 358/2 Days (KHDays 358 Android)](https://github.com/sonofskywalker3/khdays-358-android) | DS | 14 | 2026-11-19 | 200 | AI |
| 132 | [Animal Crossing: Wild World (acww-decomp)](https://github.com/banatic/acww-decomp) | DS | 12 | 2026-11-11 | 200 | — |
| 133 | [Lego Battles](https://github.com/LiruJ/Lego-Battles-Decomp) | DS | 10 | 2025-10-20 | 200 | — |
| 134 | [Super Mario 64 DS](https://github.com/matty45/sm64ds-decomp) | DS | 10 | 2024-03-15 | 200† | — |
| 135 | [Bomberman Land Touch 2](https://github.com/gamemasterplc/bltouch2) | DS | 7 | 2026-11-07 | 200 | — |
| 136 | [Pokémon Red and Blue (pokered-gbc)](https://github.com/dannye/pokered-gbc) | Game Boy | 181 | 2026-01-25 | 200 | — |
| 137 | [Pokémon Red and Blue (pokemon-claude-red)](https://github.com/levy-street/pokemon-claude-red) | Game Boy | 78 | 2026-09-30 | 200 | AI |
| 138 | [Pokémon Red and Blue (Pokémon Anniversary Red)](https://github.com/TwitchPlaysPokemon/pokemonAnniversaryRed) | Game Boy | 35 | 2015-05-27 | 200 | — |
| 139 | [Metroid II: Return Of Samus](https://github.com/Vashy777/metroid2) | Game Boy | 20 | 2021-11-08 | 200 | — |
| 140 | [Pokémon Red and Blue](https://github.com/jayceekaycee/RedPlusPlus) | Game Boy | 17 | 2016-03-01 | 200 | — |
| 141 | [Pokémon Gold and Silver (Pokémon Polished Crystal)](https://github.com/Rangi42/polishedcrystal) | Game Boy Color | 1,695 | 2026-11-18 | 200 | — |
| 142 | [The Legend of Zelda: Oracle of Ages / Oracle of Seasons (Oracles Decomp)](https://github.com/kirby-letsgo/oracles-decomp) | Game Boy Color | 122 | 2026-11-02 | 200 | AI |
| 143 | [Pokemon Puzzle League](https://github.com/AngheloAlf/puzzleleague64) | Game Boy Color | 44 | 2026-11-01 | 200 | — |
| 144 | [Star Ocean: Blue Sphere](https://github.com/animaone/star-ocean-blue-sphere-source-code) | Game Boy Color | 19 | 2025-10-08 | 200 | — |
| 145 | [Robot Poncots (Robopon) Sun / Star](https://github.com/PikalaxALT/robopon) | Game Boy Color | 14 | 2026-03-01 | 200 | — |
| 146 | [Dragon Warrior Monsters](https://github.com/NiyaDev/DWM) | Game Boy Color | 10 | 2026-02-02 | 200 | — |
| 147 | [Super Smash Bros. Melee](https://github.com/doldecomp/melee) | GameCube | 2,474 | 2026-11-05 | 200 | AI |
| 148 | [The Legend of Zelda: Twilight Princess](https://github.com/zeldaret/tp) | GameCube | 2,138 | 2026-06-23 | 200 | — |
| 149 | [Animal Crossing](https://github.com/ACreTeam/ac-decomp) | GameCube | 1,444 | 2026-11-07 | 200 | — |
| 150 | [The Legend of Zelda: The Wind Waker](https://github.com/zeldaret/tww) | GameCube | 1,175 | 2026-11-07 | 200 | — |
| 151 | [Mario Party 4](https://github.com/mariopartyrd/marioparty4) | GameCube | 891 | 2026-10-15 | 200 | — |
| 152 | [Metroid Prime (PrimeHack)](https://github.com/shiiion/dolphin) | GameCube | 627 | 2026-06-08 | 200 | — |
| 153 | [Resident Evil 4](https://github.com/adonis-singh/re4) | GameCube | 400 | 2026-10-02 | 200 | — |
| 154 | [Pikmin 2](https://github.com/projectPiki/pikmin2) | GameCube | 396 | 2026-10-20 | 200 | — |
| 155 | [Super Mario Sunshine](https://github.com/doldecomp/sms) | GameCube | 391 | 2026-11-19 | 200 | — |
| 156 | [Pikmin 1](https://github.com/projectPiki/pikmin) | GameCube | 335 | 2026-10-06 | 200 | — |
| 157 | [Mario Kart: Double Dash!!](https://github.com/doldecomp/mkdd) | GameCube | 222 | 2026-11-15 | 200 | — |
| 158 | [SpongeBob SquarePants: Battle for Bikini Bottom](https://github.com/bfbbdecomp/bfbb) | GameCube | 196 | 2026-10-29 | 200 | — |
| 159 | [Paper Mario The Thousand-Year Door (Paper Cut)](https://github.com/LLCOOLT/paper-cut) | GameCube | 170 | 2026-11-19 | 200 | AI |
| 160 | [Paper Mario: The Thousand-Year Door](https://github.com/doldecomp/ttyd) | GameCube | 154 | 2026-09-27 | 200 | — |
| 161 | [Super Mario Strikers](https://github.com/yannicksuter/smstrikers-decomp) | GameCube | 112 | 2026-09-17 | 200 | — |
| 162 | [Kirby Air Ride](https://github.com/doldecomp/kar) | GameCube | 92 | 2025-02-26 | 200 | — |
| 163 | [Star Fox Adventures (Retail)](https://github.com/zcanann/SFA-Decomp) | GameCube | 87 | 2026-11-12 | 200 | AI |
| 164 | [Animal Crossing (OpenCrossing-Anbernic)](https://github.com/TechProGabe/OpenCrossing-Anbernic) | GameCube | 75 | 2026-10-24 | 200 | — |
| 165 | [The Legend of Zelda: Twilight Princess (dusklight (HayatoG Switch fork))](https://github.com/HayatoG/dusklight) | GameCube | 72 | 2026-07-03 | 200 | — |
| 166 | [Super Monkey Ball](https://github.com/camthesaxman/smb-decomp) | GameCube | 67 | 2023-01-06 | 200 | — |
| 167 | [Pokémon Colosseum (pkmn-colosseum)](https://github.com/dougchansan/pkmn-colosseum) | GameCube | 57 | 2026-11-08 | 200 | — |
| 168 | [Animal Forest e+](https://github.com/ACreTeam/afe-decomp) | GameCube | 56 | 2026-10-24 | 200 | — |
| 169 | [Sonic Adventure DX](https://github.com/doldecomp/sadx) | GameCube | 54 | 2024-08-01 | 200 | — |
| 170 | [Sonic Heroes](https://github.com/Jovinull/sonicheroes) | GameCube | 50 | 2026-11-15 | 200 | — |
| 171 | [Final Fantasy Crystal Chronicles](https://github.com/zcanann/FFCC-Decomp) | GameCube | 48 | 2026-11-18 | 200 | — |
| 172 | [XD: Gale of Darkness](https://github.com/TeamOrre/xd-decomp) | GameCube | 48 | 2026-11-15 | 200 | — |
| 173 | [Super Smash Bros. Melee (Desktop Melee)](https://github.com/Mwrnk/desktop-melee) | GameCube | 44 | 2026-11-08 | 200 | — |
| 174 | [Mario Party 5](https://github.com/mariopartyrd/marioparty5) | GameCube | 43 | 2026-10-31 | 200 | — |
| 175 | [Need for Speed: Underground](https://github.com/dbalatoni13/nfsug) | GameCube | 39 | 2026-02-04 | 200 | — |
| 176 | [Luigi's Mansion](https://github.com/Sage-of-Mirrors/zmansion) | GameCube | 37 | 2023-11-09 | 200 | — |
| 177 | [Ty the Tasmanian Tiger](https://github.com/1superchip/ty-decomp) | GameCube | 37 | 2026-10-08 | 200 | — |
| 178 | [Animal Crossing (OpenCrossing-Xbox)](https://github.com/TechProGabe/OpenCrossing-Xbox) | GameCube | 35 | 2026-10-30 | 200 | — |
| 179 | [Pokémon Colosseum (colosseum-mb)](https://github.com/pret/colosseum-mb) | GameCube | 35 | 2024-03-29 | 200 | — |
| 180 | [Super Mario Strikers (Quest 3 Strikers)](https://github.com/LanceSweatpants/Strikers-Quest-MR) | GameCube | 35 | 2026-11-13 | 200 | — |
| 181 | [Mario Party 7](https://github.com/mariopartyrd/marioparty7) | GameCube | 34 | 2026-06-03 | 200 | — |
| 182 | [Mario Party 6](https://github.com/mariopartyrd/marioparty6) | GameCube | 29 | 2026-10-14 | 200 | — |
| 183 | [Metal Gear Solid: The Twin Snakes](https://github.com/GirianSeed/mgstts) | GameCube | 29 | 2026-06-29 | 200 | — |
| 184 | [The Incredibles](https://github.com/seilc/incredibles) | GameCube | 28 | 2026-11-17 | 200 | — |
| 185 | [Eternal Darkness: Sanity's Requiem (Eternal-Darkness---Decompile)](https://github.com/psdwizzard/Eternal-Darkness---Decompile) | GameCube | 27 | 2026-11-04 | 200 | — |
| 186 | [Star Fox Adventures (Debug)](https://github.com/RenaKunisaki/sfadebug) | GameCube | 27 | 2026-11-18 | 200 | — |
| 187 | [F-Zero GX (karamzov123)](https://github.com/karamzov123/fzero-gx-decomp) | GameCube | 26 | 2026-11-19 | 200 | — |
| 188 | [The Sims 2](https://github.com/natebag/Sims2DECOMP) | GameCube | 26 | 2026-06-10 | 200 | AI |
| 189 | [The SpongeBob SquarePants Movie](https://github.com/bfbbdecomp/tssm) | GameCube | 26 | 2026-10-26 | 200 | — |
| 190 | [Naruto: Gekitō Ninja Taisen! 4](https://github.com/doldecomp/gnt4) | GameCube | 25 | 2022-08-10 | 200 | — |
| 191 | [Luigi's Mansion (lm-decomp)](https://github.com/SomeJakeGuy/lm-decomp) | GameCube | 24 | 2026-11-18 | 200 | — |
| 192 | [Disney Piglet's Big Game](https://github.com/tgsm/pbg) | GameCube | 19 | 2026-10-27 | 200 | — |
| 193 | [Sonic Adventure 2: Battle](https://github.com/roeming/SA2B) | GameCube | 19 | 2026-10-07 | 200 | — |
| 194 | [Tiger Woods PGA Tour 2004](https://github.com/mitsevox/tw2004) | GameCube | 19 | 2026-10-28 | 200 | — |
| 195 | [Crash Tag Team Racing](https://github.com/bluisblu/cttr) | GameCube | 18 | 2026-10-15 | 200 | — |
| 196 | [Hagi (GameCube & Wii emulator from Super Mario 3D All-Stars)](https://github.com/GRAnimated/Hagi) | GameCube | 18 | 2026-05-10 | 200 | — |
| 197 | [Super Mario Sunshine (Super Mario Sunshine (Android))](https://github.com/jbcgames/sms-android) | GameCube | 18 | 2026-10-07 | 200 | — |
| 198 | [Skies of Arcadia Legends](https://github.com/Rainchus/SkiesOfArcadiaLegends) | GameCube | 17 | 2025-05-07 | 200 | — |
| 199 | [Mario Superstar Baseball](https://github.com/roeming/mssb-dtk) | GameCube | 16 | 2026-07-12 | 200 | — |
| 200 | [Sonic Riders: Zero Gravity](https://github.com/KidWizardOfTheWeb/SRZGDecomp) | GameCube | 15 | 2023-06-22 | 200 | — |
| 201 | [Super Mario Sunshine (PS5_Sunshine)](https://github.com/griches/PS5_Sunshine) | GameCube | 14 | 2026-10-14 | 200 | — |
| 202 | [Doshin the Giant](https://github.com/break-core/doshin-gc) | GameCube | 13 | 2025-12-02 | 200 | — |
| 203 | [LEGO Star Wars: The Video Game (lsw1-decomp)](https://github.com/ellierocks767/lsw1-decomp) | GameCube | 13 | 2026-11-13 | 200 | — |
| 204 | [Digimon World 4](https://github.com/ivanno4317/dw4-gc) | GameCube | 12 | 2026-11-12 | 200 | — |
| 205 | [Medal of Honor: Rising Sun (moh-rising-sun)](https://github.com/lifewillbeokay/moh-rising-sun) | GameCube | 12 | 2026-11-14 | 200 | — |
| 206 | [Paper Mario: The Thousand-Year Door (all seven versions)](https://github.com/LLCOOLT/ttyd) | GameCube | 12 | 2026-11-14 | 200 | AI |
| 207 | [Eternal Darkness: Sanity's Requiem](https://github.com/PattyTrish/unending-occlusion) | GameCube | 11 | 2026-10-16 | 200 | — |
| 208 | [The Legend of Zelda: Four Swords Adventures (fsa-decomp)](https://github.com/sh1ftmaker/fsa) | GameCube | 11 | 2026-11-15 | 200 | — |
| 209 | [F-Zero GX (rayanht)](https://github.com/rayanht/fzgx) | GameCube | 10 | 2026-09-16 | 200 | — |
| 210 | [Wario World](https://github.com/sabishii-bit/wwdcmp) | GameCube | 9 | 2025-08-28 | 200 | — |
| 211 | [Nintendo Puzzle Collection: Dr. Mario 64](https://github.com/NewGBAXL/drmario64-gc) | GameCube | 6 | 2026-08-10 | 200 | — |
| 212 | [Chibi-Robo!](https://github.com/eavpsp/cbr_decomp) | GameCube | 3 | 2026-08-12 | 200 | — |
| 213 | [Pokemon Emerald](https://github.com/pret/pokeemerald) | GBA | 3,702 | 2026-11-14 | 200 | — |
| 214 | [Pokemon FireRed](https://github.com/pret/pokefirered) | GBA | 1,721 | 2026-10-20 | 200 | — |
| 215 | [Pokemon Ruby](https://github.com/pret/pokeruby) | GBA | 1,014 | 2026-09-29 | 200 | — |
| 216 | [The Legend of Zelda: The Minish Cap](https://github.com/zeldaret/tmc) | GBA | 939 | 2026-09-27 | 200 | — |
| 217 | [The Legend of Zelda: The Minish Cap (zelda-tmc-3ds)](https://github.com/EstebanPdN/zelda-tmc-3ds) | GBA | 828 | 2026-11-10 | 200 | — |
| 218 | [Sonic Advance 2](https://github.com/SAT-R/sa2) | GBA | 700 | 2026-11-17 | 200 | — |
| 219 | [The Legend of Zelda: The Minish Cap (Project Picori)](https://github.com/999sian/tmc) | GBA | 554 | 2026-10-20 | 200 | AI |
| 220 | [Pokemon MD Red](https://github.com/pret/pmd-red) | GBA | 296 | 2026-10-16 | 200 | — |
| 221 | [Metroid: Zero Mission](https://github.com/metroidret/mzm) | GBA | 163 | 2026-11-16 | 200 | — |
| 222 | [Kirby & The Amazing Mirror](https://github.com/jiangzhengwenjz/katam) | GBA | 162 | 2026-11-16 | 200 | — |
| 223 | [Pokemon Pinball Ruby & Sapphire](https://github.com/pret/pokepinballrs) | GBA | 158 | 2026-10-11 | 200 | — |
| 224 | [Pokémon Emerald (pokeemerald-rogue)](https://github.com/Pokabbie/pokeemerald-rogue) | GBA | 150 | 2026-09-08 | 200 | — |
| 225 | [Sonic Advance 3](https://github.com/SAT-R/sa3) | GBA | 95 | 2026-11-18 | 200 | — |
| 226 | [Mother 3](https://github.com/Kurausukun/mother3) | GBA | 92 | 2026-09-14 | 200 | — |
| 227 | [Kingdom Hearts: Chain of Memories (ReKHCoM)](https://github.com/MatyMeatBoy/ReKHCoM) | GBA | 89 | 2026-11-16 | 200 | AI |
| 228 | [Metroid Fusion](https://github.com/metroidret/mf) | GBA | 83 | 2026-11-16 | 200 | — |
| 229 | [Sonic Advance 1](https://github.com/SAT-R/sa1) | GBA | 77 | 2026-03-28 | 200† | — |
| 230 | [Pokémon Emerald (pokeemerald-multiplatform)](https://github.com/gradenGnostic/pokeemerald-multiplatform) | GBA | 76 | 2026-08-15 | 200 | — |
| 231 | [Pokemon Emerald (JP)](https://github.com/pret/pokeemerald-jp) | GBA | 71 | 2021-10-08 | 200 | — |
| 232 | [Kingdom Hearts: Chain of Memories](https://github.com/Pheenoh/khcom) | GBA | 63 | 2026-10-12 | 200 | — |
| 233 | [Phoenix Wright: Ace Attorney](https://github.com/atasro2/pwaa1) | GBA | 58 | 2026-09-12 | 200 | — |
| 234 | [Harvest Moon: Friends Of Mineral Town](https://github.com/StanHash/fomt) | GBA | 48 | 2026-02-08 | 200 | — |
| 235 | [Fire Emblem: The Binding Blade](https://github.com/StanHash/fe6) | GBA | 47 | 2026-07-11 | 200 | — |
| 236 | [Banjo-Kazooie: Grunty's Revenge](https://github.com/jellees/bkgr) | GBA | 45 | 2026-10-19 | 200 | — |
| 237 | [Mario & Luigi: Superstar Saga](https://github.com/jellees/mlss) | GBA | 45 | 2026-11-19 | 200 | — |
| 238 | [Fire Emblem: The Blazing Blade](https://github.com/MokhaLeee/FireEmblem7J) | GBA | 38 | 2026-11-08 | 200 | — |
| 239 | [Mario Kart: Super Circuit](https://github.com/jellees/mksc) | GBA | 35 | 2024-10-30 | 200 | — |
| 240 | [Mario Kart: Super Circuit (mksc-decompilation)](https://github.com/XOlifreX/mksc-decompilation) | GBA | 33 | 2021-12-28 | 200 | — |
| 241 | [Castlevania: Aria of Sorrow](https://github.com/testyourmine/cvaos) | GBA | 30 | 2026-08-02 | 200 | — |
| 242 | [Mother 1+2 (Japan)](https://github.com/Normmatt/m12) | GBA | 30 | 2026-09-24 | 200 | — |
| 243 | [Tactics Ogre: The Knight of Lodis (totkol)](https://github.com/jiangzhengwenjz/totkol) | GBA | 26 | 2024-01-02 | 200 | — |
| 244 | [Zoids Legacy (ZoidsLegacyDecomp)](https://github.com/jmacato/ZoidsLegacyDecomp) | GBA | 26 | 2026-11-09 | 200 | — |
| 245 | [Crash Bandicoot: XS (The Huge Adventure)](https://github.com/Almamu/CrashBandicootXS-decomp) | GBA | 25 | 2026-10-21 | 200 | — |
| 246 | [Kingdom Hearts: Chain of Memories (KH_COM_VITA)](https://github.com/ggdrn/KH_COM_VITA) | GBA | 20 | 2026-10-17 | 200 | — |
| 247 | [Klonoa: Empire of Dreams (kleod)](https://github.com/testyourmine/kleod) | GBA | 20 | 2026-11-06 | 200 | — |
| 248 | [Kirby: Nightmare in Dream Land (knidl)](https://github.com/overjt/knidl) | GBA | 19 | 2026-10-05 | 200 | — |
| 249 | [Sonic Advance (Sonic GBA (sonicgba))](https://github.com/ImmutableOctet/sonicgba) | GBA | 19 | 2023-04-01 | 200 | — |
| 250 | [Summon Night Swordcraft Story 3](https://github.com/jiangzhengwenjz/csm3) | GBA | 18 | 2024-04-13 | 200 | — |
| 251 | [Klonoa: Empire of Dreams](https://github.com/Dream-Atelier/kl-eod-decomp) | GBA | 17 | 2026-10-05 | 200 | — |
| 252 | [Phoenix Wright: Ace Attorney – Justice for All](https://github.com/atasro2/pwaa2) | GBA | 17 | 2026-09-12 | 200 | — |
| 253 | [Advance Wars 2: Black Hole Rising](https://github.com/Eebit/aw2bhr) | GBA | 16 | 2025-06-11 | 200 | — |
| 254 | [Sonic Battle](https://github.com/cypressru/SonicBattleDecomp) | GBA | 13 | 2026-09-16 | 200 | — |
| 255 | [Wario Land 4](https://github.com/lilDavid/warioland4) | GBA | 13 | 2026-07-17 | 200 | — |
| 256 | [WarioWare, Inc.: Mega Microgames!](https://github.com/ShaffySwitcher/wariowareinc) | GBA | 13 | 2026-10-30 | 200 | — |
| 257 | [Beyblade VForce: Ultimate Blader Jam](https://github.com/marijnvdwerf/gba-beyblade-vforce) | GBA | 9 | 2026-09-24 | 200 | — |
| 258 | [jgenesis](https://github.com/jsgroth/jgenesis) | Genesis | 412 | 2026-11-16 | 200 | — |
| 259 | [Knuckles the Echidna in Sonic the Hedgehog 2 (ktes2)](https://github.com/sonicretro/ktes2) | Genesis | 16 | 2013-12-02 | 200 | — |
| 260 | [QuackShot Starring Donald Duck (quackshot_src)](https://github.com/lab313ru/quackshot_src) | Genesis | 14 | 2019-01-28 | 200 | — |
| 261 | [Sonic the Hedgehog (sonic-j2me-decompilation)](https://github.com/yowari/sonic-j2me-decompilation) | Genesis | 13 | 2025-03-07 | 200 | — |
| 262 | [Shattered Pixel Dungeon](https://github.com/00-Evan/shattered-pixel-dungeon) | Mobile | 6,830 | 2026-10-06 | 200 | — |
| 263 | [Lemuroid](https://github.com/Swordfish90/Lemuroid) | Mobile | 4,527 | 2026-10-16 | 200 | — |
| 264 | [Retro Engine (RSDKv4 (Sonic 1 and 2 Mobile))](https://github.com/RSDKModding/RSDKv4-Decompilation) | Mobile | 1,166 | 2026-10-28 | 200 | — |
| 265 | [Sonic CD](https://github.com/RSDKModding/RSDKv3-Decompilation) | Mobile | 720 | 2026-10-26 | 200 | — |
| 266 | [KEmulator (KEmulator nnmod)](https://github.com/shinovon/KEmulator) | Mobile | 502 | 2026-11-19 | 200 | — |
| 267 | [Sonic Runners](https://github.com/itsmattkc/RunnersDecomp) | Mobile | 244 | 2023-09-06 | 200 | — |
| 268 | [FreeJ2ME-Plus](https://github.com/TASEmulators/freej2me-plus) | Mobile | 224 | 2026-11-18 | 200 | — |
| 269 | [Doom RPG (DoomRPG-RE)](https://github.com/Erick194/DoomRPG-RE) | Mobile | 167 | 2024-04-23 | 200 | — |
| 270 | [Cut the Rope (Cut the Rope: DX)](https://github.com/yell0wsuit/cuttherope-dx) | Mobile | 143 | 2026-10-09 | 200 | — |
| 271 | [Sonic the Hedgehog (2013) (RSDKv4-Script-Decompilation)](https://github.com/RSDKModding/RSDKv4-Script-Decompilation) | Mobile | 140 | 2026-10-24 | 200 | — |
| 272 | [Doom II RPG (DoomIIRPG-RE)](https://github.com/Erick194/DoomIIRPG-RE) | Mobile | 104 | 2025-07-09 | 200 | — |
| 273 | [Geometry Dash (gdp)](https://github.com/camila314/gdp) | Mobile | 74 | 2025-09-24 | 200 | — |
| 274 | [Angry Birds](https://github.com/jooapa/Angry_Birds_Decompilation) | Mobile | 58 | 2024-07-05 | 200 | — |
| 275 | [Wolfenstein RPG (WolfensteinRPG-RE)](https://github.com/Erick194/WolfensteinRPG-RE) | Mobile | 58 | 2026-11-01 | 200 | — |
| 276 | [Bounce Tales](https://github.com/HelloOO7/BounceTales) | Mobile | 54 | 2023-02-07 | 200 | — |
| 277 | [Geometry Dash](https://github.com/aloaf812/GD) | Mobile | 44 | 2026-10-29 | 200 | — |
| 278 | [Sonic the Hedgehog (J2ME)](https://github.com/Iso-Kilo/Sonic-1-J2ME-Decompilation) | Mobile | 36 | 2021-02-19 | 200 | — |
| 279 | [Diamond Rush (DiamondRushSource)](https://github.com/kubikaugustyn/DiamondRushSource) | Mobile | 27 | 2025-06-07 | 200 | — |
| 280 | [Bounce (nokia-bounce-decomp)](https://github.com/rndtrash/nokia-bounce-decomp) | Mobile | 19 | 2023-04-02 | 200 | — |
| 281 | [Dragon Ball Legends](https://github.com/GodkuHacking/Dragon-Ball-Legends) | Mobile | 17 | 2024-05-09 | 200 | — |
| 282 | [Minecraft: Pocket Edition](https://github.com/BrentDaMage/mcpe-engine) | Mobile | 17 | 2026-02-11 | 200 | — |
| 283 | [SpongeBob Moves In!](https://github.com/Juanen100/SBMI-Decomp) | Mobile | 17 | 2026-09-01 | 200 | — |
| 284 | [Brave Frontier](https://github.com/decompfrontier/client) | Mobile | 16 | 2025-05-30 | 200 | — |
| 285 | [Diamond Rush](https://github.com/palaceswitcher/Diamond-Rush-Decomp) | Mobile | 15 | 2026-11-16 | 200 | — |
| 286 | [Flappy Bird](https://github.com/fr3dsp/FlappyBird-Decomp) | Mobile | 4 | 2025-10-28 | 200 | — |
| 287 | [Sonic the Hedgehog 4 (Ep 1)](https://github.com/fr3dsp/Sonic4Ep1-Decomp) | Mobile | 4 | 2025-10-28 | 200 | — |
| 288 | [Ancient Empires](https://github.com/Atomk/ancient-empires-1-decompilation) | Mobile | 2 | 2024-12-05 | 200 | — |
| 289 | [Super Mario 64](https://github.com/n64decomp/sm64) | N64 | 8,985 | 2023-08-17 | 200 | — |
| 290 | [The Legend of Zelda: Ocarina of Time (Ship of Harkinian)](https://github.com/HarbourMasters/Shipwright) | N64 | 6,107 | 2026-11-19 | 200 | AI |
| 291 | [The Legend of Zelda: Ocarina of Time](https://github.com/zeldaret/oot) | N64 | 5,763 | 2026-10-18 | 200 | — |
| 292 | [The Legend of Zelda: Majora's Mask (2 Ship 2 Harkinian)](https://github.com/2ship2harkinian/2ship2harkinian) | N64 | 2,494 | 2026-11-18 | 200 | — |
| 293 | [Star Fox 64 (Starship)](https://github.com/HarbourMasters/Starship) | N64 | 2,150 | 2026-09-15 | 200 | — |
| 294 | [The Legend of Zelda: Majora's Mask](https://github.com/zeldaret/mm) | N64 | 1,792 | 2026-11-04 | 200 | — |
| 295 | [Paper Mario](https://github.com/pmret/papermario) | N64 | 1,636 | 2026-10-23 | 200 | — |
| 296 | [Super Mario 64 (sm64coopdx)](https://github.com/coop-deluxe/sm64coopdx) | N64 | 1,553 | 2026-06-01 | 200 | — |
| 297 | [Mario Kart 64](https://github.com/n64decomp/mk64) | N64 | 1,317 | 2026-08-12 | 200 | — |
| 298 | [Perfect Dark (perfect_dark decomp)](https://github.com/n64decomp/perfect_dark) | N64 | 885 | 2025-03-14 | 200 | — |
| 299 | [GoldenEye 007 (007 decomp)](https://github.com/n64decomp/007) | N64 | 814 | 2026-08-17 | 200 | — |
| 300 | [Banjo-Kazooie (banjo-kazooie (banjo.decomp))](https://github.com/n64decomp/banjo-kazooie) | N64 | 659 | 2026-11-08 | 200 | — |
| 301 | [Paper Mario 64 (PaperBoat)](https://github.com/HarbourMasters/PaperBoat) | N64 | 569 | 2026-11-09 | 200 | — |
| 302 | [Banjo-Kazooie (Lighthouse)](https://github.com/HarbourMasters/Lighthouse) | N64 | 564 | 2026-11-16 | 200 | — |
| 303 | [Super Smash Bros. (BattleShip)](https://github.com/JRickey/BattleShip) | N64 | 541 | 2026-11-18 | 200 | AI |
| 304 | [GoldenEye 007 (Project Midas)](https://github.com/murkantor/Project-Midas) | N64 | 443 | 2026-11-08 | 200 | AI |
| 305 | [Diddy Kong Racing](https://github.com/DavidSM64/Diddy-Kong-Racing) | N64 | 425 | 2026-10-01 | 200 | — |
| 306 | [Star Fox 64](https://github.com/sonicdcer/sf64) | N64 | 357 | 2026-11-17 | 200 | — |
| 307 | [F-Zero X (G-Diffuser)](https://github.com/Zorkats/G-Diffuser) | N64 | 332 | 2026-11-19 | 200 | AI |
| 308 | [Animal Forest](https://github.com/zeldaret/af) | N64 | 304 | 2026-08-16 | 200 | — |
| 309 | [Duke Nukem: Zero Hour](https://github.com/Gillou68310/DukeNukemZeroHour) | N64 | 280 | 2025-11-06 | 200 | — |
| 310 | [Super Smash Bros.](https://github.com/VetriTheRetri/ssb-decomp-re) | N64 | 275 | 2026-10-20 | 200 | — |
| 311 | [Mario Kart 64 (mario-kart-64-3ds)](https://github.com/EstebanPdN/mario-kart-64-3ds) | N64 | 260 | 2026-11-10 | 200 | — |
| 312 | [Conker's Bad Fur Day](https://github.com/mkst/conker) | N64 | 240 | 2026-05-10 | 200† | — |
| 313 | [Doom 64](https://github.com/Erick194/DOOM64-RE) | N64 | 239 | 2025-05-30 | 200 | — |
| 314 | [Kirby 64: The Crystal Shards](https://github.com/Kirby64Ret/kirby64) | N64 | 237 | 2026-10-30 | 200 | — |
| 315 | [Harvest Moon 64](https://github.com/harvestwhisperer/hm64-decomp) | N64 | 224 | 2026-10-14 | 200 | — |
| 316 | [Dinosaur Planet](https://github.com/zestydevy/dinosaur-planet) | N64 | 217 | 2026-11-18 | 200 | — |
| 317 | [Snowboard Kids 2](https://github.com/cdlewis/snowboardkids2-decomp) | N64 | 199 | 2026-10-23 | 200 | — |
| 318 | [Diddy Kong Racing (Golden Balloon)](https://github.com/akratch/goldenballoon) | N64 | 197 | 2026-10-13 | 200 | AI |
| 319 | [RMG-K](https://github.com/Jay-Day/RMG-K) | N64 | 189 | 2026-11-06 | 200 | AI |
| 320 | [Banjo-Tooie](https://github.com/Mr-Wiseguy/banjo-tooie) | N64 | 158 | 2026-11-08 | 200 | — |
| 321 | [Gamecube Nintendo 64 Emulator](https://github.com/zeldaret/oot-gc) | N64 | 150 | 2025-05-24 | 200 | — |
| 322 | [Paper Mario (papermario-dx (engine fork))](https://github.com/bates64/papermario-dx) | N64 | 125 | 2026-11-07 | 200 | — |
| 323 | [Pokemon Snap](https://github.com/ethteck/pokemonsnap) | N64 | 113 | 2026-10-25 | 200 | — |
| 324 | [Wave Race 64](https://github.com/LLONSIT/Wave-Race-64) | N64 | 112 | 2026-09-26 | 200 | — |
| 325 | [F-Zero X](https://github.com/inspectredc/fzerox) | N64 | 111 | 2026-09-17 | 200 | — |
| 326 | [2 Ship 2 Harkinian (2 Ship 2 Harkinian [Android])](https://github.com/linkzenic/2ship2harkinian-Android) | N64 | 101 | 2026-10-23 | 200 | — |
| 327 | [Pilotwings 64 (Pilotwings64Decomp (gcsmith))](https://github.com/n64decomp/pw64) | N64 | 86 | 2026-11-10 | 200 | — |
| 328 | [Mario Party 1](https://github.com/mariopartyrd/marioparty) | N64 | 84 | 2026-06-28 | 200 | — |
| 329 | [Yoshi's Story](https://github.com/decompals/yoshis-story) | N64 | 83 | 2026-04-19 | 200 | — |
| 330 | [Dr. Mario 64](https://github.com/AngheloAlf/drmario64) | N64 | 82 | 2026-08-13 | 200 | — |
| 331 | [Mario Party 3](https://github.com/mariopartyrd/marioparty3) | N64 | 77 | 2026-10-23 | 200 | — |
| 332 | [Mischief Makers](https://github.com/Drahsid/mischief-makers) | N64 | 73 | 2026-11-18 | 200 | — |
| 333 | [Mario Kart 64 (mk64-dc)](https://github.com/jnmartin84/mk64-dc) | N64 | 72 | 2026-08-24 | 200 | — |
| 334 | [Castlevania 64](https://github.com/k64ret/cv64) | N64 | 68 | 2025-09-08 | 200 | — |
| 335 | [Space Station Silicon Valley](https://github.com/mkst/sssv) | N64 | 67 | 2026-11-19 | 200 | — |
| 336 | [Bomberman Hero](https://github.com/Bomberhackers/bmhero) | N64 | 65 | 2026-04-24 | 200 | — |
| 337 | [Jet Force Gemini](https://github.com/Ryan-Myers/Jet-Force-Gemini) | N64 | 58 | 2026-09-02 | 200 | — |
| 338 | [Snowboard Kids (snowboardkids-decomp (cdlewis))](https://github.com/cdlewis/snowboardkids-decomp) | N64 | 58 | 2026-10-31 | 200 | — |
| 339 | [Mario Party 2](https://github.com/mariopartyrd/marioparty2) | N64 | 57 | 2026-04-26 | 200 | — |
| 340 | [F-Zero X (gdx-3ds)](https://github.com/cruxxxxxx/gdx-3ds) | N64 | 56 | 2026-11-04 | 200 | — |
| 341 | [Pilotwings 64 (Birdman64)](https://github.com/NoahVl/Birdman64) | N64 | 52 | 2026-10-25 | 200 | AI |
| 342 | [Star Fox 64 (sf64-dc)](https://github.com/jnmartin84/sf64-dc) | N64 | 51 | 2026-08-24 | 200 | — |
| 343 | [Body Harvest](https://github.com/jaytheham/body-harvest-decompilation) | N64 | 46 | 2026-11-19 | 200 | AI |
| 344 | [Rocket: Robot on Wheels](https://github.com/RocketRet/Rocket-Robot-On-Wheels) | N64 | 46 | 2023-01-15 | 200 | — |
| 345 | [Aidyn Chronicles: The First Mage](https://github.com/blackgamma7/Aidyn) | N64 | 44 | 2026-10-26 | 200 | — |
| 346 | [Blast Corps](https://github.com/retroplastic/blastcorps) | N64 | 44 | 2021-12-28 | 200 | — |
| 347 | [F-Zero X](https://github.com/BttrDrgn/f-zerox) | N64 | 42 | 2023-05-23 | 200 | — |
| 348 | [Pokémon Stadium (pokemonstadium)](https://github.com/ethteck/pokemonstadium) | N64 | 42 | 2021-10-17 | 200 | — |
| 349 | [Quest 64](https://github.com/Mallos31/Quest) | N64 | 39 | 2023-11-22 | 200 | — |
| 350 | [Neon Genesis Evangelion 64](https://github.com/farisawan-2000/evangelion) | N64 | 38 | 2025-07-13 | 200 | — |
| 351 | [Bomberman 64](https://github.com/Bomberhackers/bm64) | N64 | 36 | 2026-03-08 | 200 | — |
| 352 | [Conker's Bad Fur Day (DevOldSchool)](https://github.com/DevOldSchool/conkers-bfd-decomp) | N64 | 36 | 2026-11-19 | 200 | — |
| 353 | [AeroGauge](https://github.com/LLONSIT/AeroGauge) | N64 | 32 | 2026-01-23 | 200 | — |
| 354 | [F-Zero X Expansion Kit](https://github.com/inspectredc/fzerox-expansion-kit) | N64 | 31 | 2026-01-06 | 200 | — |
| 355 | [The Legend of Zelda: Ocarina of Time (oot-dc)](https://github.com/jnmartin84/oot-dc) | N64 | 30 | 2026-09-11 | 200 | — |
| 356 | [Virtual Pro Wrestling 2: Ōdō Keishō](https://github.com/AKI-Club/vpw2) | N64 | 30 | 2026-11-18 | 200 | — |
| 357 | [Paper Mario (PaperMarioDecompilation)](https://github.com/RetroReversing/PaperMarioDecompilation) | N64 | 27 | 2022-06-12 | 200 | — |
| 358 | [Mario Golf](https://github.com/monde-lointain/mariogolf64) | N64 | 26 | 2026-06-29 | 200 | — |
| 359 | [Blast Corps](https://github.com/SlaveOfIDO/blastcorps) | N64 | 23 | 2026-10-22 | 200 | — |
| 360 | [Star Wars: Shadows of the Empire](https://github.com/EltaleLibrarian/SotE) | N64 | 23 | 2025-02-10 | 200 | — |
| 361 | [Star Wars: Rogue Squadron](https://github.com/Tmcg2/rogue_squadron64) | N64 | 22 | 2026-11-12 | 200 | — |
| 362 | [Super Mario 64 (sm64-decomp)](https://github.com/justinwash/sm64-decomp) | N64 | 22 | 2019-07-12 | 200 | — |
| 363 | [Superman 64](https://github.com/farisawan-2000/superman) | N64 | 22 | 2021-04-17 | 200 | — |
| 364 | [1080° Snowboarding](https://github.com/djsaunde/1080-decomp) | N64 | 19 | 2026-11-19 | 200 | — |
| 365 | [Beetle Adventure Racing!](https://github.com/synamaxmusic/bar-decomp) | N64 | 19 | 2026-11-17 | 200 | — |
| 366 | [Duke Nukem 64](https://github.com/NBlood/Duke64-RE) | N64 | 19 | 2025-08-04 | 200 | — |
| 367 | [Quest 64](https://github.com/Rainchus/Quest64-Decomp) | N64 | 18 | 2026-02-03 | 200 | — |
| 368 | [Bomberman 64: The Second Attack!](https://github.com/Bomberhackers/bm64tsa) | N64 | 15 | 2026-04-04 | 200 | — |
| 369 | [Chameleon Twist](https://github.com/chameleonTwistRet/chameleonTwistv1.0-JP) | N64 | 13 | 2026-09-26 | 200 | — |
| 370 | [Turok 2: Seeds of Evil (turok2-decomp (mgrz18))](https://github.com/mgrz18/turok2-decomp) | N64 | 13 | 2026-11-18 | 200 | — |
| 371 | [Glover](https://github.com/Rainchus/Glover) | N64 | 12 | 2024-07-28 | 200 | — |
| 372 | [Mario Tennis](https://github.com/DellM-79/MarioTennisN64) | N64 | 12 | 2024-04-05 | 200 | — |
| 373 | [Mystical Ninja Starring Goemon](https://github.com/klorfmorf/mnsg) | N64 | 12 | 2026-11-14 | 200 | — |
| 374 | [Conker's Bad Fur Day](https://github.com/gipson-dev/64CBFD) | N64 | 11 | 2026-11-19 | 200 | — |
| 375 | [Hey You, Pikachu!](https://github.com/farisawan-2000/hey_you_pikachu) | N64 | 11 | 2022-04-13 | 200 | — |
| 376 | [BattleTanx](https://github.com/TheGh0stShip/BattleTanx) | N64 | 10 | 2026-10-30 | 200 | — |
| 377 | [Turok: Rage Wars (Turok-Rage-Wars-Decomp (thejunkman9000))](https://github.com/JohnSams165/Turok-Rage-Wars-Decomp) | N64 | 10 | 2026-11-16 | 200 | — |
| 378 | [Rugrats: Scavenger Hunt](https://github.com/TheGh0stShip/Rugrats-Scavenger-Hunt) | N64 | 9 | 2026-10-26 | 200 | — |
| 379 | [Wonder Project J2: Josette of the Corlo Forest](https://github.com/LLONSIT-glitch/wonder) | N64 | 9 | 2026-09-03 | 200 | — |
| 380 | [BattleTanx: Global Assault](https://github.com/TheGh0stShip/BattleTanx-Global-Assault) | N64 | 8 | 2026-10-30 | 200 | — |
| 381 | [Knife Edge - Nose Gunner](https://github.com/disi33/KE-NG_Reversing) | N64 | 7 | 2021-04-01 | 200 | — |
| 382 | [Nagano Winter Olympics '98](https://github.com/TheGh0stShip/Nagano-Winter-Olympics-98-N64) | N64 | 5 | 2026-10-30 | 200 | — |
| 383 | [Ridge Racer 64](https://github.com/jvicu2001/rr64-decomp) | N64 | 4 | 2025-07-26 | 200 | — |
| 384 | [Goemon’s Great Adventure](https://github.com/PandaPandel/Goemons-Great-Adventure-Decomp) | N64 | 1 | 2026-10-26 | 200 | — |
| 385 | [Banjo-Kazooie](https://gitlab.com/banjo.decomp/banjo-kazooie) | N64 | — | — | 200 | — |
| 386 | [Donkey Kong 64](https://gitlab.com/dk64_decomp/dk64) | N64 | — | — | 200 | — |
| 387 | [GoldenEye 007](https://gitlab.com/kholdfuzion/goldeneye_src) | N64 | — | — | 200 | — |
| 388 | [Perfect Dark](https://gitlab.com/ryandwyer/perfect-dark) | N64 | — | — | 200 | — |
| 389 | [Nestopia](https://github.com/0ldsk00l/nestopia) | NES | 956 | 2026-09-13 | 200 | — |
| 390 | [Super Mario Bros. 2 (smb2)](https://github.com/Xkeeper0/smb2) | NES | 105 | 2023-02-21 | 200 | — |
| 391 | [Super Mario Bros. (SMB-Vanilla)](https://github.com/nukep/SMB-Vanilla) | NES | 68 | 2026-10-07 | 200 | — |
| 392 | [Ghosts And Graves](https://github.com/AnthonyBongers/GhostsAndGraves) | NES | 21 | 2025-11-22 | 200 | — |
| 393 | [Earthbound Beginnings](https://github.com/GrasonHumphrey/Earthbound-Zero-Decomp) | NES | 8 | 2025-09-24 | 200 | — |
| 394 | [xbased](https://github.com/crazyriddler/xbased) | og xbox | 259 | 2026-11-18 | 200 | — |
| 395 | [Legends of Future Past (lofp)](https://github.com/metavert-io/lofp) | Other | 186 | 2026-10-17 | 200 | AI |
| 396 | [3D Pinball Space Cadet](https://github.com/k4zmu2a/SpaceCadetPinball) | PC | 4,801 | 2024-08-21 | 200 | — |
| 397 | [Lego Island](https://github.com/isledecomp/isle) | PC | 3,504 | 2026-11-15 | 200 | — |
| 398 | [Touhou PC-98](https://github.com/nmlgc/ReC98) | PC | 889 | 2026-03-16 | 200 | — |
| 399 | [Half-Life (ReHLDS)](https://github.com/rehlds/ReHLDS) | PC | 882 | 2026-11-16 | 200 | — |
| 400 | [Adventure Game Studio (AGS Engine)](https://github.com/adventuregamestudio/ags) | PC | 867 | 2026-11-17 | 200 | AI |
| 401 | [Sonic Mania](https://github.com/RSDKModding/Sonic-Mania-Decompilation) | PC | 838 | 2026-05-12 | 200 | — |
| 402 | [Counter-Strike (ReGameDLL_CS)](https://github.com/rehlds/ReGameDLL_CS) | PC | 815 | 2026-11-11 | 200 | — |
| 403 | [namDHC](https://github.com/umageddon/namDHC) | PC | 668 | 2026-04-05 | 200 | — |
| 404 | [Touhou 6: The Embodiment of Scarlet Devil (th06)](https://github.com/GensokyoClub/th06) | PC | 634 | 2026-11-19 | 200 | — |
| 405 | [Legend of Dragoon](https://github.com/Legend-of-Dragoon-Modding/Severed-Chains) | PC | 594 | 2026-11-18 | 200 | — |
| 406 | [Sonic Mania (RSDKv5-Decompilation)](https://github.com/RSDKModding/RSDKv5-Decompilation) | PC | 580 | 2026-10-03 | 200 | — |
| 407 | [Fallout: New Vegas (FNV decompilation)](https://github.com/momusdigital/fnv_decomp) | PC | 524 | 2026-11-19 | 200 | — |
| 408 | [Command & Conquer: Red Alert 2 (Phobos)](https://github.com/Phobos-developers/Phobos) | PC | 507 | 2026-11-19 | 200 | — |
| 409 | [Counter-Strike (bunnyhop.lol)](https://github.com/FWGS/cs16-client) | PC | 506 | 2026-11-17 | 200 | — |
| 410 | [Fallout 2](https://github.com/alexbatalov/fallout2-re) | PC | 413 | 2023-01-20 | 200 | — |
| 411 | [Command & Conquer: Red Alert 2 – Yuri's Revenge](https://github.com/YuriPlanet/vera20k) | PC | 399 | 2026-11-19 | 200 | AI |
| 412 | [Tomb Raider: The Last Revelation (TombEngine (TEN))](https://github.com/TombEngine/TombEngine) | PC | 353 | 2026-11-08 | 200 | — |
| 413 | [Deus Ex: Human Revolution](https://github.com/rrika/cdcEngineDXHR) | PC | 332 | 2026-10-28 | 200 | — |
| 414 | [Need for Speed: Most Wanted](https://github.com/dbalatoni13/nfsmw) | PC | 258 | 2026-10-10 | 200 | — |
| 415 | [Plants vs Zombies GOTY](https://github.com/Patoke/re-plants-vs-zombies) | PC | 249 | 2026-07-11 | 200 | — |
| 416 | [RuneScape (2006scape)](https://github.com/2006-Scape/2006Scape) | PC | 249 | 2026-11-15 | 200 | — |
| 417 | [3D Maze](https://github.com/x86matthew/Playable3DMaze) | PC | 215 | 2025-02-17 | 200 | — |
| 418 | [Colin McRae Rally 2.0 (OpenCMR2)](https://github.com/pablocpas/OpenCMR2) | PC | 215 | 2026-11-15 | 200 | AI |
| 419 | [Cave Story](https://github.com/gameblabla/CSE2) | PC | 205 | 2026-03-12 | 200 | — |
| 420 | [Duck Game](https://github.com/TheFlyingFoool/DuckGameRebuilt) | PC | 203 | 2026-11-13 | 200 | AI |
| 421 | [Arcanum: Of Steamworks and Magick Obscura (Arcanum Community Edition)](https://github.com/alexbatalov/arcanum-ce) | PC | 186 | 2026-05-13 | 200 | — |
| 422 | [Ultima Online (OUO)](https://github.com/draxinar/ouo) | PC | 177 | 2026-11-12 | 200 | — |
| 423 | [Command & Conquer: Red Alert 2 (Ares)](https://github.com/Ares-Developers/Ares) | PC | 170 | 2016-01-02 | 200 | — |
| 424 | [Roblox (OpenRBX)](https://github.com/OpenRBX-org/OpenRBX) | PC | 159 | 2026-11-17 | 200 | — |
| 425 | [San Andreas Multiplayer (SA-MP)](https://github.com/dashr9230/SA-MP) | PC | 156 | 2026-10-10 | 200 | — |
| 426 | [Neverwinter Nights: Enhanced Edition (NWNX:EE unified)](https://github.com/nwnxee/unified) | PC | 152 | 2026-11-19 | 200 | — |
| 427 | [Minesweeper (ReversingMinesweeper)](https://github.com/repnz/ReversingMinesweeper) | PC | 147 | 2019-06-25 | 200 | — |
| 428 | [Raptor: Call of the Shadows](https://github.com/skynettx/raptor) | PC | 141 | 2026-09-28 | 200 | — |
| 429 | [Urban Assault (UA_source)](https://github.com/Marisa-Chan/UA_source) | PC | 141 | 2025-03-11 | 200 | — |
| 430 | [Sonic CD (RSDKv3-Script-Decompilation)](https://github.com/RSDKModding/RSDKv3-Script-Decompilation) | PC | 140 | 2026-08-13 | 200 | — |
| 431 | [Black and White](https://github.com/openblack/bw1-decomp) | PC | 133 | 2026-11-19 | 200 | — |
| 432 | [Plants vs. Zombies (PlantsVsZombies-decompilation)](https://github.com/ruslan831/PlantsVsZombies-decompilation) | PC | 127 | 2026-09-19 | 200 | — |
| 433 | [The Operative: No One Lives Forever (nolfsrc)](https://github.com/nolffan/nolfsrc) | PC | 121 | 2026-11-16 | 200 | AI |
| 434 | [Tomb Raider III (tomb3)](https://github.com/Trxyebeep/tomb3) | PC | 119 | 2023-09-03 | 200 | — |
| 435 | [LEGO Racers](https://github.com/isledecomp/racers) | PC | 112 | 2026-11-13 | 200 | — |
| 436 | [Temple of Elemental Evil (Temple Plus)](https://github.com/GrognardsFromHell/TemplePlus) | PC | 111 | 2026-02-23 | 200 | — |
| 437 | [Magic: The Gathering – Shandalar (Shandalar (patched))](https://github.com/ShandalarMagic/Shandalar) | PC | 108 | 2021-09-03 | 200 | — |
| 438 | [Zuma Deluxe](https://github.com/alula/CircleShootApp) | PC | 106 | 2025-12-06 | 200 | — |
| 439 | [Space Rangers HD: A War Apart (SpaceRangersHD_FPC)](https://github.com/pakompom/SpaceRangersHD_FPC) | PC | 105 | 2026-10-15 | 200 | — |
| 440 | [DX-Ball (dx-ball (REA showcase))](https://github.com/N0zoM1z0/dx-ball) | PC | 104 | 2026-11-10 | 200 | AI |
| 441 | [Baldur's Gate: Enhanced Edition (EEex)](https://github.com/Bubb13/EEex) | PC | 102 | 2026-10-07 | 200 | — |
| 442 | [Medieval II: Total War (M2TWEOP)](https://github.com/EOP-Labs/M2TWEOP-library) | PC | 102 | 2026-10-19 | 200 | — |
| 443 | [Tomb Raider: The Last Revelation (TOMB4)](https://github.com/Trxyebeep/TOMB4) | PC | 99 | 2023-09-03 | 200 | — |
| 444 | [Command & Conquer: Tiberian Sun (Vinifera)](https://github.com/Vinifera-Developers/Vinifera) | PC | 98 | 2026-10-18 | 200 | — |
| 445 | [Tomb Raider Chronicles (TOMB5)](https://github.com/Trxyebeep/TOMB5) | PC | 97 | 2023-09-03 | 200 | — |
| 446 | [Icewind Dale II (iwd2-re)](https://github.com/alexbatalov/iwd2-re) | PC | 92 | 2023-12-29 | 200 | — |
| 447 | [Star Wars Episode 1: Racer](https://github.com/tim-tim707/SW_RACER_RE) | PC | 90 | 2026-11-16 | 200 | — |
| 448 | [Stronghold Crusader (Unofficial Crusader Patch)](https://github.com/UnofficialCrusaderPatch/UnofficialCrusaderPatch) | PC | 88 | 2026-09-11 | 200 | — |
| 449 | [Torchlight (Torchlight Rekindled)](https://github.com/GreenSwampDweller/torchlight-rekindled) | PC | 87 | 2026-11-17 | 200 | — |
| 450 | [Indiana Jones and the Infernal Machine (OpenJones3D)](https://github.com/smlu/OpenJones3D) | PC | 77 | 2025-07-08 | 200 | — |
| 451 | [Hitman: Codename 47 (ReHitman)](https://github.com/ReGlacier/ReHitman) | PC | 74 | 2026-05-23 | 200 | — |
| 452 | [SkiFree](https://github.com/yuv422/skifree_decomp) | PC | 72 | 2022-12-08 | 200 | — |
| 453 | [Terraria](https://github.com/PPrism/TerrariaOGC) | PC | 71 | 2026-05-27 | 200 | — |
| 454 | [Half-Life (half-life1_win32_722)](https://github.com/ScriptedSnark/half-life1_win32_722) | PC | 69 | 2026-08-02 | 200 | — |
| 455 | [Wolfenstein 3D (ECWolf)](https://github.com/ECWolfEngine/ECWolf) | PC | 66 | 2026-11-08 | 200 | — |
| 456 | [Space Rangers HD: A War Apart](https://github.com/pakompom/SpaceRangersHD_decomp) | PC | 65 | 2026-10-16 | 200 | — |
| 457 | [Touhou 7: Perfect Cherry Blossom (th07)](https://github.com/some100/th07) | PC | 64 | 2026-10-07 | 200 | — |
| 458 | [Mirror's Edge (Glassline)](https://github.com/MoonCellar-Team/Glassline) | PC | 62 | 2026-10-30 | 200 | AI |
| 459 | [Peggle Deluxe (Thunderball)](https://github.com/teampopwork/Thunderball) | PC | 61 | 2026-10-31 | 200 | — |
| 460 | [Severance: Blade of Darkness (BldMystery)](https://github.com/smartblade/BldMystery) | PC | 60 | 2026-11-19 | 200 | — |
| 461 | [OutRun 2006: Coast 2 Coast (outrun2-decomp)](https://github.com/r4dius/outrun2-decomp) | PC | 59 | 2026-10-07 | 200 | — |
| 462 | [Retro-Sonic Engine v2 (RSDKv2 (Sonic Nexus))](https://github.com/RSDKModding/RSDKv2-Decompilation) | PC | 58 | 2026-07-01 | 200 | — |
| 463 | [Total Annihilation (TA: Byte Tactics)](https://github.com/HectorBailey/byte-tactics) | PC | 58 | 2026-11-14 | 200 | — |
| 464 | [Total Overdose (TOD_tools)](https://github.com/Michael0ne/TOD_tools) | PC | 58 | 2024-08-14 | 200 | — |
| 465 | [Touhou 8: Imperishable Night (th08)](https://github.com/N0zoM1z0/th08) | PC | 57 | 2026-11-10 | 200 | AI |
| 466 | [Ballance (Ballanced)](https://github.com/doyaGu/Ballanced) | PC | 53 | 2026-11-14 | 200 | — |
| 467 | [Mafia: The City of Lost Heaven](https://github.com/Marvisak/mafia-re) | PC | 52 | 2026-11-17 | 200 | — |
| 468 | [Buckshot Roulette](https://github.com/uncreativeCultist/buckshot-decomp-public) | PC | 51 | 2025-05-12 | 200 | — |
| 469 | [Half-Life (halflife_dc)](https://github.com/maximqaxd/halflife_dc) | PC | 51 | 2026-09-16 | 200 | — |
| 470 | [Command & Conquer: Tiberian Sun (ts-patches)](https://github.com/CnCNet/ts-patches) | PC | 50 | 2026-08-20 | 200 | — |
| 471 | [Touhou 6: The Embodiment of Scarlet Devil (th06-sdl2)](https://github.com/CNTianQi233/th06-sdl2) | PC | 50 | 2026-05-13 | 200 | — |
| 472 | [FlatOut 2](https://github.com/ZackWilde27/FlatOut-2-decomp) | PC | 49 | 2025-10-16 | 200 | — |
| 473 | [Jurassic Park: Operation Genesis](https://github.com/AdventureT/OpenJPOG) | PC | 49 | 2026-01-20 | 200 | — |
| 474 | [Age of Wonders (aow-patch)](https://github.com/int19h/aow-patch) | PC | 45 | 2022-12-14 | 200 | — |
| 475 | [M.U.G.E.N 1.1 Beta 1 (mugen-unleashed)](https://github.com/zxmarcos/mugen-unleashed) | PC | 43 | 2026-10-23 | 200 | AI |
| 476 | [Touhou 6: The Embodiment of Scarlet Devil (EoSDecomp)](https://github.com/wearrrrr/EoSDecomp) | PC | 42 | 2023-11-10 | 200 | — |
| 477 | [Fallout: New Vegas (fnv)](https://github.com/ieee802dot11ac/fnv) | PC | 40 | 2026-08-30 | 200 | — |
| 478 | [Icewind Dale II (iwd2r (Icewind Dale 2 Resurrected))](https://github.com/thierbig/iwd2r) | PC | 40 | 2026-11-17 | 200 | — |
| 479 | [MapleStory (shroom95-decomp)](https://github.com/jon-zu/shroom95-decomp) | PC | 39 | 2025-07-11 | 200 | — |
| 480 | [LEGO Racers (racers-portable)](https://github.com/isledecomp/racers-portable) | PC | 38 | 2026-10-26 | 200 | — |
| 481 | [Sonic R (Sonic R Android)](https://github.com/ZinexDa/sonic-r-android) | PC | 35 | 2026-10-20 | 200 | AI |
| 482 | [Carmageddon 2](https://github.com/Link4Electronics/Carpocalypse2) | PC | 33 | 2026-11-15 | 200 | AI |
| 483 | [FUEL](https://github.com/widberg/FUELDecompilation) | PC | 33 | 2026-03-14 | 200 | — |
| 484 | [Nocturne](https://github.com/NearlyTRex/NocturneDecomp) | PC | 32 | 2026-11-18 | 200 | AI |
| 485 | [Touhou 08: Imperishable Night](https://github.com/GensokyoClub/th08) | PC | 32 | 2026-10-06 | 200 | — |
| 486 | [Heroes of Might and Magic III (homm3-decomp)](https://github.com/sushi-shi/homm3-decomp) | PC | 30 | 2026-11-05 | 200 | — |
| 487 | [Aliens versus Predator 2 (AVP2-Reconstructed)](https://github.com/lemiur/AVP2-Reconstructed) | PC | 29 | 2026-11-06 | 200 | — |
| 488 | [Insaniquarium Deluxe (WinFish)](https://github.com/Vindirect/WinFish) | PC | 29 | 2026-10-08 | 200 | — |
| 489 | [Pizza Tower (Pizza-Tower-EXtracted)](https://github.com/setupwitch/Pizza-Tower-EXtracted) | PC | 28 | 2026-11-14 | 200 | — |
| 490 | [Fortnite (OT6-Reconstruction)](https://github.com/ApfelTeeSaft/OT6-Reconstruction) | PC | 27 | 2026-01-08 | 200 | — |
| 491 | [Burnout Paradise (b5-decomp)](https://github.com/BurnoutDecomp/b5-decomp) | PC | 25 | 2026-11-09 | 200 | AI |
| 492 | [Boss Rally](https://github.com/jeff-strutb/brally) | PC | 24 | 2026-11-14 | 200 | — |
| 493 | [Indiana Jones and the Infernal Machine (infernal-machine-decomp)](https://github.com/andrewspode/infernal-machine-decomp-public) | PC | 24 | 2026-10-20 | 200 | AI |
| 494 | [Project I.G.I.: I'm Going In (IGI-RE)](https://github.com/neonixmoddingteam/IGI-RE) | PC | 24 | 2026-10-26 | 200 | AI |
| 495 | [Tomb Raider: Legend](https://github.com/TheIndra55/cdcEngine) | PC | 24 | 2024-12-24 | 200 | — |
| 496 | [Oregon Trail II](https://github.com/katstasaph/otii) | PC | 23 | 2025-08-01 | 200 | — |
| 497 | [Psychonauts (psychonauts-decomp)](https://github.com/DrDecki/psychonauts-decomp) | PC | 23 | 2026-11-17 | 200 | — |
| 498 | [Star Wars: Battlefront II (2005) (swbf2decomp (Gametoast))](https://github.com/Gametoast/swbf2decomp) | PC | 22 | 2026-11-08 | 200 | — |
| 499 | [Ultima Online (uo-client)](https://github.com/xrip/uo-client) | PC | 21 | 2026-06-01 | 200 | — |
| 500 | [Civilization II](https://github.com/richardpenman/civ2) | PC | 20 | 2026-11-18 | 200 | — |
| 501 | [Ikachan](https://github.com/cuckydev/Ikachan) | PC | 20 | 2020-09-26 | 200 | — |
| 502 | [Magic: The Gathering (microprose-shandalar-source)](https://github.com/benprew/microprose-shandalar-source) | PC | 20 | 2026-09-01 | 200 | — |
| 503 | [Quake 4 (Xbox 360 Quake 4 decomp)](https://github.com/cyberheater/Xbox-360-Quake4-decomp) | PC | 20 | 2026-10-28 | 200 | — |
| 504 | [Space Rangers (SpaceRangers1_decomp)](https://github.com/pakompom/SpaceRangers1_decomp) | PC | 20 | 2026-09-29 | 200 | — |
| 505 | [Call of Duty: United Offensive (Multiplayer)](https://github.com/opencoduo/coduomp) | PC | 19 | 2026-11-18 | 200 | AI |
| 506 | [Fable: The Lost Chapters (FableDecomp)](https://github.com/BuffJesus/FableDecomp) | PC | 19 | 2026-10-24 | 200 | — |
| 507 | [Fallout Tactics: Brotherhood of Steel (FTSE)](https://github.com/melindil/FTSE) | PC | 19 | 2026-03-27 | 200 | — |
| 508 | [Zuma Deluxe (ZumaTAS)](https://github.com/9933fa/Zuma-Deluxe-TAS) | PC | 19 | 2026-11-04 | 200 | — |
| 509 | [Command & Conquer: Red Alert 2 – Yuri's Revenge](https://github.com/gibbo101/ra2-decomp) | PC | 18 | 2026-11-19 | 200 | — |
| 510 | [Day of Defeat (DOD13-Client)](https://github.com/whamemer/dod13-client) | PC | 17 | 2026-10-22 | 200 | — |
| 511 | [LEGO Rock Raiders](https://github.com/ProjectReversio/LegoRockRaiders) | PC | 17 | 2026-02-23 | 200 | — |
| 512 | [Touhou 10.5: Scarlet Weather Rhapsody (th105)](https://github.com/N0zoM1z0/th105) | PC | 17 | 2026-11-15 | 200 | AI |
| 513 | [FlatOut: Ultimate Carnage](https://github.com/ZackWilde27/FlatOut-UC-Decomp) | PC | 16 | 2025-10-22 | 200 | — |
| 514 | [Nuclear Titbit (Titbit Modern)](https://github.com/offx366/titbit-modern) | PC | 15 | 2026-10-22 | 200 | — |
| 515 | [Real War](https://github.com/Francessco121/real-war-decomp) | PC | 15 | 2024-05-27 | 200 | — |
| 516 | [Silent Storm (Silent Storm source reconstruction)](https://github.com/met-nikita/Silent-Storm-Reconstruction) | PC | 15 | 2026-11-19 | 200 | — |
| 517 | [LEGO Stunt Rally (OpenLSR)](https://github.com/OpenLSR/OpenLSR) | PC | 14 | 2026-05-10 | 200 | — |
| 518 | [Rayman Arena (raymanarenadecomp)](https://github.com/zZeck/raymanarenadecomp) | PC | 14 | 2022-09-29 | 200 | — |
| 519 | [Star Wars: Battlefront II (2005) (swbf2decomp)](https://github.com/OpenSWBF2/swbf2decomp) | PC | 14 | 2026-10-28 | 200 | — |
| 520 | [Ys VI](https://github.com/GrantBenR/YsViDecomp) | PC | 14 | 2025-08-28 | 200 | — |
| 521 | [LEGO Batman: The Videogame](https://github.com/mariopossamato/LEGO-Batman) | PC | 13 | 2025-02-08 | 200 | — |
| 522 | [Plants vs Zombies GOTY](https://github.com/Bamcane/re-plants-vs-zombies) | PC | 13 | 2025-11-21 | 200 | — |
| 523 | [Prototype (prototype-decomp)](https://github.com/pablopenna/prototype-decomp) | PC | 13 | 2026-10-18 | 200 | — |
| 524 | [Sonic Mania (Sonic-Mania-25MB)](https://github.com/ThisKwasior/Sonic-Mania-25MB) | PC | 13 | 2026-08-23 | 200 | — |
| 525 | [Sonic Mania (Sonic-Mania-Decompilation)](https://github.com/DropSonic0/Sonic-Mania-Decompilation) | PC | 13 | 2025-06-23 | 200 | — |
| 526 | [Touhou 8: Imperishable Night (th08-web)](https://github.com/N0zoM1z0/th08-web) | PC | 13 | 2026-09-11 | 200 | — |
| 527 | [Empire Earth: The Art of Conquest](https://github.com/Protryon/empire_earth) | PC | 12 | 2026-11-08 | 200 | AI |
| 528 | [Purble Place (PurblePlaceDecomp)](https://github.com/simontime/PurblePlaceDecomp) | PC | 12 | 2019-08-20 | 200 | — |
| 529 | [Snail Mail](https://github.com/banteg/snail) | PC | 12 | 2026-11-17 | 200 | — |
| 530 | [Thief: Deadly Shadows (Thief3-Decomp (T3SDK))](https://github.com/Veradictus/Thief3-Decomp) | PC | 12 | 2026-11-17 | 200 | — |
| 531 | [Cuphead](https://github.com/jmxamongusmodder/cuphead-decomp) | PC | 11 | 2023-12-25 | 200 | — |
| 532 | [Ikachan (Ikachan3)](https://github.com/hax0kartik/ikachan) | PC | 11 | 2026-10-24 | 200 | — |
| 533 | [Thandor: The Invasion (Open Thandor)](https://github.com/idkFoxes/open-thandor) | PC | 11 | 2026-11-15 | 200 | — |
| 534 | [Heroes of Might and Magic II (homm2-decomp)](https://github.com/sushi-shi/homm2-decomp) | PC | 10 | 2026-10-10 | 200 | — |
| 535 | [LEGOLAND](https://github.com/marijnvdwerf/legoland) | PC | 10 | 2026-09-26 | 200 | — |
| 536 | [LEGO Batman: The Videogame](https://github.com/wasdhjklxyz/lbtvg) | PC | 9 | 2026-10-11 | 200 | AI |
| 537 | [Lemmings Paintball](https://github.com/vonhoff/lemball-decomp) | PC | 9 | 2026-10-20 | 200 | AI |
| 538 | [Toy Story 2](https://github.com/woodys-workshop/toy2-pc-decomp) | PC | 7 | 2026-11-07 | 200 | — |
| 539 | [Sonic Generations](https://github.com/Luigi587/GenerationsDecomp) | PC | 4 | 2025-11-17 | 200 | — |
| 540 | [King's Field 2](https://github.com/snzhkhd/King-s-Field-PC) | PC | 3 | 2026-10-14 | 200 | — |
| 541 | [Five Nights At Freddy's](https://github.com/fr3dsp/FNaF-Decomp) | PC | 2 | 2025-10-28 | 200 | — |
| 542 | [Five Nights At Freddy's 2](https://github.com/fr3dsp/FNaF-2-Decomp) | PC | 2 | 2025-10-28 | 200 | — |
| 543 | [Granny](https://github.com/scd5dev/GrannyDecompilationLegacy) | PC | 2 | 2026-05-15 | 200† | — |
| 544 | [Chernobyl Neighbor. Clown Gang](https://github.com/smolkrieger/nuclear-neighbor) | PC | 1 | 2025-06-25 | 200 | — |
| 545 | [Touhou 4: Lotus Land Story (th04 (REA showcase))](https://github.com/N0zoM1z0/th04) | PC-98/PC-88 | 39 | 2026-11-10 | 200 | AI |
| 546 | [Castlevania: Symphony of the Night](https://github.com/Xeeynamo/sotn-decomp) | PS1 | 1,247 | 2026-11-19 | 200 | — |
| 547 | [Silent Hill](https://github.com/shdecompilations/silent-hill-decomp) | PS1 | 967 | 2026-11-19 | 200 | — |
| 548 | [Silent Hill (SilentHillNativePCPort)](https://github.com/SlickAmogus/silent-hill-decomp) | PS1 | 883 | 2026-11-18 | 200 | AI |
| 549 | [Metal Gear Solid 1](https://github.com/FoxdieTeam/mgs_reversing) | PS1 | 834 | 2026-11-19 | 200 | — |
| 550 | [Doom (PsyDoom)](https://github.com/BodbDearg/PsyDoom) | PS1 | 558 | 2023-06-13 | 200 | — |
| 551 | [Crash Team Racing](https://github.com/CTR-tools/CTR-ModSDK) | PS1 | 459 | 2026-07-05 | 200 | — |
| 552 | [Crash Team Racing (CTR Native)](https://github.com/CTR-tools/ctr-native) | PS1 | 443 | 2026-10-06 | 200 | — |
| 553 | [PSCoverDL](https://github.com/xlenore/pscoverdl) | PS1 | 309 | 2026-03-24 | 200 | — |
| 554 | [Resident Evil (resident-evil-pc-decomp)](https://github.com/ecruells/resident-evil-pc-decomp) | PS1 | 201 | 2026-11-04 | 200 | — |
| 555 | [Vagrant Story](https://github.com/ser-pounce/rood-reverse) | PS1 | 197 | 2026-11-19 | 200 | — |
| 556 | [VIB Ribbon](https://github.com/open-ribbon/open-ribbon) | PS1 | 196 | 2025-02-28 | 200 | — |
| 557 | [Final Fantasy VII](https://github.com/Xeeynamo/ff7-decomp) | PS1 | 188 | 2026-11-15 | 200 | — |
| 558 | [Spyro the Dragon](https://github.com/TheMobyCollective/spyro-1) | PS1 | 183 | 2026-11-08 | 200 | — |
| 559 | [Legacy of Kain: Soul Reaver (Legacy of Kain: Soul Reaver Decompile)](https://github.com/Gh0stBlade/KAIN2) | PS1 | 175 | 2024-04-24 | 200 | — |
| 560 | [DOOM PSX](https://github.com/Erick194/PSXDOOM-RE) | PS1 | 163 | 2025-05-30 | 200 | — |
| 561 | [Serial Experiments Lain](https://github.com/Y0oshi/lain-psx-decompiled) | PS1 | 162 | 2026-10-03 | 200 | — |
| 562 | [Spider-Man](https://github.com/krystalgamer/spidey-decomp) | PS1 | 142 | 2026-10-07 | 200 | — |
| 563 | [Rage Racer (Rage Racer PC)](https://github.com/khasinski/rage-racer-pc) | PS1 | 141 | 2026-11-09 | 200 | AI |
| 564 | [Silent Hill (silent-hill-pc-nightly)](https://github.com/SlickAmogus/silent-hill-pc-nightly) | PS1 | 109 | 2026-05-18 | 200 | — |
| 565 | [Parasite Eve (parasite-eve-pc)](https://github.com/khasinski/parasite-eve-pc) | PS1 | 102 | 2026-11-16 | 200 | AI |
| 566 | [Brave Fencer Musashi](https://github.com/Druthulu/BFM-decomp) | PS1 | 99 | 2026-11-17 | 200 | — |
| 567 | [Crash Bandicoot 2: Cortex Strikes back](https://github.com/ughman/c2c) | PS1 | 95 | 2015-04-20 | 200 | — |
| 568 | [Legacy of Kain: Soul Reaver](https://github.com/fmil95/soul-re) | PS1 | 91 | 2026-11-18 | 200 | — |
| 569 | [Digimon World (dw_decomp)](https://github.com/jype0/dw_decomp) | PS1 | 89 | 2026-10-19 | 200 | — |
| 570 | [Mega Man Legends (mml1)](https://github.com/ChrisNonyminus/mml1) | PS1 | 87 | 2023-07-23 | 200 | — |
| 571 | [Chrono Cross](https://github.com/jdperos/chrono-cross-decomp) | PS1 | 84 | 2026-04-14 | 200 | — |
| 572 | [Parasite Eve II (parasite-eve-2-decomp)](https://github.com/GabeRealB/parasite-eve-2-decomp) | PS1 | 82 | 2026-10-27 | 200 | — |
| 573 | [Xenogears (non-matching)](https://github.com/yaz0r/Noah) | PS1 | 81 | 2026-04-22 | 200 | — |
| 574 | [MediEvil](https://github.com/MediEvilDecompilation/medievil-decomp) | PS1 | 73 | 2026-02-23 | 200 | — |
| 575 | [Parasite Eve (parasite-eve-decomp)](https://github.com/khasinski/parasite-eve-decomp) | PS1 | 70 | 2026-11-13 | 200 | — |
| 576 | [King's Field (Verdite1)](https://github.com/Voicedrew11/verdite1) | PS1 | 68 | 2026-11-17 | 200 | AI |
| 577 | [Final Fantasy VIII (ff8-decomp)](https://github.com/roengstrom/ff8-decomp) | PS1 | 65 | 2026-11-19 | 200 | — |
| 578 | [Need for Speed: High Stakes (PS1)](https://github.com/Caesar0007/NFSHS-PSX-decomp) | PS1 | 65 | 2026-11-18 | 200 | — |
| 579 | [Frogger: He's Back!](https://github.com/HighwayFrogs/frogger-psx) | PS1 | 60 | 2025-06-17 | 200 | — |
| 580 | [Harvest Moon: Back to Nature (hmbtn-decomp)](https://github.com/coalslav/hmbtn-decomp) | PS1 | 58 | 2026-10-13 | 200 | — |
| 581 | [Tony Hawk's Pro Skater (Tony Was A Pro Skater)](https://github.com/LANCommander/TonyWasAProSkater) | PS1 | 53 | 2026-10-24 | 200 | AI |
| 582 | [Legend of Mana](https://github.com/celophi/lom-decomp) | PS1 | 51 | 2026-11-17 | 200 | — |
| 583 | [Digimon World 3](https://github.com/markisha64/ddw3) | PS1 | 47 | 2026-04-06 | 200 | — |
| 584 | [Gran Turismo 2](https://github.com/ginryuoku/gt2-reversing) | PS1 | 43 | 2024-09-14 | 200 | — |
| 585 | [Digimon World 2 (DW2-PC)](https://github.com/Wyrelade/DW2-PC) | PS1 | 42 | 2026-10-15 | 200 | — |
| 586 | [Vagrant Story (rood-boi)](https://github.com/noprompt/rood-boi) | PS1 | 41 | 2026-11-18 | 200 | — |
| 587 | [Croc: Legend of the Gobbos](https://github.com/Xeeynamo/croc) | PS1 | 40 | 2024-03-31 | 200 | — |
| 588 | [Mega Man X4](https://github.com/sozud/mmx4) | PS1 | 39 | 2026-11-18 | 200 | — |
| 589 | [PaRappa the Rapper (PaRappaSource)](https://github.com/cuckydev/PaRappaSource) | PS1 | 36 | 2021-10-30 | 200 | — |
| 590 | [Final Fantasy Tactics (fft_decomp)](https://github.com/adamrt/fft_decomp) | PS1 | 33 | 2026-10-22 | 200 | — |
| 591 | [Rage Racer](https://github.com/khasinski/rage-racer-decomp) | PS1 | 33 | 2026-10-25 | 200 | — |
| 592 | [Colin McRae Rally 2.0 (CMR2Decomp (pablocpas))](https://github.com/pablocpas/CMR2Decomp) | PS1 | 32 | 2026-11-07 | 200 | — |
| 593 | [Vandal Hearts](https://github.com/shao113/vh) | PS1 | 32 | 2024-09-17 | 200 | — |
| 594 | [Final Fantasy VII (ff7-worldmap)](https://github.com/ergonomy-joe/ff7-worldmap) | PS1 | 31 | 2024-11-06 | 200 | — |
| 595 | [Spyro: Year of the Dragon (spyro-3)](https://github.com/TheMobyCollective/spyro-3) | PS1 | 31 | 2026-11-19 | 200 | — |
| 596 | [Gex 64: Enter the Gecko](https://github.com/MatBourgon/Gex64Decomp) | PS1 | 30 | 2026-09-03 | 200 | — |
| 597 | [Tomba!](https://github.com/hansbonini/psx_tomba) | PS1 | 28 | 2026-11-08 | 200 | — |
| 598 | [Final Fantasy IX (ff9-3ds)](https://github.com/maurizi/ff9-3ds) | PS1 | 27 | 2026-11-13 | 200 | — |
| 599 | [Final Fantasy VII (q-gears_reverse)](https://github.com/Akari1982/q-gears_reverse) | PS1 | 27 | 2026-07-24 | 200 | — |
| 600 | [Jumping Flash](https://github.com/NotExactlySiev/aloha) | PS1 | 27 | 2026-11-04 | 200 | — |
| 601 | [Resident Evil 2 (bio2-ds)](https://github.com/MeganGrass/bio2-ds) | PS1 | 26 | 2026-11-14 | 200 | AI |
| 602 | [Crash Bash](https://github.com/mateusfavarin/crashbash) | PS1 | 24 | 2024-05-17 | 200 | — |
| 603 | [Sheep, Dog 'n' Wolf (sdw-decomp)](https://github.com/SDW-Community/sdw-decomp) | PS1 | 24 | 2026-09-27 | 200 | — |
| 604 | [Digimon World 3 (Digimon World 3 decompilation)](https://github.com/ReGame-Labs/dw3_decomp) | PS1 | 22 | 2026-10-16 | 200 | — |
| 605 | [Bugs Bunny: Lost in Time!](https://github.com/quantumdude836/BugsDecomp) | PS1 | 20 | 2024-04-04 | 200 | — |
| 606 | [Digimon World 2](https://github.com/Wyrelade/Digimon-World-2-Decomp) | PS1 | 16 | 2026-10-08 | 200 | — |
| 607 | [LSD Dream Emulator](https://github.com/FirecatFG/lsddecomp) | PS1 | 15 | 2024-09-13 | 200 | — |
| 608 | [Lunar 2: Eternal Blue](https://github.com/Zackmon/lunar2-psx-decomp) | PS1 | 15 | 2022-04-14 | 200 | — |
| 609 | [Resident Evil (biohazard-vita)](https://github.com/KiddRwxSsj/biohazard-vita) | PS1 | 15 | 2026-10-19 | 200 | — |
| 610 | [Another Mind (anothermind-decomp)](https://github.com/halkuncode/anothermind-decomp) | PS1 | 14 | 2026-10-18 | 200 | — |
| 611 | [Evo's Space Adventures](https://github.com/mkst/esa) | PS1 | 14 | 2026-05-10 | 200 | — |
| 612 | [Megami Ibunroku Persona](https://github.com/daanhenke/persona-psx) | PS1 | 14 | 2026-10-03 | 200 | — |
| 613 | [Sheep Dog n' Wolf / Sheep Raider](https://github.com/lace22l/sheep-dog-n-wolf-decomp) | PS1 | 14 | 2026-05-21 | 200 | — |
| 614 | [Spyro 2: Ripto's Rage!](https://github.com/TheMobyCollective/spyro-2) | PS1 | 14 | 2026-11-16 | 200 | — |
| 615 | [Yu-Gi-Oh! Forbidden Memories (memories-decomp)](https://github.com/krystalgamer/memories-decomp) | PS1 | 14 | 2026-11-19 | 200 | — |
| 616 | [Final Fantasy VII (ff7-coaster)](https://github.com/ergonomy-joe/ff7-coaster) | PS1 | 13 | 2024-11-25 | 200 | — |
| 617 | [Spyro the Dragon (spyro1-reverse-engineering)](https://github.com/C0mposer/spyro1-reverse-engineering) | PS1 | 13 | 2024-01-20 | 200 | — |
| 618 | [Alien Trilogy (alien-trilogy-decomp)](https://github.com/lemiur/alien-trilogy-decomp) | PS1 | 12 | 2026-10-17 | 200 | AI |
| 619 | [King's Field (kf1-enhanced)](https://github.com/Acranon/kf1-enhanced) | PS1 | 12 | 2026-10-01 | 200 | — |
| 620 | [Wipeout XL (Wipeout XL decomp)](https://github.com/Yash-Singh1/wipeout-xl-decomp) | PS1 | 12 | 2026-10-25 | 200 | — |
| 621 | [Ace Combat 3: Electrosphere (ac3-decomp)](https://github.com/vzepec/ac3-decomp) | PS1 | 11 | 2026-10-26 | 200 | — |
| 622 | [Digimon World](https://github.com/solidheron/Digimon_World_1_decompolation) | PS1 | 11 | 2024-10-09 | 200 | — |
| 623 | [Armored Core (Armored-Core-Decomp)](https://github.com/Wyrelade/Armored-Core-Decomp) | PS1 | 10 | 2026-10-19 | 200 | — |
| 624 | [Azure Dreams](https://github.com/forestbelton/azure) | PS1 | 10 | 2026-11-15 | 200 | — |
| 625 | [Resident Evil (Resident Evil Director's Cut: Dual Shock Ver. Decompiled)](https://github.com/ThePerfectVale/Resident-Evil-Directors-Cut-Dualshock-Decompilation) | PS1 | 10 | 2026-10-17 | 200 | AI |
| 626 | [Spyro the Dragon (open-spyro)](https://github.com/theMagicalKarp/open-spyro) | PS1 | 10 | 2026-11-18 | 200 | — |
| 627 | [Pop'N Music](https://github.com/Erizur/slpm86183) | PS1 | 9 | 2026-02-08 | 200 | — |
| 628 | [WCW/nWo Thunder](https://github.com/martinbean/thunder) | PS1 | 8 | 2025-04-07 | 200 | — |
| 629 | [Aironauts](https://github.com/bismurphy/Aironauts-decomp) | PS1 | 6 | 2024-09-12 | 200 | — |
| 630 | [BattleTanx: Global Assault (PS1)](https://github.com/TheGh0stShip/BattleTanx-Global-Assault-PS1) | PS1 | 6 | 2026-10-21 | 200 | — |
| 631 | [Wild 9](https://github.com/plinkr/Wild9-Decompilation) | PS1 | 6 | 2026-11-17 | 200 | — |
| 632 | [WCW Nitro](https://github.com/martinbean/nitro) | PS1 | 5 | 2025-04-09 | 200 | — |
| 633 | [Tokimeki Memorial: Forever With You](https://github.com/CelestialAmber/tokimemo) | PS1 | 2 | 2024-02-17 | 200 | — |
| 634 | [PlayStation 2 (PCSX2)](https://github.com/PCSX2/pcsx2) | PS2 | 16,101 | 2026-11-18 | 200 | AI |
| 635 | [Jak & Daxter](https://github.com/open-goal/jak-project) | PS2 | 3,662 | 2026-11-17 | 200 | — |
| 636 | [Dragon Ball Z: Budokai Tenkaichi 3 (Tenkaichi3Decomp)](https://github.com/z3xox/Tenkaichi3Decomp) | PS2 | 770 | 2026-11-03 | 200 | AI |
| 637 | [Grand Theft Auto: Vice City (reVC (mrxenginner mirror))](https://github.com/mrxenginner/reVC) | PS2 | 494 | 2026-10-02 | 200 | — |
| 638 | [Sly Cooper and the Thievius Raccoonus (ProjectCane)](https://github.com/theclub654/ProjectCane) | PS2 | 397 | 2026-10-22 | 200 | AI |
| 639 | [Resident Evil - Code: Veronica X](https://github.com/AshfordFamily/recvx-decomp) | PS2 | 311 | 2026-11-06 | 200 | — |
| 640 | [Sly Cooper and the Thievius Raccoonus](https://github.com/TheOnlyZac/sly1) | PS2 | 289 | 2026-10-26 | 200 | — |
| 641 | [Downhill Domination (Downhill Revived)](https://github.com/skuza-oss/downhill-revived) | PS2 | 230 | 2026-11-17 | 200 | AI |
| 642 | [Ratchet & Clank (OpenRAC)](https://github.com/OpenRAC/OpenRAC) | PS2 | 219 | 2026-11-19 | 200 | AI |
| 643 | [PaRappa the Rapper 2](https://github.com/parappadev/parappa2) | PS2 | 209 | 2026-09-17 | 200 | — |
| 644 | [Silent Hill 3](https://github.com/dreamingmoths/memory-of-alessa) | PS2 | 176 | 2026-11-19 | 200 | — |
| 645 | [Shadow of the Colossus](https://github.com/Fantaskink/SOTC) | PS2 | 154 | 2026-02-15 | 200 | — |
| 646 | [Fatal Frame (MikuPan)](https://github.com/Mikompilation/MikuPan) | PS2 | 146 | 2026-11-05 | 200 | — |
| 647 | [Crash Twinsanity (Crash Twinsanity for Windows)](https://github.com/GioPixelGH/Crash-Twinsanity-Windows) | PS2 | 139 | 2026-11-17 | 200 | AI |
| 648 | [Fatal Frame 1](https://github.com/Mikompilation/Himuro) | PS2 | 138 | 2026-11-18 | 200 | — |
| 649 | [Gran Turismo 4 (gt4-decomp)](https://github.com/gustavocanepa/gt4-decomp) | PS2 | 136 | 2026-11-17 | 200 | — |
| 650 | [Dark Cloud](https://github.com/TheMoonPeople/Chronicle) | PS2 | 128 | 2026-10-28 | 200 | — |
| 651 | [Kingdom Hearts](https://github.com/ethteck/kh1) | PS2 | 118 | 2026-08-17 | 200 | — |
| 652 | [Ratchet & Clank (rac1-native)](https://github.com/RAC-Native/rac1-native-game) | PS2 | 103 | 2026-11-16 | 200 | AI |
| 653 | [God Hand](https://github.com/LucasPicoli/god-hand-decomp) | PS2 | 101 | 2026-11-17 | 200 | — |
| 654 | [Silent Hill 2 (sh23ds)](https://github.com/ankushKun/sh23ds) | PS2 | 101 | 2026-11-04 | 200 | — |
| 655 | [Shin Megami Tensei: Persona 3 FES (Persona3-FES-Decompilation)](https://github.com/snaku/Persona3-FES-Decompilation) | PS2 | 78 | 2026-09-04 | 200 | — |
| 656 | [Shin Megami Tensei: Persona 4 (Persona4-Decompilation)](https://github.com/Raikaru/Persona4-Decompilation) | PS2 | 66 | 2026-10-27 | 200 | — |
| 657 | [Dark Cloud 2 (Chronicle Two)](https://github.com/TheMoonPeople/ChronicleTwo) | PS2 | 58 | 2026-11-13 | 200 | — |
| 658 | [ICO (ico (nathanialf))](https://github.com/nathanialf/ico) | PS2 | 52 | 2026-10-30 | 200 | — |
| 659 | [Ratchet & Clank (Lombyte)](https://github.com/lombyte-project/Lombyte) | PS2 | 51 | 2026-11-14 | 200 | — |
| 660 | [Monster Hunter](https://github.com/2Tie/mh1j) | PS2 | 50 | 2026-11-19 | 200 | — |
| 661 | [Shadow of the Colossus (sotc-decomp)](https://github.com/TheRealestNwah/sotc-decomp) | PS2 | 49 | 2026-11-19 | 200 | AI |
| 662 | [Crash Twinsanity (twinsanity-reversed)](https://github.com/Smartkin/twinsanity-reversed) | PS2 | 46 | 2026-10-05 | 200 | — |
| 663 | [Ratchet & Clank: Going Commando (rac2-gc-decomp (OpenRAC))](https://github.com/OpenRAC/rac2-decomp) | PS2 | 46 | 2026-11-17 | 200 | — |
| 664 | [Shin Megami Tensei: Digital Devil Saga (dds-decomp)](https://github.com/Megami-Decomps/dds-decomp) | PS2 | 46 | 2026-11-15 | 200 | — |
| 665 | [SSX 3 (ssx3-decomp)](https://github.com/andersfischernielsen/ssx3-decomp) | PS2 | 46 | 2026-11-18 | 200 | — |
| 666 | [Xenosaga Episode I: Der Wille zur Macht (xsg-i-decomp)](https://github.com/OpokXeno/xsg-i-decomp) | PS2 | 46 | 2026-11-09 | 200 | — |
| 667 | [Klonoa 2: Lunatea's Veil](https://github.com/entriphy/kl2_lv_decomp) | PS2 | 45 | 2025-03-07 | 200 | — |
| 668 | [SSX 3](https://github.com/ssxdecomp/ssx3) | PS2 | 45 | 2026-11-15 | 200 | — |
| 669 | [Jak and Daxter: The Precursor Legacy](https://github.com/thebardockgames/Precursor) | PS2 | 41 | 2026-10-25 | 200 | — |
| 670 | [Haunting Ground (OpenHuey)](https://github.com/ArnautDaniel/OpenHuey) | PS2 | 39 | 2026-11-16 | 200 | AI |
| 671 | [Resident Evil - Code: Veronica X (recvx-gc-decomp)](https://github.com/fmil95/recvx-gc-decomp) | PS2 | 38 | 2026-08-05 | 200 | — |
| 672 | [Dragon Ball Z: Budokai Tenkaichi 3 (BT3-Decompiled)](https://github.com/z3xox/BT3-Decompiled) | PS2 | 37 | 2026-10-25 | 200 | — |
| 673 | [Ratchet & Clank: Up Your Arsenal (rac3-uya-decomp (OpenRAC))](https://github.com/vetusmagnus/rac3-uya-decomp) | PS2 | 36 | 2026-10-22 | 200 | — |
| 674 | [Resident Evil Outbreak File #2 (REOF2)](https://github.com/caprado/REOF2) | PS2 | 36 | 2026-05-26 | 200 | — |
| 675 | [Ico](https://github.com/RossyDoubleUnderscore/ICO-decomp) | PS2 | 34 | 2026-01-08 | 200 | — |
| 676 | [Metal Gear Solid 3](https://github.com/GirianSeed/mgs3) | PS2 | 33 | 2026-11-16 | 200 | — |
| 677 | [Shin Megami Tensei: Persona 3 FES (P3FES Decompilation)](https://github.com/C-GBL/P3FES-Decompilation) | PS2 | 32 | 2026-10-31 | 200 | — |
| 678 | [Yakuza](https://github.com/Hamzaxx370/Ogre-Decomp) | PS2 | 32 | 2026-07-15 | 200 | — |
| 679 | [Baroque (Baroque-Decomp)](https://github.com/Arch61s/Baroque-Decomp) | PS2 | 28 | 2026-11-08 | 200 | AI |
| 680 | [Crash Bandicoot: The Wrath of Cortex (PS2)](https://github.com/denzi-gh/crashwoc-decomp-ps2) | PS2 | 28 | 2026-11-03 | 200 | — |
| 681 | [Ratchet: Deadlocked (rac-deadlocked-decomp (OpenRAC))](https://github.com/OpenRAC/rac4-decomp) | PS2 | 28 | 2026-11-19 | 200 | — |
| 682 | [King's Field: The Ancient City (kfiv-decomp)](https://github.com/Voicedrew11/kfiv-decomp) | PS2 | 27 | 2026-10-21 | 200 | — |
| 683 | [SSX](https://github.com/ssxdecomp/ssx) | PS2 | 24 | 2026-10-06 | 200 | — |
| 684 | [Resident Evil: Dead Aim](https://github.com/cakehonolulu/Bullseye) | PS2 | 23 | 2026-08-01 | 200 | — |
| 685 | [Twisted Metal: Harbor City](https://github.com/jacobleeharris/tmhc) | PS2 | 21 | 2026-08-30 | 200 | — |
| 686 | [Xenosaga Episode II: Jenseits von Gut und Böse (xsg-ii-decomp)](https://github.com/OpokXeno/xsg-ii-decomp) | PS2 | 21 | 2026-11-18 | 200 | — |
| 687 | [Mortal Kombat: Deception](https://github.com/ShulkMaster/mk-deception) | PS2 | 20 | 2026-11-07 | 200 | — |
| 688 | [Star Ocean: Till the End of Time (so3-decomp)](https://github.com/celophi/so3-decomp) | PS2 | 20 | 2026-11-18 | 200 | — |
| 689 | [Way of the Samurai 2 (decomp_wots2)](https://github.com/acklavidian/decomp_wots2) | PS2 | 20 | 2026-10-16 | 200 | — |
| 690 | [Gran Turismo 3: A-Spec (gt3-decomp)](https://github.com/gustavocanepa/gt3-decomp) | PS2 | 19 | 2026-11-16 | 200 | — |
| 691 | [Resident Evil Outbreak (Biohazard Outbreak decomp)](https://github.com/GalaxyNostalgia/Outbreak-decomp) | PS2 | 19 | 2026-11-13 | 200 | — |
| 692 | [Xenosaga Episode 1 - Der Wille zur Macht](https://github.com/SquareMan/xenosaga) | PS2 | 19 | 2024-08-18 | 200 | — |
| 693 | [Crash Bandicoot: The Wrath of Cortex (crashwoc-decomp-gc)](https://github.com/denzi-gh/crashwoc-decomp-gc) | PS2 | 18 | 2026-10-27 | 200 | — |
| 694 | [Dog's Life](https://github.com/IWILLCRAFT-M0d/dogcomp) | PS2 | 17 | 2026-11-03 | 200 | — |
| 695 | [Pro Evolution Soccer 6 (pes6decomp)](https://github.com/Subarasheese/pes6decomp) | PS2 | 16 | 2026-11-19 | 200 | — |
| 696 | [Silent Hill 2 (mirror of alessa (SH2 engine))](https://github.com/dreamingmoths/mirror-of-alessa) | PS2 | 16 | 2026-11-19 | 200 | — |
| 697 | [Tom and Jerry in War of the Whiskers (wotwdecomp)](https://github.com/cohaereo/wotwdecomp) | PS2 | 16 | 2024-01-01 | 200 | — |
| 698 | [Crash Bandicoot: The Wrath of Cortex](https://github.com/calmsacibis995/crash-ps2) | PS2 | 15 | 2025-10-05 | 200 | — |
| 699 | [Ratchet & Clank: Up Your Arsenal (rac3-decomp)](https://github.com/OpenRAC/rac3-decomp) | PS2 | 14 | 2026-11-19 | 200 | — |
| 700 | [Monster Hunter 2 (mh2-decomp)](https://github.com/Batenkaitos-dev/mh2-decomp) | PS2 | 13 | 2026-11-10 | 200 | AI |
| 701 | [Splashdown](https://github.com/CoastRedWood/splashdown) | PS2 | 13 | 2026-11-03 | 200 | — |
| 702 | [Crash Bandicoot: The Wrath of Cortex (crashwoc-vita)](https://github.com/sebaz07/crashwoc-vita) | PS2 | 12 | 2026-11-06 | 200 | — |
| 703 | [Fatal Frame II: Crimson Butterfly (MioPan)](https://github.com/Mikompilation/MioPan) | PS2 | 12 | 2026-11-18 | 200 | AI |
| 704 | [Guilty Gear X Plus](https://github.com/WistfulHopes/ggx) | PS2 | 12 | 2025-07-27 | 200 | — |
| 705 | [Mortal Kombat: Deadly Alliance](https://github.com/cScarletter/MK-3D-Era-Decompilation) | PS2 | 12 | 2025-06-10 | 200 | — |
| 706 | [Ratchet & Clank (Ratchet & Clank Quest VR)](https://github.com/moistman42069/RatchetAndClank-Quest-VR) | PS2 | 12 | 2026-11-19 | 200 | — |
| 707 | [Ratchet & Clank (PS2 Quadrilogy)](https://github.com/VELD-Dev/Pyrocitor) | PS2 | 11 | 2025-05-15 | 200† | — |
| 708 | [Resident Evil - Code: Veronica X (RECVX Native)](https://github.com/Patt92/recvx-native) | PS2 | 11 | 2026-11-16 | 200 | — |
| 709 | [Yu-Gi-Oh! The Duelists of the Roses (dotr-decomp)](https://github.com/kira-502/dotr-decomp) | PS2 | 11 | 2026-11-13 | 200 | — |
| 710 | [Drakan: The Ancients' Gates](https://github.com/cScarletter/Drakan-The-Ancient-Gates-Decompilation-) | PS2 | 6 | 2025-05-25 | 200 | — |
| 711 | [Legaia 2: Duel Saga](https://github.com/WeAreTommyBruh/Legaia2-Decomp) | PS2 | 5 | 2026-11-18 | 200 | — |
| 712 | [Stretch Panic](https://github.com/Harskov/stretch-panic-usa) | PS2 | 3 | 2026-11-17 | 200 | — |
| 713 | [Are You Smarter Than a 5th Grader: Make the Grade](https://github.com/Gmon20/makethedecomp) | PS2 | 2 | 2025-08-26 | 200 | — |
| 714 | [Chulip](https://github.com/aaaaaaaaaaway/chulip-decomp) | PS2 | 2 | 2026-09-29 | 200 | — |
| 715 | [Okami HD](https://github.com/Shintensu/OkamiHD-Decomp) | PS3 | 15 | 2024-12-27 | 200 | — |
| 716 | [ShadPS4 QT Launcher](https://github.com/shadps4-emu/shadps4-qtlauncher) | PS4 | 533 | 2026-11-19 | 200 | AI |
| 717 | [Bloodborne](https://github.com/Yharnam-Hunters/Paleblood) | PS4 | 219 | 2026-11-19 | 200 | — |
| 718 | [inFAMOUS Second Son (issn_pc)](https://github.com/Liondarkz/issn_pc) | PS4 | 209 | 2026-11-12 | 200 | AI |
| 719 | [PS5 (AnyPS5)](https://github.com/boykopovar/AnyPS5) | PS5 | 56,826 | 2026-11-19 | 200 | AI |
| 720 | [Monster Hunter Portable 2nd G](https://github.com/tclamb/mhp2g-decomp) | PSP | 42 | 2026-11-17 | 200 | — |
| 721 | [Yu-Gi-Oh! 5D's Tag Force 5 (ygo-tf-5-decomp)](https://github.com/angelof-exe/ygo-tf-5-decomp) | PSP | 11 | 2026-08-16 | 200 | — |
| 722 | [Bakugan: Defenders of the Core](https://github.com/Vawlpe/BakuganDotC-decomp) | PSP | 10 | 2024-03-09 | 200 | — |
| 723 | [Sega Saturn (Ymir)](https://github.com/ymir-emu/Ymir) | Saturn | 1,129 | 2026-11-18 | 200 | — |
| 724 | [Mednaffe](https://github.com/AmatCoder/mednaffe) | Saturn | 537 | 2024-04-20 | 200 | — |
| 725 | [Panzer Dragoon Saga](https://github.com/yaz0r/Azel) | Saturn | 192 | 2026-10-29 | 200 | — |
| 726 | [Panzer Dragoon Saga (Reverse-Engineer-Azel)](https://github.com/Aeonitis/Reverse-Engineer-Azel) | Saturn | 30 | 2023-05-04 | 200 | — |
| 727 | [PicoDrive](https://github.com/irixxxx/picodrive) | sms | 130 | 2026-11-17 | 200 | — |
| 728 | [Super Mario World (snesrev: smw)](https://github.com/snesrev/smw) | SNES | 653 | 2023-08-16 | 200 | — |
| 729 | [Super Metroid (sm)](https://github.com/snesrev/sm) | SNES | 563 | 2023-04-17 | 200 | — |
| 730 | [EarthBound / Mother 2](https://github.com/Herringway/ebsrc) | SNES | 188 | 2026-11-18 | 200 | — |
| 731 | [Star Fox [Enhanced]](https://github.com/kandowontu2/starfox-enhanced) | SNES | 148 | 2026-11-01 | 200 | AI |
| 732 | [SuperSnes9x](https://github.com/shanytc/snes9x) | SNES | 126 | 2026-11-19 | 200 | — |
| 733 | [Super Metroid (SuperMetroidDecomp)](https://github.com/MrJackSpade/SuperMetroidDecomp) | SNES | 17 | 2026-11-19 | 200 | — |
| 734 | [Lichii](https://github.com/zortos293/Lichii) | Switch | 9,785 | 2026-11-19 | 200 | AI |
| 735 | [The Legend of Zelda: Breath of the Wild](https://github.com/zeldaret/botw) | Switch | 2,489 | 2026-11-18 | 200 | — |
| 736 | [Minecraft: Nintendo Switch Edition](https://github.com/GRAnimated/MinecraftLCE) | Switch | 629 | 2026-10-03 | 200 | — |
| 737 | [Super Mario Odyssey](https://github.com/MonsterDruide1/OdysseyDecomp) | Switch | 521 | 2026-09-29 | 200 | — |
| 738 | [Lego City Undercover](https://github.com/Nintendocustom/Lego-City-Undercover-Decompilation) | Switch | 32 | 2026-11-13 | 200 | — |
| 739 | [Super Mario 3D World + Bowser's Fury (RedCarpet-S)](https://github.com/fruityloops1/RedCarpet-S) | Switch | 32 | 2024-10-15 | 200 | — |
| 740 | [Super Smash Bros. Ultimate (ssbu-decomp)](https://github.com/sbergeron42/ssbu-decomp) | Switch | 20 | 2026-04-13 | 200 | — |
| 741 | [Pokémon Legends: Arceus (project-arceus)](https://github.com/NicoRuedaA/project-arceus) | Switch | 13 | 2026-10-30 | 200 | AI |
| 742 | [Eglantine](https://github.com/Eglantine-Community/Eglantine) | switch2 | 6,125 | 2026-11-17 | 200 | AI |
| 743 | [The Legend of Zelda: Ocarina of Time (Fritchii)](https://github.com/Frizti/Fritchii) | switch2 | 4,362 | 2026-11-06 | 200 | AI |
| 744 | [Anka](https://github.com/EddizEge/Anka) | switch2 | 133 | 2026-11-11 | 200 | AI |
| 745 | [Bloons TD 5](https://github.com/NKHook/BTD5-Decomp) | Web/Flash | 16 | 2024-11-04 | 200 | — |
| 746 | [Happy Wheels](https://github.com/Afterflash/HappyWheels) | Web/Flash | 13 | 2025-07-27 | 200 | — |
| 747 | [Super Mario Galaxy 1](https://github.com/SMGCommunity/Petari) | Wii | 1,356 | 2026-11-18 | 200 | — |
| 748 | [Super Mario Galaxy (Nebula)](https://github.com/keepvaibin/nebula) | Wii | 610 | 2026-11-19 | 200 | AI |
| 749 | [Mario Kart Wii](https://github.com/snailspeed3/mkw) | Wii | 481 | 2025-09-16 | 200 | — |
| 750 | [The Legend of Zelda: Skyward Sword](https://github.com/zeldaret/ss) | Wii | 243 | 2026-10-20 | 200 | — |
| 751 | [Wii Menu](https://github.com/koopthekoopa/wii-ipl) | Wii | 227 | 2026-10-15 | 200 | — |
| 752 | [Wii Sports](https://github.com/doldecomp/ogws) | Wii | 189 | 2026-10-25 | 200 | — |
| 753 | [New Super Mario Bros. Wii](https://github.com/NSMBW-Community/NSMBW-Decomp) | Wii | 157 | 2026-11-15 | 200 | — |
| 754 | [Xenoblade](https://github.com/xbret/xenoblade) | Wii | 152 | 2026-06-28 | 200 | — |
| 755 | [Super Mario Galaxy (GalaxyQuest (Meta Quest 3 VR))](https://github.com/bigmak94/GalaxyQuest) | Wii | 136 | 2026-11-18 | 200 | — |
| 756 | [Rock Band 3](https://github.com/DarkRTA/rb3) | Wii | 130 | 2026-10-28 | 200 | — |
| 757 | [Super Smash Bros. Brawl](https://github.com/doldecomp/brawl) | Wii | 122 | 2026-11-18 | 200 | — |
| 758 | [Super Paper Mario](https://github.com/SeekyCt/spm-decomp) | Wii | 106 | 2026-11-17 | 200 | — |
| 759 | [Super Mario Galaxy 2](https://github.com/SMGCommunity/Garigari) | Wii | 103 | 2026-11-18 | 200 | — |
| 760 | [Super Mario Galaxy (SMGDecompilation)](https://github.com/snailspeed3/SMGDecompilation) | Wii | 97 | 2020-12-18 | 200 | — |
| 761 | [The Legend of Zelda: Ocarina of Time (Wii Virtual Console)](https://github.com/zeldaret/oot-vc) | Wii | 95 | 2026-09-06 | 200 | — |
| 762 | [Pokémon Battle Revolution (pokerevo)](https://github.com/pret/pokerevo) | Wii | 80 | 2024-10-26 | 200 | — |
| 763 | [Mario Kart Wii (mkw)](https://github.com/doldecomp/mkw) | Wii | 63 | 2026-10-16 | 200 | — |
| 764 | [Kirby's Epic Yarn](https://github.com/Swiftshine/key) | Wii | 57 | 2026-10-14 | 200 | — |
| 765 | [de Blob](https://github.com/AdventureT/OpenToshi) | Wii | 53 | 2026-10-24 | 200 | — |
| 766 | [Mario Kart Wii (mkw-structures)](https://github.com/SeekyCt/mkw-structures) | Wii | 47 | 2024-08-13 | 200 | — |
| 767 | [Mario Strikers Charged](https://github.com/yannicksuter/mscharged-decomp) | Wii | 43 | 2026-10-29 | 200 | — |
| 768 | [Rhythm Heaven Fever](https://github.com/conhlee/rhf) | Wii | 32 | 2026-10-24 | 200 | — |
| 769 | [Mario Party 8](https://github.com/mariopartyrd/marioparty8) | Wii | 31 | 2026-11-19 | 200 | — |
| 770 | [Mario Party 9](https://github.com/mariopartyrd/marioparty9) | Wii | 28 | 2025-04-01 | 200 | — |
| 771 | [Pokemon Battle Revolution](https://github.com/pbr-ret/pbr-decomp) | Wii | 28 | 2026-11-17 | 200 | — |
| 772 | [Animal Crossing: City Folk (cf-decomp)](https://github.com/ACreTeam/cf-decomp) | Wii | 27 | 2026-11-16 | 200 | — |
| 773 | [New Play Control! Pikmin 2](https://github.com/projectPiki/pik2wii) | Wii | 22 | 2026-10-12 | 200 | — |
| 774 | [The Sims 2: Castaway](https://github.com/HaydnTrigg/Castaway) | Wii | 22 | 2026-01-21 | 200 | — |
| 775 | [Lego Star Wars III: The Clone Wars](https://github.com/ThePlayerRolo/LegoCloneWarsWii) | Wii | 21 | 2025-12-07 | 200 | — |
| 776 | [Wii Play (Rhae)](https://github.com/akiramusic000/Rhae) | Wii | 19 | 2026-10-03 | 200 | — |
| 777 | [Pokepark Wii: Pikachu's Adventure](https://github.com/SephDB/pokepark-wii-decomp) | Wii | 18 | 2026-10-03 | 200 | — |
| 778 | [Inazuma Eleven Strikers](https://github.com/SwareJonge/IEStrikers) | Wii | 16 | 2024-06-13 | 200 | — |
| 779 | [Kirby's Dream Collection - Special Edition](https://github.com/Swiftshine/kdc) | Wii | 14 | 2026-11-11 | 200 | — |
| 780 | [New Play Control! Pikmin](https://github.com/projectPiki/pik1wii) | Wii | 14 | 2026-10-24 | 200 | — |
| 781 | [Rumble](https://github.com/KooShnoo/pokemon-rumble) | Wii | 14 | 2026-04-24 | 200 | — |
| 782 | [Alice in Wonderland](https://github.com/Alice-2010/Decomp) | Wii | 13 | 2026-10-22 | 200 | — |
| 783 | [Super Mario Galaxy (MacioGalaxy)](https://github.com/classicrob/MacioGalaxy) | Wii | 12 | 2026-10-23 | 200 | — |
| 784 | [Mario Kart Wii (mkw)](https://github.com/vabold/mkw) | Wii | 11 | 2026-09-19 | 200 | — |
| 785 | [Donkey Kong Country Returns](https://github.com/Wexos/DKCR-Decompilation) | Wii | 9 | 2025-07-15 | 200 | — |
| 786 | [Big Brain Academy: Wii Degree](https://github.com/vabold/bba-wd) | Wii | 7 | 2025-06-01 | 200 | — |
| 787 | [Go Vacation](https://github.com/Moddimation/GoVacation-Decompilation) | Wii | 4 | 2025-07-24 | 200† | — |
| 788 | [World of Goo](https://github.com/Fancy2209/wog-wiiware) | Wii | 3 | 2025-01-21 | 200 | — |
| 789 | [Taiko No Tatsujin Wii Ketteiban](https://github.com/CalebPancake/Taiko-No-Tatsujin-Wii-Ketteiban) | Wii | 1 | 2025-02-01 | 200 | — |
| 790 | [Wario Land: Shake It!](https://github.com/Swiftshine/wlsi) | Wii | 1 | 2025-12-01 | 200 | — |
| 791 | [Cemu](https://github.com/cemu-project/Cemu) | Wii U | 10,216 | 2026-11-18 | 200 | — |
| 792 | [New Super Mario Bros. U](https://github.com/aboood40091/red-pro2) | Wii U | 51 | 2026-10-06 | 200 | — |
| 793 | [The Legend of Zelda: The Wind Waker HD (wwhd (verified decompilation))](https://github.com/ZeldaWWHDDecomp/wwhd) | Wii U | 47 | 2026-11-19 | 200 | AI |
| 794 | [Sonic Lost World](https://github.com/Radfordhound/OpenLW) | Wii U | 21 | 2024-04-15 | 200 | — |
| 795 | [Splatoon (splatoon-decomp (Splatoon Decomp Lab))](https://github.com/sdlfoundation/splatoon-decomp) | Wii U | 21 | 2024-02-17 | 200 | — |
| 796 | [Splatoon](https://github.com/Dexx-io/Splatoon-Decomp) | Wii U | 18 | 2024-12-18 | 200 | — |
| 797 | [Halo: Combat Evolved](https://github.com/halo-re/halo) | Xbox | 462 | 2023-07-07 | 200 | — |
| 798 | [Halo 2 (halo2-decompiled)](https://github.com/kirklandsig/halo2-decompiled) | Xbox | 155 | 2026-11-19 | 200 | — |
| 799 | [UNDERTALE (Xbox One)](https://github.com/kittibyte/UndertaleDecomp) | Xbox | 130 | 2025-07-18 | 200 | — |
| 800 | [Scarface: The World Is Yours (scarface_decomp)](https://github.com/scarface-decomp/scarface_decomp) | Xbox | 16 | 2026-11-19 | 200 | — |
| 801 | [Call of Duty 2: Big Red One (Call of Duty 2: Big Red One - decompilation)](https://github.com/SmokeDoggy044/CoD2-BRO-Decomp) | Xbox | 13 | 2026-11-16 | 200 | AI |
| 802 | [Halo 2 (Halo-2-Decompiled)](https://github.com/TheRunaway5/Halo-2-Decompiled) | Xbox | 13 | 2026-11-10 | 200 | — |
| 803 | [Xenia Manager](https://github.com/xenia-manager/xenia-manager) | Xbox 360 | 1,108 | 2026-09-22 | 200 | — |
| 804 | [Call of Duty: Black Ops (bo1-zombies-decompiled)](https://github.com/MisaDev4/bo1-zombies-decompiled) | Xbox 360 | 357 | 2026-10-04 | 200 | — |
| 805 | [Marble Blast Ultra (OpenMBU)](https://github.com/MBU-Team/OpenMBU) | Xbox 360 | 265 | 2026-04-17 | 200 | — |
| 806 | [Lego Star Wars: The Complete Saga](https://github.com/opensagadev/saga) | Xbox 360 | 79 | 2026-11-10 | 200 | — |
| 807 | [Minecraft: Xbox 360 Edition](https://github.com/LCERD/Minecraft-Xbox-360-Decompilation) | Xbox 360 | 76 | 2025-09-27 | 200 | — |
| 808 | [Halo Reach](https://github.com/ChimpsAtSea/Reach) | Xbox 360 | 75 | 2026-07-31 | 200 | — |
| 809 | [Guitar Hero: Warriors of Rock](https://github.com/kernaltrap8/WoR-Plus) | Xbox 360 | 56 | 2024-12-05 | 200 | — |
| 810 | [Dance Central 3](https://github.com/rjkiv/dc3-decomp) | Xbox 360 | 46 | 2026-11-19 | 200 | — |
| 811 | [Grand Theft Auto IV (LibertyFlux)](https://github.com/monstercameron/LibertyFlux) | Xbox 360 | 27 | 2026-10-12 | 200 | AI |
| 812 | [Banjo-Kazooie (X360)](https://github.com/banjo360/bk360) | Xbox 360 | 24 | 2026-03-07 | 200 | — |
| 813 | [Burnout Paradise](https://github.com/BurnoutHints/b5-decomp) | Xbox 360 | 24 | 2025-06-12 | 200 | — |
| 814 | [Sonic the Hedgehog (2006)](https://github.com/rjkiv/sonic06) | Xbox 360 | 16 | 2026-10-31 | 200 | — |
| 815 | [Rockstar Games Presents Table Tennis (tt-decomp)](https://github.com/OZORDI/tt-decomp) | Xbox 360 | 14 | 2026-04-22 | 200 | — |
| 816 | [Crackdown 2 (Crackdown 2 decompilation)](https://github.com/matty45/Crackdown2-Decomp) | Xbox 360 | 12 | 2026-11-15 | 200 | — |
| 817 | [Skate](https://github.com/Skate-Modding-Team/Skate-Decompilation-Project) | Xbox 360 | 11 | 2024-07-10 | 200 | — |
| 818 | [Kinect Sports](https://github.com/SebaaMG/Kinect-Sports-Decomp) | Xbox 360 | 6 | 2026-09-30 | 200 | — |
| 819 | [Cobra (Paul Hughes ZXSpectrumCobra)](https://github.com/Paulie68000/ZXSpectrumCobra) | ZX Spectrum | 47 | 2024-11-17 | 200 | — |
| 820 | [Head Over Heels (simon-frankau head-over-heels)](https://github.com/simon-frankau/head-over-heels) | ZX Spectrum | 32 | 2017-06-28 | 200 | — |
| 821 | [Hyper Active (Paul Hughes ZXSpectrumHyperActive)](https://github.com/Paulie68000/ZXSpectrumHyperActive) | ZX Spectrum | 24 | 2024-11-03 | 200 | — |
| 822 | [Chuckie Egg (Paul Hughes ZXSpectrumChuckieEgg)](https://github.com/Paulie68000/ZXSpectrumChuckieEgg) | ZX Spectrum | 20 | 2024-11-16 | 200 | — |
| 823 | [Soldier of Fortune (kmatveev zx-sof-reveng)](https://github.com/kmatveev/zx-sof-reveng) | ZX Spectrum | 11 | 2018-04-01 | 200 | — |
| 824 | [Halo: Combat Evolved](https://github.com/punpckhdq/halo) | — | 212 | 2026-11-18 | 200 | — |
| 825 | [Test Drive Unlimited](https://github.com/opentestdriveunlimited/OpenTestDriveUnlimited) | — | 172 | 2026-11-19 | 200 | — |
| 826 | [Xenogears](https://github.com/ladysilverberg/xenogears-decomp) | — | 125 | 2026-10-23 | 200† | — |
| 827 | [Pizza Tower](https://github.com/femloy/OpenTower) | — | 91 | 2026-01-24 | 200 | — |
| 828 | [Hitman: Codename 47](https://github.com/0danny/re47) | — | 74 | 2026-07-29 | 200† | — |
| 829 | [Battlefield 2](https://github.com/kiwidoggie/breadflowerdos) | — | 50 | 2026-10-01 | 200† | — |
| 830 | [Deltarune](https://github.com/TeamBlossomDevs/DeltaruneDecomp_beta) | — | 29 | 2025-10-17 | 200 | — |
| 831 | [Twisted Metal](https://github.com/OpenTrac/tm1_Re-Arc) | — | 29 | 2026-11-15 | 200 | — |
| 832 | [Turok 3: Shadow of Oblivion](https://github.com/Drahsid/turok3) | — | 26 | 2023-12-04 | 200† | — |
| 833 | [Twisted Metal: Black](https://github.com/OpenTrac/tmb_Re-Arc) | — | 26 | 2026-11-15 | 200 | — |
| 834 | [SSX Tricky](https://github.com/ssxdecomp/ssxtricky) | — | 13 | 2026-10-27 | 200 | — |
| 835 | [Race Driver: GRID](https://github.com/PipeKnight/drig-race-driver) | — | 12 | 2026-11-19 | 200 | — |
| 836 | [UnderTale Yellow](https://github.com/burnedpopcorn/UnderTale-Yellow-Decompilation) | — | 12 | 2025-08-27 | 200 | — |
| 837 | [Custom Robo GX](https://github.com/pizdex/robogx) | — | 9 | 2026-10-20 | 200 | — |
| 838 | [Cut The Rope](https://github.com/Bingies24/cuttherope-dx) | — | 9 | 2026-10-09 | 200 | — |
| 839 | [Doraemon: Nobita to Mittsu no Seireiseki](https://github.com/adipocira/doraemon1) | — | 9 | 2026-11-13 | 200 | — |
| 840 | [Shaun Palmer's Pro Snowboarder](https://github.com/Daniel-McCarthy/SPPS) | — | 9 | 2026-10-12 | 200 | — |
| 841 | [Soulcalibur II](https://github.com/Soulcalibur-II-Research-Group/scII_re) | — | 9 | 2025-11-08 | 200 | — |
| 842 | [Yoshi's Woolly World](https://github.com/Swiftshine/yww) | — | 9 | 2025-01-04 | 200 | — |
| 843 | [Lego Creator Knights Kingdom](https://github.com/DavidGrice/knightskingdom) | — | 8 | 2026-07-05 | 200 | — |
| 844 | [Lego Racers](https://github.com/marijnvdwerf/lego-racers) | — | 8 | 2025-01-05 | 200 | — |
| 845 | [Summoner: A Goddess Reborn](https://github.com/Charlese2/sgr) | — | 8 | 2025-12-09 | 200 | — |
| 846 | [Team Buddies](https://github.com/hcbt/tbuddies-decomp) | — | 8 | 2026-09-15 | 200 | — |
| 847 | [Virtual Pool 64](https://github.com/LLONSIT/VirtualPool64) | — | 8 | 2022-10-29 | 200 | — |
| 848 | [Chameleon Twist 2](https://github.com/chameleonTwistRet/chameleonTwist2v1.0-JP) | — | 7 | 2026-09-13 | 200 | — |
| 849 | [Frogger's Adventures: Temple of the Frog](https://github.com/JRickey/frog-adv-temple-decomp) | — | 7 | 2026-09-08 | 200 | — |
| 850 | [Shadowgate 64](https://github.com/Rainchus/ShadowGate64) | — | 7 | 2023-05-18 | 200 | — |
| 851 | [The Lord of the Rings: Return of the King](https://github.com/crimsonmagick/lotr-rotk) | — | 7 | 2025-01-11 | 200 | — |
| 852 | [Tony Hawk's Pro Skater 2 Demo](https://github.com/emoluvjd2/thps2-demo-decomp) | — | 7 | 2026-10-12 | 200 | — |
| 853 | [Zone of the Enders 1](https://github.com/GirianSeed/zoe1) | — | 7 | 2026-05-13 | 200 | — |
| 854 | [Alphabet Park Adventure](https://github.com/unspDecomp/abcParkDecomp) | — | 6 | 2024-06-22 | 200 | — |
| 855 | [Dragon Ball Z: Budokai 2](https://github.com/TotallyNotMichael-GH/dbz2) | — | 6 | 2025-01-08 | 200 | — |
| 856 | [eCrew Development Program (McDonald's Training Game)](https://github.com/imavie/ecdpdecomp) | — | 6 | 2024-08-02 | 200 | — |
| 857 | [Snowboard Kids](https://github.com/sonicdcer/sk) | — | 6 | 2024-10-20 | 200 | — |
| 858 | [The New Tetris](https://github.com/KiritoDv/tnt) | — | 6 | 2025-01-23 | 200† | — |
| 859 | [Zone of the Enders 3 (Guy Savage from Metal Gear Solid 3)](https://github.com/GirianSeed/zoe3) | — | 6 | 2026-09-20 | 200 | — |
| 860 | [Amplitude](https://github.com/ieee802dot11ac/amp) | — | 5 | 2025-02-19 | 200 | — |
| 861 | [Freedom Fighters](https://github.com/kaustubhxd/ReFreedomFighters) | — | 5 | 2026-11-09 | 200 | AI |
| 862 | [Princess Maker 4](https://github.com/Yanis002/pm4) | — | 5 | 2026-01-30 | 200 | — |
| 863 | [Soul Blazer](https://github.com/hellow554/RustyBlazer) | — | 5 | 2025-04-01 | 200 | — |
| 864 | [The Italian Job](https://github.com/dashr9230/Caper) | — | 5 | 2026-08-28 | 200 | — |
| 865 | [Transformers: Mystery Of Convoy](https://github.com/Fixatron/TFRom-Recreation) | — | 5 | 2025-11-02 | 200 | — |
| 866 | [Zone of the Enders 2](https://github.com/GirianSeed/zoe2) | — | 5 | 2026-06-04 | 200 | — |
| 867 | [Blasterball Revolution 2](https://github.com/KoboDev/BBR2Decompile) | — | 4 | 2024-10-16 | 200 | — |
| 868 | [Excite Truck](https://github.com/orangedude27/excite-truck) | — | 4 | 2026-11-19 | 200 | — |
| 869 | [Fate EXTELLA](https://github.com/bIue9076r/fate-extella-decompilation) | — | 4 | 2025-07-02 | 200 | — |
| 870 | [Fortune Street](https://github.com/FortuneStreetModding/boom-street-decomp) | — | 4 | 2025-09-17 | 200 | — |
| 871 | [Freedom Fighters](https://github.com/andresj-sanchez/frfi-decomp) | — | 4 | 2025-11-12 | 200 | — |
| 872 | [HOVER!](https://github.com/Link4Electronics/FlyingDodgem) | — | 4 | 2026-10-20 | 200 | — |
| 873 | [Mario Sport Mix](https://github.com/EltyDev/MSM-decomp) | — | 4 | 2025-09-07 | 200 | — |
| 874 | [Ninja Master - Shinobi III](https://github.com/krazyjakee/ninja-master) | — | 4 | 2026-10-26 | 200 | AI |
| 875 | [Onegai Monsters](https://github.com/Ryan-Myers/onegaimonsters) | — | 4 | 2025-11-20 | 200 | — |
| 876 | [Skylanders Cloud Patrol](https://github.com/spyrosadventure/cloud-patrol-decomp) | — | 4 | 2024-07-22 | 200 | — |
| 877 | [Bounce](https://github.com/misterjdrg/Bouncer) | — | 3 | 2025-09-22 | 200 | — |
| 878 | [Creatures 2](https://github.com/LimitedStopSoftware/Creatures-2-Decompilation) | — | 3 | 2026-10-07 | 200 | — |
| 879 | [Dark Rift](https://github.com/Unnunu/darkrift) | — | 3 | 2026-11-06 | 200 | — |
| 880 | [DOMA Days](https://github.com/iestyn129/DOMADays) | — | 3 | 2025-11-07 | 200 | — |
| 881 | [F-Zero AX](https://github.com/TheInfiniteLegend/f-0-ax) | — | 3 | 2024-04-27 | 200 | — |
| 882 | [Ford Racing](https://github.com/dashr9230/Gt2) | — | 3 | 2026-07-30 | 200 | — |
| 883 | [Grand Theft Auto Advanced](https://github.com/AnriTool/AdvanceLiberty-Enhanced) | — | 3 | 2026-11-11 | 200 | — |
| 884 | [I Spy Spooky Mansion](https://github.com/AM7999/ISpy-SM-Decomp) | — | 3 | 2024-07-31 | 200 | — |
| 885 | [Jazz Jackrabbit 2](https://github.com/Mustafa1177/jazzjackrabbit2-decompiled) | — | 3 | 2025-05-09 | 200 | — |
| 886 | [Mario Teaches Typing 3](https://github.com/EliasFever/MarioTeachesTyping3Decomp) | — | 3 | 2025-10-29 | 200 | — |
| 887 | [Radio Helicopter](https://github.com/Bsquo/pcopter_wii) | — | 3 | 2025-05-12 | 200 | — |
| 888 | [Terminator Salvation](https://github.com/connieprice/Terminator-Salvation-Lua) | — | 3 | 2022-06-19 | 200 | — |
| 889 | [The Sims 2: Castaways](https://github.com/simdecomp/ts2c) | — | 3 | 2022-05-29 | 200 | — |
| 890 | [Treasure Planet](https://github.com/Colt-Zero/Thousand-Worlds) | — | 3 | 2024-05-21 | 200 | — |
| 891 | [Costume Quest](https://github.com/Costume-Quest-Modding/CostumeQuest-Decomp) | — | 2 | 2026-10-19 | 200 | — |
| 892 | [Defenders & Dragons](https://github.com/Lindarychwalski/Defenders-Dragons) | — | 2 | 2025-08-04 | 200 | — |
| 893 | [Green Farm 3](https://github.com/SmithGoll/Greenier-Farm-3-Decomp) | — | 2 | 2025-05-01 | 200 | — |
| 894 | [Hazard 1998](https://github.com/EuclidVsGauss/HazardRevenge) | — | 2 | 2026-10-18 | 200 | — |
| 895 | [Kuon (Mulberry)](https://github.com/weirdbeardgame/Mulberry) | — | 2 | 2026-10-26 | 200 | — |
| 896 | [Mickey Saves the Day 3D Adventure](https://github.com/Japabu/mickey-saves-the-day-3d-adventure) | — | 2 | 2026-10-23 | 200 | AI |
| 897 | [Rumble Fighter](https://github.com/Primitheus/rumbledecomp) | — | 2 | 2024-07-12 | 200 | — |
| 898 | [The Journeyman Project Turbo!](https://github.com/disinvite/jman-decomp) | — | 2 | 2026-07-04 | 200 | — |
| 899 | [Age of Speed 2](https://github.com/Llamaware/age-of-speed2) | — | 1 | 2025-07-11 | 200 | — |
| 900 | [Amazing Island](https://github.com/EltaleLibrarian/Amazing) | — | 1 | 2025-07-15 | 200 | — |
| 901 | [Chiki's Chase](https://github.com/gays-studio/ChikisChaseAPK) | — | 1 | 2025-07-03 | 200 | — |
| 902 | [Dr. Brain Action Reaction](https://github.com/SirHenricus/DrBrainActionReaction_PackageDecomp) | — | 1 | 2025-04-02 | 200 | — |
| 903 | [On The Run 2](https://github.com/caramelcupcakes842/On-The-Run-2-Decomp) | — | 1 | 2024-06-13 | 200 | — |
| 904 | [On The Run: The Getaway](https://github.com/caramelcupcakes842/On-The-Run-The-Getaway) | — | 1 | 2024-06-13 | 200 | — |
| 905 | [Sonic the Hedgehog (DIDJ)](https://github.com/ArchiverXP/sncdecomp) | — | 1 | 2024-01-18 | 200 | — |
| 906 | [Exodus](https://aliveteam.github.io) | — | — | — | 200 | — |
| 907 | [Final Fantasy V](https://www.ff6hacking.com/ff5wiki/images/0/00/Ff5j_asm_Squall.txt) | — | — | — | 200 | — |
| 908 | [Jet Set Radio Future](https://codeberg.org/KeybadeBlox/JSRF-Decompilation) | — | — | — | 200 | — |
| 909 | [Lego Star Wars III: The Clone Wars](https://decomp.dev/ThePlayerRolo/LegoCloneWarsWii) | — | — | — | 200 | — |
| 910 | [Lock's Quest](https://github.com/redraincatching/locksmith) | — | 0 | 2024-08-07 | 200 | — |
| 911 | [Metroid](https://metroiddatabase.com/source-code) | — | — | — | 200 | — |
| 912 | [On The Run Vegas](https://github.com/caramelcupcakes842/On-The-Run-Vegas-Decomp) | — | 0 | 2024-06-13 | 200 | — |
| 913 | [Shadow Hearts](https://git.sr.ht/~benoitren/shadowheartsdecompilation) | — | — | — | 200 | — |
| 914 | [Shin Megami Tensei](https://codeberg.org/Chickenzes/smt-decomp) | — | — | — | 200 | — |
| 915 | [Sonic & Knuckles Collection (1997)](https://git.sr.ht/~benoitren/skccport) | — | — | — | 200 | — |
| 916 | [Sonic the Hedgehog CD (Sonic Gems Collection version)](https://git.sr.ht/~benoitren/soniccddecompilation) | — | — | — | 200 | — |
| 917 | [Streets Of Rage 2](https://www.sor2newera.com) | — | — | — | 200 | — |
| 918 | [Super Cat Tales: PAWS](https://codeberg.org/heathercat123/PAWS-Decomp) | — | — | — | 200 | — |
| 919 | [Super Mario Bros.](https://gist.github.com/1wErt3r/4048722) | — | — | — | 200 | — |
| 920 | [The Spongebob Squarepants Movie](https://decomp.dev/bfbbdecomp/tssm) | — | — | — | 200 | — |

### 2.3 Engine remakes & reimplementations — 409 rows

*Clean-room or reverse-engineered reimplementations of a game's engine; usually need the original assets.*

| # | Title (link = project URL) | Platform | Stars | Last activity | Link | AI |
|--:|---|---|--:|---|:--:|:--:|
| 1 | [Super Hexagon (SuperHaxagon)](https://github.com/RedTopper/Super-Haxagon) | 3DS | 168 | 2025-04-22 | 200 | — |
| 2 | [Open Fodder](https://github.com/OpenFodder/openfodder) | ami | 621 | 2026-10-30 | 200 | — |
| 3 | [Prince of Persia](https://github.com/NagyD/SDLPoP) | Apple II | 1,318 | 2026-11-07 | 200 | — |
| 4 | [Out Run (Cannonball)](https://github.com/djyt/cannonball) | Arcade | 893 | 2022-01-30 | 200 | — |
| 5 | [The House of the Dead (The House of the Dead: ReWrithe)](https://github.com/TawhidI-602/The-House-of-the-Dead-ReWrithe) | Arcade | 159 | 2026-11-14 | 200 | AI |
| 6 | [OutRun (CannonBall DX)](https://github.com/Endprodukt/cannonball-dx) | Arcade | 123 | 2026-10-07 | 200 | AI |
| 7 | [Bagman (bagman (arcade -> 68k transcode))](https://github.com/jotd666/bagman) | Arcade | 23 | 2026-02-28 | 200 | — |
| 8 | [Ms. Pac-Man (mspacman500 (arcade -> 68k transcode))](https://github.com/jotd666/mspacman500) | Arcade | 12 | 2026-08-05 | 200 | — |
| 9 | [Raiders of the Lost Ark (Raiders2600 (fully co…)](https://github.com/halkuncode/Raiders2600) | Atari 2600 | 176 | 2026-03-03 | 200 | — |
| 10 | [Shockolate](https://github.com/Interrupt/systemshock) | DOS | 913 | 2026-10-18 | 200 | — |
| 11 | [remc2](https://github.com/turican0/remc2) | DOS | 156 | 2026-11-15 | 200 | — |
| 12 | [OpenCrystalCaves](https://github.com/OpenCrystalCaves/OpenCrystalCaves) | DOS | 93 | 2026-11-14 | 200 | — |
| 13 | [Shortline railroad](https://github.com/konovalov-aleks/reSL) | DOS | 44 | 2026-08-08 | 200 | — |
| 14 | [F-15 II Enhanced](https://github.com/neuviemeporte/f15se2-ex) | DOS | 33 | 2026-10-20 | 200 | — |
| 15 | [Aces of the Pacific Enhanced](https://github.com/kylofon/acesofthepacific-enhanced) | DOS | 30 | 2026-11-18 | 200 | — |
| 16 | [Tube](https://github.com/rep-stosw/tube64) | DOS | 27 | 2021-08-28 | 200 | — |
| 17 | [Realms of Arkania: Blade of Destiny ( Bright-Eyes)](https://github.com/Henne/BrightEyes) | DOS | 21 | 2025-12-19 | 200 | — |
| 18 | [Test Drive III](https://github.com/kylofon/test-drive-3-sdl3) | DOS | 18 | 2026-10-14 | 200 | — |
| 19 | [Bak-Again](https://github.com/stellargames/bakagain) | DOS | 17 | 2026-11-19 | 200 | — |
| 20 | [Magic Carpet (remc1)](https://github.com/turican0/remc1) | DOS | 13 | 2023-03-21 | 200 | — |
| 21 | [ChuChu Rocket!](https://github.com/TideGear/ChuChu-Rocket-Re-Nyastered) | Dreamcast / GBA / iOS / Android | 1 | 2026-11-19 | 200 | AI |
| 22 | [New Super Mario Bros. DS (Mario vs Luigi Online)](https://github.com/ipodtouch0218/NSMB-MarioVsLuigi) | DS | 1,113 | 2026-09-03 | 200 | — |
| 23 | [guac](https://github.com/aabalke/guac) | DS | 234 | 2026-08-13 | 200 | — |
| 24 | [Metroid Prime Hunters (melonPrimeDS)](https://github.com/makinori/melonPrimeDS) | DS | 139 | 2025-12-01 | 200 | — |
| 25 | [Tetris (agbtetris)](https://github.com/Normmatt/agbtetris) | Game Boy | 18 | 2018-02-16 | 200 | — |
| 26 | [Tetris (Kirpich)](https://github.com/etroimcasso/Kirpich) | Game Boy | 15 | 2026-11-15 | 200 | — |
| 27 | [The Legend of Zelda: Oracle of Ages (ooa-godot)](https://github.com/SHOEGAZEssb/ooa-godot) | Game Boy Color | 20 | 2026-11-16 | 200 | — |
| 28 | [Tails Adventure (Tails Adventure Remake)](https://github.com/mechakotik/tails-adventure) | Game Gear | 162 | 2026-08-26 | 200 | — |
| 29 | [Pokémon Colosseum (Colosseum Launcher)](https://github.com/chasem-dev/orre-launcher) | GameCube | 184 | 2026-11-19 | 200 | AI |
| 30 | [The Legend of Zelda: Twilight Princess (TPVR)](https://github.com/JoeyAW/TPVR) | GameCube | 103 | 2026-11-18 | 200 | AI |
| 31 | [Mega Man Battle Network 6 (OpenNetBattle)](https://github.com/TheMaverickProgrammer/OpenNetBattle) | GBA | 267 | 2025-07-30 | 200 | — |
| 32 | [Pokemon Emerald (Bravely Emerald HD-2D)](https://github.com/marcoscodas/bravely-emerald) | GBA | 105 | 2026-11-17 | 200 | AI |
| 33 | [Sonic 3 & Knuckles (Sonic 3 A.I.R.)](https://github.com/Eukaryot/sonic3air) | Genesis | 693 | 2026-10-24 | 200 | — |
| 34 | [touchHLE](https://github.com/touchHLE/touchHLE) | Mobile | 4,088 | 2026-10-13 | 200 | AI |
| 35 | [Phira](https://github.com/TeamFlos/phira) | Mobile | 2,797 | 2026-11-18 | 200 | AI |
| 36 | [Riiablo](https://github.com/collinsmith/riiablo) | Mobile | 1,111 | 2025-01-13 | 200 | — |
| 37 | [FreeSO](https://github.com/riperiperi/FreeSO) | Mobile | 991 | 2025-08-22 | 200 | — |
| 38 | [OpenVIII](https://github.com/MaKiPL/OpenVIII-monogame) | Mobile | 672 | 2024-10-15 | 200† | — |
| 39 | [Jazz² Resurrection](https://github.com/deathkiller/jazz2) | Mobile | 595 | 2026-10-17 | 200 | — |
| 40 | [Lionheart Remake](https://github.com/b3dgs/lionheart-remake) | Mobile | 88 | 2026-05-24 | 200 | — |
| 41 | [Ultimate MK3 PC](https://github.com/MaryNCRT/Ultimate-Mortal-Kombat-3-iOS-Decompiled) | Mobile | 77 | 2026-11-14 | 200 | AI |
| 42 | [Doom RPG (Mobile RPG Pack)](https://github.com/andreyvelsk/com.mobilerpgpack.phone) | Mobile | 18 | 2026-06-10 | 200 | — |
| 43 | [Mupen64Plus (Rosalie's Mupen GUI)](https://github.com/Rosalie241/RMG) | N64 | 1,156 | 2026-11-04 | 200 | — |
| 44 | [DOOM64-EX-Plus-Enhanced](https://github.com/Styd051/DOOM64-EX-Plus-Enhanced) | N64 | 48 | 2026-08-27 | 200 | — |
| 45 | [Super Mario 64 [Infinite Mario 64 Ever]](https://github.com/Brawmario/infinite-mario-64-ever) | N64 | 15 | 2026-01-18 | 200 | — |
| 46 | [Super Mario Bros. [Remastered]](https://github.com/JHDev2006/Super-Mario-Bros.-Remastered-Public) | NES | 3,334 | 2026-11-14 | 200 | — |
| 47 | [The Legend of Zelda (ZQuest Classic)](https://github.com/ZQuestClassic/ZQuestClassic) | NES | 569 | 2026-11-19 | 200 | AI |
| 48 | [Zelda II: The Adventure of Link (z2rs)](https://github.com/troyedwardsjr/z2rs) | NES | 215 | 2026-10-22 | 200 | AI |
| 49 | [The Nightmare Before Christmas: Oogie's Revenge (Project Oogie)](https://github.com/Pallypots/ProjectOogie) | og xbox | 28 | 2026-11-14 | 200 | AI |
| 50 | [osu](https://github.com/ppy/osu) | PC | 19,484 | 2026-11-18 | 200 | — |
| 51 | [OpenRA](https://github.com/OpenRA/OpenRA) | PC | 17,809 | 2026-11-17 | 200 | — |
| 52 | [RollerCoaster Tycoon 2 (OpenRCT2)](https://github.com/OpenRCT2/OpenRCT2) | PC | 16,591 | 2026-11-18 | 200 | — |
| 53 | [Luanti](https://github.com/luanti-org/luanti) | PC | 13,877 | 2026-11-16 | 200 | AI |
| 54 | [Cataclysm: Dark Days Ahead](https://github.com/CleverRaven/Cataclysm-DDA) | PC | 13,549 | 2026-11-19 | 200 | AI |
| 55 | [Prism Launcher](https://github.com/PrismLauncher/PrismLauncher) | PC | 11,166 | 2026-11-16 | 200 | — |
| 56 | [Diablo (DevilutionX)](https://github.com/diasurgical/DevilutionX) | PC | 10,027 | 2026-11-17 | 200 | AI |
| 57 | [Transport Tycoon Deluxe (OpenTTD)](https://github.com/OpenTTD/OpenTTD) | PC | 8,517 | 2026-11-18 | 200 | — |
| 58 | [The Elder Scrolls III: Morrowind (OpenMW)](https://github.com/OpenMW/openmw) | PC | 6,766 | 2026-11-17 | 200 | — |
| 59 | [Heroes of Might and Magic III (VCMI)](https://github.com/vcmi/vcmi) | PC | 6,037 | 2026-11-18 | 200 | AI |
| 60 | [The Powder Toy](https://github.com/The-Powder-Toy/The-Powder-Toy) | PC | 5,414 | 2026-11-18 | 200 | — |
| 61 | [OpenSC2K](https://github.com/OpenSC2K/OpenSC2K) | PC | 5,373 | 2026-11-16 | 200 | — |
| 62 | [Theme Hospital (CorsixTH)](https://github.com/CorsixTH/CorsixTH) | PC | 4,741 | 2026-11-18 | 200 | AI |
| 63 | [Space Station 14](https://github.com/space-wizards/space-station-14) | PC | 3,908 | 2026-11-19 | 200 | — |
| 64 | [Thrive](https://github.com/Revolutionary-Games/Thrive) | PC | 3,878 | 2026-11-19 | 200 | AI |
| 65 | [Friday Night Funkin](https://github.com/FunkinCrew/Funkin) | PC | 3,845 | 2026-11-02 | 200 | — |
| 66 | [DOSBox-X](https://github.com/joncampbell123/dosbox-x) | PC | 3,813 | 2026-11-19 | 200 | AI |
| 67 | [Cubyz](https://github.com/PixelGuys/Cubyz) | PC | 3,765 | 2026-11-18 | 200 | — |
| 68 | [fheroes2](https://github.com/ihhub/fheroes2) | PC | 3,731 | 2026-11-14 | 200 | — |
| 69 | [Daggerfall Unity](https://github.com/Interkarma/daggerfall-unity) | PC | 3,586 | 2026-11-13 | 200 | — |
| 70 | [Caesar III (Julius)](https://github.com/bvschaik/julius) | PC | 3,457 | 2026-11-13 | 200 | — |
| 71 | [SuperTux](https://github.com/SuperTux/supertux) | PC | 3,207 | 2026-11-10 | 200 | — |
| 72 | [Widelands](https://github.com/widelands/widelands) | PC | 3,130 | 2026-10-29 | 200 | AI |
| 73 | [Dungeon Crawl Stone Soup](https://github.com/crawl/crawl) | PC | 3,081 | 2026-11-18 | 200 | — |
| 74 | [Fallout (Fallout Community Edition)](https://github.com/alexbatalov/fallout1-ce) | PC | 2,995 | 2025-01-15 | 200 | — |
| 75 | [xash3d-fwgs](https://github.com/FWGS/xash3d-fwgs) | PC | 2,956 | 2026-11-17 | 200 | — |
| 76 | [PokeWilds](https://github.com/SheerSt/pokewilds) | PC | 2,931 | 2026-08-16 | 200 | — |
| 77 | [Teeworlds](https://github.com/teeworlds/teeworlds) | PC | 2,655 | 2025-07-12 | 200 | — |
| 78 | [Fallout 2 (Fallout 2 Community Edition)](https://github.com/alexbatalov/fallout2-ce) | PC | 2,519 | 2025-02-16 | 200 | — |
| 79 | [r2modman (r2modmanPlus)](https://github.com/ebkr/r2modmanPlus) | PC | 2,383 | 2026-11-19 | 200 | — |
| 80 | [dhewm3](https://github.com/dhewm/dhewm3) | PC | 2,202 | 2026-11-09 | 200 | — |
| 81 | [Cytopia](https://github.com/CytopiaTeam/Cytopia) | PC | 2,185 | 2026-08-30 | 200 | — |
| 82 | [Caesar III (Augustus)](https://github.com/Keriew/augustus) | PC | 2,157 | 2026-11-17 | 200 | — |
| 83 | [StepMania](https://github.com/stepmania/stepmania) | PC | 2,124 | 2026-11-08 | 200 | — |
| 84 | [Celeste 64: Fragments of the Mountain](https://github.com/EXOK/Celeste64) | PC | 2,065 | 2026-09-07 | 200 | — |
| 85 | [Legend of Sword and Fairy (SDLPal)](https://github.com/sdlpal/sdlpal) | PC | 2,002 | 2026-11-14 | 200 | — |
| 86 | [OpenLoco](https://github.com/OpenLoco/OpenLoco) | PC | 1,975 | 2026-11-14 | 200 | — |
| 87 | [Pioneer Space Simulator](https://github.com/pioneerspacesim/pioneer) | PC | 1,938 | 2026-11-19 | 200 | AI |
| 88 | [Lightspark](https://github.com/lightspark/lightspark) | PC | 1,917 | 2026-11-18 | 200 | — |
| 89 | [RBDOOM-3-BFG](https://github.com/RobertBeckebans/RBDOOM-3-BFG) | PC | 1,870 | 2026-08-07 | 200 | — |
| 90 | [Collapse (Collapse Launcher)](https://github.com/CollapseLauncher/Collapse) | PC | 1,794 | 2026-11-16 | 200 | — |
| 91 | [M.U.G.E.N (Ikemen GO)](https://github.com/ikemen-engine/Ikemen-GO) | PC | 1,700 | 2026-11-18 | 200 | AI |
| 92 | [OpenGothic](https://github.com/Try/OpenGothic) | PC | 1,674 | 2026-11-17 | 200 | — |
| 93 | [Bitburner](https://github.com/bitburner-official/bitburner-src) | PC | 1,649 | 2026-11-18 | 200 | AI |
| 94 | [Tabletop Club](https://github.com/drwhut/tabletop-club) | PC | 1,474 | 2026-08-30 | 200 | — |
| 95 | [OpenTESArena](https://github.com/afritz1/OpenTESArena) | PC | 1,456 | 2026-11-19 | 200 | AI |
| 96 | [PsychEngine](https://github.com/ShadowMario/FNF-PsychEngine) | PC | 1,430 | 2025-03-24 | 200† | — |
| 97 | [Freedoom](https://github.com/freedoom/freedoom) | PC | 1,389 | 2026-11-15 | 200 | — |
| 98 | [Flare: Empyrean Campaign](https://github.com/flareteam/flare-game) | PC | 1,346 | 2026-11-16 | 200 | — |
| 99 | [Cave Story (doukutsu-rs)](https://github.com/doukutsu-rs/doukutsu-rs) | PC | 1,331 | 2026-11-16 | 200 | — |
| 100 | [Cataclysm: Bright Nights](https://github.com/cataclysmbn/Cataclysm-BN) | PC | 1,310 | 2026-11-19 | 200 | AI |
| 101 | [Grand Theft Auto: San Andreas](https://github.com/gta-reversed/gta-reversed) | PC | 1,307 | 2026-11-18 | 200 | — |
| 102 | [OpenBOR](https://github.com/DCurrent/openbor) | PC | 1,293 | 2026-11-12 | 200 | AI |
| 103 | [Carmageddon (dethrace)](https://github.com/dethrace-labs/dethrace) | PC | 1,259 | 2026-11-16 | 200 | — |
| 104 | [Call of Duty: Modern Warfare 2 (IW4L)](https://github.com/vladtrc/iw4L) | PC | 1,211 | 2026-10-16 | 200 | — |
| 105 | [Star Wars: Dark Forces (The Force Engine)](https://github.com/TheForceEngine/TheForceEngine) | PC | 1,190 | 2026-11-14 | 200 | — |
| 106 | [That Trademark, the Roguelike (DRL)](https://github.com/chaosforgeorg/drl) | PC | 1,189 | 2026-11-18 | 200 | AI |
| 107 | [ironwail](https://github.com/andrei-drexler/ironwail) | PC | 1,162 | 2026-11-17 | 200 | — |
| 108 | [Tuxemon](https://github.com/Tuxemon/Tuxemon) | PC | 1,158 | 2026-11-16 | 200 | AI |
| 109 | [SurrealEngine](https://github.com/dpjudas/SurrealEngine) | PC | 1,143 | 2026-11-15 | 200 | — |
| 110 | [Unvanquished](https://github.com/Unvanquished/Unvanquished) | PC | 1,132 | 2026-11-18 | 200 | — |
| 111 | [Arx Libertatis](https://github.com/arx/ArxLibertatis) | PC | 1,122 | 2024-08-22 | 200 | — |
| 112 | [C-Dogs SDL](https://github.com/cxong/cdogs-sdl) | PC | 1,111 | 2026-11-16 | 200 | — |
| 113 | [AssaultCube](https://github.com/assaultcube/AC) | PC | 1,096 | 2023-06-17 | 200 | — |
| 114 | [freeorion](https://github.com/freeorion/freeorion) | PC | 1,066 | 2026-11-18 | 200 | — |
| 115 | [Reloaded II](https://github.com/Reloaded-Project/Reloaded-II) | PC | 1,054 | 2026-09-23 | 200 | — |
| 116 | [KeeperFX](https://github.com/dkfans/keeperfx) | PC | 1,052 | 2026-11-18 | 200 | — |
| 117 | [Tomb Raider I & II](https://github.com/LostArtefacts/TRX) | PC | 1,045 | 2026-11-15 | 200 | — |
| 118 | [Rigel Engine](https://github.com/lethal-guitar/RigelEngine) | PC | 1,021 | 2026-09-28 | 200 | — |
| 119 | [Counter-Strike: Football](https://github.com/solcloud/Counter-Strike) | PC | 988 | 2025-09-09 | 200 | — |
| 120 | [World of Warcraft 1.12 (benilla)](https://github.com/samwhosung/benilla) | PC | 965 | 2026-11-17 | 200 | — |
| 121 | [Unnamed SDVX Clone](https://github.com/Drewol/unnamed-sdvx-clone) | PC | 950 | 2026-10-24 | 200 | — |
| 122 | [Plants vs. Zombies (PvZ Portable)](https://github.com/wszqkzqk/PvZ-Portable) | PC | 933 | 2026-11-18 | 200 | — |
| 123 | [OpenEnroth](https://github.com/OpenEnroth/OpenEnroth) | PC | 891 | 2026-11-13 | 200 | AI |
| 124 | [OpenMoHAA](https://github.com/openmoh/openmohaa) | PC | 878 | 2026-04-23 | 200 | — |
| 125 | [EmptyEpsilon](https://github.com/daid/EmptyEpsilon) | PC | 872 | 2026-11-19 | 200 | AI |
| 126 | [LibreQuake](https://github.com/lavenderdotpet/LibreQuake) | PC | 868 | 2026-11-16 | 200 | — |
| 127 | [Fallout 1 (Fallout Et Tu)](https://github.com/rotators/Fo1in2) | PC | 856 | 2026-11-03 | 200 | — |
| 128 | [Aleph One](https://github.com/Aleph-One-Marathon/alephone) | PC | 827 | 2026-11-14 | 200 | — |
| 129 | [OpenTTD (OpenTTD-patches)](https://github.com/JGRennison/OpenTTD-patches) | PC | 817 | 2026-11-16 | 200 | — |
| 130 | [Need for Speed II: Special Edition (NFSIISE)](https://github.com/zaps166/NFSIISE) | PC | 799 | 2026-05-01 | 200 | — |
| 131 | [Star Wars Jedi Knight: Dark Forces II (OpenJKDF2)](https://github.com/shinyquagsire23/OpenJKDF2) | PC | 797 | 2026-11-01 | 200 | — |
| 132 | [LEGO Universe (DarkflameServer)](https://github.com/DarkflameUniverse/DarkflameServer) | PC | 768 | 2026-10-29 | 200 | AI |
| 133 | [Colonization (FreeCol)](https://github.com/FreeCol/freecol) | PC | 728 | 2026-11-12 | 200 | AI |
| 134 | [HITMAN World of Assassination Trilogy (The Peacock Project)](https://github.com/thepeacockproject/Peacock) | PC | 713 | 2026-11-12 | 200 | — |
| 135 | [Exult](https://github.com/exult/exult) | PC | 711 | 2026-11-17 | 200 | — |
| 136 | [ludo](https://github.com/libretro/ludo) | PC | 707 | 2026-10-22 | 200 | — |
| 137 | [OpenCiv3](https://github.com/C7-Game/OpenCiv3) | PC | 699 | 2026-11-16 | 200 | — |
| 138 | [GLSMAC](https://github.com/afwbkbc/glsmac) | PC | 663 | 2026-11-16 | 200 | AI |
| 139 | [LinCity-NG: A city simulation game](https://github.com/lincity-ng/lincity-ng) | PC | 653 | 2026-10-05 | 200 | AI |
| 140 | [Nox (OpenNox)](https://github.com/opennox/opennox) | PC | 649 | 2026-09-21 | 200 | — |
| 141 | [Command & Conquer: Tiberian Sun (OpenTS)](https://github.com/OpenTS-Developers/OpenTS) | PC | 638 | 2026-11-16 | 200 | AI |
| 142 | [OpenTyrian](https://github.com/opentyrian/opentyrian) | PC | 615 | 2026-11-02 | 200 | — |
| 143 | [OpenApocalypse](https://github.com/OpenApoc/OpenApoc) | PC | 609 | 2026-09-16 | 200 | — |
| 144 | [Museum of All Things](https://github.com/m4ym4y/museum-of-all-things) | PC | 583 | 2026-11-06 | 200 | — |
| 145 | [Doom (Helion Engine)](https://github.com/Helion-Engine/Helion) | PC | 578 | 2026-11-16 | 200 | — |
| 146 | [Sonic Robo Blast 2](https://github.com/STJr/SRB2) | PC | 576 | 2025-07-29 | 200 | — |
| 147 | [Marvel Heroes (MHServerEmu)](https://github.com/Crypto137/MHServerEmu) | PC | 572 | 2026-11-16 | 200 | — |
| 148 | [Victoria 2 (Project Alice)](https://github.com/schombert/Project-Alice) | PC | 567 | 2026-11-19 | 200 | — |
| 149 | [Ambermoon](https://github.com/Pyrdacor/Ambermoon.net) | PC | 563 | 2026-11-17 | 200 | AI |
| 150 | [Jagged Alliance Stracciatella](https://github.com/ja2-stracciatella/ja2-stracciatella) | PC | 550 | 2026-11-18 | 200 | AI |
| 151 | [Metroid II: Return of Samus (AM2RLauncher)](https://github.com/AM2R-Community-Developers/AM2RLauncher) | PC | 547 | 2026-09-22 | 200 | — |
| 152 | [Red Eclipse](https://github.com/redeclipse/base) | PC | 545 | 2026-11-19 | 200 | AI |
| 153 | [Pharaoh (Akhenaten)](https://github.com/dalerank/Akhenaten) | PC | 537 | 2026-11-18 | 200 | AI |
| 154 | [Tomb Raider: Chronicles](https://github.com/TOMB5/TOMB5) | PC | 522 | 2021-03-07 | 200 | — |
| 155 | [Bugdom](https://github.com/jorio/Bugdom) | PC | 516 | 2025-03-08 | 200 | — |
| 156 | [Hedge Mod Manager](https://github.com/thesupersonic16/HedgeModManager) | PC | 508 | 2026-06-28 | 200 | — |
| 157 | [openomf](https://github.com/omf2097/openomf) | PC | 508 | 2026-11-18 | 200 | — |
| 158 | [donut](https://github.com/plowteam/donut) | PC | 490 | 2021-05-11 | 200 | — |
| 159 | [Surge the Rabbit (Open Surge Engine)](https://github.com/alemart/opensurge) | PC | 487 | 2026-10-09 | 200 | — |
| 160 | [Oddworld 1-2](https://github.com/AliveTeam/alive_reversing) | PC | 457 | 2026-10-26 | 200 | — |
| 161 | [Wargus](https://github.com/Wargus/wargus) | PC | 453 | 2026-11-16 | 200 | — |
| 162 | [Neverball](https://github.com/Neverball/neverball) | PC | 452 | 2026-11-19 | 200 | AI |
| 163 | [Cataclysm: The Last Generation](https://github.com/Cataclysm-TLG/Cataclysm-TLG) | PC | 440 | 2026-11-19 | 200 | — |
| 164 | [Albion (SR)](https://github.com/M-HT/SR) | PC | 439 | 2026-08-27 | 200 | — |
| 165 | [Adventures of Demo (TheXTech)](https://github.com/TheXTech/TheXTech) | PC | 431 | 2026-11-14 | 200 | — |
| 166 | [Mr. Rescue](https://github.com/SimonLarsen/mrrescue) | PC | 430 | 2018-08-18 | 200 | — |
| 167 | [SRB2Kart](https://github.com/STJr/Kart-Public) | PC | 426 | 2024-03-31 | 200 | — |
| 168 | [OpenJazz](https://github.com/AlisterT/openjazz) | PC | 423 | 2026-09-01 | 200 | — |
| 169 | [MegaGlest](https://github.com/MegaGlest/megaglest-source) | PC | 420 | 2026-05-31 | 200 | AI |
| 170 | [Dune-II---The-Maker](https://github.com/stefanhendriks/Dune-II---The-Maker) | PC | 378 | 2026-11-19 | 200 | AI |
| 171 | [BStone](https://github.com/bibendovsky/bstone) | PC | 376 | 2026-05-27 | 200 | — |
| 172 | [Libre TrainSim](https://github.com/Libre-TrainSim/Libre-TrainSim) | PC | 376 | 2024-09-17 | 200 | — |
| 173 | [Vega Strike](https://github.com/vegastrike/Vega-Strike-Engine-Source) | PC | 370 | 2026-11-18 | 200 | — |
| 174 | [Quetoo](https://github.com/jdolan/quetoo) | PC | 350 | 2026-11-18 | 200 | AI |
| 175 | [Dr. Robotnik's Ring Racers](https://github.com/KartKrewDev/RingRacers) | PC | 348 | 2026-08-31 | 200 | — |
| 176 | [Romanov's Vengeance](https://github.com/MustaphaTR/Romanovs-Vengeance) | PC | 348 | 2025-07-26 | 200 | — |
| 177 | [Cortex Command Community Project](https://github.com/cortex-command-community/Cortex-Command-Community-Project) | PC | 345 | 2026-11-12 | 200 | AI |
| 178 | [Dust Racing 2D](https://github.com/juzzlin/DustRacing2D) | PC | 342 | 2026-11-15 | 200 | — |
| 179 | [Wyrmsun](https://github.com/Andrettin/Wyrmsun) | PC | 334 | 2025-04-17 | 200 | — |
| 180 | [Titanfall 2 (Northstar Launcher)](https://github.com/R2Northstar/NorthstarLauncher) | PC | 320 | 2026-11-06 | 200 | — |
| 181 | [Supaplex (OpenSupaplex)](https://github.com/sergiou87/open-supaplex) | PC | 313 | 2026-10-23 | 200 | AI |
| 182 | [Slippi Launcher](https://github.com/project-slippi/slippi-launcher) | PC | 312 | 2026-11-19 | 200 | AI |
| 183 | [TimeSplitters 2 (TS2 Redux)](https://github.com/HFTSRedux/TS2Redux) | PC | 301 | 2023-09-07 | 200 | — |
| 184 | [AstroMenace](https://github.com/viewizard/astromenace) | PC | 297 | 2026-08-06 | 200 | AI |
| 185 | [BetterSpades](https://github.com/xtreme8000/BetterSpades) | PC | 286 | 2025-07-30 | 200 | — |
| 186 | [Heretic2R](https://github.com/m-x-d/Heretic2R) | PC | 280 | 2026-08-21 | 200 | — |
| 187 | [Syndicate Wars](https://github.com/swfans/syndwarsfx) | PC | 276 | 2026-11-05 | 200 | — |
| 188 | [Freeciv21](https://github.com/longturn/freeciv21) | PC | 275 | 2026-11-06 | 200 | — |
| 189 | [Homestuck (Unofficial Homestuck Collection)](https://github.com/GiovanH/unofficial-homestuck-collection) | PC | 266 | 2026-04-21 | 200 | — |
| 190 | [Spelunky Classic (Spelunky Classic HD)](https://github.com/yancharkin/SpelunkyClassicHD) | PC | 261 | 2026-08-25 | 200 | — |
| 191 | [RollerCoaster Tycoon (FreeRCT)](https://github.com/FreeRCT/FreeRCT) | PC | 257 | 2026-10-08 | 200 | — |
| 192 | [Celeste Classic](https://github.com/lemon32767/ccleste) | PC | 256 | 2021-11-24 | 200† | — |
| 193 | [Total Annihilation (Nanolathe)](https://github.com/nanolathe-gg/nanolathe) | PC | 254 | 2026-11-17 | 200 | AI |
| 194 | [OpenZ](https://github.com/playopenz/OpenZ) | PC | 244 | 2026-11-18 | 200 | — |
| 195 | [Rayman Control Panel](https://github.com/RayCarrot/RaymanControlPanel) | PC | 230 | 2026-07-10 | 200 | — |
| 196 | [Club Penguin (Waddle Forever)](https://github.com/nhaar/Waddle-Forever) | PC | 219 | 2026-10-24 | 200 | — |
| 197 | [Mighty Mike](https://github.com/jorio/MightyMike) | PC | 217 | 2025-12-07 | 200 | — |
| 198 | [Python Patcher (07th-Mod Python Patcher)](https://github.com/07th-mod/python-patcher) | PC | 216 | 2026-11-04 | 200 | — |
| 199 | [Diablo II (D2MOO)](https://github.com/ThePhrozenKeep/D2MOO) | PC | 209 | 2026-11-15 | 200 | — |
| 200 | [Midtown Madness 1](https://github.com/0x1F9F1/Open1560) | PC | 207 | 2026-04-20 | 200 | — |
| 201 | [Threadbare](https://github.com/endlessm/threadbare) | PC | 206 | 2026-11-13 | 200 | AI |
| 202 | [Grand Theft Auto III (re3)](https://github.com/leanndroguedes/re3-19feb21) | PC | 204 | 2021-02-19 | 200† | — |
| 203 | [Crimsonland](https://github.com/banteg/crimson) | PC | 200 | 2026-11-19 | 200 | — |
| 204 | [Serious Sam Classic The First Encounter](https://github.com/tx00100xt/SeriousSamClassic) | PC | 197 | 2026-01-13 | 200 | — |
| 205 | [Zeus: Master of Olympus (eZeus)](https://github.com/MaurycyLiebner/eZeus) | PC | 195 | 2026-11-17 | 200 | — |
| 206 | [Combined Arms (Combined Arms (OpenRA))](https://github.com/Inq8/CAmod) | PC | 194 | 2026-09-30 | 200 | — |
| 207 | [Otto Matic](https://github.com/jorio/OttoMatic) | PC | 186 | 2025-09-28 | 200 | — |
| 208 | [Unverum](https://github.com/TekkaGB/Unverum) | PC | 184 | 2025-01-22 | 200 | — |
| 209 | [Chasm-Reverse](https://github.com/Panzerschrek/Chasm-Reverse) | PC | 182 | 2025-12-09 | 200 | — |
| 210 | [Command & Conquer: Yuri's Revenge (OpenRA Red Alert 2 Yuri's Revenge)](https://github.com/cookgreen/Yuris-Revenge) | PC | 182 | 2024-11-30 | 200 | — |
| 211 | [freeserf.net](https://github.com/Pyrdacor/freeserf.net) | PC | 182 | 2026-10-24 | 200 | AI |
| 212 | [ForsakenX](https://github.com/ForsakenX/forsaken) | PC | 181 | 2024-07-16 | 200 | — |
| 213 | [Cro-Mag Rally](https://github.com/jorio/CroMagRally) | PC | 179 | 2025-08-26 | 200 | — |
| 214 | [Ultima Online (CrossUO)](https://github.com/crossuo/crossuo) | PC | 179 | 2026-11-03 | 200 | — |
| 215 | [Creatures (OpenC2E)](https://github.com/openc2e/openc2e) | PC | 175 | 2026-10-07 | 200 | — |
| 216 | [Dune II (Dune Dynasty)](https://github.com/gameflorist/dunedynasty) | PC | 173 | 2026-11-02 | 200 | AI |
| 217 | [Enigma](https://github.com/Enigma-Game/Enigma) | PC | 173 | 2026-09-17 | 200 | — |
| 218 | [Project I.G.I.: I'm Going In (OpenIGI)](https://github.com/OpenIGI/OpenIGI) | PC | 172 | 2026-11-14 | 200 | AI |
| 219 | [GnollHack](https://github.com/hyvanmielenpelit/GnollHack) | PC | 170 | 2026-11-18 | 200 | AI |
| 220 | [Lix](https://github.com/SimonN/LixD) | PC | 168 | 2026-10-11 | 200 | — |
| 221 | [mc2](https://github.com/alariq/mc2) | PC | 166 | 2026-08-30 | 200 | — |
| 222 | [Titanfall 1 (R1Delta)](https://github.com/r1delta/r1delta) | PC | 166 | 2026-11-18 | 200 | — |
| 223 | [SeriousSamClassic-VK](https://github.com/tx00100xt/SeriousSamClassic-VK) | PC | 163 | 2026-01-14 | 200 | — |
| 224 | [Elona (OpenNefia)](https://github.com/OpenNefia/OpenNefia) | PC | 162 | 2024-01-23 | 200 | — |
| 225 | [thinker](https://github.com/induktio/thinker) | PC | 159 | 2026-11-12 | 200 | — |
| 226 | [Alone in the Dark (Alone In The Dark: Re-Haunted)](https://github.com/spacefarergames/AloneInTheDarkReHaunted) | PC | 156 | 2026-11-09 | 200 | — |
| 227 | [OPHD](https://github.com/OutpostUniverse/OPHD) | PC | 148 | 2026-11-12 | 200 | — |
| 228 | [Keen Dreams (ReflectionHLE)](https://github.com/ReflectionHLE/ReflectionHLE) | PC | 146 | 2026-10-31 | 200 | — |
| 229 | [ddnet t-client](https://github.com/TaterClient/TClient) | PC | 145 | 2026-11-03 | 200 | AI |
| 230 | [Grand Theft Auto 2](https://github.com/CriminalRETeam/gta2_re) | PC | 142 | 2026-10-29 | 200 | — |
| 231 | [Warcraft: Orcs & Humans (War1gus)](https://github.com/Wargus/war1gus) | PC | 140 | 2026-11-16 | 200 | — |
| 232 | [Prey (Prey2006)](https://github.com/FriskTheFallenHuman/Prey2006) | PC | 139 | 2026-09-04 | 200 | — |
| 233 | [Syobon Action (OpenSyobonAction)](https://github.com/akemin-dayo/OpenSyobonAction) | PC | 136 | 2017-07-06 | 200 | — |
| 234 | [Falcon BMS Alternative Launcher](https://github.com/chihirobelmo/FalconBMS-Alternative-Launcher) | PC | 132 | 2024-01-21 | 200 | — |
| 235 | [The Great Escape in C](https://github.com/dpt/The-Great-Escape-in-C) | PC | 132 | 2026-11-05 | 200 | — |
| 236 | [OpenKrush](https://github.com/IceReaper/OpenKrush) | PC | 129 | 2025-11-17 | 200 | — |
| 237 | [3D Movie Maker (3DMMEx)](https://github.com/benstone/3DMMEx) | PC | 128 | 2026-11-06 | 200 | — |
| 238 | [Katawa Shoujo (Katawa Shoujo: Re-Engineered)](https://github.com/fleetingheart/ksre) | PC | 127 | 2026-10-12 | 200 | — |
| 239 | [OpenSA](https://github.com/Dzierzan/OpenSA) | PC | 126 | 2023-09-29 | 200 | — |
| 240 | [Gabriel Knight 3: Blood of the Sacred, Blood of the Damned (G-Engine)](https://github.com/kromenak/gengine) | PC | 125 | 2026-11-01 | 200 | — |
| 241 | [Feudal Tactics - Medieval Strategy Game](https://github.com/Sesu8642/FeudalTactics) | PC | 124 | 2026-10-19 | 200 | — |
| 242 | [Magic Carpet 2 (Magic Carpet 2 HD)](https://github.com/thobbsinteractive/magic-carpet-2-hd) | PC | 123 | 2026-11-17 | 200 | AI |
| 243 | [Chu Chu Rocket (Duck Marines)](https://github.com/SimonLarsen/duckmarines) | PC | 122 | 2016-05-10 | 200 | — |
| 244 | [Sopwith (SDL Sopwith)](https://github.com/fragglet/sdl-sopwith) | PC | 122 | 2026-11-13 | 200 | — |
| 245 | [Shin Ryu Mod Manager](https://github.com/SRMM-Studio/ShinRyuModManager) | PC | 120 | 2026-11-11 | 200 | — |
| 246 | [Unhaunter](https://github.com/deavid/unhaunter) | PC | 118 | 2025-07-10 | 200 | AI |
| 247 | [1oom](https://github.com/1oom-fork/1oom) | PC | 116 | 2026-09-02 | 200 | — |
| 248 | [Knytt Stories (YKnytt)](https://github.com/youkaicountry/yknytt) | PC | 109 | 2026-11-12 | 200 | — |
| 249 | [Nanosaur II: Hatchling (Nanosaur 2)](https://github.com/jorio/Nanosaur2) | PC | 109 | 2025-12-07 | 200 | — |
| 250 | [MDK (mdk-sdl)](https://github.com/nautilusbits/mdk-sdl) | PC | 105 | 2026-11-06 | 200 | AI |
| 251 | [Fish Folk (Spicy Launcher)](https://github.com/spicylobstergames/SpicyLauncher) | PC | 104 | 2025-10-03 | 200 | — |
| 252 | [Usurper Reborn](https://github.com/binary-knight/usurper-reborn) | PC | 101 | 2026-11-15 | 200 | AI |
| 253 | [OutRun](https://github.com/ZgzInfinity/OutRun) | PC | 98 | 2026-10-11 | 200 | — |
| 254 | [Glider PRO (Aerofoil)](https://github.com/elasota/Aerofoil) | PC | 97 | 2026-10-26 | 200 | — |
| 255 | [Open Annihilation](https://github.com/open-annihilation/open-annihilation) | PC | 97 | 2026-11-19 | 200 | AI |
| 256 | [Freegish](https://github.com/freegish/freegish) | PC | 90 | 2026-10-20 | 200 | — |
| 257 | [Shattered Paradise](https://github.com/ABrandau/Shattered-Paradise-SDK) | PC | 85 | 2025-09-27 | 200 | — |
| 258 | [Moon Child (Moon Child FE)](https://github.com/MorsGames/MoonChildFE) | PC | 84 | 2026-08-12 | 200 | — |
| 259 | [AM2R: Another Metroid 2 Remake (AM2R (Android))](https://github.com/PatchDev-AM2ARM/AM2R-Autopatcher-Android) | PC | 83 | 2026-11-01 | 200 | — |
| 260 | [Star Wars Episode I: The Phantom Menace (OpenPhantom)](https://github.com/OpenPhantom/OpenPhantom) | PC | 81 | 2026-10-05 | 200 | — |
| 261 | [OpenE2140](https://github.com/OpenE2140/OpenE2140) | PC | 79 | 2026-11-17 | 200 | — |
| 262 | [dRally](https://github.com/urxp/dRally) | PC | 78 | 2023-07-26 | 200 | — |
| 263 | [Diablo II (Redivivus)](https://github.com/jaenster/redivivus) | PC | 74 | 2026-11-18 | 200 | — |
| 264 | [rebellion2](https://github.com/davidadas/rebellion2) | PC | 69 | 2026-11-19 | 200 | — |
| 265 | [Ultima 5](https://github.com/synthwave-pixel/ultima5) | PC | 62 | 2026-11-19 | 200 | AI |
| 266 | [Stronghold Crusader (OpenSHC)](https://github.com/sourcehold/OpenSHC) | PC | 57 | 2026-11-18 | 200 | — |
| 267 | [Tyrian 2000 (OpenTyrian2000)](https://github.com/andyvand/opentyrian2000) | PC | 57 | 2026-11-13 | 200 | — |
| 268 | [OpenReliant](https://github.com/OpenReliant/openreliant) | PC | 55 | 2026-11-19 | 200 | AI |
| 269 | [Flipendo](https://github.com/kroplabeskidu/flipendo) | PC | 52 | 2026-11-19 | 200 | AI |
| 270 | [maxr](https://github.com/maxr-dot-org/maxr) | PC | 51 | 2026-11-14 | 200 | AI |
| 271 | [machines](https://github.com/WiredForWar/machines) | PC | 50 | 2026-10-03 | 200 | — |
| 272 | [Underworld Revisited](https://github.com/PQMarine/UnderworldRevisited) | PC | 42 | 2026-11-16 | 200 | AI |
| 273 | [Billy Frontier](https://github.com/jorio/BillyFrontier) | PC | 41 | 2025-12-07 | 200 | — |
| 274 | [Sheep, Dog 'n' Wolf (Sheep, Dog 'n' Wolf: Rewooled)](https://github.com/SDW-Community/Sheep-Dog-n-Wolf-Rewooled) | PC | 40 | 2026-10-21 | 200 | AI |
| 275 | [Test Drive III Enhanced](https://github.com/kylofon/testdrive3-enhanced) | PC | 39 | 2026-10-14 | 200 | AI |
| 276 | [xGreed](https://github.com/jval1972/xGreed) | PC | 39 | 2022-03-19 | 200 | — |
| 277 | [OmegA-engine](https://github.com/Bishop-333/OmegA-engine) | PC | 38 | 2026-11-18 | 200 | — |
| 278 | [EmperorReborn](https://github.com/azmawee/EmperorReborn) | PC | 32 | 2026-11-15 | 200 | — |
| 279 | [Urban Chaos (OpenChaos)](https://github.com/UltimaBeaR/OpenChaos) | PC | 27 | 2026-11-04 | 200 | AI |
| 280 | [Test Drive Enhanced](https://github.com/kylofon/testdrive-enhanced) | PC | 26 | 2026-11-11 | 200 | AI |
| 281 | [Herculan](https://github.com/kevinfoley/Herculan) | PC | 22 | 2026-11-19 | 200 | AI |
| 282 | [OpenMCM2](https://github.com/crspytopgn/openmcm2) | PC | 22 | 2026-11-18 | 200 | AI |
| 283 | [Syndicate (1992)](https://github.com/swfans/syndicatfx) | PC | 20 | 2025-12-17 | 200 | — |
| 284 | [Test Drive II Enhanced](https://github.com/kylofon/testdrive2-enhanced) | PC | 20 | 2026-10-14 | 200 | AI |
| 285 | [Zoo Tycoon 1 engine (zt1-engine)](https://github.com/AlexC1991/zt1-engine) | PC | 17 | 2026-11-19 | 200 | — |
| 286 | [SimCity 4 (DeSCAi4)](https://github.com/CadenKalez/DeSCAi4) | PC | 12 | 2026-10-30 | 200 | AI |
| 287 | [retruxx](https://github.com/mindflower/retruxx) | PC | 11 | 2026-10-15 | 200 | — |
| 288 | [Bloodborne PSX (BBPSX-Decompilation)](https://github.com/SonyEntertainmentNetwork/BBPSX-Decompilation) | PC | 10 | 2022-04-22 | 200 | — |
| 289 | [Chrono Cross: The Radical Dreamers Edition](https://github.com/sp-hy/OpenCross) | PC (Windows) / PS1 | 32 | 2026-11-18 | 200 | AI |
| 290 | [Wipeout](https://github.com/phoboslab/wipeout-rewrite) | PS1 | 3,011 | 2026-09-27 | 200 | — |
| 291 | [Xenogears (Weltall)](https://github.com/Roman215/Weltall) | PS1 | 201 | 2026-11-11 | 200 | AI |
| 292 | [Dino Crisis (Dino Crisis - Modern Edition)](https://github.com/Rotmill/Dino-Crisis-Modern-Edition) | PS1 | 175 | 2026-11-01 | 200 | AI |
| 293 | [Jackie Chan Stuntmaster (ReChan)](https://github.com/SilverwireGames/ReChan) | PS1 | 75 | 2026-10-29 | 200 | — |
| 294 | [007: The World Is Not Enough (TWINE-pc)](https://github.com/CipherNovaa/twine-pc) | PS1 | 61 | 2026-10-31 | 200 | AI |
| 295 | [Street Fighter III: 3rd Strike [3SX]](https://github.com/crowded-street/3sx) | PS2 | 382 | 2026-11-11 | 200 | — |
| 296 | [Gran Turismo 3 A-Spec (GT3 Revisited)](https://github.com/matt-pulsipher/GT3-revisited) | PS2 | 336 | 2026-11-18 | 200 | AI |
| 297 | [Castlevania: Remnants of Darkness](https://github.com/GianImpr/Castlevania-Remnants-of-Darkness) | PS2 | 293 | 2026-11-12 | 200 | — |
| 298 | [Ratchet & Clank (ReRAC Launcher)](https://github.com/re-rac/rerac-launcher) | PS2 | 179 | 2026-10-23 | 200 | AI |
| 299 | [Midnight Club II (OpenMC2)](https://github.com/OpenMC2/OpenMC2) | PS2 | 175 | 2023-06-16 | 200 | — |
| 300 | [Dragon Ball Z: Budokai Tenkaichi 4](https://github.com/NauTaro/DBZ-BT4-Tag-Team-Decomp) | PS2 | 130 | 2026-11-19 | 200 | — |
| 301 | [Crash Bandicoot: The Wrath of Cortex](https://github.com/denzi-gh/crashwoc-nuworld) | PS2 | 89 | 2026-11-19 | 200 | AI |
| 302 | [Ratchet & Clank (rac1-decomp (OpenRAC))](https://github.com/OpenRAC/rac1-decomp) | PS2 | 79 | 2026-11-15 | 200 | — |
| 303 | [Street Fighter III: 3rd Strike [3SXW]](https://github.com/guimaraf/3sxw) | PS2 | 71 | 2026-10-29 | 200 | — |
| 304 | [Fatal Frame II: Crimson Butterfly (Mikompilation (FF2 engine))](https://github.com/Mikompilation/Mikompilation) | PS2 | 60 | 2024-02-06 | 200 | — |
| 305 | [Stuntman (Stuntman PC)](https://github.com/LAB0ULANGE/stuntman-pc) | PS2 | 32 | 2026-11-07 | 200 | AI |
| 306 | [Gran Turismo 6 (Gran Turismo 6 PC)](https://github.com/Mabec-games/Gran-Turismo-6-PC) | PS3 | 228 | 2026-11-12 | 200 | AI |
| 307 | [P.T. (P.T. for PC)](https://github.com/LoreanXavier/pt-pc) | PS4 | 2,518 | 2026-11-08 | 200 | AI |
| 308 | [The Last of Us Remastered (tlou-remastered-pc)](https://github.com/ravencaio/tlou-remastered-pc) | PS4 | 365 | 2026-11-15 | 200 | AI |
| 309 | [Gravity Rush 2 (GR2port)](https://github.com/junminlee2004/GR2port) | PS4 | 206 | 2026-11-19 | 200 | — |
| 310 | [Ratchet & Clank (RatchetPort)](https://github.com/shehab4546/RatchetPort) | PS4 | 175 | 2026-10-28 | 200 | AI |
| 311 | [Sonic R (sonic-r (jnmartin84))](https://github.com/jnmartin84/sonic-r) | Saturn | 39 | 2026-11-10 | 200 | AI |
| 312 | [The Legend of Zelda: A Link to the Past (zelda3)](https://github.com/snesrev/zelda3) | SNES | 5,019 | 2026-10-02 | 200 | AI |
| 313 | [Super Mario World (Super Mario World Remastered)](https://github.com/JHDev2006/Super-Mario-World-Remastered-Public) | SNES | 282 | 2025-05-14 | 200† | — |
| 314 | [Chrono Trigger](https://github.com/zdiemer/chrono-trigger-reimplemented) | SNES | 13 | 2026-11-18 | 200 | — |
| 315 | [Bayonetta 3 (Witch Time)](https://github.com/Zexyen/Witch-Time) | Switch | 417 | 2026-11-18 | 200 | AI |
| 316 | [The Legend of Zelda: Tears of the Kingdom (TOTKDroid)](https://github.com/mamcjr/TOTKDroid) | Switch | 315 | 2026-11-17 | 200 | AI |
| 317 | [Kirby's Return to Dream Land Deluxe (Kirby Redream)](https://github.com/josiahg2502-glitch/Kirby-Redream) | Switch | 16 | 2026-11-07 | 200 | AI |
| 318 | [Link's Awakening (Switch)](https://github.com/Owen-Splat/las-decomp) | Switch | 12 | 2026-03-21 | 200 | — |
| 319 | [The Legend of Zelda: Ocarina of Time (Project ReLink)](https://github.com/pixl27/ProjectReLink) | switch2 | 470 | 2026-11-19 | 200 | AI |
| 320 | [The Legend of Zelda: Ocarina of Time (HeyListen)](https://github.com/Sacrappy/HeyListen) | switch2 | 224 | 2026-11-19 | 200 | AI |
| 321 | [Sonic and the Secret Rings (Project Reignition)](https://github.com/kumapauz/project-reignition) | Wii | 314 | 2026-09-25 | 200 | — |
| 322 | [Runescape (2003)](https://github.com/2003scape/rsc-c) | Wii | 137 | 2026-10-19 | 200 | — |
| 323 | [Super Smash Bros. Brawl (BrawlModules)](https://github.com/Sammi-Husky/BrawlModules) | Wii | 14 | 2026-09-30 | 200 | — |
| 324 | [Tekken Tag Tournament 2 Wii U Edition (Tekken Tag 2 Ultimate Edition)](https://github.com/Petexy/Tekken-Tag-2-Ultimate-Edition) | Wii U | 151 | 2026-11-18 | 200 | AI |
| 325 | [Skate 3 (Skate 3 Rust Engine)](https://github.com/SK8-ENGINE/skate-3-rust-engine) | Xbox 360 | 809 | 2026-10-09 | 200 | — |
| 326 | [Call of Duty: Black Ops (WebGPU))](https://github.com/SwagSoftware/KisakBlack) | Xbox 360 | 243 | 2026-11-14 | 200 | — |
| 327 | [Battlefield 1943 (Battlefield 1943 Reborn)](https://github.com/TekRantGaming/Battlefield-1943-Reborn) | Xbox 360 | 155 | 2026-11-19 | 200 | AI |
| 328 | [Midnight Club: Los Angeles Complete Edition (Rusty MCLA)](https://github.com/holdmysocks/rusty-mcla) | Xbox 360 | 124 | 2026-11-17 | 200 | — |
| 329 | [openage](https://github.com/SFTtech/openage) | — | 14,614 | 2026-11-17 | 200 | — |
| 330 | [Diablo](https://github.com/diasurgical/devilution) | — | 9,020 | 2025-09-15 | 200 | — |
| 331 | [Awesome Open Source Games](https://github.com/michelpereira/awesome-open-source-games) | — | 3,427 | 2026-11-16 | 200 | — |
| 332 | [ScummVM](https://github.com/scummvm/scummvm) | — | 2,899 | 2026-11-19 | 200 | — |
| 333 | [permafrost-engine](https://github.com/eduard-permyakov/permafrost-engine) | — | 2,774 | 2026-11-17 | 200 | — |
| 334 | [San Andreas Unity](https://github.com/in0finite/SanAndreasUnity) | — | 2,699 | 2022-09-30 | 200 | — |
| 335 | [OpenXcom](https://github.com/OpenXcom/OpenXcom) | — | 2,256 | 2026-09-28 | 200 | — |
| 336 | [Freeablo](https://github.com/wheybags/freeablo) | — | 2,169 | 2023-04-13 | 200 | — |
| 337 | [OpenDUNE](https://github.com/OpenDUNE/OpenDUNE) | — | 1,704 | 2026-09-30 | 200 | — |
| 338 | [OpenSAGE](https://github.com/OpenSAGE/OpenSAGE) | — | 1,662 | 2025-12-16 | 200 | — |
| 339 | [freeciv](https://github.com/freeciv/freeciv) | — | 1,636 | 2026-11-18 | 200 | — |
| 340 | [openblack](https://github.com/openblack/openblack) | — | 1,611 | 2026-11-01 | 200 | — |
| 341 | [triplea](https://github.com/triplea-game/triplea) | — | 1,598 | 2026-11-16 | 200 | — |
| 342 | [Awesome Reverse-Engineered: Game Decompilations & Reimplementations](https://github.com/alexgaoth/awesome-reverse-engineered) | — | 1,461 | 2026-11-18 | 200 | — |
| 343 | [GemRB](https://github.com/gemrb/gemrb) | — | 1,272 | 2026-11-15 | 200 | — |
| 344 | [OpenSpades](https://github.com/yvt/openspades) | — | 1,253 | 2024-06-02 | 200 | — |
| 345 | [xoreos](https://github.com/xoreos/xoreos) | — | 1,199 | 2026-09-04 | 200 | — |
| 346 | [KeeperRL](https://github.com/miki151/keeperrl) | — | 1,013 | 2025-10-27 | 200 | — |
| 347 | [Zero-K](https://github.com/ZeroK-RTS/Zero-K) | — | 888 | 2026-11-18 | 200 | — |
| 348 | [Falltergeist](https://github.com/falltergeist/falltergeist) | — | 883 | 2022-07-15 | 200 | — |
| 349 | [Need For Speed 1-6](https://github.com/OpenNFS/OpenNFS) | — | 868 | 2026-06-21 | 200 | — |
| 350 | [Barony](https://github.com/TurningWheel/Barony) | — | 726 | 2026-02-21 | 200 | — |
| 351 | [Librelancer](https://github.com/Librelancer/Librelancer) | — | 611 | 2026-10-10 | 200† | — |
| 352 | [Return To The Roots](https://github.com/Return-To-The-Roots/s25client) | — | 603 | 2026-11-19 | 200 | — |
| 353 | [Carnage3D](https://github.com/codenamecpp/carnage3d) | — | 577 | 2026-08-09 | 200 | — |
| 354 | [NXEngine-evo](https://github.com/nxengine/nxengine-evo) | — | 553 | 2026-10-23 | 200 | — |
| 355 | [OpenKeeper](https://github.com/tonihele/OpenKeeper) | — | 518 | 2026-11-18 | 200 | — |
| 356 | [REGoth](https://github.com/REGoth-project/REGoth-bs) | — | 502 | 2020-05-29 | 200 | — |
| 357 | [Vange-rs](https://github.com/kvark/vange-rs) | — | 490 | 2026-11-11 | 200 | — |
| 358 | [Ryzom Core](https://github.com/ryzom/ryzomcore) | — | 479 | 2026-11-19 | 200 | — |
| 359 | [sfall](https://github.com/sfall-team/sfall) | — | 450 | 2026-11-17 | 200 | — |
| 360 | [ezQuake](https://github.com/QW-Group/ezquake-source) | — | 425 | 2026-11-18 | 200 | — |
| 361 | [KaM Remake](https://github.com/Kromster80/kam_remake) | — | 378 | 2022-06-01 | 200† | — |
| 362 | [VorpalFix](https://github.com/Wemino/VorpalFix) | — | 352 | 2026-11-07 | 200 | — |
| 363 | [The Settlers I](https://github.com/freeserf/freeserf) | — | 348 | 2026-11-14 | 200 | — |
| 364 | [UnderworldGodot](https://github.com/hankmorgan/UnderworldGodot) | — | 335 | 2026-11-05 | 200 | — |
| 365 | [Abyss Engine](https://github.com/AbyssEngine/AbyssEngine) | — | 333 | 2024-04-20 | 200 | — |
| 366 | [Omnispeak](https://github.com/sulix/omnispeak) | — | 321 | 2026-10-27 | 200 | — |
| 367 | [Resident Evil 2](https://github.com/OpenBiohazard2/OpenBiohazard2) | — | 307 | 2026-08-17 | 200 | — |
| 368 | [Sourcehold](https://github.com/sourcehold/Sourcehold) | — | 283 | 2024-07-08 | 200 | — |
| 369 | [spearmint](https://github.com/clover-moe/spearmint) | — | 281 | 2026-05-25 | 200 | — |
| 370 | [DGEngine](https://github.com/dgcor/DGEngine) | — | 271 | 2025-07-21 | 200 | — |
| 371 | [CivOne](https://github.com/Solen1985/CivOne) | — | 261 | 2020-03-14 | 200 | — |
| 372 | [Mr.Boom](https://github.com/Javanaise/mrboom-libretro) | — | 232 | 2026-06-25 | 200 | — |
| 373 | [FreeFT](https://github.com/nadult/FreeFT) | — | 195 | 2025-11-29 | 200 | — |
| 374 | [Reburn 3](https://github.com/reburndev/reburn3) | — | 195 | 2023-12-07 | 200 | — |
| 375 | [Open Panzer](https://github.com/nicupavel/openpanzer) | — | 191 | 2021-02-27 | 200 | — |
| 376 | [UAlbion](https://github.com/csinkers/ualbion) | — | 172 | 2026-05-04 | 200 | — |
| 377 | [OpenTPW](https://github.com/OpenTPW/OpenTPW) | — | 163 | 2026-09-07 | 200 | — |
| 378 | [war1](https://github.com/acoto87/war1) | — | 158 | 2026-08-09 | 200 | — |
| 379 | [Evolution-RTS](https://github.com/EvolutionRTS/Evolution-RTS) | — | 152 | 2022-03-07 | 200 | — |
| 380 | [OpenMB](https://github.com/cookgreen/OpenMB) | — | 146 | 2026-07-21 | 200 | — |
| 381 | [Little Big Adventure 2 (Twinsen's Odyssey)](https://github.com/LBALab/lba2-classic-community) | — | 118 | 2026-11-11 | 200 | — |
| 382 | [Antares](https://github.com/arescentral/antares) | — | 113 | 2026-11-03 | 200 | — |
| 383 | [simutrans](https://github.com/simutrans/simutrans) | — | 109 | 2026-11-14 | 200 | — |
| 384 | [DreeRally](https://github.com/enriquesomolinos/DreeRally) | — | 101 | 2026-11-17 | 200 | — |
| 385 | [twin-e](https://github.com/LBALab/twin-e) | — | 93 | 2025-08-31 | 200 | — |
| 386 | [q2tools-220](https://github.com/qbism/q2tools-220) | — | 82 | 2026-06-14 | 200 | — |
| 387 | [qfusion](https://github.com/Warsow/qfusion) | — | 81 | 2026-11-15 | 200 | — |
| 388 | [Rotp-Fusion](https://github.com/BrokenRegistry/Rotp-Fusion) | — | 75 | 2026-11-18 | 200 | — |
| 389 | [quakeforge](https://github.com/quakeforge/quakeforge) | — | 73 | 2026-10-10 | 200 | — |
| 390 | [Diablo II: Lord of Destruction (1.14d reimplementation)](https://github.com/psi29a/d2decomped) | — | 63 | 2026-11-19 | 200 | AI |
| 391 | [Open Kick-Off](https://github.com/ssenegas/kickoff) | — | 63 | 2024-08-01 | 200 | — |
| 392 | [lilium-voyager](https://github.com/clover-moe/lilium-voyager) | — | 61 | 2026-10-31 | 200 | — |
| 393 | [Prince-Monogame](https://github.com/salvadorc17/Prince-Monogame) | — | 55 | 2026-11-13 | 200 | — |
| 394 | [BtBuilder](https://github.com/dulsi/btbuilder) | — | 51 | 2026-06-05 | 200 | — |
| 395 | [GLKeeper](https://github.com/codenamecpp/GLKeeper) | — | 49 | 2026-10-17 | 200 | — |
| 396 | [Zelda Classic](https://github.com/ArmageddonGames/ZeldaClassic) | — | 48 | 2024-11-15 | 200 | — |
| 397 | [mint-arena](https://github.com/clover-moe/mint-arena) | — | 43 | 2026-04-07 | 200 | — |
| 398 | [Dungeon Keeper Remake](https://github.com/Themperror/Dungeon-Keeper-Remake) | — | 40 | 2026-03-29 | 200 | — |
| 399 | [Unity Underground](https://github.com/Kweepa/OpenUnderground) | — | 38 | 2026-11-17 | 200 | — |
| 400 | [heretic2](https://github.com/0lvin/heretic2) | — | 34 | 2026-11-15 | 200 | — |
| 401 | [SeriousSamAlphaRemake](https://github.com/tx00100xt/SeriousSamAlphaRemake) | — | 34 | 2025-02-05 | 200 | — |
| 402 | [O21](https://github.com/ForNeVeR/O21) | — | 31 | 2026-11-12 | 200 | — |
| 403 | [Thirdeye](https://github.com/psi29a/thirdeye) | — | 30 | 2026-08-11 | 200 | — |
| 404 | [parabellum](https://github.com/andreapavoni/parabellum) | — | 29 | 2026-09-25 | 200 | — |
| 405 | [OpenNox](https://github.com/noxworld-dev/opennox) | — | 23 | 2024-11-23 | 200† | — |
| 406 | [OpenChasm](https://github.com/alexey-lysiuk/OpenChasm) | — | 21 | 2014-01-13 | 200† | — |
| 407 | [Q2RTXPerimental](https://github.com/PolyhedronStudio/Q2RTXPerimental) | — | 21 | 2026-04-22 | 200 | — |
| 408 | [Final Fantasy IV (3D Remake)](https://github.com/GlitchedDeveloper/Babil-Decompilation-Project) | — | 8 | 2025-08-10 | 200 | — |
| 409 | [Hopmon](https://github.com/Teofil98/OpenHopmon) | — | 3 | 2025-11-04 | 200 | — |

### 2.4 Source ports — 364 rows

*Native PC/handheld ports built on top of a decompilation or released source code.*

| # | Title (link = project URL) | Platform | Stars | Last activity | Link | AI |
|--:|---|---|--:|---|:--:|:--:|
| 1 | [AzaharPlus](https://github.com/AzaharPlus/AzaharPlus) | 3DS | 1,470 | 2026-10-09 | 200 | — |
| 2 | [Sensible World of Soccer 96/97 (OpenSWOS)](https://github.com/benbaker76/OpenSWOS) | Amiga | 82 | 2026-11-18 | 200 | — |
| 3 | [Knightmare (KnightmareAmiga (h0ffman))](https://github.com/djh0ffman/KnightmareAmiga) | Amiga | 39 | 2022-05-05 | 200 | — |
| 4 | [Sensible World of Soccer 96/97 (swos-port)](https://github.com/zlatkok/swos-port) | Amiga | 39 | 2026-11-06 | 200 | — |
| 5 | [OutRunners (OutRunners - Native Port)](https://github.com/cheviman/outrunners-port) | Arcade | 134 | 2026-11-16 | 200 | AI |
| 6 | [Star Wars Trilogy Arcade (Star Wars Trilogy Native)](https://github.com/snicolast/StarWarsTrilogyNative) | Arcade | 132 | 2026-11-18 | 200 | — |
| 7 | [Teenage Mutant Ninja Turtles (TMNT - Arcade game - Native Port)](https://github.com/cheviman/tmnt-port) | Arcade | 120 | 2026-11-16 | 200 | AI |
| 8 | [Killer Instinct (UltraCombo)](https://github.com/thefixinhixon/UltraCombo) | Arcade | 81 | 2026-11-19 | 200 | AI |
| 9 | [Salamander (lifeforce-snes)](https://github.com/rumbleminze/lifeforce-snes) | Arcade | 25 | 2025-06-22 | 200 | — |
| 10 | [Power Drift (LikeTheWind)](https://github.com/hojoworks/likethewind) | Arcade | 24 | 2026-11-16 | 200 | AI |
| 11 | [Double Dragon (double-dragon-snes)](https://github.com/rumbleminze/double-dragon-snes) | Arcade | 14 | 2026-10-08 | 200 | — |
| 12 | [Ridge Racer (rr-pc-port)](https://github.com/kazuyette/rr-pc-port) | Arcade | 14 | 2026-08-15 | 200 | — |
| 13 | [Defender (Falcon)](https://github.com/therealsark02/defender) | Arcade | 13 | 2025-08-17 | 200 | — |
| 14 | [Xevious (xevious (arcade -> 68k transcode))](https://github.com/jotd666/xevious) | Arcade | 13 | 2026-11-04 | 200 | — |
| 15 | [Eastern Front (1941) (eastern-front-1941 (TypeScript port))](https://github.com/patricksurry/eastern-front-1941) | Atari 8-bit | 17 | 2026-01-25 | 200 | — |
| 16 | [Rayman (Rayverse)](https://github.com/Falcury/rayverse) | Atari Jaguar | 35 | 2026-11-08 | 200 | — |
| 17 | [Habitat (NeoHabitat)](https://github.com/frandallfarmer/neohabitat) | Commodore 64/8-bit | 251 | 2026-11-18 | 200 | — |
| 18 | [Chocolate Doom](https://github.com/chocolate-doom/chocolate-doom) | DOS | 2,459 | 2026-10-25 | 200 | — |
| 19 | [vkQuake](https://github.com/Novum/vkQuake) | DOS | 2,328 | 2026-11-15 | 200 | — |
| 20 | [Crispy Doom](https://github.com/fabiangreffrath/crispy-doom) | DOS | 973 | 2026-11-16 | 200 | — |
| 21 | [DoomRetro](https://github.com/bradharding/doomretro) | DOS | 787 | 2026-11-19 | 200 | — |
| 22 | [DXX-Rebirth](https://github.com/dxx-rebirth/dxx-rebirth) | DOS | 646 | 2026-11-15 | 200 | — |
| 23 | [Doom (dsda-doom)](https://github.com/dsda-org/dsda-doom) | DOS | 527 | 2026-11-17 | 200 | — |
| 24 | [Quake (DarkPlaces)](https://github.com/DarkPlacesEngine/DarkPlaces) | DOS | 457 | 2026-11-05 | 200 | — |
| 25 | [Quake (quakespasm)](https://github.com/sezero/quakespasm) | DOS | 416 | 2026-11-15 | 200 | — |
| 26 | [Doom (Woof)](https://github.com/fabiangreffrath/woof) | DOS | 340 | 2026-11-18 | 200 | — |
| 27 | [Odamex](https://github.com/odamex/odamex) | DOS | 310 | 2026-11-18 | 200 | — |
| 28 | [Doomsday Engine](https://github.com/skyjake/Doomsday-Engine) | DOS | 308 | 2026-11-02 | 200 | — |
| 29 | [The Eternity Engine](https://github.com/team-eternity/eternity) | DOS | 274 | 2026-11-05 | 200 | — |
| 30 | [Command & Conquer: Red Alert (ra-port)](https://github.com/dk8827/ra-port) | DOS | 252 | 2026-10-31 | 200 | — |
| 31 | [Chocolate Quake](https://github.com/Henrique194/chocolate-quake) | DOS | 235 | 2026-09-07 | 200 | — |
| 32 | [Doom (DOOM 32X: Resurrection)](https://github.com/viciious/d32xr) | DOS | 223 | 2026-11-19 | 200 | — |
| 33 | [CatacombGL](https://github.com/ArnoAnsems/CatacombGL) | DOS | 202 | 2026-11-17 | 200 | — |
| 34 | [Abuse (Abuse 1996 20th anniversary port)](https://github.com/antrad/Abuse_1996) | DOS | 157 | 2016-05-08 | 200 | — |
| 35 | [Quake (QuakeQuest)](https://github.com/Team-Beef-Studios/QuakeQuest) | DOS | 146 | 2026-08-01 | 200 | — |
| 36 | [Duke Nukem 3D (JFDuke3D)](https://github.com/jonof/jfduke3d) | DOS | 144 | 2026-01-02 | 200 | — |
| 37 | [Rise of the Triad (rottexpr)](https://github.com/LTCHIPS/rottexpr) | DOS | 112 | 2021-01-04 | 200 | — |
| 38 | [EDGE-classic](https://github.com/edge-classic/EDGE-classic) | DOS | 103 | 2026-11-18 | 200 | — |
| 39 | [jfsw](https://github.com/jonof/jfsw) | DOS | 103 | 2026-01-02 | 200 | — |
| 40 | [Doom (64doom)](https://github.com/jnmartin84/64doom) | DOS | 97 | 2024-03-17 | 200 | — |
| 41 | [Wolfenstein 3D (Iron Wolf)](https://github.com/Ragnaroek/iron-wolf) | DOS | 88 | 2026-11-16 | 200 | — |
| 42 | [Doom (QuestZDoom)](https://github.com/Team-Beef-Studios/QuestZDoom) | DOS | 72 | 2026-08-03 | 200 | — |
| 43 | [Signus: The Artefact Wars](https://github.com/signus-game/signus) | DOS | 70 | 2023-12-23 | 200 | — |
| 44 | [Quake (Qwasm)](https://github.com/GMH-Code/Qwasm) | DOS | 63 | 2024-12-09 | 200 | — |
| 45 | [Doom (Calico (Jaguar Doom backport))](https://github.com/team-eternity/calico-doom) | DOS | 57 | 2024-01-10 | 200 | — |
| 46 | [Descent (DXX Retro)](https://github.com/CDarrow/DXX-Retro) | DOS | 52 | 2022-12-16 | 200 | — |
| 47 | [The Terminator: SkyNET (skynet-godot)](https://github.com/nautilusbits/skynet-godot) | DOS | 51 | 2026-10-13 | 200 | — |
| 48 | [Tyrquake](https://github.com/libretro/tyrquake) | DOS | 51 | 2026-10-12 | 200 | — |
| 49 | [Crusader: No Remorse (Crusader: No Remorse - SDL port)](https://github.com/sebsebseb1982/crusader-no-remorse-decomp) | DOS | 49 | 2026-11-18 | 200 | — |
| 50 | [Wolfenstein 3D (Wolf4SDL)](https://github.com/fabiangreffrath/intenseflow) | DOS | 44 | 2026-11-19 | 200 | — |
| 51 | [Doom (Silent Space Marine)](https://github.com/GMH-Code/Dwasm) | DOS | 41 | 2026-04-14 | 200 | — |
| 52 | [jfwhaven](https://github.com/jonof/jfwhaven) | DOS | 32 | 2025-12-27 | 200 | — |
| 53 | [jftekwar](https://github.com/jonof/jftekwar) | DOS | 30 | 2026-06-01 | 200 | — |
| 54 | [Prehistorik 2 (missingno7 pre2_port (dos_re))](https://github.com/missingno7/pre2_port) | DOS | 26 | 2026-07-16 | 200 | AI |
| 55 | [SkyRoads (skyroads-port (1:1 C11))](https://github.com/ammaarreshi/skyroads-port) | DOS | 26 | 2026-06-11 | 200 | AI |
| 56 | [Commander Keen in Goodbye, Galaxy! (keensource456tandy)](https://github.com/FrenkelS/keensource456tandy) | DOS | 24 | 2024-01-14 | 200 | — |
| 57 | [Duke Nukem 3D (duke3d (icculus.org port))](https://github.com/icculus/duke3d) | DOS | 20 | 2021-07-12 | 200 | — |
| 58 | [Abuse (Abuse Vita)](https://github.com/Rinnegatamante/abuse-vita) | DOS | 14 | 2021-04-13 | 200 | — |
| 59 | [Tyrian (opentyrian-nx)](https://github.com/theflippedbit/opentyrian-nx) | DOS | 13 | 2021-02-10 | 200 | — |
| 60 | [Carmageddon (Carmageddon Android Port)](https://github.com/armac911/Carmageddon-Android-Port) | DOS | 12 | 2026-10-26 | 200 | — |
| 61 | [Descent (D1X 3DS)](https://github.com/iNdioNicarao/dxx-3ds) | DOS | 12 | 2026-10-24 | 200 | — |
| 62 | [Descent (DXX 3DS)](https://github.com/RossMeikleham/DXX-3DS) | DOS | 12 | 2018-12-07 | 200 | — |
| 63 | [Caesar II (caesar2-port)](https://github.com/second-impressions/caesar2-port) | DOS | 11 | 2026-09-13 | 200 | — |
| 64 | [Raptor: Call of the Shadows (raptor-reclawed)](https://github.com/Alexbeav/raptor-reclawed) | DOS | 10 | 2026-10-04 | 200 | — |
| 65 | [Street Rod 2: The Next Generation (street-rod-2-sdl3)](https://github.com/kylofon/street-rod-2-sdl3) | DOS | 10 | 2026-10-19 | 200 | — |
| 66 | [Resident Evil 4 (Dreamcast port, re4dc)](https://github.com/lamb2k/re4dc) | Dreamcast | 48 | 2026-11-11 | 200 | AI |
| 67 | [Kingdom Hearts 358/2 Days (khdays-port)](https://github.com/Yokimitsuro/khdays-port) | DS | 245 | 2026-11-06 | 200 | AI |
| 68 | [The Legend of Zelda: Oracle of Seasons / Oracle of Ages (The Oracles Project)](https://github.com/thibautbus/top) | Game Boy Color | 129 | 2026-11-15 | 200 | AI |
| 69 | [The Legend of Zelda: Twilight Princess (Dusklight)](https://github.com/TwilitRealm/dusklight) | GameCube | 6,467 | 2026-10-20 | 200 | — |
| 70 | [Animal Crossing (ACGC-PC-Port)](https://github.com/flyngmt/Nookery) | GameCube | 1,592 | 2026-11-08 | 200 | — |
| 71 | [Super Mario Strikers (PC Port)](https://github.com/new-coke/strikers) | GameCube | 426 | 2026-11-09 | 200 | AI |
| 72 | [Pikmin & Pikmin 2 (Open Nectar)](https://github.com/SSunnKing/Open-Nectar---Pikmin-Native-PC-Mobile-Port) | GameCube | 320 | 2026-11-18 | 200 | AI |
| 73 | [Super Smash Bros. Melee (OpenSmash (Melee engine: opensmash-melee-pc))](https://github.com/turtlesoupy/opensmash) | GameCube | 164 | 2026-10-30 | 200 | — |
| 74 | [F-Zero GX (F-ZERO GLINUX)](https://github.com/Mabec-games/F-ZERO-GLINUX) | GameCube | 137 | 2026-11-07 | 200 | AI |
| 75 | [The Legend of Zelda: The Wind Waker (SwitchWaker)](https://github.com/centollOS/SwitchWaker) | GameCube | 110 | 2026-11-02 | 200 | — |
| 76 | [Star Fox Adventures (Foxhollow)](https://github.com/JackPriceBurns/foxhollow) | GameCube | 96 | 2026-10-25 | 200 | — |
| 77 | [Animal Crossing (forest (ACreTeam official PC port))](https://github.com/ACreTeam/forest) | GameCube | 89 | 2026-04-15 | 200 | — |
| 78 | [Mario Party 4 (Party Board (zeranemesis port))](https://github.com/zeranemesis/Marioparty4) | GameCube | 88 | 2026-11-10 | 200 | AI |
| 79 | [Mario Party 4 (Party Board)](https://github.com/mariopartyrd/partyboard) | GameCube | 59 | 2026-10-27 | 200 | — |
| 80 | [Animal Crossing (ACGC-Android-Port)](https://github.com/zwaetschge/ACGC-Android-Port) | GameCube | 56 | 2026-10-06 | 200 | — |
| 81 | [Luigi's Mansion (Luigi's Mansion Android Port)](https://github.com/JayElDragon/luigis-mansion-android) | GameCube | 53 | 2026-11-19 | 200 | — |
| 82 | [Animal Crossing ( animalcrossing-visionos)](https://github.com/chrissotraidis/bellpad) | GameCube | 41 | 2026-11-14 | 200 | — |
| 83 | [Super Smash Bros. Melee (web ports (Melee-X Xbox, Melee360, Vita, webmelee.gg))](https://github.com/TechProGabe/Melee-X) | GameCube | 35 | 2026-10-26 | 200 | — |
| 84 | [The Legend of Zelda: The Wind Waker (WindowWaker)](https://github.com/MaskeZenY/WindowWaker) | GameCube | 35 | 2026-10-10 | 200 | AI |
| 85 | [Mario Party 6 (Starlit Party)](https://github.com/iirg4x/mp6-native-port) | GameCube | 33 | 2026-10-23 | 200 | AI |
| 86 | [Super Mario Strikers (BallPad)](https://github.com/chrissotraidis/ballpad) | GameCube | 28 | 2026-11-14 | 200 | — |
| 87 | [Super Smash Bros. Melee (Melee-PS3)](https://github.com/Mayo1970/melee-ps3) | GameCube | 28 | 2026-11-07 | 200 | — |
| 88 | [The Legend of Zelda: Twilight Princess (DuskOnVita)](https://github.com/NathanKneT/DuskOnVita) | GameCube | 25 | 2026-11-15 | 200 | — |
| 89 | [Animal Crossing (Animal Crossing PC Port - Deluxe Edition)](https://github.com/imcynic/ACGC-Deluxe-PC-Port) | GameCube | 23 | 2026-03-25 | 200 | — |
| 90 | [Super Mario Sunshine (sms-port (zeranemesis, PAL))](https://github.com/zeranemesis/sms-port) | GameCube | 22 | 2026-11-05 | 200 | — |
| 91 | [The Legend of Zelda: Twilight Princess (tp-port (mbayonal))](https://github.com/mbayonal/tp-port) | GameCube | 17 | 2026-01-21 | 200 | — |
| 92 | [Pikmin (Pikmin-PS3-Port)](https://github.com/MattyKen619/Pikmin-PS3-Port) | GameCube | 14 | 2026-11-02 | 200 | — |
| 93 | [Star Fox Adventures (Star Fox Adventures for PS Vita)](https://github.com/tchisholm20/starfox-adventures-vita) | GameCube | 13 | 2026-11-14 | 200 | — |
| 94 | [Metroid Prime (Prime-X)](https://github.com/TechProGabe/Prime-X) | GameCube | 11 | 2026-11-03 | 200 | — |
| 95 | [Pokémon Emerald (pokeemerald-3Ds-dualscreen)](https://github.com/ZallaxDev/emerald-3ds) | GBA | 795 | 2026-10-30 | 200 | — |
| 96 | [Sonic the Hedgehog (s1-port)](https://github.com/foreverWIP/s1-port) | Genesis | 35 | 2025-06-23 | 200 | — |
| 97 | [SimCity (micropolisJS)](https://github.com/graememcc/micropolisJS) | Mac | 737 | 2025-07-13 | 200 | — |
| 98 | [Marathon (Marathon (Android))](https://github.com/daniele-rapagnani/alephone-android) | Mac | 71 | 2021-05-21 | 200 | — |
| 99 | [SimCity (micropolis-java)](https://github.com/jason17055/micropolis-java) | Mac | 40 | 2015-01-25 | 200 | — |
| 100 | [AAAAXY](https://github.com/divVerent/aaaaxy) | Mobile | 305 | 2026-11-09 | 200 | — |
| 101 | [Rockman EXE Phantom of Network (PoN PC)](https://github.com/StraDaMa/PoN_PC) | Mobile | 87 | 2026-02-17 | 200 | — |
| 102 | [Mario Kart 64 (SpaghettiKart)](https://github.com/HarbourMasters/SpaghettiKart) | N64 | 2,504 | 2026-10-22 | 200 | AI |
| 103 | [Perfect Dark (Perfect Dark PC Port)](https://github.com/perfect-dark-pc-port/perfect_dark) | N64 | 2,117 | 2026-10-27 | 200 | — |
| 104 | [Super Mario 64 (sm64ex)](https://github.com/sm64pc/sm64ex) | N64 | 1,889 | 2024-12-17 | 200 | — |
| 105 | [Super Mario 64 (Ghostship)](https://github.com/HarbourMasters/Ghostship) | N64 | 930 | 2026-10-27 | 200 | — |
| 106 | [The Legend of Zelda: Ocarina of Time (Open Ocarina - The Master Port (ooot))](https://github.com/blawar/ooot) | N64 | 703 | 2023-04-22 | 200 | — |
| 107 | [GoldenEye PC Port](https://github.com/jkdansereau/goldeneye-pc-port) | N64 | 335 | 2026-10-07 | 200 | AI |
| 108 | [Super Mario 64 (SM64CoopDX for Android)](https://github.com/ManIsCat2/sm64coopdx) | N64 | 329 | 2026-06-01 | 200 | — |
| 109 | [Paper Mario (Paper Mario ReCut)](https://github.com/SMCGames/Paper-Mario-ReCut-Deprecated) | N64 | 300 | 2026-10-21 | 200 | AI |
| 110 | [Super Mario 64 (libsm64-godot)](https://github.com/Brawmario/libsm64-godot) | N64 | 219 | 2026-10-29 | 200 | — |
| 111 | [GoldenEye 007 ( goldeneye-vr (Quest))](https://github.com/chrissotraidis/goldenpad) | N64 | 193 | 2026-11-15 | 200 | — |
| 112 | [Mario Kart 64 (SpaghettiKart [Android Port])](https://github.com/izzy2lost/SpaghettiKart) | N64 | 124 | 2026-08-03 | 200 | AI |
| 113 | [The Legend of Zelda: Ocarina of Time (Ship of Harkinian - Android)](https://github.com/linkzenic/Shipwright-Ports) | N64 | 124 | 2026-10-29 | 200 | — |
| 114 | [Star Fox 64 (Starship [Android Port])](https://github.com/izzy2lost/Starship) | N64 | 118 | 2025-11-16 | 200 | — |
| 115 | [Banjo-Tooie (banjo-tooie-scurvy-dog-port)](https://github.com/some-scurvy-dog/banjo-tooie-scurvy-dog-port) | N64 | 113 | 2026-10-27 | 200 | AI |
| 116 | [Perfect Dark (Perfect Dark Port [Android])](https://github.com/izzy2lost/perfect_dark) | N64 | 109 | 2025-08-20 | 200 | — |
| 117 | [The Legend of Zelda: Ocarina of Time (oot-PSP)](https://github.com/z2442/oot-PSP) | N64 | 107 | 2026-11-19 | 200 | — |
| 118 | [Super Mario 64 (libsm64-unity)](https://github.com/libsm64/libsm64-unity) | N64 | 64 | 2022-04-15 | 200 | — |
| 119 | [Super Mario 64 in Scratch (sm64-scratch)](https://github.com/naegoxdev/sm64-scratch) | N64 | 55 | 2026-10-16 | 200 | AI |
| 120 | [The Legend of Zelda: Majora's Mask (MaskPad)](https://github.com/chrissotraidis/maskpad) | N64 | 55 | 2026-11-15 | 200 | — |
| 121 | [Super Mario 64 (libsm64-rust)](https://github.com/nickmass/libsm64-rust) | N64 | 45 | 2025-11-16 | 200 | — |
| 122 | [Super Mario 64 (SM64-PC-Port-WebGL)](https://github.com/NotAn127/SM64-PC-Port-WebGL) | N64 | 34 | 2026-10-09 | 200 | — |
| 123 | [Super Smash Bros. (Smash64DS_Port)](https://github.com/rockenrooster/Smash64DS_Port) | N64 | 34 | 2026-10-29 | 200 | — |
| 124 | [Doom 64 (doom64-dc)](https://github.com/jnmartin84/doom64-dc) | N64 | 31 | 2026-05-21 | 200 | — |
| 125 | [Super Mario 64 (SMUE5)](https://github.com/TheEnbyWitch/SMUE5) | N64 | 27 | 2022-12-20 | 200 | — |
| 126 | [Paper Mario (PaperBoat Android Port)](https://github.com/JayElDragon/Paper-Boat-Android-Port) | N64 | 24 | 2026-11-12 | 200 | — |
| 127 | [BattleTanx: Global Assault (Native PC Port)](https://github.com/TheGh0stShip/BattleTanx-Global-Assault-PC-Port) | N64 | 21 | 2026-10-15 | 200 | AI |
| 128 | [Super Smash Bros. (ssb64-dc)](https://github.com/beigeceleron/ssb64-dc) | N64 | 17 | 2026-10-10 | 200 | — |
| 129 | [Animal Forest (animal_forest_psp)](https://github.com/bruder-grimm/animal_forest_psp) | N64 | 16 | 2026-10-24 | 200 | — |
| 130 | [Super Mario 64 (libsm64-sharp)](https://github.com/MeltyPlayer/libsm64-sharp) | N64 | 13 | 2025-09-17 | 200 | — |
| 131 | [Super Smash Bros. (SSB-X (original Xbox port))](https://github.com/Team-Resurgent/SSB-X) | N64 | 13 | 2026-10-12 | 200 | — |
| 132 | [ClayFighter 64](https://github.com/djultra64/ClayFighter64) | N64 | 12 | 2026-10-27 | 200 | AI |
| 133 | [Duke Nukem: Zero Hour (DukeNukemZeroHourPort (Gillou68310))](https://github.com/Gillou68310/DukeNukemZeroHourPort) | N64 | 12 | 2025-11-06 | 200 | — |
| 134 | [Mario Kart 64 (Mario-Kart-64-X (original Xbox port))](https://github.com/Team-Resurgent/Mario-Kart-64-X) | N64 | 10 | 2026-10-18 | 200 | — |
| 135 | [Paper Mario ( pmvita)](https://github.com/versacepapermario/papermario-pc-upload) | N64 | 10 | 2026-03-30 | 200 | — |
| 136 | [Super Mario Bros. (UEFI_SuperMario)](https://github.com/MikeWuPing/UEFI_SuperMario) | NES | 36 | 2026-05-03 | 200 | — |
| 137 | [Castlevania (castlevania-snes)](https://github.com/rumbleminze/castlevania-snes) | NES | 27 | 2026-09-15 | 200 | — |
| 138 | [Super Mario Bros. (Super Mario Bros. Atari Lynx Port)](https://github.com/pwsqrd/lynx_smb) | NES | 23 | 2026-10-20 | 200 | — |
| 139 | [Super Mario World (Hummer Team NES port)](https://github.com/palaceswitcher/SMW-NES-Disassembly) | NES | 20 | 2026-11-10 | 200 | — |
| 140 | [Super Dodge Ball (super-super-dodgeball)](https://github.com/rumbleminze/super-super-dodgeball) | NES | 17 | 2025-07-02 | 200 | — |
| 141 | [Balloon Fight (Balloon-fight-VS-for-NES)](https://github.com/tvoybro/Balloon-fight-VS-for-NES) | NES | 12 | 2021-04-05 | 200 | — |
| 142 | [xemu](https://github.com/xemu-project/xemu) | og xbox | 4,278 | 2026-11-16 | 200 | AI |
| 143 | [BLACK (black-pc)](https://github.com/Spark198rus/black-pc) | og xbox | 396 | 2026-11-14 | 200 | AI |
| 144 | [Jet Set Radio Future (Jet Set Radio Future Unleashed)](https://github.com/JuMatt/JetSetRadioFuture-Unleashed) | og xbox | 289 | 2026-11-13 | 200 | AI |
| 145 | [Call of Duty: Finest Hour (Finest Hour Remastered)](https://github.com/crazyriddler/FinestHourRemastered) | og xbox | 195 | 2026-11-04 | 200 | AI |
| 146 | [TimeSplitters: Future Perfect (TimeSplitters: Future Perfect PC)](https://github.com/TheDoffman/timesplitters-future-perfect-pc) | og xbox | 158 | 2026-11-19 | 200 | AI |
| 147 | [Star Wars: Episode III – Revenge of the Sith (SWROTS-PC)](https://github.com/jedijosh920/SWROTS-PC) | og xbox | 140 | 2026-11-07 | 200 | — |
| 148 | [Dead or Alive 2 Ultimate (DOA2U Native PC Port)](https://github.com/NoRain211/doa2u-re) | og xbox | 127 | 2026-11-18 | 200 | AI |
| 149 | [Call of Duty 2: Big Red One (CoD2-BRO-Native-Loader)](https://github.com/SmokeDoggy044/CoD2-BRO-Native-Loader) | og xbox | 102 | 2026-11-18 | 200 | AI |
| 150 | [Medal of Honor: European Assault (Medal of Honor: European Assault — PC Port)](https://github.com/boodyandmustafa-create/MOH-EuropeanAssault-PC-Port) | og xbox | 71 | 2026-11-05 | 200 | AI |
| 151 | [Buffy the Vampire Slayer: Chaos Bleeds (Buffy Chaos Bleeds PC)](https://github.com/KaikoClanworth1/buffy-chaos-bleeds-pc) | og xbox | 53 | 2026-11-16 | 200 | AI |
| 152 | [Dungeons of Daggorath (Dungeons of Daggorath PC-Port)](https://github.com/gondur/dungeons-of-daggorath) | Other | 17 | 2016-04-15 | 200 | — |
| 153 | [Legend of Doom (legend-of-doom-3ds)](https://github.com/EstebanPdN/legend-of-doom-3ds) | Others | 41 | 2026-11-10 | 200 | — |
| 154 | [VVVVV](https://github.com/TerryCavanagh/VVVVVV) | PC | 8,063 | 2026-11-19 | 200 | — |
| 155 | [Warzone 2100](https://github.com/Warzone2100/warzone2100) | PC | 4,066 | 2026-11-17 | 200 | — |
| 156 | [OpenJK](https://github.com/JACoders/OpenJK) | PC | 2,344 | 2026-09-29 | 200 | — |
| 157 | [Quake III Arena (quakejs)](https://github.com/inolen/quakejs) | PC | 1,613 | 2019-03-26 | 200 | — |
| 158 | [Quake3e](https://github.com/ec-/Quake3e) | PC | 1,574 | 2026-11-15 | 200 | — |
| 159 | [Brogue (Brogue CE)](https://github.com/tmewett/BrogueCE) | PC | 1,534 | 2026-11-06 | 200 | — |
| 160 | [GeneralsGameCode](https://github.com/TheSuperHackers/GeneralsGameCode) | PC | 1,512 | 2026-11-18 | 200 | — |
| 161 | [Starbound (OpenStarbound)](https://github.com/OpenStarbound/OpenStarbound) | PC | 1,487 | 2026-11-11 | 200 | — |
| 162 | [OpenSoldat](https://github.com/opensoldat/opensoldat) | PC | 1,467 | 2026-10-18 | 200 | — |
| 163 | [Cube 2: Sauerbraten (BananaBread)](https://github.com/kripken/BananaBread) | PC | 1,449 | 2021-10-29 | 200 | — |
| 164 | [LEGO Island (isle-portable)](https://github.com/isledecomp/isle-portable) | PC | 1,099 | 2026-11-16 | 200 | AI |
| 165 | [Quake II (Batocera port package 'vkquake2')](https://github.com/kondrak/vkQuake2) | PC | 1,028 | 2026-08-04 | 200 | — |
| 166 | [Yamagi Quake II](https://github.com/yquake2/yquake2) | PC | 1,016 | 2026-11-16 | 200 | — |
| 167 | [iortcw](https://github.com/iortcw/iortcw) | PC | 772 | 2024-05-26 | 200 | — |
| 168 | [Vangers](https://github.com/KranX/Vangers) | PC | 745 | 2026-11-14 | 200 | — |
| 169 | [idTech4A++ (Harmattan Edition)](https://github.com/glKarin/com.n0n3m4.diii4a) | PC | 664 | 2026-11-10 | 200 | — |
| 170 | [Area 51 (Area 51 (Source Restoration))](https://github.com/ProjectDreamland/area51) | PC | 584 | 2025-08-02 | 200 | — |
| 171 | [Meridian 59](https://github.com/Meridian59/Meridian59) | PC | 522 | 2026-11-18 | 200 | — |
| 172 | [FS2Open](https://github.com/scp-fs2open/fs2open.github.com) | PC | 513 | 2026-11-19 | 200 | — |
| 173 | [Crysis (C1-Launcher)](https://github.com/ccomrade/c1-launcher) | PC | 504 | 2026-01-19 | 200 | — |
| 174 | [Nanosaur](https://github.com/jorio/Nanosaur) | PC | 478 | 2026-04-27 | 200 | — |
| 175 | [MadnessPatch](https://github.com/Wemino/MadnessPatch) | PC | 476 | 2026-11-16 | 200 | — |
| 176 | [VanillaConquer](https://github.com/TheAssemblyArmada/Vanilla-Conquer) | PC | 476 | 2026-11-18 | 200 | — |
| 177 | [Quake (FTEQW)](https://github.com/fte-team/fteqw) | PC | 366 | 2026-11-02 | 200 | — |
| 178 | [Gish (gish (blinry fork))](https://github.com/blinry/gish) | PC | 360 | 2017-01-12 | 200 | — |
| 179 | [ROTA: Bend Gravity](https://github.com/HarmonyHoney/ROTA) | PC | 341 | 2026-06-25 | 200 | — |
| 180 | [Zero Hour Reforged](https://github.com/olcayseygan/CnCGeneralsZH-Reforged) | PC | 340 | 2026-11-19 | 200 | — |
| 181 | [Aquaria (Aquaria OSE)](https://github.com/AquariaOSE/Aquaria) | PC | 332 | 2026-11-15 | 200 | — |
| 182 | [Marble Marcher (Marble Marcher: Community Edition)](https://github.com/WAUthethird/Marble-Marcher-Community-Edition) | PC | 288 | 2024-12-12 | 200 | — |
| 183 | [Need for Speed: Most Wanted (nfsmw-nx)](https://github.com/StevensND/nfsmw-nx) | PC | 274 | 2026-11-03 | 200 | — |
| 184 | [Seven Kingdoms: Ancient Adversaries (7KAA)](https://github.com/the3dfxdude/7kaa) | PC | 267 | 2023-09-22 | 200† | — |
| 185 | [Half-Life (Lambda1VR (Xash3D VR port))](https://github.com/Team-Beef-Studios/Lambda1VR) | PC | 254 | 2026-09-02 | 200 | — |
| 186 | [Race into Space](https://github.com/raceintospace/raceintospace) | PC | 239 | 2026-10-31 | 200 | — |
| 187 | [Marble Blast Gold (MBHaxe)](https://github.com/RandomityGuy/MBHaxe) | PC | 230 | 2026-11-13 | 200 | — |
| 188 | [openQ4](https://github.com/themuffinator/openQ4) | PC | 223 | 2026-11-18 | 200 | AI |
| 189 | [Minecraft: Java Edition (Minecraft PSP)](https://github.com/Pencea-Flavius/Minecraft-PE-PSP) | PC | 219 | 2026-09-25 | 200 | — |
| 190 | [Factorio (Pocket Foundry)](https://github.com/JulioFerrero/pocket-foundry) | PC | 207 | 2026-11-17 | 200 | AI |
| 191 | [The Simpsons: Hit & Run (The Simpsons: Hit & Run Android)](https://github.com/Carlox33/The-Simpsons-Hit-and-Run-Android) | PC | 200 | 2026-11-10 | 200 | — |
| 192 | [Half-Life (webXash))](https://github.com/x8BitRain/webXash) | PC | 183 | 2026-01-28 | 200 | — |
| 193 | [Descent 3 (Piccu Engine)](https://github.com/InsanityBringer/PiccuEngine) | PC | 169 | 2026-08-27 | 200 | — |
| 194 | [Star Wars Jedi Knight II: Jedi Outcast (JK XR)](https://github.com/Team-Beef-Studios/JKXR) | PC | 167 | 2026-06-10 | 200 | — |
| 195 | [NetHack (NetHack (Android))](https://github.com/gurrhack/NetHack-Android) | PC | 162 | 2025-12-01 | 200 | — |
| 196 | [MegaZeux](https://github.com/MegaZeux/megazeux) | PC | 155 | 2026-11-16 | 200 | — |
| 197 | [Homeworld (HomeworldSDL)](https://github.com/HomeworldSDL/HomeworldSDL) | PC | 148 | 2024-10-13 | 200 | — |
| 198 | [Jedi Knight II: Jedi Outcast (JK2MV)](https://github.com/mvdevs/jk2mv) | PC | 140 | 2025-06-13 | 200 | — |
| 199 | [Doom 3 (Doom3Quest)](https://github.com/Team-Beef-Studios/Doom3Quest) | PC | 138 | 2026-09-05 | 200 | — |
| 200 | [Hollow Knight: Silksong (Silksong Android)](https://github.com/jakobkhansen/SilksongAndroid) | PC | 135 | 2026-11-09 | 200 | AI |
| 201 | [Age of Empires Online (Project Celeste)](https://github.com/ProjectCeleste/Celeste.Launcher) | PC | 130 | 2026-10-18 | 200 | — |
| 202 | [BuildLauncher](https://github.com/fgsfds/BuildLauncher) | PC | 128 | 2026-11-12 | 200 | — |
| 203 | [Windows Frotz (WinFrotz)](https://github.com/DavidKinder/Windows-Frotz) | PC | 124 | 2026-11-11 | 200 | — |
| 204 | [Hexen II (uHexen2 (Hammer of Thyrion))](https://github.com/sezero/uhexen2) | PC | 120 | 2026-10-29 | 200 | — |
| 205 | [Clonk Rage (LegacyClonk)](https://github.com/legacyclonk/LegacyClonk) | PC | 115 | 2026-08-14 | 200 | — |
| 206 | [Quake III Arena (Batocera port package 'vkquake3')](https://github.com/suijingfeng/vkQuake3) | PC | 114 | 2026-06-14 | 200 | — |
| 207 | [The Ur-Quan Masters (Ur-Quan Masters HD MegaMod)](https://github.com/JHGuitarFreak/UQM-MegaMod) | PC | 111 | 2026-11-19 | 200 | — |
| 208 | [Plants vs. Zombies Garden Warfare (GardenGate)](https://github.com/nocss42/GardenGate) | PC | 110 | 2026-10-26 | 200 | — |
| 209 | [Starbound (OpenStarbound Mobile)](https://github.com/RohanBhattacharyya/oSBM) | PC | 107 | 2026-11-15 | 200 | — |
| 210 | [Quake II (Quake2Quest)](https://github.com/Team-Beef-Studios/Quake2Quest) | PC | 98 | 2026-06-16 | 200 | — |
| 211 | [dxx-redux](https://github.com/dxx-redux/dxx-redux) | PC | 80 | 2026-09-15 | 200 | — |
| 212 | [Return to Castle Wolfenstein (RTCWQuest)](https://github.com/Team-Beef-Studios/RTCWQuest) | PC | 80 | 2026-06-15 | 200 | — |
| 213 | [Diablo (diablo_web))](https://github.com/JohnImril/diablo_web) | PC | 75 | 2026-11-18 | 200 | — |
| 214 | [Bugdom 2](https://github.com/jorio/Bugdom2) | PC | 74 | 2025-03-08 | 200 | — |
| 215 | [Diablo III (Souls-of-the-Reaper)](https://github.com/Boron853/Souls-of-the-Reaper) | PC | 74 | 2026-07-25 | 200 | — |
| 216 | [NearChuckle](https://github.com/rohit-n/NearChuckle) | PC | 64 | 2026-08-04 | 200 | — |
| 217 | [Quake II (Qwasm2)](https://github.com/GMH-Code/Qwasm2) | PC | 64 | 2026-04-18 | 200 | — |
| 218 | [Hollow Knight (HK: Dual Souls)](https://github.com/igawa6/dualsouls) | PC | 63 | 2026-08-23 | 200 | — |
| 219 | [Stardew Valley (Stardew Valley Enhanced (PS Vita))](https://github.com/rikujoukoro/stardew-valley-enhanced-vita) | PC | 60 | 2026-11-04 | 200 | — |
| 220 | [Gish (Gish (Android))](https://github.com/EXL/Gish) | PC | 59 | 2022-08-12 | 200 | — |
| 221 | [Taradino](https://github.com/fabiangreffrath/taradino) | PC | 59 | 2026-03-20 | 200 | — |
| 222 | [Plants vs. Zombies (pvz-ps2-wii)](https://github.com/OptiJuegos/pvz-ps2-wii) | PC | 57 | 2026-09-01 | 200 | — |
| 223 | [Anodyne ( AnodyneFNA)](https://github.com/PixieCatSupreme/AnodyneSharp) | PC | 56 | 2026-02-04 | 200 | — |
| 224 | [Quake II Mission Pack: Ground Zero (Ground Zero for Yamagi Quake II)](https://github.com/yquake2/rogue) | PC | 53 | 2026-11-11 | 200 | — |
| 225 | [Tribal Trouble](https://github.com/Tribal-Trouble/tribaltrouble) | PC | 52 | 2026-11-11 | 200 | — |
| 226 | [Quake II Mission Pack: The Reckoning (The Reckoning for Yamagi Quake II)](https://github.com/yquake2/xatrix) | PC | 51 | 2026-11-16 | 200 | — |
| 227 | [Call of Duty 4: Modern Warfare (kisakcod-port (web))](https://github.com/slqntdevss/kisakcod-port) | PC | 43 | 2026-10-07 | 200 | — |
| 228 | [Arx Fatalis (Arxwasm)](https://github.com/gabrielcuvillier/arxwasm) | PC | 42 | 2019-12-03 | 200 | — |
| 229 | [No One Lives Forever 2 (nolf2src)](https://github.com/nolffan/nolf2src) | PC | 42 | 2026-11-16 | 200 | — |
| 230 | [Barrett](https://github.com/lunarmeadow/barrett) | PC | 37 | 2026-11-10 | 200 | — |
| 231 | [Duke Nukem 3D: 20th Anniversary World Tour (EDuke32 (AWO wrapper))](https://github.com/Hendricks266/e32wt) | PC | 37 | 2021-01-16 | 200 | — |
| 232 | [Quake II: Zaero (Zaero for Yamagi Quake II)](https://github.com/yquake2/zaero) | PC | 30 | 2026-11-11 | 200 | — |
| 233 | [Silent Hill 4: The Room (sh4vita)](https://github.com/vallfrr/sh4vita) | PC | 28 | 2026-10-30 | 200 | — |
| 234 | [Command & Conquer: Generals Zero Hour (NewShoes)](https://github.com/Agusx1211/NewShoes) | PC | 26 | 2026-09-23 | 200 | — |
| 235 | [Star Trek: Voyager - Elite Force (Star Trek: Voyager - Elite Force (Android))](https://github.com/imjustadudegamer/VoyagerSP-Android) | PC | 24 | 2026-11-03 | 200 | — |
| 236 | [Quake II (Three Wave Capture The Flag for Yamagi Quake II)](https://github.com/yquake2/ctf) | PC | 23 | 2026-11-11 | 200 | — |
| 237 | [Speed-Academy](https://github.com/kugelrund/Speed-Academy) | PC | 23 | 2026-07-26 | 200 | — |
| 238 | [Daikatana (Daikatana Restoration Project)](https://github.com/atsb/daikatana-restoration-project) | PC | 22 | 2026-10-18 | 200 | — |
| 239 | [Marble Blast Gold (OpenMBG)](https://github.com/The-New-Platinum-Team/OpenMBG) | PC | 20 | 2024-08-25 | 200 | — |
| 240 | [Sonic CD (SonicCD-DC)](https://github.com/DCRSDK/SonicCD-DC) | PC | 20 | 2026-09-16 | 200 | — |
| 241 | [Heroes of Might and Magic V (HommaRe)](https://github.com/livmaster-dev/HommaRe-public) | PC | 18 | 2026-11-12 | 200 | — |
| 242 | [Speed-Outcast](https://github.com/kugelrund/Speed-Outcast) | PC | 18 | 2026-06-02 | 200 | — |
| 243 | [Harry Potter and the Philosopher's Stone (Flipendo for PS Vita)](https://github.com/31zzard/flipendo-vita) | PC | 16 | 2026-11-11 | 200 | — |
| 244 | [Return to Castle Wolfenstein (rtcw.pieter.com (iortcw + Wwasm))](https://github.com/GMH-Code/Wwasm) | PC | 16 | 2025-12-30 | 200 | — |
| 245 | [Barony (Barony Android Port)](https://github.com/DifferentNet/barony-android-port) | PC | 15 | 2026-10-16 | 200 | — |
| 246 | [Heavy Metal: F.A.K.K. 2 (fakk2-rework)](https://github.com/Sporesirius/fakk2-rework) | PC | 15 | 2020-11-12 | 200 | — |
| 247 | [Star Trek: Voyager - Elite Force (Star Trek: Voyager - Elite Force Holomatch)](https://github.com/imjustadudegamer/VoyagerHM-Android) | PC | 13 | 2026-07-11 | 200 | — |
| 248 | [NetHack (Amphitere (NetHack))](https://github.com/fancypantalons/Amphitere) | PC | 10 | 2026-06-21 | 200 | — |
| 249 | [WipeOut Phantom Edition](https://github.com/wipeout-phantom-edition/wipeout-phantom-edition) | PS1 | 991 | 2024-08-21 | 200 | — |
| 250 | [Crash Bandicoot](https://github.com/wurlyfox/c1) | PS1 | 251 | 2026-10-30 | 200 | — |
| 251 | [Crash Team Racing (High Octane)](https://github.com/Rinnegatamante/Crash-Team-Racing-High-Octane) | PS1 | 228 | 2026-10-31 | 200 | — |
| 252 | [Silent Hill (SilentEngine)](https://github.com/Sezzary/SilentEngine) | PS1 | 225 | 2026-11-15 | 200 | — |
| 253 | [Wipeout (wipeout-dc)](https://github.com/jnmartin84/wipeout-dc) | PS1 | 179 | 2026-04-01 | 200 | — |
| 254 | [Parasite Eve II (PE2PC)](https://github.com/Snaity-CORE/pe2-pc-port) | PS1 | 103 | 2026-11-18 | 200 | AI |
| 255 | [Vagrant Story (VS-NativePort)](https://github.com/JEschete/VS-NativePort) | PS1 | 97 | 2026-11-19 | 200 | — |
| 256 | [Metal Gear Solid (mgs-reintegral)](https://github.com/Drommedhar/mgs-reintegral) | PS1 | 68 | 2026-11-07 | 200 | — |
| 257 | [Vandal Hearts (Vandal Hearts PC)](https://github.com/HalmyLyseas/VandalHearts-PcPort) | PS1 | 64 | 2026-08-31 | 200 | AI |
| 258 | [King's Field II (Verdite3)](https://github.com/Voicedrew11/verdite3) | PS1 | 53 | 2026-11-09 | 200 | AI |
| 259 | [Breath of Fire III (Breath of Fire III - PC Port)](https://github.com/kerokline/BreathOfFire3PCPort) | PS1 | 30 | 2026-11-19 | 200 | — |
| 260 | [Apocalypse](https://github.com/MustafaSamer93/Apocalypse-PC-Native-Port) | PS1 | 20 | 2026-11-18 | 200 | — |
| 261 | [Crash Team Racing (CTR-PC-Port)](https://github.com/NyperYuhgard/CTR-PC-Port) | PS1 | 16 | 2026-08-03 | 200 | — |
| 262 | [Xenogears (xenogears-decomp-port)](https://github.com/Blizz127/xenogears-decomp-port) | PS1 | 14 | 2026-10-29 | 200 | AI |
| 263 | [Brave Fencer Musashi (brave-fencer-musashi-decomp-port)](https://github.com/Blizz127/Brave-Fencer-Musashi-decomp-port) | PS1 | 13 | 2026-10-30 | 200 | AI |
| 264 | [Parasite Eve (parasite-eve-decomp-port)](https://github.com/Blizz127/parasite-eve-decomp-port) | PS1 | 12 | 2026-10-30 | 200 | AI |
| 265 | [Parasite Eve II (Parasite Eve II native PC port)](https://github.com/khasinski/parasite-eve-ii-pc) | PS1 | 10 | 2026-11-15 | 200 | — |
| 266 | [Ratchet & Clank (RAC-RS)](https://github.com/AsobiCodes/rac-rs) | PS2 | 289 | 2026-11-11 | 200 | AI |
| 267 | [Resident Evil Code: Veronica X (RECVX Enhanced Port)](https://github.com/aikatore/recvx-enhanced-port) | PS2 | 281 | 2026-11-15 | 200 | AI |
| 268 | [Burnout 3: Takedown (Burnout 3: Takedown - PC port)](https://github.com/danielgomesvieira2000/burnout3-pc) | PS2 | 218 | 2026-11-15 | 200 | AI |
| 269 | [God of War (GoW PC port)](https://github.com/danielalves96/gow-pc-port) | PS2 | 209 | 2026-11-13 | 200 | AI |
| 270 | [PCSX2x6](https://github.com/PS2Homebrew-arcade/pcsx2x6) | PS2 | 203 | 2026-09-09 | 200 | — |
| 271 | [Sly Cooper and the Thievius Raccoonus (SafeHouse)](https://github.com/FridiNaTor1/SafeHouse) | PS2 | 180 | 2026-11-18 | 200 | — |
| 272 | [God of War (God of War - Native Port)](https://github.com/Waffle565/God-Of-War-Native-Port) | PS2 | 65 | 2026-11-08 | 200 | — |
| 273 | [God of War (Tobiichi-Port)](https://github.com/YYOzcan/Tobiichi-Port) | PS2 | 62 | 2026-10-15 | 200 | — |
| 274 | [God of War II (God of War II: native PC port)](https://github.com/cxldsakeb/GoW2-nativo-PS2) | PS2 | 38 | 2026-10-28 | 200 | — |
| 275 | [Marvel vs. Capcom 2](https://github.com/g-guthrie/mvc2-port-and-decomp) | PS2 | 23 | 2026-11-13 | 200 | — |
| 276 | [God Hand (God Hand Android Port)](https://github.com/owaissseeee/GodHandAndroidPort) | PS2 | 17 | 2026-11-05 | 200 | — |
| 277 | [007: Nightfire (007: Nightfire native PC port)](https://github.com/Jeffsteelflex/nightfire-port) | PS2 | 11 | 2026-11-01 | 200 | — |
| 278 | [Ratchet & Clank (PC port)](https://re-rac.github.io) | PS2 | — | — | 200 | — |
| 279 | [inFAMOUS 2 (inFAMOUS 2: native PC port)](https://github.com/SamiEnazi/infamous2-port) | PS3 | 246 | 2026-11-18 | 200 | AI |
| 280 | [ARMORED CORE 4 (AC4-Port)](https://github.com/SulphurS16/AC4-Port) | PS3 | 70 | 2026-11-14 | 200 | AI |
| 281 | [Twisted Metal (twisted-metal-2012-ps3-native-port)](https://github.com/franklincg/twisted-metal-2012-ps3-native-port) | PS3 | 25 | 2026-09-15 | 200 | — |
| 282 | [Bloodborne (Bloodborne for Windows)](https://github.com/Supermedo/bloodborne_pc) | PS4 | 5,537 | 2026-11-13 | 200 | AI |
| 283 | [God of War III Remastered (PC port)](https://github.com/FelipePrado0/SpartanPort) | PS4 | 4,947 | 2026-11-17 | 200 | — |
| 284 | [Bloodborne (bbport)](https://github.com/deadinside28/bloodborne_pc) | PS4 | 4,131 | 2026-10-28 | 200 | AI |
| 285 | [Uncharted: The Nathan Drake Collection (uncharted_pc)](https://github.com/Supermedo/uncharted_pc) | PS4 | 2,328 | 2026-11-15 | 200 | AI |
| 286 | [Shadow of the Colossus (Shadow of the Colossus - PC)](https://github.com/AjncSystem/ShadowOfTheColossus-PC) | PS4 | 1,988 | 2026-11-17 | 200 | AI |
| 287 | [inFAMOUS Second Son (iss_pc)](https://github.com/HayatoG/iss_pc) | PS4 | 1,212 | 2026-11-07 | 200 | AI |
| 288 | [Uncharted: The Nathan Drake Collection (Uncharted: The Nathan Drake Collection - PC port)](https://github.com/bc160201983/Uncharted-The-Nathan-Drake-Collection-PC-port) | PS4 | 839 | 2026-11-14 | 200 | AI |
| 289 | [Crash Team Racing: Nitro-Fueled (CTR-NitroFueled-PC)](https://github.com/GetLostIn/CTR-NitroFueled-PC) | PS4 | 759 | 2026-10-19 | 200 | AI |
| 290 | [Crash Team Racing Nitro-Fueled (OCTR: Online CTR Nitro-Fueled PC)](https://github.com/Ryu7w7/OCTR-NitroFueled-PC) | PS4 | 736 | 2026-11-19 | 200 | AI |
| 291 | [Bloodborne (bloodborne_pc_windows_port)](https://github.com/Mrsuss60/bloodborne_pc_windows_port) | PS4 | 650 | 2026-11-18 | 200 | AI |
| 292 | [The Last Guardian (The Last Guardian — native PC port)](https://github.com/HayatoG/tlg_pc) | PS4 | 591 | 2026-11-14 | 200 | AI |
| 293 | [Dragon's Crown Pro (Dragon's Crown Pro PC Port)](https://github.com/saulob/dragons-crown-pro-pc) | PS4 | 507 | 2026-11-17 | 200 | AI |
| 294 | [The Order: 1886 (The Order: 1886 PC Native Port)](https://github.com/mateussmeneses/theorder1886-port) | PS4 | 418 | 2026-11-12 | 200 | AI |
| 295 | [Gravity Rush Remastered (Gravity Rush Remastered Native PC Port)](https://github.com/LucaPazienza/gravityrush_pc) | PS4 | 390 | 2026-11-06 | 200 | AI |
| 296 | [Killzone Shadow Fall (killzone-shadowfall-pc)](https://github.com/lesca-191204/killzone-shadowfall-pc) | PS4 | 378 | 2026-11-05 | 200 | AI |
| 297 | [WipEout Omega Collection (wipeout_pc)](https://github.com/AbdelmoumenDeghbouche/wipeout_pc) | PS4 | 349 | 2026-11-14 | 200 | AI |
| 298 | [MediEvil (MediEvil (PS4) for PC)](https://github.com/bc160201983/medievil_2019_pc_port) | PS4 | 274 | 2026-11-10 | 200 | AI |
| 299 | [EA Sports UFC 3 (UFC 3 — native PS4 port for Linux and Windows)](https://github.com/GNSB/UFC-3-PS4-PORT-LINUX-WINDOWS) | PS4 | 266 | 2026-10-26 | 200 | AI |
| 300 | [Unicorn Overlord (Unicorn Overlord PC)](https://github.com/hachi23/unicorn_overlord_pc) | PS4 | 264 | 2026-11-18 | 200 | AI |
| 301 | [The Order: 1886 (The Order: 1886 — PC)](https://github.com/JulioCacko/The-Order-1886_pc) | PS4 | 237 | 2026-11-07 | 200 | AI |
| 302 | [The Last Guardian (The Last Guardian PC Port)](https://github.com/SulphurS16/TLG-Port) | PS4 | 213 | 2026-11-14 | 200 | AI |
| 303 | [Odin Sphere Leifthrasir (Odin Sphere Leifthrasir PC Port)](https://github.com/saulob/odin-sphere-leifthrasir-pc) | PS4 | 209 | 2026-11-04 | 200 | AI |
| 304 | [Gravity Rush 2 (Gravity Rush 2 Native PC Port)](https://github.com/HayatoG/gr2_pc) | PS4 | 194 | 2026-10-24 | 200 | AI |
| 305 | [Uncharted: The Nathan Drake Collection (Uncharted_Collection_PC)](https://github.com/zorde23/Uncharted_Collection_PC) | PS4 | 185 | 2026-11-05 | 200 | AI |
| 306 | [Gravity Rush Remastered / Gravity Rush 2 (GRport)](https://github.com/qnfn/GRport) | PS4 | 184 | 2026-11-19 | 200 | AI |
| 307 | [Bloodborne (Bloodborne for Linux)](https://github.com/ayozetr/bloodborne_linux) | PS4 | 168 | 2026-11-18 | 200 | AI |
| 308 | [inFAMOUS First Light (inFAMOUS First Light — native PC port)](https://github.com/VantageEX/infamous-first-light-pc) | PS4 | 166 | 2026-10-25 | 200 | AI |
| 309 | [Dragon's Crown Pro (OpenCrown PC)](https://github.com/Nezara/OpenCrown-PC) | PS4 | 141 | 2026-11-14 | 200 | AI |
| 310 | [NHL 24 (nhl24pc)](https://github.com/HajDEO/nhl24pc) | PS4 | 119 | 2026-11-18 | 200 | AI |
| 311 | [13 Sentinels: Aegis Rim (13 Sentinels: Aegis Rim - PC Port)](https://github.com/saulob/13-sentinels-aegis-rim-pc) | PS4 | 117 | 2026-11-09 | 200 | AI |
| 312 | [Uncharted: The Nathan Drake Collection (uncharted-android)](https://github.com/revvv991/uncharted-android) | PS4 | 109 | 2026-11-17 | 200 | AI |
| 313 | [Astro Bot (Astro Bot PC Port (AstroHybrid))](https://github.com/imnotsharingmyname/pcportastrobot) | PS5 | 965 | 2026-11-16 | 200 | — |
| 314 | [God of War: Sons of Sparta (Sons Of Sparta PS5 Native)](https://github.com/OverkillLabs3/SoS-PS5) | PS5 | 210 | 2026-11-08 | 200 | AI |
| 315 | [Shin Megami Tensei: Persona 3 Portable (P3P3DS)](https://github.com/endercodezz/P3P3DS) | PSP | 63 | 2026-11-06 | 200 | — |
| 316 | [Monster Hunter Freedom Unite (Project Cuga)](https://github.com/SirNubs/Project-Cuga) | PSP | 20 | 2026-10-26 | 200 | — |
| 317 | [The Legend of Zelda: A Link to the Past (3DS port)](https://github.com/EstebanPdN/zelda-alttp-3ds) | SNES | 804 | 2026-11-12 | 200 | — |
| 318 | [Super Mario All-Stars (Super Mario All-Stars — PC Port)](https://github.com/Darhkfox/SuperMarioAllStars) | SNES | 383 | 2026-11-06 | 200 | AI |
| 319 | [The Legend of Zelda: A Link to the Past (zelda3-android)](https://github.com/Waterdish/zelda3-android) | SNES | 211 | 2024-06-03 | 200 | — |
| 320 | [EarthBound (Phase Distorter)](https://github.com/TheRunaway5/Phase-Distorter) | SNES | 154 | 2026-10-19 | 200 | — |
| 321 | [Super Mario World (SMAS_Launcher)](https://github.com/stephini/SMAS_Launcher) | SNES | 63 | 2023-07-20 | 200 | — |
| 322 | [EarthBound (earthbound (D port))](https://github.com/Herringway/earthbound) | SNES | 38 | 2025-08-08 | 200 | — |
| 323 | [Tiny Toon Adventures: Buster Busts Loose! (Buster Busts Loose! (PC port))](https://github.com/Darhkfox/BusterBustsLoose) | SNES | 33 | 2026-10-07 | 200 | AI |
| 324 | [Zombies Ate My Neighbors (Zombies Ate My Neighbors PC Port)](https://github.com/moshferatu/zombies-ate-my-neighbors-pc-port) | SNES | 29 | 2026-10-30 | 200 | AI |
| 325 | [The Legend of Zelda: A Link to the Past (ALTTP-DX)](https://github.com/YeOldPress/alttp-dx) | SNES | 24 | 2026-11-01 | 200 | — |
| 326 | [Super Metroid (sm-3ds)](https://github.com/CharlesAverill/sm-3ds) | SNES | 14 | 2026-01-14 | 200 | — |
| 327 | [Monster Hunter Generations Ultimate (MHGU for Android and PC)](https://github.com/khorne-hub/gu-native) | Switch | 241 | 2026-11-18 | 200 | — |
| 328 | [The Legend of Zelda: Tears of the Kingdom (TotK Native)](https://github.com/AurelioB/totk-android) | Switch | 198 | 2026-11-19 | 200 | — |
| 329 | [Pokémon Brilliant Diamond (Strahlender XNU)](https://github.com/Veemyu/strahlender-xnu) | Switch | 166 | 2026-11-05 | 200 | AI |
| 330 | [Super Mario Odyssey (SMO Android Port)](https://github.com/Deez-coder/SMO-android-port) | Switch | 95 | 2026-11-18 | 200 | — |
| 331 | [Super Smash Bros. Ultimate (SSBU (PS4 port of WindowSmash))](https://github.com/iHaiDeeZ/SSBU) | Switch | 41 | 2026-10-29 | 200 | — |
| 332 | [Tsukihime -A piece of blue glass moon- (tsukire-pc-port)](https://github.com/Broomstick-Girl-Magical-Amber/tsukire-pc-port) | Switch | 37 | 2026-11-19 | 200 | — |
| 333 | [The Legend of Zelda: Ocarina of Time (Switch 2) (NX2navi)](https://github.com/ZuanCrisp/NX2Navi-Zelda-OOT-Port) | Switch 2 | 16 | 2026-11-16 | 200 | — |
| 334 | [The Legend of Zelda: Ocarina of Time (NX2navi)](https://github.com/tangerineturtle1/NX2navi) | switch2 | 4,324 | 2026-11-16 | 200 | AI |
| 335 | [Donkey Kong Bananza (BananaNative)](https://github.com/Raphix91/BananaNative) | switch2 | 174 | 2026-11-05 | 200 | AI |
| 336 | [Mario Kart Wii (Mario Kart WiiCompiled)](https://github.com/patchzyy/Wiicompiled) | Wii | 1,451 | 2026-11-18 | 200 | AI |
| 337 | [Mario Kart Wii (KartPad)](https://github.com/chrissotraidis/kartpad) | Wii | 758 | 2026-11-19 | 200 | AI |
| 338 | [Mario Kart Wii (MKW-3DS)](https://github.com/MiniBandit/MKW-3DS) | Wii | 297 | 2026-11-14 | 200 | — |
| 339 | [Mario Strikers Charged (mscharged-port)](https://github.com/previouslevelgames/recharged) | Wii | 233 | 2026-11-14 | 200 | — |
| 340 | [Mario Kart Wii - Service Pack (mkw-sp)](https://github.com/mkw-sp/mkw-sp) | Wii | 104 | 2025-12-11 | 200 | — |
| 341 | [The Legend of Zelda: Skyward Sword (Skybreak)](https://github.com/Kyra422/skybreak) | Wii | 9 | 2026-10-05 | 200 | — |
| 342 | [Splatoon (SplatPC)](https://github.com/PC-PORTERS/SplatPC-Splatoon-Native-PC-Port) | Wii U | 80 | 2026-11-18 | 200 | — |
| 343 | [Need for Speed: Underground 2 (Switch port)](https://github.com/antoxa2584x/nfsu2-sw) | Xbox | 213 | 2026-10-18 | 200 | AI |
| 344 | [FIFA Street (ReStreet)](https://github.com/samuelit0davila/fifa-street-pc-port) | Xbox 360 | 530 | 2026-10-31 | 200 | AI |
| 345 | [Tekken 6 (Tekken6-native-online)](https://github.com/Ekspym/Tekken6-native-online) | Xbox 360 | 479 | 2026-10-18 | 200 | AI |
| 346 | [Saints Row (Saints Reborn)](https://github.com/whompay/SaintsReborn) | Xbox 360 | 237 | 2026-11-16 | 200 | AI |
| 347 | [Forza Motorsport 4 (hl360-forza4)](https://github.com/0herculabs/hl360-forza4) | Xbox 360 | 220 | 2026-11-10 | 200 | AI |
| 348 | [Gears of War 2 (Gears of War 2 PC port)](https://github.com/santiquiroz/gears-of-war-2-pc-port) | Xbox 360 | 192 | 2026-11-18 | 200 | — |
| 349 | [WWE SmackDown vs. Raw 2011 (WWE SmackDown vs. Raw 2011 - PC Port)](https://github.com/KaikoClanworth1/wwe-svr2011-pc) | Xbox 360 | 188 | 2026-11-16 | 200 | AI |
| 350 | [Skate 2 (skate2-rust-port)](https://github.com/skate6743/skate2-rust-port) | Xbox 360 | 151 | 2026-11-16 | 200 | AI |
| 351 | [Forza Motorsport 3 (hl360-forza3)](https://github.com/0herculabs/hl360-forza3) | Xbox 360 | 119 | 2026-10-17 | 200 | AI |
| 352 | [Lollipop Chainsaw (Re-Cherry)](https://github.com/MaxDeadBear/Re-Cherry) | Xbox 360 | 80 | 2026-04-01 | 200 | — |
| 353 | [Naughty Bear Gold Edition (ReStuff)](https://github.com/MaxDeadBear/NaughtyBear_ReStuff) | Xbox 360 | 71 | 2026-10-22 | 200 | — |
| 354 | [Gears of War 2 (gears2-nx)](https://github.com/VasilkovND/gears2-nx) | Xbox 360 | 34 | 2026-11-07 | 200 | — |
| 355 | [Blue Dragon (Blue Dragon Android)](https://github.com/JayElDragon/blue-dragon-android) | Xbox 360 | 27 | 2026-11-07 | 200 | — |
| 356 | [The Beatles: Rock Band (The Beatles: Rock Band for PC)](https://github.com/mercurialw0rld/thebeatlesrockband-pcport) | Xbox 360 | 24 | 2026-11-10 | 200 | — |
| 357 | [Gears of War 3 (Gears of War 3 PC port)](https://github.com/KiltedKernel/COGBox-trilogy) | Xbox 360 | 22 | 2026-11-11 | 200 | — |
| 358 | [Naruto: The Broken Bond (Naruto: The Broken Bond Android Port)](https://github.com/1nsec/Naruto-The-Broken-Bond-Android-Port) | Xbox 360 | 19 | 2026-11-10 | 200 | — |
| 359 | [The Dishwasher: Dead Samurai (DishSoap)](https://github.com/Hdmaniak/DishSoap) | Xbox 360 | 15 | 2026-10-21 | 200 | — |
| 360 | [Manic Miner (mrcook manic-miner (Manic Miner: Retro!))](https://github.com/mrcook/manic-miner) | ZX Spectrum | 19 | 2021-03-01 | 200 | — |
| 361 | [ioquake3](https://github.com/ioquake/ioq3) | — | 2,875 | 2026-11-04 | 200 | — |
| 362 | [Raze](https://github.com/ZDoom/Raze) | — | 896 | 2026-11-01 | 200 | — |
| 363 | [NBlood](https://github.com/NBlood/NBlood) | — | 826 | 2026-09-14 | 200 | — |
| 364 | [Cortex Command Community Project Source](https://github.com/cortex-command-community/Cortex-Command-Community-Project-Source) | — | 202 | 2024-01-05 | 200† | — |

### 2.5 Disassemblies — 238 rows

*Annotated assembly that rebuilds the original ROM, mostly 8/16-bit games.*

| # | Title (link = project URL) | Platform | Stars | Last activity | Link | AI |
|--:|---|---|--:|---|:--:|:--:|
| 1 | [Alien Breed](https://github.com/hitchhikr/alienbreed) | Amiga | 21 | 2025-10-28 | 200 | — |
| 2 | [Batman: The Movie (MarkyTurtle Batman---Amiga)](https://github.com/MarkyTurtle/Batman---Amiga) | Amiga | 12 | 2026-09-18 | 200 | — |
| 3 | [Prince of Persia (SDLPoP-Dreamcast)](https://github.com/Memorix101/SDLPoP-Dreamcast) | Apple II | 27 | 2025-01-22 | 200 | — |
| 4 | [Contra](https://github.com/vermiceli/nes-contra-us) | Arcade | 249 | 2026-06-07 | 200 | — |
| 5 | [Asteroids (asteroids-disassembly)](https://github.com/nmikstas/asteroids-disassembly) | Arcade | 55 | 2019-12-16 | 200 | — |
| 6 | [Mario Bros. (Mario-Bros.-Dis)](https://github.com/RussianManSMWC/Mario-Bros.-Dis) | Arcade | 36 | 2026-06-17 | 200 | — |
| 7 | [Wizard of Wor (dabadab wizardofwor)](https://github.com/dabadab/wizardofwor) | Arcade | 35 | 2021-03-21 | 200 | — |
| 8 | [Jackal (NES-Jackal_Disassembly_Fully_Commented)](https://github.com/RayofJay/NES-Jackal_Disassembly_Fully_Commented) | Arcade | 29 | 2023-05-29 | 200 | — |
| 9 | [Arkanoid (arkanoid_msx_disasm)](https://github.com/mcolom/arkanoid_msx_disasm) | Arcade | 22 | 2026-03-23 | 200 | — |
| 10 | [Green Beret (cadaver greenberet-disassembly)](https://github.com/cadaver/greenberet-disassembly) | Arcade | 11 | 2026-10-26 | 200 | — |
| 11 | [River Raid (river-raid-disasm (Sergei Morozov))](https://github.com/river-raid/river-raid-disasm) | Atari 2600 | 15 | 2026-04-05 | 200 | — |
| 12 | [Haunted House](https://github.com/brandonrobertz/haunted_house_disassembly) | Atari 2600 | 12 | 2020-06-11 | 200 | — |
| 13 | [Mercenary (mikedailly MercenaryDisassembly)](https://github.com/mikedailly/MercenaryDisassembly) | Atari 8-bit | 15 | 2026-03-13 | 200 | — |
| 14 | [Chip's Challenge (CHIPS.EXE)](https://github.com/magical/CHIPS.EXE) | Atari Lynx | 23 | 2021-05-20 | 200 | — |
| 15 | [Thrust (kieranhj thrust-disassembly)](https://github.com/kieranhj/thrust-disassembly) | BBC Micro/Acorn | 27 | 2026-10-15 | 200 | — |
| 16 | [Gridrunner (gridrunner (Llamasoft Source Code Project))](https://github.com/mwenge/gridrunner) | Commodore 64/8-bit | 76 | 2023-05-19 | 200 | — |
| 17 | [Maniac Mansion (Maniac.Mansion.Disassembly)](https://github.com/segrax/Maniac.Mansion.Disassembly) | Commodore 64/8-bit | 43 | 2020-04-23 | 200 | — |
| 18 | [Iridis Alpha (iridisalpha (Llamasoft Source Code Project))](https://github.com/mwenge/iridisalpha) | Commodore 64/8-bit | 30 | 2025-03-03 | 200 | — |
| 19 | [Ghost Town (Esshahn Ghost-Town)](https://github.com/Esshahn/Ghost-Town) | Commodore 64/8-bit | 23 | 2020-04-01 | 200 | — |
| 20 | [Crossroads II: Pandemonium (crossroads-2-disassembly)](https://github.com/MarkRdgOx/crossroads-2-disassembly) | Commodore 64/8-bit | 14 | 2026-08-21 | 200 | — |
| 21 | [The Way of the Exploding Fist (Paul Maddern (pobtastic) SkoolKit disassembly)](https://github.com/pobtastic/wayoftheexplodingfist) | Commodore 64/8-bit | 13 | 2026-11-09 | 200 | — |
| 22 | [Supaplex (cilliemalan supaplex)](https://github.com/cilliemalan/supaplex) | DOS | 35 | 2024-04-05 | 200 | — |
| 23 | [ZZT (ZZT Disassembly Project)](https://github.com/cknave/zztasm) | DOS | 15 | 2016-11-15 | 200 | — |
| 24 | [Sonic Adventure](https://github.com/sonicretro/sad_disasm) | Dreamcast | 27 | 2013-12-02 | 200 | — |
| 25 | [Pokémon Platinum (PokePlat)](https://github.com/JimB16/PokePlat) | DS | 117 | 2023-01-31 | 200 | — |
| 26 | [Rhythm Heaven](https://github.com/patataofcourse/rhgold) | DS | 54 | 2026-06-21 | 200 | — |
| 27 | [Pokemon Red](https://github.com/pret/pokered) | Game Boy | 5,037 | 2026-11-14 | 200 | — |
| 28 | [Pokemon Yellow](https://github.com/pret/pokeyellow) | Game Boy | 904 | 2026-11-01 | 200 | — |
| 29 | [Pokemon Gold SpaceWorld Demo](https://github.com/pret/pokegold-spaceworld) | Game Boy | 403 | 2026-11-16 | 200 | — |
| 30 | [Tetris](https://github.com/osnr/tetris) | Game Boy | 86 | 2017-07-01 | 200 | — |
| 31 | [Super Mario Land](https://github.com/kaspermeerts/supermarioland) | Game Boy | 72 | 2022-09-29 | 200 | — |
| 32 | [Kirby's Dream Land (kirbydreamland)](https://github.com/huderlem/kirbydreamland) | Game Boy | 54 | 2020-06-16 | 200 | — |
| 33 | [Tetris (GAME BOY)](https://github.com/alexsteb/tetris_disassembly) | Game Boy | 52 | 2021-06-03 | 200 | — |
| 34 | [Super Mario Land 3: Wario Land](https://github.com/Kak2X/wl) | Game Boy | 49 | 2026-07-19 | 200 | — |
| 35 | [Metroid II: Return of Samus (M2RoS)](https://github.com/metroidret/M2RoS) | Game Boy | 34 | 2026-08-25 | 200 | — |
| 36 | [Tetris (tetris-gb-disasm)](https://github.com/vinheim3/tetris-gb-disasm) | Game Boy | 32 | 2023-01-19 | 200 | — |
| 37 | [Pokémon Red and Blue (pokegreen)](https://github.com/Narishma-gb/pokegreen) | Game Boy | 29 | 2026-08-16 | 200 | — |
| 38 | [Donkey Kong '94](https://github.com/CelestialAmber/DKGBDisasm) | Game Boy | 28 | 2022-03-16 | 200 | — |
| 39 | [Pokémon Red and Blue (pokered-fr)](https://github.com/einstein95/pokered-fr) | Game Boy | 24 | 2026-01-27 | 200 | — |
| 40 | [Final Fantasy Adventure (FFA-Disassembly)](https://github.com/daid/FFA-Disassembly) | Game Boy | 23 | 2026-11-04 | 200 | — |
| 41 | [Mega Man: Dr. Wily's Revenge](https://github.com/iimarckus/megaman) | Game Boy | 18 | 2018-10-13 | 200 | — |
| 42 | [Pokémon Red and Blue (pokered-jp)](https://github.com/luckytyphlosion/pokered-jp) | Game Boy | 18 | 2017-01-16 | 200 | — |
| 43 | [Tetris (gbtetris)](https://github.com/meithecatte/gbtetris) | Game Boy | 16 | 2019-07-01 | 200 | — |
| 44 | [Pokémon Red and Blue (pokeblue)](https://github.com/Narishma-gb/pokeblue) | Game Boy | 15 | 2026-08-16 | 200 | — |
| 45 | [Pokémon Red and Blue (Pokered-Pro)](https://github.com/Kamy41/Pokered-Pro) | Game Boy | 14 | 2026-09-08 | 200 | — |
| 46 | [Tetris (tetris-disassembly (davFaithid))](https://github.com/davFaithid/tetris-disassembly) | Game Boy | 14 | 2020-11-27 | 200 | — |
| 47 | [Mega Man II (rw2)](https://github.com/Kak2X/rw2) | Game Boy | 13 | 2026-10-09 | 200 | — |
| 48 | [Pokémon Yellow (pokeyellow-jp)](https://github.com/Narishma-gb/pokeyellow-jp) | Game Boy | 11 | 2026-01-18 | 200 | — |
| 49 | [X (X-disasm)](https://github.com/2Tie/X-disasm) | Game Boy | 10 | 2022-01-18 | 200 | — |
| 50 | [Pokemon Crystal](https://github.com/pret/pokecrystal) | Game Boy Color | 2,553 | 2026-11-16 | 200 | — |
| 51 | [The Legend of Zelda Links Awakening DX](https://github.com/zladx/LADX-Disassembly) | Game Boy Color | 921 | 2026-09-25 | 200 | — |
| 52 | [Pokemon Gold](https://github.com/pret/pokegold) | Game Boy Color | 742 | 2026-11-16 | 200 | — |
| 53 | [Pokemon TCG 1](https://github.com/pret/poketcg) | Game Boy Color | 335 | 2026-10-30 | 200 | — |
| 54 | [Pokemon Pinball](https://github.com/pret/pokepinball) | Game Boy Color | 207 | 2026-10-30 | 200 | — |
| 55 | [Keitai Denjuu Telefang](https://github.com/telefang/telefang) | Game Boy Color | 103 | 2025-10-19 | 200 | — |
| 56 | [Pokemon TCG 2](https://github.com/pret/poketcg2) | Game Boy Color | 98 | 2026-10-31 | 200 | — |
| 57 | [Pokemon Puzzle Challenge](https://github.com/pret/pokepuzzle) | Game Boy Color | 83 | 2026-10-31 | 200 | — |
| 58 | [Medarot 3](https://github.com/Medabots/medarot3) | Game Boy Color | 49 | 2026-11-07 | 200 | — |
| 59 | [Pokémon Crystal (pokekuristaru)](https://github.com/PikalaxALT/pokekuristaru) | Game Boy Color | 24 | 2017-08-02 | 200 | — |
| 60 | [Hamtaro: Ham-Hams Unite! (hamtaro-in-pieces)](https://github.com/obskyr/hamtaro-in-pieces) | Game Boy Color | 21 | 2018-04-09 | 200 | — |
| 61 | [Harry Potter and the Sorcerer's Stone (HPSS-Disassembly)](https://github.com/terinjokes/HPSS-Disassembly) | Game Boy Color | 21 | 2024-10-24 | 200 | — |
| 62 | [Harvest Moon 3 GBC (hm3)](https://github.com/Sanqui/hm3) | Game Boy Color | 19 | 2023-04-30 | 200 | — |
| 63 | [Medarot 4](https://github.com/Medabots/medarot4) | Game Boy Color | 16 | 2025-02-05 | 200 | — |
| 64 | [Looney Tunes: Carrot Crazy](https://github.com/huderlem/carrotcrazy) | Game Boy Color | 15 | 2026-05-29 | 200 | — |
| 65 | [Wario Land 3 (warioland3 (ElectroDeoxys))](https://github.com/ElectroDeoxys/warioland3) | Game Boy Color | 15 | 2026-08-16 | 200 | — |
| 66 | [Dragon Warrior III (GBC) (dragon-warrior-3-gbc)](https://github.com/VariantXYZ/dragon-warrior-3-gbc) | Game Boy Color | 13 | 2024-06-28 | 200 | — |
| 67 | [Pokémon Gold and Silver (pokesilver)](https://github.com/Narishma-gb/pokesilver) | Game Boy Color | 12 | 2026-06-13 | 200 | — |
| 68 | [Mario Golf (mgolf)](https://github.com/DarkRTA/mgolf) | Game Boy Color | 11 | 2022-11-30 | 200 | — |
| 69 | [Keitai Denjuu Telefang (telefang_gb)](https://github.com/PikalaxALT/telefang_gb) | Game Boy Color | 10 | 2020-06-05 | 200 | — |
| 70 | [BattleTanx (Game Boy Color)](https://github.com/TheGh0stShip/BattleTanx-GBC) | Game Boy Color | 2 | 2026-10-22 | 200 | — |
| 71 | [Sonic Riders](https://github.com/doldecomp/sonicriders) | GameCube | 40 | 2022-02-06 | 200 | — |
| 72 | [Harvest Moon: A Wonderful Life](https://github.com/ChrisNonyminus/hmawl) | GameCube | 27 | 2022-11-22 | 200 | — |
| 73 | [Super Mario Sunshine (SMS)](https://github.com/JimB16/SMS) | GameCube | 21 | 2018-08-29 | 200 | — |
| 74 | [FIre Emblem: The Sacred Stones](https://github.com/FireEmblemUniverse/fireemblem8u) | GBA | 235 | 2026-11-17 | 200 | — |
| 75 | [The Legend of Zelda: A Link to the Past & Four Swords (zeldaalttp)](https://github.com/camthesaxman/zeldaalttp) | GBA | 55 | 2022-10-16 | 200 | — |
| 76 | [Harvest Moon: Friends of Mineral Town (hmfomt)](https://github.com/not-alons/hmfomt) | GBA | 48 | 2021-05-27 | 200 | — |
| 77 | [Megaman Zero 3](https://github.com/mmzret/rmz3) | GBA | 48 | 2026-07-07 | 200 | — |
| 78 | [Mega Man Battle Network 6 (bn6f)](https://github.com/dism-exe/bn6f) | GBA | 45 | 2026-08-10 | 200 | — |
| 79 | [Pokémon FireRed and LeafGreen (DisFire)](https://github.com/shinyquagsire23/DisFire) | GBA | 37 | 2015-11-26 | 200 | — |
| 80 | [Golden Sun](https://github.com/gsret/goldensun) | GBA | 35 | 2025-06-05 | 200 | — |
| 81 | [Mario VS Donkey Kong](https://github.com/camthesaxman/mariovsdk) | GBA | 23 | 2017-08-04 | 200 | — |
| 82 | [Fire Emblem: The Blazing Blade (fe7_us)](https://github.com/StanHash/fe7_us) | GBA | 19 | 2024-05-29 | 200 | — |
| 83 | [Super Mario Advance 2: Super Mario World](https://github.com/atasro2/sma2) | GBA | 19 | 2019-01-04 | 200 | — |
| 84 | [Mega Man Battle Network 6 (exe6f)](https://github.com/dism-exe/exe6f) | GBA | 18 | 2018-07-15 | 200 | — |
| 85 | [Mario & Luigi: The Superstar Saga](https://github.com/nstearns96/MLSuperstarSaga) | GBA | 17 | 2018-03-25 | 200 | — |
| 86 | [Super Mario Advance 4: Super Mario Bros. 3 (sma4-disasm)](https://github.com/KarisaAdvynia/sma4-disasm) | GBA | 16 | 2025-05-23 | 200 | — |
| 87 | [Pokémon Pinball: Ruby & Sapphire (Pokemon-Pinball-RS-Disassembly-Project)](https://github.com/Normmatt/Pokemon-Pinball-RS-Disassembly-Project) | GBA | 13 | 2015-09-24 | 200 | — |
| 88 | [Mega Man Battle Network 4 (exe4rs)](https://github.com/dism-exe/exe4rs) | GBA | 10 | 2018-07-28 | 200 | — |
| 89 | [Pokémon Mystery Dungeon: Red Rescue Team (pokemdred)](https://github.com/PikalaxALT/pokemdred) | GBA | 10 | 2017-12-11 | 200 | — |
| 90 | [The Urbz: Sims in the City](https://github.com/SimsAdvanceRet/UrbzGBADecomp) | GBA | 10 | 2025-06-12 | 200 | — |
| 91 | [The Sims 2 (GBA)](https://github.com/SimsAdvanceRet/S2GBADecomp) | GBA | 7 | 2025-06-12 | 200 | — |
| 92 | [Sonic the Hedgehog (s1disasm)](https://github.com/sonicretro/s1disasm) | Genesis | 463 | 2026-11-12 | 200 | — |
| 93 | [Sonic the Hedgehog 2 (s2disasm)](https://github.com/sonicretro/s2disasm) | Genesis | 322 | 2026-11-18 | 200 | — |
| 94 | [Sonic & Knuckles](https://github.com/sonicretro/skdisasm) | Genesis | 267 | 2026-10-11 | 200 | — |
| 95 | [Sonic 3 & Knuckles (Sonic Clean Engine (S.C.E.))](https://github.com/TheBlad768/Sonic-Clean-Engine-S.C.E.-) | Genesis | 62 | 2026-11-19 | 200 | — |
| 96 | [Shining Force II (SF2DISASM)](https://github.com/ShiningForceCentral/SF2DISASM) | Genesis | 56 | 2026-11-15 | 200 | — |
| 97 | [Sonic the Hedgehog (Hivebrain 2022 s1disasm)](https://github.com/cvghivebrain/s1disasm) | Genesis | 49 | 2024-03-12 | 200 | — |
| 98 | [Kid Chameleon](https://github.com/sonicretro/kid-chameleon-disasm) | Genesis | 43 | 2026-10-28 | 200 | — |
| 99 | [Sonic Pinball](https://github.com/sonicretro/spindisasm) | Genesis | 42 | 2019-11-28 | 200 | — |
| 100 | [Ristar](https://github.com/sonicretro/ristar) | Genesis | 34 | 2013-12-07 | 200 | — |
| 101 | [Sonic 3D Blast](https://github.com/sonicretro/s3ddisasm) | Genesis | 34 | 2013-12-02 | 200 | — |
| 102 | [Shining Force (SF1DISASM)](https://github.com/ShiningForceCentral/SF1DISASM) | Genesis | 23 | 2025-09-11 | 200 | — |
| 103 | [Puyo Puyo (puyodisasm)](https://github.com/Nasina7/puyodisasm) | Genesis | 16 | 2025-11-16 | 200 | — |
| 104 | [Sonic the Hedgehog 2 (Sonic-2-Nick-Arcade-Disassembly)](https://github.com/AlexField442/Sonic-2-Nick-Arcade-Disassembly) | Genesis | 11 | 2026-06-05 | 200 | — |
| 105 | [ToeJam & Earl (tje-disasm)](https://github.com/bstreiff/tje-disasm) | Genesis | 11 | 2021-01-25 | 200 | — |
| 106 | [Sonic the Hedgehog 2 (8-bit) (s2smsdisasm)](https://github.com/sonicretro/s2smsdisasm) | Master System/Game Gear | 59 | 2013-12-02 | 200 | — |
| 107 | [Alex Kidd in Miracle World (akmw)](https://github.com/lhsazevedo/akmw) | Master System/Game Gear | 27 | 2026-06-05 | 200 | — |
| 108 | [Sonic the Hedgehog (8-bit) (Sonic-1-Game-Gear-Disassembly)](https://github.com/TheRavenfreak/Sonic-1-Game-Gear-Disassembly) | Master System/Game Gear | 12 | 2019-07-12 | 200 | — |
| 109 | [Idle Office Tycoon](https://github.com/Avenze/ios_reverse_engineering) | Mobile | 6 | 2025-06-01 | 200 | — |
| 110 | [Metal Gear](https://github.com/GuillianSeed/MetalGear) | MSX | 328 | 2022-01-15 | 200 | — |
| 111 | [Pokemon Stadium 1](https://github.com/pret/pokestadium) | N64 | 216 | 2026-10-03 | 200 | — |
| 112 | [Pokemon Stadium 2](https://github.com/pret/pokestadiumgs) | N64 | 62 | 2026-07-10 | 200 | — |
| 113 | [The Legend of Zelda: Ocarina of Time (vc64-decomp)](https://github.com/nim-ka/vc64-decomp) | N64 | 21 | 2024-05-14 | 200 | — |
| 114 | [Metal Slug (mslug-disasm)](https://github.com/neogeodev/mslug-disasm) | Neo Geo | 14 | 2017-05-16 | 200 | — |
| 115 | [Battle City](https://github.com/cyneprepou4uk/NES-Games-Disassembly/tree/main/Battle%20City) | NES | 311 | 2026-08-12 | 200 | — |
| 116 | [Danny Sullivan's Indy heat](https://github.com/cyneprepou4uk/NES-Games-Disassembly/tree/main/Danny%20Sullivan's%20Indy%20Heat) | NES | 311 | 2026-08-12 | 200 | — |
| 117 | [Double Dragon II: The Revenge](https://github.com/cyneprepou4uk/NES-Games-Disassembly/tree/main/Double%20Dragon%20II) | NES | 311 | 2026-08-12 | 200 | — |
| 118 | [ExciteBike](https://github.com/cyneprepou4uk/NES-Games-Disassembly/tree/main/Excitebike) | NES | 311 | 2026-08-12 | 200 | — |
| 119 | [Ice Climber](https://github.com/cyneprepou4uk/NES-Games-Disassembly/tree/main/Ice%20Climber) | NES | 311 | 2026-08-12 | 200 | — |
| 120 | [Kunio-kun no Nekketsu Soccer League](https://github.com/cyneprepou4uk/NES-Games-Disassembly/tree/main/Kunio-kun%20no%20Nekketsu%20Soccer%20League) | NES | 311 | 2026-08-12 | 200 | — |
| 121 | [Mappy](https://github.com/cyneprepou4uk/NES-Games-Disassembly/tree/main/Mappy) | NES | 311 | 2026-08-12 | 200 | — |
| 122 | [Nuts & Milk](https://github.com/cyneprepou4uk/NES-Games-Disassembly/tree/main/Nuts%20%26%20Milk) | NES | 311 | 2026-08-12 | 200 | — |
| 123 | [Pac Man](https://github.com/cyneprepou4uk/NES-Games-Disassembly/tree/main/Pac-Man) | NES | 311 | 2026-08-12 | 200 | — |
| 124 | [Solstice: The Quest for the Staff of Demnos](https://github.com/cyneprepou4uk/NES-Games-Disassembly/tree/main/Solstice) | NES | 311 | 2026-08-12 | 200 | — |
| 125 | [SonSon](https://github.com/cyneprepou4uk/NES-Games-Disassembly/tree/main/Son%20Son) | NES | 311 | 2026-08-12 | 200 | — |
| 126 | [Tecmo World Cup Soccer](https://github.com/cyneprepou4uk/NES-Games-Disassembly/tree/main/Tecmo%20World%20Cup%20Soccer) | NES | 311 | 2026-08-12 | 200 | — |
| 127 | [The Bugs Bunny Crazy Castle](https://github.com/cyneprepou4uk/NES-Games-Disassembly/tree/main/Bugs%20Bunny%20Crazy%20Castle) | NES | 311 | 2026-08-12 | 200 | — |
| 128 | [Yie Ar Kung Fu](https://github.com/cyneprepou4uk/NES-Games-Disassembly/tree/main/Yie%20Ar%20Kung-Fu) | NES | 311 | 2026-08-12 | 200 | — |
| 129 | [The Legend Of Zelda](https://github.com/aldonunez/zelda1-disassembly) | NES | 284 | 2021-02-20 | 200 | — |
| 130 | [Super Mario Bros. 3](https://github.com/captainsouthbird/smb3) | NES | 259 | 2025-05-01 | 200 | — |
| 131 | [Tetris (TetrisNESDisasm)](https://github.com/CelestialAmber/TetrisNESDisasm) | NES | 112 | 2024-03-28 | 200 | — |
| 132 | [Final Fantasy](https://github.com/Entroper/FF1Disassembly) | NES | 111 | 2026-06-06 | 200 | — |
| 133 | [Dragon Warrior](https://github.com/nmikstas/dragon-warrior-disassembly) | NES | 93 | 2023-08-05 | 200 | — |
| 134 | [The Legend of Zelda (zeldasource)](https://github.com/camthesaxman/zeldasource) | NES | 78 | 2016-04-14 | 200 | — |
| 135 | [Tecmo Super Bowl (Tecmo_Super_Bowl_NES_Disassembly)](https://github.com/bruddog/Tecmo_Super_Bowl_NES_Disassembly) | NES | 64 | 2025-10-09 | 200 | — |
| 136 | [Mega Man 3](https://github.com/refreshing-lemonade/megaman3-disassembly) | NES | 52 | 2020-12-23 | 200 | — |
| 137 | [Mike Tyson's Punch Out!!](https://github.com/nmikstas/mike-tysons-punch-out-disassembly) | NES | 46 | 2020-09-13 | 200 | — |
| 138 | [Balloon Fight](https://github.com/LuigiBlood/balloonfight_dis) | NES | 45 | 2018-10-21 | 200 | — |
| 139 | [Super Mario Bros. (smb1 disassembly)](https://github.com/Xkeeper0/smb1) | NES | 43 | 2022-04-10 | 200 | — |
| 140 | [Super Mario Bros. (smb1-disasm)](https://github.com/laura240406/smb1-disasm) | NES | 39 | 2022-09-03 | 200 | — |
| 141 | [Metroid (metroid-disassembly)](https://github.com/nmikstas/metroid-disassembly) | NES | 35 | 2025-02-04 | 200 | — |
| 142 | [Mega Man 5](https://github.com/refreshing-lemonade/megaman5-disassembly) | NES | 34 | 2024-02-03 | 200 | — |
| 143 | [The Legend Of Zelda II: The Adventure Of Link](https://github.com/FiendsOfTheElements/z2disassembly) | NES | 33 | 2023-01-18 | 200 | — |
| 144 | [Donkey Kong](https://github.com/RussianManSMWC/Donkey-Kong-NES-Disassembly) | NES | 30 | 2024-04-19 | 200 | — |
| 145 | [Mega Man 4](https://github.com/refreshing-lemonade/megaman4-disassembly) | NES | 30 | 2020-12-23 | 200 | — |
| 146 | [Game Genie](https://github.com/qalle2/nes-gg-disassembly) | NES | 29 | 2025-06-22 | 200† | — |
| 147 | [Super C](https://github.com/vermiceli/nes-super-c) | NES | 29 | 2026-07-04 | 200 | — |
| 148 | [Super Mario Bros. (smb-disassembly)](https://github.com/threecreepio/smb-disassembly) | NES | 29 | 2021-05-16 | 200 | — |
| 149 | [Final Fantasy III](https://github.com/everything8215/ff3) | NES | 25 | 2022-05-28 | 200 | — |
| 150 | [Dr.Mario](https://github.com/Nostaljipi/dr-mario-disassembly) | NES | 23 | 2021-11-27 | 200 | — |
| 151 | [Final Fantasy II](https://github.com/everything8215/ff2) | NES | 23 | 2022-12-06 | 200 | — |
| 152 | [Final Fantasy (FF1-MMC5)](https://github.com/JiggeryPonkery/FF1-MMC5) | NES | 21 | 2021-01-31 | 200 | — |
| 153 | [EarthBound Beginnings (mother)](https://github.com/Nathan-R-Og/mother) | NES | 20 | 2026-11-08 | 200 | — |
| 154 | [Mega Man 6 (megaman6-disassembly)](https://github.com/refreshing-lemonade/megaman6-disassembly) | NES | 20 | 2020-12-23 | 200 | — |
| 155 | [Final Fantasy (FinalFantasyDisassembly)](https://github.com/BenWenger/FinalFantasyDisassembly) | NES | 19 | 2019-10-05 | 200 | — |
| 156 | [Super Mario Bros. 2: The Lost Levels](https://github.com/threecreepio/smb2j-disassembly) | NES | 18 | 2025-01-09 | 200 | — |
| 157 | [Donald Land](https://github.com/brunovalads/donald-land) | NES | 16 | 2018-12-19 | 200 | — |
| 158 | [Tetris (TengenTetrisDisasm)](https://github.com/zohassadar/TengenTetrisDisasm) | NES | 16 | 2024-12-16 | 200 | — |
| 159 | [Captain Tsubasa Vol. II: Super Striker (Captain-Tsubasa-2-English-Translation)](https://github.com/cyneprepou4uk/Captain-Tsubasa-2-English-Translation) | NES | 15 | 2026-04-15 | 200 | — |
| 160 | [Fire Emblem: Shadow Dragon and the Blade of Light (fe1)](https://github.com/StanHash/fe1) | NES | 15 | 2021-02-18 | 200 | — |
| 161 | [Crystalis](https://github.com/crystalisdisassembly/crystalisdisassembly) | NES | 14 | 2019-06-22 | 200 | — |
| 162 | [Mega Man (mm1dasm)](https://github.com/TheRealQuantam/mm1dasm) | NES | 14 | 2026-01-04 | 200 | — |
| 163 | [Metroid (m1disasm)](https://github.com/metroidret/m1disasm) | NES | 14 | 2026-11-15 | 200 | — |
| 164 | [Milon's Secret Castle](https://github.com/jasonmray/MilonsSecretCastle) | NES | 14 | 2026-05-05 | 200 | — |
| 165 | [Dr. Mario](https://github.com/brianhuffman/drmario) | NES | 13 | 2025-03-02 | 200 | — |
| 166 | [Castlevania (Castlevania-Labelled-Disassembly)](https://github.com/josephstevenspgh/Castlevania-Labelled-Disassembly) | NES | 10 | 2018-02-06 | 200 | — |
| 167 | [Pokéwalker (firmware/minigames) (pw)](https://github.com/lumirth/pw) | Other | 42 | 2026-09-14 | 200 | — |
| 168 | [Barnyard](https://github.com/InfiniteC0re/OpenBarnyard) | PC | 107 | 2026-11-17 | 200 | — |
| 169 | [Sonic & Knuckles Collection (PC) (skc_disasm)](https://github.com/sonicretro/skc_disasm) | PC | 25 | 2018-08-03 | 200 | — |
| 170 | [Sonic CD (scdpc_disasm)](https://github.com/sonicretro/scdpc_disasm) | PC | 21 | 2012-05-28 | 200 | — |
| 171 | [The Sims (sims1_mac_decomp)](https://github.com/simdecomp/sims1_mac_decomp) | PC | 15 | 2022-05-30 | 200 | — |
| 172 | [Driver 2](https://github.com/OpenDriver2/REDRIVER2) | PS1 | 1,471 | 2026-06-26 | 200 | — |
| 173 | [Need For Speed: High Stakes](https://github.com/OpenNFS/NFSHSX) | PS1 | 58 | 2021-07-21 | 200 | — |
| 174 | [Virtua Racing](https://github.com/matiaszanolli/sega-vr-disasm) | Sega CD/32X | 188 | 2026-06-15 | 200 | — |
| 175 | [Sonic CD (scddisasm)](https://github.com/sonicretro/scddisasm) | Sega CD/32X | 22 | 2025-07-28 | 200 | — |
| 176 | [Shining Force CD](https://github.com/ShiningForceCentral/SFCDDISASM) | Sega CD/32X | 16 | 2015-09-01 | 200 | — |
| 177 | [Super Mario World](https://github.com/IsoFrieze/SMWDisX) | SNES | 186 | 2026-08-20 | 200 | — |
| 178 | [Super Mario World 2](https://github.com/brunovalads/yoshisisland-disassembly) | SNES | 164 | 2026-08-15 | 200 | — |
| 179 | [Super Metroid](https://github.com/strager/supermetroid) | SNES | 163 | 2021-09-06 | 200 | — |
| 180 | [Super Bomberman](https://github.com/LIJI32/superbomberman) | SNES | 112 | 2026-07-05 | 200 | — |
| 181 | [Donkey Kong Country 2](https://github.com/p4plus2/DKC2-disassembly) | SNES | 76 | 2021-10-22 | 200 | — |
| 182 | [Super Mario World (smw-src)](https://github.com/galaxyhaxz/smw-src) | SNES | 60 | 2020-11-29 | 200 | — |
| 183 | [Super Mario RPG](https://github.com/Yoshifanatic1/Super-Mario-RPG-Disassembly) | SNES | 51 | 2021-05-04 | 200 | — |
| 184 | [The Legend of Zelda: A Link to the Past (jpdasm)](https://github.com/spannerisms/jpdasm) | SNES | 40 | 2026-09-15 | 200 | — |
| 185 | [Final Fantasy IV](https://github.com/everything8215/ff4) | SNES | 35 | 2022-08-02 | 200 | — |
| 186 | [Fire Emblem: Thracia 776 (FireEmblem5)](https://github.com/ZaneAvernathy/FireEmblem5) | SNES | 35 | 2024-01-03 | 200 | — |
| 187 | [Donkey Kong Country](https://github.com/Yoshifanatic1/Donkey-Kong-Country-1-Disassembly) | SNES | 30 | 2021-11-21 | 200 | — |
| 188 | [Super Mario World (SMW-SMAS-SMASW-Disassembly)](https://github.com/Yoshifanatic1/SMW-SMAS-SMASW-Disassembly) | SNES | 30 | 2021-03-05 | 200 | — |
| 189 | [Shin Megami Tensei (smt1dasm)](https://github.com/spannerisms/smt1dasm) | SNES | 26 | 2022-11-17 | 200 | — |
| 190 | [Super Metroid (sm_disassembly)](https://github.com/InsaneFirebat/sm_disassembly) | SNES | 25 | 2026-10-02 | 200 | — |
| 191 | [Super Mario World (SMWDisC (All.log++))](https://github.com/gnaghi/SMWDisC) | SNES | 24 | 2015-01-21 | 200 | — |
| 192 | [Donkey Kong Country 3](https://github.com/Yoshifanatic1/Donkey-Kong-Country-3-Disassembly) | SNES | 22 | 2021-09-30 | 200 | — |
| 193 | [Donkey Kong Country 2: Diddy's Kong Quest (Donkey-Kong-Country-2-Disassembly)](https://github.com/Yoshifanatic1/Donkey-Kong-Country-2-Disassembly) | SNES | 20 | 2021-08-31 | 200 | — |
| 194 | [Harvest Moon (HM-Decomp)](https://github.com/ElisaS-Codes/HM-Decomp) | SNES | 19 | 2024-06-10 | 200 | — |
| 195 | [Star Fox (StarFoxDisassembly)](https://github.com/SpyderTL/StarFoxDisassembly) | SNES | 19 | 2020-10-26 | 200 | — |
| 196 | [Breath Of Fire](https://github.com/Normmatt/bof) | SNES | 18 | 2021-04-05 | 200 | — |
| 197 | [The Legend of Zelda: A Link to the Past (alttp-disassembly)](https://github.com/walkingeyerobot/alttp-disassembly) | SNES | 18 | 2018-11-25 | 200 | — |
| 198 | [Super Ghouls ‘n Ghosts](https://github.com/FredYeye/Super-Ghouls-n-Ghosts-Disassembly) | SNES | 17 | 2026-10-19 | 200 | — |
| 199 | [Mystery Dungeon: Shiren the Wanderer](https://github.com/CelestialAmber/shiren) | SNES | 16 | 2023-07-13 | 200 | — |
| 200 | [Super Mario Kart (Super-Mario-Kart-Disassembly)](https://github.com/Yoshifanatic1/Super-Mario-Kart-Disassembly) | SNES | 15 | 2021-01-11 | 200 | — |
| 201 | [Mega Man 7 (Mega-Man-7-Disassembly)](https://github.com/Yoshifanatic1/Mega-Man-7-Disassembly) | SNES | 14 | 2021-01-29 | 200 | — |
| 202 | [EarthBound (EarthBound-Disassembly)](https://github.com/Yoshifanatic1/EarthBound-Disassembly) | SNES | 13 | 2021-01-11 | 200 | — |
| 203 | [Kirby Super Star (KSS-disassembly)](https://github.com/Ankouno/KSS-disassembly) | SNES | 13 | 2023-10-07 | 200 | — |
| 204 | [Super Mario World 2: Yoshi's Island (Yoshi-s-Island-Disassembly)](https://github.com/Yoshifanatic1/Yoshi-s-Island-Disassembly) | SNES | 13 | 2021-06-21 | 200 | — |
| 205 | [BS Zelda no Densetsu (BS-Zelda-no-Densetsu-Disassembly)](https://github.com/Yoshifanatic1/BS-Zelda-no-Densetsu-Disassembly) | SNES | 12 | 2021-10-31 | 200 | — |
| 206 | [International Superstar Soccer Deluxe (International-Superstar-Soccer-Deluxe-SNES-Disassembly)](https://github.com/Yoshifanatic1/International-Superstar-Soccer-Deluxe-SNES-Disassembly) | SNES | 12 | 2023-08-07 | 200 | — |
| 207 | [Jurassic Park (Jurassic-Park-1-SNES-disassembly)](https://github.com/Yoshifanatic1/Jurassic-Park-1-SNES-disassembly) | SNES | 11 | 2021-04-25 | 200 | — |
| 208 | [Goof Troop](https://github.com/Yoshifanatic1/Goof-Troop-Disassembly) | SNES | 10 | 2023-01-07 | 200 | — |
| 209 | [Mario Paint (Mario-Paint-Disassembly)](https://github.com/Yoshifanatic1/Mario-Paint-Disassembly) | SNES | 10 | 2021-01-10 | 200 | — |
| 210 | [Mario Kart Wii (DisMKW)](https://github.com/aplumafreak500/DisMKW) | Wii | 21 | 2018-11-26 | 200 | — |
| 211 | [The Great Escape (dpt The-Great-Escape)](https://github.com/dpt/The-Great-Escape) | ZX Spectrum | 90 | 2024-01-22 | 200 | — |
| 212 | [Jetpac (mrcook jetpac-disassembly)](https://github.com/mrcook/jetpac-disassembly) | ZX Spectrum | 77 | 2026-04-14 | 200 | — |
| 213 | [Nether Earth (santiontanon netherearth-disassembly)](https://github.com/santiontanon/netherearth-disassembly) | ZX Spectrum | 35 | 2022-04-06 | 200 | — |
| 214 | [Castle Master II: The Crypt (santiontanon castlemaster2-disassembly)](https://github.com/santiontanon/castlemaster2-disassembly) | ZX Spectrum | 30 | 2023-07-16 | 200 | — |
| 215 | [Manic Miner (manicminer (skoolkit.ca))](https://github.com/skoolkid/manicminer) | ZX Spectrum | 26 | 2026-11-18 | 200 | — |
| 216 | [Booga-Boo (mcolom boogaboo_disasm_msx)](https://github.com/mcolom/boogaboo_disasm_msx) | ZX Spectrum | 20 | 2024-01-28 | 200 | — |
| 217 | [Jet Set Willy (jetsetwilly (skoolkit.ca))](https://github.com/skoolkid/jetsetwilly) | ZX Spectrum | 20 | 2026-10-27 | 200 | — |
| 218 | [The Lords of Midnight (mrcook lords-of-midnight-disassembly (Spectrum + DOS))](https://github.com/mrcook/lords-of-midnight-disassembly) | ZX Spectrum | 18 | 2023-12-04 | 200 | — |
| 219 | [Manic Miner (TobyLobster ManicMiner)](https://github.com/TobyLobster/ManicMiner) | ZX Spectrum | 17 | 2024-03-04 | 200 | — |
| 220 | [Exolon (rusarh exolon-esl)](https://github.com/rusarh/exolon-esl) | ZX Spectrum | 15 | 2023-10-17 | 200 | — |
| 221 | [The Hobbit (Paul Maddern (pobtastic) SkoolKit disassembly)](https://github.com/pobtastic/hobbit) | ZX Spectrum | 13 | 2023-10-14 | 200 | — |
| 222 | [Fred (kmatveev zx-fred-reveng)](https://github.com/kmatveev/zx-fred-reveng) | ZX Spectrum | 12 | 2025-07-27 | 200 | — |
| 223 | [Rex (ultrabolido skRex)](https://github.com/ultrabolido/skRex) | ZX Spectrum | 11 | 2021-11-06 | 200 | — |
| 224 | [Deathchase (Ritchie333 deathchase)](https://github.com/Ritchie333/deathchase) | ZX Spectrum | 10 | 2023-11-07 | 200 | — |
| 225 | [The Legend of Zelda Oracle of Ages & Seasons](https://github.com/Stewmath/oracles-disasm) | — | 225 | 2026-10-02 | 200 | — |
| 226 | [Final Fantasy VI](https://github.com/everything8215/ff6) | — | 96 | 2026-09-14 | 200 | — |
| 227 | [Sonic The Fighters](https://github.com/biggestsonicfan/stfdisasm) | — | 49 | 2024-05-02 | 200 | — |
| 228 | [Knuckles Chaotix](https://github.com/sonicretro/chaotix) | — | 41 | 2026-02-27 | 200 | — |
| 229 | [Final Fantasy V](https://github.com/everything8215/ff5) | — | 21 | 2026-09-21 | 200 | — |
| 230 | [Wario land 3](https://github.com/froggestspirit/wland3) | — | 21 | 2020-08-20 | 200† | — |
| 231 | [Super Mario Land 2: Six Golden Coins](https://github.com/froggestspirit/marioland2) | — | 17 | 2014-03-07 | 200† | — |
| 232 | [The Sims: Bustin' Out](https://github.com/SimsAdvanceRet/BustinOutGBADecomp) | — | 7 | 2025-06-12 | 200 | — |
| 233 | [Homeland](https://github.com/BttrDrgn/homeland) | — | 6 | 2022-03-14 | 200 | — |
| 234 | [Super Punch-Out!!](https://github.com/Yoshifanatic1/Super-Punch-Out-Disassembly) | — | 5 | 2023-02-10 | 200 | — |
| 235 | [Dragon Warrior Monsters (German)](https://github.com/Ebernacher90/DragonQuestMonstersGerman) | — | 4 | 2020-05-31 | 200 | — |
| 236 | [Mole Mania](https://github.com/froggestspirit/mmania) | — | 4 | 2024-04-10 | 200 | — |
| 237 | [Armored Unit](https://github.com/Normmatt/unarmoredunit) | — | 3 | 2026-11-14 | 200 | — |
| 238 | [Demons Crest](https://github.com/FredYeye/various-game-disassembly) | — | 3 | 2024-08-27 | 200 | — |

### 2.6 Browser ports — 57 rows

*Games that run in a browser tab (WebAssembly / JS ports).*

| # | Title (link = project URL) | Platform | Stars | Last activity | Link | AI |
|--:|---|---|--:|---|:--:|:--:|
| 1 | [Weltendämmerung (weltendaemmerung (spec-driven RE + web port))](https://github.com/s-macke/weltendaemmerung) | Commodore 64/8-bit | 21 | 2026-01-05 | 200 | AI |
| 2 | [Doom (doom-wasm)](https://github.com/cloudflare/doom-wasm) | DOS | 421 | 2024-09-20 | 200 | — |
| 3 | [lba2remake](https://github.com/LBALab/lba2remake) | DOS | 290 | 2026-04-17 | 200 | — |
| 4 | [Doom (doom.wasm)](https://github.com/jacobenget/doom.wasm) | DOS | 11 | 2024-12-10 | 200 | — |
| 5 | [Need for Speed: Underground (NFS Underground in your browser (nfsu1web))](https://github.com/yurasmetanka/nfsu1web) | GameCube | 31 | 2026-11-07 | 200 | — |
| 6 | [Pokémon Emerald (pokeemerald-wasm)](https://github.com/tripplyons/pokeemerald-wasm) | GBA | 323 | 2026-09-20 | 200 | — |
| 7 | [Super Mario 64](https://recompiledgames.com/super-mario-64-recompiled) | N64 | — | — | 200 | — |
| 8 | [Super Mario 64 Multiplayer](https://olivers.tools/play) | N64 | — | — | 403 | — |
| 9 | [Battle City (Browser reimplementation)](https://github.com/vgrichina/battlecity) | NES | 14 | 2026-05-07 | 200 | AI |
| 10 | [Diablo (diabloweb)](https://github.com/d07RiV/diabloweb) | PC | 2,896 | 2022-05-17 | 200 | — |
| 11 | [Cricket 07 (Cricket 07 in the browser)](https://github.com/Dhaiwat10/cricket07-browser) | PC | 236 | 2026-11-08 | 200 | — |
| 12 | [Urban Terror (ut.pieter.com (ioUrbanTerror -> WebAssembly))](https://github.com/FrozenSand/ioq3-for-UrbanTerror-4) | PC | 152 | 2023-02-03 | 200 | — |
| 13 | [Half-Life (Xash3D-Emscripten)](https://github.com/btarg/Xash3D-Emscripten) | PC | 147 | 2019-10-23 | 200 | — |
| 14 | [Half-Life (hl (Xash3D FWGS Emscripten port))](https://github.com/Pixelsuft/hl) | PC | 121 | 2021-06-22 | 200 | — |
| 15 | [LEGO Island (isle.pizza (Emscripten build of isle-portable))](https://github.com/isledecomp/isle.pizza) | PC | 57 | 2026-11-08 | 200 | — |
| 16 | [OpenSGolf](https://github.com/crspytopgn/opensgolf) | PC | 53 | 2026-11-18 | 200 | AI |
| 17 | [Call of Duty: Black Ops Zombies](https://vel.gg/bsz) | PC | — | — | 200 | — |
| 18 | [Claude of Duty: Vibe Slops II (froydinger mirror)](https://froydinger.github.io/claude-of-duty) | PC | — | — | 200 | AI |
| 19 | [Claude of Duty: Vibe Slops II (GoofyAhhBro69420 mirror)](https://goofyahhbro69420.github.io/Black-Ops-2) | PC | — | — | 200 | AI |
| 20 | [Command & Conquer: Generals Zero Hour](https://generals.wasm.ltd) | PC | — | — | 200 | — |
| 21 | [Command & Conquer: Red Alert 2](https://chronodivide.com) | PC | — | — | 200 | — |
| 22 | [Counter-Strike 1.6](https://csjs.live) | PC | — | — | 200 | — |
| 23 | [Counter-Strike: Source Bunnyhop (bunnyhop.lol)](https://bunnyhop.lol) | PC | — | — | 200 | — |
| 24 | [Counter-Strike: Source Surf (Surfd)](http://surfd.net) | PC | — | — | 200 | — |
| 25 | [Diablo (diablo_web)](http://johnimril.github.io/diablo_web) | PC | — | — | 200 | — |
| 26 | [Doom Multiplayer (Silent Space Marine)](https://silentspacemarine.com) | PC | — | — | 200 | — |
| 27 | [Grand Theft Auto III](https://wasmarcade.com/gta3) | PC | — | — | 200 | — |
| 28 | [Grand Theft Auto V](https://web.archive.org/web/20261006055917/https://playgta5.com) | PC | — | — | 401 | — |
| 29 | [Grand Theft Auto: Vice City](https://joncodeofficial.github.io/gta-vice-city-wasm) | PC | — | — | 200 | — |
| 30 | [Half-Life (pixelsuft)](http://pixelsuft.github.io/hl) | PC | — | — | 200 | — |
| 31 | [Half-Life and Counter-Strike 1.6 (WebXash)](http://x8bitrain.github.io/webXash) | PC | — | — | 200 | — |
| 32 | [Kino der Toten (GoofyAhhBro69420 mirror)](https://goofyahhbro69420.github.io/COD-ZOMBIES) | PC | — | — | 200 | AI |
| 33 | [LEGO Island](https://isle.pizza) | PC | — | — | 200 | — |
| 34 | [Minecraft 1.8.8 (EaglercraftX)](https://wasmarcade.com/minecraft) | PC | — | — | 200 | — |
| 35 | [Moon (Black Ops Zombies, vel.gg)](https://vel.gg/bo1z/moon) | PC | — | — | 200 | — |
| 36 | [Nacht der Untoten](https://zombies.concentric.live) | PC | — | — | 200 | — |
| 37 | [Need for Speed: Most Wanted](https://nfsmwonline.com) | PC | — | — | 200 | — |
| 38 | [NetQuake.io](https://www.netquake.io) | PC | — | — | 200 | — |
| 39 | [Pro Evolution Soccer 6](http://pes6.optijuegos.net) | PC | — | — | 200 | — |
| 40 | [Quake II (q2.pieter.com)](http://q2.pieter.com) | PC | — | — | 200 | — |
| 41 | [Quake III Arena (q3.pieter.com)](https://q3.pieter.com) | PC | — | — | 200 | — |
| 42 | [Quake III Arena (q3js)](https://q3js.com) | PC | — | — | 200 | — |
| 43 | [QuakeWorld (q1.pieter.com)](http://q1.pieter.com) | PC | — | — | 200 | — |
| 44 | [Return to Castle Wolfenstein (rtcw.pieter.com)](http://rtcw.pieter.com) | PC | — | — | 200 | — |
| 45 | [Star Wars Jedi Knight: Jedi Academy](https://jk.q3js.com) | PC | — | — | 200 | — |
| 46 | [Super Mario Zombies](https://smz.fun) | PC | — | — | 200 | — |
| 47 | [The Simpsons: Hit & Run](http://shar-wasm.cjoseph.workers.dev/?skipmovie) | PC | — | — | 200 | — |
| 48 | [Urban Terror (ut.pieter.com)](http://ut.pieter.com) | PC | — | — | 200 | — |
| 49 | [Gran Turismo 2 (Gran Turismo 2 PC, VR & Browser)](https://github.com/dubrovskiy-yevhen-stakelogic/gt-2-pc) | PS1 | 196 | 2026-11-18 | 200 | AI |
| 50 | [Crash Bash Online](https://crashbash.app) | PS1 | — | — | 200 | — |
| 51 | [Formula One 06](https://f12006.online) | PS2 | — | — | 200 | — |
| 52 | [SSX 3](https://ssx3.online) | PS2 | — | — | 200 | — |
| 53 | [Tekken 5](https://tekken5.online) | PS2 | — | — | 200 | — |
| 54 | [Halo: Combat Evolved](https://mitchellhynes.com/halo/halo.html) | Xbox | — | — | 200 | — |
| 55 | [Halo: Combat Evolved Mobile (HCEMobile)](https://hcemobile.com) | Xbox | — | — | 200 | — |
| 56 | [Skate 3 (fan browser game)](http://skate.aaddpp.lol) | Xbox 360 | — | — | 200 | — |
| 57 | [The Simpsons: Hit & Run (Web Port)](https://github.com/Vheissu/hit-and-run-web) | — | 177 | 2026-09-10 | 200 | — |

### 2.7 Tools & launchers — 16 rows

*Recompilers, launchers and helpers around these projects.*

| # | Title (link = project URL) | Platform | Stars | Last activity | Link | AI |
|--:|---|---|--:|---|:--:|:--:|
| 1 | [3dsrecomp](https://github.com/fearkov/3dsrecomp) | 3DS | 95 | 2026-11-17 | 200 | — |
| 2 | [libsm64](https://github.com/libsm64/libsm64) | N64 | 971 | 2026-02-13 | 200 | — |
| 3 | [Godot Engine](https://github.com/godotengine/godot) | PC | 120,401 | 2026-11-18 | 200 | — |
| 4 | [Quiver Launcher](https://github.com/tgeorgiadis/quiver-launcher) | PC | 4,432 | 2026-11-19 | 200 | — |
| 5 | [Nyrna](https://github.com/Merrit/nyrna) | PC | 1,304 | 2026-05-26 | 200 | — |
| 6 | [Catapult](https://github.com/qrrk/Catapult) | PC | 518 | 2026-11-17 | 200 | AI |
| 7 | [SF4 Ember (Rollback Client)](https://github.com/Confetti3/SF4-Ember-Netplay) | PC | 211 | 2026-11-17 | 200 | AI |
| 8 | [Olympus - Cross-platform Celeste Mod Manager](https://github.com/EverestAPI/Olympus) | PC | 183 | 2026-11-14 | 200 | — |
| 9 | [9Launcher](https://github.com/wearrrrr/9Launcher) | PC | 160 | 2026-11-15 | 200 | — |
| 10 | [Ports Launcher](https://github.com/Nyaldee/Ports-Launcher) | PC | 97 | 2026-11-18 | 200 | — |
| 11 | [PlayStation 1 (DuckStation)](https://github.com/stenzek/duckstation) | PS1 | 11,023 | 2026-11-19 | 200 | — |
| 12 | [RecompOne](https://github.com/BlackLabelHQ/RecompOne) | PS1 | 631 | 2026-11-15 | 200 | — |
| 13 | [PS2Recomp](https://github.com/ran-j/PS2Recomp) | PS2 | 3,887 | 2026-10-23 | 200 | — |
| 14 | [rusty-psn](https://github.com/RainbowCookie32/rusty-psn) | PS3 | 943 | 2026-10-20 | 200 | AI |
| 15 | [xrevive](https://github.com/Teraflopping/xrevive) | Xbox | 617 | 2026-11-16 | 200 | — |
| 16 | [xboxrecomp](https://github.com/sp00nznet/xboxrecomp) | Xbox | 420 | 2026-11-06 | 200 | AI |

### 2.8 Mods & mashups — 17 rows

*Mods built on decompilations/recompilations (from the awesome-game-mashups source). `Host`/`Guest` record which game is modified and which game content is injected, per the curator.*

| # | Title (link = project URL) | Host | Guest | Mod group | Platform | Stars | Last activity | Link | AI |
|--:|---|---|---|---|--:|---|:--:|:--:|
| 1 | [SkyCraft](https://github.com/chasmlol/SkyCraft) | The Elder Scrolls V: Skyrim Special Edition | Minecraft: Java Edition | Other mods & mashups | PC | 1,282 | 2026-10-01 | 200 | — |
| 2 | [2010 Rust Rewrite Mashup](https://github.com/chasmlol/2010-rust-rewrite-mashup) | Call of Duty: Modern Warfare 2 via IW4L | Skate 3, Minecraft | Rust rewrites | PC | 952 | 2026-10-02 | 200 | — |
| 3 | [VM Computers](https://github.com/delta2force/MCVmComputers) | Minecraft: Java Edition (Fabric 1.15–1.16) | x86 operating systems and their games (e.g. DOS Doom) via VirtualBox | Other mods & mashups | PC | 528 | 2024-07-10 | 200† | — |
| 4 | [The Legend of Zelda: Majora's Mask 3D (DekUI)](https://github.com/tgacquin/mm3d-dekui) | Majora's Mask 3D (emulated) | DekUI | Emulator mods | 3DS | 279 | 2026-10-27 | 200 | AI |
| 5 | [Doom-in-Doom](https://github.com/kgsws/doom-in-doom) | DOOM II (DOS DOOM2.EXE v1.9) | DOOM (Chocolate Doom port), Heretic (also demonstrated) | Doom ports | PC | 226 | 2022-08-06 | 200 | — |
| 6 | [ER Mario](https://github.com/deltarooo/er-mario) | Elden Ring | Super Mario 64 | libsm64 / SM64 decomp | PC | 196 | 2026-10-31 | 200 | — |
| 7 | [Retro64](https://github.com/Retro64Mod/Retro64Mod) | Minecraft: Java Edition (Forge 1.20.1 and below; NeoForge 1.21.1+) | Super Mario 64 | libsm64 / SM64 decomp | PC | 170 | 2026-09-27 | 200 | — |
| 8 | [G64](https://github.com/ckosmic/g64) | Garry's Mod | Super Mario 64 | libsm64 / SM64 decomp | PC | 129 | 2023-03-07 | 200 | — |
| 9 | [sm64-san-andreas (Super Mario 64 in GTA San Andreas)](https://github.com/headshot2017/sm64-san-andreas) | Grand Theft Auto: San Andreas (PC v1.0) | Super Mario 64 | libsm64 / SM64 decomp | PC | 116 | 2025-05-05 | 200 | — |
| 10 | [hytale2mc](https://github.com/alskea/hytale2mc) | Synchronized Minecraft (Minestom) and Hytale servers | Minecraft: Java Edition 1.21.11, Hytale | Other mods & mashups | PC | 62 | 2026-02-03 | 200 | — |
| 11 | [SMC64 — Mario in Halo: CE](https://github.com/KodyJKing/smc64) | Halo: Combat Evolved (Steam MCC) | Super Mario 64 (Mario via libsm64) | libsm64 / SM64 decomp | PC | 55 | 2026-11-05 | 200 | — |
| 12 | [SkateGM](https://github.com/the-schwilliam/SkateGM) | Garry's Mod | Skate 3 | Rust rewrites | PC | 48 | 2026-10-21 | 200 | — |
| 13 | [CrossplayProject — Minecraft ↔ Roblox](https://github.com/Atmerek/CrossplayProject) | Linked Minecraft server and Roblox experience | Minecraft, Roblox | Other mods & mashups | PC | 36 | 2024-11-30 | 200† | — |
| 14 | [HyCraft](https://github.com/EdwardBelt/HyCraft) | Hytale server | Minecraft: Java Edition 1.21.11 | Other mods & mashups | PC | 34 | 2026-05-28 | 200 | — |
| 15 | [gzdoom-sm64 — Mario in Doom](https://github.com/headshot2017/gzdoom-sm64) | DOOM (GZDoom 3.2.0) | Super Mario 64 | libsm64 / SM64 decomp | PC | 30 | 2023-12-09 | 200 | — |
| 16 | [UltraDoom / UltrakillDoom](https://github.com/Squaresweets/UltrakillDoom) | ULTRAKILL | DOOM (1993) | Doom ports | PC | 28 | 2026-02-09 | 200 | — |
| 17 | [WWF No Mercy for Meta Quest 3](https://github.com/VistaLargaGames/WWF-No-Mercy-Quest-3-Standalone-) | Meta Quest 3 (VR) | WWF No Mercy N64 recomp | Other mods & mashups | N64 | 5 | 2026-10-17 | 200 | — |

---

## 3. Graphics / engine / software analysis (curated catalog + interoperability catalog)

This section analyzes **filtered subsets** of the two software-oriented evidence sources. Each filter is defined precisely; none of these subsets is "all reverse-engineered software." The full multi-source landscape (22,522 in-scope unique projects) is documented in `reverse_engineered_software_landscape.xlsx` / `reverse_engineered_software_landscape.md`.

### 3.1 Filters on the curated catalog (Tier 1, `.work/awesome_rea_catalog.json`, 5,191 resources)

Catalog-wide context: kinds are case-study 4,025, tool 910, integration 97, documentation 49, learning-resource 49, collection 33, project 15, research 13; largest tooling-related categories are native-analysis 251, game-analysis 150, dynamic-analysis 110, protocol-analysis 91, Android 89, firmware 89, binary-libraries 76.

| Filter | Definition | Rows | Kinds |
|---|---|--:|---|
| **F1** | `category == "game-analysis"` | **150** | 139 tool, 7 documentation, 3 project, 1 case-study |
| **F2** | `kind == "tool"` **and** `"game"` ∈ `targets` | **181** | tools only, by definition |
| **F3** | `kind == "tool"` **and** name/description contains `graphics|render|renderer|opengl|vulkan|directx|direct3d|engine` | **146** | tools only |
| **F4** | `kind == "tool"` **and** name/description contains `graphics|render|renderer|opengl|vulkan|directx|direct3d` (strict graphics, no generic "engine") | **37** | tools only |
| F2 ∩ F3 | game-targeting graphics/engine tools | 45 | — |
| F1-tools ∪ F2 ∪ F3 | union of the three tool filters | **282 unique tools** | — |

Representative F1/F4 entries (curated, source-reviewed): [RenderDoc](https://github.com/baldurk/renderdoc) (graphics frame debugger), [AssetRipper](https://github.com/AssetRipper/AssetRipper), [Cpp2IL](https://github.com/SamboyCoding/Cpp2IL), [Il2CppDumper](https://github.com/Perfare/Il2CppDumper), [UndertaleModTool](https://github.com/UnderminersTeam/UndertaleModTool), [frida-il2cpp-bridge](https://github.com/vfsfitvnm/frida-il2cpp-bridge), [objdiff](https://github.com/encounter/objdiff), [decomp-permuter](https://github.com/simonlindholm/decomp-permuter), [N64ModernRuntime](https://github.com/N64Recomp/N64ModernRuntime), [ReXGlue SDK](https://github.com/rexglue/rexglue-sdk), [xboxrecomp](https://github.com/sp00nznet/xboxrecomp), [ps3recomp](https://github.com/sp00nznet/ps3recomp), [PCSX-Redux](https://github.com/grumpycoders/pcsx-redux), [Decompiler Explorer](https://dogbolt.org), [Cheat Engine](https://github.com/cheat-engine/cheat-engine), [IDA Pro](https://hex-rays.com/ida-pro).

Keyword filters are noisy by construction: F3/F4 match "render" and "engine" in descriptions (e.g., [screenshot-to-code](https://github.com/abi/screenshot-to-code) matched on "render"-adjacent wording), so F4 rows must be read as *graphics-adjacent leads*, and the case-study-heavy residue (1,351 of 1,573 keyword hits are case studies, not tools) is excluded from tool counts by the `kind=="tool"` clause.

### 3.2 Filters on the interoperability catalog (Tier 3, `.work/interoperability.json`, 17,667 rows)

| Filter | Definition | Rows |
|---|---|--:|
| **I1** | `category == "Game Decompilations & Reimplementations"` | **6,071** |
| **I2** | `category == "RE Tooling"` | **1,170** |
| **I3** | description contains `graphics|render|renderer|opengl|vulkan|directx|direct3d` | **122** (59 in game category, 14 file-formats, 12 drivers/low-level, 10 devices/IoT, 8 desktop reimplementations, …) |

I1 subcategory breakdown (all 25 subcategories):

| Subcategory | Rows |
|---|--:|
| Static Recompilations & PC Ports | 1,285 |
| Engine Reimplementations | 845 |
| Matching Decompilations — PC / DOS / Windows | 413 |
| Asset & File-Format Tools | 401 |
| Matching Decompilations — Game Boy / GBA / DS | 377 |
| Matching Decompilations — Other / Multi-platform | 337 |
| Mod Loaders & Script Extenders | 292 |
| Open-source Game Clones | 291 |
| Private Servers | 225 |
| Console Emulators | 224 |
| Matching Decompilations — GameCube & Wii | 219 |
| Matching Decompilations — SNES / NES | 204 |
| Game Network Protocols & APIs | 149 |
| Matching Decompilations — Nintendo 64 | 139 |
| Matching Decompilations — PlayStation 1 | 138 |
| Matching Decompilations — PlayStation 2 | 114 |
| Matching Decompilations — Sega | 98 |
| Matching Decompilations — Mobile | 69 |
| Matching Decompilations — Arcade | 58 |
| Launchers & Store Clients | 48 |
| Other | 48 |
| Matching Decompilations — Xbox | 37 |
| Fan Patches & Enhancements | 23 |
| Matching Decompilations — Switch | 19 |
| Matching Decompilations — PSP / Vita / PS3 | 15 |
| Matching Decompilations — Atari | 3 |

I2 (RE Tooling) subcategories: Disassemblers & Decompilers 336, Mobile RE 185, AI-assisted RE 180, Binary & Format Analysis 174, Dynamic Instrumentation 118, Decompilation Project Tooling 88, Traffic Interception 63, Other 26.

Catalog-wide health labels for the interoperability source (its own enrichment, not recomputed here): active 10,036 (56.8%), dormant 3,509, slow 2,479, archived 1,189 (6.7%), unknown 454.

### 3.3 Reading the two sources together

- The curated catalog's game/tooling slice (F1–F4) is **human-reviewed but small** (≤282 unique tools under the broadest union filter); the interoperability catalog is **broad but community-curated** (6,071 game-category rows). They overlap: the correction summary counts 3,308 projects listed in both interop and the Tier-1 catalog, and 2,141 listed in both interop and games.
- Static recompilation is the single largest reconstruction craft in both games-oriented sources (1,009 of 3,030 games rows; 1,285 of 6,071 interop game rows), followed by matching decompilation (920 games rows; 1,462 interop "Matching Decompilations" rows across the 14 platform subcategories) and engine reimplementation (409 games rows; 845 interop rows).
- Graphics-specific tooling (F4 = 37 curated tools; I3 = 122 interop rows) is a thin, tools-heavy slice — frame debuggers, asset extractors, recompilers with graphics runtimes — not a large standalone ecosystem in either source.

---

## 4. REA ecosystem and fork analysis

### 4.1 Which repositories are the actual tool and the actual catalog?

Local evidence identifies two distinct repositories that are easy to confuse:

| Role | Repository | Evidence |
|---|---|---|
| **The REA tool** (CLI + MCP server, npm `rea-agents`) | [`morluto/rea`](https://github.com/morluto/rea) | Tier-1 catalog core entries (`rea-upstream`, `rea-official-skill`, 20+ guide/case-study rows all rooted in this repo); Tier-4 index row `scan-1209966933` with description "Reverse engineer anything with agents…" |
| **The Awesome-REA catalog** (curated list + awesomerea.org site + scan pipeline) | [`reacher-z/Awesome-REA`](https://github.com/reacher-z/Awesome-REA) | `awesome_rea_catalog.json` meta (`repository_url`), Tier-4 index meta (`capture_sources.repository`, workflow run [39323601991](https://github.com/reacher-z/Awesome-REA/actions/runs/39323601991)) |

The catalog's 5,191 curated resources include 20+ rows that are *documentation subpaths* of `morluto/rea` (blob/tree/anchor URLs) — under repository-root grouping these are one project, not 20 (see §4.4).

### 4.2 Official GitHub metadata (observed 2026-11-20, REST API)

| Field | `morluto/rea` | `reacher-z/Awesome-REA` |
|---|---|---|
| HTTP status | 200 | 200 |
| Stars | **470,359** (was 271,152 at 2026-10-16 index capture) | **3,222** (was 3 at 2026-10-16 index capture, the day it was created) |
| Forks (reported count) | **114,893** | **537** |
| Open issues | 1,347 | 1,862 |
| Created | 2026-04-14 | 2026-10-16 |
| Last push | 2026-11-20T05:37:26Z | 2026-11-20T05:53:58Z |
| License (API) | MIT | MIT |
| Primary language | TypeScript | Python |
| Archived / fork-of | false / false | false / false |

The two-order-of-magnitude star changes between the 2026-10-16 Tier-4 capture and the 2026-11-20 API observation are recorded as point-in-time drift; neither number is evidence of quality.

### 4.3 Fork-endpoint results, including preserved failures

**`GET /repos/morluto/rea/forks` — intermittent HTTP 500, no complete census.**

Observed call log (all 2026-11-20, unauthenticated, `Accept: application/vnd.github+json`):

| Call | Result |
|---|---|
| `?per_page=100&sort=newest&page=1` | **HTTP 500, empty body** |
| `?per_page=30&sort=oldest&page=1` | **HTTP 500** |
| `?per_page=1` | HTTP 200 |
| `?per_page=5`, `10`, `20` | **HTTP 500** each |
| `?per_page=30`, `50`, `100` (retry) | HTTP 200 each |
| `?sort=stargazers&per_page=100` | HTTP 200 |

The endpoint fails intermittently with an empty 500 body at varying page sizes and succeeds on retry — behavior consistent with an oversized fork network (114,893 forks). A complete census would need ~1,149 pages against a flaky endpoint within a 60 req/h unauthenticated rate budget (26 requests remained mid-session) and **was not attempted**. What the two successful 100-row samples show, without any completeness claim:

- **Newest-100 sample:** all 100 forks were created on 2026-11-20 with 0 stars and no post-creation pushes — the tail of the network is dominated by same-day drive-by forks.
- **Stargazers-sorted top-100 sample:** all 100 have ≥1 star. Most-starred fork: [`shijianzhong/rea`](https://github.com/shijianzhong/rea) (684 stars, 128 forks, created 2026-10-07). **30 of the top 100 forks are renamed** — e.g. [`sgunin/ReverseEngineerAnything`](https://github.com/sgunin/ReverseEngineerAnything) (56★), [`heaven-hm/re-agent`](https://github.com/heaven-hm/re-agent) (19★, self-described "Reverse Engineering Agent"), [`teonett/Reverse-Engineer-Anything`](https://github.com/teonett/Reverse-Engineer-Anything) (16★), [`VSchicksal/rae`](https://github.com/VSchicksal/rae) (10★), [`ChristopheAI/reverseengineeranything`](https://github.com/ChristopheAI/reverseengineeranything) (7★).

**`GET /repos/reacher-z/Awesome-REA/forks` — complete enumeration of a small network.**

Six pages × `per_page=100`, all HTTP 200: **539 fork objects retrieved** against a reported `forks_count` of 537 (the metadata count and the enumeration were minutes apart; the 2-object drift is consistent with forks created between calls or count-caching lag — both numbers are reported, not reconciled). Findings:

- 8 forks carry ≥1 star (max 2: [`Awesome-REA/Awesome-REA`](https://github.com/Awesome-REA/Awesome-REA), [`AI4AIResearch/Awesome-REA`](https://github.com/AI4AIResearch/Awesome-REA)); the rest have 0.
- **135 of 539 forks are renamed**, across 36 distinct names. A systematic themed-renaming pattern is visible: Awesome-REA-Games ×10, -Mobile ×10, -Web ×10, -Firmware ×10, -Binary ×10, -Symbol-Recovery ×7, -Differential-Testing ×7, -Disassembly ×7, -Emulation ×7, -Inspection ×7, -Decompilation ×7, -Apps ×7, -Protocols ×7, -Dynamic-Analysis ×6, -Static-Analysis ×3 — renamed forks are the norm in this network, not the exception.
- 23 forks show a `pushed_at` date later than their `created_at` date (a coarse divergence proxy only — pushes can be upstream syncs).
- 1 fork is archived ([`AxiomGroupHQ/Awesome-REA`](https://github.com/AxiomGroupHQ/Awesome-REA)); all 539 carry MIT license metadata (inherited).
- Fork creation by month: 2026-10: 220, 2026-11: 319 (repo created 2026-10-16 — the entire network is five weeks old).

### 4.4 Identity limitations: forks, renames, root-subpaths, and the Battle City case

1. **Forks are distinct rows.** The landscape dedup groups by repository-root URL, so a fork with its own `owner/repo` is a *separate listing*; GitHub fork networks were not resolved. With 114,893 forks of `morluto/rea` (mostly drive-by) and 539 of `reacher-z/Awesome-REA`, occurrence counts measure catalog listings, not independent engineering efforts.
2. **Renames and transfers.** Renamed forks (30% of the top-100 REA sample; 25% of the Awesome-REA network) keep their fork-network identity on GitHub but can appear under two names in catalogs captured at different times; transferred repositories can survive under two group URLs. Name-based matching would both miss these links and falsely merge same-name forks (372 Awesome-REA forks keep the exact name "Awesome-REA").
3. **Root vs subpath.** Conversely, distinct *content* can live under one repository root: the Tier-1 catalog carries 20+ subpath rows of `morluto/rea` (docs, guides, the Dinosaur/Calculator case studies sharing one blob URL with different anchors), all of which collapse to one project under root grouping.
4. **The Battle City case (concrete example of both directions at once).**
   - The games catalog contains **14 rows** (Battle City, Pac-Man, Mappy, ExciteBike, Ice Climber, SonSon, Solstice, Nuts & Milk, Double Dragon II, Kunio-kun no Nekketsu Soccer League, Danny Sullivan's Indy Heat, and siblings) that are all `tree/main/<Game>` subpaths of one repository, [`cyneprepou4uk/NES-Games-Disassembly`](https://github.com/cyneprepou4uk/NES-Games-Disassembly); every row inherits the repo's 311 stars, and the record key `cyneprepou4uk-nes-games-disassembly` repeats 14× (kept as 14 distinct occurrences — they *are* 14 different game disassemblies — while the landscape's unique-project layer merges them with the interop root row into **one project with 15 occurrences**).
   - Official metadata for that repository (200 OK, 2026-11-20): 310 stars, 48 forks, created 2021-01-25, pushed 2026-11-02, **no license declared** — a rights-relevant fact for any reuse of these disassembly listings.
   - Meanwhile the interoperability catalog also lists a *different* "Battle City" row pointing at [`vgrichina/battlecity`](https://github.com/vgrichina/battlecity) (14 stars, JavaScript) while describing it as "Disassembly of Battle City (NES, 1985)" and filing it under "Matching Decompilations — SNES / NES" — a description/URL/category mismatch (the games catalog correctly types the same repo as a browser-port reimplementation). A third distinct project, [`newagebegins/BattleCity`](https://github.com/newagebegins/BattleCity) (172 stars), is an open-source remake.
   - Net: one game title maps to ≥3 independent projects plus a 14-row subpath cluster sharing one star count. Any title- or star-based identity reasoning across catalogs would silently conflate them.

### 4.5 What this fork analysis does *not* establish

No complete fork census of `morluto/rea` exists in this report (endpoint 500s + rate budget made it infeasible; only two 100-row samples were taken). Fork counts and stars are not read as quality, demand, or endorsement signals. Fork-network parentage beyond the two named repositories was not resolved; HTML fork pages were not scraped; no claims are made from partial HTML or star counts alone.

---

## 5. Proposed role: dedicated Game Reconstruction Agent

A specialized agent role for game decompilation / static-recompilation / engine-reimplementation work, designed around the failure modes visible in this catalog (rights ambiguity, provenance drift, identity conflation, unverified builds). All gates marked **HUMAN** require a named human decision recorded before the agent proceeds.

### 5.1 Mandate and authorization (gate: **HUMAN-1, authorization**)

- Operates only under a written authorization record: target title, rights holder, jurisdiction assumptions, project license posture, and which reverse-engineering exceptions the work relies on. The agent must refuse work on targets without an authorization record and must never strip DRM/anti-cheat, bypass online-service protections, or fetch copyrighted assets.
- Maintains a per-project *rights ledger*: engine code (clean-room/matching-decomp status), assets (never redistributed), trademarks (naming/disclaimer rules).

### 5.2 Provenance and evidence discipline

- Every claim in project documentation carries a tier label equivalent to §1.2 (source-reviewed / link-checked / community / automated-lead / sampled) and a `verified_at` date with the field's semantics recorded (review date ≠ activity date).
- Repository identity is pinned by canonical clone URL + first-seen commit SHA, with fork/renamed/transferred aliases tracked explicitly (the §4.4 lesson: name- and star-based identity is unreliable; subpaths of one root may be many projects).

### 5.3 Clean-room, static-first method

- **Static analysis first**: disassembly/decompilation (Ghidra/IDA-class tooling, objdiff, decomp-permuter) and documentation of findings before any dynamic instrumentation; dynamic analysis (frida-class, debugging) only within the authorized environment.
- **Clean-room separation** where required: a spec-writing track that never sees decompiled code and an implementation track that works only from specs; the agent enforces separation mechanically (separate workspaces, no cross-copying).
- **Matching-decompilation discipline** where that route is chosen: byte- or function-matching verification against a user-supplied, hash-verified original binary; the agent never possesses or distributes the original.

### 5.4 Assets and ROM rights (gate: **HUMAN-2, assets**)

- Bring-your-own-ROM/assets pattern only (the model used by leading ports such as [Ship of Harkinian](https://github.com/HarbourMasters/Shipwright)): the build verifies user-supplied asset hashes; the agent never downloads, embeds, or redistributes game assets, ROMs, BIOS files, or trademarked branding.
- Asset-extraction tooling is documented with format provenance; extracted-content handling requires the HUMAN-2 gate.

### 5.5 Build verification

- Reproducible build pipeline: pinned toolchain with recorded hashes, CI rebuild from clean checkout, deterministic-output checks where the platform allows.
- Verification ladder reported per build: compiles → boots → matching % (functions/bytes, decomp.dev-style progress) → playtested. Stars, forks, and curator scores are **never** accepted as build-quality evidence.

### 5.6 Human gates summary

| Gate | Trigger | Human decides |
|---|---|---|
| HUMAN-1 | New target / scope change | Authorization, rights posture |
| HUMAN-2 | Any asset/ROM handling | Legality of extraction/distribution path |
| HUMAN-3 | Public release or binary distribution | Release approval, naming/trademark review |
| HUMAN-4 | Forking or republishing another reconstruction project | License compliance (incl. NOASSERTION/no-license cases like §4.4) |

### 5.7 Skill requirements

Authorization & IP literacy; provenance/evidence tiering; assembly and decompiler fluency per target ISA (MIPS/ARM/PPC/x86/6502-class); static-recompilation toolchains (N64Recomp/XenonRecomp/ReXGlue-class); engine-reimplementation architecture; graphics-pipeline analysis (RenderDoc-class frame debugging); build systems and reproducible builds; binary diffing and matching verification; ROM/asset format extraction with rights handling; defensive documentation (evidence-linked claims only).

---

## 6. Limitations and non-claims

1. **Point-in-time data.** Games metadata is from 2026-11-19; catalog review dates from 2026-10/2026-11; live API observations from 2026-11-20. Counts drift (documented for both REA repositories).
2. **Link status ≠ accessibility.** All 3,030 games rows carry `link_ok=True` upstream, yet the link check recorded 401 (`grand-theft-auto-v`) and 403 (`super-mario-64-multiplayer`).
3. **AI flag and curator scores** are internal curator-defined metrics of the games catalog; they are not independent audits.
4. **No quality inference from stars/forks** anywhere in this report; the Tier-5 topic sample is explicitly popularity-biased and cannot estimate topic composition.
5. **Fork analysis is bounded.** `morluto/rea`'s fork network is characterized only from reported counts plus two 100-row samples because the official `/forks` endpoint returned intermittent empty-body HTTP 500s under an unauthenticated 60 req/h budget; `reacher-z/Awesome-REA`'s network is fully enumerated (539 objects) but small and five weeks old. No fork-parentage resolution was performed for the 22,522-project landscape.
6. **License fields are provenance-labeled, not legal facts**: blank means "not collected" (Tier 1) or "not reported" (elsewhere); NOASSERTION in the topic snapshot means missing-or-unrecognized; none prove absence of a license.
7. **Nothing here is legal clearance.** Reconstruction, porting, asset extraction, and redistribution rights vary by jurisdiction, title, and method; §5's human gates exist precisely because this catalog cannot make those determinations.
8. **Tier-4 repository-index rows** (3,500 automated README-scan leads, 191 upstream-excluded) were used only for ecosystem context, not for any per-project claim in this report.

---

*Report ends. Evidence: `.work/games.json` (SHA-256 `8d103f9a…603ae0` per correction summary), `.work/awesome_rea_catalog.json`, `.work/awesome_rea_repository_index.json`, `.work/interoperability.json`, `.work/rea_topic_snapshot.json`, `.work/reverse_correction_summary.json`, `reverse_engineered_software_landscape.xlsx`; live calls: GitHub REST metadata + `/forks` for `morluto/rea`, `reacher-z/Awesome-REA`, `cyneprepou4uk/NES-Games-Disassembly` (2026-11-20, statuses preserved in §4).*

