/**
 * ESP32 Firebase Bridge for TachanotBOT
 * 
 * This code runs on an ESP32 microcontroller and acts as a bridge between
 * the Altera DE10 FPGA board and Firebase Realtime Database.
 * 
 * Hardware Connections:
 * - ESP32 RX (GPIO 16) -> Altera DE10 TX
 * - ESP32 TX (GPIO 17) -> Altera DE10 RX
 * - ESP32 GND -> Altera DE10 GND
 * 
 * Communication Protocol:
 * - Baud Rate: 115200
 * - Commands from Web -> Firebase -> ESP32 -> Altera DE10
 * - Status from Altera DE10 -> ESP32 -> Firebase -> Web
 * 
 * Author: Shachar Berman & Yevgeni Vilkonsky
 * Date: November 2025
 */

#include <WiFi.h>
#include <Firebase_ESP_Client.h>
#include <addons/TokenHelper.h>
#include <addons/RTDBHelper.h>
#include <HardwareSerial.h>

// WiFi Credentials - CHANGE THESE TO YOUR NETWORK
#define WIFI_SSID "YOUR_WIFI_SSID"
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"

// Firebase Configuration
#define API_KEY "AIzaSyANfH2Y1hx1zFSFp4fTEJGk6lQnZY1SdFI"
#define DATABASE_URL "https://tachanotdb-default-rtdb.europe-west1.firebasedatabase.app"

// UART Configuration for Altera DE10 Communication
#define RXD2 16  // ESP32 RX pin (connect to DE10 TX)
#define TXD2 17  // ESP32 TX pin (connect to DE10 RX)
#define BAUD_RATE 115200

// Firebase objects
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

// UART Serial for DE10 communication
HardwareSerial DE10Serial(2); // UART2

// Connection status
bool signupOK = false;
unsigned long lastHeartbeat = 0;
const unsigned long HEARTBEAT_INTERVAL = 3000; // 3 seconds

// Current bot state
String currentStation = "red";
String targetStation = "";
String botState = "Ready";

// Station color mapping (matches the web interface)
const char* stations[] = {"red", "blue", "green", "yellow", "purple", "orange"};
const int stationCount = 6;

void setup() {
  // Initialize Serial for debugging
  Serial.begin(115200);
  Serial.println("\n\nTachanotBOT ESP32 Bridge Starting...");
  
  // Initialize UART2 for DE10 communication
  DE10Serial.begin(BAUD_RATE, SERIAL_8N1, RXD2, TXD2);
  Serial.println("UART2 initialized for Altera DE10 communication");
  
  // Connect to WiFi
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");
  
  while (WiFi.status() != WL_CONNECTED) {
    Serial.print(".");
    delay(300);
  }
  
  Serial.println();
  Serial.print("Connected! IP: ");
  Serial.println(WiFi.localIP());
  
  // Configure Firebase
  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;
  
  // Sign up (anonymous authentication)
  Serial.println("Signing up to Firebase...");
  if (Firebase.signUp(&config, &auth, "", "")) {
    Serial.println("Firebase signup successful!");
    signupOK = true;
  } else {
    Serial.printf("Firebase signup failed: %s\n", config.signer.signupError.message.c_str());
  }
  
  // Assign callback function for token generation
  config.token_status_callback = tokenStatusCallback;
  
  // Initialize Firebase
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);
  
  // Set connection status to true
  if (Firebase.ready() && signupOK) {
    Firebase.RTDB.setBool(&fbdo, "/bot/esp32/connected", true);
    Firebase.RTDB.setInt(&fbdo, "/bot/esp32/lastHeartbeat", millis());
    Serial.println("Connected to Firebase successfully!");
    
    // Initialize bot status if not exists
    initializeBotStatus();
  }
  
  Serial.println("ESP32 Bridge Ready!");
  Serial.println("Waiting for commands from Firebase or status from DE10...");
}

