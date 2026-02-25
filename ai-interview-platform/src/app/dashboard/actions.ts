'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export async function createInterview(formData: FormData) {
    const jobRole = formData.get('jobRole') as string
    const difficulty = formData.get('difficulty') as string
    const numQuestions = parseInt(formData.get('numQuestions') as string, 10)
    const jdText = formData.get('jdText') as string | null

    // New Fields
    const companyName = formData.get('companyName') as string | null
    const interviewRound = formData.get('interviewRound') as string
    const language = formData.get('language') as string

    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
        throw new Error('Not authenticated')
    }

    const { data, error } = await supabase
        .from('interviews')
        .insert([
            {
                user_id: user.id,
                job_role: jobRole,
                company_name: companyName || null,
                interview_round: interviewRound,
                language: language,
                difficulty,
                num_questions: numQuestions,
                jd_text: jdText || null,
            }
        ])
        .select('id')
        .single()

    if (error || !data) {
        console.error('Failed to create interview:', error)
        return { error: 'Could not create interview session' }
    }

    // Redirect to the interview UI
    redirect(`/interview/${data.id}`)
}

export async function getDashboardData() {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return { error: 'Not authenticated' }
    }

    const { data: interviews, error } = await supabase
        .from('interviews')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

    if (error) {
        return { error: 'Failed to fetch interviews' }
    }

    const totalInterviews = interviews?.length || 0
    const completedInterviews = interviews?.filter(i => i.final_score !== null) || []

    const avgScore = completedInterviews.length > 0
        ? (completedInterviews.reduce((acc, curr) => acc + (curr.final_score || 0), 0) / completedInterviews.length).toFixed(1)
        : 'N/A'

    // Approximate time spent
    const practiceTimeMins = interviews?.reduce((acc, curr) => acc + ((curr.num_questions || 10) * 2), 0) || 0
    const practiceHours = Math.floor(practiceTimeMins / 60)
    const practiceRemainingMins = practiceTimeMins % 60
    const practiceTimeStr = `${practiceHours}h ${practiceRemainingMins}m`

    const recentInterviews = interviews?.slice(0, 3) || []

    return {
        totalInterviews,
        avgScore,
        practiceTimeStr,
        recentInterviews
    }
}
