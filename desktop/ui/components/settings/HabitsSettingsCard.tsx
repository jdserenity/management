export default function HabitsSettingsCard() {
  return (
    <section className="plugin-panel space-y-3">
      <h2 className="plugin-panel-title">Habits</h2>
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <span className="font-medium">Unbroken chain calendar</span>
            <p className="text-sm plugin-muted">Each X marks a day when every task due that day was completed. Keep the chain going.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
