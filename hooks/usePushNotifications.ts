import { useEffect } from 'react';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';

export const usePushNotifications = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { setFcmToken, setPermissionStatus } = useNotifications();

    useEffect(() => {
        if (!Capacitor.isNativePlatform()) {
            setPermissionStatus('web/non-native');
            return;
        }

        const registerNotifications = async () => {
            let permStatus = await PushNotifications.checkPermissions();

            if (permStatus.receive === 'prompt') {
                permStatus = await PushNotifications.requestPermissions();
            }

            setPermissionStatus(permStatus.receive);

            if (permStatus.receive !== 'granted') {
                console.log('User denied permissions!');
                return;
            }

            await PushNotifications.createChannel({
                id: 'default',
                name: 'Default Channel',
                description: 'General Notifications',
                importance: 5,
                visibility: 1,
                vibration: true,
            });

            await PushNotifications.register();
        };

        const addListeners = async () => {
            await PushNotifications.removeAllListeners();

            await PushNotifications.addListener('registration', async token => {
                console.log('Push registration success, token: ' + token.value);
                setFcmToken(token.value);

                if (user) {
                    const { error } = await supabase
                        .from('profiles')
                        .upsert({ id: user.id, fcm_token: token.value }, { onConflict: 'id' })
                        .select();

                    if (error) {
                        console.error("Error saving FCM token:", error);
                    } else {
                        console.log("FCM Token saved/updated for user:", user.id);
                    }
                }
            });

            await PushNotifications.addListener('registrationError', err => {
                console.error('Push registration error: ', err.error);
                setFcmToken(null);
            });

            await PushNotifications.addListener('pushNotificationReceived', notification => {
                console.log('Push received: ', notification);
                const title = notification.title || 'No Title';
                const body = notification.body || 'No Body';
                // Only alert if we want to debug foreground
                // alert(`Foreground Notification:\nTitle: ${title}\nBody: ${body}`);
            });

            await PushNotifications.addListener('pushNotificationActionPerformed', notification => {
                console.log('Push action performed: ', notification);
                const data = notification.notification.data;
                if (data.url) {
                    navigate(data.url);
                }
            });
        };

        registerNotifications();
        addListeners();

        return () => {
            if (Capacitor.isNativePlatform()) {
                PushNotifications.removeAllListeners();
            }
        };

    }, [navigate, user, setFcmToken, setPermissionStatus]);
};
