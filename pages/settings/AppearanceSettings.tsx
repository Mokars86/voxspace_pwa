import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Moon, Sun } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

const AppearanceSettings: React.FC = () => {
    const navigate = useNavigate();
    const { theme, setTheme } = useTheme();

    return (
        <div className="flex flex-col h-screen bg-white dark:bg-gray-900 dark:text-gray-100 transition-colors duration-300">
            <header className="px-4 py-3 flex items-center gap-3 border-b border-gray-100 dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-900 z-10">
                <button onClick={() => navigate(-1)} className="text-gray-600 dark:text-gray-300 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full">
                    <ArrowLeft size={24} />
                </button>
                <h1 className="text-xl font-bold">Appearance</h1>
            </header>

            <div className="flex-1 p-4 flex flex-col justify-between">
                <section>
                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 ml-2">Theme Mode</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <ThemeCard
                            icon={<Sun size={24} />}
                            label="Light Mode"
                            selected={theme === 'light'}
                            onClick={() => setTheme('light')}
                        />
                        <ThemeCard
                            icon={<Moon size={24} />}
                            label="Dark Mode"
                            selected={theme === 'dark'}
                            onClick={() => setTheme('dark')}
                        />
                    </div>
                </section>

                <div className="pt-8 px-4 text-center text-sm text-gray-400">
                    <p>Changes are saved automatically.</p>
                </div>
            </div>
        </div>
    );
};

const ThemeCard = ({ icon, label, selected, onClick }: any) => (
    <button
        onClick={onClick}
        className={`flex flex-col items-center gap-3 p-4 rounded-2xl border-2 transition-all ${selected
            ? 'border-[#ff1744] bg-red-50 dark:bg-red-900/20 text-[#ff1744]'
            : 'border-transparent bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
    >
        {icon}
        <span className="font-bold text-sm">{label}</span>
    </button>
);

export default AppearanceSettings;
