'use client'

import { useState } from 'react'
import { createInterview } from '@/app/dashboard/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export default function DashboardPage() {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        const formData = new FormData(e.currentTarget)
        try {
            const res = await createInterview(formData)
            if (res?.error) {
                setError(res.error)
            }
        } catch (err) {
            // Redirect throws an error, so we catch it
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="container mx-auto p-4 md:p-8 max-w-4xl">
            <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader>
                    <CardTitle className="text-2xl text-white">Start a Mock Interview</CardTitle>
                    <CardDescription className="text-zinc-400">
                        Configure your AI interview settings below. The AI will tailor the questions specifically to the company and role.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="jobRole" className="text-zinc-200">Job Role *</Label>
                                <Input
                                    id="jobRole"
                                    name="jobRole"
                                    placeholder="e.g. Frontend React Developer"
                                    required
                                    className="bg-zinc-950 border-zinc-800 text-white"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="companyName" className="text-zinc-200">Company Name (Optional)</Label>
                                <Input
                                    id="companyName"
                                    name="companyName"
                                    placeholder="e.g. Google, Amazon, Meta"
                                    className="bg-zinc-950 border-zinc-800 text-white"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="interviewRound" className="text-zinc-200">Interview Round</Label>
                                <Select name="interviewRound" defaultValue="Technical">
                                    <SelectTrigger className="bg-zinc-950 border-zinc-800 text-white">
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
                                    <SelectTrigger className="bg-zinc-950 border-zinc-800 text-white">
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
                                    <SelectTrigger className="bg-zinc-950 border-zinc-800 text-white">
                                        <SelectValue placeholder="Select amount" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                                        <SelectItem value="10">10 Questions (Quick)</SelectItem>
                                        <SelectItem value="20">20 Questions (Standard)</SelectItem>
                                        <SelectItem value="30">30 Questions (Comprehensive)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="difficulty" className="text-zinc-200">Difficulty Level</Label>
                                <Select name="difficulty" defaultValue="Medium">
                                    <SelectTrigger className="bg-zinc-950 border-zinc-800 text-white">
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
                                className="bg-zinc-950 border-zinc-800 text-white min-h-[120px]"
                            />
                        </div>

                        {error && <p className="text-sm text-red-500">{error}</p>}

                        <Button
                            type="submit"
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium text-lg h-12"
                            disabled={loading}
                        >
                            {loading ? "Preparing Interview..." : "Start Interview 🚀"}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
