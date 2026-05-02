import Link from 'next/link';

export default function HomePage() {
  return (
    <main>
      <section>
        <h1>Kishi Work Agent</h1>
        <p className="muted">
          Slack + Vercel AI SDK + Gemini + Google Workspace OAuth を前提にした、
          安全重視の新規リポジトリ土台です。
        </p>
      </section>

      <section>
        <h2>含まれるもの</h2>
        <ul>
          <li>Slack Events API 受信</li>
          <li>Google OAuth 接続</li>
          <li>Gmail 検索 / 読み取り / draft 作成</li>
          <li>Google Calendar 当日予定取得</li>
          <li>Prisma + PostgreSQL</li>
          <li>監査ログ</li>
        </ul>
      </section>

      <section>
        <h2>接続</h2>
        <p>
          <Link href="/connect-google">Google 接続ページへ</Link>
        </p>
      </section>
    </main>
  );
}