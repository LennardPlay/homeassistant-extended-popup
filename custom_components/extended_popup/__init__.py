"""The Extended Popup integration component."""
import logging
import os
from homeassistant.core import HomeAssistant
from homeassistant.config_entries import ConfigEntry
from homeassistant.helpers.typing import ConfigType
from homeassistant.helpers.storage import Store
from homeassistant.components.frontend import add_extra_js_url

from .const import DOMAIN, STORAGE_KEY, STORAGE_VERSION
from .websocket_api import async_setup_websocket_api

_LOGGER = logging.getLogger(__name__)

URL_BASE = "/extended_popup"


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Set up the Extended Popup component."""
    store = Store(hass, STORAGE_VERSION, STORAGE_KEY)
    hass.data[DOMAIN] = {
        "store": store,
    }

    async_setup_websocket_api(hass)

    # Register static path for custom frontend card module
    js_path = os.path.join(os.path.dirname(__file__), "frontend", "homeassistant-extended-popup.js")
    if os.path.exists(js_path):
        hass.http.register_static_path(
            f"{URL_BASE}/homeassistant-extended-popup.js",
            js_path,
            cache_headers=False,
        )
        add_extra_js_url(hass, f"{URL_BASE}/homeassistant-extended-popup.js")

    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up from a config entry."""
    return await async_setup(hass, {})


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    return True
