import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabase';
import { MyBagItem } from '../../types/mybag';
import { db } from '../../services/db';
import BagItemCard from '../../components/my-bag/BagItemCard';
import { ArrowLeft, Search, Plus, Settings, Lock, Unlock, Loader2, Grid as GridIcon, List as ListIcon, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import AddNoteModal from '../../components/my-bag/AddNoteModal';
import BagSettingsModal from '../../components/my-bag/BagSettingsModal';
import BagItemPreviewModal from '../../components/my-bag/BagItemPreviewModal';

const MyBag: React.FC = () => {
    const navigate = useNavigate();
    const { user, profile } = useAuth();
    const [isLocked, setIsLocked] = useState(true); // Default to locked
    const [pin, setPin] = useState('');
    const [showAddNote, setShowAddNote] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showSearch, setShowSearch] = useState(false);
    const [items, setItems] = useState<MyBagItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState<'all' | 'messages' | 'media' | 'files' | 'notes' | 'links'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [previewItem, setPreviewItem] = useState<MyBagItem | null>(null);
    const [editingItem, setEditingItem] = useState<MyBagItem | null>(null);
    const [usedStorage, setUsedStorage] = useState(0);

    const EXEMPT_USERS = ["Mubarik Tuahir Ali", "Kausara Mohammed"];
    const isExempt = profile?.full_name && EXEMPT_USERS.includes(profile.full_name);
    const MAX_STORAGE_BYTES = isExempt ? Infinity : 50 * 1024 * 1024; // 50MB or Unlimited

    // PIN Management
    const [currentPin, setCurrentPin] = useState<string | null>(null);

    useEffect(() => {
        if (user) {
            // Fetch PIN from profile
            supabase.from('profiles').select('chat_lock_pin').eq('id', user.id).single()
                .then(({ data }) => {
                    if (data?.chat_lock_pin) {
                        setCurrentPin(data.chat_lock_pin);
                    } else {
                        // If no PIN set, maybe allow access or prompt setup? 
                        // For now, let's keep it locked but maybe default pin is not usable?
                        // If null, we might consider it 'no pin' -> unlocked or '1234' default?
                        // Let's assume unlocked if no PIN, or standard '1234' fallback if user wants lock functionality.
                        // Better: If no PIN, treat as '1234' for simplified migration or ask to setup.
                        setCurrentPin('1234');
                    }
                });
        }
    }, [user]);

    useEffect(() => {
        if (!isLocked && user) {
            fetchItems();
        }
    }, [isLocked, user]);

    const fetchItems = async () => {
        setLoading(true);
        try {
            // 1. Try Local DB first (Offline support)
            const localItems = await db.my_bag.toArray();
            if (localItems.length > 0) {
                setItems(localItems);
            }

            // 2. Fetch from Supabase (Sync)
            const { data, error } = await supabase
                .from('my_bag_items')
                .select('*')
                .eq('user_id', user?.id)
                .order('created_at', { ascending: false });

            if (error) {
                // Don't throw if just no table yet - handle gracefully during dev
                console.warn("Error fetching bag items (table might not exist yet):", error);
            } else if (data) {
                setItems(data as MyBagItem[]);
                calculateStorage(data as MyBagItem[]);
                // Sync to local
                await db.my_bag.bulkPut(data as MyBagItem[]);
            }
        } catch (e) {
            console.error("Fetch error", e);
        } finally {
            setLoading(false);
        }
    };

    const calculateStorage = (currentItems: MyBagItem[]) => {
        const total = currentItems.reduce((acc, item) => {
            // Prioritize metadata size, fallback to content string length (approx for text)
            return acc + (item.metadata?.size || item.content.length || 0);
        }, 0);
        setUsedStorage(total);
    };

    // Update storage when items change (e.g. after delete/add)
    useEffect(() => {
        calculateStorage(items);
    }, [items]);

    const handleUnlock = (e: React.FormEvent) => {
        e.preventDefault();
        if (pin === currentPin) {
            setIsLocked(false);
        } else {
            alert("Incorrect PIN");
            setPin('');
        }
    };

    const handleChangePin = async (oldPin: string, newPin: string): Promise<boolean> => {
        if (oldPin === currentPin) {
            try {
                const { error } = await supabase.from('profiles').update({ chat_lock_pin: newPin }).eq('id', user!.id);
                if (error) throw error;
                setCurrentPin(newPin);
                return true;
            } catch (e) {
                console.error("Failed to update PIN", e);
                alert("Failed to update PIN");
                return false;
            }
        }
        return false;
    };

    const handleItemClick = (item: MyBagItem) => {
        setPreviewItem(item);
    };

    const handleDeleteItem = async (item: MyBagItem) => {
        if (!confirm(`Permanently delete "${item.title || 'this item'}"?`)) return;

        try {
            // Delete from Supabase
            if (user) {
                const { error } = await supabase.from('my_bag_items').delete().eq('id', item.id);
                if (error) throw error;
            }

            // Delete from Local DB
            await db.my_bag.delete(item.id);

            // Update UI
            setItems(prev => prev.filter(i => i.id !== item.id));
            setPreviewItem(null); // Close modal if open

        } catch (error) {
            console.error("Delete failed", error);
            alert("Failed to delete item.");
        }
    };

    const handleDownloadItem = async (item: MyBagItem) => {
        if (!item.content) return;
        try {
            // If it's a blob/file URL or remote URL
            const response = await fetch(item.content);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            // Infer name
            const ext = item.type === 'image' ? 'jpg' : item.type === 'video' ? 'mp4' : 'txt';
            a.download = item.title ? `${item.title}.${ext}` : `downloaded-file.${ext}`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            alert("Download started!");
        } catch (error) {
            console.error("Download failed", error);
            alert("Could not download file.");
        }
    };

    const filteredItems = items.filter(item => {
        if (filter !== 'all' && item.category !== filter && item.type !== filter) return false; // Simple mapping
        if (searchQuery && !item.title?.toLowerCase().includes(searchQuery.toLowerCase()) && !item.content.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        return true;
    });

    if (isLocked) {
        return (
            <div className="h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-6">
                <Lock size={48} className="mb-4 text-[#ff1744]" />
                <h2 className="text-2xl font-bold mb-2">My Bag Locked</h2>
                <p className="text-gray-400 mb-6 text-center">Enter your PIN to access your private storage.</p>
                <form onSubmit={handleUnlock} className="flex flex-col gap-4 w-full max-w-xs">
                    <input
                        type="password"
                        value={pin}
                        onChange={e => setPin(e.target.value)}
                        placeholder="Enter PIN"
                        className="bg-gray-800 border border-gray-700 rounded-xl p-3 text-center text-2xl tracking-widest outline-none focus:border-[#ff1744]"
                        maxLength={4}
                        autoFocus
                    />
                    <button type="submit" className="bg-[#ff1744] font-bold py-3 rounded-xl hover:bg-red-600 transition-colors">
                        Unlock
                    </button>
                    <button type="button" onClick={() => navigate(-1)} className="text-gray-500 text-sm">Cancel</button>
                </form>
            </div>
        );
    }

    // Standard rendering
    return (
        <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-950">
            {/* Header */}
            {/* Header */}
            <header className="bg-white dark:bg-gray-900 px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between sticky top-0 z-10 transition-all">
                {showSearch ? (
                    <div className="flex items-center gap-3 w-full animate-in slide-in-from-right-10 duration-200">
                        <div className="flex-1 relative">
                            <input
                                autoFocus
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search items..."
                                className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-xl outline-none focus:ring-2 focus:ring-[#ff1744]/50 dark:text-white"
                            />
                            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        </div>
                        <button onClick={() => { setShowSearch(false); setSearchQuery(''); }} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full dark:hover:bg-gray-800">
                            <X size={20} />
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="flex items-center gap-3">
                            <button onClick={() => navigate('/profile')} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full dark:text-gray-200">
                                <ArrowLeft size={20} />
                            </button>
                            <h1 className="font-bold text-lg dark:text-white flex items-center gap-2">
                                My Bag <Lock size={14} className="text-[#ff1744]" />
                            </h1>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setShowSearch(true)}
                                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full dark:text-gray-400"
                            >
                                <Search size={20} />
                            </button>
                            <button
                                onClick={() => setShowSettings(true)}
                                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full dark:text-gray-400"
                            >
                                <Settings size={20} />
                            </button>
                        </div>
                    </>
                )}
            </header>

            {/* Storage Indicator */}
            {!isExempt && (
                <div className="bg-white dark:bg-gray-900 px-4 py-2 border-b border-gray-100 dark:border-gray-800">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>Storage Used</span>
                        <span>
                            {(usedStorage / (1024 * 1024)).toFixed(1)} MB / 50 MB
                        </span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div
                            className={cn(
                                "h-full transition-all duration-500 rounded-full",
                                usedStorage / MAX_STORAGE_BYTES > 0.9 ? "bg-red-500" :
                                    usedStorage / MAX_STORAGE_BYTES > 0.7 ? "bg-yellow-500" : "bg-green-500"
                            )}
                            style={{ width: `${Math.min((usedStorage / MAX_STORAGE_BYTES) * 100, 100)}%` }}
                        />
                    </div>
                </div>
            )}
            {isExempt && (
                <div className="bg-white dark:bg-gray-900 px-4 py-2 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center text-xs text-green-600 font-medium">
                    <span>Storage Status</span>
                    <span>Unlimited (Premium)</span>
                </div>
            )}

            {/* Filter Tabs */}
            <div className="overflow-x-auto whitespace-nowrap px-4 py-3 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 scrollbar-hide">
                {(['all', 'messages', 'media', 'files', 'notes', 'links'] as const).map(f => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={cn(
                            "px-4 py-1.5 rounded-full text-sm font-medium mr-2 transition-colors",
                            filter === f
                                ? "bg-black dark:bg-white text-white dark:text-black"
                                : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                        )}
                    >
                        {f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
                {loading && items.length === 0 ? (
                    <div className="flex justify-center p-8"><Loader2 className="animate-spin text-[#ff1744]" /></div>
                ) : filteredItems.length > 0 ? (
                    <div className="grid grid-cols-1 gap-3">
                        {filteredItems.map(item => (
                            <BagItemCard
                                key={item.id}
                                item={item}
                                onPress={handleItemClick}
                                onLongPress={(i) => confirm("Delete?")}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                        <Lock size={48} className="mb-4 opacity-20" />
                        <p>Your bag is empty.</p>
                        <p className="text-sm">Save items here for private keeping.</p>
                    </div>
                )}
            </div>

            <button
                onClick={() => {
                    if (usedStorage >= MAX_STORAGE_BYTES) {
                        alert("Storage limit reached (50MB). Please delete items to free up space.");
                        return;
                    }
                    setShowAddNote(true);
                }}
                className={cn(
                    "fixed bottom-6 right-6 w-14 h-14 text-white rounded-full shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-transform z-20",
                    usedStorage >= MAX_STORAGE_BYTES ? "bg-gray-400 cursor-not-allowed" : "bg-[#ff1744]"
                )}
            >
                <Plus size={28} />
            </button>

            <AddNoteModal
                isOpen={showAddNote}
                onClose={() => {
                    setShowAddNote(false);
                    setEditingItem(null);
                }}
                currentUsage={usedStorage}
                maxStorage={MAX_STORAGE_BYTES}
                initialTitle={editingItem?.title}
                initialContent={editingItem?.content}
                mode={editingItem ? 'edit' : 'create'}
                onSave={async (title, content) => {
                    if (!user) return;

                    if (editingItem) {
                        // UPDATE EXISTING
                        try {
                            const isLocalId = editingItem.id.startsWith('local-');

                            if (isLocalId) {
                                // MIGRATION: Convert local-only note to synced note
                                const newId = crypto.randomUUID();
                                const newItem: any = {
                                    ...editingItem,
                                    id: newId,
                                    title,
                                    content,
                                    // Ensure user_id is set
                                    user_id: user?.id || editingItem.user_id,
                                };

                                // 1. Remove old local item
                                await db.my_bag.delete(editingItem.id);

                                // 2. Add new item locally
                                await db.my_bag.add(newItem);

                                // 3. Sync to Supabase (Insert since it's "new" to server)
                                supabase.from('my_bag_items').insert(newItem).then(({ error }) => {
                                    if (error) console.error("Migration sync error", error);
                                });

                                // 4. Update State
                                setItems(prev => prev.map(i => i.id === editingItem.id ? newItem : i));
                                if (previewItem?.id === editingItem.id) setPreviewItem(newItem);

                            } else {
                                // STANDARD UPDATE
                                const updatedItem = { ...editingItem, title, content };

                                // 1. Update Local DB (Offline First)
                                await db.my_bag.put(updatedItem);

                                // 2. Update State immediately
                                setItems(prev => prev.map(i => i.id === editingItem.id ? updatedItem : i));
                                if (previewItem?.id === editingItem.id) setPreviewItem(updatedItem);

                                // 3. Update Supabase
                                const { error } = await supabase
                                    .from('my_bag_items')
                                    .update({ title, content })
                                    .eq('id', editingItem.id);

                                if (error) {
                                    console.error("Supabase update error", error);
                                    // alerting user might be annoying if it's just sync, but helpful for debugging
                                    // alert("Note saved locally, but failed to sync.");
                                }
                            }

                            setEditingItem(null);
                        } catch (err: any) {
                            console.error("Update failed", err);
                            alert(`Failed to update note: ${err.message || err}`);
                        }

                    } else {
                        // CREATE NEW
                        const newId = crypto.randomUUID();
                        const newItem: any = {
                            id: newId,
                            user_id: user.id,
                            type: 'note',
                            content: content,
                            title: title,
                            created_at: new Date().toISOString(),
                            category: 'notes',
                            is_locked: false
                        };

                        // Offline First
                        await db.my_bag.add(newItem);
                        setItems(prev => [newItem, ...prev]);

                        // Sync
                        supabase.from('my_bag_items').insert(newItem).then(({ error }) => {
                            if (error) console.error("Sync error", error);
                        });
                    }
                }}
            />

            <BagSettingsModal
                isOpen={showSettings}
                onClose={() => setShowSettings(false)}
                onLock={() => {
                    setIsLocked(true);
                    setPin('');
                    setShowSettings(false);
                }}
                onChangePin={handleChangePin}
            />

            <BagItemPreviewModal
                isOpen={!!previewItem}
                onClose={() => setPreviewItem(null)}
                item={previewItem}
                onDelete={handleDeleteItem}
                onDownload={handleDownloadItem}
                onEdit={(item) => {
                    // Only notes allow edit for now
                    if (item.type === 'note') {
                        setEditingItem(item);
                        setShowAddNote(true);
                        // Optional: close preview or keep it open?
                        // If we keep preview open, it will need to update when save happens.
                        // We handled that in onSave.
                    }
                }}
            />
        </div>
    );
};



export default MyBag;
