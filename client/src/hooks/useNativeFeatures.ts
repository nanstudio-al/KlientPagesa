import { Share } from '@capacitor/share';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { useToast } from '@/hooks/use-toast';

export function useNativeFeatures() {
  const { toast } = useToast();
  const isNative = Capacitor.isNativePlatform();

  // Share PDF invoice natively
  const shareInvoice = async (pdfBlob: Blob, invoiceNumber: string) => {
    if (!isNative) {
      // Web fallback - traditional download
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fatura-${invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: 'Fatura u shkarkua',
        description: 'Fatura u ruajt në dosjen e shkarkimeve.'
      });
      return;
    }

    try {
      // Convert blob to base64 for native sharing
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Data = (reader.result as string).split(',')[1];
          
          // Save file temporarily
          const fileName = `fatura-${invoiceNumber}.pdf`;
          await Filesystem.writeFile({
            path: fileName,
            data: base64Data,
            directory: Directory.Cache,
          });

          // Get file URI for sharing
          const fileUri = await Filesystem.getUri({
            directory: Directory.Cache,
            path: fileName
          });

          // Share the file
          await Share.share({
            title: `Fatura #${invoiceNumber}`,
            text: `Fatura për shërbimin tuaj - ${invoiceNumber}`,
            url: fileUri.uri,
            dialogTitle: 'Ndaj faturën'
          });

          toast({
            title: 'Fatura u nda',
            description: 'Fatura u nda me sukses!'
          });

        } catch (error) {
          console.error('Error sharing file:', error);
          toast({
            title: 'Gabim në ndarje',
            description: 'Nuk mundëm të ndajmë faturën.',
            variant: 'destructive'
          });
        }
      };
      
      reader.readAsDataURL(pdfBlob);
    } catch (error) {
      console.error('Error preparing file for share:', error);
      toast({
        title: 'Gabim në përgatitje',
        description: 'Nuk mundëm të përgatisim faturën për ndarje.',
        variant: 'destructive'
      });
    }
  };

  // Save invoice to device storage
  const saveInvoiceToDevice = async (pdfBlob: Blob, invoiceNumber: string) => {
    if (!isNative) {
      // Web fallback - same as shareInvoice
      shareInvoice(pdfBlob, invoiceNumber);
      return;
    }

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Data = (reader.result as string).split(',')[1];
          const fileName = `fatura-${invoiceNumber}-${Date.now()}.pdf`;
          
          await Filesystem.writeFile({
            path: fileName,
            data: base64Data,
            directory: Directory.Documents,
          });

          toast({
            title: 'Fatura u ruajt',
            description: 'Fatura u ruajt në dosjen e dokumenteve.'
          });

        } catch (error) {
          console.error('Error saving file:', error);
          toast({
            title: 'Gabim në ruajtje',
            description: 'Nuk mundëm të ruajmë faturën.',
            variant: 'destructive'
          });
        }
      };
      
      reader.readAsDataURL(pdfBlob);
    } catch (error) {
      console.error('Error preparing file for save:', error);
      toast({
        title: 'Gabim në përgatitje',
        description: 'Nuk mundëm të përgatisim faturën për ruajtje.',
        variant: 'destructive'
      });
    }
  };

  // Share text content (for reports, summaries)
  const shareText = async (text: string, title: string) => {
    if (!isNative) {
      // Web fallback - copy to clipboard
      try {
        await navigator.clipboard.writeText(text);
        toast({
          title: 'U kopjua',
          description: 'Teksti u kopjua në clipboard.'
        });
      } catch (error) {
        toast({
          title: 'Gabim në kopjim',
          description: 'Nuk mundëm të kopjojmë tekstin.',
          variant: 'destructive'
        });
      }
      return;
    }

    try {
      await Share.share({
        title,
        text,
        dialogTitle: 'Ndaj raportin'
      });

      toast({
        title: 'Raporti u nda',
        description: 'Raporti u nda me sukses!'
      });
    } catch (error) {
      console.error('Error sharing text:', error);
      toast({
        title: 'Gabim në ndarje',
        description: 'Nuk mundëm të ndajmë raportin.',
        variant: 'destructive'
      });
    }
  };

  // Check if device supports native features
  const canShare = async () => {
    if (!isNative) return true; // Web always "supports" sharing via download
    
    try {
      return await Share.canShare();
    } catch {
      return false;
    }
  };

  return {
    isNative,
    shareInvoice,
    saveInvoiceToDevice,
    shareText,
    canShare
  };
}