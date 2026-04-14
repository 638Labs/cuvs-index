function matchWhere(record, where) {
  if (!where) return true;
  for (const [field, condition] of Object.entries(where)) {
    const value = record[field];
    if (condition === null || typeof condition !== 'object') {
      if (value !== condition) return false;
      continue;
    }
    if ('eq' in condition && value !== condition.eq) return false;
    if ('ne' in condition && value === condition.ne) return false;
    if ('gt' in condition && !(value > condition.gt)) return false;
    if ('gte' in condition && !(value >= condition.gte)) return false;
    if ('lt' in condition && !(value < condition.lt)) return false;
    if ('lte' in condition && !(value <= condition.lte)) return false;
    if ('in' in condition && !condition.in.includes(value)) return false;
  }
  return true;
}

function applySort(rows, sort) {
  if (!sort) return rows;
  const entries = Array.isArray(sort) ? sort : [sort];
  return [...rows].sort((a, b) => {
    for (const entry of entries) {
      const field = entry.field;
      const dir = entry.dir === 'desc' ? -1 : 1;
      if (a[field] < b[field]) return -1 * dir;
      if (a[field] > b[field]) return 1 * dir;
    }
    return 0;
  });
}

export function compileQuery(spec) {
  const { entity, where, similar, sort, limit } = spec ?? {};
  if (!entity) throw new Error('query: "entity" is required');

  const stages = [];
  if (where) stages.push({ kind: 'filter', where });
  if (similar) stages.push({ kind: 'vector', similar });
  if (where && similar) stages.push({ kind: 'merge' });
  if (sort) stages.push({ kind: 'sort', sort });
  if (limit != null) stages.push({ kind: 'limit', limit });

  return {
    entity,
    stages,
    async execute({ adapter, vectorSearch }) {
      let candidates = await adapter.scan(entity);
      if (where) candidates = candidates.filter((r) => matchWhere(r, where));

      if (similar) {
        const hits = await vectorSearch(entity, similar);
        const hitMap = new Map(hits.map((h) => [h.id, h]));
        if (where) {
          candidates = candidates
            .filter((r) => hitMap.has(r.id))
            .map((r) => {
              const h = hitMap.get(r.id);
              return { ...r, _score: h.score, _distance: h.distance };
            });
        } else {
          const byId = new Map(candidates.map((r) => [r.id, r]));
          candidates = hits
            .map((h) => {
              const row = byId.get(h.id);
              return row ? { ...row, _score: h.score, _distance: h.distance } : null;
            })
            .filter(Boolean);
        }
        candidates.sort((a, b) => b._score - a._score);
      }

      if (sort) candidates = applySort(candidates, sort);
      if (limit != null) candidates = candidates.slice(0, limit);
      return candidates;
    },
  };
}
