/* Tasks, classes and events: priorities, Canvas import, workload warnings, tips and study guides. */

// What kind of assignment a title sounds like: a guess at how long it takes and how much it matters.
const KINDS = [
  { key: 'test', re: /\b(test|exam|midterm|final|assessment)\b/i, effort: 90, importance: 3 },
  { key: 'project', re: /\b(project|presentation|poster|portfolio)\b/i, effort: 120, importance: 3 },
  { key: 'essay', re: /\b(essay|paper|draft|writing|report|research)\b/i, effort: 90, importance: 2 },
  { key: 'quiz', re: /\bquiz/i, effort: 30, importance: 2 },
  { key: 'lab', re: /\blab\b/i, effort: 60, importance: 2 },
  { key: 'reading', re: /\b(read|reading|chapter|ch\.|pages?)\b/i, effort: 30, importance: 1 },
  { key: 'discussion', re: /\b(discussion|post|reply|reflection|journal)\b/i, effort: 20, importance: 1 },
  { key: 'problems', re: /\b(worksheet|problems?|practice|homework|hw|problem set|pset|exercises?)\b/i, effort: 40, importance: 2 },
];
const DEFAULT_KIND = { key: 'task', effort: 30, importance: 2 };
function kindOf(title) { return KINDS.find(k => k.re.test(title || '')) || DEFAULT_KIND; }

const CLASS_COLORS = ['#e64980', '#7950f2', '#1c7ed6', '#0ca678', '#f08c00', '#d6336c', '#15aabf', '#ae3ec9', '#5c940d', '#e8590c'];

