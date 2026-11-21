import { z } from "zod";

/**
 * Phase 0 shared enterprise / CEO contract — single source of truth for the
 * enterprise blueprint DTOs, the deterministic blueprint generator, budget
 * partitioning, and the derived graph/list view. This file is copied
 * byte-identically into the desktop shell
 * (desktop-shell/src/shared/enterprise.ts); keep the two copies in sync.
 *
 * Browser-safe: this module imports NOTHING from any platform API (no
 * node:crypto, no fs). Canonical JSON + SHA-256 are implemented in pure
 * TypeScript so the web contracts and the Electron shell produce identical
 * hashes. Pure and deterministic: no Date, no randomness, no I/O.
 */

export const ENTERPRISE_CONTRACT_VERSION = 1 as const;

// ── Primitives ───────────────────────────────────────────────────

export const Sha256HexSchema = z
  .string()
  .regex(/^[0-9a-f]{64}$/, "sha256 must be 64 lowercase hex chars");
export type Sha256Hex = z.infer<typeof Sha256HexSchema>;

/** Kebab-case keys shared by companies, departments, contracts, memory scopes. */
export const EnterpriseKeySchema = z
  .string()
  .min(1)
  .max(64)
  .regex(
    /^[a-z][a-z0-9-]*$/,
    "enterprise keys must be lowercase kebab-case starting with a letter",
  );

/**
 * A hard enterprise budget envelope. Money is integer USD micros (1e-6 USD)
 * to avoid float drift; tokens/calls are integers; minutes may be fractional
 * (millisecond precision is preserved by partitioning in milli-minutes).
 */
export const EnterpriseBudgetSchema = z.object({
  maxTokens: z.number().int().positive(),
  maxCalls: z.number().int().positive(),
  maxMinutes: z.number().positive(),
  maxCostUsdMicros: z.number().int().positive(),
});
export type EnterpriseBudget = z.infer<typeof EnterpriseBudgetSchema>;

/** A per-company reservation; all four fields may be zero (inactive company). */
export const EnterpriseReservationSchema = z.object({
  maxTokens: z.number().int().nonnegative(),
  maxCalls: z.number().int().nonnegative(),
  maxMinutes: z.number().nonnegative(),
  maxCostUsdMicros: z.number().int().nonnegative(),
});
export type EnterpriseReservation = z.infer<typeof EnterpriseReservationSchema>;

export const ZERO_RESERVATION: EnterpriseReservation = {
  maxTokens: 0,
  maxCalls: 0,
  maxMinutes: 0,
  maxCostUsdMicros: 0,
};

// ── Enumerations ─────────────────────────────────────────────────

export const COMPANY_KINDS = ["line", "shared-services"] as const;
export const CompanyKindSchema = z.enum(COMPANY_KINDS);
export type CompanyKind = z.infer<typeof CompanyKindSchema>;

export const DISCIPLINES = [
  "mathematics",
  "computational-geometry",
  "backend-engineering",
  "cybersecurity",
  "ai-research",
  "design",
  "music-production",
] as const;
export const DisciplineSchema = z.enum(DISCIPLINES);
export type Discipline = z.infer<typeof DisciplineSchema>;

export const WORKER_CONTRACT_STATUSES = [
  "proposed",
  "active",
  "draining",
  "released",
  "revoked",
] as const;
export const WorkerContractStatusSchema = z.enum(WORKER_CONTRACT_STATUSES);
export type WorkerContractStatus = z.infer<typeof WorkerContractStatusSchema>;

export const MEMORY_SCOPES = [
  "enterprise",
  "company",
  "department",
  "office",
] as const;
export const MemoryScopeSchema = z.enum(MEMORY_SCOPES);
export type MemoryScope = z.infer<typeof MemoryScopeSchema>;

export const CEO_PROGRAM_STATES = [
  "draft",
  "blueprint_ready",
  "awaiting_plan_approval",
  "dispatching",
  "running",
  "reconciling",
  "completed",
  "failed",
  "stopped_budget",
  "stopped_human",
] as const;
export const CeoProgramStateSchema = z.enum(CEO_PROGRAM_STATES);
export type CeoProgramState = z.infer<typeof CeoProgramStateSchema>;

export const ENTERPRISE_PRESETS = ["creative_technology_group"] as const;
export const EnterprisePresetSchema = z.enum(ENTERPRISE_PRESETS);
export type EnterprisePreset = z.infer<typeof EnterprisePresetSchema>;

// ── Discipline → skill map (no standing roles, skills only) ─────

/**
 * New creative skill ids introduced by the creative_technology_group preset.
 * They are skill packages (to be vetted through the normal skill registry),
 * NOT standing roles; the generator never invents roles or skills beyond the
 * ids listed here and in DISCIPLINE_SKILLS.
 */
export const CREATIVE_SKILL_IDS = [
  "civilization-art-design-research",
  "music-theory-production-engineering",
] as const;
export type CreativeSkillId = (typeof CREATIVE_SKILL_IDS)[number];

/**
 * Discipline → bundled/declared skill ids, in deterministic preference order
 * (index 0 is the generator's primary pin). Existing atlas skill ids are
 * reused; the two creative ids above cover the disciplines with no existing
 * package. Nothing outside this map may appear in a blueprint.
 */
export const DISCIPLINE_SKILLS: Record<Discipline, readonly string[]> = {
  mathematics: ["mathematics-research"],
  "computational-geometry": ["computational-geometry-engineering"],
  "backend-engineering": ["architecture-database-backend-engineering"],
  cybersecurity: ["defensive-reverse-engineering"],
  "ai-research": ["ai-research-frontier", "ai-open-model-research"],
  design: [
    "civilization-art-design-research",
    "ui-ux-research-design-engineering",
    "spatial-3d-production-engineering",
  ],
  "music-production": ["music-theory-production-engineering"],
};

export const ALL_DISCIPLINE_SKILL_IDS: readonly string[] = DISCIPLINES.flatMap(
  (d) => DISCIPLINE_SKILLS[d],
);

// ── Core DTOs ────────────────────────────────────────────────────

/**
 * A pinned skill reference. sha256 is nullable in Phase 0: a blueprint may
 * pin a declared-but-not-yet-vetted skill (staffed=false) without inventing
 * an integrity hash.
 */
export const EnterpriseSkillPinSchema = z.object({
  skillId: z.string().min(1).max(80),
  version: z.string().min(1).max(50),
  sha256: Sha256HexSchema.nullable(),
});
export type EnterpriseSkillPin = z.infer<typeof EnterpriseSkillPinSchema>;

