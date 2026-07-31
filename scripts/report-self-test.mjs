import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const indexPath = path.join(rootDir, 'index.html');
const html = fs.readFileSync(indexPath, 'utf8');
const match = html.match(/<script>\s*([\s\S]*?)<\/script>/i);

if (!match) {
  console.error('No inline script found in index.html');
  process.exit(1);
}

class ClassListStub {
  constructor() {
    this.values = new Set();
  }

  add(...names) {
    names.forEach(name => this.values.add(name));
  }

  remove(...names) {
    names.forEach(name => this.values.delete(name));
  }

  toggle(name, force) {
    if (force === undefined) {
      if (this.values.has(name)) {
        this.values.delete(name);
        return false;
      }
      this.values.add(name);
      return true;
    }
    if (force) this.values.add(name);
    else this.values.delete(name);
    return !!force;
  }

  contains(name) {
    return this.values.has(name);
  }
}

class ElementStub {
  constructor(id = '') {
    this.id = id;
    this.dataset = {};
    this.style = { setProperty() {} };
    this.classList = new ClassListStub();
    this.parentElement = { clientWidth: 800 };
    this.children = [];
    this.value = '';
    this.disabled = false;
    this.title = '';
    this.innerHTML = '';
    this.textContent = '';
  }

  addEventListener() {}
  click() {}
  scrollIntoView() {}

  querySelectorAll() {
    return [];
  }

  querySelector() {
    return new ElementStub();
  }

  getContext() {
    return {
      clearRect() {},
      beginPath() {},
      moveTo() {},
      lineTo() {},
      stroke() {},
      fillRect() {},
      scale() {},
      set strokeStyle(_) {},
      set lineWidth(_) {},
      set fillStyle(_) {}
    };
  }
}

const elements = new Map();
const getElement = id => {
  if (!elements.has(id)) elements.set(id, new ElementStub(id));
  return elements.get(id);
};

const documentStub = {
  documentElement: new ElementStub('documentElement'),
  getElementById: getElement,
  querySelector(selector) {
    if (selector.startsWith('.tab[data-track="')) {
      const track = selector.match(/"([^"]+)"/)?.[1] || '';
      const el = getElement(`tab-${track}`);
      el.dataset.track = track;
      return el;
    }
    return new ElementStub(selector);
  },
  querySelectorAll(selector) {
    if (selector === '.tab') {
      return ['voice', 'bgm'].map(track => {
        const el = getElement(`tab-${track}`);
        el.dataset.track = track;
        return el;
      });
    }
    if (selector === '.panel') {
      return ['voice', 'bgm'].map(track => getElement(`panel-${track}`));
    }
    return [];
  }
};

const windowStub = {
  devicePixelRatio: 1,
  location: { search: '' },
  AudioContext: class {},
  webkitAudioContext: class {}
};

const context = vm.createContext({
  console,
  document: documentStub,
  window: windowStub,
  navigator: {
    clipboard: {
      writeText: async () => {}
    }
  },
  requestAnimationFrame: callback => callback(),
  setTimeout,
  clearTimeout,
  URLSearchParams
});

windowStub.window = windowStub;
windowStub.document = documentStub;
windowStub.navigator = context.navigator;

try {
  vm.runInContext(match[1], context, { filename: indexPath });
  const result = context.window.runReportSelfTest?.();

  if (!result || result.ok !== true) {
    console.error('Report self-test failed');
    console.error(JSON.stringify(result, null, 2));
    process.exit(1);
  }

  console.log('Report self-test passed');
  console.log(JSON.stringify(result));
} catch (error) {
  console.error('Report self-test crashed');
  console.error(error);
  process.exit(1);
}
