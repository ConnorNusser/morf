import { RefObject } from 'react';
import { View } from 'react-native';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';

export async function captureAndShare(viewRef: RefObject<ViewShot>): Promise<boolean> {
  try {
    if (!viewRef.current) {
      console.error('ViewShot ref is not available');
      return false;
    }

    // Capture the view as an image
    const uri = await viewRef.current.capture?.();

    if (!uri) {
      console.error('Failed to capture view');
      return false;
    }

    // Check if sharing is available
    const isAvailable = await Sharing.isAvailableAsync();

    if (!isAvailable) {
      console.error('Sharing is not available on this device');
      return false;
    }

    // Share the image
    await Sharing.shareAsync(uri, {
      mimeType: 'image/png',
      dialogTitle: 'Share your workout recap',
      UTI: 'public.png',
    });

    return true;
  } catch (error) {
    console.error('Error capturing and sharing:', error);
    return false;
  }
}

export async function captureToUri(viewRef: RefObject<ViewShot>): Promise<string | null> {
  try {
    if (!viewRef.current) {
      console.error('ViewShot ref is not available');
      return null;
    }

    const uri = await viewRef.current.capture?.();
    return uri || null;
  } catch (error) {
    console.error('Error capturing view:', error);
    return null;
  }
}
