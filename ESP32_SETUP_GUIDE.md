# ESP32 Firebase Bridge Setup Guide

## Overview
This ESP32 bridge connects your Altera DE10 FPGA board to Firebase Realtime Database, enabling real-time control and monitoring of TachanotBOT through the web interface.

## Hardware Requirements
- ESP32 Development Board (ESP32-WROOM or similar)
- Altera DE10-Lite/Standard FPGA Board
- USB Cable for ESP32 programming
- Jumper wires for UART connection

## Hardware Connections

### ESP32 to Altera DE10 UART Connection
```
ESP32 Pin          →  Altera DE10 Pin
─────────────────────────────────────
GPIO 16 (RX2)     →  TX Pin (GPIO_0 or UART TX)
GPIO 17 (TX2)     →  RX Pin (GPIO_1 or UART RX)
GND               →  GND
```

**Important:** Make sure both boards share a common ground (GND).

## Software Requirements

### Arduino IDE Setup
1. **Install Arduino IDE** (version 1.8.19 or later)
   - Download from: https://www.arduino.cc/en/software

2. **Add ESP32 Board Support**
   - Open Arduino IDE → File → Preferences
   - Add to "Additional Board Manager URLs":
     ```
     https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
     ```
   - Go to Tools → Board → Boards Manager
   - Search for "esp32" and install "ESP32 by Espressif Systems"

3. **Install Required Libraries**
   - Go to Sketch → Include Library → Manage Libraries
   - Install the following:
     - **Firebase ESP Client** by Mobizt (version 4.0.0 or later)
   
   Or via Library Manager, search and install:
   ```
   Firebase ESP Client
   ```

## Configuration

### 1. WiFi Configuration
Edit the ESP32 code and update your WiFi credentials:

```cpp
#define WIFI_SSID "YOUR_WIFI_SSID"
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"
```

### 2. Firebase Configuration
The Firebase credentials are already configured in the code:
- API Key: `AIzaSyANfH2Y1hx1zFSFp4fTEJGk6lQnZY1SdFI`
- Database URL: `https://tachanotdb-default-rtdb.europe-west1.firebasedatabase.app`

**Note:** For production use, consider implementing proper authentication instead of anonymous signup.

### 3. UART Configuration (Optional)
If you need to use different pins, modify:

```cpp
#define RXD2 16  // ESP32 RX pin
#define TXD2 17  // ESP32 TX pin
#define BAUD_RATE 115200  // Must match Altera DE10 baud rate
```

## Upload to ESP32

1. **Connect ESP32** to your computer via USB
2. **Select Board**: Tools → Board → ESP32 Arduino → ESP32 Dev Module
3. **Select Port**: Tools → Port → (select your ESP32 COM port)
4. **Upload Settings**:
   - Upload Speed: 921600
   - Flash Frequency: 80MHz
   - Flash Mode: QIO
   - Flash Size: 4MB
   - Partition Scheme: Default 4MB with spiffs

5. **Upload**: Click the Upload button (→) or Sketch → Upload

## Monitoring and Debugging

### Serial Monitor
Open Tools → Serial Monitor (115200 baud) to see:
- WiFi connection status
- Firebase connection status
- Commands sent to Altera DE10
- Status received from Altera DE10

### Expected Output
```
TachanotBOT ESP32 Bridge Starting...
UART2 initialized for Altera DE10 communication
Connecting to WiFi.....
Connected! IP: 192.168.1.100
Signing up to Firebase...
Firebase signup successful!
Connected to Firebase successfully!
ESP32 Bridge Ready!
Waiting for commands from Firebase or status from DE10...
```

## Communication Protocol

### Commands: Firebase → ESP32 → Altera DE10
Format: `GOTO:<station_id>\n`

Examples:
- `GOTO:red\n` - Go to Red Station
- `GOTO:blue\n` - Go to Blue Station
- `GOTO:green\n` - Go to Green Station

### Status: Altera DE10 → ESP32 → Firebase
Formats:
- `STATUS:READY\n` - Bot is ready
- `STATUS:MOVING\n` - Bot is moving
- `STATUS:ARRIVED:<station_id>\n` - Bot arrived at station
- `STATUS:ERROR:<message>\n` - Error occurred
- `SENSOR:<data>\n` - Sensor data (optional)

