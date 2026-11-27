import { supabase } from './supabase';

export const API_BASE = 
  (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
    ? "http://127.0.0.1:8000/api"
    : (import.meta.env.VITE_API_BASE_URL || "https://chatpilot-backend-5js6.onrender.com/api");

export async function fetchApi<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
  
  // Attach token if present
  let authHeader: Record<string, string> = {};
  const token = localStorage.getItem('chatpilot_access_token');
  if (token) {
    authHeader['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeader,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    let detailMsg = errorText;
    try {
      const parsed = JSON.parse(errorText);
      if (parsed.detail) detailMsg = parsed.detail;
    } catch {}
    
    // Check for single active device session revocation
    if (response.status === 401 && detailMsg === "session_revoked_by_another_device") {
      window.dispatchEvent(new CustomEvent("chatpilot:session_revoked"));
    }

    throw new Error(detailMsg || `API Error ${response.status}`);
  }

  return response.json();
}

export const api = {
  // Auth & Single-Device Sessions
  login: (data: any) => fetchApi('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  confirmSwitchDevice: (data: any) => fetchApi('/auth/confirm-switch', { method: 'POST', body: JSON.stringify(data) }),
  forceLogin: (data: any) => fetchApi('/auth/confirm-switch', { method: 'POST', body: JSON.stringify(data) }),
  validateSession: (data: any) => fetchApi('/auth/validate-session', { method: 'POST', body: JSON.stringify(data) }),
  register: (data: any) => fetchApi('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  forgotPassword: (data: any) => fetchApi('/auth/forgot-password', { method: 'POST', body: JSON.stringify(typeof data === 'string' ? { email: data } : data) }),
  verifyRecoveryOtp: (data: any) => fetchApi('/auth/verify-recovery-otp', { method: 'POST', body: JSON.stringify(data) }),
  verifyOtp: (email: string, token: string) => fetchApi('/auth/verify-recovery-otp', { method: 'POST', body: JSON.stringify({ email, token }) }),
  resetPassword: (data: any) => fetchApi('/auth/reset-password', { method: 'POST', body: JSON.stringify(data) }),
  changePassword: (data: any) => fetchApi('/auth/change-password', { method: 'POST', body: JSON.stringify(data) }),
  logout: (data: any) => fetchApi('/auth/logout', { method: 'POST', body: JSON.stringify(data) }),
  getActiveDevice: () => fetchApi('/auth/active-device'),

  // Health
  getHealth: () => fetchApi('/health'),

  // Contacts
  getContacts: async () => {
    try {
      const res = await fetchApi('/contacts');
      if (Array.isArray(res) && res.length > 0) {
        return res;
      }
    } catch (e) {
      console.warn('[API] /contacts backend call note:', e);
    }
    // Direct Supabase fallback
    try {
      const { data } = await supabase.from('contacts').select('*').order('created_at', { ascending: false });
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
    } catch {}
    return [];
  },
  createContact: (data: any) => fetchApi('/contacts', { method: 'POST', body: JSON.stringify(data) }),
  updateContact: (id: string, data: any) => fetchApi(`/contacts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteContact: (id: string) => fetchApi(`/contacts/${id}`, { method: 'DELETE' }),

  // Groups
  getGroups: () => fetchApi('/groups'),
  createGroup: (data: any) => fetchApi('/groups', { method: 'POST', body: JSON.stringify(data) }),
  updateGroup: (id: string, data: any) => fetchApi(`/groups/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  // Conversations & Messages
  getConversations: () => fetchApi('/conversations'),
  getMessages: (conversationId: string) => fetchApi(`/messages?conversation_id=${conversationId}`),

  // Memory & Style
  getMemory: (contactId?: string) => fetchApi(`/memory${contactId ? `?contact_id=${contactId}` : ''}`),
  createMemory: (data: any) => fetchApi('/memory', { method: 'POST', body: JSON.stringify(data) }),
  deleteMemory: (id: string) => fetchApi(`/memory/${id}`, { method: 'DELETE' }),
  getWritingStyle: (contactId: string) => fetchApi(`/memory/style/${contactId}`),

  // AI Providers & Models
  getProviders: () => fetchApi('/ai/providers'),
  updateProvider: (id: string, data: any) => fetchApi(`/ai/providers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  testProvider: (providerName: string, modelName?: string) => 
    fetchApi('/ai/test', { method: 'POST', body: JSON.stringify({ provider_name: providerName, model_name: modelName }) }),

  // Reply Drafts & Policies
  getReplies: (status?: string) => fetchApi(`/replies${status ? `?status=${status}` : ''}`),
  approveReply: (replyId: string, editedText?: string) => 
    fetchApi(`/replies/${replyId}/approve`, { method: 'POST', body: JSON.stringify({ edited_text: editedText }) }),
  rejectReply: (replyId: string) => fetchApi(`/replies/${replyId}/reject`, { method: 'POST' }),
  regenerateReply: (replyId: string) => fetchApi(`/replies/${replyId}/regenerate`, { method: 'POST' }),
  getAiUsage: () => fetchApi('/ai/usage'),

  // WhatsApp Importer
  previewImport: (formData: FormData) => {
    return fetch(`${API_BASE}/import/preview`, {
      method: 'POST',
      body: formData,
    }).then(res => {
      if (!res.ok) throw new Error("Import preview failed");
      return res.json();
    });
  },
  executeImport: (data: any) => fetchApi('/import/execute', { method: 'POST', body: JSON.stringify(data) }),

  // Simulator & Webhooks
  simulateMessage: (data: { sender_name: string; message: string; contact_id?: string; conversation_id?: string }) => 
    fetchApi('/diagnostics/simulate', { method: 'POST', body: JSON.stringify(data) }),
  getDiagnostics: () => fetchApi('/diagnostics'),

  // Dataset Package & Learning
  getDatasetDryRun: () => fetchApi('/dataset/dry-run'),
  executeDatasetImport: (limitChats?: number) => 
    fetchApi('/dataset/execute-import', { method: 'POST', body: JSON.stringify({ limit_chats: limitChats }) }),
  getStyleProfiles: () => fetchApi('/dataset/style-profiles'),
  reviewStyleProfile: (profileId: string, reviewStatus: string) => 
    fetchApi(`/dataset/style-profiles/${profileId}/review`, { method: 'POST', body: JSON.stringify({ review_status: reviewStatus }) }),
  getRelationships: () => fetchApi('/dataset/relationships'),
  confirmRelationship: (relationshipId: string, relationshipType: string, notes?: string) => 
    fetchApi(`/dataset/relationships/${relationshipId}/confirm`, { method: 'POST', body: JSON.stringify({ relationship_type: relationshipType, notes }) }),
  classifyPolicy: (message: string) => 
    fetchApi('/dataset/policy/classify', { method: 'POST', body: JSON.stringify({ message }) }),

  // Settings & Activity
  getSettings: () => fetchApi('/settings'),
  updateSettings: (settings: any) => fetchApi('/settings', { method: 'POST', body: JSON.stringify(settings) }),
  getAutoReplyStatus: () => fetchApi('/auto-reply/status'),
  toggleAutoReply: (enabled: boolean) => fetchApi('/auto-reply/toggle', { method: 'POST', body: JSON.stringify({ enabled }) }),
  emergencyStopParveen: () => fetchApi('/parveen/emergency-stop', { method: 'POST' }),
  getActivity: () => fetchApi('/activity'),

  // Connectors & MCP
  getConnectors: () => fetchApi('/connectors'),
  toggleConnector: (connectorId: string, enabled: boolean) => 
    fetchApi(`/connectors/${connectorId}/toggle`, { method: 'POST', body: JSON.stringify({ enabled }) }),
  testConnector: (connectorId: string) => 
    fetchApi(`/connectors/${connectorId}/test`, { method: 'POST' }),
  addMcpServer: (data: any) => 
    fetchApi('/connectors/mcp/add', { method: 'POST', body: JSON.stringify(data) }),
  executeConnectorTool: (toolName: string, args: any = {}) => 
    fetchApi('/connectors/execute', { method: 'POST', body: JSON.stringify({ tool_name: toolName, arguments: args }) }),

  // Assistant Chat
  getAssistantSessions: () => fetchApi('/assistant/sessions'),
  createAssistantSession: (title?: string) => 
    fetchApi('/assistant/sessions', { method: 'POST', body: JSON.stringify({ title }) }),
  getAssistantMessages: (sessionId: string) => fetchApi(`/assistant/sessions/${sessionId}/messages`),
  sendAssistantMessage: (sessionId: string, data: any) => 
    fetchApi(`/assistant/sessions/${sessionId}/chat`, { method: 'POST', body: JSON.stringify(data) }),
};
