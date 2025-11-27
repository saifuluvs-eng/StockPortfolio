import React, { createContext, useContext, useState, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";

interface PointsContextType {
    points: number;
    deductPoints: (amount: number) => boolean;
    canAfford: (amount: number) => boolean;
}

const PointsContext = createContext<PointsContextType | undefined>(undefined);

export const PointsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // Initialize with 30 points (simulating early adopter bonus)
    const [points, setPoints] = useState<number>(30);
    const { toast } = useToast();

    const canAfford = (amount: number) => {
        return points >= amount;
    };

    const deductPoints = (amount: number): boolean => {
        if (canAfford(amount)) {
            setPoints(prev => prev - amount);
            return true;
        } else {
            toast({
                title: "Insufficient Points",
                description: `You need ${amount} points for this action. Current balance: ${points}`,
                variant: "destructive",
            });
            return false;
        }
    };

    return (
        <PointsContext.Provider value={{ points, deductPoints, canAfford }}>
            {children}
        </PointsContext.Provider>
    );
};

export const usePoints = () => {
    const context = useContext(PointsContext);
    if (context === undefined) {
        throw new Error('usePoints must be used within a PointsProvider');
    }
    return context;
};
