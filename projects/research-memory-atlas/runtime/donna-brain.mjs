// desktop-shell/src/shared/graphMemory.ts
var GRAPH_VERSION = "daftar-graph-memory-2";
var GRAPH_LIMITS = Object.freeze({ nodes: 12e3, edges: 6e4, sources: 8e3, results: 12, bytes: 12288, iterations: 160 });
var encoder = new TextEncoder();
var ID = /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,159}$/;
var SOURCE_ID = /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,299}$/;
var SCOPE = /^[a-z][a-z0-9-]{0,79}$/;
var STOP = new Set("a an the of for and or to in on with how what why is are does do this that our from using use can as at by be been it into their these which".split(" "));
var ROUTABLE = /* @__PURE__ */ new Set(["requires", "prerequisite_of", "derived_from", "related", "related_to", "implements", "applies_to", "uses", "supports", "specializes", "generalizes", "member_of", "part_of", "connects", "analogy", "contradicts", "tests", "explains"]);
var compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
var object = (v) => !!v && typeof v === "object" && !Array.isArray(v);
var string = (v, limit = 5e4) => typeof v === "string" && v.length <= limit;
var scope = (n) => n.scope ?? "public";
var key = (n) => scope(n) + "/" + n.id;
var finite = (n) => typeof n === "number" && Number.isFinite(n);
function validTime(v) {
  return v === null || v === void 0 || typeof v === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 19) === v.slice(0, 19);
}
function active(v, at) {
  return (!v.valid_from || Date.parse(v.valid_from) <= at) && (!v.valid_until || at < Date.parse(v.valid_until));
}
function safeUrl(value) {
  if (!string(value, 3e3)) return false;
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !u.username && !u.password;
  } catch {
    return false;
  }
}
function validateGraph(value) {
  if (!object(value) || value.schemaVersion !== 1 || !string(value.revision, 200) || !Array.isArray(value.nodes) || value.nodes.length > GRAPH_LIMITS.nodes || !Array.isArray(value.edges) || value.edges.length > GRAPH_LIMITS.edges || !Array.isArray(value.sources) || value.sources.length > GRAPH_LIMITS.sources) throw new Error("Invalid or oversized graph");
  const sources = /* @__PURE__ */ new Set();
  for (const s of value.sources) {
    if (!object(s) || !string(s.id, 300) || !SOURCE_ID.test(s.id) || sources.has(s.id) || !string(s.title, 2e3) || !safeUrl(s.url) || s.access_depth !== void 0 && !string(s.access_depth, 300)) throw new Error("Invalid or duplicate source");
    sources.add(s.id);
  }
  const ids = /* @__PURE__ */ new Set();
  const refs = (v) => Array.isArray(v) && v.length <= 80 && v.every((x) => typeof x === "string" && sources.has(x));
  const interval = (v) => validTime(v.valid_from) && validTime(v.valid_until) && (!v.valid_from || !v.valid_until || Date.parse(String(v.valid_from)) < Date.parse(String(v.valid_until)));
  for (const n of value.nodes) {
    if (!object(n) || !string(n.id, 160) || !ID.test(n.id) || !string(n.label, 1e3) || !string(n.summary) || !string(n.type, 80) || !string(n.domain, 80) || n.status !== void 0 && !string(n.status, 160) || n.classification !== void 0 && !["public", "internal", "private"].includes(String(n.classification)) || n.taxonomy_path !== void 0 && (!Array.isArray(n.taxonomy_path) || n.taxonomy_path.length > 12 || n.taxonomy_path.some((p) => !string(p, 500))) || n.scope !== void 0 && (typeof n.scope !== "string" || !SCOPE.test(n.scope)) || !refs(n.source_ids) || !interval(n)) throw new Error("Invalid graph node");
    const k = key(n);
    if (ids.has(k)) throw new Error("Duplicate node within scope");
    if ((n.scope ?? "public") === "public" && n.classification !== void 0 && n.classification !== "public") throw new Error("Private classification in public scope");
    ids.add(k);
  }
  for (const e of value.edges) {
    if (!object(e) || !string(e.source, 160) || !string(e.target, 160) || !string(e.type, 80) || e.scope !== void 0 && (typeof e.scope !== "string" || !SCOPE.test(e.scope)) || e.weight !== void 0 && (!finite(e.weight) || e.weight < 0 || e.weight > 100) || e.source_ids !== void 0 && !refs(e.source_ids) || !interval(e) || !ids.has((e.scope ?? "public") + "/" + e.source) || !ids.has((e.scope ?? "public") + "/" + e.target)) throw new Error("Invalid edge or unresolved endpoint");
  }
}
function tokenize(text2) {
  return (text2.normalize("NFKC").toLocaleLowerCase("en-US").match(/[\p{L}\p{N}][\p{L}\p{N}_+-]*/gu) ?? []).filter((t) => t.length <= 80 && !STOP.has(t));
}
function request(q, grant) {
  if (!object(q) || !string(q.query, 4e3) || !object(grant) || !Array.isArray(grant.allowedScopes) || !grant.allowedScopes.every((s) => typeof s === "string" && SCOPE.test(s)) || !string(grant.policyVersion, 200)) throw new Error("Invalid query or scope grant");
  if (q.scopes !== void 0 && (!Array.isArray(q.scopes) || q.scopes.some((s) => typeof s !== "string"))) throw new Error("Invalid query scopes");
  const scopes = [...new Set(q.scopes ?? ["public"])].sort(compare);
  if (!scopes.length || scopes.length > 16 || scopes.some((s) => !SCOPE.test(s) || !grant.allowedScopes.includes(s))) throw new Error("Scope is not authorized by caller");
  const maxResults = q.maxResults ?? 6, maxBytes = q.maxBytes ?? 8192, alpha = q.alpha ?? 0.85, seedLimit = q.seedLimit ?? 8;
  if (!Number.isInteger(maxResults) || maxResults < 0 || maxResults > GRAPH_LIMITS.results || !Number.isInteger(maxBytes) || maxBytes < 1024 || maxBytes > GRAPH_LIMITS.bytes || !finite(alpha) || alpha < 0 || alpha >= 1 || !Number.isInteger(seedLimit) || seedLimit < 1 || seedLimit > 32 || q.relations !== void 0 && (!Array.isArray(q.relations) || q.relations.length > 32 || q.relations.some((r) => !ROUTABLE.has(r)))) throw new Error("Invalid retrieval bounds");
  const asOf = q.asOf ?? (/* @__PURE__ */ new Date()).toISOString();
  if (!validTime(asOf)) throw new Error("asOf requires an explicit UTC instant");
  return { scopes, asOf, at: Date.parse(asOf), maxResults, maxBytes, alpha, seedLimit };
}
function eligibleGraph(graph, q, grant) {
  const options = request(q, grant), allowed = new Set(options.scopes);
  const nodes = graph.nodes.filter((n) => allowed.has(scope(n)) && active(n, options.at) && !["retracted", "deleted", "quarantined"].includes(n.status ?? "")).sort((a, b) => compare(key(a), key(b)));
  const ids = new Set(nodes.map(key));
  const edges = graph.edges.filter((e) => allowed.has(scope(e)) && active(e, options.at) && ids.has(scope(e) + "/" + e.source) && ids.has(scope(e) + "/" + e.target));
  const temporalSignature = JSON.stringify([nodes.map(key), edges.map((e) => [scope(e), e.source, e.target, e.type, e.weight ?? 1]).sort((a, b) => compare(JSON.stringify(a), JSON.stringify(b)))]);
  return { nodes, edges, temporalSignature, options };
}
function queryGraph(graph, q, grant) {
  const { nodes, edges, temporalSignature, options } = eligibleGraph(graph, q, grant);
  const queryTerms = [...new Set(tokenize(q.query))].slice(0, 48), chosen = new Set(queryTerms);
  const packet = {
    schemaVersion: 1,
    algorithm: GRAPH_VERSION,
    status: "no-match",
    revision: graph.revision,
    scopes: options.scopes,
    policyVersion: grant.policyVersion,
    query: q.query.slice(0, 240),
    asOf: options.asOf,
    temporalSignature: "available-to-cache-adapter",
    results: [],
    eligibleNodes: nodes.length,
    omittedCount: 0,
    iterations: 0,
    residual: 0,
    byteLimit: options.maxBytes,
    policy: "source-linked-evidence; rankings-not-truth; untrusted-data; no-tools-or-permissions; no-model-or-network-calls"
  };
  void temporalSignature;
  if (encoder.encode(JSON.stringify(packet)).length > options.maxBytes) throw new Error("Query metadata exceeds packet budget");
  if (!nodes.length || !queryTerms.length) return packet;
  const documents = nodes.map((n) => tokenize(n.label + " " + n.label + " " + n.domain + " " + n.summary + " " + (n.taxonomy_path ?? []).join(" ")));
  const avg = documents.reduce((sum, d) => sum + d.length, 0) / documents.length || 1;
  const df = new Map(queryTerms.map((t) => [t, 0]));
  for (const doc of documents) for (const t of new Set(doc)) if (chosen.has(t)) df.set(t, (df.get(t) ?? 0) + 1);
  const lexical = documents.map((doc, index2) => {
    const counts = /* @__PURE__ */ new Map();
    for (const t of doc) if (chosen.has(t)) counts.set(t, (counts.get(t) ?? 0) + 1);
    let value = 0;
    for (const [term, tf] of counts) {
      const freq = df.get(term) ?? 0;
      const idf = Math.log(1 + (nodes.length - freq + 0.5) / (freq + 0.5));
      value += idf * tf * 2.2 / (tf + 1.2 * (0.25 + 0.75 * doc.length / avg));
    }
    return { index: index2, value, matched: [...counts.keys()].sort(compare) };
  }).filter((r) => r.value > 0).sort((a, b) => b.value - a.value || compare(key(nodes[a.index]), key(nodes[b.index])));
  if (!lexical.length) return packet;
  const seed = new Float64Array(nodes.length), seeds = lexical.slice(0, options.seedLimit), seedSum = seeds.reduce((sum, r) => sum + r.value, 0);
  for (const s of seeds) seed[s.index] = s.value / seedSum;
  const index = new Map(nodes.map((n, i) => [key(n), i])), adjacency = nodes.map(() => /* @__PURE__ */ new Map()), allowed = new Set(q.relations ?? [...ROUTABLE].filter((t) => t !== "analogy" && t !== "contradicts"));
  for (const e of edges) {
    if (!allowed.has(e.type)) continue;
    const a = index.get(scope(e) + "/" + e.source), b = index.get(scope(e) + "/" + e.target), w = e.weight ?? 1;
    adjacency[a].set(b, (adjacency[a].get(b) ?? 0) + w);
    adjacency[b].set(a, (adjacency[b].get(a) ?? 0) + w * 0.5);
  }
  const degree = adjacency.map((row) => [...row.values()].reduce((a, b) => a + b, 0));
  let rank = Float64Array.from(seed);
  for (let iteration = 0; iteration < GRAPH_LIMITS.iterations; iteration++) {
    const next = Float64Array.from(seed, (x) => (1 - options.alpha) * x);
    let dangling = 0;
    for (let a = 0; a < nodes.length; a++) {
      if (degree[a] === 0) {
        dangling += rank[a];
        continue;
      }
      for (const [b, w] of adjacency[a]) next[b] = next[b] + options.alpha * rank[a] * w / degree[a];
    }
    for (let a = 0; a < nodes.length; a++) next[a] = next[a] + options.alpha * dangling * seed[a];
    packet.residual = next.reduce((sum, v, i) => sum + Math.abs(v - rank[i]), 0);
    rank = next;
    packet.iterations = iteration + 1;
    if (packet.residual < 1e-10) break;
  }
  const graphRanks = [...rank].map((value, index2) => ({ value, index: index2 })).filter((r) => r.value > 1e-14).sort((a, b) => b.value - a.value || compare(key(nodes[a.index]), key(nodes[b.index])));
  const lr = new Map(lexical.map((r, i) => [r.index, i + 1])), gr = new Map(graphRanks.map((r, i) => [r.index, i + 1])), matches = new Map(lexical.map((r) => [r.index, r.matched]));
  const candidates = [.../* @__PURE__ */ new Set([...lr.keys(), ...gr.keys()])].map((index2) => ({ index: index2, score: (lr.has(index2) ? 1 / (60 + lr.get(index2)) : 0) + (gr.has(index2) ? 0.7 / (60 + gr.get(index2)) : 0) })).sort((a, b) => b.score - a.score || compare(key(nodes[a.index]), key(nodes[b.index])));
  const sourceMap = new Map(graph.sources.map((s) => [s.id, s]));
  const size = () => encoder.encode(JSON.stringify(packet)).length;
  packet.omittedCount = candidates.length;
  for (const candidate of candidates) {
    if (packet.results.length >= options.maxResults) break;
    const n = nodes[candidate.index];
    const result = { id: n.id, scope: scope(n), label: n.label, type: n.type, domain: n.domain, summary: n.summary.slice(0, 1e3), status: n.status ?? "not-specified", score: Number(candidate.score.toPrecision(8)), lexicalRank: lr.get(candidate.index) ?? null, graphRank: gr.get(candidate.index) ?? null, matchedTerms: matches.get(candidate.index) ?? [], sources: n.source_ids.slice(0, 4).map((id) => {
      const s = sourceMap.get(id);
      return { id, title: s.title.slice(0, 220), url: s.url, accessDepth: s.access_depth ?? "not-specified" };
    }), connections: edges.filter((e) => scope(e) === scope(n) && (e.source === n.id || e.target === n.id)).slice(0, 6).map((e) => ({ id: e.source === n.id ? e.target : e.source, relation: e.type, direction: e.source === n.id ? "outgoing" : "incoming" })) };
    packet.results.push(result);
    packet.omittedCount--;
    if (size() > options.maxBytes) {
      packet.results.pop();
      packet.omittedCount++;
    }
  }
  packet.status = packet.results.length ? "ready" : "bounded-empty";
  while (size() > options.maxBytes && packet.results.length) {
    packet.results.pop();
    packet.omittedCount++;
    packet.status = packet.results.length ? "ready" : "bounded-empty";
  }
  while (size() > options.maxBytes && packet.query.length) {
    packet.query = Array.from(packet.query).slice(0, Math.floor(Array.from(packet.query).length / 2)).join("");
  }
  if (size() > options.maxBytes) throw new Error("Final retrieval metadata exceeds packet budget");
  return packet;
}

