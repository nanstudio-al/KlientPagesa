import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { useToast } from '@/hooks/use-toast';

export function useNotifications() {
  const { toast } = useToast();
  const isNative = Capacitor.isNativePlatform();

  // Request notification permissions
  const requestPermissions = async () => {
    if (!isNative) return true;

    try {
      const result = await LocalNotifications.requestPermissions();
      return result.display === 'granted';
    } catch (error) {
      console.error('Failed to request notification permissions:', error);
      return false;
    }
  };

  // Generate safe 32-bit notification ID
  const generateNotificationId = () => {
    return Math.floor(Math.random() * 2_000_000_000);
  };

  // Schedule invoice due date reminder
  const scheduleInvoiceDueReminder = async (invoiceId: string, clientName: string, amount: number, dueDate: Date) => {
    if (!isNative) {
      console.log('Web platform: would schedule reminder for', invoiceId);
      return;
    }

    try {
      const hasPermission = await requestPermissions();
      if (!hasPermission) {
        toast({
          title: 'Njoftime jo të lejuara',
          description: 'Lejoni njoftimet në cilësimet e aplikacionit.',
          variant: 'destructive'
        });
        return;
      }

      // Schedule notification 1 day before due date
      const reminderDate = new Date(dueDate);
      reminderDate.setDate(reminderDate.getDate() - 1);
      reminderDate.setHours(9, 0, 0, 0); // 9 AM reminder

      // Only schedule if reminder date is in the future
      if (reminderDate <= new Date()) {
        return;
      }

      await LocalNotifications.schedule({
        notifications: [
          {
            title: 'Kujtues Pagese',
            body: `Fatura për ${clientName} (${amount}€) skadon nesër`,
            id: generateNotificationId(),
            schedule: { at: reminderDate },
            sound: 'default',
            attachments: undefined,
            actionTypeId: '',
            extra: {
              invoiceId: invoiceId,
              type: 'invoice_due_reminder'
            }
          }
        ]
      });

      console.log(`Scheduled reminder for invoice ${invoiceId} at ${reminderDate}`);
    } catch (error) {
      console.error('Failed to schedule notification:', error);
    }
  };

  // Schedule sync success notification
  const notifySyncSuccess = async (itemsCount: number) => {
    if (!isNative) {
      return;
    }

    try {
      const hasPermission = await requestPermissions();
      if (!hasPermission) return;

      await LocalNotifications.schedule({
        notifications: [
          {
            title: 'Sinkronizimi u krye',
            body: `${itemsCount} veprime u sinkronizuan me sukses`,
            id: generateNotificationId(),
            schedule: { at: new Date(Date.now() + 1000) }, // Show in 1 second
            sound: 'default',
            attachments: undefined,
            actionTypeId: '',
            extra: {
              type: 'sync_success'
            }
          }
        ]
      });
    } catch (error) {
      console.error('Failed to send sync notification:', error);
    }
  };

  // Schedule sync failure notification
  const notifySyncFailure = async (failedCount: number) => {
    if (!isNative) {
      return;
    }

    try {
      const hasPermission = await requestPermissions();
      if (!hasPermission) return;

      await LocalNotifications.schedule({
        notifications: [
          {
            title: 'Gabim në sinkronizim',
            body: `${failedCount} veprime nuk u sinkronizuan. Provojeni përsëri.`,
            id: generateNotificationId(),
            schedule: { at: new Date(Date.now() + 1000) }, // Show in 1 second
            sound: 'default',
            attachments: undefined,
            actionTypeId: '',
            extra: {
              type: 'sync_failure'
            }
          }
        ]
      });
    } catch (error) {
      console.error('Failed to send sync failure notification:', error);
    }
  };

  // Cancel all notifications for an invoice (e.g., when marked as paid)
  const cancelInvoiceNotifications = async (invoiceId: string) => {
    if (!isNative) return;

    try {
      const notificationId = parseInt(invoiceId.replace(/[^0-9]/g, '').substring(0, 8));
      await LocalNotifications.cancel({
        notifications: [{ id: notificationId }]
      });
    } catch (error) {
      console.error('Failed to cancel notifications:', error);
    }
  };

  // Get pending notifications
  const getPendingNotifications = async () => {
    if (!isNative) return [];

    try {
      const result = await LocalNotifications.getPending();
      return result.notifications;
    } catch (error) {
      console.error('Failed to get pending notifications:', error);
      return [];
    }
  };

  return {
    isNative,
    requestPermissions,
    scheduleInvoiceDueReminder,
    notifySyncSuccess,
    notifySyncFailure,
    cancelInvoiceNotifications,
    getPendingNotifications
  };
}