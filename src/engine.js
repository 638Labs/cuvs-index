import { compileQuery } from './query.js';

const ALGO_CTOR_KEYS = {
  cagra: 'CagraIndex',
  ivf_flat: 'IvfFlatIndex',
  ivf_pq: 'IvfPqIndex',
};

export function createEngine({ schema, adapter, gpu, cuvs }) {
  if (!schema) throw new Error('createEngine: "schema" is required');
  if (!adapter) throw new Error('createEngine: "adapter" is required');
  if (!cuvs) throw new Error('createEngine: "cuvs" runtime is required (real cuvs-node or mock-cuvs)');

  const resources = new cuvs.Resources(gpu ?? {});
  const indexes = new Map();

  function assertEntity(entityName) {
    if (!schema.entities[entityName]) {
      throw new Error(`unknown entity "${entityName}"`);
    }
    return schema.entities[entityName];
  }

  function resolveIndexCtor(algorithm) {
    const key = ALGO_CTOR_KEYS[algorithm];
    if (!key) throw new Error(`unknown vector index algorithm "${algorithm}"`);
    const Ctor = cuvs[key];
    if (!Ctor) throw new Error(`cuvs runtime missing "${key}" for algorithm "${algorithm}"`);
    return Ctor;
  }

  async function buildIndex(entityName) {
    const entity = assertEntity(entityName);
    if (!entity.vectorIndex) return null;

    const { field, algorithm, params } = entity.vectorIndex;
    const rows = await adapter.scan(entityName);
    const withVec = rows.filter((r) => Array.isArray(r[field]));
    const vectors = withVec.map((r) => r[field]);
    const ids = withVec.map((r) => r.id);

    const IndexCtor = resolveIndexCtor(algorithm);
    const index = new IndexCtor(resources, params ?? {});
    await index.build(vectors);
    const handle = { index, ids };
    indexes.set(entityName, handle);
    return handle;
  }

  async function vectorSearch(entityName, similar) {
    let handle = indexes.get(entityName);
    if (!handle) handle = await buildIndex(entityName);
    if (!handle || handle.ids.length === 0) return [];
    const k = Math.min(similar.k ?? 10, handle.ids.length);
    if (k === 0) return [];
    const results = await handle.index.search([similar.vector], k);
    return results[0].map((r) => ({
      id: handle.ids[r.index],
      score: r.score,
      distance: typeof r.distance === 'number' ? r.distance : 1 / r.score - 1,
    }));
  }

  return {
    schema,
    adapter,
    async insert(entityName, record) {
      assertEntity(entityName);
      if (!record || record.id == null) throw new Error('engine.insert: record.id is required');
      indexes.delete(entityName);
      return adapter.put(entityName, record);
    },
    async update(entityName, id, record) {
      assertEntity(entityName);
      if (id == null) throw new Error('engine.update: id is required');
      const existing = await adapter.get(entityName, id);
      if (!existing) throw new Error(`engine.update: no ${entityName} with id "${id}"`);
      indexes.delete(entityName);
      return adapter.put(entityName, { ...existing, ...record, id });
    },
    async delete(entityName, id) {
      assertEntity(entityName);
      indexes.delete(entityName);
      return adapter.delete(entityName, id);
    },
    async get(entityName, id) {
      assertEntity(entityName);
      return adapter.get(entityName, id);
    },
    async buildIndex(entityName) {
      assertEntity(entityName);
      return buildIndex(entityName);
    },
    async query(spec) {
      if (!spec || !spec.entity) throw new Error('query: "entity" is required');
      assertEntity(spec.entity);
      const compiled = compileQuery(spec);
      return compiled.execute({ adapter, vectorSearch });
    },
  };
}
