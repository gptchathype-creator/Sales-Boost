import React from 'react';
import ReactDOM from 'react-dom/client';
import { HeroUIProvider } from '@heroui/react';
import App from './App';
import { PublicVoiceDemo } from './PublicVoiceDemo';
import './index.css';

const rootElement = document.getElementById('root') as HTMLElement;
const isPublicDemo = typeof window !== 'undefined' && window.location.pathname.startsWith('/demo-call');

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <HeroUIProvider>
      {isPublicDemo ? <PublicVoiceDemo /> : <App />}
    </HeroUIProvider>
  </React.StrictMode>
);
