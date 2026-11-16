export function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <div className="rv-stat">
      <span className="rv-stat-num">{value}</span>
      <span className="rv-stat-label">{label}</span>
    </div>
  );
}
export function StatGrid({ children }: { children: React.ReactNode }) {
  return <div className="rv-stats">{children}</div>;
}
