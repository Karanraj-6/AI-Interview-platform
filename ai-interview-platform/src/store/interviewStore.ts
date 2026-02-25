import { create } from 'zustand'

export interface InterviewMessage {
    id: string
    role: 'user' | 'ai'
    text: string
}

interface InterviewState {
    isConnected: boolean
    isMicOn: boolean
    isWebcamOn: boolean
    messages: InterviewMessage[]
    setIsConnected: (connected: boolean) => void
    toggleMic: () => void
    toggleWebcam: () => void
    addMessage: (message: InterviewMessage) => void
    clearMessages: () => void
}

export const useInterviewStore = create<InterviewState>((set) => ({
    isConnected: false,
    isMicOn: false,
    isWebcamOn: true,
    messages: [],
    setIsConnected: (connected) => set({ isConnected: connected }),
    toggleMic: () => set((state) => ({ isMicOn: !state.isMicOn })),
    toggleWebcam: () => set((state) => ({ isWebcamOn: !state.isWebcamOn })),
    addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
    clearMessages: () => set({ messages: [] }),
}))
