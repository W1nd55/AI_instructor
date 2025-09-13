import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * Minimal React frontend for the FastAPI backend
 * Features:
 * - Register & Login (JWT)
 * - New chat / multi-turn conversation
 * - View chat history for a selected conversation
 * - Persist token and conversations in localStorage
 * - Configurable API base URL
 *
 * How to use quickly:
 * - In a Vite React project, replace App.jsx with this file's default export
 * - Or in your environment that supports this component, just render <App />
 */

// ---- Config helpers ----
const LS = {
  token: "aii.token",
  username: "aii.username",
  userId: "aii.userId",
  apiBase: "aii.apiBase",
  conversations: "aii.conversations", // [{id, title}]
};

function getApiBase() {
  return localStorage.getItem(LS.apiBase) || "http://127.0.0.1:8000";
}

async function apiFetch(path, { method = "GET", body, token, signal } = {}) {
  const url = `${getApiBase()}${path}`;
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const data = await res.json();
      if (data?.detail) detail = data.detail;
    } catch {}
    const err = new Error(detail);
    err.status = res.status;
    throw err;
  }
  return res.headers.get("content-type")?.includes("application/json")
    ? res.json()
    : res.text();
}

// ---- Small utilities ----
const classNames = (...arr) => arr.filter(Boolean).join(" ");
const fmtTime = (s) => new Date(s).toLocaleString();

// ---- Auth Views ----
function AuthView({ onAuthed }) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [apiBase, setApiBase] = useState(getApiBase());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    localStorage.setItem(LS.apiBase, apiBase);
  }, [apiBase]);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await apiFetch(isLogin ? "/auth/login" : "/auth/register", {
        method: "POST",
        body: { username, password },
      });
      const { access_token, user_id, username: name } = data;
      localStorage.setItem(LS.token, access_token);
      localStorage.setItem(LS.username, name);
      localStorage.setItem(LS.userId, user_id);
      onAuthed({ token: access_token, username: name, userId: user_id });
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white shadow-xl rounded-2xl p-6">
        <h1 className="text-2xl font-semibold mb-1">AI Instructor Admin</h1>
        <p className="text-slate-500 mb-6">Sign in to chat with your backend.</p>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">API Base URL</label>
            <input
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring focus:ring-indigo-200"
              value={apiBase}
              onChange={(e) => setApiBase(e.target.value)}
              placeholder="http://127.0.0.1:8000"
            />
            <p className="text-xs text-slate-500 mt-1">Your FastAPI server address.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
            <input
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring focus:ring-indigo-200"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input
              type="password"
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring focus:ring-indigo-200"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          {error && <div className="text-red-600 text-sm">{error}</div>}

          <button
            type="submit"
            className={classNames(
              "w-full py-2 rounded-lg font-medium",
              "bg-indigo-600 text-white hover:bg-indigo-700",
              loading && "opacity-60 cursor-not-allowed"
            )}
            disabled={loading}
          >
            {loading ? "Processing..." : isLogin ? "Sign In" : "Create Account"}
          </button>
        </form>

        <div className="mt-4 text-sm text-slate-600 text-center">
          {isLogin ? (
            <span>
              No account?{" "}
              <button className="text-indigo-600 hover:underline" onClick={() => setIsLogin(false)}>
                Register
              </button>
            </span>
          ) : (
            <span>
              Already have an account?{" "}
              <button className="text-indigo-600 hover:underline" onClick={() => setIsLogin(true)}>
                Sign in
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- Chat Views ----
function Sidebar({ conversations, activeId, onSelect, onNew, onLogout }) {
  return (
    <div className="w-72 bg-white border-r h-full flex flex-col">
      <div className="p-4 border-b">
        <div className="text-lg font-semibold">Conversations</div>
        <div className="text-xs text-slate-500">Stored locally on this browser</div>
      </div>
      <div className="flex-1 overflow-auto">
        {conversations.length === 0 ? (
          <div className="p-4 text-sm text-slate-500">No conversations yet.</div>
        ) : (
          conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => onSelect(c.id)}
              className={classNames(
                "w-full text-left px-4 py-3 border-b hover:bg-slate-50",
                activeId === c.id && "bg-indigo-50"
              )}
            >
              <div className="font-medium truncate">{c.title || c.id}</div>
              <div className="text-xs text-slate-500 truncate">{c.id}</div>
            </button>
          ))
        )}
      </div>
      <div className="p-4 border-t flex gap-2">
        <button onClick={onNew} className="flex-1 bg-indigo-600 text-white rounded-lg py-2 hover:bg-indigo-700">New Chat</button>
        <button onClick={onLogout} className="px-3 bg-slate-200 rounded-lg hover:bg-slate-300">Logout</button>
      </div>
    </div>
  );
}

