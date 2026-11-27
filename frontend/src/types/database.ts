// Supabase database types for ChatPilot AI

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Contacts {
  id?: string;
  owner_id?: string;
  display_name: string;
  phone_e164?: string;
  whatsapp_jid?: string;
  is_selected: boolean;
  auto_reply_enabled: boolean;
  reply_mode: 'automatic' | 'manual' | 'off';
  preferred_language?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ChatpilotGroups {
  id?: string;
  owner_id?: string;
  group_name: string;
  whatsapp_jid?: string;
  is_selected: boolean;
  auto_reply_enabled: boolean;
  reply_mode: 'reply_to_all' | 'mentions_only' | 'manual_only';
  trigger_mode?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Conversations {
  id?: string;
  owner_id?: string;
  conversation_type: 'contact' | 'group';
  contact_id?: string;
  group_id?: string;
  title?: string;
  last_message_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Messages {
  id?: string;
  owner_id?: string;
  conversation_id: string;
  external_message_id?: string;
  direction: 'incoming' | 'outgoing';
  sender_identifier?: string;
  sender_name?: string;
  body: string;
  message_type?: string;
  source?: string;
  message_timestamp?: string;
  metadata?: Record<string, any>;
  created_at?: string;
}

export interface ContactPrompts {
  id?: string;
  owner_id?: string;
  contact_id?: string;
  group_id?: string;
  system_prompt: string;
  tone?: string;
  language_mode?: string;
  max_reply_chars?: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ContactMemory {
  id?: string;
  owner_id?: string;
  contact_id?: string;
  group_id?: string;
  memory_key: string;
  memory_value: string;
  confidence?: number;
  source_message_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ConversationSummaries {
  id?: string;
  owner_id?: string;
  conversation_id: string;
  summary: string;
  covered_until?: string;
  created_at?: string;
  updated_at?: string;
}

export interface WritingSamples {
  id?: string;
  owner_id?: string;
  contact_id?: string;
  group_id?: string;
  sample_text: string;
  source?: string;
  created_at?: string;
}

export interface AiProviders {
  id?: string;
  owner_id?: string;
  provider_name: string;
  model_name: string;
  priority: number;
  is_enabled: boolean;
  allow_private_content: boolean;
  monthly_budget?: number;
  settings?: {
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    [key: string]: any;
  };
  created_at?: string;
  updated_at?: string;
}

export interface AiUsageLogs {
  id?: string;
  owner_id?: string;
  provider_name: string;
  model_name: string;
  request_status: string;
  prompt_tokens: number;
  completion_tokens: number;
  estimated_cost: number;
  latency_ms: number;
  error_code?: string;
  created_at?: string;
}

export interface ReplyDrafts {
  id?: string;
  owner_id?: string;
  conversation_id: string;
  source_message_id?: string;
  draft_text: string;
  provider_name?: string;
  model_name?: string;
  status: 'pending' | 'approved' | 'rejected' | 'sent';
  approved_at?: string;
  sent_at?: string;
  send_result?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ActivityLogs {
  id?: string;
  owner_id?: string;
  event_type: string;
  description: string;
  related_conversation_id?: string;
  metadata?: Record<string, any>;
  created_at?: string;
}

export interface AppSettings {
  id?: string;
  owner_id?: string;
  settings: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}


export interface ChatImportBatches {
  id: string;
  owner_id: string;
  source_type: string;
  batch_name?: string;
  status: string;
  total_sources: number;
  total_messages: number;
  imported_messages: number;
  error_count: number;
  manifest: any;
  created_at: string;
  completed_at?: string;
}

export interface ChatImportSources {
  id: string;
  owner_id: string;
  batch_id: string;
  contact_id?: string;
  source_filename: string;
  source_sha256: string;
  source_bytes: number;
  exported_chat_title?: string;
  parsed_message_count: number;
  imported_message_count: number;
  date_range_start?: string;
  date_range_end?: string;
  possible_group_chat: boolean;
  status: string;
  parser_metadata: any;
  created_at: string;
}

export interface ContactStyleProfiles {
  id: string;
  owner_id: string;
  contact_id: string;
  profile_version: number;
  style_profile: any;
  evidence: any;
  confidence: number;
  review_status: string;
  last_analyzed_at?: string;
  approved_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ContactRelationships {
  id: string;
  owner_id: string;
  contact_id: string;
  relationship_type: string;
  context_label?: string;
  notes?: string;
  source: string;
  confidence: number;
  needs_user_confirmation: boolean;
  created_at: string;
  updated_at: string;
}

export interface ResponsePolicies {
  id: string;
  owner_id: string;
  contact_id?: string;
  scope: string;
  message_category: string;
  action: string;
  holding_template?: string;
  policy_config: any;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface MessageAttachments {
  id: string;
  owner_id: string;
  message_id?: string;
  attachment_type: string;
  original_filename?: string;
  storage_path?: string;
  mime_type?: string;
  file_bytes?: number;
  sha256?: string;
  metadata: any;
  created_at: string;
}

export interface ResponseFeedback {
  id: string;
  owner_id: string;
  reply_draft_id?: string;
  contact_id?: string;
  source_message_id?: string;
  action_taken: string;
  original_draft?: string;
  final_sent_text?: string;
  edit_distance?: number;
  feedback_notes?: string;
  created_at: string;
}

export interface AssistantSessions {
  id: string;
  owner_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  archived_at?: string;
}

export interface AssistantSessionMessages {
  id: string;
  owner_id: string;
  session_id: string;
  role: string;
  content: string;
  context_refs: any;
  sequence_number: number;
  created_at: string;
}
