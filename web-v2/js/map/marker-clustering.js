// Local Web Mercator grid. Only matching points enter these groups.
export function clusterFeatures(features, zoom, cellSize = 60) {
  if (zoom > 14) return features.map((feature) => [feature]);
  const scale = 256 * 2 ** zoom, cells = new Map();
  for (const feature of features) {
    const [lng, lat] = feature.geometry.coordinates, sin = Math.sin(lat * Math.PI / 180);
    const x = (lng + 180) / 360 * scale;
    const y = (.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale;
    const key = `${Math.floor(x / cellSize)}:${Math.floor(y / cellSize)}`;
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push(feature);
  }
  return [...cells.values()];
}
