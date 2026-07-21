import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import CustomizeStretchesPanel from '@/components/customize/CustomizeStretchesPanel';
import CustomizeExercisesPanel from '@/components/customize/CustomizeExercisesPanel';
import CustomizeMovementSnacksPanel from '@/components/customize/CustomizeMovementSnacksPanel';
import CustomizeFoodPanel from '@/components/customize/CustomizeFoodPanel';
import CustomizeHabitsPanel from '@/components/customize/CustomizeHabitsPanel';

export default function CustomizePage() {
  return (
    <div className="plugin-page">
      <Tabs defaultValue="tasks">
        <TabsList className="mb-4 grid w-full grid-cols-3">
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="body">Body</TabsTrigger>
          <TabsTrigger value="energy">Energy</TabsTrigger>
        </TabsList>
        <TabsContent value="tasks">
          <CustomizeHabitsPanel />
        </TabsContent>
        <TabsContent value="body" className="space-y-3">
          <CustomizeMovementSnacksPanel />
          <CustomizeExercisesPanel />
          <CustomizeStretchesPanel />
        </TabsContent>
        <TabsContent value="energy">
          <CustomizeFoodPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
