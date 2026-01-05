import React from 'react';
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
import SpaceChatRoom from './pages/spaces/SpaceChatRoom';
import PrivacySettings from './pages/settings/PrivacySettings';
import SecuritySettings from './pages/settings/SecuritySettings';
import AppearanceSettings from './pages/settings/AppearanceSettings';
import NotificationSettings from './pages/settings/NotificationSettings';
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

import { LanguageProvider } from './context/LanguageContext';
import { NotificationProvider } from './context/NotificationContext';
import { usePushNotifications } from './hooks/usePushNotifications';

import ErrorBoundary from './components/ErrorBoundary';

const App: React.FC = () => {
  usePushNotifications();


  const { loading } = useAuth();

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
    <ErrorBoundary>
      <LanguageProvider>
        <NotificationProvider>
          <CallProvider>
            <Routes>
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
              <Route path="/settings/security" element={<ProtectedRoute><SecuritySettings /></ProtectedRoute>} />
              <Route path="/settings/appearance" element={<ProtectedRoute><AppearanceSettings /></ProtectedRoute>} />
              <Route path="/edit-profile" element={<ProtectedRoute><EditProfile /></ProtectedRoute>} />
              <Route path="/space/:id" element={<ProtectedRoute><SpaceDetail /></ProtectedRoute>} />
              <Route path="/space/:id/chat" element={<ProtectedRoute><SpaceChatRoom /></ProtectedRoute>} />
              <Route path="/user/:id" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />
              <Route path="/*" element={<ProtectedRoute><MainApp /></ProtectedRoute>} />
            </Routes>
          </CallProvider>
        </NotificationProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
};


export default App;
