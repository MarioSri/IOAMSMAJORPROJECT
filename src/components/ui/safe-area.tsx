import React, { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SafeAreaProps {
  children: ReactNode;
  className?: string;
  top?: boolean;
  bottom?: boolean;
  left?: boolean;
  right?: boolean;
}

export const SafeArea: React.FC<SafeAreaProps> = ({
  children,
  className,
  top = false,
  bottom = false,
  left = false,
  right = false
}) => {
  return (
    <div
      className={cn(
        className,
        top && 'pt-[env(safe-area-inset-top)]',
        bottom && 'pb-[env(safe-area-inset-bottom)]',
        left && 'pl-[env(safe-area-inset-left)]',
        right && 'pr-[env(safe-area-inset-right)]'
      )}
      style={{
        paddingTop: top ? 'max(1rem, env(safe-area-inset-top))' : undefined,
        paddingBottom: bottom ? 'max(1rem, env(safe-area-inset-bottom))' : undefined,
        paddingLeft: left ? 'max(1rem, env(safe-area-inset-left))' : undefined,
        paddingRight: right ? 'max(1rem, env(safe-area-inset-right))' : undefined,
      }}
    >
      {children}
    </div>
  );
};

export const MobileSafeArea: React.FC<{ children: ReactNode; className?: string }> = ({
  children,
  className
}) => (
  <SafeArea top bottom className={className}>
    {children}
  </SafeArea>
);