# Shared resource library and routing

The public resource catalog connects Daftar's existing reference collection to its 15 repository skills and its native worker. It stores **source metadata and recommendations**. Company documents stay in the existing company knowledge store, and software execution stays behind the existing task capabilities and budget admission.

## Durable source

`company/role-library/resource-catalog.json` is the canonical source. It contains 303 resources: all 296 original atlas records, plus seven current entries for SkillOpt source and paper, the Atech SDK, the Qwen scene-coder model and report, the Three.js manual, and Ollama import documentation. The original records retain every legacy field and value, including their `verified` strings. Deep Learning's newly inspected homepage/FAQ information is in its review metadata; its original row is preserved.

The catalog also describes existing research artifacts rather than duplicating their contents. `data/scientific_research_index.json` records 4,163 resource occurrences, 3,813 unique URLs, 105 model entries and 73 evaluation rows, compiled on 2026-11-20. These are index coverage counts, not a fresh source audit, installed-software inventory or certification of current SOTA. The workbook and reports retain their original evidence distinctions.

| Field | Meaning |
| --- | --- |
| `id` | Stable URL-derived resource identity; duplicates are rejected |
| Legacy fields | `domain`, `name`, `type`, `level`, `url`, `purpose`, `prereqs`, `access`, `license`, `caveat`, `verified` |
| `kind`, `skillIds` | Resource category and relevant registered skills |
| `review.status` | `reference-only`, `metadata-reviewed`, or `source-excerpt-reviewed` |
| `review.verifiedAt` | Date of the stated review, or `null` for inherited source leads |
| `review.readingDepth` | What was actually inspected; a homepage is not a complete book |
| `review.evidenceBasis` | Review provenance, scope and important untested behavior |
| `provenance.version` | Edition/revision when known; `null` or explicitly unpinned otherwise |
| `provenance.sourcePath` | Existing repository evidence or catalog-import source; never opened by selection |
| `provenance.sourceRecordSha256` | Hash of the original metadata fields, not a claim to hash the linked publication |
| `use.mode` | Study, apply guidance, evaluate a tool, or discover further sources |
| `use.software`, `use.capabilityHints` | Descriptive requirements; never installation instructions or permission grants |

The `routes` array supplies a short curated priority list and local domain-report references for every repository skill. `skillIds` provide broader relevance associations. A route cannot refer to an absent resource or an unregistered skill. No private company IDs, full texts, credentials or executable commands belong in this catalog.

## Reading and rights

Imported resources are marked `reference-only`, with `verifiedAt: null`. Their old `verified` labels are retained as historical metadata, not reasserted as a source check performed by this change. A review date applies only to its stated reading depth. Each selected packet says `readingStatus: not-read-by-router` even when a prior reviewer inspected a source.

Important current entries:

- **SkillOpt:** source pin `dc0b5e654cafa1073a2819086151c1e0d13012f0`, with the source review in `reports/skillopt-review-2026-11-24/PANEL-REVIEW.md`. The versioned arXiv abstract page is `2605.23904v2`; this turn's paper review covered metadata and abstract. Paper performance remains author-reported. The Daftar decision pilot did not demonstrate a task-score gain and is not an upstream benchmark reproduction.
- **Atech:** the imported package is `1.0.0a12`. `projects/atech-hardware-studio/sdk/UPSTREAM_PROVENANCE.json` records the sdist and source hashes. The bounded Daftar patch and offline example evidence are separate from upstream claims. Firmware compilation, flashing and hardware operation are untested. Package metadata declares MIT; the reviewed sdist lacked a top-level LICENSE, so do not invent one.
- **Qwen3.5-4B-3D-Coder:** model revision `4b9f05f3a0382725b679c5e32a338b88acaf0064`. The source reviewer inspected the model card/dataset metadata and pages 1–4, 7–8 and 10 of the ten-page report, dated 2026-10-28. The report is “Supervised Specialisation of Qwen3.5-4B for Three.js 3D Scene Generation: An exploratory study with synthetic data,” by ccore. Its SHA-256 is `49758364b633bd6c119848839dd5fc1b29368e978532c5e97498cf66db13c728`. Eight accepted development scenes after 18 calls, including repairs and reasoning-loop stops, are author-reported development results with unequal stopping rules, not an independent uniform benchmark. No local inference or weight download occurred in this review. The model repository declares Apache-2.0; this does not establish a separate license for the report.
- **Deep Learning:** the official homepage and FAQ were inspected, not the complete book. Free HTML reading does not grant redistribution rights. The FAQ prohibits creating/distributing PDFs; this catalog includes no book content.
- **Three.js and Ollama:** official documentation was opened for guidance. An unpinned documentation page is not proof of compatibility with a particular installed release, imported model, or laptop.