function MessageBubble({ role, content, created_at }) {
  const isUser = role === "user";
  return (
    <div className={classNames("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={classNames(
          "max-w-[80%] rounded-2xl px-4 py-2 mb-3 shadow",
          isUser ? "bg-indigo-600 text-white" : "bg-white border text-black"
        )}
      >
        <div className="whitespace-pre-wrap text-sm leading-relaxed">
          {content}
        </div>
        {created_at && (
          <div className={classNames("mt-1 text-[11px]", isUser ? "text-indigo-100" : "text-slate-500")}>
            {fmtTime(created_at)}
          </div>
        )}
      </div>
    </div>
  );
}

function ChatView({ token, onLogout }) {
  const [conversations, setConversations] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(LS.conversations) || "[]");
    } catch {
      return [];
    }
  });
  const [activeId, setActiveId] = useState(conversations[0]?.id || null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const abortRef = useRef(null);
  const scrollerRef = useRef(null);

  useEffect(() => {
    localStorage.setItem(LS.conversations, JSON.stringify(conversations));
  }, [conversations]);

  useEffect(() => {
    if (!activeId) return setMessages([]);
    let isMounted = true;
    const controller = new AbortController();
    apiFetch(`/chat/history?conversation_id=${encodeURIComponent(activeId)}`, {
      token,
      signal: controller.signal,
    })
      .then((data) => {
        if (isMounted) setMessages(data);
      })
      .catch((err) => {
        if (err.status === 401) onLogout();
        else setError(err.message);
      });
    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [activeId, token, onLogout]);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  function newChat() {
    setActiveId(null);
    setMessages([]);
  }

  function selectChat(id) {
    setActiveId(id);
  }

  function upsertConversationLocal(id, title) {
    setConversations((prev) => {
      const exists = prev.find((c) => c.id === id);
      if (exists) return prev;
      const item = { id, title: title || "Untitled" };
      return [item, ...prev];
    });
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setError("");
    setLoading(true);
    const body = activeId ? { conversation_id: activeId, text } : { text };

    // optimistic append user message
    setMessages((prev) => [...prev, { role: "user", content: text, created_at: new Date().toISOString() }]);

    try {
      const data = await apiFetch("/chat/send", {
        method: "POST",
        token,
        body,
      });
      // ensure conversation exists locally
      upsertConversationLocal(data.conversation_id, messages[0]?.content || text);
      if (!activeId) setActiveId(data.conversation_id);

      // append assistant reply
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply, created_at: data.created_at },
      ]);
    } catch (err) {
      if (err.status === 401) onLogout();
      else setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="h-screen w-full bg-slate-100 flex">
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        onSelect={selectChat}
        onNew={newChat}
        onLogout={onLogout}
      />

      <div className="flex-1 flex flex-col">
        <div className="h-14 border-b bg-white px-4 flex items-center justify-between">
          <div className="font-semibold">{activeId ? `Conversation: ${activeId}` : "New Conversation"}</div>
          <div className="text-xs text-slate-500">API: {getApiBase()}</div>
        </div>

        <div ref={scrollerRef} className="flex-1 overflow-auto p-4 space-y-1">
          {messages.length === 0 && (
            <div className="text-sm text-slate-500">No messages yet. Say hi!</div>
          )}
          {messages.map((m, idx) => (
            <MessageBubble key={idx} role={m.role} content={m.content} created_at={m.created_at} />
          ))}
          {loading && (
            <div className="text-slate-500 text-sm">Thinking…</div>
          )}
          {error && (
            <div className="text-red-600 text-sm">{error}</div>
          )}
        </div>

        <div className="border-t bg-white p-3">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Type a message and press Enter…"
              className="flex-1 border rounded-lg px-3 py-2 focus:outline-none focus:ring focus:ring-indigo-200"
            />
            <button
              onClick={sendMessage}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(() => {
    const token = localStorage.getItem(LS.token);
    const username = localStorage.getItem(LS.username);
    const userId = localStorage.getItem(LS.userId);
    return token ? { token, username, userId } : null;
  });

  function handleAuthed(payload) {
    setSession(payload);
  }

  function handleLogout() {
    localStorage.removeItem(LS.token);
    localStorage.removeItem(LS.username);
    localStorage.removeItem(LS.userId);
    setSession(null);
  }

  return session ? (
    <ChatView token={session.token} onLogout={handleLogout} />
  ) : (
    <AuthView onAuthed={handleAuthed} />
  );
}
