import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateRights } from '../src/engine';
import { defaultRightRules, parseRightRules, type RightRulesCatalog } from '../src/right-rules';
import type { Right } from '../src/types';

const now = new Date('2026-09-10T12:00:00Z');
const right: Right = {id:'rsa',name:'RSA',provider:'CAF',category:'revenus-emploi',description:'',sourceUrl:'https://www.caf.fr',applicationUrl:'https://www.caf.fr',checkedAt:'2026-09-09',reviewDue:'2026-09-16',conditions:[],caution:'',published:true,version:1};
const profile = {age:30,children:0};
const custom = (): RightRulesCatalog => structuredClone(defaultRightRules);

test('declarative catalog changes orientation without altering prose or engine', () => {
  const rules = custom();
  rules.rules.find(rule => rule.rightId === 'rsa')!.any = [{field:'age',min:40,max:60}];
  assert.equal(evaluateRights(profile,[right],rules,now)[0].status,'outside');
  assert.equal(evaluateRights({...profile,age:40},[right],rules,now)[0].status,'possible');
  assert.equal(evaluateRights({...profile,age:60},[right],rules,now)[0].status,'possible');
  assert.equal(evaluateRights({...profile,age:61},[right],rules,now)[0].status,'outside');
  assert.equal(evaluateRights(profile,[right],now)[0].status,'possible');
});
test('schema rejects code, sensitive fields, invalid operators, dates, duplicate and unversioned rules', () => {
  for (const change of [
    (rules: any) => rules.rules[0].expression = 'return true',
    (rules: any) => rules.rules[0].required = ['medical'],
    (rules: any) => rules.rules[0].any = [{field:'age',operator:'eval',value:'true'}],
    (rules: any) => rules.rules[0].any = [],
    (rules: any) => rules.rules[0].any = [{field:'age',min:40,max:20}],
    (rules: any) => rules.rules[0].any = [{field:'housing',values:['tenant']}],
    (rules: any) => rules.reviewDue = '2026-02-30',
    (rules: any) => rules.reviewDue = '2026-09-08',
    (rules: any) => rules.rules.push(rules.rules[0]),
    (rules: any) => delete rules.version,
  ]) {
    const rules = custom(); change(rules);
    assert.throws(() => parseRightRules(rules));
    assert.equal(evaluateRights(profile,[right],rules,now)[0].status,'outside');
  }
});
test('catalog dates stop orientation before review and after final UTC day', () => {
  assert.equal(evaluateRights(profile,[right],custom(),new Date('2026-09-16T23:59:59.999Z'))[0].status,'possible');
  assert.equal(evaluateRights(profile,[{...right,reviewDue:'2026-10-01'}],custom(),new Date('2026-09-17T00:00:00Z'))[0].status,'expired');
  assert.equal(evaluateRights(profile,[{...right,checkedAt:'2026-09-01'}],custom(),new Date('2026-09-08T23:59:59Z'))[0].status,'expired');
  for (const checkedAt of ['2026-02-30','2026-09-11','2026-09-20','bad']) {
    assert.equal(evaluateRights(profile,[{...right,checkedAt}],custom(),now)[0].status,'expired');
  }
});
test('medical orientation cannot be promoted by custom data and received benefits stay excluded', () => {
  const rules = custom();
  rules.rules.find(rule => rule.rightId === 'aah')!.outside = false;
  assert.equal(evaluateRights({},[{...right,id:'aah'}],rules,now)[0].status,'outside');
  assert.equal(evaluateRights({receivedRights:['rsa']},[{...right,reviewDue:'2026-09-08'}],rules,now)[0].status,'received');
});
test('a future catalog entry without matching rules remains outside', () => {
  assert.equal(evaluateRights(profile,[{...right,id:'new-right',conditions:['return true']}],custom(),now)[0].status,'outside');
});
