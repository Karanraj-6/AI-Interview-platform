'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { login } from '@/app/auth/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import Orb from '@/components/Orb'

export default function LoginPage() {
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        const formData = new FormData(e.currentTarget)
        try {
            const res = await login(formData)
            if (res?.error) {
                setError(res.error)
            }
            // If no error, redirect happens on the server via the action
        } catch (err) {
            // In case redirect throws, we let it propagate
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="relative min-h-screen flex items-center justify-center bg-zinc-950 p-4 overflow-hidden">
            <div className="absolute inset-0 z-0">
                <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                    <Orb
                        hoverIntensity={0.82}
                        rotateOnHover
                        hue={360}
                        forceHoverState={false}
                        backgroundColor="#2b2989"
                    />
                </div>
            </div>
            <Card className="z-10 w-full max-w-lg shadow-2xl border-zinc-800 bg-zinc-950/80 backdrop-blur-sm">
                <CardHeader className="space-y-3 pb-6">
                    <CardTitle className="text-3xl font-bold tracking-tight text-zinc-100">Login</CardTitle>
                    <CardDescription className="text-base text-zinc-400">Enter your email below to login to your account.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-3">
                            <Label htmlFor="email" className="text-base text-zinc-200">Email</Label>
                            <Input id="email" name="email" type="email" placeholder="m@example.com" required className="h-12 text-lg bg-zinc-900/50 border-zinc-800 text-zinc-100 placeholder:text-zinc-500" />
                        </div>
                        <div className="space-y-3">
                            <Label htmlFor="password" className="text-base text-zinc-200">Password</Label>
                            <Input id="password" name="password" type="password" required className="h-12 text-lg bg-zinc-900/50 border-zinc-800 text-zinc-100" />
                        </div>
                        {error && <p className="text-base text-red-500">{error}</p>}
                        <Button type="submit" className="w-full h-12 text-lg font-medium bg-indigo-600 hover:bg-indigo-700 text-white" disabled={loading}>
                            {loading ? "Logging in..." : "Login"}
                        </Button>
                    </form>
                </CardContent>
                <CardFooter className="flex justify-center flex-col space-y-4 pt-6">
                    <p className="text-base text-center text-zinc-400">
                        Don't have an account?{" "}
                        <Link href="/register" className="text-indigo-400 underline hover:text-indigo-300 transition-colors">
                            Register here
                        </Link>
                    </p>
                </CardFooter>
            </Card>
        </div>
    )
}
