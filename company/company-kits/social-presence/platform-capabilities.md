# Social platform capability and connection register

Primary documentation reviewed 21 November 2026. This is research for adapter
selection, not evidence that any account is connected to Daftar. No social
publisher, direct-message sender, paid campaign or continuous listening service
is activated by this kit. Platform scopes, versions and product access must be
rechecked when an adapter is implemented and against the actual owner's account.

## Supported product surfaces and implications

| Platform / surface | Documentation establishes | Daftar implementation decision |
| --- | --- | --- |
| LinkedIn member and organization posts | Posts API separates authenticated-member posting from organization posting; organization actions depend on the member's Page role. Member reading is restricted. Requests carry a supported version header. [L1] | Keep member and organization account identities separate. Validate product access, granted scopes and Page role. Do not promise personal-feed reading, unrestricted inbox access or bulk outreach from publishing permission. |
| LinkedIn Community Management | The program supports company-page management and analytics, with access requirements; its overview says `r_member_social` is closed to new requests at review time. [L2] | Start with a justified organization use case and account-level capability check. Use owner-supplied exports where reading is unavailable. A member-post write capability does not prove analytics/read access. |
| Instagram professional accounts | Current publishing guide covers images, video/reels and carousels, with different login routes and token/scopes; media containers precede publication and have status checks. [M1] | Choose one login route explicitly. Verify the canonical professional account, selected scopes, source media exposure and container result. Do not treat an uploaded container as a live post. |
| Instagram account type | The media endpoint is for professional-account-owned media and excludes personal-account-owned media. [M2] | An individual client can still receive strategy/assets/manual handoffs. Do not promise the same API control for their personal account or silently convert their account type. |
| Facebook Pages | Page feed publishing requires a Page token and the appropriate Page task/permissions; posts appear as the Page. [M3] | Support explicitly authorized Pages, with correct identity and Page task verification. Do not label this as general publishing to an individual's Facebook profile. |
| Facebook Page measurement | Insights have their own read permissions and metric definitions/deprecations. [M4] | Maintain a versioned metric dictionary and display unsupported metrics as unavailable. Do not infer reporting access from write access. |
| YouTube video publishing | Video insert supports metadata and privacy fields. The November 2, 2026 change removed the former private-only restriction for unverified projects; omitted privacy can default to public. [Y1][Y2] | Require an explicit intended audience in every upload packet. Verify current OAuth/project/account access and read back processing/publication state. Do not use the obsolete private-only rule as a safety assumption. |
| YouTube analytics | Analytics and Reporting APIs require authorization by the channel/content owner and offer different report/metric surfaces. [Y3] | Separate channel analytics authorization, source windows and metric names from public video counts. Only expose data actually returned for the authorized owner. |
| YouTube community posts | The November 16, 2026 update describes the posts resource as a pilot limited to selected approved projects. [Y1] | Keep community-post support unavailable unless this application's actual project is admitted. Video upload support is not proof of community-post access. |
| TikTok Direct Post | Current guidelines require a broader audience rather than a private/internal account-management utility. Unaudited clients are restricted to private viewing, and release UX must preserve creator control. [T1] | The personal Daftar setup should use export/manual or an already-authorized compatible third-party workflow. Do not claim that a private internal Direct Post tool can pass audit, nor bypass the restriction through browser automation. |
| X posts | Create/edit post uses OAuth authorization with post-write scope. Feature/account-plan limits still apply; an uploaded media object alone does not guarantee it can be attached. [X1] | Keep text posting, media, replies and other capabilities distinct. Verify the actual account, product access, cost/limits and exact supported action before admitting a release job. Do not infer DM authority from posting. |

The capability decisions in the right column are engineering recommendations
derived from the cited interfaces. They are not announcements of shipped
integrations. SEO tools, email/CRM, social listening and advertising APIs need
their own scoped evaluation; this matrix makes no claim that their connectors
exist. A general API token from a language-model provider cannot authenticate a
social account.

## Account capability record

