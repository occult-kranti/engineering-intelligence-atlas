# Managed design applications on an existing compute target

The design toolchain provides a catalog, durable installation plans and explicit installation jobs. Catalog and plan operations perform no SSH, package download, cloud-provider or billing operation. The instance may remain stopped while plans are reviewed. Nothing in this service starts, resumes, rents or destroys an instance.

## Supported applications

| Application | Installation path | Interactive use | Automation |
| --- | --- | --- | --- |
| Blender | Exact Debian/Ubuntu package version from official signed indexes | Requires a desktop/display | Background rendering and command-line tasks |
| Godot 4 | Exact official Linux release archive and reviewed SHA-256 | Requires an appropriate display and graphics support | Explicit headless tasks |
| Krita | Exact Debian/Ubuntu package version | Painting application needs a desktop/display | Some command-line exports; verify workload/display requirements |
| GIMP | Exact Debian/Ubuntu package version | Image editor needs a desktop/display | Version-dependent console/batch processing |
| Inkscape | Exact Debian/Ubuntu package version | Vector editor needs a desktop/display | Version-dependent command-line export |
| Penpot | Blocked pending a reviewed compose importer | Browser design interface | Docker/Compose stack required; this service does not deploy it yet |

Penpot, GIMP and Krita are separate products. This catalog does not install Figma or Adobe Photoshop, provide their licenses, or promise complete fidelity for their files. Import, export, fonts and plugins need workflow-specific acceptance tests.

The catalog links to upstream license notices. Godot uses MIT; Penpot uses MPL-2.0; GIMP uses GPLv3 or later; Krita documents GPLv3. Blender documents GPLv3-or-later for distributed binaries, with differing source-component notices. Inkscape uses the GPL; inspect the exact pinned package's copyright and bundled-component notices rather than assuming one version applies to every component. These application licenses are separate from the copyright of created artwork.

## API

`createDesignToolchain({stateDir, hostControl, snapshot})` exposes `catalog()`, `plan(input)`, `install(input)`, `inspect({id})` and `close()`. Every external adapter must authenticate the runtime owner. Company and employee IDs are canonical attribution and policy selectors, not separate logins or a hostile-tenant sandbox.

A package plan requires a unique `id`, `companyId`, `employeeId`, a catalog `toolId`, and these reviewed fields:

```json
{
  "target": {
    "distribution": "debian",
    "versionId": "EXACT_TARGET_VERSION",
    "arch": "x86_64"
  },
  "packageVersion": "EXACT_VERSION_FROM_SIGNED_TARGET_INDEX"
}
```

The placeholders above are explanatory and are not valid installation input. Supply real values obtained for the intended target. The service never invents a current version. Omitted target/version fields produce a durable **blocked** plan with explicit reasons. Plans expose their stable `planHash`, requirements, license sources, and whether installation is blocked.

Godot plans use `toolId: "godot4"` and an `artifact` object containing `version`, `url`, `sha256` and `maxBytes`. The URL must name an exact Godot 4 stable Linux editor archive in the official `godotengine/godot` or `godotengine/godot-builds` GitHub releases. CPU architecture, release tag and filename must agree. SHA-256 must come from a reviewed source; there is no default hash or `latest` tag.

Installation is a separate operation:

```json
{
  "id": "UNIQUE_INSTALLATION_ID",
  "planId": "EXISTING_PLAN_ID",
  "expectedPlanHash": "EXACT_SHA256_RETURNED_BY_PLAN"
}
```

An explicit install request rechecks current native employee/company eligibility and submits a durable job to host-control. Host-control must already be enabled and have the applicable grant. Manual host policy leaves the job pending approval; auto policy permits dispatch. A receipt is not a claim that software is installed. `inspect` distinguishes pending, running, uncertain, failed and completed host outcomes; verified installation metadata appears only after a successful result proof.

Repeated identical IDs return the same receipt. Changed request bodies conflict. Unknown submission outcomes are never automatically retried. Interrupted APT transactions may require local package-manager inspection; the service does not hide them with a fresh automatic installation attempt.

