import { useState, useEffect } from "react";
import { GRID_CONFIG } from "../lib/constants";

export function useResponsiveGrid() {
  const [gridColumns, setGridColumns] = useState(`repeat(${GRID_CONFIG.DESKTOP_COLUMNS}, 1fr)`);
  
  useEffect(() => {
    const updateGridColumns = () => {
      const width = window.innerWidth;
      
      if (width < 640) {
        setGridColumns(`repeat(${GRID_CONFIG.MOBILE_COLUMNS}, 1fr)`);
      } else if (width < 1024) {
        setGridColumns(`repeat(${GRID_CONFIG.TABLET_COLUMNS}, 1fr)`);
      } else if (width >= 1280) {
        setGridColumns(`repeat(${GRID_CONFIG.WIDE_COLUMNS}, 1fr)`);
      } else {
        setGridColumns(`repeat(${GRID_CONFIG.DESKTOP_COLUMNS}, 1fr)`);
      }
    };
    
    updateGridColumns();
    window.addEventListener('resize', updateGridColumns);
    
    return () => window.removeEventListener('resize', updateGridColumns);
  }, []);
  
  return gridColumns;
}