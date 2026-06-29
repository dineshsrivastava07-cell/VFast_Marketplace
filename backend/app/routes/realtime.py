"""WebSocket realtime channel for the OMS live operations board.

A simple in-memory broadcaster: every WS client subscribes to /api/ws/oms
and receives JSON messages whenever an order state changes. Other modules
call `broadcast_order_event(...)` from inside their handlers.
"""
from __future__ import annotations

import asyncio
import json
import logging
from typing import Set

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

log = logging.getLogger("vfast.realtime")
router = APIRouter()

_clients: Set[WebSocket] = set()
_lock = asyncio.Lock()


async def broadcast_order_event(event: str, order: dict) -> None:
    """Fan-out a JSON message to every connected OMS client."""
    if not _clients:
        return
    payload = json.dumps({
        "event": event,
        "order_no": order.get("order_no"),
        "status": order.get("status"),
        "total": order.get("total"),
        "payment_method": order.get("payment_method"),
        "address": order.get("address"),
        "rider_id": order.get("rider_id"),
        "items_count": len(order.get("items", [])),
        "at": order.get("updated_at") or order.get("created_at"),
    })
    stale = []
    async with _lock:
        for ws in list(_clients):
            try:
                await ws.send_text(payload)
            except Exception:
                stale.append(ws)
        for ws in stale:
            _clients.discard(ws)


@router.websocket("/api/ws/oms")
async def oms_ws(websocket: WebSocket):
    await websocket.accept()
    async with _lock:
        _clients.add(websocket)
    log.info("OMS WS client connected (total=%d)", len(_clients))
    try:
        await websocket.send_text(json.dumps({"event": "hello", "clients": len(_clients)}))
        while True:
            # Keep the connection alive; we don't expect inbound messages.
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        log.warning("WS error: %s", exc)
    finally:
        async with _lock:
            _clients.discard(websocket)
        log.info("OMS WS client disconnected (total=%d)", len(_clients))
