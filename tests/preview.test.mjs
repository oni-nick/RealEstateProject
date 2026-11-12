import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { dirname, resolve, relative, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../web-v2/', import.meta.url));
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(resolve(dir, e.name)) : [resolve(dir, e.name)]);
const files = walk(root).filter((file) => !/[\\/]local-naver-config[^\\/]*\.js$/.test(file));

test('local HTML, CSS, module, data and photo references resolve inside web-v2', () => {
  let checked = 0;
  function check(base, value) {
    if (/^(?:[a-z]+:|\/\/|#)/i.test(value)) return;
    const path = resolve(base, decodeURIComponent(value.split(/[?#]/)[0]));
    assert.ok(path.startsWith(root), value);
    assert.ok(existsSync(path), `${relative(root, base)}: ${value}`);
    checked++;
  }
  for (const file of files.filter((f) => /\.(html|css|js|svg)$/.test(f))) {
    const text = readFileSync(file, 'utf8');
    const patterns = extname(file) === '.js'
      ? [[/(?:from\s+|import\s*\(?\s*)['"](\.[^'"]+)['"]/g, dirname(file)], [/new URL\(['"]([^'"]+)['"],\s*import\.meta\.url/g, dirname(file)], [/(?:src|href):\s*['"](\.[^'"]+)['"]/g, root]]
      : [[/(?:src|href)=["']([^"']+)["']/g, dirname(file)], [/url\(\s*['"]?([^\s'")]+)['"]?\s*\)/g, dirname(file)], [/@import\s+['"]([^'"]+)['"]/g, dirname(file)]];
    for (const [pattern, base] of patterns) for (const match of text.matchAll(pattern)) check(base, match[1]);
  }
  const inventory = JSON.parse(readFileSync(resolve(root, 'data/buildings.json'), 'utf8'));
  for (const b of inventory.buildings) if (b.deepPath) check(resolve(root, 'data'), b.deepPath);
  const manifest = JSON.parse(readFileSync(resolve(root, 'assets/photos/manifest.json'), 'utf8'));
  for (const p of manifest.photos) check(resolve(root, 'assets/photos'), p.file);
  assert.ok(checked > 100);
});

test('all assets including SVGs are below 1 MB and valid UTF-8 without replacement characters', () => {
  const assets = files.filter((f) => f.startsWith(resolve(root, 'assets') + sep));
  assert.ok(assets.length > 0);
  for (const file of assets) {
    assert.ok(statSync(file).size < 1_000_000, file);
    const bytes = readFileSync(file);
    assert.notDeepEqual([...bytes.subarray(0, 3)], [239, 187, 191], file);
    if (/\.(?:jpg|jpeg|webp)$/i.test(file)) continue;
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    assert.ok(!text.includes('\ufffd'), file);
  }
});

test('worktree preview serves every runtime asset with correct MIME and rejects unavailable or outside paths', async () => {
  const { createPreviewServer } = await import('../scripts/serve.mjs');
  const server = createPreviewServer();
  await new Promise((done, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', done); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.md': 'text/plain', '.jpg': 'image/jpeg', '.webp': 'image/webp' };
  try {
    for (const file of files.filter((f) => mime[extname(f)])) {
      const response = await fetch(`${base}/${relative(root, file).split(sep).join('/')}`);
      assert.equal(response.status, 200, file);
      assert.ok(response.headers.get('content-type').startsWith(mime[extname(file)]), file);
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), readFileSync(file), file);
    }
    assert.match(await (await fetch(base + '/')).text(), /<html lang="ko">/);
    for (const path of ['/missing.svg', '/..%2fdocs%2fPROGRESS.md', '/data/%', '/js/']) {
      assert.equal((await fetch(base + path)).status, 404, path);
    }
    const head = await fetch(base + '/index.html', { method: 'HEAD' });
    assert.equal(head.status, 200); assert.equal(await head.text(), '');
  } finally { await new Promise((done) => server.close(done)); }
});
