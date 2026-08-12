import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { WalletProvider } from './contexts/WalletContext';
import { EscrowProvider } from './contexts/EscrowContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <WalletProvider>
        <EscrowProvider>
          <App />
        </EscrowProvider>
      </WalletProvider>
    </BrowserRouter>
  </React.StrictMode>
);
