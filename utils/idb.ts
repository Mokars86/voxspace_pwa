// utils/idb.ts
import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface VoxDB extends DBSchema {
  chats: {
    key: string; // chat id
    value: any; // ChatPreview object
    indexes: { 'by-time': number };
  };
}

let dbPromise: Promise<IDBPDatabase<VoxDB>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<VoxDB>('voxspace-db', 1, {
      upgrade(db) {
        const store = db.createObjectStore('chats', { keyPath: 'id' });
        store.createIndex('by-time', 'time');
      },
    });
  }
  return dbPromise;
}

export async function storeChats(chats: any[]) {
  const db = await getDB();
  const tx = db.transaction('chats', 'readwrite');
  for (const chat of chats) {
    await tx.store.put(chat);
  }
  await tx.done;
}

export async function getAllChats() {
  const db = await getDB();
  return db.getAllFromIndex('chats', 'by-time');
}

export async function clearChats() {
  const db = await getDB();
  await db.clear('chats');
}
