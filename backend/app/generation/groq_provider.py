from typing import AsyncIterator, List, Dict
from groq import AsyncGroq
from .llm_provider import LLMProvider
from ..config import settings
import logging

logger = logging.getLogger(__name__)

class GroqProvider(LLMProvider):
    def __init__(self):
        self.client = AsyncGroq(api_key=settings.GROQ_API_KEY)
        self.model = settings.GROQ_MODEL

    async def generate_stream(self, messages: List[Dict[str, str]]) -> AsyncIterator[str]:
        try:
            stream = await self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0.2,
                stream=True
            )
            async for chunk in stream:
                content = chunk.choices[0].delta.content
                if content:
                    yield content
        except Exception as e:
            logger.error(f"Groq API error: {e}")
            yield f"Error generating response: {e}"
