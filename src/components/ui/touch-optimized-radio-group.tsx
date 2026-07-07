import * as React from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useResponsive } from "@/hooks/useResponsive";
import { cn } from "@/lib/utils";

interface TouchOptimizedRadioOption {
  value: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  description?: string;
}

interface TouchOptimizedRadioGroupProps {
  options: TouchOptimizedRadioOption[];
  value: string;
  onValueChange: (value: string) => void;
  label: string;
  required?: boolean;
  className?: string;
  gridColumns?: "1" | "2" | "3" | "auto";
  name?: string;
}

export const TouchOptimizedRadioGroup: React.FC<TouchOptimizedRadioGroupProps> = ({
  options,
  value,
  onValueChange,
  label,
  required = false,
  className,
  gridColumns = "auto",
  name,
  ...props
}) => {
  const { isMobile } = useResponsive();

  // Determine grid columns based on screen size and prop
  const getGridCols = () => {
    if (gridColumns === "1") return "grid-cols-1";
    if (gridColumns === "2") return isMobile ? "grid-cols-1 xs:grid-cols-2" : "grid-cols-2";
    if (gridColumns === "3") return isMobile ? "grid-cols-2" : "grid-cols-3";
    // Auto mode: responsive based on option count
    if (options.length <= 2) return "grid-cols-1 xs:grid-cols-2";
    if (options.length === 3) return isMobile ? "grid-cols-2" : "grid-cols-3";
    return isMobile ? "grid-cols-2" : "grid-cols-3";
  };

  return (
    <div className={cn("space-y-3", isMobile && "space-y-4", className)}>
      <Label className={cn(
        "text-base font-medium", 
        isMobile && "text-lg"
      )}>
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      
      <RadioGroup
        value={value}
        onValueChange={onValueChange}
        name={name}
        className={cn(
          "grid gap-2",
          isMobile ? "gap-4" : "gap-2",
          getGridCols()
        )}
        {...props}
      >
        {options.map((option) => (
          <div
            key={option.value}
            className={cn(
              "flex items-center space-x-3 p-3 rounded-lg border hover:bg-accent transition-colors cursor-pointer",
              isMobile && "p-4 space-x-4 min-h-[56px]", // Touch-friendly on mobile
              value === option.value && "bg-accent border-primary ring-1 ring-primary/20"
            )}
            onClick={() => onValueChange(option.value)}
          >
            <RadioGroupItem
              value={option.value}
              className={cn(
                isMobile && "w-6 h-6" // Larger radio button on mobile
              )}
            />
            <div className="flex items-center gap-2 flex-1">
              {option.icon && (
                <option.icon className={cn(
                  "w-4 h-4 shrink-0",
                  isMobile && "w-5 h-5"
                )} />
              )}
              <div className="flex-1">
                <Label 
                  className={cn(
                    "cursor-pointer text-sm font-medium",
                    isMobile && "text-base"
                  )}
                  htmlFor={option.value}
                >
                  {option.label}
                </Label>
                {option.description && (
                  <p className={cn(
                    "text-xs text-muted-foreground mt-0.5",
                    isMobile && "text-sm"
                  )}>
                    {option.description}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
};

export type { TouchOptimizedRadioOption, TouchOptimizedRadioGroupProps };