"use client";

import { useRef, useState, useCallback } from "react";

interface UseWebSerialOptions {
  onScan: (rfid: string, timestamp?: string, antenna?: string) => void;
  baudRate?: number;
}

// MC2100 serial protocol constants
const ACK = new Uint8Array([0x06]);
const LF = 0x0a;

function formatTimestamp(date: Date): string {
  const y = date.getUTCFullYear();
  const mo = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  const h = String(date.getUTCHours()).padStart(2, "0");
  const mi = String(date.getUTCMinutes()).padStart(2, "0");
  const s = String(date.getUTCSeconds()).padStart(2, "0");
  const ms = String(date.getUTCMilliseconds()).padStart(3, "0");
  return `${y}${mo}${d}${h}${mi}${s}${ms}`;
}

// Real MC2100: "4F7D5A06-3E-05.09.26 04:17:29.58-001"
// Legacy colon: "SN000/002:R500000672" or "SN000/003:0000026000/TLI200V3.01"
function parseMessage(message: string): { rfid: string; timestamp: string; antenna: string } | null {
  const firstToken = message.split("-")[0].trim();

  // Real MC2100: first token is 8-char hex RFID
  if (
    firstToken.length === 8 &&
    /^[0-9A-Fa-f]{8}$/.test(firstToken)
  ) {
    const rfid = firstToken.toUpperCase();
    let timestamp = formatTimestamp(new Date());
    let antenna = "";

    // "RFID-ANTENNA_HEX-DD.MM.YY HH:MM:SS.cs-seq"
    const parts = message.split("-", 3);
    if (parts.length === 3) {
      antenna = parts[1].trim();
      try {
        // strip sequence suffix: "DD.MM.YY HH:MM:SS.cs-seq" → take everything before last "-"
        const datepart = parts[2].lastIndexOf("-") > 0
          ? parts[2].substring(0, parts[2].lastIndexOf("-")).trim()
          : parts[2].trim();
        // datepart: "DD.MM.YY HH:MM:SS.cs"
        const csMatch = datepart.match(/\.(\d+)$/);
        const cs = csMatch ? parseInt(csMatch[1]) : 0;
        const withoutCs = datepart.replace(/\.\d+$/, ""); // "DD.MM.YY HH:MM:SS"
        // Parse as local time (scanner uses local clock)
        const [datePart, timePart] = withoutCs.split(" ");
        const [dd, mm, yy] = datePart.split(".");
        const [hh, min, ss] = timePart.split(":");
        const localDate = new Date(
          2000 + parseInt(yy),
          parseInt(mm) - 1,
          parseInt(dd),
          parseInt(hh),
          parseInt(min),
          parseInt(ss)
        );
        const ms = cs * 10; // centiseconds → ms
        localDate.setMilliseconds(ms);
        timestamp = formatTimestamp(localDate);
      } catch {
        // keep now() fallback
      }
    }

    return { rfid, timestamp, antenna };
  }

  // Legacy colon format: "antenna:candidate[/...]"
  if (message.includes(":")) {
    const colonParts = message.split(":", 2);
    const antenna = colonParts[0].trim();
    const candidate = colonParts[1].split("/")[0].trim();
    if (candidate && /^[0-9A-Za-z]+$/.test(candidate)) {
      return { rfid: candidate, timestamp: formatTimestamp(new Date()), antenna };
    }
  }

  return null;
}

