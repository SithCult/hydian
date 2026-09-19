// Local document store (IndexedDB): notes and journal entries are rich documents that outgrow localStorage.
// Everything here stays on this machine; nothing in it is ever uploaded.
const NAME = "hydian",
  STORE = "docs";
let dbp: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}
const tx = async (mode: IDBTransactionMode) => (await open()).transaction(STORE, mode).objectStore(STORE);
const done = <T>(req: IDBRequest<T>) =>
  new Promise<T>((res, rej) => {
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });

export const dbGet = async <T>(key: string): Promise<T | undefined> =>
  done((await tx("readonly")).get(key)) as Promise<T | undefined>;
export const dbSet = async (key: string, value: unknown): Promise<void> => {
  await done((await tx("readwrite")).put(value, key));
};
export const dbDel = async (key: string): Promise<void> => {
  await done((await tx("readwrite")).delete(key));
};
/** All entries whose key starts with `prefix`, as [key, value] pairs. */
export async function dbList<T>(prefix: string): Promise<[string, T][]> {
  const store = await tx("readonly");
  const range = IDBKeyRange.bound(prefix, prefix + "￿");
  const keys = await done(store.getAllKeys(range)),
    values = await done(store.getAll(range));
  return keys.map((k, i) => [String(k), values[i] as T]);
}
