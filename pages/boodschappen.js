// Boodschappen is samengevoegd in de Lijsten-tool.
// Dit bestand zorgt dat oude links/bookmarks automatisch doorsturen.
import { useEffect } from "react";
import { useRouter } from "next/router";

export default function BoodschappenRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/lijsten"); }, []);
  return null;
}
