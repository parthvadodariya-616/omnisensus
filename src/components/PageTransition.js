'use client';
// Removed: The displayChildren swap caused a blank flash on every navigation.
// Solution: render children directly — CSS handles the fade via .route-shell animation.
export default function PageTransition({ children }) {
  return <div className="route-shell">{children}</div>;
}