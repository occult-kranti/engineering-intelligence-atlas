declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    ANTHROPIC_API_KEY?: string;
    ATLAS_ADMIN_TOKEN?: string;
    ATLAS_OWNER_EMAIL?: string;
    ATLAS_SITE_ACCESS_TOKEN?: string;
    ATLAS_CLOUD_CAP_USD?: string;
  }
}
