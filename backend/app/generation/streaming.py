import json
import asyncio
from typing import AsyncGenerator

async def sse_generator(token_stream, citations=None, refused=False) -> AsyncGenerator[str, None]:
    try:
        async for token in token_stream:
            # yield formatted SSE
            yield f"event: token\ndata: {json.dumps({'text': token})}\n\n"
            
        # final event
        final_data = {
            "citations": citations or [],
            "refused": refused
        }
        yield f"event: done\ndata: {json.dumps(final_data)}\n\n"
    except Exception as e:
        yield f"event: error\ndata: {json.dumps({'detail': str(e)})}\n\n"
