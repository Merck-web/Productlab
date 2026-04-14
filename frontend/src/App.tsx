import { useWebSocket } from './hooks/useWebSocket';
import { MessageList } from './components/MessageList';
import './App.css';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  disconnected: { label: 'Отключено', color: '#ef4444' },
  connecting: { label: 'Подключение...', color: '#f59e0b' },
  connected: { label: 'Подключено', color: '#22c55e' },
  'auth-required': { label: 'Требуется авторизация', color: '#f59e0b' },
  'auth-error': { label: 'Ошибка авторизации', color: '#ef4444' },
  error: { label: 'Ошибка', color: '#ef4444' },
};

function App() {
  const { messages, status, clearMessages } = useWebSocket();
  const statusInfo = STATUS_LABELS[status] || STATUS_LABELS.error;

  return (
    <div className="app">
      <header className="app-header">
        <h1>Avito Messages Monitor</h1>
        <div className="header-controls">
          <div className="status-indicator">
            <span
              className="status-dot"
              style={{ backgroundColor: statusInfo.color }}
            />
            <span className="status-text">{statusInfo.label}</span>
          </div>
          {messages.length > 0 && (
            <button className="clear-btn" onClick={clearMessages}>
              Очистить
            </button>
          )}
        </div>
      </header>
      <main className="app-main">
        <MessageList messages={messages} />
      </main>
    </div>
  );
}

export default App;
