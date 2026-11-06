import { createClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config.js";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storageKey: "academia.auth",
    flowType: "pkce",
  },
  global: {
    headers: { "x-application-name": "academia" },
  },
  realtime: { params: { eventsPerSecond: 4 } },
});

/** Load the signed-in student's profile row (RLS limits this to their own row). */
export async function fetchProfile(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, email, phone, display_name, class_level, accent, created_at")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Wrap a Supabase response, throwing a readable error. */
export function unwrap({ data, error }) {
  if (error) throw error;
  return data;
}
