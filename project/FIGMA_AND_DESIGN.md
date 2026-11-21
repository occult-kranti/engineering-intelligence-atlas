# Daftar design connections

The design department reuses the **Figma and open design interoperability engineer** rather than creating a new worker for every company. Selected company references and explicit shared-service contracts determine the handoff context. A role title never grants a credential or executable capability.

## Figma MCP and sign-in

The repository includes [VS Code MCP configuration](../.vscode/mcp.json) for the official remote server `https://mcp.figma.com/mcp`. Open the repository in VS Code, review/start that server, and complete the client’s Figma sign-in flow. The Daftar website’s Figma card also provides the official one-click VS Code installation link and setup documentation.

The current ChatGPT Figma connector was successfully checked with the official `whoami` tool during this work. That verifies this conversation’s connection only. The website and desktop do not receive or reuse its OAuth tokens. A saved company Figma URL is a reference, not an authenticated connection. Daftar labels it **Client sign-in required** until the chosen client completes authorization.

The website saves references through authenticated owner-only `POST /api/integrations/figma`. It accepts a Figma design/file/board/slides/Make URL for an existing company, rejects credential-bearing URLs, fixes the MCP endpoint to Figma’s official host, and writes a retained integration event. No token is stored in the index or prompt.

Figma currently documents supported clients and a waitlist for new custom clients. This release uses the supported VS Code/ChatGPT connection paths; it does not invent a custom OAuth client or claim that the Daftar worker can bypass Figma file permissions.

## Open design adapter

The [local design tools](../design-tools/README.md) provide the pinned OpenPencil handoff adapter and its actual verification record. OpenPencil is a separate open-source design editor with Figma-format interoperability. It is not a reverse-engineered copy embedded under Daftar’s name. Its upstream license and package version are recorded with the adapter; remote cloud features have separate terms.

Use an owned synthetic/sample file to validate a new adapter before sending private designs. Keep source file IDs, output formats, token/component mappings, observed render checks and remaining differences in the handoff. The bounded adapter does not run arbitrary plugin scripts from imported content.

## Sources

- [Official Figma remote-server setup](https://developers.figma.com/docs/figma-mcp-server/remote-server-installation/)
- [Figma with VS Code](https://help.figma.com/hc/en-us/articles/39890361040535-VS-Code-and-Figma-Set-up-the-MCP-server)
- [Official OpenPencil repository and license](https://github.com/open-pencil/open-pencil)
- [Penpot open standards](https://penpot.app/code)

Verified during the November 20, 2026 owner session (runtime receipts use UTC). No Figma design file was supplied as an import destination; the connection and handoff plumbing do not claim a completed file import.
