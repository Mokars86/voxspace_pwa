import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Moon, Sun } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

const AppearanceSettings: React.FC = () => {
    const navigate = useNavigate();
    const { mode, setMode } = useTheme();

    return (
        <div className="flex flex-col h-screen bg-transparent transition-colors duration-300">
            <header className="px-4 py-3 flex items-center gap-3 border-b border-gray-100 dark:border-gray-800 sticky top-0 bg-background/80 backdrop-blur-md z-10">
                <button onClick={() => navigate(-1)} className="text-muted-foreground p-2 hover:bg-muted rounded-full">
                    <ArrowLeft size={24} />
                </button>
                <h1 className="text-xl font-bold">Appearance</h1>
            </header>

            <div className="flex-1 p-4 flex flex-col gap-8 overflow-y-auto">
                {/* Mode Selection */}
                <section>
                    <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4 ml-1">Theme Mode</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <ThemeCard
                            icon={<Sun size={24} />}
                            label="Light Mode"
                            selected={mode === 'light'}
                            onClick={() => setMode('light')}
                            colorClass="bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        />
                        <ThemeCard
                            icon={<Moon size={24} />}
                            label="Dark Mode"
                            selected={mode === 'dark'}
                            onClick={() => setMode('dark')}
                            colorClass="bg-gray-900 text-white"
                        />
                    </div>
                </section>

                {/* Font Size Selection */}
                <FontSizeSection />

                {/* Bubble Color Selection */}
                <BubbleColorSection />

                {/* Chat Wallpaper Selection */}
                <WallpaperSection />
            </div>
        </div>
    );
};

const FontSizeSection = () => {
    const { fontSize, setFontSize } = useTheme();

    const sizes: { label: string; value: 'small' | 'medium' | 'large' | 'extra-large'; class: string }[] = [
        { label: 'Small', value: 'small', class: 'text-sm' },
        { label: 'Medium', value: 'medium', class: 'text-base' },
        { label: 'Large', value: 'large', class: 'text-lg' },
        { label: 'Extra Large', value: 'extra-large', class: 'text-xl' },
    ];

    return (
        <section>
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4 ml-1">Font Size</h3>
            <div className="bg-card border rounded-2xl p-4 flex flex-col gap-4">
                <div className="flex justify-between items-center px-2">
                    <span className="text-sm">A</span>
                    <span className="text-xl font-bold">A</span>
                </div>
                <input
                    type="range"
                    min="0"
                    max="3"
                    step="1"
                    value={sizes.findIndex(s => s.value === fontSize)}
                    onChange={(e) => setFontSize(sizes[parseInt(e.target.value)].value)}
                    className="w-full accent-primary h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                />
                <div className="text-center text-sm font-medium text-primary">
                    {sizes.find(s => s.value === fontSize)?.label}
                </div>
                <div className="p-4 bg-muted/50 rounded-xl">
                    <p className="text-center text-muted-foreground">
                        Preview text size
                    </p>
                </div>
            </div>
        </section>
    );
};

const BubbleColorSection = () => {
    const { bubbleColor, setBubbleColor } = useTheme();

    const colors = [
        { name: 'Red', value: '#ff1744' },
        { name: 'Blue', value: '#3b82f6' },
        { name: 'Green', value: '#22c55e' },
        { name: 'Purple', value: '#a855f7' },
        { name: 'Orange', value: '#f97316' },
        { name: 'Pink', value: '#ec4899' },
        { name: 'Teal', value: '#14b8a6' },
        { name: 'Indigo', value: '#6366f1' },
    ];

    return (
        <section>
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4 ml-1">Bubble Color</h3>
            <div className="grid grid-cols-4 gap-3">
                {colors.map((c) => (
                    <button
                        key={c.name}
                        onClick={() => setBubbleColor(c.value)}
                        className={`aspect-square rounded-full transition-all duration-200 relative overflow-hidden flex items-center justify-center ${bubbleColor === c.value ? 'ring-4 ring-offset-2 ring-primary/20 scale-110' : 'hover:scale-105'
                            }`}
                        style={{ background: c.value }}
                    >
                        {bubbleColor === c.value && (
                            <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
                        )}
                    </button>
                ))}
            </div>
        </section>
    );
};

const WallpaperSection = () => {
    const { chatWallpaper, setChatWallpaper } = useTheme();

    const wallpapers = [
        { name: 'Default', value: '#e5ddd5' }, // WhatsApp-ish
        { name: 'Dark', value: '#0f172a' }, // Slate 900
        { name: 'Blue', value: '#dbeafe' }, // Blue 100
        { name: 'Pink', value: '#fce7f3' }, // Pink 100
        { name: 'Yellow', value: '#fef3c7' }, // Amber 100
        { name: 'Green', value: '#dcfce7' }, // Emerald 100
        { name: 'Bubble', value: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
        { name: 'Ocean', value: 'linear-gradient(to right, #4facfe 0%, #00f2fe 100%)' },
        { name: 'Dark Pattern', value: 'url(/wallpapers/dark-pattern.png)' },
        { name: 'Light Pattern', value: 'url(/wallpapers/light-pattern.png)' },
        { name: 'Vibrant', value: 'url(/wallpapers/vibrant-pattern.png)' },
        { name: 'Red & White', value: 'url(/wallpapers/white-red-pattern.png)' },
        { name: 'Orange Pattern', value: 'url(/wallpapers/orange-pattern.png)' },
        { name: 'Pink Pattern', value: 'url(/wallpapers/pink-pattern.png)' },
        { name: 'Purple Pattern', value: 'url(/wallpapers/purple-pattern.png)' },
    ];

    return (
        <section>
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4 ml-1">Chat Wallpaper</h3>
            <div className="grid grid-cols-4 gap-3">
                {wallpapers.map((w) => (
                    <button
                        key={w.name}
                        onClick={() => setChatWallpaper(w.value)}
                        className={`aspect-square rounded-xl border-2 transition-all duration-200 relative overflow-hidden ${chatWallpaper === w.value ? 'border-primary ring-2 ring-primary/20 scale-105' : 'border-transparent hover:scale-105'}`}
                        style={{ background: w.value }}
                    >
                        {chatWallpaper === w.value && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                <div className="w-3 h-3 bg-white rounded-full box-shadow" />
                            </div>
                        )}
                    </button>
                ))}
            </div>
        </section>
    );
};

const ThemeCard = ({ icon, label, selected, onClick, colorClass }: any) => (
    <button
        onClick={onClick}
        className={`flex flex-col items-center gap-3 p-6 rounded-2xl border-2 transition-all duration-200 ${selected
            ? 'border-primary ring-2 ring-primary/20 scale-[1.02]'
            : 'border-transparent hover:bg-muted/50'
            } ${colorClass}`}
    >
        {icon}
        <span className="font-bold text-sm">{label}</span>
    </button>
);

export default AppearanceSettings;
