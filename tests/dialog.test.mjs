import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as connection from '../webui/connection.mjs';
// Load the actual store with browser/core imports replaced by test doubles.
const source=(await readFile(new URL('../webui/android-app-store.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'').replace('export const store =','globalThis.store =');
const qr = name => `[data-mobile-qr="${name}"]`;
function fixture(origin,request){
 const notices=[];
 const context=vm.createContext({...connection,URL,location:{origin},navigator:{userAgent:'Android'},createStore:(_,value)=>value,callJsonApi:request,toastFrontendError:(...args)=>notices.push(args)});
 vm.runInContext(source,context);
 const model=context.store.createModel(),codes=new Map(),draws=[];
 model.drawCode=(element,value)=>{codes.set(element.selector,value);draws.push({selector:element.selector,value});};
 return {model,codes,draws,notices,element:{querySelector:selector=>({selector})},store:context.store};
}
test('HTTPS draws both downloads and server pairing without a tunnel request',async()=>{
 const f=fixture('https://agent.example',()=>{throw Error('unexpected request')});
 await f.model.onOpen(f.element);
 assert.equal(f.model.server,'https://agent.example');assert.equal(f.codes.size,3);assert.equal(f.notices.length,0);
 assert.equal(f.codes.get(qr('ios')),'https://testflight.apple.com/join/xqAFS5er');
 assert.equal(f.codes.get(qr('install')),connection.installLink('https://agent.example'));
});
test('local HTTP reads existing tunnel status once and updates Android pairing',async()=>{
 let calls=0;
 const f=fixture('http://localhost:80',async(path,args)=>{calls++;assert.equal(path,'tunnel_proxy');assert.equal(args.action,'get');return {success:true,tunnel_url:'https://remote.example'};});
 await f.model.onOpen(f.element);
 assert.equal(calls,1);assert.equal(f.model.server,'https://remote.example');assert.equal(f.codes.get(qr('connect')),'https://remote.example');
 assert.equal(f.codes.get(qr('install')),connection.installLink('https://remote.example'));
 assert.equal(f.codes.get(qr('ios')),'https://testflight.apple.com/join/xqAFS5er');
});
test('download QR codes render before tunnel lookup finishes; iOS contains only the beta URL',async()=>{
 let release;
 const f=fixture('http://localhost',()=>new Promise(resolve=>{release=resolve}));
 const pending=f.model.onOpen(f.element);
 assert.equal(f.model.loading,true);
 assert.equal(f.codes.get(qr('install')),connection.INSTALL_URL);
 assert.equal(f.codes.get(qr('ios')),'https://testflight.apple.com/join/xqAFS5er');
 assert.equal(f.model.iosBeta,f.codes.get(qr('ios')));
 release({success:true,tunnel_url:'https://private-server.example'});await pending;
 assert.equal(f.draws.filter(d=>d.selector===qr('ios')).length,1);
 assert.equal(f.codes.get(qr('ios')),'https://testflight.apple.com/join/xqAFS5er');
});
test('loopback and credential-bearing tunnel URLs still offer both downloads',async()=>{
 for(const url of ['https://127.0.0.1','https://[::1]','https://localhost','https://u:p@remote.example']){
  const f=fixture('http://localhost',async()=>({success:true,tunnel_url:url}));
  await f.model.onOpen(f.element);assert.equal(f.model.server,'');assert.equal(f.codes.size,2);assert.equal(f.model.openUrl,null);
  assert.equal(f.codes.get(qr('ios')),'https://testflight.apple.com/join/xqAFS5er');
 }
});
test('request failure leaves both downloads usable and emits a safe notification',async()=>{
 const f=fixture('http://localhost',async()=>{throw Error('secret in server error')});
 await f.model.onOpen(f.element);
 assert.equal(f.model.loading,false);assert.equal(f.codes.size,2);assert.equal(f.notices.length,1);assert.ok(!JSON.stringify(f.notices).includes('secret'));
});
test('closing while tunnel status is pending cannot redraw or mutate a new dialog',async()=>{
 let release;
 const f=fixture('http://localhost',()=>new Promise(resolve=>{release=resolve}));
 const pending=f.model.onOpen(f.element);f.model.cleanup();
 const reopened=f.store.createModel();
 release({success:true,tunnel_url:'https://stale.example'});await pending;
 assert.equal(f.model.server,'');assert.equal(reopened.server,'');assert.equal(f.draws.length,2);assert.equal(f.notices.length,0);
 assert.equal(f.codes.has(qr('connect')),false);
});
