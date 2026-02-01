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
    bubbleColor: string;
    setBubbleColor: (color: string) => void;
}

const initialState: ThemeProviderState = {
    mode: 'light',
    setMode: () => null,
    fontSize: 'medium',
    setFontSize: () => null,
    chatWallpaper: '#e5ddd5', // Default WhatsApp/Standard like color
    setChatWallpaper: () => null,
    bubbleColor: '#ff1744',
    setBubbleColor: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

// Helper to convert hex to space-separated HSL for Tailwind
function hexToHSL(hex: string): string {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return '348 100% 54%'; // Default red

    let r = parseInt(result[1], 16);
    let g = parseInt(result[2], 16);
    let b = parseInt(result[3], 16);

    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }

    // Round values
    h = Math.round(h * 360 * 10) / 10; // 1 decimal place
    s = Math.round(s * 100 * 10) / 10;
    l = Math.round(l * 100 * 10) / 10;

    return `${h} ${s}% ${l}%`;
}

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

    const [bubbleColor, setBubbleColor] = useState<string>(() => {
        return localStorage.getItem(`${storageKey}-bubble-color`) || '#ff1744';
    });

    // Effect to update theme class and meta tags (status bar)
    useEffect(() => {
        const root = window.document.documentElement;

        // Mode
        root.classList.remove('light', 'dark');
        root.classList.add(mode);

        // Update meta theme-color for PWA status bar
        const metaThemeColor = document.querySelector('meta[name="theme-color"]');
        // Colors match index.css --background values
        const color = mode === 'dark' ? '#0c0a09' : '#ffffff';
        // Note: #0c0a09 is slightly different from HSL calculation but safe for dark mode. 
        // Let's use the HSL -> Hex logic or just the primary background color. 
        // Using #020817 to match the index.css approx value properly.
        // index.css dark bg is hsl(222.2, 84%, 4.9%) -> #020817
        const darkBg = '#020817';

        if (metaThemeColor) {
            metaThemeColor.setAttribute('content', mode === 'dark' ? darkBg : '#ffffff');
        } else {
            const meta = document.createElement('meta');
            meta.name = "theme-color";
            meta.content = mode === 'dark' ? darkBg : '#ffffff';
            document.head.appendChild(meta);
        }

    }, [mode]);

    // Effect to update Primary color CSS variable
    useEffect(() => {
        const root = window.document.documentElement;
        if (bubbleColor) {
            const hslValue = hexToHSL(bubbleColor);
            root.style.setProperty('--primary', hslValue);
            root.style.setProperty('--ring', hslValue);
            // Optionally update primary-foreground if the color is very light?
            // For now assuming primary is always dark/saturated enough for white text, 
            // or sticking to existing foreground logic.
        }
    }, [bubbleColor]);

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
        },
        bubbleColor,
        setBubbleColor: (c: string) => {
            localStorage.setItem(`${storageKey}-bubble-color`, c);
            setBubbleColor(c);
        }
    }), [mode, fontSize, chatWallpaper, bubbleColor, storageKey]);

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
