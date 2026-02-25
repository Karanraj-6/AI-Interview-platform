import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { GoogleGenAI } from '@google/genai'

interface TranscriptEntry {
    role: 'ai' | 'user'
    text: string
}

export async function POST(req: NextRequest) {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { interviewId, transcript, jobRole, numQuestions } = await req.json()

    if (!interviewId || !transcript || !Array.isArray(transcript)) {
        return NextResponse.json({ error: 'Missing interviewId or transcript' }, { status: 400 })
    }

    const apiKey = process.env.GOOGLE_GEMINI_API_KEY
    if (!apiKey) {
        return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
    }

    const ai = new GoogleGenAI({ apiKey })

    // Format transcript for evaluation
    const formattedTranscript = (transcript as TranscriptEntry[])
        .map(entry => `${entry.role === 'ai' ? 'Interviewer' : 'Candidate'}: ${entry.text}`)
        .join('\n\n')

    const evaluationPrompt = `You are an expert interview evaluator. Analyze the following interview transcript and provide a detailed evaluation.

**Interview Context:**
- Role: ${jobRole || 'Not specified'}
- Total expected questions: ${numQuestions || 'Unknown'}

**Transcript:**
${formattedTranscript}

**Your Task:**
Analyze each question-answer pair from the transcript. For each question the interviewer asked and the candidate answered, provide:
1. The question text
2. A score from 0.0 to 1.0 (0 = completely wrong/no answer, 0.5 = partial, 1.0 = excellent answer)
3. Brief feedback on the answer

Then provide an overall summary with specific improvement suggestions.

**IMPORTANT: Respond ONLY with valid JSON in this exact format, no markdown code blocks:**
{
    "questions": [
        {
            "question": "The exact question asked",
            "score": 0.75,
            "feedback": "Brief feedback on the answer quality"
        }
    ],
    "totalScore": 7.5,
    "totalQuestions": 10,
    "summaryFeedback": "A detailed 3-5 paragraph summary covering: 1) Overall performance assessment, 2) Key strengths demonstrated, 3) Specific weaknesses and areas needing improvement with concrete suggestions on what to study/practice, 4) Actionable next steps for the candidate"
}`

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: evaluationPrompt,
        })

        let resultText = response.text || ''

        // Clean up potential markdown code blocks
        resultText = resultText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()

        const evaluation = JSON.parse(resultText)

        // Save per-question responses to DB
        if (evaluation.questions && Array.isArray(evaluation.questions)) {
            const responses = evaluation.questions.map((q: any) => ({
                interview_id: interviewId,
                question_text: q.question,
                user_answer: '',  // We don't have the exact user audio text
                ai_feedback: q.feedback,
                rating: q.score,
            }))

            const { error: respError } = await supabase
                .from('responses')
                .insert(responses)

            if (respError) {
                console.error('Error saving responses:', respError)
            }
        }

        // Update interview with final score and summary
        const { error: updateError } = await supabase
            .from('interviews')
            .update({
                final_score: evaluation.totalScore,
                summary_feedback: evaluation.summaryFeedback,
            })
            .eq('id', interviewId)

        if (updateError) {
            console.error('Error updating interview:', updateError)
        }

        return NextResponse.json({
            success: true,
            totalScore: evaluation.totalScore,
            totalQuestions: evaluation.totalQuestions,
            summaryFeedback: evaluation.summaryFeedback,
            questions: evaluation.questions,
        })
    } catch (err: any) {
        console.error('Evaluation error:', err)
        return NextResponse.json({ error: 'Failed to evaluate interview', details: err.message }, { status: 500 })
    }
}
