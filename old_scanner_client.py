#!/usr/bin/env python3
"""
PigeonPulse RFID Scanner Client
Handles authentication, bird entry, and race management with RFID scanning
"""

import serial
import time
import requests
import json
import asyncio
import websockets
from datetime import datetime
from typing import Optional, Dict, Any


# Configuration
API_BASE_URL = "https://pigeon-pulse.vercel.app"
WEBSOCKET_URL = "wss://ws.infps-demo.com/ws"
PORT = "COM8"  # Default fallback — overridden at startup prompt

# Serial Protocol Constants
ACK = b'\x06'
NAK = b'\x15'
LF = b'\x0A'


class RFIDScanner:
    """Handles communication with MC2100 RFID Scanner"""
    
    def __init__(self, port: str):
        self.port = port
        self.ser: Optional[serial.Serial] = None
        self.buffer = b""
    
    def connect(self) -> bool:
        """Connect to the RFID scanner"""
        try:
            self.ser = serial.Serial(
                port=self.port,
                baudrate=38400,
                bytesize=serial.EIGHTBITS,
                parity=serial.PARITY_NONE,
                stopbits=serial.STOPBITS_ONE,
                timeout=1
            )
            print("✅ Connected to MC2100 scanner")
            return True
        except Exception as e:
            print(f"❌ Failed to connect to scanner: {e}")
            return False
    
    def startup(self) -> bool:
        """Send startup command and wait for acknowledgment"""
        print("🔄 Sending startup command 'O'...")
        
        for attempt in range(5):
            self.ser.write(b'O')
            time.sleep(2)
            
            response = self.ser.read(1)
            if response == ACK:
                print("✅ Startup ACK received")
                return True
            
            print(f"⚠️  Startup attempt {attempt + 1} failed, retrying...")
        
        print("❌ Startup failed after 5 attempts")
        return False
    
    def set_time(self) -> bool:
        """Set the scanner's internal clock"""
        now = datetime.now().strftime("%Y%m%d%H%M%S")
        print(f"🕐 Setting time: {now}")
        
        self.ser.write(now.encode("ascii") + LF)
        
        response = self.ser.read(1)
        if response == ACK:
            print("✅ Time set successfully")
            return True
        else:
            print("❌ Time set failed (NAK)")
            return False
    
    def read_scan(self, timeout: float = 30.0) -> Optional[Dict[str, str]]:
        """
        Read RFID scan from scanner
        Returns dict with ring_no, timestamp, antenna or None
        """
        start_time = time.time()
        
        while time.time() - start_time < timeout:
            data = self.ser.read(64)
            if not data:
                continue
            
            self.buffer += data
            
            while LF in self.buffer:
                line, self.buffer = self.buffer.split(LF, 1)
                message = line.decode("ascii", errors="ignore").strip()
                
                if not message:
                    continue
                
                print(f"📡 RX: {message}")

                # MC2100 format: "ANTENNA:RINGNO" e.g. "SN000/002:R500000672"
                # Fallback: legacy dash-separated "RINGNO-TIMESTAMP-ANTENNA"
                ring_no = None
                timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
                antenna = ""

                if ":" in message:
                    colon_parts = message.split(":", 1)
                    antenna = colon_parts[0].strip()
                    ring_no = colon_parts[1].strip()
                else:
                    dash_parts = message.split("-")
                    if len(dash_parts) >= 3:
                        ring_no = dash_parts[0]
                        timestamp = dash_parts[1]
                        antenna = dash_parts[2]

                if ring_no:
                    self.ser.write(ACK)
                    print(f"   Ring: {ring_no} | Antenna: {antenna}")
                    return {
                        "ring_no": ring_no,
                        "timestamp": timestamp,
                        "antenna": antenna
                    }
        
        return None
    
    def close(self):
        """Close serial connection"""
        if self.ser:
            self.ser.close()
            print("🔌 Scanner connection closed")


