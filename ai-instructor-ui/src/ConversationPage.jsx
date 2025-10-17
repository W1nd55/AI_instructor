import React, { useState, useEffect, useRef } from "react";
import { apiFetch, getApiBase, LS, classNames, exportToCSV } from "./App";
import { StudentInfoModal } from "./AuthPage";
import MessageBubble from "./MessageBubble";

// Sidebar Component
function Sidebar({ conversations, activeId, onSelect, onNew, onLogout }) {
  return (
    <div className="w-80 bg-gradient-to-b from-slate-50 to-white border-r border-slate-200 h-full flex flex-col shadow-lg">
      <div className="p-6 border-b border-slate-200 bg-white">
        <h2 className="text-xl font-bold text-slate-800 mb-1">Conversations</h2>
        <p className="text-xs text-slate-500">Stored locally on this browser</p>
      </div>

      <div className="flex-1 overflow-auto p-3">
        {conversations.length === 0 ? (
          <div className="p-6 text-center">
            <svg className="w-16 h-16 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-sm text-slate-500">No conversations yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => onSelect(c.id)}
                className={classNames(
                  "w-full text-left px-4 py-3 rounded-xl transition-all transform hover:scale-[1.02]",
                  activeId === c.id
                    ? "bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-md"
                    : "bg-white hover:bg-slate-50 text-slate-700 border border-slate-200"
                )}
              >
                <div className="font-medium truncate text-sm">{c.title || c.id}</div>
                <div className={classNames(
                  "text-xs truncate mt-1",
                  activeId === c.id ? "text-indigo-100" : "text-slate-400"
                )}>
                  {c.id}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="p-4 border-t border-slate-200 bg-white space-y-2">
        <button
          onClick={onNew}
          className="w-full bg-indigo-600 text-white rounded-xl py-3 font-medium hover:shadow-lg transition-all transform hover:scale-[1.02] flex items-center justify-center"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Chat
        </button>
        <button
          onClick={onLogout}
          className="w-full bg-slate-100 text-slate-700 rounded-xl py-3 font-medium hover:bg-slate-200 transition-all"
        >
          Logout
        </button>
      </div>
    </div>
  );
}

// Main Conversation Page
export default function ConversationPage({ token, onLogout }) {
  const [conversations, setConversations] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(LS.conversations) || "[]");
    } catch {
      return [];
    }
  });

  const [showWelcome, setShowWelcome] = useState(true);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [useReference, setUseReference] = useState(() => {
    try {
      const v = localStorage.getItem(LS.useReference);
      return v === null ? true : JSON.parse(v);
    } catch {
      return true;
    }
  });

  const [showStudentModal, setShowStudentModal] = useState(false);
  const [studentInfo, setStudentInfo] = useState(null);
  const [pendingMessage, setPendingMessage] = useState("");

  const scrollerRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    localStorage.setItem(LS.conversations, JSON.stringify(conversations));
  }, [conversations]);

  useEffect(() => {
    localStorage.setItem(LS.useReference, JSON.stringify(useReference));
  }, [useReference]);

  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }
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

    apiFetch(`/chat/history/detailed?conversation_id=${encodeURIComponent(activeId)}`, {
      token,
      signal: controller.signal,
    })
      .then((data) => {
        if (isMounted && data.student_name && data.student_id) {
          setStudentInfo({
            name: data.student_name,
            studentId: data.student_id,
          });
        }
      })
      .catch((err) => {
        console.warn("Could not fetch student info:", err);
      });

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [activeId, token, onLogout]);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [input]);

  function handleWelcomeStart() {
    setShowWelcome(false);
    setShowStudentModal(true);
  }

  function newChat() {
    setStudentInfo(null);
    setActiveId(null);
    setMessages([]);
    setShowStudentModal(true);
  }

  function handleStudentInfoSubmit(info) {
    setStudentInfo(info);
    setShowStudentModal(false);

    if (pendingMessage) {
      sendMessageWithStudentInfo(pendingMessage, info);
      setPendingMessage("");
    }
  }

  function selectChat(id) {
    setShowWelcome(false);
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

  function handleExportHistory() {
    if (messages.length === 0) {
      alert("No messages to export");
      return;
    }
    exportToCSV(messages, studentInfo);
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;

    if (!studentInfo) {
      setPendingMessage(text);
      setInput("");
      setShowStudentModal(true);
      return;
    }

    setInput("");
    sendMessageWithStudentInfo(text, studentInfo);
  }

  async function sendMessageWithStudentInfo(text, info) {
    setError("");
    setLoading(true);
    const body = activeId
      ? { conversation_id: activeId, text, use_reference: useReference, study: true}
      : {
        text,
        use_reference: useReference,
        student_name: info?.name,
        student_id: info?.studentId,
        study: true
      };

    setMessages((prev) => [...prev, { role: "user", content: text, created_at: new Date().toISOString() }]);

    try {
      const data = await apiFetch("/chat/send", {
        method: "POST",
        token,
        body,
      });
      upsertConversationLocal(data.conversation_id, messages[0]?.content || text);
      if (!activeId) setActiveId(data.conversation_id);
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

  if (showWelcome && !activeId) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-indigo-50 via-slate-50 to-indigo-50 p-6">
        <div className="w-full max-w-4xl">
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold text-indigo-600 mb-4">
              Welcome to AI Instructor
            </h1>
            <p className="text-xl text-slate-600">
              Your personal AI teaching assistant
            </p>
          </div>

          <div className="bg-white rounded-3xl shadow-2xl p-10 mb-8 border border-slate-200">
            <h2 className="text-2xl font-semibold text-slate-700 mb-6 flex items-center">
              <svg className="w-6 h-6 mr-2 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Directions
            </h2>
            <div className="text-slate-600 min-h-[120px] flex items-center justify-center">
              <p className="italic text-slate-400 text-lg">Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.</p>
            </div>
          </div>

          <div className="text-center">
            <button
              onClick={handleWelcomeStart}
              className="group px-10 py-4 bg-indigo-600 text-white text-lg font-semibold rounded-2xl hover:shadow-2xl transition-all transform hover:scale-105 shadow-lg"
            >
              <span className="flex items-center">
                Let's Start
                <svg className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-gradient-to-br from-slate-50 to-slate-100 flex">
      {showStudentModal && (
        <StudentInfoModal
          onSubmit={handleStudentInfoSubmit}
          onCancel={
            pendingMessage
              ? () => {
                setShowStudentModal(false);
                setInput(pendingMessage);
                setPendingMessage("");
              }
              : null
          }
        />
      )}

      <Sidebar
        conversations={conversations}
        activeId={activeId}
        onSelect={selectChat}
        onNew={newChat}
        onLogout={onLogout}
      />

      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="h-16 border-b border-slate-200 bg-white/80 backdrop-blur-md px-6 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <div className="font-semibold text-slate-800">
              {activeId ? `Conversation` : "New Conversation"}
            </div>
            {studentInfo && (
              <div className="flex items-center gap-2 text-sm bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-full border border-indigo-200">
                <span className="text-slate-600">Name:</span>
                <span className="font-medium">{studentInfo.name}</span>
                <span className="text-indigo-500">•</span>
                <span className="text-slate-600">ID:</span>
                <span>{studentInfo.studentId}</span>
              </div>
            )}
            <label className="flex items-center gap-2 cursor-pointer select-none bg-slate-100 px-3 py-1.5 rounded-full hover:bg-slate-200 transition-all">
              <input
                type="checkbox"
                className="accent-indigo-600 w-4 h-4"
                checked={useReference}
                onChange={(e) => setUseReference(e.target.checked)}
              />
              <span className="text-sm text-slate-700">Use textbook</span>
            </label>
          </div>
          <div className="flex items-center gap-3">
            {messages.length > 0 && (
              <button
                onClick={handleExportHistory}
                className="flex items-center gap-2 text-sm px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:shadow-lg transition-all transform hover:scale-105"
              >
                Export History
              </button>
            )}
            <div className="text-xs text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full">
              API: {getApiBase().replace('http://', '').replace('https://', '')}
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <div ref={scrollerRef} className="flex-1 overflow-auto p-6">
          <div className="max-w-4xl mx-auto">
            {messages.length === 0 && (
              <div className="text-center py-20">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-indigo-100 rounded-3xl mb-6">
                  <svg className="w-10 h-10 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-slate-700 mb-2">Start a conversation</h3>
                <p className="text-slate-500">Ask me anything and I'll help you learn!</p>
              </div>
            )}
            {messages.map((m, idx) => (
              <MessageBubble key={idx} role={m.role} content={m.content} created_at={m.created_at} />
            ))}
            {loading && (
              <div className="flex items-start gap-3 mb-6">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-md">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <div className="bg-white rounded-2xl rounded-bl-sm px-5 py-3 shadow-md border border-slate-200">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            )}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-5 py-3 rounded-2xl text-sm flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Input Area */}
        <div className="border-t border-slate-200 bg-white/80 backdrop-blur-md p-6">
          <div className="max-w-4xl mx-auto">
            <div className="flex gap-3 items-end">
              <div className="flex-1 bg-white rounded-2xl shadow-lg border border-slate-200 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent transition-all">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder="Type your message here... (Shift+Enter for new line)"
                  className="w-full px-5 py-4 rounded-2xl focus:outline-none resize-none text-slate-800 placeholder-slate-400"
                  rows="1"
                  style={{ minHeight: '56px', maxHeight: '200px' }}
                />
              </div>
              <button
                onClick={sendMessage}
                disabled={!input.trim() || loading}
                className={classNames(
                  "flex-shrink-0 w-14 h-14 rounded-2xl font-medium transition-all transform shadow-lg flex items-center justify-center",
                  input.trim() && !loading
                    ? "bg-indigo-600 text-white hover:shadow-xl hover:scale-105"
                    : "bg-slate-200 text-slate-400 cursor-not-allowed"
                )}
              >
                {loading ? (
                  <svg className="animate-spin w-6 h-6" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                )}
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-2 text-center">
              Press Enter to send, Shift+Enter for new line
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}