const FIELD_TYPES = new Set(['string', 'number', 'enum', 'vector']);

function validateField(entityName, fieldName, field) {
  if (!field || typeof field !== 'object') {
    throw new Error(`${entityName}.${fieldName}: field definition must be an object`);
  }
  if (!FIELD_TYPES.has(field.type)) {
    throw new Error(`${entityName}.${fieldName}: invalid type "${field.type}"`);
  }
  if (field.type === 'vector') {
    if (!Number.isInteger(field.dimensions) || field.dimensions <= 0) {
      throw new Error(`${entityName}.${fieldName}: vector field requires positive integer "dimensions"`);
    }
  }
  if (field.type === 'enum') {
    if (!Array.isArray(field.values) || field.values.length === 0) {
      throw new Error(`${entityName}.${fieldName}: enum field requires non-empty "values" array`);
    }
  }
  return {
    type: field.type,
    filterable: field.filterable === true,
    ...(field.type === 'vector' ? { dimensions: field.dimensions } : {}),
    ...(field.type === 'enum' ? { values: [...field.values] } : {}),
  };
}

function validateVectorIndex(entityName, fields, vectorIndex) {
  if (!vectorIndex) return null;
  const { field, algorithm, params } = vectorIndex;
  if (!field || !fields[field]) {
    throw new Error(`${entityName}.vectorIndex: unknown field "${field}"`);
  }
  if (fields[field].type !== 'vector') {
    throw new Error(`${entityName}.vectorIndex: field "${field}" is not a vector field`);
  }
  if (typeof algorithm !== 'string' || !algorithm) {
    throw new Error(`${entityName}.vectorIndex: "algorithm" is required`);
  }
  return { field, algorithm, params: params ?? {} };
}

function validateEntity(name, entity) {
  if (!entity || typeof entity !== 'object') {
    throw new Error(`entity "${name}": definition must be an object`);
  }
  if (!entity.fields || typeof entity.fields !== 'object') {
    throw new Error(`entity "${name}": "fields" object is required`);
  }
  const fields = {};
  for (const [fieldName, field] of Object.entries(entity.fields)) {
    fields[fieldName] = validateField(name, fieldName, field);
  }
  const vectorIndex = validateVectorIndex(name, fields, entity.vectorIndex);
  return { name, fields, vectorIndex };
}

export function defineSchema(spec) {
  if (!spec || typeof spec !== 'object') {
    throw new Error('defineSchema: spec must be an object');
  }
  if (!spec.entities || typeof spec.entities !== 'object') {
    throw new Error('defineSchema: "entities" object is required');
  }
  const entities = {};
  for (const [name, entity] of Object.entries(spec.entities)) {
    entities[name] = validateEntity(name, entity);
  }
  return Object.freeze({ entities: Object.freeze(entities) });
}