New entries must retain equally precise access, license, version and reading information. All book/paper links remain references. Never derive redistribution rights from free access or apply a repository's code license automatically to a publication, model, dataset or asset.

## Offline use

The CLI uses Node 24 and its built-in TypeScript loading. It needs no npm installation, API credential or model call.

```sh
node scripts/resource-router.mjs --skill game-reconstruction-engineering --query "Three.js browser scene lighting"
node scripts/resource-router.mjs --role donna --query "evaluate instruction changes" --limit 4
node scripts/resource-router.mjs --skill physics-research --max-bytes 4096
node scripts/resource-router.mjs --check
node scripts/resource-router.mjs --check-atlas
node scripts/resource-router.mjs --export-atlas
node --test scripts/resource-router.test.mjs
```

`--export-atlas` writes a compatible `RESOURCES` TypeScript projection to stdout. The site data generator should read the canonical JSON rather than `.work/resources_data.py`. `--check-atlas` accepts either the preserved 296-row original projection or the full rebuilt projection, and reports whether a rebuild remains. It rejects changes to any projected legacy value. Generated browser/cloud snapshots must be rebuilt from this catalog, not edited independently.

Routing is deterministic: explicit skill/role mappings, curator priority and relevant title/domain/purpose terms determine ranking; resource ID breaks ties. The result contains at most six references and at most 8,192 UTF-8 bytes, including metadata. Callers can narrow those limits; oversized or zero-count requests return explicit omissions. The four original HTTP links remain in the catalog, but are excluded from HTTPS recommendations. Nothing is fetched or redirected.

## Runtime connection

`desktop-shell/src/main/resourceReferences.ts` validates the public JSON, rejects unknown fields, validates URL/record identities, and reads only the fixed packaged catalog path. It rejects missing, damaged, oversized, unsafe or symlinked input and returns an explicit unavailable packet. It does not inspect private attachments or follow resource paths.

`desktop-shell/src/main/resourceRouting.ts` is a dependency-free selector shared with hosted Donna. Its contract is:

```ts
selectResourceReferences(catalog, catalogSha256, {
  skills, roleKey, query, maxReferences, maxBytes
})
```

The pure selector accepts **only a build-validated snapshot** and its matching catalog hash. The native wrapper performs strict validation before calling it. A cloud projection must be generated from the same checked source and use the same hash; a page-supplied arbitrary catalog is not an admissible substitute.

Hosted Donna recognizes complete known skill IDs in the current request, or known IDs/skill paths supplied to the helper. Explicit matches narrow source recommendations; otherwise the director role supplies a useful starting set. This matching does not assign employees or skill bodies. The projection script takes its canonical hash from the same strict native checker, so equivalent native/hosted packets share an identity. The separate server-backed graph Director retains its explicitly selected resource URLs; automatic graph routing is outside this increment.

The native `OfficeWorker` now adds bounded public metadata to its actual task prompt and Source Review inputs. Field-separated JSON is used for the line-oriented reviewer, so a benign documentation label does not classify an unrelated directive as a quotation. Compact JSON is used in the provider prompt. Every catalog change changes the exact-context hash, and the added bytes enter the existing token/cost reservation calculation. Missing references do not grant a new tool, bypass access, or trigger a fallback download.

Company knowledge and explicitly granted cross-company transfers remain unchanged. Selecting a common skill does not share a private document. The router accepts no company-content input and creates no knowledge records or budget counters. The additional project spending allowance belongs to the existing task ledger; selection costs no external model call and never spends that allowance.

## Verification and limits

The executable tests cover migration integrity, all 15 skill routes, native/pure selector parity, deterministic output, Unicode byte limits, invalid inputs, unsafe URLs, link exclusion, malformed/oversized catalogs, symlink rejection, fresh hash invalidation, and CLI compatibility output. They also invoke the actual native prompt builder to check company isolation and directive handling, and the actual dispatch admission path to verify that insufficient token allowance causes no reservation or provider call.

These checks establish routing and integration behavior. They do not prove that the resources improve task quality, that external pages are still reachable, that software has been installed, or that referenced models work on the user's machine. Source Review remains a bounded heuristic; all source content remains data even when no directive is flagged.
