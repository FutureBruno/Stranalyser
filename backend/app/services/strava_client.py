import time
from datetime import datetime, timezone
from typing import Any

import httpx

from app.config import settings
from app.models.athlete import Athlete


class StravaAPIError(Exception):
    def __init__(self, status_code: int, message: str):
        self.status_code = status_code
        super().__init__(f"Strava API error {status_code}: {message}")


class StravaClient:
    def __init__(self, athlete: Athlete):
        self.athlete = athlete

    def get_authorization_url(self) -> str:
        params = {
            "client_id": settings.strava_client_id,
            "redirect_uri": settings.strava_redirect_uri,
            "response_type": "code",
            "approval_prompt": "auto",
            "scope": "read,activity:read_all",
        }
        query = "&".join(f"{k}={v}" for k, v in params.items())
        return f"{settings.strava_auth_url}?{query}"

    async def _get_fresh_token(self) -> str:
        """Return valid access token, refreshing if needed."""
        expires_at = self.athlete.token_expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)

        now = datetime.now(tz=timezone.utc)
        if (expires_at - now).total_seconds() < 300:
            await self._refresh_token()
        return self.athlete.access_token

    async def _refresh_token(self) -> None:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                settings.strava_token_url,
                data={
                    "client_id": settings.strava_client_id,
                    "client_secret": settings.strava_client_secret,
                    "grant_type": "refresh_token",
                    "refresh_token": self.athlete.refresh_token,
                },
            )
            if resp.status_code != 200:
                raise StravaAPIError(resp.status_code, resp.text)
            data = resp.json()
            self.athlete.access_token = data["access_token"]
            self.athlete.refresh_token = data["refresh_token"]
            self.athlete.token_expires_at = datetime.fromtimestamp(
                data["expires_at"], tz=timezone.utc
            )

    async def _get(self, path: str, params: dict | None = None) -> Any:
        token = await self._get_fresh_token()
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(
                f"{settings.strava_api_base}{path}",
                headers={"Authorization": f"Bearer {token}"},
                params=params or {},
            )
            if resp.status_code == 429:
                raise StravaAPIError(429, "Rate limit exceeded")
            if resp.status_code != 200:
                raise StravaAPIError(resp.status_code, resp.text)
            return resp.json()

    async def get_athlete(self) -> dict:
        return await self._get("/athlete")

    async def list_activities(self, page: int = 1, per_page: int = 200, after: int | None = None) -> list[dict]:
        params: dict = {"page": page, "per_page": per_page}
        if after:
            params["after"] = after
        return await self._get("/athlete/activities", params)

    async def get_activity(self, activity_id: int) -> dict:
        return await self._get(f"/activities/{activity_id}")

    async def get_streams(self, activity_id: int) -> dict:
        keys = "latlng,altitude,heartrate,distance,velocity_smooth,time,cadence,watts"
        return await self._get(
            f"/activities/{activity_id}/streams",
            {"keys": keys, "key_by_type": "true"},
        )


async def exchange_code(code: str) -> dict:
    """Exchange OAuth authorization code for tokens + athlete data."""
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            settings.strava_token_url,
            data={
                "client_id": settings.strava_client_id,
                "client_secret": settings.strava_client_secret,
                "code": code,
                "grant_type": "authorization_code",
            },
        )
        if resp.status_code != 200:
            raise StravaAPIError(resp.status_code, resp.text)
        return resp.json()


def get_authorization_url() -> str:
    params = {
        "client_id": settings.strava_client_id,
        "redirect_uri": settings.strava_redirect_uri,
        "response_type": "code",
        "approval_prompt": "auto",
        "scope": "read,activity:read_all",
    }
    query = "&".join(f"{k}={v}" for k, v in params.items())
    return f"{settings.strava_auth_url}?{query}"
