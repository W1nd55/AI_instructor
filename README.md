# Minimal Chat Server (FastAPI + SQLite + JWT + OpenAI Responses API)

A minimal backend that:
- Authenticates users (register/login with JWT)
- Persists conversations and messages (SQLite by default)
- Reads a local `system_prompt.txt`
- Calls the **OpenAI Responses API** to power multi-turn chat

> Stack: FastAPI · SQLAlchemy · SQLite (pluggable to Postgres) · JWT · OpenAI Python SDK (Responses API)

---

## Project Structure

```
your-project/
├─ app.py                 # API / DB / Auth / OpenAI call
├─ requirements.txt
├─ .env.example           # Environment variable template
└─ system_prompt.txt      # Your system prompt (editable anytime)
```

---

## Prerequisites

- Python 3.10+ (3.12 recommended)
- Ubuntu/macOS/Windows (examples use Ubuntu)

---

## Setup

```bash
# 0) Optional: update system packages
sudo apt update

# 1) Python tooling
sudo apt install -y python3-venv python3-pip

# 2) Enter your project folder
cd your-project

# 3) Virtual environment
python3 -m venv venv
source venv/bin/activate

# 4) Install dependencies
pip install -r requirements.txt
```

---

## Environment Variables

Create `.env` in the project root (use `.env.example` as a guide):

```dotenv
OPENAI_API_KEY=your_api_key_here
SECRET_KEY=change_me_to_random_long_secret
MODEL_NAME=gpt-4o-mini
SYSTEM_PROMPT_PATH=./system_prompt.txt
DATABASE_URL=sqlite:///./app.db
ACCESS_TOKEN_EXPIRE_HOURS=168
```

> If `.env` is not in the same dir as `app.py`, pass an absolute path to `load_dotenv`.

---

## Run

### Local-only (loopback)

```bash
uvicorn app:app --reload
# Same as --host 127.0.0.1 --port 8000
```

### Expose on your network

```bash
uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

> For production, put Nginx/Caddy in front with HTTPS and don’t expose the app directly to the public internet.

---

## API Reference

### 1) Register (testing convenience)
`POST /auth/register`

**Request**
```json
{ "username": "ben", "password": "test123456" }
```

**Response**
```json
{
  "access_token": "<JWT>",
  "token_type": "bearer",
  "user_id": "uuid",
  "username": "ben"
}
```

### 2) Login
`POST /auth/login`

**Request**
```json
{ "username": "ben", "password": "test123456" }
```

**Response**
```json
{
  "access_token": "<JWT>",
  "token_type": "bearer",
  "user_id": "uuid",
  "username": "ben"
}
```

### 3) Send a message / chat
`POST /chat/send` (requires `Authorization: Bearer <JWT>`)

**Request (first turn, no conversation_id)**
```json
{ "text": "Hi, summarize what this backend does." }
```

**Request (subsequent turns)**
```json
{
  "conversation_id": "existing-conv-uuid",
  "text": "Continue"
}
```

**Response**
```json
{
  "conversation_id": "uuid",
  "reply": "Model response text",
  "created_at": "2025-09-06T08:00:00"
}
```

> The backend converts history + the current user turn to the Responses API input and sends `system_prompt.txt` via `instructions`.

### 4) Get conversation history
`GET /chat/history?conversation_id=<uuid>` (requires `Authorization: Bearer <JWT>`)

**Response**
```json
[
  { "role": "user", "content": "...", "created_at": "..." },
  { "role": "assistant", "content": "...", "created_at": "..." }
]
```

---

## Data Model & Storage

Defaults to SQLite; DB file is `app.db` in the project root (`DATABASE_URL=sqlite:///./app.db`).

- `users`: `id (uuid)`, `username`, `password_hash`, `created_at`
- `conversations`: `id (uuid)`, `user_id`, `title`, `created_at`, `updated_at`
- `messages`: `id (int)`, `conversation_id`, `role ('user'|'assistant')`, `content`, `created_at`

A conversation has many messages. On the first turn, the server creates the conversation and returns `conversation_id`.

---

## Export & Analysis

### Option A: sqlite3 → CSV

```bash
# Inspect tables
sqlite3 app.db ".tables"
sqlite3 app.db "PRAGMA table_info(messages)"

# Flattened message export (includes username & conversation_id)
sqlite3 -header -csv app.db "
SELECT
  c.id               AS conversation_id,
  c.student_name     AS student_name,
  c.student_id       AS student_id,
  m.id               AS message_id,
  m.role             AS role,
  m.content          AS content,
  m.created_at       AS created_at
FROM messages m
JOIN conversations c ON m.conversation_id = c.id
JOIN users u ON c.user_id = u.id
ORDER BY c.id, m.id;
" > messages_flat.csv
```

> If you worry about locks, copy first and analyze the copy: `cp app.db app_copy.db`.

### Option B: Python + pandas

Create `export_data.py`:

```python
import os
from sqlalchemy import create_engine, text
import pandas as pd

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./app.db")
engine = create_engine(DATABASE_URL)

flat_sql = """
SELECT
  c.id        AS conversation_id,
  u.username  AS username,
  m.id        AS message_id,
  m.role      AS role,
  m.content   AS content,
  m.created_at
FROM messages m
JOIN conversations c ON m.conversation_id = c.id
JOIN users u ON c.user_id = u.id
ORDER BY c.id, m.id
"""

with engine.connect() as conn:
    flat = pd.read_sql(text(flat_sql), conn)

flat.to_csv("messages_flat.csv", index=False)
print("Exported: messages_flat.csv")
```

Run:
```bash
source venv/bin/activate
python export_data.py
```

---

## Dependencies (requirements.txt)

```txt
fastapi==0.115.0
uvicorn[standard]==0.30.6

sqlalchemy==2.0.34
passlib[bcrypt]==1.7.4
PyJWT==2.9.0
python-dotenv==1.0.1
pydantic==2.8.2

# OpenAI Python SDK (Responses API)
# Pin httpx to avoid known compatibility issues in some openai/httpx combinations.
openai>=1.97,<2.0
httpx<0.28
```

Install:
```bash
pip install -r requirements.txt
```

---

## Security Checklist (minimal)

- **HTTPS** via Nginx/Caddy reverse proxy  
- Restrict **CORS allow_origins** to your frontend domain(s)  
- Use a strong random **SECRET_KEY** and rotate periodically  
- Add **rate limiting** (e.g., `slowapi`) and structured logging  
- Prefer **PostgreSQL** in production + **Alembic** migrations  
- **Anonymize** or redact sensitive content before exports

---

## Extensions (optional)

- **Streaming (SSE)** with the Responses API and forward to the frontend  
- **Context trimming/summarization** to manage token usage  
- **Roles & permissions**, admin dashboard, audit logs  
- **Multi-model & parameters** (toggle `temperature`, `top_p`, etc.)

---

## License

Choose a license appropriate for your org (e.g., MIT/Apache-2.0) and add a `LICENSE` file at the repo root.
