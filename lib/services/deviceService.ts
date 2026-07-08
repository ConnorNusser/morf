import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DEVICE_ID_KEY = 'device_id';
const USERNAME_KEY = 'username';

class DeviceService {
  private deviceId: string | null = null;
  private username: string | null = null;

  // Keychain (SecureStore) survives app reinstall; AsyncStorage is checked only
  // to migrate pre-Keychain users.
  async getDeviceId(): Promise<string> {
    if (this.deviceId) return this.deviceId;

    try {
      let id = await SecureStore.getItemAsync(DEVICE_ID_KEY);
      if (id) {
        this.deviceId = id;
        return id;
      }

      id = await AsyncStorage.getItem(DEVICE_ID_KEY);
      if (id) {
        await SecureStore.setItemAsync(DEVICE_ID_KEY, id); // migrate to Keychain
        this.deviceId = id;
        return id;
      }

      id = this.generateDeviceId();
      await SecureStore.setItemAsync(DEVICE_ID_KEY, id);
      this.deviceId = id;
      return id;
    } catch (error) {
      console.error('Error getting device ID:', error);
      return this.generateDeviceId(); // temporary id if storage fails
    }
  }

  private generateDeviceId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  async getUsername(): Promise<string | null> {
    if (this.username) return this.username;

    try {
      const username = await AsyncStorage.getItem(USERNAME_KEY);
      this.username = username;
      return username;
    } catch (error) {
      console.error('Error getting username:', error);
      return null;
    }
  }

  async setUsername(username: string): Promise<void> {
    try {
      await AsyncStorage.setItem(USERNAME_KEY, username);
      this.username = username;
    } catch (error) {
      console.error('Error setting username:', error);
    }
  }

  async generateDefaultUsername(): Promise<string> {
    const deviceId = await this.getDeviceId();
    return `user_${deviceId.substring(0, 8)}`;
  }
}

export const deviceService = new DeviceService();