export const EnterpriseCompanySchema = z.object({
  key: EnterpriseKeySchema,
  name: z.string().min(1).max(255),
  kind: CompanyKindSchema,
  mission: z.string().max(2000).default(""),
  disciplines: z.array(DisciplineSchema).max(8),
  /** Relative capacity weight (integer basis for partitionBudget). */
  capacityShare: z.number().int().positive(),
});
export type EnterpriseCompany = z.infer<typeof EnterpriseCompanySchema>;

export const DepartmentSchema = z.object({
  key: EnterpriseKeySchema,
  /** Owning company (the shared-services company for service departments). */
  companyKey: EnterpriseKeySchema,
  name: z.string().min(1).max(255),
  discipline: DisciplineSchema,
});
export type Department = z.infer<typeof DepartmentSchema>;

export const WorkerContractSchema = z.object({
  key: EnterpriseKeySchema,
  /** Company whose program this contract serves. */
  companyKey: EnterpriseKeySchema,
  /** Department providing the capability (may be another company's). */
  departmentKey: EnterpriseKeySchema,
  discipline: DisciplineSchema,
  status: WorkerContractStatusSchema,
  /** Contract revision; bumped on every renegotiation. */
  version: z.number().int().positive(),
  /** Fraction (0,1] of the served company's capacity routed to this contract. */
  capacityShare: z.number().positive().max(1),
  skillPin: EnterpriseSkillPinSchema,
  /**
   * True iff skillPin.skillId was present in the generator's
   * availableSkillIds. Never asserted for an unknown/invented skill.
   */
  staffed: z.boolean(),
});
export type WorkerContract = z.infer<typeof WorkerContractSchema>;

/** Reference to a platform artifact (web run id or desktop run id). */
export const ArtifactRefSchema = z.object({
  /** Platform artifact id: numeric (web DB) or string (desktop store). */
  artifactId: z.union([
    z.string().min(1).max(128),
    z.number().int().positive(),
  ]),
  runId: z.union([z.string().min(1).max(128), z.number().int().positive()]),
  nodeKey: EnterpriseKeySchema,
  attempt: z.number().int().positive(),
  kind: z.string().min(1).max(64),
  title: z.string().min(1).max(500),
  summary: z.string().max(2000).default(""),
  contentSha256: Sha256HexSchema,
});
export type ArtifactRef = z.infer<typeof ArtifactRefSchema>;

/**
 * Memory entry: REFERENCE ONLY. Enterprise memory never inlines artifact
 * content; it points at an ArtifactRef in the platform artifact store.
 */
export const MemoryEntrySchema = z.object({
  scope: MemoryScopeSchema,
  /** programId for enterprise scope, else the company/department/office key. */
  scopeKey: EnterpriseKeySchema,
  artifact: ArtifactRefSchema,
});
export type MemoryEntry = z.infer<typeof MemoryEntrySchema>;

// ── Blueprint ────────────────────────────────────────────────────

export const EnterpriseBlueprintSchema = z
  .object({
    contractVersion: z.literal(ENTERPRISE_CONTRACT_VERSION),
    preset: EnterprisePresetSchema,
    programId: EnterpriseKeySchema,
    name: z.string().min(1).max(255),
    mission: z.string().min(1).max(2000),
    companies: z.array(EnterpriseCompanySchema).min(1),
    departments: z.array(DepartmentSchema),
    contracts: z.array(WorkerContractSchema),
    budget: EnterpriseBudgetSchema,
    maxReplans: z.number().int().min(0).max(10),
    maxConcurrentRuns: z.number().int().positive().max(64),
  })
  .strict()
  .superRefine((bp, ctx) => {
    const companyKeys = new Set<string>();
    for (const [i, c] of bp.companies.entries()) {
      if (companyKeys.has(c.key)) {
        ctx.addIssue({
          code: "custom",
          path: ["companies", i, "key"],
          message: `duplicate company key "${c.key}"`,
        });
      }
      companyKeys.add(c.key);
    }
    const departmentKeys = new Set<string>();
    for (const [i, d] of bp.departments.entries()) {
      if (departmentKeys.has(d.key)) {
        ctx.addIssue({
          code: "custom",
          path: ["departments", i, "key"],
          message: `duplicate department key "${d.key}"`,
        });
      }
      departmentKeys.add(d.key);
      if (!companyKeys.has(d.companyKey)) {
        ctx.addIssue({
          code: "custom",
          path: ["departments", i, "companyKey"],
          message: `department "${d.key}" references unknown company "${d.companyKey}"`,
        });
      }
    }
    const contractKeys = new Set<string>();
    for (const [i, w] of bp.contracts.entries()) {
      if (contractKeys.has(w.key)) {
        ctx.addIssue({
          code: "custom",
          path: ["contracts", i, "key"],
          message: `duplicate contract key "${w.key}"`,
        });
      }
      contractKeys.add(w.key);
      if (!companyKeys.has(w.companyKey)) {
        ctx.addIssue({
          code: "custom",
          path: ["contracts", i, "companyKey"],
          message: `contract "${w.key}" references unknown company "${w.companyKey}"`,
        });
      }
      if (!departmentKeys.has(w.departmentKey)) {
        ctx.addIssue({
          code: "custom",
          path: ["contracts", i, "departmentKey"],
          message: `contract "${w.key}" references unknown department "${w.departmentKey}"`,
        });
      }
      const allowed = DISCIPLINE_SKILLS[w.discipline] ?? [];
      if (!allowed.includes(w.skillPin.skillId)) {
        ctx.addIssue({
          code: "custom",
          path: ["contracts", i, "skillPin", "skillId"],
          message: `contract "${w.key}" pins skill "${w.skillPin.skillId}" which is not a declared skill for discipline "${w.discipline}" (no invented skills)`,
        });
      }
    }
  });
export type EnterpriseBlueprint = z.infer<typeof EnterpriseBlueprintSchema>;

// ── CEO program + approvals ──────────────────────────────────────

export const COMPANY_RUN_STATUSES = [
  "pending",
  "running",
  "completed",
  "failed",
  "stopped",
] as const;
export const CompanyRunStatusSchema = z.enum(COMPANY_RUN_STATUSES);
export type CompanyRunStatus = z.infer<typeof CompanyRunStatusSchema>;

export const CompanyRunSchema = z.object({
  companyKey: EnterpriseKeySchema,
  runId: z
    .union([z.string().min(1).max(128), z.number().int().positive()])
    .nullable(),
  status: CompanyRunStatusSchema,
});
export type CompanyRun = z.infer<typeof CompanyRunSchema>;

