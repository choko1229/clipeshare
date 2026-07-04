import { detectMediaKind } from "@/lib/uploads/file-kind";

const databaseName = "clipeshare-pending-post";
const databaseVersion = 1;
const storeName = "files";
const pendingFileKey = "latest";

export function selectPostFile(files: File[]) {
  return files.find((file) => detectMediaKind(file) === "CLIP") ?? files.find((file) => detectMediaKind(file) === "SCREENSHOT") ?? null;
}

export async function savePendingPostFile(file: File) {
  const database = await openDatabase();
  await runTransaction(database, "readwrite", (store) => {
    store.put(file, pendingFileKey);
  });
  database.close();
}

export async function takePendingPostFile() {
  const database = await openDatabase();
  const file = await new Promise<File | null>((resolve, reject) => {
    const transaction = database.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    const getRequest = store.get(pendingFileKey);

    getRequest.onerror = () => reject(getRequest.error);
    getRequest.onsuccess = () => {
      const result = getRequest.result;
      store.delete(pendingFileKey);
      resolve(result instanceof File ? result : null);
    };
  });
  database.close();
  return file;
}

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName, databaseVersion);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(storeName);
    };
  });
}

function runTransaction(database: IDBDatabase, mode: IDBTransactionMode, callback: (store: IDBObjectStore) => void) {
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    callback(transaction.objectStore(storeName));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}
