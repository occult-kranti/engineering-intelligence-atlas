#!/usr/bin/env python3
"""Read-only bounded-memory inspection of acquired OBJ masters; no assumptions on scale."""
import argparse, collections, hashlib, json, math, pathlib, time

def inspect(path):
 start=time.monotonic();counts=collections.Counter();minimum=[math.inf]*3;maximum=[-math.inf]*3;colour_min=[math.inf]*3;colour_max=[-math.inf]*3;materials=[];face_sizes=collections.Counter();max_index=0;min_index=math.inf;finite=True;sha=hashlib.sha256()
 with path.open('rb') as f:
  for raw in f:
   sha.update(raw);parts=raw.split()
   if not parts:continue
   kind=parts[0]
   if kind==b'v':
    counts['vertices']+=1;xyz=[float(v) for v in parts[1:4]];finite=finite and all(math.isfinite(v) for v in xyz)
    minimum=[min(a,b) for a,b in zip(minimum,xyz)];maximum=[max(a,b) for a,b in zip(maximum,xyz)]
    if len(parts)==7:
     counts['colouredVertices']+=1;rgb=[float(c) for c in parts[4:7]];finite=finite and all(math.isfinite(v) for v in rgb);colour_min=[min(a,b) for a,b in zip(colour_min,rgb)];colour_max=[max(a,b) for a,b in zip(colour_max,rgb)]
   elif kind==b'f':
    counts['faces']+=1;face_sizes[len(parts)-1]+=1;counts['trianglesAfterFanTriangulation']+=len(parts)-3
    face_indices=[v.split(b'/')[0] for v in parts[1:]]
    counts['facesWithRepeatedVertexIndex']+=int(len(set(face_indices))!=len(face_indices))
    for token in parts[1:]:
     index=int(token.split(b'/')[0]);max_index=max(max_index,index);min_index=min(min_index,index)
   elif kind==b'vt':counts['uvCoordinates']+=1
   elif kind==b'vn':counts['normals']+=1
   elif kind==b'mtllib':materials.append(b' '.join(parts[1:]).decode('utf-8'))
 result={'file':path.name,'bytes':path.stat().st_size,'sha256':sha.hexdigest(),'counts':dict(counts),'faceSizes':dict(face_sizes),'sourceBounds':{'minimum':minimum,'maximum':maximum,'extent':[b-a for a,b in zip(minimum,maximum)],'units':'source units; metres not established'},'colourRange':{'minimum':colour_min,'maximum':colour_max},'materialReferences':materials,'presentMaterialFiles':[name for name in materials if (path.parent/name).is_file()],'allPositionsAndColoursFinite':finite,'positivePositionIndicesInBounds':min_index>=1 and max_index<=counts['vertices'],'elapsedSeconds':round(time.monotonic()-start,3)}
 return result

def main():
 p=argparse.ArgumentParser();p.add_argument('--input',required=True,type=pathlib.Path);p.add_argument('--output',required=True,type=pathlib.Path);a=p.parse_args()
 if not a.input.is_absolute() or not a.input.is_file() or not a.output.is_absolute():raise ValueError('Absolute input file/output paths required')
 result=inspect(a.input)
 if not result['allPositionsAndColoursFinite'] or not result['positivePositionIndicesInBounds']:raise ValueError('Invalid mesh data')
 with a.output.open('x') as f:json.dump(result,f,indent=2);f.write('\n')
 print(json.dumps(result))
if __name__=='__main__':main()
