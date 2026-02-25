'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { signup } from '@/app/auth/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import Squares from '@/components/Squares'

export default function RegisterPage() {
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        const formData = new FormData(e.currentTarget)
        try {
            const res = await signup(formData)
            if (res?.error) {
                setError(res.error)
            }
            // If no error, redirect happens on the server via the action
        } catch (err) {
            // In case redirect throws, let it propagate
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="relative min-h-screen flex items-center justify-center bg-zinc-950 p-4 overflow-hidden">
            <div className="absolute inset-0 z-0">
                <Squares
                    speed={0.5}
                    squareSize={40}
                    direction="diagonal"
                    borderColor="#5a2aac"
                    hoverFillColor="#3021a1"
                />
            </div>
            <Card className="z-10 w-full max-w-lg shadow-2xl border-zinc-800 bg-zinc-950/80 backdrop-blur-sm">
                <CardHeader className="space-y-3 pb-6">
                    <CardTitle className="text-3xl font-bold tracking-tight text-zinc-100">Create an account</CardTitle>
                    <CardDescription className="text-base text-zinc-400">Enter your details below to create your account.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-3">
                            <Label htmlFor="name" className="text-base text-zinc-200">Full Name</Label>
                            <Input id="name" name="name" type="text" placeholder="John Doe" required className="h-12 text-lg bg-zinc-900/50 border-zinc-800 text-zinc-100 placeholder:text-zinc-500" />
                        </div>
                        <div className="space-y-3">
                            <Label htmlFor="email" className="text-base text-zinc-200">Email</Label>
                            <Input id="email" name="email" type="email" placeholder="m@example.com" required className="h-12 text-lg bg-zinc-900/50 border-zinc-800 text-zinc-100 placeholder:text-zinc-500" />
                        </div>
                        <div className="space-y-3">
                            <Label htmlFor="password" className="text-base text-zinc-200">Password</Label>
                            <Input id="password" name="password" type="password" required className="h-12 text-lg bg-zinc-900/50 border-zinc-800 text-zinc-100" />
                        </div>
                        {error && <p className="text-base text-red-500">{error}</p>}
                        <Button type="submit" className="w-full h-12 text-lg font-medium" disabled={loading}>
                            {loading ? "Signing up..." : "Sign up"}
                        </Button>
                    </form>
                </CardContent>
                <CardFooter className="flex justify-center flex-col space-y-4 pt-6">
                    <p className="text-base text-center text-zinc-400">
                        Already have an account?{" "}
                        <Link href="/login" className="text-primary underline hover:text-primary/80 transition-colors">
                            Login here
                        </Link>
                    </p>
                </CardFooter>
            </Card>
        </div>
    )
}
