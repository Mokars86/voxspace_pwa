import React, { useEffect, useState } from 'react';
import { supabase } from '../../services/supabase';
import { SpaceResource } from '../../types';
import { FileText, Link as LinkIcon, Download, Plus, Trash2, Image as ImageIcon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface SpaceResourcesProps {
    spaceId: string;
    isMember: boolean;
    role?: string;
}

const SpaceResources: React.FC<SpaceResourcesProps> = ({ spaceId, isMember, role }) => {
    const { user } = useAuth();
    const [resources, setResources] = useState<SpaceResource[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);

    // Form
    const [newTitle, setNewTitle] = useState('');
    const [newUrl, setNewUrl] = useState('');
    const [newType, setNewType] = useState<'link' | 'pdf' | 'doc'>('link');

    useEffect(() => {
        fetchResources();
    }, [spaceId]);

    const fetchResources = async () => {
        const { data, error } = await supabase
            .from('space_resources')
            .select(`*, uploader:created_by(full_name)`)
            .eq('space_id', spaceId)
            .order('created_at', { ascending: false });

        if (data) setResources(data);
        setLoading(false);
    };

    const handleAdd = async () => {
        if (!newTitle || !newUrl || !user) return;

        try {
            const { error } = await supabase.from('space_resources').insert({
                space_id: spaceId,
                title: newTitle,
                url: newUrl,
                type: newType,
                created_by: user.id
            });

            if (error) throw error;
            setShowAdd(false);
            setNewTitle('');
            setNewUrl('');
            fetchResources();
        } catch (err) {
            alert('Failed to add resource');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this resource?')) return;
        await supabase.from('space_resources').delete().eq('id', id);
        setResources(prev => prev.filter(r => r.id !== id));
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'pdf': return <FileText className="text-red-500" />;
            case 'doc': return <FileText className="text-blue-500" />;
            case 'image': return <ImageIcon className="text-purple-500" />;
            default: return <LinkIcon className="text-green-500" />;
        }
    };

    const canManage = role === 'owner' || role === 'moderator' || role === 'admin';

    return (
        <div className="space-y-4 p-4">
            <div className="flex justify-between items-center">
                <h3 className="font-bold text-lg dark:text-white">Shared Resources</h3>
                {isMember && (
                    <button
                        onClick={() => setShowAdd(!showAdd)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-black dark:bg-white text-white dark:text-black rounded-full text-sm font-bold"
                    >
                        <Plus size={16} /> Add Resource
                    </button>
                )}
            </div>

            {showAdd && (
                <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-xl space-y-3 animate-in fade-in slide-in-from-top-2">
                    <input
                        placeholder="Resource Title"
                        className="w-full p-2 rounded-lg border dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        value={newTitle}
                        onChange={e => setNewTitle(e.target.value)}
                    />
                    <div className="flex gap-2">
                        <select
                            className="p-2 rounded-lg border dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            value={newType}
                            onChange={(e: any) => setNewType(e.target.value)}
                        >
                            <option value="link">Link</option>
                            <option value="pdf">PDF</option>
                            <option value="doc">Document</option>
                        </select>
                        <input
                            placeholder="URL (https://...)"
                            className="flex-1 p-2 rounded-lg border dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            value={newUrl}
                            onChange={e => setNewUrl(e.target.value)}
                        />
                    </div>
                    <div className="flex justify-end gap-2">
                        <button onClick={() => setShowAdd(false)} className="px-3 py-1.5 text-sm font-bold text-gray-500">Cancel</button>
                        <button onClick={handleAdd} className="px-3 py-1.5 bg-primary text-white rounded-lg text-sm font-bold bg-[#ff1744]">Save</button>
                    </div>
                </div>
            )}

            <div className="space-y-2">
                {resources.map(res => (
                    <div key={res.id} className="flex items-center gap-4 bg-white dark:bg-gray-800 p-3 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 hover:border-gray-300 transition-colors group">
                        <div className="w-10 h-10 rounded-lg bg-gray-50 dark:bg-gray-700 flex items-center justify-center text-2xl">
                            {getIcon(res.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-sm dark:text-white truncate">{res.title}</h4>
                            <div className="flex items-center gap-2 text-xs text-gray-400">
                                <span>Added by {res.uploader?.full_name || 'Member'}</span>
                                <span>• {new Date(res.created_at).toLocaleDateString()}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <a
                                href={res.url}
                                target="_blank"
                                rel="noreferrer"
                                className="p-2 text-gray-400 hover:text-primary hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                            >
                                <LinkIcon size={18} />
                            </a>
                            {canManage && (
                                <button
                                    onClick={() => handleDelete(res.id)}
                                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                                >
                                    <Trash2 size={18} />
                                </button>
                            )}
                        </div>
                    </div>
                ))}
                {resources.length === 0 && !loading && (
                    <div className="text-center py-8 text-gray-400">
                        No resources yet.
                    </div>
                )}
            </div>
        </div>
    );
};

export default SpaceResources;
