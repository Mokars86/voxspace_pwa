
export type TabType = 'chats' | 'feed' | 'spaces' | 'discover' | 'profile' | 'wallet';

export interface Post {
  id: string;
  author: {
    id: string;
    name: string;
    username: string;
    avatar: string;
    isVerified: boolean;
  };
  content: string;
  timestamp: string;
  likes: number;
  comments: number;
  reposts: number;
  media?: string;
  media_type?: 'image' | 'audio' | 'video';
  location?: { lat: number, lng: number, name: string };
  isLiked?: boolean;
  repostOf?: Post; // For quotes/reposts
  repostAuthor?: string;
  space_id?: string;
  is_pinned?: boolean;
}

export interface SpaceEvent {
  id: string;
  space_id: string;
  title: string;
  description: string;
  start_time: string;
  location: string;
  created_by: string;
}

// Consolidated Story Interface
export interface Story {
  id: string;
  user_id: string;
  user?: {
    username: string;
    avatar_url: string;
  };
  media_url?: string;
  content?: string;
  type: 'image' | 'text' | 'video' | 'voice' | 'poll';
  created_at: string;
  expires_at: string;
  is_viewed?: boolean;
  privacy_level?: 'public' | 'followers' | 'only_me';
  views_count?: number;
  poll_options?: { text: string; count: number }[];
  user_vote?: number; // Index of option user voted for
}

export interface ChatPreview {
  id: string;
  name: string;
  lastMessage: string;
  time: string;
  unread: number;
  avatar: string;
  isOnline: boolean;
  isTyping?: boolean;
  isArchived?: boolean;
  isGroup?: boolean;
  status?: 'accepted' | 'pending' | 'rejected' | 'blocked';
  isPinned?: boolean;
}


export interface Space {
  id: string;
  name: string;
  description: string;
  members: number;
  isLive: boolean;
  banner: string;
  speakers?: string[];
}

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  parent_id?: string | null;
  profiles?: {
    full_name: string;
    avatar_url: string;
    username: string;
  };
  children?: Comment[];
}