// desktop-shell/src/shared/donnaBrain.ts
var BRAIN_VERSION = "donna-brain-1";
var types = /* @__PURE__ */ new Set(["fact", "decision", "question", "procedure"]);
var idPattern = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,119}$/;
var enc = new TextEncoder();
var order = (a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
var text = (v, max = 2e3) => String(v ?? "").replace(/(^|[^A-Za-z0-9_-])(?:sk-|gh[pousr]_|github_pat_)[A-Za-z0-9_-]{8,}/g, "$1[redacted]").slice(0, max);
function instant(value) {
  if (typeof value !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!m) return null;
  const year = Number(m[1]), month = Number(m[2]), day = Number(m[3]), days = [31, year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month < 1 || month > 12 || day < 1 || day > days[month - 1]) return null;
  const n = Date.parse(value);
  return Number.isFinite(n) ? new Date(n).toISOString() : null;
}
function fingerprint(value) {
  let a = 2166136261, b = 2654435769;
  for (let i = 0; i < value.length; i++) {
    a = Math.imul(a ^ value.charCodeAt(i), 16777619);
    b = Math.imul(b ^ value.charCodeAt(i), 2246822519);
  }
  return (a >>> 0).toString(16).padStart(8, "0") + (b >>> 0).toString(16).padStart(8, "0");
}
function ordinary(record) {
  return !/^daftar-kit:/i.test(record.artifactUri ?? "") && !record.title.startsWith("Company kit identity:") && !/"kind"\s*:\s*"daftar-company-kit-binding"/.test(record.summary);
}
function makeBrainNote(input) {
  if (!input || !types.has(input.type) || typeof input.body !== "string" || !input.body.trim() || input.body.length > 3e3) throw new Error("Write a note of 1\u20133000 characters and choose its kind.");
  if (input.tags !== void 0 && (!Array.isArray(input.tags) || input.tags.length > 12 || input.tags.some((t) => typeof t !== "string" || !t.trim() || t.length > 60))) throw new Error("Use at most twelve short tags.");
  if (input.supersedes !== void 0 && input.supersedes !== null && (typeof input.supersedes !== "string" || !idPattern.test(input.supersedes))) throw new Error("Choose a valid existing note to correct.");
  if (input.expiresAt !== void 0 && input.expiresAt !== null && !instant(input.expiresAt)) throw new Error("Use an ISO timestamp for note expiry.");
  const note = { kind: "daftar-brain-note", version: 1, type: input.type, body: input.body.trim(), tags: [...new Set((input.tags ?? []).map((t) => t.trim()))].sort(), supersedes: input.supersedes ?? null, expiresAt: instant(input.expiresAt) };
  const result = JSON.stringify(note);
  if (enc.encode(result).length > 3900) throw new Error("This note exceeds the saved knowledge byte limit; shorten it.");
  return result;
}
function readBrainNote(summary) {
  try {
    const v = JSON.parse(summary);
    if (v?.kind !== "daftar-brain-note" || v.version !== 1) return null;
    return JSON.parse(makeBrainNote(v));
  } catch {
    return null;
  }
}
function recognizedEnvelope(summary) {
  try {
    const parsed = JSON.parse(summary);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && parsed.kind === "daftar-brain-note") return true;
  } catch {
  }
  return /^\s*\{/.test(summary) && /"kind"\s*:\s*"daftar-brain-note"/.test(summary);
}
function filterBrainKnowledge(knowledge, companyId, asOf = (/* @__PURE__ */ new Date()).toISOString()) {
  const at = instant(asOf);
  if (!at) throw new Error("Invalid memory clock");
  const scoped = knowledge.filter((k) => k.companyId === companyId);
  const identified = scoped.filter((k) => typeof k.id === "string" && idPattern.test(k.id)), records = new Map(identified.map((k) => [k.id, k]));
  if (records.size !== identified.length) throw new Error("Ambiguous company knowledge identity");
  const retired = /* @__PURE__ */ new Set();
  for (const k of scoped) {
    const n = readBrainNote(k.summary), created = instant(k.createdAt);
    if (!n?.supersedes || !created || created > at || n.expiresAt && n.expiresAt <= created) continue;
    const old = records.get(n.supersedes), oldCreated = old && instant(old.createdAt);
    if (old && old.id !== k.id && oldCreated && created > oldCreated) retired.add(old.id);
  }
  return scoped.filter((k) => {
    const n = readBrainNote(k.summary), created = instant(k.createdAt);
    if (recognizedEnvelope(k.summary) && (!n || !records.has(k.id))) return false;
    return !retired.has(k.id) && (!created || created <= at) && (!n || (!n.expiresAt || at < n.expiresAt) && (!created || !n.expiresAt || created < n.expiresAt));
  });
}
function unique(values) {
  const seen = /* @__PURE__ */ new Set();
  for (const v of values) {
    if (!idPattern.test(v.id) || seen.has(v.id)) throw new Error("Ambiguous or invalid company record identity");
    seen.add(v.id);
  }
  return [...values].sort(order);
}
function buildDonnaBrain(snapshot, companyId) {
  const candidates = (snapshot.companies ?? []).filter((c) => c.id === companyId);
  if (candidates.length !== 1 || !idPattern.test(companyId)) throw new Error("Choose one available company.");
  const company = candidates[0], nodes = [], edges = [], sources = [];
  const index = /* @__PURE__ */ new Map();
  let omitted = 0;
  const cap = (values, max) => {
    omitted += Math.max(0, values.length - max);
    return values.slice(-max);
  };
  const offices = cap(unique((snapshot.offices ?? []).filter((x) => x.companyId === companyId)), 200);
  const departments = cap(unique((snapshot.departments ?? []).filter((x) => x.companyId === companyId)), 500);
  const employees = cap(unique((snapshot.employees ?? []).filter((x) => x.companyId === companyId)), 1e3);
  const knowledge = cap(unique((snapshot.knowledge ?? []).filter((x) => x.companyId === companyId && ordinary(x))), 5e3);
  const goals = cap(unique((snapshot.goals ?? []).filter((x) => x.companyId === companyId)), 500);
  const jobs = cap(unique((snapshot.jobs ?? []).filter((x) => x.companyId === companyId)), 500);
  function add(kind, id, label, summary, status, updatedAt, extra = {}) {
    const n = { id: kind + ":" + id, label: text(label, 500), summary: text(summary), type: kind, domain: "company-operations", scope: "company", classification: "private", status: text(status, 100), source_ids: [], recordRef: kind + ":" + id, companyId, updatedAt: instant(updatedAt), ...extra };
    if (index.has(n.id)) throw new Error("Duplicate brain node");
    nodes.push(n);
    index.set(n.id, n);
    return n;
  }
  function link(source, target, type, label) {
    if (index.has(source) && index.has(target)) edges.push({ source, target, type, label, scope: "company", source_ids: [] });
  }
  const root = add("company", company.id, company.name, "Company operating memory. " + (company.repoUrl ? "Repository configured." : "Repository not yet linked."), company.status, company.createdAt);
  if (company.repoUrl) {
    try {
      const u = new URL(company.repoUrl);
      if (u.protocol === "https:" && !u.username && !u.password && !u.search) {
        const repo = add("repository", company.id, company.repoUrl, "Repository connection metadata. Source files have not been opened by this projection.", company.githubStatus, company.importedAt ?? company.createdAt);
        sources.push({ id: "repository-source", title: company.repoUrl, url: u.href, access_depth: "connection-metadata; repository-files-not-read" });
        repo.source_ids = ["repository-source"];
        link(repo.id, root.id, "part_of", "Repository belongs to this company");
      }
    } catch {
    }
  }
  for (const o of offices) add("office", o.id, o.name, "Office definition; saved assistants are not running processes.", o.status, o.createdAt);
  for (const d of departments) add("department", d.id, d.name, "Department definition in the current company.", d.status, d.createdAt);
  for (const e of employees) {
    const paths = e.skillPaths ?? [];
    const n = add("employee", e.id, e.name, e.role + "; " + e.kind + " definition. Skills: " + paths.join(", "), e.status, e.updatedAt);
    for (const skill of [...new Set(paths)].slice(0, 16)) {
      const id = "skill:" + fingerprint(skill);
      if (!index.has(id)) add("skill", fingerprint(skill), skill.split("/").filter(Boolean).at(-2) ?? skill, "Assigned skill reference: " + text(skill, 500) + ". The projection does not execute skill instructions.", "assigned-reference", void 0, { skillPath: skill });
      link(n.id, id, "uses", "Employee is assigned this skill reference");
    }
  }
  for (const o of offices) link("office:" + o.id, root.id, "part_of", "Office in company");
  for (const d of departments) {
    link("department:" + d.id, "office:" + d.officeId, "part_of", "Department in office");
    if (d.parentDepartmentId) link("department:" + d.id, "department:" + d.parentDepartmentId, "part_of", "Nested department");
  }
  for (const e of employees) link("employee:" + e.id, e.departmentId ? "department:" + e.departmentId : e.officeId ? "office:" + e.officeId : root.id, "part_of", "Saved assignment");
  const noteRecords = new Map(knowledge.map((k) => [k.id, k]));
  let questions = 0, corrections = 0;
  for (const k of knowledge) {
    const note = readBrainNote(k.summary), created = instant(k.createdAt);
    const n = add("knowledge", k.id, k.title, note ? note.body + "\nTags: " + note.tags.join(", ") : k.summary, note?.type === "question" ? "open-question" : note ? "recorded-" + note.type : "recorded-knowledge", k.createdAt, { noteType: note?.type ?? "knowledge", tags: note?.tags ?? [], artifactRef: text(k.artifactUri, 500), ...created ? { valid_from: created } : {}, ...note?.expiresAt && (!created || note.expiresAt > created) ? { valid_until: note.expiresAt } : {} });
    if (recognizedEnvelope(k.summary) && !note) {
      n.status = "quarantined";
      n.summary = "Saved brain note has invalid or unsupported metadata. Inspect the original native record before using it as evidence.";
    }
    if (note?.expiresAt && created && note.expiresAt <= created) {
      n.status = "retracted";
      n.expiredAt = note.expiresAt;
    }
    if (note?.type === "question") questions++;
    link(n.id, root.id, "part_of", "Recorded company knowledge");
  }
  for (const k of knowledge) {
    const note = readBrainNote(k.summary);
    if (!note?.supersedes) continue;
    const old = noteRecords.get(note.supersedes), stamp = instant(k.createdAt), oldStamp = old && instant(old.createdAt);
    if (!old || old.id === k.id || !stamp || !oldStamp || stamp <= oldStamp || note.expiresAt && note.expiresAt <= stamp) continue;
    const prior = index.get("knowledge:" + old.id);
    if (!prior.valid_until || stamp < prior.valid_until) prior.valid_until = stamp;
    prior.supersededBy = k.id;
    corrections++;
    link("knowledge:" + k.id, prior.id, "supersedes", "Correction preserves the earlier record in history");
  }
  for (const g of goals) add("goal", g.id, g.title, g.description, g.status, g.updatedAt, { goalMode: g.mode });
  for (const j of jobs) add("job", j.id, j.goal.slice(0, 160), (j.summary ?? j.error ?? "No result summary recorded.") + "\nExecution: " + j.status, j.status, j.updatedAt, { artifactRef: text(j.artifactUri, 500) });
  for (const g of goals) {
    link("goal:" + g.id, root.id, "part_of", "Company goal");
    for (const id of g.jobIds) link("job:" + id, "goal:" + g.id, "part_of", "Job belongs to goal");
  }
  for (const j of jobs) {
    link("job:" + j.id, "employee:" + j.employeeId, "related", "Recorded assigned worker");
    for (const id of j.dependencies) link("job:" + id, "job:" + j.id, "prerequisite_of", "Native job dependency");
  }
  const roadmap = cap(unique((snapshot.portfolio?.roadmap ?? []).filter((x) => x.scope.kind === "company" && x.scope.id === companyId)), 500);
  for (const r of roadmap) add("roadmap", r.id, r.title, r.description + "\nEvidence: " + text(r.evidence, 500), r.status, r.updatedAt);
  for (const r of roadmap) {
    link("roadmap:" + r.id, root.id, "part_of", "Company roadmap");
    for (const id of r.goalIds) link("goal:" + id, "roadmap:" + r.id, "part_of", "Goal supports roadmap item");
    for (const id of r.dependencies) link("roadmap:" + id, "roadmap:" + r.id, "prerequisite_of", "Roadmap dependency");
  }
  if (nodes.length > 11e3) throw new Error("Company brain exceeds its bounded projection; narrow the workspace before indexing.");
  nodes.sort(order);
  edges.sort((a, b) => (a.source + a.type + a.target).localeCompare(b.source + b.type + b.target));
  const graph = { schemaVersion: 1, revision: BRAIN_VERSION + "-" + fingerprint(JSON.stringify([companyId, nodes, edges, sources])), nodes, edges, sources };
  validateGraph(graph);
  const gaps = [];
  if (!index.has("repository:" + companyId)) gaps.push({ id: "repository", title: "Connect a repository", detail: "No usable HTTPS repository connection is saved.", action: "Review the company repository connection." });
  if (!offices.length) gaps.push({ id: "office", title: "Organize the company workspace", detail: "No office is defined for this company.", action: "Create a company office using existing native commands." });
  if (!employees.some((e) => e.id === company.assistantId && e.status === "active")) gaps.push({ id: "assistant", title: "Resolve the company assistant", detail: "The saved company assistant is missing or inactive.", action: "Reuse or configure the company assistant; preserve existing identities." });
  if (!employees.some((e) => (e.skillPaths ?? []).length)) gaps.push({ id: "skills", title: "Assign relevant skills", detail: "No company employee has a saved skill reference.", action: "Match the existing role and skill library to this company\u2019s goals." });
  if (!knowledge.length) gaps.push({ id: "knowledge", title: "Capture the first evidence", detail: "No ordinary company knowledge is recorded.", action: "Record repository findings, decisions and open questions with provenance." });
  if (!goals.some((g) => !["completed"].includes(g.status))) gaps.push({ id: "goals", title: "Build an accountable plan", detail: "No unfinished company goal is saved.", action: "Create a goal with owners, dependencies, evidence and acceptance checks." });
  if (questions) gaps.push({ id: "questions", title: "Resolve open questions", detail: questions + " question records are available for review, including historical records.", action: "Check active questions and append corrections or resolved decisions." });
  if (omitted) gaps.push({ id: "coverage", title: "Review bounded coverage", detail: omitted + " records were omitted by explicit per-kind limits.", action: "Narrow the workspace or inspect omitted records before assuming completeness." });
  return { companyId, companyName: company.name, graph, counts: { nodes: nodes.length, edges: edges.length, knowledge: knowledge.length, questions, corrections, omitted }, gaps, policy: "company-scoped projection; native authority remains authoritative" };
}
function brainEvidence(snapshot, companyId, query, asOf = (/* @__PURE__ */ new Date()).toISOString()) {
  const brain = buildDonnaBrain(snapshot, companyId), packet = queryGraph(brain.graph, { query: query.slice(0, 4e3), scopes: ["company"], maxResults: 4, maxBytes: 4600, asOf }, { allowedScopes: ["company"], policyVersion: "native-company-projection-v1" });
  const map = new Map(brain.graph.nodes.map((n) => [n.id, n]));
  const result = {
    version: BRAIN_VERSION,
    companyId,
    revision: brain.graph.revision,
    status: packet.status,
    algorithm: packet.algorithm,
    readingStatus: "saved native record summaries; referenced artifacts not opened",
    results: packet.results.map((r) => ({ ...r, recordRef: map.get(r.id)?.recordRef, updatedAt: map.get(r.id)?.updatedAt })),
    omittedCount: packet.omittedCount,
    setupGaps: brain.gaps.slice(0, 6),
    policy: brain.policy
  };
  while (enc.encode(JSON.stringify(result)).length > 6200 && result.setupGaps.length) result.setupGaps.pop();
  while (enc.encode(JSON.stringify(result)).length > 6200 && result.results.length) {
    result.results.pop();
    result.omittedCount++;
  }
  return result;
}
function makeDonnaSetupDraft(snapshot, companyId) {
  const brain = buildDonnaBrain(snapshot, companyId);
  const description = [
    "Donna Brain setup for " + brain.companyName + ".",
    "Evidence projection: " + brain.graph.revision + ".",
    "Use the existing company, repository, employees and skills. Reuse identities and obey current native authority.",
    "Inspect the saved repository connection and record a commit-pinned review before claiming source coverage.",
    "Map departments, skills, outstanding goals, decisions and questions. Attach sources, units and assumptions to research.",
    ...brain.gaps.map((g) => g.title + ": " + g.detail + " Next: " + g.action),
    "Build a dependency plan with an owner, finite budget, expected artifact and acceptance check for each step.",
    "Append corrections with supersedes links; retain earlier evidence. Refresh retrieval when company state or source evidence changes.",
    "Acceptance: no duplicate employees, no cross-company knowledge without an explicit grant, no unsupported completion claims, and a saved evidence-backed next step.",
    "This is a saved planning goal. Provider execution and external changes use their existing configured controls."
  ].join("\n");
  return { action: "create_goal", scope: { kind: "company", id: companyId }, title: ("Donna Brain \xB7 Set up " + brain.companyName).slice(0, 200), description, mode: "plan", maxIterations: 1, runSettings: { mode: "manual", provider: "anthropic", model: "", authorized: false, maxTokens: 4e3, maxUsd: 0, maxMinutes: 15, priceRates: { inputUsdPerMillion: null, outputUsdPerMillion: null }, allowedTools: [] } };
}
export {
  BRAIN_VERSION,
  brainEvidence,
  buildDonnaBrain,
  filterBrainKnowledge,
  makeBrainNote,
  makeDonnaSetupDraft,
  readBrainNote
};
