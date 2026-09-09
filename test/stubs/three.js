export class Vector3 { constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}
 set(x,y,z){this.x=x;this.y=y;this.z=z;return this;} setScalar(s){return this.set(s,s,s);} copy(v){return this.set(v.x,v.y,v.z);}
 clone(){return new Vector3(this.x,this.y,this.z);} addScaledVector(v,s){this.x+=v.x*s;this.y+=v.y*s;this.z+=v.z*s;return this;} multiplyScalar(s){this.x*=s;this.y*=s;this.z*=s;return this;} }
export class Euler extends Vector3 {}
export class Quaternion { copy(){return this;} }
export class Color { constructor(c=0){this.setHex(c);} setHex(h){this.h=h;return this;} getHex(){return this.h;} setRGB(r,g,b){this.r=r;this.g=g;this.b=b;return this;} copy(c){this.h=c.h;return this;} clone(){return new Color(this.h);} multiplyScalar(){return this;} }
export class Object3D { constructor(){this.position=new Vector3();this.rotation=new Euler();this.scale=new Vector3(1,1,1);this.children=[];this.parent=null;this.visible=true;this.quaternion=new Quaternion();this.matrixWorld={decompose(p,q,s){p.set(1,2,3);}};}
 add(o){this.children.push(o);o.parent=this;return this;} remove(o){const i=this.children.indexOf(o);if(i>=0)this.children.splice(i,1);o.parent=null;return this;}
 updateWorldMatrix(){} getWorldPosition(v){return v.copy(this.position);} lookAt(){} }
export class Group extends Object3D {}
export class Scene extends Object3D {}
export class Mesh extends Object3D { constructor(g,m){super();this.geometry=g;this.material=m;} }
export class PerspectiveCamera extends Object3D { updateProjectionMatrix(){} }
class Geo { constructor(...a){this.a=a;} scale(){return this;} translate(){return this;} }
export class CapsuleGeometry extends Geo {} export class ConeGeometry extends Geo {} export class SphereGeometry extends Geo {}
export class CylinderGeometry extends Geo {} export class DodecahedronGeometry extends Geo {} export class OctahedronGeometry extends Geo {}
export class TetrahedronGeometry extends Geo {} export class BoxGeometry extends Geo {} export class CircleGeometry extends Geo {} export class PlaneGeometry extends Geo {} export class ExtrudeGeometry extends Geo {}
export class Shape { moveTo(){} lineTo(){} absarc(){} }
class Mat { constructor(o={}){Object.assign(this,o);this.color=new Color(o.color);this.emissive=new Color(o.emissive||0);} clone(){const m=new this.constructor({...this});return m;} dispose(){} }
export class MeshLambertMaterial extends Mat {} export class MeshBasicMaterial extends Mat {}
export class TorusGeometry extends Geo {}
export class Fog { constructor(c,n,f){this.color=c;this.near=n;this.far=f;} }
export class Light extends Object3D { constructor(c,i){super();this.color=c;this.intensity=i;} }
export class HemisphereLight extends Light {}
export class DirectionalLight extends Light { constructor(c,i){super(c,i);this.target=new Object3D();this.shadow={mapSize:{set(){}},camera:{},bias:0};} }
export class Clock { constructor(){this.t=0;this.dt=1/60;} getDelta(){return this.dt;} }
export class WebGLRenderer { constructor(){this.domElement={addEventListener(){},clientWidth:390,clientHeight:844};this.shadowMap={};this.frames=0;} setPixelRatio(){} setSize(){} render(){this.frames++;} }
export const SRGBColorSpace = 'srgb'; export const PCFSoftShadowMap = 2;
