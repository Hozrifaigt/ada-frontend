/**
 * Run async work over a list with a fixed concurrency limit and cooperative cancellation.
 * `worker` handles its own errors; `shouldStop` is checked before each item is claimed.
 */
export async function runPool<T>(
  items: T[],
  worker: (item: T) => Promise<void>,
  concurrency: number,
  shouldStop?: () => boolean,
): Promise<void> {
  let idx = 0;
  const lanes = Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, async () => {
    while (idx < items.length) {
      if (shouldStop?.()) return;
      const item = items[idx++];
      await worker(item);
    }
  });
  await Promise.all(lanes);
}
