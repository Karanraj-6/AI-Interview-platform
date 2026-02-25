'use client'

import { useEffect, useRef } from 'react';
import { useInterviewStore } from '@/store/interviewStore';
import { MicOff, VideoOff } from 'lucide-react';

export default function Webcam({ stream }: { stream: MediaStream | null }) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const { isMicOn, isWebcamOn } = useInterviewStore();

    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
        }
    }, [stream]);

    return (
        <div className="relative w-48 h-36 md:w-80 md:h-60 bg-zinc-900 rounded-2xl overflow-hidden border-2 border-zinc-700 shadow-xl">
            {!isWebcamOn && (
                <div className="absolute inset-0 flex items-center justify-center bg-zinc-900 z-10 transition-opacity duration-300">
                    <VideoOff className="w-10 h-10 text-zinc-500" />
                </div>
            )}
            {!isMicOn && (
                <div className="absolute top-3 right-3 p-1.5 bg-red-500/90 rounded-full z-20 shadow-md">
                    <MicOff className="w-4 h-4 text-white" />
                </div>
            )}
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                // scale-x-[-1] mirrors the webcam feed like a mirror
                className={`w-full h-full object-cover transform scale-x-[-1] transition-opacity duration-300 ${!isWebcamOn ? 'opacity-0' : 'opacity-100'}`}
            />
        </div>
    );
}
