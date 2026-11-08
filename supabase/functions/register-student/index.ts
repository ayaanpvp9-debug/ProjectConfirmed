// ============================================================================
// Ayaan Academia · register-student
// Server-side registration: validates every field, enforces unique username /
// email / phone, creates the Supabase Auth user and the linked profile row.
// If the profile insert fails the auth user is removed, so no orphans remain.
// Deploy: supabase functions deploy register-student --no-verify-jwt
// ============================================================================
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;
const PHONE_RE = /^\+?[0-9]{10,15}$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const username = String(body.username ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const phone = String(body.phone ?? "").trim().replace(/[\s()-]/g, "");
    const password = String(body.password ?? "");

    // ---- field validation -------------------------------------------------
    const fieldErrors: Record<string, string> = {};
    if (!USERNAME_RE.test(username)) {
      fieldErrors.username = "Use 3–20 characters: letters, numbers or underscores.";
    }
    if (!EMAIL_RE.test(email)) fieldErrors.email = "Enter a valid email address.";
    if (!PHONE_RE.test(phone)) fieldErrors.phone = "Enter a valid phone number (10–15 digits).";
    if (password.length < 8) fieldErrors.password = "Use at least 8 characters.";
    else if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      fieldErrors.password = "Mix letters and numbers for a stronger password.";
    }
    if (Object.keys(fieldErrors).length) {
      return json({ error: "Please fix the highlighted fields.", fields: fieldErrors }, 422);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ---- duplicate detection ---------------------------------------------
    const checks = await Promise.all([
      admin.from("profiles").select("id").eq("username_lower", username.toLowerCase()).maybeSingle(),
      admin.from("profiles").select("id").eq("email_lower", email).maybeSingle(),
      admin.from("profiles").select("id").eq("phone", phone).maybeSingle(),
    ]);
    const dupeFields: Record<string, string> = {};
    if (checks[0].data) dupeFields.username = "That username is already taken.";
    if (checks[1].data) dupeFields.email = "That email is already registered.";
    if (checks[2].data) dupeFields.phone = "That phone number is already registered.";
    if (Object.keys(dupeFields).length) {
      return json({ error: "Some details are already registered.", fields: dupeFields }, 409);
    }

    // ---- create the auth user --------------------------------------------
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username, phone },
    });

    if (createError || !created.user) {
      const message = (createError?.message ?? "").toLowerCase();
      if (message.includes("already") || message.includes("registered") || message.includes("exists")) {
        return json(
          { error: "That email is already registered.", fields: { email: "That email is already registered." } },
          409,
        );
      }
      console.error("createUser failed", createError?.message);
      return json({ error: "Could not create the account. Please try again." }, 500);
    }

    // ---- link the profile -------------------------------------------------
    const { error: profileError } = await admin.from("profiles").insert({
      id: created.user.id,
      username,
      email,
      phone,
      display_name: username,
    });

    if (profileError) {
      // roll back so the student can retry with the same email
      await admin.auth.admin.deleteUser(created.user.id).catch(() => {});
      const isDupe = profileError.code === "23505";
      return json(
        {
          error: isDupe
            ? "Those details are already registered."
            : "Could not save your profile. Please try again.",
          details: profileError.message,
        },
        isDupe ? 409 : 500,
      );
    }

    await admin.from("activity_events").insert({
      user_id: created.user.id,
      kind: "account",
      title: "Joined Ayaan Academia",
      detail: "Workspace created",
    });

    return json({ ok: true, username });
  } catch (err) {
    console.error("register-student error", err);
    return json({ error: "Unexpected server error." }, 500);
  }
});
