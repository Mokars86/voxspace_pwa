import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Upload, Database, Cloud, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../services/db';

const ChatSettings: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleBackup = async () => {
        if (!user) return;
        setLoading(true);
        setStatus("Fetching chats...");
        try {
            // 1. Get all My Chats
            const { data: participants, error: partError } = await supabase
                .from('chat_participants')
                .select('chat_id')
                .eq('user_id', user.id);

            if (partError) throw partError;
            const chatIds = participants.map(p => p.chat_id);

            if (chatIds.length === 0) {
                alert("No chats to backup.");
                setLoading(false);
                return;
            }

            // 2. Get Messages
            setStatus(`Backing up ${chatIds.length} chats...`);
            // Batched fetch if necessary, but for now single query (limit to last 10000?)
            // We want FULL backup, so maybe recursive fetching if large.
            // For simplicity, let's just fetch default limit (Supabase default is often 1000)
            // We'll trust the user has < 10000 messages for this v1 or use simple pagination if needed.
            // Actually, let's do a simple loop or large limit.

            let allMessages: any[] = [];
            const BATCH_SIZE = 1000;
            let offset = 0;

            while (true) {
                const { data: msgs, error: msgError } = await supabase
                    .from('messages')
                    .select('*')
                    .in('chat_id', chatIds)
                    .range(offset, offset + BATCH_SIZE - 1)
                    .order('created_at', { ascending: true });

                if (msgError) throw msgError;
                if (!msgs || msgs.length === 0) break;

                allMessages = [...allMessages, ...msgs];
                offset += BATCH_SIZE;
                setStatus(`Fetched ${allMessages.length} messages...`);
            }

            // 3. Create JSON
            const backupData = {
                version: 1,
                date: new Date().toISOString(),
                userId: user.id,
                messageCount: allMessages.length,
                messages: allMessages
            };

            const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = `voxspace_backup_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            setStatus(`Backup complete! (${allMessages.length} messages)`);
            setTimeout(() => setStatus(null), 3000);

        } catch (error: any) {
            console.error("Backup failed", error);
            setStatus(`Error: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleRestoreClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setLoading(true);
        setStatus("Reading backup file...");

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const json = JSON.parse(event.target?.result as string);

                if (!json.messages || !Array.isArray(json.messages)) {
                    throw new Error("Invalid backup format");
                }

                setStatus(`Restoring ${json.messages.length} messages...`);

                // Upsert messages
                // We chunk it to avoid payload limits
                const CHUNK_SIZE = 100;
                const chunks = [];
                for (let i = 0; i < json.messages.length; i += CHUNK_SIZE) {
                    chunks.push(json.messages.slice(i, i + CHUNK_SIZE));
                }

                let restoredCount = 0;
                for (const chunk of chunks) {
                    // Clean chunk? Ensure compatible fields
                    // If we blindly upsert, we might overwrite newer edits if we aren't careful?
                    // But backup is usually "source of truth" if restoring.

                    const { error } = await supabase
                        .from('messages')
                        .upsert(chunk, { onConflict: 'id', ignoreDuplicates: true }); // Prefer existing server data? Or overwrite? 
                    // "restore" usually implies "I want what's in the file". 
                    // But if I have a newer edited message on server, overwriting with old backup is bad.
                    // Safe approach: ignoreDuplicates: true. Only fill GAPS.
                    // But if user deleted chat and wants it back, this works.

                    if (error) throw error;
                    restoredCount += chunk.length;
                    setStatus(`Restored ${restoredCount}/${json.messages.length}...`);
                }

                // Sync local DB (Optional but good)
                try {
                    // We could clear and refill, or just bulkPut
                    // For performance, maybe just let the app lazy load or rely on Supabase
                    // But let's try to put some into Dexie
                    const dbMessages = json.messages.map((m: any) => ({
                        ...m,
                        status: 'read' // default to read
                    }));
                    await db.messages.bulkPut(dbMessages);
                } catch (dbErr) {
                    console.warn("Local DB sync skip", dbErr);
                }

                setStatus("Restore complete!");
                setTimeout(() => setStatus(null), 3000);

            } catch (error: any) {
                console.error("Restore failed", error);
                setStatus(`Error: ${error.message}`);
            } finally {
                setLoading(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
        reader.readAsText(file);
    };

    return (
        <div className="flex flex-col h-screen bg-white dark:bg-gray-900 transition-colors">
            <header className="px-4 py-3 flex items-center gap-3 border-b border-gray-100 dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-900 z-10">
                <button onClick={() => navigate(-1)} className="text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded-full">
                    <ArrowLeft size={24} />
                </button>
                <h1 className="text-xl font-bold dark:text-white">Chat Backup & Restore</h1>
            </header>

            <div className="p-4 space-y-6">

                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl flex items-start gap-3">
                    <Cloud className="text-blue-500 shrink-0 mt-1" size={24} />
                    <div>
                        <h3 className="font-bold text-blue-700 dark:text-blue-300">About Backups</h3>
                        <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                            Your chats are automatically synced to the cloud securely. However, you can create a local backup for your own records or to restore messages if they are accidentally deleted.
                        </p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="border border-gray-100 dark:border-gray-800 rounded-2xl p-6 flex flex-col items-center text-center gap-4 bg-gray-50 dark:bg-gray-950/50">
                        <div className="w-16 h-16 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center shadow-sm">
                            <Download size={32} className="text-gray-900 dark:text-white" />
                        </div>
                        <div>
                            <h3 className="font-bold text-lg dark:text-white">Export Backup</h3>
                            <p className="text-gray-500 text-sm">Download all your messages as a JSON file.</p>
                        </div>
                        <button
                            onClick={handleBackup}
                            disabled={loading}
                            className="w-full bg-black dark:bg-white text-white dark:text-black py-3 rounded-xl font-bold active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {loading ? <Loader2 className="animate-spin" /> : <Download size={20} />}
                            {loading ? "Backing up..." : "Download Backup"}
                        </button>
                    </div>

                    <div className="border border-gray-100 dark:border-gray-800 rounded-2xl p-6 flex flex-col items-center text-center gap-4 bg-gray-50 dark:bg-gray-950/50">
                        <div className="w-16 h-16 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center shadow-sm">
                            <Upload size={32} className="text-gray-900 dark:text-white" />
                        </div>
                        <div>
                            <h3 className="font-bold text-lg dark:text-white">Restore Backup</h3>
                            <p className="text-gray-500 text-sm">Restore missing messages from a backup file.</p>
                        </div>
                        <button
                            onClick={handleRestoreClick}
                            disabled={loading}
                            className="w-full border-2 border-dashed border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 py-3 rounded-xl font-bold hover:bg-gray-100 dark:hover:bg-gray-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {loading ? <Loader2 className="animate-spin" /> : <Upload size={20} />}
                            {loading ? "Restoring..." : "Select Backup File"}
                        </button>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            accept=".json"
                            className="hidden"
                        />
                    </div>
                </div>

                {status && (
                    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-6 py-3 rounded-full shadow-xl font-medium text-sm animate-in slide-in-from-bottom-5 fade-in z-50 flex items-center gap-3">
                        {loading ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle size={16} />}
                        {status}
                    </div>
                )}

            </div>
        </div>
    );
};

export default ChatSettings;
