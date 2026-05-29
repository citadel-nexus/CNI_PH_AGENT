import { electronStorage } from "@utils/electronStorage";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type LayoutPreset = "1x1" | "2x1" | "1x2" | "2x2" | "3x2" | "3x3";
export type CommandCenterPanelId = "datadog" | "posthog" | "linear" | "n8n";

export interface DatadogPanelSnapshot {
  activeAlerts: number;
  errorRate: number;
  apmHealthy: boolean;
  recentEventCount: number;
  lastEventAt: string | null;
}

export interface PosthogPanelEvent {
  eventName: string;
  timestamp: string;
}

export interface PosthogPanelSnapshot {
  recentEvents: PosthogPanelEvent[];
}

export interface LinearPanelIssue {
  id: string;
  identifier: string;
  title: string;
  state: string | null;
}

export interface LinearPanelSnapshot {
  activeIssues: LinearPanelIssue[];
  projectStatus: Array<{
    id: string;
    name: string;
    progress: number | null;
    state: string | null;
  }>;
  recentUpdates: Array<{
    id: string;
    identifier: string;
    title: string;
    updatedAt: string | null;
  }>;
}

export interface N8nPanelSnapshot {
  workflows: Array<{
    id: string;
    name: string;
    active: boolean;
    updatedAt: string | null;
  }>;
  recentExecutions: Array<{
    id: string;
    status: string;
    startedAt: string | null;
    stoppedAt: string | null;
  }>;
  errorCount: number;
}

interface GridDimensions {
  cols: number;
  rows: number;
}

export function getGridDimensions(preset: LayoutPreset): GridDimensions {
  const [cols, rows] = preset.split("x").map(Number);
  return { cols, rows };
}

function getCellCount(preset: LayoutPreset): number {
  const { cols, rows } = getGridDimensions(preset);
  return cols * rows;
}

interface CommandCenterStoreState {
  layout: LayoutPreset;
  cells: (string | null)[];
  activeTaskId: string | null;
  activeCellIndex: number | null;
  zoom: number;
  creatingCells: number[];
  panelVisibility: Record<CommandCenterPanelId, boolean>;
  panelOrder: CommandCenterPanelId[];
  lastRefreshAt: string | null;
  datadogSnapshot: DatadogPanelSnapshot;
  posthogSnapshot: PosthogPanelSnapshot;
  linearSnapshot: LinearPanelSnapshot;
  n8nSnapshot: N8nPanelSnapshot;
}

interface CommandCenterStoreActions {
  setLayout: (preset: LayoutPreset) => void;
  setActiveTask: (taskId: string | null) => void;
  setActiveCell: (cellIndex: number | null) => void;
  assignTask: (cellIndex: number, taskId: string) => void;
  autofillCells: (taskIds: string[]) => void;
  removeTask: (cellIndex: number) => void;
  removeTaskById: (taskId: string) => void;
  clearAll: () => void;
  setZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  startCreating: (cellIndex: number) => void;
  stopCreating: (cellIndex: number) => void;
  setPanelVisibility: (panelId: CommandCenterPanelId, visible: boolean) => void;
  setPanelOrder: (panelOrder: CommandCenterPanelId[]) => void;
  setLastRefreshAt: (timestamp: string | null) => void;
  setDatadogSnapshot: (snapshot: DatadogPanelSnapshot) => void;
  setPosthogSnapshot: (snapshot: PosthogPanelSnapshot) => void;
  setLinearSnapshot: (snapshot: LinearPanelSnapshot) => void;
  setN8nSnapshot: (snapshot: N8nPanelSnapshot) => void;
}

export const COMMAND_CENTER_INITIAL_STATE: CommandCenterStoreState = {
  layout: "2x2",
  cells: [null, null, null, null],
  activeTaskId: null,
  activeCellIndex: null,
  zoom: 1,
  creatingCells: [],
  panelVisibility: {
    datadog: true,
    posthog: true,
    linear: true,
    n8n: true,
  },
  panelOrder: ["datadog", "posthog", "linear", "n8n"],
  lastRefreshAt: null,
  datadogSnapshot: {
    activeAlerts: 0,
    errorRate: 0,
    apmHealthy: true,
    recentEventCount: 0,
    lastEventAt: null,
  },
  posthogSnapshot: {
    recentEvents: [],
  },
  linearSnapshot: {
    activeIssues: [],
    projectStatus: [],
    recentUpdates: [],
  },
  n8nSnapshot: {
    workflows: [],
    recentExecutions: [],
    errorCount: 0,
  },
};

type CommandCenterStore = CommandCenterStoreState & CommandCenterStoreActions;

function resizeCells(
  current: (string | null)[],
  newCount: number,
): (string | null)[] {
  if (current.length === newCount) return current;
  if (current.length > newCount) return current.slice(0, newCount);
  return [...current, ...Array(newCount - current.length).fill(null)];
}

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 1.5;
const ZOOM_STEP = 0.1;

