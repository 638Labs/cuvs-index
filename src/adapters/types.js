/**
 * @typedef {Object} StorageAdapter
 * @property {(entity: string, record: Object) => Promise<void>} put
 *   Insert or replace a record. Records must have an `id` property.
 * @property {(entity: string, id: string) => Promise<Object|null>} get
 *   Fetch a single record by id, or null if not found.
 * @property {(entity: string) => Promise<Object[]>} scan
 *   Return all records for an entity. Used by the query engine for filtering.
 * @property {(entity: string, id: string) => Promise<void>} delete
 *   Remove a record.
 * @property {(entity: string, handler: (event: ChangeEvent) => void) => () => void} [onChange]
 *   Optional change subscription. Returns an unsubscribe function.
 */

/**
 * @typedef {Object} ChangeEvent
 * @property {'put'|'delete'} kind
 * @property {string} id
 * @property {Object} [record]
 */

/** Reference shape — adapters should match this surface. */
export const exampleAdapter = {
  async put(_entity, _record) {},
  async get(_entity, _id) { return null; },
  async scan(_entity) { return []; },
  async delete(_entity, _id) {},
  onChange(_entity, _handler) { return () => {}; },
};
