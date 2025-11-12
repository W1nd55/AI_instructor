import React from "react";
import { classNames, fmtTime } from "./App";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
export default function MessageBubble({ role, content, created_at }) {
  const isUser = role === "user";

  return (
    <div className={classNames("flex mb-6", isUser ? "justify-end" : "justify-start")}>
      <div className="flex items-start max-w-full gap-3">
        {!isUser && (
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-indigo-600 to-indigo-700 flex items-center justify-center shadow-md">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
        )}

        <div className="flex-1">
          <div
            className={classNames(
              "rounded-2xl px-6 py-4 shadow-md overflow-x-auto",
              isUser
                ? "bg-indigo-600 text-white rounded-br-sm"
                : "bg-white text-slate-800 border-2 border-slate-200 rounded-bl-sm"
            )}
          >
            <div className={classNames("prose max-w-none", isUser ? "prose-invert" : "prose-slate")}>
              <ReactMarkdown
                // 先解析数学，再做 GFM
                remarkPlugins={[remarkMath, remarkGfm]}
                rehypePlugins={[
                  [rehypeKatex, { throwOnError: false, strict: false }],
                  rehypeHighlight
                ]}
                // 链接新窗口打开（可选）
                // linkTarget="_blank"
              >
                {content || ""}
              </ReactMarkdown>
            </div>
          </div>

          {created_at && (
            <div className={classNames("mt-1 text-xs px-2", isUser ? "text-right text-slate-500" : "text-left text-slate-400")}>
              {fmtTime(created_at)}
            </div>
          )}
        </div>

        {isUser && (
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}