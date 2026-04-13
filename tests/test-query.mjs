import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compileQuery } from '../src/query.js';
import { memoryAdapter } from '../src/adapters/memory.js';

async function seed() {
  const adapter = memoryAdapter();
  await adapter.put('doc', { id: '1', category: 'a', embedding: [1, 0] });
  await adapter.put('doc', { id: '2', category: 'b', embedding: [0, 1] });
  await adapter.put('doc', { id: '3', category: 'a', embedding: [0.5, 0.5] });
  return adapter;
}

const fakeVectorSearch = async (_entity, similar) => {
  const corpus = [
    { id: '1', vector: [1, 0] },
    { id: '2', vector: [0, 1] },
    { id: '3', vector: [0.5, 0.5] },
  ];
  return corpus
    .map((row) => ({
      id: row.id,
      score: 1 / (1 + Math.hypot(row.vector[0] - similar.vector[0], row.vector[1] - similar.vector[1])),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, similar.k ?? 10);
};

test('where clause filters records', async () => {
  const adapter = await seed();
  const q = compileQuery({ entity: 'doc', where: { category: 'a' } });
  const rows = await q.execute({ adapter, vectorSearch: fakeVectorSearch });
  assert.deepEqual(rows.map((r) => r.id).sort(), ['1', '3']);
});

test('similar clause orders by score', async () => {
  const adapter = await seed();
  const q = compileQuery({ entity: 'doc', similar: { vector: [1, 0], k: 3 } });
  const rows = await q.execute({ adapter, vectorSearch: fakeVectorSearch });
  assert.equal(rows[0].id, '1');
  assert.equal(rows.length, 3);
});

test('combined where + similar intersects then ranks', async () => {
  const adapter = await seed();
  const q = compileQuery({
    entity: 'doc',
    where: { category: 'a' },
    similar: { vector: [0.5, 0.5], k: 5 },
    limit: 2,
  });
  const rows = await q.execute({ adapter, vectorSearch: fakeVectorSearch });
  assert.ok(rows.length <= 2);
  for (const row of rows) assert.equal(row.category, 'a');
  assert.equal(rows[0].id, '3');
});

test('compileQuery requires entity', () => {
  assert.throws(() => compileQuery({}), /entity/);
});
