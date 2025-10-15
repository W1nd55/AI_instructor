import React, { useState, useEffect } from "react";
import { apiFetch, getApiBase, LS, classNames } from "./App";

// Auth View
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
    <div className="fixed inset-0 bg-gradient-to-br from-indigo-50 via-slate-50 to-indigo-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white shadow-2xl rounded-3xl p-8 border border-slate-200">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">AI Instructor</h1>
          <p className="text-slate-500">Sign in to get started</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">API Base URL</label>
            <input
              className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              value={apiBase}
              onChange={(e) => setApiBase(e.target.value)}
              placeholder="http://127.0.0.1:8000"
            />
            <p className="text-xs text-slate-500 mt-1">Your FastAPI server address</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
            <input
              className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
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
              className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            className={classNames(
              "w-full py-3 rounded-xl font-medium transition-all transform hover:scale-[1.02]",
              "bg-indigo-600 text-white shadow-lg hover:shadow-xl",
              loading && "opacity-60 cursor-not-allowed"
            )}
            disabled={loading}
          >
            {loading ? "Processing..." : isLogin ? "Sign In" : "Create Account"}
          </button>
        </form>

        <div className="mt-6 text-sm text-slate-600 text-center">
          {isLogin ? (
            <span>
              No account?{" "}
              <button className="text-indigo-600 hover:underline font-medium" onClick={() => setIsLogin(false)}>
                Register
              </button>
            </span>
          ) : (
            <span>
              Already have an account?{" "}
              <button className="text-indigo-600 hover:underline font-medium" onClick={() => setIsLogin(true)}>
                Sign in
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// Student Info Modal
export function StudentInfoModal({ onSubmit, onCancel }) {
  const [studentId, setStudentId] = useState("");
  const [name, setName] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    if (studentId.trim() && name.trim()) {
      onSubmit({ studentId: studentId.trim(), name: name.trim() });
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md transform transition-all">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Student Information</h2>
          <p className="text-sm text-slate-600">
            Please provide your information before starting the chat
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Student Name
            </label>
            <input
              type="text"
              className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Student ID
            </label>
            <input
              type="text"
              className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              placeholder="Enter your student ID"
              required
            />
          </div>

          <div className="flex gap-3 pt-4">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 px-4 py-3 rounded-xl border-2 border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition-all"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              className="flex-1 px-4 py-3 rounded-xl bg-indigo-600 text-white font-medium hover:shadow-lg transition-all transform hover:scale-[1.02]"
            >
              Continue
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// 只导出 AuthView，移除 WelcomeScreen
export default AuthView;