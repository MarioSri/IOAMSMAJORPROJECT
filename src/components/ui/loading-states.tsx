import React from 'react';
import { HITAMTreeLoading, LoadingSpinner, ClockLoading } from './loading-animation';
import { cn } from "@/lib/utils";

interface LoadingStateProps {
  type?: 'tree' | 'spinner' | 'clock';
  size?: 'sm' | 'md' | 'lg';
  message?: string;
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  type = 'tree',
  size = 'lg',
  message,
  className
}) => {
  return (
    <div className={cn("flex flex-col items-center justify-center p-8", className)}>
      {type === 'tree' ? (
        <HITAMTreeLoading size={size} showText={!!message} />
      ) : type === 'clock' ? (
        <ClockLoading size={size} showText={!!message} message={message} />
      ) : (
        <LoadingSpinner size={size} />
      )}
      {message && type === 'spinner' && (
        <p className="mt-4 text-sm text-muted-foreground text-center">{message}</p>
      )}
    </div>
  );
};

export const PageLoadingState: React.FC<{ message?: string }> = ({ message }) => (
  <div className="min-h-screen flex items-center justify-center bg-gradient-subtle">
    <HITAMTreeLoading size="lg" showText={true} />
    {message && (
      <div className="absolute bottom-1/3 text-center">
        <p className="text-muted-foreground">{message}</p>
      </div>
    )}
  </div>
);

export const InlineLoadingState: React.FC<{ message?: string }> = ({ message }) => (
  <div className="flex items-center justify-center py-12">
    <div className="text-center">
      <LoadingSpinner size="lg" className="mx-auto mb-4" />
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
    </div>
  </div>
);