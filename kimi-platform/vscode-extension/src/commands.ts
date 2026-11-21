/**
 * Command implementations. Every state-changing call to the desktop is
 * preceded by an explicit user confirmation; destructive/local writes are
 * modal. No command ever writes the pairing token anywhere except
 * context.secrets (via BridgeManager).
 */

import * as vscode from 'vscode';
import { buildDecision, describeApproval } from './approvals/decide.js';
import { ArtifactDocumentProvider, type ArtifactKey } from './artifacts/document.js';
import { languageIdForPath } from './artifacts/language.js';
import { isContained, joinInsideWorkspace, validateWorkspaceRelativePath } from './artifacts/paths.js';
import type { BridgeManager } from './bridge/manager.js';
import { parseBridgeAddress, parsePort, normalizeLoopbackHost } from './bridge/url.js';
import type {
  ApprovalRecord,
  BudgetLimits,
  PriceRates,
  Project,
  ProjectProvider,
  ProjectRun,
} from './bridge/types.js';
import { vscodeSelectionSource } from './coding/editorContext.js';
import { collectSelectionContext, composeSelectionMessage } from './coding/selectionContext.js';
import type { ChatViewProvider } from './webview/chatView.js';
import type { ProjectsTreeProvider } from './views/projectsTree.js';
import type { RunsTreeProvider } from './views/runsTree.js';

export interface CommandDeps {
  manager: BridgeManager;
  chat: ChatViewProvider;
  projectsTree: ProjectsTreeProvider;
  runsTree: RunsTreeProvider;
  artifacts: ArtifactDocumentProvider;
  refreshAll: () => Promise<void>;
}

async function requirePaired(deps: CommandDeps): Promise<boolean> {
  if (await deps.manager.isPaired()) return true;
  const choice = await vscode.window.showInformationMessage(
    'Not paired with Research Director Desktop.',
    'Pair now',
  );
  if (choice === 'Pair now') await vscode.commands.executeCommand('research-director.pair');
  return deps.manager.isPaired();
}

// ---------------------------------------------------------------------------
// Pairing
// ---------------------------------------------------------------------------

export async function pairCommand(deps: CommandDeps): Promise<void> {
  const hostInput = await vscode.window.showInputBox({
    title: 'Pair with Research Director Desktop (1/3)',
    prompt: 'Loopback host of the desktop companion server',
    value: '127.0.0.1',
    validateInput: (v) =>
      normalizeLoopbackHost(v) ? null : 'Only loopback hosts are allowed: 127.0.0.1, localhost or [::1]',
  });
  if (hostInput === undefined) return;

  const portInput = await vscode.window.showInputBox({
    title: 'Pair with Research Director Desktop (2/3)',
    prompt: 'Port (shown in the desktop app under Settings → Companion; default 4319)',
    value: '4319',
    validateInput: (v) => (parsePort(v) !== null ? null : 'Enter a port between 1 and 65535'),
  });
  if (portInput === undefined) return;

  const token = await vscode.window.showInputBox({
    title: 'Pair with Research Director Desktop (3/3)',
    prompt: 'Pairing password/token from the desktop app (stored only in VS Code Secret Storage)',
    password: true,
    validateInput: (v) => (v.trim().length >= 8 ? null : 'Token must be at least 8 characters'),
  });
  if (token === undefined) return;

  const address = parseBridgeAddress(hostInput, portInput);
  if (!address) {
    void vscode.window.showErrorMessage('Invalid loopback address.');
    return;
  }

  try {
    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: 'Pairing with desktop…' },
      () => deps.manager.pair(address, token.trim()),
    );
    void vscode.window.showInformationMessage(
      `Paired with Research Director Desktop at ${address.host}:${address.port}.`,
    );
    await deps.refreshAll();
  } catch (err) {
    void vscode.window.showErrorMessage(err instanceof Error ? err.message : 'Pairing failed.');
  }
}

export async function disconnectCommand(deps: CommandDeps): Promise<void> {
  await deps.manager.disconnect();
  void vscode.window.showInformationMessage('Disconnected from Research Director Desktop.');
  await deps.refreshAll();
}

