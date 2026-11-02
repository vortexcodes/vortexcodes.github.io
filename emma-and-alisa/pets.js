/* Pixel pets: the sprites, the reward odds, and the little critters that walk around the screen.
   Each sprite is a 16x16 grid of letters. Each letter is a color from the breed's palette:
   o outline, b fur, s belly, d ears/patches, p pink, e eyes, w eye shine, k beak/shell pattern. */

const SPRITE_BODY = [
  '..oobbbbbbbboo..',
  '.obbssssssssbbo.',
  '.obssssssssssbo.',
  '.obssssssssssbo.',
  '.obbbbbbbbbbbbo.',
];
const FEET = ['..oooo....oooo..', '...oooo..oooo...'];

const SHAPES = {
  cat: [
    '................',
    '..o..........o..',
    '.opo........opo.',
    '.obpoooooooopbo.',
    '.obbbbbbbbbbbbo.',
    'obbbbbbbbbbbbbbo',
    'obbewbbbbbbewbbo',
    'obbeebbbbbbeebbo',
    'obpbbbbppbbbbpbo',
    '.obbbbbbbbbbbbo.',
  ],
  dog: [
    '................',
    '................',
    '....oooooooo....',
    '..oobbbbbbbboo..',
    '.oddobbbbbboddo.',
    'odddbbbbbbbbdddo',
    'oddbewbbbbewbddo',
    'oddbeebbbbeebddo',
    '.oddbbboobbbddo.',
    '..odbbbppbbbdo..',
  ],
  bunny: [
    '...oo......oo...',
    '..obpo....opbo..',
    '..obpo....opbo..',
    '..obpo....opbo..',
    '..obpoooooopbo..',
    '.obbbbbbbbbbbbo.',
    'obbewbbbbbbewbbo',
    'obbeebbbbbbeebbo',
    'obpbbbbppbbbbpbo',
    '.obbbbbwwbbbbbo.',
  ],
  hamster: [
    '................',
    '................',
    '..ooo......ooo..',
    '.oppooooooooppo.',
    '.obbbbbbbbbbbbo.',
    'obbbbbbbbbbbbbbo',
    'obbewbbbbbbewbbo',
    'obbeebbbbbbeebbo',
    'ospbbbbppbbbbpso',
    'osssbbbbbbbbssso',
  ],
  guinea: [
    '................',
    '................',
    '................',
    '....oooooooo....',
    '..oodbbbbbbdoo..',
    '.oddbbbbbbbbddo.',
    'oddewbbbbbbewbbo',
    'oddeebbbbbbeebbo',
    'odbbbbbppbbbbbbo',
    '.obbbbbbbbbbbdo.',
  ],
  bird: [
    '................',
    '.......oo.......',
    '......obbo......',
    '....oooooooo....',
    '...obbbbbbbbo...',
    '..obbbbbbbbbbo..',
    '..obewbbbbewbo..',
    '..obeebbbbeebo..',
    '..obbbbkkbbbbo..',
    '..osbbbbkbbbbso.',
  ],
  hedgehog: [
    '................',
    '..o.o.o..o.o.o..',
    '.oddddddddddddo.',
    'oddddddddddddddo',
    'oddddbbbbbbddddo',
    'odddbbbbbbbbdddo',
    'oddbewbbbbewbddo',
    'oddbeebbbbeebddo',
    'oddbbbbeebbbbddo',
    '.oddpbbbbbbpddo.',
  ],
  turtle: [
    '................',
    '................',
    '......oooo......',
    '.....obbbbo.....',
    '....obebbebo....',
    '....obbppbbo....',
    '.....obbbbo.....',
    '...oooooooooo...',
    '..odddkddkdddo..',
    '.oddkkddddkkddo.',
  ],
  axolotl: [
    '................',
    '................',
    '....oooooooo....',
    'od.obbbbbbbbo.do',
    '.dobbbbbbbbbbod.',
    'ddobewbbbbewbodd',
    '.dobeebbbbeebod.',
    'odobpbbbbbbpbodo',
    '..obbboooobbbo..',
    '...obbbbbbbbo...',
  ],
};

// Body rows that differ from the shared body
const BODIES = {
  bird: ['.osbssssssssbso.', 'ossbssssssssbsso', '.osbssssssssbso.', '..obbssssssbbo..', '...oobbbbbboo...'],
  hedgehog: ['..ooddbbbbddoo..', '.oddssssssssddo.', '.odssssssssssdo.', '.odssssssssssdo.', '.oddddddddddddo.'],
  turtle: ['.odddkddddkdddo.', 'obddddkkkkddddbo', 'obssssssssssssbo', '.oossssssssssoo.', '..obbo....obbo..'],
};
const BIRD_FEET = ['.....k....k.....', '......k..k......'];