const Tasks = {
  // Tasks shown in the app (Canvas tasks are hidden when the source is "only my own tasks")
  all() {
    const manualOnly = Store.data.settings.source === 'manual';
    return Store.data.tasks.filter(t => !(manualOnly && t.source === 'canvas'));
  },
  open() { return Tasks.all().filter(t => !t.done); },
  get(id) { return Store.data.tasks.find(t => t.id === id); },

  add(f) {
    const kind = kindOf(f.title);
    const t = {
      id: 't' + uid(), title: f.title.trim(), cls: (f.cls || '').trim(),
      dueDay: f.dueDay || '', dueTime: f.dueTime || '',
      importance: f.importance || kind.importance, effort: f.effort || kind.effort,
      source: f.source || 'manual', done: false, doneAt: '', planDay: f.planDay || '',
      url: f.url || '', canvasId: f.canvasId || '', notes: f.notes || '',
    };
    Store.data.tasks.push(t);
    Store.save();
    return t;
  },
  update(id, f) { Object.assign(Tasks.get(id) || {}, f); Store.save(); },
  remove(id) { Store.data.tasks = Store.data.tasks.filter(t => t.id !== id); Store.save(); },
  toggle(id) {
    const t = Tasks.get(id);
    if (!t) return;
    t.done = !t.done;
    t.doneAt = t.done ? new Date().toISOString() : '';
    Store.save();
    if (t.done) Rewards.taskDone(t);
    return t;
  },
  clearDone() { Store.data.tasks = Store.data.tasks.filter(t => !t.done); Store.save(); },

  // Priority = how soon it's due + how important it is. Higher goes first.
  urgency(t) {
    if (!t.dueDay) return 0;
    const n = daysBetween(today(), t.dueDay);
    if (n < 0) return 10;
    if (n === 0) return 8;
    if (n === 1) return 6;
    if (n <= 3) return 4;
    if (n <= 7) return 2;
    return 1;
  },
  score(t) { return Tasks.urgency(t) + (t.importance || 2) * 2; },
  level(t) {
    const s = Tasks.score(t);
    return s >= 12 ? 'urgent' : s >= 9 ? 'soon' : 'later';
  },
  sorted(list) {
    const key = t => (t.dueDay || '9999-12-31') + (t.dueTime || '23:59');
    return list.slice().sort((a, b) => (a.done - b.done) || (Tasks.score(b) - Tasks.score(a)) || key(a).localeCompare(key(b)));
  },
  byDate(list) {
    const key = t => (t.dueDay || '9999-12-31') + (t.dueTime || '23:59');
    return list.slice().sort((a, b) => key(a).localeCompare(key(b)));
  },
  dueLabel(t) {
    if (!t.dueDay) return 'No due date';
    return relDay(t.dueDay) + (t.dueTime ? ' · ' + fmtTime(t.dueTime) : '');
  },

  classes() {
    const map = {};
    Tasks.all().forEach(t => {
      if (!t.cls) return;
      (map[t.cls] = map[t.cls] || { name: t.cls, tasks: [] }).tasks.push(t);
    });
    return Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
  },
  color(cls) {
    if (!cls) return 'var(--muted)';
    const map = Store.data.colors;
    if (!map[cls]) { map[cls] = CLASS_COLORS[Object.keys(map).length % CLASS_COLORS.length]; Store.save(); }
    return map[cls];
  },

  /* Workload: school tasks (ones with a class) land on the day they're planned for, or else the day they're due. */
  workDay(t) { return t.planDay || t.dueDay; },
  loadOn(day) {
    const list = Tasks.open().filter(t => t.cls && Tasks.workDay(t) === day);
    return { day, count: list.length, minutes: list.reduce((m, t) => m + (t.effort || 30), 0), tasks: list };
  },
  heavyDays(days = 14) {
    const out = [];
    for (let i = 0; i < days; i++) {
      const l = Tasks.loadOn(addDays(today(), i));
      if (l.minutes > 180 || l.count >= 4) out.push(l);
    }
    return out;
  },
  // For a heavy day: the least important task that could move to the lightest earlier day
  suggestMove(load) {
    const start = today();
    const movable = load.tasks.slice().sort((a, b) => a.importance - b.importance || a.effort - b.effort);
    for (const t of movable) {
      let best = null;
      for (let d = start; d < load.day; d = addDays(d, 1)) {
        const l = Tasks.loadOn(d);
        if (l.minutes + t.effort <= 180 && (!best || l.minutes < best.minutes)) best = l;
      }
      if (best) return { task: t, day: best.day };
    }
    return null;
  },

  tip(t) { return TIPS[kindOf(t.title).key] || TIPS.task; },

  // A spaced study plan for a test or quiz: a few short sessions on different days before it
  studyPlan(t) {
    const days = daysBetween(today(), t.dueDay);
    if (!t.dueDay || days < 1) return [];
    const offsets = days >= 6 ? [5, 3, 1] : days >= 3 ? [days - 1, 1] : [1];
    const steps = [
      { name: 'practice questions', text: 'List the topics and make 10 practice questions from your notes' },
      { name: 'practice test', text: 'Answer your practice questions without notes, then review the ones you missed' },
      { name: 'final review', text: 'Quick self-quiz on the hard parts, then get to bed on time' },
    ];
    const pick = offsets.length === 3 ? steps : offsets.length === 2 ? [{ name: 'practice questions', text: steps[0].text + ', then try them' }, steps[2]] : [steps[2]];
    return offsets.map((off, i) => ({ day: addDays(t.dueDay, -off), ...pick[i] }));
  },
  addPlan(t) {
    Tasks.studyPlan(t).forEach(s => Tasks.add({
      title: `Study for ${t.title} (${s.name})`, cls: t.cls, dueDay: s.day, effort: 25, importance: 2, notes: s.text, source: 'manual',
    }));
  },
  // Break a project or essay into steps with their own mini due dates
  addSteps(t) {
    const days = Math.max(1, daysBetween(today(), t.dueDay || addDays(today(), 7)));
    const steps = kindOf(t.title).key === 'essay'
      ? ['Write your main point in one sentence', 'Outline 3 reasons with evidence', 'Write the messy first draft', 'Revise and check the rubric']
      : ['List the parts and what each needs', 'Research and gather materials', 'Make the main part', 'Finish, practice and turn in'];
    steps.forEach((s, i) => Tasks.add({
      title: `${t.title}: ${s.toLowerCase()}`, cls: t.cls, importance: t.importance,
      dueDay: addDays(today(), Math.round(days * (i + 1) / steps.length)),
      effort: Math.round((t.effort || 90) / steps.length), source: 'manual',
    }));
  },

  sources(cls) { return (SOURCES.find(s => s.re.test(cls)) || SOURCES[SOURCES.length - 1]).links; },
};

