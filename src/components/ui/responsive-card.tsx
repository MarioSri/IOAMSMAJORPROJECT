import React, { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useResponsive } from '@/hooks/useResponsive';

interface ResponsiveCardProps {
  title?: string;
  children: ReactNode;
  className?: string;
  actions?: Array<{
    label: string;
    onClick: () => void;
    variant?: "default" | "outline" | "destructive" | "secondary" | "ghost" | "link";
    icon?: ReactNode;
    disabled?: boolean;
  }>;
  swipeActions?: {
    left?: Array<{
      label: string;
      onClick: () => void;
      variant?: "default" | "destructive" | "success";
      icon?: ReactNode;
    }>;
    right?: Array<{
      label: string;
      onClick: () => void;
      variant?: "default" | "destructive" | "success";
      icon?: ReactNode;
    }>;
  };
}

export const ResponsiveCard: React.FC<ResponsiveCardProps> = ({
  title,
  children,
  className,
  actions = [],
  swipeActions
}) => {
  const { isMobile } = useResponsive();
  const [swipeOffset, setSwipeOffset] = React.useState(0);
  const [isDragging, setIsDragging] = React.useState(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!swipeActions || !isMobile) return;
    setIsDragging(true);
    setSwipeOffset(0);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || !swipeActions || !isMobile) return;
    
    const touch = e.touches[0];
    const startX = e.currentTarget.getBoundingClientRect().left;
    const currentX = touch.clientX;
    const offset = currentX - startX - 200; // Adjust for card width
    
    setSwipeOffset(Math.max(-150, Math.min(150, offset)));
  };

  const handleTouchEnd = () => {
    if (!isDragging || !swipeActions || !isMobile) return;
    
    setIsDragging(false);
    
    if (Math.abs(swipeOffset) > 80) {
      const direction = swipeOffset > 0 ? 'right' : 'left';
      const actionsToShow = direction === 'left' ? swipeActions.left : swipeActions.right;
      
      if (actionsToShow && actionsToShow.length > 0) {
        // Execute first action for simplicity
        actionsToShow[0].onClick();
      }
    }
    
    setSwipeOffset(0);
  };

  return (
    <div className="relative overflow-hidden">
      {/* Swipe Actions Background */}
      {isMobile && swipeActions && (
        <>
          {/* Left Actions */}
          {swipeActions.left && (
            <div className="absolute left-0 top-0 h-full flex items-center z-10">
              {swipeActions.left.map((action, index) => (
                <Button
                  key={index}
                  variant="ghost"
                  className={cn(
                    "h-full rounded-none px-4 min-w-[80px]",
                    action.variant === 'destructive' && "bg-destructive text-destructive-foreground",
                    action.variant === 'success' && "bg-success text-success-foreground"
                  )}
                  onClick={action.onClick}
                >
                  <div className="flex flex-col items-center gap-1">
                    {action.icon}
                    <span className="text-xs">{action.label}</span>
                  </div>
                </Button>
              ))}
            </div>
          )}

          {/* Right Actions */}
          {swipeActions.right && (
            <div className="absolute right-0 top-0 h-full flex items-center z-10">
              {swipeActions.right.map((action, index) => (
                <Button
                  key={index}
                  variant="ghost"
                  className={cn(
                    "h-full rounded-none px-4 min-w-[80px]",
                    action.variant === 'destructive' && "bg-destructive text-destructive-foreground",
                    action.variant === 'success' && "bg-success text-success-foreground"
                  )}
                  onClick={action.onClick}
                >
                  <div className="flex flex-col items-center gap-1">
                    {action.icon}
                    <span className="text-xs">{action.label}</span>
                  </div>
                </Button>
              ))}
            </div>
          )}
        </>
      )}

      {/* Main Card */}
      <Card
        className={cn(
          "shadow-elegant transition-all duration-200 touch-manipulation",
          isDragging && "transition-none",
          isMobile && "mx-0", // Remove margin on mobile
          className
        )}
        style={isMobile ? {
          transform: `translateX(${swipeOffset}px)`,
        } : undefined}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {title && (
          <CardHeader className={cn(isMobile ? "pb-3 px-6 pt-6" : "pb-4")}>
            <CardTitle className={cn(isMobile ? "text-xl" : "text-lg")}>
              {title}
            </CardTitle>
          </CardHeader>
        )}
        
        <CardContent className={cn(
          "space-y-4",
          isMobile ? "px-6 pb-6" : "px-6 pb-4",
          !title && (isMobile ? "pt-6" : "pt-4")
        )}>
          {children}
          
          {actions.length > 0 && (
            <div className={cn(
              "flex gap-3 pt-4",
              isMobile ? "flex-col" : "flex-row flex-wrap"
            )}>
              {actions.map((action, index) => (
                <Button
                  key={index}
                  variant={action.variant || "default"}
                  onClick={action.onClick}
                  disabled={action.disabled}
                  className={cn(
                    "transition-all duration-200",
                    isMobile ? "h-14 text-lg min-w-[44px] flex-1" : "h-12 text-base min-w-[44px]"
                  )}
                >
                  {action.icon && <span className="mr-2">{action.icon}</span>}
                  {action.label}
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

interface TouchOptimizedFieldGroupProps {
  children: ReactNode;
  className?: string;
}

export const TouchOptimizedFieldGroup: React.FC<TouchOptimizedFieldGroupProps> = ({
  children,
  className
}) => {
  const { isMobile } = useResponsive();

  return (
    <div className={cn(
      "grid gap-4",
      isMobile ? "grid-cols-1 gap-6" : "grid-cols-1 md:grid-cols-2 gap-4",
      className
    )}>
      {children}
    </div>
  );
};