export const EnterpriseProgramSchema = z
  .object({
    contractVersion: z.literal(ENTERPRISE_CONTRACT_VERSION),
    programId: EnterpriseKeySchema,
    state: CeoProgramStateSchema,
    /** Program revision (optimistic concurrency); bumped on every mutation. */
    version: z.number().int().positive(),
    blueprintHash: Sha256HexSchema,
    companyRuns: z.array(CompanyRunSchema),
    maxReplans: z.number().int().min(0).max(10),
    maxConcurrentRuns: z.number().int().positive().max(64),
    budget: EnterpriseBudgetSchema,
  })
  .strict();
export type EnterpriseProgram = z.infer<typeof EnterpriseProgramSchema>;

export const ENTERPRISE_APPROVAL_KINDS = [
  "blueprint-activation",
  "plan",
  "budget-increase",
  "memory-promote",
] as const;
export const EnterpriseApprovalKindSchema = z.enum(ENTERPRISE_APPROVAL_KINDS);
export type EnterpriseApprovalKind = z.infer<
  typeof EnterpriseApprovalKindSchema
>;

/**
 * Versioned, hash-bound approval payload. Materializers must present the
 * exact blueprintHash + payloadHash a human approved; a decision can never
 * approve a different blueprint or materialization payload.
 */
export const EnterpriseApprovalPayloadSchema = z
  .object({
    contractVersion: z.literal(ENTERPRISE_CONTRACT_VERSION),
    kind: EnterpriseApprovalKindSchema,
    programId: EnterpriseKeySchema,
    programVersion: z.number().int().positive(),
    blueprintHash: Sha256HexSchema,
    /** sha256 of canonicalJson(materialization payload). */
    payloadHash: Sha256HexSchema,
  })
  .strict();
export type EnterpriseApprovalPayload = z.infer<
  typeof EnterpriseApprovalPayloadSchema
>;

// ── Errors ───────────────────────────────────────────────────────

export class EnterpriseContractError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(`${code}: ${message}`);
    this.name = "EnterpriseContractError";
    this.code = code;
  }
}

// ── Canonical JSON + pure-TypeScript SHA-256 ─────────────────────

/**
 * Stable canonical JSON: object keys sorted recursively, no whitespace.
 * Undefined object properties are skipped (matching JSON.stringify); array
 * holes/undefined serialize as null, matching JSON.stringify.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value === undefined ? null : value) ?? "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => canonicalJson(v === undefined ? null : v)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record)
    .filter((k) => record[k] !== undefined)
    .sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${canonicalJson(record[k])}`)
    .join(",")}}`;
}

const SHA256_K: readonly number[] = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

function rotr(x: number, n: number): number {
  return ((x >>> n) | (x << (32 - n))) | 0;
}

/**
 * Pure-TypeScript SHA-256 (FIPS 180-4) over the UTF-8 encoding of `text`.
 * Deterministic and browser-safe; identical digests in every JS engine.
 */
export function sha256Hex(text: string): string {
  const bytes = new TextEncoder().encode(text);
  const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
  const buf = new Uint8Array(paddedLength);
  buf.set(bytes);
  buf[bytes.length] = 0x80;
  const bitLenHi = Math.floor(bytes.length / 0x20000000);
  const bitLenLo = (bytes.length << 3) >>> 0;
  const dv = new DataView(buf.buffer);
  dv.setUint32(paddedLength - 8, bitLenHi, false);
  dv.setUint32(paddedLength - 4, bitLenLo, false);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const w = new Int32Array(64);
  for (let block = 0; block < paddedLength; block += 64) {
    for (let t = 0; t < 16; t++) {
      w[t] = dv.getInt32(block + t * 4, false);
    }
    for (let t = 16; t < 64; t++) {
      const w15 = w[t - 15] as number;
      const w2 = w[t - 2] as number;
      const s0 = rotr(w15, 7) ^ rotr(w15, 18) ^ (w15 >>> 3);
      const s1 = rotr(w2, 17) ^ rotr(w2, 19) ^ (w2 >>> 10);
      w[t] = (((w[t - 16] as number) + s0 + (w[t - 7] as number) + s1) | 0);
    }
    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;
    for (let t = 0; t < 64; t++) {
      const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + s1 + ch + (SHA256_K[t] as number) + (w[t] as number)) | 0;
      const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (s0 + maj) | 0;
      h = g;
      g = f;
      f = e;
      e = (d + t1) | 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) | 0;
    }
    h0 = (h0 + a) | 0;
    h1 = (h1 + b) | 0;
    h2 = (h2 + c) | 0;
    h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0;
    h5 = (h5 + f) | 0;
    h6 = (h6 + g) | 0;
    h7 = (h7 + h) | 0;
  }
  const words = [h0, h1, h2, h3, h4, h5, h6, h7];
  return words.map((word) => (word >>> 0).toString(16).padStart(8, "0")).join("");
}

/** sha256 over the canonical JSON encoding of any JSON-serializable value. */
export function hashCanonical(value: unknown): Sha256Hex {
  return sha256Hex(canonicalJson(value));
}

/** The blueprint hash every approval/program row binds to. */
export function blueprintHash(blueprint: EnterpriseBlueprint): Sha256Hex {
  return hashCanonical(blueprint);
}

/** Payload hash materializers present to the approval gate. */
export function enterpriseApprovalPayloadHash(payload: unknown): Sha256Hex {
  return hashCanonical(payload);
}

// ── Blueprint generator ──────────────────────────────────────────

export const GenerateBlueprintInputSchema = z
  .object({
    preset: EnterprisePresetSchema,
    programId: EnterpriseKeySchema,
    name: z.string().min(1).max(255),
    mission: z.string().min(1).max(2000),
    budget: EnterpriseBudgetSchema,
    /**
     * Skills actually available (vetted) in the platform registry. Contracts
     * whose pin is in this list are marked staffed=true; unknown ids are
     * ignored — they never create contracts or roles.
     */
    availableSkillIds: z.array(z.string().min(1).max(80)).max(64).default([]),
    maxReplans: z.number().int().min(0).max(10),
    maxConcurrentRuns: z.number().int().positive().max(64),
  })
  .strict();
export type GenerateBlueprintInput = z.infer<typeof GenerateBlueprintInputSchema>;

interface PresetCompany {
  key: string;
  name: string;
  kind: CompanyKind;
  disciplines: readonly Discipline[];
  capacityShare: number;
  mission: string;
}

