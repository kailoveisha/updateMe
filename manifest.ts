import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Updateme',
    short_name: 'Updateme',
    description: 'A small private page for two.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f1f3ef',
    theme_color: '#f1f3ef',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
  };
}
