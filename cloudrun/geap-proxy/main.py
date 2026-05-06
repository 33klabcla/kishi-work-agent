"""
Cloud Run 上で動く薄い GEAP プロキシ。

- サービスアカウントキー不要（Cloud Run の Attached SA でメタデータサーバー経由認証）
- POST /query  : Vercel から呼ばれる。GEAP Reasoning Engine に転送して結果を返す。
- GET  /healthz: ヘルスチェック
"""
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel
import os
import requests

app = FastAPI(title="GEAP Proxy")


class QueryBody(BaseModel):
    message: str
    user_id: str | None = "anonymous"
    session_id: str | None = None


def get_access_token() -> str:
    """Cloud Run メタデータサーバーから OAuth2 アクセストークンを取得する。"""
    url = (
        "http://metadata.google.internal/computeMetadata/v1"
        "/instance/service-accounts/default/token"
    )
    r = requests.get(url, headers={"Metadata-Flavor": "Google"}, timeout=10)
    r.raise_for_status()
    return r.json()["access_token"]


@app.get("/healthz")
def healthz():
    return {"ok": True}


@app.post("/query")
def query(
    body: QueryBody,
    x_api_key: str | None = Header(default=None),
):
    # 簡易 API キー認証（PROXY_API_KEY 未設定の場合はスキップ）
    expected = os.environ.get("PROXY_API_KEY")
    if expected and x_api_key != expected:
        raise HTTPException(status_code=401, detail="Unauthorized")

    project_number = os.environ["GEAP_PROJECT_NUMBER"]
    location = os.environ.get("GEAP_LOCATION", "asia-northeast1")
    resource_id = os.environ["GEAP_RESOURCE_ID"]

    endpoint = (
        f"https://{location}-aiplatform.googleapis.com/v1beta1/"
        f"projects/{project_number}/locations/{location}/"
        f"reasoningEngines/{resource_id}:query"
    )

    token = get_access_token()

    payload = {
        "input": {
            "message": body.message,
            "user_id": body.user_id or "anonymous",
            "session_id": body.session_id or "session-cloudrun",
        }
    }

    r = requests.post(
        endpoint,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=60,
    )

    if not r.ok:
        raise HTTPException(status_code=r.status_code, detail=r.text)

    return r.json()
