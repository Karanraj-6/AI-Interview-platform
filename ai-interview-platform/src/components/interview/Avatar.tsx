'use client'

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';

import img1 from '@/assets/image_1.png';
import img2 from '@/assets/image_2.png';
import img3 from '@/assets/image_3.png';
import img4 from '@/assets/image_4.png';
import img5 from '@/assets/image_5.png';

const allImages = [img1, img2, img3, img4, img5];
const talkingIndices = [1, 2, 3, 4]; // indices for img2-img5

export default function Avatar({ isTalking }: { isTalking: boolean }) {
    const [activeIndex, setActiveIndex] = useState(0);
    const [prevIndex, setPrevIndex] = useState(0);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        if (isTalking) {
            const pick = talkingIndices[Math.floor(Math.random() * talkingIndices.length)];
            setPrevIndex(activeIndex);
            setActiveIndex(pick);

            intervalRef.current = setInterval(() => {
                setActiveIndex(prev => {
                    setPrevIndex(prev);
                    return talkingIndices[Math.floor(Math.random() * talkingIndices.length)];
                });
            }, 200);
        } else {
            setPrevIndex(activeIndex);
            setActiveIndex(0);
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [isTalking]);

    return (
        <div className="w-220 mx-auto" style={{ height: '70vh', aspectRatio: '16/9' }}>
            <div className="relative w-full h-full overflow-hidden bg-zinc-800 rounded-2xl">
                {/* Previous image stays fully visible underneath */}
                <Image
                    src={allImages[prevIndex]}
                    alt="AI Interviewer Avatar"
                    fill
                    className="object-cover"
                    priority
                    style={{ position: 'absolute', inset: 0, zIndex: 1 }}
                />
                {/* Active image fades in on top */}
                <Image
                    key={activeIndex}
                    src={allImages[activeIndex]}
                    alt="AI Interviewer Avatar"
                    fill
                    className="object-cover"
                    priority
                    style={{
                        position: 'absolute',
                        inset: 0,
                        zIndex: 2,
                        animation: 'fadeIn 100ms ease-in-out forwards',
                    }}
                />
            </div>
            <style jsx global>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
            `}</style>
        </div>
    );
}
