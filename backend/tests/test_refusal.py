import pytest
import asyncio
from app.chat.service import process_chat

class MockDB:
    async def execute(self, *args, **kwargs):
        pass
    async def commit(self):
        pass

@pytest.mark.asyncio
async def test_refusal_short_circuit(monkeypatch):
    
    async def mock_add_message(*args, **kwargs):
        pass
    
    async def mock_get_history(*args, **kwargs):
        from app.models import ChatMessage
        return [ChatMessage(id="1", role="user", content="hello", citations=None, refused=False, created_at="")]
        
    async def mock_route_query(*args, **kwargs):
        return {}
        
    def mock_hybrid_search(*args, **kwargs):
        return [] # Zero chunks survive
        
    monkeypatch.setattr("app.chat.service.add_message", mock_add_message)
    monkeypatch.setattr("app.chat.service.get_session_history", mock_get_history)
    monkeypatch.setattr("app.chat.service.route_query", mock_route_query)
    monkeypatch.setattr("app.chat.service.hybrid_search", mock_hybrid_search)
    
    db = MockDB()
    generator = await process_chat(db, "session_id", "question?", "user_id")
    
    events = []
    async for event in generator:
        events.append(event)
        
    # Reconstruct text
    import json
    text = ""
    citations = None
    refused = False
    
    for e in events:
        if e.startswith("event: token"):
            data = json.loads(e.split("data: ")[1])
            text += data["text"]
        elif e.startswith("event: done"):
            data = json.loads(e.split("data: ")[1])
            citations = data["citations"]
            refused = data["refused"]
            
    assert text == "The requested information is unavailable in the provided Gujarat State Board textbooks."
    assert citations == []
    assert refused == True
