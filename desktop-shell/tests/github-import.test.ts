import {describe,expect,it,vi} from 'vitest';
import {discoverPublicRepositories} from '../src/main/githubImport';
const repo=(name:string,owner='fixture')=>({name,private:false,owner:{login:owner},html_url:`https://github.com/${owner}/${name}`});
const response=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json'}});
describe('public GitHub company discovery',()=>{
 it.each([null,undefined,1,'','https://github.com/fixture','fixture/../../other','fixture?token=x','fixture@evil.test','fixture\nInjected','-leading'])('rejects invalid owner %s before networking',async owner=>{const fetcher=vi.fn();await expect(discoverPublicRepositories(owner,fetcher as typeof fetch)).rejects.toThrow(/account name/);expect(fetcher).not.toHaveBeenCalled();});
 it('uses fixed GitHub API URLs and rejects redirects',async()=>{const fetcher=vi.fn(async()=>response([repo('one')]));const result=await discoverPublicRepositories(' fixture ',fetcher as typeof fetch);expect(result).toHaveLength(1);expect(result[0]).toMatchObject({name:'one',repoUrl:'https://github.com/fixture/one',source:'github-public-api'});expect(fetcher).toHaveBeenCalledWith('https://api.github.com/users/fixture/repos?type=owner&sort=full_name&per_page=100&page=1',expect.objectContaining({method:'GET',redirect:'error'}));});
 it('paginates and deduplicates repeated repository identities',async()=>{const fetcher=vi.fn().mockResolvedValueOnce(response(Array.from({length:100},(_,i)=>repo(`repo-${i}`)))).mockResolvedValueOnce(response([repo('repo-0'),repo('new-repository')]));const result=await discoverPublicRepositories('fixture',fetcher);expect(result).toHaveLength(101);expect(fetcher).toHaveBeenCalledTimes(2);expect(fetcher.mock.calls[1]?.[0]).toContain('page=2');});
 it.each([{...repo('valid'),private:true},{...repo('valid'),owner:{login:'different'}},{...repo('valid'),html_url:'https://evil.example/fixture/valid'},repo('../escape'),repo('.'),{...repo('valid'),html_url:'https://github.com/fixture/valid?token=leak'},{name:'incomplete'}])('rejects hostile or incomplete metadata',async metadata=>{const fetcher=vi.fn(async()=>response([repo('safe-first'),metadata]));await expect(discoverPublicRepositories('fixture',fetcher as typeof fetch)).rejects.toThrow();});
 it('returns no partial catalog after a later HTTP failure',async()=>{const fetcher=vi.fn().mockResolvedValueOnce(response(Array.from({length:100},(_,i)=>repo(`repo-${i}`)))).mockResolvedValueOnce(response({message:'rate limited'},403));await expect(discoverPublicRepositories('fixture',fetcher)).rejects.toThrow(/No partial catalog was imported/);expect(fetcher).toHaveBeenCalledTimes(2);});
 it('returns no partial catalog after a later network failure',async()=>{const fetcher=vi.fn().mockResolvedValueOnce(response(Array.from({length:100},(_,i)=>repo(`repo-${i}`)))).mockRejectedValueOnce(new Error('Fixture network failure'));await expect(discoverPublicRepositories('fixture',fetcher)).rejects.toThrow(/request failed before a verified response/);});
 it('rejects oversized streamed bodies',async()=>{const fetcher=vi.fn(async()=>new Response('x'.repeat(2_000_001)));await expect(discoverPublicRepositories('fixture',fetcher as typeof fetch)).rejects.toThrow(/response limit/);});
 it('rejects invalid JSON and pages over100 rows',async()=>{await expect(discoverPublicRepositories('fixture',vi.fn(async()=>new Response('{'))as typeof fetch)).rejects.toThrow();await expect(discoverPublicRepositories('fixture',vi.fn(async()=>response(Array.from({length:101},(_,i)=>repo(`repo-${i}`))))as typeof fetch)).rejects.toThrow(/invalid repository catalog/);});
 it('accepts exactly 2,000 repositories after a bounded empty-page check',async()=>{
  const fetcher=vi.fn(async(input:RequestInfo|URL)=>{
   const page=Number(new URL(String(input)).searchParams.get('page'));
   return response(page<=20?Array.from({length:100},(_,i)=>repo(`repo-${(page-1)*100+i}`)):[]);
  });
  await expect(discoverPublicRepositories('fixture',fetcher as typeof fetch)).resolves.toHaveLength(2000);
  expect(fetcher).toHaveBeenCalledTimes(21);
 });
 it('rejects a catalog larger than 2,000 without returning a partial list',async()=>{
  const fetcher=vi.fn(async(input:RequestInfo|URL)=>{
   const page=Number(new URL(String(input)).searchParams.get('page'));
   return response(Array.from({length:page<=20?100:1},(_,i)=>repo(`repo-${(page-1)*100+i}`)));
  });
  await expect(discoverPublicRepositories('fixture',fetcher as typeof fetch)).rejects.toThrow(/2,?000/);
 });
 it('returns an empty list for an empty account',async()=>{await expect(discoverPublicRepositories('fixture',vi.fn(async()=>response([]))as typeof fetch)).resolves.toEqual([]);});
});