### Example Exchange
```
Web → Firebase → ESP32 → DE10: GOTO:blue\n
DE10 → ESP32 → Firebase → Web: STATUS:MOVING\n
DE10 → ESP32 → Firebase → Web: STATUS:ARRIVED:blue\n
```

## Altera DE10 UART Implementation

Your Altera DE10 FPGA code needs to implement UART communication. Here's a basic structure:

### Receiving Commands (UART RX)
```vhdl
-- When receiving "GOTO:blue\n", parse and execute movement
process(clk, reset)
begin
    if reset = '1' then
        -- Reset state
    elsif rising_edge(clk) then
        if uart_rx_valid = '1' then
            -- Parse command
            if command = "GOTO" then
                target_station <= parsed_station;
                start_movement <= '1';
            end if;
        end if;
    end if;
end process;
```

### Sending Status (UART TX)
```vhdl
-- Send status updates to ESP32
process(clk, reset)
begin
    if rising_edge(clk) then
        case current_state is
            when IDLE =>
                uart_tx_data <= "STATUS:READY\n";
                
            when MOVING =>
                uart_tx_data <= "STATUS:MOVING\n";
                
            when ARRIVED =>
                uart_tx_data <= "STATUS:ARRIVED:" & station_id & "\n";
                
            when ERROR =>
                uart_tx_data <= "STATUS:ERROR:message\n";
        end case;
    end if;
end process;
```

## Firebase Database Structure

The ESP32 bridge interacts with the following Firebase paths:

```
/bot
  /status
    currentStation: "red"
    targetStation: "blue"
    state: "Moving"
    lastUpdated: timestamp
    error: "error message" (if any)
    
  /esp32
    connected: true
    lastHeartbeat: timestamp
    
  /commands
    /{timestamp}
      from: "red"
      to: "blue"
      status: "sent_to_de10"
      timestamp: timestamp
      
  /sensors (optional)
    latest: "sensor data"
    timestamp: timestamp
```

## Troubleshooting

### ESP32 Won't Connect to WiFi
- Check WiFi credentials are correct
- Ensure WiFi network is 2.4GHz (ESP32 doesn't support 5GHz)
- Check WiFi signal strength

### Firebase Connection Failed
- Verify API key and database URL
- Check Firebase Realtime Database is enabled
- Ensure Firebase rules allow read/write access

### No Communication with Altera DE10
- Verify UART wiring (RX-TX crossed, GND connected)
- Check baud rate matches on both sides (115200)
- Use Serial Monitor to check if ESP32 is sending data
- Verify Altera DE10 UART is properly implemented

### Connection Status Shows "Disconnected"
- Wait 10 seconds for heartbeat to register
- Check Firebase connection in Serial Monitor
- Verify `/bot/esp32/connected` path in Firebase

## Testing

### Test 1: ESP32 to Firebase
1. Upload code and open Serial Monitor
2. Check Firebase Console → Realtime Database
3. Verify `/bot/esp32/connected` is `true`
4. Verify `/bot/esp32/lastHeartbeat` updates every 3 seconds

### Test 2: Web to ESP32
1. Open web control panel
2. Select a destination station
3. Click "Send Bot to Selected Station"
4. Check Serial Monitor - should show "New command received!"
5. Check Serial Monitor - should show "Sent to DE10: GOTO:xxx"

### Test 3: DE10 to Firebase
1. From Altera DE10, send via UART: `STATUS:READY\n`
2. Check Serial Monitor - should show "Received from DE10: STATUS:READY"
3. Check Firebase - `/bot/status/state` should be "Ready"

## LED Indicators (Optional)

You can add LED indicators on the ESP32:

```cpp
#define LED_WIFI 2      // Built-in LED
#define LED_FIREBASE 4  // External LED
#define LED_ACTIVITY 5  // External LED

void setup() {
    pinMode(LED_WIFI, OUTPUT);
    pinMode(LED_FIREBASE, OUTPUT);
    pinMode(LED_ACTIVITY, OUTPUT);
}

// In loop():
digitalWrite(LED_WIFI, WiFi.status() == WL_CONNECTED);
digitalWrite(LED_FIREBASE, Firebase.ready());
digitalWrite(LED_ACTIVITY, isReceiving || isSending);
```

## Support

For issues or questions:
- Check Serial Monitor output for error messages
- Review Firebase Console for data structure
- Ensure all hardware connections are secure
- Verify Altera DE10 UART implementation

## License

This code is part of the TachanotBOT project.
© 2025 Shachar Berman & Yevgeni Vilkonsky
