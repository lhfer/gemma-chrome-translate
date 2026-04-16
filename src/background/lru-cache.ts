export class LruCache<K, V> {
  private readonly capacity: number;

  private readonly store = new Map<K, V>();

  constructor(capacity: number) {
    this.capacity = Math.max(1, capacity);
  }

  get(key: K): V | undefined {
    const value = this.store.get(key);
    if (value === undefined) {
      return undefined;
    }

    this.store.delete(key);
    this.store.set(key, value);
    return value;
  }

  set(key: K, value: V): void {
    if (this.store.has(key)) {
      this.store.delete(key);
    }

    this.store.set(key, value);

    if (this.store.size > this.capacity) {
      const oldestKey = this.store.keys().next().value as K | undefined;
      if (oldestKey !== undefined) {
        this.store.delete(oldestKey);
      }
    }
  }
}
