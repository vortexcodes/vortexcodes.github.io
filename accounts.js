// Simple account system for vortex1.dev
// Stores accounts in localStorage - not secure, just for tracking who owns what gear

var Accounts = (function() {
  var ACCOUNTS_KEY = 'vortex_accounts';
  var SESSION_KEY = 'vortex_session';

  function getAll() {
    return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '{}');
  }

  function saveAll(accounts) {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  }

  function currentUser() {
    return localStorage.getItem(SESSION_KEY) || null;
  }

  function register(username, password) {
    username = username.trim().toLowerCase();
    if (!username || !password) return { ok: false, error: 'Username and password required' };
    if (username.length < 2) return { ok: false, error: 'Username must be at least 2 characters' };
    if (password.length < 3) return { ok: false, error: 'Password must be at least 3 characters' };
    if (!/^[a-z0-9_]+$/.test(username)) return { ok: false, error: 'Username: letters, numbers, underscores only' };

    var accounts = getAll();
    if (accounts[username]) return { ok: false, error: 'Username already taken' };

    accounts[username] = {
      password: password,
      gear: { tops: [], pants: [], head: [], skis: [], safety: [], misc: [] },
      created: new Date().toISOString()
    };
    saveAll(accounts);
    localStorage.setItem(SESSION_KEY, username);
    return { ok: true, user: username };
  }

  function login(username, password) {
    username = username.trim().toLowerCase();
    if (!username || !password) return { ok: false, error: 'Username and password required' };

    var accounts = getAll();
    if (!accounts[username]) return { ok: false, error: 'Account not found' };
    if (accounts[username].password !== password) return { ok: false, error: 'Wrong password' };

    localStorage.setItem(SESSION_KEY, username);
    return { ok: true, user: username };
  }

  function logout() {
    localStorage.removeItem(SESSION_KEY);
  }

  function getGear(username) {
    username = username || currentUser();
    if (!username) return null;
    var accounts = getAll();
    if (!accounts[username]) return null;
    return accounts[username].gear;
  }

  function saveGear(gear, username) {
    username = username || currentUser();
    if (!username) return false;
    var accounts = getAll();
    if (!accounts[username]) return false;
    accounts[username].gear = gear;
    saveAll(accounts);
    return true;
  }

  function getProfile(username) {
    username = username || currentUser();
    if (!username) return null;
    var accounts = getAll();
    if (!accounts[username]) return null;
    var acct = accounts[username];
    var gearCount = 0;
    var gear = acct.gear || {};
    ['tops', 'pants', 'head', 'skis', 'safety', 'misc'].forEach(function(k) {
      gearCount += (gear[k] || []).length;
    });
    return {
      username: username,
      created: acct.created,
      gearCount: gearCount,
      gear: gear
    };
  }

  function listUsers() {
    var accounts = getAll();
    return Object.keys(accounts).map(function(username) {
      var acct = accounts[username];
      var gear = acct.gear || {};
      var gearCount = 0;
      ['tops', 'pants', 'head', 'skis', 'safety', 'misc'].forEach(function(k) {
        gearCount += (gear[k] || []).length;
      });
      return { username: username, gearCount: gearCount, created: acct.created };
    });
  }

  function getConnections(username) {
    username = username || currentUser();
    if (!username) return [];
    var accounts = getAll();
    if (!accounts[username]) return [];
    return accounts[username].connections || [];
  }

  function addConnection(targetUser) {
    var user = currentUser();
    if (!user || !targetUser) return { ok: false, error: 'Must be logged in' };
    if (user === targetUser) return { ok: false, error: 'Cannot connect with yourself' };
    var accounts = getAll();
    if (!accounts[user]) return { ok: false, error: 'Account not found' };
    if (!accounts[targetUser]) return { ok: false, error: 'Target account not found' };
    if (!accounts[user].connections) accounts[user].connections = [];
    if (!accounts[targetUser].connections) accounts[targetUser].connections = [];
    if (accounts[user].connections.indexOf(targetUser) >= 0) return { ok: false, error: 'Already connected' };
    accounts[user].connections.push(targetUser);
    accounts[targetUser].connections.push(user);
    saveAll(accounts);
    return { ok: true };
  }

  function removeConnection(targetUser) {
    var user = currentUser();
    if (!user) return false;
    var accounts = getAll();
    if (!accounts[user]) return false;
    if (!accounts[user].connections) return false;
    accounts[user].connections = accounts[user].connections.filter(function(c) { return c !== targetUser; });
    if (accounts[targetUser] && accounts[targetUser].connections) {
      accounts[targetUser].connections = accounts[targetUser].connections.filter(function(c) { return c !== user; });
    }
    saveAll(accounts);
    return true;
  }

  function getConnectionGear() {
    var user = currentUser();
    if (!user) return [];
    var accounts = getAll();
    if (!accounts[user]) return [];
    var connections = accounts[user].connections || [];
    var result = [];
    connections.forEach(function(connUser) {
      if (accounts[connUser]) {
        result.push({
          username: connUser,
          gear: accounts[connUser].gear || { tops: [], pants: [], head: [], skis: [], safety: [], misc: [] }
        });
      }
    });
    return result;
  }

  return {
    currentUser: currentUser,
    register: register,
    login: login,
    logout: logout,
    getGear: getGear,
    saveGear: saveGear,
    getProfile: getProfile,
    listUsers: listUsers,
    getConnections: getConnections,
    addConnection: addConnection,
    removeConnection: removeConnection,
    getConnectionGear: getConnectionGear
  };
})();
