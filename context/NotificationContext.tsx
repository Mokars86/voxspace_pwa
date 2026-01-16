import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from './AuthContext';

export interface Notification {
    id: string;
    type: 'message' | 'like' | 'follow' | 'system';
    title: string;
    content: string;
    data?: any;
    is_read: boolean;
    created_at: string;
    actor_id?: string;
}

interface NotificationContextType {
    notifications: Notification[];
    unreadCount: number;
    markAsRead: (id: string) => Promise<void>;
    markAllAsRead: () => Promise<void>;
    markChatNotificationsAsRead: (chatId: string) => Promise<void>;
    loading: boolean;
    sentMessageSound: string;
    setSentMessageSound: (sound: string) => void;
    // Debug / Diagnostics
    fcmToken: string | null;
    setFcmToken: (token: string | null) => void;
    permissionStatus: string;
    setPermissionStatus: (status: string) => void;
    activeChatId: string | null;
    setActiveChatId: (id: string | null) => void;
}

const NotificationContext = createContext<NotificationContextType>({
    notifications: [],
    unreadCount: 0,
    markAsRead: async () => { },
    markAllAsRead: async () => { },
    markChatNotificationsAsRead: async () => { },
    loading: true,
    sentMessageSound: 'pop',
    setSentMessageSound: () => { },
    fcmToken: null,
    setFcmToken: () => { },
    permissionStatus: 'unknown',
    activeChatId: null,
    setActiveChatId: () => { },
});

export const NotificationProvider = ({ children }: { children: React.ReactNode }) => {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [sentMessageSound, setSentMessageSound] = useState<string>(() => {
        return localStorage.getItem('sentMessageSound') || 'pop';
    });
    const [fcmToken, setFcmToken] = useState<string | null>(null);
    const [permissionStatus, setPermissionStatus] = useState<string>('unknown');
    const [activeChatId, setActiveChatId] = useState<string | null>(null);

    useEffect(() => {
        localStorage.setItem('sentMessageSound', sentMessageSound);
    }, [sentMessageSound]);

    const fetchNotifications = async () => {
        if (!user) return;
        try {
            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;
            setNotifications(data || []);
        } catch (err) {
            console.error("Error fetching notifications:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!user) {
            setNotifications([]);
            return;
        }

        fetchNotifications();

        // Realtime Subscription
        const channel = supabase
            .channel('public:notifications')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${user.id}`,
                },
                (payload) => {
                    const newNotif = payload.new as Notification;

                    // Auto-read if in active chat
                    let shouldMarkRead = false;
                    if (activeChatId && newNotif.data?.chat_id === activeChatId) {
                        newNotif.is_read = true;
                        shouldMarkRead = true;
                    }

                    setNotifications((prev) => [newNotif, ...prev]);

                    if (shouldMarkRead) {
                        // Background sync to DB
                        supabase
                            .from('notifications')
                            .update({ is_read: true })
                            .eq('id', newNotif.id)
                            .then(({ error }) => {
                                if (error) console.error("Auto-read sync failed", error);
                            });
                    } else {
                        // Only vibrate/sound if NOT reading it right now
                        if (navigator.vibrate) navigator.vibrate(200);
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${user.id}`,
                },
                (payload) => {
                    const updatedNotif = payload.new as Notification;
                    setNotifications(prev => prev.map(n => n.id === updatedNotif.id ? updatedNotif : n));
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, activeChatId]); // Re-subscribe when activeChatId changes to capture correct closure value

    const unreadCount = notifications.filter(n => !n.is_read).length;

    const markAsRead = async (id: string) => {
        // Optimistic update
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));

        await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('id', id);
    };

    const markAllAsRead = async () => {
        // Optimistic update
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));

        if (user) {
            await supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('user_id', user.id)
                .eq('is_read', false);
        }
    };

    const markChatNotificationsAsRead = async (chatId: string) => {
        // 1. Identify IDs to mark as read from local state
        const idsToMark = notifications
            .filter(n => !n.is_read && n.data?.chat_id === chatId)
            .map(n => n.id);

        if (idsToMark.length === 0) return; // Nothing to do

        // 2. Optimistic Update
        setNotifications(prev => prev.map(n => {
            if (idsToMark.includes(n.id)) {
                return { ...n, is_read: true };
            }
            return n;
        }));

        // 3. Explicit DB Update by IDs
        if (user) {
            await supabase
                .from('notifications')
                .update({ is_read: true })
                .in('id', idsToMark);
        }
    };

    return (
        <NotificationContext.Provider value={{
            notifications,
            unreadCount,
            markAsRead,
            markAllAsRead,
            markChatNotificationsAsRead,
            loading,
            sentMessageSound,
            setSentMessageSound,
            fcmToken,
            setFcmToken,
            permissionStatus,
            setPermissionStatus,
            activeChatId,
            setActiveChatId
        }}>
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotifications = () => useContext(NotificationContext);
