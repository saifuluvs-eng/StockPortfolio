import { Link, useLocation } from "wouter";
import { Home, Briefcase, Activity, BarChart2, Menu } from "lucide-react";
import { motion } from "framer-motion";

interface MobileNavProps {
    onMenuClick: () => void;
}

export default function MobileNav({ onMenuClick }: MobileNavProps) {
    const [location] = useLocation();

    const items = [
        { label: "Home", to: "/dashboard", icon: <Home size={20} /> },
        { label: "Portfolio", to: "/portfolio", icon: <Briefcase size={20} /> },
        { label: "Gainers", to: "/gainers", icon: <Activity size={20} /> },
        { label: "Analyse", to: "/analyse", icon: <BarChart2 size={20} /> },
    ];

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#0f0f0f]/95 backdrop-blur-lg border-t border-white/10 md:hidden pb-safe">
            <div className="flex items-center justify-around h-16 px-2">
                {items.map((item) => {
                    const isActive = location === item.to || (item.to !== "/dashboard" && location.startsWith(item.to));

                    return (
                        <Link key={item.to} href={item.to}>
                            <div className="relative flex flex-col items-center justify-center w-full h-full space-y-1 group cursor-pointer">
                                {isActive && (
                                    <motion.div
                                        layoutId="mobileNavActive"
                                        className="absolute -top-[1px] w-12 h-[2px] bg-[#f7931a] shadow-[0_0_10px_#f7931a]"
                                        initial={false}
                                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                    />
                                )}
                                <div className={`transition-colors duration-200 ${isActive ? "text-[#f7931a]" : "text-gray-400 group-hover:text-gray-200"}`}>
                                    {item.icon}
                                </div>
                                <span className={`text-[10px] font-medium transition-colors duration-200 ${isActive ? "text-[#f7931a]" : "text-gray-400 group-hover:text-gray-200"}`}>
                                    {item.label}
                                </span>
                            </div>
                        </Link>
                    );
                })}

                {/* Menu Button (Triggers Sidebar) */}
                <button
                    onClick={onMenuClick}
                    className="relative flex flex-col items-center justify-center w-full h-full space-y-1 group cursor-pointer"
                >
                    <div className="text-gray-400 group-hover:text-gray-200">
                        <Menu size={20} />
                    </div>
                    <span className="text-[10px] font-medium text-gray-400 group-hover:text-gray-200">
                        Menu
                    </span>
                </button>
            </div>
        </div>
    );
}
