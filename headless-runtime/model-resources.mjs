/** Owner-authenticated resource policy and bounded native-job orchestration.
 * A request ensemble is not a newly trained mixture-of-experts weight artifact. */
import { ModelResourcesError, RESOURCE_LIMITS, assertActor, createPrivateRegistry, fields, hash, nativeSnapshot,
  normalizeConfiguration, object, resourceFail as fail, safeId, scopeEntity, validId, validateResourceOperation } from './model-resources-contract.mjs';
export { ModelResourcesError } from './model-resources-contract.mjs';

const now = () => new Date().toISOString();
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const scopeKey = value => `${value.kind}:${value.id}`;
const nativeTerminal = new Set(['completed', 'failed', 'cancelled', 'budget-exhausted', 'needs-review']);
const pairedStep = step => validId(step?.reviewerEmployeeId) && step.reviewerEmployeeId !== step.employeeId;
const reviewGoal = goal => `Review the primary deliverable for this work. Return only structured JSON with verdict (accepted, revise or blocked), summary and evidenceRefs. Cite concrete evidence; do not claim execution or grant permissions.\n${goal}`;
const primaryTokens = total => Math.max(1, Math.min(total - 1, Math.floor(total * 3 / 5)));
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
function acceptedPair(primary, review) {
  const record = review?.review;
  return primary?.status === 'completed' && review?.status === 'completed' && record?.verdict === 'accepted'
    && record.primaryArtifactComplete === true && digest(primary.artifactSha256) && digest(review.artifactSha256)
    && record.primaryArtifactSha256 === primary.artifactSha256 && record.reviewArtifactSha256 === review.artifactSha256
    && typeof primary.artifactUri === 'string' && typeof review.artifactUri === 'string';
}
function validateState(state) {
  if (!object(state) || state.version !== 1 || !Number.isSafeInteger(state.revision) || state.revision < 0) fail('RESOURCE_STATE_INVALID', 'The resource registry is malformed.', 503);
  for (const key of ['resources', 'grants', 'routes', 'officeParents', 'definitions', 'plans', 'runs']) {
    const limit = { definitions: 512, plans: 256, runs: 256, officeParents: 2048 }[key] ?? RESOURCE_LIMITS[key];
    if (!Array.isArray(state[key]) || state[key].length > limit) fail('RESOURCE_STATE_INVALID', 'A resource registry collection is malformed.', 503);
    const identities = state[key].map(row => row?.id ?? row?.officeId);
    if (identities.some(id => typeof id !== 'string') || new Set(identities).size !== identities.length) fail('RESOURCE_STATE_INVALID', 'Resource registry identities are malformed.', 503);
  }
  normalizeConfiguration({ expectedRevision: state.revision, resources: state.resources, grants: state.grants.map(({ coveredScopes, ...grant }) => grant), routes: state.routes, officeParents: state.officeParents });
  for (const grant of state.grants) if (!Array.isArray(grant.coveredScopes) || grant.coveredScopes.length > RESOURCE_LIMITS.coveredScopes) fail('RESOURCE_STATE_INVALID', 'Resource grant membership is malformed.', 503);
  for (const plan of state.plans) if (!/^[a-f0-9]{64}$/.test(plan.planHash) || !Array.isArray(plan.steps) || plan.steps.length > 5) fail('RESOURCE_STATE_INVALID', 'A stored resource plan is malformed.', 503);
}
function hierarchy(state, officeParents) {
  const maps = { company: new Map(state.companies.map(item => [item.id, item.parentCompanyId ?? null])),
    office: new Map(state.offices.map(item => [item.id, null])), department: new Map(state.departments.map(item => [item.id, item.parentDepartmentId ?? null])), employee: new Map() };
  for (const edge of officeParents) {
    const child = scopeEntity(state, { kind: 'office', id: edge.officeId });
    if (edge.parentOfficeId !== null) { const parent = scopeEntity(state, { kind: 'office', id: edge.parentOfficeId }); if (parent.companyId !== child.companyId) fail('RESOURCE_SCOPE_DENIED', 'Office grouping must stay inside one company.', 403); }
    maps.office.set(edge.officeId, edge.parentOfficeId);
  }
  for (const [kind, parents] of Object.entries(maps)) {
    const finished = new Set();
    for (const [id, parent] of parents) {
      if (parent && !parents.has(parent)) fail('RESOURCE_HIERARCHY_INVALID', 'A hierarchy parent is missing.');
      const seen = new Set(); let cursor = id;
      while (cursor !== null && cursor !== undefined && !finished.has(cursor)) {
        if (seen.has(cursor)) fail('RESOURCE_HIERARCHY_INVALID', 'A hierarchy contains a cycle.');
        seen.add(cursor); if (seen.size > 16001) fail('RESOURCE_HIERARCHY_INVALID', 'A hierarchy exceeds its bound.'); cursor = parents.get(cursor);
      }
      for (const visited of seen) finished.add(visited);
      if (kind === 'department' && parent) {
        const child = state.departments.find(item => item.id === id); const owner = state.departments.find(item => item.id === parent);
        if (child.companyId !== owner.companyId || child.officeId !== owner.officeId) fail('RESOURCE_HIERARCHY_INVALID', 'Department hierarchy must stay in one native company and office.');
      }
    }
  }
  return maps;
}
function expand(target, descendants, maps) {
  const covered = [target]; if (!descendants) return covered;
  if (target.kind === 'employee') fail('RESOURCE_INPUT_INVALID', 'Employees have no descendant resource scopes.');
  const children = new Map();
  for (const [id, parent] of maps[target.kind]) { if (!children.has(parent)) children.set(parent, []); children.get(parent).push(id); }
  for (let cursor = 0; cursor < covered.length; cursor++) {
    for (const id of children.get(covered[cursor].id) ?? []) covered.push({ kind: target.kind, id });
    if (covered.length > RESOURCE_LIMITS.coveredScopes) fail('RESOURCE_CAPACITY', 'Explicit descendant membership exceeds its bound.', 409);
  }
  return covered.sort((a, b) => scopeKey(a).localeCompare(scopeKey(b)));
}
function inScope(target, companyId, employee, location) {
  if (target.kind === 'company') return target.id === companyId;
  if (target.kind === 'employee') return target.id === employee.id;
  if (target.kind === 'office') return target.id === (location?.officeId ?? employee.officeId);
  return target.id === (location?.departmentId ?? employee.departmentId);
}
const publicGrant = ({ coveredScopes, ...grant }) => ({ ...grant, coveredScopeCount: coveredScopes.length, membershipHash: hash(JSON.stringify(coveredScopes)) });
const publicPlan = plan => ({ id: plan.id, companyId: plan.companyId, employeeId: plan.employeeId, routeId: plan.routeId, planHash: plan.planHash,
  strategy: plan.strategy, kind: 'request-routing', trainedMoe: false, pairedReviewRequired: true, requiresReplan: !plan.steps.every(pairedStep), task: plan.task, steps: plan.steps, limits: plan.limits, createdAt: plan.createdAt });
