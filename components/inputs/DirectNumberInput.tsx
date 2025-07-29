import React, { useState } from 'react';
import CustomNumberKeyboard from './CustomNumberKeyboard';

interface DirectNumberInputProps {
  visible: boolean;
  value: string | number;
  onClose: () => void;
  onChange: (value: string) => void;
  title: string;
  allowRange?: boolean;
  maxLength?: number;
}

export default function DirectNumberInput({
  visible,
  value,
  onClose,
  onChange,
  title,
  allowRange = false,
  maxLength = allowRange ? 5 : 3,
}: DirectNumberInputProps) {
  const [tempValue, setTempValue] = useState(value.toString());

  const handleValueChange = (val: string) => {
    // For range mode, just limit the total length and let CustomNumberKeyboard handle the logic
    if (allowRange) {
      setTempValue(val.substring(0, 5)); // Max 5 chars: "12-34"
    } else {
      setTempValue(val.substring(0, maxLength));
    }
  };

  const handleDone = () => {
    let finalValue = tempValue;
    
    // Basic validation for range
    if (allowRange && finalValue.includes('-')) {
      const parts = finalValue.split('-');
      if (parts.length === 2 && parts[0] && parts[1]) {
        const first = parseInt(parts[0]);
        const second = parseInt(parts[1]);
        if (first >= second) {
          // If first >= second, just use the first number
          finalValue = parts[0];
        }
      }
    }
    
    onChange(finalValue);
    onClose();
  };

  const handleCancel = () => {
    setTempValue(value.toString());
    onClose();
  };

  // Reset temp value when modal opens
  React.useEffect(() => {
    if (visible) {
      setTempValue(value.toString());
    }
  }, [visible, value]);

  return (
    <CustomNumberKeyboard
      visible={visible}
      value={tempValue}
      onValueChange={handleValueChange}
      onDone={handleDone}
      onCancel={handleCancel}
      title={title}
      placeholder={allowRange ? "e.g. 8 - 12" : "0"}
      allowDecimal={false}
      allowRange={allowRange}
      maxLength={maxLength}
    />
  );
} 