// ---------------------------------------------------------------------------
// New Goal (office project) — explicit confirmed creation
// ---------------------------------------------------------------------------

function parsePositiveNumber(raw: string): number | null {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function promptBudgets(): Promise<{ budget: BudgetLimits; rates: PriceRates } | undefined> {
  const maxTokens = await vscode.window.showInputBox({
    title: 'Budgets (1/5): max tokens',
    value: '200000',
    validateInput: (v) => (parsePositiveNumber(v) !== null ? null : 'Positive number required'),
  });
  if (maxTokens === undefined) return undefined;
  const maxMinutes = await vscode.window.showInputBox({
    title: 'Budgets (2/5): max minutes',
    value: '30',
    validateInput: (v) => (parsePositiveNumber(v) !== null ? null : 'Positive number required'),
  });
  if (maxMinutes === undefined) return undefined;
  const maxUsd = await vscode.window.showInputBox({
    title: 'Budgets (3/5): max USD',
    value: '5',
    validateInput: (v) => (parsePositiveNumber(v) !== null ? null : 'Positive number required'),
  });
  if (maxUsd === undefined) return undefined;
  const inRate = await vscode.window.showInputBox({
    title: 'Budgets (4/5): input price per 1M tokens (USD)',
    value: '3',
    validateInput: (v) => (parsePositiveNumber(v) !== null ? null : 'Positive number required'),
  });
  if (inRate === undefined) return undefined;
  const outRate = await vscode.window.showInputBox({
    title: 'Budgets (5/5): output price per 1M tokens (USD)',
    value: '15',
    validateInput: (v) => (parsePositiveNumber(v) !== null ? null : 'Positive number required'),
  });
  if (outRate === undefined) return undefined;
  return {
    budget: {
      maxTokens: parsePositiveNumber(maxTokens) ?? 0,
      maxMinutes: parsePositiveNumber(maxMinutes) ?? 0,
      maxUsd: parsePositiveNumber(maxUsd) ?? 0,
    },
    rates: {
      inputUsdPerMillion: parsePositiveNumber(inRate) ?? 0,
      outputUsdPerMillion: parsePositiveNumber(outRate) ?? 0,
    },
  };
}

export async function newGoalCommand(deps: CommandDeps): Promise<void> {
  if (!(await requirePaired(deps))) return;

  const goal = await vscode.window.showInputBox({
    title: 'New Goal (1/4)',
    prompt: 'What should the office achieve?',
    validateInput: (v) => (v.trim().length >= 4 ? null : 'Describe the goal in a few words'),
  });
  if (goal === undefined) return;

  const name = await vscode.window.showInputBox({
    title: 'New Goal (2/4)',
    prompt: 'Project name',
    value: goal.trim().slice(0, 48),
    validateInput: (v) => (v.trim().length > 0 && v.length <= 80 ? null : '1–80 characters'),
  });
  if (name === undefined) return;

  const provider = await vscode.window.showQuickPick(
    ['ollama', 'openai', 'anthropic'].map((p) => ({ label: p })),
    { title: 'New Goal (3/4): provider' },
  );
  if (!provider) return;

  const model = await vscode.window.showInputBox({
    title: 'New Goal (4/4): model id',
    prompt: 'Model id as configured in the desktop app',
    validateInput: (v) => (v.trim().length > 0 ? null : 'Model id required'),
  });
  if (model === undefined) return;

  const budgets = await promptBudgets();
  if (!budgets) return;

  const confirm = await vscode.window.showWarningMessage(
    `Create office project "${name.trim()}" with provider ${provider.label} / model ${model.trim()}?\n` +
      `Budgets: ${budgets.budget.maxTokens} tokens, ${budgets.budget.maxMinutes} min, $${budgets.budget.maxUsd}.`,
    { modal: true },
    'Create project',
  );
  if (confirm !== 'Create project') return;

  try {
    const res = await deps.manager.client().createProject({
      name: name.trim(),
      goal: goal.trim(),
      provider: provider.label as ProjectProvider,
      model: model.trim(),
      template: 'office',
      confirmed: true,
    });
    if (!res.ok) {
      void vscode.window.showErrorMessage(`Desktop rejected the project: ${res.error ?? 'unknown error'}`);
      return;
    }
    void vscode.window.showInformationMessage(`Project "${name.trim()}" created.`);
    await deps.refreshAll();
  } catch (err) {
    void vscode.window.showErrorMessage(err instanceof Error ? err.message : 'Create failed');
  }
}

// ---------------------------------------------------------------------------
// Run controls
// ---------------------------------------------------------------------------

async function pickProject(deps: CommandDeps): Promise<Project | undefined> {
  const projects = await deps.manager.client().listProjects();
  if (projects.length === 0) {
    void vscode.window.showInformationMessage('No projects yet — create one with "New Goal".');
    return undefined;
  }
  const picked = await vscode.window.showQuickPick(
    projects.map((p) => ({ label: p.name, description: p.id, project: p })),
    { title: 'Select project' },
  );
  return picked?.project;
}

async function pickRun(deps: CommandDeps, filter?: (r: ProjectRun) => boolean): Promise<ProjectRun | undefined> {
  const runs = (await deps.manager.client().listRuns()).filter((r) => !filter || filter(r));
  if (runs.length === 0) {
    void vscode.window.showInformationMessage('No matching runs.');
    return undefined;
  }
  const picked = await vscode.window.showQuickPick(
    runs.map((r) => ({ label: `${r.id.slice(0, 8)} · ${r.status}`, description: r.projectId, run: r })),
    { title: 'Select run' },
  );
  return picked?.run;
}

function runFromArg(arg: unknown): ProjectRun | null {
  if (arg && typeof arg === 'object' && 'kind' in arg && (arg as { kind: unknown }).kind === 'run') {
    return (arg as unknown as { run: ProjectRun }).run;
  }
  return null;
}

export async function startRunCommand(deps: CommandDeps, arg?: unknown): Promise<void> {
  if (!(await requirePaired(deps))) return;
  let project: Project | undefined;
  if (arg && typeof arg === 'object' && 'kind' in arg && (arg as { kind: unknown }).kind === 'project') {
    project = (arg as unknown as { project: Project }).project;
  } else {
    project = await pickProject(deps);
  }
  if (!project) return;

  const budgets = await promptBudgets();
  if (!budgets) return;

  const confirm = await vscode.window.showWarningMessage(
    `Start a run of "${project.name}"? This calls the ${project.provider} API and counts against your budgets ` +
      `(${budgets.budget.maxTokens} tokens / ${budgets.budget.maxMinutes} min / $${budgets.budget.maxUsd}).`,
    { modal: true },
    'Start run',
  );
  if (confirm !== 'Start run') return;

  const res = await deps.manager.client().startRun({
    projectId: project.id,
    runBudget: budgets.budget,
    priceRates: budgets.rates,
  });
  if (!res.ok) {
    void vscode.window.showErrorMessage(`Could not start run: ${res.error ?? 'unknown error'}`);
    return;
  }
  void vscode.window.showInformationMessage('Run started.');
  await deps.refreshAll();
}

async function simpleRunControl(
  deps: CommandDeps,
  arg: unknown,
  action: (runId: string) => Promise<{ ok: boolean; error?: string }>,
  filter: (r: ProjectRun) => boolean,
  verb: string,
): Promise<void> {
  if (!(await requirePaired(deps))) return;
  const run = runFromArg(arg) ?? (await pickRun(deps, filter));
  if (!run) return;
  const res = await action(run.id);
  if (!res.ok) {
    void vscode.window.showErrorMessage(`Could not ${verb} run: ${res.error ?? 'unknown error'}`);
    return;
  }
  void vscode.window.showInformationMessage(`Run ${verb}d.`);
  await deps.refreshAll();
}

export const pauseRunCommand = (deps: CommandDeps, arg?: unknown): Promise<void> =>
  simpleRunControl(deps, arg, (id) => deps.manager.client().pauseRun(id), (r) => r.status === 'running', 'pause');

export const resumeRunCommand = (deps: CommandDeps, arg?: unknown): Promise<void> =>
  simpleRunControl(deps, arg, (id) => deps.manager.client().resumeRun(id), (r) => r.status === 'paused', 'resume');

export const recoverRunCommand = (deps: CommandDeps, arg?: unknown): Promise<void> =>
  simpleRunControl(
    deps,
    arg,
    (id) => deps.manager.client().recoverRun(id),
    (r) => r.status === 'interrupted',
    'recover',
  );

export async function cancelRunCommand(deps: CommandDeps, arg?: unknown): Promise<void> {
  if (!(await requirePaired(deps))) return;
  const run =
    runFromArg(arg) ??
    (await pickRun(deps, (r) => r.status === 'running' || r.status === 'paused' || r.status === 'waiting-approval'));
  if (!run) return;
  const confirm = await vscode.window.showWarningMessage(
    `Cancel run ${run.id.slice(0, 8)}? In-flight node work is stopped; usage so far still counts.`,
    { modal: true },
    'Cancel run',
  );
  if (confirm !== 'Cancel run') return;
  const res = await deps.manager.client().cancelRun(run.id);
  if (!res.ok) {
    void vscode.window.showErrorMessage(`Could not cancel run: ${res.error ?? 'unknown error'}`);
    return;
  }
  void vscode.window.showInformationMessage('Run cancelled.');
  await deps.refreshAll();
}

// ---------------------------------------------------------------------------
// Approvals — exact payloadHash decisions
// ---------------------------------------------------------------------------

function approvalFromArg(arg: unknown): ApprovalRecord | null {
  if (arg && typeof arg === 'object' && 'kind' in arg && (arg as { kind: unknown }).kind === 'approval') {
    return (arg as unknown as { approval: ApprovalRecord }).approval;
  }
  return null;
}

async function decideApprovalCommand(
  deps: CommandDeps,
  arg: unknown,
  decision: 'approved' | 'rejected',
): Promise<void> {
  if (!(await requirePaired(deps))) return;
  let record = approvalFromArg(arg);
  if (!record) {
    const pending = (await deps.manager.client().listApprovals()).filter((a) => a.status === 'pending');
    if (pending.length === 0) {
      void vscode.window.showInformationMessage('No pending approvals.');
      return;
    }
    const picked = await vscode.window.showQuickPick(
      pending.map((a) => ({ label: describeApproval(a), approval: a })),
      { title: 'Select approval' },
    );
    record = picked?.approval ?? null;
  }
  if (!record) return;

  const confirm = await vscode.window.showWarningMessage(
    `${decision === 'approved' ? 'Approve' : 'Reject'}: ${describeApproval(record)}`,
    { modal: true },
    decision === 'approved' ? 'Approve' : 'Reject',
  );
  if (!confirm) return;

  try {
    const payload = buildDecision(record, decision); // throws on non-pending / bad hash
    const res = await deps.manager.client().decideApproval(payload);
    if (!res.ok) {
      void vscode.window.showErrorMessage(`Decision rejected by desktop: ${res.error ?? 'unknown error'}`);
      return;
    }
    void vscode.window.showInformationMessage(`Approval ${decision}.`);
    await deps.refreshAll();
  } catch (err) {
    void vscode.window.showErrorMessage(err instanceof Error ? err.message : 'Decision failed');
  }
}

export const approveCommand = (deps: CommandDeps, arg?: unknown): Promise<void> =>
  decideApprovalCommand(deps, arg, 'approved');

export const rejectCommand = (deps: CommandDeps, arg?: unknown): Promise<void> =>
  decideApprovalCommand(deps, arg, 'rejected');

// ---------------------------------------------------------------------------
// Artifacts: open / diff / apply
// ---------------------------------------------------------------------------

export interface ArtifactRef extends ArtifactKey {
  title?: string;
}

function artifactFromArg(arg: unknown): ArtifactRef | null {
  if (arg && typeof arg === 'object' && 'kind' in arg && (arg as { kind: unknown }).kind === 'artifact') {
    const a = arg as unknown as { projectId: string; runId: string; nodeId: string };
    return { projectId: a.projectId, runId: a.runId, nodeId: a.nodeId };
  }
  if (arg && typeof arg === 'object' && 'projectId' in arg && 'runId' in arg && 'nodeId' in arg) {
    return arg as ArtifactRef;
  }
  return null;
}

async function pickArtifact(deps: CommandDeps): Promise<ArtifactRef | undefined> {
  const runs = await deps.manager.client().listRuns();
  const items: Array<{ label: string; description: string; ref: ArtifactRef }> = [];
  for (const run of runs) {
    for (const [nodeId, st] of Object.entries(run.nodeStates)) {
      if (st.artifactId || (st.artifactIds && st.artifactIds.length > 0)) {
        items.push({
          label: nodeId,
          description: `run ${run.id.slice(0, 8)}`,
          ref: { projectId: run.projectId, runId: run.id, nodeId },
        });
      }
    }
  }
  if (items.length === 0) {
    void vscode.window.showInformationMessage('No artifacts yet.');
    return undefined;
  }
  const picked = await vscode.window.showQuickPick(items, { title: 'Select artifact' });
  return picked?.ref;
}

async function fetchArtifact(deps: CommandDeps, ref: ArtifactRef) {
  const res = await deps.manager.client().readArtifact(ref.projectId, ref.runId, ref.nodeId, ref.attempt);
  if (!res.ok || typeof res.text !== 'string') {
    void vscode.window.showErrorMessage(`Could not read artifact: ${res.error ?? 'unknown error'}`);
    return undefined;
  }
  return res;
}

export async function openArtifactCommand(deps: CommandDeps, arg?: unknown): Promise<void> {
  if (!(await requirePaired(deps))) return;
  const ref = artifactFromArg(arg) ?? (await pickArtifact(deps));
  if (!ref) return;
  const res = await fetchArtifact(deps, ref);
  if (!res) return;
  const uri = deps.artifacts.set(ref, res.text ?? '', res.meta);
  const doc = await vscode.workspace.openTextDocument(uri);
  await vscode.languages.setTextDocumentLanguage(doc, 'markdown');
  await vscode.window.showTextDocument(doc, { preview: true });
}

/**
 * Diff an artifact against the active editor file or a chosen workspace file.
 * The artifact side is always the in-memory read-only document.
 */
export async function diffArtifactCommand(deps: CommandDeps, arg?: unknown): Promise<void> {
  if (!(await requirePaired(deps))) return;
  const ref = artifactFromArg(arg) ?? (await pickArtifact(deps));
  if (!ref) return;
  const res = await fetchArtifact(deps, ref);
  if (!res) return;
  const artifactUri = deps.artifacts.set(ref, res.text ?? '', res.meta);

  let target: vscode.Uri | undefined;
  const active = vscode.window.activeTextEditor?.document;
  const choices: Array<{ label: string; uri?: vscode.Uri }> = [];
  if (active && active.uri.scheme === 'file') {
    choices.push({
      label: `Active editor: ${vscode.workspace.asRelativePath(active.uri, false)}`,
      uri: active.uri,
    });
  }
  choices.push({ label: 'Choose workspace file…' });
  const picked = await vscode.window.showQuickPick(choices, { title: 'Diff artifact against' });
  if (!picked) return;
  target = picked.uri;
  if (!target) {
    const chosen = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
      openLabel: 'Diff against this file',
      defaultUri: vscode.workspace.workspaceFolders?.[0]?.uri,
    });
    target = chosen?.[0];
  }
  if (!target) return;
  await vscode.commands.executeCommand(
    'vscode.diff',
    target,
    artifactUri,
    `${vscode.workspace.asRelativePath(target, false)} ↔ artifact ${ref.nodeId}`,
  );
}