function spriteRows(species, frame) {
  const head = SHAPES[species];
  const body = BODIES[species] || SPRITE_BODY;
  const feet = species === 'bird' ? BIRD_FEET : FEET;
  return head.concat(body, [feet[frame]]);
}

// Breeds: a species plus a palette. tier: 0 common, 1 uncommon, 2 rare, 3 epic, 4 legendary.
const BREEDS = {
  'cat-tabby':   { species: 'cat', name: 'Tabby Cat', tier: 0, pal: { o: '#4a2f1e', b: '#d69552', s: '#f6dcb4', p: '#f4a0b0', e: '#2b1d16', w: '#fff' } },
  'cat-black':   { species: 'cat', name: 'Black Cat', tier: 0, pal: { o: '#121218', b: '#33333f', s: '#4c4c5c', p: '#f39ab0', e: '#f2cc3a', w: '#fff' } },
  'cat-orange':  { species: 'cat', name: 'Orange Cat', tier: 0, pal: { o: '#6b3a1a', b: '#f59a45', s: '#ffe2bf', p: '#f7a3a8', e: '#2b1d16', w: '#fff' } },
  'cat-white':   { species: 'cat', name: 'White Cat', tier: 0, pal: { o: '#6f6f80', b: '#fbfbfd', s: '#ecebf3', p: '#f7a8bb', e: '#3a7bd5', w: '#fff' } },
  'cat-gray':    { species: 'cat', name: 'Gray Cat', tier: 0, pal: { o: '#3a4049', b: '#9ea7b1', s: '#dfe4e9', p: '#f4a5b4', e: '#2a6b3a', w: '#fff' } },
  'dog-golden':  { species: 'dog', name: 'Golden Pup', tier: 0, pal: { o: '#5a3818', b: '#e8b062', d: '#c4843a', s: '#f8e2b8', p: '#f28da0', e: '#2a1a10', w: '#fff' } },
  'dog-lab':     { species: 'dog', name: 'Black Lab', tier: 0, pal: { o: '#0c0a0a', b: '#3d3636', d: '#262121', s: '#5a5050', p: '#f08aa0', e: '#0a0707', w: '#fff' } },
  'dog-beagle':  { species: 'dog', name: 'Beagle', tier: 0, pal: { o: '#4a2a12', b: '#f3e7d8', d: '#9a5a2a', s: '#ffffff', p: '#f28da0', e: '#2a1a10', w: '#fff' } },
  'dog-dalmatian': { species: 'dog', name: 'Dalmatian', tier: 0, pal: { o: '#2b2b2b', b: '#ffffff', d: '#262626', s: '#f2f2f2', p: '#f28da0', e: '#1a1a1a', w: '#fff' } },
  'bunny-white': { species: 'bunny', name: 'Snow Bunny', tier: 1, pal: { o: '#7a6f78', b: '#ffffff', s: '#f6eef1', p: '#f7a7bb', e: '#d64570', w: '#fff' } },
  'bunny-brown': { species: 'bunny', name: 'Cocoa Bunny', tier: 1, pal: { o: '#4d3220', b: '#b8875b', s: '#eedcc6', p: '#f4a6b4', e: '#2a1a10', w: '#fff' } },
  'hamster-golden': { species: 'hamster', name: 'Golden Hamster', tier: 1, pal: { o: '#6b3f17', b: '#eaa85c', s: '#fff1dd', p: '#f6a1ad', e: '#24150c', w: '#fff' } },
  'hamster-white':  { species: 'hamster', name: 'Pearl Hamster', tier: 1, pal: { o: '#7d7480', b: '#f7f4f2', s: '#ffffff', p: '#f6a1ad', e: '#24150c', w: '#fff' } },
  'guinea-tricolor': { species: 'guinea', name: 'Tricolor Guinea Pig', tier: 2, pal: { o: '#4a2c16', b: '#ffffff', d: '#c8702e', s: '#f3e7da', p: '#f4a6b4', e: '#1d120a', w: '#fff' } },
  'guinea-tan':   { species: 'guinea', name: 'Caramel Guinea Pig', tier: 2, pal: { o: '#4a2c16', b: '#e6c49a', d: '#3a281c', s: '#f6e6cf', p: '#f4a6b4', e: '#1d120a', w: '#fff' } },
  'bird-green':   { species: 'bird', name: 'Green Budgie', tier: 2, pal: { o: '#2d5a1d', b: '#83d65f', s: '#f3e95c', k: '#f0a23a', e: '#152a0d', w: '#fff' } },
  'bird-blue':    { species: 'bird', name: 'Blue Budgie', tier: 2, pal: { o: '#1d4a73', b: '#62b6f2', s: '#ffffff', k: '#f0a23a', e: '#0e2236', w: '#fff' } },
  'dog-husky':    { species: 'dog', name: 'Husky', tier: 2, pal: { o: '#2e333a', b: '#dfe4ea', d: '#5c6674', s: '#ffffff', p: '#f28da0', e: '#3b9cff', w: '#fff' } },
  'cat-siamese':  { species: 'cat', name: 'Siamese Cat', tier: 3, pal: { o: '#3b2a22', b: '#f3e4cc', s: '#fff8ec', p: '#6b4a3a', e: '#3b8cf2', w: '#fff' } },
  'hedgehog':     { species: 'hedgehog', name: 'Hedgehog', tier: 3, pal: { o: '#3a2a1e', b: '#f3ddc2', d: '#76593f', s: '#ecd3b2', p: '#f3a6a6', e: '#1a1a1a', w: '#fff' } },
  'turtle':       { species: 'turtle', name: 'Box Turtle', tier: 3, pal: { o: '#1f3d22', b: '#a3d77f', d: '#45964f', k: '#2c6b37', s: '#f4e3a1', p: '#e9898f', e: '#14240f', w: '#fff' } },
  'axolotl':      { species: 'axolotl', name: 'Axolotl', tier: 4, pal: { o: '#a0365e', b: '#ffb8cc', d: '#ff6f9f', s: '#ffdbe5', p: '#ff8fb1', e: '#2a1a22', w: '#fff' } },
  'cat-cosmic':   { species: 'cat', name: 'Cosmic Cat', tier: 4, pal: { o: '#1c1640', b: '#5a46b0', s: '#8f7fe6', p: '#ff9ad5', e: '#fff7a8', w: '#fff' } },
};

