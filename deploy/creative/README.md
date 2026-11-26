# Private creative tools on an existing Linux host

This pack installs a checksum-pinned official Blender release, imports an owner-supplied Unreal Linux archive, discovers an authorized Unreal source build, and installs open-source graphics packages from the host's signed distribution repositories. The headless runtime connects employees to reviewed project roots through fixed operations and the native `creative.execute` grant.

No VPS, GPU, bucket, Epic account or Adobe subscription is created by these commands. Run the deployment steps on an existing host you control. The verified CPU smoke in this change used scratch storage, not a production VPS.

## What is implemented

| Tool | Installation / connection | Runtime operations |
| --- | --- | --- |
| Blender 4.5.17 LTS | Official Linux x64 archive; fixed SHA256, resumable download, atomic publication and full installed-file verification | `blender.inspect`, `blender.render`, `blender.export_glb` |
| Unreal Engine | Owner supplies an authenticated official Linux ZIP plus an independently verified hash, or points to an already built authorized source tree | `unreal.inspect`, `unreal.validate`; a discovered binary does not establish account/license validity |
| Inkscape | Signed distro package | `inkscape.export_png` |
| FFmpeg tools | Signed distro package; the runtime's `ffmpeg` entry points to **ffprobe** | `ffmpeg.probe` |
| Krita and GIMP | Signed distro packages for local/manual workflows | Installed editing applications; no arbitrary GUI/script command endpoint |
| Adobe Photoshop API v2 | Optional licensed server API, private credentials and an existing private S3-compatible asset store | `adobe.manifest`, `adobe.render`, with explicit paid-request and upload settings |

The installer does not run an engine in `--plan` or `--check`. Installed-file verification and a real operation have different receipts. Project code and engine plugins remain trusted code; the process guard and resource limits are not an operating-system sandbox for hostile files.

## Verified pin and official sources

Review dated **2026-11-24 (America/New_York)**; source verification is recorded as **2026-11-25 UTC** in the lock manifest. The checksum text was fetched directly from the official HTTPS endpoint; the complete archive was downloaded and matched it.

| Locked item | Value |
| --- | --- |
| Release | Blender **4.5.17 LTS**, published 2026-11-24 |
| Archive | `blender-4.5.17-linux-x64.tar.xz` |
| Archive bytes | **377,826,816** |
| SHA256 | `b7d09d1aa7c346fed1e56390e815dbf1589d47324734fbad9e2007fe75ca0b8d` |
| Official archive | <https://download.blender.org/release/Blender4.5/blender-4.5.17-linux-x64.tar.xz> |
| Official checksum | <https://download.blender.org/release/Blender4.5/blender-4.5.17.sha256> |
| Official release index | <https://download.blender.org/release/Blender4.5/> |
| Release/support information | <https://www.blender.org/releases/4-5/> |
| Production executable | `/opt/daftar-tools/blender/4.5.17/blender` |

`tools.lock.json` is the reviewed source of this pin. It deliberately selects the 4.5 LTS line; it does not mean 4.5 is the newest feature release. Updating it requires checking the new official hash/size, running the installer tests, and running the optional actual-engine CI smoke. Never derive an expected hash from an untrusted mirror's download alone.

Official technical references:

