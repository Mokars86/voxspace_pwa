import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Lock, Eye, Shield, Users, Clock, Image as ImageIcon, Info, ChevronRight, Loader2 } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';

type PrivacyLevel = 'everyone' | 'contacts' | 'nobody';

const PrivacySettings: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);

    // Privacy States
    const [lastSeenPrivacy, setLastSeenPrivacy] = useState<PrivacyLevel>('everyone');
    const [profilePhotoPrivacy, setProfilePhotoPrivacy] = useState<PrivacyLevel>('everyone');
    const [aboutPrivacy, setAboutPrivacy] = useState<PrivacyLevel>('everyone');
    const [onlineStatusPrivacy, setOnlineStatusPrivacy] = useState<PrivacyLevel>('everyone');
    const [readReceipts, setReadReceipts] = useState(true);

    // Disappearing Messages Default
    const [defaultTimer, setDefaultTimer] = useState<number>(0); // 0 = off
    const [showTimerModal, setShowTimerModal] = useState(false);

    useEffect(() => {
        if (!user) return;
        fetchSettings();
    }, [user]);

    const fetchSettings = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('profiles')
                .select('last_seen_privacy, profile_photo_privacy, about_privacy, online_status_privacy') // Add read_receipts if exists in schema
                .eq('id', user?.id)
                .single();

            if (data) {
                setLastSeenPrivacy(data.last_seen_privacy as PrivacyLevel || 'everyone');
                setProfilePhotoPrivacy(data.profile_photo_privacy as PrivacyLevel || 'everyone');
                setAboutPrivacy(data.about_privacy as PrivacyLevel || 'everyone');
                setOnlineStatusPrivacy(data.online_status_privacy as PrivacyLevel || 'everyone');
                // setReadReceipts(data.read_receipts); // Assuming column exists or using local storage for now if not in DB
            }
        } catch (error) {
            console.error('Error fetching privacy settings:', error);
        } finally {
            setLoading(false);
        }
    };

    const updateSetting = async (column: string, value: string | boolean | number) => {
        if (!user) return;
        try {
            // Optimistic update
            const { error } = await supabase
                .from('profiles')
                .update({ [column]: value })
                .eq('id', user.id);

            if (error) throw error;
        } catch (error) {
            console.error(`Error updating ${column}:`, error);
            // Revert state if needed (skipped for brevity)
        }
    };

    if (loading) {
        return (
            <div className="h-screen flex items-center justify-center bg-white dark:bg-black">
                <Loader2 className="animate-spin text-[#ff1744]" size={32} />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-[#f0f2f5] dark:bg-black">
            <header className="px-4 py-3 flex items-center gap-3 border-b border-gray-100 dark:border-gray-800 sticky top-0 bg-white/80 dark:bg-black/80 backdrop-blur-md z-10 transition-colors">
                <button onClick={() => navigate(-1)} className="text-gray-600 dark:text-gray-300 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                    <ArrowLeft size={24} />
                </button>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">Privacy</h1>
            </header>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">

                {/* Who can see my personal info */}
                <section>
                    <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 ml-2">Who can see my personal info</h3>
                    <div className="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-800 divide-y divide-gray-50 dark:divide-gray-800">
                        <PrivacySelect
                            icon={<Eye size={20} />}
                            label="Last Seen"
                            value={lastSeenPrivacy}
                            onChange={(val) => { setLastSeenPrivacy(val); updateSetting('last_seen_privacy', val); }}
                        />
                        <PrivacySelect
                            icon={<ImageIcon size={20} />}
                            label="Profile Photo"
                            value={profilePhotoPrivacy}
                            onChange={(val) => { setProfilePhotoPrivacy(val); updateSetting('profile_photo_privacy', val); }}
                        />
                        <PrivacySelect
                            icon={<Info size={20} />}
                            label="About"
                            value={aboutPrivacy}
                            onChange={(val) => { setAboutPrivacy(val); updateSetting('about_privacy', val); }}
                        />
                        <PrivacySelect
                            icon={<div className="w-5 h-5 rounded-full border-2 border-current flex items-center justify-center text-[10px] font-bold">ON</div>}
                            label="Online Status"
                            value={onlineStatusPrivacy}
                            onChange={(val) => { setOnlineStatusPrivacy(val); updateSetting('online_status_privacy', val); }}
                        />
                    </div>
                </section>

                {/* Messaging */}
                <section>
                    <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 ml-2">Messaging</h3>
                    <div className="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-800 divide-y divide-gray-50 dark:divide-gray-800">
                        <ToggleItem
                            icon={<Shield size={20} />}
                            label="Read Receipts"
                            description="If turned off, you won't send or receive Read Receipts."
                            checked={readReceipts}
                            onChange={(val) => { setReadReceipts(val); /* updateSetting('read_receipts', val); */ }}
                        />
                        <div className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer" onClick={() => setShowTimerModal(true)}>
                            <div className="flex items-center gap-3">
                                <div className="text-gray-400 dark:text-gray-500"><Clock size={20} /></div>
                                <div>
                                    <span className="font-medium text-gray-900 dark:text-white block">Default Message Timer</span>
                                    <span className="text-xs text-gray-400 dark:text-gray-500">
                                        {defaultTimer === 0 ? "Off" :
                                            defaultTimer === 24 * 60 * 60 ? "24 Hours" :
                                                defaultTimer === 7 * 24 * 60 * 60 ? "7 Days" :
                                                    defaultTimer === 90 * 24 * 60 * 60 ? "90 Days" : "Custom"}
                                    </span>
                                </div>
                            </div>
                            <ChevronRight size={20} className="text-gray-300 dark:text-gray-600" />
                        </div>
                    </div>
                </section>

                {showTimerModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                        <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-sm overflow-hidden shadow-xl animate-in zoom-in-95 duration-200">
                            <div className="p-4 border-b border-gray-100 dark:border-gray-800">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Default Message Timer</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    New chats will start with this timer set.
                                </p>
                            </div>
                            <div className="p-2">
                                {[
                                    { label: '24 Hours', value: 24 * 60 * 60 },
                                    { label: '7 Days', value: 7 * 24 * 60 * 60 },
                                    { label: '90 Days', value: 90 * 24 * 60 * 60 },
                                    { label: 'Off', value: 0 },
                                ].map((option) => (
                                    <button
                                        key={option.value}
                                        onClick={() => {
                                            setDefaultTimer(option.value);
                                            // updateSetting('default_msg_timer', option.value); 
                                            setShowTimerModal(false);
                                        }}
                                        className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                                    >
                                        <span className="text-gray-900 dark:text-white font-medium">{option.label}</span>
                                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${defaultTimer === option.value ? 'border-[#ff1744] bg-[#ff1744]' : 'border-gray-300 dark:border-gray-600'}`}>
                                            {defaultTimer === option.value && <div className="w-2 h-2 bg-white rounded-full" />}
                                        </div>
                                    </button>
                                ))}
                            </div>
                            <div className="p-4 bg-gray-50 dark:bg-gray-800/50 text-center">
                                <button onClick={() => setShowTimerModal(false)} className="text-[#ff1744] font-medium text-sm">Cancel</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Connections */}
                <section>
                    <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 ml-2">Connections</h3>
                    <div className="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-800 divide-y divide-gray-50 dark:divide-gray-800">
                        <button
                            onClick={() => navigate('/settings/privacy/blocked')}
                            className="w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
                        >
                            <div className="flex items-center gap-3">
                                <div className="text-gray-400 dark:text-gray-500"><Users size={20} /></div>
                                <div>
                                    <span className="font-medium text-gray-900 dark:text-white block">Blocked Contacts</span>
                                    <span className="text-xs text-gray-400 dark:text-gray-500">Manage blocked users</span>
                                </div>
                            </div>
                            <ChevronRight size={20} className="text-gray-300 dark:text-gray-600" />
                        </button>
                    </div>
                </section>

            </div>
        </div>
    );
};

// Helper Components

interface PrivacySelectProps {
    icon: React.ReactNode;
    label: string;
    value: PrivacyLevel;
    onChange: (value: PrivacyLevel) => void;
}

const PrivacySelect: React.FC<PrivacySelectProps> = ({ icon, label, value, onChange }) => {
    return (
        <div className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group">
            <div className="flex items-center gap-3">
                <div className="text-gray-400 dark:text-gray-500 group-hover:text-[#ff1744] transition-colors">{icon}</div>
                <span className="font-medium text-gray-900 dark:text-white">{label}</span>
            </div>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value as PrivacyLevel)}
                className="bg-transparent text-sm text-gray-500 dark:text-gray-400 focus:outline-none focus:text-[#ff1744] cursor-pointer text-right"
            >
                <option value="everyone">Everyone</option>
                <option value="contacts">My Contacts</option>
                <option value="nobody">Nobody</option>
            </select>
        </div>
    );
};

interface ToggleItemProps {
    icon: React.ReactNode;
    label: string;
    description: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
}

const ToggleItem: React.FC<ToggleItemProps> = ({ icon, label, description, checked, onChange }) => (
    <div className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
        <div className="flex items-center gap-3">
            <div className="text-gray-400 dark:text-gray-500">{icon}</div>
            <div>
                <span className="font-medium text-gray-900 dark:text-white block">{label}</span>
                <span className="text-xs text-gray-400 dark:text-gray-500">{description}</span>
            </div>
        </div>
        <button
            onClick={() => onChange(!checked)}
            className={`w-11 h-6 rounded-full transition-colors relative ${checked ? 'bg-[#ff1744]' : 'bg-gray-200 dark:bg-gray-700'}`}
        >
            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
    </div>
);

export default PrivacySettings;
