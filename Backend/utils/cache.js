// Tiny in-memory cache. Same request within `ttlMs` reuses one answer, and
// simultaneous identical requests share a single call to the outside API.
const stores = new Map();

function memo(namespace, key, ttlMs, loader, max = 300) {
  if (!stores.has(namespace)) stores.set(namespace, new Map());
  const store = stores.get(namespace);
  const hit = store.get(key);
  if (hit && hit.expires > Date.now()) return hit.promise;

  const promise = loader();
  store.set(key, { promise, expires: Date.now() + ttlMs });
  promise.catch(() => store.delete(key)); // never cache a failure

  if (store.size > max) store.delete(store.keys().next().value); // drop the oldest
  return promise;
}

module.exports = { memo };
