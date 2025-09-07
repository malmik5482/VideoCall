import React, { useState } from 'react';

interface Message {
  id: number;
  text: string;
  timestamp: Date;
  sender: string;
}

const Chat: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [currentUser] = useState('User'); // Можно сделать настраиваемым

  const sendMessage = () => {
    if (inputMessage.trim() === '') return;
    
    const newMessage: Message = {
      id: Date.now(),
      text: inputMessage,
      timestamp: new Date(),
      sender: currentUser
    };
    
    setMessages(prev => [...prev, newMessage]);
    setInputMessage('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  };

  return (
    <div className="chat-container" style={{
      display: 'flex',
      flexDirection: 'column',
      height: '500px',
      maxWidth: '600px',
      border: '1px solid #ccc',
      borderRadius: '8px',
      padding: '16px'
    }}>
      <h2 style={{ margin: '0 0 16px 0' }}>Чат</h2>
      
      {/* Список сообщений */}
      <div className="messages-container" style={{
        flex: 1,
        overflowY: 'auto',
        border: '1px solid #eee',
        borderRadius: '4px',
        padding: '12px',
        marginBottom: '16px',
        backgroundColor: '#fafafa'
      }}>
        {messages.length === 0 ? (
          <p style={{ color: '#888', textAlign: 'center' }}>
            Нет сообщений. Начните разговор!
          </p>
        ) : (
          messages.map((message) => (
            <div key={message.id} className="message" style={{
              marginBottom: '12px',
              padding: '8px',
              backgroundColor: 'white',
              borderRadius: '4px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '4px'
              }}>
                <strong>{message.sender}</strong>
                <small style={{ color: '#666' }}>
                  {message.timestamp.toLocaleTimeString()}
                </small>
              </div>
              <p style={{ margin: 0 }}>{message.text}</p>
            </div>
          ))
        )}
      </div>
      
      {/* Поле ввода и кнопка отправки */}
      <div className="input-container" style={{
        display: 'flex',
        gap: '8px'
      }}>
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Введите сообщение..."
          style={{
            flex: 1,
            padding: '8px 12px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            fontSize: '14px'
          }}
        />
        <button
          onClick={sendMessage}
          disabled={inputMessage.trim() === ''}
          style={{
            padding: '8px 16px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          Отправить
        </button>
      </div>
    </div>
  );
};

export default Chat;
