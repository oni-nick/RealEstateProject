import { h } from './components.js';
import { photoFor, photosFor, EXAMPLE_PHOTO_LABEL } from '../photos.js';

export function buildingPhoto(building, { photo = photoFor(building), compact = false } = {}) {
  const frame = h('div', { className: 'photo-frame' });
  const corner = () => h('span', { className: 'photo-badge' }, '예시');
  const image = h('img', { src: photo.url, alt: photo.alt, width: photo.width, height: photo.height,
    loading: 'lazy', decoding: 'async', onError() {
      // Remove the failed resource entirely: no broken icon or automatic retry loop.
      frame.replaceChildren(h('span', { className: 'photo-fallback' }, '예시 사진 없음'), corner());
    } });
  frame.append(image, corner());
  return h('figure', { className: `building-photo${compact ? ' photo-compact' : ''}` }, frame,
    h('figcaption', { className: 'photo-disclosure' }, EXAMPLE_PHOTO_LABEL));
}

export function buildingGallery(building) {
  const gallery = photosFor(building);
  return h('section', { className: `building-gallery${gallery.length > 1 ? ' has-gallery' : ''}`, 'aria-label': '건물 외관 예시' },
    h('div', { className: 'photo-gallery-grid' }, gallery.map((photo) => buildingPhoto(building, { photo }))),
    h('p', { className: 'photo-gallery-note' }, '해당 건물의 실제 사진 아님 · 생성된 건축 일러스트',
      gallery.length > 1 ? ' · 서로 다른 외관 예시이며 층수·재료·시점은 건물 정보와 무관합니다.' : ' · 층수·재료는 건물 정보와 무관합니다.'));
}
