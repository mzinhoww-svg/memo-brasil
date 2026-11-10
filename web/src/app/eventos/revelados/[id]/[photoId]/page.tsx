"use client";

import { useParams } from "next/navigation";
import { PhotoView } from "@/features/revelados/PhotoView";

/** 19 · foto aberta. */
export default function ReveladosFotoPage() {
  const { id, photoId } = useParams<{ id: string; photoId: string }>();
  return <PhotoView id={id} photoId={photoId} />;
}
