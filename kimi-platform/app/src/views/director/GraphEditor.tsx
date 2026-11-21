import { useCallback, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { trpc } from "@/lib/trpc-client";
import type { DagSpec, NodeSpec } from "@contracts/dag";
import {
  defaultNodeBudget,
  defaultTermination,
} from "@contracts/dag";
import { ARTIFACT_TYPES } from "@contracts/artifacts";
import type { ProviderId } from "@contracts/run";
import { GOAL_MODES, type GoalMode } from "@contracts/office";
import { ErrorNote } from "./DirectorShell";
import { buildRunStartInput } from "./workspace/adapter";
import { navigate } from "@/lib/utils";

/** Editable plan graph (spec §6). All edits produce a new revision on save;
 * approval freezes a revision hash and any edit invalidates it. */

type NodeData = Record<string, unknown> & { label: string; spec: NodeSpec };

function specToFlow(spec: DagSpec): { nodes: Node<NodeData>[]; edges: Edge[] } {
  return {
    nodes: spec.nodes.map((n, i) => ({
      id: n.key,
      position: n.position ?? { x: 80 + i * 240, y: 100 + (i % 2) * 140 },
      data: { label: `${n.key}\n${n.role}`, spec: n },
    })),
    edges: spec.edges.map((e, i) => ({
      id: `e${i}-${e.from}-${e.to}-${e.kind}`,
      source: e.from,
      target: e.to,
      label: e.kind,
    })),
  };
}

function flowToSpec(
  nodes: Node<NodeData>[],
  edges: Edge[],
  revision: number,
  budget: DagSpec["budget"],
): DagSpec {
  return {
    revision,
    nodes: nodes.map((n) => ({
      ...n.data.spec,
      position: { x: n.position.x, y: n.position.y },
    })),
    edges: edges.map((e) => ({
      from: e.source,
      to: e.target,
      kind: (e.label === "control" ? "control" : "artifact") as "artifact" | "control",
    })),
    budget,
  };
}

export default function GraphEditor({ projectId }: { projectId: number }) {
  const utils = trpc.useUtils();
  const projectQ = trpc.projects.get.useQuery({ id: projectId });
  const revisionsQ = trpc.dag.revisions.useQuery({ projectId });
  const rolesQ = trpc.registry.roles.useQuery({});
  const resourcesQ = trpc.registry.resources.useQuery({});
  const skillsQ = trpc.registry.skills.useQuery();
  const providersQ = trpc.ai.providers.useQuery();
  const modelsQ = trpc.ai.gatewayModels.useQuery(undefined, { retry: false });

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<NodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [budget, setBudget] = useState<DagSpec["budget"] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [provider, setProvider] = useState<ProviderId>("mock");
  const [confirmLive, setConfirmLive] = useState(false);
  const [goalMode, setGoalMode] = useState<GoalMode>("build");
  const autonomyQ = trpc.autonomy.status.useQuery({ projectId });
  /** Only a PROJECT-scoped active grant may preauthorize a new run. */
  const applicableGrant =
    autonomyQ.data?.activeGrant && autonomyQ.data.activeGrant.scope === "project"
      ? autonomyQ.data.activeGrant
      : null;

  const latest = revisionsQ.data?.[0];

  // Load the latest revision into the canvas once (adjust-during-render so
  // the server data lands without a post-render cascading effect).
  const [loadedRevisionId, setLoadedRevisionId] = useState<number | null>(null);
  if (latest && loadedRevisionId !== latest.id && nodes.length === 0) {
    setLoadedRevisionId(latest.id);
    const f = specToFlow(latest.spec);
    setNodes(f.nodes);
    setEdges(f.edges);
    setBudget(latest.spec.budget);
  }

  const validateM = trpc.dag.validate.useMutation();
  const saveM = trpc.dag.save.useMutation({
    onSuccess: (r) => {
      if (r.saved) {
        setNotice(`saved as revision ${r.revision} (approval reset — approve to freeze)`);
        void utils.dag.revisions.invalidate();
      }
    },
  });
  const approveM = trpc.dag.approve.useMutation({
    onSuccess: () => {
      setNotice("revision approved and frozen");
      void utils.dag.revisions.invalidate();
    },
  });
  const proposeM = trpc.dag.proposeSquad.useMutation({
    onSuccess: (res) => {
      const f = specToFlow(res.spec);
      setNodes(f.nodes);
      setEdges(f.edges);
      setBudget(res.spec.budget);
      setNotice(
        res.degradedFrom
          ? `provider "${res.degradedFrom}" unavailable (${res.degradedReason ?? ""}) — returned a deterministic mock proposal instead`
          : `proposal from ${res.provider} (${res.usedModel}) — edit, save, approve before any run`,
      );
    },
  });
  const startM = trpc.runs.start.useMutation({
    onSuccess: (run) => navigate(`#/director/projects/${projectId}/runs/${run.id}`),
  });

  const onConnect = useCallback(
    (c: Connection) => setEdges((eds) => addEdge({ ...c, label: "artifact" }, eds)),
    [setEdges],
  );

  const currentSpec = useMemo(() => {
    if (!budget) return null;
    return flowToSpec(nodes, edges, (latest?.revision ?? 0) + 1, budget);
  }, [nodes, edges, budget, latest]);

  const selNode = nodes.find((n) => n.id === selected);
  const vettedSkills = (skillsQ.data ?? []).filter((s) => s.status === "vetted");

  if (projectQ.error) return <ErrorNote message={projectQ.error.message} />;

  const patchNode = (key: string, patch: Partial<NodeSpec>) => {
    setNodes((ns) =>
      ns.map((n) =>
        n.id === key
          ? {
              ...n,
              data: {
                spec: { ...n.data.spec, ...patch },
                label: `${n.data.spec.key}\n${patch.role ?? n.data.spec.role}`,
              },
            }
          : n,
      ),
    );
  };

  const addNode = () => {
    const key = `node-${nodes.length + 1}`;
    const skill = vettedSkills[0];
    if (!skill) {
      setNotice("no vetted skill in the registry — vet one first");
      return;
    }
    const spec: NodeSpec = {
      key,
      role: rolesQ.data?.[0]?.name ?? "Research Scientist",
      skill: { name: skill.name, version: skill.version, sha256: skill.contentSha256 },
      goal: "Describe this node's task",
      inputArtifactTypes: [],
      outputArtifactType: "research-brief",
      toolsAllowed: ["read", "summarize"],
      resourceUrls: [],
      budget: defaultNodeBudget(),
      termination: defaultTermination(),
    };
    setNodes((ns) => [
      ...ns,
      {
        id: key,
        position: { x: 100, y: 100 },
        data: { label: `${spec.key}\n${spec.role}`, spec },
      },
    ]);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-extrabold tracking-tight">
          Plan editor — {projectQ.data?.name ?? `#${projectId}`}
        </h1>
        <span className="chip">
          rev {latest?.revision ?? "—"}
          {latest?.approvedAt ? " · approved" : " · not approved"}
        </span>
        {latest?.planHash ? (
          <span className="mono text-xs text-[hsl(var(--ink-soft))]">
            hash {latest.planHash.slice(0, 12)}…
          </span>
        ) : null}
      </div>

      {notice ? <p className="mt-2 text-sm text-[hsl(var(--ink-soft))]">{notice}</p> : null}
      {(saveM.error || approveM.error || proposeM.error || startM.error) && (
        <ErrorNote
          message={
            (saveM.error ?? approveM.error ?? proposeM.error ?? startM.error)!.message
          }
        />
      )}
      {saveM.data && !saveM.data.saved ? (
        <div className="mt-2 border border-[hsl(var(--mustard))] p-3 text-sm" role="alert">
          <p className="font-bold">Server-side validation rejected the plan:</p>
          <ul className="mt-1 list-disc pl-5">
            {saveM.data.violations.map((v, i) => (
              <li key={i}>
                <span className="mono">{v.rule}</span> @ {v.path}: {v.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="tab-control text-xs" onClick={addNode}>
          Add node
        </button>
        <button
          type="button"
          className="tab-control text-xs"
          onClick={() => {
            setNodes((ns) => ns.filter((n) => !n.selected));
            setEdges((es) => es.filter((e) => !e.selected));
          }}
        >
          Delete selected
        </button>
        <button
          type="button"
          className="tab-control text-xs"
          onClick={() => currentSpec && validateM.mutate({ projectId, spec: currentSpec })}
        >
          Validate (server)
        </button>
        <button
          type="button"
          className="tab-control text-xs"
          onClick={() => currentSpec && saveM.mutate({ projectId, spec: currentSpec })}
        >
          Save new revision
        </button>
        <button
          type="button"
          className="tab-control text-xs"
          disabled={!latest || !!latest.approvedAt}
          onClick={() => latest && approveM.mutate({ projectId, revisionId: latest.id })}
        >
          Approve & freeze
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        <span className="font-bold">Propose squad via</span>
        <select
          className="border border-[hsl(var(--line))] bg-transparent p-1"
          value={provider}
          onChange={(e) => setProvider(e.target.value as ProviderId)}
          aria-label="proposal provider"
        >
          {(providersQ.data ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.id}
              {p.configured ? "" : " (unconfigured → mock)"}
            </option>
          ))}
        </select>
        {provider === "gateway" && modelsQ.data ? (
          <span className="mono">{modelsQ.data.defaultModelId}</span>
        ) : null}
        <button
          type="button"
          className="tab-control"
          onClick={() => proposeM.mutate({ projectId, provider })}
          disabled={proposeM.isPending}
        >
          {proposeM.isPending ? "Proposing…" : "Propose squad"}
        </button>
        <span className="text-[hsl(var(--ink-soft))]">
          Plan-time hiring only; runtime self-expansion is not allowed.
        </span>
      </div>

      {validateM.data ? (
        <p className="mt-2 text-xs" role="status">
          {validateM.data.ok
            ? "Validation passed: acyclic, pinned, budgeted."
            : `${validateM.data.violations.length} violation(s): ${validateM.data.violations[0]?.message ?? ""}`}
        </p>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="border border-[hsl(var(--line))]" style={{ height: 420 }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onSelectionChange={(sel) => setSelected(sel.nodes[0]?.id ?? null)}
            fitView
          >
            <Background />
            <Controls />
          </ReactFlow>
        </div>

        <aside className="border border-[hsl(var(--line))] p-3 text-sm">
          {selNode ? (
            <NodeInspector
              node={selNode.data.spec}
              roles={(rolesQ.data ?? []).map((r) => r.name)}
              resources={(resourcesQ.data ?? []).map((r) => r.url)}
              skills={vettedSkills}
              onChange={(patch) => patchNode(selNode.id, patch)}
            />
          ) : budget ? (
            <div>
              <h2 className="font-bold">Run budget</h2>
              {(["maxTokens", "maxCalls", "maxMinutes", "maxCostUsd"] as const).map((k) => (
                <label key={k} className="mt-2 block text-xs font-bold">
                  {k}
                  <input
                    type="number"
                    min={1}
                    step="any"
                    value={budget[k]}
                    onChange={(e) => setBudget({ ...budget, [k]: Number(e.target.value) })}
                    className="mt-1 w-full border border-[hsl(var(--line))] bg-transparent p-1"
                  />
                </label>
              ))}
              <p className="mt-3 text-xs text-[hsl(var(--ink-soft))]">
                Select a node to edit its role, pinned skill, resources, and
                per-node budget/approval. Connect nodes by dragging handles;
                edges are artifact handoffs (delete to remove).
              </p>
            </div>
          ) : null}
        </aside>
      </div>

      <div className="mt-4 border border-[hsl(var(--line))] p-3 text-sm">
        <h2 className="font-bold">Start a run</h2>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <label className="flex items-center gap-1">
            Goal mode
            <select
              className="tab-control"
              value={goalMode}
              onChange={(e) => setGoalMode(e.target.value as GoalMode)}
            >
              {GOAL_MODES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={confirmLive}
              onChange={(e) => setConfirmLive(e.target.checked)}
            />
            I approve this live run start. Live model calls are billed to the
            site owner; mock runs are deterministic and free.
          </label>
          <button
            type="button"
            className="tab-control"
            disabled={!latest?.approvedAt}
            onClick={() =>
              latest &&
              startM.mutate(
                buildRunStartInput({
                  projectId,
                  dagRevisionId: latest.id,
                  mode: "mock",
                  provider: "mock",
                  goalMode,
                  activeGrant: applicableGrant,
                }),
              )
            }
          >
            Start mock run
          </button>
          <button
            type="button"
            className="tab-control"
            disabled={!latest?.approvedAt || !confirmLive}
            onClick={() =>
              latest &&
              startM.mutate(
                buildRunStartInput({
                  projectId,
                  dagRevisionId: latest.id,
                  mode: "live",
                  provider,
                  goalMode,
                  activeGrant: applicableGrant,
                  confirmLive: true,
                }),
              )
            }
          >
            Start live run
          </button>
          {!latest?.approvedAt ? (
            <span className="text-[hsl(var(--ink-soft))]">
              Approve the current revision before starting a run.
            </span>
          ) : null}
        </div>
        <div className="mt-2 text-xs text-[hsl(var(--ink-soft))]">
          {autonomyQ.data?.activeGrant ? (
            applicableGrant ? (
              <>
                Autonomy grant #{applicableGrant.id} ({applicableGrant.mode}
                {applicableGrant.allowLive ? ", live preauthorized" : ", mock runs only"})
                applies to this run — expires{" "}
                {new Date(applicableGrant.expiresAtMs).toLocaleString()}.
              </>
            ) : (
              <>
                An active run-scoped autonomy grant exists but is bound to a
                specific run — it does NOT apply to new runs started here.
              </>
            )
          ) : (
            "No active autonomy grant — every gated node will ask for approval."
          )}
        </div>
      </div>
    </div>
  );
}

function NodeInspector({
  node,
  roles,
  resources,
  skills,
  onChange,
}: {
  node: NodeSpec;
  roles: string[];
  resources: string[];
  skills: {
    name: string;
    version: string;
    contentSha256: string;
    status: string;
  }[];
  onChange: (patch: Partial<NodeSpec>) => void;
}) {
  const inputCls = "mt-1 w-full border border-[hsl(var(--line))] bg-transparent p-1";
  return (
    <div>
      <h2 className="font-bold">Node {node.key}</h2>
      <label className="mt-2 block text-xs font-bold">
        Goal
        <textarea
          rows={3}
          value={node.goal}
          onChange={(e) => onChange({ goal: e.target.value })}
          className={inputCls}
        />
      </label>
      <label className="mt-2 block text-xs font-bold">
        Role
        <select
          value={node.role}
          onChange={(e) => onChange({ role: e.target.value })}
          className={inputCls}
        >
          {[node.role, ...roles.filter((r) => r !== node.role)].map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </label>
      <label className="mt-2 block text-xs font-bold">
        Pinned skill
        <select
          value={`${node.skill.name}@${node.skill.version}`}
          onChange={(e) => {
            const s = skills.find(
              (x) => `${x.name}@${x.version}` === e.target.value,
            );
            if (s) {
              onChange({
                skill: { name: s.name, version: s.version, sha256: s.contentSha256 },
              });
            }
          }}
          className={inputCls}
        >
          {skills.map((s) => (
            <option key={`${s.name}@${s.version}`} value={`${s.name}@${s.version}`}>
              {s.name}@{s.version} ({s.contentSha256.slice(0, 8)})
            </option>
          ))}
        </select>
      </label>
      <label className="mt-2 block text-xs font-bold">
        Output artifact type
        <select
          value={node.outputArtifactType}
          onChange={(e) => onChange({ outputArtifactType: e.target.value })}
          className={inputCls}
        >
          {ARTIFACT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="mt-2 text-xs">
        <legend className="font-bold">Input artifact types</legend>
        {ARTIFACT_TYPES.map((t) => (
          <label key={t} className="mr-2 inline-flex items-center gap-1">
            <input
              type="checkbox"
              checked={node.inputArtifactTypes.includes(t)}
              onChange={(e) =>
                onChange({
                  inputArtifactTypes: e.target.checked
                    ? [...node.inputArtifactTypes, t]
                    : node.inputArtifactTypes.filter((x) => x !== t),
                })
              }
            />
            {t}
          </label>
        ))}
      </fieldset>
      <label className="mt-2 block text-xs font-bold">
        Add curated resource
        <select
          value=""
          onChange={(e) => {
            if (e.target.value && !node.resourceUrls.includes(e.target.value)) {
              onChange({ resourceUrls: [...node.resourceUrls, e.target.value] });
            }
          }}
          className={inputCls}
        >
          <option value="">choose…</option>
          {resources.slice(0, 300).map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </label>
      {node.resourceUrls.length ? (
        <ul className="mt-1 text-xs">
          {node.resourceUrls.map((u) => (
            <li key={u} className="flex items-center justify-between gap-1">
              <span className="truncate">{u}</span>
              <button
                type="button"
                className="text-[hsl(var(--rust))]"
                onClick={() =>
                  onChange({ resourceUrls: node.resourceUrls.filter((x) => x !== u) })
                }
              >
                remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-2 grid grid-cols-2 gap-2">
        {(["maxTokens", "maxCalls", "maxMinutes", "maxCostUsd"] as const).map((k) => (
          <label key={k} className="text-xs font-bold">
            {k}
            <input
              type="number"
              min={k.startsWith("maxM") || k === "maxCostUsd" ? 0.000001 : 1}
              step="any"
              value={node.budget[k]}
              onChange={(e) =>
                onChange({ budget: { ...node.budget, [k]: Number(e.target.value) } })
              }
              className={inputCls}
            />
          </label>
        ))}
      </div>
      <label className="mt-2 block text-xs font-bold">
        Approval gate
        <select
          value={node.approvalBefore ?? "none"}
          onChange={(e) =>
            onChange({
              approvalBefore:
                e.target.value === "none"
                  ? undefined
                  : (e.target.value as "start" | "accept"),
            })
          }
          className={inputCls}
        >
          <option value="none">none</option>
          <option value="start">before start</option>
          <option value="accept">before artifact acceptance</option>
        </select>
      </label>
    </div>
  );
}
