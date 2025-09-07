import React from 'react';

const VideoCall: React.FC = () => {
  return (
    <div className="video-call-container">
      <h1>Video Call App</h1>
      
      <div className="video-area">
        <div className="local-video">
          <p>Локальное видео</p>
        </div>
        <div className="remote-video">
          <p>Удаленное видео</p>
        </div>
      </div>
      
      <div className="controls">
        <button className="call-button">Позвонить</button>
      </div>
      
      <div className="chat-container">
        <h3>Чат</h3>
        <div className="chat-messages">
          <p>Сообщения чата появятся здесь...</p>
        </div>
        <div className="chat-input">
          <input type="text" placeholder="Введите сообщение..." />
          <button>Отправить</button>
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <div className="App">
      <VideoCall />
    </div>
  );
};

export default App;
