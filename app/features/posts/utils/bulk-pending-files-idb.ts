/**
 * Persists in-memory File[] for bulk composer rows across navigations.
 * localStorage cannot hold File/Blob; IndexedDB can store ArrayBuffers per stable row clientId.
 */

const DB_NAME = "smartflow-bulk-composer-v1";
const STORE_NAME = "pendingRowFiles";
const DB_VERSION = 1;

interface SerializedFileEntry {
  name: string;
  type: string;
  lastModified: number;
  buffer: ArrayBuffer;
}

interface RowPayload {
  clientId: string;
  entries: SerializedFileEntry[];
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error("indexedDB open failed"));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (ev) => {
      const db = (ev.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "clientId" });
      }
    };
  });
}

/**
 * Replace all stored pending files with the current posts' File arrays.
 * Rows with no local files omit their key (or clear previous).
 */
export async function syncBulkPendingFilesFromPosts(
  posts: Array<{ clientId: string; files: File[] }>
): Promise<void> {
  const payloads: RowPayload[] = [];
  for (const p of posts) {
    if (p.files.length === 0) continue;
    const entries: SerializedFileEntry[] = [];
    for (const file of p.files) {
      try {
        entries.push({
          name: file.name,
          type: file.type || "application/octet-stream",
          lastModified: file.lastModified,
          buffer: await file.arrayBuffer(),
        });
      } catch {
        // skip unreadable file
      }
    }
    if (entries.length > 0) {
      payloads.push({ clientId: p.clientId, entries });
    }
  }

  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.clear();
      for (const payload of payloads) {
        store.put(payload);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () =>
        reject(tx.error ?? new Error("indexedDB transaction aborted"));
    });
  } catch {
    // private mode / quota / unsupported
  }
}

export async function loadPendingFilesForClient(
  clientId: string
): Promise<File[] | null> {
  try {
    const db = await openDb();
    return await new Promise<File[] | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(clientId);
      req.onsuccess = () => {
        const row = req.result as RowPayload | undefined;
        if (!row || row.entries.length === 0) {
          resolve(null);
          return;
        }
        const files = row.entries.map(
          (e) =>
            new File([e.buffer], e.name, {
              type: e.type,
              lastModified: e.lastModified,
            })
        );
        resolve(files);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function clearAllBulkPendingFiles(): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const req = tx.objectStore(STORE_NAME).clear();
      req.onsuccess = () => {};
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore
  }
}
