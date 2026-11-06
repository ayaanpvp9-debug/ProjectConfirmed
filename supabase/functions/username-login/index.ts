// ============================================================================
// ACADEMIA · username-login
// Secure server-side username → account lookup, then a real Supabase Auth
// password grant. The account email never leaves the server.
// Deploy: supabase functions deploy username-login --no-verify-jwt
// ============================================================================
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GENERIC_ERROR = "Incorrect username or password.";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const username = String(body.username ?? "").trim();
    const password = String(body.password ?? "");

    if (!username || !password) {
      return json({ error: "Username and password are required." }, 400);
    }
    if (username.length > 40 || password.length > 200) {
      return json({ error: GENERIC_ERROR }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: profile, error } = await admin
      .from("profiles")
      .select("id, username, email")
      .eq("username_lower", username.toLowerCase())
      .maybeSingle();

    if (error) {
      console.error("profile lookup failed", error.message);
      return json({ error: "Sign-in is temporarily unavailable. Please retry." }, 503);
    }

    // Same latency + same message for unknown usernames (no account enumeration).
    if (!profile) {
      await sleep(350);
      return json({ error: GENERIC_ERROR }, 401);
    }

    const authClient = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data, error: signInError } = await authClient.auth.signInWithPassword({
      email: profile.email,
      password,
    });

    if (signInError || !data.session) {
      return json({ error: GENERIC_ERROR }, 401);
    }

    return json({
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
        expires_in: data.session.expires_in,
        token_type: data.session.token_type,
      },
      user: { id: profile.id, username: profile.username },
    });
  } catch (err) {
    console.error("username-login error", err);
    return json({ error: "Unexpected server error." }, 500);
  }
});
