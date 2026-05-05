/**
 * KotobaFlow — JMDict IndexedDB Manager
 *
 * Stores JMDict data locally in the browser's IndexedDB for instant,
 * offline dictionary lookups — exactly like 10ten Japanese Reader.
 *
 * Data source: fetched once from /api/nlp/jmdict-export (backend API)
 * and cached permanently in IndexedDB.
 *
 * Lookup chain (mirrors 10ten):
 *   1. Exact kanji match
 *   2. Exact reading match
 *   3. Base-form match
 *   4. After de-inflection, repeat 1-3 for each candidate
 */

import { deinflect } from "./deinflect";

const DB_NAME = "kotobaflow-jmdict";
const DB_VERSION = 1;
const STORE_ENTRIES = "entries";
const STORE_META = "meta";

export interface JMDictEntry {
  id: number;
  kanji: string[];        // All kanji forms, e.g. ["食べる"]
  readings: string[];     // All kana readings, e.g. ["たべる"]
  base_form: string;      // Primary lookup key
  meanings_en: string[];
  meanings_vi: string[];
  pos_tags: string[];
  jlpt_level: string | null;
  common: boolean;
}

export interface LookupResult {
  entry: JMDictEntry;
  matchedTerm: string;
  inflectionType: string;
}

// ---------------------------------------------------------------------------
// IndexedDB helpers
// ---------------------------------------------------------------------------

let _db: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db);

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;

      // Main entries store
      const store = db.createObjectStore(STORE_ENTRIES, { keyPath: "id", autoIncrement: true });
      store.createIndex("base_form", "base_form", { unique: false });
      store.createIndex("kanji_0", "kanji_0", { unique: false }); // first kanji form
      store.createIndex("reading_0", "reading_0", { unique: false }); // first reading

      // Metadata store (version, entry count, fetch date)
      db.createObjectStore(STORE_META, { keyPath: "key" });
    };

    req.onsuccess = (e) => {
      _db = (e.target as IDBOpenDBRequest).result;
      resolve(_db);
    };
    req.onerror = () => reject(req.error);
  });
}

function idbGet<T>(store: IDBObjectStore, query: IDBValidKey | IDBKeyRange): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const req = store.get(query);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

function idbGetAllByIndex<T>(
  store: IDBObjectStore,
  indexName: string,
  query: string
): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const index = store.index(indexName);
    const req = index.getAll(query);
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

// ---------------------------------------------------------------------------
// JMDictIDB — main class
// ---------------------------------------------------------------------------

export class JMDictIDB {
  private db: IDBDatabase | null = null;
  private _ready = false;
  private _entryCount = 0;

  get ready() { return this._ready; }
  get entryCount() { return this._entryCount; }

  /**
   * Initialize the database.
   * If already populated, resolves immediately.
   * If empty, fetches from the backend API and populates.
   */
  async init(apiBase: string, onProgress?: (loaded: number, total: number) => void): Promise<void> {
    this.db = await openDB();

    // Check if already populated
    const meta = await this._getMeta("entry_count");
    if (meta && meta.value > 0) {
      this._entryCount = meta.value;
      this._ready = true;
      console.log(`[JMDict] Loaded from IndexedDB: ${this._entryCount} entries`);
      return;
    }

    // Fetch from backend
    console.log("[JMDict] Fetching from backend API...");
    await this._fetchAndPopulate(apiBase, onProgress);
  }

  private async _getMeta(key: string): Promise<{ key: string; value: number } | undefined> {
    const tx = this.db!.transaction(STORE_META, "readonly");
    const store = tx.objectStore(STORE_META);
    return idbGet(store, key);
  }

