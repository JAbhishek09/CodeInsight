import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// AuthProvider is mounted inside App, co-located with BrowserRouter
// so hooks like useNavigate work inside the context. Do NOT wrap here.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
