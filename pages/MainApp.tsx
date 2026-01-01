import React, { useState } from 'react';
import {
    MessageCircle,
    Rss,
    Users,
    Search,
    User,
    Plus,
    Wallet,
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
import WalletView from '../components/WalletView';
import CreateModal from '../components/CreateModal';
import { useLanguage } from '../context/LanguageContext';
import { useNotifications } from '../context/NotificationContext';
import { useNavigate } from 'react-router-dom';

const MainApp: React.FC = () => {
    const { t } = useLanguage();
    const { unreadCount, notifications, markAsRead, markAllAsRead } = useNotifications();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<TabType>('feed');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);

    const renderContent = () => {
        switch (activeTab) {
            case 'feed': return <FeedView />;
            case 'chats': return <ChatView />;
            case 'spaces': return <SpacesView />;
            case 'discover': return <DiscoverView />;
            case 'profile': return <ProfileView />;
            case 'wallet': return <WalletView />;
            default: return <FeedView />;
        }
    };

    return (
        <div className="flex bg-gray-50 dark:bg-gray-950 h-screen w-full overflow-hidden">
            {/* Desktop Sidebar Navigation */}
            <aside className="hidden md:flex w-64 flex-col border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 pb-4">
                <div className="p-6 flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#ff1744] rounded-xl flex items-center justify-center shadow-lg shadow-red-500/20">
                        <Zap size={24} className="text-white fill-white" />
                    </div>
                    <h1 className="text-2xl font-bold tracking-tighter">
                        <span className="text-black dark:text-white">Vox</span><span className="text-[#ff1744]">Space</span>
                    </h1>
                </div>

                <div className="flex-1 px-4 space-y-2 mt-4">
                    <NavButtonDesktop active={activeTab === 'feed'} onClick={() => setActiveTab('feed')} icon={<Rss size={24} />} label={t('nav.feed')} />
                    <NavButtonDesktop active={activeTab === 'chats'} onClick={() => setActiveTab('chats')} icon={<MessageCircle size={24} />} label={t('nav.chats')} />
                    <NavButtonDesktop active={activeTab === 'spaces'} onClick={() => setActiveTab('spaces')} icon={<Users size={24} />} label={t('nav.spaces')} />
                    <NavButtonDesktop active={activeTab === 'discover'} onClick={() => setActiveTab('discover')} icon={<Search size={24} />} label={t('nav.discover')} />
                    <NavButtonDesktop active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} icon={<User size={24} />} label={t('nav.profile')} />
                </div>

                <div className="px-4">
                    <NavButtonDesktop active={activeTab === 'wallet'} onClick={() => setActiveTab('wallet')} icon={<Wallet size={24} />} label={t('nav.wallet')} />
                </div>
            </aside>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col h-full relative min-w-0 bg-white dark:bg-gray-900 md:max-w-2xl lg:max-w-4xl md:border-r border-gray-200 dark:border-gray-800 shadow-sm mx-auto md:mx-0 w-full">
                {/* Mobile Header (Hidden on Desktop if desired, but let's keep consistent for now or hide title) */}
                <header className="px-4 py-3 flex items-center justify-between border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 sticky top-0 z-10 w-full md:hidden">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-[#ff1744] rounded-full flex items-center justify-center shadow-sm">
                            <Zap size={16} className="text-white fill-white" />
                        </div>
                        <h1 className="text-2xl font-bold tracking-tighter">
                            <span className="text-black dark:text-white">Vox</span><span className="text-[#ff1744]">Space</span>
                        </h1>
                    </div>
                    <div className="flex items-center space-x-4">
                        <button
                            onClick={() => setActiveTab('wallet')}
                            className={`p-1.5 rounded-full transition-colors ${activeTab === 'wallet' ? 'bg-red-50 dark:bg-red-900/20 text-[#ff1744]' : 'text-gray-600 dark:text-gray-400'}`}
                        >
                            <Wallet size={22} />
                        </button>
                        <button
                            onClick={() => setShowNotifications(true)}
                            className="p-1.5 rounded-full text-gray-600 dark:text-gray-400 relative"
                        >
                            <Bell size={22} />
                            {unreadCount > 0 && (
                                <span className="absolute top-1 right-1 w-2 h-2 bg-[#ff1744] rounded-full animate-pulse"></span>
                            )}
                        </button>
                    </div>
                </header>

                {/* Content */}
                <main className="flex-1 overflow-y-auto w-full">
                    {renderContent()}
                </main>

                {/* Mobile Bottom Nav */}
                <nav className="md:hidden flex items-center justify-around py-3 border-t border-gray-100 dark:border-gray-800 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md safe-bottom sticky bottom-0 z-10 w-full">
                    <NavButton active={activeTab === 'chats'} onClick={() => setActiveTab('chats')} icon={<MessageCircle size={24} />} label={t('nav.chats')} />
                    <NavButton active={activeTab === 'feed'} onClick={() => setActiveTab('feed')} icon={<Rss size={24} />} label={t('nav.feed')} />
                    <NavButton active={activeTab === 'spaces'} onClick={() => setActiveTab('spaces')} icon={<Users size={24} />} label={t('nav.spaces')} />
                    <NavButton active={activeTab === 'discover'} onClick={() => setActiveTab('discover')} icon={<Search size={24} />} label={t('nav.discover')} />
                    <NavButton active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} icon={<User size={24} />} label={t('nav.profile')} />
                </nav>
            </div>

            {/* Desktop Right Sidebar (Widgets) - Optional, fills space */}
            <div className="hidden lg:block w-80 p-6 border-l border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 overflow-y-auto">
                <div className="mb-6">
                    <h3 className="font-bold text-gray-500 mb-4 uppercase text-xs tracking-wider">{t('sidebar.suggested')}</h3>
                    {/* Placeholder Widgets */}
                    <div className="space-y-4">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-800" />
                                <div>
                                    <div className="w-24 h-3 bg-gray-200 dark:bg-gray-800 rounded mb-1" />
                                    <div className="w-16 h-2 bg-gray-200 dark:bg-gray-800 rounded" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="p-4 bg-gradient-to-br from-[#ff1744] to-pink-600 rounded-2xl text-white shadow-lg">
                    <h3 className="font-bold text-lg mb-1">{t('sidebar.premium')}</h3>
                    <p className="text-sm text-white/90 mb-3">{t('sidebar.premium_desc')}</p>
                    <button className="w-full py-2 bg-white text-[#ff1744] font-bold rounded-xl text-sm">{t('sidebar.upgrade')}</button>
                </div>
            </div>

            {/* FAB (Mobile & Desktop? Maybe just Desktop floating or inline) */}
            <button
                onClick={() => setShowCreateModal(true)}
                className="fixed bottom-20 right-4 md:bottom-10 md:right-10 w-14 h-14 bg-[#ff1744] text-white rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-transform z-20 hover:scale-105"
            >
                <Plus size={30} strokeWidth={3} />
            </button>

            {/* Modals & Overlays */}
            {showCreateModal && <CreateModal onClose={() => setShowCreateModal(false)} />}
            {showNotifications && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex justify-end md:justify-center md:items-center">
                    <div className="w-full max-w-md h-full md:h-2/3 bg-white dark:bg-gray-900 md:rounded-2xl flex flex-col animate-in slide-in-from-right md:zoom-in-95 duration-200 shadow-2xl">
                        <div className="p-4 border-b dark:border-gray-800 flex items-center justify-between">
                            <h2 className="text-xl font-bold dark:text-white">Notifications</h2>
                            <button onClick={() => setShowNotifications(false)} className="dark:text-white"><X /></button>
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
                                        className={`flex space-x-3 items-start border-b border-gray-50 dark:border-gray-800 pb-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 p-2 rounded-xl transition-colors ${!notif.is_read ? 'bg-red-50/50 dark:bg-red-900/10' : ''}`}
                                    >
                                        <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-[#ff1744] flex-shrink-0">
                                            {notif.type === 'message' ? <MessageCircle size={18} /> :
                                                notif.type === 'like' ? <Zap size={18} /> :
                                                    notif.type === 'follow' ? <User size={18} /> :
                                                        <Bell size={18} />}
                                        </div>
                                        <div>
                                            <p className="text-sm dark:text-gray-200">
                                                <span className="font-bold">{notif.title}</span> {notif.content}
                                            </p>
                                            <p className="text-xs text-gray-400 mt-1">{new Date(notif.created_at).toLocaleTimeString()} · {new Date(notif.created_at).toLocaleDateString()}</p>
                                        </div>
                                        {!notif.is_read && <div className="w-2 h-2 bg-[#ff1744] rounded-full mt-2" />}
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-10 text-gray-400">
                                    <Bell size={32} className="mx-auto mb-2 opacity-20" />
                                    No notifications
                                </div>
                            )}
                        </div>
                        {notifications.length > 0 && unreadCount > 0 && (
                            <div className="p-4 border-t dark:border-gray-800 sticky bottom-0 bg-white dark:bg-gray-900 rounded-b-2xl">
                                <button onClick={markAllAsRead} className="w-full py-3 text-sm font-bold text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">
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
}

const NavButton: React.FC<NavButtonProps> = ({ active, onClick, icon, label }) => (
    <button
        onClick={onClick}
        className={`flex flex-col items-center transition-all ${active ? 'text-[#ff1744]' : 'text-gray-400 hover:text-gray-600'}`}
    >
        {icon}
        <span className="text-[10px] mt-1 font-medium">{label}</span>
    </button>
);

const NavButtonDesktop: React.FC<NavButtonProps> = ({ active, onClick, icon, label }) => (
    <button
        onClick={onClick}
        className={`flex items-center gap-4 w-full p-3 rounded-xl transition-all ${active
            ? 'bg-red-50 dark:bg-red-900/10 text-[#ff1744] font-bold'
            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
    >
        {icon}
        <span className="text-lg">{label}</span>
    </button>
);

export default MainApp;
