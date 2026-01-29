
export type TabType = 'chats' | 'feed' | 'spaces' | 'discover' | 'profile' | 'wallet';

export interface Post {
  id: string;
  author: {
    id: string;
    name: string;
    username: string;
    avatar: string;
    isVerified: boolean;
    badge_type?: 'blue' | 'creator' | 'business' | 'elite' | 'education' | 'founder';
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
  poll_options?: { text: string; count: number }[];
  user_vote?: number | null;
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
    badge_type?: 'blue' | 'creator' | 'business' | 'elite' | 'education' | 'founder';
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
  metadata?: any; // For background colors, fonts, etc.
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
  isLocked?: boolean;
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
    badge_type?: 'blue' | 'creator' | 'business' | 'elite' | 'education' | 'founder';
  };
  children?: Comment[];
}

export type SpaceRole = 'owner' | 'moderator' | 'member';

export interface SpaceMember {
  id?: string;
  user_id: string;
  space_id: string;
  role: SpaceRole;
  joined_at: string;
  profile?: {
    full_name: string;
    username: string;
    avatar_url: string;
  };
}

export interface PollOption {
  id: string;
  poll_id: string;
  text: string;
  vote_count: number;
}

export interface Poll {
  id: string;
  space_id: string;
  question: string;
  options: PollOption[];
  created_by: string;
  created_at: string;
  expires_at?: string;
  user_vote_id?: string; // If user voted
  is_active: boolean;
  creator?: {
    full_name: string;
    avatar_url: string;
  };
}

export interface SpaceResource {
  id: string;
  space_id: string;
  title: string;
  description?: string;
  url: string;
  type: 'link' | 'pdf' | 'doc' | 'image';
  created_by: string;
  created_at: string;
  uploader?: {
    full_name: string;
  };
}

export interface SpaceAnnouncement {
  id: string;
  space_id: string;
  content: string;
  created_at: string;
  active_until?: string;
}

export interface VoiceParticipant {
  user_id: string;
  joined_at: string;
  is_muted: boolean;
  is_speaking: boolean;
  profile?: {
    full_name: string;
    avatar_url: string;
  };
}
