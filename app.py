import os
from dotenv import load_dotenv
import uuid
from datetime import datetime, timedelta
from typing import Optional, List

from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from sqlalchemy import (
    create_engine, Column, String, DateTime, Text, ForeignKey,
    Integer, func
)
from sqlalchemy.orm import declarative_base, sessionmaker, relationship, Session

from passlib.context import CryptContext
import jwt

# ---- OpenAI SDK (Responses API) ----
# Recommended: use Responses API; see openai/openai-python README (examples include output_text)
# https://github.com/openai/openai-python
from openai import OpenAI

# --------- Load .env BEFORE any os.getenv ----------
load_dotenv(dotenv_path=".env", override=False)

# ---------- Config ----------
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./app.db")
SECRET_KEY = os.getenv("SECRET_KEY", "60a8016c-39bd-42d8-b76a-3ab80d88ddd6")
JWT_ALG = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = int(os.getenv("ACCESS_TOKEN_EXPIRE_HOURS", "168"))  # default: 7 days
SYSTEM_PROMPT_PATH = os.getenv("SYSTEM_PROMPT_PATH", "./system_prompt.txt")
MODEL_NAME = os.getenv("MODEL_NAME", "gpt-4o-mini")

# OpenAI API key
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    raise RuntimeError("OPENAI_API_KEY is not set")

oai_client = OpenAI(api_key=OPENAI_API_KEY)

# ---------- App ----------
app = FastAPI(title="Minimal Chat Server")

# CORS (restrict allow_origins in production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- DB ----------
Base = declarative_base()
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
    future=True,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class User(Base):
    """User table"""
    __tablename__ = "users"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    username = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    conversations = relationship("Conversation", back_populates="user")


class Conversation(Base):
    """Conversation table"""
    __tablename__ = "conversations"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    user = relationship("User", back_populates="conversations")
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan")


class Message(Base):
    """Message table"""
    __tablename__ = "messages"
    id = Column(Integer, primary_key=True, autoincrement=True)
    conversation_id = Column(String, ForeignKey("conversations.id"), index=True, nullable=False)
    role = Column(String, nullable=False)  # 'user' | 'assistant' | 'system'
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    conversation = relationship("Conversation", back_populates="messages")


Base.metadata.create_all(bind=engine)

# ---------- Security ----------
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
http_bearer = HTTPBearer()


def get_db() -> Session:
    """Get DB session (dependency injection)"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def hash_password(password: str) -> str:
    """Hash password with bcrypt"""
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    """Verify password against stored hash"""
    return pwd_context.verify(password, password_hash)


def create_access_token(sub: str, expires_delta: Optional[timedelta] = None) -> str:
    """Generate JWT access token"""
    expire = datetime.utcnow() + (expires_delta or timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS))
    to_encode = {"exp": expire, "sub": sub}
    return jwt.encode(to_encode, SECRET_KEY, algorithm=JWT_ALG)


def decode_access_token(token: str) -> str:
    """Decode JWT token and extract subject (user_id)"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[JWT_ALG])
        return payload.get("sub")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(http_bearer),
    db: Session = Depends(get_db),
) -> User:
    """Get current user from token"""
    user_id = decode_access_token(creds.credentials)
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user

# ---------- Schemas ----------
class RegisterIn(BaseModel):
    """Schema for register input"""
    username: str = Field(min_length=3, max_length=64)
    password: str = Field(min_length=6, max_length=128)


class LoginIn(BaseModel):
    """Schema for login input"""
    username: str
    password: str


class LoginOut(BaseModel):
    """Schema for login output"""
    access_token: str
    token_type: str = "bearer"
    user_id: str
    username: str


class ChatSendIn(BaseModel):
    """Schema for chat request input"""
    text: str = Field(min_length=1)
    conversation_id: Optional[str] = None


class ChatSendOut(BaseModel):
    """Schema for chat response output"""
    conversation_id: str
    reply: str
    created_at: datetime


class MessageOut(BaseModel):
    """Schema for returning message history"""
    role: str
    content: str
    created_at: datetime


# ---------- Utils ----------
def read_system_prompt() -> str:
    """Read system prompt text from file"""
    try:
        with open(SYSTEM_PROMPT_PATH, "r", encoding="utf-8") as f:
            return f.read().strip()
    except FileNotFoundError:
        return "You are a helpful assistant."  # fallback


