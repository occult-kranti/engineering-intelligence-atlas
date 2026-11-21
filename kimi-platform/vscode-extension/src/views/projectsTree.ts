/**
 * Office Projects tree: projects -> office rooms -> members.
 * Polls conservatively (every 30s) and refreshes on pairing changes and the
 * Refresh command. All model logic lives in model.ts (unit-tested).
 */

import * as vscode from 'vscode';
import type { BridgeManager } from '../bridge/manager.js';
import type { OfficeSnapshot, Project } from '../bridge/types.js';
import {
  buildProjectChildren,
  buildProjectNodes,
  buildRoomChildren,
  type ProjectsNode,
} from './model.js';

export class ProjectsTreeProvider implements vscode.TreeDataProvider<ProjectsNode>, vscode.Disposable {
  #manager: BridgeManager;
  #onDidChangeTreeData = new vscode.EventEmitter<ProjectsNode | undefined>();
  readonly onDidChangeTreeData = this.#onDidChangeTreeData.event;

  #projects: Project[] = [];
  #snapshots = new Map<string, OfficeSnapshot | null>();
  #paired = false;
  #timer: ReturnType<typeof setInterval> | null = null;

  constructor(manager: BridgeManager) {
    this.#manager = manager;
    manager.onDidChangePairing(() => void this.refresh());
    this.#timer = setInterval(() => void this.refresh(), 30_000);
  }

  async refresh(): Promise<void> {
    this.#paired = await this.#manager.isPaired();
    if (!this.#paired) {
      this.#projects = [];
      this.#snapshots.clear();
    } else {
      try {
        this.#projects = await this.#manager.client().listProjects();
        const snaps = await Promise.all(
          this.#projects
            .filter((p) => p.template === 'office')
            .map((p) => this.#manager.client().officeSnapshot(p.id).catch(() => null)),
        );
        this.#snapshots.clear();
        let i = 0;
        for (const p of this.#projects.filter((x) => x.template === 'office')) {
          this.#snapshots.set(p.id, snaps[i++] ?? null);
        }
      } catch {
        // Keep last-known data on transient desktop failures.
      }
    }
    this.#onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(node: ProjectsNode): vscode.TreeItem {
    switch (node.kind) {
      case 'project': {
        const item = new vscode.TreeItem(node.project.name, vscode.TreeItemCollapsibleState.Collapsed);
        item.id = `project:${node.project.id}`;
        item.contextValue = 'project';
        item.description = `${node.project.template ?? 'standard'} · ${node.project.provider}/${node.project.model}`;
        item.tooltip = node.project.goal;
        item.iconPath = new vscode.ThemeIcon(node.project.template === 'office' ? 'organization' : 'project');
        return item;
      }
      case 'room': {
        const item = new vscode.TreeItem(node.label, vscode.TreeItemCollapsibleState.Collapsed);
        item.id = `room:${node.projectId}:${node.roomId}`;
        item.contextValue = 'room';
        item.description = `${node.memberCount}`;
        item.iconPath = new vscode.ThemeIcon('group-by-ref-type');
        return item;
      }
      case 'member': {
        const item = new vscode.TreeItem(node.title, vscode.TreeItemCollapsibleState.None);
        item.id = `member:${node.projectId}:${node.nodeId}`;
        item.contextValue = 'member';
        item.description = `${node.role} · ${node.status}`;
        item.iconPath = new vscode.ThemeIcon('person');
        return item;
      }
      case 'info': {
        const item = new vscode.TreeItem(node.label, vscode.TreeItemCollapsibleState.None);
        item.contextValue = 'info';
        return item;
      }
    }
  }

  async getChildren(node?: ProjectsNode): Promise<ProjectsNode[]> {
    if (!this.#paired) {
      return [{ kind: 'info', label: 'Not paired — run "Research Director: Pair with Desktop".' }];
    }
    if (!node) return buildProjectNodes(this.#projects, this.#snapshots);
    if (node.kind === 'project') {
      return buildProjectChildren(node.project, this.#snapshots.get(node.project.id));
    }
    if (node.kind === 'room') {
      const snap = this.#snapshots.get(node.projectId);
      return snap ? buildRoomChildren(snap, node.roomId) : [{ kind: 'info', label: 'Snapshot unavailable.' }];
    }
    return [];
  }

  dispose(): void {
    if (this.#timer) clearInterval(this.#timer);
    this.#onDidChangeTreeData.dispose();
  }
}
