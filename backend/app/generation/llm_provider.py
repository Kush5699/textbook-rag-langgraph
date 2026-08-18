from abc import ABC, abstractmethod
from typing import AsyncIterator, List, Dict

class LLMProvider(ABC):
    @abstractmethod
    async def generate_stream(self, messages: List[Dict[str, str]]) -> AsyncIterator[str]:
        pass
