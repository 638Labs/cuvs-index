import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defineSchema } from '../src/schema.js';

test('valid schema passes', () => {
  const schema = defineSchema({
    entities: {
      doc: {
        fields: {
          id: { type: 'string' },
          title: { type: 'string', filterable: true },
          score: { type: 'number', filterable: true },
          status: { type: 'enum', values: ['draft', 'published'], filterable: true },
          embedding: { type: 'vector', dimensions: 128 },
        },
        vectorIndex: { field: 'embedding', algorithm: 'cagra', params: { graphDegree: 32 } },
      },
    },
  });
  assert.equal(schema.entities.doc.fields.embedding.dimensions, 128);
  assert.equal(schema.entities.doc.vectorIndex.algorithm, 'cagra');
});

test('missing entities rejected', () => {
  assert.throws(() => defineSchema({}), /entities/);
});

test('invalid field type rejected', () => {
  assert.throws(
    () => defineSchema({ entities: { doc: { fields: { x: { type: 'blob' } } } } }),
    /invalid type/,
  );
});

test('vector field without dimensions rejected', () => {
  assert.throws(
    () => defineSchema({ entities: { doc: { fields: { v: { type: 'vector' } } } } }),
    /dimensions/,
  );
});

test('enum without values rejected', () => {
  assert.throws(
    () => defineSchema({ entities: { doc: { fields: { s: { type: 'enum' } } } } }),
    /values/,
  );
});

test('vectorIndex referencing unknown field rejected', () => {
  assert.throws(
    () =>
      defineSchema({
        entities: {
          doc: {
            fields: { id: { type: 'string' } },
            vectorIndex: { field: 'missing', algorithm: 'cagra' },
          },
        },
      }),
    /unknown field/,
  );
});
