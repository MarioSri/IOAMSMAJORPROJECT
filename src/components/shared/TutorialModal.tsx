import React, { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from 'react-router-dom';
import { useTutorialContext } from "@/contexts/TutorialContext";
import { cn } from "@/lib/utils";

interface TutorialModalProps {
  className?: string;
}

export function TutorialModal({ className }: TutorialModalProps) {
  const navigate = useNavigate();
  const {
    isActive,
    currentStep,
    totalSteps,
    getCurrentStep,
    navigateToCurrentStep,
    nextStep,
    previousStep,
    skipTutorial
  } = useTutorialContext();

  // Navigate to current step when step changes
  useEffect(() => {
    navigateToCurrentStep(navigate);
  }, [currentStep, navigateToCurrentStep, navigate]);

  const step = getCurrentStep();
  
  if (!isActive || !step) return null;

  const progress = ((currentStep + 1) / totalSteps) * 100;
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === totalSteps - 1;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50 pointer-events-auto" />
      
      {/* Tutorial Card */}
      <div className={cn(
        "pointer-events-auto fixed inset-x-4 top-1/2 max-h-[calc(100dvh-2rem)] -translate-y-1/2 overflow-y-auto sm:inset-x-auto sm:left-1/2 sm:w-[min(28rem,calc(100vw-2rem))] sm:-translate-x-1/2 lg:left-72 lg:w-[367px] lg:translate-x-0",
        className
      )}>
        <Card className="border-0 bg-white shadow-2xl">
          <CardHeader className="p-4 pb-3 sm:p-6 sm:pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-sm font-medium text-muted-foreground">
                  Step {currentStep + 1} of {totalSteps}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={skipTutorial}
                className="h-8 w-8 p-0 hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <Progress value={progress} className="h-1 mt-2" />
            
            <CardTitle className="mt-3 text-center text-lg font-bold sm:mt-4 sm:text-xl">
              {step.title}
            </CardTitle>
          </CardHeader>
          
          <CardContent className="space-y-4 p-4 pt-0 sm:space-y-6 sm:p-6 sm:pt-0">
            <div className="w-full h-px bg-gray-200" />
            
            <p className="text-gray-600 text-sm leading-relaxed text-center">
              {step.description}
            </p>
            
            <div className="flex gap-2 pt-2 sm:gap-3 sm:pt-4">
              <Button
                variant="outline"
                onClick={previousStep}
                disabled={isFirstStep}
                className="flex-1 rounded-full border-gray-300 hover:bg-gray-50"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
              
              <Button
                onClick={nextStep}
                className="flex-1 rounded-full bg-green-600 hover:bg-green-700 text-white"
              >
                {isLastStep ? 'Complete' : 'Next'}
                {!isLastStep && <ChevronRight className="w-4 h-4 ml-1" />}
              </Button>
            </div>
            
            <div className="text-center">
              <Button
                variant="ghost"
                onClick={skipTutorial}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Skip Tutorial
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}