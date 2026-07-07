import { useState, useEffect } from 'react';

export interface TutorialStep {
  id: string;
  title: string;
  description: string;
  route: string;
  icon: string;
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    description: 'Your central hub for quick access to key metrics, recent activities, and important notifications.',
    route: '/dashboard',
    icon: 'LayoutDashboard'
  },
  {
    id: 'track-documents',
    title: 'Track Documents',
    description: 'Monitor the status and progress of all your documents in real-time.',
    route: '/track-documents',
    icon: 'Eye'
  },
  {
    id: 'approval-center',
    title: 'Approval Center',
    description: 'Review and approve pending documents that require your authorization.',
    route: '/approvals',
    icon: 'CheckSquare'
  },
  {
    id: 'calendar',
    title: 'Calendar',
    description: 'Schedule meetings, view appointments, and manage your time effectively.',
    route: '/calendar',
    icon: 'Calendar'
  },
  {
    id: 'messages',
    title: 'Messages',
    description: 'Communicate with colleagues and stay updated on important conversations.',
    route: '/messages',
    icon: 'MessageSquare'
  },
  {
    id: 'document-management',
    title: 'Document Management',
    description: 'Upload, organize, and manage all your institutional documents.',
    route: '/documents',
    icon: 'FileText'
  },
  {
    id: 'emergency-management',
    title: 'Emergency Management',
    description: 'Handle urgent matters and emergency workflows when immediate action is required.',
    route: '/emergency',
    icon: 'AlertTriangle'
  },
  {
    id: 'approval-chain',
    title: 'Approval Chain with Bypass',
    description: 'Configure and manage approval workflows with bypass options for urgent cases.',
    route: '/approval-routing',
    icon: 'ArrowRightLeft'
  },
  {
    id: 'analytics',
    title: 'Analytics Dashboard',
    description: 'View detailed reports and analytics about document processing and system usage.',
    route: '/analytics',
    icon: 'BarChart3'
  },
  {
    id: 'profile',
    title: 'Profile Settings',
    description: 'Manage your account settings, preferences, and personal information.',
    route: '/profile',
    icon: 'Settings'
  }
];

export const ADVANCED_TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'adv-emerg-auto-forward',
    title: 'Emergency Auto-Forward',
    description: 'Automatically forward emergency documents to the next recipient if not acted upon within a specific timeframe.',
    route: '/emergency',
    icon: 'ArrowRight'
  },
  {
    id: 'adv-emerg-sequential-routing',
    title: 'Sequential Routing',
    description: 'Documents are sent to one recipient at a time in a specific order. The next person receives it only after the previous approves.',
    route: '/emergency',
    icon: 'ArrowRight'
  },
  {
    id: 'adv-emerg-parallel-routing',
    title: 'Parallel Routing',
    description: 'Documents are sent to all recipients simultaneously. Everyone must approve before the document moves forward. This mode also bypasses the rejection to ensure workflow continuity during emergencies.',
    route: '/emergency',
    icon: 'Zap'
  },
  {
    id: 'adv-approval-routing-sequential',
    title: 'Sequential Routing',
    description: 'Documents are sent to one recipient at a time in a specific order. The next person receives it only after the previous approves.',
    route: '/approval-routing',
    icon: 'ArrowRight'
  },
  {
    id: 'adv-approval-routing-parallel',
    title: 'Parallel Routing',
    description: 'Documents are sent to all recipients simultaneously. Everyone must approve before the document moves forward.',
    route: '/approval-routing',
    icon: 'Users'
  },
  {
    id: 'adv-approval-routing-bidirectional',
    title: 'Bi-Directional Routing',
    description: 'Allows documents to flow in both directions, enabling flexible, dynamic approval processes.',
    route: '/approval-routing',
    icon: 'ArrowRightLeft'
  }
];

export function useTutorial() {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isAdvanced, setIsAdvanced] = useState(false);
  const [advancedCompleted, setAdvancedCompleted] = useState(false);

  useEffect(() => {
    const tutorialCompleted = localStorage.getItem('tutorialCompleted');
    const advCompleted = localStorage.getItem('advancedTutorialCompleted');
    const isFirstLogin = localStorage.getItem('isFirstLogin');

    if (!tutorialCompleted && isFirstLogin === 'true') {
      setIsActive(true);
      setIsAdvanced(false);
      localStorage.removeItem('isFirstLogin');
    } else if (tutorialCompleted && !advCompleted) {
      setIsActive(true);
      setIsAdvanced(true);
      setCurrentStep(0);
    } else {
      setIsCompleted(!!tutorialCompleted);
      setAdvancedCompleted(!!advCompleted);
    }
  }, []);

  const activeSteps = isAdvanced ? ADVANCED_TUTORIAL_STEPS : TUTORIAL_STEPS;

  function startTutorial() {
    setIsActive(true);
    setIsAdvanced(false);
    setCurrentStep(0);
    setIsCompleted(false);
    setAdvancedCompleted(false);
    localStorage.removeItem('tutorialCompleted');
    localStorage.removeItem('advancedTutorialCompleted');
  }

  function nextStep() {
    if (currentStep < activeSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      if (!isAdvanced) {
        completeTutorial();
        setIsAdvanced(true);
        setCurrentStep(0);
        setIsActive(true);
      } else {
        completeAdvancedTutorial();
      }
    }
  }

  function previousStep() {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    } else if (isAdvanced) {
      setIsAdvanced(false);
      setCurrentStep(TUTORIAL_STEPS.length - 1);
    }
  }

  function completeTutorial() {
    setIsCompleted(true);
    localStorage.setItem('tutorialCompleted', 'true');
  }

  function completeAdvancedTutorial() {
    setIsActive(false);
    setAdvancedCompleted(true);
    localStorage.setItem('advancedTutorialCompleted', 'true');
  }

  function skipTutorial() {
    setIsActive(false);
    completeTutorial();
    completeAdvancedTutorial();
  }

  function getCurrentStep() {
    return activeSteps[currentStep];
  }

  function isCurrentRoute(route: string): boolean {
    return isActive && getCurrentStep()?.route === route;
  }

  function navigateToCurrentStep(navigate: (path: string) => void) {
    if (isActive && activeSteps[currentStep]) {
      navigate(activeSteps[currentStep].route);
    }
  }

  return {
    isActive,
    currentStep,
    totalSteps: activeSteps.length,
    isCompleted,
    isAdvanced,
    advancedCompleted,
    getCurrentStep,
    isCurrentRoute,
    navigateToCurrentStep,
    startTutorial,
    nextStep,
    previousStep,
    skipTutorial,
    completeTutorial,
    steps: activeSteps
  };
}