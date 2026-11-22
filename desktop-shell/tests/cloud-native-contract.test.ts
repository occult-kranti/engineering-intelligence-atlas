import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { OfficeService } from '../src/main/office';
import { cloudSnapshot, syncStateHash } from '../src/main/cloudSync';
const dirs:string[]=[];
afterEach(()=>{for(const dir of dirs.splice(0))fs.rmSync(dir,{recursive:true,force:true});});
describe('real Rust and TypeScript cloud command contract',()=>{
  it('agrees on canonical hashes, rejects stale state and deduplicates lost acknowledgements',async()=>{
    const userDataPath=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-sync-native-'));dirs.push(userDataPath);
    const binaryPath=path.resolve(__dirname,'../native',process.platform==='win32'?'atlas-core.exe':'atlas-core');
    expect(fs.existsSync(binaryPath),'Build the native core before this integration gate.').toBe(true);
    const service=new OfficeService({userDataPath,seedDir:path.resolve(__dirname,'../../company'),binaryPath});
    const first=await service.officeSnapshot();expect(first.ok).toBe(true);
    const originalHash=syncStateHash(first.snapshot!);
    const companyCount=first.snapshot!.companies.length;
    const command={action:'apply_remote_command' as const,id:'integration-command',expectedStateHash:originalHash,command:{action:'create_company',id:'cloud-contract-test',name:'Cloud contract test'}};
    const applied=await service.officeCommand(command);expect(applied.error).toBeUndefined();expect(applied.ok).toBe(true);
    expect(applied.snapshot!.companies).toHaveLength(companyCount+1);
    expect(syncStateHash(applied.snapshot!)).not.toBe(originalHash);
    const replayed=await service.officeCommand(command);expect(replayed.ok).toBe(true);expect(replayed.snapshot!.companies).toHaveLength(companyCount+1);expect(replayed.snapshot!.lastAction?.replayed).toBe(true);
    const stale=await service.officeCommand({...command,id:'stale-integration-command',command:{action:'create_company',name:'Must not be created'}});
    expect(stale.ok).toBe(false);expect(stale.code).toBe('CONFLICT');
    expect((await service.officeSnapshot()).snapshot!.companies).toHaveLength(companyCount+1);
  });
  it('imports a cloud reply once through the real native receipt transaction without dispatch or budget changes',async()=>{
    const userDataPath=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-chat-native-'));dirs.push(userDataPath);
    const binaryPath=path.resolve(__dirname,'../native',process.platform==='win32'?'atlas-core.exe':'atlas-core');
    const service=new OfficeService({userDataPath,seedDir:path.resolve(__dirname,'../../company'),binaryPath});
    const first=await service.officeSnapshot();expect(first.ok).toBe(true);
    const messageId='cloud-00000000-0000-4000-8000-000000000009';
    const content='A saved private website reply.\r\n'+'漢'.repeat(45000)+'🎼'.repeat(5000);
    const request={action:'apply_remote_command' as const,id:'cloud-chat-00000000-0000-4000-8000-000000000009',expectedStateHash:syncStateHash(first.snapshot!),command:{action:'import_cloud_message',id:messageId,scope:{kind:'employee',id:'donna'},role:'assistant',content,createdAt:'2026-11-21T00:00:00.000Z'}};
    const applied=await service.officeCommand(request);expect(applied.error).toBeUndefined();expect(applied.ok).toBe(true);
    const replayed=await service.officeCommand(request);expect(replayed.ok).toBe(true);expect(replayed.snapshot!.lastAction?.replayed).toBe(true);
    const persisted=await service.officeSnapshot();const messages=persisted.snapshot!.chatThreads.flatMap(t=>t.messages).filter(m=>m.id===messageId);
    expect(messages).toEqual([{id:messageId,role:'assistant',content,createdAt:'2026-11-21T00:00:00.000Z',source:'cloud'}]);
    expect(persisted.snapshot!.jobs).toEqual(first.snapshot!.jobs);expect(persisted.snapshot!.goals).toEqual(first.snapshot!.goals);expect(persisted.snapshot!.budget).toEqual(first.snapshot!.budget);
  });
  it('keeps native/cloud hashes equal after a real export and restore relocates and renames decision artifacts',async()=>{
    const root=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-sync-restore-'));dirs.push(root);
    const userDataPath=path.join(root,'original');const restoredPath=path.join(root,'restored');
    const repo=path.resolve(__dirname,'../..');
    const binaryPath=path.resolve(__dirname,'../native',process.platform==='win32'?'atlas-core.exe':'atlas-core');
    const options={seedDir:path.join(repo,'company'),binaryPath};
    const service=new OfficeService({...options,userDataPath});
    const first=await service.officeSnapshot();expect(first.ok).toBe(true);
    const companyId=first.snapshot!.activeCompanyId;
    const artifactDir=path.join(userDataPath,'office-artifacts');fs.mkdirSync(artifactDir,{recursive:true});
    const artifactPath=path.join(artifactDir,'a'.repeat(64)+'.md');
    const artifactText='# Synthetic expert report\n\nNo provider request was made.\n';fs.writeFileSync(artifactPath,artifactText);
    const contentHash=crypto.createHash('sha256').update(artifactText).digest('hex');expect(contentHash).not.toBe('a'.repeat(64));
    const panel=await service.officeCommand({action:'convene_panel',companyId,title:'Portable evidence',task:'Check synthetic artifact references',focus:'software',roleKeys:['qa'],maxRounds:1,maxUsd:1,maxTokens:1000,maxMinutes:1});
    expect(panel.error).toBeUndefined();expect(panel.ok).toBe(true);const panelId=String(panel.snapshot!.lastAction!.panelId);
    const started=await service.officeCommand({action:'start_panel_round',panelId});expect(started.error).toBeUndefined();expect(started.ok).toBe(true);
    let finished=0;
    for(let i=0;i<10;i++){
      const claimed=await service.workerCommand({action:'claim_job',workerId:'synthetic-restore-worker'});expect(claimed.error).toBeUndefined();
      const jobId=claimed.snapshot?.lastAction?.jobId;if(!jobId)break;
      const attempt=claimed.snapshot!.jobs.find(job=>job.id===jobId)!;
      const done=await service.workerCommand({action:'finish_job',jobId,leaseToken:claimed.snapshot!.lastAction!.leaseToken,status:'completed',inputTokens:0,outputTokens:0,costUsd:0,artifactUri:artifactPath,artifactSha256:contentHash,summary:'Synthetic local test report'});
      expect(done.error).toBeUndefined();expect(done.ok).toBe(true);finished++;
      if(attempt.pair?.phase==='review'){
        const reviewed=await service.workerCommand({action:'record_step_review',jobId,leaseToken:attempt.leaseToken,
          primaryJobId:attempt.pair.primaryJobId,primaryArtifactSha256:contentHash,reviewArtifactSha256:contentHash,
          primaryArtifactComplete:true,verdict:'accepted',summary:'Synthetic paired fixture accepted only for export/restore testing.',evidenceRefs:[artifactPath]});
        expect(reviewed.error).toBeUndefined();expect(reviewed.ok).toBe(true);
      }
    }
    expect(finished).toBe(4);
    const httpsEvidence='https://example.org/reports/verified?path=/tmp/reference.md';
    const evidence=[artifactPath,pathToFileURL(artifactPath).href,'C:\\Private\\original.md','\\\\private-server\\share\\report.md',httpsEvidence,'project/reference.md'];
    const decided=await service.officeCommand({action:'record_panel_decision',panelId,verdict:'accepted',summary:'Synthetic report accepted for the portability test',evidence});expect(decided.error).toBeUndefined();expect(decided.ok).toBe(true);
    const chatText=`Keep this authored note unchanged: ${artifactPath}`;
    const posted=await service.officeCommand({action:'post_chat',scope:{kind:'company',id:companyId},content:chatText});expect(posted.ok).toBe(true);
    const original=(await service.officeSnapshot()).snapshot!;const beforeHash=syncStateHash(original);
    const archive=path.join(root,'workspace.zip');const python=process.platform==='win32'?'python':'python3';
    execFileSync(python,[path.join(repo,'scripts/export-personal-workspace.py'),'--state',path.join(userDataPath,'company/company-state.json'),'--out',archive,'--artifact-root',artifactDir],{encoding:'utf8',timeout:20000});
    execFileSync(python,[path.join(repo,'scripts/restore-personal-workspace.py'),'--archive',archive,'--user-data-path',restoredPath],{encoding:'utf8',timeout:20000});
    const restoredService=new OfficeService({...options,userDataPath:restoredPath});
    const restoredResult=await restoredService.officeSnapshot();expect(restoredResult.error).toBeUndefined();expect(restoredResult.ok).toBe(true);const restored=restoredResult.snapshot!;
    const restoredEvidence=restored.decisionPanels.find(p=>p.id===panelId)!.decisions[0]!.evidence;
    expect(restoredEvidence[0]).toBe(path.join(restoredPath,'office-artifacts',contentHash+'.md'));
    expect(restoredEvidence[1]).toBe(restoredEvidence[0]);expect(fs.readFileSync(restoredEvidence[0]!,'utf8')).toBe(artifactText);
    expect(path.basename(restoredEvidence[0]!)).not.toBe(path.basename(artifactPath));
    expect(restoredEvidence.slice(2)).toEqual(evidence.slice(2));
    expect(restored.chatThreads.flatMap(t=>t.messages).some(m=>m.content===chatText)).toBe(true);
    expect(syncStateHash(restored)).toBe(beforeHash);
    expect(cloudSnapshot(restored).decisionPanels.find(p=>p.id===panelId)!.decisions[0]!.evidence).toEqual([...Array(4).fill('[local artifact omitted from cloud]'),httpsEvidence,'project/reference.md']);
    // A real Rust transaction must accept the TypeScript hash from before relocation.
    const accepted=await restoredService.officeCommand({action:'apply_remote_command',id:'portable-hash-check',expectedStateHash:beforeHash,command:{action:'select_company',companyId}});
    expect(accepted.error).toBeUndefined();expect(accepted.ok).toBe(true);
  },30000);
});
