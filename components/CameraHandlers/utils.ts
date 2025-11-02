/**
 * Shared utility functions for camera file handling
 */

export const formatFileNumber = (value: string): string => {
  // Only allow numeric input
  const numericValue = value.replace(/[^0-9]/g, '');
  return numericValue;
};

export const formatFileNumberOnBlur = (value: string): string => {
  // Pad to 4 digits on blur
  const numericValue = value.replace(/[^0-9]/g, '');
  if (numericValue) {
    return numericValue.padStart(4, '0');
  }
  return '';
};

export const getPlaceholderText = (fieldId: string, fieldLabel: string): string => {
  // For camera and audio files, show "0001" as placeholder
  if (fieldId === 'soundFile' || fieldId.startsWith('cameraFile')) {
    return '0001';
  }
  return `Enter ${fieldLabel.toLowerCase()}`;
};

export const isNumberInRange = (number: number, fromValue: string, toValue: string): boolean => {
  const from = parseInt(fromValue) || 0;
  const to = parseInt(toValue) || 0;
  return number >= Math.min(from, to) && number <= Math.max(from, to);
};

export const getRangeFromData = (data: any, fieldId: string): { from: string; to: string } | null => {
  if (fieldId === 'soundFile') {
    const from = data['sound_from'];
    const to = data['sound_to'];
    if (from && to) return { from, to };
  } else if (fieldId.startsWith('cameraFile')) {
    const cameraNum = fieldId === 'cameraFile' ? 1 : parseInt(fieldId.replace('cameraFile', '')) || 1;
    const from = data[`camera${cameraNum}_from`];
    const to = data[`camera${cameraNum}_to`];
    if (from && to) return { from, to };
  }
  return null;
};

export const getHighestFileNumber = (fieldId: string, projectLogSheets: any[]): number => {
  let highestNum = 0;
  
  projectLogSheets.forEach(sheet => {
    if (sheet.data) {
      // Check single value format
      const singleValue = sheet.data[fieldId];
      if (singleValue && typeof singleValue === 'string') {
        // Handle inline range format like "004-008"
        if (singleValue.includes('-')) {
          const parts = singleValue.split('-');
          parts.forEach(part => {
            const num = parseInt(part.trim()) || 0;
            highestNum = Math.max(highestNum, num);
          });
        } else {
          const num = parseInt(singleValue) || 0;
          highestNum = Math.max(highestNum, num);
        }
      }
      
      // Check range format stored in separate fields
      if (fieldId === 'soundFile') {
        const soundFrom = sheet.data['sound_from'];
        const soundTo = sheet.data['sound_to'];
        if (soundFrom) {
          const fromNum = parseInt(soundFrom) || 0;
          highestNum = Math.max(highestNum, fromNum);
        }
        if (soundTo) {
          const toNum = parseInt(soundTo) || 0;
          highestNum = Math.max(highestNum, toNum);
        }
      } else if (fieldId.startsWith('cameraFile')) {
        const cameraNum = fieldId === 'cameraFile' ? 1 : parseInt(fieldId.replace('cameraFile', '')) || 1;
        const cameraFrom = sheet.data[`camera${cameraNum}_from`];
        const cameraTo = sheet.data[`camera${cameraNum}_to`];
        if (cameraFrom) {
          const fromNum = parseInt(cameraFrom) || 0;
          highestNum = Math.max(highestNum, fromNum);
        }
        if (cameraTo) {
          const toNum = parseInt(cameraTo) || 0;
          highestNum = Math.max(highestNum, toNum);
        }
      }
    }
  });
  
  return highestNum;
};

