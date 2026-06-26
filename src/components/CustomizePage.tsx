import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import CustomizeStretchesPanel from '@/components/customize/CustomizeStretchesPanel';
import CustomizeExercisesPanel from '@/components/customize/CustomizeExercisesPanel';
import CustomizeFoodPanel from '@/components/customize/CustomizeFoodPanel';
import CustomizeHabitsPanel from '@/components/customize/CustomizeHabitsPanel';

export default function CustomizePage() {
  return (
    <Tabs defaultValue="exercises" className="mx-auto max-w-3xl">
      <TabsList className="mb-6 grid w-full grid-cols-4">
        <TabsTrigger value="exercises">Exercises</TabsTrigger>
        <TabsTrigger value="stretches">Stretches</TabsTrigger>
        <TabsTrigger value="habits">Habits</TabsTrigger>
        <TabsTrigger value="food">Food</TabsTrigger>
      </TabsList>
      <TabsContent value="exercises"><CustomizeExercisesPanel /></TabsContent>
      <TabsContent value="stretches"><CustomizeStretchesPanel /></TabsContent>
      <TabsContent value="habits"><CustomizeHabitsPanel /></TabsContent>
      <TabsContent value="food"><CustomizeFoodPanel /></TabsContent>
    </Tabs>
  );
}
