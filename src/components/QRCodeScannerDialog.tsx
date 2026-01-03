"use client";

import { useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface QRCodeScannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScanSuccess: (decodedText: string) => void;
}

export default function QRCodeScannerDialog({ open, onOpenChange, onScanSuccess }: QRCodeScannerDialogProps) {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    if (open) {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(err => console.error("Failed to clear scanner before render", err));
      }

      const scanner = new Html5QrcodeScanner(
        "qr-reader",
        { fps: 10, qrbox: { width: 250, height: 250 }, supportedScanTypes: [] },
        false
      );
      scannerRef.current = scanner;

      const handleSuccess = (decodedText: string) => {
        onScanSuccess(decodedText);
        scanner.clear();
        onOpenChange(false);
      };
      
      const handleError = (error: any) => {
        // console.warn(`QR error = ${error}`);
      };

      scanner.render(handleSuccess, handleError);
    } else {
        if (scannerRef.current) {
          scannerRef.current.clear().catch(error => {
            // This can throw an error if the scanner is already cleared, which is fine.
          });
          scannerRef.current = null;
        }
    }

    // Cleanup on component unmount
    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(error => {
          // It might already be cleared, so we ignore errors here.
        });
      }
    };
  }, [open, onOpenChange, onScanSuccess]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Escanear Código QR</DialogTitle>
          <DialogDescription>Apunta la cámara al código QR de la guía.</DialogDescription>
        </DialogHeader>
        <div id="qr-reader" className="w-full [&>div>span>button]:hidden [&>div>span>a]:hidden"></div>
      </DialogContent>
    </Dialog>
  );
}
