import { getChatDb } from '../database/client';
import { generateId } from '@/lib/utils/uuid';
import { toLocalISO } from '@/lib/utils/date';
import type { ChatMessage, CreateMessageInput } from '../types/message.types';
import type { Conversation } from '../types/conversation.types';

interface ConversationRow {
  id: string;
  title: string;
  is_favorite: number;
  created_at: string;
  updated_at: string;
}

interface MessageRow {
  id: string;
  conversation_id: string;
  type: 'user' | 'system';
  text: string;
  status: 'sent' | 'error' | 'pending';
  metadata: string;
  created_at: string;
}

function rowToConversation(row: ConversationRow): Conversation {
  return { id: row.id, title: row.title, isFavorite: !!row.is_favorite, createdAt: row.created_at, updatedAt: row.updated_at };
}

function rowToMessage(row: MessageRow): ChatMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    type: row.type,
    text: row.text,
    status: row.status,
    metadata: JSON.parse(row.metadata || '{}'),
    createdAt: row.created_at,
  };
}

export async function getOrCreateDefaultConversation(): Promise<Conversation> {
  const db = await getChatDb();
  const rows = await db.select<ConversationRow[]>('SELECT * FROM conversations ORDER BY created_at ASC LIMIT 1');
  if (rows[0]) return rowToConversation(rows[0]);

  const id = generateId();
  const now = toLocalISO(new Date());
  await db.execute(
    'INSERT INTO conversations (id, title, is_favorite, created_at, updated_at) VALUES ($1, $2, 0, $3, $3)',
    [id, 'Conversa', now]
  );
  return { id, title: 'Conversa', isFavorite: false, createdAt: now, updatedAt: now };
}

export async function getMessages(conversationId: string): Promise<ChatMessage[]> {
  const db = await getChatDb();
  const rows = await db.select<MessageRow[]>('SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC', [conversationId]);
  return rows.map(rowToMessage);
}

export async function addMessage(input: CreateMessageInput): Promise<ChatMessage> {
  const db = await getChatDb();
  const id = generateId();
  const now = toLocalISO(new Date());
  const status = input.status ?? 'sent';
  const metadata = JSON.stringify(input.metadata ?? {});

  await db.execute(
    'INSERT INTO messages (id, conversation_id, type, text, status, metadata, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
    [id, input.conversationId, input.type, input.text, status, metadata, now]
  );
  await db.execute('UPDATE conversations SET updated_at = $1 WHERE id = $2', [now, input.conversationId]);

  return { id, conversationId: input.conversationId, type: input.type, text: input.text, status, metadata: input.metadata ?? {}, createdAt: now };
}