/**
 * creative_technology_group preset: four line companies plus the shared-
 * services company. Declaration order is irrelevant — every output list is
 * sorted by key before hashing.
 */
const CREATIVE_TECHNOLOGY_GROUP_COMPANIES: readonly PresetCompany[] = [
  {
    key: "software",
    name: "Software Line Company",
    kind: "line",
    disciplines: ["backend-engineering", "computational-geometry"],
    capacityShare: 30,
    mission: "Design, build, and verify software systems and geometric engines.",
  },
  {
    key: "ai-cyber",
    name: "AI & Cybersecurity Line Company",
    kind: "line",
    disciplines: ["ai-research", "cybersecurity", "mathematics"],
    capacityShare: 25,
    mission: "Advance AI research and defensive security with mathematical rigor.",
  },
  {
    key: "civilization-design",
    name: "Civilization Design Line Company",
    kind: "line",
    disciplines: ["design", "mathematics"],
    capacityShare: 15,
    mission: "Research and design artifacts, systems, and narratives for civilization-scale problems.",
  },
  {
    key: "music",
    name: "Music Production Line Company",
    kind: "line",
    disciplines: ["music-production", "design"],
    capacityShare: 15,
    mission: "Produce music and audio works grounded in theory and production engineering.",
  },
  {
    key: "shared-services",
    name: "Shared Services Company",
    kind: "shared-services",
    disciplines: DISCIPLINES,
    capacityShare: 15,
    mission: "Provide shared disciplinary departments under contract to the line companies.",
  },
];

const DISCIPLINE_LABELS: Record<Discipline, string> = {
  mathematics: "Mathematics",
  "computational-geometry": "Computational Geometry",
  "backend-engineering": "Backend Engineering",
  cybersecurity: "Cybersecurity",
  "ai-research": "AI Research",
  design: "Design",
  "music-production": "Music Production",
};

/** Shared-service department key for a discipline (7 departments total). */
export function sharedServiceDepartmentKey(discipline: Discipline): string {
  return `svc-${discipline}`;
}

/**
 * Deterministically generate the enterprise blueprint for a preset. Pure:
 * same input → byte-identical canonical JSON. Unknown availableSkillIds are
 * ignored (never staffed, never expanded into invented roles); the result is
 * re-validated through EnterpriseBlueprintSchema so any internal inconsistency
 * (duplicate keys, undeclared skills) fails loudly instead of shipping a bad
 * blueprint.
 */
export function generateEnterpriseBlueprint(
  rawInput: GenerateBlueprintInput,
): EnterpriseBlueprint {
  const parsed = GenerateBlueprintInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new EnterpriseContractError(
      "invalid-generator-input",
      parsed.error.issues
        .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
        .join("; "),
    );
  }
  const input = parsed.data;
  if (input.preset !== "creative_technology_group") {
    throw new EnterpriseContractError(
      "unknown-preset",
      `unknown enterprise preset "${String(input.preset)}"`,
    );
  }

  const available = new Set(input.availableSkillIds);
  // Every skill the generator may pin is declared in DISCIPLINE_SKILLS; an
  // available id outside the map is ignored rather than role-invented.

  const companies: EnterpriseCompany[] = CREATIVE_TECHNOLOGY_GROUP_COMPANIES.map(
    (c) => ({
      key: c.key,
      name: c.name,
      kind: c.kind,
      mission: c.mission,
      disciplines: [...c.disciplines].sort(),
      capacityShare: c.capacityShare,
    }),
  ).sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));

  const departments: Department[] = DISCIPLINES.map((discipline) => ({
    key: sharedServiceDepartmentKey(discipline),
    companyKey: "shared-services",
    name: `${DISCIPLINE_LABELS[discipline]} Shared Service`,
    discipline,
  })).sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));

  // Deterministic cross-company department contracts: every line company
  // contracts each shared-service department matching one of its disciplines.
  const contracts: WorkerContract[] = [];
  for (const company of CREATIVE_TECHNOLOGY_GROUP_COMPANIES) {
    if (company.kind !== "line") continue;
    const disciplines = [...company.disciplines].sort();
    for (const discipline of disciplines) {
      const skillIds = DISCIPLINE_SKILLS[discipline];
      const skillId = skillIds[0] as string; // primary pin (deterministic)
      contracts.push({
        key: `${company.key}--${sharedServiceDepartmentKey(discipline)}`,
        companyKey: company.key,
        departmentKey: sharedServiceDepartmentKey(discipline),
        discipline,
        status: "proposed",
        version: 1,
        capacityShare: 1 / disciplines.length,
        skillPin: { skillId, version: "0.0.0", sha256: null },
        staffed: available.has(skillId),
      });
    }
  }
  contracts.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));

  const candidate = {
    contractVersion: ENTERPRISE_CONTRACT_VERSION,
    preset: input.preset,
    programId: input.programId,
    name: input.name,
    mission: input.mission,
    companies,
    departments,
    contracts,
    budget: input.budget,
    maxReplans: input.maxReplans,
    maxConcurrentRuns: input.maxConcurrentRuns,
  };
  const validated = EnterpriseBlueprintSchema.safeParse(candidate);
  if (!validated.success) {
    throw new EnterpriseContractError(
      "blueprint-validation-failed",
      validated.error.issues
        .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
        .join("; "),
    );
  }
  return validated.data;
}

// ── Budget partitioning (integer largest remainder) ──────────────

export const PartitionRequestSchema = z.object({
  companyKey: EnterpriseKeySchema,
  /** Relative weight; only active companies receive capacity. */
  capacityShare: z.number().int().positive(),
  active: z.boolean(),
});
export type PartitionRequest = z.infer<typeof PartitionRequestSchema>;

export const BudgetPartitionSchema = z.object({
  companyKey: EnterpriseKeySchema,
  active: z.boolean(),
  capacityShare: z.number().int().positive(),
  reservation: EnterpriseReservationSchema,
});
export type BudgetPartition = z.infer<typeof BudgetPartitionSchema>;

export interface PartitionResult {
  envelope: EnterpriseBudget;
  partitions: BudgetPartition[];
  /** Sum over ACTIVE reservations only. */
  totals: EnterpriseReservation;
  /** Proof flag: totals <= envelope in every dimension. */
  withinEnvelope: boolean;
}

/**
 * Hamilton/largest-remainder apportionment over integer units, computed in
 * BigInt so rounding is exact at any budget scale. Ties on remainder are
 * broken by ascending companyKey (stable, engine-independent). Inactive
 * companies receive a zero reservation and are excluded from the apportionment
 * base.
 */
