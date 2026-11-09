import { Signature } from "./Signature";

/** Card de mesa A6 com QR. `qrSrc` é uma imagem (data URL) do QR da mesa. */
export function TableCard({ eyebrow, qrSrc, eventName, steps = "Aponte a câmera. Entre com seu nome. Poste o que só daqui dá para ver.", title = "Essa mesa também faz parte da história.", note }: { eyebrow: string; qrSrc: string; eventName: string; steps?: string; title?: string; note?: string }) {
  return (
    <div className="rv-card-mesa">
      <span className="rv-card-mesa-eyebrow">{eyebrow}</span>
      <span className="rv-card-mesa-titulo">{title}</span>
      <div className="rv-card-mesa-qr">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="rv-qr" src={qrSrc} alt={`QR Code de ${eyebrow}`} width={112} height={112} />
        <span>{steps}{note ? <><br />{note}</> : null}</span>
      </div>
      <div className="rv-card-mesa-pe">
        <span className="rv-card-mesa-nome">{eventName}</span>
        <Signature />
      </div>
    </div>
  );
}
