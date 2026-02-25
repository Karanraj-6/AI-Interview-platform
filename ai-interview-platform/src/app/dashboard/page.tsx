'use client'

import { useState, useRef, useEffect } from 'react'
import { createInterview, getDashboardData } from '@/app/dashboard/actions'
import gsap from 'gsap'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { PlusIcon, LineChart, Clock, Award } from 'lucide-react'
import Threads from '@/components/Threads'

export default function DashboardPage() {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [dashboardStats, setDashboardStats] = useState({
        totalInterviews: 0,
        avgScore: 'N/A',
        practiceTimeStr: '0h 0m',
        recentInterviews: [] as any[]
    })
    const [dataFetched, setDataFetched] = useState(false)

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        const formData = new FormData(e.currentTarget)
        try {
            const res = await createInterview(formData)
            if (res?.error) {
                setError(res.error)
            } else {
                setIsDialogOpen(false) // Close dialog on success assuming action redirects
            }
        } catch (err) {
            // Redirect throws an error, so we catch it
        } finally {
            setLoading(false)
        }
    }

    // GSAP Animation Context
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        getDashboardData().then(data => {
            if (data && !data.error) {
                setDashboardStats({
                    totalInterviews: data.totalInterviews || 0,
                    avgScore: data.avgScore || 'N/A',
                    practiceTimeStr: data.practiceTimeStr || '0h 0m',
                    recentInterviews: data.recentInterviews || []
                })
            }
            setDataFetched(true)
        })
    }, [])

    useEffect(() => {
        if (!containerRef.current || !dataFetched) return

        const ctx = gsap.context(() => {
            // Animate Header
            gsap.fromTo(".dash-header",
                { opacity: 0, y: -20 },
                { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" }
            )

            // Animate Stats Cards
            gsap.fromTo(".stat-card",
                { opacity: 0, scale: 0.95, y: 20 },
                { opacity: 1, scale: 1, y: 0, duration: 0.5, stagger: 0.1, ease: "back.out(1.2)", delay: 0.2 }
            )

            // Animate Main Layout Cards
            gsap.fromTo(".layout-card",
                { opacity: 0, y: 30 },
                { opacity: 1, y: 0, duration: 0.6, stagger: 0.15, ease: "power3.out", delay: 0.4 }
            )
        }, containerRef)

        return () => ctx.revert()
    }, [dataFetched])

    return (
        <div className="relative min-h-[calc(100vh-4rem)] w-full overflow-hidden flex flex-col items-center">
            {/* Animated Background */}
            <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
                <div style={{ width: '100%', height: '100%', position: 'relative', top: '-25%' }}>
                    <Threads
                        amplitude={1.5}
                        distance={0.8}
                        enableMouseInteraction
                    />
                </div>
            </div>

            {/* Main Content Dashboard Layout */}
            <div ref={containerRef} className="relative z-10 w-full container mx-auto p-4 md:p-8 max-w-6xl space-y-8 h-full flex-grow">

                {/* Header Section */}
                <div className="dash-header flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2">
                    <div>
                        <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-indigo-300 bg-clip-text text-transparent mb-2">
                            Dashboard
                        </h1>
                        <p className="text-zinc-400 text-sm">Welcome back. Here’s an overview of your interview progress.</p>
                    </div>

                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                            <Button className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold px-6 py-4 h-auto text-base shadow-lg shadow-indigo-900/30 hover:shadow-indigo-700/40 transition-all duration-300 flex items-center gap-2 rounded-full">
                                <PlusIcon className="w-5 h-5" />
                                Create a Mock Interview
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[700px] bg-zinc-950 border-zinc-800 text-zinc-100 p-0 overflow-hidden max-h-[90vh] overflow-y-auto">
                            <div className="p-6 md:p-8">
                                <DialogHeader className="mb-6">
                                    <DialogTitle className="text-2xl text-white">Start a Mock Interview</DialogTitle>
                                    <DialogDescription className="text-zinc-400">
                                        Configure your AI interview settings below. The AI will tailor the questions specifically to the company and role.
                                    </DialogDescription>
                                </DialogHeader>

                                <form onSubmit={handleSubmit} className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <Label htmlFor="jobRole" className="text-zinc-200">Job Role *</Label>
                                            <Input
                                                id="jobRole"
                                                name="jobRole"
                                                placeholder="e.g. Frontend React Developer"
                                                required
                                                className="bg-zinc-900 border-zinc-800 text-white focus-visible:ring-indigo-500"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="companyName" className="text-zinc-200">Company Name (Optional)</Label>
                                            <Input
                                                id="companyName"
                                                name="companyName"
                                                placeholder="e.g. Google, Amazon, Meta"
                                                className="bg-zinc-900 border-zinc-800 text-white focus-visible:ring-indigo-500"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="interviewRound" className="text-zinc-200">Interview Round</Label>
                                            <Select name="interviewRound" defaultValue="Technical">
                                                <SelectTrigger className="bg-zinc-900 border-zinc-800 text-white focus:ring-indigo-500">
                                                    <SelectValue placeholder="Select round" />
                                                </SelectTrigger>
                                                <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                                                    <SelectItem value="Technical">Technical Interview</SelectItem>
                                                    <SelectItem value="HR">HR Interview</SelectItem>
                                                    <SelectItem value="Behavioral">Behavioral / Hiring Manager</SelectItem>
                                                    <SelectItem value="SystemDesign">System Design</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="language" className="text-zinc-200">Interview Language</Label>
                                            <Select name="language" defaultValue="en-US">
                                                <SelectTrigger className="bg-zinc-900 border-zinc-800 text-white focus:ring-indigo-500">
                                                    <SelectValue placeholder="Select language" />
                                                </SelectTrigger>
                                                <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                                                    <SelectItem value="en-US">English (US)</SelectItem>
                                                    <SelectItem value="en-GB">English (UK)</SelectItem>
                                                    <SelectItem value="es-ES">Spanish</SelectItem>
                                                    <SelectItem value="fr-FR">French</SelectItem>
                                                    <SelectItem value="hi-IN">Hindi</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="numQuestions" className="text-zinc-200">Number of Questions</Label>
                                            <Select name="numQuestions" defaultValue="10">
                                                <SelectTrigger className="bg-zinc-900 border-zinc-800 text-white focus:ring-indigo-500">
                                                    <SelectValue placeholder="Select amount" />
                                                </SelectTrigger>
                                                <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                                                    <SelectItem value="5">5 Questions (Quick)</SelectItem>
                                                    <SelectItem value="10">10 Questions (Standard)</SelectItem>
                                                    <SelectItem value="15">15 Questions (Comprehensive)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="difficulty" className="text-zinc-200">Difficulty Level</Label>
                                            <Select name="difficulty" defaultValue="Medium">
                                                <SelectTrigger className="bg-zinc-900 border-zinc-800 text-white focus:ring-indigo-500">
                                                    <SelectValue placeholder="Select difficulty" />
                                                </SelectTrigger>
                                                <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                                                    <SelectItem value="Easy">Easy</SelectItem>
                                                    <SelectItem value="Medium">Medium</SelectItem>
                                                    <SelectItem value="Hard">Hard</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="jdText" className="text-zinc-200">Job Description (Optional)</Label>
                                        <Textarea
                                            id="jdText"
                                            name="jdText"
                                            placeholder="Paste the job description here to help the AI tailor the questions..."
                                            className="bg-zinc-900 border-zinc-800 text-white min-h-[120px] focus-visible:ring-indigo-500"
                                        />
                                    </div>

                                    {error && <p className="text-sm text-red-500">{error}</p>}

                                    <div className="pt-4 flex justify-end gap-3">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => setIsDialogOpen(false)}
                                            className="border-zinc-800 bg-transparent text-zinc-300 hover:bg-zinc-900 hover:text-white"
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            type="submit"
                                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-6"
                                            disabled={loading}
                                        >
                                            {loading ? "Preparing..." : "Start Interview 🚀"}
                                        </Button>
                                    </div>
                                </form>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>

                {/* Stats Overview Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="stat-card bg-zinc-900/60 backdrop-blur-md border-zinc-800 shadow-xl transition-all duration-300 hover:shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:border-indigo-500/30 hover:-translate-y-1">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-zinc-400">Total Interviews</CardTitle>
                            <LineChart className="w-4 h-4 text-indigo-400" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-white">{dataFetched ? dashboardStats.totalInterviews : '...'}</div>
                            <p className="text-xs text-zinc-500 mt-1">Interviews completed</p>
                        </CardContent>
                    </Card>
                    <Card className="stat-card bg-zinc-900/60 backdrop-blur-md border-zinc-800 shadow-xl transition-all duration-300 hover:shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:border-indigo-500/30 hover:-translate-y-1">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-zinc-400">Practice Time</CardTitle>
                            <Clock className="w-4 h-4 text-indigo-400" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-white">{dataFetched ? dashboardStats.practiceTimeStr : '...'}</div>
                            <p className="text-xs text-zinc-500 mt-1">Total time spent</p>
                        </CardContent>
                    </Card>
                    <Card className="stat-card bg-zinc-900/60 backdrop-blur-md border-zinc-800 shadow-xl transition-all duration-300 hover:shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:border-indigo-500/30 hover:-translate-y-1">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-zinc-400">Avg. Score</CardTitle>
                            <Award className="w-4 h-4 text-indigo-400" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-white">{dataFetched ? dashboardStats.avgScore : '...'}</div>
                            <p className="text-xs text-zinc-500 mt-1">Overall performance rating</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Main Content Area */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-6 mb-8">

                    {/* Recent Activity */}
                    <Card className="layout-card bg-zinc-900/60 backdrop-blur-md border-zinc-800 shadow-xl lg:col-span-2 transition-all duration-300 hover:shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:border-indigo-500/30 hover:-translate-y-1">
                        <CardHeader>
                            <CardTitle className="text-xl text-white">Recent Activity</CardTitle>
                            <CardDescription className="text-zinc-400">Your latest mock interview sessions</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {dashboardStats.recentInterviews.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-zinc-800 rounded-lg bg-zinc-950/30">
                                    <Clock className="w-10 h-10 text-zinc-600 mb-3" />
                                    <h3 className="text-lg font-medium text-zinc-300">No recent activity</h3>
                                    <p className="text-sm text-zinc-500 mt-1 mb-4 max-w-sm">
                                        You haven't completed any interviews yet. Start your first mock interview to see your activity here.
                                    </p>
                                    <Button
                                        onClick={() => setIsDialogOpen(true)}
                                        variant="outline"
                                        className="border-indigo-600/50 text-indigo-400 hover:bg-indigo-600/10 hover:text-indigo-300"
                                    >
                                        Start your first interview
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {dashboardStats.recentInterviews.map((interview: any) => (
                                        <div key={interview.id} className="flex items-center justify-between p-4 bg-zinc-950/50 rounded-lg border border-zinc-800">
                                            <div>
                                                <h4 className="font-medium text-white">{interview.job_role}</h4>
                                                <p className="text-xs text-zinc-400 mt-1">
                                                    {new Date(interview.created_at).toLocaleDateString()} • {interview.difficulty}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                {interview.final_score !== null ? (
                                                    <div className="text-lg font-bold text-indigo-400">{interview.final_score}/{interview.num_questions}</div>
                                                ) : (
                                                    <div className="text-sm text-zinc-500 italic mb-1">Incomplete</div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Quick Tips or Recommended */}
                    <Card className="layout-card bg-zinc-900/60 backdrop-blur-md border-zinc-800 shadow-xl transition-all duration-300 hover:shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:border-indigo-500/30 hover:-translate-y-1">
                        <CardHeader>
                            <CardTitle className="text-xl text-white">Pro Tips</CardTitle>
                            <CardDescription className="text-zinc-400">Extract maximum value</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-1">
                                <h4 className="text-sm font-medium text-zinc-200">Paste the JD</h4>
                                <p className="text-xs text-zinc-500">Always paste the real Job Description for the most accurate tailored questions.</p>
                            </div>
                            <div className="space-y-1">
                                <h4 className="text-sm font-medium text-zinc-200">Review Feedback</h4>
                                <p className="text-xs text-zinc-500">Spend time reviewing the AI's feedback after each session to identify weak spots.</p>
                            </div>
                            <div className="space-y-1">
                                <h4 className="text-sm font-medium text-zinc-200">Speak Clearly</h4>
                                <p className="text-xs text-zinc-500">Ensure you have a good microphone connection for accurate voice transcription.</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
