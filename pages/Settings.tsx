import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Shield, Bell, Moon, Globe, Database, Lock, LogOut, ChevronRight, Loader2, MessageSquare } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { useLanguage } from '../context/LanguageContext';
import LanguageModal from '../components/LanguageModal';

const Settings: React.FC = () => {
    const navigate = useNavigate();
    const { signOut, deleteAccount } = useAuth();
    const { language, setLanguage, t } = useLanguage();
    const [showLangModal, setShowLangModal] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDeleteAccount = async () => {
        if (window.confirm("Are you sure you want to delete your account? This action cannot be undone and you will lose all your data.")) {
            setIsDeleting(true);
            try {
                await deleteAccount();
                navigate('/welcome');
            } catch (error) {
                alert("Failed to delete account. Please try again.");
                setIsDeleting(false);
            }
        }
    };

    const handleLogout = async () => {
        await signOut();
        navigate('/welcome');
    };

    return (
        <div className="flex flex-col h-screen bg-white dark:bg-gray-900 transition-colors">
            <header className="px-4 py-3 flex items-center gap-3 border-b border-gray-100 dark:border-gray-800 z-10 bg-white dark:bg-gray-900 sticky top-0">
                <button onClick={() => navigate(-1)} className="text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded-full">
                    <ArrowLeft size={24} />
                </button>
                <h1 className="text-xl font-bold dark:text-white">{t('headers.settings')}</h1>
            </header>

            <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-950">
                <div className="p-4 space-y-6">

                    <SettingsSection title="Account">
                        <div onClick={() => navigate('/edit-profile')}>
                            <SettingsItem icon={<User size={20} />} label="Account Information" />
                        </div>
                        <div onClick={() => navigate('/settings/privacy')}>
                            <SettingsItem icon={<Shield size={20} />} label="Privacy" />
                        </div>
                        <div onClick={() => navigate('/settings/security')}>
                            <SettingsItem icon={<Lock size={20} />} label="Security" />
                        </div>
                    </SettingsSection>

                    <SettingsSection title="Preferences">
                        <div onClick={() => navigate('/settings/notifications')}>
                            <SettingsItem icon={<Bell size={20} />} label={t('headers.notifications')} />
                        </div>
                        <div onClick={() => navigate('/settings/chats')}>
                            <SettingsItem icon={<MessageSquare size={20} />} label="Chats" />
                        </div>
                        <div onClick={() => navigate('/settings/appearance')}>
                            <SettingsItem icon={<Moon size={20} />} label="Appearance" value="Mode" />
                        </div>
                        <div onClick={() => setShowLangModal(true)}>
                            <SettingsItem icon={<Globe size={20} />} label="Language" value={language} />
                        </div>
                    </SettingsSection>

                    <SettingsSection title="Data">
                        <div onClick={() => navigate('/settings/data')}>
                            <SettingsItem icon={<Database size={20} />} label="Data Usage" />
                        </div>
                    </SettingsSection>

                    <button
                        onClick={handleLogout}
                        className="w-full bg-white dark:bg-gray-900 p-4 rounded-2xl flex items-center gap-3 text-red-600 font-bold shadow-sm active:scale-[0.98] transition-all hover:bg-red-50 dark:hover:bg-red-900/10"
                    >
                        <LogOut size={20} />
                        Log Out
                    </button>

                    <button
                        onClick={handleDeleteAccount}
                        disabled={isDeleting}
                        className="w-full bg-white dark:bg-gray-900 p-4 rounded-2xl flex items-center gap-3 text-red-600 font-bold shadow-sm active:scale-[0.98] transition-all hover:bg-red-50 dark:hover:bg-red-900/10 mt-4"
                    >
                        {isDeleting ? <Loader2 className="animate-spin" size={20} /> : <LogOut size={20} />}
                        {isDeleting ? "Deleting..." : "Delete Account"}
                    </button>

                    <p className="text-center text-xs text-gray-400 mt-4">
                        VoxSpace v1.0.0
                    </p>
                </div>
            </div>

            {showLangModal && (
                <LanguageModal
                    onClose={() => setShowLangModal(false)}
                    currentLanguage={language}
                    onUpdate={(lang) => setLanguage(lang)}
                />
            )}
        </div>
    );
};

const SettingsSection = ({ title, children }: { title: string, children: React.ReactNode }) => (
    <div>
        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2 ml-2">{title}</h3>
        <div className="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-sm divide-y divide-gray-50 dark:divide-gray-800">
            {children}
        </div>
    </div>
);

const SettingsItem = ({ icon, label, value }: { icon: React.ReactNode, label: string, value?: string }) => (
    <button className="w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
        <div className="flex items-center gap-3">
            <div className="text-gray-400 dark:text-gray-500">{icon}</div>
            <span className="font-medium text-gray-900 dark:text-gray-100">{label}</span>
        </div>
        <div className="flex items-center gap-2">
            {value && <span className="text-sm text-gray-400 dark:text-gray-500">{value}</span>}
            <ChevronRight size={18} className="text-gray-300 dark:text-gray-600" />
        </div>
    </button>
);

export default Settings;
