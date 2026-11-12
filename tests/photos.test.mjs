import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { photoFor, photosFor, EXAMPLE_PHOTO_LABEL } from '../web-v2/js/photos.js';
import { PHOTO_CATALOG } from '../web-v2/js/photo-catalog.js';

const root = new URL('../web-v2/assets/photos/', import.meta.url);
const buildings = JSON.parse(readFileSync(new URL('../web-v2/data/buildings.json', import.meta.url), 'utf8')).buildings;
const manifest = () => JSON.parse(readFileSync(new URL('manifest.json', root), 'utf8'));

test('every building has a stable primary in the manifest and deep galleries keep it first', () => {
  const entries = new Map(manifest().photos.map((p) => [p.id, p]));
  const used = new Set();
  for (const b of buildings) {
    const primary = photoFor(b), gallery = photosFor(b);
    assert.deepEqual(photoFor({ ...b, askingPriceKrw: 1 }), primary, 'financial edits must not change imagery');
    assert.deepEqual(photosFor({ ...b }), gallery);
    assert.deepEqual(gallery[0], primary);
    assert.equal(gallery.length, b.deepPath ? 4 : 1);
    assert.equal(new Set(gallery.map((p) => p.id)).size, gallery.length);
    for (const photo of gallery) {
      assert.equal(photo.file, entries.get(photo.id)?.file);
      assert.equal(photo.label, '\uC608\uC2DC \uC0AC\uC9C4 \u00B7 \uC2E4\uC81C \uB9E4\uBB3C \uC544\uB2D8');
      assert.ok(photo.url.endsWith(`/assets/photos/${photo.file}`));
      assert.ok(statSync(new URL(photo.file, root)).isFile());
      used.add(photo.id);
    }
  }
  assert.equal(used.size, entries.size, 'the pool should be used across the inventory');
  assert.equal(EXAMPLE_PHOTO_LABEL, '\uC608\uC2DC \uC0AC\uC9C4 \u00B7 \uC2E4\uC81C \uB9E4\uBB3C \uC544\uB2D8');
  assert.equal(photoFor({ id: buildings[0].id }).id, photoFor(buildings[0]).id);
});

test('offline pool contains small licensed photographs with matching catalog and provenance', () => {
  const data = manifest();
  const licenses = readFileSync(new URL('LICENSES.md', root), 'utf8');
  assert.ok(data.photos.length >= 20 && data.photos.length <= 30);
  assert.equal(data.label, EXAMPLE_PHOTO_LABEL);
  assert.deepEqual(PHOTO_CATALOG, data.photos);
  assert.equal(new Set(data.photos.map((p) => p.sourceUrl)).size, data.photos.length);
  for (const p of data.photos) {
    assert.equal(p.kind, 'photograph');
    assert.match(p.file, /^office-\d{2}\.(jpg|webp)$/);
    assert.ok(p.licenseNotes && p.author && p.alt);
    assert.equal(p.label, EXAMPLE_PHOTO_LABEL);
    assert.equal(p.license, 'Unsplash License');
    assert.equal(p.licenseUrl, 'https://unsplash.com/license');
    assert.match(p.sourceUrl, /^https:\/\/unsplash\.com\/photos\//);
    assert.ok(licenses.includes(p.file) && licenses.includes(p.author) && licenses.includes(p.sourceUrl));
    const bytes = readFileSync(new URL(p.file, root));
    assert.ok(bytes.length > 10_000 && bytes.length < 250_000, p.file);
    assert.deepEqual([...bytes.subarray(0, 3)], [0xff, 0xd8, 0xff], 'local asset is a JPEG photograph');
    assert.equal(p.width, 800);
    assert.equal(p.height, 600);
  }
});

test('thumbnail discloses examples and a failed image keeps its frame without retrying', async () => {
  // Minimal DOM only at the browser boundary; exercise real component events.
  class Element extends EventTarget {
    constructor(tag, text = '') { super(); this.tagName = tag; this.children = []; this.attributes = new Map(); this._text = text; }
    setAttribute(k, v) { this.attributes.set(k, String(v)); }
    getAttribute(k) { return this.attributes.get(k); }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.children = children; }
    get textContent() { return this._text + this.children.map((c) => c.textContent).join(''); }
  }
  const saved = { document: globalThis.document, Node: globalThis.Node };
  globalThis.Node = Element;
  globalThis.document = { createElement: (tag) => new Element(tag), createTextNode: (text) => new Element('#text', text) };
  try {
    const { buildingPhoto, buildingGallery } = await import('../web-v2/js/ui/photo.js');
    const figure = buildingPhoto(buildings[0]);
    const frame = figure.children[0], img = frame.children.find((c) => c.tagName === 'img');
    assert.equal(img.getAttribute('loading'), 'lazy');
    assert.equal(img.getAttribute('width'), '800');
    assert.equal(img.getAttribute('height'), '600');
    assert.ok(img.getAttribute('alt').includes('\uC608\uC2DC'));
    assert.ok(figure.textContent.includes(EXAMPLE_PHOTO_LABEL));
    assert.ok(frame.textContent.includes('\uC608\uC2DC'));
    img.dispatchEvent(new Event('error'));
    assert.ok(!frame.children.some((c) => c.tagName === 'img'));
    assert.ok(frame.textContent.includes('\uC608\uC2DC \uC0AC\uC9C4 \uC5C6\uC74C'));
    assert.ok(figure.textContent.includes(EXAMPLE_PHOTO_LABEL));
    const gallery = buildingGallery(buildings.find((b) => b.deepPath));
    assert.equal(gallery.children[0].children.length, 4);
    assert.ok(gallery.textContent.includes('\uD574\uB2F9 \uAC74\uBB3C\uC758 \uC2E4\uC81C \uC0AC\uC9C4 \uC544\uB2D8'));
    assert.equal(buildingGallery(buildings.find((b) => !b.deepPath)).children[0].children.length, 1);
  } finally {
    for (const [key, value] of Object.entries(saved)) if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
  }
});
