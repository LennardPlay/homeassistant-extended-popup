"""WebSocket API for Extended Popup integration."""
import logging
import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.storage import Store

from .const import DOMAIN, STORAGE_KEY, STORAGE_VERSION

_LOGGER = logging.getLogger(__name__)

WS_TYPE_GET_CARDS = "extended_popup/get_cards"
WS_TYPE_SAVE_CARDS = "extended_popup/save_cards"

SCHEMA_WS_GET_CARDS = websocket_api.BASE_COMMAND_MESSAGE_SCHEMA.extend(
    {
        vol.Required("type"): WS_TYPE_GET_CARDS,
        vol.Required("entity_id"): cv.string,
    }
)

SCHEMA_WS_SAVE_CARDS = websocket_api.BASE_COMMAND_MESSAGE_SCHEMA.extend(
    {
        vol.Required("type"): WS_TYPE_SAVE_CARDS,
        vol.Required("entity_id"): cv.string,
        vol.Required("cards"): cv.ensure_list,
    }
)


@callback
def async_setup_websocket_api(hass: HomeAssistant) -> None:
    """Register WebSocket API commands."""
    websocket_api.async_register_command(hass, ws_get_cards)
    websocket_api.async_register_command(hass, ws_save_cards)


@websocket_api.websocket_command(SCHEMA_WS_GET_CARDS)
@websocket_api.async_response
async def ws_get_cards(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """Handle get cards command."""
    entity_id = msg["entity_id"]
    store: Store = hass.data[DOMAIN]["store"]
    data = await store.async_load() or {}
    cards = data.get(entity_id, [])
    connection.send_result(msg["id"], {"cards": cards})


@websocket_api.websocket_command(SCHEMA_WS_SAVE_CARDS)
@websocket_api.async_response
async def ws_save_cards(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """Handle save cards command."""
    if not connection.user or not connection.user.is_admin:
        connection.send_error(
            msg["id"],
            websocket_api.ERR_UNAUTHORIZED,
            "Only admin users can modify popup cards.",
        )
        return

    entity_id = msg["entity_id"]
    cards = msg["cards"]

    store: Store = hass.data[DOMAIN]["store"]
    data = await store.async_load() or {}
    if cards:
        data[entity_id] = cards
    else:
        data.pop(entity_id, None)

    await store.async_save(data)
    connection.send_result(msg["id"], {"success": True})
