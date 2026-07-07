import React, { ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import { useResponsive } from '@/hooks/useResponsive';

interface TouchOptimizedFormProps {
  children: ReactNode;
  onSubmit: (e: React.FormEvent) => void;
  className?: string;
}

export const TouchOptimizedForm: React.FC<TouchOptimizedFormProps> = ({
  children,
  onSubmit,
  className
}) => {
  const { isMobile } = useResponsive();

  return (
    <form 
      onSubmit={onSubmit} 
      className={cn(
        "touch-manipulation",
        isMobile ? "space-y-8 px-4" : "space-y-6", // Increased spacing and padding on mobile
        className
      )}
    >
      {children}
    </form>
  );
};

interface TouchOptimizedInputProps extends React.ComponentProps<typeof Input> {
  label: string;
  required?: boolean;
  error?: string;
  helpText?: string;
}

export const TouchOptimizedInput: React.FC<TouchOptimizedInputProps> = ({
  label,
  required,
  error,
  helpText,
  className,
  ...props
}) => {
  const { isMobile } = useResponsive();

  return (
    <div className={cn("space-y-3", isMobile && "space-y-4")}>
      <Label className={cn("text-base font-medium", isMobile && "text-lg")}>
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <Input
        {...props}
        className={cn(
          "transition-all duration-200",
          isMobile ? "h-16 text-lg px-4 py-3" : "h-12 text-base",
          error && "border-destructive focus:ring-destructive",
          className
        )}
        aria-invalid={!!error}
        aria-describedby={error ? `${props.id}-error` : helpText ? `${props.id}-help` : undefined}
      />
      {error && (
        <p id={`${props.id}-error`} className={cn("text-destructive", isMobile ? "text-base" : "text-sm")}>
          {error}
        </p>
      )}
      {helpText && !error && (
        <p id={`${props.id}-help`} className={cn("text-muted-foreground", isMobile ? "text-base" : "text-sm")}>
          {helpText}
        </p>
      )}
    </div>
  );
};

interface TouchOptimizedTextareaProps extends React.ComponentProps<typeof Textarea> {
  label: string;
  required?: boolean;
  error?: string;
  helpText?: string;
}

export const TouchOptimizedTextarea: React.FC<TouchOptimizedTextareaProps> = ({
  label,
  required,
  error,
  helpText,
  className,
  ...props
}) => {
  const { isMobile } = useResponsive();

  return (
    <div className={cn("space-y-3", isMobile && "space-y-4")}>
      <Label className={cn("text-base font-medium", isMobile && "text-lg")}>
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <Textarea
        {...props}
        className={cn(
          "transition-all duration-200",
          isMobile ? "min-h-[140px] text-lg px-4 py-4" : "min-h-[100px] text-base",
          error && "border-destructive focus:ring-destructive",
          className
        )}
        aria-invalid={!!error}
        aria-describedby={error ? `${props.id}-error` : helpText ? `${props.id}-help` : undefined}
      />
      {error && (
        <p id={`${props.id}-error`} className={cn("text-destructive", isMobile ? "text-base" : "text-sm")}>
          {error}
        </p>
      )}
      {helpText && !error && (
        <p id={`${props.id}-help`} className={cn("text-muted-foreground", isMobile ? "text-base" : "text-sm")}>
          {helpText}
        </p>
      )}
    </div>
  );
};

interface TouchOptimizedSelectProps {
  label: string;
  required?: boolean;
  error?: string;
  helpText?: string;
  placeholder?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  children: ReactNode;
}

export const TouchOptimizedSelect: React.FC<TouchOptimizedSelectProps> = ({
  label,
  required,
  error,
  helpText,
  placeholder,
  value,
  onValueChange,
  children
}) => {
  const { isMobile } = useResponsive();

  return (
    <div className="space-y-2">
      <Label className={cn("text-base font-medium", isMobile && "text-lg")}>
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger 
          className={cn(
            "transition-all duration-200",
            isMobile ? "h-14 text-lg" : "h-12 text-base",
            error && "border-destructive focus:ring-destructive"
          )}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {children}
        </SelectContent>
      </Select>
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
      {helpText && !error && (
        <p className="text-sm text-muted-foreground">{helpText}</p>
      )}
    </div>
  );
};

interface TouchOptimizedButtonProps extends React.ComponentProps<typeof Button> {
  children: ReactNode;
}

export const TouchOptimizedButton: React.FC<TouchOptimizedButtonProps> = ({
  children,
  className,
  ...props
}) => {
  const { isMobile } = useResponsive();

  return (
    <Button
      {...props}
      className={cn(
        "transition-all duration-200",
        isMobile ? "h-14 px-8 text-lg min-w-[44px]" : "h-12 px-6 text-base min-w-[44px]",
        className
      )}
    >
      {children}
    </Button>
  );
};

interface TouchOptimizedCheckboxProps {
  label: string;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  error?: string;
  helpText?: string;
}

export const TouchOptimizedCheckbox: React.FC<TouchOptimizedCheckboxProps> = ({
  label,
  checked,
  onCheckedChange,
  disabled,
  error,
  helpText
}) => {
  const { isMobile } = useResponsive();

  return (
    <div className="space-y-2">
      <div className={cn(
        "flex items-center space-x-3 p-3 rounded-lg border hover:bg-accent transition-colors",
        isMobile && "p-4 min-h-[56px]", // Larger touch target
        error && "border-destructive"
      )}>
        <Checkbox
          checked={checked}
          onCheckedChange={onCheckedChange}
          disabled={disabled}
          className={cn(isMobile && "w-6 h-6")}
        />
        <Label 
          className={cn(
            "flex-1 cursor-pointer font-medium",
            isMobile && "text-lg",
            disabled && "opacity-50"
          )}
        >
          {label}
        </Label>
      </div>
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
      {helpText && !error && (
        <p className="text-sm text-muted-foreground">{helpText}</p>
      )}
    </div>
  );
};