const isMobileDevice = () => {
  if (typeof window === "undefined") return false;

  const userAgent = navigator.userAgent.toLowerCase();
  const isMobileUserAgent = /android|iphone|ipad|ipod|windows phone|mobile/.test(userAgent);
  const isMobileUserAgentData = navigator.userAgentData?.mobile ?? false;
  const isCoarsePointer = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  const isNarrowViewport = window.matchMedia?.("(max-width: 768px)").matches ?? false;

  return isMobileUserAgent || isMobileUserAgentData || (isCoarsePointer && isNarrowViewport);
};

export const enforceDesktopOnly = (targetPath = "/mobile") => {
  if (window.location.pathname.startsWith(targetPath)) return false;

  if (isMobileDevice()) {
    window.location.replace(targetPath);
    return true;
  }

  return false;
};
