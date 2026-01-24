import React, { useState, useEffect } from 'react';
import { Users, Hash, Mic, Globe, Search, Plus, Loader2 } from 'lucide-react';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { Space } from '../types';
import CreateSpaceModal from './CreateSpaceModal';

import { useNavigate } from 'react-router-dom';

const SpacesView: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [activeCategory, setActiveCategory] = useState('All');
  const [showAllSpaces, setShowAllSpaces] = useState(false);

  const fetchSpaces = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('spaces')
        .select('*')
        .order('members_count', { ascending: false });

      if (activeCategory !== 'All') {
        query = query.eq('category', activeCategory);
      }

      const { data, error } = await query;

      if (error) throw error;

      let displaySpaces = data;

      // If NOT showing all spaces, we filter to show only "Recommended" (unjoined)
      // If showing ALL spaces, we just show everything (maybe we can visually indicate joined status later)
      if (!showAllSpaces && user) {
        const { data: joinedData } = await supabase
          .from('space_members')
          .select('space_id')
          .eq('user_id', user.id);

        const joinedIds = new Set(joinedData?.map((j: any) => j.space_id));
        displaySpaces = data.filter((s: any) => !joinedIds.has(s.id));
      }

      // Limit results if not showing all
      const limit = showAllSpaces ? 100 : 10;

      const formattedSpaces: Space[] = displaySpaces.slice(0, limit).map((s: any) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        members: s.members_count || 0,
        isLive: s.is_live,
        banner: s.banner_url || 'https://images.unsplash.com/photo-1518770660439-4636190af475?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'
      }));

      setSpaces(formattedSpaces);

    } catch (error) {
      console.error("Error fetching spaces", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSpaces();
  }, [activeCategory, showAllSpaces]);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 relative transition-colors">
      <div className="p-4 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold tracking-tight dark:text-white">Spaces</h2>
          <button
            onClick={() => setShowCreateModal(true)}
            className="p-2 bg-[#ff1744] text-white rounded-full hover:bg-red-600 transition-colors shadow-md"
          >
            <Plus size={20} />
          </button>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Find communities..."
            className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-800 rounded-xl border-none focus:ring-1 focus:ring-[#ff1744] outline-none text-sm font-medium dark:text-white dark:placeholder:text-gray-500"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-2">
          {['All', 'Tech', 'Music', 'Politics', 'Crypto', 'Art'].map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${activeCategory === cat
                ? 'bg-black dark:bg-white text-white dark:text-black'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-4 flex-1 overflow-y-auto">
        {/* Live Spaces */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Mic size={20} className="text-[#ff1744]" />
            <h3 className="font-bold text-lg dark:text-white">Happening Now</h3>
          </div>
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-4 text-white shadow-lg relative overflow-hidden">
            <div className="relative z-10">
              <div className="flex items-start justify-between mb-4">
                <span className="bg-white/20 backdrop-blur-md px-2 py-1 rounded-md text-xs font-bold uppercase tracking-wider">Live</span>
                <div className="flex -space-x-2">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="w-8 h-8 rounded-full bg-gray-300 border-2 border-purple-600" />
                  ))}
                </div>
              </div>
              <h4 className="text-xl font-bold mb-1">Future of AI Agents</h4>
              <p className="text-white/80 text-sm mb-4">Discussion with top engineers from Google & OpenAI</p>
              <button className="w-full py-2 bg-white text-purple-600 font-bold rounded-xl">Join Listening</button>
            </div>
          </div>
        </section>

        {/* Popular Spaces */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Globe size={20} className="text-blue-500" />
              <h3 className="font-bold text-lg dark:text-white">
                {showAllSpaces ? 'All Spaces' : 'Recommended Spaces'}
              </h3>
            </div>
            <button
              onClick={() => {
                setShowAllSpaces(!showAllSpaces);
                // Trigger fetch immediately or depend on useEffect
              }}
              className="text-sm text-[#ff1744] font-bold hover:underline"
            >
              {showAllSpaces ? 'Show Less' : 'View All'}
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center"><Loader2 className="animate-spin text-gray-400" /></div>
          ) : (
            <div className={`grid gap-3 ${showAllSpaces ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-2'}`}>
              {spaces.length > 0 ? spaces.map(space => (
                <div
                  key={space.id}
                  onClick={() => navigate(`/space/${space.id}`)}
                  className="relative aspect-square rounded-2xl overflow-hidden group cursor-pointer bg-gray-100"
                >
                  <img src={space.banner} alt={space.name} className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                  <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
                    <h4 className="text-white font-bold text-sm leading-tight">{space.name}</h4>
                    <p className="text-white/70 text-xs">{space.members} members</p>
                  </div>
                </div>
              )) : (
                <div className="col-span-2 text-center text-gray-400 py-4">No spaces found. Create one!</div>
              )}
            </div>
          )}
        </section>
      </div>

      {showCreateModal && (
        <CreateSpaceModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={fetchSpaces}
        />
      )}
    </div>
  );
};

export default SpacesView;
