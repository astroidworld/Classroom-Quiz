import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.js'; // Note: NodeNext/Bundler resolves it, we can use ./App or ./App.tsx
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
