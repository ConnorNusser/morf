import { radius, space } from '@/lib/ui/tokens';
import { StyleSheet } from 'react-native';

// Card frame shared by a custom-exercise row and the inline add/edit form.
export const itemStyles = StyleSheet.create({
  exerciseItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: space.lg,
    marginBottom: space.md,
    borderRadius: radius.card,
    borderWidth: 1,
  },
  editingItem: {
    borderWidth: 2,
  },
});
