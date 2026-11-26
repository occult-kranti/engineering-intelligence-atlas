/** Exercise an already-created test venv using one generated offline wheel.
 * This is acceptance tooling, not an installer or a hostile-code sandbox.
 * The probe is uninstalled before returning; all temporary source is removed. */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
export const PYTHON_VENV_PROBE_SOURCE = `import json,os,site,sys
# Windows site.getsitepackages includes the base roots, which can legitimately
# supply standard-library modules. Only actual package directories count here.
normalized=lambda value: os.path.normcase(os.path.realpath(value))
base_roots={normalized(sys.base_prefix),normalized(sys.base_exec_prefix)}
base_package_dirs={normalized(value) for value in site.getsitepackages([sys.base_prefix,sys.base_exec_prefix])}-base_roots
path_dirs={normalized(value) for value in sys.path}
print(json.dumps({"prefix":os.path.realpath(sys.prefix),"basePrefix":os.path.realpath(sys.base_prefix),"executable":os.path.abspath(sys.executable),"baseExecutable":os.path.abspath(sys._base_executable),"version":list(sys.version_info[:3]),"isolated":sys.flags.isolated==1,"userSiteEnabled":site.ENABLE_USER_SITE,"systemSitePackages":bool(base_package_dirs.intersection(path_dirs)),"nullDevice":os.devnull}))`;
const lookupSource = 'import importlib.util,json,sys;print(json.dumps({"found":importlib.util.find_spec(sys.argv[1]) is not None}))';
const wheelSource = `import base64,csv,hashlib,io,json,pathlib,sys,zipfile
root=pathlib.Path(sys.argv[1]); name=sys.argv[2]; info=name+"-0.0.0.dist-info"
files={name+".py":('import json\\ndef calculate(a,b): return a*b\\nif __name__ == "__main__": print(json.dumps({"probe":"daftar-venv-acceptance","result":calculate(6,7)}))\\n').encode(),info+"/METADATA":("Metadata-Version: 2.1\\nName: "+name+"\\nVersion: 0.0.0\\n").encode(),info+"/WHEEL":b"Wheel-Version: 1.0\\nGenerator: Daftar acceptance\\nRoot-Is-Purelib: true\\nTag: py3-none-any\\n"}
record=io.StringIO(); writer=csv.writer(record,lineterminator="\\n")
for filename,data in files.items(): writer.writerow([filename,"sha256="+base64.urlsafe_b64encode(hashlib.sha256(data).digest()).rstrip(b"=").decode(),len(data)])
writer.writerow([info+"/RECORD","",""]); files[info+"/RECORD"]=record.getvalue().encode()
wheel=root/(name+"-0.0.0-py3-none-any.whl")
with zipfile.ZipFile(wheel,"w",zipfile.ZIP_DEFLATED) as archive:
 for filename,data in files.items(): archive.writestr(filename,data)
print(json.dumps({"wheel":str(wheel),"sha256":hashlib.sha256(wheel.read_bytes()).hexdigest()}))`;

function environment(pythonPath) {
  const value = {};
  for (const key of ['HOME', 'USER', 'LOGNAME', 'LANG', 'LC_ALL', 'PATH', 'SystemRoot', 'SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP']) {
    if (typeof process.env[key] === 'string' && !process.env[key].includes('\0')) value[key] = process.env[key];
  }
  value.PATH = `${path.dirname(pythonPath)}${path.delimiter}${value.PATH ?? ''}`;
  return { ...value, PYTHONNOUSERSITE: '1', PIP_REQUIRE_VIRTUALENV: 'true', PIP_DISABLE_PIP_VERSION_CHECK: '1' };
}

