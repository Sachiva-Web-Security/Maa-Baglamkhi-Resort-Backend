import { jest } from "@jest/globals";

class StorageMock {
  constructor() {
    this.store = new Map();
  }

  clear() {
    this.store.clear();
  }

  getItem(key) {
    return this.store.has(String(key)) ? this.store.get(String(key)) : null;
  }

  key(index) {
    return Array.from(this.store.keys())[index] || null;
  }

  removeItem(key) {
    this.store.delete(String(key));
  }

  setItem(key, value) {
    this.store.set(String(key), String(value));
  }

  get length() {
    return this.store.size;
  }
}

const createWindowLocation = () => ({
  origin: "http://localhost:5173",
  href: "http://localhost:5173/",
});

beforeEach(() => {
  const localStorage = new StorageMock();
  const sessionStorage = new StorageMock();

  global.localStorage = localStorage;
  global.sessionStorage = sessionStorage;
  global.CustomEvent = class CustomEvent {
    constructor(type, init = {}) {
      this.type = type;
      this.detail = init.detail;
    }
  };

  global.window = {
    localStorage,
    sessionStorage,
    location: createWindowLocation(),
    dispatchEvent: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  };

  global.document = {
    hidden: false,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    querySelector: jest.fn(() => null),
    createElement: jest.fn(() => ({
      dataset: {},
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    })),
    head: {
      appendChild: jest.fn(),
    },
  };
});

afterEach(() => {
  jest.restoreAllMocks();
});
