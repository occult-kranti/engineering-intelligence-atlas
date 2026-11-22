import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { assertImprovementPriceQuote, readImprovementPriceCatalog, selectImprovementRoute } from '../src/main/improvementPricing';
const directories:string[]=[];
const now=Date.parse('2026-11-22T12:00:00Z');
const cheap={provider:'anthropic' as const,model:'test-small'};
const expensive={provider:'anthropic' as const,model:'test-large'};
function catalog() {
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'daftar-price-'));directories.push(dir);const filename=path.join(dir,'prices.json');
 const data={schemaVersion:1,observedAt:'2026-11-22T00:00:00Z',expiresAt:'2026-12-22T00:00:00Z',routes:[
  {...cheap,source:'https://example.test/small',tiers:[{maxInputTokens:100000,inputUsdPerMillion:0.1,outputUsdPerMillion:0.5},{maxInputTokens:1000000,inputUsdPerMillion:0.5,outputUsdPerMillion:2.5}]},
  {...expensive,source:'https://example.test/large',tiers:[{maxInputTokens:1000000,inputUsdPerMillion:2,outputUsdPerMillion:10}]}
 ]};
 fs.writeFileSync(filename,JSON.stringify(data));return {filename,data,value:readImprovementPriceCatalog(filename)};
}
afterEach(()=>{for(const dir of directories.splice(0))fs.rmSync(dir,{recursive:true,force:true});});
describe('improvement route pricing',()=>{
 it('ranks only both allowed and currently eligible discovered routes',()=>{
  const {value}=catalog();
  expect(selectImprovementRoute(value,[cheap,expensive],[cheap,expensive],8000,now)?.model).toBe(cheap.model);
  expect(selectImprovementRoute(value,[expensive],[cheap,expensive],8000,now)?.model).toBe(expensive.model);
  expect(selectImprovementRoute(value,[cheap,expensive],[expensive],8000,now)?.model).toBe(expensive.model);
  expect(selectImprovementRoute(value,[cheap],[],8000,now)).toBeNull();
 });
 it('uses the expensive tier when the entire pair ceiling crosses 100000',()=>{
  const {value}=catalog();
  const low=selectImprovementRoute(value,[cheap],[cheap],100000,now)!;
  const high=selectImprovementRoute(value,[cheap],[cheap],100001,now)!;
  expect(low.priceRates).toEqual({inputUsdPerMillion:0.1,outputUsdPerMillion:0.5});
  expect(high.priceRates).toEqual({inputUsdPerMillion:0.5,outputUsdPerMillion:2.5});
  expect(()=>assertImprovementPriceQuote(low,cheap,100001,now)).toThrow('token bound');
 });
 it('blocks expired or future catalog quotes and rejects route/rate substitutions',()=>{
  const {value}=catalog();const quote=selectImprovementRoute(value,[cheap],[cheap],8000,now)!;
  expect(selectImprovementRoute(value,[cheap],[cheap],8000,Date.parse(value.expiresAt))).toBeNull();
  expect(selectImprovementRoute(value,[cheap],[cheap],8000,Date.parse(value.observedAt)-1)).toBeNull();
  expect(()=>assertImprovementPriceQuote(quote,cheap,4800,Date.parse(value.expiresAt))).toThrow('expired');
  expect(()=>assertImprovementPriceQuote(quote,expensive,4800,now)).toThrow('changed');
  expect(()=>assertImprovementPriceQuote(quote,{...cheap,priceRates:{inputUsdPerMillion:0,outputUsdPerMillion:0}},4800,now)).toThrow('changed');
  expect(()=>assertImprovementPriceQuote(quote,{...cheap,priceRates:quote.priceRates},4800,now)).not.toThrow();
 });
 it('issues a one-hour execution quote without extending catalog provenance or validity',()=>{
  const {value}=catalog();const quote=selectImprovementRoute(value,[cheap],[cheap],8000,now)!;
  expect(quote.observedAt).toBe(new Date(now).toISOString());
  expect(Date.parse(quote.expiresAt)-now).toBe(60*60_000);
  expect(quote.catalogSha256).toBe(value.sha256);expect(quote.source).toBe(value.routes[0].source);
  const nearExpiry=Date.parse(value.expiresAt)-1_000;
  expect(Date.parse(selectImprovementRoute(value,[cheap],[cheap],8000,nearExpiry)!.expiresAt)).toBe(Date.parse(value.expiresAt));
  expect(()=>assertImprovementPriceQuote({...quote,observedAt:value.observedAt,expiresAt:value.expiresAt},cheap,4800,now)).toThrow('expired');
 });
 it('selects local zero token cost only when the caller attests both actors eligible',()=>{
  const {value}=catalog();const local={provider:'ollama' as const,model:'fixture:1b'};
  expect(selectImprovementRoute(value,[cheap,local],[cheap],8000,now)?.provider).toBe('anthropic');
  const selected=selectImprovementRoute(value,[cheap,local],[cheap,local],8000,now)!;
  expect(selected.provider).toBe('ollama');expect(selected.priceRates).toEqual({inputUsdPerMillion:0,outputUsdPerMillion:0});
  expect(selected.source).toBe('local-installed-model');
 });
 it('rejects malformed tier order, zero cloud prices and duplicate route identities',()=>{
  for(const mutate of [
   (d:any)=>{d.routes[0].tiers.reverse();},
   (d:any)=>{d.routes[0].tiers[0].outputUsdPerMillion=0;},
   (d:any)=>{d.routes.push(d.routes[0]);},
  ]) {const f=catalog();mutate(f.data);fs.writeFileSync(f.filename,JSON.stringify(f.data));expect(()=>readImprovementPriceCatalog(f.filename)).toThrow();}
 });
});
