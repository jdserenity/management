import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import CustomizeStretchesPanel from '@/components/customize/CustomizeStretchesPanel';
import CustomizeExercisesPanel from '@/components/customize/CustomizeExercisesPanel';
import CustomizeMovementSnacksPanel from '@/components/customize/CustomizeMovementSnacksPanel';
import CustomizeFoodPanel from '@/components/customize/CustomizeFoodPanel';
import CustomizeHabitsPanel from '@/components/customize/CustomizeHabitsPanel';

export default function CustomizePage() {
  return (
    <div className="plugin-page">
      <Tabs defaultValue="exercises">
        <TabsList className="mb-4 grid w-full grid-cols-4">
          <TabsTrigger value="exercises">Exercises</TabsTrigger>
          <TabsTrigger value="stretches">Stretches</TabsTrigger>
          <TabsTrigger value="streaks">Streaks</TabsTrigger>
          <TabsTrigger value="tdee">TDEE</TabsTrigger>
        </TabsList>
        <TabsContent value="exercises" className="space-y-3">
          <CustomizeMovementSnacksPanel />
          <CustomizeExercisesPanel />
        </TabsContent>
        <TabsContent value="stretches"><CustomizeStretchesPanel /></TabsContent>
        <TabsContent value="streaks"><CustomizeHabitsPanel /></TabsContent>
        <TabsContent value="tdee"><CustomizeFoodPanel /></TabsContent>
      </Tabs>
    </div>
  );
}
