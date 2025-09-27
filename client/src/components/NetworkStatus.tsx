import { Wifi, WifiOff, RefreshCw, Cloud, CloudOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useOfflineStorage } from '@/hooks/useOfflineStorage';
import { cn } from '@/lib/utils';

export function NetworkStatus() {
  const { 
    isOnline, 
    isSyncing, 
    syncOfflineActions, 
    hasPendingActions, 
    pendingActionsCount 
  } = useOfflineStorage();

  return (
    <div className="flex items-center gap-2">
      {/* Network status indicator */}
      <Badge 
        variant={isOnline ? 'default' : 'destructive'}
        className={cn(
          'flex items-center gap-1 transition-all',
          isOnline ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'
        )}
        data-testid={isOnline ? 'badge-online' : 'badge-offline'}
      >
        {isOnline ? (
          <>
            <Wifi className="w-3 h-3" />
            Online
          </>
        ) : (
          <>
            <WifiOff className="w-3 h-3" />
            Offline
          </>
        )}
      </Badge>

      {/* Sync status */}
      {isSyncing && (
        <Badge variant="secondary" className="flex items-center gap-1" data-testid="badge-syncing">
          <RefreshCw className="w-3 h-3 animate-spin" />
          Duke sinkronizuar...
        </Badge>
      )}

      {/* Pending actions indicator */}
      {hasPendingActions() && !isSyncing && (
        <Badge 
          variant="outline" 
          className="flex items-center gap-1 border-orange-500 text-orange-600"
          data-testid="badge-pending-actions"
        >
          <CloudOff className="w-3 h-3" />
          {pendingActionsCount} në pritje
        </Badge>
      )}

      {/* Manual sync button */}
      {isOnline && hasPendingActions() && !isSyncing && (
        <Button
          size="sm"
          variant="outline"
          onClick={syncOfflineActions}
          className="h-6 px-2 text-xs"
          data-testid="button-sync-now"
        >
          <Cloud className="w-3 h-3 mr-1" />
          Sinkronizo
        </Button>
      )}
    </div>
  );
}