const TIERS = [
  { name: 'Common', color: '#8a94a3' },
  { name: 'Uncommon', color: '#2f9e44' },
  { name: 'Rare', color: '#1c7ed6' },
  { name: 'Epic', color: '#9c36b5' },
  { name: 'Legendary', color: '#e8590c' },
];
// Chance (in %) of each tier for each goal level. Harder goals, rarer pets.
const ODDS = {
  easy:   [70, 25, 5, 0, 0],
  medium: [35, 40, 20, 5, 0],
  hard:   [10, 25, 35, 22, 8],
};
const STARTERS = { cat: ['cat-tabby', 'cat-black', 'cat-orange'], dog: ['dog-golden', 'dog-lab', 'dog-beagle'] };
const PET_NAMES = ['Mochi', 'Biscuit', 'Pickle', 'Bean', 'Noodle', 'Peanut', 'Clover', 'Muffin', 'Sprout', 'Tofu',
  'Pudding', 'Waffles', 'Pip', 'Marshmallow', 'Boba', 'Pebble', 'Maple', 'Nugget', 'Ziggy', 'Dumpling', 'Olive', 'Honey'];

const spriteCache = {};
function spriteURL(breedId, frame = 0) {
  const key = breedId + frame;
  if (spriteCache[key]) return spriteCache[key];
  const breed = BREEDS[breedId] || BREEDS['cat-tabby'];
  const rows = spriteRows(breed.species, frame);
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const g = c.getContext('2d');
  rows.forEach((row, y) => {
    for (let x = 0; x < 16; x++) {
      const color = breed.pal[row[x]];
      if (!color) continue;
      g.fillStyle = color;
      g.fillRect(x, y, 1, 1);
    }
  });
  return (spriteCache[key] = c.toDataURL());
}

const Pets = {
  pickTier(level) {
    const odds = ODDS[level] || ODDS.medium;
    let roll = Math.random() * 100;
    for (let i = 0; i < odds.length; i++) { roll -= odds[i]; if (roll < 0) return i; }
    return 0;
  },
  // A new random pet for finishing a goal at this level
  award(level) {
    const tier = Pets.pickTier(level);
    const choices = Object.keys(BREEDS).filter(id => BREEDS[id].tier === tier);
    const breed = choices[Math.floor(Math.random() * choices.length)];
    return Pets.adopt(breed);
  },
  adopt(breed, name) {
    const pet = { id: uid(), breed, name: name || Pets.randomName(), shown: true, got: dayKey() };
    Store.data.pets.push(pet);
    Store.save();
    PetLayer.sync();
    return pet;
  },
  randomName() {
    const used = new Set(Store.data.pets.map(p => p.name));
    const free = PET_NAMES.filter(n => !used.has(n));
    const list = free.length ? free : PET_NAMES;
    return list[Math.floor(Math.random() * list.length)];
  },
  img(breed, size = 48, cls = '') {
    return `<img class="pet-img ${cls}" src="${spriteURL(breed)}" width="${size}" height="${size}" alt="">`;
  },
};

