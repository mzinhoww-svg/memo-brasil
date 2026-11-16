"use client";
/* Convidado-flash.html (22): o disparo, com o clarão sobre o visor e uma pose a menos. */
import { CameraFrame, type CameraFrameProps } from "./CameraFrame";

export type ConvidadoFlashProps = CameraFrameProps;

export function ConvidadoFlash(props: ConvidadoFlashProps = {}) {
  return <CameraFrame left={23} flash {...props} />;
}
