// Tiny per-route response cache. Every read endpoint is aggregated and cheap to serve stale for a minute or
// five; deleting an install clears them all so nothing lingers past the request.
const all = new Set<TtlCache<unknown>>();

export class TtlCache<T> {
  private hits = new Map<string, { at: number; body: T }>();
  private ttl: number;
  private revision = 0;
  constructor(ttl: number) {
    this.ttl = ttl;
    all.add(this);
  }
  get(key: string): T | undefined {
    const hit = this.hits.get(key);
    if (!hit) return undefined;
    if (Date.now() - hit.at < this.ttl) return hit.body;
    this.hits.delete(key);
    return undefined;
  }
  get generation(): number {
    return this.revision;
  }
  set(key: string, body: T, generation = this.revision): T {
    if (generation !== this.revision) return body;
    const now = Date.now();
    for (const [k, hit] of this.hits) if (now - hit.at >= this.ttl) this.hits.delete(k);
    this.hits.delete(key);
    if (this.hits.size >= 512) this.hits.delete(this.hits.keys().next().value!);
    this.hits.set(key, { at: now, body });
    return body;
  }
  clear() {
    this.revision++;
    this.hits.clear();
  }
}

export const clearCaches = () => all.forEach((c) => c.clear());
