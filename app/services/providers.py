from __future__ import annotations

import hashlib
import math
import re
from collections.abc import Iterator

from openai import OpenAI

from app.config import Settings


class ProviderConfigurationError(RuntimeError):
    pass


class EmbeddingProvider:
    def embed_many(self, texts: list[str]) -> list[list[float]]:
        raise NotImplementedError


class HashEmbeddingProvider(EmbeddingProvider):
    """Deterministic local embedding substitute for automated tests only."""

    def __init__(self, dimensions: int) -> None:
        self.dimensions = dimensions

    def embed_many(self, texts: list[str]) -> list[list[float]]:
        vectors: list[list[float]] = []
        for text in texts:
            vector = [0.0] * self.dimensions
            for term in re.findall(r"\w+", text.lower(), flags=re.UNICODE):
                bucket = int(hashlib.sha256(term.encode("utf-8")).hexdigest(), 16) % self.dimensions
                vector[bucket] += 1.0
            magnitude = math.sqrt(sum(value * value for value in vector)) or 1.0
            vectors.append([value / magnitude for value in vector])
        return vectors


class OpenAIEmbeddingProvider(EmbeddingProvider):
    def __init__(self, settings: Settings) -> None:
        if not settings.openai_api_key:
            raise ProviderConfigurationError("OPENAI_API_KEY is required when EMBEDDING_PROVIDER=openai.")
        self.client = OpenAI(api_key=settings.openai_api_key)
        self.model = settings.openai_embedding_model

    def embed_many(self, texts: list[str]) -> list[list[float]]:
        result = self.client.embeddings.create(model=self.model, input=texts)
        return [item.embedding for item in result.data]


class ChatProvider:
    def complete(self, *, system_prompt: str, user_prompt: str) -> str:
        raise NotImplementedError

    def stream(self, *, system_prompt: str, user_prompt: str) -> Iterator[str]:
        yield self.complete(system_prompt=system_prompt, user_prompt=user_prompt)


class OpenAIChatProvider(ChatProvider):
    def __init__(self, settings: Settings) -> None:
        if not settings.openai_api_key:
            raise ProviderConfigurationError("OPENAI_API_KEY is required when CHAT_PROVIDER=openai.")
        self.client = OpenAI(api_key=settings.openai_api_key)
        self.model = settings.openai_chat_model

    def complete(self, *, system_prompt: str, user_prompt: str) -> str:
        result = self.client.chat.completions.create(
            model=self.model,
            temperature=0,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        )
        return (result.choices[0].message.content or "").strip()

    def stream(self, *, system_prompt: str, user_prompt: str) -> Iterator[str]:
        stream = self.client.chat.completions.create(
            model=self.model,
            temperature=0,
            stream=True,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        )
        for event in stream:
            delta = event.choices[0].delta.content
            if delta:
                yield delta


class ExtractiveDemoChatProvider(ChatProvider):
    """Offline development provider. It intentionally never invents beyond evidence."""

    def complete(self, *, system_prompt: str, user_prompt: str) -> str:
        evidence = user_prompt.partition("EVIDENCE:\n")[2].strip()
        if not evidence:
            return "I could not find this information in the provided textbooks."
        first = evidence.split("\n\n", 1)[-1].strip()
        return first[:900]


def get_embedding_provider(settings: Settings) -> EmbeddingProvider:
    if settings.embedding_provider.lower() == "hash":
        return HashEmbeddingProvider(settings.embedding_dimensions)
    if settings.embedding_provider.lower() == "openai":
        return OpenAIEmbeddingProvider(settings)
    raise ProviderConfigurationError(f"Unsupported embedding provider: {settings.embedding_provider}")


def get_chat_provider(settings: Settings) -> ChatProvider:
    if settings.chat_provider.lower() in {"demo", "extractive"}:
        return ExtractiveDemoChatProvider()
    if settings.chat_provider.lower() == "openai":
        return OpenAIChatProvider(settings)
    raise ProviderConfigurationError(f"Unsupported chat provider: {settings.chat_provider}")

