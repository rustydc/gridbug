import { create } from 'zustand';
import { temporal } from 'zundo';
import debounce from 'just-debounce-it';
import { Outline, ViewBox, Point } from './types';
import { calculateMinimalGridArea } from './utils/grid';
import { getNextColor } from './utils/color';
import { calculateSplineBounds } from './utils/spline';

interface State {
  outlines: Outline[];
  viewBox: ViewBox;
  zoomFactor: number;  // Add zoomFactor to state
  addOutline: (points: Point[][], bitmap?: {
    url: string;
    width: number;
    height: number;
    position: Point;
  }) => void;
  updateOutline: (id: string, updates: Partial<Outline>) => void;
  setViewBox: (viewBox: ViewBox) => void;
  setZoomFactor: (factor: number) => void; // Add method to update zoomFactor
  selectOutline: (id: string | null, multiSelect?: boolean) => void;
  clearSelection: () => void;
  deleteOutline: (id: string) => void;
  centerView: () => void;
  updateMultipleOutlines: (updates: { id: string; updates: Partial<Outline> }[]) => void;
}

export const useStore = create<State>()(
  temporal((set, get) => ({
    outlines: [],
    viewBox: { x: 0, y: 0, width: 800, height: 600 },
    zoomFactor: 1,  // Initialize zoomFactor
    
    centerView: () => set((state) => {
      const { min, max } = calculateMinimalGridArea(state.outlines);
      const padding = 84; // 2 grid cells padding
      return {
        viewBox: {
          x: min.x - padding,
          y: min.y - padding,
          width: max.x - min.x + (padding * 2),
          height: max.y - min.y + (padding * 2),
        }
      };
    }),

    addOutline: (points, bitmap) => set((state) => {
      const newState = {
        outlines: [...state.outlines, {
          id: Math.random().toString(36).substr(2, 9),
          points: points[0], // Take first contour for now
          position: { x: 0, y: 0 },
          rotation: 0,
          selected: false,
          editMode: false,
          color: getNextColor(state.outlines.length),
          bounds: calculateSplineBounds(points[0]),
          bitmap
        }]
      };
      get().centerView();
      return newState;
    }),

    updateOutline: (id, updates) => set((state) => ({
      outlines: state.outlines.map(outline => 
        outline.id === id ? { 
          ...outline, 
          ...updates,
          // Recalculate bounds if points changed
          bounds: updates.points ? calculateSplineBounds(updates.points) : outline.bounds
        } : outline
      )
    })),

    updateMultipleOutlines: (updates) => set((state) => ({
      outlines: state.outlines.map(outline => {
        const update = updates.find(u => u.id === outline.id);
        return update ? { ...outline, ...update.updates } : outline;
      })
    })),

    setViewBox: (viewBox) => set({ viewBox }),

    setZoomFactor: (factor) => set({ zoomFactor: factor }), // Method to update zoomFactor

    selectOutline: (id, multiSelect = false) => set((state) => ({
      outlines: state.outlines.map(outline => ({
        ...outline,
        selected: multiSelect ? 
          (outline.id === id ? !outline.selected : outline.selected) : // Toggle on shift-click
          outline.id === id, // Normal click behavior
        editMode: outline.id === id ? outline.editMode : false
      }))
    })),
    
    clearSelection: () => set((state) => ({
      outlines: state.outlines.map(outline => ({
        ...outline,
        selected: false,
        editMode: false
      }))
    })),
    
    deleteOutline: (id) => set((state) => ({
      outlines: state.outlines.filter(outline => outline.id !== id)
    }))
  }), {
    limit: 50,
    partialize: (state) => ({
      outlines: state.outlines
    }),
    handleSet: (handleSet) => {
      const debouncedSet = debounce(handleSet, 3000, true);
      return (state) => debouncedSet(state);
    }
  })
);
