/** Relative, cached fetches. Rejected requests are evicted so Retry works. */
const DATA_ROOT = new URL('../data/', import.meta.url);
export function createDataLoader(fetcher = (...args) => fetch(...args)) {
  const cache = new Map();
  function load(path) {
    if (!/^(?:buildings|districts|market_refs|generation|comps)\.json$|^deep\/bld-[a-z]+-\d{3}\.json$/.test(path)) throw new Error('지원하지 않는 예시 데이터 경로입니다.');
    if (!cache.has(path)) {
      const request = Promise.resolve().then(() => fetcher(new URL(path, DATA_ROOT))).then(async (response) => {
        if (!response.ok) throw new Error(`예시 데이터를 불러오지 못했습니다 (${response.status}).`);
        const data = await response.json();
        if (!data || typeof data !== 'object') throw new Error('예시 데이터 형식이 올바르지 않습니다.');
        return data;
      }).catch((error) => { cache.delete(path); throw error; });
      cache.set(path, request);
    }
    return cache.get(path);
  }
  return {
    load,
    async loadCore() {
      const [inventory, geography, references, generation] = await Promise.all(['buildings.json', 'districts.json', 'market_refs.json', 'generation.json'].map(load));
      if (!Array.isArray(inventory.buildings) || !Array.isArray(geography.districts) || !geography.river?.points || !Array.isArray(references.districts)) throw new Error('예시 데이터 스키마를 확인해 주세요.');
      return { buildings: inventory.buildings, metadata: inventory.metadata, geography, references, generation };
    },
    async loadDeep(building) {
      if (!building.deepPath) return null;
      const deep = await load(building.deepPath);
      if (deep.buildingId !== building.id || !Array.isArray(deep.rentRoll)) throw new Error('건물의 상세 데이터가 일치하지 않습니다.');
      return deep;
    },
  };
}