const Events = {
  all() {
    const manualOnly = Store.data.settings.source === 'manual';
    return Store.data.events.filter(e => !(manualOnly && e.source === 'canvas'));
  },
  on(day) { return Events.all().filter(e => e.day === day).sort((a, b) => (a.time || '').localeCompare(b.time || '')); },
  add(f) { const e = { id: 'e' + uid(), title: f.title.trim(), day: f.day, time: f.time || '', kind: f.kind || 'event', source: f.source || 'manual' }; Store.data.events.push(e); Store.save(); return e; },
  remove(id) { Store.data.events = Store.data.events.filter(e => e.id !== id); Store.save(); },
};

/* Tips for getting started. Each "why" names the study it comes from. */
const TIPS = {
  test: {
    title: 'How to study for a test',
    steps: ['Write down the topics it covers (check the unit, your notes or the study guide).',
      'Make about 10 practice questions, close your notes and answer them.',
      'Study in 2 or 3 short sessions on different days instead of one big cram.',
      'Night before: a quick self-quiz, then sleep.'],
    why: 'Testing yourself beats rereading for remembering things later (Roediger & Karpicke, 2006), and spreading study over several days beats cramming (Cepeda et al., 2006).',
    action: 'plan',
  },
  quiz: {
    title: 'How to get ready for a quiz',
    steps: ['Skim what the quiz covers.', 'Cover your notes and explain each idea out loud or on paper.', 'Check what you missed and go over just those parts.'],
    why: 'Pulling information out of your memory helps it stick better than rereading it (Roediger & Karpicke, 2006).',
    action: 'plan',
  },
  essay: {
    title: 'How to start an essay',
    steps: ['Write your main point in one sentence. It doesn\'t have to be good yet.', 'List 3 reasons or pieces of evidence under it.',
      'Write a messy first draft fast, without fixing anything.', 'Next day: reread, fix, and check the rubric.'],
    why: 'Deciding exactly when and where you\'ll do the first step ("after dinner, at my desk, I\'ll write my main point") makes people much more likely to follow through (Gollwitzer & Sheeran, 2006, a review of 94 studies).',
    link: { label: 'Purdue OWL writing help', url: 'https://owl.purdue.edu/owl/' },
    action: 'steps',
  },
  project: {
    title: 'How to start a project',
    steps: ['List the parts (research, make, write, practice).', 'Give each part its own mini due date, working back from the real one.', 'Do the smallest part today.'],
    why: 'Making an if-then plan for each step ("if it\'s Tuesday after school, then I\'ll do the research") helps people get started and keep going (Gollwitzer & Sheeran, 2006).',
    action: 'steps',
  },
  reading: {
    title: 'How to get through a reading',
    steps: ['Look at the headings and questions first so you know what to look for.', 'After each section, look away and sum it up in one sentence.', 'Write down one question you still have.'],
    why: 'Recalling what you just read without looking helps it stick (Roediger & Karpicke, 2006).',
  },
  problems: {
    title: 'How to start a problem set',
    steps: ['Warm up with one problem you already know how to do.', 'Try each problem before looking at the examples.', 'Mark the ones you\'re stuck on and come back after the rest.'],
    why: 'Mixing different kinds of problems in practice helped students do better on a later test (Rohrer & Taylor, 2007).',
  },
  lab: {
    title: 'How to start a lab',
    steps: ['Reread the procedure and set up your data table first.', 'Write the easy parts first: title, question, hypothesis.', 'Do the results and analysis while the data is fresh.'],
    why: 'Starting with small, concrete steps and a set time to do them makes it easier to begin (Gollwitzer & Sheeran, 2006).',
  },
  discussion: {
    title: 'How to write a discussion post',
    steps: ['Read the prompt and pick one idea you agree or disagree with.', 'Write 3 sentences: your point, an example, a question for others.'],
    why: 'A tiny first step with a set time and place is easier to start (Gollwitzer & Sheeran, 2006).',
  },
  task: {
    title: 'How to get started',
    steps: ['Pick the first tiny step (2 to 5 minutes), like opening the file.', 'Set the clock for 15 minutes and do just that step.', 'Take a 5 minute break when it rings.'],
    why: 'Planning exactly when and where you\'ll start makes people more likely to follow through (Gollwitzer & Sheeran, 2006). The clock\'s Pomodoro mode does the 15 and 5 for you.',
  },
};