/**
 * Apply an artifact into the workspace: modal confirmation + explicit target
 * path prompt, strict relative-path containment, overwrite confirmation,
 * workspace.fs write, then language sync on the opened document.
 */
export async function applyArtifactCommand(deps: CommandDeps, arg?: unknown): Promise<void> {
  if (!(await requirePaired(deps))) return;
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    void vscode.window.showErrorMessage('Open a workspace folder before applying artifacts.');
    return;
  }
  const ref = artifactFromArg(arg) ?? (await pickArtifact(deps));
  if (!ref) return;
  const res = await fetchArtifact(deps, ref);
  if (!res) return;
  const text = res.text ?? '';

  let folder = folders[0];
  if (folders.length > 1) {
    const picked = await vscode.window.showQuickPick(
      folders.map((f) => ({ label: f.name, folder: f })),
      { title: 'Apply into workspace folder' },
    );
    if (!picked) return;
    folder = picked.folder;
  }
  if (!folder) return;

  const confirm = await vscode.window.showWarningMessage(
    `Apply artifact "${ref.nodeId}" (${text.length} chars) into workspace folder "${folder.name}"?`,
    { modal: true },
    'Continue',
  );
  if (confirm !== 'Continue') return;

  const relPath = await vscode.window.showInputBox({
    title: 'Target path (relative to the workspace folder)',
    prompt: 'Forward slashes only; no absolute paths, no ".."',
    value: `artifacts/${ref.nodeId.replace(/[^A-Za-z0-9._-]/g, '-')}.md`,
    validateInput: (v) => {
      const verdict = validateWorkspaceRelativePath(v);
      return verdict.ok ? null : `Invalid path: ${verdict.reason}`;
    },
  });
  if (relPath === undefined) return;

  const rootPath = folder.uri.path;
  const joined = joinInsideWorkspace(rootPath, relPath);
  if (!joined || !isContained(rootPath, joined)) {
    void vscode.window.showErrorMessage('Target path escapes the workspace folder — refused.');
    return;
  }
  const target = vscode.Uri.joinPath(folder.uri, ...relPath.split('/'));

  let exists = false;
  try {
    await vscode.workspace.fs.stat(target);
    exists = true;
  } catch {
    exists = false;
  }
  if (exists) {
    const overwrite = await vscode.window.showWarningMessage(
      `"${relPath}" already exists and will be overwritten.`,
      { modal: true },
      'Overwrite',
    );
    if (overwrite !== 'Overwrite') return;
  }

  await vscode.workspace.fs.writeFile(target, new TextEncoder().encode(text));
  const doc = await vscode.workspace.openTextDocument(target);
  const wanted = languageIdForPath(relPath);
  if (wanted && doc.languageId !== wanted) {
    await vscode.languages.setTextDocumentLanguage(doc, wanted); // target-language sync
  }
  await vscode.window.showTextDocument(doc, { preview: false });
  void vscode.window.showInformationMessage(`Artifact applied to ${relPath}.`);
}