export async function runVenvAcceptance({ pythonPath, workingDirectory, timeoutMs = 30000, verifyInstalled } = {}) {
  assert.equal(typeof pythonPath, 'string'); assert.ok(path.isAbsolute(pythonPath), 'Use the exact returned absolute venv interpreter');
  assert.equal(typeof workingDirectory, 'string'); assert.ok(path.isAbsolute(workingDirectory));
  assert.ok(Number.isInteger(timeoutMs) && timeoutMs >= 1000 && timeoutMs <= 60000);
  assert.ok(verifyInstalled === undefined || typeof verifyInstalled === 'function');
  const directory = fs.mkdtempSync(path.join(workingDirectory, 'venv-acceptance-'));
  const moduleName = `daftar_venv_probe_${crypto.randomBytes(8).toString('hex')}`;
  const env = environment(pythonPath); let installed = false; let receipt;
  const execute = async (executable, args) => exec(executable, args, { cwd: directory, env, shell: false, windowsHide: true, timeout: timeoutMs, maxBuffer: 262144 });
  const inspect = async (executable, args) => JSON.parse((await execute(executable, ['-I', ...args])).stdout);
  try {
    const proof = await inspect(pythonPath, ['-c', PYTHON_VENV_PROBE_SOURCE]);
    assert.notEqual(proof.prefix, proof.basePrefix, 'The package test refuses a base/global interpreter');
    assert.equal(proof.isolated, true); assert.equal(proof.userSiteEnabled, false); assert.equal(proof.systemSitePackages, false);
    assert.ok(path.isAbsolute(proof.baseExecutable));
    // pip treats its platform's null device as an instruction to ignore every
    // config file. Explicit offline flags also prevent index/dependency access.
    env.PIP_CONFIG_FILE = proof.nullDevice;
    const pip = (await execute(pythonPath, ['-I', '-m', 'pip', '--isolated', '--require-virtualenv', '--version'])).stdout.trim();
    assert.match(pip, /^pip \d/);
    assert.equal((await inspect(pythonPath, ['-c', lookupSource, moduleName])).found, false);
    assert.equal((await inspect(proof.baseExecutable, ['-c', lookupSource, moduleName])).found, false);
    const wheel = await inspect(pythonPath, ['-c', wheelSource, directory, moduleName]);
    await execute(pythonPath, ['-I', '-m', 'pip', '--isolated', '--require-virtualenv', 'install', '--no-index', '--no-deps', '--no-compile', '--no-cache-dir', '--disable-pip-version-check', wheel.wheel]);
    installed = true;
    const output = await inspect(pythonPath, ['-m', moduleName]);
    assert.deepEqual(output, { probe: 'daftar-venv-acceptance', result: 42 });
    const location = await inspect(pythonPath, ['-c', 'import importlib,json,os,sys;m=importlib.import_module(sys.argv[1]);root=os.path.normcase(os.path.realpath(sys.prefix));source=os.path.normcase(os.path.realpath(m.__file__));print(json.dumps({"inside":os.path.commonpath([root,source])==root}))', moduleName]);
    assert.equal(location.inside, true, 'Probe must install inside the selected venv');
    assert.equal((await inspect(proof.baseExecutable, ['-c', lookupSource, moduleName])).found, false, 'Base interpreter must not see the venv package');
    receipt = { schemaVersion: 1, pythonVersion: proof.version, pipVersion: pip.split(/\s+/)[1],
      isolatedPrefix: true, isolatedMode: true, userSiteDisabled: true, systemSitePackagesExcluded: true,
      offlineWheelInstalled: true, offlineWheelSha256: wheel.sha256, moduleExecuted: true, moduleResult: output.result,
      packageInsideVenv: true, baseInterpreterCannotImportProbe: true, providerCalls: 0, packageIndexRequests: 0 };
    if (verifyInstalled) {
      await verifyInstalled({ moduleName, pythonPath });
      receipt.callbackVerified = true;
    }
  } finally {
    try {
      if (installed) {
        await execute(pythonPath, ['-I', '-m', 'pip', '--isolated', '--require-virtualenv', 'uninstall', '--yes', '--disable-pip-version-check', moduleName]);
        assert.equal((await inspect(pythonPath, ['-c', lookupSource, moduleName])).found, false, 'Acceptance package must be removed');
        if (receipt) receipt.probeUninstalled = true;
      }
    } finally { fs.rmSync(directory, { recursive: true, force: true }); }
  }
  return receipt;
}