void loop() {
  // Check if Firebase is ready
  if (Firebase.ready() && signupOK) {
    
    // Send heartbeat every 3 seconds
    if (millis() - lastHeartbeat > HEARTBEAT_INTERVAL) {
      Firebase.RTDB.setInt(&fbdo, "/bot/esp32/lastHeartbeat", millis());
      lastHeartbeat = millis();
    }
    
    // Check for new commands from Firebase
    checkForCommands();
    
    // Check for manual control commands
    checkManualControl();
    
    // Check for status updates from Altera DE10
    checkDE10Status();
  }
  
  delay(100); // Small delay to prevent overwhelming the system
}

/**
 * Initialize bot status in Firebase if it doesn't exist
 */
void initializeBotStatus() {
  if (Firebase.RTDB.getString(&fbdo, "/bot/status/currentStation")) {
    currentStation = fbdo.stringData();
    Serial.print("Current station from Firebase: ");
    Serial.println(currentStation);
  } else {
    // Set default status
    Firebase.RTDB.setString(&fbdo, "/bot/status/currentStation", "red");
    Firebase.RTDB.setString(&fbdo, "/bot/status/state", "Ready");
    Firebase.RTDB.setInt(&fbdo, "/bot/status/lastUpdated", millis());
    currentStation = "red";
    Serial.println("Initialized default bot status");
  }
}

/**
 * Check for manual control commands from Firebase
 */
void checkManualControl() {
  static String lastCommand = "";
  static unsigned long lastCommandTime = 0;
  
  if (Firebase.RTDB.getString(&fbdo, "/bot/manualControl/command")) {
    String command = fbdo.stringData();
    unsigned long commandTime = 0;
    
    // Get the timestamp of the command
    if (Firebase.RTDB.getInt(&fbdo, "/bot/manualControl/timestamp")) {
      commandTime = fbdo.intData();
    }
    
    // Only process new commands (avoid repeating the same command)
    if (command.length() > 0 && (command != lastCommand || commandTime != lastCommandTime)) {
      lastCommand = command;
      lastCommandTime = commandTime;
      
      Serial.print("Manual control command received: ");
      Serial.println(command);
      
      // Send manual control command to Altera DE10
      sendManualControlToDE10(command);
    }
  }
}

/**
 * Send manual control command to Altera DE10 board via UART
 * 
 * Protocol: "MANUAL:<command>\n"
 * Commands: FORWARD, REVERSE, LEFT, RIGHT, STOP
 */
void sendManualControlToDE10(String command) {
  String uartCommand = "MANUAL:" + command + "\n";
  DE10Serial.print(uartCommand);
  
  Serial.print("Sent manual control to DE10: ");
  Serial.println(uartCommand);
  
  // Optional: Log manual command to Firebase
  String logPath = "/bot/manualLogs/" + String(millis());
  Firebase.RTDB.setString(&fbdo, logPath + "/command", command);
  Firebase.RTDB.setInt(&fbdo, logPath + "/timestamp", millis());
}

/**
 * Check for new commands from Firebase
 */
void checkForCommands() {
  // Listen for targetStation changes
  if (Firebase.RTDB.getString(&fbdo, "/bot/status/targetStation")) {
    String newTarget = fbdo.stringData();
    
    // If there's a new target and it's different from current
    if (newTarget.length() > 0 && newTarget != currentStation && newTarget != targetStation) {
      targetStation = newTarget;
      Serial.print("New command received! Target: ");
      Serial.println(targetStation);
      
      // Send command to Altera DE10
      sendCommandToDE10(targetStation);
      
      // Update status to "Moving"
      Firebase.RTDB.setString(&fbdo, "/bot/status/state", "Moving");
      botState = "Moving";
    }
  }
}

/**
 * Send movement command to Altera DE10 board via UART
 * 
 * Protocol: "GOTO:<station_id>\n"
 * Example: "GOTO:blue\n"
 */
