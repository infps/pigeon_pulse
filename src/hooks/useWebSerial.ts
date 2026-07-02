"use client";

import { useRef, useState, useCallback } from "react";

interface UseWebSerialOptions {
  onScan: (rfid: string) => void;
  baudRate?: number;
}

export function useWebSerial({ onScan, baudRate = 38400 }: UseWebSerialOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const portRef = useRef<any>(null);
  const readerRef = useRef<ReadableStreamDefaultReader | null>(null);
  const abortRef = useRef(false);

  const parseMessage = (message: string): string | null => {
    // MC2100 format: "ANTENNA:RINGNO" e.g. "SN000/002:R500000672"
    if (message.includes(":")) {
      const parts = message.split(":", 2);
      return parts[1]?.trim() || null;
    }
    // Legacy dash format: "RINGNO-TIMESTAMP-ANTENNA"
    const parts = message.split("-");
    if (parts.length >= 3) return parts[0].trim();
    return null;
  };

  const connect = useCallback(async () => {
    if (!("serial" in navigator)) {
      setError("Web Serial not supported. Use Chrome or Edge.");
      return;
    }
    try {
      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate, dataBits: 8, stopBits: 1, parity: "none" });
      portRef.current = port;
      abortRef.current = false;
      setIsConnected(true);
      setError(null);

      const decoder = new TextDecoderStream();
      port.readable.pipeTo(decoder.writable);
      const reader = decoder.readable.getReader();
      readerRef.current = reader;

      let buffer = "";
      while (!abortRef.current) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const msg = line.trim();
          if (!msg) continue;
          const rfid = parseMessage(msg);
          if (rfid) onScan(rfid);
        }
      }
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        setError(err?.message ?? "Connection failed");
      }
      setIsConnected(false);
    }
  }, [onScan, baudRate]);

  const disconnect = useCallback(async () => {
    abortRef.current = true;
    try { await readerRef.current?.cancel(); } catch {}
    try { await portRef.current?.close(); } catch {}
    portRef.current = null;
    readerRef.current = null;
    setIsConnected(false);
  }, []);

  return { isConnected, error, connect, disconnect };
}
