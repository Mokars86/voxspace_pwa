import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell, Mail, Megaphone, Loader2 } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';

const NotificationSettings: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [preferences, setPreferences] = useState({
        email_notifications: true,
        push_notifications: true,
        marketing_notifications: false
    });

    useEffect(() => {
        if (user) fetchPreferences();
    }, [user]);

    const fetchPreferences = async () => {
        try {
            const { data, error } = await supabase
                .from('notification_preferences')
                .select('*')
                .eq('user_id', user?.id)
                .single();

            if (error && error.code !== 'PGRST116') throw error;
            if (data) {
                setPreferences({
                    email_notifications: data.email_notifications,
                    push_notifications: data.push_notifications,
                    marketing_notifications: data.marketing_notifications
                });
            }
        } catch (error) {
            console.error('Error fetching notification preferences:', error);
        } finally {
            setLoading(false);
        }
    };

    const updatePreference = async (key: string, value: boolean) => {
        if (!user) return;
        setPreferences(prev => ({ ...prev, [key]: value }));

        try {
            const { error } = await supabase
                .from('notification_preferences')
                .upsert({
                    user_id: user.id,
                    ...preferences,
                    [key]: value,
                    updated_at: new Date().toISOString()
                });

            if (error) throw error;
        } catch (error) {
            console.error('Error updating preference:', error);
            // Revert on error
            setPreferences(prev => ({ ...prev, [key]: !value }));
        }
    };

    if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-[#ff1744]" /></div>;

    return (
        <div className="flex flex-col h-screen bg-white dark:bg-gray-900 dark:text-gray-100">
            <header className="px-4 py-3 flex items-center gap-3 border-b border-gray-100 dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-900 z-10">
                <button onClick={() => navigate(-1)} className="text-gray-600 dark:text-gray-300 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full">
                    <ArrowLeft size={24} />
                </button>
                <h1 className="text-xl font-bold">Notifications</h1>
            </header>

            <div className="p-4 space-y-6">
                <div className="bg-gray-50 dark:bg-gray-950 p-4 rounded-2xl space-y-6">
                    <ToggleItem
                        icon={<Bell size={24} />}
                        label="Push Notifications"
                        description="Receive alerts on your device"
                        checked={preferences.push_notifications}
                        onChange={(v) => updatePreference('push_notifications', v)}
                    />
                    <ToggleItem
                        icon={<Mail size={24} />}
                        label="Email Notifications"
                        description="Receive digests and updates via email"
                        checked={preferences.email_notifications}
                        onChange={(v) => updatePreference('email_notifications', v)}
                    />
                    <ToggleItem
                        icon={<Megaphone size={24} />}
                        label="Marketing"
                        description="Receive news and special offers"
                        checked={preferences.marketing_notifications}
                        onChange={(v: boolean) => updatePreference('marketing_notifications', v)}
                    />
                </div>

                {/* Sound Settings */}
                <div className="bg-gray-50 dark:bg-gray-950 p-4 rounded-2xl space-y-4">
                    <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-2">Message Sounds</h3>
                    <SoundSelector />
                </div>

                {/* Debug / Diagnostics */}
                {process.env.NODE_ENV === 'development' || true ? ( // Always show for now to debug
                    <div className="bg-gray-50 dark:bg-gray-950 p-4 rounded-2xl space-y-4 border border-blue-100 dark:border-blue-900">
                        <h3 className="font-bold text-blue-600 dark:text-blue-400 mb-2 flex items-center gap-2">
                            <Loader2 size={16} /> Debug Diagnostics
                        </h3>
                        <DebugSection />
                    </div>
                ) : null}
            </div>
        </div>
    );
};

