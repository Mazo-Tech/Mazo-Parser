
export type SkillResult = 'Select' | 'Hold' | 'Reject';

export const getSkillColor = (skillResult: SkillResult) => {
  switch (skillResult) {
    case 'Select':
      return { 
        tailwind: 'text-green-600',
        hex: '008000' // Excel green
      };
    case 'Hold':
      return { 
        tailwind: 'text-orange-500',
        hex: 'FFA500' // Excel orange/yellow
      };
    case 'Reject':
      return { 
        tailwind: 'text-red-600',
        hex: 'FF0000' // Excel red
      };
    default:
      return { 
        tailwind: 'text-gray-500',
        hex: '000000' // Black
      };
  }
};

export const getSkillResult = (percentage: number): SkillResult => {
  if (percentage <= 40) return 'Reject';
  if (percentage <= 60) return 'Hold';
  return 'Select';
};
