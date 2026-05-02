'use client';

import { useMemo } from 'react';

export default function ConnectGooglePage() {
  const status = useMemo(() => {
    if (typeof window === 'undefined') return undefined;
    const params = new URLSearchParams(window.location.search);
    return params.get('status') ?? undefined;
  }, []);

  const message =
    status === 'success'
      ? 'Google アカウントとの接続が完了しました。Slack から URAKATA3 に話しかけて確認してみてください。'
      : status === 'error'
      ? 'Google 接続中にエラーが発生しました。もう一度お試しください。'
      : 'Google アカウントとの接続状態を確認しています…';

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-8">
      <div className="max-w-lg w-full rounded-lg border border-gray-200 bg-white/80 p-6 shadow-sm">
        <h1 className="text-xl font-semibold mb-4">Google 接続</h1>
        <p className="text-sm text-gray-700 whitespace-pre-wrap">{message}</p>
      </div>
    </main>
  );
}