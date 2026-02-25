import { createClient } from '@/utils/supabase/server'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default async function ProfilePage() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    // Fetch complete interview history
    const { data: interviews, error } = await supabase
        .from('interviews')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

    const totalInterviews = interviews?.length || 0
    const completedInterviews = interviews?.filter(i => i.final_score !== null) || []
    const avgScore = completedInterviews.length > 0
        ? (completedInterviews.reduce((acc, curr) => acc + (curr.final_score || 0), 0) / completedInterviews.length).toFixed(1)
        : '0'
    const bestInterview = completedInterviews.length > 0
        ? completedInterviews.reduce((best, curr) => (curr.final_score || 0) > (best.final_score || 0) ? curr : best)
        : null

    // Get latest completed interview with feedback
    const latestWithFeedback = completedInterviews.find(i => i.summary_feedback)

    const userMeta = user.user_metadata

    return (
        <div className="container mx-auto p-4 md:p-8 space-y-8">
            {/* Profile Header */}
            <div className="flex flex-col md:flex-row items-center md:items-start gap-6 bg-zinc-900 border border-zinc-800 p-6 rounded-xl">
                <Avatar className="w-24 h-24 border-2 border-zinc-700">
                    <AvatarImage src={userMeta?.avatar_url || ''} />
                    <AvatarFallback className="bg-zinc-800 text-2xl">{userMeta?.full_name?.charAt(0) || user?.email?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="text-center md:text-left">
                    <h1 className="text-3xl font-bold text-white">{userMeta?.full_name || 'User Profile'}</h1>
                    <p className="text-zinc-400">{user.email}</p>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-zinc-900 border-zinc-800">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-zinc-400">Total Interviews</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-bold text-white">{totalInterviews}</div>
                    </CardContent>
                </Card>
                <Card className="bg-zinc-900 border-zinc-800">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-zinc-400">Average Score</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-bold text-blue-400">{avgScore}</div>
                        <p className="text-xs text-zinc-500 mt-1">avg score per interview</p>
                    </CardContent>
                </Card>
                <Card className="bg-zinc-900 border-zinc-800">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-zinc-400">Best Score</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-bold text-green-400">
                            {bestInterview ? `${bestInterview.final_score}/${bestInterview.num_questions}` : '—'}
                        </div>
                        <p className="text-xs text-zinc-500 mt-1">{bestInterview?.job_role || ''}</p>
                    </CardContent>
                </Card>
            </div>

            {/* Latest Feedback */}
            {latestWithFeedback && (
                <Card className="bg-zinc-900 border-zinc-800">
                    <CardHeader>
                        <CardTitle className="text-xl text-white flex items-center gap-2">
                            💡 Latest Interview Feedback
                        </CardTitle>
                        <p className="text-xs text-zinc-500">
                            {latestWithFeedback.company_name ? `${latestWithFeedback.company_name} — ` : ''}
                            {latestWithFeedback.job_role} • {new Date(latestWithFeedback.created_at).toLocaleDateString()}
                        </p>
                    </CardHeader>
                    <CardContent>
                        <div className="text-zinc-300 leading-relaxed whitespace-pre-wrap text-sm">
                            {latestWithFeedback.summary_feedback}
                        </div>
                        <div className="mt-4">
                            <Link href={`/dashboard/results/${latestWithFeedback.id}`}>
                                <Button variant="outline" size="sm" className="text-blue-400 border-blue-900 hover:bg-blue-900/20">
                                    View Full Results →
                                </Button>
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Interview History */}
            <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader>
                    <CardTitle className="text-xl text-white">Interview History</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border border-zinc-800">
                        <Table>
                            <TableHeader className="bg-zinc-950">
                                <TableRow className="border-zinc-800 hover:bg-zinc-950">
                                    <TableHead className="text-zinc-400">Date</TableHead>
                                    <TableHead className="text-zinc-400">Role</TableHead>
                                    <TableHead className="text-zinc-400">Difficulty</TableHead>
                                    <TableHead className="text-zinc-400">Score</TableHead>
                                    <TableHead className="text-right text-zinc-400">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {interviews?.length === 0 && (
                                    <TableRow className="border-zinc-800 hover:bg-zinc-900">
                                        <TableCell colSpan={5} className="text-center text-zinc-500 py-6">
                                            No interviews taken yet.
                                        </TableCell>
                                    </TableRow>
                                )}
                                {interviews?.map((interview) => (
                                    <TableRow key={interview.id} className="border-zinc-800 hover:bg-zinc-800/50">
                                        <TableCell className="text-zinc-300">
                                            {new Date(interview.created_at).toLocaleDateString()}
                                        </TableCell>
                                        <TableCell className="font-medium text-white">{interview.job_role}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={
                                                interview.difficulty === 'Easy' ? 'text-green-400 border-green-900' :
                                                    interview.difficulty === 'Medium' ? 'text-yellow-400 border-yellow-900' :
                                                        'text-red-400 border-red-900'
                                            }>
                                                {interview.difficulty}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            {interview.final_score !== null ? (
                                                <span className="font-bold text-white">{interview.final_score}/{interview.num_questions}</span>
                                            ) : (
                                                <span className="text-zinc-500 italic">Incomplete</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Link href={`/dashboard/results/${interview.id}`}>
                                                <Button variant="ghost" size="sm" className="text-blue-400 hover:text-blue-300 hover:bg-blue-900/20">
                                                    View Feedback
                                                </Button>
                                            </Link>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