function partitionUnits(
  totalUnits: bigint,
  requests: readonly PartitionRequest[],
): Map<string, bigint> {
  const out = new Map<string, bigint>();
  for (const r of requests) out.set(r.companyKey, 0n);
  const active = requests.filter((r) => r.active);
  if (active.length === 0 || totalUnits <= 0n) return out;
  const weightSum = active.reduce(
    (acc, r) => acc + BigInt(r.capacityShare),
    0n,
  );
  const quotas = active.map((r) => {
    const product = totalUnits * BigInt(r.capacityShare);
    return {
      key: r.companyKey,
      floor: product / weightSum,
      remainder: product % weightSum,
    };
  });
  let leftover =
    totalUnits - quotas.reduce((acc, q) => acc + q.floor, 0n);
  const order = [...quotas].sort((a, b) => {
    if (a.remainder !== b.remainder) return a.remainder > b.remainder ? -1 : 1;
    return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
  });
  for (const q of order) {
    if (leftover <= 0n) break;
    q.floor += 1n;
    leftover -= 1n;
  }
  for (const q of quotas) out.set(q.key, q.floor);
  return out;
}

function reservationWithin(
  reservation: EnterpriseReservation,
  envelope: EnterpriseBudget,
): boolean {
  return (
    reservation.maxTokens <= envelope.maxTokens &&
    reservation.maxCalls <= envelope.maxCalls &&
    reservation.maxMinutes <= envelope.maxMinutes &&
    reservation.maxCostUsdMicros <= envelope.maxCostUsdMicros
  );
}

/**
 * Partition an enterprise budget envelope across companies. Guarantees (and
 * reports) sum(active reservations) <= envelope in every dimension; the proof
 * is by construction (floors + leftover distribution) and re-checked here.
 *
 * Throws EnterpriseContractError on duplicate company keys or invalid input —
 * partitioning never silently merges or drops companies.
 */
export function partitionBudget(
  rawEnvelope: EnterpriseBudget,
  rawRequests: readonly PartitionRequest[],
): PartitionResult {
  const envelope = EnterpriseBudgetSchema.safeParse(rawEnvelope);
  if (!envelope.success) {
    throw new EnterpriseContractError(
      "invalid-envelope",
      envelope.error.issues
        .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
        .join("; "),
    );
  }
  const requests = z.array(PartitionRequestSchema).safeParse(rawRequests);
  if (!requests.success) {
    throw new EnterpriseContractError(
      "invalid-partition-request",
      requests.error.issues
        .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
        .join("; "),
    );
  }
  const seen = new Set<string>();
  for (const r of requests.data) {
    if (seen.has(r.companyKey)) {
      throw new EnterpriseContractError(
        "duplicate-partition-key",
        `duplicate company key "${r.companyKey}" in partition requests`,
      );
    }
    seen.add(r.companyKey);
  }

  const env = envelope.data;
  const tokens = partitionUnits(BigInt(env.maxTokens), requests.data);
  const calls = partitionUnits(BigInt(env.maxCalls), requests.data);
  const minutes = partitionUnits(
    BigInt(Math.round(env.maxMinutes * 1000)) ,
    requests.data,
  );
  const micros = partitionUnits(BigInt(env.maxCostUsdMicros), requests.data);

  const partitions: BudgetPartition[] = requests.data.map((r) => ({
    companyKey: r.companyKey,
    active: r.active,
    capacityShare: r.capacityShare,
    reservation: {
      maxTokens: Number(tokens.get(r.companyKey) ?? 0n),
      maxCalls: Number(calls.get(r.companyKey) ?? 0n),
      maxMinutes: Number(minutes.get(r.companyKey) ?? 0n) / 1000,
      maxCostUsdMicros: Number(micros.get(r.companyKey) ?? 0n),
    },
  }));

  // Sum ACTIVE reservations in integer units (milli-minutes for time) so the
  // envelope proof never drifts on float accumulation.
  let totalTokens = 0n;
  let totalCalls = 0n;
  let totalMinutesMilli = 0n;
  let totalMicros = 0n;
  for (const p of partitions) {
    if (!p.active) continue;
    totalTokens += tokens.get(p.companyKey) ?? 0n;
    totalCalls += calls.get(p.companyKey) ?? 0n;
    totalMinutesMilli += minutes.get(p.companyKey) ?? 0n;
    totalMicros += micros.get(p.companyKey) ?? 0n;
  }
  const totals: EnterpriseReservation = {
    maxTokens: Number(totalTokens),
    maxCalls: Number(totalCalls),
    maxMinutes: Number(totalMinutesMilli) / 1000,
    maxCostUsdMicros: Number(totalMicros),
  };
  const withinEnvelope = reservationWithin(totals, env);
  if (!withinEnvelope) {
    // Defensive: largest-remainder construction makes this unreachable, but a
    // budget contract must fail loudly rather than overspend silently.
    throw new EnterpriseContractError(
      "partition-overspend",
      `active reservations exceed envelope: ${canonicalJson(totals)} > ${canonicalJson(env)}`,
    );
  }
  return { envelope: env, partitions, totals, withinEnvelope };
}

// ── Derived view (graph + list rows from ONE source) ─────────────

export const EnterpriseSnapshotSchema = z.object({
  blueprint: EnterpriseBlueprintSchema,
  program: EnterpriseProgramSchema.nullable().default(null),
});
export type EnterpriseSnapshot = z.infer<typeof EnterpriseSnapshotSchema>;

export type EnterpriseNodeKind = "company" | "department" | "contract";

export interface EnterpriseCompanyRow {
  key: string;
  name: string;
  kind: CompanyKind;
  capacityShare: number;
  disciplines: Discipline[];
  departmentCount: number;
  contractCount: number;
}

export interface EnterpriseDepartmentRow {
  key: string;
  companyKey: string;
  name: string;
  discipline: Discipline;
  contractCount: number;
}

export interface EnterpriseContractRow {
  key: string;
  companyKey: string;
  departmentKey: string;
  discipline: Discipline;
  status: WorkerContractStatus;
  staffed: boolean;
  skillId: string;
}

export interface EnterpriseViewNode {
  key: string;
  kind: EnterpriseNodeKind;
  label: string;
  parentKey: string | null;
  status: WorkerContractStatus | null;
}

export interface EnterpriseViewEdge {
  /** `${kind}:${from}->${to}` — unique, stable. */
  key: string;
  from: string;
  to: string;
  kind: "contains" | "serves";
}

