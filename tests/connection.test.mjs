import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseOrigin,installLink,appLink,serverFromFragment} from '../webui/connection.mjs';

test('HTTPS address round-trips through private fragment and Android intent',()=>{
 const server='https://agent.example:8443';
 const link=new URL(installLink(server));
 assert.equal(link.search,'');
 assert.equal(serverFromFragment(link.hash),server);
 assert.equal(appLink(server),'a0android://connect?server=https%3A%2F%2Fagent.example%3A8443');
 assert.match(appLink(server,true),/package=com\.terminallylazy\.a0android;/);
});
test('credentials, paths, queries and ambiguous URLs cannot become connection links',()=>{
 for(const input of ['http://agent.example','https://user:secret@agent.example','https://agent.example/path','https://agent.example?token=x','https://agent.example#x','javascript:alert(1)','https://agent.example\\@evil.example','https://agent.example/%2e','https://é.example']){
  assert.equal(parseOrigin(input),null);assert.equal(appLink(input),null);assert.equal(new URL(installLink(input)).hash,'');
 }
 assert.equal(serverFromFragment('#server=%ZZ'),null);
 assert.equal(serverFromFragment('#server=https://agent.example&token=x'),null);
});
