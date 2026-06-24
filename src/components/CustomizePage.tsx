import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import CustomizeExercisesPanel from '@/components/customize/CustomizeExercisesPanel';
import CustomizeFoodPanel from '@/components/customize/CustomizeFoodPanel';
import CustomizeHabitsPanel from '@/components/customize/CustomizeHabitsPanel';

export default function CustomizePage() {
  return (
    <Tabs defaultValue="exercises" className="mx-auto max-w-3xl">
      <TabsList className="mb-6 grid w-full grid-cols-3">
        <TabsTrigger value="exercises">Exercises</TabsTrigger>
        <TabsTrigger value="habits">Habits</TabsTrigger>
        <TabsTrigger value="food">Food</TabsTrigger>
      </TabsList>
      <TabsContent value="exercises"><CustomizeExercisesPanel /></TabsContent>
      <TabsContent value="habits"><CustomizeHabitsPanel /></TabsContent>
      <TabsContent value="food"><CustomizeFoodPanel /></TabsContent>
    </Tabs>
  );
}
