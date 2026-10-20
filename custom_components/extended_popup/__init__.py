"""The Extended Popup integration component."""
import logging
import os
from homeassistant.core import HomeAssistant
from homeassistant.helpers.typing import ConfigType
from homeassistant.helpers.storage import Store

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
        url_path = f"{URL_BASE}/homeassistant-extended-popup.js"

        # Modern Home Assistant (>= 2024.7): async_register_static_paths with StaticPathConfig
        if hasattr(hass.http, "async_register_static_paths"):
            try:
                from homeassistant.components.http import StaticPathConfig
                await hass.http.async_register_static_paths(
                    [StaticPathConfig(url_path, js_path, False)]
                )
            except Exception as err:
                _LOGGER.debug("Failed async_register_static_paths: %s", err)
        elif hasattr(hass.http, "register_static_path"):
            hass.http.register_static_path(url_path, js_path, cache_headers=False)

        try:
            from homeassistant.components.frontend import add_extra_js_url
            add_extra_js_url(hass, url_path)
        except Exception as err:
            _LOGGER.debug("Could not add_extra_js_url: %s", err)

    return True


async def async_setup_entry(hass: HomeAssistant, entry) -> bool:
    """Set up from a config entry."""
    return await async_setup(hass, {})


async def async_unload_entry(hass: HomeAssistant, entry) -> bool:
    """Unload a config entry."""
    return True
