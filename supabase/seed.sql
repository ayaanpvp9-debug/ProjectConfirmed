-- ============================================================================
-- ACADEMIA — reference + demonstration seed data
-- Every NCERT link below was verified against ncert.nic.in's official
-- textbook URLs (https://ncert.nic.in/textbook.php?<code>=0-<chapters>).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- NCERT classes
-- ---------------------------------------------------------------------------
insert into public.ncert_classes (class_number, display_name, tagline, accent) values
  (1,  'Class 1',  'First steps, big wonder',        'cyan'),
  (2,  'Class 2',  'Reading, counting, creating',    'cyan'),
  (3,  'Class 3',  'Curiosity takes hold',           'blue'),
  (4,  'Class 4',  'Ideas start to connect',         'blue'),
  (5,  'Class 5',  'Thinking gets sharper',          'violet'),
  (6,  'Class 6',  'The world opens up',             'violet'),
  (7,  'Class 7',  'Questions get deeper',           'violet'),
  (8,  'Class 8',  'Foundations turn solid',         'amber'),
  (9,  'Class 9',  'The board years begin',          'amber'),
  (10, 'Class 10', 'The first big summit',           'rose'),
  (11, 'Class 11', 'Choose your direction',          'blue'),
  (12, 'Class 12', 'The final stretch',              'rose')
on conflict (class_number) do update
  set display_name = excluded.display_name,
      tagline      = excluded.tagline,
      accent       = excluded.accent;

create unique index if not exists ncert_books_class_code_key
  on public.ncert_books (class_id, book_code);

-- ---------------------------------------------------------------------------
-- NCERT books (official English-medium textbooks, I–XII)
-- ---------------------------------------------------------------------------
with book_seed (class_number, subject, title, code, chapters) as (
  values
    (1,'Mathematics','Math-Magic 1','aemh1',13),
    (1,'English','Marigold 1','aeen1',10),
    (1,'Hindi','Rimjhim 1','ahhn1',14),
    (2,'Mathematics','Math-Magic 2','bemh1',15),
    (2,'English','Marigold 2','been1',10),
    (2,'Hindi','Rimjhim 2','bhhn1',15),
    (3,'Mathematics','Math-Magic 3','cemh1',14),
    (3,'English','Marigold 3','ceen1',10),
    (3,'Hindi','Rimjhim 3','chhn1',14),
    (3,'EVS','Looking Around 3','ceap1',24),
    (4,'Mathematics','Math-Magic 4','demh1',14),
    (4,'English','Marigold 4','deen1',9),
    (4,'Hindi','Rimjhim 4','dhhn1',14),
    (4,'EVS','Looking Around 4','deap1',27),
    (5,'Mathematics','Math-Magic 5','eemh1',14),
    (5,'English','Marigold 5','eeen1',10),
    (5,'Hindi','Rimjhim 5','ehhn1',18),
    (5,'EVS','Looking Around 5','eeap1',22),
    (6,'Mathematics','Mathematics 6','femh1',14),
    (6,'Science','Science 6','fesc1',16),
    (6,'English','Honeysuckle','fehl1',10),
    (6,'Hindi','Vasant 1','fhvs1',17),
    (6,'Social Science','Our Pasts I','fess1',11),
    (6,'Social Science','The Earth: Our Habitat','fess2',8),
    (6,'Social Science','Social and Political Life I','fess3',9),
    (6,'Sanskrit','Ruchira 1','fhsk1',15),
    (7,'Mathematics','Mathematics 7','gemh1',15),
    (7,'Science','Science 7','gesc1',18),
    (7,'English','Honeycomb','gehc1',10),
    (7,'Hindi','Vasant 2','ghvs1',20),
    (7,'Social Science','Our Pasts II','gess1',10),
    (7,'Social Science','Our Environment','gess2',9),
    (7,'Social Science','Social and Political Life II','gess3',9),
    (7,'Sanskrit','Ruchira 2','ghsk1',15),
    (8,'Mathematics','Mathematics 8','hemh1',16),
    (8,'Science','Science 8','hesc1',18),
    (8,'English','Honeydew','hehd1',10),
    (8,'English','It So Happened','heih1',11),
    (8,'Hindi','Vasant 3','hhvs1',18),
    (8,'Social Science','Our Pasts III','hess2',8),
    (8,'Social Science','Resources and Development','hess4',6),
    (8,'Social Science','Social and Political Life III','hess3',8),
    (8,'Sanskrit','Ruchira 3','hhsk1',15),
    (9,'Mathematics','Mathematics 9','iemh1',12),
    (9,'Science','Science 9','iesc1',12),
    (9,'Social Science','Contemporary India I','iess1',8),
    (9,'Social Science','Economics 9','iess2',8),
    (9,'Social Science','India and the Contemporary World I','iess3',8),
    (9,'Social Science','Democratic Politics I','iess4',8),
    (10,'Mathematics','Mathematics 10','jemh1',15),
    (10,'Science','Science 10','jesc1',16),
    (10,'English','First Flight','jeff1',11),
    (10,'English','Footprints Without Feet','jefp1',10),
    (10,'Hindi','Kshitij 2','jhks1',17),
    (10,'Hindi','Kritika 2','jhkr1',5),
    (10,'Social Science','Contemporary India II','jess1',7),
    (10,'Social Science','Understanding Economic Development','jess2',5),
    (10,'Social Science','India and the Contemporary World II','jess3',5),
    (10,'Social Science','Democratic Politics II','jess4',8),
    (11,'Mathematics','Mathematics 11','kemh1',14),
    (11,'Physics','Physics Part I','keph1',8),
    (11,'Physics','Physics Part II','keph2',7),
    (11,'Chemistry','Chemistry Part I','kech1',9),
    (11,'Chemistry','Chemistry Part II','kech2',8),
    (11,'Biology','Biology 11','kebo1',19),
    (12,'Mathematics','Mathematics Part I','lemh1',6),
    (12,'Mathematics','Mathematics Part II','lemh2',7),
    (12,'Physics','Physics Part I','leph1',8),
    (12,'Physics','Physics Part II','leph2',7),
    (12,'Chemistry','Chemistry Part I','lech1',9),
    (12,'Chemistry','Chemistry Part II','lech2',8),
    (12,'Biology','Biology 12','lebo1',16)
)
insert into public.ncert_books (class_id, subject, title, language, book_code, official_url, download_url, display_order)
select c.id,
       b.subject,
       b.title,
       'English',
       b.code,
       'https://ncert.nic.in/textbook.php?' || b.code || '=0-' || b.chapters,
       'https://ncert.nic.in/textbook/pdf/' || b.code || 'dd.zip',
       row_number() over (partition by b.class_number order by b.subject, b.title)::smallint
from book_seed b
join public.ncert_classes c on c.class_number = b.class_number
on conflict (class_id, book_code) do update
  set title = excluded.title,
      subject = excluded.subject,
      official_url = excluded.official_url,
      download_url = excluded.download_url,
      display_order = excluded.display_order;

-- ---------------------------------------------------------------------------
-- Mock tests — exactly FIVE subjects
-- ---------------------------------------------------------------------------
insert into public.mock_subjects (name, slug, description, accent, display_order) values
  ('Mathematics',     'mathematics',     'Algebra, geometry, number sense and probability.',           'blue',   1),
  ('Science',         'science',         'Physics, chemistry and biology fundamentals.',                'violet', 2),
  ('English',         'english',         'Grammar, vocabulary and comprehension precision.',             'cyan',   3),
  ('Social Science',  'social-science',  'Indian polity, geography, history and economy.',              'amber',  4),
  ('Computer Science','computer-science','Web fundamentals, logic and programming concepts.',            'rose',   5)
on conflict (slug) do update
  set name = excluded.name,
      description = excluded.description,
      accent = excluded.accent,
      display_order = excluded.display_order;

insert into public.mock_tests (subject_id, title, description, duration_minutes, difficulty, is_active)
select s.id, v.title, v.description, v.duration, v.difficulty, true
from public.mock_subjects s
join (values
  ('mathematics','Mathematics · Foundations','Warm-up set on equations, HCF/LCM, mensuration and probability. 10 min · 6 questions','easy',10),
  ('mathematics','Mathematics · Board Sprint','Board-style mixed set: quadratics, AP, trigonometry and coordinate geometry. 12 min · 6 questions','challenging',12),
  ('science','Science · Core Concepts','Forces, cells, acids and chemical formulae — the essentials. 10 min · 6 questions','easy',10),
  ('science','Science · Concept Check','Laws of motion, electricity and neutralisation. 12 min · 6 questions','moderate',12),
  ('english','English · Grammar & Usage','Tense, articles, synonyms and parts of speech. 8 min · 6 questions','easy',8),
  ('english','English · Vocabulary Lab','Idioms, voice, spelling and word precision. 10 min · 6 questions','moderate',10),
  ('social-science','Social Science · India & the World','Freedom movement, geography and the Constitution. 10 min · 6 questions','easy',10),
  ('social-science','Social Science · Polity & Economy','Elections, sectors and landmark reforms. 12 min · 6 questions','challenging',12),
  ('computer-science','Computer Science · Fundamentals','Hardware, bits and the web. 8 min · 6 questions','easy',8),
  ('computer-science','Computer Science · Web & Logic','CSS, algorithms, HTTP and JavaScript basics. 10 min · 6 questions','moderate',10)
) as v(slug, title, description, difficulty, duration) on s.slug = v.slug
where not exists (select 1 from public.mock_tests t where t.title = v.title);

-- ---------------------------------------------------------------------------
-- Mock questions (answer keys live here — protected by RLS, RPC-only access)
-- ---------------------------------------------------------------------------
with q (test_title, ord, question_text, a, b, c, d, correct_option, explanation) as (
  values
  -- MATHEMATICS · FOUNDATIONS
  ('Mathematics · Foundations', 1, 'If 2x + 5 = 17, what is the value of x?',
   '4','6','7','11','B','Subtract 5 from both sides to get 2x = 12, so x = 6.'),
  ('Mathematics · Foundations', 2, 'What is the HCF of 12 and 18?',
   '2','3','6','36','C','12 = 2² × 3 and 18 = 2 × 3². The highest common factor is 2 × 3 = 6.'),
  ('Mathematics · Foundations', 3, 'The area of a circle with radius 7 cm (π = 22/7) is:',
   '44 cm²','154 cm²','308 cm²','49 cm²','B','Area = πr² = 22/7 × 7 × 7 = 154 cm².'),
  ('Mathematics · Foundations', 4, 'Simple interest on ₹5,000 at 8% per annum for 2 years is:',
   '₹400','₹600','₹800','₹1,000','C','SI = PRT/100 = 5000 × 8 × 2 / 100 = ₹800.'),
  ('Mathematics · Foundations', 5, 'Which of the following is an irrational number?',
   '0.25','√2','22/7','√16','B','√2 cannot be written as a fraction of integers, so it is irrational.'),
  ('Mathematics · Foundations', 6, 'The sum of the interior angles of a pentagon is:',
   '360°','480°','540°','720°','C','Sum = (n − 2) × 180° = 3 × 180° = 540°.'),
  -- MATHEMATICS · BOARD SPRINT
  ('Mathematics · Board Sprint', 1, 'The roots of x² − 5x + 6 = 0 are:',
   '1 and 6','2 and 3','−2 and −3','5 and 6','B','Factorise: (x − 2)(x − 3) = 0, so x = 2 or 3.'),
  ('Mathematics · Board Sprint', 2, 'In the AP 3, 7, 11, …, the 10th term is:',
   '35','37','39','41','C','aₙ = a + (n − 1)d = 3 + 9 × 4 = 39.'),
  ('Mathematics · Board Sprint', 3, 'A fair die is rolled once. The probability of getting a prime number is:',
   '1/3','1/2','2/3','1/6','B','Primes on a die are 2, 3 and 5 → 3/6 = 1/2.'),
  ('Mathematics · Board Sprint', 4, 'The value of tan 45° is:',
   '0','1/2','1','√3','C','tan 45° = sin 45° / cos 45° = 1.'),
  ('Mathematics · Board Sprint', 5, 'The distance between the points (0, 0) and (3, 4) is:',
   '4','5','7','25','B','Distance = √(3² + 4²) = √25 = 5 units.'),
  ('Mathematics · Board Sprint', 6, 'A cylinder has radius 3 cm and height 5 cm. Its volume (in cm³, take π = 3.14) is:',
   '47.1','94.2','141.3','188.4','C','Volume = πr²h = 3.14 × 9 × 5 = 141.3 cm³.'),
  -- SCIENCE · CORE CONCEPTS
  ('Science · Core Concepts', 1, 'The SI unit of force is the:',
   'joule','watt','newton','pascal','C','Force is measured in newtons (N), where 1 N = 1 kg·m/s².'),
  ('Science · Core Concepts', 2, 'The chemical formula of water is:',
   'H₂O','CO₂','HO₂','H₂O₂','A','Water has two hydrogen atoms bonded to one oxygen atom: H₂O.'),
  ('Science · Core Concepts', 3, 'Which organelle is known as the powerhouse of the cell?',
   'Ribosome','Nucleus','Mitochondrion','Golgi body','C','Mitochondria release energy as ATP through cellular respiration.'),
  ('Science · Core Concepts', 4, 'A solution with pH less than 7 is:',
   'basic','neutral','acidic','amphoteric','C','Lower pH means a higher hydrogen-ion concentration, i.e. acidic.'),
  ('Science · Core Concepts', 5, 'During photosynthesis, plants absorb which gas?',
   'Oxygen','Nitrogen','Carbon dioxide','Hydrogen','C','Plants use CO₂ and water, releasing oxygen in the presence of sunlight.'),
  ('Science · Core Concepts', 6, 'The speed of light in vacuum is approximately:',
   '3 × 10⁶ m/s','3 × 10⁸ m/s','3 × 10¹⁰ m/s','9.8 m/s²','B','Light travels at about 3 × 10⁸ m/s in vacuum.'),
  -- SCIENCE · CONCEPT CHECK
  ('Science · Concept Check', 1, 'Newton''s second law of motion is expressed as:',
   'F = mv','F = ma','F = m/a','F = mgh','B','Force equals mass times acceleration: F = ma.'),
  ('Science · Concept Check', 2, 'Which of these is a noble gas?',
   'Chlorine','Argon','Oxygen','Nitrogen','B','Argon belongs to Group 18 — the noble gases, which are highly unreactive.'),
  ('Science · Concept Check', 3, 'Ohm''s law states that:',
   'V = IR','V = I/R','V = R/I','V = I²R','A','Potential difference equals current multiplied by resistance: V = IR.'),
  ('Science · Concept Check', 4, 'Acid + base → ?',
   'salt + water','acid + salt','gas only','metal + water','A','This is neutralisation: an acid and a base form a salt and water.'),
  ('Science · Concept Check', 5, 'The SI unit of electric power is the:',
   'ampere','ohm','volt','watt','D','Power is measured in watts; 1 W = 1 J/s.'),
  ('Science · Concept Check', 6, 'The pH of human blood is approximately:',
   '5.0','6.0','7.4','9.0','C','Blood is slightly basic at about pH 7.4.'),
  -- ENGLISH · GRAMMAR & USAGE
  ('English · Grammar & Usage', 1, 'Choose the grammatically correct sentence.',
   'She don''t like coffee.','She doesn''t likes coffee.','She doesn''t like coffee.','She not like coffee.','C','With a third-person singular subject, use “doesn''t” + base verb.'),
  ('English · Grammar & Usage', 2, 'The synonym of “diligent” is:',
   'lazy','hardworking','careless','cheerful','B','Diligent means showing persistent, careful effort.'),
  ('English · Grammar & Usage', 3, 'The past tense of “write” is:',
   'writed','wrote','written','writing','B','Write → wrote (past) → written (past participle).'),
  ('English · Grammar & Usage', 4, 'Choose the correct article: “___ honest man”.',
   'a','an','the','no article','B','“Honest” begins with a vowel sound, so “an” is used.'),
  ('English · Grammar & Usage', 5, 'The antonym of “scarce” is:',
   'rare','limited','abundant','narrow','C','Scarce means in short supply; abundant means plentiful.'),
  ('English · Grammar & Usage', 6, 'Which word is a preposition?',
   'quickly','between','and','beautiful','B','“Between” shows the relationship of a noun to another element — a preposition.'),
  -- ENGLISH · VOCABULARY LAB
  ('English · Vocabulary Lab', 1, 'The idiom “to let the cat out of the bag” means to:',
   'make a mistake','reveal a secret','start a fight','escape quickly','B','It means disclosing something that was meant to be secret.'),
  ('English · Vocabulary Lab', 2, 'The passive voice of “The teacher praised him” is:',
   'He praised the teacher.','He was praised by the teacher.','He is praising the teacher.','The teacher was praised.','B','Passive: object + was + past participle + by + subject.'),
  ('English · Vocabulary Lab', 3, 'Identify the adverb: “She sang beautifully.”',
   'She','sang','beautifully','none','C','“Beautifully” modifies the verb “sang”, so it is an adverb.'),
  ('English · Vocabulary Lab', 4, 'Choose the correctly spelled word.',
   'acomodation','accommodation','accomodation','accommodetion','B','Accommodation has double “c” and double “m”.'),
  ('English · Vocabulary Lab', 5, 'Which word is a conjunction?',
   'although','quickly','beneath','happiness','A','“Although” joins two clauses, so it is a subordinating conjunction.'),
  ('English · Vocabulary Lab', 6, 'One who studies stars and planets is called an:',
   'astrologer','astronomer','archaeologist','astronaut','B','An astronomer studies celestial objects scientifically.'),
  -- SOCIAL SCIENCE · INDIA & THE WORLD
  ('Social Science · India & the World', 1, 'India gained independence in the year:',
   '1942','1945','1947','1950','C','India became independent on 15 August 1947.'),
  ('Social Science · India & the World', 2, 'Fundamental Rights are guaranteed in which Part of the Constitution?',
   'Part II','Part III','Part IV','Part V','B','Part III (Articles 12–35) contains the Fundamental Rights.'),
  ('Social Science · India & the World', 3, 'The Tropic of Cancer passes through how many Indian states?',
   '6','7','8','9','C','It crosses 8 states, from Gujarat to Mizoram.'),
  ('Social Science · India & the World', 4, 'The longest river flowing entirely within India is the:',
   'Ganga','Godavari','Yamuna','Narmada','A','The Ganga is India''s longest river, about 2,525 km.'),
  ('Social Science · India & the World', 5, 'The First World War began in:',
   '1912','1914','1918','1939','B','It began in 1914 after the assassination of Archduke Franz Ferdinand.'),
  ('Social Science · India & the World', 6, 'Which Article abolishes untouchability?',
   'Article 14','Article 15','Article 17','Article 21','C','Article 17 abolishes untouchability in any form.'),
  -- SOCIAL SCIENCE · POLITY & ECONOMY
  ('Social Science · Polity & Economy', 1, 'The Election Commission of India is established under:',
   'Article 312','Article 324','Article 356','Article 370','B','Article 324 provides for an independent Election Commission.'),
  ('Social Science · Polity & Economy', 2, 'Which sector contributes the largest share to India''s GDP?',
   'Agriculture','Manufacturing','Services','Mining','C','The services sector contributes the largest share of India''s GDP.'),
  ('Social Science · Polity & Economy', 3, 'The Right to Education Act was enacted in:',
   '2005','2009','2012','2015','B','The RTE Act came into force in 2010 after being passed in 2009.'),
  ('Social Science · Polity & Economy', 4, 'Who chaired the Drafting Committee of the Constitution?',
   'Rajendra Prasad','Jawaharlal Nehru','B. R. Ambedkar','Sardar Patel','C','Dr B. R. Ambedkar chaired the Drafting Committee.'),
  ('Social Science · Polity & Economy', 5, 'The Green Revolution in India is associated with:',
   'Verghese Kurien','M. S. Swaminathan','Norman Borlaug only','C. Subramaniam only','B','M. S. Swaminathan led India''s Green Revolution in wheat and rice.'),
  ('Social Science · Polity & Economy', 6, 'A Uniform Civil Code is mentioned in the Constitution as a:',
   'Fundamental Right','Directive Principle','Fundamental Duty','Constitutional Amendment','B','Article 44 places it among the Directive Principles of State Policy.'),
  -- COMPUTER SCIENCE · FUNDAMENTALS
  ('Computer Science · Fundamentals', 1, 'HTML stands for:',
   'HyperText Markup Language','HighText Machine Language','HyperTool Markup Language','Home Tool Markup Language','A','HTML is the standard markup language for documents on the web.'),
  ('Computer Science · Fundamentals', 2, 'Which of these is a programming language?',
   'HTTP','Python','HTML','JPEG','B','Python is a general-purpose programming language.'),
  ('Computer Science · Fundamentals', 3, 'One byte is equal to:',
   '4 bits','8 bits','16 bits','1024 bits','B','A byte consists of 8 bits.'),
  ('Computer Science · Fundamentals', 4, 'The CPU is responsible for:',
   'storing files permanently','processing instructions','displaying images','routing network traffic','B','The Central Processing Unit executes program instructions.'),
  ('Computer Science · Fundamentals', 5, 'Which key usually refreshes a web page?',
   'F1','F5','F9','F12','B','F5 (or Ctrl/Cmd + R) reloads the current page.'),
  ('Computer Science · Fundamentals', 6, 'JavaScript was originally developed at:',
   'Microsoft','Netscape','Sun Microsystems','Google','B','Brendan Eich created JavaScript at Netscape in 1995.'),
  -- COMPUTER SCIENCE · WEB & LOGIC
  ('Computer Science · Web & Logic', 1, 'Which CSS property controls the space inside an element''s border?',
   'margin','padding','border-radius','gap','B','Padding is the inner space between content and border.'),
  ('Computer Science · Web & Logic', 2, 'The time complexity of binary search on a sorted array is:',
   'O(1)','O(log n)','O(n)','O(n²)','B','Each comparison halves the search space, giving logarithmic time.'),
  ('Computer Science · Web & Logic', 3, 'In JavaScript, which keyword declares a block-scoped variable?',
   'var','let','function','const only at top level','B','“let” (and “const”) are block-scoped; “var” is function-scoped.'),
  ('Computer Science · Web & Logic', 4, 'SQL stands for:',
   'Structured Query Language','Simple Question Language','Sequential Query Logic','Standard Query Layer','A','SQL is the Structured Query Language used with relational databases.'),
  ('Computer Science · Web & Logic', 5, 'The HTTP status code for “Not Found” is:',
   '200','301','403','404','D','404 means the server cannot find the requested resource.'),
  ('Computer Science · Web & Logic', 6, 'Which of these is NOT a JavaScript primitive type?',
   'string','boolean','float','symbol','C','JavaScript numbers are all “number”; there is no “float” primitive.')
)
insert into public.mock_questions (test_id, display_order, question_text, option_a, option_b, option_c, option_d, correct_option, explanation)
select t.id, q.ord, q.question_text, q.a, q.b, q.c, q.d, q.correct_option, q.explanation
from q join public.mock_tests t on t.title = q.test_title
on conflict do nothing;