- [Blender hardware requirements](https://www.blender.org/download/requirements/) and [official Linux installation](https://docs.blender.org/manual/en/latest/getting_started/installing/linux.html).
- [Epic Linux quickstart](https://dev.epicgames.com/documentation/en-us/unreal-engine/linux-development-quickstart-for-unreal-engine), [Linux requirements](https://dev.epicgames.com/documentation/unreal-engine/linux-development-requirements-for-unreal-engine?lang=en-US), [authenticated Linux downloads](https://www.unrealengine.com/en-US/linux), and [authorized GitHub source access](https://www.unrealengine.com/ue-on-github).
- Distribution package records: [Inkscape](https://packages.debian.org/bookworm/inkscape), [Krita](https://packages.debian.org/bookworm/amd64/krita), [GIMP](https://packages.debian.org/bookworm/gimp), [FFmpeg](https://packages.debian.org/bookworm/ffmpeg), and [Ubuntu Blender dependencies](https://packages.ubuntu.com/noble/blender).
- [GIMP supported image formats](https://developer.gimp.org/core/standards/images/), [Krita PSD support/limitations](https://docs.krita.org/en/general_concepts/file_formats/file_psd.html), and [OpenRaster interchange](https://docs.krita.org/en/general_concepts/file_formats/file_ora.html).
- [Adobe desktop operating systems](https://helpx.adobe.com/photoshop/desktop/get-started/technical-requirements-installation/adobe-photoshop-on-desktop-technical-requirements.html), [Photoshop API v2](https://developer.adobe.com/firefly-services/docs/photoshop/), and [API authentication/contract prerequisites](https://developer.adobe.com/firefly-services/docs/photoshop/getting-started/).
- [NVIDIA Container Toolkit installation and Docker integration](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html), for an already owned GPU host only.

## Preflight and disk planning

The archive installer requires Python 3.10+, Linux x86_64 and glibc 2.28+. Blender additionally requires detected SSE4.2 CPU support. There is no ARM/emulation substitution. Distribution package profiles support Debian 12/13 and Ubuntu 22.04/24.04/26.04. Other Linux hosts can use the official archive after installing their distribution's runtime libraries, but the APT profile will refuse them.

The preflight reports schedulable CPUs, host/cgroup memory, free disk, and visible GPU device nodes. A device node is not proof of a working driver, Vulkan/OpenGL support, sufficient VRAM or rendering performance. Blender's published baseline is four CPU cores and 8 GB RAM, with 32 GB recommended. Epic recommends 32 GB RAM and a capable Vulkan GPU for Linux development. CPU-only Blender background rendering can perform a tiny smoke job without a GPU; this says nothing about Unreal interactive-editor readiness.

RAM/CPU shortfalls appear as warnings; add `--strict-hardware` to require the published baseline before installation. Architecture, libc, SSE4.2 and disk failures always stop installation. The Blender staging budget is **5,209,665,024 free bytes**, including the compressed archive, a conservative 4 GiB expanded limit and a 512 MiB reserve. The verified archive actually expanded to **1,165,711,107 bytes**. Unreal ZIP planning sums declared expanded members with a 250 GiB upper limit, adds a local cache copy and a 10 GiB reserve. Project assets, build products, shader caches, source builds and backups need additional space.

`--plan` does not make a directory, access a download URL, or execute the application:

```bash
python3 deploy/creative/install.py --plan --tool blender --prefix /opt/daftar-tools
python3 deploy/creative/install.py --plan --tool graphics --profile open-graphics --prefix /opt/daftar-tools
```

## Install and verify Blender

On the chosen Debian/Ubuntu host, install the shared libraries and optional editing applications through its signed repositories. The profile adds no repositories and never disables APT signature checks. Review the host's repository configuration first. Exact resolved package versions are saved under the managed prefix; distro security updates remain available.

```bash
sudo python3 deploy/creative/install.py --install --tool graphics --profile open-graphics --prefix /opt/daftar-tools
sudo python3 deploy/creative/install.py --install --tool blender --prefix /opt/daftar-tools
python3 deploy/creative/install.py --check --tool blender --prefix /opt/daftar-tools
python3 deploy/creative/install.py --check --tool graphics --profile open-graphics --prefix /opt/daftar-tools
```

Use `--profile blender-runtime` for Python, Git and Blender's shared-library dependencies. Python runs the process guard; Git verifies an existing reviewed checkout during offline company setup. The open-graphics profile also installs Inkscape, Krita, GIMP, FFmpeg and DejaVu fonts. A repository without the requested official packages causes a failed install; the installer does not silently replace them.

An offline Blender copy is accepted only if it matches the same lock:

```bash
sudo python3 deploy/creative/install.py --install --tool blender --archive /srv/imports/blender-4.5.17-linux-x64.tar.xz --prefix /opt/daftar-tools
```

Installer behavior:

- A per-prefix lock rejects concurrent installers. Managed directories cannot be symlinks or group/world writable. Privileged installs additionally require root-owned, non-mutable ancestors. Under a root-owned sticky temporary directory, the first private child must already exist and be root-owned. Inputs and install paths must be absolute. Unprivileged installs belong under a private directory controlled by that account.
- A download remains a `.part` file until its exact size and SHA256 match. Resume metadata binds the partial to the same pin. A valid HTTP range resumes it; a full response restarts it instead of appending. Redirects must remain on the official HTTPS host.
- Validation rejects absolute/traversing paths, duplicate paths, device/FIFO/hard-link entries, unsafe symlinks, excessive expanded sizes and member counts. Official Blender's relative library-link chains are accepted only when they terminate at an archived regular file.
- Extraction occurs in a private sibling staging directory. Executable bits are preserved, setuid/setgid and writable-by-others bits are removed, and archive file timestamps are preserved so bundled Python bytecode stays valid.
- One rename publishes the completed version. A receipt records the archive pin and every file hash/mode or symlink target. Matching installations are verified and reused. Modified or unmanaged destinations fail without being overwritten.
- Download failures can retain a resumable partial. Extraction failures remove staging. A killed process may leave a `.stage-*` directory; after confirming no installer holds the lock, review and remove only that abandoned stage. Existing verified version directories stay intact.

Install production engines as an administrator and run the runtime under the separate unprivileged `daftar` account. Containers mount engine files read-only. Do not let project jobs modify the installation receipt or executable tree.

## A bounded real CPU smoke

Run under the runtime's unprivileged user with a **new** output directory inside its writable workspace:

```bash
sudo -u daftar /opt/daftar-tools/blender/4.5.17/blender \
  --background --factory-startup --disable-autoexec --threads 2 \
  --python-exit-code 1 --python /opt/daftar/deploy/creative/smoke_blender.py \
  -- /var/lib/daftar-creative/smoke-001
python3 deploy/creative/install.py --check --tool blender --prefix /opt/daftar-tools
```

The script uses the factory cube/camera/light scene, Cycles CPU, two threads, four samples and a 96 × 96 frame. It writes a `.blend`, PNG, GLB and JSON receipt. It does not load a supplied project, run a provider, contact Adobe, or require a GPU. A success here establishes that this small operation works on that host; larger scenes require their own measured memory/time budget.

## Unreal: authenticated archive or authorized source tree

Epic's official Linux quickstart requires the owner to sign in and download a precompiled ZIP. Source access requires linking authorized Epic/GitHub accounts and accepting the applicable Epic agreement. These account actions remain with the owner; this installer has no token scraper, public mirror substitution or license activation path.

Obtain the archive through the official account and verify the expected SHA256 through a trustworthy owner-controlled channel. Supply the actual version and hash, for example:

```bash
python3 deploy/creative/install.py --plan --tool unreal \
  --archive /srv/imports/UnrealEngine-Linux.zip --version 5.7.1 \
  --sha256 OWNER_VERIFIED_64_HEX_DIGEST --prefix /opt/daftar-tools
sudo python3 deploy/creative/install.py --install --tool unreal \
  --archive /srv/imports/UnrealEngine-Linux.zip --version 5.7.1 \
  --sha256 OWNER_VERIFIED_64_HEX_DIGEST --prefix /opt/daftar-tools
```

`5.7.1` is a usage example, not a downloaded or locked Unreal release. The import verifies the supplied hash, ZIP paths, executable ELF architecture and `Engine/Build/Build.version`; mismatched versions fail. Internal library symlinks must resolve to archived regular files; unsafe links are refused. The receipt explicitly says `owner_supplied_sha256`, because matching a caller-supplied hash does not prove Epic provenance or ownership. Keep the source archive available for the same `--check` invocation, or use discovery to verify a source-built root's layout:

```bash
python3 deploy/creative/install.py --check --tool unreal --engine-root /opt/daftar-tools/unreal/5.7.1
```

Discovery returns `discovered_unverified_provenance` and `accountOrLicenseVerified: false`; it does not execute the editor. For an authorized source build, use Epic's linked Linux build instructions and then point discovery/configuration to the built tree. No unreviewed `Setup.sh`, Git submodule, engine plugin or project build hook is run by this installer. Add the resulting absolute `Engine/Binaries/Linux/UnrealEditor` path under `tools.unreal.executable` in the private config.

## Private runtime configuration and employee ownership

Start from `creative-tools.example.json`. Replace the company/department identifiers with actual native records and create the reviewed project directory. Set `DAFTAR_CREATIVE_CONFIG_FILE` to the resulting **regular, nonsymlink file with mode 0400 or 0600**. Every project and executable path must be absolute and have no symlink components.

```bash
sudo install -d -o daftar -g daftar -m 0700 /var/lib/daftar-creative/projects/studio-demo
sudo install -d -m 0755 /etc/daftar
sudo install -o daftar -g daftar -m 0600 deploy/creative/creative-tools.example.json /etc/daftar/creative-tools.json
sudoedit /etc/daftar/creative-tools.json
```

The example grants only listed project operations. `trusted: true` means the owner has reviewed the project, its linked assets and plugins. It does not make arbitrary downloaded files safe. `repository` is optional metadata; it does not cause an automatic clone. The employee must belong to the configured company/department, hold the scoped native `creative.execute` grant, and be assigned the tool/project through the authenticated runtime workflow. The config itself does not grant a worker native authority.

The private config's top-level `limits.maxMemoryBytes` is **8 GiB** in the Blender example; the service default is 4 GiB and its accepted range is 256 MiB–16 GiB. CPU operations enforce this as a per-process address-space guard, while systemd/container memory limits cover the aggregate service. GPU renders require the verified cgroup allowance described below. Defaults permit one concurrent creative job, eight queued jobs and a two-minute operation. Increasing concurrency multiplies the memory needed. Large Unreal projects may exceed these bounds; they should fail with a retained receipt rather than silently evade the limit.

FFmpeg configuration intentionally binds `/usr/bin/ffprobe` because the exposed operation inspects media; it is not a free-form transcoding shell. Krita/GIMP are installed for manual editing and format exchange, while the implemented automated raster/vector adapters remain explicit.

## systemd: CPU baseline and explicit GPU access

Install the existing base unit from `deploy/systemd/daftar-runtime.service` first. Its 2 GiB memory ceiling and private devices are suitable for the control plane, so apply the creative override on a host with enough available capacity:

```bash
sudo install -d -m 0755 /etc/systemd/system/daftar-runtime.service.d
sudo install -m 0644 deploy/creative/systemd/creative.conf /etc/systemd/system/daftar-runtime.service.d/20-creative.conf
sudo systemctl daemon-reload
sudo systemctl restart daftar-runtime
```

The override creates a private `/var/lib/daftar-creative` state directory, permits writes there, keeps `ProtectSystem=strict` and private devices, raises aggregate memory to 16 GiB, CPU quota to four cores and tasks to 512, and explicitly keeps `KillMode=control-group`. Tune limits to the actual host, leaving memory for the OS and any models. An 8 GiB VPS does not become a 16 GiB machine by applying this file. The existing owner-token API remains bound to loopback; use SSH/private access.

For an existing GPU host, inspect `systemd/gpu.conf.example`, replace device nodes with the actual approved GPU and install it as a later drop-in. It changes `PrivateDevices` only for that deliberate GPU profile and uses `DevicePolicy=closed` with named devices. Install/test the appropriate host driver separately. The example has no wildcard device access, kernel-module loading, display server, public Unreal remote-control endpoint or provisioning command.

## Docker Compose profile

The creative image extends the existing runtime with Python, Git, shared libraries and distro graphics tools. It includes the fixed helpers from `integrations/creative-tools`, the company-kit importer/skill definitions and the optional Adobe adapter copied by the base image. Engine binaries remain on the host and mount read-only. Use **Docker Compose 2.24.4 or newer**: the `!override` tag replaces the base `/tmp` entry instead of concatenating two mounts. See the [official Compose merge rules](https://docs.docker.com/compose/how-tos/multiple-compose-files/merge/). Prepare `/opt/daftar-tools`, `/var/lib/daftar-creative`, and the private config before starting the profile; the mounts refuse to create missing host paths.

For Docker, writable workspace/config ownership must match the container's **UID/GID 10001**. Copying a config for the systemd account does not automatically give UID 10001 access. Use host paths that are also valid in the container: the default workspace and tool mount paths match the examples. Adobe credential paths inside Docker should point into the existing `/run/secrets` mount, including `assetStorageFile`.

Run company setup while the runtime is stopped, using the host checkout or an isolated offline setup container with the same state and project paths. The running profile intentionally mounts configuration read-only. The setup helper atomically replaces its config, so an offline setup container needs the reviewed **parent directory** mounted writable for that operation; changing only an individual file bind to writable does not support atomic rename. Do not weaken the running profile's config mount to perform online setup.

```bash
docker compose -f deploy/compose.yaml build runtime
docker compose -f deploy/compose.yaml -f deploy/compose.creative.yaml config --quiet
docker compose -f deploy/compose.yaml -f deploy/compose.creative.yaml build runtime
docker compose -f deploy/compose.yaml -f deploy/compose.creative.yaml up -d --wait
```

The overlay keeps the readonly root filesystem, dropped capabilities, owner credential and host-loopback port. It sets a 16 GiB memory limit, four CPU allowance, 512 processes and a 1 GiB private `/tmp`. Override `DAFTAR_CREATIVE_MEMORY_LIMIT`, `DAFTAR_CREATIVE_CPUS`, `DAFTAR_CREATIVE_TOOLS_PREFIX`, `DAFTAR_CREATIVE_WORKSPACE` or `DAFTAR_CREATIVE_CONFIG_HOST_FILE` for the chosen host. None contains a credential value.

An existing NVIDIA host with the vendor Container Toolkit can additionally apply `-f deploy/creative/compose.gpu.yaml`. This requests one existing GPU; it does not obtain a new one. No engine port is added. GPU use is optional and was not validated in the CPU-only scratch environment.

## Explicit Blender GPU selection and acceptance

Device exposure alone does not enable GPU rendering. Set these fields in the protected owner configuration after verifying the host driver and approved visible GPU:

```json
{
  "tools": {
    "blender": {
      "executable": "/opt/daftar-tools/blender/4.5.17/blender",
      "renderDevice": "OPTIX",
      "renderDeviceIndex": 0
    }
  },
  "limits": {
    "maxConcurrentJobs": 1,
    "maxMemoryBytes": 17179869184
  }
}
```

This is a fragment to merge into the existing configuration; retain `schemaVersion`, reviewed projects and other limits. `CUDA` is also supported. CPU remains the default. The index selects one device in the actual matching Cycles inventory sorted by device ID. All other devices and CPU rendering are disabled for that render. Missing devices and backend initialization failures produce an explicit failure; they do not silently become CPU jobs. [Blender's GPU device settings](https://docs.blender.org/manual/en/4.5/render/cycles/gpu_rendering.html).

GPU drivers may reserve more virtual address space than the scene's physical memory use, so applying the CPU `RLIMIT_AS` unchanged can prevent GPU initialization. Daftar removes that new address-space limit **only after** its launcher verifies a finite kernel cgroup-v2 `memory.max` no larger than the configured `maxMemoryBytes`. With the supplied 16 GiB service/container ceiling, the fragment above permits that verification. Keeping the example's 8 GiB process allowance with a 16 GiB cgroup is deliberately rejected: lower the actual cgroup ceiling or choose a reviewed allowance up to 16 GiB. Unsupported cgroup layouts and unbounded interactive shells fail with `GPU_MEMORY_PREREQUISITE`. CPU, wall-time, file-size, artifact, output and descriptor limits remain active. See [the Linux memory controller](https://docs.kernel.org/admin-guide/cgroup-v2.html#memory).

The memory ceiling includes the whole service cgroup; it is not reserved headroom for a render. Leave room for the OS and the controller, configure host swap policy, and serialize MoE inference and rendering until measured together. GPU VRAM is not constrained by `memory.max`. Cycles can spill some GPU allocations into system memory; a successful small render is not proof that a larger scene will fit.

For a systemd installation, verify the deployed unit's `MemoryMax`, `DevicePolicy` and named devices, then run the bounded render through the authenticated runtime with an actual assigned employee and project. An ordinary shell does not inherit that unit's cgroup. For the already-running Compose GPU profile, the following disposable acceptance uses the CPU smoke scene created above. Pause other creative/inference work first, ensure the scene/output parent are accessible to UID 10001, and use a new output directory:

```bash
docker compose -f deploy/compose.yaml -f deploy/compose.creative.yaml -f deploy/creative/compose.gpu.yaml exec -T runtime \
  node /app/integrations/creative-tools/smoke-service.mjs \
  --blender /opt/daftar-tools/blender/4.5.17/blender \
  --scene /var/lib/daftar-creative/smoke-001/scene.blend \
  --output /var/lib/daftar-creative/gpu-acceptance-001 \
  --render-device OPTIX --device-index 0 --max-memory-bytes 17179869184
```

The service acceptance inspects the scene, renders a 64 × 64 two-sample PNG, exports GLB, checks hashes/replay/authority callbacks and retains receipts. It uses synthetic scope in disposable state, sends no model/provider request, and grants no production employee access. `gpuTested` becomes true only after the GPU render and PNG checks succeed. Review the receipt's backend, selected device, render time, all job outcomes and final `ok`. Version inventory continues to report `renderDeviceVerified: false`, because discovering a binary version is not a GPU test. No successful GPU acceptance was performed in this development environment.

Unreal remains a separate capability: the current adapter inspects project descriptors and runs the fixed DataValidation commandlet with `-NullRHI`. It does not yet render an Unreal scene, run a gameplay session, or start Pixel Streaming. Those need a licensed installed engine, reviewed project and a separate rendering adapter acceptance.

## Adobe and lawful graphics interoperability

Adobe's Photoshop desktop requirements list Windows and macOS; this Linux pack does not install Photoshop desktop. A licensed Windows/macOS companion can exchange reviewed files, or the optional official Photoshop API v2 adapter can process them remotely. A regular desktop subscription is not proof of API access: Adobe documents a Developer Console account, an active Enterprise contract including Firefly Services, and OAuth Server-to-Server credentials as API prerequisites.

`adobe-tools.example.json` shows the explicit remote settings. Merge only the needed tool/project entries into the private config. API use requires `enabled: true`, `allowPaidRequests: true`, project `allowExternalUpload: true`, private client ID/secret files, and `assetStorageFile`. The asset-storage file contains `endpoint`, `region`, `bucket`, `accessKeyId`, `secretAccessKey`, and a dedicated `prefix` for an **existing** owner-controlled S3-compatible bucket. Keep every credential file mode 0400/0600; never commit it or include secret values in shell arguments.

The local-byte bridge uploads only the reviewed input, uses signed temporary URLs for Adobe and downloads the result into the retained job artifacts. `adobe.manifest` accepts PSD; `adobe.render` accepts PSD, PNG and JPEG. PSB is not accepted by this adapter. Use a dedicated bucket prefix with a short lifecycle as a cleanup backstop. Job receipts report cleanup outcomes; a failed or cancelled local request is not evidence that uploaded bytes have already disappeared or that Adobe stopped a remote operation. Retain cancellation/cleanup receipts and review outstanding remote work. Storage/Adobe requests can incur the owner's service charges. Readiness without a live authorized request remains `configured_unverified`; this change makes no live Adobe request and does not establish an Adobe license.

For workflows that stay local, use SVG for vector interchange and PNG/TIFF/EXR/OpenRaster where appropriate for raster work. GIMP documents PSD/PSB and OpenRaster import/export; Krita documents supported PSD layer features and recommends suitable interchange formats. Preserve original PSD files and compare fonts, text layers, masks, effects, color profiles and linked assets before approving an export. Installing GIMP/Krita does not promise exact Photoshop rendering or plugin compatibility.

## Tests and CI

```bash
python3 -m unittest discover -s deploy/creative/tests -v
python3 -B -m unittest discover -s integrations/creative-tools/tests -v
node --test headless-runtime/test/creative-tools.test.mjs
```

The tests use tiny synthetic archives, fake HTTP responses, real bounded child fixtures, synthetic Cycles inventories and cgroup-file fixtures. They cover traversal/absolute paths, symlink escapes/chains/cycles, duplicate/special members, executable modes and timestamps, byte/entry limits, checksums, resume semantics, disk/platform preflight, concurrent installer locks, incomplete extraction, atomic publication, reuse, tamper detection, Unreal version/layout checks, GPU selection/failure, finite cgroup prerequisites and read-only planning. They do not install distro packages, spend provider credits or establish real GPU performance.

`.github/workflows/creative-tools.yml` runs the contract tests, a real read-only Linux host preflight and assertions over the actual Docker-merged CPU/GPU profiles as a required dependency of the main CI/release workflow. A manual dispatch with `blender_smoke: true` additionally installs signed distro dependencies, downloads/verifies the official archive, checks reuse, runs the bounded CPU render/export, exercises the real creative service against that engine with synthetic scope/grant fixtures, and verifies the installed files again afterward. It retains direct-render and service receipts/artifacts. CI never downloads Unreal without its authenticated owner or uses Adobe credentials.

Local verification of this pack included the real official Blender archive and CPU render/export. Docker/Compose was not available in the scratch environment; the added CI gate validates those merged profiles on its Docker-enabled runner. No GPU, Unreal binary, Adobe entitlement, production project or active VPS was supplied, so those capabilities remain explicitly unverified here.
