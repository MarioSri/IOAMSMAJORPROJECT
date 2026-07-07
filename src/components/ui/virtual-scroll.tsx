import React, { useState, useEffect, useRef, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { calculateVisibleItems } from '@/utils/performance';

interface VirtualScrollProps<T> {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  className?: string;
  overscan?: number;
  onScroll?: (scrollTop: number) => void;
}

export function VirtualScroll<T>({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  className,
  overscan = 5,
  onScroll
}: VirtualScrollProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const scrollElementRef = useRef<HTMLDivElement>(null);

  const { start, end, offsetY } = useMemo(() => 
    calculateVisibleItems(containerHeight, itemHeight, scrollTop, items.length, overscan),
    [containerHeight, itemHeight, scrollTop, items.length, overscan]
  );

  const visibleItems = useMemo(() => 
    items.slice(start, end + 1),
    [items, start, end]
  );

  const totalHeight = items.length * itemHeight;

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const newScrollTop = e.currentTarget.scrollTop;
    setScrollTop(newScrollTop);
    onScroll?.(newScrollTop);
  };

  return (
    <div
      ref={scrollElementRef}
      className={cn("overflow-auto", className)}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div
          style={{
            transform: `translateY(${offsetY}px)`,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
          }}
        >
          {visibleItems.map((item, index) => (
            <div
              key={start + index}
              style={{ height: itemHeight }}
              className="flex items-center"
            >
              {renderItem(item, start + index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Specialized virtual scroll for mobile lists
interface MobileVirtualListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  estimatedItemHeight?: number;
  className?: string;
}

export function MobileVirtualList<T>({
  items,
  renderItem,
  estimatedItemHeight = 80,
  className
}: MobileVirtualListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(400);

  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerHeight(rect.height);
      }
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  return (
    <div ref={containerRef} className={cn("h-full", className)}>
      <VirtualScroll
        items={items}
        itemHeight={estimatedItemHeight}
        containerHeight={containerHeight}
        renderItem={renderItem}
        overscan={3}
      />
    </div>
  );
}