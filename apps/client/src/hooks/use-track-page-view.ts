import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageView } from '@/lib/analytics';

/**
 * Hook to track page views when the location changes
 * This should be used in layout components to track navigation
 */
export function useTrackPageView() {
  const location = useLocation();
  
  useEffect(() => {
    // Extract page name from the path
    const pageName = getPageNameFromPath(location.pathname);
    
    // Track the page view
    trackPageView(pageName, {
      path: location.pathname,
      search: location.search,
      hash: location.hash,
    });
  }, [location]);
}

/**
 * Helper function to extract a readable page name from the URL path
 */
function getPageNameFromPath(path: string): string {
  // Remove leading and trailing slashes
  const cleanPath = path.replace(/^\/|\/$/g, '');
  
  // Handle empty path (home)
  if (!cleanPath) return 'Home';
  
  // Handle special cases
  if (cleanPath === 'home') return 'Home';
  if (cleanPath.startsWith('s/')) {
    // Space pages
    const parts = cleanPath.split('/');
    if (parts.length === 2) return `Space: ${parts[1]}`;
    if (parts.length >= 4 && parts[2] === 'p') return `Page: ${parts[3]}`;
    return 'Space Page';
  }
  if (cleanPath.startsWith('p/')) {
    // Direct page access
    return `Page: ${cleanPath.substring(2)}`;
  }
  if (cleanPath.startsWith('settings/')) {
    // Settings pages
    return `Settings: ${cleanPath.substring(9)}`;
  }
  if (cleanPath.startsWith('share/')) {
    // Shared pages
    return 'Shared Page';
  }
  
  // Default: capitalize each part of the path
  return cleanPath
    .split('/')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' - ');
}
