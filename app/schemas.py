from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=12, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    email: EmailStr


class DocumentOut(BaseModel):
    id: str
    original_name: str
    subject: str | None
    standard: str | None
    language: str | None
    status: str
    page_count: int
    chunk_count: int
    error_message: str | None
    created_at: datetime


class CitationOut(BaseModel):
    source_name: str
    pages: list[int]
    snippet: str
    chunk_id: str


class ChatRequest(BaseModel):
    question: str = Field(min_length=2, max_length=4000)
    conversation_id: str | None = None
    subject: str | None = Field(default=None, max_length=120)
    standard: str | None = Field(default=None, max_length=40)
    document_ids: list[str] | None = None


class ChatResponse(BaseModel):
    conversation_id: str
    answer: str
    grounded: bool
    citations: list[CitationOut]


class MessageOut(BaseModel):
    id: str
    role: str
    content: str
    citations: list[CitationOut] = []
    created_at: datetime


class ConversationOut(BaseModel):
    id: str
    title: str
    updated_at: datetime

