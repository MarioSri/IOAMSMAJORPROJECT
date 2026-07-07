export function announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
  const announcement = document.createElement('div');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = message;

  document.body.appendChild(announcement);

  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
}

export function trapFocus(element: HTMLElement): () => void {
  const focusableElements = element.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );

  const firstElement = focusableElements[0] as HTMLElement;
  const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

  const handleTabKey = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;

    if (e.shiftKey) {
      if (document.activeElement === firstElement) {
        lastElement.focus();
        e.preventDefault();
      }
    } else {
      if (document.activeElement === lastElement) {
        firstElement.focus();
        e.preventDefault();
      }
    }
  };

  element.addEventListener('keydown', handleTabKey);
  firstElement?.focus();

  return () => {
    element.removeEventListener('keydown', handleTabKey);
  };
}

export function generateId(prefix: string = 'id'): string {
  return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
}

export function getAriaLabel(element: string, action?: string, context?: string): string {
  let label = element;
  if (action) label += ` ${action}`;
  if (context) label += ` for ${context}`;
  return label;
}

export function handleArrowNavigation(
  e: KeyboardEvent,
  items: HTMLElement[],
  currentIndex: number,
  onIndexChange: (index: number) => void
): void {
  let newIndex = currentIndex;

  switch (e.key) {
    case 'ArrowDown':
      newIndex = Math.min(currentIndex + 1, items.length - 1);
      break;
    case 'ArrowUp':
      newIndex = Math.max(currentIndex - 1, 0);
      break;
    case 'Home':
      newIndex = 0;
      break;
    case 'End':
      newIndex = items.length - 1;
      break;
    default:
      return;
  }

  e.preventDefault();
  onIndexChange(newIndex);
  items[newIndex]?.focus();
}

export function getContrastRatio(color1: string, color2: string): number {
  const getLuminance = (color: string): number => {
    const rgb = parseInt(color.slice(1), 16);
    const r = (rgb >> 16) & 0xff;
    const g = (rgb >> 8) & 0xff;
    const b = (rgb >> 0) & 0xff;

    const [rs, gs, bs] = [r, g, b].map(c => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });

    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  };

  const lum1 = getLuminance(color1);
  const lum2 = getLuminance(color2);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);

  return (brightest + 0.05) / (darkest + 0.05);
}

export function meetsWCAGStandard(color1: string, color2: string, level: 'AA' | 'AAA' = 'AA'): boolean {
  const ratio = getContrastRatio(color1, color2);
  return level === 'AA' ? ratio >= 4.5 : ratio >= 7;
}

export class FocusManager {
  private static focusStack: HTMLElement[] = [];

  static pushFocus(element: HTMLElement) {
    this.focusStack.push(document.activeElement as HTMLElement);
    element.focus();
  }

  static popFocus() {
    const previousElement = this.focusStack.pop();
    if (previousElement && typeof previousElement.focus === 'function') {
      previousElement.focus();
    }
  }

  static clearFocusStack() {
    this.focusStack = [];
  }
}

export function createLiveRegion(priority: 'polite' | 'assertive' = 'polite'): HTMLElement {
  const region = document.createElement('div');
  region.setAttribute('aria-live', priority);
  region.setAttribute('aria-atomic', 'true');
  region.className = 'sr-only';
  document.body.appendChild(region);
  return region;
}

export function updateLiveRegion(region: HTMLElement, message: string): void {
  region.textContent = message;
}

export function enhanceTouchAccessibility(element: HTMLElement): void {
  const rect = element.getBoundingClientRect();
  if (rect.width < 44 || rect.height < 44) {
    element.style.minWidth = '44px';
    element.style.minHeight = '44px';
  }

  element.addEventListener('touchstart', () => {
    element.style.transform = 'scale(0.95)';
  });

  element.addEventListener('touchend', () => {
    element.style.transform = 'scale(1)';
  });

  element.addEventListener('touchcancel', () => {
    element.style.transform = 'scale(1)';
  });
}
