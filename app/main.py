from __future__ import annotations

import json
import uuid
from contextlib import asynccontextmanager
from functools import lru_cache
from pathlib import Path

from fastapi import BackgroundTasks, Depends, FastAPI, File, Form, HTTPException, Response, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.database import Base, SessionLocal, engine, get_db
from app.models import Chunk, Conversation, Document, Message, User
from app.schemas import ChatRequest, ChatResponse, ConversationOut, DocumentOut, LoginRequest, MessageOut, RegisterRequest, UserOut
from app.security import create_access_token, get_current_user, hash_password, verify_password
from app.services.chat import ChatService
from app.services.ingestion import IngestionService
from app.services.providers import ProviderConfigurationError, get_chat_provider, get_embedding_provider
from app.services.reranking import Reranker
from app.services.retrieval import RetrievalService, delete_lexical_document, initialise_lexical_index
from app.services.vector_store import QdrantVectorStore


def build_ingestion_service(settings: Settings) -> IngestionService:
    embedder = get_embedding_provider(settings)
    vector_store = QdrantVectorStore(settings)
    return IngestionService(settings, embedder, vector_store)


def build_chat_service(settings: Settings) -> ChatService:
    embedder = get_embedding_provider(settings)
    vector_store = QdrantVectorStore(settings)
    return ChatService(settings, RetrievalService(settings, embedder, vector_store), Reranker(settings), get_chat_provider(settings))


@lru_cache
def ingestion_service() -> IngestionService:
    return build_ingestion_service(settings)


@lru_cache
def chat_service() -> ChatService:
    return build_chat_service(settings)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    Path("data").mkdir(parents=True, exist_ok=True)
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        initialise_lexical_index(db)
    yield


settings = get_settings()
app = FastAPI(title=settings.app_name, version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Content-Type"],
)


def serialize_document(document: Document) -> DocumentOut:
    return DocumentOut(
        id=document.id, original_name=document.original_name, subject=document.subject,
        standard=document.standard, language=document.language, status=document.status,
        page_count=document.page_count, chunk_count=document.chunk_count,
        error_message=document.error_message, created_at=document.created_at,
    )


def issue_session(user: User) -> JSONResponse:
    response = JSONResponse(UserOut(id=user.id, email=user.email).model_dump())
    response.set_cookie(
        key="access_token", value=create_access_token(user.id), httponly=True,
        secure=settings.cookie_secure, samesite="lax", max_age=settings.access_token_minutes * 60,
    )
    return response


def process_document(document_id: str) -> None:
    db = SessionLocal()
    try:
        ingestion_service().ingest(db, document_id)
    finally:
        db.close()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/auth/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> Response:
    email = str(payload.email).lower()
    user = User(email=email, password_hash=hash_password(payload.password))
    db.add(user)
    try:
        db.commit()
        db.refresh(user)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account with this email already exists.") from exc
    return issue_session(user)


@app.post("/api/auth/login", response_model=UserOut)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> Response:
    user = db.query(User).filter(User.email == str(payload.email).lower()).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password.")
    return issue_session(user)


@app.post("/api/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout() -> Response:
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    response.delete_cookie("access_token")
    return response


@app.get("/api/auth/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)) -> UserOut:
    return UserOut(id=user.id, email=user.email)


@app.get("/api/documents", response_model=list[DocumentOut])
def list_documents(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[DocumentOut]:
    documents = db.query(Document).filter(Document.owner_id == user.id).order_by(Document.created_at.desc()).all()
    return [serialize_document(document) for document in documents]


@app.post("/api/documents", response_model=DocumentOut, status_code=status.HTTP_202_ACCEPTED)
def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    subject: str | None = Form(default=None),
    standard: str | None = Form(default=None),
    language: str | None = Form(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DocumentOut:
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="Upload a PDF textbook.")
    suffix = Path(file.filename).suffix.lower()
    stored_name = f"{uuid.uuid4()}{suffix}"
    destination = settings.upload_dir / stored_name
    bytes_written = 0
    with destination.open("wb") as output:
        while block := file.file.read(1024 * 1024):
            bytes_written += len(block)
            if bytes_written > settings.max_upload_mb * 1024 * 1024:
                output.close()
                destination.unlink(missing_ok=True)
                raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail=f"PDF exceeds {settings.max_upload_mb} MB limit.")
            output.write(block)
    document = Document(
        owner_id=user.id, original_name=Path(file.filename).name, stored_path=str(destination),
        subject=subject.strip() if subject else None, standard=standard.strip() if standard else None,
        language=language.strip() if language else None, status="queued",
    )
    db.add(document)
    db.commit()
    db.refresh(document)
    background_tasks.add_task(process_document, document.id)
    return serialize_document(document)


@app.delete("/api/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(document_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Response:
    document = db.get(Document, document_id)
    if not document or document.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")
    vector_ids = [chunk.vector_id for chunk in document.chunks if chunk.kind == "child"]
    try:
        QdrantVectorStore(settings).delete(vector_ids)
    except Exception:
        # The relational record is still removed; an orphaned vector is user-isolated by owner payload.
        pass
    Path(document.stored_path).unlink(missing_ok=True)
    delete_lexical_document(db, document.id)
    db.delete(document)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.get("/api/conversations", response_model=list[ConversationOut])
def list_conversations(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[ConversationOut]:
    conversations = db.query(Conversation).filter(Conversation.owner_id == user.id).order_by(Conversation.updated_at.desc()).all()
    return [ConversationOut(id=item.id, title=item.title, updated_at=item.updated_at) for item in conversations]


@app.get("/api/conversations/{conversation_id}/messages", response_model=list[MessageOut])
def list_messages(conversation_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[MessageOut]:
    conversation = db.get(Conversation, conversation_id)
    if not conversation or conversation.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")
    return [
        MessageOut(
            id=message.id, role=message.role, content=message.content,
            citations=json.loads(message.citations_json or "[]"), created_at=message.created_at,
        )
        for message in conversation.messages
    ]


def build_chat_plan(payload: ChatRequest, user: User, db: Session):
    try:
        return chat_service().plan(
            db, owner=user, question=payload.question.strip(), conversation_id=payload.conversation_id,
            subject=payload.subject, standard=payload.standard, document_ids=payload.document_ids,
        )
    except ProviderConfigurationError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@app.post("/api/chat", response_model=ChatResponse)
def chat(payload: ChatRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> ChatResponse:
    plan = build_chat_plan(payload, user, db)
    try:
        answer = chat_service().answer(db, plan)
    except ProviderConfigurationError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    return ChatResponse(conversation_id=plan.conversation.id, answer=answer, grounded=plan.grounded, citations=plan.citations)


@app.post("/api/chat/stream")
def stream_chat(payload: ChatRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> StreamingResponse:
    plan = build_chat_plan(payload, user, db)
    service = chat_service()

    def events():
        try:
            for piece in service.stream_answer(db, plan):
                yield f"event: token\ndata: {json.dumps({'text': piece})}\n\n"
            yield f"event: sources\ndata: {json.dumps([citation.model_dump() for citation in plan.citations])}\n\n"
            yield f"event: done\ndata: {json.dumps({'conversation_id': plan.conversation.id, 'grounded': plan.grounded})}\n\n"
        except ProviderConfigurationError as exc:
            yield f"event: error\ndata: {json.dumps({'detail': str(exc)})}\n\n"

    return StreamingResponse(events(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


STATIC_DIR = Path(__file__).parent / "static"
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/", include_in_schema=False)
def home() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")
