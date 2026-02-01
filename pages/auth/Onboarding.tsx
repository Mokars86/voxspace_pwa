import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, ArrowRight, Check, Shield, Bell, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabase';

const Onboarding: React.FC = () => {
    const navigate = useNavigate();
    const { user, refreshProfile } = useAuth();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Step 1: Profile
    const [username, setUsername] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [avatarUrl, setAvatarUrl] = useState('');
    const [uploading, setUploading] = useState(false);

    // Step 2: Interests
    const [selectedInterests, setSelectedInterests] = useState<string[]>([]);

    const interests = [
        "Tech & AI", "Music", "Art & Design", "Politics",
        "Science", "Gaming", "Movies", "Startups",
        "Crypto", "Health", "Travel", "Food"
    ];

    const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        try {
            setUploading(true);
            if (!event.target.files || event.target.files.length === 0) {
                return;
            }

            const file = event.target.files[0];
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random()}.${fileExt}`;
            const filePath = `${fileName}`;

            // Upload to 'VoxSpace_App' bucket
            let { error: uploadError } = await supabase.storage
                .from('VoxSpace_App')
                .upload(filePath, file);

            if (uploadError) {
                throw uploadError;
            }

            const { data } = supabase.storage
                .from('VoxSpace_App')
                .getPublicUrl(filePath);

            setAvatarUrl(data.publicUrl);
        } catch (error: any) {
            console.error('Error uploading avatar:', error.message);
            alert('Error uploading avatar: ' + error.message);
        } finally {
            setUploading(false);
        }
    };

    const handleNext = async () => {
        if (!user) return;
        setLoading(true);

        try {
            if (step === 1) {
                // Save Profile Data Immediately
                const updates = {
                    id: user.id,
                    username,
                    full_name: displayName,
                    avatar_url: avatarUrl,
                    updated_at: new Date().toISOString(),
                };
                const { error } = await supabase.from('profiles').upsert(updates);
                if (error) throw error;
                await refreshProfile(); // Sync context
                setStep(2);
            } else if (step === 2) {
                // Could save interests here if we had a table for it
                setStep(3);
            } else if (step === 3) {
                // Finalize
                // Just force redirect since profile is already saved
                window.location.href = '/';
            }
        } catch (error: any) {
            console.error('Error in onboarding:', error.message);
            alert('Error: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-screen bg-background text-foreground overflow-y-auto">
            <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full p-6 min-h-[600px]">
                {/* Progress Bars */}
                <div className="flex gap-2 mb-8">
                    {[1, 2, 3].map(i => (
                        <div key={i} className={cn("h-1 flex-1 rounded-full transition-colors", step >= i ? "bg-[#ff1744]" : "bg-gray-100 dark:bg-gray-800")} />
                    ))}
                </div>

                {step === 1 && (
                    <div className="animate-in slide-in-from-right duration-300">
                        <h1 className="text-3xl font-bold mb-2">Setup Profile</h1>
                        <p className="text-gray-500 mb-8">Let's verify your identity.</p>

                        <div className="flex flex-col items-center mb-8">
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="w-24 h-24 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center text-gray-400 relative overflow-hidden active:scale-95 transition-transform"
                                disabled={uploading}
                            >
                                {avatarUrl ? (
                                    <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                                ) : (
                                    uploading ? <Loader2 className="animate-spin" /> : <Camera size={32} />
                                )}
                            </button>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleAvatarUpload}
                                className="hidden"
                                accept="image/*"
                            />
                            <p className="text-sm font-medium text-[#ff1744] mt-2">
                                {uploading ? 'Uploading...' : 'Upload Photo'}
                            </p>
                        </div>

                        <div className="space-y-4">
                            <input
                                type="text"
                                placeholder="Display Name"
                                value={displayName}
                                onChange={e => setDisplayName(e.target.value)}
                                className="w-full p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-transparent focus:border-[#ff1744]/20 outline-none font-semibold text-gray-900 dark:text-white placeholder:text-gray-400"
                            />
                            <input
                                type="text"
                                placeholder="@username"
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                className="w-full p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-transparent focus:border-[#ff1744]/20 outline-none font-semibold text-gray-900 dark:text-white placeholder:text-gray-400"
                            />
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div className="animate-in slide-in-from-right duration-300">
                        <h1 className="text-3xl font-bold mb-2">Your Interests</h1>
                        <p className="text-gray-500 mb-8">Pick 3 or more topics you like.</p>

                        <div className="flex flex-wrap gap-3">
                            {interests.map(topic => (
                                <button
                                    key={topic}
                                    onClick={() => {
                                        if (selectedInterests.includes(topic)) {
                                            setSelectedInterests(selectedInterests.filter(t => t !== topic));
                                        } else {
                                            setSelectedInterests([...selectedInterests, topic]);
                                        }
                                    }}
                                    className={cn(
                                        "px-4 py-2 rounded-full font-medium text-sm border transition-all",
                                        selectedInterests.includes(topic)
                                            ? "bg-[#ff1744] text-white border-[#ff1744]"
                                            : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                                    )}
                                >
                                    {topic}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {step === 3 && (
                    <div className="animate-in slide-in-from-right duration-300">
                        <h1 className="text-3xl font-bold mb-2">Preferences</h1>
                        <p className="text-gray-500 mb-8">Control your privacy and notifications.</p>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-white dark:bg-gray-700 rounded-xl shadow-sm"><Shield size={20} className="text-blue-500" /></div>
                                    <div className="text-left">
                                        <p className="font-bold text-gray-900 dark:text-white">Private Account</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">Only followers see your posts</p>
                                    </div>
                                </div>
                                <div className="w-12 h-6 bg-gray-200 dark:bg-gray-700 rounded-full relative">
                                    <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm" />
                                </div>
                            </div>

                            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-white dark:bg-gray-700 rounded-xl shadow-sm"><Bell size={20} className="text-orange-500" /></div>
                                    <div className="text-left">
                                        <p className="font-bold text-gray-900 dark:text-white">Notifications</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">Push notifications enabled</p>
                                    </div>
                                </div>
                                <div className="w-12 h-6 bg-[#ff1744] rounded-full relative">
                                    <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm" />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <button
                onClick={handleNext}
                disabled={step === 1 && !displayName}
                className="w-full py-4 text-white bg-[#ff1744] disabled:opacity-50 hover:bg-[#d50000] rounded-2xl font-bold text-lg transition-all shadow-lg shadow-red-200 mt-8 flex items-center justify-center gap-2"
            >
                {loading ? "Saving..." : (step === 3 ? "Complete Setup" : "Continue")}
                {!loading && <ArrowRight size={20} />}
            </button>
        </div>
    );
};

export default Onboarding;
