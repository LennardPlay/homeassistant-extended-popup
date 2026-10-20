"""The Extended Popup integration component."""
import logging
import os
from homeassistant.core import HomeAssistant
from homeassistant.helpers.typing import ConfigType
from homeassistant.helpers.storage import Store

try:
    from .const import DOMAIN, STORAGE_KEY, STORAGE_VERSION
except ImportError:
    DOMAIN = "extended_popup"
    STORAGE_KEY = "extended_popup_cards"
    STORAGE_VERSION = 1

from .websocket_api import async_setup_websocket_api

_LOGGER = logging.getLogger(__name__)

URL_BASE = "/extended_popup"


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Set up the Extended Popup component."""
    if DOMAIN in hass.data:
        return True

    store = Store(hass, STORAGE_VERSION, STORAGE_KEY)
    hass.data[DOMAIN] = {
        "store": store,
    }

    async_setup_websocket_api(hass)

    # Register static path for custom frontend card module
    js_path = os.path.join(os.path.dirname(__file__), "frontend", "homeassistant-extended-popup.js")
    if os.path.exists(js_path):
        url_path = f"{URL_BASE}/homeassistant-extended-popup.js"

        try:
            from homeassistant.components.http import StaticPathConfig
            await hass.http.async_register_static_paths(
                [StaticPathConfig(url_path, js_path, False)]
            )
        except Exception as err:
            _LOGGER.error("Failed to register static path: %s", err)

        try:
            from homeassistant.components.frontend import add_extra_js_url
            add_extra_js_url(hass, url_path)
        except Exception as err:
            _LOGGER.error("Failed to add extra JS URL: %s", err)

    return True


async def async_setup_entry(hass: HomeAssistant, entry) -> bool:
    """Set up from a config entry."""
    return await async_setup(hass, {})


async def async_unload_entry(hass: HomeAssistant, entry) -> bool:
    """Unload a config entry."""
    return True
