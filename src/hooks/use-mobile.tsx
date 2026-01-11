import * as React from "react";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    // Check for touch capability (works for iPad, tablets, phones)
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
    // Also check screen width for small devices
    const isSmallScreen = window.innerWidth < MOBILE_BREAKPOINT;
    
    // Consider it "mobile" if it's a touch device OR small screen
    const checkMobile = () => {
      const touchCapable = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const smallScreen = window.innerWidth < MOBILE_BREAKPOINT;
      setIsMobile(touchCapable || smallScreen);
    };

    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    mql.addEventListener("change", checkMobile);
    checkMobile();
    
    return () => mql.removeEventListener("change", checkMobile);
  }, []);

  return !!isMobile;
}
