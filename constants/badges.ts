export type BadgeType = 'founder' | 'verified' | 'premium' | 'admin' | 'moderator';

export const getBadgeColor = (type: BadgeType | string): string => {
    switch (type) {
        case 'founder': return '#FFD700'; // Gold
        case 'verified': return '#1D9BF0'; // Blue
        case 'premium': return '#FF1744'; // Brand Red
        case 'admin': return '#000000'; // Black
        case 'moderator': return '#10B981'; // Green
        default: return '#9CA3AF'; // Gray
    }
};
