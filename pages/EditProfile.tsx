import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Camera, Loader2, Save } from 'lucide-react';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';

const EditProfile: React.FC = () => {
    const navigate = useNavigate();
    const { user, refreshProfile } = useAuth();
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);

    const [formData, setFormData] = useState({
        full_name: '',
        username: '',
        bio: '',
        website: '',
        avatar_url: '',
        banner_url: ''
    });

    const fileInputRef = useRef<HTMLInputElement>(null);
    const bannerInputRef = useRef<HTMLInputElement>(null);

    const [hasUsername, setHasUsername] = useState(false);

    useEffect(() => {
        const loadProfile = async () => {
            if (!user) return;
            const { data } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            if (data) {
                setFormData({
                    full_name: data.full_name || '',
                    username: data.username || '',
                    bio: data.bio || '',
                    website: data.website || '',
                    avatar_url: data.avatar_url || '',
                    banner_url: data.banner_url || ''
                });
                if (data.username) {
                    setHasUsername(true);
                }
            }
        };
        loadProfile();
    }, [user]);

    const handleSave = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    full_name: formData.full_name,
                    username: formData.username,
                    bio: formData.bio,
                    website: formData.website,
                    avatar_url: formData.avatar_url,
                    banner_url: formData.banner_url,
                    updated_at: new Date().toISOString()
                })
                .eq('id', user.id);

            if (error) throw error;

            await refreshProfile();
            await refreshProfile();
            navigate(`/user/${user.id}`); // Go back to profile
        } catch (error) {
            console.error('Error updating profile:', error);
            alert('Failed to update profile');
        } finally {
            setLoading(false);
        }
    };

    const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        try {
            if (!event.target.files || event.target.files.length === 0 || !user) return;
            setUploading(true);

            const file = event.target.files[0];
            const fileExt = file.name.split('.').pop();
            const fileName = `avatar-${user.id}-${Math.random()}.${fileExt}`;
            const filePath = `${fileName}`; // Upload to root of bucket or a folder

            const { error: uploadError } = await supabase.storage
                .from('VoxSpace_App')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data } = supabase.storage
                .from('VoxSpace_App')
                .getPublicUrl(filePath);

            setFormData(prev => ({ ...prev, avatar_url: data.publicUrl }));
        } catch (error: any) {
            alert('Error uploading avatar: ' + error.message);
        } finally {
            setUploading(false);
        }
    };

    const handleBannerUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        try {
            if (!event.target.files || event.target.files.length === 0 || !user) return;
            setUploading(true);

            const file = event.target.files[0];
            const fileExt = file.name.split('.').pop();
            const fileName = `banner-${user.id}-${Math.random()}.${fileExt}`;
            const filePath = `${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('VoxSpace_App')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data } = supabase.storage
                .from('VoxSpace_App')
                .getPublicUrl(filePath);

            setFormData(prev => ({ ...prev, banner_url: data.publicUrl }));
        } catch (error: any) {
            alert('Error uploading banner: ' + error.message);
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="flex flex-col h-screen bg-white">
            <header className="px-4 py-3 flex items-center justify-between border-b border-gray-100 sticky top-0 bg-white z-10">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate(-1)} className="text-gray-600 p-2 hover:bg-gray-100 rounded-full">
                        <ArrowLeft size={24} />
                    </button>
                    <h1 className="text-xl font-bold">Edit Profile</h1>
                </div>
                <button
                    onClick={handleSave}
                    disabled={loading}
                    className="text-[#ff1744] font-bold text-sm bg-red-50 px-4 py-2 rounded-full hover:bg-red-100 disabled:opacity-50"
                >
                    {loading ? <Loader2 className="animate-spin" size={20} /> : 'Save'}
                </button>
            </header>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {/* Header Section */}
                <div className="relative mb-16">
                    {/* Banner */}
                    <div
                        className="w-full h-48 bg-gray-100 dark:bg-gray-800 relative group cursor-pointer overflow-hidden border-b border-gray-200 dark:border-gray-800"
                        onClick={() => bannerInputRef.current?.click()}
                    >
                        {formData.banner_url ? (
                            <img src={formData.banner_url} alt="Banner" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-gray-400 bg-gray-100 dark:bg-gray-800">
                                <Camera size={32} />
                                <span className="text-xs font-bold">Add Banner</span>
                            </div>
                        )}

                        {/* Banner Overlay */}
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Camera className="text-white" size={32} />
                        </div>
                    </div>

                    {/* Edit Banner Button (Top Right) */}
                    <button
                        onClick={(e) => { e.stopPropagation(); bannerInputRef.current?.click(); }}
                        className="absolute top-4 right-4 bg-black/30 backdrop-blur-md text-white text-xs font-bold py-1.5 px-3 rounded-full hover:bg-black/50 transition-colors z-20"
                    >
                        Edit Banner
                    </button>

                    <input
                        type="file"
                        ref={bannerInputRef}
                        onChange={handleBannerUpload}
                        className="hidden"
                        accept="image/*"
                    />

                    {/* Avatar (Overlapping Bottom Left) */}
                    <div className="absolute -bottom-14 left-4 z-20">
                        <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                            <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-white dark:border-gray-900 bg-gray-100 shadow-sm">
                                <img
                                    src={formData.avatar_url || `https://ui-avatars.com/api/?name=${formData.full_name}`}
                                    className="w-full h-full object-cover"
                                    alt="Avatar"
                                />
                            </div>
                            <div className="absolute inset-0 bg-black/30 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Camera className="text-white" size={24} />
                            </div>
                            {uploading && (
                                <div className="absolute inset-0 bg-white/80 rounded-full flex items-center justify-center">
                                    <Loader2 className="animate-spin text-[#ff1744]" />
                                </div>
                            )}
                        </div>
                        <button
                            onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                            className="absolute bottom-1 right-1 bg-gray-900 text-white p-2 rounded-full border-2 border-white dark:border-gray-900 hover:bg-black transition-colors shadow-sm"
                            title="Change Avatar"
                        >
                            <Camera size={14} />
                        </button>
                    </div>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleAvatarUpload}
                        className="hidden"
                        accept="image/*"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase">Full Name</label>
                    <input
                        type="text"
                        value={formData.full_name}
                        onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                        className="w-full p-4 bg-gray-50 rounded-xl font-bold text-gray-900 border-none focus:ring-1 focus:ring-[#ff1744]"
                        placeholder="Your Name"
                    />
                </div>

                <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase flex justify-between">
                        Username
                        {hasUsername && <span className="text-xs text-red-500 normal-case">Cannot be changed</span>}
                    </label>
                    <input
                        type="text"
                        value={formData.username}
                        onChange={e => setFormData({ ...formData, username: e.target.value })}
                        className={`w-full p-4 bg-gray-50 rounded-xl font-bold text-gray-900 border-none focus:ring-1 focus:ring-[#ff1744] ${hasUsername ? 'opacity-60 cursor-not-allowed bg-gray-100 text-gray-500' : ''}`}
                        placeholder="@username"
                        disabled={hasUsername}
                    />
                </div>

                <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase">Bio</label>
                    <textarea
                        value={formData.bio}
                        onChange={e => setFormData({ ...formData, bio: e.target.value })}
                        className="w-full p-4 bg-gray-50 rounded-xl font-medium text-gray-900 border-none focus:ring-1 focus:ring-[#ff1744] min-h-[100px] resize-none"
                        placeholder="Tell us about yourself..."
                    />
                </div>

                <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase">Website</label>
                    <input
                        type="url"
                        value={formData.website}
                        onChange={e => setFormData({ ...formData, website: e.target.value })}
                        className="w-full p-4 bg-gray-50 rounded-xl font-medium text-gray-900 border-none focus:ring-1 focus:ring-[#ff1744]"
                        placeholder="https://yourwebsite.com"
                    />
                </div>
            </div>
        </div>
    );
};

export default EditProfile;
