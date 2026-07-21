const state = { mode: "login", user: null, conversationId: null, conversations: [] };
const $ = (selector) => document.querySelector(selector);

async function api(path, options = {}) {
  const response = await fetch(path, { credentials: "same-origin", headers: { ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }), ...(options.headers || {}) }, ...options });
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({ detail: "Unexpected response." }));
  if (!response.ok) throw new Error(data.detail || "Request failed.");
  return data;
}

function showApp() { $("#auth-view").hidden = true; $("#app-view").hidden = false; $("#user-email").textContent = state.user.email; loadDocuments(); loadConversations(); }
function showAuth() { $("#auth-view").hidden = false; $("#app-view").hidden = true; }

function setAuthMode(mode) {
  state.mode = mode;
  const registering = mode === "register";
  $("#auth-title").textContent = registering ? "Create your account" : "Sign in";
  $("#auth-help").textContent = registering ? "Your textbooks and conversations stay private to your account." : "Use your account to keep textbooks and conversations private.";
  $("#auth-submit").textContent = registering ? "Create account" : "Sign in";
  $("#auth-toggle").textContent = registering ? "Already have an account? Sign in" : "Need an account? Create one";
  $("#password").autocomplete = registering ? "new-password" : "current-password";
  $("#auth-error").textContent = "";
}

async function loadDocuments() {
  const documents = await api("/api/documents");
  const root = $("#document-list");
  root.replaceChildren();
  if (!documents.length) { root.innerHTML = '<p class="status">No textbooks uploaded yet.</p>'; return; }
  documents.forEach((item) => {
    const node = document.createElement("article");
    node.className = "document";
    const details = [item.subject, item.standard && `Std. ${item.standard}`, item.language].filter(Boolean).join(" · ");
    node.innerHTML = `<div class="document-header"><div class="document-title">${escapeHtml(item.original_name)}</div><span class="badge ${item.status}">${escapeHtml(item.status)}</span></div><p class="document-meta">${escapeHtml(details || "No metadata")}<br>${item.page_count || "–"} pages · ${item.chunk_count || "–"} searchable chunks</p>`;
    if (item.status === "failed") node.innerHTML += `<p class="error">${escapeHtml(item.error_message || "Processing failed.")}</p>`;
    const remove = document.createElement("button"); remove.className = "delete"; remove.type = "button"; remove.textContent = "Remove";
    remove.onclick = async () => { if (confirm(`Remove ${item.original_name}?`)) { await api(`/api/documents/${item.id}`, { method: "DELETE" }); loadDocuments(); } };
    node.append(remove); root.append(node);
  });
}

async function loadConversations() {
  state.conversations = await api("/api/conversations");
  const root = $("#conversation-list"); root.replaceChildren();
  state.conversations.forEach((conversation) => {
    const button = document.createElement("button"); button.className = `conversation-item ${conversation.id === state.conversationId ? "active" : ""}`; button.type = "button"; button.textContent = conversation.title;
    button.onclick = () => openConversation(conversation.id); root.append(button);
  });
}

async function openConversation(id) {
  state.conversationId = id;
  const conversation = state.conversations.find((item) => item.id === id);
  $("#chat-title").textContent = conversation?.title || "Conversation";
  const messages = await api(`/api/conversations/${id}/messages`);
  const feed = $("#chat-feed"); feed.replaceChildren();
  messages.forEach((message) => addMessage(message.role, message.content, message.citations));
  feed.scrollTop = feed.scrollHeight; loadConversations();
}

function citationsElement(citations) {
  const list = document.createElement("div"); list.className = "citation-list";
  citations.forEach((citation) => { const card = document.createElement("div"); card.className = "citation"; card.innerHTML = `<strong>${escapeHtml(citation.source_name)} — page${citation.pages.length > 1 ? "s" : ""} ${citation.pages.join(", ")}</strong><p>${escapeHtml(citation.snippet)}</p>`; list.append(card); });
  return list;
}

