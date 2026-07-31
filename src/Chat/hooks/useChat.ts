import { useState, useEffect, useCallback } from 'react';
import { getOrCreateDefaultConversation, getMessages, addMessage } from '../services/chatService';
import { isCommand, parseCommand } from '../parser/commandParser';
import { commandRegistry } from '../commands/registry';
import '../commands'; // efeito colateral: garante que os comandos já foram registrados

import type { ChatMessage } from '../types/message.types';

export function useChat() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    (async () => {
      const conv = await getOrCreateDefaultConversation();
      setConversationId(conv.id);
      setMessages(await getMessages(conv.id));
      setLoading(false);
    })();
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    if (!conversationId || !text.trim() || sending) return;
    setSending(true);

    const userMsg = await addMessage({ conversationId, type: 'user', text: text.trim() });
    setMessages((prev) => [...prev, userMsg]);

    if (isCommand(text)) {
      const parsed = parseCommand(text);
      if (!parsed) {
        const msg = await addMessage({ conversationId, type: 'system', status: 'error', text: 'Comando inválido.' })
        setMessages((prev) => [...prev, ...[msg]]);
        setSending(false);
        return;
      }

      const command = commandRegistry.resolve(parsed.name);
      if (!command) {
        const errMsg = await addMessage({ conversationId, type: 'system', status: 'error', text: `Comando "!${parsed.name}" não encontrado.` });
        setMessages((prev) => [...prev, errMsg]);
        setSending(false);
        return;
      }

      try {
        const result = await command.execute(parsed);
        const sysMsg = await addMessage({
          conversationId, type: 'system', text: result.message,
          status: result.success ? 'sent' : 'error', metadata: result.metadata,
        });
        setMessages((prev) => [...prev, sysMsg]);
      } catch (err) {
        const errMsg = await addMessage({ conversationId, type: 'system', status: 'error', text: `Erro ao executar comando: ${String(err)}` });
        setMessages((prev) => [...prev, errMsg]);
      }
    }

    setSending(false);
  }, [conversationId, sending]);

  return { messages, loading, sending, sendMessage };
}