export function useWebSerial({ onScan, baudRate = 38400 }: UseWebSerialOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const portRef = useRef<any>(null);
  const writerRef = useRef<WritableStreamDefaultWriter | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader | null>(null);
  const abortRef = useRef(false);

  const sendBytes = useCallback(async (bytes: Uint8Array) => {
    try { await writerRef.current?.write(bytes); } catch { /* ignore */ }
  }, []);

  const startup = useCallback(async (): Promise<boolean> => {
    for (let attempt = 0; attempt < 5; attempt++) {
      await sendBytes(new Uint8Array([0x4f])); // 'O'
      // Wait up to 2s for ACK
      const deadline = Date.now() + 2000;
      while (Date.now() < deadline) {
        if (abortRef.current) return false;
        await new Promise((r) => setTimeout(r, 50));
        // ACK is read in the main loop; we use a flag instead
        if ((portRef.current as any)?._ackReceived) {
          (portRef.current as any)._ackReceived = false;
          return true;
        }
      }
    }
    return false;
  }, [sendBytes]);

  const setTime = useCallback(async (): Promise<boolean> => {
    const now = new Date();
    const ts =
      now.getUTCFullYear().toString() +
      String(now.getUTCMonth() + 1).padStart(2, "0") +
      String(now.getUTCDate()).padStart(2, "0") +
      String(now.getUTCHours()).padStart(2, "0") +
      String(now.getUTCMinutes()).padStart(2, "0") +
      String(now.getUTCSeconds()).padStart(2, "0");
    const bytes = new TextEncoder().encode(ts + "\n");
    await sendBytes(bytes);
    // Wait up to 2s for ACK
    const deadline = Date.now() + 2000;
    while (Date.now() < deadline) {
      if (abortRef.current) return false;
      await new Promise((r) => setTimeout(r, 50));
      if ((portRef.current as any)?._ackReceived) {
        (portRef.current as any)._ackReceived = false;
        return true;
      }
    }
    return false;
  }, [sendBytes]);

  const connect = useCallback(async () => {
    if (!("serial" in navigator)) {
      setError("Web Serial not supported. Use Chrome or Edge.");
      return;
    }
    try {
      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate, dataBits: 8, stopBits: 1, parity: "none" });
      portRef.current = port;
      portRef.current._ackReceived = false;
      abortRef.current = false;
      setIsConnected(true);
      setError(null);

      // Set up writer for ACK/time commands
      const writer = port.writable.getWriter();
      writerRef.current = writer;

      // Raw byte reader for ACK detection + line parsing
      const reader: ReadableStreamDefaultReader<Uint8Array> = port.readable.getReader();
      readerRef.current = reader;

      // Run the read loop in background
      (async () => {
        let buffer: number[] = [];

        // Startup handshake
        await sendBytes(new Uint8Array([0x4f])); // 'O'

        try {
          while (!abortRef.current) {
            const { value, done } = await reader.read();
            if (done) break;

            for (const byte of value) {
              if (byte === ACK[0]) {
                // ACK from scanner — signal startup/time-set waiters
                portRef.current._ackReceived = true;
                continue;
              }

              if (byte === LF) {
                const line = new TextDecoder().decode(new Uint8Array(buffer)).trim();
                buffer = [];
                if (!line) continue;

                const parsed = parseMessage(line);
                if (parsed) {
                  // Send ACK back to scanner
                  await sendBytes(ACK);
                  onScan(parsed.rfid, parsed.timestamp, parsed.antenna);
                }
              } else {
                buffer.push(byte);
              }
            }
          }
        } catch (err: any) {
          if (!abortRef.current && err?.name !== "AbortError") {
            setError(err?.message ?? "Connection lost");
          }
        } finally {
          setIsConnected(false);
        }
      })();

      // After read loop started, complete handshake
      // Wait for startup ACK (up to 10s, 5 retries handled by loop above)
      let ackWait = 0;
      while (!portRef.current?._ackReceived && ackWait < 5000 && !abortRef.current) {
        await new Promise((r) => setTimeout(r, 100));
        ackWait += 100;
        // Retry 'O' every 2s
        if (ackWait % 2000 === 0) await sendBytes(new Uint8Array([0x4f]));
      }
      if (portRef.current?._ackReceived) {
        portRef.current._ackReceived = false;
        // Set scanner time
        const ts = new Date();
        const timeStr =
          ts.getUTCFullYear().toString() +
          String(ts.getUTCMonth() + 1).padStart(2, "0") +
          String(ts.getUTCDate()).padStart(2, "0") +
          String(ts.getUTCHours()).padStart(2, "0") +
          String(ts.getUTCMinutes()).padStart(2, "0") +
          String(ts.getUTCSeconds()).padStart(2, "0");
        await sendBytes(new TextEncoder().encode(timeStr + "\n"));
      }
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        setError(err?.message ?? "Connection failed");
      }
      setIsConnected(false);
    }
  }, [onScan, baudRate, sendBytes]);

  const disconnect = useCallback(async () => {
    abortRef.current = true;
    try { await readerRef.current?.cancel(); } catch {}
    try { writerRef.current?.releaseLock(); } catch {}
    try { await portRef.current?.close(); } catch {}
    portRef.current = null;
    readerRef.current = null;
    writerRef.current = null;
    setIsConnected(false);
  }, []);

  return { isConnected, error, connect, disconnect };
}