function clampZoom(value: number): number {
  return Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value)) * 10) / 10;
}

export function getCellSessionId(cellIndex: number): string {
  return `cc-cell-${cellIndex}`;
}

export const useCommandCenterStore = create<CommandCenterStore>()(
  persist(
    (set) => ({
      ...COMMAND_CENTER_INITIAL_STATE,

      setLayout: (preset) =>
        set((state) => {
          const newCount = getCellCount(preset);
          return {
            activeTaskId: resizeCells(state.cells, newCount).includes(
              state.activeTaskId,
            )
              ? state.activeTaskId
              : null,
            activeCellIndex:
              state.activeCellIndex !== null && state.activeCellIndex < newCount
                ? state.activeCellIndex
                : null,
            layout: preset,
            cells: resizeCells(state.cells, newCount),
            creatingCells: state.creatingCells.filter((i) => i < newCount),
          };
        }),

      setActiveTask: (taskId) => set({ activeTaskId: taskId }),

      setActiveCell: (cellIndex) => set({ activeCellIndex: cellIndex }),

      assignTask: (cellIndex, taskId) =>
        set((state) => {
          if (cellIndex < 0 || cellIndex >= state.cells.length) return state;
          const cells = [...state.cells];
          const existingIndex = cells.indexOf(taskId);
          if (existingIndex !== -1) {
            cells[existingIndex] = null;
          }
          cells[cellIndex] = taskId;
          return {
            cells,
            activeTaskId: taskId,
            creatingCells: state.creatingCells.filter((i) => i !== cellIndex),
          };
        }),

      autofillCells: (taskIds) =>
        set((state) => {
          if (taskIds.length === 0) return state;
          if (state.cells.every((id) => id != null)) return state;
          const cells: (string | null)[] = [...state.cells];
          const queue = [...taskIds];
          for (let i = 0; i < cells.length && queue.length > 0; i++) {
            if (cells[i] == null) {
              cells[i] = queue.shift() as string;
            }
          }
          return { cells };
        }),

      removeTask: (cellIndex) =>
        set((state) => {
          const cells = [...state.cells];
          const removedTaskId = cells[cellIndex];
          cells[cellIndex] = null;
          return {
            cells,
            activeTaskId:
              removedTaskId && state.activeTaskId === removedTaskId
                ? null
                : state.activeTaskId,
          };
        }),

      removeTaskById: (taskId) =>
        set((state) => {
          const index = state.cells.indexOf(taskId);
          if (index === -1) return state;
          const cells = [...state.cells];
          cells[index] = null;
          return {
            cells,
            activeTaskId:
              state.activeTaskId === taskId ? null : state.activeTaskId,
          };
        }),

      clearAll: () =>
        set((state) => ({
          activeTaskId: null,
          activeCellIndex: null,
          cells: state.cells.map(() => null),
          creatingCells: [],
        })),

      setZoom: (zoom) => set({ zoom: clampZoom(zoom) }),
      zoomIn: () =>
        set((state) => ({ zoom: clampZoom(state.zoom + ZOOM_STEP) })),
      zoomOut: () =>
        set((state) => ({ zoom: clampZoom(state.zoom - ZOOM_STEP) })),

      startCreating: (cellIndex) =>
        set((state) => ({
          creatingCells: state.creatingCells.includes(cellIndex)
            ? state.creatingCells
            : [...state.creatingCells, cellIndex],
        })),

      stopCreating: (cellIndex) =>
        set((state) => ({
          creatingCells: state.creatingCells.filter((i) => i !== cellIndex),
        })),

      setPanelVisibility: (panelId, visible) =>
        set((state) => ({
          panelVisibility: {
            ...state.panelVisibility,
            [panelId]: visible,
          },
        })),

      setPanelOrder: (panelOrder) => set({ panelOrder }),

      setLastRefreshAt: (timestamp) => set({ lastRefreshAt: timestamp }),

      setDatadogSnapshot: (snapshot) => set({ datadogSnapshot: snapshot }),
      setPosthogSnapshot: (snapshot) => set({ posthogSnapshot: snapshot }),
      setLinearSnapshot: (snapshot) => set({ linearSnapshot: snapshot }),
      setN8nSnapshot: (snapshot) => set({ n8nSnapshot: snapshot }),
    }),
    {
      name: "command-center-storage",
      storage: electronStorage,
      partialize: (state) => ({
        layout: state.layout,
        cells: state.cells,
        activeTaskId: state.activeTaskId,
        activeCellIndex: state.activeCellIndex,
        zoom: state.zoom,
        creatingCells: state.creatingCells,
        panelVisibility: state.panelVisibility,
        panelOrder: state.panelOrder,
      }),
    },
  ),
);
