#!/usr/bin/env python3
"""Acquire two explicitly licensed source meshes via public HTTP ZIP ranges.
No authentication, viewer scraping, full archive claims, or mesh modification.
"""
import argparse, hashlib, json, pathlib, struct, urllib.request, zlib
RECORD = 'https://zenodo.org/api/records/17063337'
SITES = {
 'st-george-antiochian-orthodox-church': ('11-St-George-Church.zip', 471831250, 'md5:498a3097041b15bd12f4c4118d6af02b', '11-St-George-Church'),
 'el-markaz-islami-mosque': ('16-Islamic-Center-of-Quebec-El-MarkazIslami-Mosque.zip', 910313817, 'md5:15e2fbba021f03e9d407e499cdaa3a24', '16-Islamic-Center-of-Quebec-El-MarkazIslami-Mosque'),
}
def fetch_range(url,start,end,total):
 req=urllib.request.Request(url,headers={'Range':f'bytes={start}-{end}'})
 with urllib.request.urlopen(req,timeout=60) as r:
  if r.status!=206 or r.headers.get('Content-Range')!=f'bytes {start}-{end}/{total}': raise ValueError('Server did not honor exact public byte range')
  b=r.read(end-start+2)
 if len(b)!=end-start+1:raise ValueError('Truncated/oversized range')
 return b

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--output',required=True);args=ap.parse_args()
 out=pathlib.Path(args.output)
 if not out.is_absolute() or out.exists():raise ValueError('Output must be a new absolute directory')
 if out.parent.resolve()!=out.parent:raise ValueError('Output parent must be canonical, without symlinks')
 out.mkdir(mode=0o755)
 with urllib.request.urlopen(RECORD,timeout=30) as r:record=json.load(r)
 if record['metadata']['license']['id']!='cc-by-4.0':raise ValueError('Source licence changed; review required')
 (out/'source-record.json').write_text(json.dumps(record,indent=2)+'\n')
 receipt={'schemaVersion':1,'record':RECORD,'licence':'CC-BY-4.0','wholeArchiveChecksumsVerified':False,'integrity':'ZIP central-directory CRC32 and uncompressed size checked per selected member; SHA256 calculated for acquired bytes. Full archive MD5 is provenance only.','networkAssetBytes':0,'assets':[]}
 for site,(key,total,archive_md5,prefix) in SITES.items():
  f=next(f for f in record['files'] if f['key']==key)
  if f['size']!=total or f['checksum']!=archive_md5:raise ValueError('Pinned source archive metadata changed')
  url=f['links']['self'];tail=fetch_range(url,total-262144,total-1,total);receipt['networkAssetBytes']+=len(tail)
  e=struct.unpack_from('<4s4H2LH',tail,tail.rfind(b'PK\x05\x06'));p=e[6]-(total-len(tail));members={}
  while p>=0 and tail[p:p+4]==b'PK\x01\x02':
   h=struct.unpack_from('<4s6H3L5H2L',tail,p);nl,xl,cl=h[10:13];name=tail[p+46:p+46+nl].decode('utf-8');members[name]=h;p+=46+nl+xl+cl
  dest=out/site;dest.mkdir()
  for suffix,filename in [('4_mesh/mesh.ply','mesh.ply'),('2_sfm/sfm.json','sfm.json'),('6_metashape/mesh_metashape.obj','mesh_metashape.obj')]:
   name=prefix+'/'+suffix;h=members[name];flags,method,crc,compressed,size,offset=h[3],h[4],h[7],h[8],h[9],h[16]
   if flags&1 or method!=8 or size>400_000_000 or compressed>90_000_000:raise ValueError('Unexpected archive member encoding/size')
   head=fetch_range(url,offset,offset+29,total);receipt['networkAssetBytes']+=len(head)
   local=struct.unpack('<4s5H3L2H',head)
   if local[0]!=b'PK\x03\x04':raise ValueError('Invalid local header')
   name_extra=fetch_range(url,offset+30,offset+29+local[-2]+local[-1],total);receipt['networkAssetBytes']+=len(name_extra)
   if name_extra[:local[-2]].decode('utf-8')!=name:raise ValueError('Member name mismatch')
   start=offset+30+len(name_extra);compressed_data=fetch_range(url,start,start+compressed-1,total);receipt['networkAssetBytes']+=len(compressed_data)
   dec=zlib.decompressobj(-15);data=dec.decompress(compressed_data,size+1)
   if len(data)!=size or not dec.eof or dec.unconsumed_tail or dec.unused_data or zlib.crc32(data)!=crc:raise ValueError('Member integrity failed')
   target=dest/filename
   with target.open('xb') as f:f.write(data)
   row={'siteId':site,'sourceArchive':key,'sourceArchiveMd5':archive_md5,'sourceArchiveBytes':total,'sourceUrl':url,'member':name,'localHeaderOffset':offset,'dataOffset':start,'compressedBytes':compressed,'bytes':len(data),'crc32':format(crc,'08x'),'sha256':hashlib.sha256(data).hexdigest(),'path':site+'/'+filename}
   receipt['assets'].append(row);print(json.dumps(row),flush=True)
 (out/'acquisition.json').write_text(json.dumps(receipt,indent=2)+'\n')
 print(json.dumps({'ok':True,'networkAssetBytes':receipt['networkAssetBytes']}),flush=True)
if __name__=='__main__':main()