## Package integrity and bounds

The Debian/Ubuntu recipe checks the actual running distribution version and architecture against the plan. It requires root inside the intended container and existing reviewed signed APT indexes. A runtime running as a normal user returns a blocked package plan; it does not attempt interactive sudo or privilege escalation. The installer independently checks the actual OS identity again. It does not run an automatic update or add third-party repositories.

Before installation it simulates the package operation, rejects removals, resolves at most 256 packages, and validates every resolved version against the supported official Debian or Ubuntu archive origins. Each selected version must have SHA-256 and size metadata; conflicting artifact digests fail. All resolved versions are then explicit APT arguments. Authentication and insecure-repository bypasses are disabled, source-level trust overrides are rejected, and `--no-remove` is used.

The resolved set is bounded to 2 GiB of package downloads and 8 GiB of installed-size estimates. Free disk must cover those estimates before installation. These checks do not establish a universal minimum RAM requirement or GPU compatibility. The operating system's already installed dependencies and trusted package-manager configuration remain part of the host trust boundary.

Godot transfer allows only HTTPS official release hosts and bounded release-asset redirects. It verifies SHA-256 before promoting the archive. Extraction accepts exactly the expected executable, writes it as a new private file, limits extracted output to 512 MiB, and checks its ELF architecture. It does not execute an unreviewed remote installer. Installation does not start the application, a GUI desktop, a game, or a GPU workload.

Penpot's upstream example is a useful review source, but its documented default follows a latest image. This service deliberately does not fetch and run that compose file. A future importer must verify Docker/Compose availability, pin every image by digest, review persistent volumes, credentials and private ingress, and retain a concrete reviewed compose artifact before deployment.

## Python and application runtimes

These are application installations. Debian/Ubuntu applications and their bundled components use the distribution-managed application runtime; portable Godot uses its own application directory. They are **not** represented as project Python virtual environments.

New managed Python scripts, model-training scripts and project dependencies must go through `managed-environments`, using its verified interpreter and private virtual environment. The design installer never invokes global `pip`, `sudo pip`, or `--break-system-packages`. An explicitly owner-authorized arbitrary host shell still has its operating-system privileges; application packaging and venv checks are not a hostile-root sandbox.

## Verification boundary

Local tests use a fake host adapter, recorded package metadata and in-memory synthetic download bytes. They do not install applications, download actual binaries, connect to a VPS or start an instance. Real-target acceptance remains separate: exact package availability, downloaded artifact provenance, graphics drivers, desktop access, memory/disk behavior and representative application workflows must be observed after the user resumes the intended target and explicitly requests installation.

## Primary references reviewed

- [Blender command-line rendering](https://docs.blender.org/manual/en/latest/advanced/command_line/render.html) and [license](https://www.blender.org/about/license/).
- [Godot command-line interface](https://docs.godotengine.org/en/stable/tutorials/editor/command_line_tutorial.html) and [license](https://godotengine.org/license/).
- [Penpot Docker installation](https://help.penpot.app/technical-guide/getting-started/docker/) and [source license](https://github.com/penpot/penpot/blob/develop/LICENSE).
- [Krita command-line reference](https://docs.krita.org/en/reference_manual/linux_command_line.html), [installation](https://docs.krita.org/en/user_manual/getting_started/installation.html) and [license](https://krita.org/en/about/license/).
- [GIMP manual](https://www.gimp.org/man/gimp.html) and [license FAQ](https://www.gimp.org/docs/userfaq.html).
- [Inkscape manual](https://inkscape.org/doc/inkscape-man.html), [license page](https://inkscape.org/about/license/) and [project-hosted translation/license metadata](https://translate.inkscape.org/projects/inkscape/master/).
- [Debian apt-secure documentation](https://manpages.debian.org/bookworm/apt/apt-secure.8.en.html), including the distinction between archive authentication and package-level code review.
