import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'react-qr-code';
import QrScanner from 'qr-scanner';
import { X, Copy, Check, Info } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { useNavigate } from 'react-router-dom';

interface QRCodeModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const QRCodeModal: React.FC<QRCodeModalProps> = ({ isOpen, onClose }) => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'my-code' | 'scan-code'>('my-code');
    const [copied, setCopied] = useState(false);
    const [scanError, setScanError] = useState('');
    const [scannedData, setScannedData] = useState('');

    // Video element ref
    const videoRef = useRef<HTMLVideoElement>(null);
    const scannerRef = useRef<QrScanner | null>(null);

    // Initialization Effect
    useEffect(() => {
        if (isOpen && activeTab === 'scan-code' && !scannedData) {
            // Slight delay to ensure video element is mounted
            const timer = setTimeout(() => {
                if (videoRef.current && !scannerRef.current) {
                    const scanner = new QrScanner(
                        videoRef.current,
                        (result) => {
                            // result is an object { data: string, ... } or string depending on version, 
                            // usually object in newer versions.
                            const data = typeof result === 'string' ? result : result?.data;
                            if (data) handleScan(data);
                        },
                        {
                            onDecodeError: (error) => {
                                // console.log(error); // ignore errors
                            },
                            highlightScanRegion: true,
                            highlightCodeOutline: true,
                        }
                    );

                    scanner.start().catch(err => console.error("Scanner start error", err));
                    scannerRef.current = scanner;
                }
            }, 100);

            return () => {
                clearTimeout(timer);
                if (scannerRef.current) {
                    scannerRef.current.stop();
                    scannerRef.current.destroy();
                    scannerRef.current = null;
                }
            };
        }

        return () => {
            if (scannerRef.current) {
                scannerRef.current.stop();
                scannerRef.current.destroy();
                scannerRef.current = null;
            }
        };
    }, [isOpen, activeTab, scannedData]);

    if (!isOpen || !user) return null;

    const myQrData = `voxspace:user:${user.id}`;

    const handleCopy = () => {
        navigator.clipboard.writeText(user.username || user.id);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleScan = async (data: string) => {
        if (data && !scannedData) {
            if (data.startsWith('voxspace:user:')) {
                setScannedData(data); // prevent further scans

                // Stop scanner
                if (scannerRef.current) {
                    scannerRef.current.stop();
                    scannerRef.current.destroy();
                    scannerRef.current = null;
                }

                const targetUserId = data.split(':')[2];
                if (targetUserId === user.id) {
                    setScanError("You cannot scan your own code.");
                    return;
                }

                try {
                    // Call backend to get or create DM
                    const { data: chatId, error } = await supabase.rpc('get_or_create_dm', {
                        target_user_id: targetUserId
                    });

                    if (error) throw error;

                    onClose();
                    navigate(`/chat/${chatId}`);
                } catch (err) {
                    console.error("Scan processing error:", err);
                    setScanError("Could not start chat. User might be invalid.");
                }
            } else {
                setScanError("Invalid QR Code");
            }
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-sm mx-4 rounded-3xl overflow-hidden shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b">
                    <h3 className="font-bold text-lg">QR Code</h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
                        <X size={20} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex p-1 bg-gray-100 m-4 rounded-xl">
                    <button
                        className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'my-code' ? 'bg-white shadow-sm text-black' : 'text-gray-500 hover:text-gray-700'}`}
                        onClick={() => setActiveTab('my-code')}
                    >
                        My Code
                    </button>
                    <button
                        className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'scan-code' ? 'bg-white shadow-sm text-black' : 'text-gray-500 hover:text-gray-700'}`}
                        onClick={() => setActiveTab('scan-code')}
                    >
                        Scan Code
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 pt-2 min-h-[400px] flex flex-col items-center justify-center">
                    {activeTab === 'my-code' ? (
                        <div className="flex flex-col items-center w-full animate-in slide-in-from-left duration-200">
                            <div className="bg-white p-4 rounded-2xl border-2 border-[#ff1744]/20 shadow-lg mb-6">
                                <QRCode
                                    value={myQrData}
                                    size={200}
                                    className="h-auto max-w-full"
                                    viewBox={`0 0 256 256`}
                                />
                            </div>
                            <div className="text-center mb-6">
                                <p className="font-bold text-xl mb-1">@{user.username || 'User'}</p>
                                <p className="text-sm text-gray-500">Share this code to start a chat</p>
                            </div>

                            <button
                                onClick={handleCopy}
                                className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-full text-sm font-medium transition-colors"
                            >
                                {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                                {copied ? 'Copied!' : 'Copy Username'}
                            </button>
                        </div>
                    ) : (
                        <div className="w-full flex flex-col items-center justify-center animate-in slide-in-from-right duration-200 bg-black rounded-xl overflow-hidden relative">
                            {/* Video Element for QrScanner */}
                            <video
                                ref={videoRef}
                                className="w-full h-full object-cover"
                                playsInline // Important for iOS
                                muted // Important for some browsers to autoplay
                            />

                            {scanError && (
                                <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-20 bg-red-500 text-white px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 shadow-lg whitespace-nowrap">
                                    <Info size={16} className="shrink-0" />
                                    {scanError}
                                </div>
                            )}

                            {/* Finder overlay */}
                            <div className="absolute inset-0 pointer-events-none border-[40px] border-black/50">
                                <div className="w-full h-full border-2 border-white/50 relative">
                                    <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-[#ff1744]"></div>
                                    <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-[#ff1744]"></div>
                                    <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-[#ff1744]"></div>
                                    <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-[#ff1744]"></div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default QRCodeModal;
