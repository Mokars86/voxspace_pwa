import React, { useState, useEffect } from 'react';
import { Share, X, Download } from 'lucide-react';

export const PWAInstallPrompt = () => {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [showPrompt, setShowPrompt] = useState(false);
    const [platform, setPlatform] = useState<'ios' | 'android' | 'desktop'>('desktop');

    useEffect(() => {
        const userAgent = window.navigator.userAgent.toLowerCase();
        const isIos = /iphone|ipad|ipod/.test(userAgent);
        const isAndroid = /android/.test(userAgent);

        if (isIos) setPlatform('ios');
        else if (isAndroid) setPlatform('android');
        else setPlatform('desktop');

        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
        if (isStandalone) return; // Already installed

        // Handlers
        const handleBeforeInstallPrompt = (e: any) => {
            e.preventDefault();
            setDeferredPrompt(e);
            // Show prompt immediately for Android/Desktop if not dismissed
            if (!localStorage.getItem('pwaPromptDismissed')) {
                setShowPrompt(true);
            }
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        // iOS Logic: Show after delay
        if (isIos && !localStorage.getItem('pwaPromptDismissed')) {
            setTimeout(() => setShowPrompt(true), 3000);
        }

        return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    }, []);

    const dismissPrompt = () => {
        setShowPrompt(false);
        localStorage.setItem('pwaPromptDismissed', 'true');
    };

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            setDeferredPrompt(null);
            setShowPrompt(false);
        }
    };

    if (!showPrompt) return null;

    return (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-white dark:bg-gray-800 p-5 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 z-50 animate-in slide-in-from-bottom-5">
            <button
                onClick={dismissPrompt}
                className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
                <X size={20} />
            </button>

            <div className="flex items-start gap-4">
                <img src="/pwa-192x192.png" alt="App Icon" className="w-14 h-14 rounded-xl shadow-md" />
                <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 dark:text-white text-lg">Install VoxSpace</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {platform === 'ios'
                            ? "Install this app on your iPhone for the best experience."
                            : "Add VoxSpace to your home screen for quick access."}
                    </p>
                </div>
            </div>

            {platform === 'ios' ? (
                <div className="mt-4 border-t border-gray-100 dark:border-gray-700 pt-3 space-y-2">
                    <p className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-2">
                        1. Tap the <Share size={16} className="text-blue-500" /> Share button below.
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-2">
                        2. Select <span className="font-medium">"Add to Home Screen"</span>.
                    </p>
                    <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 rotate-45 w-4 h-4 bg-white dark:bg-gray-800 border-r border-b border-gray-200 dark:border-gray-700 md:hidden"></div>
                </div>
            ) : (
                <button
                    onClick={handleInstallClick}
                    className="mt-4 w-full py-2.5 bg-[#ff1744] hover:bg-red-600 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors shadow-sm"
                >
                    <Download size={18} />
                    Install App
                </button>
            )}
        </div>
    );
};
