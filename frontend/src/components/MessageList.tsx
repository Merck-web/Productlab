import { useEffect, useRef } from 'react';
import type { Message } from '../hooks/useWebSocket';

interface MessageListProps {
  messages: Message[];
}

export function MessageList({ messages }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0) {
    return <div className="empty-state">Ожидание новых сообщений...</div>;
  }

  return (
    <div className="message-list">
      {messages.map((msg, i) => (
        <div
          key={`${msg.id}-${i}`}
          className={`message ${msg.isOwn ? 'message-own' : 'message-other'}`}
        >
          <div className="message-header">
            <span className="message-author">{msg.author}</span>
            {msg.time && <span className="message-time">{msg.time}</span>}
          </div>
          <div className="message-text">{msg.text}</div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
