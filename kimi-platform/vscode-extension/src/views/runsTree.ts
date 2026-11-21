/**
 * Runs tree: runs -> pending approvals + node artifacts.
 * Polls conservatively: 10s while any run is active, 30s otherwise.
 */

import * as vscode from 'vscode';
import type { BridgeManager } from '../bridge/manager.js';
import type { ApprovalRecord, Project, ProjectRun } from '../bridge/types.js';
import {
  buildRunChildren,
  buildRunNodes,
  runDescription,
  runStatusContextValue,
  runStatusIcon,
  type RunsNode,
} from './model.js';

const ACTIVE_STATUSES = new Set(['running', 'paused', 'waiting-approval']);

export class RunsTreeProvider implements vscode.TreeDataProvider<RunsNode>, vscode.Disposable {
  #manager: BridgeManager;
  #onDidChangeTreeData = new vscode.EventEmitter<RunsNode | undefined>();
  readonly onDidChangeTreeData = this.#onDidChangeTreeData.event;

  #runs: ProjectRun[] = [];
  #projects: Project[] = [];
  #approvals = new Map<string, ApprovalRecord[]>();
  #paired = false;
  #timer: ReturnType<typeof setTimeout> | null = null;

  constructor(manager: BridgeManager) {
    this.#manager = manager;
    manager.onDidChangePairing(() => void this.refresh());
  }

  async refresh(): Promise<void> {
    this.#paired = await this.#manager.isPaired();
    if (!this.#paired) {
      this.#runs = [];
      this.#approvals.clear();
    } else {
      try {
        const [runs, projects] = await Promise.all([
          this.#manager.client().listRuns(),
          this.#manager.client().listProjects(),
        ]);
        this.#runs = runs;
        this.#projects = projects;
        this.#approvals.clear();
        for (const run of runs.filter((r) => r.status === 'waiting-approval')) {
          const list = await this.#manager.client().listApprovals(run.projectId, run.id).catch(() => []);
          this.#approvals.set(run.id, list);
        }
      } catch {
        // Keep last-known data on transient desktop failures.
      }
    }
    this.#onDidChangeTreeData.fire(undefined);
    this.#schedule();
  }

  #schedule(): void {
    if (this.#timer) clearTimeout(this.#timer);
    const active = this.#runs.some((r) => ACTIVE_STATUSES.has(r.status));
    this.#timer = setTimeout(() => void this.refresh(), active ? 10_000 : 30_000);
  }

  getTreeItem(node: RunsNode): vscode.TreeItem {
    switch (node.kind) {
      case 'run': {
        const label = `${node.projectName ?? node.run.projectId} · ${node.run.id.slice(0, 8)}`;
        const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.Collapsed);
        item.id = `run:${node.run.id}`;
        item.contextValue = runStatusContextValue(node.run.status);
        item.description = runDescription(node.run);
        item.tooltip = node.run.error ?? node.run.status;
        item.iconPath = new vscode.ThemeIcon(runStatusIcon(node.run.status));
        return item;
      }
      case 'approval': {
        const a = node.approval;
        const item = new vscode.TreeItem(
          `Approval: ${a.kind}${a.nodeId ? ` (${a.nodeId})` : ''}`,
          vscode.TreeItemCollapsibleState.None,
        );
        item.id = `approval:${a.id}`;
        item.contextValue = a.status === 'pending' ? 'approval-pending' : 'approval';
        item.description = a.status;
        item.tooltip = `payloadHash: ${a.payloadHash}`;
        item.iconPath = new vscode.ThemeIcon(a.status === 'pending' ? 'shield' : 'check');
        return item;
      }
      case 'artifact': {
        const item = new vscode.TreeItem(node.title, vscode.TreeItemCollapsibleState.None);
        item.id = `artifact:${node.runId}:${node.nodeId}`;
        item.contextValue = 'artifact';
        item.description = `${node.status}${node.attemptCount > 1 ? ` · ${node.attemptCount} attempts` : ''}`;
        item.iconPath = new vscode.ThemeIcon('file-text');
        item.command = {
          command: 'research-director.artifact.open',
          title: 'Open Artifact',
          arguments: [node],
        };
        return item;
      }
      case 'info': {
        const item = new vscode.TreeItem(node.label, vscode.TreeItemCollapsibleState.None);
        item.contextValue = 'info';
        return item;
      }
    }
  }

  async getChildren(node?: RunsNode): Promise<RunsNode[]> {
    if (!this.#paired) {
      return [{ kind: 'info', label: 'Not paired — run "Research Director: Pair with Desktop".' }];
    }
    if (!node) return buildRunNodes(this.#runs, this.#projects);
    if (node.kind === 'run') {
      return buildRunChildren(node.run, this.#approvals.get(node.run.id) ?? []);
    }
    return [];
  }

  dispose(): void {
    if (this.#timer) clearTimeout(this.#timer);
    this.#onDidChangeTreeData.dispose();
  }
}
