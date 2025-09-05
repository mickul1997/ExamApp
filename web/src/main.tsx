import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './web-app';
import './index.css';

const el = document.getElementById('root');
if (!el) throw new Error('Missing #root');
createRoot(el).render(<App />);
