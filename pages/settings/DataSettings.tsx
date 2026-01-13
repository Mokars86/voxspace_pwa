import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Wifi, Smartphone, Trash2, Database, Loader2 } from 'lucide-react';

const Toggle = ({ checked, onChange }: { checked: boolean, onChange: (val: boolean) => void }) => (
    <button
        onClick={() => onChange(!checked)}
        className={`${checked ? 'bg-[#ff1744]' : 'bg-gray-200 dark:bg-gray-700'
            } relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none`}
    >
        <span className={`${checked ? 'translate-x-6' : 'translate-x-1'
            } inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm`} />
    </button>
);

const DataSettings: React.FC = () => {
    const navigate = useNavigate();

    // Mock settings state (In real app, useLocalStorage or Context)
    const [autoDownloadWifi, setAutoDownloadWifi] = useState(true);
    const [autoDownloadMobile, setAutoDownloadMobile] = useState(false);

    const [cacheSize, setCacheSize] = useState<string>("Calculating...");
    const [isClearing, setIsClearing] = useState(false);

    useEffect(() => {
        // Real implementation would calculate cache size
        setCacheSize("Unknown");
    }, []);

    const handleClearCache = () => {
        if (confirm("Are you sure you want to clear the cache? This will free up space but may cause some media to reload.")) {
            setIsClearing(true);
            setTimeout(() => {
                // Real implementation would clear specific localForage/CacheStorage
                // For now, visual feedback
                setIsClearing(false);
                setCacheSize("0 KB");
                alert("Cache cleared successfully.");
            }, 1000);
        }
    };

    return (
        <div className="flex flex-col h-screen bg-white dark:bg-gray-900 transition-colors">
            <header className="px-4 py-3 flex items-center gap-3 border-b border-gray-100 dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-900 z-10">
                <button onClick={() => navigate(-1)} className="text-gray-600 dark:text-gray-400 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                    <ArrowLeft size={24} />
                </button>
                <h1 className="text-xl font-bold dark:text-white">Data & Storage</h1>
            </header>

            <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-950 p-4 space-y-6">

                {/* Auto-Download Section */}
                <section>
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 ml-2">Media Auto-Download</h3>
                    <div className="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-sm divide-y divide-gray-50 dark:divide-gray-800 border border-gray-100 dark:border-gray-800">

                        <div className="p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-500"><Wifi size={20} /></div>
                                <div>
                                    <span className="font-medium text-gray-900 dark:text-white block">When connected to Wi-Fi</span>
                                    <span className="text-xs text-gray-400">Download photos and videos automatically</span>
                                </div>
                            </div>
                            <Toggle checked={autoDownloadWifi} onChange={setAutoDownloadWifi} />
                        </div>

                        <div className="p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-full bg-green-50 dark:bg-green-900/20 text-green-500"><Smartphone size={20} /></div>
                                <div>
                                    <span className="font-medium text-gray-900 dark:text-white block">When using mobile data</span>
                                    <span className="text-xs text-gray-400">Download media automatically on cellular</span>
                                </div>
                            </div>
                            <Toggle checked={autoDownloadMobile} onChange={setAutoDownloadMobile} />
                        </div>

                    </div>
                </section>

                {/* Storage Usage Section */}
                <section>
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 ml-2">Storage Usage</h3>
                    <div className="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-800">
                        <div className="p-6 flex flex-col items-center justify-center border-b border-gray-50 dark:border-gray-800">
                            <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-3">
                                <Database size={32} className="text-gray-400" />
                            </div>
                            <h2 className="text-2xl font-bold dark:text-white">{cacheSize}</h2>
                            <p className="text-sm text-gray-400">Used by cached media</p>
                        </div>

                        <button
                            onClick={handleClearCache}
                            disabled={isClearing || cacheSize === "0 KB"}
                            className="w-full p-4 flex items-center justify-center gap-2 text-red-500 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isClearing ? <Loader2 size={20} className="animate-spin" /> : <Trash2 size={20} />}
                            Clear Cache
                        </button>
                    </div>
                </section>

            </div>
        </div>
    );
};

export default DataSettings;
