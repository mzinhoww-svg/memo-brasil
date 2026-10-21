import QRCode from "qrcode";

/** QR como data URL PNG. Preto sobre branco, com margem de 2 módulos, para leitura em impressão A6. */
export async function qrDataUrl(text: string, width = 336, dark = "#1C1917"): Promise<string> {
  return QRCode.toDataURL(text, { width, margin: 2, errorCorrectionLevel: "M", color: { dark, light: "#FFFFFF" } });
}
