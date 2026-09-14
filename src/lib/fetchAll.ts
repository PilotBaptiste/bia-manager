// PostgREST caps every response (1000 rows by default): load a query page by page until it is exhausted.
// `build` must return a fresh query each call, e.g. (from, to) => supabase.from("eleves").select("*").range(from, to)
export async function fetchAll<T = any>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  pageSize = 1000,
): Promise<{ data: T[]; error: { message: string } | null }> {
  const all: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await build(from, from + pageSize - 1);
    if (error) return { data: all, error };
    all.push(...(data || []));
    if (!data || data.length < pageSize) return { data: all, error: null };
  }
}
