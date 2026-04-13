# cuvs-index

Indexing and query engine built on NVIDIA cuVS - schema-driven GPU-accelerated vector search for Node.js.

Built on [cuvs-node](https://github.com/638Labs/cuvs-node) by [638Labs](https://638labs.com), an open-source, native C++ Node.js bindings for [NVIDIA cuVS](https://developer.nvidia.com/cuvs). GPU-accelerated vector search, in-process, no Python required. 

`cuvs-index` adds three things on top of raw cuvs-node:

1. **Schema definitions**: declare entities, fields (string/number/enum/vector), and vector indexes.
2. **Storage adapters**: pluggable backends (in-memory, DynamoDB, MongoDB) for the structured side of your data.
3. **Hybrid queries**: combine structured filters (`where`) with vector similarity (`similar`) in a single query.

## Design principle

`cuvs-index` is usable and testable without a GPU. A mock cuvs-node implementation (`src/mock-cuvs.js`) lets you develop and run tests on any machine. Integration tests against the real `cuvs-node` run on GPU instances.

## Quick example

```js
import { defineSchema, createEngine } from 'cuvs-index';
import { memoryAdapter } from 'cuvs-index/adapters/memory';
import * as mockCuvs from 'cuvs-index/mock-cuvs';
// On a GPU box, swap mockCuvs for: import * as cuvs from 'cuvs-node';

const schema = defineSchema({
  entities: {
    doc: {
      fields: {
        id: { type: 'string' },
        category: { type: 'enum', values: ['blog', 'news'], filterable: true },
        embedding: { type: 'vector', dimensions: 768 },
      },
      vectorIndex: { field: 'embedding', algorithm: 'cagra', params: { graphDegree: 32 } },
    },
  },
});

const engine = createEngine({
  schema,
  adapter: memoryAdapter(),
  cuvs: mockCuvs,
  gpu: { deviceId: 0 },
});

await engine.insert('doc', { id: '1', category: 'blog', embedding: [/* 768 floats */] });

const results = await engine.query({
  entity: 'doc',
  where: { category: 'blog' },
  similar: { vector: [/* 768 floats */], k: 10 },
  limit: 5,
});
```

## Adapters

- `adapters/memory`: in-memory `Map`, no dependencies. Good for tests and dev.
- `adapters/dynamodb`: stub. TODO.
- `adapters/mongodb`: stub. TODO.

Custom adapters implement the `StorageAdapter` shape documented in `src/adapters/types.js`.

## Tests

```
node --test tests/
```

## License

Apache-2.0
