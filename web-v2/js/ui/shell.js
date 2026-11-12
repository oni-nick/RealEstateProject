import { updateFilters } from '../store.js';

export function bindShell(store, root = document, host = window) {
  const form = root.getElementById('global-search');
  const input = root.getElementById('global-search-input');
  const submit = (event) => {
    event.preventDefault();
    updateFilters({ query: input.value.trim() });
    host.location.hash = '#/radar';
  };
  form?.addEventListener('submit', submit);
  const sync = ({ filters, selectedId }) => {
    if (input && input !== root.activeElement) input.value = filters.query;
    if (selectedId) for (const nav of root.querySelectorAll?.('[data-building-scene]') ?? []) nav.setAttribute('href', `#/building/${selectedId}/${nav.dataset.buildingScene}`);
  };
  sync(store.getState());
  const unsubscribe = store.subscribe(sync);
  return () => { form?.removeEventListener('submit', submit); unsubscribe(); };
}
