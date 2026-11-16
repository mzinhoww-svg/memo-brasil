"use client";

import { useParams } from "next/navigation";
import { AlbumView } from "@/features/revelados/AlbumView";

/** 19b · álbum impresso. */
export default function ReveladosAlbumPage() {
  const { id } = useParams<{ id: string }>();
  return <AlbumView id={id} />;
}
