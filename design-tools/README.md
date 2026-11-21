# Daftar design handoffs

This local adapter gives the design department four concrete OpenPencil operations: inspect a design, import static HTML into `.fig`, convert a supported design into a fresh `.fig`, and export SVG. It uses the real **`@open-pencil/cli` 0.16.0**, pinned with the complete npm lockfile. It does not call a model, connect to a live editor, or inherit a Figma account session.

The companion website saves each company's Figma file reference. Figma authorization is completed separately in VS Code or another supported MCP client. The official remote endpoint is `https://mcp.figma.com/mcp`; setup and available capabilities are documented by [Figma](https://developers.figma.com/docs/figma-mcp-server/remote-server-installation/).

## Install and verify

Use Node 22.13 or newer:

```sh
cd design-tools
npm ci --ignore-scripts
npm run check
npm test
npm run smoke
```

The smoke test imports the synthetic [office handoff fixture](fixtures/office-handoff.html), invokes the installed CLI to inspect the result, converts it to a second `.fig`, and exports that converted file as SVG. It verifies one page, twelve nodes, the expected frame and text counts, the SVG dimensions, and the fixture's labels. Every subprocess must report zero network attempts. No provider credential or model call is involved.

Results are written to `.work/openpencil-smoke.json` and `.work/design-handoffs/`. The latter contains the resulting files and an append-only `ledger.jsonl` with input/output hashes, the tool version, operation, byte counts, and timestamps. A failed conversion preserves its input. Existing handoff files are never overwritten.

## Fixed operations

Run these from the directory selected as the employee's workspace. Input paths are relative to that workspace. Outputs go into its `.work/design-handoffs/` directory.

| Operation | Accepted input | Result |
| --- | --- | --- |
| `inspect` | `.fig` or `.pen` | JSON document summary |
| `import-html` | `.html` or `.htm` | New `.fig` document |
| `convert-fig` | `.fig` or `.pen` | New `.fig` document |
| `export-svg` | `.fig` or `.pen` | SVG handoff |

Example, from this package directory:

```sh
node scripts/daftar-design.mjs import-html fixtures/office-handoff.html example.fig
node scripts/daftar-design.mjs inspect .work/design-handoffs/example.fig example-info.json
node scripts/daftar-design.mjs convert-fig .work/design-handoffs/example.fig example-roundtrip.fig
node scripts/daftar-design.mjs export-svg .work/design-handoffs/example-roundtrip.fig example.svg
```

Choose new output filenames when running the example again. To call the adapter from a tool integration, import `runDesignOperation` and pass `{workspace, operation, input, output}`. The caller assigns the workspace according to the employee's company and task. `operation` accepts only the four values above; arbitrary CLI arguments, JavaScript evaluation, plugins, generic tool calls, and live-editor RPC are not exposed.

## Resource and access boundaries

- Inputs must be ordinary local files inside the selected workspace, at most 20 MiB. Symlink and hard-link inputs are rejected.
- The adapter copies input bytes into a temporary operation directory. It never passes a caller-selected live document to the upstream CLI and never writes into the input file.
- HTML imports accept static markup and inline CSS. Scripts, event handlers, external resource references, and CSS imports are rejected before the CLI starts.
- Each process uses fixed arguments without a shell. Provider credentials and injected Node options are omitted from its environment. The process receives an isolated configuration/cache directory and a network guard before the CLI loads.
- Operations have a 45-second parsing limit, a 4 MiB log limit, and a 40 MiB result limit. These are local tool limits, separate from Daftar's model spending limits.
- The network guard covers the Node fetch, HTTP, WebSocket, TCP and UDP entry points used by this path. This is a bounded adapter, not an operating-system security sandbox. The installed upstream program still runs as the local user; do not expose the raw CLI as an unrestricted employee tool.

## Reference handoff and limits

The committed [example `.fig`](examples/office-handoff.fig), [SVG](examples/office-handoff.svg), [inspection](examples/office-handoff-inspection.json), and [receipt](examples/receipt.json) were produced by the actual pinned CLI. They contain only the synthetic fixture and can be used as reference material for a design employee.

The verified path is an OpenPencil `.fig` round trip. Importing that file into the Figma application, matching every browser CSS property, and preserving every Figma feature are separate acceptance checks. The sample's inspected font is Inter. SVG text rendering on another machine depends on font availability. This release does not install the OpenPencil desktop application or deploy OpenPencil Cloud.

## Source and license provenance

OpenPencil's CLI package declares **MIT**. Its exact distributed license is retained in [licenses/openpencil-cli-0.16.0.txt](licenses/openpencil-cli-0.16.0.txt), with its SHA-256, npm integrity value and source links in [licenses/provenance.json](licenses/provenance.json). The repository distinguishes OpenPencil Cloud under Apache-2.0; this adapter runs the npm CLI locally. Dependency versions and integrity values are retained in `package-lock.json`.

Primary references:

- [OpenPencil repository](https://github.com/open-pencil/open-pencil)
- [Official CLI reference](https://openpencil.dev/reference/cli)
- [Inspecting design files](https://openpencil.dev/developers/cli/inspecting)
- [Figma remote MCP setup](https://developers.figma.com/docs/figma-mcp-server/remote-server-installation/)
- [Microsoft's MCP installation URL format](https://code.visualstudio.com/api/extension-guides/ai/mcp)
