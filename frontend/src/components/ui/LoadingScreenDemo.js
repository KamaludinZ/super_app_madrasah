import React, { useState } from 'react';
import LoadingScreen, { FullPageLoader, InlineLoader } from './LoadingScreen';
import { FullPageLoader as FullPageLoaderUpdated } from './page-loader';
import { Button } from './button';
import { Card, CardContent, CardHeader, CardTitle } from './card';

/**
 * Demo page untuk testing LoadingScreen component
 * Accessible di /demo/loading-screen (development only)
 */
export default function LoadingScreenDemo() {
  const [showFullPage, setShowFullPage] = useState(false);
  const [showUpdatedLoader, setShowUpdatedLoader] = useState(false);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-slate-900">Loading Screen Demo</h1>
        <p className="text-slate-600">Test semua variasi loading screen dengan logo dari settings</p>
      </div>

      {/* Full Page Loading Screen (Original) */}
      <Card>
        <CardHeader>
          <CardTitle>1. Full Page Loading Screen (Original LoadingScreen.js)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600">
            LoadingScreen component dengan logo dinamis dari settings.
            Menampilkan logo di tengah dengan spinner ring dan animasi dots.
          </p>
          <Button onClick={() => setShowFullPage(true)}>
            Show Full Page Loading
          </Button>
        </CardContent>
      </Card>

      {/* Updated Full Page Loader */}
      <Card>
        <CardHeader>
          <CardTitle>2. Updated FullPageLoader (page-loader.jsx)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600">
            Updated FullPageLoader yang digunakan di seluruh aplikasi.
            Fetch logo dari /api/app-info dan tampilkan dengan spinner.
          </p>
          <Button onClick={() => setShowUpdatedLoader(true)}>
            Show Updated Full Page Loader
          </Button>
        </CardContent>
      </Card>

      {/* Inline Loader */}
      <Card>
        <CardHeader>
          <CardTitle>3. Inline Loader</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600">
            Inline loader untuk digunakan di dalam komponen (bukan fullscreen).
          </p>
          <div className="border rounded-lg p-4 bg-slate-50">
            <InlineLoader message="Loading data..." />
          </div>
        </CardContent>
      </Card>

      {/* Inline Loader - No Spinner */}
      <Card>
        <CardHeader>
          <CardTitle>4. Inline Loader (No Spinner)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600">
            Inline loader tanpa spinner animation.
          </p>
          <div className="border rounded-lg p-4 bg-slate-50">
            <InlineLoader message="Processing..." showSpinner={false} />
          </div>
        </CardContent>
      </Card>

      {/* Usage Examples */}
      <Card>
        <CardHeader>
          <CardTitle>Usage Examples</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 text-sm">
            <div>
              <h3 className="font-semibold mb-2">1. Full Page Loading (Original)</h3>
              <pre className="bg-slate-900 text-slate-50 p-3 rounded overflow-x-auto">
{`import LoadingScreen from '@/components/ui/LoadingScreen';

<LoadingScreen message="Memuat data..." />`}
              </pre>
            </div>

            <div>
              <h3 className="font-semibold mb-2">2. Full Page Loader (Updated)</h3>
              <pre className="bg-slate-900 text-slate-50 p-3 rounded overflow-x-auto">
{`import { FullPageLoader } from '@/components/ui/page-loader';

if (loading) {
  return <FullPageLoader message="Memuat..." />;
}`}
              </pre>
            </div>

            <div>
              <h3 className="font-semibold mb-2">3. Inline Loader</h3>
              <pre className="bg-slate-900 text-slate-50 p-3 rounded overflow-x-auto">
{`import { InlineLoader } from '@/components/ui/LoadingScreen';

<InlineLoader message="Loading..." showSpinner={true} />`}
              </pre>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Conditional Renders */}
      {showFullPage && (
        <LoadingScreen
          message="Testing Full Page Loading Screen..."
          variant="full"
        />
      )}

      {showUpdatedLoader && (
        <FullPageLoaderUpdated message="Testing Updated FullPageLoader..." />
      )}

      {/* Close Buttons (appear after 2 seconds) */}
      {showFullPage && (
        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-[60]">
          <Button
            onClick={() => setShowFullPage(false)}
            variant="destructive"
            size="lg"
          >
            Close Full Page Loading
          </Button>
        </div>
      )}

      {showUpdatedLoader && (
        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-[60]">
          <Button
            onClick={() => setShowUpdatedLoader(false)}
            variant="destructive"
            size="lg"
          >
            Close Updated Loader
          </Button>
        </div>
      )}
    </div>
  );
}
