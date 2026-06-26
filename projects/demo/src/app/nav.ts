/** Sidebar navigation model for the docs site. Each item maps to a route. */
export interface NavItem {
  path: string;
  label: string;
}
export interface NavGroup {
  title: string;
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  {
    title: 'Overview',
    items: [
      { path: '', label: 'Playground' },
      { path: 'getting-started', label: 'Getting started' },
      { path: 'configuration', label: 'Configuration' },
    ],
  },
  {
    title: 'Capabilities',
    items: [
      { path: 'editing-tools', label: 'Editing tools' },
      { path: 'workflow', label: 'Canvas & workflow' },
      { path: 'export', label: 'Export' },
    ],
  },
  {
    title: 'Reference',
    items: [{ path: 'reference', label: 'Integration & API' }],
  },
];
