"use client";

import { Square, Usb, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ScannerButtonsProps {
  pollActive: boolean;
  onStartPoll: () => void;
  onStopPoll: () => void;
  serialConnected: boolean;
  onConnectSerial: () => void;
  onDisconnectSerial: () => void;
  disabled?: boolean;
}

/** "Start Scanner" (poll) + "Web Serial" buttons. Only one input runs at a time. */
export function ScannerButtons({
  pollActive,
  onStartPoll,
  onStopPoll,
  serialConnected,
  onConnectSerial,
  onDisconnectSerial,
  disabled,
}: ScannerButtonsProps) {
  return (
    <>
      {pollActive ? (
        <Button size="sm" className="gap-1.5 bg-red-600 hover:bg-red-700" onClick={onStopPoll}>
          <Square className="h-4 w-4" />Stop Scanner
        </Button>
      ) : (
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          disabled={disabled}
          onClick={() => { onDisconnectSerial(); onStartPoll(); }}
        >
          <Wifi className="h-4 w-4" />Start Scanner
        </Button>
      )}
      <Button
        size="sm"
        variant={serialConnected ? "default" : "outline"}
        className="gap-1.5"
        disabled={disabled && !serialConnected}
        title="Web Serial (browser COM port, Chrome/Edge)"
        onClick={serialConnected ? onDisconnectSerial : () => { if (pollActive) onStopPoll(); onConnectSerial(); }}
      >
        <Usb className="h-4 w-4" />
        {serialConnected ? "Web Serial On" : "Web Serial"}
      </Button>
    </>
  );
}
