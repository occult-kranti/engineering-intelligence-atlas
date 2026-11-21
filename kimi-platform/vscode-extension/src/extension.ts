/**
 * Research Director Companion — activation entry point.
 * Stable VS Code APIs only. No process spawning, no terminals, no remote
 * execution: all desktop interaction goes through the loopback BridgeClient.
 */

import * as vscode from 'vscode';
import { ArtifactDocumentProvider, ARTIFACT_SCHEME } from './artifacts/document.js';
import { BridgeManager } from './bridge/manager.js';
import {
  applyArtifactCommand,
  approveCommand,
  askAboutSelectionCommand,
  cancelRunCommand,
  diffArtifactCommand,
  disconnectCommand,
  newGoalCommand,
  openArtifactCommand,
  pairCommand,
  pauseRunCommand,
  recoverRunCommand,
  rejectCommand,
  resumeRunCommand,
  startRunCommand,
  type CommandDeps,
} from './commands.js';
import { ProjectsTreeProvider } from './views/projectsTree.js';
import { RunsTreeProvider } from './views/runsTree.js';
import { ChatViewProvider } from './webview/chatView.js';

export function activate(context: vscode.ExtensionContext): void {
  const manager = new BridgeManager(context);
  const chat = new ChatViewProvider(manager, context.extensionUri);
  const projectsTree = new ProjectsTreeProvider(manager);
  const runsTree = new RunsTreeProvider(manager);
  const artifacts = new ArtifactDocumentProvider();

  const refreshAll = async (): Promise<void> => {
    await Promise.all([projectsTree.refresh(), runsTree.refresh(), chat.refreshSessions()]);
  };

  const deps: CommandDeps = { manager, chat, projectsTree, runsTree, artifacts, refreshAll };

  context.subscriptions.push(
    manager,
    projectsTree,
    runsTree,
    vscode.window.registerWebviewViewProvider(ChatViewProvider.viewType, chat),
    vscode.window.registerTreeDataProvider('researchDirector.projects', projectsTree),
    vscode.window.registerTreeDataProvider('researchDirector.runs', runsTree),
    vscode.workspace.registerTextDocumentContentProvider(ARTIFACT_SCHEME, artifacts),
    vscode.commands.registerCommand('research-director.pair', () => pairCommand(deps)),
    vscode.commands.registerCommand('research-director.disconnect', () => disconnectCommand(deps)),
    vscode.commands.registerCommand('research-director.refresh', () => refreshAll()),
    vscode.commands.registerCommand('research-director.newGoal', () => newGoalCommand(deps)),
    vscode.commands.registerCommand('research-director.run.start', (arg?: unknown) => startRunCommand(deps, arg)),
    vscode.commands.registerCommand('research-director.run.pause', (arg?: unknown) => pauseRunCommand(deps, arg)),
    vscode.commands.registerCommand('research-director.run.resume', (arg?: unknown) => resumeRunCommand(deps, arg)),
    vscode.commands.registerCommand('research-director.run.recover', (arg?: unknown) => recoverRunCommand(deps, arg)),
    vscode.commands.registerCommand('research-director.run.cancel', (arg?: unknown) => cancelRunCommand(deps, arg)),
    vscode.commands.registerCommand('research-director.approval.approve', (arg?: unknown) => approveCommand(deps, arg)),
    vscode.commands.registerCommand('research-director.approval.reject', (arg?: unknown) => rejectCommand(deps, arg)),
    vscode.commands.registerCommand('research-director.artifact.open', (arg?: unknown) => openArtifactCommand(deps, arg)),
    vscode.commands.registerCommand('research-director.artifact.diff', (arg?: unknown) => diffArtifactCommand(deps, arg)),
    vscode.commands.registerCommand('research-director.artifact.apply', (arg?: unknown) => applyArtifactCommand(deps, arg)),
    vscode.commands.registerCommand('research-director.askAboutSelection', () => askAboutSelectionCommand(deps)),
  );
}

export function deactivate(): void {
  // Providers dispose via context.subscriptions.
}
