(function () {
  const ACCOUNTS_KEY = 'azha_moh_accounts_v1';
  const SESSION_KEY = 'azha_moh_session_v1';
  const MESSAGES_KEY = 'azha_moh_messages_v1';

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function normalizeText(value) {
    return String(value || '').trim();
  }

  function normalizeUsername(value) {
    return normalizeText(value).replace(/\s+/g, ' ');
  }

  function normalizeEmail(value) {
    return normalizeText(value).toLowerCase();
  }

  function sanitizeUser(account) {
    if (!account) return null;

    const { password, ...safeUser } = account;
    return {
      ...safeUser,
      role: account.role || (account.isAdmin ? 'admin' : 'user'),
      isAdmin: Boolean(account.isAdmin || account.role === 'admin')
    };
  }

  function makeId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  }

  function normalizeRole(value) {
    return value === 'admin' ? 'admin' : 'user';
  }

  function ensureDemoAccount() {
    const accounts = readJSON(ACCOUNTS_KEY, []);
    const adminAccount = {
      id: 'admin-azha',
      username: 'AZHA Admin',
      email: 'bestazhafgame@gmail.com',
      password: 'qBAO5214',
      role: 'admin',
      isAdmin: true,
      friends: [],
      createdAt: new Date().toISOString()
    };

    const normalizedAccounts = Array.isArray(accounts)
      ? accounts.map((account) => ({
          ...account,
          role: normalizeRole(account.role || (account.isAdmin ? 'admin' : 'user')),
          isAdmin: Boolean(account.isAdmin || account.role === 'admin'),
          friends: Array.isArray(account.friends) ? account.friends : []
        }))
      : [];

    if (!normalizedAccounts.length) {
      writeJSON(ACCOUNTS_KEY, [adminAccount]);
      return [adminAccount];
    }

    const adminExists = normalizedAccounts.some(
      (account) => account.email === adminAccount.email || account.role === 'admin'
    );

    if (!adminExists) {
      normalizedAccounts.push(adminAccount);
      writeJSON(ACCOUNTS_KEY, normalizedAccounts);
    }

    return normalizedAccounts;
  }

  function getAccounts() {
    return ensureDemoAccount();
  }

  function saveAccounts(accounts) {
    writeJSON(
      ACCOUNTS_KEY,
      accounts.map((account) => ({
        ...account,
        role: normalizeRole(account.role || (account.isAdmin ? 'admin' : 'user')),
        isAdmin: Boolean(account.isAdmin || account.role === 'admin'),
        friends: Array.isArray(account.friends) ? account.friends : []
      }))
    );
  }

  function getCurrentUser() {
    const accounts = getAccounts();
    const sessionId = localStorage.getItem(SESSION_KEY);

    if (!sessionId) {
      return null;
    }

    const currentUser = accounts.find((account) => account.id === sessionId) || null;
    return currentUser ? sanitizeUser(currentUser) : null;
  }

  function setCurrentUser(userId) {
    localStorage.setItem(SESSION_KEY, userId);
  }

  function ensureFriendsList(account) {
    if (!Array.isArray(account.friends)) {
      account.friends = [];
    }
    return account.friends;
  }

  const AZHAAccounts = {
    getAccounts,
    saveAccounts,
    getCurrentUser,
    clearSession() {
      localStorage.removeItem(SESSION_KEY);
      return true;
    },
    isCurrentUserAdmin() {
      const currentUser = getCurrentUser();
      return Boolean(currentUser && (currentUser.role === 'admin' || currentUser.isAdmin));
    },
    logout() {
      localStorage.removeItem(SESSION_KEY);
      return true;
    },
    createAccount({ username, email, password }) {
      const cleanUsername = normalizeUsername(username);
      const cleanEmail = normalizeEmail(email);
      const cleanPassword = normalizeText(password);

      if (!cleanUsername || !cleanEmail || !cleanPassword) {
        return { success: false, message: 'Please fill in all fields.' };
      }

      if (cleanPassword.length < 6) {
        return { success: false, message: 'Password must be at least 6 characters.' };
      }

      const accounts = getAccounts();
      const emailExists = accounts.some((account) => account.email === cleanEmail);
      const usernameExists = accounts.some((account) => account.username.toLowerCase() === cleanUsername.toLowerCase());

      if (emailExists) {
        return { success: false, message: 'An account with that email already exists.' };
      }

      if (usernameExists) {
        return { success: false, message: 'That username is already taken.' };
      }

      const newAccount = {
        id: makeId('user'),
        username: cleanUsername,
        email: cleanEmail,
        password: cleanPassword,
        role: 'user',
        isAdmin: false,
        friends: [],
        createdAt: new Date().toISOString()
      };

      accounts.push(newAccount);
      saveAccounts(accounts);
      setCurrentUser(newAccount.id);

      return {
        success: true,
        user: sanitizeUser(newAccount)
      };
    },
    login({ email, password }) {
      const cleanEmail = normalizeEmail(email);
      const cleanPassword = normalizeText(password);

      if (!cleanEmail || !cleanPassword) {
        return { success: false, message: 'Email and password are required.' };
      }

      const accounts = getAccounts();
      const account = accounts.find(
        (entry) => entry.email === cleanEmail && entry.password === cleanPassword
      );

      if (!account) {
        return { success: false, message: 'Incorrect email or password.' };
      }

      setCurrentUser(account.id);
      return {
        success: true,
        user: sanitizeUser(account)
      };
    },
    getAllUsers() {
      return getAccounts().map((account) => sanitizeUser(account));
    },
    updateUserRole(userId, role) {
      if (!this.isCurrentUserAdmin()) {
        return { success: false, message: 'Admin permissions are required.' };
      }

      const nextRole = normalizeRole(role);
      const accounts = getAccounts();
      const targetUser = accounts.find((account) => account.id === userId);

      if (!targetUser) {
        return { success: false, message: 'User not found.' };
      }

      if (targetUser.email === 'bestazhafgame@gmail.com') {
        return {
          success: false,
          message: 'The main administrator account cannot be changed.'
        };
      }

      targetUser.role = nextRole;
      targetUser.isAdmin = nextRole === 'admin';
      saveAccounts(accounts);

      return { success: true, user: sanitizeUser(targetUser) };
    },
    deleteUser(userId) {
      if (!this.isCurrentUserAdmin()) {
        return { success: false, message: 'Admin permissions are required.' };
      }

      const accounts = getAccounts();
      const targetUser = accounts.find((account) => account.id === userId);

      if (!targetUser) {
        return { success: false, message: 'User not found.' };
      }

      if (targetUser.email === 'bestazhafgame@gmail.com') {
        return {
          success: false,
          message: 'The main administrator account cannot be deleted.'
        };
      }

      const filteredAccounts = accounts.filter((account) => account.id !== userId);
      saveAccounts(filteredAccounts);

      if (localStorage.getItem(SESSION_KEY) === userId) {
        localStorage.removeItem(SESSION_KEY);
      }

      return { success: true };
    },
    addFriend(friendUsername) {
      const currentUser = getCurrentUser();

      if (!currentUser) {
        return { success: false, message: 'Please log in first.' };
      }

      const cleanFriend = normalizeUsername(friendUsername);
      if (!cleanFriend) {
        return { success: false, message: 'Please enter a username.' };
      }

      const accounts = getAccounts();
      const friend = accounts.find(
        (account) => account.username.toLowerCase() === cleanFriend.toLowerCase()
      );

      if (!friend) {
        return { success: false, message: 'User not found.' };
      }

      if (friend.id === currentUser.id) {
        return { success: false, message: 'You cannot add yourself as a friend.' };
      }

      const currentAccount = accounts.find((account) => account.id === currentUser.id);
      const currentFriends = ensureFriendsList(currentAccount);

      if (currentFriends.some((entry) => entry.id === friend.id)) {
        return { success: false, message: 'This user is already on your friends list.' };
      }

      currentFriends.push({ id: friend.id, username: friend.username });
      saveAccounts(accounts);

      return {
        success: true,
        friend: { id: friend.id, username: friend.username }
      };
    },
    getFriends() {
      const currentUser = getCurrentUser();

      if (!currentUser) {
        return [];
      }

      const accounts = getAccounts();
      const currentAccount = accounts.find((account) => account.id === currentUser.id);
      const friendList = ensureFriendsList(currentAccount || { friends: [] });

      return friendList.map((friend) => ({
        id: friend.id,
        username: friend.username
      }));
    },
    sendMessage({ toUserId, text }) {
      const currentUser = getCurrentUser();

      if (!currentUser) {
        return { success: false, message: 'Please log in to send messages.' };
      }

      const cleanText = normalizeText(text);
      if (!cleanText) {
        return { success: false, message: 'Type a message before sending.' };
      }

      if (!toUserId) {
        return { success: false, message: 'Choose a friend to message.' };
      }

      const messages = readJSON(MESSAGES_KEY, []);
      const newMessage = {
        id: makeId('msg'),
        fromId: currentUser.id,
        toId: toUserId,
        text: cleanText,
        timestamp: new Date().toISOString()
      };

      messages.push(newMessage);
      writeJSON(MESSAGES_KEY, messages);

      return { success: true, message: newMessage };
    },
    getConversation(friendId) {
      const currentUser = getCurrentUser();

      if (!currentUser || !friendId) {
        return [];
      }

      const messages = readJSON(MESSAGES_KEY, []);
      return messages
        .filter(
          (message) =>
            (message.fromId === currentUser.id && message.toId === friendId) ||
            (message.fromId === friendId && message.toId === currentUser.id)
        )
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    },
    findUserById(userId) {
      const accounts = getAccounts();
      return accounts.find((account) => account.id === userId) || null;
    }
  };

  window.AZHAAccounts = AZHAAccounts;
})();
