
import React from 'react';
import { Zap } from 'lucide-react';
import { BadgeType, getBadgeColor } from '../src/constants/badges';

interface BadgeIconProps {
    type: BadgeType | string;
    size?: number;
    className?: string;
}

export const BadgeIcon: React.FC<BadgeIconProps> = ({ type, size = 16, className = '' }) => {
    const color = getBadgeColor(type as BadgeType);

    return (
        <div
            className={`inline-flex items-center justify-center rounded-full border-2 border-white dark:border-gray-900 ${className}`}
            style={{ backgroundColor: color }}
            title={`${type} Badge`}
        >
            <Zap
                size={size}
                color="white"
                fill="white"
                className="drop-shadow-sm"
            />
        </div>
    );
};
