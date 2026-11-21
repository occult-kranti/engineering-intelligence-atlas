# Daftar studio color system

Owner: shared Design and Architecture service, color/accessibility specialist.
Review date: **20 November 2026 (America/New_York)**.
Source implementation: [studio-tokens.css](../desktop-shell/src/renderer/studio-tokens.css).

## Direction and source images

The supplied references suggest two useful working environments: a dark
drafting canvas with connected office nodes, and a light ivory office with warm
metal accents. The user's subsequent direction calls for vivid green and gold.
The revised palette therefore uses a deep violet field, electric green actions,
and warm gold details. Blueprint mode concentrates detail on the dark field;
drafting mode offers a paper-like alternative with violet ink and deep green
controls. Violet connections and gold identity accents remain separate from
operational status. This is an interpretation of the references and the later
color direction, not a measured user preference or an exact image extraction.

The reference images' office hierarchy, linked work, side inspector and nearby
Donna conversation inform layout. Their sample organizations, dates, API badges
and charts are not operational data. They must not be copied as live metrics.
The reference images remain user attachments; this palette is an original
semantic implementation rather than a claim to be an official product theme.

`html[data-theme="blueprint"]` selects the default dark mode;
`html[data-theme="drafting"]` selects the light mode. An absent attribute uses
blueprint mode. Theme preference is presentation state and never changes a
company, permission grant, budget, worker or saved job.

## Semantic palette

| Role / token | Blueprint | Drafting | Use |
| --- | --- | --- | --- |
| `--canvas` | `#151126` | `#F6F2E8` | Main working field |
| `--surface` | `#211B35` | `#FFFDFA` | Cards, forms and inspector |
| `--elevated` | `#2D2544` | `#EEE8DC` | Selected context and raised controls |
| `--ink` | `#F4F1FB` | `#251D36` | Primary text |
| `--muted` | `#BFB4D0` | `#685E75` | Descriptions and supporting labels |
| `--line-strong` | `#887A9F` | `#81718B` | Boundaries needed to identify controls |
| `--accent` | `#BEF264` | `#385D20` | Primary action and selected interactive context |
| `--accent-ink` | `#17220B` | `#FFFFFF` | Text on the solid action fill |
| `--brand-gold` | `#E8BA64` | `#77591B` | Restrained identity/detail accent |
| `--success` | `#A5D6A9` | `#33613A` | An explicitly successful result |
| `--warning` | `#E8C676` | `#795618` | A stated warning or attention condition |
| `--danger` | `#FFAA97` | `#9B352A` | An actual error or destructive action |

Each status color has a paired `-soft` surface. `--line` and the two grid tokens
are decorative separators; use `--line-strong` for an essential control boundary.
Do not use opacity to make required explanatory text appear secondary: use the
measured `--muted` token. Action hover and keyboard focus have their own tokens.

Legacy aliases (`--paper`, `--green`, `--amber`, `--red` and their existing
variants) allow current components to migrate. A legacy green alias is an action
color; it does not imply that every active request succeeded. Components with
hardcoded white backgrounds, white button text or `--green-dark` used as both
foreground and background still require explicit component updates. A token
file by itself does not prove that every screen adopts it correctly.

## Heat maps: amount first, status separately

The same five ordered swatches are used in both modes. Their relative luminance
increases from level 0 to 4. This is an ordinal violet/green/gold intensity scale;
it is not claimed to be perceptually uniform, a probability scale or a measure
of employee quality. High activity is not automatically an error. An actual
failed operation retains its separately labeled error status.

| Level | Swatch | Text on solid swatch | Relative luminance | Text contrast |
| --- | --- | --- | ---: | ---: |
| 0 | `#4B3F68` | `#FFFFFF` | 0.0605 | 9.50:1 |
| 1 | `#71618F` | `#FFFFFF` | 0.1404 | 5.51:1 |
| 2 | `#94B171` | `#151126` | 0.3893 | 7.71:1 |
| 3 | `#C4D88E` | `#151126` | 0.6280 | 11.89:1 |
| 4 | `#F0D38B` | `#151126` | 0.6698 | 12.63:1 |

