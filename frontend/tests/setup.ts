import '@testing-library/jest-dom';
import { beforeAll, afterEach, afterAll, vi } from 'vitest';
import { server } from './mocks/server';

const localStorageStore: Record<string, string> = {};
const localStorageMock: Storage = {
  getItem: (key) => localStorageStore[key] ?? null,
  setItem: (key, value) => {
    localStorageStore[key] = value;
  },
  removeItem: (key) => {
    delete localStorageStore[key];
  },
  clear: () => {
    Object.keys(localStorageStore).forEach((k) => delete localStorageStore[k]);
  },
  key: (index) => Object.keys(localStorageStore)[index] ?? null,
  get length() {
    return Object.keys(localStorageStore).length;
  },
};
vi.stubGlobal('localStorage', localStorageMock);

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
