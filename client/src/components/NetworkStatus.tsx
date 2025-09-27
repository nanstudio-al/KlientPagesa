import { useOfflineStorage } from '@/hooks/useOfflineStorage';

export function NetworkStatus() {
  const { isOnline } = useOfflineStorage();

  return (
    <div 
      className={`w-2 h-2 rounded-full transition-colors ${
        isOnline ? 'bg-green-500' : 'bg-red-500'
      }`}
      data-testid={isOnline ? 'dot-online' : 'dot-offline'}
      title={isOnline ? 'Online' : 'Offline'}
    />
  );
}