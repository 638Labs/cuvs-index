import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defineSchema, createEngine } from '../src/index.js';
import { memoryAdapter } from '../src/adapters/memory.js';
import * as mockCuvs from '../src/mock-cuvs.js';

function makeEngine() {
  const schema = defineSchema({
    entities: {
      doc: {
        fields: {
          id: { type: 'string' },
          title: { type: 'string', filterable: true },
          category: { type: 'enum', values: ['a', 'b', 'c'], filterable: true },
          score: { type: 'number', filterable: true },
          price: { type: 'number', filterable: true },
          embedding: { type: 'vector', dimensions: 3 },
        },
        vectorIndex: { field: 'embedding', algorithm: 'cagra' },
      },
    },
  });
  return createEngine({ schema, adapter: memoryAdapter(), cuvs: mockCuvs });
}

async function seed(engine, n = 20) {
  const cats = ['a', 'b', 'c'];
  for (let i = 0; i < n; i++) {
    await engine.insert('doc', {
      id: String(i),
      title: `doc ${i}`,
      category: cats[i % 3],
      score: i,
      price: i * 5,
      embedding: [Math.cos(i / 2), Math.sin(i / 2), i / n],
    });
  }
}

test('e2e: insert 20 records and scan returns them all', async () => {
  const engine = makeEngine();
  await seed(engine, 20);
  const all = await engine.query({ entity: 'doc' });
  assert.equal(all.length, 20);
  assert.ok(all.every((r) => typeof r.title === 'string'));
});

test('e2e: where only — filter by enum field', async () => {
  const engine = makeEngine();
  await seed(engine, 20);
  const rows = await engine.query({ entity: 'doc', where: { category: 'a' } });
  // i % 3 === 0 => 0,3,6,9,12,15,18 = 7
  assert.equal(rows.length, 7);
  assert.ok(rows.every((r) => r.category === 'a'));
});

test('e2e: where only — filter by number range', async () => {
  const engine = makeEngine();
  await seed(engine, 20);
  const rows = await engine.query({
    entity: 'doc',
    where: { score: { gte: 10, lt: 15 } },
  });
  assert.deepEqual(rows.map((r) => r.score).sort((a, b) => a - b), [10, 11, 12, 13, 14]);
});

test('e2e: similar only — returns k nearest with distance', async () => {
  const engine = makeEngine();
  await seed(engine, 20);
  const rows = await engine.query({
    entity: 'doc',
    similar: { vector: [1, 0, 0], k: 5 },
  });
  assert.equal(rows.length, 5);
  for (const r of rows) {
    assert.equal(typeof r._score, 'number');
    assert.equal(typeof r._distance, 'number');
  }
  // scores should be sorted descending
  for (let i = 1; i < rows.length; i++) {
    assert.ok(rows[i - 1]._score >= rows[i]._score);
  }
});

test('e2e: where + similar combined — filter then rank', async () => {
  const engine = makeEngine();
  await seed(engine, 20);
  const rows = await engine.query({
    entity: 'doc',
    where: { category: 'a' },
    similar: { vector: [1, 0, 0], k: 20 },
  });
  assert.equal(rows.length, 7);
  assert.ok(rows.every((r) => r.category === 'a'));
  for (let i = 1; i < rows.length; i++) {
    assert.ok(rows[i - 1]._score >= rows[i]._score);
  }
});

test('e2e: update — query reflects the change', async () => {
  const engine = makeEngine();
  await seed(engine, 20);
  await engine.update('doc', '0', { category: 'b', title: 'renamed' });
  const updated = await engine.get('doc', '0');
  assert.equal(updated.category, 'b');
  assert.equal(updated.title, 'renamed');
  assert.equal(updated.score, 0);
  const asAfter = await engine.query({ entity: 'doc', where: { category: 'a' } });
  assert.ok(!asAfter.some((r) => r.id === '0'));
  const bsAfter = await engine.query({ entity: 'doc', where: { category: 'b' } });
  assert.ok(bsAfter.some((r) => r.id === '0'));
});

test('e2e: delete — record gone from results', async () => {
  const engine = makeEngine();
  await seed(engine, 20);
  await engine.delete('doc', '5');
  const all = await engine.query({ entity: 'doc' });
  assert.equal(all.length, 19);
  assert.ok(!all.some((r) => r.id === '5'));
  const gone = await engine.get('doc', '5');
  assert.equal(gone, null);
  const similar = await engine.query({
    entity: 'doc',
    similar: { vector: [Math.cos(2.5), Math.sin(2.5), 0.25], k: 20 },
  });
  assert.ok(!similar.some((r) => r.id === '5'));
});

test('e2e: query with limit', async () => {
  const engine = makeEngine();
  await seed(engine, 20);
  const rows = await engine.query({ entity: 'doc', limit: 3 });
  assert.equal(rows.length, 3);
});

test('e2e: query with sort', async () => {
  const engine = makeEngine();
  await seed(engine, 20);
  const rows = await engine.query({
    entity: 'doc',
    sort: { field: 'score', dir: 'desc' },
    limit: 5,
  });
  assert.deepEqual(rows.map((r) => r.score), [19, 18, 17, 16, 15]);
});

test('e2e: empty result sets', async () => {
  const engine = makeEngine();
  await seed(engine, 20);
  const none = await engine.query({ entity: 'doc', where: { category: 'z' } });
  assert.equal(none.length, 0);
  const emptyEngine = makeEngine();
  const alsoNone = await emptyEngine.query({ entity: 'doc' });
  assert.equal(alsoNone.length, 0);
  const alsoNoneSimilar = await emptyEngine.query({
    entity: 'doc',
    similar: { vector: [1, 0, 0], k: 5 },
  });
  assert.equal(alsoNoneSimilar.length, 0);
});

