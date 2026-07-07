export const POSTURE_TIP_LABELS: Record<string, string> = {
  tip1: 'Keep your neck straight and pull your shoulders back.',
  tip2: 'Adjust your monitor to eye level.',
  tip3: 'Stretch every 30 minutes.',
  tip4: 'Sit with your back fully against the chair.',
  tip5: 'Keep your feet flat on the floor.',
  'motivation.excellent': 'Excellent! Keep up the good posture.',
  'motivation.good': "Good try! Let's pay a little more attention.",
  'motivation.bad': 'Consciously correct your posture and raise your score!'
};

export const postureTipLabel = (key: string): string => POSTURE_TIP_LABELS[key] ?? key;