// Study websites by subject, matched on the class name
const SOURCES = [
  { re: /math|algebra|geometry|calc|trig|stat|precalc/i, links: [
    { label: 'Khan Academy: Math', url: 'https://www.khanacademy.org/math' },
    { label: 'Desmos graphing calculator', url: 'https://www.desmos.com/calculator' },
    { label: 'Paul\'s Online Math Notes', url: 'https://tutorial.math.lamar.edu' }] },
  { re: /english|lit|language arts|\bela\b|writing|composition/i, links: [
    { label: 'Purdue OWL (writing and citations)', url: 'https://owl.purdue.edu/owl/' },
    { label: 'LitCharts (book guides)', url: 'https://www.litcharts.com' }] },
  { re: /physics/i, links: [
    { label: 'The Physics Classroom', url: 'https://www.physicsclassroom.com' },
    { label: 'PhET simulations', url: 'https://phet.colorado.edu' },
    { label: 'Khan Academy: Science', url: 'https://www.khanacademy.org/science' }] },
  { re: /chem|bio|science|anatomy|earth|environmental/i, links: [
    { label: 'Khan Academy: Science', url: 'https://www.khanacademy.org/science' },
    { label: 'PhET simulations', url: 'https://phet.colorado.edu' }] },
  { re: /hist|gov|civics|econ|geograph|social|psych/i, links: [
    { label: 'Khan Academy: Humanities', url: 'https://www.khanacademy.org/humanities' },
    { label: 'Crash Course videos', url: 'https://thecrashcourse.com' },
    { label: 'Library of Congress primary sources', url: 'https://www.loc.gov' }] },
  { re: /spanish|español/i, links: [
    { label: 'SpanishDict (dictionary and conjugations)', url: 'https://www.spanishdict.com' },
    { label: 'WordReference', url: 'https://www.wordreference.com' }] },
  { re: /french|german|italian|chinese|mandarin|japanese|korean|latin/i, links: [
    { label: 'WordReference', url: 'https://www.wordreference.com' },
    { label: 'Quizlet flashcards', url: 'https://quizlet.com' }] },
  { re: /comput|coding|programming|\bcs\b|robot/i, links: [
    { label: 'Khan Academy: Computing', url: 'https://www.khanacademy.org/computing' },
    { label: 'freeCodeCamp', url: 'https://www.freecodecamp.org' }] },
  { re: /.*/, links: [
    { label: 'Khan Academy', url: 'https://www.khanacademy.org' },
    { label: 'Quizlet flashcards', url: 'https://quizlet.com' }] },
];

