import React, { useEffect, useState } from 'react';
import { useNotifications } from '../context/NotificationContext';
import { X, MessageCircle, Heart, User, Bell, Users, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const NotificationToast = () => {
    const { latestNotification, setLatestNotification, markAsRead } = useNotifications();
    const [visible, setVisible] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        if (latestNotification) {
            setVisible(true);
            const timer = setTimeout(() => {
                setVisible(false);
                setTimeout(() => setLatestNotification(null), 300); // Clear after fade out
            }, 4000);
            return () => clearTimeout(timer);
        }
    }, [latestNotification, setLatestNotification]);

    if (!latestNotification) return null;

    const getIcon = () => {
        switch (latestNotification.type) {
            case 'message': return <MessageCircle size={18} />;
            case 'like': return <Heart size={18} />;
            case 'follow': return <User size={18} />;
            // @ts-ignore
            case 'space_post': return <Users size={18} />;
            // @ts-ignore
            case 'space_event': return <Calendar size={18} />;
            default: return <Bell size={18} />;
        }
    };

    const handleClick = () => {
        markAsRead(latestNotification.id);
        setVisible(false);
        setLatestNotification(null);

        if (latestNotification.data?.chat_id) {
            navigate(`/chat/${latestNotification.data.chat_id}`);
        } else if (latestNotification.data?.space_id) {
            navigate(`/space/${latestNotification.data.space_id}`);
        } else if (latestNotification.data?.post_id) {
            // Navigate to post detail? Or just feed.
            // Assuming we have a post detail page or anchor, but for now feed/profile handles it.
            // If it's a comment/like on a post, maybe navigate to post?
            // Current routes support /space/:id but maybe not /post/:id yet?
            // If user profile:
            if (latestNotification.actor_id) navigate(`/user/${latestNotification.actor_id}`);
        } else if (latestNotification.actor_id) {
            navigate(`/user/${latestNotification.actor_id}`);
        }
    };

    return (
        <div
            className={`fixed top-4 left-4 right-4 z-[9999] md:left-auto md:right-4 md:w-96 transition-all duration-300 transform ${visible ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0 pointer-events-none'}`}
        >
            <div
                onClick={handleClick}
                className="bg-card/90 backdrop-blur-md border border-primary/20 p-4 rounded-xl shadow-lg flex items-start gap-4 cursor-pointer hover:bg-card/100 transition-colors"
                style={{ backdropFilter: 'blur(12px)' }}
            >
                <div className="w-10 h-10 rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0">
                    {getIcon()}
                </div>
                <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-sm text-foreground truncate">{latestNotification.title}</h4>
                    <p className="text-sm text-muted-foreground line-clamp-2">{latestNotification.content}</p>
                </div>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setVisible(false);
                        setLatestNotification(null);
                    }}
                    className="text-muted-foreground hover:text-foreground"
                >
                    <X size={18} />
                </button>
            </div>
        </div>
    );
};
