// TODO: implement DynamoDB-backed StorageAdapter.
// Should use @aws-sdk/client-dynamodb and map entity -> table.
// Vector fields stored as binary or JSON-encoded number arrays.
export function dynamoAdapter(_config) {
  return {
    async put(_entity, _record) {
      throw new Error('dynamoAdapter: not implemented');
    },
    async get(_entity, _id) {
      throw new Error('dynamoAdapter: not implemented');
    },
    async scan(_entity) {
      throw new Error('dynamoAdapter: not implemented');
    },
    async delete(_entity, _id) {
      throw new Error('dynamoAdapter: not implemented');
    },
  };
}