class PigeonPulseClient:
    """Handles authentication and API communication"""
    
    def __init__(self, base_url: str):
        self.base_url = base_url
        self.session = requests.Session()
        self.token: Optional[str] = None
        self.user: Optional[Dict[str, Any]] = None
    
    def login(self, email: str, password: str) -> bool:
        """Authenticate with the API"""
        try:
            print(f"\n🔐 Authenticating as {email}...")
            
            response = self.session.post(
                f"{self.base_url}/api/auth/sign-in/email",
                json={
                    "email": email,
                    "password": password
                },
                headers={
                    "Content-Type": "application/json"
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                self.token = data.get("token")
                self.user = data.get("user")
                role = self.user.get("role", "UNKNOWN")
                print(f"✅ Authentication successful! Welcome, {self.user.get('name', 'User')} [{role}]")
                if not self.token:
                    print("⚠️  No token returned — authenticated API calls may fail")
                if role not in ("ADMIN", "SUPERADMIN"):
                    print(f"⚠️  Role is {role} — race scan endpoint requires ADMIN or SUPERADMIN")
                return True
            else:
                print(f"❌ Authentication failed: {response.status_code}")
                print(f"Response: {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Authentication error: {e}")
            return False

    def submit_race_arrival(self, race_id: str, ring_no: str, timestamp: str, antenna: str) -> dict:
        """Submit arrival scan to POST /api/admin/race/{raceId}/scan"""
        url = f"{self.base_url}/api/admin/race/{race_id}/scan"
        headers = {"Authorization": f"Bearer {self.token}"} if self.token else {}
        try:
            resp = self.session.post(
                url,
                json={"ringNo": ring_no, "timestamp": timestamp, "antenna": antenna},
                headers=headers,
                timeout=10,
            )
            data = resp.json()
            if resp.ok:
                scan_type = data.get("scanType", "")
                position = data.get("birdPosition")
                bird = data.get("raceItem", {}).get("inventoryItem", {}).get("bird", {})
                name = bird.get("birdName") or ring_no
                if scan_type == "arrival" and position:
                    print(f"   ✅ Arrival recorded — {name} | Position #{position}")
                elif scan_type == "loft":
                    print(f"   ✅ Loft basket scan — {name}")
                elif data.get("isNewScan") is False:
                    print(f"   ℹ️  Already recorded: {data.get('message')}")
                else:
                    print(f"   ✅ {data.get('message')}")
            else:
                print(f"   ❌ API {resp.status_code}: {data.get('message')} (ringNo={ring_no}, raceId={race_id})")
            return data
        except Exception as e:
            print(f"   ⚠️  Submit error (non-fatal): {e}")
            return {}

    def push_scan(self, rfid_tag: str, scanner_id: str = "python-mc2100"):
        """Push parsed RFID to web /api/scanner/push (for poll bridge)"""
        try:
            url = f"{self.base_url}/api/scanner/push"
            resp = self.session.post(
                url,
                json={"rfidTag": rfid_tag, "scannerId": scanner_id},
                timeout=5
            )
            if resp.ok:
                print("📤 Pushed to /api/scanner/push")
            else:
                print(f"❌ Push failed: {resp.status_code} — {resp.text[:200]}")
        except Exception as e:
            print(f"❌ Push error: {e}")


class WebSocketClient:
    """Handles WebSocket connection for real-time updates"""
    
    def __init__(self, ws_url: str, client_id: str = "scanner-1"):
        self.ws_url = ws_url
        self.client_id = client_id
        self.ws = None
        self.connected = False
        self.current_channel: Optional[str] = None
    
    async def connect(self):
        """Connect to WebSocket server"""
        try:
            # Add client type and ID to URL
            url = f"{self.ws_url}?type=scanner&id={self.client_id}"
            
            self.ws = await websockets.connect(url)
            self.connected = True
            print("✅ Connected to WebSocket server")
            
            # Wait for welcome message
            try:
                welcome = await asyncio.wait_for(self.ws.recv(), timeout=5.0)
                data = json.loads(welcome)
                if data.get("type") == "connected":
                    print(f"   Client ID: {data.get('clientId')}")
                    print(f"   Message: {data.get('message')}")
            except asyncio.TimeoutError:
                print("⚠️  No welcome message received")
            
            return True
        except Exception as e:
            print(f"❌ WebSocket connection failed: {e}")
            self.connected = False
            return False
    
    async def subscribe(self, bird_id: str):
        """Subscribe to a bird's channel"""
        if not self.ws or not self.connected:
            print("⚠️  Not connected to WebSocket server")
            return False
        
        try:
            channel = f"bird:{bird_id}"
            message = {
                "type": "subscribe",
                "channel": channel
            }
            
            await self.ws.send(json.dumps(message))
            print(f"📡 Subscribing to channel: {channel}")
            
            # Wait for confirmation
            try:
                response = await asyncio.wait_for(self.ws.recv(), timeout=5.0)
                data = json.loads(response)
                if data.get("type") == "subscribed":
                    self.current_channel = channel
                    print(f"✅ Subscribed to channel: {data.get('channel')}")
                    return True
            except asyncio.TimeoutError:
                print("⚠️  Subscription confirmation timeout")
                
            return False
        except Exception as e:
            print(f"❌ Failed to subscribe: {e}")
            return False
    
    async def send_scan(self, bird_id: str, scan_data: Dict[str, Any]):
        """Send scan data through WebSocket"""
        if not self.ws or not self.connected:
            print("⚠️  Not connected to WebSocket server")
            return False
        
        try:
            message = {
                "type": "scan",
                "birdId": bird_id,
                "ringNo": scan_data["ring_no"]
            }
            
            await self.ws.send(json.dumps(message))
            print("📤 Scan data sent via WebSocket")
            
            # Wait for acknowledgment
            try:
                response = await asyncio.wait_for(self.ws.recv(), timeout=5.0)
                data = json.loads(response)
                if data.get("type") == "scan_ack":
                    print(f"✅ Scan acknowledged - published to {data.get('published')} clients")
                    return True
            except asyncio.TimeoutError:
                print("⚠️  Acknowledgment timeout")
            
            return True
        except Exception as e:
            print(f"❌ Failed to send via WebSocket: {e}")
            return False
    
    async def close(self):
        """Close WebSocket connection"""
        if self.ws:
            try:
                await self.ws.close()
                self.connected = False
                print("🔌 WebSocket connection closed")
            except Exception as e:
                print(f"⚠️  Error closing WebSocket: {e}")


def clear_screen():
    """Clear the terminal screen"""
    import os
    os.system('cls' if os.name == 'nt' else 'clear')


def print_header():
    """Print application header"""
    print("=" * 60)
    print("🐦 PigeonPulse RFID Scanner Client")
    print("=" * 60)
    print()


def get_port() -> str:
    """Prompt user for COM port with default"""
    try:
        from serial.tools.list_ports import comports
        ports = [p.device for p in comports()]
    except Exception:
        ports = []
    if ports:
        print("\n📡 Available ports: " + ", ".join(ports))
    default = ports[0] if ports else PORT
    entered = input(f"Serial port [{default}]: ").strip()
    return entered if entered else default


def get_credentials() -> tuple[str, str]:
    """Get email and password from user"""
    print("\n📝 Login Required\n")
    email = input("Email: ").strip()
    password = input("Password: ").strip()
    return email, password


def show_main_menu() -> str:
    """Display main menu and get user choice"""
    print("\n" + "=" * 60)
    print("Main Menu")
    print("=" * 60)
    print("1. Bird Entry Mode")
    print("2. Race Mode")
    print("3. Logout")
    print("4. Exit")
    print("=" * 60)
    
    choice = input("\nSelect option (1-4): ").strip()
    return choice


def bird_entry_mode(scanner: RFIDScanner, client: PigeonPulseClient):
    """Handle bird entry mode"""
    print("\n" + "=" * 60)
    print("🐦 Bird Entry Mode")
    print("=" * 60)
    
    bird_id = input("\nEnter Bird ID: ").strip()
    
    if not bird_id:
        print("❌ Bird ID is required!")
        return
    
    print(f"\n✅ Bird ID: {bird_id}")
    
    # Connect to WebSocket and subscribe to channel
    async def handle_scan_with_ws():
        ws_client = WebSocketClient(WEBSOCKET_URL)
        
        # Connect to WebSocket
        if await ws_client.connect():
            # Subscribe to bird's channel
            await ws_client.subscribe(bird_id)
        else:
            print("⚠️  Continuing without WebSocket connection")
        
        print("\n⏳ Waiting for RFID scan... (30 seconds timeout)")
        print("Place the pigeon near the antenna...\n")
        
        # Read scan in a thread to avoid blocking
        scan_data = scanner.read_scan(timeout=30.0)
        
        if scan_data:
            print(f"\n✨ SCAN DETECTED!")
            print(f"   Ring Number: {scan_data['ring_no']}")
            
            # Push for web poll path (dual button support)
            client.push_scan(scan_data["ring_no"])

            # Send via WebSocket (existing)
            if ws_client.connected:
                print("\n📡 Broadcasting via WebSocket...")
                await ws_client.send_scan(bird_id, scan_data)
            else:
                print("\n⚠️  Not connected to WebSocket - scan data not sent")
        else:
            print("\n⚠️  Scan timeout - no RFID detected")
        
        # Close WebSocket
        await ws_client.close()
    
    # Run async code
    asyncio.run(handle_scan_with_ws())
    
    input("\nPress Enter to continue...")


def race_mode(scanner: RFIDScanner, client: PigeonPulseClient):
    """Handle race mode"""
    print("\n" + "=" * 60)
    print("🏁 Race Mode")
    print("=" * 60)
    
    race_id = input("\nEnter Race ID: ").strip()
    
    if not race_id:
        print("❌ Race ID is required!")
        return
    
    print(f"\n✅ Race ID: {race_id}")
    print("\n🔴 LIVE SCANNING MODE - Press Ctrl+C to stop")
    print("Waiting for pigeon arrivals...\n")
    
    async def race_loop():
        ws_client = WebSocketClient(WEBSOCKET_URL)
        ws_ok = await ws_client.connect()
        if not ws_ok:
            print("⚠️  WebSocket unavailable — continuing without broadcast")

        try:
            while True:
                scan_data = scanner.read_scan(timeout=5.0)

                if scan_data:
                    ring_no = scan_data["ring_no"]
                    timestamp = scan_data["timestamp"]
                    antenna = scan_data["antenna"]

                    print(f"\n📍 ARRIVAL DETECTED!")
                    print(f"   Ring: {ring_no} | Time: {timestamp} | Antenna: {antenna}")

                    # Push for web poll path
                    client.push_scan(ring_no)

                    # Submit to API
                    result = client.submit_race_arrival(race_id, ring_no, timestamp, antenna)

                    # Broadcast via WebSocket
                    if ws_ok and ws_client.connected:
                        try:
                            msg = {
                                "type": "arrival",
                                "raceId": race_id,
                                "ringNo": ring_no,
                                "timestamp": timestamp,
                                "birdPosition": result.get("birdPosition"),
                                "message": result.get("message", ""),
                            }
                            await ws_client.ws.send(json.dumps(msg))
                            print("   📡 Broadcasted via WebSocket")
                        except Exception as e:
                            print(f"   ⚠️  WS broadcast error: {e}")

        except KeyboardInterrupt:
            pass
        finally:
            await ws_client.close()

    try:
        asyncio.run(race_loop())
    except KeyboardInterrupt:
        pass

    print("\n\n⏸️  Race mode stopped")
    
    input("\nPress Enter to continue...")


def main():
    """Main application entry point"""
    clear_screen()
    print_header()
    
    # Get credentials
    email, password = get_credentials()
    
    # Initialize client
    client = PigeonPulseClient(API_BASE_URL)
    
    # Authenticate
    if not client.login(email, password):
        print("\n❌ Authentication failed. Exiting...")
        return
    
    # Initialize scanner
    port = get_port()
    scanner = RFIDScanner(port)
    
    if not scanner.connect():
        print("\n❌ Scanner connection failed. Exiting...")
        return
    
    if not scanner.startup():
        scanner.close()
        print("\n❌ Scanner startup failed. Exiting...")
        return
    
    if not scanner.set_time():
        scanner.close()
        print("\n❌ Failed to set scanner time. Exiting...")
        return
    
    # Main application loop
    try:
        while True:
            clear_screen()
            print_header()
            print(f"Logged in as: {client.user.get('email', 'Unknown')}")
            
            choice = show_main_menu()
            
            if choice == "1":
                bird_entry_mode(scanner, client)
            elif choice == "2":
                race_mode(scanner, client)
            elif choice == "3":
                print("\n👋 Logging out...")
                client.token = None
                client.user = None
                email, password = get_credentials()
                if not client.login(email, password):
                    print("\n❌ Authentication failed. Exiting...")
                    break
            elif choice == "4":
                print("\n👋 Goodbye!")
                break
            else:
                print("\n❌ Invalid option. Please select 1-4.")
                time.sleep(2)
    
    except KeyboardInterrupt:
        print("\n\n⚠️  Application interrupted by user")
    
    finally:
        scanner.close()
        print("\n✅ Application closed")


if __name__ == "__main__":
    main()
