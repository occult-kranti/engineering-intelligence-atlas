# Selected-source extension example

This is an ordinary Manifest V3 extension. The user selects a short passage, opens
the extension, chooses **Capture selection**, reviews the record and chooses
**Export reviewed JSON**. It has no server, account integration, background
crawler, persistent storage or remote transmission. It does not read cookies,
browser history, password stores, form values or hidden application sessions.

For local development, load this directory as an unpacked extension in a browser
that supports Chrome's Manifest V3 APIs. This repository does not install it for
you or claim Chrome Web Store review. Select ordinary text on an HTTP(S) page;
browser-internal/restricted pages remain unavailable. User-selected private text
can still be sensitive: the export is marked private until reviewed.

`activeTab` supplies temporary access after the user invokes the extension;
`scripting` executes the small selection reader in that tab. There are no blanket
host permissions. Selection length is limited to 2,000 characters; query strings
and fragments are omitted from the source URL, and editable fields are excluded.
Known credential patterns are rejected, but this is not a comprehensive detector
of confidential information. The user reviews the record before sharing it.

The local examples suite verifies projection, bounds and manifest permissions.
A real browser extension load, permission prompt and download need a separate
manual/browser verification receipt; passing the pure-function checks does not
prove those interactions ran.

Primary references:

- [Chrome activeTab](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab)
- [Chrome scripting](https://developer.chrome.com/docs/extensions/reference/api/scripting)
