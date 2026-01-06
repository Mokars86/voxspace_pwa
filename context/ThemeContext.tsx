import React, { createContext, useContext, useEffect, useState } from 'react';

type Mode = 'dark' | 'light';
export type FontSize = 'small' | 'medium' | 'large' | 'extra-large';

interface ThemeProviderProps {
    children: React.ReactNode;
    defaultMode?: Mode;
    storageKey?: string;
}

interface ThemeProviderState {
    mode: Mode;
    setMode: (mode: Mode) => void;
    fontSize: FontSize;
    setFontSize: (size: FontSize) => void;
    chatWallpaper: string;
    setChatWallpaper: (wallpaper: string) => void;
}

const initialState: ThemeProviderState = {
    mode: 'light',
    setMode: () => null,
    fontSize: 'medium',
    setFontSize: () => null,
    chatWallpaper: '#e5ddd5', // Default WhatsApp/Standard like color
    setChatWallpaper: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
    children,
    defaultMode = 'light',
    storageKey = 'vite-ui-theme',
}: ThemeProviderProps) {
    const [mode, setMode] = useState<Mode>(() => {
        const stored = localStorage.getItem(`${storageKey}-mode`);
        return (stored === 'dark' || stored === 'light') ? stored : defaultMode;
    });

    const [fontSize, setFontSize] = useState<FontSize>(() => {
        return (localStorage.getItem(`${storageKey}-fontsize`) as FontSize) || 'medium';
    });

    const [chatWallpaper, setChatWallpaper] = useState<string>(() => {
        return localStorage.getItem(`${storageKey}-wallpaper`) || '#e5ddd5';
    });

    useEffect(() => {
        const root = window.document.documentElement;

        // Mode
        root.classList.remove('light', 'dark');
        root.classList.add(mode);
    }, [mode]);

    useEffect(() => {
        const root = window.document.documentElement;
        // Base size is usually 16px.
        // small: 14px (87.5%)
        // medium: 16px (100%)
        // large: 18px (112.5%)
        // extra-large: 20px (125%)
        const sizes = {
            'small': '14px',
            'medium': '16px',
            'large': '18px',
            'extra-large': '20px'
        };
        root.style.fontSize = sizes[fontSize];
    }, [fontSize]);

    const value = React.useMemo(() => ({
        mode,
        setMode: (m: Mode) => {
            localStorage.setItem(`${storageKey}-mode`, m);
            setMode(m);
        },
        fontSize,
        setFontSize: (s: FontSize) => {
            localStorage.setItem(`${storageKey}-fontsize`, s);
            setFontSize(s);
        },
        chatWallpaper,
        setChatWallpaper: (w: string) => {
            localStorage.setItem(`${storageKey}-wallpaper`, w);
            setChatWallpaper(w);
        }
    }), [mode, fontSize, chatWallpaper, storageKey]);

    return (
        <ThemeProviderContext.Provider value={value}>
            {children}
        </ThemeProviderContext.Provider>
    );
}

export const useTheme = () => {
    const context = useContext(ThemeProviderContext);

    if (context === undefined)
        throw new Error("useTheme must be used within a ThemeProvider");

    return context;
};
