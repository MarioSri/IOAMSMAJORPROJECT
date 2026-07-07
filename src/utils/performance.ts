export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;

  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

export function optimizeImage(file: File, maxWidth: number = 1920, quality: number = 0.8): Promise<Blob> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const img = new Image();

    img.onload = () => {
      const ratio = Math.min(maxWidth / img.width, maxWidth / img.height);
      canvas.width = img.width * ratio;
      canvas.height = img.height * ratio;

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(resolve, 'image/jpeg', quality);
    };

    img.src = URL.createObjectURL(file);
  });
}

export function createIntersectionObserver(
  callback: (entries: IntersectionObserverEntry[]) => void,
  options: IntersectionObserverInit = {}
): IntersectionObserver {
  const defaultOptions: IntersectionObserverInit = {
    root: null,
    rootMargin: '50px',
    threshold: 0.1,
    ...options
  };

  return new IntersectionObserver(callback, defaultOptions);
}

export function cleanupResources(): void {
  const events = ['resize', 'scroll', 'orientationchange'];
  events.forEach(event => {
    window.removeEventListener(event, () => {});
  });
}

export function measurePerformance(name: string, fn: () => void): void {
  const start = performance.now();
  fn();
  const end = performance.now();
  console.log(`${name} took ${end - start} milliseconds`);
}

export function batchDOMUpdates(updates: (() => void)[]): void {
  requestAnimationFrame(() => {
    updates.forEach(update => update());
  });
}

export function calculateVisibleItems(
  containerHeight: number,
  itemHeight: number,
  scrollTop: number,
  totalItems: number,
  overscan: number = 5
) {
  const visibleStart = Math.floor(scrollTop / itemHeight);
  const visibleEnd = Math.min(
    visibleStart + Math.ceil(containerHeight / itemHeight),
    totalItems - 1
  );

  return {
    start: Math.max(0, visibleStart - overscan),
    end: Math.min(totalItems - 1, visibleEnd + overscan),
    offsetY: Math.max(0, visibleStart - overscan) * itemHeight
  };
}

export interface TouchGesture {
  type: 'swipe' | 'pinch' | 'tap' | 'longpress';
  direction?: 'left' | 'right' | 'up' | 'down';
  distance?: number;
  scale?: number;
  duration?: number;
}

export function detectTouchGesture(
  startTouch: Touch,
  endTouch: Touch,
  duration: number
): TouchGesture | null {
  const deltaX = endTouch.clientX - startTouch.clientX;
  const deltaY = endTouch.clientY - startTouch.clientY;
  const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

  if (duration > 500 && distance < 10) {
    return { type: 'longpress', duration };
  }

  if (duration < 200 && distance < 10) {
    return { type: 'tap', duration };
  }

  if (distance > 50) {
    const angle = Math.atan2(deltaY, deltaX) * 180 / Math.PI;
    let direction: 'left' | 'right' | 'up' | 'down';

    if (angle > -45 && angle <= 45) direction = 'right';
    else if (angle > 45 && angle <= 135) direction = 'down';
    else if (angle > 135 || angle <= -135) direction = 'left';
    else direction = 'up';

    return { type: 'swipe', direction, distance };
  }

  return null;
}
