
import { Zap } from 'lucide-react';

export enum BadgeType {
  BLUE = 'blue',
  CREATOR = 'creator',
  BUSINESS = 'business',
  ELITE = 'elite',
  EDUCATION = 'education',
  FOUNDER = 'founder',
}

export interface BadgeDefinition {
  id: BadgeType;
  name: string;
  color: string;
  description: string;
  features: string[];
  price?: string; // Display string for now
}

export const BADGES: BadgeDefinition[] = [
  {
    id: BadgeType.BLUE,
    name: 'Blue Badge',
    color: '#3b82f6', // blue-500
    description: 'For serious users',
    features: [
      'Profile verification',
      'Post priority',
      'Custom username colors',
      'Longer posts',
    ],
    price: '$8/mo',
  },
  {
    id: BadgeType.CREATOR,
    name: 'Creator Badge',
    color: '#a855f7', // purple-500
    description: 'For content creators',
    features: [
      'Monetization tools',
      'Tip button',
      'Subscriber-only posts',
      'Analytics dashboard',
    ],
    price: '$12/mo',
  },
  {
    id: BadgeType.BUSINESS,
    name: 'Business Badge',
    color: '#eab308', // yellow-500
    description: 'For brands',
    features: [
      'Business profile',
      'Product showcase',
      'Auto-replies',
      'Ad credits',
    ],
    price: '$50/mo',
  },
  {
    id: BadgeType.ELITE,
    name: 'Elite Badge',
    color: '#ef4444', // red-500 (using red/fire color for Elite/Fire)
    description: 'Premium status',
    features: [
      'All features',
      'VIP spaces',
      'Early access',
      'Premium AI tools',
    ],
    price: '$100/mo',
  },
  {
    id: BadgeType.EDUCATION,
    name: 'Education Badge',
    color: '#22c55e', // green-500
    description: 'For schools, teachers, communities',
    features: [
      'Private class spaces',
      'Student management',
      'Announcements',
      'File sharing',
    ],
    price: 'Free for verified',
  },
  {
    id: BadgeType.FOUNDER,
    name: 'Founder Badge',
    color: '#ff1744', // Special Red
    description: 'Limited Edition for early supporters',
    features: [
      'Rare status',
      'Increases in value',
      'Special recognition',
    ],
    price: 'Invite Only',
  },
];

export const getBadgeColor = (type: BadgeType): string => {
  const badge = BADGES.find((b) => b.id === type);
  return badge ? badge.color : '#3b82f6';
};
