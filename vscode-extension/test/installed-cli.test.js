'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const helpers=import('../scripts/installed-cli.mjs');
async function fixture(t,{entry='..\\resources\\app\\out\\cli.mjs',insiders=false,writeEntry=true}={}){
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'VS Code & (literal) %value! '));t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const executable=path.join(root,insiders?'Code - Insiders.exe':'Code.exe');await fs.writeFile(executable,'fixture executable; never run');
  const launcher=path.join(root,'bin',insiders?'code-insiders.cmd':'code.cmd');await fs.mkdir(path.dirname(launcher),{recursive:true});
  const invocation=`"%~dp0..\\${path.basename(executable)}" "%~dp0${entry}" %*`;
  const source=`@echo off\r\nsetlocal\r\nset VSCODE_DEV=\r\nset ELECTRON_RUN_AS_NODE=1\r\n${invocation}\r\nIF %ERRORLEVEL% NEQ 0 EXIT /b %ERRORLEVEL%\r\nendlocal\r\n`;
  await fs.writeFile(launcher,source);
  const entryPath=path.resolve(path.dirname(launcher),...entry.split(/[\\/]/));
  if(writeEntry){await fs.mkdir(path.dirname(entryPath),{recursive:true});await fs.writeFile(entryPath,'export {}; // declared fixture only');}
  return{root,executable,launcher,entryPath,source,invocation};
}
test('Windows installation resolves the downloaded launcher declaration with literal metacharacter paths',async t=>{
  const {resolveWindowsCliEntry}=await helpers;
  for(const entry of ['..\\resources\\app\\out\\cli.js','..\\resources\\app\\out\\bootstrap\\cli-contenthash.mjs','../resources/app/out/cli.cjs']){
    const f=await fixture(t,{entry});const result=await resolveWindowsCliEntry(f.executable,f.launcher);
    assert.equal(result.executable,f.executable);assert.equal(result.entry,await fs.realpath(f.entryPath));assert.equal(result.launcher,await fs.realpath(f.launcher));assert.match(result.entry,/VS Code & \(literal\) %value!/);
  }
});
test('official insiders executable spelling and a BOM launcher remain literal',async t=>{
  const f=await fixture(t,{insiders:true});await fs.writeFile(f.launcher,'\uFEFF'+f.source);const {resolveWindowsCliEntry}=await helpers;
  assert.equal((await resolveWindowsCliEntry(f.executable,f.launcher)).entry,await fs.realpath(f.entryPath));
});
test('the captured VS Code 1.147.0 archive version directory resolves only its declared entry',async t=>{
  const f=await fixture(t,{entry:'..\\8a14f0cc1b\\resources\\app\\out\\cli.js'});const {resolveWindowsCliEntry}=await helpers;
  const result=await resolveWindowsCliEntry(f.executable,f.launcher);assert.equal(result.entry,await fs.realpath(f.entryPath));assert.match(result.entry,/[\\/]8a14f0cc1b[\\/]resources[\\/]app[\\/]out[\\/]cli\.js$/);
  const direct=path.join(f.root,'resources','app','out','cli.js');await fs.mkdir(path.dirname(direct),{recursive:true});await fs.writeFile(direct,'wrong direct entry');
  await fs.unlink(f.entryPath);await assert.rejects(resolveWindowsCliEntry(f.executable,f.launcher),/ENOENT/);
});
test('arbitrary or nested bundle-prefix directories remain unsupported',async t=>{
  const {resolveWindowsCliEntry}=await helpers;
  for(const entry of ['..\\arbitrary\\resources\\app\\out\\cli.js','..\\8a14f0cc1b\\8a14f0cc1b\\resources\\app\\out\\cli.js']){
    const f=await fixture(t,{entry});await assert.rejects(resolveWindowsCliEntry(f.executable,f.launcher),/10-hex version directory/);
  }
});
test('a missing declared CLI never falls back to a guessed module',async t=>{
  const f=await fixture(t,{entry:'..\\resources\\app\\out\\declared-missing.mjs',writeEntry:false});const other=path.join(f.root,'resources','app','out','cli.js');await fs.mkdir(path.dirname(other),{recursive:true});await fs.writeFile(other,'not the declared entry');
  const {resolveWindowsCliEntry}=await helpers;await assert.rejects(resolveWindowsCliEntry(f.executable,f.launcher),/ENOENT/);
});
test('unsafe substitutions, escaping paths and shell suffixes fail closed',async t=>{
  const f=await fixture(t);const {resolveWindowsCliEntry}=await helpers;
  for(const declared of ['..\\resources\\app\\out\\%ENTRY%.mjs','..\\resources\\app\\out\\!ENTRY!.mjs','..\\resources\\app\\out\\cli^name.mjs','..\\..\\outside.mjs','C:\\outside.mjs']){
    await fs.writeFile(f.launcher,f.source.replace('%~dp0..\\resources\\app\\out\\cli.mjs',`%~dp0${declared}`));
    await assert.rejects(resolveWindowsCliEntry(f.executable,f.launcher),/Unsafe|escapes|Invalid/);
  }
  await fs.writeFile(f.launcher,f.source.replace(f.invocation,`${f.invocation} & echo injected`));await assert.rejects(resolveWindowsCliEntry(f.executable,f.launcher),/Unsupported/);
});
test('ambiguous invocations, missing Node mode and oversized wrapper text are rejected',async t=>{
  const f=await fixture(t);const {resolveWindowsCliEntry}=await helpers;
  for(const source of [f.source+f.invocation+'\n',f.source.replace('set ELECTRON_RUN_AS_NODE=1','set ELECTRON_RUN_AS_NODE=0'),'x'.repeat(32769),f.source+'\0']){
    await fs.writeFile(f.launcher,source);await assert.rejects(resolveWindowsCliEntry(f.executable,f.launcher),/Unsupported|Node mode|bounded size|Invalid/);
  }
});
test('the declaration must identify the downloaded executable and its own out tree',async t=>{
  const f=await fixture(t);const {resolveWindowsCliEntry}=await helpers;await fs.writeFile(path.join(f.root,'Other.exe'),'not the downloaded executable');
  await fs.writeFile(f.launcher,f.source.replace('..\\Code.exe','..\\Other.exe'));await assert.rejects(resolveWindowsCliEntry(f.executable,f.launcher),/different executable/);
  await fs.writeFile(path.join(f.root,'outside.mjs'),'outside the out tree');await fs.writeFile(f.launcher,f.source.replace('..\\resources\\app\\out\\cli.mjs','..\\outside.mjs'));await assert.rejects(resolveWindowsCliEntry(f.executable,f.launcher),/resources\/app\/out/);
});
test('a CLI entry symlink is not accepted as a regular bundle file',async t=>{
  const f=await fixture(t);const {resolveWindowsCliEntry}=await helpers;const alternate=path.join(f.root,'target.mjs');await fs.writeFile(alternate,'export {};');await fs.unlink(f.entryPath);
  try{await fs.symlink(alternate,f.entryPath);}catch(error){if(['EPERM','EACCES','ENOTSUP'].includes(error.code)){t.skip('Symlink creation is unavailable on this host.');return;}throw error;}
  await assert.rejects(resolveWindowsCliEntry(f.executable,f.launcher),/regular downloaded/);
});
test('installation diagnostics expose bounded process failure evidence and omit token-shaped material',async()=>{
  const {installDiagnostics}=await helpers;
  const log=installDiagnostics({status:1,signal:null,error:new Error('MODULE_NOT_FOUND'),stdout:'a'.repeat(15000),stderr:'Error: no declared module\nsk-not-a-real-credential'},{executable:'C:\\VS Code\\Code.exe',launcher:'C:\\VS Code\\bin\\code.cmd',entry:'C:\\VS Code\\resources\\app\\out\\cli.mjs'});
  assert.match(log,/status: 1/);assert.match(log,/MODULE_NOT_FOUND/);assert.match(log,/no declared module/);assert.match(log,/last 12000 characters/);assert.match(log,/credential omitted/);assert.ok(!log.includes('sk-not-a-real-credential'));assert.ok(log.length<26000);
});
