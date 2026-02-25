import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import InterviewUI from '@/components/interview/InterviewUI'

export default async function InterviewPage({ params }: { params: { id: string } }) {
    // Await params directly if Next.js 15+ or 14 dynamic routing requires it
    const resolvedParams = await Promise.resolve(params)
    const interviewId = resolvedParams.id

    const supabase = await createClient()

    // Verify auth
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        redirect('/login')
    }

    // Fetch interview settings
    const { data: interview, error } = await supabase
        .from('interviews')
        .select('*')
        .eq('id', interviewId)
        .single()

    if (error || !interview) {
        // Return a friendly error state or redirect
        return (
            <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
                <h1 className="text-2xl text-white font-bold mb-4">Interview Not Found</h1>
                <p className="text-zinc-400">We could not find the requested interview session. It may have been deleted.</p>
            </div>
        )
    }

    // Double check the user owns this session
    if (interview.user_id !== user.id) {
        redirect('/dashboard')
    }

    return (
        <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
            <InterviewUI interview={interview} userName={user.user_metadata?.full_name || 'Candidate'} />
        </div>
    )
}
