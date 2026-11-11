/** Hash paths are deployment-subpath independent. Unknown routes stay explicit. */
export function parseRoute(hash = '') {
  const [path, query = ''] = hash.replace(/^#/, '').split('?');
  const params = new URLSearchParams(query);
  if (!path || path === '/') return { name: 'home', params };
  if (['/radar', '/listings', '/proposal'].includes(path)) return { name: path.slice(1), params };
  const match = path.match(/^\/building\/(bld-[a-z]+-\d{3})(?:\/(bid|valueup|proposal))?\/?$/);
  if (match) return { name: match[2] || 'building', id: match[1], params };
  return { name: 'not-found', params };
}
export function createRouter(onRoute, host = window) {
  const handle = () => onRoute(parseRoute(host.location.hash));
  host.addEventListener('hashchange', handle);
  handle();
  return () => host.removeEventListener('hashchange', handle);
}
