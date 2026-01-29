import React from 'react';
import { X, Download, Trash2, FileText, ExternalLink, PenLine } from 'lucide-react';
import { MyBagItem } from '../../types/mybag';

interface BagItemPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    item: MyBagItem | null;
    onDownload: (item: MyBagItem) => void;
    onDelete: (item: MyBagItem) => void;
    onEdit?: (item: MyBagItem) => void;
}

const BagItemPreviewModal: React.FC<BagItemPreviewModalProps> = ({ isOpen, onClose, item, onDownload, onDelete, onEdit }) => {
    if (!item) return null;

    const renderContent = () => {
        switch (item.type) {
            case 'image':
                return <img src={item.content} alt={item.title} className="w-full h-auto max-h-[70vh] object-contain rounded-lg" />;
            case 'video':
                return <video src={item.content} controls className="w-full max-h-[70vh] rounded-lg" />;
            case 'audio':
                return (
                    <div className="w-full p-8 flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-800 rounded-xl">
                        <audio src={item.content} controls className="w-full" />
                    </div>
                );
            case 'link':
                return (
                    <div className="text-center p-8">
                        <ExternalLink size={48} className="mx-auto text-blue-500 mb-4" />
                        <a href={item.content} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline break-all text-lg">
                            {item.content}
                        </a>
                        <p className="text-sm text-gray-500 mt-2">Tap to open link</p>
                    </div>
                );
            default: // note, message, file
                return (
                    <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-xl w-full max-h-[60vh] overflow-y-auto">
                        <p className="whitespace-pre-wrap text-gray-800 dark:text-gray-200 text-lg leading-relaxed">
                            {item.content}
                        </p>
                    </div>
                );
        }
    };

    return (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm transition-opacity duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
            <div className="bg-white dark:bg-gray-900 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden transform transition-all scale-100">

                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
                    <h3 className="font-bold text-lg truncate flex-1 pr-4">{item.title || 'Preview'}</h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 flex items-center justify-center min-h-[200px]">
                    {renderContent()}
                </div>

                {/* Footer Actions */}
                <div className="flex items-center justify-between p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
                    <span className="text-xs text-gray-500">
                        {new Date(item.created_at).toLocaleString()}
                    </span>

                    <div className="flex gap-3">
                        <button
                            onClick={() => onDelete(item)}
                            className="flex items-center gap-2 px-4 py-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg font-medium transition-colors"
                        >
                            <Trash2 size={18} />
                            <span>Delete</span>
                        </button>

                        {item.type === 'note' && (
                            <button
                                onClick={() => onEdit && onEdit(item)}
                                className="flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-700 rounded-lg font-medium transition-colors"
                            >
                                <PenLine size={18} />
                                <span>Edit</span>
                            </button>
                        )}

                        {(item.type === 'image' || item.type === 'video' || item.type === 'audio' || item.type === 'file') && (
                            <button
                                onClick={() => onDownload(item)}
                                className="flex items-center gap-2 px-4 py-2 bg-[#ff1744] text-white hover:bg-red-600 rounded-lg font-bold shadow-md transition-all active:scale-95"
                            >
                                <Download size={18} />
                                <span>Download</span>
                            </button>
                        )}
                    </div>
                </div>

            </div>

            {/* Backdrop close */}
            <div className="absolute inset-0 -z-10" onClick={onClose} />
        </div>
    );
};

export default BagItemPreviewModal;