const publicRun = run => ({ id: run.id, planId: run.planId, planHash: run.planHash, status: run.status, createdAt: run.createdAt,
  steps: run.steps.map(step => ({ index: step.index, employeeId: step.employeeId, resourceId: step.resourceId, model: step.model, digest: step.digest,
    role: step.role, status: step.status, jobId: step.jobId ?? null, artifactUri: step.artifactUri ?? null, reason: step.reason ?? null,
    reviewerEmployeeId: step.reviewerEmployeeId ?? null, reviewJobId: step.reviewJobId ?? null, primaryStatus: step.primaryStatus ?? null,
    reviewStatus: step.reviewStatus ?? null, reviewArtifactUri: step.reviewArtifactUri ?? null, reviewVerdict: step.reviewVerdict ?? null,
    reviewFailureReason: step.reviewFailureReason ?? null })) });

export function createModelResources({ stateDir, snapshot, modelPool, nativeCommand, environmentService } = {}) {
  if (typeof stateDir !== 'string' || typeof snapshot !== 'function' || typeof modelPool?.snapshot !== 'function') fail('RESOURCE_INPUT_INVALID', 'State, native snapshot and model pool adapters are required.');
  const store = createPrivateRegistry({ stateDir, name: 'model-resources', initial: { version: 1, revision: 0, resources: [], grants: [], routes: [], officeParents: [], definitions: [], plans: [], runs: [] }, validate: validateState });
  const current = () => nativeSnapshot(snapshot);
  const inventory = async (companyId, employeeId) => {
    let response; try { response = await modelPool.snapshot({ companyId, ...(employeeId ? { employeeId } : {}) }); } catch { fail('RESOURCE_MODEL_UNAVAILABLE', 'The installed local model inventory could not be verified.', 503); }
    const value = response?.snapshot;
    if (response?.ok !== true || !value?.available || !value?.enabled || !Array.isArray(value.models)) fail('RESOURCE_MODEL_UNAVAILABLE', 'The installed local model inventory is unavailable.', 503);
    return value;
  };
  const installed = async (resource, companyId, employeeId, assignment = false) => {
    const pool = await inventory(companyId, employeeId); const matches = pool.models.filter(item => item.name === resource.model);
    if (matches.length !== 1 || matches[0].digest !== resource.digest) fail('RESOURCE_DIGEST_CHANGED', 'The registered model is absent or its installed digest changed.', 409);
    if (assignment && !pool.assignments?.some(item => item.companyId === companyId && item.employeeId === employeeId && item.model === resource.model && item.digest === resource.digest)) fail('RESOURCE_MODEL_NOT_ASSIGNED', 'Select this exact resource model for the expert before dispatch.', 409);
    return matches[0];
  };
  const resolveIn = async (input, state, location, assignment = false) => {
    const employee = assertActor(state, input.companyId, input.employeeId, location);
    const resource = store.value.resources.find(item => item.id === input.resourceId);
    if (!resource) fail('RESOURCE_NOT_FOUND', 'The requested model resource was not found.', 404);
    scopeEntity(state, { kind: 'company', id: resource.companyId }); scopeEntity(state, resource.ownerScope);
    const maps = hierarchy(state, store.value.officeParents); const matches = [];
    for (const grant of store.value.grants) {
      if (grant.resourceId !== resource.id || !grant.permissions.includes(input.purpose)) continue;
      let currentScopes; try { scopeEntity(state, grant.targetScope); currentScopes = new Set(expand(grant.targetScope, grant.includeDescendants, maps).map(scopeKey)); } catch { continue; }
      const included = grant.coveredScopes.some(target => {
        if (!currentScopes.has(scopeKey(target))) return false;
        try { scopeEntity(state, target); } catch { return false; }
        return inScope(target, input.companyId, employee, location);
      });
      if (included) matches.push(grant.id);
    }
    if (!matches.length) fail('RESOURCE_GRANT_REQUIRED', 'An explicit current resource grant is required.', 403);
    await installed(resource, input.companyId, input.employeeId, assignment);
    return { ok: true, resource: { ...resource }, authorization: { companyId: input.companyId, employeeId: input.employeeId, purpose: input.purpose, grantIds: matches, revision: store.value.revision } };
  };
  const statusView = input => {
    let resources = store.value.resources;
    if (input.scope) resources = resources.filter(item => same(item.ownerScope, input.scope) || store.value.grants.some(grant => grant.resourceId === item.id && grant.coveredScopes.some(target => same(target, input.scope))));
    const ids = new Set(resources.map(item => item.id));
    return { ok: true, resources: { revision: store.value.revision, resources: structuredClone(resources), grants: store.value.grants.filter(item => ids.has(item.resourceId)).map(publicGrant), routes: structuredClone(store.value.routes), officeParents: structuredClone(store.value.officeParents), planCount: store.value.plans.length, runCount: store.value.runs.length,
      limits: RESOURCE_LIMITS, capabilities: { requestRouting: true, nativeExpertDag: typeof nativeCommand === 'function', pairedReviewRequired: true, reviewUsesSameResource: true, trainedMoeCreation: false, nativeSuboffices: false, officeGrouping: 'sidecar-resource-view-only', remoteWeightTransfer: false, managedEnvironments: !!environmentService, infrastructureCost: 'separate', enforcementRequiresAllAdapters: true, enforcementEnabled: store.value.revision > 0, downloadOwnership: 'owner-staging-before-register' } } };
  };
  const findPlan = id => { const plan = store.value.plans.find(item => item.id === id); if (!plan) fail('RESOURCE_PLAN_NOT_FOUND', 'The resource plan was not found.', 404); return plan; };
  const verifyStep = async (step, plan, state) => {
    if (!pairedStep(step)) fail('RESOURCE_PAIR_REQUIRED', 'This historical plan has no frozen distinct reviewer. Create a new paired plan; the original receipt will not be replayed.', 409);
    const primary = await resolveIn({ companyId: plan.companyId, employeeId: step.employeeId, resourceId: step.resourceId, purpose: 'use' }, state, step, true);
    await resolveIn({ companyId: plan.companyId, employeeId: step.reviewerEmployeeId, resourceId: step.resourceId, purpose: 'use' }, state,
      { ...step, serviceContractId: step.reviewerServiceContractId }, true);
    return primary;
  };
  const selectReviewer = async (expert, companyId, state) => {
    const verify = async employeeId => {
      if (employeeId === expert.employeeId) fail('RESOURCE_PAIR_REQUIRED', 'Primary and reviewer must be different employees.', 409);
      await resolveIn({ companyId, employeeId, resourceId: expert.resourceId, purpose: 'use' }, state,
        { ...expert, serviceContractId: expert.reviewerServiceContractId ?? null }, true);
      return employeeId;
    };
    if (expert.reviewerEmployeeId) return verify(expert.reviewerEmployeeId);
    const company = state.companies.find(item => item.id === companyId);
    const candidates = state.employees.filter(employee => employee.status === 'active' && employee.id !== expert.employeeId
      && (employee.companyId === companyId || (employee.companyId === null && employee.id === company?.assistantId))).sort((a, b) => a.id.localeCompare(b.id));
    for (const candidate of candidates) {
      try { return await verify(candidate.id); } catch (error) {
        if (!['RESOURCE_SCOPE_DENIED', 'RESOURCE_GRANT_REQUIRED', 'RESOURCE_MODEL_NOT_ASSIGNED'].includes(error.code)) throw error;
      }
    }
    fail('RESOURCE_PAIR_REQUIRED', 'No distinct active reviewer has the required scope, model assignment and resource grant. Assign one and create a new plan; no authority was added.', 409);
  };
  const nativeMatches = (job, expected, phase, primary, review) => {
    if (!job || !primary || !review || !pairedStep(expected) || !digest(primary.requestSha256)) return false;
    const isReview = phase === 'review';
    const projected = { ...expected, employeeId: isReview ? expected.reviewerEmployeeId : expected.employeeId,
      serviceContractId: isReview ? expected.reviewerServiceContractId : expected.serviceContractId,
      goal: isReview ? reviewGoal(expected.goal) : expected.goal,
      idempotencyKey: isReview ? `pair-review:${primary.requestSha256}` : expected.idempotencyKey,
      dependencies: isReview ? [primary.id] : expected.dependencies, allowedTools: isReview ? [] : expected.allowedTools,
      maxTokens: isReview ? expected.maxTokens - primaryTokens(expected.maxTokens) : primaryTokens(expected.maxTokens) };
    return ['companyId', 'officeId', 'departmentId', 'employeeId', 'goal', 'mode', 'provider', 'model', 'idempotencyKey'].every(key => job[key] === projected[key])
      && (job.serviceContractId ?? null) === projected.serviceContractId && job.authorized === true && same(job.dependencies, projected.dependencies)
      && same(job.allowedTools, projected.allowedTools) && job.limits?.maxTokens === projected.maxTokens && job.limits?.maxUsd === 0 && job.limits?.maxMinutes === projected.maxMinutes
      && job.id === (isReview ? review.id : primary.id) && (isReview ? job.requestSha256 === hash(`review:${primary.requestSha256}`) : true)
      && Object.entries({ stepId: primary.id, phase, peerEmployeeId: isReview ? expected.employeeId : expected.reviewerEmployeeId,
        primaryJobId: primary.id, reviewJobId: review.id }).every(([key, value]) => job.pair?.[key] === value);
  };
  const pairForStep = (step, state) => {
    const expected = step.expected;
    const matches = (state.jobs ?? []).filter(job => job.companyId === expected.companyId && job.idempotencyKey === expected.idempotencyKey);
    if (!matches.length) return null;
    const primary = matches[0], reviews = (state.jobs ?? []).filter(job => job.id === primary.pair?.reviewJobId), review = reviews[0];
    if (matches.length !== 1 || reviews.length !== 1 || !nativeMatches(primary, expected, 'primary', primary, review)
      || !nativeMatches(review, expected, 'review', primary, review) || (step.jobId && step.jobId !== primary.id) || (step.reviewJobId && step.reviewJobId !== review.id)) {
      fail('RESOURCE_NATIVE_CONFLICT', 'A native pair does not match its immutable routing receipt.', 409);
    }
    return { primary, review };
  };
  // Old receipts can predate the paired DTO even when the native enqueue
  // committed a pair. Recover identities only for inspection/cancellation;
  // never reinterpret the old authorization as permission to dispatch again.
  const historicalJobs = (step, state) => {
    const expected = step.expected;
    if (!expected) return [];
    const matches = (state.jobs ?? []).filter(job => job.companyId === expected.companyId && job.idempotencyKey === expected.idempotencyKey
      && job.employeeId === expected.employeeId && job.officeId === expected.officeId && job.goal === expected.goal && (!step.jobId || step.jobId === job.id));
    if (matches.length !== 1) return [];
    const primary = matches[0], review = (state.jobs ?? []).find(job => job.id === primary.pair?.reviewJobId && job.companyId === primary.companyId
      && job.pair?.phase === 'review' && job.pair?.primaryJobId === primary.id);
    return [primary, ...(review ? [review] : [])];
  };
  const updateStep = (step, { primary, review }) => {
    step.jobId = primary.id; step.reviewJobId = review.id; step.primaryStatus = primary.status; step.reviewStatus = review.status;
    step.artifactUri = primary.artifactUri ?? null; step.reviewArtifactUri = review.artifactUri ?? null;
    step.reviewVerdict = review.review?.verdict ?? null; step.reviewFailureReason = review.reviewFailure?.reason ?? null;
    step.status = acceptedPair(primary, review) ? 'completed'
      : review.reviewFailure || ['revise', 'blocked'].includes(review.review?.verdict) || [primary.status, review.status].some(status => ['failed', 'needs-review', 'budget-exhausted'].includes(status)) ? 'needs-review'
      : [primary.status, review.status].includes('cancelled') ? 'cancelled'
      : [primary.status, review.status].includes('running') ? 'running'
      : primary.status === 'completed' ? 'awaiting-review' : primary.status;
    step.reason = step.reviewFailureReason ?? (step.reviewVerdict && step.reviewVerdict !== 'accepted' ? `review_${step.reviewVerdict}` : null);
  };
  const refreshRuns = async () => {
    const state = await current(); let changed = false; const next = structuredClone(store.value.runs);
    for (const run of next) {
      for (const step of run.steps) {
        if (!step.expected) continue;
        if (!pairedStep(step.expected)) {
          const before = JSON.stringify(step), jobs = historicalJobs(step, state);
          if (jobs.length) { step.jobId = jobs[0].id; step.reviewJobId = jobs[1]?.id ?? null; step.primaryStatus = jobs[0].status; step.reviewStatus = jobs[1]?.status ?? null; }
          step.status = jobs.length && jobs.every(job => job.status === 'cancelled') ? 'cancelled' : 'needs-review'; step.reason = 'legacy_unpaired_receipt';
          if (before !== JSON.stringify(step)) changed = true;
          continue;
        }
        const pair = pairForStep(step, state);
        if (pair) {
          const before = JSON.stringify(step); updateStep(step, pair); if (before !== JSON.stringify(step)) changed = true;
        } else if (step.status === 'dispatching') { step.status = 'uncertain'; step.reason = 'native_enqueue_unknown'; changed = true; }
      }
      const statuses = run.steps.map(item => item.status);
      const status = statuses.some(item => item === 'uncertain') ? 'uncertain'
        : statuses.every(item => item === 'completed') ? 'completed'
        : statuses.every(item => nativeTerminal.has(item) || item === 'not-dispatched') && statuses.some(item => item === 'cancelled') ? 'cancelled'
        : statuses.some(item => ['failed', 'needs-review', 'budget-exhausted'].includes(item)) ? 'needs-review'
        : statuses.some(item => item === 'running') ? 'running'
        : statuses.some(item => item === 'awaiting-review') ? 'awaiting-review'
        : run.steps.every(item => item.jobId && item.reviewJobId) && !['cancelling', 'needs-review'].includes(run.status) ? 'queued' : run.status;
      if (run.status !== status) { run.status = status; changed = true; }
    }
    if (changed) store.update(value => { value.runs = next; });
  };
  const verifyPlan = async plan => {
    const route = store.value.routes.find(item => item.id === plan.routeId);
    if (!route || hash(JSON.stringify(route)) !== plan.routeHash) fail('RESOURCE_PLAN_STALE', 'The route changed after this plan was created.', 409);
    const state = await current(); assertActor(state, plan.companyId, plan.employeeId);
    for (const step of plan.steps) {
      const resolved = await verifyStep(step, plan, state);
      if (resolved.resource.digest !== step.digest || resolved.resource.model !== step.model) fail('RESOURCE_PLAN_STALE', 'A model resource changed after planning.', 409);
    }
  };
  return {
    status: (input = {}) => store.serial(async () => { validateResourceOperation('status', input); if (input.scope) scopeEntity(await current(), input.scope); await refreshRuns(); return statusView(input); }),
    configure: input => store.serial(async () => {
      const config = normalizeConfiguration(input); if (config.expectedRevision !== store.value.revision) fail('RESOURCE_REVISION_CONFLICT', 'Resource policy changed; read its current revision first.', 409);
      const state = await current(); const maps = hierarchy(state, config.officeParents);
      for (const resource of config.resources) {
        const prior = store.value.definitions.find(item => item.id === resource.id);
        if (prior && prior.hash !== hash(JSON.stringify(resource))) fail('RESOURCE_IDENTITY_CONFLICT', 'This resource ID is permanently bound to another definition; use a new ID.', 409);
        // Retaining a previously verified identity must not prevent revocation
        // when its model or owner subsequently becomes unavailable.
        if (store.value.resources.some(item => same(item, resource))) continue;
        const entity = scopeEntity(state, resource.ownerScope); scopeEntity(state, { kind: 'company', id: resource.companyId });
        if (resource.ownerScope.kind === 'employee') assertActor(state, resource.companyId, entity.id);
        else if ((resource.ownerScope.kind === 'company' ? entity.id : entity.companyId) !== resource.companyId) fail('RESOURCE_SCOPE_DENIED', 'Resource ownership must match its canonical company.', 403);
        await installed(resource, resource.companyId);
      }
      const resourceIds = new Set(config.resources.map(item => item.id));
      const grants = config.grants.map(grant => {
        if (!resourceIds.has(grant.resourceId)) fail('RESOURCE_NOT_FOUND', 'A grant refers to an unknown resource.', 404);
        scopeEntity(state, grant.targetScope);
        const previous = store.value.grants.find(item => item.id === grant.id);
        const { coveredScopes, ...prior } = previous ?? {};
        return { ...grant, coveredScopes: previous && same(prior, grant) ? coveredScopes : expand(grant.targetScope, grant.includeDescendants, maps) };
      });
      for (const route of config.routes) {
        scopeEntity(state, { kind: 'company', id: route.companyId });
        for (const expert of [...route.experts, ...(route.aggregator ? [route.aggregator] : [])]) {
          if (!resourceIds.has(expert.resourceId)) fail('RESOURCE_NOT_FOUND', 'An expert refers to an unknown resource.', 404);
          assertActor(state, route.companyId, expert.employeeId, expert);
          if (expert.reviewerEmployeeId) assertActor(state, route.companyId, expert.reviewerEmployeeId, { ...expert, serviceContractId: expert.reviewerServiceContractId });
        }
      }
      store.update(value => {
        for (const resource of config.resources) if (!value.definitions.some(item => item.id === resource.id)) value.definitions.push({ id: resource.id, hash: hash(JSON.stringify(resource)) });
        value.resources = config.resources; value.grants = grants; value.routes = config.routes; value.officeParents = config.officeParents; value.revision++;
      }); return statusView({});
    }),
    resolve: input => store.serial(async () => { validateResourceOperation('resolve', input); return resolveIn(input, await current()); }),
    plan: input => store.serial(async () => {
      validateResourceOperation('plan', input); const inputHash = hash(JSON.stringify(input)); const previous = store.value.plans.find(item => item.id === input.id);
      if (previous) { if (previous.inputHash !== inputHash) fail('RESOURCE_IDEMPOTENCY_CONFLICT', 'This plan ID belongs to different input.', 409); return { ok: true, id: previous.id, replayed: true, plan: publicPlan(previous) }; }
      if (store.value.plans.length >= RESOURCE_LIMITS.receipts) fail('RESOURCE_CAPACITY', 'The durable plan receipt limit is full.', 409);
      const route = store.value.routes.find(item => item.id === input.routeId && item.companyId === input.companyId); if (!route) fail('RESOURCE_ROUTE_NOT_FOUND', 'The route was not found in this company.', 404);
      const state = await current(); assertActor(state, input.companyId, input.employeeId);
      const definitions = [...route.experts.map(item => ({ ...item, role: 'expert' })), ...(route.aggregator ? [{ ...route.aggregator, role: 'aggregator' }] : [])];
      if (route.limits.maxTokens < definitions.length * 2 || route.limits.maxMinutes < definitions.length * 0.02) fail('RESOURCE_PAIR_BUDGET', 'The original limits cannot cover both native phases. Increase the explicit route limits before planning.', 409);
      const steps = [];
      for (const [index, expert] of definitions.entries()) {
        const resolved = await resolveIn({ companyId: input.companyId, employeeId: expert.employeeId, resourceId: expert.resourceId, purpose: 'use' }, state, expert, true);
        const reviewerEmployeeId = await selectReviewer(expert, input.companyId, state);
        const dependsOn = expert.role === 'aggregator' ? route.experts.map((_, position) => position) : index >= route.limits.maxParallel ? [index - route.limits.maxParallel] : [];
        steps.push({ ...expert, reviewerEmployeeId, reviewerServiceContractId: expert.reviewerServiceContractId ?? null, index, model: resolved.resource.model, digest: resolved.resource.digest, dependsOn });
      }
      const body = { id: input.id, companyId: input.companyId, employeeId: input.employeeId, routeId: route.id, routeHash: hash(JSON.stringify(route)), strategy: route.strategy, task: input.task, steps, limits: route.limits };
      const plan = { ...body, inputHash, planHash: hash(JSON.stringify(body)), createdAt: now() }; store.update(value => { value.plans.push(plan); });
      return { ok: true, id: plan.id, replayed: false, plan: publicPlan(plan) };
    }),
    start: input => store.serial(async () => {
      validateResourceOperation('start', input); const inputHash = hash(JSON.stringify(input)); const previous = store.value.runs.find(item => item.id === input.id);
      if (previous) { if (previous.inputHash !== inputHash) fail('RESOURCE_IDEMPOTENCY_CONFLICT', 'This run ID belongs to different input.', 409); await refreshRuns(); return { ok: true, id: input.id, replayed: true, run: publicRun(store.value.runs.find(item => item.id === input.id)) }; }
      const plan = findPlan(input.planId); if (plan.planHash !== input.expectedPlanHash) fail('RESOURCE_PLAN_STALE', 'The supplied plan hash does not match.', 409);
      if (store.value.runs.some(item => item.planId === plan.id)) fail('RESOURCE_PLAN_ALREADY_STARTED', 'This immutable plan already has a run receipt.', 409);
      if (typeof nativeCommand !== 'function') fail('RESOURCE_EXECUTION_UNAVAILABLE', 'Native job enqueue is not connected; this service can only produce plans.', 503);
      if (store.value.runs.length >= RESOURCE_LIMITS.receipts) fail('RESOURCE_CAPACITY', 'The durable run receipt limit is full.', 409);
      await verifyPlan(plan);
      store.update(value => { value.runs.push({ id: input.id, inputHash, planId: plan.id, planHash: plan.planHash, status: 'dispatching', createdAt: now(), steps: plan.steps.map(step => ({ ...step, status: 'not-dispatched', jobId: null, reviewJobId: null })) }); });
      for (const planned of plan.steps) {
        try { await verifyPlan(plan); } catch (error) {
          store.update(value => { const run = value.runs.find(item => item.id === input.id); run.status = 'needs-review'; run.steps[planned.index].reason = 'authorization_changed_before_enqueue'; });
          break;
        }
        const run = store.value.runs.find(item => item.id === input.id); const step = run.steps[planned.index];
        const expected = { action: 'enqueue_job', companyId: plan.companyId, officeId: step.officeId, departmentId: step.departmentId, employeeId: step.employeeId,
          serviceContractId: step.serviceContractId, goal: `${step.role === 'aggregator' ? 'Synthesize the completed expert dependency artifacts with provenance.\n' : ''}${plan.task}`,
          reviewerEmployeeId: step.reviewerEmployeeId, reviewerServiceContractId: step.reviewerServiceContractId,
          mode: 'provider', provider: 'ollama', model: step.model, authorized: true, allowedTools: ['provider.run'],
          dependencies: step.dependsOn.map(index => run.steps[index].reviewJobId), maxTokens: Math.floor(plan.limits.maxTokens / plan.steps.length), maxUsd: 0,
          maxMinutes: plan.limits.maxMinutes / (plan.steps.length * 2), idempotencyKey: `resource:${hash(`${input.id}:${plan.planHash}`).slice(0, 48)}:${step.index}` };
        store.update(value => { const target = value.runs.find(item => item.id === input.id).steps[step.index]; target.expected = expected; target.status = 'dispatching'; });
        let response; try { response = await nativeCommand(expected); } catch { response = null; }
        const state = await current(); let pair; try { pair = pairForStep({ expected }, state); } catch { pair = null; }
        if (!pair) {
          store.update(value => { const target = value.runs.find(item => item.id === input.id); target.status = 'uncertain'; target.steps[step.index].status = 'uncertain'; target.steps[step.index].reason = response?.ok === false ? 'native_enqueue_rejected' : 'native_enqueue_unknown'; }); break;
        }
        store.update(value => { updateStep(value.runs.find(item => item.id === input.id).steps[step.index], pair); });
      }
      store.update(value => { const run = value.runs.find(item => item.id === input.id); if (run.steps.every(step => step.jobId && step.reviewJobId)) run.status = 'queued'; });
      return { ok: true, id: input.id, replayed: false, run: publicRun(store.value.runs.find(item => item.id === input.id)) };
    }),
    inspect: input => store.serial(async () => {
      validateResourceOperation('inspect', input); await refreshRuns(); const run = store.value.runs.find(item => item.id === input.id); const plan = run ? findPlan(run.planId) : store.value.plans.find(item => item.id === input.id);
      if (!run && !plan) fail('RESOURCE_RECEIPT_NOT_FOUND', 'The requested resource receipt was not found.', 404);
      return { ok: true, id: input.id, ...(plan ? { plan: publicPlan(plan) } : {}), ...(run ? { run: publicRun(run) } : {}) };
    }),
    cancel: input => store.serial(async () => {
      validateResourceOperation('cancel', input); await refreshRuns(); const run = store.value.runs.find(item => item.id === input.id);
      if (!run) fail('RESOURCE_RECEIPT_NOT_FOUND', 'The requested native run was not found.', 404);
      if (typeof nativeCommand !== 'function') fail('RESOURCE_EXECUTION_UNAVAILABLE', 'Native cancellation is unavailable.', 503);
      store.update(value => { value.runs.find(item => item.id === input.id).status = 'cancelling'; });
      const state = await current();
      for (const step of run.steps) for (const jobId of [step.jobId, step.reviewJobId]) {
        const job = (state.jobs ?? []).find(item => item.id === jobId);
        if (job && !nativeTerminal.has(job.status)) { try { await nativeCommand({ action: 'cancel_job', jobId }); } catch { /* inspect reconciles the canonical result; no claim of cancellation yet */ } }
      }
      await refreshRuns(); return { ok: true, id: input.id, run: publicRun(store.value.runs.find(item => item.id === input.id)) };
    }),
    authorizeModelOperation: (operation, input) => store.serial(async () => {
      if (['snapshot', 'cancel'].includes(operation)) return { ok: true, authorization: { ownerDirected: true } };
      if (!['select', 'request'].includes(operation)) fail('RESOURCE_INPUT_INVALID', 'Unsupported model operation.');
      safeId(input?.companyId); safeId(input?.employeeId); const state = await current();
      // An authenticated owner can stage reviewed weights before registering
      // their verified digest. Staging grants no assignment or execution right.
      if (operation === 'request') { assertActor(state, input.companyId, input.employeeId); return { ok: true, authorization: { ownerStaging: true, grantsAssignment: false } }; }
      const candidates = store.value.resources.filter(resource => resource.model === input.model);
      if (!candidates.length) fail('RESOURCE_NOT_REGISTERED', 'Register an installed verified model resource before using this managed model operation.', 403);
      let denied; for (const resource of candidates) { try { return await resolveIn({ companyId: input.companyId, employeeId: input.employeeId, resourceId: resource.id, purpose: 'assign' }, state); } catch (error) { denied = error; } }
      throw denied;
    }),
    validateJob: job => store.serial(async () => {
      if (job?.provider !== 'ollama') return;
      const state = await current();
      const original = (state.jobs ?? []).find(item => item.id === job.pair?.primaryJobId);
      const belongs = step => step.jobId === job.id || step.reviewJobId === job.id
        || (step.expected?.companyId === job.companyId && [job.idempotencyKey, original?.idempotencyKey].includes(step.expected?.idempotencyKey));
      const run = store.value.runs.find(item => item.steps.some(belongs));
      if (run) {
        const plan = findPlan(run.planId); await verifyPlan(plan); const step = run.steps.find(belongs);
        const pair = pairForStep(step, state);
        if (!pair || !nativeMatches(job, step.expected, job.pair?.phase, pair.primary, pair.review)) fail('RESOURCE_NATIVE_CONFLICT', 'The worker job differs from its resource routing receipt.', 409);
        await verifyStep(step, plan, state);
      } else {
        if (job.idempotencyKey?.startsWith('resource:') || original?.idempotencyKey?.startsWith('resource:')) fail('RESOURCE_NATIVE_CONFLICT', 'This resource-prefixed native pair has no matching managed receipt.', 409);
        const candidates = store.value.resources.filter(resource => resource.model === job.model); let permitted = false;
        for (const resource of candidates) { try { await resolveIn({ companyId: job.companyId, employeeId: job.employeeId, resourceId: resource.id, purpose: 'use' }, state, job, true); permitted = true; break; } catch {} }
        if (!permitted) fail('RESOURCE_GRANT_REQUIRED', 'The worker has no current grant for this exact model.', 403);
      }
      await modelPool.validateJob?.(job);
    }),
    isEnforced: () => { store.assertHealthy(); return store.value.revision > 0; },
    close: () => store.close()
  };
}
