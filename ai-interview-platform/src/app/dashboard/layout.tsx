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
        <div className="min-h-screen bg-zinc-950 flex flex-col relative z-0">
            {/* The layout background is now fully transparent to allow Orb behind it, or handled by page.tsx */}
            <header className="border-b border-white/5 bg-zinc-950/70 relative z-10 backdrop-blur-xl shadow-lg shadow-black/20">
                <div className="container mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <Link href="/dashboard" className="flex items-center gap-2 group">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:shadow-indigo-500/40 transition-all duration-300">
                                <span className="text-white font-bold text-sm">AI</span>
                            </div>
                            <span className="text-lg font-semibold bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent group-hover:from-indigo-300 group-hover:to-purple-300 transition-all duration-300">
                                Interview Platform
                            </span>
                        </Link>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Link href="/dashboard/profile" className="text-sm text-zinc-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5">
                            Profile
                        </Link>
                        <div className="h-4 w-px bg-zinc-800 mx-1"></div>
                        <span className="text-sm text-zinc-500 hidden md:inline-block">{user.email}</span>
                        <form action={logout}>
                            <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg">
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
