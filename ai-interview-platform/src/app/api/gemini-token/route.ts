import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET() {
    const supabase = await createClient()

    // Verify user is authenticated
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Return the API key so the client can establish a secure WebSocket connection
    // In a production environment with strict security requirements, 
    // you would want a dedicated WebSocket proxy server instead.
    return NextResponse.json({
        token: process.env.GOOGLE_GEMINI_API_KEY
    })
}
