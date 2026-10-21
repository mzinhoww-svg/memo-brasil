import { Signature } from "./Signature";

/** Card de mesa A6 com QR. `qrSrc` é uma imagem (data URL) do QR da mesa. */
export function TableCard({ eyebrow, qrSrc, eventName, steps = "Aponte a câmera. Entre com seu nome. Poste o que só daqui dá para ver." }: { eyebrow: string; qrSrc: string; eventName: string; steps?: string }) {
  return (
    <div className="mm-card-mesa">
      <span className="mm-card-mesa-eyebrow">{eyebrow}</span>
      <span className="mm-card-mesa-titulo">Essa mesa também faz parte da história.</span>
      <div className="mm-card-mesa-qr">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="mm-qr" src={qrSrc} alt={`QR Code de ${eyebrow}`} width={112} height={112} />
        <span>{steps}</span>
      </div>
      <div className="mm-card-mesa-pe">
        <span className="mm-card-mesa-nome">{eventName}</span>
        <Signature />
      </div>
    </div>
  );
}
