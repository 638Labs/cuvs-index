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
    async put(entity, idOrRecord, maybeRecord) {
      let id;
      let record;
      if (maybeRecord !== undefined) {
        id = idOrRecord;
        if (!record && (maybeRecord == null || typeof maybeRecord !== 'object')) {
          throw new Error('memoryAdapter.put: record must be an object');
        }
        record = { ...maybeRecord, id };
      } else {
        record = idOrRecord;
        if (!record || record.id == null) {
          throw new Error('memoryAdapter.put: record.id is required');
        }
        id = record.id;
        record = { ...record };
      }
      table(entity).set(id, record);
      emit(entity, { kind: 'put', id, record });
    },
    async get(entity, id) {
      return table(entity).get(id) ?? null;
    },
    async scan(entity, filter) {
      const rows = [...table(entity).values()];
      if (typeof filter === 'function') return rows.filter((r) => filter(r));
      return rows;
    },
    async list(entity) {
      return [...table(entity).keys()];
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
