import React, { useState, useEffect } from 'react';
import { cn } from "@/lib/utils";
import { Clock } from 'lucide-react';

interface LoadingAnimationProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showText?: boolean;
  message?: string;
}

export const HITAMTreeLoading: React.FC<LoadingAnimationProps> = ({
  size = 'md',
  className,
  showText = true
}) => {
  // Force re-render to restart animations every time component mounts
  const [animationKey, setAnimationKey] = useState(0);

  useEffect(() => {
    // Generate a unique key when component mounts to ensure animations restart
    setAnimationKey(Date.now());
  }, []);

  const sizeClasses = {
    sm: 'w-80 h-80',
    md: 'w-[28rem] h-[28rem]',
    lg: 'w-[40rem] h-[40rem]'
  };

  // Use the exact file path for the logo
  const logoPath = '/hitam-tree-logo.png';

  return (
    <div className={cn("flex flex-col items-center justify-center", className)}>
      {/* HITAM Tree Container with filling animation */}
      <div
        key={`hitam-tree-${animationKey}`}
        className={cn("relative overflow-hidden", sizeClasses[size])}
      >
        {/* Base HITAM Tree Image (Background) */}
        <img
          src={logoPath}
          alt="HITAM Tree Logo"
          className="w-full h-full object-contain opacity-20 grayscale pointer-events-none"
        />

        {/* Filling Green Logo Overlay */}
        <div
          className="absolute inset-0 hitam-tree-rising pointer-events-none"
          style={{
            backgroundColor: 'hsl(var(--primary))',
            maskImage: `url(${logoPath})`,
            WebkitMaskImage: `url(${logoPath})`,
            maskSize: 'contain',
            WebkitMaskSize: 'contain',
            maskRepeat: 'no-repeat',
            WebkitMaskRepeat: 'no-repeat',
            maskPosition: 'center',
            WebkitMaskPosition: 'center'
          }}
        />

      </div>



      {showText && (
        <div
          key={`text-${animationKey}`}
          className="mt-6 text-center space-y-2 hitam-text-fadeup"
        >
          <p className="text-xl font-bold text-foreground">
            LOADING YOUR WORKSPACE...
          </p>

        </div>
      )}
    </div>
  );
};

export const LoadingSpinner: React.FC<LoadingAnimationProps> = ({
  size = 'md',
  className
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };

  return (
    <div className={cn("animate-spin rounded-full border-2 border-primary border-t-transparent", sizeClasses[size], className)} />
  );
};

export const ClockLoading: React.FC<LoadingAnimationProps> = ({
  size = 'md',
  className,
  showText = true,
  message = "SUBMITTING..."
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  return (
    <div className={cn("flex items-center justify-center font-bold text-destructive", className)}>
      <Clock className={cn("mr-2 animate-spin", sizeClasses[size])} />
      {showText && <span>{message}</span>}
    </div>
  );
};