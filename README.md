# Home Assistant Extended Entity Popup

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://github.com/hacs/default)

A Home Assistant extension and custom component that allows you to add custom Lovelace cards to entity popups (more-info dialogs).

## Features

- **Custom Popup Cards:** Add one or multiple custom Lovelace cards underneath the main entity control popup.
- **Admin Edit Mode:** Admins can toggle Edit Mode directly in the popup, add new cards, edit existing cards, or delete cards.
- **Persistent Storage:** Card configurations are stored centrally on Home Assistant (`.storage/extended_popup_cards`), ensuring all devices and users see the exact same layout.
- **Role-based Access:** Non-admin users can view and interact with the added cards, while editing is strictly restricted to Admins.

## Installation

### Via HACS
1. Open HACS in Home Assistant.
2. Add this repository as a Custom Repository (Category: Integration or Lovelace).
3. Install **Extended Entity Popup**.
4. Restart Home Assistant.

## Usage

1. Open any entity dialog / popup in Home Assistant.
2. As an Admin, click the edit button (pencil icon) in the popup header.
3. Click **"+ Add card"** to enter card configuration in JSON format.
4. Toggle edit mode off once finished.
