-- ============================================================================
-- ACADEMIA — optional demonstration workspace
-- Creates clearly-labelled demo content for one existing student so the
-- dashboards, charts and history can be explored immediately.
--
-- 1. Create/register the account first (in the app, or Dashboard → Auth users).
-- 2. Adjust DEMO_USERNAME below.
-- 3. Run this file in the SQL editor.
--
-- The same dataset can be loaded per-student from Settings → “Load demo
-- workspace” inside the app (no SQL required).
-- ============================================================================
do $$
declare
  demo_username constant text := 'ayaan_demo';
  demo_id uuid;
  cfg record;
  attempt uuid;
  q record;
  idx int;
  total int;
  started timestamptz;
begin
  select id into demo_id from public.profiles where username_lower = lower(demo_username);
  if demo_id is null then
    raise notice 'No profile named % — register it first, then re-run.', demo_username;
    return;
  end if;

  update public.profiles set class_level = 10 where id = demo_id;

  -- --------------------------------------------------------------- homework
  if not exists (select 1 from public.homework where user_id = demo_id) then
    insert into public.homework (user_id, title, description, subject, deadline, priority, status, completed_at)
    values
      (demo_id, 'Quadratic equations — Exercise 4.3', 'Solve Q1–Q10 and rework the two problems marked in class.', 'Mathematics', now() + interval '1 day 4 hours', 'high', 'pending', null),
      (demo_id, 'Chemical reactions worksheet', 'Balance the 12 equations and note the reaction type for each.', 'Science', now() + interval '2 days', 'high', 'pending', null),
      (demo_id, 'First Flight — “A Letter to God”', 'Character sketch of Lencho in 150 words with three textual references.', 'English', now() + interval '3 days 6 hours', 'medium', 'pending', null),
      (demo_id, 'Map work: Resources and Development', 'Mark five major soil types on the outline map of India.', 'Social Science', now() - interval '2 days', 'medium', 'pending', null),
      (demo_id, 'Trigonometry practice set', 'Complete the NCERT exemplar questions on heights and distances.', 'Mathematics', now() + interval '5 days', 'low', 'pending', null),
      (demo_id, 'Physics: Laws of reflection lab record', 'Write the observation table and conclusion for the mirror experiment.', 'Science', now() + interval '6 days', 'medium', 'pending', null),
      (demo_id, 'Essay: Digital India', '300-word essay with an introduction and conclusion.', 'English', now() - interval '5 days', 'low', 'completed', now() - interval '5 days 2 hours'),
      (demo_id, 'Real Numbers — assignment 1', 'Complete the assignment sheet handed out on Monday.', 'Mathematics', now() - interval '8 days', 'high', 'completed', now() - interval '8 days 3 hours'),
      (demo_id, 'Periodic table quiz preparation', 'Revise groups 1, 2, 17 and 18 with their properties.', 'Science', now() - interval '9 days', 'medium', 'completed', now() - interval '9 days 1 hour'),
      (demo_id, 'Civics: Federalism notes', 'Summarise the three lists of the Indian Constitution.', 'Social Science', now() - interval '11 days', 'low', 'completed', now() - interval '11 days'),
      (demo_id, 'Hindi: Kshitij chapter summary', 'Write a summary of chapter 2 in 100 words.', 'Hindi', now() - interval '12 days', 'medium', 'completed', now() - interval '12 days 5 hours'),
      (demo_id, 'Statistics: mean, median, mode', 'Solve the practice set and check your answers.', 'Mathematics', now() - interval '14 days', 'low', 'completed', now() - interval '13 days');
  end if;

  -- ------------------------------------------------------------ study plan
  if not exists (select 1 from public.study_sessions where user_id = demo_id) then
    insert into public.study_sessions (user_id, title, subject, scheduled_at, duration, notes, completed)
    values
      (demo_id, 'Revise quadratic identities', 'Mathematics', date_trunc('day', now()) + interval '16 hours 30 minutes', 45, 'Focus on the discriminant and nature of roots.', false),
      (demo_id, 'Physics numericals drill', 'Science', date_trunc('day', now()) + interval '18 hours', 60, 'Reflection and refraction numericals.', false),
      (demo_id, 'Vocabulary sprint', 'English', date_trunc('day', now()) + interval '20 hours', 30, '20 new words + one idiom set.', true),
      (demo_id, 'History timeline revision', 'Social Science', date_trunc('day', now()) + interval '1 day 17 hours', 45, 'Nationalism in Europe.', false),
      (demo_id, 'Trigonometry problem set', 'Mathematics', date_trunc('day', now()) + interval '2 days 15 hours', 50, 'Identities → heights and distances.', false),
      (demo_id, 'Chemistry: acids and bases', 'Science', date_trunc('day', now()) + interval '3 days 16 hours', 40, 'Revisit neutralisation and pH scale.', false),
      (demo_id, 'Past mock test analysis', 'Mathematics', date_trunc('day', now()) - interval '1 day' + interval '18 hours', 30, 'Review the two algebra mistakes.', true),
      (demo_id, 'Reading: First Flight', 'English', date_trunc('day', now()) - interval '2 days' + interval '19 hours', 35, 'Annotations for the character sketch.', true);
  end if;

  -- ------------------------------------------------------------ mock tests
  if not exists (select 1 from public.test_attempts where user_id = demo_id) then
    for cfg in
      select * from (values
        ('Mathematics · Board Sprint', 5::int, interval '6 days'),
        ('Science · Core Concepts',    4::int, interval '4 days'),
        ('English · Grammar & Usage',  5::int, interval '1 day')
      ) as v(title, correct_answers, ago)
    loop
      select count(*) into total
      from public.mock_questions q2 join public.mock_tests t2 on t2.id = q2.test_id
      where t2.title = cfg.title;

      started := now() - cfg.ago;

      insert into public.test_attempts
        (user_id, test_id, status, started_at, completed_at, score, total_questions,
         correct_count, incorrect_count, unanswered_count, duration_seconds)
      select demo_id, t.id, 'completed', started, started + interval '7 minutes',
             cfg.correct_answers, total, cfg.correct_answers, 1,
             greatest(total - cfg.correct_answers - 1, 0), 420
      from public.mock_tests t
      where t.title = cfg.title
      returning id into attempt;

      if attempt is null then
        continue;
      end if;

      idx := 0;
      for q in
        select q3.id, q3.correct_option
        from public.mock_questions q3
        join public.mock_tests t3 on t3.id = q3.test_id
        where t3.title = cfg.title
        order by q3.display_order
      loop
        idx := idx + 1;
        if idx <= cfg.correct_answers then
          insert into public.test_answers (attempt_id, question_id, selected_option)
          values (attempt, q.id, q.correct_option);
        elsif idx = cfg.correct_answers + 1 then
          insert into public.test_answers (attempt_id, question_id, selected_option)
          values (attempt, q.id, case when q.correct_option = 'A' then 'B' else 'A' end);
        end if;
      end loop;

      insert into public.activity_events (user_id, kind, title, detail, meta)
      values (
        demo_id, 'test',
        'Mock test submitted — ' || round(cfg.correct_answers::numeric / total * 100) || '%',
        cfg.correct_answers || '/' || total || ' correct',
        jsonb_build_object('attempt_id', attempt)
      );
    end loop;
  end if;

  raise notice 'Demo workspace ready for %', demo_username;
end $$;
