// A deliberately small DOM for route construction and native control events.
export class Element extends EventTarget {
  constructor(tag, text = '') {
    super(); this.tagName = tag; this.children = []; this.attributes = new Map(); this.dataset = {}; this.className = ''; this._text = text;
    this.classList = {
      toggle: (name, force) => {
        const classes = new Set(this.className.split(/\s+/).filter(Boolean));
        const enabled = force ?? !classes.has(name);
        if (enabled) classes.add(name); else classes.delete(name);
        this.className = [...classes].join(' '); return enabled;
      },
      add: (name) => this.classList.toggle(name, true), remove: (name) => this.classList.toggle(name, false),
    };
  }
  setAttribute(name, value) {
    this.attributes.set(name, String(value));
    if (name === 'class') this.className = value;
    if (name.startsWith('data-')) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, x) => x.toUpperCase())] = String(value);
  }
  getAttribute(name) { return this.attributes.get(name); }
  removeAttribute(name) { this.attributes.delete(name); }
  append(...nodes) {
    for (const node of nodes) {
      if (node?.parentNode) node.parentNode.children = node.parentNode.children.filter((child) => child !== node);
      if (node instanceof Element) node.parentNode = this;
      this.children.push(node);
    }
  }
  replaceChildren(...nodes) { this.children = nodes; }
  get textContent() { return this._text + this.children.map((n) => n.textContent ?? String(n)).join(''); }
  set textContent(value) { this._text = String(value); this.children = []; }
  querySelectorAll(selector) {
    const all = this.children.flatMap((n) => n instanceof Element ? [n, ...n.querySelectorAll('*')] : []);
    if (selector === '*') return all;
    if (selector.startsWith('[')) return all.filter((n) => n.attributes.has(selector.slice(1, -1)));
    return all.filter((n) => n.tagName === selector);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
  getScreenCTM() { return null; }
  focus() { globalThis.document.activeElement = this; }
  showModal() { this.open = true; }
  close() { this.open = false; }
}

export function installDOM() {
  const saved = { document: globalThis.document, Node: globalThis.Node };
  globalThis.Node = Element;
  globalThis.document = { createElement: (tag) => new Element(tag), createElementNS: (_, tag) => new Element(tag), createTextNode: (text) => new Element('#text', text) };
  return () => { for (const [key, value] of Object.entries(saved)) if (value === undefined) delete globalThis[key]; else globalThis[key] = value; };
}
