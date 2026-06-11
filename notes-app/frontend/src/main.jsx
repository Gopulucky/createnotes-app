import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { auth } from './firebase.js'

// Intercept fetch calls to automatically attach Firebase ID token and API Base URL
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const originalFetch = window.fetch;
window.fetch = async (...args) => {
  let [resource, config] = args;
  
  if (typeof resource === 'string' && resource.startsWith('/api/')) {
    resource = API_BASE + resource;
    
    if (auth.currentUser) {
      const token = await auth.currentUser.getIdToken();
      config = config || {};
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${token}`
      };
      
      // If it's a FormData request, we don't want to set Content-Type
      // But we do want to add Authorization.
    }
  }
  
  return originalFetch(resource, config);
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
