import { compileQuery } from './query.js';

export function createEngine({ schema, adapter, gpu, cuvs }) {
  if (!schema) throw new Error('createEngine: "schema" is required');
  if (!adapter) throw new Error('createEngine: "adapter" is required');
  if (!cuvs) throw new Error('createEngine: "cuvs" runtime is required (real cuvs-node or mock-cuvs)');

  const resources = new cuvs.Resources(gpu ?? {});
  const indexes = new Map();

  async function buildIndex(entityName) {
    const entity = schema.entities[entityName];
    if (!entity) throw new Error(`unknown entity "${entityName}"`);
    if (!entity.vectorIndex) return null;

    const { field, algorithm, params } = entity.vectorIndex;
    const rows = await adapter.scan(entityName);
    const vectors = rows.map((r) => r[field]);
    const ids = rows.map((r) => r.id);

    const IndexCtor = algorithm === 'cagra' ? cuvs.CagraIndex : cuvs.CagraIndex;
    const index = new IndexCtor(resources, params ?? {});
    await index.build(vectors);
    const handle = { index, ids };
    indexes.set(entityName, handle);
    return handle;
  }

  async function vectorSearch(entityName, similar) {
    let handle = indexes.get(entityName);
    if (!handle) handle = await buildIndex(entityName);
    if (!handle) return [];
    const k = similar.k ?? 10;
    const results = await handle.index.search([similar.vector], k);
    return results[0].map((r) => ({ id: handle.ids[r.index], score: r.score }));
  }

  return {
    schema,
    adapter,
    async insert(entityName, record) {
      indexes.delete(entityName);
      return adapter.put(entityName, record);
    },
    async buildIndex(entityName) {
      return buildIndex(entityName);
    },
    async query(spec) {
      const compiled = compileQuery(spec);
      return compiled.execute({ adapter, vectorSearch });
    },
  };
}
