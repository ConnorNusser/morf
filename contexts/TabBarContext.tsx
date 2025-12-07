import React, { createContext, useCallback, useContext } from 'react';
import { useSharedValue, SharedValue } from 'react-native-reanimated';

interface TabBarContextType {
  tabBarBackgroundVisible: SharedValue<number>;
  setTabBarBackgroundVisible: (visible: boolean) => void;
}

const TabBarContext = createContext<TabBarContextType | null>(null);

export function TabBarProvider({ children }: { children: React.ReactNode }) {
  // 1 = visible, 0 = transparent
  const tabBarBackgroundVisible = useSharedValue(1);

  const setTabBarBackgroundVisible = useCallback((visible: boolean) => {
    tabBarBackgroundVisible.value = visible ? 1 : 0;
  }, [tabBarBackgroundVisible]);

  return (
    <TabBarContext.Provider value={{
      tabBarBackgroundVisible,
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
