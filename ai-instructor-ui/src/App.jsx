import 'katex/dist/katex.min.css'
import 'highlight.js/styles/github.css'
import React, { useState } from "react";
import AuthPage from "./AuthPage";
import ConversationPage from "./ConversationPage";


// ---- Constants ----
export const LS = {
  token: "aii.token",
  username: "aii.username",
  userId: "aii.userId",
  apiBase: "aii.apiBase",
  conversations: "aii.conversations",
  useReference: "aii.useReference",
};

// ---- Utilities ----
export function getApiBase() {
  return localStorage.getItem(LS.apiBase) || "http://103.101.203.183:8000";
}

export async function apiFetch(path, { method = "GET", body, token, signal } = {}) {
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
    } catch { }
    const err = new Error(detail);
    err.status = res.status;
    throw err;
  }
  return res.headers.get("content-type")?.includes("application/json")
    ? res.json()
    : res.text();
}

export const classNames = (...arr) => arr.filter(Boolean).join(" ");
export const fmtTime = (s) => new Date(s).toLocaleString();

export function exportToCSV(messages, studentInfo) {
  const headers = ["user_name", "user_id", "timestamp", "role", "text"];
  const rows = messages.map((msg) => {
    let timestamp = msg.created_at;
    if (timestamp) {
      timestamp = typeof timestamp === 'string'
        ? timestamp
        : new Date(timestamp).toISOString();
    } else {
      timestamp = new Date().toISOString();
    }
    return [
      studentInfo?.name || "",
      studentInfo?.studentId || "",
      timestamp,
      msg.role,
      `"${(msg.content || "").replace(/"/g, '""')}"`,
    ];
  });

  const csvContent = [
    "\uFEFF" + headers.join(","),
    ...rows.map((row) => row.join(",")),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute(
    "download",
    `chat_history_${studentInfo?.studentId || "unknown"}_${Date.now()}.csv`
  );
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ---- Main App ----
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

  return (
    <div className="h-full w-full">
      {session ? (
        <ConversationPage token={session.token} onLogout={handleLogout} />
      ) : (
        <AuthPage onAuthed={handleAuthed} />
      )}
    </div>
  );
}