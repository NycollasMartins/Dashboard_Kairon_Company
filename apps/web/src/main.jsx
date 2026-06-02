import React from 'react';
import ReactDOM from 'react-dom/client';
import { initSupabase } from '@kairon/core/supabase/client';
import App from '@/app/App.jsx';
import '@/index.css';

// Inicializa o client Supabase compartilhado com as variaveis do Vite, antes de
// renderizar. Os modulos de API (no @kairon/core) so acessam o client em tempo
// de chamada (Proxy), entao a ordem aqui e segura.
initSupabase({
  url: import.meta.env.VITE_SUPABASE_URL,
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
});

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
