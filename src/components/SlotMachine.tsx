'use client';

import { useEffect, useState } from 'react';

interface SlotMachineProps {
  value: string;
}

export default function SlotMachine({ value }: SlotMachineProps) {
  const [display, setDisplay] = useState(value);
  const [isAnimating, setIsAnimating] = useState(true);

  useEffect(() => {
    if (value === '-' || value === '0' || value === 'none' || value === 'Yes' || value === 'No') {
      setDisplay(value);
      setIsAnimating(false);
      return;
    }

    setIsAnimating(true);
    let iterations = 0;
    const maxIterations = 15;
    
    const interval = setInterval(() => {
      iterations++;
      
      const scrambled = value.split('').map(char => {
        if (/[0-9]/.test(char)) return Math.floor(Math.random() * 10);
        return char;
      }).join('');
      
      setDisplay(scrambled);
      
      if (iterations >= maxIterations) {
        setDisplay(value);
        setIsAnimating(false);
        clearInterval(interval);
      }
    }, 40);

    return () => clearInterval(interval);
  }, [value]);

  return <span className={isAnimating ? 'opacity-70' : ''}>{display}</span>;
}
