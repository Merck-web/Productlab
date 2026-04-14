import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

export interface Message {
  id: string;
  text: string;
  author: string;
  time: string;
  isOwn: boolean;
}

type Status = 'disconnected' | 'connecting' | 'connected' | 'auth-required' | 'auth-error' | 'error';

const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3000';

export function useWebSocket() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<Status>('disconnected');
  const socketRef = useRef<Socket | null>(null);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  useEffect(() => {
    setStatus('connecting');
    const socket = io(WS_URL, {
      transports: ['polling', 'websocket'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setStatus('connected');
    });

    socket.on('disconnect', () => {
      setStatus('disconnected');
    });

    socket.on('newMessage', (message: Message) => {
      setMessages((prev) => [...prev, message]);
    });

    socket.on('status', (payload: { status: Status }) => {
      setStatus(payload.status);
    });

    socket.on('connect_error', () => {
      setStatus('error');
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return { messages, status, clearMessages };
}
