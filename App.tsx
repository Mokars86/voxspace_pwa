import React, { useState, useEffect } from 'react';
import { useTheme } from './context/ThemeContext';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Welcome from './pages/auth/Welcome';
import Login from './pages/auth/Login';
import MainApp from './pages/MainApp';
import { Loader2 } from 'lucide-react';
import { SplashScreen } from '@capacitor/splash-screen'; // Import Splash Screen

import Onboarding from './pages/auth/Onboarding';
import ChatRoom from './pages/chats/ChatRoom';
import Settings from './pages/Settings';
import SpaceDetail from './pages/spaces/SpaceDetail';
import EditProfile from './pages/EditProfile';
import UserProfile from './pages/UserProfile';
import MyBag from './pages/my-bag/MyBag';
import SpaceChatRoom from './pages/spaces/SpaceChatRoom';
import PrivacySettings from './pages/settings/PrivacySettings';
import SecuritySettings from './pages/settings/SecuritySettings';
import AppearanceSettings from './pages/settings/AppearanceSettings';
import NotificationSettings from './pages/settings/NotificationSettings';
import DataSettings from './pages/settings/DataSettings';
import BlockedUsers from './pages/settings/BlockedUsers';
import { CallProvider } from './context/CallContext';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, profile, loading } = useAuth();

  // Force safety timeout for loading state
  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (loading) {
        console.warn("Auth loading timed out, forcing render");
        // We can't force context update easily here, but we can assume no session if it took this long?
        // Actually best to just show an error or a reload button.
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [loading]);

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-white text-[#ff1744]">
        <Loader2 size={40} className="animate-spin mb-4" />
        <p className="text-gray-500 text-sm">Loading...</p>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/welcome" replace />;
  }

  // Redirect logic removed to prevent infinite loop.
  // if (session && !profile && window.location.pathname !== '/onboarding') {
  //   return <Navigate to="/onboarding" replace />;
  // }

  return <>{children}</>;
};

import { usePushNotifications } from './hooks/usePushNotifications';
import { useNetworkStatus } from './hooks/useNetworkStatus';
import { WifiOff } from 'lucide-react';

// DEBUG COMPONENT
// DEBUG COMPONENT
const DebugOverlay = () => {
  const { session, user, loading } = useAuth();
  const [storageKeys, setStorageKeys] = useState<string[]>([]);
  const [lastError, setLastError] = useState<string>('');

  useEffect(() => {
    const interval = setInterval(() => {
      setStorageKeys(Object.keys(localStorage));
      // @ts-ignore
      if (window.lastAuthError) setLastError(JSON.stringify(window.lastAuthError));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  if (process.env.NODE_ENV === 'production') return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '10px',
      right: '10px',
      background: 'rgba(0,0,0,0.85)',
      color: '#0f0',
      padding: '12px',
      borderRadius: '8px',
      fontSize: '11px',
      fontFamily: 'monospace',
      zIndex: 9999,
      maxWidth: '350px',
      pointerEvents: 'none',
      border: '1px solid #00ff00',
      boxShadow: '0 0 10px rgba(0,255,0,0.2)'
    }}>
      <div style={{ borderBottom: '1px solid #333', marginBottom: '5px', paddingBottom: '2px' }}><strong>DEBUG HOST: 5173</strong></div>
      <div>STATUS: {loading ? '⌛ LOADING' : (session ? '✅ LOGGED IN' : '❌ LOGGED OUT')}</div>
      <div>USER: {user?.email || 'N/A'}</div>

      {lastError && (
        <div style={{ color: '#ff4444', marginTop: '5px', fontWeight: 'bold' }}>
          LAST ERROR: {lastError.substring(0, 50)}...
        </div>
      )}

      <div style={{ marginTop: '8px', borderTop: '1px solid #333', paddingTop: '4px' }}>
        <strong>Start Logged Keys:</strong>
        {storageKeys.filter(k => k.includes('sb-') || k.includes('token')).map(k => (
          <div key={k} style={{ color: '#aaa' }}>{k.substring(0, 35)}...</div>
        ))}
        {storageKeys.length === 0 && <div style={{ color: '#888' }}>(No storage keys found)</div>}
      </div>
    </div>
  );
};

function App() {
  const { theme } = useTheme();
  const { session, loading, user } = useAuth();
  usePushNotifications();
  const isOnline = useNetworkStatus();


  React.useEffect(() => {
    // Hide splash screen after app mounts AND auth is ready
    const hideSplash = async () => {
      if (!loading) {
        await SplashScreen.hide();
      }
    };
    hideSplash();
  }, [loading]);

  React.useEffect(() => {
    // Request Notification permission on app start to trigger Android 13+ prompt
    if ("Notification" in window) {
      Notification.requestPermission().then((permission) => {
        console.log("Notification permission status:", permission);
      }).catch(err => {
        console.error("Error requesting notification permission:", err);
      });
    }
  }, []);

  return (
    <>
      {!isOnline && (
        <div className="bg-red-500 text-white text-xs py-1 px-2 text-center fixed top-0 w-full z-[9999] animate-in slide-in-from-top">
          <div className="flex items-center justify-center gap-2">
            <WifiOff size={12} />
            <span>No Internet Connection</span>
          </div>
        </div>
      )}
      <Routes>
        <Route path="/my-bag" element={<ProtectedRoute><MyBag /></ProtectedRoute>} />
        <Route path="/welcome" element={<Welcome />} />
        <Route path="/login" element={<Login />} />

        <Route
          path="/chat/:id"
          element={
            <ProtectedRoute>
              <ChatRoom />
            </ProtectedRoute>
          }
        />
        {/* ... other routes ... */}
        <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        <Route path="/settings/notifications" element={<ProtectedRoute><NotificationSettings /></ProtectedRoute>} />
        <Route path="/settings/privacy" element={<ProtectedRoute><PrivacySettings /></ProtectedRoute>} />
        <Route path="/settings/privacy/blocked" element={<ProtectedRoute><BlockedUsers /></ProtectedRoute>} />
        <Route path="/settings/security" element={<ProtectedRoute><SecuritySettings /></ProtectedRoute>} />
        <Route path="/settings/data" element={<ProtectedRoute><DataSettings /></ProtectedRoute>} />
        <Route path="/settings/appearance" element={<ProtectedRoute><AppearanceSettings /></ProtectedRoute>} />
        <Route path="/edit-profile" element={<ProtectedRoute><EditProfile /></ProtectedRoute>} />
        <Route path="/space/:id" element={<ProtectedRoute><SpaceDetail /></ProtectedRoute>} />
        <Route path="/space/:id/chat" element={<ProtectedRoute><SpaceChatRoom /></ProtectedRoute>} />
        <Route path="/user/:id" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />
        <Route path="/*" element={<ProtectedRoute><MainApp /></ProtectedRoute>} />
      </Routes>
    </>
  );
};


export default App;
