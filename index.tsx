import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { NotificationProvider } from './context/NotificationContext'; // Moved here
import { LanguageProvider } from './context/LanguageContext'; // Moved here
import { CallProvider } from './context/CallContext'; // Moved here
import ErrorBoundary from './components/ErrorBoundary'; // Moved here
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <ErrorBoundary>
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider defaultMode="light" storageKey="voxspace-theme">
          <LanguageProvider>
            <NotificationProvider>
              <CallProvider>
                <App />
              </CallProvider>
            </NotificationProvider>
          </LanguageProvider>
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  </ErrorBoundary>
);
