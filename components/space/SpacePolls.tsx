import React, { useEffect, useState } from 'react';
import { supabase } from '../../services/supabase';
import { Poll, PollOption } from '../../types';
import { Plus, BarChart2, CheckCircle, Trash2, Clock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/utils';

interface SpacePollsProps {
    spaceId: string;
    isMember: boolean;
    role?: string;
}

const SpacePolls: React.FC<SpacePollsProps> = ({ spaceId, isMember, role }) => {
    const { user } = useAuth();
    const [polls, setPolls] = useState<Poll[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);

    // Create State
    const [question, setQuestion] = useState('');
    const [options, setOptions] = useState<string[]>(['', '']);

    const [expiresAt, setExpiresAt] = useState('');

    useEffect(() => {
        fetchPolls();

        // Subscription for real-time votes and polls
        const channel = supabase
            .channel(`polls:${spaceId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'space_poll_votes' }, () => {
                fetchPolls();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'space_polls' }, () => {
                fetchPolls();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'space_poll_options' }, () => {
                fetchPolls();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [spaceId, user]); // Added user dependency

    const fetchPolls = async () => {
        try {
            // Fetch Polls (Allow public view)
            // Note: We join 'profiles' (aliased as creator) using the created_by column.
            // This requires a FK from space_polls.created_by -> profiles.id
            const { data: pollsData, error } = await supabase
                .from('space_polls')
                .select(`*, options:space_poll_options(*), creator:profiles!created_by(full_name, avatar_url)`)
                .eq('space_id', spaceId)
                .order('created_at', { ascending: false });

            if (error) {
                console.error("Error fetching polls:", error);
                throw error;
            }

            if (!pollsData) {
                setPolls([]);
                return;
            }

            let myVotes: any[] = [];
            if (user) {
                // Check user votes only if logged in
                const pollIds = pollsData.map(p => p.id);
                if (pollIds.length > 0) {
                    const { data } = await supabase
                        .from('space_poll_votes')
                        .select('poll_id, option_id')
                        .in('poll_id', pollIds)
                        .eq('user_id', user.id);
                    if (data) myVotes = data;
                }
            }


            const formatted = pollsData.map((p: any) => ({
                ...p,
                options: p.options.sort((a: any, b: any) => a.text.localeCompare(b.text)), // Simple sort
                user_vote_id: myVotes?.find(v => v.poll_id === p.id)?.option_id,
                is_expired: p.expires_at && new Date(p.expires_at) < new Date()
            }));

            setPolls(formatted);
            setLoading(false);
        } catch (error) {
            console.error("Fetch polls error:", error);
            setLoading(false);
        }
    };

    const handleVote = async (pollId: string, optionId: string) => {
        if (!user) return;
        try {
            // Check if already voted
            const poll = polls.find(p => p.id === pollId);
            if (poll?.user_vote_id) return; // Prevent double vote for now
            if (poll?.is_expired || !poll?.is_active) {
                alert("This poll has ended.");
                return;
            }

            await supabase.from('space_poll_votes').insert({
                poll_id: pollId,
                option_id: optionId,
                user_id: user.id
            });

            // Optimistic Update
            setPolls(prev => prev.map(p => {
                if (p.id !== pollId) return p;
                return {
                    ...p,
                    user_vote_id: optionId,
                    options: p.options.map((o: any) => o.id === optionId ? { ...o, vote_count: (o.vote_count || 0) + 1 } : o)
                };
            }));
        } catch (err) {
            console.error(err);
        }
    };

    const handleCreate = async () => {
        if (!user) return;

        if (!question.trim()) {
            alert("Please enter a question.");
            return;
        }

        // Filter out empty options
        const validOptions = options.filter(o => o.trim().length > 0);

        if (validOptions.length < 2) {
            alert("Please provide at least 2 valid options.");
            return;
        }

        try {
            // 1. Create Poll
            const { data: pollData, error: pollError } = await supabase
                .from('space_polls')
                .insert({
                    space_id: spaceId,
                    question,
                    created_by: user.id,
                    expires_at: expiresAt ? new Date(expiresAt).toISOString() : null
                })
                .select()
                .single();

            if (pollError) throw pollError;

            // 2. Create Options
            const optionsData = validOptions.map(text => ({
                poll_id: pollData.id,
                text,
                vote_count: 0
            }));

            const { data: createdOptions, error: optionsError } = await supabase
                .from('space_poll_options')
                .insert(optionsData)
                .select();

            if (optionsError) throw optionsError;

            setShowCreate(false);
            setQuestion('');
            setOptions(['', '']);
            setExpiresAt('');
            alert("Poll created successfully!");

            // Manual State Update (Optimistic-ish)
            const newPoll: Poll = {
                id: pollData.id,
                space_id: spaceId,
                question: pollData.question,
                created_by: user.id,
                created_at: pollData.created_at,
                expires_at: pollData.expires_at,
                is_active: pollData.is_active,
                options: createdOptions as PollOption[],
                user_vote_id: undefined,
                creator: {
                    full_name: user.user_metadata?.full_name || 'Me',
                    avatar_url: user.user_metadata?.avatar_url || ''
                }
            };

            setPolls(prev => [newPoll, ...prev]);

        } catch (err: any) {
            console.error("Create poll failed:", err);
            alert(`Failed to create poll: ${err.message || err.details || "Unknown error"}`);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("End this poll?")) return;
        await supabase.from('space_polls').update({ is_active: false }).eq('id', id);
        // Optimistic
        setPolls(prev => prev.map(p => p.id === id ? { ...p, is_active: false } : p));
    };

    const totalVotes = (poll: Poll) => poll.options.reduce((acc, curr) => acc + (curr.vote_count || 0), 0);

    return (
        <div className="space-y-6 p-4">
            <div className="flex justify-between items-center">
                <h3 className="font-bold text-lg dark:text-white flex items-center gap-2">
                    <BarChart2 className="text-[#ff1744]" /> Community Polls
                </h3>
                {isMember && (
                    <button
                        onClick={() => setShowCreate(!showCreate)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-black dark:bg-white text-white dark:text-black rounded-full text-sm font-bold"
                    >
                        <Plus size={16} /> New Poll
                    </button>
                )}
            </div>

            {showCreate && (
                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 space-y-3">
                    <input
                        placeholder="Ask a question..."
                        className="w-full text-lg font-bold bg-transparent border-b border-gray-200 dark:border-gray-700 py-2 focus:outline-none dark:text-white"
                        value={question}
                        onChange={e => setQuestion(e.target.value)}
                    />

                    {/* Expiration Input */}
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Clock size={16} />
                        <span>Ends at (optional):</span>
                        <input
                            type="datetime-local"
                            className="bg-gray-50 dark:bg-gray-700 rounded-lg p-1 text-xs outline-none"
                            value={expiresAt}
                            onChange={e => setExpiresAt(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        {options.map((opt, idx) => (
                            <input
                                key={idx}
                                placeholder={`Option ${idx + 1}`}
                                className="w-full p-2 rounded-lg bg-gray-50 dark:bg-gray-700 border-none text-sm dark:text-white"
                                value={opt}
                                onChange={e => {
                                    const newOpts = [...options];
                                    newOpts[idx] = e.target.value;
                                    setOptions(newOpts);
                                }}
                            />
                        ))}
                        <button
                            onClick={() => setOptions([...options, ''])}
                            className="text-xs text-[#ff1744] font-bold hover:underline"
                        >
                            + Add Option
                        </button>
                    </div>
                    <div className="flex justify-end pt-2">
                        <button onClick={handleCreate} className="px-4 py-2 bg-[#ff1744] text-white rounded-lg font-bold text-sm shadow-md hover:bg-red-600">
                            Post Poll
                        </button>
                    </div>
                </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
                {polls.map(poll => {
                    const total = totalVotes(poll);
                    const isClosed = !poll.is_active || (poll as any).is_expired;
                    const timeLeft = poll.expires_at ? new Date(poll.expires_at).getTime() - Date.now() : null;

                    return (
                        <div key={poll.id} className={cn("bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border relative group", isClosed ? "border-gray-200 dark:border-gray-700 opacity-75" : "border-gray-100 dark:border-gray-600")}>
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden">
                                        <img src={poll.creator?.avatar_url || `https://ui-avatars.com/api/?name=${poll.creator?.full_name}`} className="w-full h-full object-cover" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-sm dark:text-white">{poll.question}</h4>
                                        <div className="flex items-center gap-2 text-xs text-gray-400">
                                            <span>{new Date(poll.created_at).toLocaleDateString()}</span>
                                            {isClosed && <span className="text-red-500 font-bold border border-red-200 px-1 rounded">Ended</span>}
                                            {!isClosed && timeLeft && timeLeft > 0 && <span className="text-green-500">Ends in {Math.ceil(timeLeft / (1000 * 60 * 60 * 24))}d</span>}
                                        </div>
                                    </div>
                                </div>
                                {(role === 'owner' || role === 'moderator' || user?.id === poll.created_by) && (
                                    <button onClick={() => handleDelete(poll.id)} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Trash2 size={16} />
                                    </button>
                                )}
                            </div>

                            <div className="space-y-2">
                                {poll.options.map(opt => {
                                    const percent = total === 0 ? 0 : Math.round((opt.vote_count / total) * 100);
                                    const isVoted = poll.user_vote_id === opt.id;

                                    return (
                                        <button
                                            key={opt.id}
                                            onClick={() => handleVote(poll.id, opt.id)}
                                            disabled={!!poll.user_vote_id || isClosed}
                                            className={cn(
                                                "w-full relative h-10 rounded-lg overflow-hidden transition-all text-left",
                                                !!poll.user_vote_id || isClosed ? "cursor-default" : "hover:bg-gray-50 dark:hover:bg-gray-700"
                                            )}
                                        >
                                            {/* Progress Bar */}
                                            <div
                                                className={cn("absolute inset-y-0 left-0 transition-all duration-500", isVoted ? "bg-[#ff1744]/20" : "bg-gray-200 dark:bg-gray-600")}
                                                style={{ width: `${percent}%` }}
                                            />

                                            <div className="absolute inset-0 flex items-center justify-between px-3">
                                                <span className={cn("text-sm font-medium z-10 flex items-center gap-2", isVoted ? "text-[#ff1744]" : "text-gray-700 dark:text-gray-200")}>
                                                    {opt.text}
                                                    {isVoted && <CheckCircle size={14} />}
                                                </span>
                                                <span className="text-xs font-bold text-gray-500 z-10">{percent}%</span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                            <div className="mt-3 text-xs text-gray-400 text-right">
                                {total} votes
                            </div>
                        </div>
                    );
                })}
            </div>

            {polls.length === 0 && !loading && (
                <div className="text-center py-10 text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
                    <BarChart2 className="w-12 h-12 mx-auto mb-2 opacity-20" />
                    <p>No active polls.</p>
                </div>
            )}
        </div>
    );
};

export default SpacePolls;
