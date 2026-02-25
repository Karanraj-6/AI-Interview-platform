import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default async function ResultsPage({ params }: { params: { id: string } }) {
    const resolvedParams = await Promise.resolve(params)
    const interviewId = resolvedParams.id

    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) redirect('/login')

    // Fetch interview
    const { data: interview, error: intError } = await supabase
        .from('interviews')
        .select('*')
        .eq('id', interviewId)
        .single()

    if (intError || !interview || interview.user_id !== user.id) {
        redirect('/dashboard')
    }

    // Fetch per-question responses
    const { data: responses } = await supabase
        .from('responses')
        .select('*')
        .eq('interview_id', interviewId)
        .order('created_at', { ascending: true })

    const totalQuestions = responses?.length || 0
    const totalScore = interview.final_score ?? 0

    return (
        <div className="container mx-auto p-4 md:p-8 max-w-4xl space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white">Interview Results</h1>
                    <p className="text-zinc-400 mt-1">
                        {interview.company_name ? `${interview.company_name} — ` : ''}{interview.job_role} ({interview.difficulty})
                    </p>
                    <p className="text-xs text-zinc-500 mt-1">
                        {new Date(interview.created_at).toLocaleDateString('en-US', { dateStyle: 'long' })}
                    </p>
                </div>
                <Link href="/dashboard">
                    <Button variant="outline" className="border-zinc-700 hover:bg-zinc-800 text-zinc-300">
                        ← Back to Dashboard
                    </Button>
                </Link>
            </div>

            {/* Score Overview */}
            <Card className="bg-gradient-to-br from-zinc-900 to-zinc-800 border-zinc-700">
                <CardContent className="pt-8 pb-8">
                    <div className="flex flex-col items-center justify-center text-center space-y-3">
                        <p className="text-sm font-medium text-zinc-400 uppercase tracking-wider">Overall Score</p>
                        <div className="text-6xl font-bold">
                            <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                                {totalScore}
                            </span>
                            <span className="text-2xl text-zinc-500 ml-1">/ {totalQuestions}</span>
                        </div>
                        <Badge
                            variant="outline"
                            className={
                                totalScore / Math.max(totalQuestions, 1) >= 0.7 ? 'text-green-400 border-green-800 bg-green-900/20' :
                                    totalScore / Math.max(totalQuestions, 1) >= 0.4 ? 'text-yellow-400 border-yellow-800 bg-yellow-900/20' :
                                        'text-red-400 border-red-800 bg-red-900/20'
                            }
                        >
                            {totalScore / Math.max(totalQuestions, 1) >= 0.7 ? 'Strong Performance' :
                                totalScore / Math.max(totalQuestions, 1) >= 0.4 ? 'Needs Improvement' :
                                    'Significant Gaps'}
                        </Badge>
                    </div>
                </CardContent>
            </Card>

            {/* Summary Feedback */}
            {interview.summary_feedback && (
                <Card className="bg-zinc-900 border-zinc-800">
                    <CardHeader>
                        <CardTitle className="text-xl text-white flex items-center gap-2">
                            💡 AI Feedback & Improvement Suggestions
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-zinc-300 leading-relaxed whitespace-pre-wrap text-sm">
                            {interview.summary_feedback}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Per-Question Breakdown */}
            {responses && responses.length > 0 && (
                <Card className="bg-zinc-900 border-zinc-800">
                    <CardHeader>
                        <CardTitle className="text-xl text-white">Question-by-Question Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {responses.map((resp: any, idx: number) => {
                            const score = resp.rating ?? 0
                            const scoreColor = score >= 0.7 ? 'text-green-400 border-green-800 bg-green-900/30' :
                                score >= 0.4 ? 'text-yellow-400 border-yellow-800 bg-yellow-900/30' :
                                    'text-red-400 border-red-800 bg-red-900/30'

                            return (
                                <div key={resp.id} className="p-4 rounded-lg bg-zinc-950 border border-zinc-800">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1">
                                            <p className="text-sm text-zinc-400 mb-1">Question {idx + 1}</p>
                                            <p className="text-white font-medium">{resp.question_text}</p>
                                        </div>
                                        <Badge variant="outline" className={`${scoreColor} shrink-0 text-base px-3 py-1`}>
                                            {score.toFixed(1)}
                                        </Badge>
                                    </div>
                                    {resp.ai_feedback && (
                                        <p className="mt-3 text-sm text-zinc-400 border-t border-zinc-800 pt-3">
                                            {resp.ai_feedback}
                                        </p>
                                    )}
                                </div>
                            )
                        })}
                    </CardContent>
                </Card>
            )}

            {/* No results yet */}
            {(!responses || responses.length === 0) && !interview.summary_feedback && (
                <Card className="bg-zinc-900 border-zinc-800">
                    <CardContent className="py-12 text-center">
                        <p className="text-zinc-500 text-lg">No evaluation data found for this interview.</p>
                        <p className="text-zinc-600 text-sm mt-2">This interview may not have been completed or evaluated.</p>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
