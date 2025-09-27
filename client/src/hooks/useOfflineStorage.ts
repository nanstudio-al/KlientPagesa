import { useState, useEffect, useRef } from 'react';
import { Preferences } from '@capacitor/preferences';
import { Network } from '@capacitor/network';
import { useToast } from '@/hooks/use-toast';
import { useNotifications } from '@/hooks/useNotifications';
import { apiRequest } from '@/lib/queryClient';

type OfflineAction = {
  id: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  entity: 'clients' | 'services' | 'invoices';
  data: any;
  timestamp: number;
};

type OfflineData = {
  clients: any[];
  services: any[];
  invoices: any[];
  actions: OfflineAction[];
  lastSync: number;
};

export function useOfflineStorage() {
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [offlineData, setOfflineData] = useState<OfflineData>({
    clients: [],
    services: [],
    invoices: [],
    actions: [],
    lastSync: 0
  });
  
  // Refs to avoid stale closures in network listener
  const isSyncingRef = useRef(false);
  const actionsLengthRef = useRef(0);
  const mountedRef = useRef(true);
  
  const { toast } = useToast();
  const { notifySyncSuccess, notifySyncFailure } = useNotifications();

  // Update refs when state changes
  useEffect(() => {
    isSyncingRef.current = isSyncing;
  }, [isSyncing]);
  
  useEffect(() => {
    actionsLengthRef.current = offlineData.actions.length;
  }, [offlineData.actions.length]);

  // Initialize offline storage and network monitoring
  useEffect(() => {
    mountedRef.current = true;
    initializeOfflineStorage();
    
    let cleanupFn: (() => void) | undefined;
    
    setupNetworkMonitoring().then((cleanup) => {
      if (mountedRef.current) {
        cleanupFn = cleanup;
      } else {
        // Component unmounted before listener setup completed
        cleanup();
      }
    });
    
    // Cleanup network listener on unmount
    return () => {
      mountedRef.current = false;
      if (cleanupFn) cleanupFn();
    };
  }, []);

  const initializeOfflineStorage = async () => {
    try {
      const { value } = await Preferences.get({ key: 'pagesa_offline_data' });
      if (value) {
        const data = JSON.parse(value) as OfflineData;
        setOfflineData(data);
      }
    } catch (error) {
      console.error('Failed to load offline data:', error);
    }
  };

  const setupNetworkMonitoring = async () => {
    try {
      // Check initial network status
      const status = await Network.getStatus();
      setIsOnline(status.connected);

      // Track previous state to detect transitions
      let wasOnline = status.connected;

      // Listen for network changes
      const listener = await Network.addListener('networkStatusChange', (status) => {
        const currentlyOnline = status.connected;
        setIsOnline(currentlyOnline);
        
        // Sync when transitioning from offline to online (using refs to avoid stale closures)
        if (currentlyOnline && !wasOnline && actionsLengthRef.current > 0 && !isSyncingRef.current) {
          toast({
            title: 'Lidhja u rivendos',
            description: 'Të dhënat po sinkronizohen me serverin...',
          });
          syncOfflineActions();
        } else if (!currentlyOnline) {
          toast({
            title: 'Pa lidhje interneti',
            description: 'Aplikacioni vazhdon të punojë offline.',
            variant: 'destructive'
          });
        }
        
        // Update previous state
        wasOnline = currentlyOnline;
      });

      // Return cleanup function
      return () => {
        if (listener && typeof listener.remove === 'function') {
          listener.remove();
        }
      };
    } catch (error) {
      console.error('Failed to setup network monitoring:', error);
      return () => {}; // Return empty cleanup function
    }
  };

  const saveOfflineData = async (data: OfflineData) => {
    try {
      await Preferences.set({
        key: 'pagesa_offline_data',
        value: JSON.stringify(data)
      });
      setOfflineData(data);
    } catch (error) {
      console.error('Failed to save offline data:', error);
    }
  };

  const addOfflineAction = async (action: Omit<OfflineAction, 'id' | 'timestamp'>) => {
    const newAction: OfflineAction = {
      ...action,
      id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now()
    };

    const updatedData = {
      ...offlineData,
      actions: [...offlineData.actions, newAction]
    };

    await saveOfflineData(updatedData);
    return newAction.id;
  };

  // Cache data for offline use
  const cacheData = async (entity: keyof OfflineData, data: any[]) => {
    if (entity === 'actions' || entity === 'lastSync') return;
    
    const updatedData = {
      ...offlineData,
      [entity]: data,
      lastSync: Date.now()
    };
    
    await saveOfflineData(updatedData);
  };

  // Create data offline
  const createOffline = async (entity: 'clients' | 'services' | 'invoices', data: any) => {
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const itemWithTempId = { ...data, id: tempId, _offline: true };

    // Add to local cache
    const updatedData = {
      ...offlineData,
      [entity]: [...offlineData[entity], itemWithTempId]
    };
    await saveOfflineData(updatedData);

    // Queue for sync
    await addOfflineAction({
      type: 'CREATE',
      entity,
      data: { ...data, tempId }
    });

    return tempId;
  };

  // Update data offline
  const updateOffline = async (entity: 'clients' | 'services' | 'invoices', id: string, data: any) => {
    // Update local cache
    const updatedData = {
      ...offlineData,
      [entity]: offlineData[entity].map(item => 
        item.id === id ? { ...item, ...data, _offline: true } : item
      )
    };
    await saveOfflineData(updatedData);

    // Queue for sync
    await addOfflineAction({
      type: 'UPDATE',
      entity,
      data: { id, ...data }
    });
  };

  // Delete data offline
  const deleteOffline = async (entity: 'clients' | 'services' | 'invoices', id: string) => {
    // Remove from local cache
    const updatedData = {
      ...offlineData,
      [entity]: offlineData[entity].filter(item => item.id !== id)
    };
    await saveOfflineData(updatedData);

    // Queue for sync (unless it was a temp item)
    if (!id.startsWith('temp_')) {
      await addOfflineAction({
        type: 'DELETE',
        entity,
        data: { id }
      });
    }
  };

  // Get current offline data (fresh from storage)
  const getCurrentOfflineData = async (): Promise<OfflineData> => {
    try {
      const { value } = await Preferences.get({ key: 'pagesa_offline_data' });
      if (value) {
        return JSON.parse(value);
      }
    } catch (error) {
      console.error('Failed to get current offline data:', error);
    }
    return {
      clients: [],
      services: [],
      invoices: [],
      actions: [],
      lastSync: 0
    };
  };

  // Sync offline actions with server
  const syncOfflineActions = async () => {
    if (isSyncingRef.current) {
      return;
    }

    // Get fresh network status to avoid stale state
    try {
      const networkStatus = await Network.getStatus();
      if (!networkStatus.connected) {
        return;
      }
    } catch (error) {
      console.error('Failed to check network status:', error);
      return;
    }

    // Get fresh data to avoid stale state
    const currentData = await getCurrentOfflineData();
    if (currentData.actions.length === 0) {
      return;
    }

    setIsSyncing(true);
    const successfulActions: string[] = [];

    try {
      for (const action of currentData.actions) {
        try {
          let endpoint = `/api/${action.entity}`;
          let method: 'POST' | 'PUT' | 'DELETE' = 'POST';

          switch (action.type) {
            case 'CREATE':
              method = 'POST';
              const response = await apiRequest(method, endpoint, action.data);
              const result = await response.json();
              
              // Update temp ID with real ID in cache
              if (result && result.id && action.data.tempId) {
                const freshData = await getCurrentOfflineData();
                const updatedData = {
                  ...freshData,
                  [action.entity]: freshData[action.entity].map(item =>
                    item.id === action.data.tempId 
                      ? { ...item, id: result.id, _offline: false }
                      : item
                  )
                };
                await saveOfflineData(updatedData);
                setOfflineData(updatedData);
              }
              break;

            case 'UPDATE':
              method = 'PUT';
              endpoint = `${endpoint}/${action.data.id}`;
              await apiRequest(method, endpoint, action.data);
              break;

            case 'DELETE':
              method = 'DELETE';
              endpoint = `${endpoint}/${action.data.id}`;
              await apiRequest(method, endpoint);
              break;
          }

          successfulActions.push(action.id);
        } catch (error) {
          console.error(`Failed to sync action ${action.id}:`, error);
          // Continue with other actions
        }
      }

      // Remove successfully synced actions using fresh data
      if (successfulActions.length > 0) {
        const freshData = await getCurrentOfflineData();
        const updatedData = {
          ...freshData,
          actions: freshData.actions.filter(action => 
            !successfulActions.includes(action.id)
          ),
          lastSync: Date.now()
        };
        await saveOfflineData(updatedData);
        setOfflineData(updatedData);

        toast({
          title: 'Sinkronizimi u krye',
          description: `${successfulActions.length} veprime u sinkronizuan me sukses.`,
        });
        
        // Native notification for sync success
        notifySyncSuccess(successfulActions.length);
      }

    } catch (error) {
      console.error('Sync failed:', error);
      const failedCount = offlineData.actions.length - successfulActions.length;
      toast({
        title: 'Gabim në sinkronizim',
        description: 'Disa të dhëna nuk u sinkronizuan. Do të provohet përsëri.',
        variant: 'destructive'
      });
      
      // Native notification for sync failure
      if (failedCount > 0) {
        notifySyncFailure(failedCount);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  // Manual sync trigger
  const forcSync = () => {
    if (isOnline) {
      syncOfflineActions();
    } else {
      toast({
        title: 'Pa lidhje interneti',
        description: 'Nuk mund të sinkronizohet pa lidhje interneti.',
        variant: 'destructive'
      });
    }
  };

  // Get cached data for offline viewing
  const getCachedData = (entity: 'clients' | 'services' | 'invoices') => {
    return offlineData[entity] || [];
  };

  // Check if app has pending offline actions
  const hasPendingActions = () => {
    return offlineData.actions.length > 0;
  };

  return {
    isOnline,
    isSyncing,
    offlineData,
    cacheData,
    createOffline,
    updateOffline,
    deleteOffline,
    getCachedData,
    syncOfflineActions: forcSync,
    hasPendingActions,
    pendingActionsCount: offlineData.actions.length
  };
}