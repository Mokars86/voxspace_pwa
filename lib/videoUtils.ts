export const generateVideoThumbnail = (file: File): Promise<Blob | null> => {
    return new Promise((resolve) => {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.onloadedmetadata = () => {
            // Seek to 0.5s or 1s to ensure we have a frame (avoiding black screen at 0s)
            video.currentTime = 1;
        };
        video.onseeked = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    canvas.toBlob((blob) => {
                        resolve(blob);
                        URL.revokeObjectURL(video.src); // Cleanup
                    }, 'image/jpeg', 0.7);
                } else {
                    resolve(null);
                }
            } catch (e) {
                console.error("Error generating thumbnail", e);
                resolve(null);
            }
        };
        video.onerror = () => {
            resolve(null);
        };
        video.src = URL.createObjectURL(file);
    });
};
