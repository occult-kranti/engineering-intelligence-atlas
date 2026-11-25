export function triangleGlb({ instances = 1, invalidIndex = false, nonfinite = false, external = false, compressed = false } = {}) {
  const bin = Buffer.alloc(84);
  [0,0,0,1,0,0,0,1,0].forEach((x, i) => bin.writeFloatLE(nonfinite && i === 0 ? NaN : x, i * 4));
  [1,0,0,0,1,0,0,0,1].forEach((x, i) => bin.writeFloatLE(x, 36 + i * 4));
  [0,1,invalidIndex ? 9 : 2].forEach((x, i) => bin.writeUInt32LE(x, 72 + i * 4));
  const json = { asset:{version:'2.0'}, buffers:[{byteLength:84,...(external?{uri:'../outside.bin'}:{})}], bufferViews:[{buffer:0,byteOffset:0,byteLength:36},{buffer:0,byteOffset:36,byteLength:36},{buffer:0,byteOffset:72,byteLength:12}], accessors:[{bufferView:0,componentType:5126,count:3,type:'VEC3',min:[0,0,0],max:[1,1,0]},{bufferView:1,componentType:5126,count:3,type:'VEC3'},{bufferView:2,componentType:5125,count:3,type:'SCALAR'}], meshes:[{primitives:[{attributes:{POSITION:0,COLOR_0:1},indices:2}]}], nodes:Array.from({length:instances},(_,i)=>({mesh:0,name:'triangle'+i,translation:[i*10,0,0]})), scenes:[{nodes:Array.from({length:instances},(_,i)=>i)}], scene:0 };
  if(compressed) json.extensionsRequired=['EXT_meshopt_compression'];
  const text=Buffer.from(JSON.stringify(json)), padded=Buffer.alloc(Math.ceil(text.length/4)*4,32);text.copy(padded);
  const out=Buffer.alloc(12+8+padded.length+8+bin.length);out.write('glTF');out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(padded.length,12);out.writeUInt32LE(0x4e4f534a,16);padded.copy(out,20);out.writeUInt32LE(bin.length,20+padded.length);out.writeUInt32LE(0x004e4942,24+padded.length);bin.copy(out,28+padded.length);return out;
}
