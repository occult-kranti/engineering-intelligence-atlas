import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { PYTHON_VENV_PROBE_SOURCE } from '../../scripts/venv-acceptance.mjs';

// Execute the same Python proof used by real offline pip acceptance. These
// fixtures emulate site.getsitepackages/sys.path layouts, not a Windows host.
const pythonPath = process.env.DAFTAR_PYTHON_PATH || 'python3';
const fixtureSource = `import json,os,site,sys
fixture=json.loads(sys.argv[1])
sys.base_prefix=os.path.join(os.getcwd(),"fixture-base-python")
sys.base_exec_prefix=os.path.join(os.getcwd(),"fixture-base-exec-python")
def package_directory(prefix):
 return os.path.join(prefix,"Lib","site-packages") if fixture["layout"]=="windows" else os.path.join(prefix,"lib","python3.12","site-packages")
site.getsitepackages=lambda prefixes: [directory for prefix in prefixes for directory in ([prefix,package_directory(prefix)] if fixture["layout"]=="windows" else [package_directory(prefix)])]
sys.path=[sys.base_prefix,sys.base_exec_prefix,os.path.join(sys.base_prefix,"DLLs"),os.path.join(sys.base_prefix,"lib","python3.12")]
if fixture["leak"]: sys.path.append(package_directory(sys.base_prefix if fixture["leak"]=="base" else sys.base_exec_prefix))
exec(sys.argv[2])`;

for (const layout of ['windows', 'posix']) {
  for (const leak of [null, 'base', 'exec']) {
    test(`portable Python proof distinguishes ${layout} stdlib roots from ${leak ?? 'no'} base-package leakage`, () => {
      const result = spawnSync(pythonPath, ['-I', '-c', fixtureSource, JSON.stringify({ layout, leak }), PYTHON_VENV_PROBE_SOURCE], {
        encoding: 'utf8', timeout: 10000, maxBuffer: 8192, windowsHide: true,
      });
      assert.ifError(result.error); assert.equal(result.status, 0, result.stderr);
      const proof = JSON.parse(result.stdout);
      assert.equal(proof.isolated, true); assert.equal(proof.userSiteEnabled, false);
      assert.equal(proof.systemSitePackages, leak !== null, 'Only actual base-package directories count as package leakage');
    });
  }
}
