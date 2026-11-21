import fs from 'node:fs';
import path from 'node:path';
const root=process.argv[2];
if(!root||!path.isAbsolute(root))throw Error('Pass the absolute Atlas repository directory.');
const renderer=path.join(root,'desktop-shell/dist/renderer'),target=path.resolve('public/workspace');
fs.mkdirSync(target,{recursive:true});
for(const name of ['chrome.html','chrome.css','chrome.js','browser-bridge.js']){
 let data=fs.readFileSync(path.join(renderer,name));
 if(name==='chrome.html')data=Buffer.from(data.toString().replace('</head>','<script src="./cloud-bridge.js"></script></head>'));
 fs.writeFileSync(path.join(target,name),data);
}
console.log('Copied the shared desktop renderer with the private cloud transport.');
