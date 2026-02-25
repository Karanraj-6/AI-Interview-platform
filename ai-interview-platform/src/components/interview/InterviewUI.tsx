'use client'

import { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleGenAI } from '@google/genai';
import { useInterviewStore, InterviewMessage } from '@/store/interviewStore';
import Avatar from './Avatar';
import Webcam from './Webcam';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function InterviewUI({ interview, userName }: { interview: any, userName: string }) {
    const router = useRouter();
    const { isConnected, setIsConnected, isMicOn, isWebcamOn, toggleMic, toggleWebcam, messages, addMessage } = useInterviewStore();

    const [isInitializing, setIsInitializing] = useState(false);
    const [isEvaluating, setIsEvaluating] = useState(false);
    const [errorStatus, setErrorStatus] = useState<string | null>(null);

    // Refs to prevent state closure issues inside callbacks
    const isMicOnRef = useRef(isMicOn);
    useEffect(() => { isMicOnRef.current = isMicOn; }, [isMicOn]);

    const sessionRef = useRef<any>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const inputAudioCtxRef = useRef<AudioContext | null>(null);
    const playbackAudioCtxRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const isAISpeakingRef = useRef(false);

    // PCM audio queue for single-stream playback (no more hundreds of AudioBufferSourceNodes)
    const audioQueueRef = useRef<Float32Array[]>([]);
    const isPlayingRef = useRef(false);
    const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);

    // Expose talking state to Avatar
    const [isTalking, setIsTalking] = useState(false);

    // Transcript tracking for post-interview evaluation
    const transcriptRef = useRef<{ role: 'ai' | 'user'; text: string }[]>([]);
    const currentAITurnTextRef = useRef('');

    // Single-stream playback: dequeue PCM chunks and play them one at a time
    const playNextChunk = useCallback(() => {
        const audioCtx = playbackAudioCtxRef.current;
        const analyser = analyserRef.current;
        if (!audioCtx || audioCtx.state === 'closed') {
            isPlayingRef.current = false;
            return;
        }

        if (audioQueueRef.current.length === 0) {
            isPlayingRef.current = false;
            return;
        }

        isPlayingRef.current = true;
        const chunk = audioQueueRef.current.shift()!;

        const buffer = audioCtx.createBuffer(1, chunk.length, 24000);
        buffer.getChannelData(0).set(chunk);

        const source = audioCtx.createBufferSource();
        source.buffer = buffer;
        if (analyser) {
            source.connect(analyser);
        }

        currentSourceRef.current = source;

        source.onended = () => {
            currentSourceRef.current = null;
            // Play next chunk when this one finishes (true sequential single-stream)
            if (audioQueueRef.current.length > 0) {
                playNextChunk();
            } else {
                isPlayingRef.current = false;
            }
        };

        source.start(0); // Play immediately
    }, []);

    // Stop everything
    const cleanup = useCallback(() => {
        if (sessionRef.current) {
            try { sessionRef.current.close(); } catch (e) { /* ignore close errors */ }
            sessionRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
        }
        if (inputAudioCtxRef.current && inputAudioCtxRef.current.state !== 'closed') {
            inputAudioCtxRef.current.close();
        }
        if (playbackAudioCtxRef.current && playbackAudioCtxRef.current.state !== 'closed') {
            playbackAudioCtxRef.current.close();
        }

        // Clear audio queue
        audioQueueRef.current = [];
        isPlayingRef.current = false;

        setIsConnected(false);
    }, []);

    useEffect(() => {
        // Component unmount cleanup
        return cleanup;
    }, [cleanup]);

    const startInterview = async () => {
        // Guard against double-connections
        if (sessionRef.current) {
            console.warn('Session already active, skipping duplicate connect.');
            return;
        }
        setIsInitializing(true);
        setErrorStatus(null);
        try {
            // 1. Fetch API Token + Company Research in parallel
            const [tokenRes, researchRes] = await Promise.all([
                fetch('/api/gemini-token'),
                fetch('/api/company-research', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        companyName: interview.company_name || '',
                        jobRole: interview.job_role,
                        interviewRound: interview.interview_round,
                    }),
                }).catch(() => null),
            ]);
            if (!tokenRes.ok) throw new Error("Failed to authenticate session.");
            const { token } = await tokenRes.json();

            let companyResearch = '';
            if (researchRes && researchRes.ok) {
                const researchData = await researchRes.json();
                companyResearch = researchData.research || '';
            }

            // 2. Setup Playback Web Audio API (Output -> Avatar Analyser)
            const playCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            playbackAudioCtxRef.current = playCtx;
            const analyser = playCtx.createAnalyser();
            analyser.fftSize = 256;
            analyser.connect(playCtx.destination);
            analyserRef.current = analyser;

            // 3. Setup Recording Web Audio API (Input -> User Mic)
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    sampleRate: 16000,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true
                },
                video: true
            });
            streamRef.current = stream;

            const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            inputAudioCtxRef.current = inputCtx;
            const micSource = inputCtx.createMediaStreamSource(stream);
            const processor = inputCtx.createScriptProcessor(4096, 1, 1);

            processor.onaudioprocess = (e) => {
                if (!isMicOnRef.current || !sessionRef.current) return;

                const inputData = e.inputBuffer.getChannelData(0);
                const inputSampleRate = inputCtx.sampleRate;
                const targetSampleRate = 16000;

                // Downsample if necessary
                let downsampledData = inputData;
                if (inputSampleRate !== targetSampleRate) {
                    const ratio = inputSampleRate / targetSampleRate;
                    const newLength = Math.round(inputData.length / ratio);
                    downsampledData = new Float32Array(newLength);
                    for (let i = 0; i < newLength; i++) {
                        downsampledData[i] = inputData[Math.floor(i * ratio)];
                    }
                }

                // Convert Float32 to Int16
                const pcm16 = new Int16Array(downsampledData.length);
                for (let i = 0; i < downsampledData.length; i++) {
                    pcm16[i] = Math.max(-1, Math.min(1, downsampledData[i])) * 0x7FFF;
                }

                // Convert to Base64
                const bytes = new Uint8Array(pcm16.buffer);
                const chunkSize = 8192;
                let binary = '';
                for (let i = 0; i < bytes.byteLength; i += chunkSize) {
                    const chunk = bytes.subarray(i, i + chunkSize);
                    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
                }
                const base64 = btoa(binary);

                sessionRef.current.sendRealtimeInput({
                    audio: { data: base64, mimeType: "audio/pcm;rate=16000" }
                });
            };

            micSource.connect(processor);

            // Prevent mic from playing back through speakers
            const gainNode = inputCtx.createGain();
            gainNode.gain.value = 0;
            processor.connect(gainNode);
            gainNode.connect(inputCtx.destination);

            // 4. Initialize Gemini Live API
            const ai = new GoogleGenAI({ apiKey: token });

            const companyContext = interview.company_name
                ? `You are a senior employee and interviewer at ${interview.company_name}. You have deep knowledge of the company's culture, engineering practices, and interview standards. You represent ${interview.company_name} and should behave as an insider who knows exactly what the company looks for in candidates.`
                : `You are a senior professional interviewer. No specific company was provided, so conduct a general industry-standard interview.`;

            let textInstruction = `${companyContext}

IMPORTANT RULES:
- You are a single person speaking with one voice only. Never roleplay as multiple people or switch between different voices or personas.
- The candidate's name is ${userName}.
- You are interviewing them for the role of ${interview.job_role}.
- The difficulty level is ${interview.difficulty}.
- Ask exactly ${interview.num_questions} questions total. Ask them ONE BY ONE. Wait for the candidate to answer before moving to the next question.
- Provide brief acknowledgment of their answer before asking the next question.
- When all ${interview.num_questions} questions have been asked and answered, conclude the interview professionally.
- Internally judge each answer on a scale of 0 to 1 (0 = completely wrong, 0.5 = partial, 1.0 = excellent). Do NOT share the scores during the interview.
- Mix your questions across: company-specific questions, role-specific technical questions, JD-relevant questions, behavioral questions, and your own AI-generated questions relevant to the role.
`;
            if (interview.interview_round) textInstruction += `\nThis is a ${interview.interview_round} round interview. Tailor your question style accordingly.`;
            if (interview.language) textInstruction += `\nConduct the entire interview strictly in the language code: ${interview.language}.`;
            if (interview.jd_text) textInstruction += `\n\nJob Description to base questions on:\n${interview.jd_text}`;
            if (companyResearch) textInstruction += `\n\nHere is research about the company and typical interview patterns. Use this to inform your questions:\n${companyResearch}`;

            const session = await ai.live.connect({
                model: "gemini-2.5-flash-native-audio-preview-12-2025",
                config: {
                    responseModalities: ["AUDIO"] as any,
                    systemInstruction: textInstruction,
                    speechConfig: {
                        voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } }
                    },
                },
                callbacks: {
                    onmessage: (message: any) => {
                        // AI is generating audio
                        if (message.serverContent && message.serverContent.modelTurn) {
                            isAISpeakingRef.current = true;
                            setIsTalking(true);
                            const parts = message.serverContent.modelTurn.parts;
                            for (const part of parts) {
                                if (part.inlineData) {
                                    const base64 = part.inlineData.data;
                                    const binaryData = atob(base64);
                                    const bytes = new Uint8Array(binaryData.length);
                                    for (let i = 0; i < binaryData.length; i++) {
                                        bytes[i] = binaryData.charCodeAt(i);
                                    }
                                    // Decode 16-bit PCM at 24kHz
                                    const float32Data = new Float32Array(bytes.length / 2);
                                    const dataView = new DataView(bytes.buffer);
                                    for (let i = 0; i < bytes.length / 2; i++) {
                                        float32Data[i] = dataView.getInt16(i * 2, true) / 32768.0;
                                    }

                                    // Push to queue instead of creating individual sources
                                    audioQueueRef.current.push(float32Data);

                                    // Start playback if not already playing
                                    if (!isPlayingRef.current) {
                                        playNextChunk();
                                    }
                                }
                                if (part.text) {
                                    addMessage({ id: Date.now().toString(), role: 'ai', text: part.text });
                                    currentAITurnTextRef.current += part.text;
                                }
                            }
                        }

                        // User interrupted the AI — stop playback immediately
                        if (message.serverContent && message.serverContent.interrupted) {
                            audioQueueRef.current = [];
                            if (currentSourceRef.current) {
                                try { currentSourceRef.current.stop(); } catch (_) { /* already stopped */ }
                                currentSourceRef.current = null;
                            }
                            isPlayingRef.current = false;
                            isAISpeakingRef.current = false;
                            setIsTalking(false);
                        }

                        // AI finished generating (no interruption)
                        if (message.serverContent && message.serverContent.generationComplete) {
                            // Save completed AI turn to transcript
                            if (currentAITurnTextRef.current.trim()) {
                                transcriptRef.current.push({ role: 'ai', text: currentAITurnTextRef.current.trim() });
                                currentAITurnTextRef.current = '';
                            }

                            const checkPlaybackDone = () => {
                                if (audioQueueRef.current.length === 0 && !isPlayingRef.current) {
                                    isAISpeakingRef.current = false;
                                    setIsTalking(false);
                                } else {
                                    setTimeout(checkPlaybackDone, 200);
                                }
                            };
                            checkPlaybackDone();
                        }

                        // Capture user speech input text (if Gemini transcribes it)
                        if (message.serverContent && message.serverContent.inputTranscript) {
                            transcriptRef.current.push({ role: 'user', text: message.serverContent.inputTranscript });
                        }
                    },
                    onclose: (e: any) => {
                        console.log("Live session disconnected", e);
                        setErrorStatus(`Disconnected: ${e?.reason || "Unknown reason"}`);
                        cleanup();
                    },
                    onerror: (e: any) => {
                        console.error("Live session error event:", e);
                        setErrorStatus(`Socket Error: ${e.message || "Unknown error"}`);
                    }
                }
            });

            sessionRef.current = session;
            setIsConnected(true);
            setIsInitializing(false);

        } catch (err: any) {
            console.error(err);
            setErrorStatus(err.message || "Failed to start interview");
            setIsInitializing(false);
        }
    };

    const handleEndInterview = async () => {
        cleanup();
        setIsEvaluating(true);

        try {
            const res = await fetch('/api/evaluate-interview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    interviewId: interview.id,
                    transcript: transcriptRef.current,
                    jobRole: interview.job_role,
                    numQuestions: interview.num_questions,
                }),
            });

            if (res.ok) {
                router.push(`/dashboard/results/${interview.id}`);
            } else {
                console.error('Evaluation failed');
                router.push('/dashboard/profile');
            }
        } catch (err) {
            console.error('Evaluation error:', err);
            router.push('/dashboard/profile');
        }
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-zinc-950">
            {/* Header */}
            <header className="px-6 py-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
                <div>
                    <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                        {interview.company_name ? `${interview.company_name} ` : ''}{interview.job_role} Interview
                    </h1>
                    <p className="text-xs text-zinc-400">Difficulty: {interview.difficulty} | Round: {interview.interview_round}</p>
                </div>

                {isConnected ? (
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 px-3 py-1 bg-green-900/30 rounded-full border border-green-800">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                            <span className="text-xs text-green-400 font-medium">Live Server</span>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 px-3 py-1 bg-zinc-900/80 rounded-full border border-zinc-800">
                            <div className="w-2 h-2 rounded-full bg-zinc-500"></div>
                            <span className="text-xs text-zinc-400 font-medium">Disconnected</span>
                        </div>
                    </div>
                )}
            </header>

            {/* Main Content */}
            <main className="flex-1 flex flex-col items-center justify-center relative overflow-hidden p-4">

                {isEvaluating ? (
                    <div className="flex flex-col items-center justify-center space-y-6 max-w-sm text-center">
                        <div className="w-20 h-20 rounded-full bg-indigo-900/20 flex items-center justify-center border border-indigo-800/50">
                            <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-semibold mb-2 text-white">Evaluating Your Interview...</h2>
                            <p className="text-zinc-400">AI is analyzing your answers and generating detailed feedback. This may take a moment.</p>
                        </div>
                    </div>
                ) : isInitializing ? (
                    <div className="flex flex-col items-center justify-center space-y-6 max-w-sm text-center">
                        <div className="w-20 h-20 rounded-full bg-blue-900/20 flex items-center justify-center border border-blue-800/50">
                            <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-semibold mb-2 text-white">Preparing Interview...</h2>
                            <p className="text-zinc-400">Researching company & connecting to Gemini Live API.</p>
                        </div>
                    </div>
                ) : errorStatus ? (
                    <div className="flex flex-col items-center justify-center space-y-6 max-w-sm text-center">
                        <div className="w-20 h-20 rounded-full bg-red-900/20 flex items-center justify-center border border-red-800/50">
                            <span className="text-3xl">⚠️</span>
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold mb-2 text-white">Connection Error</h2>
                            <p className="text-red-400 text-sm">{errorStatus}</p>
                        </div>
                        <Button onClick={startInterview} variant="outline" className="border-zinc-700 hover:bg-zinc-800">
                            Retry Connection
                        </Button>
                    </div>
                ) : null}

                {!isInitializing && !errorStatus && !isConnected ? (
                    <div className="flex flex-col items-center gap-6">
                        <div className="text-center space-y-2">
                            <h2 className="text-2xl font-bold">Ready when you are</h2>
                            <p className="text-zinc-400 max-w-md">The interviewer will begin speaking as soon as you connect. Make sure your microphone is working.</p>
                        </div>
                        <Button onClick={startInterview} size="lg" className="bg-blue-600 hover:bg-blue-700 h-14 px-8 text-lg rounded-full shadow-lg shadow-blue-900/20">
                            Connect to Interviewer ⚡
                        </Button>
                    </div>
                ) : null}

                {isConnected && (
                    <div className="w-full h-full flex items-center justify-center relative">
                        {/* The Avatar stretched 16:9 */}
                        <div className="z-0 animate-in fade-in zoom-in duration-700 w-full h-full">
                            <Avatar isTalking={isTalking} />
                        </div>

                        {/* Webcam Floating Bottom Right */}
                        <div className="absolute bottom-6 right-6 z-20 animate-in slide-in-from-bottom flex shadow-2xl">
                            <Webcam stream={streamRef.current} />
                        </div>
                    </div>
                )}

            </main>

            {/* Controls Footer */}
            <footer className="h-24 border-t border-zinc-800 bg-zinc-900 px-6 flex items-center justify-center gap-6 relative z-50">
                <Button
                    onClick={toggleMic}
                    variant={isMicOn ? "default" : "destructive"}
                    size="icon"
                    className={`w-14 h-14 rounded-full ${isMicOn ? 'bg-zinc-800 hover:bg-zinc-700 text-white' : ''}`}
                    disabled={!isConnected}
                >
                    {isMicOn ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
                </Button>

                <Button
                    onClick={handleEndInterview}
                    variant="destructive"
                    size="icon"
                    className="w-16 h-16 rounded-2xl shadow-lg shadow-red-900/20 hover:scale-105 transition-transform"
                >
                    <PhoneOff className="w-7 h-7" />
                </Button>

                <Button
                    onClick={toggleWebcam}
                    variant={isWebcamOn ? "default" : "secondary"}
                    size="icon"
                    className={`w-14 h-14 rounded-full ${isWebcamOn ? 'bg-zinc-800 hover:bg-zinc-700 text-white' : 'bg-zinc-700 text-zinc-400 hover:bg-zinc-600'}`}
                >
                    {isWebcamOn ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
                </Button>
            </footer>
        </div>
    )
}
