import React, { useRef } from "react";
import { Link } from "wouter";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, BarChart3, Brain, ShieldCheck, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
    const targetRef = useRef<HTMLDivElement>(null);
    const { scrollYProgress } = useScroll({
        target: targetRef,
        offset: ["start start", "end start"],
    });

    const heroOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
    const heroScale = useTransform(scrollYProgress, [0, 0.5], [1, 0.8]);
    const heroY = useTransform(scrollYProgress, [0, 0.5], [0, 100]);

    return (
        <div className="min-h-screen bg-background text-foreground overflow-x-hidden selection:bg-primary/30">
            {/* Navigation */}
            <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 bg-background/80 backdrop-blur-md border-b border-white/5">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center">
                        <BarChart3 className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-xl font-bold tracking-tight">StockPortfolio</span>
                </div>
                <div className="flex items-center gap-4">
                    <Link href="/login">
                        <Button variant="ghost" className="text-sm font-medium">
                            Sign In
                        </Button>
                    </Link>
                    <Link href="/signup">
                        <Button className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20">
                            Get Started
                        </Button>
                    </Link>
                </div>
            </nav>

            {/* Hero Section */}
            <section ref={targetRef} className="relative min-h-[110vh] flex items-center justify-center pt-20 overflow-hidden">
                {/* Background Elements */}
                <div className="absolute inset-0 z-0">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-900/10 via-background to-background" />
                    <motion.img
                        src="/assets/images/hero_bg_3d_coins_v2.png"
                        alt="3D Crypto Coins"
                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[110%] max-w-none opacity-80 object-cover h-full md:h-auto md:w-full mix-blend-lighten"
                        style={{ y: heroY, scale: heroScale, opacity: heroOpacity }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-background/0 via-background/40 to-background" />
                </div>

                {/* Content */}
                <div className="relative z-10 container mx-auto px-4 text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="max-w-5xl mx-auto space-y-8"
                    >
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mb-6 shadow-2xl shadow-purple-500/10">
                            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-sm font-medium text-white/90">AI-Powered Analysis Live</span>
                        </div>

                        <h1 className="text-6xl md:text-8xl font-bold tracking-tight text-white drop-shadow-2xl pb-4">
                            Master the Market <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 animate-gradient-x">
                                Intelligent Insights
                            </span>
                        </h1>

                        <p className="text-xl md:text-2xl text-gray-300 max-w-3xl mx-auto leading-relaxed drop-shadow-md">
                            Stop guessing. Start strategizing. Our AI-driven platform analyzes market structure, momentum, and risk to give you a clear edge.
                        </p>

                        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-10">
                            <Link href="/signup">
                                <Button size="lg" className="h-14 px-10 text-lg bg-primary hover:bg-primary/90 shadow-[0_0_40px_-10px_rgba(168,85,247,0.5)] transition-all hover:scale-105 hover:shadow-[0_0_60px_-10px_rgba(168,85,247,0.6)]">
                                    Start Free Trial <ArrowRight className="ml-2 w-5 h-5" />
                                </Button>
                            </Link>
                            <Link href="/dashboard">
                                <Button size="lg" variant="outline" className="h-14 px-10 text-lg border-white/10 bg-white/5 hover:bg-white/10 backdrop-blur-md text-white">
                                    View Demo
                                </Button>
                            </Link>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* Features Section */}
            <section className="relative py-32 bg-background z-20">
                <div className="container mx-auto px-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <FeatureCard
                            icon={<Brain className="w-8 h-8 text-purple-400" />}
                            title="AI Strategist"
                            description="Get a 7-step comprehensive breakdown of your portfolio health, risks, and actionable moves."
                            delay={0.1}
                        />
                        <FeatureCard
                            icon={<Zap className="w-8 h-8 text-amber-400" />}
                            title="Real-time Signals"
                            description="Live market data meets quantitative analysis. Spot breakouts and breakdowns before they happen."
                            delay={0.2}
                        />
                        <FeatureCard
                            icon={<ShieldCheck className="w-8 h-8 text-emerald-400" />}
                            title="Risk Management"
                            description="Protect your capital with smart alerts, concentration checks, and volatility monitoring."
                            delay={0.3}
                        />
                    </div>
                </div>
            </section>

            {/* Deep Dive Section */}
            <section className="relative py-32 overflow-hidden">
                <div className="container mx-auto px-4">
                    <div className="flex flex-col md:flex-row items-center gap-20">
                        <motion.div
                            initial={{ opacity: 0, x: -50 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.8 }}
                            className="flex-1 space-y-8"
                        >
                            <h2 className="text-4xl md:text-6xl font-bold leading-tight">
                                The Brain Behind <br />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">Your Portfolio</span>
                            </h2>
                            <p className="text-xl text-muted-foreground leading-relaxed">
                                Our advanced AI engine processes thousands of data points to deliver clear, signal-based guidance. No noise, no fear—just pure, actionable strategy.
                            </p>
                            <ul className="space-y-6 pt-4">
                                {['Trend Analysis', 'Momentum Scoring', 'Scenario Planning'].map((item, i) => (
                                    <li key={i} className="flex items-center gap-4 text-lg text-foreground/90">
                                        <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center border border-purple-500/30">
                                            <div className="w-2.5 h-2.5 rounded-full bg-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.8)]" />
                                        </div>
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, scale: 0.8, rotate: -5 }}
                            whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 1, ease: "easeOut" }}
                            className="flex-1 relative"
                        >
                            <div className="absolute inset-0 bg-purple-500/10 blur-[120px] rounded-full mix-blend-screen" />
                            <img
                                src="/assets/images/feature_ai_brain_v2.png"
                                alt="AI Brain"
                                className="relative z-10 w-full max-w-lg mx-auto drop-shadow-2xl animate-float hover:scale-105 transition-transform duration-700"
                            />
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-32 relative">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-primary/5" />
                <div className="container mx-auto px-4 text-center relative z-10">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="max-w-3xl mx-auto space-y-8"
                    >
                        <h2 className="text-4xl md:text-5xl font-bold">Ready to Level Up?</h2>
                        <p className="text-xl text-muted-foreground">
                            Join thousands of traders who are making smarter, data-driven decisions every day.
                        </p>
                        <Link href="/signup">
                            <Button size="lg" className="h-14 px-10 text-lg bg-white text-black hover:bg-white/90 shadow-2xl shadow-white/10 transition-transform hover:scale-105">
                                Create Free Account
                            </Button>
                        </Link>
                    </motion.div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-12 border-t border-white/5 bg-background/50 backdrop-blur-sm">
                <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-6 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                        <BarChart3 className="w-4 h-4" />
                        <span>© 2025 StockPortfolio AI</span>
                    </div>
                    <div className="flex gap-6">
                        <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
                        <a href="#" className="hover:text-foreground transition-colors">Terms</a>
                        <a href="#" className="hover:text-foreground transition-colors">Contact</a>
                    </div>
                </div>
            </footer>
        </div>
    );
}

function FeatureCard({ icon, title, description, delay }: { icon: React.ReactNode, title: string, description: string, delay: number }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay, duration: 0.5 }}
            className="p-8 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors group"
        >
            <div className="mb-6 p-3 rounded-xl bg-background w-fit group-hover:scale-110 transition-transform duration-300 border border-white/5">
                {icon}
            </div>
            <h3 className="text-xl font-bold mb-3">{title}</h3>
            <p className="text-muted-foreground leading-relaxed">
                {description}
            </p>
        </motion.div>
    );
}
