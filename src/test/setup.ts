// Shared setup for all tests. Screen tests opt into a browser-like DOM with
// a `// @vitest-environment jsdom` comment; logic tests keep running in plain Node.
import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';

if (typeof window !== 'undefined') {
  // jsdom doesn't implement scrolling; the layout scrolls to the top on every page change.
  window.scrollTo = () => {};
}
