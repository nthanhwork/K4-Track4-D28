const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {createCanvas} = require(process.env.DOCKCHECK_CANVAS_MODULE || '@napi-rs/canvas');
const root = path.resolve(__dirname, '../..');
module.exports = function loadPage(file = 'dockcheck-world.html', allowExternalScripts = true) {
  const elements = new Map(), documentListeners = {}, windowListeners = {};
  const element = id => {
    if (!elements.has(id)) {
      const item = ['world','camera'].includes(id) ? createCanvas(640,400) : {};
      Object.assign(item, {value:'', checked:false, disabled:false, textContent:'', dataset:{}, append(){}, reportValidity(){return true;}});
      elements.set(id,item);
    }
    return elements.get(id);
  };
  const document = {
    hidden:false, getElementById:element,
    createElement:tag => tag==='canvas' ? createCanvas(640,400) : {value:'',textContent:''},
    addEventListener(name,fn){(documentListeners[name] ||= []).push(fn);}
  };
  const sandbox = {document, console:{log(){}}, structuredClone, performance, setTimeout,
    CustomEvent:class{constructor(type,init){this.type=type;this.detail=init?.detail;}},
    requestAnimationFrame(){},
    addEventListener(name,fn){(windowListeners[name] ||= []).push(fn);},
    dispatchEvent(event){for(const fn of windowListeners[event.type]||[])fn(event);}
  };
  sandbox.window=sandbox; vm.createContext(sandbox);
  const html=fs.readFileSync(path.join(root,file),'utf8');
  for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)){
    const src=match[1].match(/src=["']([^"']+)["']/);
    if(src && !allowExternalScripts)throw new Error('Standalone page requested an external script: '+src[1]);
    const name=src?src[1]:file;
    const code=src?fs.readFileSync(path.resolve(root,src[1]),'utf8'):match[2];
    vm.runInContext(code,sandbox,{filename:name});
  }
  return {window:sandbox,element,hide(value){document.hidden=value;for(const fn of documentListeners.visibilitychange||[])fn();}};
};