/* Goals: pick one when you join (and change it in Settings). Reaching it earns a random pet. */
const GOALS = {
  login: { label: 'Open the app every day', short: 'days in a row', targets: { easy: 7, medium: 14, hard: 30 } },
  streak: { label: 'Finish a task every day', short: 'days in a row', targets: { easy: 5, medium: 10, hard: 21 } },
  tasks: { label: 'Finish tasks', short: 'tasks done', targets: { easy: 10, medium: 25, hard: 50 } },
};
const LEVELS = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

const Rewards = {
  goal() { return GOALS[Store.data.goal.type] || GOALS.login; },
  target() { return Rewards.goal().targets[Store.data.goal.level] || 14; },
  status() {
    const count = Math.min(Store.data.progress.count, Rewards.target());
    return { count, target: Rewards.target(), pct: count / Rewards.target() };
  },
  describe() {
    const g = Store.data.goal;
    const n = Rewards.target();
    if (g.type === 'login') return `Open the app ${n} days in a row`;
    if (g.type === 'streak') return `Finish at least one task ${n} days in a row`;
    return `Finish ${n} tasks`;
  },
  setGoal(type, level) {
    Store.data.goal = { type, level };
    const p = Store.data.progress;
    p.count = type === 'login' ? (p.loginDay === today() ? 1 : 0) : type === 'streak' ? (p.taskDay === today() ? 1 : 0) : 0;
    Store.save();
  },
  // Called when the app opens and when the day changes
  visit() {
    const p = Store.data.progress, t = today(), yest = addDays(t, -1);
    if (p.loginDay !== t) {
      p.loginStreak = p.loginDay === yest ? p.loginStreak + 1 : 1;
      p.loginDay = t;
      if (Store.data.goal.type === 'login') p.count = p.loginStreak === 1 ? 1 : p.count + 1;
    }
    if (p.taskDay && p.taskDay < yest) {
      p.taskStreak = 0;
      if (Store.data.goal.type === 'streak') p.count = 0;
    }
    Store.save();
    Rewards.check();
  },
  taskDone(task) {
    const p = Store.data.progress, t = today();
    if (!p.credited[task.id]) {
      p.credited[task.id] = 1;
      if (Store.data.goal.type === 'tasks') p.count++;
    }
    if (p.taskDay !== t) {
      p.taskStreak = p.taskDay === addDays(t, -1) ? p.taskStreak + 1 : 1;
      p.taskDay = t;
      if (Store.data.goal.type === 'streak') p.count = p.taskStreak === 1 ? 1 : p.count + 1;
    }
    Store.save();
    PetLayer.cheer();
    Rewards.check();
  },
  check() {
    const p = Store.data.progress;
    if (p.count < Rewards.target()) return;
    p.count = 0;
    p.goalsDone++;
    Store.save();
    const pet = Pets.award(Store.data.goal.level);
    App.celebrate(pet);
  },
};

