import { radius, space } from '@/lib/ui/tokens';
import { StyleSheet } from 'react-native';

// The surface card + title row shared by every section card on the profile sheet.
export const cardStyles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    padding: space.lg,
    gap: space.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
