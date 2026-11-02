/* The clock: a plain timer, or Pomodoro mode that keeps switching between work and break.
   It keeps counting while the popup is closed, and after a page reload. */

const Timer = {
  s() {
    if (!Store.data.timer) {
      Store.data.timer = { mode: 'timer', phase: 'work', length: 15 * 60, remaining: 15 * 60, endAt: 0, running: false, rounds: 0, timerLen: 15 * 60 };
    }
    return Store.data.timer;
  },
  left() {
    const s = Timer.s();
    return s.running ? Math.max(0, (s.endAt - Date.now()) / 1000) : s.remaining;
  },
  phaseLength(phase) {
    const st = Store.data.settings;
    return (phase === 'break' ? st.pomoBreak : st.pomoWork) * 60;
  },
  start() {
    const s = Timer.s();
    if (s.running) return;
    if (s.remaining <= 0) s.remaining = s.length;
    s.endAt = Date.now() + s.remaining * 1000;
    s.running = true;
    Store.save();
    Chime.unlock();
  },
  pause() {
    const s = Timer.s();
    if (!s.running) return;
    s.remaining = Timer.left();
    s.running = false;
    Store.save();
  },
  toggle() { Timer.s().running ? Timer.pause() : Timer.start(); },
  restart() {
    const s = Timer.s();
    s.remaining = s.length;
    if (s.running) s.endAt = Date.now() + s.length * 1000;
    Store.save();
  },
  adjust(sec) {
    const s = Timer.s();
    const rem = Math.max(0, Math.round(Timer.left() + sec));
    if (s.running) {
      s.endAt = Date.now() + rem * 1000;
      s.length = Math.max(s.length, rem);
    } else {
      s.remaining = rem;
      if (s.mode === 'timer') s.length = s.timerLen = Math.max(rem, 0);
      else s.length = Math.max(s.length, rem);
    }
    Store.save();
  },
  setMode(mode) {
    const s = Timer.s();
    s.mode = mode;
    s.running = false;
    s.phase = 'work';
    s.rounds = 0;
    s.length = s.remaining = mode === 'pomo' ? Timer.phaseLength('work') : s.timerLen;
    Store.save();
  },
  // Start a Pomodoro work session right away (used by tips)
  focus() {
    Timer.setMode('pomo');
    Timer.start();
  },
  // Settings changed the Pomodoro lengths: apply them if this phase hasn't started
  settingsChanged() {
    const s = Timer.s();
    if (s.mode === 'pomo' && !s.running && s.remaining === s.length) {
      s.length = s.remaining = Timer.phaseLength(s.phase);
      Store.save();
    }
  },
  tick() {
    const s = Timer.s();
    if (!s.running || Timer.left() > 0) return;
    if (s.mode === 'pomo') {
      if (s.phase === 'work') s.rounds++;
      s.phase = s.phase === 'work' ? 'break' : 'work';
      s.length = Timer.phaseLength(s.phase);
      s.endAt = Date.now() + s.length * 1000;
      Store.save();
      Chime.play(s.phase === 'break' ? 2 : 3);
      App.alert(s.phase === 'break' ? 'Break time!' : 'Back to work',
        s.phase === 'break' ? `Nice focus. ${Store.data.settings.pomoBreak} minute break starts now.` : `${Store.data.settings.pomoWork} minutes of work. You've got this.`);
    } else {
      s.running = false;
      s.remaining = 0;
      Store.save();
      Chime.play(3);
      App.alert('Time\'s up!', 'Your timer finished.');
    }
  },
  fmt(sec) {
    sec = Math.ceil(sec);
    const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), x = sec % 60;
    return (h ? h + ':' + pad(m) : m) + ':' + pad(x);
  },
};

/* A soft chime made in the browser, no sound files needed */
const Chime = {
  ctx: null,
  unlock() {
    try { Chime.ctx = Chime.ctx || new (window.AudioContext || window.webkitAudioContext)(); Chime.ctx.resume(); } catch (e) {}
  },
  play(times = 1) {
    if (!Store.data.settings.sound) return;
    Chime.unlock();
    const c = Chime.ctx;
    if (!c) return;
    for (let i = 0; i < times; i++) {
      [880, 1320].forEach((f, j) => {
        const o = c.createOscillator(), g = c.createGain();
        const t = c.currentTime + i * 0.35 + j * 0.08;
        o.frequency.value = f;
        o.type = 'sine';
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
        o.connect(g).connect(c.destination);
        o.start(t);
        o.stop(t + 0.65);
      });
    }
  },
  pop() {
    if (!Store.data.settings.sound) return;
    Chime.unlock();
    const c = Chime.ctx;
    if (!c) return;
    const o = c.createOscillator(), g = c.createGain(), t = c.currentTime;
    o.frequency.setValueAtTime(520, t);
    o.frequency.exponentialRampToValueAtTime(1040, t + 0.12);
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + 0.22);
  },
};
