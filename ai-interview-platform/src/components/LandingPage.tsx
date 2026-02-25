"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Squares from "./Squares";

gsap.registerPlugin(ScrollTrigger);

const features = [
    {
        icon: "🎙️",
        title: "Real-Time AI Voice",
        description:
            "Experience bi-directional voice interviews powered by advanced AI. Natural conversations that adapt to your responses in real time.",
    },
    {
        icon: "📊",
        title: "Smart Feedback",
        description:
            "Receive detailed performance analytics after every session. Identify strengths, pinpoint weaknesses, and track your growth over time.",
    },
    {
        icon: "🚀",
        title: "Practice Anytime",
        description:
            "Unlimited practice sessions available 24/7. Prepare for any role, any industry, at your own pace — whenever you're ready.",
    },
];

export default function LandingPage() {
    const heroRef = useRef<HTMLDivElement>(null);
    const headlineRef = useRef<HTMLHeadingElement>(null);
    const subtitleRef = useRef<HTMLParagraphElement>(null);
    const ctaRef = useRef<HTMLDivElement>(null);
    const badgeRef = useRef<HTMLDivElement>(null);
    const featuresRef = useRef<HTMLDivElement>(null);
    const footerRef = useRef<HTMLElement>(null);

    useEffect(() => {
        const ctx = gsap.context(() => {
            // Hero timeline
            const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

            // Badge
            if (badgeRef.current) {
                gsap.set(badgeRef.current, { y: -20, opacity: 0 });
                tl.to(badgeRef.current, { y: 0, opacity: 1, duration: 0.6 });
            }

            // Headline — split words
            if (headlineRef.current) {
                const words = headlineRef.current.querySelectorAll(".word");
                gsap.set(words, { y: 60, opacity: 0, rotateX: -40 });
                tl.to(
                    words,
                    {
                        y: 0,
                        opacity: 1,
                        rotateX: 0,
                        duration: 0.8,
                        stagger: 0.08,
                    },
                    "-=0.2"
                );
            }

            // Subtitle
            if (subtitleRef.current) {
                gsap.set(subtitleRef.current, { y: 30, opacity: 0 });
                tl.to(
                    subtitleRef.current,
                    { y: 0, opacity: 1, duration: 0.7 },
                    "-=0.3"
                );
            }

            // CTA buttons
            if (ctaRef.current) {
                const buttons = ctaRef.current.querySelectorAll(".landing-btn");
                gsap.set(buttons, { y: 20, opacity: 0 });
                tl.to(
                    buttons,
                    { y: 0, opacity: 1, duration: 0.5, stagger: 0.12 },
                    "-=0.3"
                );
            }

            // Feature cards — ScrollTrigger
            if (featuresRef.current) {
                const cards = featuresRef.current.querySelectorAll(".feature-card");
                gsap.set(cards, { y: 60, opacity: 0 });
                gsap.to(cards, {
                    scrollTrigger: {
                        trigger: featuresRef.current,
                        start: "top 80%",
                        end: "bottom 60%",
                        toggleActions: "play none none reverse",
                    },
                    y: 0,
                    opacity: 1,
                    duration: 0.7,
                    stagger: 0.15,
                    ease: "power2.out",
                });
            }

            // Footer
            if (footerRef.current) {
                gsap.set(footerRef.current, { opacity: 0, y: 20 });
                gsap.to(footerRef.current, {
                    scrollTrigger: {
                        trigger: footerRef.current,
                        start: "top 95%",
                    },
                    opacity: 1,
                    y: 0,
                    duration: 0.6,
                });
            }
        });

        return () => ctx.revert();
    }, []);



    return (
        <div className="landing-root">
            <div className="landing-bg-wrap">
                <Squares
                    speed={0.5}
                    squareSize={40}
                    direction="diagonal"
                    borderColor="#5a2aac"
                    hoverFillColor="#3021a1"
                />
            </div>

            {/* ── Hero ── */}
            <section ref={heroRef} className="landing-hero">
                <div className="landing-hero-inner">
                    {/* Badge */}
                    <div ref={badgeRef} className="landing-badge">
                        <span className="landing-badge-dot" />
                        AI-Powered Interview Coach
                    </div>

                    {/* Brand Name — Large */}
                    <h1 ref={headlineRef} className="landing-brand">
                        <span className="word">AI</span>
                        <span className="word">Interview</span>
                    </h1>

                    {/* Tagline */}
                    <p ref={subtitleRef} className="landing-tagline">
                        Your Career, Perfected.
                    </p>

                    {/* Description */}
                    <p className="landing-subtitle">
                        Master every interview with our real-time AI voice coach.
                        <br className="hidden sm:block" />
                        Practice smarter. Get instant feedback. Land your dream role.
                    </p>

                    {/* CTAs */}
                    <div ref={ctaRef} className="landing-cta-group">
                        <Link href="/login" className="landing-btn landing-btn-primary">
                            Get Started
                            <svg
                                width="16"
                                height="16"
                                viewBox="0 0 16 16"
                                fill="none"
                                className="landing-btn-arrow"
                            >
                                <path
                                    d="M3 8h10M9 4l4 4-4 4"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </svg>
                        </Link>
                        <Link href="/register" className="landing-btn landing-btn-secondary">
                            Create Free Account
                        </Link>
                    </div>
                </div>
            </section>

            {/* ── Features ── */}
            <section ref={featuresRef} className="landing-features">
                <div className="landing-features-inner">
                    <h2 className="landing-section-title">
                        Everything you need to prepare
                    </h2>
                    <p className="landing-section-subtitle">
                        A complete platform designed to sharpen your interview skills and
                        boost your confidence.
                    </p>

                    <div className="landing-features-grid">
                        {features.map((f, i) => (
                            <div key={i} className="feature-card">
                                <div className="feature-icon">{f.icon}</div>
                                <h3 className="feature-title">{f.title}</h3>
                                <p className="feature-desc">{f.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Footer ── */}
            <footer ref={footerRef} className="landing-footer">
                <div className="landing-footer-inner">
                    <span className="landing-footer-brand">AI Interview Platform</span>
                    <span className="landing-footer-copy">
                        &copy; {new Date().getFullYear()} All rights reserved.
                    </span>
                </div>
            </footer>
        </div>
    );
}
