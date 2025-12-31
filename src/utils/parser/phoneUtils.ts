
export const cleanAndValidatePhone = (phone: string): string => {
  // Remove text labels that might be captured
  if (phone.toLowerCase().includes('mobile') || 
      phone.toLowerCase().includes('phone') || 
      phone.toLowerCase().includes('cell') || 
      phone.toLowerCase().includes('tel')) {
    return '';
  }

  // Clean the phone number
  const cleaned = phone
    .replace(/[^\d+]/g, '') // Remove all non-digit characters except +
    .replace(/^00/, '+'); // Replace leading 00 with +

  const digitCount = cleaned.replace(/\D/g, '').length;
  
  // Must have between 10 and 15 digits
  if (digitCount < 10 || digitCount > 15) {
    return '';
  }

  // Validation function
  const isValid = (number: string): boolean => {
    // Must start with + or digit
    if (!/^[+\d]/.test(number)) return false;
    
    // Can't have multiple + signs
    if ((number.match(/\+/g) || []).length > 1) return false;
    
    // If starts with +, must have country code
    if (number.startsWith('+') && !/^\+\d{1,3}/.test(number)) return false;
    
    // Can't be all zeros or all same digit
    if (/^(\d)\1+$/.test(number.replace(/\D/g, ''))) return false;
    
    return true;
  };

  // Format the number
  const formatNumber = (number: string): string => {
    const digits = number.replace(/\D/g, '');
    
    // For 10-digit Indian numbers
    if (digits.length === 10) {
      return `+91${digits}`;
    }
    
    // For international numbers
    if (digits.length > 10 && digits.length <= 15) {
      if (cleaned.startsWith('+')) {
        return cleaned;
      }
      return `+${digits}`;
    }
    
    return '';
  };

  if (isValid(cleaned)) {
    return formatNumber(cleaned);
  }
  
  return '';
};
