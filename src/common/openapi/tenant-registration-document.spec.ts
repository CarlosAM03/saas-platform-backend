import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';
import type { OpenAPIObject } from '@nestjs/swagger';
import {
  addTenantRegistration,
  registrationPaths,
} from './tenant-registration-document';

const baseline = () =>
  load(
    readFileSync('./Docs/Contracts/platform-api.v1.yaml', 'utf8'),
  ) as OpenAPIObject;
const operations = (doc: OpenAPIObject) =>
  Object.entries(doc.paths).flatMap(([path, item]) =>
    (['get', 'post', 'patch', 'delete'] as const)
      .filter((method) => item[method])
      .map((method) => ({ path, method, operation: item[method]! })),
  );

describe('ADR006 controlled contract composition', () => {
  it('preserves all 33 core operations and login shape; adds exactly five unique operations', () => {
    const core = baseline();
    const before = structuredClone(core);
    addTenantRegistration(core, true);
    expect(operations(before)).toHaveLength(33);
    expect(operations(core)).toHaveLength(38);
    for (const { path, method, operation } of operations(before))
      expect(core.paths[path][method]).toEqual(operation);
    expect(
      new Set(operations(core).map((o) => o.operation.operationId)).size,
    ).toBe(38);
    expect(core.paths['/api/v1/auth/login'].post?.responses['200']).toEqual(
      before.paths['/api/v1/auth/login'].post?.responses['200'],
    );
  });
  it('documents gated endpoints as unavailable without hiding pending recovery', () => {
    const doc = baseline();
    addTenantRegistration(doc, false);
    expect(
      doc.paths[registrationPaths[0]].post?.responses['201'],
    ).toBeUndefined();
    expect(
      doc.paths[registrationPaths[0]].post?.responses['503'],
    ).toBeDefined();
    expect(doc.paths[registrationPaths[1]].get?.responses['200']).toBeDefined();
    expect(
      doc.paths[registrationPaths[3]].post?.responses['200'],
    ).toBeDefined();
    const check = (value: unknown): void => {
      if (!value || typeof value !== 'object') return;
      const record = value as Record<string, unknown>;
      if (typeof record.$ref === 'string' && record.$ref.startsWith('#/')) {
        let node: unknown = doc;
        for (const key of record.$ref.slice(2).split('/'))
          node = (node as Record<string, unknown>)?.[key];
        expect(node).toBeDefined();
      }
      Object.values(record).forEach(check);
    };
    check(doc);
  });
});
