import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Dimensions, Image, ImageBackground, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Card from './Card';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface MerchShopProps {
  userPercentile: number;
}

interface MerchItem {
  id: string;
  name: string;
  description: string;
  price: string;
  requiredPercentile: number;
  unlocked: boolean;
  featured?: boolean;
  femaleImage: any;
  maleImage?: any; // For future male model images
}

const apparelItems: MerchItem[] = [
  {
    id: 'elite-crop-top',
    name: 'Elite Crop Top',
    description: 'Premium workout crop top with rainbow gradient logo - Elite tier exclusive',
    price: '65',
    requiredPercentile: 75,
    unlocked: false,
    featured: true,
    femaleImage: require('@/assets/images/influencer.webp'),
    maleImage: require('@/assets/images/influencer.webp'), // Using same for now
  },
  {
    id: 'god-tier-crop-top',
    name: 'God Tier Crop Top',
    description: 'Ultimate exclusive crop top for the highest achievers - God tier only',
    price: '95',
    requiredPercentile: 90,
    unlocked: false,
    femaleImage: require('@/assets/images/influencer1.webp'),
    maleImage: require('@/assets/images/influencer1.webp'), // Using same for now
  },
];

export default function MerchShop({ userPercentile }: MerchShopProps) {
  const { currentTheme } = useTheme();
  const [selectedGender, setSelectedGender] = useState<'female' | 'male'>('female');
  const [fullScreenImage, setFullScreenImage] = useState<any>(null);
  const [fullScreenVisible, setFullScreenVisible] = useState(false);
  
  const getUnlockStatus = (requiredPercentile: number) => {
    return userPercentile >= requiredPercentile;
  };
  
  const itemsWithUnlockStatus = apparelItems.map(item => ({
    ...item,
    unlocked: getUnlockStatus(item.requiredPercentile)
  }));
    
  const unlockedCount = itemsWithUnlockStatus.filter(item => item.unlocked).length;
  const totalCount = itemsWithUnlockStatus.length;
  const featuredItem = itemsWithUnlockStatus.find(item => item.featured) || itemsWithUnlockStatus[0];

  const openFullScreen = (image: any) => {
    setFullScreenImage(image);
    setFullScreenVisible(true);
  };

  const closeFullScreen = () => {
    setFullScreenVisible(false);
    setFullScreenImage(null);
  };

  const renderGenderSelector = () => (
    <Card variant="subtle" style={styles.genderCard}>
      <Text style={[
        styles.genderTitle,
        { 
          color: currentTheme.colors.text,
          fontFamily: 'Raleway_600SemiBold',
        }
      ]}>
        Model View
      </Text>
      <View style={styles.genderButtons}>
        <TouchableOpacity
          style={[
            styles.genderButton,
            {
              backgroundColor: selectedGender === 'female' 
                ? currentTheme.colors.primary + '20' 
                : currentTheme.colors.surface,
              borderColor: selectedGender === 'female' 
                ? currentTheme.colors.primary 
                : currentTheme.colors.border,
            }
          ]}
          onPress={() => setSelectedGender('female')}
        >
          <Ionicons 
            name="woman-outline" 
            size={20} 
            color={selectedGender === 'female' ? currentTheme.colors.primary : currentTheme.colors.text + '70'} 
          />
          <Text style={[
            styles.genderButtonText,
            { 
              color: selectedGender === 'female' ? currentTheme.colors.primary : currentTheme.colors.text + '70',
              fontFamily: 'Raleway_500Medium',
            }
          ]}>
            Female
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.genderButton,
            {
              backgroundColor: selectedGender === 'male' 
                ? currentTheme.colors.primary + '20' 
                : currentTheme.colors.surface,
              borderColor: selectedGender === 'male' 
                ? currentTheme.colors.primary 
                : currentTheme.colors.border,
            }
          ]}
          onPress={() => setSelectedGender('male')}
        >
          <Ionicons 
            name="man-outline" 
            size={20} 
            color={selectedGender === 'male' ? currentTheme.colors.primary : currentTheme.colors.text + '70'} 
          />
          <Text style={[
            styles.genderButtonText,
            { 
              color: selectedGender === 'male' ? currentTheme.colors.primary : currentTheme.colors.text + '70',
              fontFamily: 'Raleway_500Medium',
            }
          ]}>
            Male
          </Text>
        </TouchableOpacity>
      </View>
    </Card>
  );

  const renderShopHeader = () => (
    <View style={styles.shopHeader}>
      <Text style={[
        styles.shopTitle,
        { 
          color: currentTheme.colors.text,
          fontFamily: 'Raleway_700Bold',
        }
      ]}>
        Morf Elite Collection
      </Text>
      <Text style={[
        styles.shopSubtitle,
        { 
          color: currentTheme.colors.text + '80',
          fontFamily: 'Raleway_400Regular',
        }
      ]}>
        Exclusive crop tops for top performers
      </Text>
    </View>
  );

  const renderProgressStats = () => (
    <Card variant="subtle" style={styles.progressCard}>
      <View style={styles.progressContent}>
        <View style={styles.progressInfo}>
          <Text style={[
            styles.progressTitle,
            { 
              color: currentTheme.colors.text,
              fontFamily: 'Raleway_600SemiBold',
            }
          ]}>
            Collection Progress
          </Text>
          <Text style={[
            styles.progressText,
            { 
              color: currentTheme.colors.text + '80',
              fontFamily: 'Raleway_500Medium',
            }
          ]}>
            {unlockedCount}/{totalCount} items unlocked
          </Text>
        </View>
        <View style={styles.progressBarContainer}>
          <View style={[styles.progressBarBackground, { backgroundColor: currentTheme.colors.border + '40' }]}>
            <View style={[
              styles.progressBarFill,
              { 
                width: `${(unlockedCount / totalCount) * 100}%`,
                backgroundColor: currentTheme.colors.primary 
              }
            ]} />
          </View>
        </View>
      </View>
    </Card>
  );

  const renderFeaturedProduct = () => {
    if (!featuredItem) return null;

    const currentImage = selectedGender === 'female' ? featuredItem.femaleImage : featuredItem.maleImage;

    return (
      <Card variant="elevated" style={styles.featuredCard}>
        <View style={styles.featuredHeader}>
          <Text style={[styles.featuredLabel, { color: currentTheme.colors.primary }]}>
            Featured Item
          </Text>
          {featuredItem.unlocked && (
            <View style={[styles.unlockedBadge, { backgroundColor: '#10B981' + '20' }]}>
              <Ionicons name="checkmark-circle" size={14} color="#10B981" />
              <Text style={[styles.unlockedText, { color: '#10B981' }]}>Unlocked</Text>
            </View>
          )}
        </View>
        
        <View style={styles.featuredContent}>
          <TouchableOpacity
            onPress={() => openFullScreen(currentImage)}
          >
            <ImageBackground
              source={currentImage}
              style={styles.featuredImageContainer}
              imageStyle={[
                styles.featuredBackgroundImage,
                !featuredItem.unlocked && { opacity: 0.3 }
              ]}
            >
              {/* Blur overlay for locked items */}
              {!featuredItem.unlocked && (
                <View style={styles.blurOverlay}>
                  <Ionicons name="lock-closed" size={24} color="white" />
                </View>
              )}
              
              {/* Expand icon for all items */}
              <View style={styles.expandIcon}>
                <Ionicons name="expand-outline" size={16} color="white" />
              </View>
            </ImageBackground>
          </TouchableOpacity>
          
          <View style={styles.featuredInfo}>
            <Text style={[
              styles.featuredName,
              { 
                color: featuredItem.unlocked ? currentTheme.colors.text : currentTheme.colors.text + '60',
                fontFamily: 'Raleway_700Bold',
              }
            ]}>
              {featuredItem.name}
            </Text>
            <Text style={[
              styles.featuredDescription,
              { 
                color: featuredItem.unlocked ? currentTheme.colors.text + '80' : currentTheme.colors.text + '50',
                fontFamily: 'Raleway_400Regular',
              }
            ]}>
              {featuredItem.description}
            </Text>
            
            <View style={styles.featuredFooter}>
              <View style={styles.featuredPriceSection}>
                <Text style={[
                  styles.priceLabel,
                  { 
                    color: currentTheme.colors.text + '60',
                    fontFamily: 'Raleway_400Regular',
                  }
                ]}>
                  Price
                </Text>
                <Text style={[
                  styles.featuredPrice,
                  { 
                    color: currentTheme.colors.primary,
                    fontFamily: 'Raleway_700Bold',
                  }
                ]}>
                  ${featuredItem.price}
                </Text>
                {!featuredItem.unlocked && (
                  <Text style={[
                    styles.unlockRequirement,
                    { 
                      color: currentTheme.colors.text + '60',
                      fontFamily: 'Raleway_400Regular',
                    }
                  ]}>
                    Unlock at {featuredItem.requiredPercentile}th percentile
                  </Text>
                )}
              </View>
              
              <TouchableOpacity
                style={[
                  styles.featuredButton,
                  {
                    backgroundColor: featuredItem.unlocked 
                      ? currentTheme.colors.primary 
                      : currentTheme.colors.surface,
                    borderColor: featuredItem.unlocked 
                      ? currentTheme.colors.primary 
                      : currentTheme.colors.border,
                  }
                ]}
                disabled={!featuredItem.unlocked}
              >
                <Text style={[
                  styles.featuredButtonText,
                  { 
                    color: featuredItem.unlocked 
                      ? currentTheme.colors.background 
                      : currentTheme.colors.text + '60',
                    fontFamily: 'Raleway_600SemiBold',
                  }
                ]}>
                  {featuredItem.unlocked ? 'Add to Cart' : 'Locked'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Card>
    );
  };

  const renderProductGrid = () => (
    <View style={styles.productGrid}>
      <Text style={[
        styles.gridTitle,
        { 
          color: currentTheme.colors.text,
          fontFamily: 'Raleway_600SemiBold',
        }
      ]}>
        All Items
      </Text>
      
      {itemsWithUnlockStatus.map((item) => {
        const currentImage = selectedGender === 'female' ? item.femaleImage : item.maleImage;
        
        return (
          <Card key={item.id} variant="clean" style={styles.productCard}>
            <TouchableOpacity
              onPress={() => openFullScreen(currentImage)}
            >
              <ImageBackground
                source={currentImage}
                style={styles.productImageContainer}
                imageStyle={[
                  styles.productBackgroundImage,
                  !item.unlocked && { opacity: 0.2 }
                ]}
              >
                {/* Blur overlay for locked items */}
                {!item.unlocked && (
                  <View style={styles.productBlurOverlay}>
                    <Ionicons name="lock-closed" size={16} color={currentTheme.colors.text + '60'} />
                  </View>
                )}
                
                {/* Expand icon for all items */}
                <View style={styles.productExpandIcon}>
                  <Ionicons name="expand-outline" size={12} color="white" />
                </View>
                
                {/* Unlock requirement badge */}
                {!item.unlocked && (
                  <View style={[styles.requirementBadge, { backgroundColor: currentTheme.colors.surface + 'E6' }]}>
                    <Text style={[
                      styles.requirementText,
                      { 
                        color: currentTheme.colors.text,
                        fontFamily: 'Raleway_500Medium',
                      }
                    ]}>
                      {item.requiredPercentile}th percentile
                    </Text>
                  </View>
                )}
              </ImageBackground>
            </TouchableOpacity>
            
            <View style={styles.productInfo}>
              <Text style={[
                styles.productName,
                { 
                  color: item.unlocked ? currentTheme.colors.text : currentTheme.colors.text + '60',
                  fontFamily: 'Raleway_600SemiBold',
                }
              ]}>
                {item.name}
              </Text>
              <Text style={[
                styles.productDescription,
                { 
                  color: item.unlocked ? currentTheme.colors.text + '70' : currentTheme.colors.text + '40',
                  fontFamily: 'Raleway_400Regular',
                }
              ]}>
                {item.description}
              </Text>
              
              <View style={styles.productFooter}>
                <Text style={[
                  styles.productPrice,
                  { 
                    color: item.unlocked ? currentTheme.colors.primary : currentTheme.colors.text + '40',
                    fontFamily: 'Raleway_700Bold',
                  }
                ]}>
                  ${item.price}
                </Text>
                
                {item.unlocked ? (
                  <TouchableOpacity style={[
                    styles.addToCartButton,
                    { backgroundColor: currentTheme.colors.primary }
                  ]}>
                    <Text style={[
                      styles.addToCartText,
                      { 
                        color: currentTheme.colors.background,
                        fontFamily: 'Raleway_500Medium',
                      }
                    ]}>
                      Add to Cart
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <View style={[
                    styles.lockedButton,
                    { 
                      backgroundColor: currentTheme.colors.surface,
                      borderColor: currentTheme.colors.border,
                    }
                  ]}>
                    <Text style={[
                      styles.lockedText,
                      { 
                        color: currentTheme.colors.text + '60',
                        fontFamily: 'Raleway_500Medium',
                      }
                    ]}>
                      Locked
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </Card>
        );
      })}
    </View>
  );

  const renderFullScreenModal = () => (
    <Modal visible={fullScreenVisible} transparent animationType="fade">
      <View style={styles.fullScreenContainer}>
        <TouchableOpacity style={styles.fullScreenBackground} onPress={closeFullScreen} />
        <View style={styles.fullScreenContent}>
          <TouchableOpacity style={styles.closeButton} onPress={closeFullScreen}>
            <Ionicons name="close" size={24} color="white" />
          </TouchableOpacity>
          {fullScreenImage && (
            <Image source={fullScreenImage} style={styles.fullScreenImage} resizeMode="contain" />
          )}
        </View>
      </View>
    </Modal>
  );

  return (
    <>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {renderShopHeader()}
        {renderProgressStats()}
        {renderGenderSelector()}
        {renderFeaturedProduct()}
        {renderProductGrid()}
        
        <Card variant="subtle" style={styles.comingSoonCard}>
          <View style={styles.comingSoonContent}>
            <Ionicons name="construct-outline" size={24} color={currentTheme.colors.text + '60'} />
            <Text style={[
              styles.comingSoonTitle,
              { 
                color: currentTheme.colors.text,
                fontFamily: 'Raleway_600SemiBold',
              }
            ]}>
              Real checkout coming soon!
            </Text>
            <Text style={[
              styles.comingSoonText,
              { 
                color: currentTheme.colors.text + '70',
                fontFamily: 'Raleway_400Regular',
              }
            ]}>
              For now, enjoy browsing and tracking your unlock progress. Full purchasing will be available in a future update.
            </Text>
          </View>
        </Card>
        
        <View style={{ height: 40 }} />
      </ScrollView>
      
      {renderFullScreenModal()}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  shopHeader: {
    marginBottom: 24,
    alignItems: 'center',
  },
  shopTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  shopSubtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
  genderCard: {
    marginBottom: 24,
  },
  genderTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  genderButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  genderButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  genderButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  progressCard: {
    marginBottom: 24,
  },
  progressContent: {
    gap: 12,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  progressText: {
    fontSize: 14,
    fontWeight: '500',
  },
  progressBarContainer: {
    marginTop: 4,
  },
  progressBarBackground: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  featuredCard: {
    marginBottom: 24,
    padding: 0,
    overflow: 'hidden',
  },
  featuredHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 12,
  },
  featuredLabel: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Raleway_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  unlockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  unlockedText: {
    fontSize: 10,
    fontWeight: '500',
    fontFamily: 'Raleway_500Medium',
  },
  featuredContent: {
    flexDirection: 'row',
    padding: 16,
    paddingTop: 0,
  },
  featuredImageContainer: {
    width: 100,
    height: 120,
    borderRadius: 12,
    marginRight: 16,
    overflow: 'hidden',
    justifyContent: 'flex-start',
    alignItems: 'center',
    position: 'relative',
  },
  featuredBackgroundImage: {
    borderRadius: 12,
    transform: [{ translateY: -20 }], // Show top half
  },
  blurOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  expandIcon: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featuredInfo: {
    flex: 1,
  },
  featuredName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  featuredDescription: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  featuredFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  featuredPriceSection: {
    alignItems: 'flex-start',
  },
  priceLabel: {
    fontSize: 10,
    marginBottom: 2,
  },
  featuredPrice: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  unlockRequirement: {
    fontSize: 10,
    marginTop: 2,
    fontStyle: 'italic',
  },
  featuredButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  featuredButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  gridTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
  productGrid: {
    gap: 16,
    marginBottom: 24,
  },
  productCard: {
    padding: 0,
    overflow: 'hidden',
  },
  productImageContainer: {
    height: 160,
    justifyContent: 'flex-start',
    alignItems: 'center',
    position: 'relative',
  },
  productBackgroundImage: {
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    transform: [{ translateY: -30 }], // Show top half
  },
  productBlurOverlay: {
    position: 'absolute',
    top: 12,
    left: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productExpandIcon: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  requirementBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  requirementText: {
    fontSize: 10,
    fontWeight: '500',
  },
  productInfo: {
    padding: 16,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  productDescription: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 12,
  },
  productFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  productPrice: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  addToCartButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  addToCartText: {
    fontSize: 12,
    fontWeight: '500',
  },
  lockedButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  lockedText: {
    fontSize: 12,
    fontWeight: '500',
  },
  fullScreenContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  fullScreenContent: {
    width: screenWidth * 0.9,
    height: screenHeight * 0.8,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: -40,
    right: 0,
    zIndex: 10,
    padding: 8,
  },
  fullScreenImage: {
    width: '100%',
    height: '100%',
  },
  comingSoonCard: {
    marginBottom: 20,
  },
  comingSoonContent: {
    alignItems: 'center',
    padding: 20,
  },
  comingSoonTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 8,
  },
  comingSoonText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
}); 