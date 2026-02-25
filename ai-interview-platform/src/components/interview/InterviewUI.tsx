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
    const [evaluationError, setEvaluationError] = useState<string | null>(null);

    // Refs to prevent state closure issues inside callbacks
    const isMicOnRef = useRef(isMicOn);
    useEffect(() => { isMicOnRef.current = isMicOn; }, [isMicOn]);

    const sessionRef = useRef<any>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const inputAudioCtxRef = useRef<AudioContext | null>(null);
    const playbackAudioCtxRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const isAISpeakingRef = useRef(false);
    const avatarActivatedRef = useRef(false); // true once the initial lip-sync delay has passed

    const audioQueueRef = useRef<Float32Array[]>([]);
    const isPlayingRef = useRef(false);
    const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);

    const [isTalking, setIsTalking] = useState(false);
    const isTalkingRef = useRef(false);

    const transcriptRef = useRef<{ role: 'ai' | 'user'; text: string }[]>([]);
    const currentAITurnTextRef = useRef('');
    const currentUserTurnTextRef = useRef('');
    const interviewStartTimeRef = useRef<number>(0);
    const recognitionRef = useRef<any>(null);

    // Small accumulation buffer — 1600 samples = 100ms at 16kHz (optimal WebSocket batch size)
    const accumulatorRef = useRef<Float32Array[]>([]);
    const accumulatedLengthRef = useRef(0);
    const SEND_CHUNK_SIZE = 1600;

    const playNextChunk = useCallback(() => {
        const audioCtx = playbackAudioCtxRef.current;
        const analyser = analyserRef.current;
        if (!audioCtx || audioCtx.state === 'closed') {
            isPlayingRef.current = false;
            return;
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        if (audioQueueRef.current.length === 0) {
            isPlayingRef.current = false;
            // Don't reset isTalking here — let checkPlaybackDone handle it
            // (prevents avatar flickering when queue temporarily empties between chunks)
            return;
        }

        isPlayingRef.current = true;
        const chunk = audioQueueRef.current.shift()!;

        const buffer = audioCtx.createBuffer(1, chunk.length, 24000);
        buffer.getChannelData(0).set(chunk);

        const source = audioCtx.createBufferSource();
        source.buffer = buffer;
        if (analyser) source.connect(analyser);
        currentSourceRef.current = source;

        source.onended = () => {
            currentSourceRef.current = null;
            if (audioQueueRef.current.length > 0) {
                playNextChunk();
            } else {
                isPlayingRef.current = false;
                // Don't reset isTalking — checkPlaybackDone will handle it
            }
        };

        source.start(0);
    }, []);

    const stopPlayback = useCallback(() => {
        audioQueueRef.current = [];
        if (currentSourceRef.current) {
            try { currentSourceRef.current.stop(); } catch (_) { }
            currentSourceRef.current = null;
        }
        isPlayingRef.current = false;
        isTalkingRef.current = false;
        isAISpeakingRef.current = false;
        setIsTalking(false);
    }, []);

    const cleanup = useCallback(() => {
        if (sessionRef.current) {
            try { sessionRef.current.close(); } catch (e) { }
            sessionRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (inputAudioCtxRef.current && inputAudioCtxRef.current.state !== 'closed') {
            inputAudioCtxRef.current.close();
            inputAudioCtxRef.current = null;
        }
        if (playbackAudioCtxRef.current && playbackAudioCtxRef.current.state !== 'closed') {
            playbackAudioCtxRef.current.close();
            playbackAudioCtxRef.current = null;
        }
        audioQueueRef.current = [];
        accumulatorRef.current = [];
        accumulatedLengthRef.current = 0;
        isPlayingRef.current = false;
        setIsConnected(false);
    }, []);

    useEffect(() => {
        return cleanup;
    }, [cleanup]);

    const sendAudioFrame = useCallback((session: any, sampleRate: number) => {
        if (accumulatedLengthRef.current === 0) return;

        // Merge accumulated frames
        const merged = new Float32Array(accumulatedLengthRef.current);
        let offset = 0;
        for (const frame of accumulatorRef.current) {
            merged.set(frame, offset);
            offset += frame.length;
        }
        accumulatorRef.current = [];
        accumulatedLengthRef.current = 0;

        // Resample to 16kHz if browser gave us a different rate
        const targetRate = 16000;
        let finalData = merged;
        if (Math.abs(sampleRate - targetRate) > 100) {
            const ratio = sampleRate / targetRate;
            const newLength = Math.round(merged.length / ratio);
            finalData = new Float32Array(newLength);
            for (let i = 0; i < newLength; i++) {
                finalData[i] = merged[Math.floor(i * ratio)];
            }
        }

        // Convert Float32 → Int16 PCM
        const pcm16 = new Int16Array(finalData.length);
        for (let i = 0; i < finalData.length; i++) {
            pcm16[i] = Math.max(-1, Math.min(1, finalData[i])) * 0x7FFF;
        }

        // Convert to base64 and send
        const bytes = new Uint8Array(pcm16.buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i += 8192) {
            binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192) as unknown as number[]);
        }

        session.sendRealtimeInput({
            audio: { data: btoa(binary), mimeType: "audio/pcm;rate=16000" },
        });
    }, []);

    const startInterview = async () => {
        if (sessionRef.current) {
            console.warn('Session already active, skipping duplicate connect.');
            return;
        }
        setIsInitializing(true);
        setErrorStatus(null);
        try {
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

            // Playback audio context
            const playCtx = new AudioContext({ sampleRate: 24000 });
            playbackAudioCtxRef.current = playCtx;
            const analyser = playCtx.createAnalyser();
            analyser.fftSize = 256;
            analyser.connect(playCtx.destination);
            analyserRef.current = analyser;

            // Mic stream
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
                video: true,
            });
            streamRef.current = stream;

            // Setup Browser Web Speech API for user transcription fallback
            // (Gemini Live preview doesn't reliably send inputTranscription events yet)
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            if (SpeechRecognition) {
                const recognition = new SpeechRecognition();
                recognition.continuous = true;
                recognition.interimResults = true;
                // Use the language selected in the interview setup
                recognition.lang = interview.language || 'en-IN';

                recognition.onresult = (event: any) => {
                    let interimTranscript = '';
                    let finalTranscript = '';

                    for (let i = event.resultIndex; i < event.results.length; ++i) {
                        if (event.results[i].isFinal) {
                            finalTranscript += event.results[i][0].transcript;
                        } else {
                            interimTranscript += event.results[i][0].transcript;
                        }
                    }

                    if (finalTranscript) {
                        console.log("Browser Speech Fallback:", finalTranscript);
                        currentUserTurnTextRef.current += " " + finalTranscript;
                    }
                };

                recognition.onerror = (e: any) => console.log("Speech recognition error:", e);

                // Keep it running continuously
                recognition.onend = () => {
                    if (sessionRef.current && isMicOnRef.current) {
                        try { recognition.start(); } catch (e) { }
                    }
                };

                recognitionRef.current = recognition;
            }

            // Input audio context
            const inputCtx = new AudioContext({ sampleRate: 16000 });
            inputAudioCtxRef.current = inputCtx;
            const micSource = inputCtx.createMediaStreamSource(stream);

            // AudioWorklet for low-latency mic capture
            await inputCtx.audioWorklet.addModule('/audio-processor.worklet.js');
            const workletNode = new AudioWorkletNode(inputCtx, 'audio-processor');

            workletNode.port.onmessage = (e) => {
                if (!sessionRef.current) return;
                const frame: Float32Array = e.data;
                accumulatorRef.current.push(frame);
                accumulatedLengthRef.current += frame.length;
                // Send when we have ~100ms of audio (1600 samples at 16kHz)
                if (accumulatedLengthRef.current >= SEND_CHUNK_SIZE) {
                    sendAudioFrame(sessionRef.current, inputCtx.sampleRate);
                }
            };

            // Connect mic → worklet only (NOT to destination — prevents echo/speaker feedback)
            micSource.connect(workletNode);

            // Gemini Live API
            const ai = new GoogleGenAI({ apiKey: token });

            const companyContext = interview.company_name
                ? `You are a senior employee and interviewer at ${interview.company_name}. You have deep knowledge of the company's culture, engineering practices, and interview standards. You represent ${interview.company_name} and should behave as an insider who knows exactly what the company looks for in candidates.`
                : `You are a senior professional interviewer. No specific company was provided, so conduct a general industry-standard interview.`;

            let textInstruction = `${companyContext}

IMPORTANT RULES:
- You are a single person speaking with one voice only. Never roleplay as multiple people or switch between different voices or personas.
- Make sure to introduce yourself formally at the very beginning of the interview. Start speaking immediately as soon as the session begins — do not wait for the candidate to speak first. Welcome the candidate.
- After your introduction, ask the candidate to briefly introduce themselves — their name, background, and experience relevant to the role. Wait for their full introduction before proceeding to technical questions.
- The candidate's name is ${userName}.
- You are interviewing them for the role of ${interview.job_role}.
- The difficulty level is ${interview.difficulty}.

QUESTION COUNTING & TRACKING:
- You must ask EXACTLY ${interview.num_questions} main/core questions during this interview.
- Maintain an internal question counter starting at 0. Every time you ask a NEW distinct technical or behavioral question, increment the counter by 1.
- When asking a new core question, always prefix it by saying the question number naturally, e.g. "For my first question...", "Moving on to question two...", "Alright, question three...", etc.
- Follow-up questions, clarifications, "can you elaborate?", "tell me more about that", or supportive/conversational responses do NOT count as new questions. Only increment the counter for genuinely new, distinct topics.
- Once your internal counter reaches ${interview.num_questions}, STOP asking new questions.

CONVERSATION STYLE:
- CRITICAL: DO INTERRUPT YOUR RESPONCE AND LISTEN TO THE CANDIDATE IF HE START SPEAKING IN MIDDLE OF YOUR RESPONCE.
- CRITICAL: DO NOT INTERRUPT THE CANDIDATE. The candidate may pause to think. You must wait patiently until they are completely finished with their entire answer before you respond.
- IMPORTANT: After the candidate answers each core question, DO NOT jump straight to the next question. Instead, engage in a brief back-and-forth discussion:
  1. First, acknowledge their answer with a brief comment (agree, appreciate, or gently point out something interesting).
  2. Then ask 1-2 follow-up questions to dig deeper — e.g. "Can you walk me through how you'd implement that?", "What would happen if...?", "Have you faced a scenario where...?".
  3. Only move on to the next core question after you've explored the current topic sufficiently.
- These follow-up questions do NOT count toward the ${interview.num_questions} question limit.
- Internally judge their overall knowledge on each main topic on a scale of 0 to 1 (0 = completely wrong, 0.5 = partial, 1.0 = excellent). Do NOT share the scores during the interview.
- Mix your questions across: company-specific questions, role-specific technical questions, JD-relevant questions, behavioral questions, and your own AI-generated questions relevant to the role.

CLOSING THE INTERVIEW:
- After you have asked all ${interview.num_questions} core questions and received answers, you MUST ask: "Before we wrap up, do you have any questions for me or anything you'd like to discuss?"
- After the candidate responds to that, conclude professionally by thanking them and saying something like: "That concludes our interview. You may now end the call to see your evaluation scores. It was great speaking with you!"
- Do NOT reveal any scores or detailed feedback during the interview itself.
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
                        voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } },
                    },
                    // Transcription configs for capturing AI speech (input transcription not supported by SDK yet)
                    outputAudioTranscription: {},
                },
                callbacks: {
                    onmessage: (message: any) => {
                        // Debug: log non-audio message types (inputTranscript, generationComplete, etc.)
                        const keys = Object.keys(message.serverContent || {});
                        const noisy = ['modelTurn', 'outputTranscription'];
                        if (keys.length > 0 && keys.some(k => !noisy.includes(k))) {
                            console.log('Gemini event:', keys, message.serverContent);
                        }

                        // AI audio chunks arriving
                        if (message.serverContent?.modelTurn) {
                            // Flush accumulated user speech before AI turn starts
                            if (currentUserTurnTextRef.current.trim()) {
                                transcriptRef.current.push({ role: 'user', text: currentUserTurnTextRef.current.trim() });
                                currentUserTurnTextRef.current = '';
                            }
                            isAISpeakingRef.current = true;

                            // Very first AI turn (intro) — delay so avatar syncs with buffered audio
                            if (!avatarActivatedRef.current) {
                                setTimeout(() => {
                                    if (isAISpeakingRef.current) {
                                        avatarActivatedRef.current = true;
                                        isTalkingRef.current = true;
                                        setIsTalking(true);
                                    }
                                }, 2500);
                            } else {
                                // All subsequent turns — 200ms sync
                                setTimeout(() => {
                                    if (isAISpeakingRef.current) {
                                        isTalkingRef.current = true;
                                        setIsTalking(true);
                                    }
                                }, 200);
                            }

                            const parts = message.serverContent.modelTurn.parts;
                            for (const part of parts) {
                                if (part.inlineData) {
                                    const binaryData = atob(part.inlineData.data);
                                    const bytes = new Uint8Array(binaryData.length);
                                    for (let i = 0; i < binaryData.length; i++) {
                                        bytes[i] = binaryData.charCodeAt(i);
                                    }
                                    const float32Data = new Float32Array(bytes.length / 2);
                                    const dataView = new DataView(bytes.buffer);
                                    for (let i = 0; i < float32Data.length; i++) {
                                        float32Data[i] = dataView.getInt16(i * 2, true) / 32768.0;
                                    }

                                    audioQueueRef.current.push(float32Data);
                                    if (!isPlayingRef.current) {
                                        playNextChunk();
                                    }
                                }
                                // NOTE: part.text from native audio model is THINKING text, not spoken words.
                                // We intentionally skip it for transcript. Only outputTranscript has actual speech.
                            }
                        }

                        // Gemini detected user interrupted AI — stop playback immediately
                        if (message.serverContent?.interrupted) {
                            stopPlayback();
                        }

                        // AI turn fully done — save transcript + wait for playback to finish
                        if (message.serverContent?.generationComplete) {
                            // Save completed AI turn to transcript (from outputTranscript only)
                            if (currentAITurnTextRef.current.trim()) {
                                transcriptRef.current.push({ role: 'ai', text: currentAITurnTextRef.current.trim() });
                                currentAITurnTextRef.current = '';
                            }

                            // Poll until audio playback is fully done, then reset talking state
                            const checkPlaybackDone = () => {
                                if (audioQueueRef.current.length === 0 && !isPlayingRef.current) {
                                    isAISpeakingRef.current = false;
                                    isTalkingRef.current = false;
                                    setIsTalking(false);
                                } else {
                                    setTimeout(checkPlaybackDone, 200);
                                }
                            };
                            checkPlaybackDone();
                        }

                        // Gemini transcribed user speech — accumulate fragments
                        if (message.serverContent?.inputTranscription) {
                            const userText = message.serverContent.inputTranscription.text || message.serverContent.inputTranscription;
                            if (typeof userText === 'string') {
                                currentUserTurnTextRef.current += userText;
                            }
                        }
                        // Gemini transcribed AI speech — this is what was ACTUALLY SPOKEN (not thinking)
                        if (message.serverContent?.outputTranscription) {
                            const aiText = message.serverContent.outputTranscription.text || message.serverContent.outputTranscription;
                            if (typeof aiText === 'string') {
                                currentAITurnTextRef.current += aiText;
                            }
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
                    },
                },
            });

            sessionRef.current = session;
            interviewStartTimeRef.current = Date.now();
            setIsConnected(true);
            setIsInitializing(false);

            // Auto-enable mic
            if (!isMicOnRef.current) {
                toggleMic();
            }

            // Resume playback context (required after user gesture)
            await playCtx.resume();

            // Start browser speech recognition if available
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.start();
                } catch (e) {
                    console.log("Speech recognition start error:", e);
                }
            }

            // Kick off AI introduction immediately
            (session as any).sendClientContent({
                turns: [{ role: "user", parts: [{ text: "Please begin the interview now." }] }],
                turnComplete: true,
            });

        } catch (err: any) {
            console.error(err);
            setErrorStatus(err.message || "Failed to start interview");
            setIsInitializing(false);
        }
    };

    const handleEndInterview = async () => {
        // Flush any remaining AI turn text into transcript before evaluating
        if (currentAITurnTextRef.current.trim()) {
            transcriptRef.current.push({ role: 'ai', text: currentAITurnTextRef.current.trim() });
            currentAITurnTextRef.current = '';
        }
        // Flush any remaining user speech
        if (currentUserTurnTextRef.current.trim()) {
            transcriptRef.current.push({ role: 'user', text: currentUserTurnTextRef.current.trim() });
            currentUserTurnTextRef.current = '';
        }

        cleanup();
        setIsEvaluating(true);

        // Debug: log full transcript content
        console.log('Transcript before evaluation:', JSON.stringify(transcriptRef.current, null, 2));
        console.log('Transcript length:', transcriptRef.current.length);
        console.log('Interview ID:', interview.id);

        try {
            const res = await fetch('/api/evaluate-interview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    interviewId: interview.id,
                    transcript: transcriptRef.current,
                    jobRole: interview.job_role,
                    numQuestions: interview.num_questions,
                    companyName: interview.company_name,
                    jdText: interview.jd_text,
                    durationSeconds: interviewStartTimeRef.current
                        ? Math.round((Date.now() - interviewStartTimeRef.current) / 1000)
                        : 0,
                }),
            });

            if (res.ok) {
                router.push(`/dashboard/results/${interview.id}`);
            } else {
                const errorBody = await res.text();
                console.error('Evaluation failed — status:', res.status, 'body:', errorBody);
                setIsEvaluating(false);
                if (res.status === 429) {
                    setEvaluationError('API rate limit reached. Please wait a moment and try again.');
                } else {
                    setEvaluationError('Evaluation failed. You can retry or view your dashboard.');
                }
            }
        } catch (err) {
            console.error('Evaluation network error:', err);
            setIsEvaluating(false);
            setEvaluationError('Network error during evaluation. Please check your connection and retry.');
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

                {evaluationError ? (
                    <div className="flex flex-col items-center justify-center space-y-6 max-w-sm text-center">
                        <div className="w-20 h-20 rounded-full bg-red-900/20 flex items-center justify-center border border-red-800/50">
                            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-2xl font-semibold mb-2 text-white">Evaluation Error</h2>
                            <p className="text-zinc-400 mb-4">{evaluationError}</p>
                        </div>
                        <div className="flex gap-3">
                            <Button
                                onClick={() => { setEvaluationError(null); setIsEvaluating(true); handleEndInterview(); }}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6"
                            >
                                Retry Evaluation
                            </Button>
                            <Button
                                onClick={() => router.push('/dashboard/profile')}
                                variant="outline"
                                className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 px-6"
                            >
                                Skip to Dashboard
                            </Button>
                        </div>
                    </div>
                ) : isEvaluating ? (
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

                {!isInitializing && !errorStatus && !isConnected && !isEvaluating ? (
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
                        <div className="z-0 animate-in fade-in zoom-in duration-700 w-full h-full">
                            <Avatar isTalking={isTalking} />
                        </div>
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
    );
}