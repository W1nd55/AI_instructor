# AI Instructor UI (Vite + React) — Quick Start

A minimal frontend that connects to your FastAPI backend running on Ubuntu.

## 0. Prerequisites

- Node.js ≥ 18 (`node -v`)
- NPM ≥ 9 (`npm -v`)
- Backend is running (e.g., `http://<your-server-ip>:8000`) and either allows CORS or you use a proxy

---

## 1. Create a Vite React Project

```bash
# Using npm
npm create vite@latest ai-instructor-ui -- --template react

# Enter the directory and install dependencies
cd ai-instructor-ui
npm install
```

---

## 2. Enable Tailwind (CDN for development, zero config)

Edit `index.html` in the project root and add one line in `<head>`:

```html
<!-- index.html -->
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <script src="https://cdn.tailwindcss.com"></script> <!-- ✅ Enable Tailwind during development -->
  <title>AI Instructor</title>
</head>
```

> For production you may switch to a full Tailwind setup (PostCSS + `tailwind.config.js`). For development, CDN is enough.

---

## 3. Replace the Frontend Code

Copy your **single-file React component** (the one I provided) into:

```
src/App.jsx
```

Overwrite the default content.

> This frontend includes: Register/Login (JWT), new/existing conversations, send messages, view history, and a configurable API Base URL (stored in `localStorage`).

---

## 4. Start the Dev Server

```bash
npm run dev
# Default address: http://127.0.0.1:5173
```

Open `http://127.0.0.1:5173` in your browser.

---

## 5. Connect to the Backend (API Base URL)

On the sign-in page, fill **API Base URL** with your backend address, e.g.:

```
http://<your-server-ip>:8000
```

- The backend should listen on an external interface:
  ```bash
  uvicorn app:app --host 0.0.0.0 --port 8000 --reload
  ```
- If your server uses a firewall/security group, allow `8000/tcp` inbound.

> If the frontend runs on your **Mac** and the backend runs on an **Ubuntu server**, this “cross-machine” setup is correct. Do **not** use `127.0.0.1` (that points to the local machine of your browser).

---

## 6. (Optional) Use an SSH Tunnel (no open ports)

Create a local port forward on your Mac to map the server’s `127.0.0.1:8000` to your local machine:

```bash
ssh -N -L 8000:127.0.0.1:8000 ubuntu@<your-server-ip>
```

Then set **API Base URL** in the frontend to:

```
http://127.0.0.1:8000
```

> If you also run the frontend (Vite) on the server, forward 5173 as well:  
> `ssh -N -L 5173:127.0.0.1:5173 -L 8000:127.0.0.1:8000 ubuntu@<server-ip>`  
> Then open `http://127.0.0.1:5173` in your browser.

---

## 7. (Optional) Dev Proxy to Avoid CORS

If you prefer the frontend to always call relative `/api` paths, create `vite.config.js` in the project root:

```js
// vite.config.js
export default {
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api": {
        target: "http://<your-server-ip>:8000",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ""),
      },
    },
  },
};
```

Then change your frontend API calls from `http://IP:8000/xxx` to `/api/xxx`.  
> In this case you can keep CORS relaxed or even closed on the backend (the proxy handles cross-origin).

---

## 8. Production Build & Deployment

```bash
npm run build
# Artifacts will be in dist/
```

Upload `dist/` to any static host (Nginx, Vercel, Netlify, etc.).  
For the backend, deploy behind `https://api.yourdomain.com` (reverse-proxy Uvicorn with Nginx/Caddy and enable HTTPS).

Nginx example (simplified):

```nginx
# Frontend site
server {
  listen 80;
  server_name ui.yourdomain.com;
  root /var/www/ai-instructor-ui/dist;

  location / {
    try_files $uri /index.html;
  }
}

# Backend API reverse-proxy
server {
  listen 80;
  server_name api.yourdomain.com;

  location / {
    proxy_pass http://127.0.0.1:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }
}
```

---

## 9. Common Scripts

```bash
# Development
npm run dev

# Build
npm run build

# Preview local build artifacts
npm run preview
```

---

## 10. Login & Chat Flow (Brief)

1. Open the sign-in page, set **API Base URL** (backend address), then register or log in to get a JWT.  
2. After login, you’ll see the chat UI:  
   - **New Chat** to create a conversation;  
   - Sending a message calls `/chat/send` (with Bearer token);  
   - Chat history is fetched from `/chat/history?conversation_id=...`.  
3. When the token expires or an endpoint returns `401`, the frontend will prompt you to sign in again.
