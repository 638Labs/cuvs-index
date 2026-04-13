// Mock implementation of the cuvs-node API surface used by cuvs-index.
// Lets the engine run end-to-end on a CPU-only dev box. Real cuvs-node
// is swapped in on GPU instances for integration tests.

export class Resources {
  constructor(config = {}) {
    this.config = config;
  }
}

function l2(a, b) {
  let sum = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

export class CagraIndex {
  constructor(resources, params = {}) {
    this.resources = resources;
    this.params = params;
    this.vectors = [];
    this.built = false;
  }

  async build(vectors) {
    this.vectors = vectors.map((v) => Array.from(v));
    this.built = true;
  }

  async search(queries, k) {
    if (!this.built) throw new Error('CagraIndex.search: index not built');
    return queries.map((q) => {
      const scored = this.vectors.map((v, index) => ({
        index,
        score: 1 / (1 + l2(q, v)),
      }));
      scored.sort((a, b) => b.score - a.score);
      return scored.slice(0, k);
    });
  }
}

export class IvfFlatIndex extends CagraIndex {}
export class IvfPqIndex extends CagraIndex {}

export default { Resources, CagraIndex, IvfFlatIndex, IvfPqIndex };
