#!/usr/bin/env node
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {MemoryStore,readGraph,exportObsidian} from '../projects/research-memory-atlas/runtime/store.mjs';
import {queryGraph,exploreGraph,prerequisitePlan} from '../projects/research-memory-atlas/runtime/graph-core.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const args=process.argv.slice(2),command=args.shift()??'help',flags={};
const known=new Set(['--input','--store','--scope','--allow-scope','--query','--limit','--max-bytes','--at','--out','--node','--depth']);
try{
  for(let i=0;i<args.length;i++){const name=args[i];if(!known.has(name)||!args[i+1]||args[i+1].startsWith('--'))throw new Error('Invalid or missing flag value: '+name);(flags[name]??=[]).push(args[++i]);}
  const value=(name,fallback)=>flags[name]?.at(-1)??fallback;
  const scopes=flags['--scope']??['public'],grant={allowedScopes:flags['--allow-scope']??['public'],policyVersion:'local-cli-explicit-scopes-v1'};
  const input=value('--input',path.join(root,'company/knowledge-memory/atlas.json'));
  const query={query:value('--query',''),scopes,maxResults:Number(value('--limit','6')),maxBytes:Number(value('--max-bytes','8192')),...(value('--at')?{asOf:value('--at')}:{})};
  let result;
  if(command==='help'){console.log('Usage: node scripts/graph-memory.mjs validate|index|query|neighbors|plan|export-obsidian\n  --input atlas.json --store .work/memory --query "question" --limit 6\n  --scope public [--allow-scope company-id] [--at 2026-11-25T12:00:00Z]\n  neighbors --node public/g-pagerank --depth 2\n  export-obsidian --out /path/to/new/vault\nNo provider calls. Local scope flags are explicit caller grants, not authentication.');process.exit(0);}
  if(command==='index'){const store=new MemoryStore(value('--store',path.join(root,'.work/graph-memory')),grant);if(scopes.length!==1)throw new Error('Index one scope at a time');result=store.ingest(readGraph(input),scopes[0]);}
  else if(command==='query'&&value('--store'))result=new MemoryStore(value('--store'),grant).query(query);
  else{const graph=readGraph(input);
    if(command==='validate')result={valid:true,revision:graph.revision,nodes:graph.nodes.length,edges:graph.edges.length,sources:graph.sources.length};
    else if(command==='query')result=queryGraph(graph,query,grant);
    else if(command==='neighbors')result=exploreGraph(graph,value('--node',''),query,grant,Number(value('--depth','2')));
    else if(command==='plan')result=prerequisitePlan(graph,query,grant);
    else if(command==='export-obsidian'){if(!value('--out'))throw new Error('An export destination is required');result=exportObsidian(graph,value('--out'),query,grant);}
    else throw new Error('Unknown command: '+command);
  }
  console.log(JSON.stringify(result,null,2));
}catch(error){console.error(error.message??'Graph memory failed');process.exitCode=1;}