export interface EnterpriseView {
  graph: { nodes: EnterpriseViewNode[]; edges: EnterpriseViewEdge[] };
  lists: {
    companies: EnterpriseCompanyRow[];
    departments: EnterpriseDepartmentRow[];
    contracts: EnterpriseContractRow[];
  };
}

/**
 * Project an enterprise snapshot into graph nodes/edges AND list rows from a
 * single derivation pass. Parity invariant: for each kind, graph node keys
 * are exactly the list row keys (the nodes are built FROM the rows), and
 * every edge endpoint is an existing node key.
 */
export function deriveEnterpriseView(
  rawSnapshot: EnterpriseSnapshot,
): EnterpriseView {
  const snapshot = EnterpriseSnapshotSchema.parse(rawSnapshot);
  const { blueprint } = snapshot;

  const departmentCountByCompany = new Map<string, number>();
  for (const d of blueprint.departments) {
    departmentCountByCompany.set(
      d.companyKey,
      (departmentCountByCompany.get(d.companyKey) ?? 0) + 1,
    );
  }
  const contractCountByCompany = new Map<string, number>();
  const contractCountByDepartment = new Map<string, number>();
  for (const w of blueprint.contracts) {
    contractCountByCompany.set(
      w.companyKey,
      (contractCountByCompany.get(w.companyKey) ?? 0) + 1,
    );
    contractCountByDepartment.set(
      w.departmentKey,
      (contractCountByDepartment.get(w.departmentKey) ?? 0) + 1,
    );
  }

  // One source: build the list rows first…
  const companies: EnterpriseCompanyRow[] = blueprint.companies.map((c) => ({
    key: c.key,
    name: c.name,
    kind: c.kind,
    capacityShare: c.capacityShare,
    disciplines: [...c.disciplines].sort(),
    departmentCount: departmentCountByCompany.get(c.key) ?? 0,
    contractCount: contractCountByCompany.get(c.key) ?? 0,
  }));
  const departments: EnterpriseDepartmentRow[] = blueprint.departments.map(
    (d) => ({
      key: d.key,
      companyKey: d.companyKey,
      name: d.name,
      discipline: d.discipline,
      contractCount: contractCountByDepartment.get(d.key) ?? 0,
    }),
  );
  const contracts: EnterpriseContractRow[] = blueprint.contracts.map((w) => ({
    key: w.key,
    companyKey: w.companyKey,
    departmentKey: w.departmentKey,
    discipline: w.discipline,
    status: w.status,
    staffed: w.staffed,
    skillId: w.skillPin.skillId,
  }));

  // …then derive graph nodes FROM the rows (parity by construction).
  const nodes: EnterpriseViewNode[] = [
    ...companies.map(
      (c): EnterpriseViewNode => ({
        key: c.key,
        kind: "company",
        label: c.name,
        parentKey: null,
        status: null,
      }),
    ),
    ...departments.map(
      (d): EnterpriseViewNode => ({
        key: d.key,
        kind: "department",
        label: d.name,
        parentKey: d.companyKey,
        status: null,
      }),
    ),
    ...contracts.map(
      (w): EnterpriseViewNode => ({
        key: w.key,
        kind: "contract",
        label: w.key,
        parentKey: w.departmentKey,
        status: w.status,
      }),
    ),
  ];

  const departmentCompany = new Map(
    blueprint.departments.map((d) => [d.key, d.companyKey]),
  );
  const edges: EnterpriseViewEdge[] = [];
  for (const d of departments) {
    edges.push({
      key: `contains:${d.companyKey}->${d.key}`,
      from: d.companyKey,
      to: d.key,
      kind: "contains",
    });
  }
  for (const w of contracts) {
    edges.push({
      key: `contains:${w.departmentKey}->${w.key}`,
      from: w.departmentKey,
      to: w.key,
      kind: "contains",
    });
    const owner = departmentCompany.get(w.departmentKey) ?? null;
    if (owner !== null && owner !== w.companyKey) {
      edges.push({
        key: `serves:${w.key}->${w.companyKey}`,
        from: w.key,
        to: w.companyKey,
        kind: "serves",
      });
    }
  }

  return {
    graph: { nodes, edges },
    lists: { companies, departments, contracts },
  };
}

// ── Operations DTOs (token-free) ─────────────────────────────────
//
// These DTOs drive desktop/web work ledgers, timeline indexes, and
// per-employee controls. They are TOKEN-FREE: no raw prompt text, no raw
// completions, no chain-of-thought, and NO provider-generated summaries.
// Text fields are bounded; returnedSummary/summary are EXTRACTIVE (spans
// copied from an artifact by the system, with explicit truncation metadata).

export const WORK_LEDGER_KINDS = [
  "assignment",
  "prompt_started",
  "returned",
  "artifact",
  "approval",
  "waiting",
  "error",
] as const;
export const WorkLedgerKindSchema = z.enum(WORK_LEDGER_KINDS);
export type WorkLedgerKind = z.infer<typeof WorkLedgerKindSchema>;

export const LEDGER_TEXT_CAPS = {
  intendedAsk: 1000,
  returnedSummary: 2000,
} as const;

/** Platform id: numeric (web DB) or string (desktop store). */
export const PlatformIdSchema = z.union([
  z.string().min(1).max(128),
  z.number().int().positive(),
]);
export type PlatformId = z.infer<typeof PlatformIdSchema>;

export const LedgerUsageSchema = z.object({
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  costUsdMicros: z.number().int().nonnegative(),
});
export type LedgerUsage = z.infer<typeof LedgerUsageSchema>;

export const WorkLedgerEntrySchema = z
  .object({
    /** Monotonic per-enterprise sequence (1-based, gap-free per stream). */
    seq: z.number().int().positive(),
    /** Epoch milliseconds. */
    ts: z.number().int().nonnegative(),
    enterpriseId: EnterpriseKeySchema.nullable().default(null),
    companyKey: EnterpriseKeySchema.nullable().default(null),
    projectId: PlatformIdSchema.nullable().default(null),
    officeId: EnterpriseKeySchema.nullable().default(null),
    roomId: EnterpriseKeySchema.nullable().default(null),
    workerId: PlatformIdSchema.nullable().default(null),
    nodeKey: EnterpriseKeySchema.nullable().default(null),
    runId: PlatformIdSchema.nullable().default(null),
    attempt: z.number().int().positive().nullable().default(null),
    kind: WorkLedgerKindSchema,
    status: z.string().min(1).max(64),
    /**
     * Bounded plain-text statement of what the worker was asked to do.
     * NEVER the raw prompt and never chain-of-thought.
     */
    intendedAsk: z.string().max(LEDGER_TEXT_CAPS.intendedAsk).default(""),
    /** Integrity hash of the exact prompt sent; the text itself is not stored. */
    promptSha256: Sha256HexSchema.nullable().default(null),
    /**
     * Bounded EXTRACTIVE summary: spans copied from the returned artifact by
     * the system. Never a provider-generated summary.
     */
    returnedSummary: z
      .string()
      .max(LEDGER_TEXT_CAPS.returnedSummary)
      .default(""),
    artifactRef: ArtifactRefSchema.nullable().default(null),
    usage: LedgerUsageSchema.nullable().default(null),
    skillRef: z.string().min(1).max(80).nullable().default(null),
  })
  .strict();
