import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

const COUNTRY_CODE_KEY = 'user_country_code';

// Country code to flag emoji mapping
export const getCountryFlag = (countryCode: string | null | undefined): string => {
  if (!countryCode || countryCode.length !== 2) return '';

  // Convert country code to flag emoji using regional indicator symbols
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));

  return String.fromCodePoint(...codePoints);
};

// Country code to country name mapping (common countries)
export const COUNTRY_NAMES: Record<string, string> = {
  'US': 'United States',
  'GB': 'United Kingdom',
  'CA': 'Canada',
  'AU': 'Australia',
  'DE': 'Germany',
  'FR': 'France',
  'ES': 'Spain',
  'IT': 'Italy',
  'JP': 'Japan',
  'KR': 'South Korea',
  'CN': 'China',
  'IN': 'India',
  'BR': 'Brazil',
  'MX': 'Mexico',
  'NL': 'Netherlands',
  'SE': 'Sweden',
  'NO': 'Norway',
  'DK': 'Denmark',
  'FI': 'Finland',
  'PL': 'Poland',
  'RU': 'Russia',
  'NZ': 'New Zealand',
  'IE': 'Ireland',
  'PT': 'Portugal',
  'AT': 'Austria',
  'CH': 'Switzerland',
  'BE': 'Belgium',
  'ZA': 'South Africa',
  'SG': 'Singapore',
  'HK': 'Hong Kong',
  'TW': 'Taiwan',
  'PH': 'Philippines',
  'ID': 'Indonesia',
  'MY': 'Malaysia',
  'TH': 'Thailand',
  'VN': 'Vietnam',
  'AE': 'UAE',
  'SA': 'Saudi Arabia',
  'IL': 'Israel',
  'TR': 'Turkey',
  'GR': 'Greece',
  'CZ': 'Czech Republic',
  'HU': 'Hungary',
  'RO': 'Romania',
  'UA': 'Ukraine',
  'AR': 'Argentina',
  'CL': 'Chile',
  'CO': 'Colombia',
  'PE': 'Peru',
};

export const getCountryName = (countryCode: string | null | undefined): string => {
  if (!countryCode) return 'Unknown';
  return COUNTRY_NAMES[countryCode.toUpperCase()] || countryCode.toUpperCase();
};

class GeoService {
  private cachedCountryCode: string | null = null;

  /**
   * Get stored country code from AsyncStorage
   */
  async getStoredCountryCode(): Promise<string | null> {
    if (this.cachedCountryCode) return this.cachedCountryCode;

    try {
      const code = await AsyncStorage.getItem(COUNTRY_CODE_KEY);
      if (code) {
        this.cachedCountryCode = code;
      }
      return code;
    } catch (error) {
      console.error('Error getting stored country code:', error);
      return null;
    }
  }

  /**
   * Store country code in AsyncStorage
   */
  async setStoredCountryCode(countryCode: string): Promise<void> {
    try {
      await AsyncStorage.setItem(COUNTRY_CODE_KEY, countryCode);
      this.cachedCountryCode = countryCode;
    } catch (error) {
      console.error('Error storing country code:', error);
    }
  }

  /**
   * Request location permission and get user's country
   */
  async requestAndGetCountry(): Promise<string | null> {
    try {
      // Check if we already have a stored country
      const stored = await this.getStoredCountryCode();
      if (stored) return stored;

      // Request permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        return null;
      }

      // Get current location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Low, // Low accuracy is fine for country detection
      });

      // Reverse geocode to get country
      const [geocode] = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      if (geocode?.isoCountryCode) {
        await this.setStoredCountryCode(geocode.isoCountryCode);
        return geocode.isoCountryCode;
      }

      return null;
    } catch (error) {
      console.error('Error getting country:', error);
      return null;
    }
  }

  /**
   * Get country code without requesting permission (uses stored value)
   */
  async getCountryCode(): Promise<string | null> {
    return this.getStoredCountryCode();
  }

  /**
   * Check if location permission is granted
   */
  async hasLocationPermission(): Promise<boolean> {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      return status === 'granted';
    } catch {
      return false;
    }
  }
}

export const geoService = new GeoService();
