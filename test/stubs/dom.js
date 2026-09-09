// Minimal DOM so Game/HUD/ShellBuilder can be constructed headlessly.
// Elements are recorded by id; classList/style/innerHTML are plain data, so tests can assert on them.
class ClassList { constructor(){this.set=new Set();} add(...c){c.forEach(x=>this.set.add(x));} remove(...c){c.forEach(x=>this.set.delete(x));} toggle(c,f){ if(f===undefined) f=!this.set.has(c); f?this.set.add(c):this.set.delete(c); return f;} contains(c){return this.set.has(c);} }
export class Element {
  constructor(tag='div', id=''){ this.tagName=tag.toUpperCase(); this.id=id; this.children=[]; this.parent=null; this.listeners={}; this.classList=new ClassList(); this.dataset={}; this.disabled=false;
    this.style={ setProperty(k,v){ this[k]=v; } }; this._text=''; this._html=''; this.clientWidth=390; this.clientHeight=844; }
  get className(){ return [...this.classList.set].join(' '); } set className(v){ this.classList.set=new Set(v.split(' ').filter(Boolean)); }
  get textContent(){ return this._text; } set textContent(v){ this._text=String(v); this.children=[]; }
  get innerHTML(){ return this._html; } set innerHTML(v){ this._html=String(v); this.children=[]; }
  appendChild(c){ this.children.push(c); c.parent=this; return c; }
  addEventListener(t,f){ (this.listeners[t] ||= []).push(f); }
  dispatch(t,e={}){ for(const f of this.listeners[t]||[]) f({ target:this, preventDefault(){}, ...e }); }
  click(){ this.dispatch('click'); }
  closest(sel){ let n=this; const cls=sel.slice(1); while(n){ if(n.classList.contains(cls)) return n; n=n.parent; } return null; }
  setPointerCapture(){}
  querySelectorAll(){ return []; } querySelector(){ return null; }
}
export function installDom(ids){
  const byId=new Map(ids.map(id=>[id,new Element('div',id)]));
  let elementAt=null;
  globalThis.document={ getElementById:(id)=>{ if(!byId.has(id)) byId.set(id,new Element('div',id)); return byId.get(id); },
    createElement:(tag)=>new Element(tag), elementFromPoint:()=>elementAt, activeElement:null, hidden:false, addEventListener(){}, body:new Element('body') };
  globalThis.window={ addEventListener(){}, innerWidth:390, innerHeight:844, devicePixelRatio:2 };
  globalThis.requestAnimationFrame=()=>0;
  globalThis.setTimeout=globalThis.setTimeout; 
  const storage=(()=>{ const m=new Map(); return { getItem:k=>m.has(k)?m.get(k):null, setItem:(k,v)=>m.set(k,String(v)), map:m }; })();
  return { byId, storage, setElementAt:(el)=>{ elementAt=el; } };
}
