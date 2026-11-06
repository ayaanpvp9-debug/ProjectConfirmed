/**
 * Runtime configuration.
 *
 * Values come from `.env` (see `.env.example`). The fallback below points at
 * the deployed ACADEMIA project so a fresh clone runs without extra setup.
 *
 * The anon key is *public by design* — Supabase Row Level Security is what
 * protects the data. The service_role key must never appear in client code.
 */

const FALLBACK_URL = "https://cirkoogdprlxkktxcnlj.supabase.co";
const FALLBACK_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpcmtvb2dkcHJseGtrdHhjbmxqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM5NTIwNzIsImV4cCI6MjEwOTUyODA3Mn0.jnki8cODithReRhdv-eadaok4Fv-BFr9wtLbHf_pncY";

const env = import.meta.env ?? {};

export const SUPABASE_URL = (env.VITE_SUPABASE_URL || FALLBACK_URL).replace(/\/+$/, "");
export const SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY || FALLBACK_ANON_KEY;
export const FUNCTIONS_URL = (
  env.VITE_FUNCTIONS_URL || `${SUPABASE_URL}/functions/v1`
).replace(/\/+$/, "");

export const APP = {
  name: "ACADEMIA",
  tagline: "Student Workspace",
  storagePrefix: "academia.",
};

export const SUBJECTS = [
  "Mathematics",
  "Science",
  "English",
  "Social Science",
  "Hindi",
  "Computer Science",
  "Sanskrit",
  "Other",
];

export const PRIORITIES = [
  { value: "high", label: "High", tone: "high" },
  { value: "medium", label: "Medium", tone: "medium" },
  { value: "low", label: "Low", tone: "low" },
];
