import { useState } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

// Image-carousel + fullscreen state; mediaWidth is per-screen so it's passed in.
export function useImageCarousel(imageUrls: string[], mediaWidth: number) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showFullScreen, setShowFullScreen] = useState(false);
  const [fullScreenInitialIndex, setFullScreenInitialIndex] = useState(0);

  const handleImagePress = (index: number) => {
    setFullScreenInitialIndex(index);
    setShowFullScreen(true);
  };

  const handleImageScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / mediaWidth);
    if (index !== currentImageIndex && index >= 0 && index < imageUrls.length) {
      setCurrentImageIndex(index);
    }
  };

  return { currentImageIndex, showFullScreen, fullScreenInitialIndex, setShowFullScreen, handleImagePress, handleImageScroll };
}
