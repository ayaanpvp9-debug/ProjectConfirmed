/**
 * Edge Function client.
 * Every privileged operation (registration, username login, mock exams) lives
 * server-side; the browser only ever holds a normal user session.
 */
import { FUNCTIONS_URL, SUPABASE_ANON_KEY } from "./config.js";
import { supabase } from "./supabase.js";

export class ApiError extends Error {
  constructor(message, { status = 0, fields = null } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fields = fields;
  }
}

async function invoke(name, payload, { auth = false } = {}) {
  const headers = {
    "Content-Type": "application/json",
    apikey: SUPABASE_ANON_KEY,
  };

  if (auth) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) throw new ApiError("Your session expired. Please sign in again.", { status: 401 });
    headers.Authorization = `Bearer ${session.access_token}`;
  }

  let response;
  try {
    response = await fetch(`${FUNCTIONS_URL}/${name}`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload ?? {}),
    });
  } catch {
    throw new ApiError("Network error — check your connection and try again.");
  }

  let body = {};
  try {
    body = await response.json();
  } catch {
    body = {};
  }

  if (!response.ok || body?.error) {
    throw new ApiError(body?.error || `Request failed (${response.status})`, {
      status: response.status,
      fields: body?.fields ?? null,
    });
  }

  return body;
}

export const api = {
  /* auth ------------------------------------------------------------- */
  register: (payload) => invoke("register-student", payload),
  login: ({ username, password }) => invoke("username-login", { username, password }),

  /* mock tests ------------------------------------------------------- */
  mockList: () => invoke("mock-test", { action: "list" }, { auth: true }),
  mockStart: (testId) => invoke("mock-test", { action: "start", test_id: testId }, { auth: true }),
  mockAnswer: ({ attemptId, questionId, selectedOption, marked }) =>
    invoke(
      "mock-test",
      {
        action: "answer",
        attempt_id: attemptId,
        question_id: questionId,
        selected_option: selectedOption,
        is_marked_for_review: Boolean(marked),
      },
      { auth: true },
    ),
  mockSubmit: (attemptId) =>
    invoke("mock-test", { action: "submit", attempt_id: attemptId }, { auth: true }),
  mockReview: (attemptId) =>
    invoke("mock-test", { action: "review", attempt_id: attemptId }, { auth: true }),
};
