import {mkdir,copyFile,cp} from 'node:fs/promises';
await mkdir('dist/assets',{recursive:true});
for(const file of ['index.html','style.css','app.mjs','engine.mjs','worker.mjs'])await copyFile(file,`dist/${file}`);
await cp('assets','dist/assets',{recursive:true});
console.log('Built static application in dist/');
