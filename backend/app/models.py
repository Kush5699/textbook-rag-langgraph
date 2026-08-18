from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime


class UserResponse(BaseModel):
    id: str
    email: str
    role: str
    created_at: str


class MessageCreate(BaseModel):
    session_id: str
    content: str


class ChatMessage(BaseModel):
    id: str
    role: str
    content: str
    citations: Optional[List[Dict[str, Any]]] = None
    refused: bool = False
    created_at: str


class SessionResponse(BaseModel):
    id: str
    user_id: Optional[str] = None
    title: Optional[str] = None
    created_at: str
    updated_at: str


class DocumentResponse(BaseModel):
    id: str
    filename: str
    textbook_name: Optional[str] = None
    standard: Optional[str] = None
    subject: Optional[str] = None
    status: str
    page_count: Optional[int] = None
    chunk_count: Optional[int] = None
    created_at: str
