import { useEffect, useState } from "react";

/** Full hash path (e.g. "director/projects/12/graph"), without the leading "#/". */
export function useHashPath(): string {
  const read = () =>
    (window.location.hash.replace(/^#\/?/, "") || "overview").split("?")[0]!;
  const [path, setPath] = useState(read);
  useEffect(() => {
    const onChange = () => setPath(read());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return path;
}
