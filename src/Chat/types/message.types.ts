export type MessageType = 'user' | 'system';
export type MessageStatus = 'sent' | 'error' | 'pending';

export interface ChatMessage {
  id: string;
  conversationId: string;
  type: MessageType;
  text: string;
  status: MessageStatus;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface CreateMessageInput {
  conversationId: string;
  type: MessageType;
  text: string;
  status?: MessageStatus;
  metadata?: Record<string, unknown>;
}