Large room surfaces use the mode-specific `--heat-fill-0` through
`--heat-fill-4` tints and ordinary `--ink` text. Solid legend chips use
`--heat-0` through `--heat-4` and their corresponding `--heat-ink-*` foreground.
`data-heat-level` supplies `--heat-color`, `--heat-fill`, `--heat-ink` and
`--heat-pattern` for the component. Do not mix the solid-swatch text color with
the pale room tint. The unknown legend marker is the exception: use its
`--heat-fill` with `--heat-ink` and a dashed boundary. Its `--heat-color` is a
boundary color and is not the measured background for the question mark.

The analytics contract owns the thresholds, counts and explanatory wording:

| Metric | Levels 0 / 1 / 2 / 3 / 4 | Meaning |
| --- | --- | --- |
| Workload | 0 / 1–2 / 3–5 / 6–9 / 10+ unresolved jobs | Recorded work assigned in the selected scope; not a percentage of human or machine capacity |
| Attention | 0 / 1 / 2–3 / 4–5 / 6+ distinct jobs requiring attention | A count with recorded reasons; not a security-risk score |
| Budget | 0 / above 0 to below 50% / 50% to below 80% / 80% to below 100% / 100%+ | Recorded committed amount against applicable recorded job ceilings; not the global remaining balance |

The fixed thresholds remain comparable while switching rooms or departments.
The selected metric, scope, unit, bucket thresholds and exact value must remain
visible. A data-based percentage needs its numerator and denominator; do not
invent a capacity denominator or quietly normalize each visible board to its
largest value. The backend contract is documented in [office signals](OFFICE_SIGNALS.md).

`unknown` is separate from a measured zero. No applicable records, stale or
partial data, an invalid scope, or a missing budget denominator must not become
a reassuring zero. Show **Unknown** and its reason with a dashed marker;
optional diagonal hatching reinforces the distinction. A positive recorded
commitment against an explicitly zero ceiling may be a separately explained
over-limit result, even though a percentage cannot be computed. The exact
analytics result controls that distinction.

Visible labels and numeric/ordinal values carry the meaning in addition to
color. Adjacent heat swatches do not all differ by 3:1, so hue or shade alone
cannot be the information channel. W3C's use-of-color guidance calls for an
additional visible cue, such as text or shape; an accessible name alone does
not replace a visible alternative for sighted users who cannot distinguish
the colors. [W3C: Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html)

## Calculated contrast and scope of the check

