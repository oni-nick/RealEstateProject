/** Session-only state. No customer records, cookies or persistent storage. */
export const DEFAULT_FILTERS = Object.freeze({ query: '', districts: Object.freeze([]), minPriceEok: 30, maxPriceEok: 150, maxWalk: 18, deepOnly: false, equityEok: 30, targetIrrPct: 8, ltvPct: 50, useKo: '' });
export function createStore(initial = {}) {
  let state = Object.freeze({ filters: DEFAULT_FILTERS, evidenceMode: false, selectedId: null, ...initial });
  const listeners = new Set();
  return {
    getState: () => state,
    setState(patch) {
      const next = typeof patch === 'function' ? patch(state) : patch;
      state = Object.freeze({ ...state, ...next });
      for (const listener of [...listeners]) listener(state);
      return state;
    },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
  };
}
export const store = createStore();
export function updateFilters(patch) {
  store.setState(({ filters }) => ({ filters: Object.freeze({ ...filters, ...patch, ...(patch.districts ? { districts: Object.freeze([...patch.districts]) } : {}) }) }));
}
export function filterBuildings(buildings, filters) {
  const query = filters.query.trim().toLocaleLowerCase('ko');
  return buildings.filter((b) => b.statusKo !== '거래완료 참고'
    && (!filters.districts.length || filters.districts.includes(b.districtId))
    && b.askingPriceKrw >= (filters.minPriceEok ?? 30) * 1e8
    && b.askingPriceKrw <= filters.maxPriceEok * 1e8
    && (!filters.useKo || b.useKo.includes(filters.useKo))
    && b.walkMinutes <= filters.maxWalk
    && (!filters.deepOnly || Boolean(b.deepPath))
    && (!query || `${b.nameKo} ${b.addressKo} ${b.stationNameKo}`.toLocaleLowerCase('ko').includes(query)));
}
