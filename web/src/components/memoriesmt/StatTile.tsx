export function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <div className="mm-stat">
      <span className="mm-stat-num">{value}</span>
      <span className="mm-stat-label">{label}</span>
    </div>
  );
}
export function StatGrid({ children }: { children: React.ReactNode }) {
  return <div className="mm-stats">{children}</div>;
}