def build_input_messages(history: List[Message], new_user_text: str) -> list:
    """
    Convert message history + new user input into Responses API format.
    Rules:
      - user -> content.type = "input_text"
      - assistant -> content.type = "output_text"
    """
    input_list = []

    for m in history:
        role = m.role
        if role not in ("user", "assistant"):
            # Currently no 'system' stored; if added later, it can be passed to instructions.
            # Here unknown roles are treated as assistant.
            role = "assistant"

        content_type = "input_text" if role == "user" else "output_text"
        input_list.append({
            "role": role,
            "content": [{"type": content_type, "text": m.content}],
        })

    # Append the latest user message
    input_list.append({
        "role": "user",
        "content": [{"type": "input_text", "text": new_user_text}],
    })
    return input_list


def extract_output_text(resp) -> str:
    """
    Extract output text from OpenAI Responses response.
    Prefer resp.output_text (recommended).
    Fallback: parse resp.output if output_text is empty or missing.
    """
    txt = getattr(resp, "output_text", None)
    if isinstance(txt, str) and txt.strip():
        return txt.strip()

    # Fallback: try model_dump or model_dump_json
    data = None
    try:
        data = resp.model_dump()
    except Exception:
        try:
            import json
            data = json.loads(resp.model_dump_json())
        except Exception:
            pass

    parts: List[str] = []
    if isinstance(data, dict):
        for item in data.get("output", []):
            itype = item.get("type")
            if itype == "output_text":
                t = item.get("text") or item.get("content")
                if isinstance(t, str):
                    parts.append(t)
            elif itype == "message":
                for c in item.get("content", []):
                    if isinstance(c, dict):
                        if c.get("type") in ("output_text", "output_text.delta", "input_text"):
                            t = c.get("text")
                            if isinstance(t, str):
                                parts.append(t)
    return "".join(parts).strip()


def ensure_conversation(db: Session, user: User, conv_id: Optional[str]) -> Conversation:
    """Fetch existing conversation or create a new one"""
    if conv_id:
        conv = db.query(Conversation).filter(
            Conversation.id == conv_id,
            Conversation.user_id == user.id
        ).first()
        if not conv:
            raise HTTPException(status_code=404, detail="Conversation not found")
        return conv
    conv = Conversation(user_id=user.id, title=None)
    db.add(conv)
    db.flush()
    return conv


# ---------- Routes ----------
@app.post("/auth/register", response_model=LoginOut)
def register(data: RegisterIn, db: Session = Depends(get_db)):
    """Register new user"""
    if db.query(User).filter(User.username == data.username).first():
        raise HTTPException(status_code=400, detail="Username already exists")
    user = User(username=data.username, password_hash=hash_password(data.password))
    db.add(user)
    db.commit()
    token = create_access_token(sub=user.id)
    return LoginOut(access_token=token, user_id=user.id, username=user.username)


@app.post("/auth/login", response_model=LoginOut)
def login(data: LoginIn, db: Session = Depends(get_db)):
    """Login user and return access token"""
    user = db.query(User).filter(User.username == data.username).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token(sub=user.id)
    return LoginOut(access_token=token, user_id=user.id, username=user.username)


@app.post("/chat/send", response_model=ChatSendOut)
def chat_send(
    data: ChatSendIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Send user message and get assistant reply"""
    # 1) Conversation
    conv = ensure_conversation(db, user, data.conversation_id)

    # 2) System prompt
    system_prompt = read_system_prompt()

    # 3) History (can add max length control for tokens)
    history = db.query(Message).filter(
        Message.conversation_id == conv.id
    ).order_by(Message.id.asc()).all()

    # 4) Build Responses API input
    input_msgs = build_input_messages(history, data.text)

    # 5) Call OpenAI Responses API
    try:
        resp = oai_client.responses.create(
            model=MODEL_NAME,
            instructions=system_prompt,     # system prompt
            input=input_msgs,               # multi-turn conversation
        )
        assistant_text = extract_output_text(resp)
        if not assistant_text:
            raise RuntimeError("Empty assistant output")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OpenAI error: {e}")

    # 6) Save messages into DB
    if not data.conversation_id:
        conv.title = (data.text[:30] + "…") if len(data.text) > 30 else data.text

    db.add_all([
        Message(conversation_id=conv.id, role="user", content=data.text),
        Message(conversation_id=conv.id, role="assistant", content=assistant_text),
    ])
    db.commit()

    return ChatSendOut(conversation_id=conv.id, reply=assistant_text, created_at=datetime.utcnow())


@app.get("/chat/history", response_model=List[MessageOut])
def chat_history(
    conversation_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Fetch chat history for a conversation"""
    conv = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.user_id == user.id
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    rows = db.query(Message).filter(
        Message.conversation_id == conversation_id
    ).order_by(Message.id.asc()).all()
    return [MessageOut(role=r.role, content=r.content, created_at=r.created_at) for r in rows]