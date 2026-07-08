import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getAppKind } from '@/lib/appRuntime';
import { APP_VERSION, appSurfaceLabel } from '@/lib/appVersion';

export default function AppVersionCard() {
  const kind = getAppKind();
  return (
    <Card>
      <CardHeader><CardTitle>App version</CardTitle></CardHeader>
      <CardContent className="space-y-1 text-sm">
        <p><span className="font-medium">Version:</span> {APP_VERSION}</p>
        <p className="text-muted-foreground">{appSurfaceLabel(kind)} — compare this number on desktop and phone to confirm both builds match.</p>
      </CardContent>
    </Card>
  );
}
