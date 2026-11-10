"use client";
/* Convidado-camera.html (21): visor, contador, obturador e rolo. A tela 22 (disparo) é a mesma com o clarão. */
import { CameraFrame, type CameraFrameProps } from "./CameraFrame";

export type ConvidadoCameraProps = CameraFrameProps;

export function ConvidadoCamera(props: ConvidadoCameraProps = {}) {
  return <CameraFrame left={24} {...props} />;
}