/* Canvas: reads the Canvas calendar feed (an .ics file) for assignments and events. */
const Canvas = {
  parse(text) {
    const lines = text.replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n');
    const items = [];
    let cur = null;
    for (const line of lines) {
      if (line === 'BEGIN:VEVENT') { cur = {}; continue; }
      if (line === 'END:VEVENT') { if (cur) items.push(cur); cur = null; continue; }
      if (!cur) continue;
      const i = line.indexOf(':');
      if (i < 0) continue;
      const [name, ...params] = line.slice(0, i).split(';');
      cur[name.toUpperCase()] = { value: line.slice(i + 1), params: params.join(';') };
    }
    const unescape = s => (s || '').replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');
    return items.map(ev => {
      const start = Canvas.date(ev.DTSTART);
      if (!start) return null;
      const uid = ev.UID ? ev.UID.value : '';
      const url = ev.URL ? ev.URL.value : '';
      let title = unescape(ev.SUMMARY && ev.SUMMARY.value).trim();
      let cls = '';
      const m = title.match(/^(.*)\s\[([^\]]+)\]$/);
      if (m) { title = m[1].trim(); cls = m[2].trim(); }
      return { uid, title, cls, url, day: start.day, time: start.time, assignment: /assignment/i.test(uid + ' ' + url) };
    }).filter(Boolean);
  },
  date(field) {
    if (!field) return null;
    const m = field.value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
    if (!m) return null;
    const [, y, mo, d, h, mi, , z] = m;
    if (!h) return { day: `${y}-${mo}-${d}`, time: '' };
    const dt = z ? new Date(Date.UTC(+y, mo - 1, +d, +h, +mi)) : new Date(+y, mo - 1, +d, +h, +mi);
    return { day: dayKey(dt), time: pad(dt.getHours()) + ':' + pad(dt.getMinutes()) };
  },
  // Adds new assignments, updates changed ones and keeps your checkmarks and edits
  merge(items) {
    const start = today();
    const seen = new Set();
    let added = 0, updated = 0;
    items.forEach(it => {
      if (it.day < start) return;
      seen.add(it.uid);
      if (it.assignment) {
        const t = Store.data.tasks.find(x => x.canvasId === it.uid);
        if (t) {
          if (t.dueDay !== it.day || t.dueTime !== it.time || t.title !== it.title) updated++;
          Object.assign(t, { title: it.title, cls: it.cls, dueDay: it.day, dueTime: it.time, url: it.url });
        } else {
          Tasks.add({ title: it.title, cls: it.cls, dueDay: it.day, dueTime: it.time, url: it.url, canvasId: it.uid, source: 'canvas' });
          added++;
        }
      } else {
        const e = Store.data.events.find(x => x.canvasId === it.uid);
        if (e) Object.assign(e, { title: it.title + (it.cls ? ` (${it.cls})` : ''), day: it.day, time: it.time });
        else Store.data.events.push({ id: 'e' + uid(), canvasId: it.uid, title: it.title + (it.cls ? ` (${it.cls})` : ''), day: it.day, time: it.time, kind: 'event', source: 'canvas' });
      }
    });
    // Upcoming Canvas assignments that left the feed were removed or moved by the teacher
    Store.data.tasks = Store.data.tasks.filter(t => t.source !== 'canvas' || t.done || seen.has(t.canvasId) || (t.dueDay && t.dueDay < start));
    Store.data.events = Store.data.events.filter(e => e.source !== 'canvas' || seen.has(e.canvasId) || e.day < start);
    Store.data.canvas.lastSync = new Date().toISOString();
    Store.save();
    return { added, updated, total: items.filter(it => it.assignment && it.day >= start).length };
  },
  feedUrl(url) { return url.trim().replace(/^webcal:\/\//i, 'https://'); },
  // Try to read the feed straight from Canvas. Most schools block this, so it falls back to a file upload.
  async sync() {
    const url = Canvas.feedUrl(Store.data.canvas.feedUrl || '');
    if (!url) throw new Error('nourl');
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error('http');
    const text = await res.text();
    if (!/BEGIN:VCALENDAR/.test(text)) throw new Error('notics');
    Store.data.canvas.direct = true;
    return Canvas.merge(Canvas.parse(text));
  },
  async importFile(file) {
    const text = await file.text();
    if (!/BEGIN:VCALENDAR/.test(text)) throw new Error('notics');
    return Canvas.merge(Canvas.parse(text));
  },
  removeAll() {
    Store.data.tasks = Store.data.tasks.filter(t => t.source !== 'canvas');
    Store.data.events = Store.data.events.filter(e => e.source !== 'canvas');
    Store.data.canvas = { feedUrl: '', lastSync: '', direct: false };
    Store.save();
  },
};

/* Sample classes, so the app has something in it before Canvas is connected */
const Sample = {
  has() { return Store.data.tasks.some(t => t.source === 'sample'); },
  add() {
    const d = n => addDays(today(), n);
    [
      ['Unit 4 quiz: quadratics', 'Algebra 2', 2, '08:00'], ['Practice problems 4.3', 'Algebra 2', 1, '23:59'], ['Unit 4 test', 'Algebra 2', 8, '08:00'],
      ['Read chapters 5-6 of the novel', 'English 10', 1, '23:59'], ['Persuasive essay draft', 'English 10', 4, '23:59'], ['Discussion post: chapter 6', 'English 10', 3, '23:59'],
      ['Cell membrane lab report', 'Biology', 3, '23:59'], ['Chapter 7 reading notes', 'Biology', 3, '23:59'], ['Cells test', 'Biology', 10, '09:00'],
      ['Primary source worksheet', 'World History', 3, '23:59'], ['Industrial Revolution project', 'World History', 12, '23:59'],
      ['Vocab quiz: la comida', 'Spanish 2', 5, '10:00'], ['Workbook pages 44-45', 'Spanish 2', 1, '23:59'],
    ].forEach(([title, cls, n, time]) => Tasks.add({ title, cls, dueDay: d(n), dueTime: time, source: 'sample' }));
    Events.add({ title: 'No school: teacher planning day', day: d(6), kind: 'important', source: 'sample' });
    Events.add({ title: 'Club meeting', day: d(2), time: '15:30', source: 'sample' });
  },
  remove() {
    Store.data.tasks = Store.data.tasks.filter(t => t.source !== 'sample');
    Store.data.events = Store.data.events.filter(e => e.source !== 'sample');
    Store.save();
  },
};
