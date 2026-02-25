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

    const { interviewId, transcript, jobRole, numQuestions, companyName, jdText } = await req.json()

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

    const evaluationPrompt = `You are a strict, objective technical interview evaluator. You must analyze the transcript below and evaluate the candidate's performance. The interview was conversational, so questions and answers may span multiple back-and-forth exchanges.

**CRITICAL RULES:**
1. **NO HALLUCINATION:** You must ONLY evaluate topics that were ACTUALLY DISCUSSED in the transcript. Do not invent, assume, or pull questions from a template.
2. Group the conversation into "Core Topics" or "Main Questions" that were assessed.
3. If the candidate failed to answer, dodged the question, or said "I don't know" to a topic, score THAT topic as 0.0.
4. **EXACT COUNT:** You must identify and evaluate EXACTLY the first ${numQuestions || 'Unknown'} primary Technical/Core topics the interviewer asked about. If the interviewer asked more than ${numQuestions || 'Unknown'} topics, ignore the extra ones for scoring. If the interviewer asked fewer, only evaluate what was asked. The \`totalQuestions\` field must reflect the true number of core topics you evaluated.

**Interview Context metadata:**
- Role: ${jobRole || 'Not specified'}
- Company: ${companyName || 'Not specified'}
- Expected/Requested Question Count: ${numQuestions || 'Unknown'}
- Job Description Context: ${jdText || 'None provided'}

**Transcript:**
${formattedTranscript}

**Your Task:**
Identify the main topics or questions discussed. For each actual core topic the interviewer tested (up to a maximum of ${numQuestions || 'Unknown'}), provide:
1. "question": A summary of the core question or topic discussed (e.g., "Explain the CSS Box Model").
2. "score": A score from 0.0 to 1.0 evaluating the candidate's overall answer(s) on this topic.
3. "feedback": Brief feedback on the candidate's specific responses regarding this topic.

Then provide an overall summary with specific improvement suggestions based ONLY on the evidence in the transcript. Include feedback on any casual conversation that happened after the core questions in this summary area.

**IMPORTANT: Respond ONLY with valid JSON in this exact format:**
{
    "questions": [
        {
            "question": "Summary of topic or question actually discussed",
            "score": 0.75,
            "feedback": "Brief feedback on the answer quality based on the conversation"
        }
    ],
    "totalScore": 7.5,
    "totalQuestions": 1, // The number of distinct core topics evaluated
    "summaryFeedback": "A detailed 3-5 paragraph summary covering: 1) Overall performance, 2) Key strengths, 3) Specific weaknesses needing improvement, 4) Actionable next steps"
}`

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
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
