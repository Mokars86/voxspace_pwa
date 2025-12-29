import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Welcome from './pages/auth/Welcome';
import Login from './pages/auth/Login';
import MainApp from './pages/MainApp';
import { Loader2 } from 'lucide-react';

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

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-white text-[#ff1744]">
        <Loader2 size={40} className="animate-spin" />
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

const App: React.FC = () => {
  return (
    <LanguageProvider>
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
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/notifications"
          element={
            <ProtectedRoute>
              <NotificationSettings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/privacy"
          element={
            <ProtectedRoute>
              <PrivacySettings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/security"
          element={
            <ProtectedRoute>
              <SecuritySettings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/appearance"
          element={
            <ProtectedRoute>
              <AppearanceSettings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/edit-profile"
          element={
            <ProtectedRoute>
              <EditProfile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/space/:id"
          element={
            <ProtectedRoute>
              <SpaceDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/space/:id/chat"
          element={
            <ProtectedRoute>
              <SpaceChatRoom />
            </ProtectedRoute>
          }
        />
        <Route
          path="/user/:id"
          element={
            <ProtectedRoute>
              <UserProfile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <MainApp />
            </ProtectedRoute>
          }
        />
      </Routes>
    </LanguageProvider>
  );
};


export default App;
