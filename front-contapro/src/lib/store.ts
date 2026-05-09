type User = {
  id: string;
  email: string;
  password: string;
  name?: string;
};

type HistoryItem = {
  id: string;
  userId: string;
  filename: string;
  uploadedAt: string;
  summary?: string;
};

type Store = {
  users: User[];
  sessions: Map<string, string>; // token -> userId
  history: HistoryItem[];
};

const g = globalThis as any;
if (!g.__contapro_store) {
  g.__contapro_store = {
    users: [],
    sessions: new Map<string, string>(),
    history: [],
  } as Store;
}

const store: Store = g.__contapro_store as Store;

export function addUser(user: User) {
  store.users.push(user);
}

export function findUserByEmail(email: string): User | undefined {
  return store.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
}

export function createSession(userId: string): string {
  const token = crypto.randomUUID();
  store.sessions.set(token, userId);
  return token;
}

export function getUserIdByToken(token: string | undefined): string | undefined {
  if (!token) return undefined;
  return store.sessions.get(token);
}

export function endSession(token: string | undefined) {
  if (!token) return;
  store.sessions.delete(token);
}

export function addHistory(item: HistoryItem) {
  store.history.push(item);
}

export function getHistoryByUser(userId: string): HistoryItem[] {
  return store.history.filter((h) => h.userId === userId);
}

export type { User, HistoryItem };