  private async _setMeta(key: string, value: number): Promise<void> {
    const tx = this.db!.transaction(STORE_META, "readwrite");
    const store = tx.objectStore(STORE_META);
    return new Promise((resolve, reject) => {
      const req = store.put({ key, value });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  private async _fetchAndPopulate(
    apiBase: string,
    onProgress?: (loaded: number, total: number) => void
  ): Promise<void> {
    // Fetch the exported JMDict JSON from the backend
    const res = await fetch(`${apiBase}/api/nlp/jmdict-export`);
    if (!res.ok) {
      throw new Error(`Failed to fetch JMDict: ${res.statusText}`);
    }

    const data: { entries: JMDictEntry[] } = await res.json();
    const entries = data.entries;
    const total = entries.length;

    // Batch-insert into IndexedDB for performance
    const BATCH_SIZE = 500;
    let inserted = 0;

    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      const batch = entries.slice(i, i + BATCH_SIZE);
      await this._insertBatch(batch);
      inserted += batch.length;
      onProgress?.(inserted, total);
    }

    await this._setMeta("entry_count", total);
    await this._setMeta("fetch_timestamp", Date.now());

    this._entryCount = total;
    this._ready = true;
    console.log(`[JMDict] Populated IndexedDB with ${total} entries`);
  }

  private _insertBatch(entries: JMDictEntry[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_ENTRIES, "readwrite");
      const store = tx.objectStore(STORE_ENTRIES);

      for (const entry of entries) {
        // Flatten kanji/reading to single indexed fields for fast lookup
        const doc = {
          ...entry,
          kanji_0: entry.kanji[0] ?? "",
          reading_0: entry.readings[0] ?? "",
        };
        store.put(doc);
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // ---------------------------------------------------------------------------
  // Lookup — Longest Prefix Match + De-inflection (10ten algorithm)
  // ---------------------------------------------------------------------------

  /**
   * Main lookup function.
   * Given a text string, tries from longest prefix down to 1 char,
   * applying de-inflection at each length.
   *
   * @param text - The text to look up (should start at word boundary)
   * @param maxLen - Maximum prefix length to try (default 10)
   */
  async lookup(text: string, maxLen = 10): Promise<LookupResult | null> {
    if (!this._ready || !this.db) return null;

    const searchLen = Math.min(text.length, maxLen);

    for (let len = searchLen; len >= 1; len--) {
      const slice = text.slice(0, len);
      const candidates = deinflect(slice);

      for (const candidate of candidates) {
        const result = await this._findEntry(candidate.term);
        if (result) {
          return {
            entry: result,
            matchedTerm: slice,
            inflectionType: candidate.inflectionType,
          };
        }
      }
    }

    return null;
  }

  /**
   * Lookup by exact known term (base_form from SudachiPy).
   * Used when we already have a tokenized word.
   */
  async lookupExact(term: string): Promise<LookupResult | null> {
    if (!this._ready || !this.db) return null;
    const entry = await this._findEntry(term);
    if (!entry) return null;
    return { entry, matchedTerm: term, inflectionType: "original" };
  }

  private async _findEntry(term: string): Promise<JMDictEntry | null> {
    const tx = this.db!.transaction(STORE_ENTRIES, "readonly");
    const store = tx.objectStore(STORE_ENTRIES);

    // 1. Try kanji match
    const byKanji = await idbGetAllByIndex<JMDictEntry>(store, "kanji_0", term);
    if (byKanji.length > 0) return byKanji[0];

    // 2. Try reading match
    const byReading = await idbGetAllByIndex<JMDictEntry>(store, "reading_0", term);
    if (byReading.length > 0) return byReading[0];

    // 3. Try base_form
    const byBase = await idbGetAllByIndex<JMDictEntry>(store, "base_form", term);
    if (byBase.length > 0) return byBase[0];

    return null;
  }

  /** Clear the database (useful for forcing a re-download) */
  async clear(): Promise<void> {
    if (!this.db) return;
    const tx = this.db.transaction([STORE_ENTRIES, STORE_META], "readwrite");
    tx.objectStore(STORE_ENTRIES).clear();
    tx.objectStore(STORE_META).clear();
    this._ready = false;
    this._entryCount = 0;
    console.log("[JMDict] Database cleared");
  }
}

// Singleton instance
export const jmdict = new JMDictIDB();
