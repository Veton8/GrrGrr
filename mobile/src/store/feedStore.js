import { create } from 'zustand';

const useFeedStore = create((set) => ({
  activeTab: 'foryou',
  setActiveTab: (tab) => set({ activeTab: tab }),
}));

export default useFeedStore;
