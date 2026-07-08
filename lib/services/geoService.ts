import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

const COUNTRY_CODE_KEY = 'user_country_code';

export const getCountryFlag = (countryCode: string | null | undefined): string => {
  if (!countryCode || countryCode.length !== 2) return '';

  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));

  return String.fromCodePoint(...codePoints);
};

const COUNTRY_NAMES: Record<string, string> = {
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

  async setStoredCountryCode(countryCode: string): Promise<void> {
    try {
      await AsyncStorage.setItem(COUNTRY_CODE_KEY, countryCode);
      this.cachedCountryCode = countryCode;
    } catch (error) {
      console.error('Error storing country code:', error);
    }
  }

  async requestAndGetCountry(): Promise<string | null> {
    try {
      const stored = await this.getStoredCountryCode();
      if (stored) return stored;

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        return null;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Low, // low accuracy is fine for country detection
      });

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
}

export const geoService = new GeoService();
