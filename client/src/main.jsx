import React from 'react';
import ReactDOM from 'react-dom/client';
import './theme.css';
import App from './App';

// Sync init — apply saved theme before first paint to avoid flash
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'light') {
  document.documentElement.setAttribute('data-theme', 'light');
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