export type WorkLedgerEntry = z.infer<typeof WorkLedgerEntrySchema>;

/** One end of a handoff (worker/node and/or org placement). */
export const HandoffEndpointRefSchema = z
  .object({
    workerId: PlatformIdSchema.nullable().default(null),
    nodeKey: EnterpriseKeySchema.nullable().default(null),
    companyKey: EnterpriseKeySchema.nullable().default(null),
    departmentKey: EnterpriseKeySchema.nullable().default(null),
  })
  .strict();
export type HandoffEndpointRef = z.infer<typeof HandoffEndpointRefSchema>;

export const TruncationInfoSchema = z.object({
  truncated: z.boolean(),
  originalLength: z.number().int().nonnegative(),
  keptLength: z.number().int().nonnegative(),
});
export type TruncationInfo = z.infer<typeof TruncationInfoSchema>;

/**
 * Handoff manifest: carries content BETWEEN workers by reference + hash, with
 * a bounded extractive summary and explicit truncation/provenance. The
 * summary is system-derived; no provider call is involved.
 */
export const HandoffManifestSchema = z
  .object({
    from: HandoffEndpointRefSchema,
    to: HandoffEndpointRefSchema,
    /** Bounded extractive summary of the handed-off content. */
    summary: z.string().max(LEDGER_TEXT_CAPS.returnedSummary).default(""),
    /** sha256 of the full handed-off content (stored by reference, not inline). */
    contentSha256: Sha256HexSchema,
    truncation: TruncationInfoSchema,
    provenance: z
      .object({
        /** Ledger entry whose artifact/result this handoff carries. */
        sourceLedgerSeq: z.number().int().positive().nullable().default(null),
        sourceArtifactRef: ArtifactRefSchema.nullable().default(null),
        /** Always "system": handoffs are deterministic derivations, never LLM work. */
        derivedBy: z.literal("system"),
      })
      .strict(),
  })
  .strict();
export type HandoffManifest = z.infer<typeof HandoffManifestSchema>;

export const TimelineIndexEntrySchema = z
  .object({
    /** Monotonic timeline order (1-based), derived from the ledger. */
    seq: z.number().int().positive(),
    ts: z.number().int().nonnegative(),
    kind: WorkLedgerKindSchema,
    enterpriseId: EnterpriseKeySchema.nullable().default(null),
    companyKey: EnterpriseKeySchema.nullable().default(null),
    workerId: PlatformIdSchema.nullable().default(null),
    nodeKey: EnterpriseKeySchema.nullable().default(null),
    runId: PlatformIdSchema.nullable().default(null),
    /** Back-pointer to the source ledger entry. */
    ledgerSeq: z.number().int().positive().nullable().default(null),
    artifactRef: ArtifactRefSchema.nullable().default(null),
  })
  .strict();
export type TimelineIndexEntry = z.infer<typeof TimelineIndexEntrySchema>;

/**
 * Derive the timeline index from a work ledger. Pure/system derivation:
 * entries are sorted by (ts, seq) and re-indexed 1..n with a ledgerSeq
 * back-pointer. Duplicate ledger seqs are rejected — an index must never
 * silently collapse two ledger events.
 */
export function deriveTimelineIndex(
  rawLedger: readonly WorkLedgerEntry[],
): TimelineIndexEntry[] {
  const ledger = z.array(WorkLedgerEntrySchema).parse(rawLedger);
  const seenSeqs = new Set<number>();
  for (const entry of ledger) {
    if (seenSeqs.has(entry.seq)) {
      throw new EnterpriseContractError(
        "duplicate-ledger-seq",
        `duplicate ledger seq ${entry.seq}`,
      );
    }
    seenSeqs.add(entry.seq);
  }
  const ordered = [...ledger].sort((a, b) => a.ts - b.ts || a.seq - b.seq);
  return ordered.map((entry, index) => ({
    seq: index + 1,
    ts: entry.ts,
    kind: entry.kind,
    enterpriseId: entry.enterpriseId,
    companyKey: entry.companyKey,
    workerId: entry.workerId,
    nodeKey: entry.nodeKey,
    runId: entry.runId,
    ledgerSeq: entry.seq,
    artifactRef: entry.artifactRef,
  }));
}

// ── Declarative action registry ──────────────────────────────────

export const ENTERPRISE_CAPABILITIES = [
  "read",
  "propose",
  "apply",
  "decide",
  "operate",
  "reassign",
  "promote",
] as const;
export const EnterpriseCapabilitySchema = z.enum(ENTERPRISE_CAPABILITIES);
export type EnterpriseCapability = z.infer<typeof EnterpriseCapabilitySchema>;

export const EnterpriseActionSchema = z
  .object({
    /** Stable view/control id used by feature-connection graphs and controls. */
    id: z.string().min(1).max(64),
    /** Operation name dispatched by the control plane. */
    operation: z.string().min(1).max(64),
    capability: EnterpriseCapabilitySchema,
    /** Approval kind the operation must present, or null when ungated. */
    approval: EnterpriseApprovalKindSchema.nullable(),
    description: z.string().max(500),
  })
  .strict();
export type EnterpriseAction = z.infer<typeof EnterpriseActionSchema>;

/**
 * The closed registry of enterprise actions. Renderers map these ids to
 * view/control surfaces; the control plane maps them to operations; both
 * sides share this single list (action parity by construction). Stewards and
 * office workers may only ever PROPOSE these — never execute them.
 */
