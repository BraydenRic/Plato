/**
 * AsyncStorage is native, so the guest store needs an in-memory stand-in to be
 * testable at all.
 *
 * It has to be a *singleton pinned to globalThis* rather than a fresh object per
 * mock factory: the guest-store tests call jest.resetModules() to get a clean
 * module-level cache, and that re-runs this factory. A per-factory store would
 * hand the reloaded module an empty disk, so nothing seeded before the reset
 * would survive it — and spying on one registry's instance wouldn't affect the
 * one under test.
 */
globalThis.__asyncStorageMock ??= (() => {
  const disk = new Map();
  return {
    getItem: async (key) => (disk.has(key) ? disk.get(key) : null),
    setItem: async (key, value) => {
      disk.set(key, String(value));
    },
    removeItem: async (key) => {
      disk.delete(key);
    },
    clear: async () => {
      disk.clear();
    },
    getAllKeys: async () => [...disk.keys()],
    multiGet: async (keys) => keys.map((k) => [k, disk.has(k) ? disk.get(k) : null]),
    multiSet: async (pairs) => {
      for (const [k, v] of pairs) disk.set(k, String(v));
    },
    multiRemove: async (keys) => {
      for (const k of keys) disk.delete(k);
    },
  };
})();

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: globalThis.__asyncStorageMock,
}));
