import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { GoogleGenAI } from '@google/genai'

export async function POST(req: NextRequest) {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { companyName, jobRole, interviewRound } = await req.json()

    const apiKey = process.env.GOOGLE_GEMINI_API_KEY
    if (!apiKey) {
        return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
    }

    const ai = new GoogleGenAI({ apiKey })

    let prompt: string

    if (companyName) {
        prompt = `Research the company "${companyName}" for a job interview preparation. The candidate is applying for the role of "${jobRole}" and the interview round is "${interviewRound}".

Please provide:
1. **Company Overview**: What the company does, its culture, values, and recent news
2. **Interview Process**: Typical interview rounds and format at this company for this role
3. **Common Interview Questions**: 10-15 frequently asked questions at ${companyName} for ${jobRole} positions (sourced from Glassdoor, LeetCode, interview prep sites, etc.)
4. **Technical Focus Areas**: Key technical skills and topics they typically test
5. **Tips**: Specific advice for succeeding in a ${interviewRound} interview at ${companyName}

Be specific and factual. Use real data from the internet.`
    } else {
        prompt = `Provide general interview preparation guidance for a "${jobRole}" position. The interview round is "${interviewRound}".

Please provide:
1. **Role Overview**: What this role typically entails
2. **Common Interview Questions**: 10-15 frequently asked questions for ${jobRole} positions
3. **Technical Focus Areas**: Key skills and topics typically tested
4. **Tips**: Advice for succeeding in a ${interviewRound} interview for this role

Be specific and practical.`
    }

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
            }
        })

        const researchText = response.text || 'No research data available.'

        return NextResponse.json({ research: researchText })
    } catch (err: any) {
        console.error('Company research error:', err)
        return NextResponse.json({ research: 'Could not fetch company research. Proceeding with general interview.' })
    }
}
