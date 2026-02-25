import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

        const supabase = createClient(supabaseUrl, supabaseKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        });

        // 1. Get all users from auth.users (requires service role)
        const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();

        if (authError) {
            return NextResponse.json({ error: authError.message }, { status: 500 });
        }

        if (!users || users.length === 0) {
            return NextResponse.json({ message: "No registered users found in auth.users." });
        }

        // 2. For each user, ensure they exist in public.users
        const insertedUsers = [];
        for (const user of users) {
            // Check if user exists in public.users
            const { data: existingUser } = await supabase
                .from('users')
                .select('id')
                .eq('id', user.id)
                .single();

            if (!existingUser) {
                // Insert missing user
                const { error: insertError } = await supabase
                    .from('users')
                    .insert({
                        id: user.id,
                        email: user.email,
                        name: user.user_metadata?.full_name || 'Candidate',
                        avatar_url: user.user_metadata?.avatar_url || ''
                    });

                if (insertError) {
                    console.error(`Failed to insert user ${user.id}:`, insertError);
                } else {
                    insertedUsers.push(user.email);
                }
            }
        }

        return NextResponse.json({
            success: true,
            message: `Checked ${users.length} auth.users. Inserted ${insertedUsers.length} missing records into public.users.`,
            insertedUsers
        });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
