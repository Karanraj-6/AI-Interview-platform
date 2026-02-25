import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { logout } from '@/app/auth/actions'

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const supabase = await createClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        return redirect('/login')
    }

    return (
        <div className="min-h-screen bg-zinc-950 flex flex-col">
            <header className="border-b border-zinc-800 bg-zinc-900/50">
                <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <Link href="/dashboard" className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                            AI Interview Platform
                        </Link>
                    </div>
                    <div className="flex items-center space-x-4">
                        <Link href="/dashboard/profile" className="text-sm text-zinc-400 hover:text-white transition-colors">
                            Profile
                        </Link>
                        <span className="text-sm text-zinc-500 hidden md:inline-block">{user.email}</span>
                        <form action={logout}>
                            <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-white hover:bg-zinc-800">
                                Log out
                            </Button>
                        </form>
                    </div>
                </div>
            </header>
            <main className="flex-1">
                {children}
            </main>
        </div>
    )
}
