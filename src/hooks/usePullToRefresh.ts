import { useEffect, useRef, useState } from 'react';

export function usePullToRefresh(onRefresh: () => Promise<void>) {
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    let isRefreshing = false;
    
    const handleTouchStart = (e: TouchEvent) => {
      if (window.scrollY === 0) {
        startY.current = e.touches[0].clientY;
      }
    };
    
    const handleTouchMove = (e: TouchEvent) => {
      if (!startY.current) return;
      
      const currentY = e.touches[0].clientY;
      const diff = currentY - startY.current;
      
      if (diff > 0 && window.scrollY === 0) {
        e.preventDefault();
        setIsPulling(true);
        setPullDistance(Math.min(diff, 150));
      }
    };
    
    const handleTouchEnd = async () => {
      if (pullDistance > 80 && !isRefreshing) {
        isRefreshing = true;
        
        // Haptic feedback
        if ('vibrate' in navigator) {
          navigator.vibrate(20);
        }
        
        try {
          await onRefresh();
        } finally {
          isRefreshing = false;
        }
      }
      
      setIsPulling(false);
      setPullDistance(0);
      startY.current = 0;
    };
    
    document.addEventListener('touchstart', handleTouchStart, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
    
    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [pullDistance, onRefresh]);
  
  return {
    containerRef,
    isPulling,
    pullDistance
  };
}