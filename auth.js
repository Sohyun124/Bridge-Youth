const { getSupabaseServerCredential } = require("./supabase-credentials");

function config() {
  const credential = getSupabaseServerCredential();
  if (!process.env.SUPABASE_URL || !credential) throw new Error("Supabase is not configured");
  return { url: process.env.SUPABASE_URL.replace(/\/$/, ""), key: credential.key };
}

async function authRequest(path, options = {}) {
  const { url, key } = config();
  const response = await fetch(`${url}/auth/v1/${path}`, {
    ...options,
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || body.error_description || "Authentication failed");
  return body;
}

async function signUpMember({ email, password, nickname, redirectTo }) {
  return authRequest("signup", {
    method: "POST",
    body: JSON.stringify({ email, password, data: { nickname }, ...(redirectTo ? { redirect_to: redirectTo } : {}) }),
  });
}

async function signInMember({ email, password }) {
  return authRequest("token?grant_type=password", { method: "POST", body: JSON.stringify({ email, password }) });
}

function getProviderAuthorizationUrl(provider, redirectTo) {
  const { url } = config();
  const query = new URLSearchParams({ provider, redirect_to: redirectTo });
  return `${url}/auth/v1/authorize?${query.toString()}`;
}

async function getMember(accessToken) {
  const user = await authRequest("user", { headers: { Authorization: `Bearer ${accessToken}` } });
  const { url, key } = config();
  const response = await fetch(`${url}/rest/v1/member_profiles?select=email,nickname,role&id=eq.${encodeURIComponent(user.id)}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!response.ok) throw new Error("Member profile is unavailable");
  const rows = await response.json();
  return rows[0] ? { ...rows[0], id: user.id } : null;
}

module.exports = { signUpMember, signInMember, getProviderAuthorizationUrl, getMember };