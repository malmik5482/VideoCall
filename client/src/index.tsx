import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/tailwind.css';

// Глобальный обработчик ошибок
window.addEventListener('error', (event) => {
  console.error('Глобальная ошибка:', event.error);
});

// Обработчик необработанных промисов
window.addEventListener('unhandledrejection', (event) => {
  console.error('Необработанный промис:', event.reason);
  event.preventDefault();
});

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Скрыть загрузочный экран после монтирования React
const loadingElement = document.getElementById('loading');
if (loadingElement) {
  setTimeout(() => {
    loadingElement.style.display = 'none';
  }, 500);
}

// Регистрация Service Worker для PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('SW зарегистрирован: ', registration);
      })
      .catch((registrationError) => {
        console.log('SW регистрация не удалась: ', registrationError);
      });
  });
}
