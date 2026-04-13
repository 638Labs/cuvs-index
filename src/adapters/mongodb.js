// TODO: implement MongoDB-backed StorageAdapter.
// Should use the official mongodb driver and map entity -> collection.
// Consider change streams for onChange().
export function mongoAdapter(_config) {
  return {
    async put(_entity, _record) {
      throw new Error('mongoAdapter: not implemented');
    },
    async get(_entity, _id) {
      throw new Error('mongoAdapter: not implemented');
    },
    async scan(_entity) {
      throw new Error('mongoAdapter: not implemented');
    },
    async delete(_entity, _id) {
      throw new Error('mongoAdapter: not implemented');
    },
  };
}
