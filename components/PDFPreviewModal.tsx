import React from 'react';
import { X, ExternalLink } from 'lucide-react';

interface PDFPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    url: string;
    title?: string;
}

const PDFPreviewModal: React.FC<PDFPreviewModalProps> = ({ isOpen, onClose, url, title }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200">
            {/* Header */}
            <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between text-white z-50 bg-gradient-to-b from-black/50 to-transparent">
                <h3 className="font-bold truncate max-w-[80%] drop-shadow-md">
                    {title || "PDF Preview"}
                </h3>
                <div className="flex items-center gap-4">
                    <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 hover:bg-white/10 rounded-full transition-colors"
                        title="Open external"
                    >
                        <ExternalLink size={24} />
                    </a>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-full transition-colors"
                    >
                        <X size={28} />
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="w-full h-full pt-16 pb-4 px-0 md:px-4 flex items-center justify-center">
                <div className="w-full h-full max-w-5xl bg-white rounded-none md:rounded-xl overflow-hidden shadow-2xl">
                    <iframe
                        src={url}
                        className="w-full h-full border-0"
                        title="PDF Viewer"
                    />
                </div>
            </div>
        </div>
    );
};

export default PDFPreviewModal;