test('e2e: multiple where conditions — category AND price range', async () => {
  const engine = makeEngine();
  await seed(engine, 20);
  // category 'a' => i in {0,3,6,9,12,15,18}, prices {0,15,30,45,60,75,90}
  // price > 20 => {30,45,60,75,90} => ids {6,9,12,15,18}
  const rows = await engine.query({
    entity: 'doc',
    where: { category: 'a', price: { gt: 20 } },
  });
  assert.deepEqual(rows.map((r) => r.id).sort(), ['12', '15', '18', '6', '9']);
  assert.ok(rows.every((r) => r.category === 'a' && r.price > 20));
});

test('e2e: k larger than matching results — returns all without crashing', async () => {
  const engine = makeEngine();
  await seed(engine, 20);
  const rows = await engine.query({
    entity: 'doc',
    similar: { vector: [1, 0, 0], k: 100 },
  });
  assert.equal(rows.length, 20);
  for (let i = 1; i < rows.length; i++) {
    assert.ok(rows[i - 1]._score >= rows[i]._score);
  }
});

test('e2e: sort descending by price', async () => {
  const engine = makeEngine();
  await seed(engine, 20);
  const rows = await engine.query({
    entity: 'doc',
    sort: { field: 'price', dir: 'desc' },
  });
  assert.equal(rows.length, 20);
  assert.equal(rows[0].price, 95);
  assert.equal(rows[rows.length - 1].price, 0);
  for (let i = 1; i < rows.length; i++) {
    assert.ok(rows[i - 1].price >= rows[i].price);
  }
});

test('e2e: insert with duplicate id overwrites previous record', async () => {
  const engine = makeEngine();
  await engine.insert('doc', {
    id: '42',
    title: 'first',
    category: 'a',
    score: 1,
    price: 10,
    embedding: [1, 0, 0],
  });
  await engine.insert('doc', {
    id: '42',
    title: 'second',
    category: 'b',
    score: 2,
    price: 20,
    embedding: [0, 1, 0],
  });
  const all = await engine.query({ entity: 'doc' });
  assert.equal(all.length, 1);
  const row = await engine.get('doc', '42');
  assert.equal(row.title, 'second');
  assert.equal(row.category, 'b');
  assert.deepEqual(row.embedding, [0, 1, 0]);
});

test('e2e: delete nonexistent id does not throw', async () => {
  const engine = makeEngine();
  await seed(engine, 20);
  await assert.doesNotReject(() => engine.delete('doc', 'nope'));
  const all = await engine.query({ entity: 'doc' });
  assert.equal(all.length, 20);
});

test('e2e: get single record by id', async () => {
  const engine = makeEngine();
  await seed(engine, 20);
  const row = await engine.get('doc', '7');
  assert.ok(row);
  assert.equal(row.id, '7');
  assert.equal(row.title, 'doc 7');
  assert.equal(row.score, 7);
  assert.equal(row.price, 35);
  const missing = await engine.get('doc', '999');
  assert.equal(missing, null);
});

test('e2e: update structured fields only — vector stays the same', async () => {
  const engine = makeEngine();
  await seed(engine, 20);
  const before = await engine.get('doc', '4');
  const originalEmbedding = [...before.embedding];
  await engine.update('doc', '4', { title: 'updated title', price: 999 });
  const after = await engine.get('doc', '4');
  assert.equal(after.title, 'updated title');
  assert.equal(after.price, 999);
  assert.equal(after.category, before.category);
  assert.equal(after.score, before.score);
  assert.deepEqual(after.embedding, originalEmbedding);
});

test('e2e: update vector only — structured fields stay the same', async () => {
  const engine = makeEngine();
  await seed(engine, 20);
  const before = await engine.get('doc', '8');
  await engine.update('doc', '8', { embedding: [0, 0, 1] });
  const after = await engine.get('doc', '8');
  assert.deepEqual(after.embedding, [0, 0, 1]);
  assert.equal(after.title, before.title);
  assert.equal(after.category, before.category);
  assert.equal(after.score, before.score);
  assert.equal(after.price, before.price);
  // Verify index was rebuilt with new vector — searching near new vector
  // should surface id '8' among top hits.
  const hits = await engine.query({
    entity: 'doc',
    similar: { vector: [0, 0, 1], k: 3 },
  });
  assert.ok(hits.some((r) => r.id === '8'));
});

test('e2e: bulk insert 20 records — full scan count is correct', async () => {
  const engine = makeEngine();
  await seed(engine, 20);
  const all = await engine.query({ entity: 'doc' });
  assert.equal(all.length, 20);
  const ids = all.map((r) => r.id).sort((a, b) => Number(a) - Number(b));
  assert.deepEqual(
    ids,
    Array.from({ length: 20 }, (_, i) => String(i)),
  );
  const catCounts = all.reduce((m, r) => ((m[r.category] = (m[r.category] ?? 0) + 1), m), {});
  assert.equal(catCounts.a, 7);
  assert.equal(catCounts.b, 7);
  assert.equal(catCounts.c, 6);
});

test('e2e: query on nonexistent entity throws', async () => {
  const engine = makeEngine();
  await seed(engine, 5);
  await assert.rejects(
    () => engine.query({ entity: 'missing' }),
    /unknown entity/,
  );
  await assert.rejects(
    () => engine.insert('missing', { id: '1' }),
    /unknown entity/,
  );
});
