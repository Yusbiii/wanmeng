export interface IoTData {
  Suhu: number;
  Kelembapan: number;
  Relay1: boolean;
  Relay2: boolean;
  Relay3: boolean;
  Relay4: boolean;
}

export interface VoiceCommandLog {
  id: string;
  timestamp: string;
  text: string;
  detectedCommand: string;
  response: string;
  success: boolean;
}
