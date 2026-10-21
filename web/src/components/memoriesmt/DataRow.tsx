export interface DataRowDef {
  key: string;
  name: string;
  kind?: string;
  value: string;
  alert?: boolean;
}

/** Lista de linhas com rótulo e valor. Valor em alerta sempre acompanha uma nota que diz o que fazer. */
export function DataList({ head, rows, note }: { head: [string, string]; rows: DataRowDef[]; note?: string }) {
  return (
    <div className="mm-list">
      <div className="mm-list-head"><span>{head[0]}</span><span>{head[1]}</span></div>
      {rows.map((r) => (
        <div key={r.key} className="mm-row">
          <span><strong>{r.name}</strong>{r.kind ? <> · {r.kind}</> : null}</span>
          <span className={r.alert ? "mm-row-valor mm-row-valor--alerta" : "mm-row-valor"}>{r.value}</span>
        </div>
      ))}
      {note && <div className="mm-list-nota">{note}</div>}
    </div>
  );
}
