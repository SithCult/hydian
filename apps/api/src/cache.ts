// Tiny per-route response cache. Every read endpoint is aggregated and cheap to serve stale for a minute or
// five; deleting an install clears them all so nothing lingers past the request.
const all = new Set<TtlCache<unknown>>();

export class TtlCache<T> {
  private hits = new Map<string, { at: number; body: T }>();
  private ttl: number;
  constructor(ttl: number) {
    this.ttl = ttl;
    all.add(this);
  }
  get(key: string): T | undefined {
    const hit = this.hits.get(key);
    return hit && Date.now() - hit.at < this.ttl ? hit.body : undefined;
  }
  set(key: string, body: T): T {
    this.hits.set(key, { at: Date.now(), body });
    return body;
  }
  clear() {
    this.hits.clear();
  }
}

export const clearCaches = () => all.forEach((c) => c.clear());
