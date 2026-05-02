export default function ConnectGooglePage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const status = searchParams.status;

  return (
    <main>
      <section>
        <h1>Google 接続</h1>
        <p className="muted">
          Slack user ID をつけてアクセスしてください。例:
          <code>/api/google/oauth/start?slackUserId=U12345678</code>
        </p>
        {status === 'success' ? (
          <p className="ok">Google 接続が完了しました。</p>
        ) : null}
      </section>

      <section>
        <h2>メモ</h2>
        <p>
          本番ではこのページに Slack OAuth 後の本人確認や、接続済みスコープ表示を追加してください。
        </p>
      </section>
    </main>
  );
}