import { auth } from '../firebase';

/**
 * Stream a chat message to the backend via SSE.
 * Gets a fresh Firebase ID token for authentication.
 * 
 * @param {string} sessionId
 * @param {string} message
 * @param {function} onToken - Called with each text token
 * @param {function} onDone - Called with {citations, refused, sessionTitle} when done
 * @param {function} onError - Called with error object
 */
export const streamChat = async (sessionId, message, onToken, onDone, onError) => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      onError(new Error('Not authenticated'));
      return;
    }

    const token = await currentUser.getIdToken();

    const response = await fetch(`/api/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ session_id: sessionId, content: message }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      onError(new Error(errorData.detail || `HTTP ${response.status}`));
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('event:') || trimmed.startsWith(':')) continue;

        if (trimmed.startsWith('data: ')) {
          const jsonStr = trimmed.slice(6);
          if (jsonStr === '[DONE]') {
            onDone({ citations: [], refused: false, sessionTitle: null });
            return;
          }
          try {
            const parsed = JSON.parse(jsonStr);

            if (parsed.event === 'token') {
              const text = parsed.data?.text || parsed.data || '';
              onToken(text);
            } else if (parsed.event === 'done') {
              onDone({
                citations: parsed.data?.citations || [],
                refused: parsed.data?.refused || false,
                sessionTitle: parsed.data?.session_title || null,
              });
              return;
            } else if (parsed.event === 'error') {
              onError(new Error(parsed.detail || 'Stream error'));
              return;
            }
          } catch {
            // Not JSON, treat as raw token text
            onToken(jsonStr);
          }
        }
      }
    }

    // If we got here without an explicit done event, signal done
    onDone({ citations: [], refused: false, sessionTitle: null });
  } catch (error) {
    onError(error);
  }
};