function addMessage(role, content, citations = []) {
  $("#empty-chat")?.remove();
  const section = document.createElement("article"); section.className = `message ${role}`;
  section.innerHTML = `<span class="message-label">${role === "user" ? "You" : "Textbook assistant"}</span><div class="message-content"></div>`;
  section.querySelector(".message-content").textContent = content;
  if (citations.length) {
    section.append(citationsElement(citations));
  }
  $("#chat-feed").append(section); return section;
}

async function streamChat(question) {
  const response = await fetch("/api/chat/stream", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question, conversation_id: state.conversationId }) });
  if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.detail || "Unable to answer this question."); }
  const assistant = addMessage("assistant", ""); const content = assistant.querySelector(".message-content");
  const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = "";
  while (true) {
    const { value, done } = await reader.read(); if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n"); buffer = parts.pop();
    for (const part of parts) {
      const event = part.match(/^event: (.+)$/m)?.[1] || "message"; const raw = part.match(/^data: (.+)$/m)?.[1]; if (!raw) continue;
      const data = JSON.parse(raw);
      if (event === "token") content.textContent += data.text;
      if (event === "sources" && data.length) assistant.append(citationsElement(data));
      if (event === "done") { state.conversationId = data.conversation_id; await loadConversations(); $("#chat-title").textContent = state.conversations.find((item) => item.id === state.conversationId)?.title || "Conversation"; }
      if (event === "error") throw new Error(data.detail);
      $("#chat-feed").scrollTop = $("#chat-feed").scrollHeight;
    }
  }
}

function escapeHtml(value) { const node = document.createElement("span"); node.textContent = value || ""; return node.innerHTML; }

$("#auth-form").addEventListener("submit", async (event) => { event.preventDefault(); const error = $("#auth-error"); error.textContent = ""; try { state.user = await api(`/api/auth/${state.mode === "register" ? "register" : "login"}`, { method: "POST", body: JSON.stringify({ email: $("#email").value, password: $("#password").value }) }); showApp(); } catch (err) { error.textContent = err.message; } });
$("#auth-toggle").onclick = () => setAuthMode(state.mode === "login" ? "register" : "login");
$("#password-toggle").onclick = () => {
  const password = $("#password");
  const visible = password.type === "password";
  password.type = visible ? "text" : "password";
  $("#password-toggle").setAttribute("aria-pressed", String(visible));
  $("#password-toggle").setAttribute("aria-label", visible ? "Hide password" : "Show password");
};
$("#forgot-password").onclick = () => {
  $("#auth-error").textContent = "Password-reset emails are not configured for this local demo yet. Create a new account or add an email provider before public deployment.";
};
$("#logout").onclick = async () => { await api("/api/auth/logout", { method: "POST" }); state.user = null; state.conversationId = null; showAuth(); };
$("#new-chat").onclick = () => { state.conversationId = null; $("#chat-title").textContent = "New conversation"; $("#chat-feed").innerHTML = '<div class="empty-state" id="empty-chat"><h2>What would you like to learn?</h2><p>Ask a question after adding at least one textbook to your library.</p></div>'; loadConversations(); };
$("#mobile-library").onclick = () => $("#library").classList.add("open"); $("#close-library").onclick = () => $("#library").classList.remove("open");
$("#upload-form").addEventListener("submit", async (event) => { event.preventDefault(); const status = $("#upload-status"); const form = new FormData(); form.append("file", $("#pdf-file").files[0]); form.append("subject", $("#subject").value); form.append("standard", $("#standard").value); form.append("language", $("#language").value); status.textContent = "Uploading and preparing the textbook..."; try { await api("/api/documents", { method: "POST", body: form }); event.target.reset(); status.textContent = "Upload accepted. Processing may take a moment."; loadDocuments(); setTimeout(loadDocuments, 5000); } catch (err) { status.textContent = err.message; } });
$("#chat-form").addEventListener("submit", async (event) => { event.preventDefault(); const field = $("#question"); const send = $("#send"); const question = field.value.trim(); if (!question) return; field.value = ""; addMessage("user", question); send.disabled = true; try { await streamChat(question); } catch (err) { addMessage("assistant", err.message); } finally { send.disabled = false; field.focus(); } });

(async () => { try { state.user = await api("/api/auth/me"); showApp(); } catch { showAuth(); setAuthMode("login"); } })();