Normal text was checked against a 4.5:1 threshold; selected essential boundaries
and focus colors against 3:1. These thresholds come from W3C's
[Contrast Minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
and [Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)
guidance. Values below are displayed rounded, but acceptance used the unrounded
ratios. The calculation uses the specified sRGB foreground and background values.

| Tested pair | Blueprint | Drafting |
| --- | ---: | ---: |
| Primary text / main surface | 14.79:1 | 15.82:1 |
| Muted text / main surface | 8.37:1 | 6.00:1 |
| Muted text / elevated surface | 7.30:1 | 4.99:1 |
| Action text / action fill | 12.66:1 | 7.62:1 |
| Action text / hover fill | 14.50:1 | 10.48:1 |
| Success text / success surface | 7.05:1 | 6.15:1 |
| Warning text / warning surface | 6.98:1 | 5.74:1 |
| Error text / error surface | 6.78:1 | 6.05:1 |
| Information text / information surface | 6.77:1 | 6.40:1 |
| Strong boundary / elevated surface | 3.65:1 | 3.69:1 |
| Focus color / elevated surface | 11.01:1 | 6.25:1 |
| Primary text / highest room heat tint | 8.42:1 | 13.96:1 |
| Unknown text / unknown surface | 12.35:1 | 13.25:1 |

The check covered **32 pairs per theme plus five solid heat swatches: 69 pairs**.
The lowest normal-text pair was 4.99:1; the lowest tested boundary/focus pair
was 3.65:1. This is a token-pair check, **not a WCAG conformance claim**. Actual
computed component styles, disabled states, overlap, keyboard behavior, zoom,
reading order and assistive-technology behavior require their own verification.

Keyboard focus must be an enduring outline with a gap, not a transient glow.
The focus color is measured against the surrounding surfaces; a gap keeps the
outline separate from the same-colored action fill. Retain visible focus while
operating the canvas, inspector and theme control. [W3C: Focus Visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html)
Forced-colors mode uses system colors and retains text/ordinal values and dashed
unknown boundaries. Background grids and tints can disappear without removing
operational information. Reduced-motion handling belongs in the component CSS;
the tokens introduce no animation.

### Reproduce the luminance calculation

```python
def luminance(hex_color):
    channels = [int(hex_color[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    linear = [v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
              for v in channels]
    return sum(v * weight for v, weight in zip(linear, (0.2126, 0.7152, 0.0722)))

def contrast(first, second):
    low, high = sorted((luminance(first), luminance(second)))
    return (high + 0.05) / (low + 0.05)

assert contrast('#685E75', '#EEE8DC') >= 4.5
assert contrast('#887A9F', '#2D2544') >= 3
assert contrast('#FFFFFF', '#71618F') >= 4.5
```

## Integration acceptance

1. Switching themes preserves the selected scope, heat metric, unsent Donna
   text, open inspector and saved office state.
2. Blueprint, hierarchy, whiteboard and roadmap use the same metric labels and
   thresholds, and selecting a node retains the same accountable identity.
3. Unknown data remains visibly distinct from zero in both themes and in a
   text/list fallback. A stale sample shows its recorded age or freshness reason.
4. Focus remains visible; keyboard users can reach the alternative list,
   selected-node details and Donna controls without operating a visual canvas.
5. Narrow layouts retain the metric legend and exact values. No essential
   decision depends on reading a distant glow, decorative thumbnail or tooltip.

These are the acceptance criteria for the renderer and cloud integration owners.
The palette review itself establishes the source interpretation, token values,
69 calculated pairs and quantitative-label rules; it does not establish that
every final interaction has already passed a browser test.

## Component source review — 21 November 2026 UTC

A second review inspected the actual declarations in
[chrome.css](../desktop-shell/src/renderer/chrome.css), the initialization in
[chrome.ts](../desktop-shell/src/renderer/chrome.ts), and the cloud
[header](../cloud-workspace/app/office-header.tsx),
[layout](../cloud-workspace/app/layout.tsx),
[home styles](../cloud-workspace/app/office-home.css) and
[directory styles](../cloud-workspace/app/applications/directory.css).
The renderer owner applied the bounded corrections below; the color reviewer
then re-read those declarations and recalculated their intended pairs.

| Source finding | Corrected pairing or behavior | Calculated result |
| --- | --- | --- |
| Unknown legend marker used its boundary color as a text background | Unknown fill, unknown ink and a dashed border | 12.35:1 blueprint / 13.25:1 drafting; previously 1.64:1 / 2.65:1 |
| Placeholder text applied 85% opacity to the measured muted color | Full-opacity muted text on the canvas | 5.45:1 in drafting; previously approximately 3.98:1 after compositing |
| Keyboard skip link retained white text on vivid green | Action ink on action fill | 12.66:1 in blueprint; previously 1.31:1 |
| Reachable metrics, employee, node, squad, pricing and artifact surfaces retained pale legacy fills | Surface/ink; code and skill paths use elevated/ink; supporting labels use muted | Covered by the existing surface/text pair checks |
| A global heading/eyebrow rule could place dark drafting text on the dark focus banner | Explicit emphasis ink on emphasis surface for its heading, paragraph and eyebrow | 13.02:1 blueprint / 15.82:1 drafting |
| Restoring drafting appearance left the initial browser theme color violet | Initialize the meta theme color from the restored attribute as well as on selection | Source state reviewed; browser chrome not observed |
| The cloud directory's manual-connection code block retained a pale background | Surface-soft/ink with a strong boundary | Uses the measured token pair |

The current cloud header reads and writes `daftar-studio-theme`, the same key
used by the desktop renderer. It handles unavailable storage and listens for
cross-tab preference changes. Explicit theme selectors have higher specificity
than the generic `:root` operating-system dark-mode defaults. Home styles also
map the directory's `--rule`, `--pine` and `--error` aliases to the shared palette.
These are source observations. A saved drafting preference is applied by the
cloud header after hydration, so an initial dark frame remains possible on a
fresh load; this review does not claim that first-paint appearance was tested.

This review is **not browser or accessibility certification**. It establishes
that the reported declarations were corrected and that their specified pairs
have the calculated contrast above. Screenshot appearance, copied build assets,
keyboard navigation, actual computed styles, forced colors and preserved form
state require release verification. No paid model call or new executable role
capability was needed for this review.

### Browser-discovered cascade correction

The release owner's actual browser review at **1348 × 916**, in blueprint mode,
found defects that the initial token and bounded source checks had not caught.
Computed styles showed inactive navigation and the save-state control using
`#BFB4D0` text on `#BEF264`: **1.51:1**. The visible blueprint description retained
legacy `#61725A` on `#151126`: **3.56:1**. These observations establish why
checking token pairs alone cannot verify a composed screen.

The generic themed button rule supplied a vivid action background, while
component rules replaced only its foreground. The generic hover selector also
had specificity `(0,3,1)`, exceeding several component defaults at `(0,3,0)`.
The renderer owner corrected the complete foreground/background pairs for
navigation, save state, picker/budget/Donna-dock/executive hover states,
office-tools tabs and inline links. The real decision-button class is
`decision-list-button`; it now has its own default, selected, hover and status
text pairs. The canvas description and composer help use full-opacity muted
text. A subsequent release-owner reload confirmed neutral inactive navigation,
a neutral save-state control and readable composer help.

| Corrected semantic pair | Blueprint | Drafting |
| --- | ---: | ---: |
| Generic action text / action fill | 12.66:1 | 7.62:1 |
| Generic action text / action hover | 14.50:1 | 10.48:1 |
| Inactive navigation text / sidebar canvas | 9.14:1 | 5.13:1 |
| Active navigation text / selected fill | 8.87:1 | 6.50:1 |
| Save-state text / surface | 8.37:1 | 6.00:1 |
| Canvas description / canvas | 9.35:1 | 5.45:1 |
| Composer or scope help / surface | 8.37:1 | 6.00:1 |
| Primary text / component hover surface | 12.89:1 | 13.16:1 |

These ratios are calculations of the corrected specified colors. A bounded
browser regression gate now targets inactive navigation, active navigation,
save status and the visible blueprint description in both themes, using
computed styles and transparent ancestor-background compositing. Its execution
result belongs in the release verification record; the existence of the gate
does not itself establish a pass. The same browser review identified the
goal-sidebar `.scope-note p` as another legacy foreground; its isolated
correction is muted text on the existing surface, leaving its separately
themed eyebrow and link control unchanged.

### Candidate `81afaf3` screenshot review and targeted corrections

The color reviewer inspected 20 exported captures from the candidate's
`cloud-44865684035`, `pages-44865684142` and `packaged-desktop-ui` artifacts.
Coverage included both home themes; public dark blueprint, ownership and
roadmap; light ownership, blueprint, heat legend and Donna dock; narrow
ownership, roadmap, directory and home; and packaged desktop office, decisions
and settings. The cloud receipt recorded 42 checks and 18 screenshots with
synthetic fixture data and zero provider calls. It explicitly did not establish
production authentication or persistence.

The corrected navigation, save-state control and canvas descriptions were
visibly legible in those captures. The light legend retained its ordinal
labels and a separate dashed question-mark marker for unknown values. Narrow
cloud directory, ownership and roadmap content wrapped within the captured
viewport. These are observations of the named captures, not general conformance
claims.

The candidate still required correction. Its public browser gate stopped at
a populated mobile room height of 507.19px against an existing limit below
400px, so that candidate did not receive a complete passing public-browser
receipt. Packaged screenshots exposed hardcoded dark child text inside the
themed conversation, goal card, decision sidebar and cloud-state panel. This
affected saved content even though its parent surfaces had already adopted
the palette.

The renderer owner applied explicit semantic foregrounds to those observed
elements. A subsequent source review confirmed these mappings:

| Observed element | Target token | Old dark contrast | Corrected dark / light contrast |
| --- | --- | ---: | ---: |
| User message body | Ink on action-soft | 1.67:1 | 10.39:1 / 13.69:1 |
| Donna message body | Ink on surface | 2.38:1 | 14.79:1 / 15.82:1 |
| Speaker labels | Ink on the message's own fill | 1.74:1 user / 2.48:1 Donna | Same corrected body pairs above |
| User-message timestamp/header | Muted on action-soft | 2.32:1 | 5.88:1 / 5.20:1 |
| Saved goal counts | Muted on surface | 3.30:1 | 8.37:1 / 6.00:1 |
| Plan and ownership disclosure | Accent on surface | 3.33:1 | 12.63:1 / 7.51:1 |
| Decision principle heading | Ink on surface | 2.01:1 | 14.79:1 / 15.82:1 |
| Decision principle paragraph / expertise legend | Muted on surface | 3.41:1 / 2.80:1 | 8.37:1 / 6.00:1 |
| Cloud-state values / labels | Ink / muted on surface | 1.75:1 / 3.41:1 | 14.79:1 / 15.82:1 values; 8.37:1 / 6.00:1 labels |
| Assigned-people locator | Muted on canvas | 3.93:1 | 9.35:1 / 5.45:1 |

The foreground selectors are `chat-message-text`, `chat-message-header strong`,
`chat-message-header`, `goal-card p`, `goal-steps`, `goal-step strong`,
`goal-step span`, `goal-steps summary`, `decision-principle strong/p`,
`decision-role-fieldset legend`, `cloud-state-grid strong/span` and
`locator-people`. The pale decision checkbox tiles were readable in the
capture and were not changed merely to match a preferred appearance.

The ratios above are calculations from the specified foregrounds and actual
surface roles. At that checkpoint, the corrected candidate still required a
browser rerun. The earlier candidate's images remain failed-candidate evidence;
final release measurements are recorded below.


## Released build: rendered contrast and visual review

The final source `5b661e57a2ac68530e50a7f452d912f169495ef5` passed the full [Verify gate](https://github.com/occult-kranti/engineering-intelligence-atlas/actions/runs/44866920958) and [Pages gate](https://github.com/occult-kranti/engineering-intelligence-atlas/actions/runs/44866920872). Both receipts contain the following actual computed text/background ratios, separate from the 69 calculated token pairs above.

| Rendered target | Violet studio | Golden drafting |
| --- | ---: | ---: |
| Inactive navigation | 9.1423:1 | 5.1253:1 |
| Active navigation | 8.8737:1 | 6.5000:1 |
| Save status | 8.3707:1 | 6.0009:1 |
| Blueprint description | 9.3457:1 | 5.4503:1 |

The release retains 74 public, 18 cloud-fixture and four packaged-desktop captures. Independent review confirmed the corrected saved message, goal and sync-state text, the compact mobile rooms, and the first-screen laptop composer. The final 1024×768 send-button bottom is 732.6875px; at 1280×720 it is 689.1875px. Two additional live public screenshots show Violet ownership and the Golden drafting roadmap with the released stylesheet `chrome.32a6e07447d920cd.css`.

The cloud captures use synthetic records and do not establish an authenticated production session. The live private URL still presents its ChatGPT sign-in gate. Full screen-reader/forced-colors acceptance and every possible legacy state remain outside this targeted review. A narrow floating-launcher overlap and the difference between activity-scope people and shared leadership remain specific layout/copy follow-ups. [Full receipt and limitations](release-0.6.0.json).


## 0.8.0 endless canvas palette — 2026-11-21

The shared renderer and embedded website now use **Night office** (charcoal, moss and brass) and **Drafting paper** (warm paper and forest ink). The stable stored theme keys remain `blueprint` and `drafting`. The palette is defined in `desktop-shell/src/renderer/studio-tokens.css` and copied to the website by the renderer sync; panel bodies use sans-serif text and serif type is limited to display headings. Earlier tables above record historical releases, not these new values.

The following ratios were recalculated from the new source tokens using the WCAG relative-luminance formula. These are specified-color checks. The real browser gate separately measures enabled rendered navigation, status and blueprint-description text; it remains a release gate.

| Pair | Night office | Drafting paper |
| --- | ---: | ---: |
| Body / surface | 12.94:1 | 12.43:1 |
| Muted / surface | 7.81:1 | 6.19:1 |
| Muted / elevated | 6.64:1 | 4.74:1 |
| Action label / accent | 13.00:1 | 9.08:1 |
| Accent / surface | 11.76:1 | 8.91:1 |
| Focus / elevated | 10.00:1 | 6.82:1 |
| Strong boundary / surface | 3.98:1 | 3.28:1 |

The selected action label remains paired with its accent fill. Workload heat keeps its five numeric levels and unknown hatch; it does not express employee quality. Tabletop blueprint thumbnails use recorded room geometry, dark green ink on warm paper, and explicit saved/omitted counts. The owner canvas inherits its palette from root tokens so system forced-color substitutions can reach panels instead of being overridden by body-level colors. HUD spacing, keyboard focus and panel reading scale are covered by the endless canvas browser checks.