/* The pets walking around the home screen */
const PetLayer = {
  el: null,
  sprites: {},
  last: 0,
  init() {
    PetLayer.el = document.getElementById('pets');
    PetLayer.sync();
    requestAnimationFrame(PetLayer.tick);
    window.addEventListener('resize', () => Object.values(PetLayer.sprites).forEach(PetLayer.clamp));
  },
  bounds() {
    return { w: window.innerWidth - 56, h: window.innerHeight - 56, top: 72 };
  },
  sync() {
    if (!PetLayer.el) return;
    const shown = Store.data.pets.filter(p => p.shown);
    const ids = new Set(shown.map(p => p.id));
    for (const id in PetLayer.sprites) {
      if (!ids.has(id)) { PetLayer.sprites[id].el.remove(); delete PetLayer.sprites[id]; }
    }
    shown.forEach(p => {
      let s = PetLayer.sprites[p.id];
      if (!s) {
        const b = PetLayer.bounds();
        const el = document.createElement('button');
        el.className = 'pet';
        el.innerHTML = `<img src="${spriteURL(p.breed)}" alt=""><span class="pet-tag"></span>`;
        el.addEventListener('click', () => PetLayer.poke(p.id));
        PetLayer.el.appendChild(el);
        s = PetLayer.sprites[p.id] = {
          id: p.id, el, breed: p.breed, x: b.w / 2, y: b.h / 2,
          tx: 0, ty: 0, speed: 28, wait: 1 + Math.random() * 3, frame: 0, ft: 0, face: 1,
        };
        PetLayer.pickTarget(s, true);
        s.x = s.tx;
        s.y = s.ty;
        PetLayer.pickTarget(s);
      }
      s.breed = p.breed;
      s.el.querySelector('.pet-tag').textContent = p.name;
      s.el.setAttribute('aria-label', p.name + ', ' + BREEDS[p.breed].name);
      s.el.classList.toggle('legendary', BREEDS[p.breed].tier === 4);
    });
  },
  // Somewhere new to walk to, not on top of a widget (so pets never sit on your to-do list)
  pickTarget(s, far) {
    const b = PetLayer.bounds();
    const blocks = [...document.querySelectorAll('.widget')].map(el => el.getBoundingClientRect());
    for (let i = 0; i < 12; i++) {
      s.tx = far ? Math.random() * b.w : Math.min(b.w, Math.max(0, s.x + (Math.random() - 0.5) * b.w * 0.7));
      s.ty = far ? b.top + Math.random() * (b.h - b.top) : Math.min(b.h, Math.max(b.top, s.y + (Math.random() - 0.5) * b.h * 0.7));
      const hit = blocks.some(r => s.tx + 48 > r.left - 8 && s.tx < r.right + 8 && s.ty + 48 > r.top - 8 && s.ty < r.bottom + 8);
      if (!hit) return;
    }
  },
  clamp(s) {
    const b = PetLayer.bounds();
    s.x = Math.min(b.w, Math.max(0, s.x));
    s.y = Math.min(b.h, Math.max(b.top, s.y));
    PetLayer.pickTarget(s);
  },
  tick(now) {
    const dt = Math.min(0.1, (now - PetLayer.last) / 1000 || 0);
    PetLayer.last = now;
    Object.values(PetLayer.sprites).forEach(s => {
      let moving = false;
      if (s.wait > 0) {
        s.wait -= dt;
      } else {
        const dx = s.tx - s.x, dy = s.ty - s.y, dist = Math.hypot(dx, dy);
        if (dist < 2) {
          s.wait = 1.5 + Math.random() * 5;
          s.speed = 28;
          PetLayer.pickTarget(s);
        } else {
          const step = Math.min(dist, s.speed * dt);
          s.x += dx / dist * step;
          s.y += dy / dist * step;
          if (Math.abs(dx) > 1) s.face = dx < 0 ? -1 : 1;
          moving = true;
        }
      }
      s.ft += dt;
      if (moving && s.ft > 0.18) { s.ft = 0; s.frame = 1 - s.frame; }
      if (!moving) s.frame = 0;
      const img = s.el.firstChild;
      const src = spriteURL(s.breed, s.frame);
      if (img.getAttribute('src') !== src) img.setAttribute('src', src);
      s.el.style.transform = `translate(${s.x}px, ${s.y}px)`;
      img.style.transform = `scaleX(${s.face})`;
      s.el.classList.toggle('walking', moving);
    });
    requestAnimationFrame(PetLayer.tick);
  },
  // Clicked: a hop, a heart, then a quick dash somewhere new
  poke(id) {
    const s = PetLayer.sprites[id];
    if (!s) return;
    PetLayer.hop(s);
    s.wait = 0.45;
    s.speed = 110;
    PetLayer.pickTarget(s, true);
  },
  hop(s) {
    s.el.classList.remove('hop');
    void s.el.offsetWidth;
    s.el.classList.add('hop');
    const heart = document.createElement('span');
    heart.className = 'pet-heart';
    heart.textContent = '♥';
    s.el.appendChild(heart);
    setTimeout(() => heart.remove(), 900);
  },
  // A random pet celebrates (used when a task gets checked off)
  cheer() {
    const all = Object.values(PetLayer.sprites);
    if (all.length) PetLayer.hop(all[Math.floor(Math.random() * all.length)]);
  },
  find(id) {
    const s = PetLayer.sprites[id];
    if (!s) return false;
    s.wait = 3;
    s.el.classList.remove('found');
    void s.el.offsetWidth;
    s.el.classList.add('found');
    setTimeout(() => s.el.classList.remove('found'), 3000);
    return true;
  },
};
