import React, { useRef, useState, useEffect } from "react";
import { Link } from "wouter";
import { motion, useScroll, useTransform, useSpring, useInView } from "framer-motion";
import { ArrowRight, BarChart3, Brain, ShieldCheck, Zap, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
    const [isScrolled, setIsScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => setIsScrolled(window.scrollY > 50);
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    return (
        <div className="bg-black text-white min-h-screen font-sans selection:bg-white selection:text-black overflow-x-hidden">
            {/* Navigation */}
            <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled ? "py-4 bg-black/80 backdrop-blur-md" : "py-6 bg-transparent"}`}>
                <div className="container mx-auto px-6 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
                            <BarChart3 className="w-6 h-6 text-black" />
                        </div>
                        <span className="text-xl font-bold tracking-tighter">StockPortfolio</span>
                    </div>
                    <div className="hidden md:flex items-center gap-8">
                        <Link href="/login" className="text-sm font-medium hover:opacity-70 transition-opacity">sign in</Link>
                        <Link href="/signup">
                            <Button className="rounded-full bg-white text-black hover:bg-gray-200 px-6 font-bold">
                                Get Started
                            </Button>
                        </Link>
                    </div>
                </div>
            </nav>

            <HeroSection />
            <ProblemSection />
            <RevealSection />
            <HorizontalScrollSection />
            <FooterSection />
        </div>
    );
}

function HeroSection() {
    const { scrollY } = useScroll();
    const y1 = useTransform(scrollY, [0, 500], [0, 200]);
    const y2 = useTransform(scrollY, [0, 500], [0, -150]);
    const opacity = useTransform(scrollY, [0, 300], [1, 0]);

    return (
        <section className="relative h-screen flex flex-col items-center justify-center overflow-hidden">
            <motion.div
                style={{ y: y1, opacity }}
                className="z-10 text-center space-y-6 px-4"
            >
                <h1 className="text-6xl md:text-9xl font-black tracking-tighter leading-[0.9]">
                    MASTER <br />
                    THE <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">MARKET</span>
                </h1>
                <p className="text-xl md:text-2xl font-medium text-gray-400 max-w-2xl mx-auto">
                    Intelligent insights for the modern trader.
                </p>
                <div className="pt-8">
                    <Link href="/signup">
                        <Button size="lg" className="h-16 px-10 text-xl rounded-full bg-white text-black hover:bg-gray-200 font-bold transition-transform hover:scale-105">
                            Start Free Trial <ArrowRight className="ml-2" />
                        </Button>
                    </Link>
                </div>
            </motion.div>

            {/* Background Parallax */}
            <motion.div
                style={{ y: y2 }}
                className="absolute inset-0 z-0 opacity-60"
            >
                <img
                    src="/assets/images/hero_bg_3d_coins_v2.png"
                    alt="Background"
                    className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black" />
            </motion.div>

            <motion.div
                style={{ opacity }}
                className="absolute bottom-10 animate-bounce"
            >
                <ChevronDown className="w-8 h-8 text-gray-500" />
            </motion.div>
        </section>
    );
}

function ProblemSection() {
    const containerRef = useRef(null);
    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: ["start start", "end end"],
    });

    const opacity1 = useTransform(scrollYProgress, [0.2, 0.3], [0.3, 1]);
    const opacity2 = useTransform(scrollYProgress, [0.4, 0.5], [0.3, 1]);
    const opacity3 = useTransform(scrollYProgress, [0.6, 0.7], [0.3, 1]);

    return (
        <section ref={containerRef} className="relative h-[200vh] bg-black">
            <div className="sticky top-0 h-screen flex items-center justify-center overflow-hidden">
                <div className="container mx-auto px-6 max-w-4xl">
                    <h2 className="text-5xl md:text-8xl font-bold leading-tight tracking-tight text-white">
                        <motion.span style={{ opacity: opacity1 }} className="block">
                            Stop guessing.
                        </motion.span>
                        <motion.span style={{ opacity: opacity2 }} className="block text-gray-200">
                            Most traders lose because they trade on emotion.
                        </motion.span>
                        <motion.span style={{ opacity: opacity3 }} className="block text-purple-400">
                            You're better than that.
                        </motion.span>
                    </h2>
                </div>
            </div>
        </section>
    );
}

function RevealSection() {
    const containerRef = useRef(null);
    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: ["start end", "end start"],
    });

    const scale = useTransform(scrollYProgress, [0, 0.5], [0.8, 1]);
    const opacity = useTransform(scrollYProgress, [0, 0.3], [0, 1]);
    const y = useTransform(scrollYProgress, [0, 0.5], [100, 0]);

    return (
        <section ref={containerRef} className="min-h-screen flex items-center justify-center bg-black py-20 overflow-hidden">
            <div className="container mx-auto px-6 relative">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-purple-600/20 blur-[120px] rounded-full pointer-events-none" />

                <motion.div
                    style={{ scale, opacity, y }}
                    className="relative z-10 bg-[#0a0a0a] border border-white/10 rounded-[3rem] p-8 md:p-12 overflow-hidden shadow-2xl"
                >
                    <div className="grid md:grid-cols-2 gap-12 items-center">
                        <div className="space-y-8">
                            <h3 className="text-3xl md:text-5xl font-bold leading-tight">
                                The Brain Behind <br />
                                <span className="text-purple-400">Your Portfolio</span>
                            </h3>
                            <p className="text-lg text-gray-400 leading-relaxed">
                                Our AI engine doesn't just show data. It interprets it. Get a 7-step comprehensive breakdown of your portfolio health, risks, and actionable moves.
                            </p>
                            <div className="space-y-4">
                                {['Trend Analysis', 'Momentum Scoring', 'Scenario Planning'].map((item, i) => (
                                    <div key={i} className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/5">
                                        <div className="w-3 h-3 rounded-full bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.8)]" />
                                        <span className="font-medium">{item}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="relative h-[400px] md:h-[500px] flex items-center justify-center">
                            <img
                                src="/assets/images/feature_ai_brain_v2.png"
                                alt="AI Brain"
                                className="w-full h-full object-contain drop-shadow-2xl"
                            />
                        </div>
                    </div>
                </motion.div>
            </div>
        </section>
    );
}

function HorizontalScrollSection() {
    const targetRef = useRef(null);
    const { scrollYProgress } = useScroll({
        target: targetRef,
    });

    const x = useTransform(scrollYProgress, [0, 1], ["0%", "-66%"]);

    const features = [
        {
            title: "Real-time Signals",
            desc: "Spot breakouts before they happen.",
            icon: <Zap className="w-12 h-12 text-amber-400" />,
            color: "bg-amber-400/10 border-amber-400/20"
        },
        {
            title: "Risk Management",
            desc: "Protect your capital with smart alerts.",
            icon: <ShieldCheck className="w-12 h-12 text-emerald-400" />,
            color: "bg-emerald-400/10 border-emerald-400/20"
        },
        {
            title: "Portfolio Health",
            desc: "Deep dive into your asset allocation.",
            icon: <BarChart3 className="w-12 h-12 text-blue-400" />,
            color: "bg-blue-400/10 border-blue-400/20"
        }
    ];

    return (
        <section ref={targetRef} className="relative h-[300vh] bg-black">
            <div className="sticky top-0 flex h-screen items-center overflow-hidden">
                <motion.div style={{ x }} className="flex gap-10 px-20">
                    <div className="min-w-[80vw] md:min-w-[40vw] flex flex-col justify-center">
                        <h2 className="text-5xl md:text-8xl font-black tracking-tighter leading-tight">
                            EVERYTHING <br />
                            YOU NEED <br />
                            TO <span className="text-gray-500">WIN.</span>
                        </h2>
                    </div>
                    {features.map((feature, i) => (
                        <div key={i} className={`min-w-[80vw] md:min-w-[30vw] h-[60vh] rounded-[3rem] p-10 flex flex-col justify-between border ${feature.color} backdrop-blur-sm`}>
                            <div>
                                <div className="mb-6">{feature.icon}</div>
                                <h3 className="text-4xl font-bold mb-4">{feature.title}</h3>
                                <p className="text-xl text-gray-400">{feature.desc}</p>
                            </div>
                            <div className="text-9xl font-black opacity-10 self-end">0{i + 1}</div>
                        </div>
                    ))}
                </motion.div>
            </div>
        </section>
    );
}

function FooterSection() {
    return (
        <footer className="bg-black py-20 border-t border-white/10">
            <div className="container mx-auto px-6 text-center">
                <h2 className="text-4xl md:text-6xl font-black tracking-tighter mb-8">
                    ready to <span className="text-purple-500">upgrade?</span>
                </h2>
                <Link href="/signup">
                    <Button size="lg" className="h-20 px-12 text-2xl rounded-full bg-white text-black hover:bg-gray-200 font-bold mb-12">
                        Create Free Account
                    </Button>
                </Link>
                <div className="flex justify-center gap-8 text-gray-500 text-sm">
                    <a href="#" className="hover:text-white transition-colors">privacy</a>
                    <a href="#" className="hover:text-white transition-colors">terms</a>
                    <a href="#" className="hover:text-white transition-colors">contact</a>
                </div>
                <p className="mt-8 text-gray-700 text-xs">© 2025 StockPortfolio AI. All rights reserved.</p>
            </div>
        </footer>
    );
}
