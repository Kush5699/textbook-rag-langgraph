import pytest
import os

@pytest.fixture
def mock_settings(monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "test_key")
    monkeypatch.setenv("JWT_SECRET", "test_secret")
