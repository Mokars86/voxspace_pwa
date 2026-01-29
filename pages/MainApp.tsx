import React, { useState, useEffect } from 'react';
import {
    MessageCircle,
    Rss,
    Users,
    Search,
    User,
    Plus,
    Bell,
    X,
    Zap
} from 'lucide-react';
import { TabType } from '../types';
import FeedView from '../components/FeedView';
import ChatView from '../components/ChatView';
import SpacesView from '../components/SpacesView';
import DiscoverView from '../components/DiscoverView';
import ProfileView from '../components/ProfileView';
import CreateModal from '../components/CreateModal';
import { useLanguage } from '../context/LanguageContext';
import { useNotifications } from '../context/NotificationContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../services/supabase';

import { PWAInstallPrompt } from '../components/PWAInstallPrompt';

const MainApp: React.FC = () => {
    const { t } = useLanguage();
    const { unreadCount: globalUnreadCount, notifications, markAsRead, markAllAsRead } = useNotifications();
    const navigate = useNavigate();
    const location = useLocation();

    // Determine initial tab from URL or default to feed
    const getTabFromPath = () => {
        // Robust path parsing: handle leading/trailing slashes
        const parts = location.pathname.split('/').filter(p => p.length > 0);
        const path = parts[0] || 'feed';

        if (['feed', 'chats', 'spaces', 'discover', 'profile'].includes(path)) {
            return path as TabType;
        }
        return 'feed';
    };

    const [activeTab, setActiveTab] = useState<TabType>(getTabFromPath());
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);

    // Sync Tab with URL Path Changes (e.g. back button)
    useEffect(() => {
        const tab = getTabFromPath();
        if (tab !== activeTab) {
            setActiveTab(tab);
        }
    }, [location.pathname]);

    // -- Badge State --
    const [newPostCount, setNewPostCount] = useState(0);
    const [lastViewedFeed, setLastViewedFeed] = useState(() => localStorage.getItem('lastViewedFeed') || new Date().toISOString());

    // 1. Calculate Badge Counts
    const chatBadgeCount = notifications.filter(n => n.type === 'message' && !n.is_read).length;
    // Note: globalUnreadCount might be more accurate if context sums up unread messages from logic
    // For now using context notifications filter as base, or we can use globalUnreadCount if it represents messages.
    // Actually globalUnreadCount in context is just filter(!is_read).length. 
    // But we want to separate "Chat Messages" from "Feed/System" notifications.

    // Feed Badges: Comments + Likes + Follows + New Posts
    const feedNotificationCount = notifications.filter(n =>
        (n.type === 'like' || n.type === 'comment' || n.type === 'follow') && !n.is_read
    ).length;

    const feedBadgeCount = feedNotificationCount + newPostCount;

    // 2. Fetch New Posts Logic
    useEffect(() => {
        const checkNewPosts = async () => {
            // Count posts created AFTER lastViewedFeed
            // Limit check to last 24h to avoid massive queries on old accounts
            const { count, error } = await supabase
                .from('posts')
                .select('*', { count: 'exact', head: true })
                .gt('created_at', lastViewedFeed);

            if (!error && count) {
                setNewPostCount(count);
            }
        };

        checkNewPosts();

        // Optional: Interval to check periodically? Or rely on realtime if we added it for feed
        const interval = setInterval(checkNewPosts, 60000); // Check every minute
        return () => clearInterval(interval);
    }, [lastViewedFeed]);

    // 3. Handle Tab Change (Clear Badges)
    const handleTabChange = (tab: TabType) => {
        setActiveTab(tab);
        // Navigate to update URL
        navigate(tab === 'feed' ? '/' : `/${tab}`);

        if (tab === 'feed') {
            const now = new Date().toISOString();
            setLastViewedFeed(now);
            localStorage.setItem('lastViewedFeed', now);
            setNewPostCount(0);
        }
    };


    const renderContent = () => {
        switch (activeTab) {
            case 'feed': return <FeedView />;
            case 'chats': return <ChatView />;
            case 'spaces': return <SpacesView />;
            case 'discover': return <DiscoverView />;
            case 'profile': return <ProfileView />;

            default: return <FeedView />;
        }
    };

    return (
        <div className="flex bg-background h-screen w-full overflow-hidden text-foreground">
            {/* Desktop Sidebar Navigation */}
            <aside className="hidden md:flex w-64 flex-col border-r border-border bg-card pb-4">
                <div className="p-6 flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-red-500/20">
                        <Zap size={24} className="text-white fill-white" />
                    </div>
                    <h1 className="text-2xl font-bold tracking-tighter">
                        <span className="text-foreground">Vox</span><span className="text-primary">Space</span>
                    </h1>
                </div>

                <div className="flex-1 px-4 space-y-2 mt-4">
                    <NavButtonDesktop
                        active={activeTab === 'feed'}
                        onClick={() => handleTabChange('feed')}
                        icon={<Rss size={24} />}
                        label={t('nav.feed')}
                        badge={feedBadgeCount}
                    />
                    <NavButtonDesktop
                        active={activeTab === 'chats'}
                        onClick={() => handleTabChange('chats')}
                        icon={<MessageCircle size={24} />}
                        label={t('nav.chats')}
                        badge={chatBadgeCount}
                    />
                    <NavButtonDesktop active={activeTab === 'spaces'} onClick={() => handleTabChange('spaces')} icon={<Users size={24} />} label={t('nav.spaces')} />
                    <NavButtonDesktop active={activeTab === 'discover'} onClick={() => handleTabChange('discover')} icon={<Search size={24} />} label={t('nav.discover')} />
                    <NavButtonDesktop active={activeTab === 'profile'} onClick={() => handleTabChange('profile')} icon={<User size={24} />} label={t('nav.profile')} />
                </div>


            </aside>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col h-full relative min-w-0 bg-background md:max-w-2xl lg:max-w-4xl md:border-r border-border shadow-sm mx-auto md:mx-0 w-full">
                {/* Mobile Header (Hidden on Desktop if desired, but let's keep consistent for now or hide title) */}
                <header className="px-4 py-3 flex items-center justify-between border-b border-border bg-background sticky top-0 z-10 w-full md:hidden">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center shadow-sm">
                            <Zap size={16} className="text-white fill-white" />
                        </div>
                        <h1 className="text-2xl font-bold tracking-tighter">
                            <span className="text-foreground">Vox</span><span className="text-primary">Space</span>
                        </h1>
                    </div>
                    <div className="flex items-center space-x-4">

                        <button
                            onClick={() => setShowNotifications(true)}
                            className="p-1.5 rounded-full text-muted-foreground relative"
                        >
                            <Bell size={22} />
                            {globalUnreadCount > 0 && (
                                <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full animate-pulse"></span>
                            )}
                        </button>
                    </div>
                </header>

                {/* Content */}
                <main className="flex-1 overflow-y-auto w-full bg-background">
                    {renderContent()}
                </main>

                {/* Mobile Bottom Nav */}
                <nav className="md:hidden flex items-center justify-around py-3 border-t border-border bg-background/90 backdrop-blur-md safe-bottom sticky bottom-0 z-10 w-full">
                    <NavButton
                        active={activeTab === 'chats'}
                        onClick={() => handleTabChange('chats')}
                        icon={<MessageCircle size={24} />}
                        label={t('nav.chats')}
                        badge={chatBadgeCount}
                    />
                    <NavButton
                        active={activeTab === 'feed'}
                        onClick={() => handleTabChange('feed')}
                        icon={<Rss size={24} />}
                        label={t('nav.feed')}
                        badge={feedBadgeCount}
                    />
                    <NavButton active={activeTab === 'spaces'} onClick={() => handleTabChange('spaces')} icon={<Users size={24} />} label={t('nav.spaces')} />
                    <NavButton active={activeTab === 'discover'} onClick={() => handleTabChange('discover')} icon={<Search size={24} />} label={t('nav.discover')} />
                    <NavButton active={activeTab === 'profile'} onClick={() => handleTabChange('profile')} icon={<User size={24} />} label={t('nav.profile')} />
                </nav>
            </div>

            {/* Desktop Right Sidebar (Widgets) - Optional, fills space */}
            <div className="hidden lg:block w-80 p-6 border-l border-border bg-muted/30 overflow-y-auto">
                <div className="mb-6">
                    <h3 className="font-bold text-muted-foreground mb-4 uppercase text-xs tracking-wider">{t('sidebar.suggested')}</h3>
                    {/* Placeholder Widgets */}
                    <div className="space-y-4">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-muted" />
                                <div>
                                    <div className="w-24 h-3 bg-muted rounded mb-1" />
                                    <div className="w-16 h-2 bg-muted rounded" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="p-4 bg-gradient-to-br from-primary to-pink-600 rounded-2xl text-white shadow-lg">
                    <h3 className="font-bold text-lg mb-1">{t('sidebar.premium')}</h3>
                    <p className="text-sm text-white/90 mb-3">{t('sidebar.premium_desc')}</p>
                    <button className="w-full py-2 bg-white text-primary font-bold rounded-xl text-sm">{t('sidebar.upgrade')}</button>
                </div>
            </div>

            {/* FAB (Mobile & Desktop? Maybe just Desktop floating or inline) */}
            <button
                onClick={() => setShowCreateModal(true)}
                className="fixed bottom-20 right-4 md:bottom-10 md:right-10 w-14 h-14 bg-primary text-white rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-transform z-20 hover:scale-105"
            >
                <Plus size={30} strokeWidth={3} />
            </button>

            {/* Modals and Overlays */}
            <PWAInstallPrompt />
            {showCreateModal && <CreateModal onClose={() => setShowCreateModal(false)} />}
            {showNotifications && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex justify-end md:justify-center md:items-center">
                    <div className="w-full max-w-md h-full md:h-2/3 bg-background md:rounded-2xl flex flex-col animate-in slide-in-from-right md:zoom-in-95 duration-200 shadow-2xl">
                        <div className="p-4 border-b border-border flex items-center justify-between">
                            <h2 className="text-xl font-bold text-foreground">Notifications</h2>
                            <button onClick={() => setShowNotifications(false)} className="text-foreground"><X /></button>
                        </div>
                        <div className="flex-1 p-4 space-y-4 overflow-y-auto">
                            {notifications.length > 0 ? (
                                notifications.map(notif => (
                                    <div
                                        key={notif.id}
                                        onClick={() => {
                                            markAsRead(notif.id);
                                            if (notif.data?.chat_id) {
                                                navigate(`/chat/${notif.data.chat_id}`);
                                                setShowNotifications(false);
                                            } else if (notif.type === 'like' || notif.type === 'follow') {
                                                if (notif.actor_id) {
                                                    navigate(`/user/${notif.actor_id}`);
                                                    setShowNotifications(false);
                                                }
                                            }
                                        }}
                                        className={`flex space-x-3 items-start border-b border-border pb-4 cursor-pointer hover:bg-muted/50 p-2 rounded-xl transition-colors ${!notif.is_read ? 'bg-primary/10' : ''}`}
                                    >
                                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary flex-shrink-0">
                                            {notif.type === 'message' ? <MessageCircle size={18} /> :
                                                notif.type === 'like' ? <Zap size={18} /> :
                                                    notif.type === 'follow' ? <User size={18} /> :
                                                        <Bell size={18} />}
                                        </div>
                                        <div>
                                            <p className="text-sm text-foreground">
                                                <span className="font-bold">{notif.title}</span> {notif.content}
                                            </p>
                                            <p className="text-xs text-muted-foreground mt-1">{new Date(notif.created_at).toLocaleTimeString()} · {new Date(notif.created_at).toLocaleDateString()}</p>
                                        </div>
                                        {!notif.is_read && <div className="w-2 h-2 bg-primary rounded-full mt-2" />}
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-10 text-muted-foreground">
                                    <Bell size={32} className="mx-auto mb-2 opacity-20" />
                                    No notifications
                                </div>
                            )}
                        </div>
                        {notifications.length > 0 && globalUnreadCount > 0 && (
                            <div className="p-4 border-t border-border sticky bottom-0 bg-background rounded-b-2xl">
                                <button onClick={markAllAsRead} className="w-full py-3 text-sm font-bold text-muted-foreground hover:text-foreground">
                                    Mark all as read
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

interface NavButtonProps {
    active: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
    badge?: number;
}

const NavButton: React.FC<NavButtonProps> = ({ active, onClick, icon, label, badge }) => (
    <button
        onClick={onClick}
        className={`flex flex-col items-center transition-all relative ${active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
    >
        <div className="relative">
            {icon}
            {badge !== undefined && badge > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 flex items-center justify-center bg-primary text-white text-[9px] font-bold rounded-full px-0.5 border-2 border-white dark:border-gray-900">
                    {badge > 99 ? '99+' : badge}
                </span>
            )}
        </div>
        <span className="text-[10px] mt-1 font-medium">{label}</span>
    </button>
);

const NavButtonDesktop: React.FC<NavButtonProps> = ({ active, onClick, icon, label, badge }) => (
    <button
        onClick={onClick}
        className={`flex items-center gap-4 w-full p-3 rounded-xl transition-all relative group ${active
            ? 'bg-primary/10 text-primary font-bold'
            : 'text-muted-foreground hover:bg-muted'
            }`}
    >
        <div className="relative">
            {icon}
            {badge !== undefined && badge > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 flex items-center justify-center bg-primary text-white text-[9px] font-bold rounded-full px-0.5 border-2 border-white dark:border-gray-900">
                    {badge > 99 ? '99+' : badge}
                </span>
            )}
        </div>
        <span className="text-lg flex-1 text-left">{label}</span>
        {badge !== undefined && badge > 0 && (
            <span className="bg-primary text-white text-xs px-2 py-0.5 rounded-full font-bold shadow-sm">
                {badge > 99 ? '99+' : badge}
            </span>
        )}
    </button>
);

export default MainApp;
