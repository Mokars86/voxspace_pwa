import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, Lock, AlertCircle, Loader2, Eye, EyeOff, CheckCheck, User, Camera, AtSign } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';

const Login: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const [fullName, setFullName] = useState('');
    const [username, setUsername] = useState('');
    const [referralCode, setReferralCode] = useState('');
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

    // Forgot Password State
    const [showForgotPassword, setShowForgotPassword] = useState(false);
    const [resetEmail, setResetEmail] = useState('');
    const [resetLoading, setResetLoading] = useState(false);

    React.useEffect(() => {
        if (user) {
            navigate('/');
        }
    }, [user, navigate]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setAvatarFile(file);
            setAvatarPreview(URL.createObjectURL(file));
        }
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setResetLoading(true);
        setError(null);
        setSuccessMessage(null);

        try {
            const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
                redirectTo: window.location.origin,
            });
            if (error) throw error;
            setSuccessMessage("Password reset link sent! Please check your email.");
            setShowForgotPassword(false);
            setResetEmail('');
        } catch (err: any) {
            setError(err.message || "Failed to send reset link");
        } finally {
            setResetLoading(false);
        }
    };

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (isSignUp) {
                // 1. Upload Avatar if selected
                let avatarUrl = '';
                if (avatarFile) {
                    const fileExt = avatarFile.name.split('.').pop();
                    const fileName = `${Math.random()}.${fileExt}`;
                    const filePath = `${fileName}`;

                    const { error: uploadError } = await supabase.storage
                        .from('avatars')
                        .upload(filePath, avatarFile);

                    if (uploadError) throw uploadError;

                    const { data: { publicUrl } } = supabase.storage
                        .from('avatars')
                        .getPublicUrl(filePath);

                    avatarUrl = publicUrl;
                }

                // 2. Sign Up
                const { data, error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            full_name: fullName,
                            username: username,
                            avatar_url: avatarUrl,
                        },
                    },
                });
                if (error) throw error;

                // 3. Update Profile (Manual ensure)
                if (data.user) {
                    let referrerId = null;
                    if (referralCode) {
                        const { data: referrerData } = await supabase
                            .from('profiles')
                            .select('id')
                            .eq('referral_code', referralCode)
                            .single();
                        if (referrerData) {
                            referrerId = referrerData.id;
                        }
                    }

                    // Generate unique referral code for this new user
                    // Simple strategy: First 4 chars of username + 4 random chars
                    const cleanUsername = username.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 5);
                    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
                    const newReferralCode = `${cleanUsername}${randomSuffix}`;

                    const updates = {
                        id: data.user.id,
                        username,
                        full_name: fullName,
                        avatar_url: avatarUrl,
                        updated_at: new Date(),
                        referral_code: newReferralCode,
                        referred_by: referrerId
                    };

                    const { error: profileError } = await supabase
                        .from('profiles')
                        .upsert(updates);

                    if (profileError) {
                        console.error('Profile update error:', profileError);
                        // Don't throw here to avoid blocking auth success, but maybe warn?
                    }
                }

            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
            }
        } catch (err: any) {
            setError(err.message || "An error occurred");
        } finally {
            setLoading(false);
        }
    };





    return (
        <div className="flex flex-col h-screen bg-background text-foreground">
            <header className="p-4">
                <button
                    onClick={() => navigate(-1)}
                    className="w-10 h-10 rounded-full bg-gray-50 dark:bg-gray-800 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                    <ArrowLeft size={20} className="text-gray-900 dark:text-white" />
                </button>
            </header>

            <main className="flex-1 p-8 flex flex-col justify-center">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-foreground mb-2">
                        {isSignUp ? "Create Account" : "Welcome Back"}
                    </h1>
                    <p className="text-gray-500">
                        {isSignUp
                            ? "Sign up to start chatting and exploring."
                            : "Enter your email and password to sign in."}
                    </p>
                </div>

                <form onSubmit={handleAuth} className="space-y-4">
                    {isSignUp && (
                        <>
                            {/* Avatar Picker */}
                            <div className="flex justify-center mb-6">
                                <div className="relative">
                                    <div className="w-24 h-24 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center overflow-hidden border-4 border-white dark:border-gray-700 shadow-lg">
                                        {avatarPreview ? (
                                            <img src={avatarPreview} alt="Profile Preview" className="w-full h-full object-cover" />
                                        ) : (
                                            <User size={40} className="text-gray-400" />
                                        )}
                                    </div>
                                    <label className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-[#ff1744] hover:bg-[#d50000] flex items-center justify-center cursor-pointer transition-colors text-white shadow-md">
                                        <Camera size={14} />
                                        <input
                                            type="file"
                                            className="hidden"
                                            accept="image/*"
                                            onChange={handleFileChange}
                                        />
                                    </label>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1">Full Name</label>
                                <div className="relative">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                                    <input
                                        type="text"
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                        placeholder="John Doe"
                                        className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-800 border-2 border-transparent focus:border-[#ff1744]/20 focus:bg-white dark:focus:bg-gray-900 rounded-2xl outline-none transition-all font-medium text-gray-900 dark:text-white placeholder:text-gray-400"
                                        required={isSignUp}
                                    />
                                </div>
                            </div>

                            {/* Username */}
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1">Username</label>
                                <div className="relative">
                                    <AtSign className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                                    <input
                                        type="text"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        placeholder="johndoe"
                                        className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-800 border-2 border-transparent focus:border-[#ff1744]/20 focus:bg-white dark:focus:bg-gray-900 rounded-2xl outline-none transition-all font-medium text-gray-900 dark:text-white placeholder:text-gray-400"
                                        required={isSignUp}
                                    />
                                </div>
                            </div>

                            {/* Referral Code */}
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1">Referral Code (Optional)</label>
                                <div className="relative">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                                    <input
                                        type="text"
                                        value={referralCode}
                                        onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                                        placeholder="REFERRAL123"
                                        className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-800 border-2 border-transparent focus:border-[#ff1744]/20 focus:bg-white dark:focus:bg-gray-900 rounded-2xl outline-none transition-all font-medium text-gray-900 dark:text-white placeholder:text-gray-400"
                                    />
                                </div>
                            </div>
                        </>
                    )}

                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1">Email Address</label>
                        <div className="relative">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@example.com"
                                className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-800 border-2 border-transparent focus:border-[#ff1744]/20 focus:bg-white dark:focus:bg-gray-900 rounded-2xl outline-none transition-all font-medium text-gray-900 dark:text-white placeholder:text-gray-400"
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1">Password</label>
                        <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full pl-12 pr-12 py-4 bg-gray-50 dark:bg-gray-800 border-2 border-transparent focus:border-[#ff1744]/20 focus:bg-white dark:focus:bg-gray-900 rounded-2xl outline-none transition-all font-medium text-gray-900 dark:text-white placeholder:text-gray-400"
                                required
                                minLength={6}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>
                    </div>

                    {error && (
                        <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-sm flex items-center gap-2 animate-in slide-in-from-top-2 duration-200">
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}

                    {successMessage && (
                        <div className="p-4 bg-green-50 text-green-600 rounded-2xl text-sm flex items-center gap-2 animate-in slide-in-from-top-2 duration-200">
                            <CheckCheck size={16} />
                            {successMessage}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-4 text-white bg-[#ff1744] hover:bg-[#d50000] rounded-2xl font-bold text-lg hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-red-200 disabled:opacity-70 disabled:hover:scale-100 flex items-center justify-center gap-2"
                    >
                        {loading ? <Loader2 size={20} className="animate-spin" /> : null}
                        {isSignUp ? "Create Account" : "Sign In"}
                    </button>
                    {!isSignUp && (
                        <div className="flex justify-end">
                            <button
                                type="button"
                                onClick={() => setShowForgotPassword(true)}
                                className="text-sm font-medium text-gray-500 hover:text-[#ff1744] transition-colors"
                            >
                                Forgot Password?
                            </button>
                        </div>
                    )}
                </form>

                {/* Forgot Password Modal */}
                {showForgotPassword && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                        <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl scale-100 animate-in zoom-in-95 duration-200">
                            <h2 className="text-2xl font-bold text-gray-900 mb-2">Reset Password</h2>
                            <p className="text-gray-500 mb-6">Enter your email address and we'll send you a link to reset your password.</p>

                            <form onSubmit={handleResetPassword} className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-gray-700 ml-1">Email Address</label>
                                    <div className="relative">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                                        <input
                                            type="email"
                                            value={resetEmail}
                                            onChange={(e) => setResetEmail(e.target.value)}
                                            placeholder="you@example.com"
                                            className="w-full pl-12 pr-4 py-4 bg-gray-50 border-2 border-transparent focus:border-[#ff1744]/20 focus:bg-white rounded-2xl outline-none transition-all font-medium text-gray-900"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="flex gap-3 mt-6">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowForgotPassword(false);
                                            setError(null);
                                            setSuccessMessage(null);
                                        }}
                                        className="flex-1 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-2xl font-bold transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={resetLoading}
                                        className="flex-1 py-3 text-white bg-[#ff1744] hover:bg-[#d50000] rounded-2xl font-bold shadow-lg shadow-red-200 disabled:opacity-70 flex items-center justify-center gap-2 transition-all"
                                    >
                                        {resetLoading ? <Loader2 size={18} className="animate-spin" /> : null}
                                        Send Link
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                <div className="mt-6 text-center">
                    <button
                        onClick={() => setIsSignUp(!isSignUp)}
                        className="text-gray-500 font-medium hover:text-[#ff1744] transition-colors"
                    >
                        {isSignUp ? "Already have an account? Sign In" : "Don't have an account? Sign Up"}
                    </button>
                </div>




            </main>
        </div>
    );
};

export default Login;