Record the client's private company/brand ID, platform account ID/type, display
label, authorized account owner, adapter and API-version references, granted
scopes, checked operations, last successful read/write check, token expiry,
revocation state, rate-limit observations and source-documentation review date.
Store only a credential handle, never the credential itself. Keep platform
permissions separate from Daftar employee authority and from the client's
content/release mandate: the operation must satisfy all three.

The UI should distinguish `not-connected`, `authorizing`, `verified-read`,
`verified-write`, `limited`, `expired`, `revoked` and `error`. A successful OAuth
callback is not sufficient to mark every capability available. A valid read
probe proves only the specific read operation tested. External writes need an
authorized target and their own receipt; no public test post should be created
merely to make a green status badge.

## Integration priority

1. **Immediate:** account inventory, private client knowledge, production packets,
   manual handoff and receipt capture. These are useful even without OAuth.
2. **One justified pilot:** select the client's priority supported surface, such
   as an authorized LinkedIn organization, Meta professional/Page account or
   YouTube channel. Confirm actual product eligibility before building deeply.
3. **Read and reporting:** implement only required metrics with source/version,
   sampling window and unavailable-state handling.
4. **Release adapter:** enforce exact target, audience, artifact version and
   current authority; retain upload/processing/publish stages independently.
5. **Durable scheduling:** add persistent queueing, reconciliation, rate-limit
   feedback, cancellation and a visible scheduling receipt. Until this exists,
   the calendar is a plan and external scheduler handoff is labeled as such.
6. **Expand deliberately:** add channels only when the owner has a concrete use
   case, eligible account, measurable outcome and maintainable integration.

## Failure cases that must shape implementation

| Failure | Required behavior |
| --- | --- |
| Token expires after scheduling | Stop that dispatch with a specific reconnect state; retain the approved artifact and prior schedule record. |
| Client/account changes after content approval | Require the applicable authorization to match the current target and revision before dispatch. |
| API accepts an upload but processing fails | Preserve the returned container/upload ID and processing error; never count it as published. |
| Write times out after the provider might have accepted it | Mark uncertain and reconcile by known attempt/provider identifiers before retrying. |
| Cross-channel campaign partly succeeds | Record results per account/variant; provide a partial campaign summary and bounded retry options. |
| Permission is removed while work is queued | Recheck at execution and stop unsupported side effects; keep prior receipts and work. |
| Metric is deprecated or omitted | Preserve the last known value with timestamp, show current unavailability and update the metric definition. |
| Account display name or handle changes | Resolve by verified canonical ID and make label changes visible; do not silently switch destinations. |
| User pauses a company/employee | Prevent new dispatch under that scope; reconcile an already-started external request without blind cancellation claims. |

## Primary references

All links below were retrieved or searched directly in official documentation
on 21 November 2026. They establish documented capabilities, not this project's
approval or an executed integration test. Avoid pinning old version strings from
examples without checking current support.

- **[L1]** [LinkedIn Posts API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api?view=li-lms-2026-08)
- **[L2]** [LinkedIn Community Management overview](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/community-management-overview)
- **[M1]** [Meta: Instagram content publishing](https://developers.facebook.com/documentation/instagram-platform/content-publishing)
- **[M2]** [Meta: Instagram Media endpoint](https://developers.facebook.com/docs/instagram-platform/reference/instagram-media/v21.0/)
- **[M3]** [Meta: Facebook Page feed](https://developers.facebook.com/docs/graph-api/reference/page/feed/)
- **[M4]** [Meta: Page insights](https://developers.facebook.com/docs/graph-api/reference/insights)
- **[Y1]** [YouTube Data API revision history](https://developers.google.com/youtube/data/revision_history), especially 2 and 16 November 2026
- **[Y2]** [YouTube: videos.insert](https://developers.google.com/youtube/data/reference/rest/v3/videos/insert)
- **[Y3]** [YouTube Analytics and Reporting APIs](https://developers.google.com/youtube/reporting)
- **[T1]** [TikTok Content Sharing Guidelines](https://developers.tiktok.com/docs/en/content-sharing-guidelines), page updated 4 August 2026
- **[X1]** [X: create or edit post](https://docs.x.com/x-api/posts/create-post)
