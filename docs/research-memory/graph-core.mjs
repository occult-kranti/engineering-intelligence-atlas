const GRAPH_VERSION = "daftar-graph-memory-2";
const GRAPH_LIMITS = Object.freeze({ nodes: 12e3, edges: 6e4, sources: 8e3, results: 12, bytes: 12288, iterations: 160 });
const encoder = new TextEncoder();
const ID = /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,159}$/;
const SOURCE_ID = /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,299}$/;
const SCOPE = /^[a-z][a-z0-9-]{0,79}$/;
const STOP = new Set("a an the of for and or to in on with how what why is are does do this that our from using use can as at by be been it into their these which".split(" "));
const ROUTABLE = /* @__PURE__ */ new Set(["requires", "prerequisite_of", "derived_from", "related", "related_to", "implements", "applies_to", "uses", "supports", "specializes", "generalizes", "member_of", "part_of", "connects", "analogy", "contradicts", "tests", "explains"]);
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const object = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const string = (v, limit = 5e4) => typeof v === "string" && v.length <= limit;
const scope = (n) => n.scope ?? "public";
const key = (n) => scope(n) + "/" + n.id;
const finite = (n) => typeof n === "number" && Number.isFinite(n);
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
function tokenize(text) {
  return (text.normalize("NFKC").toLocaleLowerCase("en-US").match(/[\p{L}\p{N}][\p{L}\p{N}_+-]*/gu) ?? []).filter((t) => t.length <= 80 && !STOP.has(t));
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
function exploreGraph(graph, start, q, grant, depth = 2, maxNodes = 120) {
  if (!Number.isInteger(depth) || depth < 0 || depth > 6 || !Number.isInteger(maxNodes) || maxNodes < 1 || maxNodes > 500) throw new Error("Invalid exploration bounds");
  const eligible = eligibleGraph(graph, q, grant), map = new Map(eligible.nodes.map((n) => [key(n), n]));
  if (!map.has(start)) return { nodes: [], edges: [], truncated: false };
  const seen = /* @__PURE__ */ new Set([start]), queue = [[start, 0]];
  let truncated = false;
  const neighbors = /* @__PURE__ */ new Map();
  for (const e of eligible.edges) {
    const a = scope(e) + "/" + e.source, b = scope(e) + "/" + e.target;
    for (const [x, y] of [[a, b], [b, a]]) {
      if (!neighbors.has(x)) neighbors.set(x, /* @__PURE__ */ new Set());
      neighbors.get(x).add(y);
    }
  }
  for (let pos = 0; pos < queue.length; pos++) {
    const [current, d] = queue[pos];
    if (d >= depth) continue;
    for (const next of [...neighbors.get(current) ?? []].sort(compare)) {
      if (seen.has(next)) continue;
      if (seen.size >= maxNodes) {
        truncated = true;
        continue;
      }
      seen.add(next);
      queue.push([next, d + 1]);
    }
  }
  return { nodes: [...seen].map((k) => map.get(k)), edges: eligible.edges.filter((e) => seen.has(scope(e) + "/" + e.source) && seen.has(scope(e) + "/" + e.target)), truncated };
}
function prerequisitePlan(graph, q, grant) {
  const eligible = eligibleGraph(graph, q, grant), ids = eligible.nodes.map(key), next = new Map(ids.map((id) => [id, /* @__PURE__ */ new Set()])), degree = new Map(ids.map((id) => [id, 0]));
  for (const e of eligible.edges) {
    if (!["requires", "prerequisite_of"].includes(e.type)) continue;
    const from = scope(e) + "/" + (e.type === "requires" ? e.target : e.source), to = scope(e) + "/" + (e.type === "requires" ? e.source : e.target);
    if (!next.get(from).has(to)) {
      next.get(from).add(to);
      degree.set(to, degree.get(to) + 1);
    }
  }
  const ready = ids.filter((id) => degree.get(id) === 0).sort(compare), order = [];
  while (ready.length) {
    const id = ready.shift();
    order.push(id);
    for (const target of [...next.get(id)].sort(compare)) {
      degree.set(target, degree.get(target) - 1);
      if (degree.get(target) === 0) {
        ready.push(target);
        ready.sort(compare);
      }
    }
  }
  const done = new Set(order), blocked = ids.filter((id) => !done.has(id));
  return { order, blocked, acyclic: blocked.length === 0 };
}
export {
  GRAPH_LIMITS,
  GRAPH_VERSION,
  eligibleGraph,
  exploreGraph,
  prerequisitePlan,
  queryGraph,
  tokenize,
  validateGraph
};
