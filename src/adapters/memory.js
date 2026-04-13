export function memoryAdapter() {
  /** @type {Map<string, Map<string, Object>>} */
  const tables = new Map();
  /** @type {Map<string, Set<Function>>} */
  const subscribers = new Map();

  function table(entity) {
    let t = tables.get(entity);
    if (!t) {
      t = new Map();
      tables.set(entity, t);
    }
    return t;
  }

  function emit(entity, event) {
    const subs = subscribers.get(entity);
    if (!subs) return;
    for (const handler of subs) handler(event);
  }

  return {
    async put(entity, record) {
      if (!record || record.id == null) throw new Error('memoryAdapter.put: record.id is required');
      table(entity).set(record.id, { ...record });
      emit(entity, { kind: 'put', id: record.id, record });
    },
    async get(entity, id) {
      return table(entity).get(id) ?? null;
    },
    async scan(entity) {
      return [...table(entity).values()];
    },
    async delete(entity, id) {
      table(entity).delete(id);
      emit(entity, { kind: 'delete', id });
    },
    onChange(entity, handler) {
      let subs = subscribers.get(entity);
      if (!subs) {
        subs = new Set();
        subscribers.set(entity, subs);
      }
      subs.add(handler);
      return () => subs.delete(handler);
    },
  };
}
