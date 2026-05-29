import { create } from "zustand";

interface OpsDashboardStoreState {
  activePanel: "datadog" | "posthog" | "linear" | "n8n" | null;
  refreshInterval: number;
}

interface OpsDashboardStoreActions {
  setActivePanel: (panel: OpsDashboardStoreState["activePanel"]) => void;
  setRefreshInterval: (ms: number) => void;
}

type OpsDashboardStore = OpsDashboardStoreState & OpsDashboardStoreActions;

export const useOpsDashboardStore = create<OpsDashboardStore>((set) => ({
  activePanel: null,
  refreshInterval: 30_000,

  setActivePanel: (panel) => set({ activePanel: panel }),
  setRefreshInterval: (ms) => set({ refreshInterval: ms }),
}));
