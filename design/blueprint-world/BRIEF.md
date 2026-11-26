# Daftar — continuous blueprint canvas

**Mode: Operate.** Help the owner understand company structure, assign work, create local organization records and coordinate through Donna without leaving one continuous canvas.

**Latest user direction:** floorplans and blueprints, with flat, color-coded circles for the CEO, directors, Donna, employees and visitors. This supersedes the earlier dollhouse direction. Exclude human meshes, volumetric figures, furniture, plants, glass architecture and decorative office props. The corrected concept images are visual targets; generated imagery does not establish working behavior.

## 1. One world and a clear visual hierarchy

Use a continuous drafting surface containing distinct company floorplans. Each company has a named boundary, its own director and sub-Donna, departments, nested departments and employee circles. A company marker at the shared table edge selects that company's plan. Parent and sub-company plans remain separate, connected by an explicit relationship.

Rooms, department outlines, employee circles and company boards stay within their owning company. Nested departments also stay inside their parent department. Selection and zoom never relocate these records. New records receive stable IDs and predictable positions.

The default view is straight overhead. Pan, zoom, optional rotation and restrained sheet depth may remain; they serve navigation and readability. No perspective setting may introduce figures or furniture. A minimal Home/Fit/search/camera strip is acceptable; work interfaces are world-attached elements, with no replacement pages or permanent management sidebar.

## 2. Visual language

Use warm ivory plans on a quiet midnight drafting surface, fine blue-grey room lines, clear door openings, understated department fills and ample separation between company boundaries. Keep the grid faint. Show dimensions only when useful; do not fill the canvas with architectural decoration.

People are flat circles with initials or a short identifier. Suggested role-family colors: muted gold for CEO/directors, teal for Donna/sub-Donnas, blue for engineering/product, coral for design, violet for research and sage for operations. Shared assignments use a labelled second ring; visiting assignments use a dashed ring and Visiting label, without changing the role-family fill. Retain a role/status label in the profile and accessible name: color alone must not carry meaning. Selection adds a clear outline; keyboard focus remains independently visible.

Use readable interface typography, with restrained display lettering for company names. Popups are crisp paper-like panels with solid backgrounds, light borders and short shadows. Donna's marker is also a flat circle; no glowing orb, human avatar or idle hovering animation.

Restricted areas use opaque grey/charcoal fill, restrained hatching, a lock and “Access required.” Hidden people, task titles and counts must be absent from the restricted projection, including search and accessible labels.

## 3. Semantic zoom and continuity

| Focus | Visible information | Main action |
| --- | --- | --- |
| Portfolio | Company boundaries/names, parent links, selected shared connections | Select or search a company |
| Company | Department names, director/sub-Donna, employee groups, board titles | Focus a department or board |
| Department | Individual circles, names when space allows, nested boundaries | Inspect a person or assign work |
| Person / work | Readable profile, task editor, hiring form or Donna conversation | Complete the scoped operation |

Choose detail from projected screen space, with a small threshold buffer to avoid flicker. Labels must not shrink into unreadable noise. Keep selected records and open popup identities stable across zoom levels. Search, breadcrumbs and a minimap provide alternatives to long panning.

Camera movements are short and interruptible. Manual input always wins. Reduced motion removes animated travel and automatic browsing. Text editing, popup scrolling and button clicks never pan the world or start a camera flight.

## 4. Core working flows

1. **Navigate and inspect.** Select a company marker, focus a department, then select an employee circle. Open a profile showing role, company, department, reporting relationship, assignment type and local tasks. Selecting a restricted region opens its permitted explanation, not hidden contents.

2. **Create company structure.** A world-attached Create popup supports company and sub-company creation with a valid parent. Department creation requires an owning company and optional parent department. Validate names, duplicate identities, acyclic parents and available bounds. On success, add the visible plan or department without resetting unrelated state. On failure, retain the draft and explain the problem.

3. **Hire locally.** A department's Hire action opens a scoped popup for name, role, reporting relationship and resident/shared/visiting assignment. Confirmation creates a local employee record and circle inside that department, then updates the roster. Label the action's effect “Local demo”; it creates no running worker, provider request or real access grant.

4. **Assign and progress work.** Open a company's Roadmap or Ownership board, create a task, assign an eligible employee and change status. Roadmap lane and execution status are separate fields. The same record updates the board and employee profile. Notes belong to a specific company/board. Optional drag interactions have ordinary controls providing the same result.

5. **Coordinate with Donna.** A movable Donna circle opens a world-attached conversation with an explicit company/department scope and “Scripted demo” label. Support scoped task summaries, unassigned work and contextual employee explanations. Preparing a task or hiring draft may populate a local form; it does not silently submit it. Preserve unsent text while navigating or opening another popup.

6. **Inspect company connections.** Show parent/sub-company, shared employee and task-handoff connections with distinct labelled line styles. Emphasize the selected company's relevant links; bundle distant connections instead of drawing a dense web. Opening a connection shows its source, destination, type and scope. Parentage and dragging never grant authority. A simulated visitor mode must be clearly labelled and render only its permitted fixture projection.

## 5. Record scope is part of the interface

The previous demo's global task/note collections and repeated people fixtures must become explicitly scoped records:

- **Company:** stable ID, name, optional parent company, bounds, director and assistant references.
- **Office:** stable ID, owning company and contained bounds for its department layout.
- **Department:** stable ID, company/office IDs, optional parent department and contained bounds.
- **Employee:** stable identity, home company, role and reporting relationship. Visiting/shared placements reference that identity through explicit company/department assignments.
- **Task:** stable ID, company, optional department, eligible owner, title, roadmap lane and status.
- **Note / board:** stable ID, company, board identity and bounded local position.
- **Connection:** stable ID, typed source/destination references and explicit scope.

Every board filters by its owner. Unassigned work stays visibly unassigned. No cross-company assignment occurs by accident. Use collision-safe IDs, bounded storage and validation on reload. Changes to one company must not alter another company's records or repaint a popup with stale scope.

## 6. World-attached popup contract

Creation, hiring, profile, roadmap, ownership, whiteboard, connection and Donna surfaces all retain world anchors. Multiple surfaces can coexist. Each has a visible scope, labelled controls, drag handle, close and focus action. Closing or moving a panel preserves its draft; camera movement does not recreate the form.

Keep the full popup readable and clickable at supported camera settings. Focus must not scroll the page or ancestors. Long content scrolls within its panel. Resolve overlap by focusing or repositioning the popup while preserving its anchor and ownership. Local panel geometry contains no credentials or grants.

## 7. Acceptance and demo boundaries

Visual acceptance requires a readable overhead floorplan, flat circles, strict company/department containment, sparse meaningful connections and usable world-attached forms. No excluded decorative or volumetric elements may reappear.

Verify creation, local hiring, scoped task assignment, notes, reload persistence and company isolation through actual controls. Exercise duplicate names, invalid parents, same-clock IDs, corrupt/unavailable storage, large company sets, rapid popup reopen, retained drafts, keyboard navigation, reduced motion and restricted projections. Separately verify actual browser hit targets, popup visibility and zero ancestor scrolling; synthetic geometry alone is insufficient.

This is a standalone synthetic frontend demo. External Claude authorship is distinct from Donna's scripted behavior. Native authority, real model execution, account connections and grants remain unconnected unless separately implemented and verified. Preserve the historical 0.8.0 release and its receipts; this brief creates no release or deployment claim.
