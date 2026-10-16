function getSupabaseServerCredential() {
  if (process.env.SUPABASE_SECRET_KEY) {
    return { key: process.env.SUPABASE_SECRET_KEY, isLegacy: false };
  }
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { key: process.env.SUPABASE_SERVICE_ROLE_KEY, isLegacy: true };
  }
  return null;
}

function requireSupabaseServerCredential() {
  const credential = getSupabaseServerCredential();
  if (!credential) throw new Error("SUPABASE_SECRET_KEY is required");
  return credential;
}

function supabaseServerHeaders(extra = {}) {
  const { key, isLegacy } = requireSupabaseServerCredential();
  return {
    apikey: key,
    ...(isLegacy ? { Authorization: `Bearer ${key}` } : {}),
    ...extra,
  };
}

module.exports = {
  getSupabaseServerCredential,
  requireSupabaseServerCredential,
  supabaseServerHeaders,
};