export const ENTERPRISE_ACTIONS: readonly EnterpriseAction[] = [
  {
    id: "blueprint.apply",
    operation: "apply-blueprint",
    capability: "apply",
    approval: "blueprint-activation",
    description:
      "Materialize an approved blueprint (companies/departments/contracts) into platform state.",
  },
  {
    id: "contract.decide",
    operation: "decide-contract",
    capability: "decide",
    approval: null,
    description:
      "Approve or reject a proposed worker contract (the decision IS the gate).",
  },
  {
    id: "contract.release",
    operation: "release-contract",
    capability: "operate",
    approval: null,
    description: "Release an active/draining contract back to the pool.",
  },
  {
    id: "program.start",
    operation: "start-program",
    capability: "operate",
    approval: "plan",
    description: "Start dispatching company runs for an approved program.",
  },
  {
    id: "program.pause",
    operation: "pause-program",
    capability: "operate",
    approval: null,
    description: "Pause a running program (leases keep draining).",
  },
  {
    id: "program.resume",
    operation: "resume-program",
    capability: "operate",
    approval: null,
    description: "Resume a paused program.",
  },
  {
    id: "program.cancel",
    operation: "cancel-program",
    capability: "operate",
    approval: null,
    description: "Cancel a program and stop all company runs.",
  },
  {
    id: "worker.reassign",
    operation: "reassign-worker",
    capability: "reassign",
    approval: null,
    description: "Reassign a worker to a different node/room/department.",
  },
  {
    id: "worker.capacity",
    operation: "adjust-worker-capacity",
    capability: "operate",
    approval: null,
    description: "Adjust a worker contract capacity share.",
  },
  {
    id: "worker.suspend",
    operation: "suspend-worker",
    capability: "operate",
    approval: null,
    description: "Suspend a worker contract (no new claims).",
  },
  {
    id: "memory.promote",
    operation: "promote-memory",
    capability: "promote",
    approval: "memory-promote",
    description:
      "Promote an artifact reference into a wider memory scope (by ref only).",
  },
  {
    id: "memory.revoke",
    operation: "revoke-memory",
    capability: "promote",
    approval: null,
    description: "Revoke a promoted memory entry.",
  },
] as const;

// ── Permanent steward roles (system, propose-only) ───────────────

export const PERMANENT_STEWARD_ROLE_NAMES = [
  "blueprint-ops",
  "roadmap-cartographer",
  "evidence-ledger-steward",
  "cache-budget-steward",
] as const;
export const PermanentStewardRoleNameSchema = z.enum(
  PERMANENT_STEWARD_ROLE_NAMES,
);
export type PermanentStewardRoleName =
  (typeof PERMANENT_STEWARD_ROLE_NAMES)[number];

export const PermanentStewardRoleSchema = z
  .object({
    name: PermanentStewardRoleNameSchema,
    title: z.string().min(1).max(255),
    /** Stewards are system derivations, never provider-backed agents. */
    actor: z.literal("system"),
    /** Propose-only: they can never execute ENTERPRISE_ACTIONS or mutate state. */
    authority: z.literal("propose-only"),
    /** Hard guarantees: no provider calls, no node execution, no external writes. */
    providerCalls: z.literal(false),
    executesNodes: z.literal(false),
    externalWrites: z.literal(false),
    derivation: z.literal("deterministic"),
    capabilities: z.array(z.string().min(1).max(64)).max(16),
    description: z.string().max(500),
  })
  .strict();
export type PermanentStewardRole = z.infer<typeof PermanentStewardRoleSchema>;

/**
 * Permanent seeded steward roles. Their outputs (ledger/handoff/cache/budget
 * recommendations) are deterministic system derivations over existing state —
 * not LLM work. They hold no budget, make no provider calls, and cannot
 * execute or write externally.
 */
export const PERMANENT_STEWARD_ROLES: Record<
  PermanentStewardRoleName,
  PermanentStewardRole
> = {
  "blueprint-ops": {
    name: "blueprint-ops",
    title: "Blueprint Ops Manager",
    actor: "system",
    authority: "propose-only",
    providerCalls: false,
    executesNodes: false,
    externalWrites: false,
    derivation: "deterministic",
    capabilities: ["read", "summarize", "classify"],
    description:
      "Derives blueprint/drift observations and handoff proposals from enterprise state.",
  },
  "roadmap-cartographer": {
    name: "roadmap-cartographer",
    title: "Roadmap Cartographer",
    actor: "system",
    authority: "propose-only",
    providerCalls: false,
    executesNodes: false,
    externalWrites: false,
    derivation: "deterministic",
    capabilities: ["read", "summarize", "compare", "cite"],
    description:
      "Derives roadmap/graph projections (feature-connection graphs) from the enterprise view.",
  },
  "evidence-ledger-steward": {
    name: "evidence-ledger-steward",
    title: "Evidence Ledger Steward",
    actor: "system",
    authority: "propose-only",
    providerCalls: false,
    executesNodes: false,
    externalWrites: false,
    derivation: "deterministic",
    capabilities: ["read", "classify", "cite"],
    description:
      "Derives ledger/timeline indexing recommendations and memory promotion candidates (by ref).",
  },
  "cache-budget-steward": {
    name: "cache-budget-steward",
    title: "Cache & Budget Steward",
    actor: "system",
    authority: "propose-only",
    providerCalls: false,
    executesNodes: false,
    externalWrites: false,
    derivation: "deterministic",
    capabilities: ["read", "compare", "classify"],
    description:
      "Derives cache-reuse and budget-rebalance recommendations from usage rollups.",
  },
};

export const STEWARD_RECOMMENDATION_KINDS = [
  "ledger",
  "handoff",
  "cache",
  "budget",
] as const;
export const StewardRecommendationKindSchema = z.enum(
  STEWARD_RECOMMENDATION_KINDS,
);
export type StewardRecommendationKind = z.infer<
  typeof StewardRecommendationKindSchema
>;

/**
 * A steward recommendation. Always system-derived (derivedBy "system",
 * providerCalls false); carries a bounded extractive summary and references,
 * never raw content. A recommendation is a PROPOSAL: applying it requires the
 * matching ENTERPRISE_ACTIONS gate.
 */
export const StewardRecommendationSchema = z
  .object({
    steward: PermanentStewardRoleNameSchema,
    kind: StewardRecommendationKindSchema,
    derivedBy: z.literal("system"),
    providerCalls: z.literal(false),
    summary: z.string().max(LEDGER_TEXT_CAPS.returnedSummary),
    refs: z.array(ArtifactRefSchema).max(16).default([]),
    ledgerSeq: z.number().int().positive().nullable().default(null),
    /** Action id from ENTERPRISE_ACTIONS that would apply this proposal, or null. */
    actionId: z.string().min(1).max(64).nullable().default(null),
  })
  .strict();
export type StewardRecommendation = z.infer<typeof StewardRecommendationSchema>;
