import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc-client";
import { ErrorNote } from "./DirectorShell";
import {
  INTEGRATION_PROVIDER_INFO,
  type IntegrationProvider,
} from "@contracts/integrations";

/**
 * Integration Settings — owner-scoped credential vault + read-only connectors.
 *
 * Security contract on this page:
 *  - secrets are entered into write-only password inputs and submitted over
 *    the authenticated runtime; the field is cleared immediately after
 *    submit and the value is never persisted anywhere in the browser
 *    (no web storage APIs, no cookies, no analytics events);
 *  - on an insecure origin (http outside localhost/dev) the credential forms
 *    are not rendered at all — production HTTP is rejected;
 *  - the server never returns secrets, ciphertext, or last-N characters;
 *    this page renders status and metadata only;
 *  - every connector call is an explicit button click. There is no
 *    background sync and no scheduler.
 */

function isSecureRuntime(): boolean {
  if (typeof window === "undefined") return false;
  const proto = window.location.protocol;
  if (proto === "https:") return true;
  const host = window.location.hostname;
  return proto === "http:" && (host === "localhost" || host === "127.0.0.1");
}

const CREDENTIAL_PROVIDERS: Exclude<IntegrationProvider, "mcp">[] = [
  "openai",
  "anthropic",
  "github",
  "figma",
  "google-drive",
];

const STATUS_CHIP: Record<string, string> = {
  ok: "chip chip-sage",
  failed: "chip chip-mustard",
  unchecked: "chip",
};

function AddCredentialForm({ provider }: { provider: Exclude<IntegrationProvider, "mcp"> }) {
  const utils = trpc.useUtils();
  const [label, setLabel] = useState("");
  const [secret, setSecret] = useState("");
  const createM = trpc.integrations.create.useMutation({
    onSuccess: () => void utils.integrations.list.invalidate(),
  });
  const info = INTEGRATION_PROVIDER_INFO[provider];
  return (
    <form
      className="mt-2 flex flex-wrap items-end gap-2 text-xs"
      onSubmit={(e) => {
        e.preventDefault();
        const s = secret;
        setSecret(""); // cleared before the request resolves — write-only
        createM.mutate(
          { provider, label, secret: s },
          { onSettled: () => setLabel("") },
        );
      }}
    >
      <label>
        Label
        <input
          required
          maxLength={120}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="ml-1 border border-[hsl(var(--line))] bg-transparent p-1"
          placeholder="e.g. personal"
        />
      </label>
      <label>
        {info.secretLabel}
        <input
          required
          type="password"
          autoComplete="new-password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          className="ml-1 w-56 border border-[hsl(var(--line))] bg-transparent p-1"
          placeholder="write-only — never shown again"
        />
      </label>
      <button type="submit" className="tab-control" disabled={createM.isPending}>
        Store encrypted
      </button>
      {createM.error ? <ErrorNote message={createM.error.message} /> : null}
    </form>
  );
}