const DebugSection = () => {
    const { fcmToken, permissionStatus } = useNotifications();
    const { user } = useAuth();
    const [sending, setSending] = useState(false);
    const [result, setResult] = useState<string>('');

    const sendTest = async () => {
        if (!user || !fcmToken) return;
        setSending(true);
        setResult('Sending...');
        try {
            const { data, error } = await supabase.functions.invoke('push-notification', {
                body: {
                    type: 'test',
                    record: {
                        user_id: user.id, // For test logic
                        content: 'This is a test notification'
                    }
                }
            });

            if (error) throw error;
            setResult('Success: ' + JSON.stringify(data));
        } catch (e: any) {
            setResult('Error: ' + e.message);
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="space-y-3 text-sm">
            <div className="flex justify-between">
                <span className="text-gray-500">Permission:</span>
                <span className={`font-mono ${permissionStatus === 'granted' ? 'text-green-600' : 'text-red-500'}`}>
                    {permissionStatus}
                </span>
            </div>
            <div className="flex justify-between items-center">
                <span className="text-gray-500">FCM Token:</span>
                <span className={`font-mono text-xs truncate max-w-[150px] ${fcmToken ? 'text-green-600' : 'text-orange-500'}`}>
                    {fcmToken ? 'Present' : 'Missing'}
                </span>
            </div>
            {fcmToken && (
                <div className="pt-2">
                    <button
                        onClick={sendTest}
                        disabled={sending}
                        className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center gap-2"
                    >
                        {sending ? <Loader2 className="animate-spin" size={16} /> : <Bell size={16} />}
                        Send Test Notification
                    </button>
                    {result && (
                        <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-900 rounded text-xs break-all font-mono">
                            {result}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

import { useNotifications } from '../../context/NotificationContext';
import { Volume2 } from 'lucide-react';

const SoundSelector = () => {
    const { sentMessageSound, setSentMessageSound } = useNotifications();

    const sounds = [
        { id: 'pop', name: 'Pop' },
        { id: 'chime', name: 'Chime' },
        { id: 'level_up', name: 'Level Up' },
        { id: 'airbus', name: 'Airbus' },
        { id: 'none', name: 'None' },
    ];

    const playPreview = (soundId: string) => {
        if (soundId === 'none') return;
        const audio = new Audio(`/sounds/${soundId}.mp3`);
        audio.play().catch(e => console.error("Error playing sound", e));
    };

    return (
        <div className="space-y-2">
            {sounds.map((sound) => (
                <button
                    key={sound.id}
                    onClick={() => {
                        setSentMessageSound(sound.id);
                        playPreview(sound.id);
                    }}
                    className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${sentMessageSound === sound.id
                        ? 'bg-white dark:bg-gray-800 border-2 border-[#ff1744] shadow-sm'
                        : 'bg-white dark:bg-gray-900 border border-transparent hover:bg-gray-100 dark:hover:bg-gray-800'
                        }`}
                >
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${sentMessageSound === sound.id ? 'bg-[#ff1744]/10 text-[#ff1744]' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>
                            <Volume2 size={20} />
                        </div>
                        <span className={`font-medium ${sentMessageSound === sound.id ? 'text-[#ff1744]' : 'text-gray-700 dark:text-gray-300'}`}>
                            {sound.name}
                        </span>
                    </div>
                    {sentMessageSound === sound.id && (
                        <div className="w-4 h-4 rounded-full bg-[#ff1744] shadow-sm" />
                    )}
                </button>
            ))}
        </div>
    );
};

const ToggleItem = ({ icon, label, description, checked, onChange }: any) => (
    <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
            <div className="p-2 bg-white dark:bg-gray-900 rounded-xl shadow-sm text-gray-700 dark:text-gray-300">
                {icon}
            </div>
            <div>
                <p className="font-bold text-sm text-gray-900 dark:text-gray-100">{label}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>
            </div>
        </div>
        <button
            onClick={() => onChange(!checked)}
            className={`w-12 h-6 rounded-full p-1 transition-colors ${checked ? 'bg-[#ff1744]' : 'bg-gray-300 dark:bg-gray-700'}`}
        >
            <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${checked ? 'translate-x-6' : 'translate-x-0'}`} />
        </button>
    </div>
);

export default NotificationSettings;
