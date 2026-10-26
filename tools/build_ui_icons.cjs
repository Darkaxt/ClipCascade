/* Rasterize the project's installed Lucide definitions for native Tk controls. */
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {execFileSync}=require('node:child_process');
const repo=path.resolve(__dirname,'..');
const icons=['history','activity','settings-2','user-round','search','trash-2','copy','send','refresh-cw','lock-keyhole','radio','eye','eye-off','chevron-left','circle-alert','check','info'];
const output=path.join(repo,'logo/ui');
fs.mkdirSync(output,{recursive:true});
for(const name of icons){
  const sandbox={module:{exports:{}},require:()=>((label,nodes)=>nodes)};
  vm.runInNewContext(fs.readFileSync(path.join(repo,'ClipCascade_Mobile/src/node_modules/lucide-react-native/dist/cjs/icons',name+'.js'),'utf8'),sandbox,{filename:name+'.js'});
  for(const [tone,color] of Object.entries({muted:'#b9b7b6',accent:'#72d6e5',ink:'#102f34'})){
    const nodes=sandbox.module.exports.map(([tag,attrs])=>`<${tag} ${Object.entries(attrs).filter(([key])=>key!=='key').map(([key,value])=>`${key}="${value}"`).join(' ')}/>`).join('');
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${nodes}</svg>`;
    const source=path.join(output,name+'-'+tone+'.svg');
    fs.writeFileSync(source,svg);
    execFileSync(process.argv[2]||'magick',['-background','none',source,'-resize','22x22',path.join(output,name+'-'+tone+'.png')]);
  }
}
fs.copyFileSync(path.join(repo,'ClipCascade_Mobile/src/node_modules/lucide-react-native/LICENSE'),path.join(output,'LUCIDE-LICENSE'));
console.log('Generated 51 native UI icons from lucide-react-native 1.16.0; tray/window artwork unchanged.');
