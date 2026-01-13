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
        avatar_url: ''
    });

    const fileInputRef = useRef<HTMLInputElement>(null);

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
                    avatar_url: data.avatar_url || ''
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
                    updated_at: new Date().toISOString()
                })
                .eq('id', user.id);

            if (error) throw error;

            await refreshProfile();
            navigate('/profile'); // Go back to profile
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
                {/* Avatar Section */}
                <div className="flex flex-col items-center gap-4 py-4">
                    <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                        <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-gray-100 bg-gray-100">
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
                        onClick={() => fileInputRef.current?.click()}
                        className="text-[#ff1744] font-bold text-sm"
                    >
                        Change Photo
                    </button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleAvatarUpload}
                        className="hidden"
                        accept="image/*"
                    />
                </div>

                <div className="space-y-4">
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
        </div>
    );
};

export default EditProfile;