// ---------------------------------------------------------------------------
// Ask Director about Selection (coding-first workflow)
// ---------------------------------------------------------------------------

export async function askAboutSelectionCommand(deps: CommandDeps): Promise<void> {
  if (!(await requirePaired(deps))) return;

  const editor = vscode.window.activeTextEditor;
  const ctx = editor
    ? collectSelectionContext(vscodeSelectionSource(editor))
    : collectSelectionContext({
        readSelection: () => '',
        languageId: () => 'plaintext',
        relativeLabel: () => null,
      });

  // Empty selection → offer a clear input box rather than failing.
  const hasSelection = ctx.text.trim().length > 0;
  const question = await vscode.window.showInputBox({
    title: hasSelection
      ? `Ask Director about selection (${ctx.text.length} chars${ctx.fileLabel ? `, ${ctx.fileLabel}` : ''})`
      : 'Ask Director (no selection — describe your question)',
    prompt: hasSelection
      ? 'What should the Director do with the selected code?'
      : 'Nothing is selected in the active editor. Type your question for the Director.',
    validateInput: (v) => (v.trim().length > 0 || hasSelection ? null : 'Type a question'),
  });
  if (question === undefined) return;

  const message = composeSelectionMessage(question, ctx);

  const confirm = await vscode.window.showWarningMessage(
    hasSelection
      ? `Send the selection (${ctx.text.length} chars${ctx.fileLabel ? ` from ${ctx.fileLabel}` : ''}) to the Director? ` +
          'This triggers a provider call via the desktop.'
      : 'Send your question to the Director? This triggers a provider call via the desktop.',
    { modal: true },
    'Send to Director',
  );
  if (confirm !== 'Send to Director') return;

  try {
    const sessionId = await deps.chat.ensureDirectorSession();
    if (!sessionId) return; // user cancelled session creation
    await deps.chat.reveal();
    await deps.chat.sendToSession(sessionId, message);
  } catch (err) {
    void vscode.window.showErrorMessage(err instanceof Error ? err.message : 'Send failed');
  }
}
