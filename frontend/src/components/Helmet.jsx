import { useEffect } from "react";

const SUFFIX = "VFast By V-Mart";

export function Helmet({ title }) {
  useEffect(() => {
    document.title = title ? `${title} | ${SUFFIX}` : `${SUFFIX} | 10-Min Delivery`;
  }, [title]);
  return null;
}
