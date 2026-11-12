Read-only survey completed on `demo/plot-os-v2`. Git status remains clean; no files changed. The private Client ID was neither read nor printed.

**1. Current map structure and behavior**

- [radar-map.js](/C:/Users/nicho/Dev/RealEstate-v2/web-v2/js/map/radar-map.js:19) exports `createRadarMap({ buildings, geography, onOpen, onSelect, onHover, maplibre })`. Its public adapter exposes `element`, `mount`, `update`, `highlight`, `select`, `resize`, and `destroy`.
- [radar-geo.js](/C:/Users/nicho/Dev/RealEstate-v2/web-v2/js/map/radar-geo.js) exports `buildingCoordinates`, `scoreBand`, and `radarGeoJSON`. Valid Seoul coordinates are preserved; missing coordinates receive deterministic illustrative positions where possible. Features remain labeled synthetic.
- Home calls `createRadarMap` from `views.js`, applies `DEFAULT_FILTERS`, and supplies building navigation. It supplies no score rows, so scores are unavailable.
- Deal Radar calls it from `ui/radar-view.js`. `refresh()` evaluates candidates and passes `{ matchingIds, rows, selected }` to `map.update()`. Most filter changes refresh immediately; LTV changes debounce for 100 ms. Selection synchronizes cards, store, drawer/mobile dialog, popup, and camera.
- Matching features alone enter MapLibre clustering: radius `44`, maximum cluster zoom `14`. Nonmatches remain selectable hollow context points and never affect cluster counts. Separate layers render scores, prices, and selection/hover halos. Cluster clicks expand the cluster; revision checks reject stale asynchronous results.
- Popups contain `buildingPhoto`, building/location, asking price, land price per pyeong, Cap rate, score, and detail link. Photos use deterministic local SVG illustrations with “예시” and “예시 사진 · 실제 매물 아님” disclosures; failed images become “예시 사진 없음”.
- Current failure handling covers missing SDK/CSS, WebGL initialization/context loss, map errors, and a 15-second timeout. Korean notices preserve list usability; retry can reload failed CDN resources. **There is currently no secondary map provider.**
- `ui/map.js` still exports the older SVG schematic adapter and projection helpers. Home and Deal Radar no longer call it.

**2. Tests affected**

| Test file | Relevant assertions |
|---|---|
| `radar-map.test.mjs` | Coordinates, score thresholds, matching/context partition; exact OpenFreeMap Positron URL; clustering; Korean label expressions; popup content; selection/hover; drawer padding; cluster races; failures, retry, and destruction. |
| `smoke.test.mjs` | Exact pinned MapLibre JS/CSS URLs and HTML tags; asynchronous JS/nonblocking CSS; OpenFreeMap text; map/card/filter synchronization, context membership, photos, cleanup; legacy SVG behavior. |
| `market-refs.test.mjs` | Exact HTML external-resource allowlist: MapLibre JS/CSS and Pretendard. |
| `ui-restyle.test.mjs` | Route construction; selection drawer; one map instance; resize calls; filter preservation; stale-selection clearing; mobile modal/Escape behavior. |
| `preview.test.mjs` | Local references resolve; asset sizes/UTF-8; every recognized runtime file serves byte-identically with correct MIME; missing/traversal paths return 404; HEAD has no body. |
| `photos.test.mjs` | Stable illustration assignment, disclosures, provenance, small local SVGs, and image-error fallback. |
| `radar.test.mjs`, `integration.test.mjs` | Candidate membership, scoring, financial gates, presets, and aggregates that drive marker membership. |

A source-level issue needs attention: `smoke.test.mjs` imports **every** `.js` file under `web-v2`, including browser-only local config/example scripts. Step 01 should explicitly exclude these and avoid importing SDK-dependent vendor scripts before Naver exists.

**3. Preview and ignored config**

[scripts/serve.mjs](/C:/Users/nicho/Dev/RealEstate-v2/scripts/serve.mjs:9) exports `createPreviewServer()`. Running `node scripts/serve.mjs` serves this worktree’s `web-v2/` at `http://127.0.0.1:4173/#/`; `/` maps to `index.html`. It supports GET/HEAD, UTF-8 MIME headers, and `Cache-Control: no-store`.

