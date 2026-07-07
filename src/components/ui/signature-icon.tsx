import React from 'react';
import { cn } from "@/lib/utils";

interface SignatureIconProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  variant?: 'default' | 'hover' | 'active' | 'disabled';
}

export const AdvancedSignatureIcon: React.FC<SignatureIconProps> = ({ 
  size = 'md', 
  className,
  variant = 'default'
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5', 
    lg: 'w-6 h-6',
    xl: 'w-8 h-8'
  };

  const variantClasses = {
    default: 'text-current',
    hover: 'text-primary',
    active: 'text-primary-foreground',
    disabled: 'text-muted-foreground opacity-50'
  };

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn(sizeClasses[size], variantClasses[variant], className)}
    >
      {/* Document background */}
      <rect x="3" y="2" width="14" height="18" rx="2" ry="2" fill="currentColor" fillOpacity="0.1" />
      <rect x="3" y="2" width="14" height="18" rx="2" ry="2" stroke="currentColor" strokeWidth="1.5" />
      
      {/* Document lines */}
      <line x1="6" y1="6" x2="14" y2="6" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      <line x1="6" y1="9" x2="12" y2="9" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      <line x1="6" y1="12" x2="10" y2="12" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      
      {/* Advanced stylus/pen */}
      <path
        d="M14 15l-2-2 6-6 2 2-6 6z"
        fill="currentColor"
        fillOpacity="0.8"
      />
      <path
        d="M12 13l2 2-1.5 1.5-2-2L12 13z"
        fill="currentColor"
        fillOpacity="0.6"
      />
      
      {/* Pen tip detail */}
      <circle cx="20" cy="7" r="1.5" fill="currentColor" />
      
      {/* Signature line */}
      <path
        d="M6 16c2-1 4 1 6-1s4 2 6 0"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        strokeDasharray="0 4"
      />
    </svg>
  );
};

export const SignatureIcon: React.FC<SignatureIconProps> = (props) => {
  return <AdvancedSignatureIcon {...props} />;
};