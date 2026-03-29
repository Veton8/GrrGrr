import { create } from 'zustand';

const useMessageStore = create((set, get) => ({
  conversations: [],
  unreadTotal: 0,
  activeConversationId: null,

  setConversations: (conversations) => {
    const unreadTotal = conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
    set({ conversations, unreadTotal });
  },

  setActiveConversation: (id) => set({ activeConversationId: id }),

  updateConversation: (conversationId, updates) =>
    set((state) => {
      const conversations = state.conversations.map((c) =>
        c.id === conversationId ? { ...c, ...updates } : c
      );
      const unreadTotal = conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
      return { conversations, unreadTotal };
    }),

  addNewMessage: (conversationId, message) =>
    set((state) => {
      let found = false;
      const conversations = state.conversations.map((c) => {
        if (c.id === conversationId) {
          found = true;
          return {
            ...c,
            lastMessage: message,
            unreadCount:
              c.id === state.activeConversationId ? 0 : (c.unreadCount || 0) + 1,
          };
        }
        return c;
      });

      // Sort by most recent message
      conversations.sort((a, b) => {
        const aTime = a.lastMessage?.createdAt || a.updatedAt || '';
        const bTime = b.lastMessage?.createdAt || b.updatedAt || '';
        return bTime.localeCompare(aTime);
      });

      const unreadTotal = conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
      return { conversations, unreadTotal };
    }),

  markConversationRead: (conversationId) =>
    set((state) => {
      const conversations = state.conversations.map((c) =>
        c.id === conversationId ? { ...c, unreadCount: 0 } : c
      );
      const unreadTotal = conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
      return { conversations, unreadTotal };
    }),
}));

export default useMessageStore;
