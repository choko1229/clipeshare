/**
 * プロセス内メモリの固定ウィンドウ方式レート制限。
 * 本番は単一プロセス(systemd の `npm run start`)のため十分。複数プロセス化する場合は共有ストアに置き換える
 * (docs/quickshare/QUESTIONS.md Q-010)。
 */
export type RateLimitResult = { allowed: true; remaining: number } | { allowed: false; retryAfterSeconds: number };

type Bucket = {
  count: number;
  resetAt: number;
};

export class FixedWindowRateLimiter {
  private readonly buckets = new Map<string, Bucket>();
  private lastSweep = 0;

  constructor(
    private readonly windowMs: number,
    private readonly maxKeys = 50_000,
    private readonly now: () => number = Date.now,
  ) {}

  /** 1回分を消費する。limit <= 0 は無制限 */
  consume(key: string, limit: number): RateLimitResult {
    if (limit <= 0) {
      return { allowed: true, remaining: Number.POSITIVE_INFINITY };
    }

    const now = this.now();
    this.sweep(now);

    const bucket = this.buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + this.windowMs });
      return { allowed: true, remaining: limit - 1 };
    }

    if (bucket.count >= limit) {
      return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
    }

    bucket.count += 1;
    return { allowed: true, remaining: limit - bucket.count };
  }

  /** 消費せずに上限到達かどうかだけ見る */
  peek(key: string, limit: number): RateLimitResult {
    if (limit <= 0) {
      return { allowed: true, remaining: Number.POSITIVE_INFINITY };
    }

    const now = this.now();
    const bucket = this.buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      return { allowed: true, remaining: limit };
    }

    if (bucket.count >= limit) {
      return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
    }

    return { allowed: true, remaining: limit - bucket.count };
  }

  reset() {
    this.buckets.clear();
  }

  private sweep(now: number) {
    if (now - this.lastSweep < this.windowMs && this.buckets.size < this.maxKeys) {
      return;
    }

    this.lastSweep = now;

    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) {
        this.buckets.delete(key);
      }
    }

    // 期限内のキーだけで上限を超えた場合は古い順に捨てる(メモリ保護)
    if (this.buckets.size >= this.maxKeys) {
      const overflow = this.buckets.size - this.maxKeys + 1;
      let removed = 0;
      for (const key of this.buckets.keys()) {
        this.buckets.delete(key);
        removed += 1;
        if (removed >= overflow) {
          break;
        }
      }
    }
  }
}