The private config file exists. The server **will serve `/local-naver-config.js`**: it reads filesystem paths without consulting Git ignore rules. The page currently does not load it.

`.gitignore` contains the exact rule `web-v2/local-naver-config.js`; `git check-ignore` confirms it. The tracked example contains only `YOUR_NAVER_MAPS_CLIENT_ID`.

**4. Official Naver usage verified**

For the **new Maps product**, the exact SDK URL is:

```text
https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=YOUR_NAVER_MAPS_CLIENT_ID
```

The official v3 guide explicitly identifies `ncpClientId` as the previous parameter and `ncpKeyId` as the replacement. It supports asynchronous initialization through `&callback=CALLBACK_FUNCTION`. Authentication failures invoke a predefined `window.navermap_authFailure` function. [Official loading and authentication guide](https://navermaps.github.io/maps.js.ncp/docs/tutorial-2-Getting-Started.html)

Naver’s clustering example uses a separate `MarkerClustering.js` helper with marker arrays, grid size, maximum zoom, cluster counts, and click-to-zoom options. It is example code rather than an automatically available SDK class. Vendor the small helper locally with its Apache-2.0 notices, or implement clustering locally; use CSS/HTML icons and native DOM updates instead of the example’s images/jQuery. Its old SDK-loading snippet should not be copied. [Official clustering example](https://navermaps.github.io/maps.js.ncp/docs/tutorial-marker-cluster.example.html), [official helper source](https://github.com/navermaps/marker-tools.js/blob/master/marker-clustering/src/MarkerClustering.js)

**5. Recommended exact step 01 scope**

| File | Recommended change |
|---|---|
| `web-v2/index.html` | Remove eager MapLibre CDN tags once fallback loading is handled dynamically. |
| **New** `web-v2/js/map/naver-loader.js` | Load `local-naver-config.js` once, then read `window.PLOT_OS_NAVER_CONFIG.clientId` at runtime. Construct the SDK URL using `ncpKeyId`; install auth-failure handling before insertion. Handle missing/placeholder config, timeout, script error, retry, and shared loading. Never log the key or generated URL. |
| `web-v2/js/map/radar-map.js` | Preserve the public adapter contract and queued state; choose Naver first, then MapLibre on failure. Preserve filters, selection, hover, resize, and cleanup across provider changes. |
| **New** `web-v2/js/map/naver-map.js` | Implement Naver markers, score/price labels, context points, clusters, photo information windows, camera behavior, and teardown. Convert `[lng, lat]` to `LatLng(lat, lng)`. |
| **New** `web-v2/js/map/maplibre-map.js` | Extract the existing renderer as fallback; retain pinned MapLibre 4.7.1/OpenFreeMap behavior and load its resources only when needed. |
| **New** `web-v2/js/map/marker-clustering.js` | Small local clustering implementation or adapted official helper; matching markers only, fresh membership after filters, complete listener cleanup. No npm. |
| `web-v2/css/radar-map.css` | Add Naver marker/popup styles; preserve Korean UI, photo disclosures, responsive layout, and unobstructed attribution. Keep `logoControl` and `mapDataControl` enabled. [Official map options](https://navermaps.github.io/maps.js.ncp/docs/naver.maps.html#~MapOptions) |
| Tests above; new `tests/naver-map.test.mjs` | Update provider assumptions; cover Naver success/auth failure/timeout, fallback, clustering, filters, photos, retry, and route cleanup using synthetic configuration only. Exclude private config contents from test diagnostics. |
| `README.md`, `docs/SUMMARY.md`, config example | Document new-product `ncpKeyId`, runtime configuration, registered URLs, and fallback. Use only the prescribed placeholder. |

Keep a visible fallback notice such as:

> 네이버 지도를 불러오지 못해 대체 지도를 표시합니다. `local-naver-config.js`의 Client ID와 등록된 웹 서비스 URL(`http://localhost` / `http://127.0.0.1`)을 확인해 주세요.

No server or geography changes appear necessary. Runtime Naver authentication, tile rendering, and visual behavior are **UNKNOWN**; this step inspected source and documentation only. Tests were not run; `node` was unavailable on PATH.

STATUS: DONE