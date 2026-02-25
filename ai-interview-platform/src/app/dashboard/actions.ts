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
