import React from 'react';
import ReactDOM from 'react-dom/client';
import Cortex from './Cortex';
import './presentation/styles/tokens.css';
import './presentation/styles/global.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Cortex />
  </React.StrictMode>
);
