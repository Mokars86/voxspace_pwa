import React, { useState, useEffect } from 'react';
import { X, Shield, Trash2, Download, LogOut, KeyRound, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../services/db';


interface BagSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onLock: () => void;
    onChangePin: (oldPin: string, newPin: string) => Promise<boolean>;
}

const BagSettingsModal: React.FC<BagSettingsModalProps> = ({ isOpen, onClose, onLock, onChangePin }) => {
    const [mode, setMode] = useState<'menu' | 'change-pin'>('menu');
    const [step, setStep] = useState<'old' | 'new' | 'confirm'>('old');
    const [pinInput, setPinInput] = useState('');

    // Temporary storage for flow
    const [oldPin, setOldPin] = useState('');
    const [newPin, setNewPin] = useState('');

    useEffect(() => {
        if (!isOpen) {
            resetState();
        }
    }, [isOpen]);

    const resetState = () => {
        setMode('menu');
        setStep('old');
        setPinInput('');
        setOldPin('');
        setNewPin('');
    };

    if (!isOpen) return null;

    const handleClearBag = async () => {
        if (confirm("Are you sure you want to delete ALL items in My Bag? This cannot be undone.")) {
            if (confirm("Really delete everything locally?")) {
                await db.my_bag.clear();
                alert("Bag cleared locally.");
                onClose();
            }
        }
    };

    const handleExport = async () => {
        try {
            const items = await db.my_bag.toArray();
            const dataStr = JSON.stringify(items, null, 2);
            const blob = new Blob([dataStr], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `my-bag-backup-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            alert(`Exported ${items.length} items successfully!`);
        } catch (error) {
            console.error("Export failed:", error);
            alert("Export failed.");
        }
    };

    const handlePinSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (pinInput.length !== 4) return;

        if (step === 'old') {
            setOldPin(pinInput);
            setStep('new');
            setPinInput('');
        } else if (step === 'new') {
            setNewPin(pinInput);
            setStep('confirm');
            setPinInput('');
        } else if (step === 'confirm') {
            if (pinInput !== newPin) {
                alert("PINs do not match. Please try again.");
                setStep('new');
                setNewPin('');
                setPinInput('');
                return;
            }
            // Execute Change
            const success = await onChangePin(oldPin, pinInput);
            if (success) {
                alert("PIN changed successfully!");
                resetState();
                onClose();
            } else {
                alert("Incorrect Old PIN.");
                resetState();
                setMode('change-pin'); // Restart flow?
            }
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                    <h2 className="text-lg font-bold flex items-center gap-2 dark:text-white">
                        {mode === 'change-pin' ? (
                            <button onClick={resetState} className="mr-2 text-gray-400 hover:text-gray-600">
                                <ArrowLeft size={20} />
                            </button>
                        ) : (
                            <Shield className="text-[#ff1744]" size={20} />
                        )}
                        {mode === 'change-pin' ? 'Change PIN' : 'Bag Settings'}
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors dark:text-gray-400">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                {mode === 'menu' ? (
                    <div className="p-4 space-y-2">
                        <button onClick={onLock} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left">
                            <div className="p-2 bg-orange-100 dark:bg-orange-900/30 text-orange-600 rounded-lg">
                                <LogOut size={20} />
                            </div>
                            <div>
                                <div className="font-semibold dark:text-gray-200">Lock Bag Now</div>
                                <div className="text-xs text-gray-500">Require PIN to re-enter</div>
                            </div>
                        </button>

                        <button onClick={() => setMode('change-pin')} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left">
                            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-lg">
                                <KeyRound size={20} />
                            </div>
                            <div>
                                <div className="font-semibold dark:text-gray-200">Change PIN</div>
                                <div className="text-xs text-gray-500">Update your 4-digit code</div>
                            </div>
                        </button>

                        <button onClick={handleExport} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left">
                            <div className="p-2 bg-green-100 dark:bg-green-900/30 text-green-600 rounded-lg">
                                <Download size={20} />
                            </div>
                            <div>
                                <div className="font-semibold dark:text-gray-200">Export / Backup</div>
                                <div className="text-xs text-gray-500">Download data as JSON</div>
                            </div>
                        </button>

                        <div className="h-px bg-gray-100 dark:bg-gray-800 my-2" />

                        <button onClick={handleClearBag} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors text-left group">
                            <div className="p-2 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-lg group-hover:bg-red-200 dark:group-hover:bg-red-900/50">
                                <Trash2 size={20} />
                            </div>
                            <div>
                                <div className="font-semibold text-red-600">Clear All Data</div>
                                <div className="text-xs text-red-400">Delete local storage</div>
                            </div>
                        </button>
                    </div>
                ) : (
                    <div className="p-6">
                        <div className="text-center mb-6">
                            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
                                <KeyRound size={24} />
                            </div>
                            <h3 className="font-bold text-lg dark:text-white mb-1">
                                {step === 'old' ? 'Enter Current PIN' : step === 'new' ? 'Create New PIN' : 'Confirm New PIN'}
                            </h3>
                            <p className="text-xs text-gray-500">
                                {step === 'old' ? 'Verify it\'s you' : step === 'new' ? 'Choose a 4-digit code' : 'Re-enter to confirm'}
                            </p>
                        </div>

                        <form onSubmit={handlePinSubmit}>
                            <div className="flex justify-center mb-8">
                                <input
                                    type="password"
                                    value={pinInput}
                                    onChange={e => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                                    className="bg-gray-50 dark:bg-gray-800 border-2 border-transparent focus:border-blue-500 text-center text-3xl tracking-[0.5em] w-48 py-3 rounded-xl outline-none font-bold"
                                    autoFocus
                                    placeholder="••••"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={pinInput.length !== 4}
                                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all active:scale-95"
                            >
                                {step === 'confirm' ? 'Set PIN' : 'Next'}
                            </button>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BagSettingsModal;
