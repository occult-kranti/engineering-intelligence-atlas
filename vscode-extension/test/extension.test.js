'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {createRequire}=require('node:module');
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const snapshot=()=>({activeCompanyId:'a',companies:[{id:'a',name:'A',assistantId:'assistant-a'},{id:'b',name:'B',assistantId:'donna'}],offices:[{id:'oa',companyId:'a',assistantId:'ao',name:'Engineering'}],departments:[],employees:[{id:'donna',companyId:null,kind:'assistant',status:'active',name:'Donna'},{id:'assistant-a',companyId:'a',officeId:null,departmentId:null,kind:'assistant',status:'active',name:'A coordinator'},{id:'ea',companyId:'a',officeId:'oa',kind:'specialist',name:'Engineer',role:'Engineer',status:'active',skillPaths:[]}],jobs:[]});
function harness(options={}) {
  const messages=[],calls=[],documents=[],registered=new Map();let handler,provider;
  const connection={kind:'cloud',url:'https://atlas.example',deviceToken:'synthetic-pairing-token-1234567890'};
  const state={secret:JSON.stringify(connection)};
  class Client {
    constructor(c){this.connection=c;}
    async snapshot(){calls.push(['snapshot']);return options.snapshot?options.snapshot():{snapshot:snapshot(),revision:7};}
    async chatHistory(company){calls.push(['history',company]);return options.history?options.history(company):{messages:[]};}
    async chat(company,content,id){calls.push(['chat',company,content,id]);return options.chat?options.chat(company,content,id):{reply:'Synthetic reply'};}
    async command(command){calls.push(['command',command]);return {queued:true};}
  }
  const noOp=()=>({dispose(){}});
  const vscode={StatusBarAlignment:{Left:0},ConfigurationTarget:{Global:1},
    Uri:{joinPath:(base,...parts)=>path.join(base,...parts),parse:value=>value},
    env:{openExternal:async()=>true},
    commands:{registerCommand:(id,fn)=>{registered.set(id,fn);return noOp();},executeCommand:async()=>{}},
    workspace:{isTrusted:options.trusted!==false,getConfiguration:()=>({get:()=>'',update:async()=>{}}),openTextDocument:async document=>{documents.push(document);return document;}},
    window:{createStatusBarItem:()=>({show(){},dispose(){}}),registerWebviewViewProvider:(_id,value)=>{provider=value;return noOp();},showErrorMessage:()=>{},showInformationMessage:()=>{},showWarningMessage:async()=>undefined,showTextDocument:async()=>{},showQuickPick:options.pick||(async()=>undefined),showInputBox:options.input||(async()=>undefined)}};
  const filename=path.resolve(__dirname,'../src/extension.js'),realRequire=createRequire(filename),sandbox={require:id=>id==='vscode'?vscode:id==='./client'?{...realRequire('./client'),AtlasClient:Client}:realRequire(id),module:{exports:{}},Buffer,setInterval:()=>1,clearInterval(){}};
  vm.runInNewContext(fs.readFileSync(filename,'utf8'),sandbox,{filename});
  sandbox.module.exports.activate({extensionUri:'/synthetic/extension',subscriptions:[],globalState:{get:()=> 'a',update:async()=>{}},secrets:{get:async()=>state.secret,store:async(_key,value)=>{state.secret=value;},delete:async()=>{if(options.deleteSecret)await options.deleteSecret();state.secret=undefined;}}});
  provider.resolveWebviewView({visible:true,onDidChangeVisibility:noOp,webview:{cspSource:'vscode-test',asWebviewUri:value=>value,postMessage:async message=>{messages.push(message);},onDidReceiveMessage:fn=>{handler=fn;return noOp();}}});
  return {messages,calls,documents,registered,send:message=>handler(message),vscode};
}
test('a late workspace response cannot restore a disconnected editor',async()=>{
  const pending=deferred(),h=harness({snapshot:()=>pending.promise});await flush();
  await h.registered.get('atlas.disconnect')();
  pending.resolve({snapshot:snapshot(),revision:7});await flush();await flush();
  assert.equal(h.messages.some(message=>message.type==='state'&&message.connected),false);
  assert.equal(h.messages.filter(message=>message.type==='state').at(-1).connected,false);
});
test('refresh cannot reload a revoked connection while SecretStorage deletion is pending',async()=>{
  const deletion=deferred(),h=harness({deleteSecret:()=>deletion.promise});await flush();
  const disconnected=h.registered.get('atlas.disconnect')();
  await h.registered.get('atlas.refresh')();
  assert.equal(h.messages.filter(message=>message.type==='state').at(-1).connected,false);
  assert.equal(h.calls.filter(call=>call[0]==='snapshot').length,1);
  deletion.resolve();await disconnected;
});
test('an in-flight chat remains bound to its original company and does not overwrite the new company',async()=>{
  const pending=deferred(),h=harness({chat:()=>pending.promise});await flush();
  const chat=h.send({type:'chat',companyId:'a',content:'A private brief'});await flush();
  await h.send({type:'company',id:'b'});
  pending.resolve({reply:'A private response'});await chat;await flush();
  assert.equal(h.calls.find(call=>call[0]==='chat')[1],'a');
  assert.equal(h.messages.some(message=>message.type==='chatSent'),false);
  assert.equal(h.messages.filter(message=>message.type==='state'&&message.connected).at(-1).selectedCompany,'b');
});
test('duplicate chat clicks dispatch one request while the first remains pending',async()=>{
  const pending=deferred(),h=harness({chat:()=>pending.promise});await flush();
  const first=h.send({type:'chat',companyId:'a',content:'One request'});await flush();
  await h.send({type:'chat',companyId:'a',content:'One request'});
  assert.equal(h.calls.filter(call=>call[0]==='chat').length,1);
  assert.match(h.messages.find(message=>message.type==='error').message,/Wait for the current/);
  pending.resolve({reply:'Done'});await first;
});
test('company switching during command preparation cannot mutate either company',async()=>{
  let reads=0;const pending=deferred(),h=harness({snapshot:()=>++reads===2?pending.promise:{snapshot:snapshot(),revision:7}});await flush();
  const command=h.send({type:'employee',companyId:'a',id:'ea',operation:'pause'});await flush();
  await h.send({type:'company',id:'b'});
  pending.resolve({snapshot:snapshot(),revision:7});await command;
  assert.equal(h.calls.some(call=>call[0]==='command'),false);
  assert.match(h.messages.find(message=>message.type==='error').message,/workspace changed/);
});
test('management command palette edits one selected employee through the existing command boundary',async()=>{
  let pick=0;const h=harness({pick:async rows=>[++pick===1?'update_employee':pick===2?'ea':'role'].map(value=>rows.find(row=>row.action===value||row.record?.id===value||row.key===value))[0],input:async()=> 'Backend reviewer'});await flush();
  await h.registered.get('atlas.manageTeam')();
  assert.deepEqual(h.calls.filter(call=>call[0]==='command'),[['command',{action:'update_employee',employeeId:'ea',role:'Backend reviewer'}]]);
  assert.match(h.messages.find(message=>message.type==='notice').message,/Waiting for desktop/);
});
test('ownership review remains read-only and requires a trusted editor',async()=>{
  const h=harness();await flush();await h.registered.get('atlas.reviewOwnership')();
  assert.equal(h.documents.length,1);assert.match(h.documents[0].content,/Donna and assistant ownership/);assert.equal(h.calls.some(call=>['command','chat'].includes(call[0])),false);
  const untrusted=harness({trusted:false});await flush();await untrusted.send({type:'manageTeam'});
  assert.equal(untrusted.calls.length,0);
});
