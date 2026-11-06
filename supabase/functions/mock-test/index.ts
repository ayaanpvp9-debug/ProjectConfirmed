// ============================================================================
// ACADEMIA · mock-test
// The only path to mock-exam data. It issues questions *without* the answer
// key, persists answers mid-attempt, grades on the server and only then
// reveals solutions. Requires a valid Supabase JWT.
// Deploy: supabase functions deploy mock-test
// ============================================================================
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GRACE_SECONDS = 45;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

type Option = "A" | "B" | "C" | "D";

interface Question {
  id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: Option;
  explanation: string | null;
  display_order: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Missing session." }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userData, error: userError } = await admin.auth.getUser(token);
  const user = userData?.user;
  if (userError || !user) return json({ error: "Session expired. Sign in again." }, 401);
  const userId = user.id;

  let payload: Record<string, unknown> = {};
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  const action = String(payload.action ?? "");
  const testId = payload.test_id ? String(payload.test_id) : null;
  const attemptId = payload.attempt_id ? String(payload.attempt_id) : null;

  // Shared: load an attempt that belongs to this student.
  async function loadAttempt(id: string) {
    const { data, error } = await admin
      .from("test_attempts")
      .select("id, user_id, test_id, status, started_at, total_questions, score, correct_count, incorrect_count, unanswered_count")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data || data.user_id !== userId) return null;
    return data;
  }

  async function questionsFor(testIdToUse: string): Promise<Question[]> {
    const { data, error } = await admin
      .from("mock_questions")
      .select("id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, display_order")
      .eq("test_id", testIdToUse)
      .order("display_order", { ascending: true });
    if (error) throw error;
    return (data ?? []) as Question[];
  }

  const publicQuestion = (q: Question) => ({
    id: q.id,
    order: q.display_order,
    question_text: q.question_text,
    options: { A: q.option_a, B: q.option_b, C: q.option_c, D: q.option_d },
  });

  try {
    // ------------------------------------------------------------------ start
    if (action === "start") {
      if (!testId) return json({ error: "test_id is required." }, 400);

      const { data: test, error: testError } = await admin
        .from("mock_tests")
        .select("id, title, description, duration_minutes, difficulty, is_active, subject_id, mock_subjects(name, slug)")
        .eq("id", testId)
        .maybeSingle();
      if (testError) throw testError;
      if (!test || !test.is_active) return json({ error: "This test is not available." }, 404);

      const questions = await questionsFor(testId);
      if (!questions.length) return json({ error: "This test has no questions yet." }, 409);

      let { data: attempt } = await admin
        .from("test_attempts")
        .select("id, started_at, status")
        .eq("user_id", userId)
        .eq("test_id", testId)
        .eq("status", "in_progress")
        .maybeSingle();

      if (!attempt) {
        const { data: created, error: createError } = await admin
          .from("test_attempts")
          .insert({ user_id: userId, test_id: testId, total_questions: questions.length })
          .select("id, started_at, status")
          .single();
        if (createError) throw createError;
        attempt = created;
      }

      const { data: saved } = await admin
        .from("test_answers")
        .select("question_id, selected_option, is_marked_for_review")
        .eq("attempt_id", attempt!.id);

      const elapsed = Math.floor((Date.now() - new Date(attempt!.started_at).getTime()) / 1000);
      const limit = test.duration_minutes * 60;
      const remaining = Math.max(0, limit - elapsed);

      // The clock ran out while the tab was closed → grade what exists.
      if (remaining === 0) {
        const graded = await grade(attempt!.id);
        return json({ expired: true, ...graded });
      }

      return json({
        test: {
          id: test.id,
          title: test.title,
          description: test.description,
          duration_minutes: test.duration_minutes,
          difficulty: test.difficulty,
          subject: (test as any).mock_subjects?.name ?? "",
          subject_slug: (test as any).mock_subjects?.slug ?? "",
        },
        attempt: { id: attempt!.id, started_at: attempt!.started_at, status: attempt!.status },
        remaining_seconds: remaining,
        questions: questions.map(publicQuestion),
        answers: saved ?? [],
      });
    }

    // ----------------------------------------------------------------- answer
    if (action === "answer") {
      if (!attemptId) return json({ error: "attempt_id is required." }, 400);
      const attempt = await loadAttempt(attemptId);
      if (!attempt) return json({ error: "Attempt not found." }, 404);
      if (attempt.status !== "in_progress") return json({ error: "Attempt already submitted." }, 409);

      const questionId = String(payload.question_id ?? "");
      const rawOption = payload.selected_option;
      const selected = rawOption === null || rawOption === undefined || rawOption === ""
        ? null
        : String(rawOption).toUpperCase();
      if (selected && !["A", "B", "C", "D"].includes(selected)) {
        return json({ error: "Invalid option." }, 422);
      }

      const { data: question } = await admin
        .from("mock_questions")
        .select("id, test_id")
        .eq("id", questionId)
        .maybeSingle();
      if (!question || question.test_id !== attempt.test_id) {
        return json({ error: "Question does not belong to this test." }, 422);
      }

      const { error: upsertError } = await admin.from("test_answers").upsert(
        {
          attempt_id: attemptId,
          question_id: questionId,
          selected_option: selected,
          is_marked_for_review: Boolean(payload.is_marked_for_review),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "attempt_id,question_id" },
      );
      if (upsertError) throw upsertError;

      return json({ ok: true, saved_at: new Date().toISOString() });
    }

    // ----------------------------------------------------------------- submit
    if (action === "submit") {
      if (!attemptId) return json({ error: "attempt_id is required." }, 400);
      const attempt = await loadAttempt(attemptId);
      if (!attempt) return json({ error: "Attempt not found." }, 404);
      if (attempt.status !== "completed") {
        const graded = await grade(attemptId);
        return json(graded);
      }
      return json(await result(attemptId));
    }

    // ----------------------------------------------------------------- review
    if (action === "review") {
      if (!attemptId) return json({ error: "attempt_id is required." }, 400);
      const attempt = await loadAttempt(attemptId);
      if (!attempt) return json({ error: "Attempt not found." }, 404);
      if (attempt.status !== "completed") return json({ error: "Submit the test to see solutions." }, 403);

      const questions = await questionsFor(attempt.test_id);
      const { data: answers } = await admin
        .from("test_answers")
        .select("question_id, selected_option")
        .eq("attempt_id", attemptId);
      const answerMap = new Map((answers ?? []).map((a) => [a.question_id, a.selected_option]));

      return json({
        attempt: await result(attemptId),
        questions: questions.map((q) => ({
          ...publicQuestion(q),
          correct_option: q.correct_option,
          explanation: q.explanation,
          selected_option: answerMap.get(q.id) ?? null,
          is_correct: answerMap.get(q.id) === q.correct_option,
        })),
      });
    }

    // ------------------------------------------------------------------- list
    if (action === "list") {
      const { data: tests, error } = await admin
        .from("mock_tests")
        .select("id, title, description, duration_minutes, difficulty, subject_id, mock_subjects(name, slug, accent), mock_questions(count)")
        .eq("is_active", true);
      if (error) throw error;

      const { data: history } = await admin
        .from("test_attempts")
        .select("id, test_id, status, score, total_questions, started_at, completed_at")
        .eq("user_id", userId)
        .order("started_at", { ascending: false });

      return json({ tests: tests ?? [], attempts: history ?? [] });
    }

    return json({ error: `Unknown action “${action}”.` }, 400);
  } catch (err) {
    console.error("mock-test error", err);
    return json({ error: "Something went wrong on the server." }, 500);
  }

  // -------------------------------------------------------------- grading
  async function grade(id: string) {
    const attempt = await loadAttempt(id);
    if (!attempt) throw new Error("Attempt not found");

    const questions = await questionsFor(attempt.test_id);
    const { data: answers } = await admin
      .from("test_answers")
      .select("question_id, selected_option")
      .eq("attempt_id", id);

    const answerMap = new Map((answers ?? []).map((a) => [a.question_id, a.selected_option]));
    let correct = 0;
    let incorrect = 0;
    let unanswered = 0;
    for (const q of questions) {
      const picked = answerMap.get(q.id) ?? null;
      if (!picked) unanswered += 1;
      else if (picked === q.correct_option) correct += 1;
      else incorrect += 1;
    }

    const startedAt = new Date(attempt.started_at).getTime();
    const now = Date.now();
    const durationSeconds = Math.min(
      Math.round((now - startedAt) / 1000),
      Math.round((now - startedAt) / 1000),
    );

    const { error } = await admin
      .from("test_attempts")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        score: correct,
        total_questions: questions.length,
        correct_count: correct,
        incorrect_count: incorrect,
        unanswered_count: unanswered,
        duration_seconds: durationSeconds,
      })
      .eq("id", id);
    if (error) throw error;

    const pct = questions.length ? Math.round((correct / questions.length) * 100) : 0;
    await admin.from("activity_events").insert({
      user_id: userId,
      kind: "test",
      title: `Mock test submitted — ${pct}%`,
      detail: `${correct}/${questions.length} correct`,
      meta: { attempt_id: id },
    });

    return result(id);
  }

  async function result(id: string) {
    const { data, error } = await admin
      .from("test_attempts")
      .select("id, test_id, score, total_questions, correct_count, incorrect_count, unanswered_count, started_at, completed_at, duration_seconds, status, mock_tests(title, mock_subjects(name, slug))")
      .eq("id", id)
      .eq("user_id", userId)
      .single();
    if (error) throw error;
    const pct = data.total_questions ? Math.round((data.score / data.total_questions) * 100) : 0;
    return { attempt: { ...data, percentage: pct } };
  }
});