void sendCommandToDE10(String station) {
  String command = "GOTO:" + station + "\n";
  DE10Serial.print(command);
  
  Serial.print("Sent to DE10: ");
  Serial.println(command);
  
  // Optional: Log command to Firebase
  String commandPath = "/bot/commands/" + String(millis());
  Firebase.RTDB.setString(&fbdo, commandPath + "/to", station);
  Firebase.RTDB.setString(&fbdo, commandPath + "/from", currentStation);
  Firebase.RTDB.setString(&fbdo, commandPath + "/status", "sent_to_de10");
  Firebase.RTDB.setInt(&fbdo, commandPath + "/timestamp", millis());
}

/**
 * Check for status updates from Altera DE10 via UART
 * 
 * Expected messages from DE10:
 * - "STATUS:READY\n" - Bot is ready and idle
 * - "STATUS:MOVING\n" - Bot is currently moving
 * - "STATUS:ARRIVED:<station_id>\n" - Bot arrived at station
 * - "STATUS:ERROR:<message>\n" - Error occurred
 * - "SENSOR:<data>\n" - Sensor data (optional)
 */
void checkDE10Status() {
  if (DE10Serial.available()) {
    String message = DE10Serial.readStringUntil('\n');
    message.trim();
    
    Serial.print("Received from DE10: ");
    Serial.println(message);
    
    // Parse the message
    if (message.startsWith("STATUS:")) {
      handleStatusUpdate(message.substring(7)); // Remove "STATUS:" prefix
    } 
    else if (message.startsWith("SENSOR:")) {
      handleSensorData(message.substring(7)); // Remove "SENSOR:" prefix
    }
    else {
      Serial.println("Unknown message format from DE10");
    }
  }
}

/**
 * Handle status updates from DE10
 */
void handleStatusUpdate(String status) {
  if (status == "READY") {
    botState = "Ready";
    Firebase.RTDB.setString(&fbdo, "/bot/status/state", "Ready");
    Serial.println("Bot is ready");
  }
  else if (status == "MOVING") {
    botState = "Moving";
    Firebase.RTDB.setString(&fbdo, "/bot/status/state", "Moving");
    Serial.println("Bot is moving");
  }
  else if (status.startsWith("ARRIVED:")) {
    String arrivedStation = status.substring(8);
    currentStation = arrivedStation;
    botState = "Ready";
    
    // Update Firebase
    Firebase.RTDB.setString(&fbdo, "/bot/status/currentStation", currentStation);
    Firebase.RTDB.setString(&fbdo, "/bot/status/state", "Ready");
    Firebase.RTDB.setString(&fbdo, "/bot/status/targetStation", ""); // Clear target
    Firebase.RTDB.setInt(&fbdo, "/bot/status/lastUpdated", millis());
    
    Serial.print("Bot arrived at: ");
    Serial.println(currentStation);
    
    targetStation = ""; // Clear target
  }
  else if (status.startsWith("ERROR:")) {
    String errorMsg = status.substring(6);
    botState = "Error";
    
    Firebase.RTDB.setString(&fbdo, "/bot/status/state", "Error");
    Firebase.RTDB.setString(&fbdo, "/bot/status/error", errorMsg);
    Firebase.RTDB.setInt(&fbdo, "/bot/status/lastUpdated", millis());
    
    Serial.print("Error from DE10: ");
    Serial.println(errorMsg);
  }
}

/**
 * Handle sensor data from DE10 (optional)
 */
void handleSensorData(String sensorData) {
  // Store sensor data in Firebase (optional feature)
  Firebase.RTDB.setString(&fbdo, "/bot/sensors/latest", sensorData);
  Firebase.RTDB.setInt(&fbdo, "/bot/sensors/timestamp", millis());
  
  Serial.print("Sensor data: ");
  Serial.println(sensorData);
}

/**
 * Token status callback (for debugging)
 */
void tokenStatusCallback(TokenInfo info) {
  Serial.printf("Token info: type = %s, status = %s\n", 
                getTokenType(info).c_str(), 
                getTokenStatus(info).c_str());
}
