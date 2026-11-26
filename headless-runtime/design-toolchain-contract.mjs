import { bounded, fields, safeId } from './model-resources-contract.mjs';
export class DesignToolchainError extends Error {
  constructor(code, message, status = 400) { super(message); this.name = 'DesignToolchainError'; this.code = code.replace(/^RESOURCE_/, 'DESIGN_'); this.status = status; }
}
export const designFail = (code, message, status = 400) => { throw new DesignToolchainError(code, message, status); };
export const DESIGN_LIMITS = Object.freeze({ plans: 128, installs: 128, downloadBytes: 2 * 1024 ** 3, installedBytes: 8 * 1024 ** 3, artifactBytes: 1024 ** 3, extractedBytes: 512 * 1024 ** 2, dependencies: 256 });
export const DESIGN_CATALOG = Object.freeze([
  { id: 'blender', name: 'Blender', category: '3D creation', license: 'GPL-3.0-or-later for distributed binaries; source components vary', licenseUrl: 'https://www.blender.org/about/license/', method: 'signed-apt', package: 'blender', gui: true, headless: 'Background rendering and command-line automation', runtime: 'Distribution-managed application runtime; bundled Python is not a project virtualenv', docs: 'https://docs.blender.org/manual/en/latest/advanced/command_line/render.html', installDocs: 'https://www.blender.org/download/' },
  { id: 'godot4', name: 'Godot 4', category: '3D and 2D engine', license: 'MIT; third-party components retain their licenses', licenseUrl: 'https://godotengine.org/license/', method: 'verified-portable', gui: true, headless: 'Explicit --headless runtime/editor tasks', runtime: 'Private portable application runtime', docs: 'https://docs.godotengine.org/en/stable/tutorials/editor/command_line_tutorial.html', installDocs: 'https://godotengine.org/download/archive/' },
  { id: 'penpot', name: 'Penpot', category: 'Browser interface design', license: 'MPL-2.0; bundled services have separate licenses', licenseUrl: 'https://github.com/penpot/penpot/blob/develop/LICENSE', method: 'reviewed-compose-required', gui: 'Web browser', headless: 'Server deployment requires Docker and Docker Compose', runtime: 'Container application stack; not a Python virtualenv', docs: 'https://help.penpot.app/technical-guide/getting-started/docker/', installDocs: 'https://help.penpot.app/technical-guide/getting-started/docker/', note: 'Separate design product; this does not install Figma or promise complete Figma-file compatibility.' },
  { id: 'krita', name: 'Krita', category: 'Digital painting', license: 'GNU GPL version 3; component notices apply', licenseUrl: 'https://krita.org/en/about/license/', method: 'signed-apt', package: 'krita', gui: true, headless: 'Some command-line export options; a GUI/display requirement remains workload-dependent', runtime: 'Distribution-managed application runtime', docs: 'https://docs.krita.org/en/reference_manual/linux_command_line.html', installDocs: 'https://docs.krita.org/en/user_manual/getting_started/installation.html' },
  { id: 'gimp', name: 'GIMP', category: 'Raster image editing', license: 'GPL-3.0-or-later', licenseUrl: 'https://www.gimp.org/docs/userfaq.html', method: 'signed-apt', package: 'gimp', gui: true, headless: 'Version-dependent noninteractive batch/console support', runtime: 'Distribution-managed application runtime', docs: 'https://www.gimp.org/man/gimp.html', installDocs: 'https://www.gimp.org/downloads/', note: 'Separate image editor; this does not install Adobe Photoshop or guarantee Photoshop-file fidelity.' },
  { id: 'inkscape', name: 'Inkscape', category: 'Vector graphics', license: 'GNU GPL; verify exact version and bundled component notices in the pinned package copyright', licenseUrl: 'https://inkscape.org/about/license/', method: 'signed-apt', package: 'inkscape', gui: true, headless: 'Command-line export; verify options against the installed version', runtime: 'Distribution-managed application runtime', docs: 'https://inkscape.org/doc/inkscape-man.html', installDocs: 'https://inkscape.org/release/' }
]);
const exactText = (value, regex, limit) => typeof value === 'string' && value.length <= limit && regex.test(value) && !/[\r\n\0]/.test(value);
export function validateGodotArtifact(artifact, target) {
  fields(artifact, ['version', 'url', 'sha256', 'maxBytes'], undefined, designFail);
  if (!exactText(artifact.version, /^4\.\d+(?:\.\d+)?-stable$/, 40) || !exactText(artifact.sha256, /^[a-f0-9]{64}$/, 64)) designFail('DESIGN_ARTIFACT_INVALID', 'An exact Godot 4 stable version and reviewed SHA-256 digest are required.');
  if (!Number.isSafeInteger(artifact.maxBytes)) designFail('DESIGN_ARTIFACT_INVALID', 'An integer artifact byte ceiling is required.'); bounded(artifact.maxBytes, 1, DESIGN_LIMITS.artifactBytes, designFail);
  let url; try { url = new URL(artifact.url); } catch { designFail('DESIGN_ARTIFACT_INVALID', 'A fixed official Godot release URL is required.'); }
  const match = url.pathname.match(/^\/godotengine\/(godot|godot-builds)\/releases\/download\/(4\.\d+(?:\.\d+)?-stable)\/Godot_v(4\.\d+(?:\.\d+)?-stable)_linux\.(x86_64|arm64)\.zip$/);
  if (url.protocol !== 'https:' || url.hostname !== 'github.com' || url.port || url.username || url.password || url.search || url.hash || !match || match[2] !== artifact.version || match[3] !== artifact.version || (target && match[4] !== (target.arch === 'aarch64' ? 'arm64' : 'x86_64'))) designFail('DESIGN_ARTIFACT_INVALID', 'Only matching official Godot Linux release artifacts are accepted.');
  return { version: artifact.version, url: url.href, sha256: artifact.sha256, maxBytes: artifact.maxBytes };
}
const id = { type: 'string', pattern: '^[A-Za-z0-9_.:-]{1,160}$', maxLength: 160 };
const obj = (properties, required = Object.keys(properties)) => ({ type: 'object', properties, required, additionalProperties: false });
const targetSchema = obj({ distribution: { type: 'string', enum: ['debian', 'ubuntu'] }, versionId: { type: 'string', pattern: '^[0-9]{1,4}(\\.[0-9]{1,3})?$', maxLength: 8 }, arch: { type: 'string', enum: ['x86_64', 'aarch64'] } });
const artifactSchema = obj({ version: { type: 'string', pattern: '^4\\.[0-9]+(\\.[0-9]+)?-stable$', maxLength: 40 }, url: { type: 'string', maxLength: 500 }, sha256: { type: 'string', pattern: '^[a-f0-9]{64}$' }, maxBytes: { type: 'integer', minimum: 1, maximum: DESIGN_LIMITS.artifactBytes } });
export const DESIGN_TOOLCHAIN_SCHEMAS = Object.freeze({
  catalog: obj({}),
  plan: obj({ id, companyId: id, employeeId: id, toolId: { type: 'string', enum: DESIGN_CATALOG.map(item => item.id) }, target: targetSchema,
    packageVersion: { type: 'string', maxLength: 100 }, artifact: artifactSchema,
    timeoutSeconds: { type: 'integer', minimum: 1, maximum: 86400 }, maxOutputBytes: { type: 'integer', minimum: 1, maximum: 8388608 } }, ['id', 'companyId', 'employeeId', 'toolId']),
  install: obj({ id, planId: id, expectedPlanHash: { type: 'string', pattern: '^[a-f0-9]{64}$' } }),
  inspect: obj({ id })
});
export function validateDesignToolchainOperation(operation, input = {}) {
  const schema = Object.hasOwn(DESIGN_TOOLCHAIN_SCHEMAS, operation) && DESIGN_TOOLCHAIN_SCHEMAS[operation];
  if (!schema) designFail('DESIGN_INPUT_INVALID', 'Unknown design-toolchain operation.');
  fields(input, Object.keys(schema.properties), schema.required, designFail);
  for (const key of ['id', 'companyId', 'employeeId', 'planId']) if (input[key] !== undefined) safeId(input[key], designFail);
  if (operation === 'install' && !exactText(input.expectedPlanHash, /^[a-f0-9]{64}$/, 64)) designFail('DESIGN_INPUT_INVALID', 'An exact plan hash is required.');
  if (operation !== 'plan') return input;
  if (!DESIGN_CATALOG.some(item => item.id === input.toolId)) designFail('DESIGN_INPUT_INVALID', 'Select a cataloged design application.');
  let target;
  if (input.target !== undefined) {
    fields(input.target, ['distribution', 'versionId', 'arch'], undefined, designFail);
    if (!['debian', 'ubuntu'].includes(input.target.distribution) || !['x86_64', 'aarch64'].includes(input.target.arch) || !exactText(input.target.versionId, /^\d{1,4}(?:\.\d{1,3})?$/, 8)) designFail('DESIGN_INPUT_INVALID', 'A supported exact target distribution and architecture are required.');
    target = { distribution: input.target.distribution, versionId: input.target.versionId, arch: input.target.arch };
  }
  if (input.packageVersion !== undefined && !exactText(input.packageVersion, /^[A-Za-z0-9][A-Za-z0-9.+:~_-]{0,99}$/, 100)) designFail('DESIGN_INPUT_INVALID', 'An exact distribution package version is required.');
  if (input.packageVersion && ['godot4', 'penpot'].includes(input.toolId)) designFail('DESIGN_INPUT_INVALID', 'This application does not use the signed APT recipe.');
  if (input.artifact && input.toolId !== 'godot4') designFail('DESIGN_INPUT_INVALID', 'Portable artifacts are supported only for Godot 4.');
  for (const [key, max] of [['timeoutSeconds', 86400], ['maxOutputBytes', 8388608]]) if (input[key] !== undefined && (!Number.isInteger(input[key]) || bounded(input[key], 1, max, designFail) < 1)) designFail('DESIGN_INPUT_INVALID', 'A job limit is invalid.');
  return { id: input.id, companyId: input.companyId, employeeId: input.employeeId, toolId: input.toolId,
    ...(target ? { target } : {}), ...(input.packageVersion ? { packageVersion: input.packageVersion } : {}),
    ...(input.artifact ? { artifact: validateGodotArtifact(input.artifact, target) } : {}), timeoutSeconds: input.timeoutSeconds ?? 1800, maxOutputBytes: input.maxOutputBytes ?? 1048576 };
}
