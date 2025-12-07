import React, { createContext, useCallback, useContext, useRef } from 'react';
import { useSharedValue, SharedValue } from 'react-native-reanimated';

interface TabBarContextType {
  tabBarVisible: SharedValue<number>;
  tabBarBackgroundVisible: SharedValue<number>;
  setTabBarVisible: (visible: boolean) => void;
  setTabBarBackgroundVisible: (visible: boolean) => void;
}

const TabBarContext = createContext<TabBarContextType | null>(null);

export function TabBarProvider({ children }: { children: React.ReactNode }) {
  // 1 = visible, 0 = hidden
  const tabBarVisible = useSharedValue(1);
  const tabBarBackgroundVisible = useSharedValue(1);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setTabBarVisible = useCallback((visible: boolean) => {
    // Clear any pending timeout
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }

    if (visible) {
      // Show immediately
      tabBarVisible.value = 1;
    } else {
      // Hide with a small delay to debounce rapid scroll changes
      hideTimeoutRef.current = setTimeout(() => {
        tabBarVisible.value = 0;
      }, 50);
    }
  }, [tabBarVisible]);

  const setTabBarBackgroundVisible = useCallback((visible: boolean) => {
    tabBarBackgroundVisible.value = visible ? 1 : 0;
  }, [tabBarBackgroundVisible]);

  return (
    <TabBarContext.Provider value={{
      tabBarVisible,
      tabBarBackgroundVisible,
      setTabBarVisible,
      setTabBarBackgroundVisible,
    }}>
      {children}
    </TabBarContext.Provider>
  );
}

export function useTabBar() {
  const context = useContext(TabBarContext);
  if (!context) {
    throw new Error('useTabBar must be used within a TabBarProvider');
  }
  return context;
}
