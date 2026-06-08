/** Run async workers over items with a fixed concurrency limit; results preserve input order. */
export async function runWithConcurrency(items, limit, worker) {
  if (!Array.isArray(items) || items.length === 0) return [];
  const results = new Array(items.length);
  let nextIndex = 0;
  const poolSize = Math.max(1, Math.min(limit, items.length));

  async function runWorker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: poolSize }, () => runWorker()));
  return results;
}
