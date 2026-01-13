import React from 'react';
import { X, Download, ZoomIn, ZoomOut } from 'lucide-react';

interface ImageViewerProps {
    isOpen: boolean;
    onClose: () => void;
    src?: string;
    images?: string[]; // Array of URLs
    alt?: string;
}

const ImageViewer: React.FC<ImageViewerProps> = ({ isOpen, onClose, src, images, alt }) => {
    const [scale, setScale] = React.useState(1);
    const [position, setPosition] = React.useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = React.useState(false);
    const dragStart = React.useRef({ x: 0, y: 0 });
    const [currentIndex, setCurrentIndex] = React.useState(0);

    // Gallery Logic
    const allImages = React.useMemo(() => {
        if (images && images.length > 0) return images;
        if (src) return [src];
        return [];
    }, [images, src]);

    React.useEffect(() => {
        if (isOpen) {
            if (src && allImages.includes(src)) {
                setCurrentIndex(allImages.indexOf(src));
            } else {
                setCurrentIndex(0);
            }
            setScale(1);
            setPosition({ x: 0, y: 0 });
        }
    }, [isOpen, src, allImages]);

    const navigate = (dir: 1 | -1) => {
        const newIndex = currentIndex + dir;
        if (newIndex >= 0 && newIndex < allImages.length) {
            setCurrentIndex(newIndex);
            setScale(1);
            setPosition({ x: 0, y: 0 });
        }
    };

    // Zoom Controls
    const handleZoomStep = (step: number) => {
        const newScale = Math.min(Math.max(1, scale + step), 4);
        setScale(newScale);
        if (newScale === 1) setPosition({ x: 0, y: 0 });
    };

    // Swipe & Pinch Logic
    const touchStart = React.useRef<{ x: number, dist: number } | null>(null);

    const getTouchDist = (touches: React.TouchList) => {
        return Math.hypot(
            touches[0].clientX - touches[1].clientX,
            touches[0].clientY - touches[1].clientY
        );
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        if (e.touches.length === 2) {
            // Pinch Start
            const dist = getTouchDist(e.touches);
            touchStart.current = { x: 0, dist }; // We only care about dist for pinch
        } else if (e.touches.length === 1 && scale === 1) {
            // Swipe Start
            touchStart.current = { x: e.touches[0].clientX, dist: 0 };
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (e.touches.length === 2 && touchStart.current) {
            // Pinch Move
            const dist = getTouchDist(e.touches);
            const scaleChange = dist / touchStart.current.dist;
            // Simple pinch zoom: adjusting scale relative to previous pinch start
            // To make it smoother we might want to track initial scale
            // simplified:
            const newScale = Math.min(Math.max(1, scale * scaleChange), 4);
            setScale(newScale);
        }
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        if (touchStart.current && e.changedTouches.length === 1 && scale === 1 && e.touches.length === 0) {
            // Swipe End Logic
            // Only if we weren't pinching
            if (touchStart.current.dist === 0) {
                const diff = e.changedTouches[0].clientX - touchStart.current.x;
                if (Math.abs(diff) > 50) {
                    if (diff > 0) navigate(-1); // Right -> Prev
                    else navigate(1); // Left -> Next
                }
            }
        }
        touchStart.current = null;
    };


    // Keyboard Nav
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;
            if (e.key === 'ArrowRight') navigate(1);
            if (e.key === 'ArrowLeft') navigate(-1);
            if (e.key === 'Escape') onClose();
            if (e.key === '+' || e.key === '=') handleZoomStep(0.5);
            if (e.key === '-') handleZoomStep(-0.5);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, currentIndex, allImages, scale]);


    if (!isOpen || allImages.length === 0) return null;

    const currentSrc = allImages[currentIndex];

    // Mouse Wheel Zoom
    const handleWheel = (e: React.WheelEvent) => {
        e.stopPropagation();
        const delta = e.deltaY * -0.01;
        const newScale = Math.min(Math.max(1, scale + delta), 4);
        setScale(newScale);
        if (newScale === 1) setPosition({ x: 0, y: 0 });
    };

    // Pan (Drag) Logic
    const handleMouseDown = (e: React.MouseEvent) => {
        if (scale > 1) {
            e.preventDefault();
            setIsDragging(true);
            dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDragging && scale > 1) {
            e.preventDefault();
            const newX = e.clientX - dragStart.current.x;
            const newY = e.clientY - dragStart.current.y;
            // Add bounds check later if needed, for now free pan
            setPosition({ x: newX, y: newY });
        }
    };

    const handleMouseUp = () => setIsDragging(false);

    const handleDoubleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (scale > 1) {
            setScale(1);
            setPosition({ x: 0, y: 0 });
        } else {
            setScale(2.5);
        }
    };

    return (
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 backdrop-blur-md animate-in fade-in duration-200 overflow-hidden touch-none"
            onClick={onClose}
            onWheel={handleWheel}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            {/* Header Controls */}
            <div className="absolute top-4 right-4 flex items-center gap-4 z-50">
                <span className="text-white/80 font-medium hidden md:inline">
                    {currentIndex + 1} / {allImages.length}
                </span>

                <div className="flex items-center gap-1 bg-white/10 rounded-full p-1 border border-white/10 backdrop-blur-sm">
                    <button
                        onClick={(e) => { e.stopPropagation(); handleZoomStep(-0.5); }}
                        className="p-2 hover:bg-white/20 rounded-full text-white transition-colors"
                        title="Zoom Out"
                    >
                        <ZoomOut size={20} />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); handleZoomStep(0.5); }}
                        className="p-2 hover:bg-white/20 rounded-full text-white transition-colors"
                        title="Zoom In"
                    >
                        <ZoomIn size={20} />
                    </button>
                </div>

                <a
                    href={currentSrc}
                    download={`voxspace_image_${currentIndex}.jpg`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
                    onClick={(e) => e.stopPropagation()}
                    title="Download"
                >
                    <Download size={24} />
                </a>

                <button
                    onClick={onClose}
                    className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
                >
                    <X size={24} />
                </button>
            </div>


            {/* Content */}
            <div
                className="relative w-full h-full flex items-center justify-center overflow-hidden"
                onDoubleClick={handleDoubleClick}
            >
                {/* Nav Buttons (Desktop) - Only show if not zoomed significantly to avoid blocking pan */}
                {allImages.length > 1 && scale === 1 && (
                    <>
                        <button
                            onClick={(e) => { e.stopPropagation(); navigate(-1); }}
                            className="absolute left-4 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white z-50 hidden md:flex backdrop-blur-sm"
                            disabled={currentIndex === 0}
                        >
                            ←
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); navigate(1); }}
                            className="absolute right-4 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white z-50 hidden md:flex backdrop-blur-sm"
                            disabled={currentIndex === allImages.length - 1}
                        >
                            →
                        </button>
                    </>
                )}

                <img
                    key={currentSrc}
                    src={currentSrc}
                    alt={alt || "Preview"}
                    className="max-h-[90vh] max-w-[90vw] object-contain transition-transform duration-75 ease-linear"
                    style={{
                        transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
                        cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in'
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    draggable={false}
                />
            </div>

            {/* Mobile Footer Counter */}
            <div className="absolute bottom-6 left-0 right-0 text-center md:hidden pointer-events-none">
                <span className="bg-black/50 px-3 py-1 rounded-full text-white text-sm backdrop-blur-sm">
                    {currentIndex + 1} / {allImages.length}
                </span>
            </div>
        </div>
    );
};

export default ImageViewer;
