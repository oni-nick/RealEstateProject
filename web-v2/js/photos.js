import { EXAMPLE_PHOTO_LABEL, PHOTO_CATALOG } from './photo-catalog.js';
export { EXAMPLE_PHOTO_LABEL };

// Separate from data generation: imagery never changes the financial seed.
const photos = PHOTO_CATALOG.map((photo) => Object.freeze({ ...photo,
  url: new URL(`../assets/photos/${photo.file}`, import.meta.url).href,
}));
function photoIndex(building) {
  const id = String(typeof building === 'string' ? building : building?.id ?? 'example');
  let hash = 2166136261;
  for (const char of id) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  return hash % photos.length;
}
export function photoFor(building) { return photos[photoIndex(building)]; }
export function photosFor(building) {
  const primary = photoIndex(building);
  return (building?.deepPath ? [0, 7, 15, 23] : [0]).map((offset) => photos[(primary + offset) % photos.length]);
}