function RecordRow({ recordId }: { recordId: number }) {
  const utils = trpc.useUtils();
  const listQ = trpc.integrations.list.useQuery();
  const record = (listQ.data?.records ?? []).find((r) => r.id === recordId);
  const testM = trpc.integrations.test.useMutation({
    onSuccess: () => void utils.integrations.list.invalidate(),
  });
  const revokeM = trpc.integrations.revoke.useMutation({
    onSuccess: () => void utils.integrations.list.invalidate(),
  });
  if (!record) return null;
  return (
    <li className="border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <b>{record.label}</b>
        <span className={STATUS_CHIP[record.lastCheckStatus] ?? "chip"}>
          {record.lastCheckStatus}
        </span>
        {record.lastCheckErrorClass ? (
          <span className="text-xs text-[hsl(var(--ink-soft))]">
            last error: {record.lastCheckErrorClass}
          </span>
        ) : null}
        <span className="ml-auto flex gap-2">
          {record.provider !== "mcp" ? (
            <button
              type="button"
              className="tab-control text-xs"
              disabled={testM.isPending}
              onClick={() => testM.mutate({ id: record.id })}
            >
              Test connection
            </button>
          ) : null}
          <button
            type="button"
            className="tab-control text-xs"
            disabled={revokeM.isPending}
            onClick={() => {
              if (window.confirm(`Revoke and delete "${record.label}"? This cannot be undone.`)) {
                revokeM.mutate({ id: record.id });
              }
            }}
          >
            Revoke
          </button>
        </span>
      </div>
      <p className="mt-1 text-xs text-[hsl(var(--ink-soft))]">
        added {new Date(record.createdAt).toLocaleString()} · updated{" "}
        {new Date(record.updatedAt).toLocaleString()}
      </p>
      {testM.data ? (
        <p className="mt-1 text-xs">
          {testM.data.ok ? (
            <>
              Connection OK.
              {testM.data.models?.length ? (
                <> Models discovered ({testM.data.models.length}): {testM.data.models.slice(0, 12).join(", ")}
                  {testM.data.models.length > 12 ? "…" : ""}</>
              ) : null}
            </>
          ) : (
            <>
              Failed ({testM.data.errorClass}){testM.data.detail ? `: ${testM.data.detail}` : ""}
            </>
          )}
        </p>
      ) : null}
      {testM.error ? <ErrorNote message={testM.error.message} /> : null}
    </li>
  );
}

