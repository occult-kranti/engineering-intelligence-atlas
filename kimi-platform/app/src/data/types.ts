export interface Role {
  function: string;
  name: string;
  mission: string;
  outputs: string;
  skills: string;
  senior: string;
  interfaces: string;
  source: string;
}

export interface Resource {
  domain: string;
  name: string;
  type: string;
  level: string;
  url: string;
  purpose: string;
  prereqs: string;
  access: string;
  license: string;
  caveat: string;
  verified: string;
}

export interface AgentRepo {
  domain: string;
  repository: string;
  url: string;
  official: string;
  purpose: string;
  status: string;
  license: string;
  pushedAt: string | null;
  stars: number | null;
  verified: string;
  caveat: string;
}

export interface SkillEntry {
  vendor: string;
  name: string;
  url: string;
  type: string;
  status: string;
  license: string;
  verified: string;
  caveat: string;
}

export interface TopicSearch {
  domain: string;
  tags: string;
  query: string;
  url: string;
  verified: string;
  caveat: string;
}

export interface Community {
  domain: string;
  name: string;
  platform: string;
  url: string;
  official: string;
  access: string;
  verified: string;
  caveat: string;
}

export interface Lead {
  company: string;
  title: string;
  family: string;
  location: string;
  qualificationSummary: string;
  officialUrl: string;
  evidenceUrl: string;
  evidenceClass: string;
  retrieved: string;
  liveStatus: string;
  note: string;
}

export interface Paper {
  title: string;
  authors: string;
  year: string;
  citations: number;
  publicationInfo: string;
  url: string;
  collection: string;
}

export interface JobExample {
  company: string;
  title: string;
  url: string;
  category: string;
}

export interface RockstarJob {
  title: string;
  url: string;
  locations: string[];
  department: string;
  postedDate: string;
}

export interface AmazonSample {
  title: string;
  url: string;
  locations: string[];
  postedDate: string;
}

export interface JobsEvidence {
  retrievedAt: string;
  recordCount: number;
  companies: Record<string, number>;
  titleFamilyCounts: Record<string, Record<string, number>>;
  contentFamilyCounts: Record<string, Record<string, number>>;
  skillsByTitleFamily: Record<
    string,
    { jobCount: number; topSkills: [string, number][] }
  >;
  amazonCategoryCounts: Record<string, number>;
  rockstarDepartmentCounts: Record<string, number>;
  seniorityByCompany: Record<string, Record<string, number>>;
  examples: Record<string, JobExample[]>;
  limitations: string[];
  rockstarBoard: RockstarJob[];
  amazonSamples: Record<string, AmazonSample[]>;
}

export interface ReverseEvidence {
  interoperability: {
    n: number;
    updated: string;
    categories: { name: string; slug: string; count: number }[];
    rowCount: number;
  };
  games: {
    generatedAt: string;
    total: number;
    browserPlayable: number;
    uniqueGames: number;
    counts: Record<string, number>;
    inactiveCounts: Record<string, number>;
    inactiveCutoff: string;
    active: number;
    inactive: number;
    topics: Record<string, { name: string; description: string }>;
    modCount: number;
    sources: { name: string; url: string }[];
  };
  reaCatalog: {
    siteUrl: string;
    repositoryUrl: string;
    resourceCount: number;
    independentIntegrationCount: number;
    paperCount: number;
    latestReview: string;
    verificationNote: string;
    sourceIndex: {
      available: boolean;
      resource_count: number;
      scanned_count: number;
      excluded_count: number;
      status: string;
      published_at: string;
      verification: string;
      publication_schema_version?: number;
      full_export?: string;
    };
  };
  repositoryIndex: {
    uniqueRepos: number;
    successfulScans: number;
    attemptedScans: number;
    failed: number;
    status: string;
    completedAt: string;
    publishedSelection: number | null;
  };
  topicSnapshot: {
    retrievedAt: string;
    method: string;
    recordCount: number;
    top: {
      fullName: string;
      url: string;
      description: string;
      stars: number;
      language: string;
      license: string;
      archived: boolean;
    }[];
  };
  officialShowcases: {
    name: string;
    url: string;
    targets: string[];
    evidenceClass: number;
    description: string;
  }[];
  analysis: {
    sourceOccurrences: number;
    uniqueProjects: number;
    /** Projects corroborated by 2+ sources (repository-root grouping). */
    multiSourceProjects: number;
    /** Blank language fields (interop + topic snapshot only); blank = unknown, not "no language". */
    languageBlank: number;
    clusterCount: number;
    perSourceOccurrences: { source: string; count: number }[];
    tierLabels: Record<string, string>;
    tierCounts: { tier: number; label: string; count: number }[];
    overlapPairs: { pair: string; count: number }[];
    gamesFinal: {
      totalRecords: number;
      games: number;
      mods: number;
      typeCounts: Record<string, number>;
      activity: { active: number; inactive: number; unknown: number };
      activityCutoff: string;
      /** HTTP status histogram from the catalog link check. */
      linkStatus: Record<string, number>;
      linkExceptions: Record<string, string>;
      linkOkDisclosure: string;
    };
    mixedClusters: number[];
  };
  clusters: {
    clusterId: number;
    rank: number;
    nDocs: number;
    topTerms: string;
    reps: { name: string; url: string; description: string }[];
  }[];
}

export interface SkillPackage {
  id: string;
  name: string;
  shortName: string;
  accent: "mustard" | "sage" | "cornflower";
  tagline: string;
  description: string;
  domains: string[];
  outputs: string[];
  gates: string[];
}
