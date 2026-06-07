/** Persist Anthropic usage for analytics — fire-and-forget, never blocks generation. */

function parseTripNights(tripNights) {
  if (!tripNights) return 0;
  const m = String(tripNights).match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} admin
 * @param {object} row
 */
export function logGenerationUsage(admin, row) {
  if (!admin || !row?.user_id) return;

  void admin
    .from("generation_logs")
    .insert({
      user_id: row.user_id,
      input_tokens: row.input_tokens ?? 0,
      output_tokens: row.output_tokens ?? 0,
      route_distance_miles: row.route_distance_miles ?? null,
      trip_category: row.trip_category ?? null,
      overnight_count: row.overnight_count ?? null,
      is_simplified: row.is_simplified ?? false,
      max_tokens_tier: row.max_tokens_tier ?? null,
    })
    .then(({ error }) => {
      if (error) console.error("[generation_logs] insert failed:", error.message);
    });
}

export function buildGenerationLogRow({
  userId,
  inputTokens,
  outputTokens,
  ctx,
  answers,
  routeInfo,
  isSimplifiedFormat,
  maxTokensTier,
}) {
  const miles = routeInfo?.routeDistanceMiles ?? ctx?.routeMiles ?? null;
  return {
    user_id: userId,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    route_distance_miles: miles != null ? Number(miles) : null,
    trip_category: ctx?.tripCategory ?? null,
    overnight_count: parseTripNights(answers?.trip_nights),
    is_simplified: isSimplifiedFormat,
    max_tokens_tier: maxTokensTier,
  };
}
