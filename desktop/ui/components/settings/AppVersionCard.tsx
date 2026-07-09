import { getAppKind } from '@/lib/appRuntime';
import { APP_VERSION, appSurfaceLabel } from '@/lib/appVersion';

export default function AppVersionCard() {
  const kind = getAppKind();
  return (
    <section className="plugin-panel space-y-3">
      <h2 className="plugin-panel-title">App version</h2>
      <div className="space-y-1 text-sm">
        <p><span className="font-medium">Version:</span> {APP_VERSION}</p>
        <p className="plugin-muted">{appSurfaceLabel(kind)} — compare this number on desktop and phone to confirm both builds match.</p>
      </div>
    </section>
  );
}