function GithubSection({ recordIds }: { recordIds: number[] }) {
  const [repoUrl, setRepoUrl] = useState("");
  const [recordId, setRecordId] = useState<number | undefined>(undefined);
  const inspectM = trpc.integrations.githubInspect.useMutation();
  const importM = trpc.integrations.githubImport.useMutation();
  return (
    <div className="mt-3 border border-[hsl(var(--line))] p-3">
      <h3 className="text-sm font-bold">GitHub repository import (read-only)</h3>
      <p className="mt-1 text-xs text-[hsl(var(--ink-soft))]">
        Fetches repo metadata, the default-branch tree, and the README. Public
        repos need no token. Import stores the README as a <b>quarantined</b>{" "}
        skill draft after hash verification — nothing is cloned or executed.
      </p>
      <form
        className="mt-2 flex flex-wrap items-end gap-2 text-xs"
        onSubmit={(e) => {
          e.preventDefault();
          inspectM.mutate({ repoUrl, recordId });
        }}
      >
        <label className="grow">
          Repository URL
          <input
            required
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="https://github.com/owner/repo"
            className="ml-1 w-72 border border-[hsl(var(--line))] bg-transparent p-1"
          />
        </label>
        {recordIds.length ? (
          <label>
            Token (optional)
            <select
              value={recordId ?? ""}
              onChange={(e) =>
                setRecordId(e.target.value ? Number(e.target.value) : undefined)
              }
              className="ml-1 border border-[hsl(var(--line))] bg-transparent p-1"
            >
              <option value="">none (public repo)</option>
              {recordIds.map((id) => (
                <option key={id} value={id}>
                  record #{id}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <button type="submit" className="tab-control" disabled={inspectM.isPending}>
          Inspect
        </button>
      </form>
      {inspectM.error ? <ErrorNote message={inspectM.error.message} /> : null}
      {inspectM.data ? (
        <div className="mt-3 text-xs">
          <p>
            <b>{inspectM.data.fullName}</b> · {inspectM.data.language ?? "unknown"} · ★{" "}
            {inspectM.data.stars} · license {inspectM.data.license ?? "none"} · branch{" "}
            {inspectM.data.defaultBranch}
          </p>
          <p className="mt-1">{inspectM.data.description}</p>
          <p className="mono mt-1">
            tree: {inspectM.data.treePaths.length} path(s)
            {inspectM.data.treeTruncated ? " (truncated)" : ""} · README sha256{" "}
            {inspectM.data.readmeSha256 ? inspectM.data.readmeSha256.slice(0, 16) + "…" : "none"}
          </p>
          {inspectM.data.readmeExcerpt ? (
            <pre className="mono mt-2 max-h-40 overflow-auto border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-2">
              {inspectM.data.readmeExcerpt}
            </pre>
          ) : (
            <p className="mt-2 text-[hsl(var(--ink-soft))]">No README — nothing to import.</p>
          )}
          {inspectM.data.readmeSha256 ? (
            <button
              type="button"
              className="tab-control mt-2"
              disabled={importM.isPending}
              onClick={() =>
                importM.mutate({
                  repoUrl,
                  recordId,
                  expectedReadmeSha256: inspectM.data!.readmeSha256!,
                })
              }
            >
              Import README as quarantined skill draft
            </button>
          ) : null}
          {importM.error ? <ErrorNote message={importM.error.message} /> : null}
          {importM.data ? (
            <p className="mt-2">
              Imported as quarantined draft #{importM.data.id} · sha256{" "}
              {importM.data.contentSha256.slice(0, 16)}… · review it in the{" "}
              <a className="underline" href="#/director/skills">
                Skill registry
              </a>
              .
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function FigmaSection({ recordIds }: { recordIds: number[] }) {
  const [fileKey, setFileKey] = useState("");
  const [recordId, setRecordId] = useState<number | undefined>(recordIds[0]);
  const metaM = trpc.integrations.figmaFileMeta.useMutation();
  if (!recordIds.length) return null;
  return (
    <div className="mt-3 border border-[hsl(var(--line))] p-3">
      <h3 className="text-sm font-bold">Figma file metadata (read-only)</h3>
      <form
        className="mt-2 flex flex-wrap items-end gap-2 text-xs"
        onSubmit={(e) => {
          e.preventDefault();
          if (recordId) metaM.mutate({ recordId, fileKey });
        }}
      >
        <label>
          Record
          <select
            value={recordId ?? ""}
            onChange={(e) => setRecordId(Number(e.target.value))}
            className="ml-1 border border-[hsl(var(--line))] bg-transparent p-1"
          >
            {recordIds.map((id) => (
              <option key={id} value={id}>
                record #{id}
              </option>
            ))}
          </select>
        </label>
        <label>
          File key
          <input
            required
            value={fileKey}
            onChange={(e) => setFileKey(e.target.value)}
            className="ml-1 border border-[hsl(var(--line))] bg-transparent p-1"
          />
        </label>
        <button type="submit" className="tab-control" disabled={metaM.isPending}>
          Fetch metadata
        </button>
      </form>
      {metaM.error ? <ErrorNote message={metaM.error.message} /> : null}
      {metaM.data ? (
        <p className="mt-2 text-xs">
          <b>{metaM.data.name}</b> · {metaM.data.pageCount} page(s) · version{" "}
          {metaM.data.version} · modified {metaM.data.lastModified}
        </p>
      ) : null}
    </div>
  );
}

function DriveSection({ recordIds }: { recordIds: number[] }) {
  const [recordId, setRecordId] = useState<number | undefined>(recordIds[0]);
  const listM = trpc.integrations.driveList.useMutation();
  if (!recordIds.length) return null;
  return (
    <div className="mt-3 border border-[hsl(var(--line))] p-3">
      <h3 className="text-sm font-bold">Google Drive file list (read-only)</h3>
      <p className="mt-1 text-xs text-[hsl(var(--ink-soft))]">
        Uses the short-lived OAuth access token you stored. Limitation: there is
        no refresh-token flow — when the token expires (typically ~1 hour) the
        test will report <span className="mono">auth</span> and you must paste a
        fresh token. Listing is capped at two pages; nothing is downloaded or
        modified.
      </p>
      <div className="mt-2 flex items-end gap-2 text-xs">
        <label>
          Record
          <select
            value={recordId ?? ""}
            onChange={(e) => setRecordId(Number(e.target.value))}
            className="ml-1 border border-[hsl(var(--line))] bg-transparent p-1"
          >
            {recordIds.map((id) => (
              <option key={id} value={id}>
                record #{id}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="tab-control"
          disabled={listM.isPending || !recordId}
          onClick={() => recordId && listM.mutate({ recordId, pageSize: 25 })}
        >
          List files
        </button>
      </div>
      {listM.error ? <ErrorNote message={listM.error.message} /> : null}
      {listM.data ? (
        <ul className="mt-2 grid gap-1 text-xs">
          {listM.data.files.map((f) => (
            <li key={f.id}>
              <b>{f.name}</b> <span className="mono">{f.mimeType}</span> · {f.modifiedTime}
            </li>
          ))}
          {listM.data.truncated ? <li>…truncated at the page cap.</li> : null}
        </ul>
      ) : null}
    </div>
  );
}

function McpSection() {
  const utils = trpc.useUtils();
  const listQ = trpc.integrations.list.useQuery();
  const [allowlistText, setAllowlistText] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [bearer, setBearer] = useState("");
  const allowM = trpc.integrations.mcpSetAllowlist.useMutation({
    onSuccess: () => void utils.integrations.list.invalidate(),
  });
  const regM = trpc.integrations.mcpRegister.useMutation({
    onSuccess: () => void utils.integrations.list.invalidate(),
  });
  const discM = trpc.integrations.mcpDiscover.useMutation({
    onSuccess: () => void utils.integrations.list.invalidate(),
  });
  const [discRecordId, setDiscRecordId] = useState<number | null>(null);
  const discQ = trpc.integrations.discoveries.useQuery(
    { recordId: discRecordId ?? 0 },
    { enabled: discRecordId !== null },
  );
  const mcpRecords = (listQ.data?.records ?? []).filter((r) => r.provider === "mcp");
  const secure = isSecureRuntime();

  return (
    <div className="mt-3 border border-[hsl(var(--line))] p-3">
      <h3 className="text-sm font-bold">MCP servers (remote Streamable HTTP, discovery only)</h3>
      <p className="mt-1 text-xs text-[hsl(var(--ink-soft))]">
        Registration performs <span className="mono">initialize</span> +{" "}
        <span className="mono">tools/list</span> only — tools are never
        executed, and discovered schemas are stored as quarantined records.
        HTTPS with SSRF/private-IP/redirect protections; local HTTP only in
        explicit development mode. Hosts must be on your allowlist first.
      </p>

      <div className="mt-2 text-xs">
        <label className="block font-bold">Owner MCP host allowlist</label>
        <textarea
          rows={2}
          className="mt-1 w-full border border-[hsl(var(--line))] bg-transparent p-1"
          placeholder="one host per line, e.g. mcp.example.com"
          value={allowlistText ?? (listQ.data?.mcpAllowlist ?? []).join("\n")}
          onChange={(e) => setAllowlistText(e.target.value)}
        />
        <button
          type="button"
          className="tab-control mt-1"
          disabled={allowM.isPending}
          onClick={() =>
            allowM.mutate({
              hosts: (allowlistText ?? "").split(/\s+/).filter(Boolean),
            })
          }
        >
          Save allowlist
        </button>
        {allowM.error ? <ErrorNote message={allowM.error.message} /> : null}
      </div>

      {secure ? (
        <form
          className="mt-3 flex flex-wrap items-end gap-2 text-xs"
          onSubmit={(e) => {
            e.preventDefault();
            const b = bearer;
            setBearer(""); // write-only
            regM.mutate({ label, url, secret: b || undefined }, { onSettled: () => setLabel("") });
          }}
        >
          <label>
            Label
            <input
              required
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="ml-1 border border-[hsl(var(--line))] bg-transparent p-1"
            />
          </label>
          <label>
            Server URL
            <input
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://mcp.example.com/mcp"
              className="ml-1 w-64 border border-[hsl(var(--line))] bg-transparent p-1"
            />
          </label>
          <label>
            Bearer (optional)
            <input
              type="password"
              autoComplete="new-password"
              value={bearer}
              onChange={(e) => setBearer(e.target.value)}
              className="ml-1 border border-[hsl(var(--line))] bg-transparent p-1"
            />
          </label>
          <button type="submit" className="tab-control" disabled={regM.isPending}>
            Register server
          </button>
          {regM.error ? <ErrorNote message={regM.error.message} /> : null}
        </form>
      ) : null}

      <ul className="mt-3 grid gap-2">
        {mcpRecords.map((r) => (
          <li key={r.id} className="border border-[hsl(var(--line))] p-2 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <b>{r.label}</b>
              <span className="mono">{String(r.metadata.url ?? "")}</span>
              <span className={STATUS_CHIP[r.lastCheckStatus] ?? "chip"}>{r.lastCheckStatus}</span>
              <button
                type="button"
                className="tab-control ml-auto"
                disabled={discM.isPending}
                onClick={() => {
                  setDiscRecordId(r.id);
                  discM.mutate({ id: r.id }, { onSuccess: () => void discQ.refetch() });
                }}
              >
                Discover tools
              </button>
            </div>
            {discRecordId === r.id && discM.data ? (
              <p className="mt-1">{discM.data.ok ? discM.data.detail : `failed: ${discM.data.errorClass}`}</p>
            ) : null}
            {discRecordId === r.id && discQ.data ? (
              <ul className="mono mt-1 grid gap-0.5">
                {discQ.data.map((t) => (
                  <li key={t.id}>
                    {t.name} <span className="chip">quarantined</span>{" "}
                    <span className="text-[hsl(var(--ink-soft))]">{t.sha256.slice(0, 12)}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {discRecordId === r.id && discM.error ? <ErrorNote message={discM.error.message} /> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function IntegrationsPanel() {
  const listQ = trpc.integrations.list.useQuery();
  const capsQ = trpc.integrations.capabilities.useQuery();
  const secure = useMemo(() => isSecureRuntime(), []);
  const records = listQ.data?.records ?? [];
  const idsByProvider = (p: IntegrationProvider) =>
    records.filter((r) => r.provider === p).map((r) => r.id);

  return (
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight">Integration Settings</h1>
      <p className="prose-evidence mt-1 text-sm text-[hsl(var(--ink-soft))]">
        Credentials are encrypted server-side with AES-256-GCM (owner-scoped,
        key never leaves the server) and are write-only: they are never shown,
        never returned by the API, and never stored in your browser. All
        connector operations are read-only and run only when you click them.
      </p>
      {capsQ.data && !capsQ.data.vaultConfigured ? (
        <ErrorNote message="the credential vault is not provisioned on this server (server encryption key missing) — storage is disabled (fail closed)." />
      ) : null}
      {!secure ? (
        <ErrorNote message="this page is served over insecure HTTP — credential forms are disabled. Open the site over HTTPS." />
      ) : null}

      {CREDENTIAL_PROVIDERS.map((p) => {
        const info = INTEGRATION_PROVIDER_INFO[p];
        const ids = idsByProvider(p);
        return (
          <section key={p} className="mt-6">
            <h2 className="text-lg font-extrabold tracking-tight">{info.name}</h2>
            <p className="text-xs text-[hsl(var(--ink-soft))]">
              Capabilities: {info.capabilities.join(" · ")}
            </p>
            <ul className="mt-2 grid gap-2">
              {ids.map((id) => (
                <RecordRow key={id} recordId={id} />
              ))}
              {ids.length === 0 ? (
                <li className="text-xs text-[hsl(var(--ink-soft))]">No credential stored.</li>
              ) : null}
            </ul>
            {secure ? <AddCredentialForm provider={p} /> : null}
            {p === "github" ? <GithubSection recordIds={ids} /> : null}
            {p === "figma" ? <FigmaSection recordIds={ids} /> : null}
            {p === "google-drive" ? <DriveSection recordIds={ids} /> : null}
          </section>
        );
      })}

      <section className="mt-6">
        <h2 className="text-lg font-extrabold tracking-tight">
          {INTEGRATION_PROVIDER_INFO["mcp"].name}
        </h2>
        <McpSection />
      </section>
      {listQ.error ? <ErrorNote message={listQ.error.message} /> : null}
    </div>
  );
}
