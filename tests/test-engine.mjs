import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defineSchema, createEngine } from '../src/index.js';
import { memoryAdapter } from '../src/adapters/memory.js';
import * as mockCuvs from '../src/mock-cuvs.js';

function makeSchema() {
  return defineSchema({
    entities: {
      doc: {
        fields: {
          id: { type: 'string' },
          category: { type: 'enum', values: ['a', 'b'], filterable: true },
          embedding: { type: 'vector', dimensions: 4 },
        },
        vectorIndex: { field: 'embedding', algorithm: 'cagra' },
      },
    },
  });
}

test('engine inserts and queries via memory adapter + mock cuvs', async () => {
  const engine = createEngine({
    schema: makeSchema(),
    adapter: memoryAdapter(),
    cuvs: mockCuvs,
  });

  await engine.insert('doc', { id: '1', category: 'a', embedding: [1, 0, 0, 0] });
  await engine.insert('doc', { id: '2', category: 'b', embedding: [0, 1, 0, 0] });
  await engine.insert('doc', { id: '3', category: 'a', embedding: [0.9, 0.1, 0, 0] });

  const all = await engine.query({ entity: 'doc' });
  assert.equal(all.length, 3);

  const filtered = await engine.query({ entity: 'doc', where: { category: 'a' } });
  assert.equal(filtered.length, 2);

  const similar = await engine.query({
    entity: 'doc',
    similar: { vector: [1, 0, 0, 0], k: 2 },
  });
  assert.equal(similar.length, 2);
  assert.equal(similar[0].id, '1');
});

test('engine requires cuvs runtime', () => {
  assert.throws(
    () => createEngine({ schema: makeSchema(), adapter: memoryAdapter() }),
    /cuvs/,
  );
});
