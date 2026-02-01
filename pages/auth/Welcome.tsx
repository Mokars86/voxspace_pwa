import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap } from 'lucide-react';
import { cn } from '../../lib/utils';

const Welcome: React.FC = () => {
    const navigate = useNavigate();
    const [animationStep, setAnimationStep] = useState(0);

    useEffect(() => {
        const t1 = setTimeout(() => setAnimationStep(1), 500); // Logo appear
        const t2 = setTimeout(() => setAnimationStep(2), 1500); // Text appear
        const t3 = setTimeout(() => setAnimationStep(3), 2000); // Buttons appear

        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
            clearTimeout(t3);
        };
    }, []);

    return (
        <div className="flex flex-col h-screen bg-background relative overflow-hidden">
            {/* Background blobs */}
            <div className="absolute top-[-20%] right-[-20%] w-[500px] h-[500px] bg-red-100/50 rounded-full blur-[100px]" />
            <div className="absolute bottom-[-20%] left-[-20%] w-[500px] h-[500px] bg-orange-100/50 rounded-full blur-[100px]" />

            <div className="flex-1 flex flex-col items-center justify-center p-8 z-10 transition-all duration-1000">
                <div
                    className={cn(
                        "w-24 h-24 bg-[#ff1744] rounded-full flex items-center justify-center shadow-xl mb-8 transform transition-all duration-1000",
                        animationStep >= 1 ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-10 scale-90"
                    )}
                >
                    <Zap size={48} className="text-white fill-white" />
                </div>

                <div className={cn(
                    "text-center space-y-2 transition-all duration-1000 delay-300",
                    animationStep >= 2 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
                )}>
                    <h1 className="text-4xl font-bold tracking-tight">
                        <span className="text-black dark:text-white">Vox</span><span className="text-[#ff1744]">Space</span>
                    </h1>
                    <p className="text-xl text-gray-500 font-medium">
                        Voice of the People
                    </p>
                </div>
            </div>

            <div className={cn(
                "p-8 space-y-4 z-10 transition-all duration-1000 delay-500",
                animationStep >= 3 ? "translate-y-0 opacity-100" : "translate-y-20 opacity-0"
            )}>
                <button
                    onClick={() => navigate('/login')}
                    className="w-full py-4 text-white bg-gray-900 dark:bg-white dark:text-gray-900 rounded-2xl font-semibold text-lg hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-gray-200"
                >
                    Get Started
                </button>
                <p className="text-center text-sm text-gray-400">
                    By continuing, you agree to our Terms & Privacy Policy.
                </p>
            </div>
        </div>
    );
};

export default Welcome;
