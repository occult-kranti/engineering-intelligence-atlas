# Donna Brain · public research memory

This is Donna Brain's public research partition for the source-linked physics,
mathematics and memory graph. Private company memory stays in Daftar's native
workspace. This interface combines a bounded visual map, a keyboard-readable record
list, detailed formula cards and a source catalogue. It performs no model calls,
does not fetch papers automatically and does not change company authority.

## Build contract

`scripts/build-research-memory.mjs` copies this directory to
`site-source/public/research-memory/`, then supplies `atlas.json`, the shared
`graph-core.mjs`, documents and field exports. The static build publishes the same
surface under `docs/research-memory/`. Serve the built directory through HTTP;
opening an isolated HTML file cannot supply the required dataset/module URLs.

Expected data: `{schemaVersion:1, revision, nodes, edges, sources, formulas, meta}`.
The shared validator runs before rendering. The explorer rejects nonpublic node
or edge scopes. Source text is inserted with DOM text nodes, never interpolated
HTML. Linked source URLs must use HTTPS without credentials.

## Interaction

- Search filters labels, summaries and study paths. **Follow linked evidence**
  invokes the actual shared lexical/PageRank retrieval with at most 12 results
  and its byte budget; the interface names omitted candidates and ranking limits.
- Domain and record-type controls expose the seven study fields. Catalogue-only
  manuscripts are excluded initially and carry a distinct status when included.
  Neither a catalogue record nor a curated summary is labeled a verified proof.
- The map displays 40, 80 or 160 records per page and at most 480 links. Counts and
  caps remain visible. Its finite spacing algorithm is an illustration: positions
  do not measure forces, similarity, importance, memory capacity or claim truth.
- Select a node for its full record, source reading depth, caveats and directed
  relationships. **Explore this neighborhood** performs bounded, visited-set,
  two-hop traversal. A truncated neighborhood is disclosed.
- Drag to pan; use wheel, plus/minus, arrow keys or the explicit controls. **Fit**
  restores the bounded drawing. The List view offers ordinary keyboard buttons.
- Formula cards retain variables, assumptions, derivation, worked example and
  limits. Build-supplied MathML is parsed with a restrictive element/attribute
  allowlist. Unsupported markup falls back to the original selectable LaTeX.
  No CDN, external font, remote math renderer or image service is required.
- The built study guide, formula notebook and AI results audit are linked
  directly. The native JSON brain snapshot retains the full public dataset;
  typed field GraphML exports preserve graph interchange. These exports contain
  public research only. Original source links leave the atlas.

The data fetch has a 20-second deadline and a streaming 16 MiB bound. An invalid,
private or unavailable dataset produces a visible error and retry control. The
loaded graph can be explored without network access. That is separate from a
claim that the browser has installed or persistently cached the whole application.

## Review and acceptance

The design follows the existing Daftar Night office identity: green surfaces,
brass headings, serif study titles, clear source text and explicit evidence states.
Motion is unnecessary for the graph; reduced-motion settings suppress incidental
effects. Broad reading views collapse to one column on narrow screens.

`node scripts/smoke-research-memory.mjs` tests the built site with real Playwright
Chromium, using the GitHub Pages subpath. `RESEARCH_MEMORY_SOURCE` can point to a
different complete build; `RESEARCH_MEMORY_CHROMIUM_EXECUTABLE` can name an actual
available browser. A missing/refused browser fails visibly and never becomes a
mock browser pass. The gate checks actual graph selection, limits, catalogue
labels, search, keyboard controls, formulas, exports, literal-source handling,
MathML rejection, network independence after load and recovery states.

The separate four-case `tests/review-regressions.test.mjs` records the independent
Round 2 runtime review. It checks parseable cache corruption, a UTF-8 packet
boundary, optional field types and maximum-length namespaced source IDs. These
checks do not claim that local cache hashes authenticate a malicious host.
