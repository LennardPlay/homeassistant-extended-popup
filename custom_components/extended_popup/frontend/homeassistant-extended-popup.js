/**
 * Extended Entity Popup for Home Assistant
 * Custom Lovelace Resource & HA Extension
 */

(function () {
  console.log("Extended Entity Popup loaded");

  class ExtendedPopupManager {
    constructor() {
      this.editMode = false;
      this.cards = [];
      this.currentEntityId = null;
      this.hass = null;
      this.dialog = null;
      this.container = null;
      this.initObserver();
    }

    initObserver() {
      const observer = new MutationObserver(() => {
        this.checkAndInjectDialog();
      });
      observer.observe(document.body, { childList: true, subtree: true });
      this.checkAndInjectDialog();
    }

    getHass() {
      const ha = document.querySelector("home-assistant");
      return ha && ha.hass ? ha.hass : null;
    }

    checkAndInjectDialog() {
      const dialog = document.querySelector("home-assistant")?.shadowRoot?.querySelector("ha-more-info-dialog") ||
                     document.querySelector("ha-more-info-dialog");

      if (!dialog) return;

      // Ensure dialog is currently open
      const isOpened = dialog.hasAttribute("open") || dialog.open || dialog.shadowRoot?.querySelector("ha-dialog")?.open;
      if (!isOpened) return;

      this.hass = this.getHass();
      if (!this.hass) return;

      const entityId = dialog.entityId || dialog._entityId || dialog.stateObj?.entity_id;
      if (!entityId) return;

      const shadow = dialog.shadowRoot;
      if (!shadow) return;

      const container = shadow.querySelector("#extended-popup-container");
      if (this.currentEntityId !== entityId || !container) {
        this.dialog = dialog;
        this.currentEntityId = entityId;
        this.setupDialogInjection(dialog, entityId);
      }
    }

    async setupDialogInjection(dialog, entityId) {
      const shadow = dialog.shadowRoot;
      if (!shadow) return;

      let container = shadow.querySelector("#extended-popup-container");
      if (!container) {
        container = document.createElement("div");
        container.id = "extended-popup-container";
        container.style.cssText = "padding: 0 16px 16px 16px; display: flex; flex-direction: column; gap: 12px; margin-top: 12px;";

        const contentArea = shadow.querySelector(".content") || shadow.querySelector("ha-dialog") || shadow.querySelector("mwc-dialog") || shadow;
        contentArea.appendChild(container);
      }
      this.container = container;

      this.injectMenuButton(dialog);
      await this.loadCards(entityId);
      this.render();
    }

    injectMenuButton(dialog) {
      const shadow = dialog.shadowRoot;
      if (!shadow) return;

      const isAdmin = this.hass?.user?.is_admin;
      if (!isAdmin) return;

      let editBtn = shadow.querySelector("#extended-popup-edit-toggle");
      if (!editBtn) {
        editBtn = document.createElement("ha-icon-button");
        editBtn.id = "extended-popup-edit-toggle";
        editBtn.style.cssText = "cursor: pointer; --mdc-icon-size: 20px; color: var(--primary-text-color);";

        const headerContainer = shadow.querySelector(".controls") || shadow.querySelector(".header") || shadow.querySelector("[slot='title']")?.parentElement || shadow;
        if (headerContainer) {
          headerContainer.appendChild(editBtn);
        }
      }

      editBtn.icon = this.editMode ? "mdi:pencil-off" : "mdi:pencil";
      editBtn.title = this.editMode ? "Exit edit mode" : "Edit popup cards";
      editBtn.onclick = (e) => {
        e.stopPropagation();
        this.toggleEditMode();
      };
    }

    toggleEditMode() {
      this.editMode = !this.editMode;
      if (this.dialog) {
        this.injectMenuButton(this.dialog);
      }
      this.render();
    }

    async loadCards(entityId) {
      try {
        const res = await this.hass.callWS({
          type: "extended_popup/get_cards",
          entity_id: entityId,
        });
        this.cards = res.cards || [];
      } catch (err) {
        console.error("Failed to load extended popup cards:", err);
        this.cards = [];
      }
    }

    async saveCards() {
      try {
        await this.hass.callWS({
          type: "extended_popup/save_cards",
          entity_id: this.currentEntityId,
          cards: this.cards,
        });
      } catch (err) {
        console.error("Failed to save extended popup cards:", err);
      }
    }

    async render() {
      if (!this.container) return;
      this.container.innerHTML = "";

      const helpers = window.loadCardHelpers ? await window.loadCardHelpers() : null;

      for (let index = 0; index < this.cards.length; index++) {
        const cardConfig = this.cards[index];
        const cardWrapper = document.createElement("div");
        cardWrapper.className = "extended-popup-card-wrapper";
        cardWrapper.style.cssText = "position: relative; border-radius: 12px; overflow: hidden;";

        if (helpers) {
          const cardEl = await helpers.createCardElement(cardConfig);
          cardEl.hass = this.hass;
          cardWrapper.appendChild(cardEl);
        } else {
          const fallback = document.createElement("pre");
          fallback.textContent = JSON.stringify(cardConfig, null, 2);
          cardWrapper.appendChild(fallback);
        }

        if (this.editMode) {
          const toolbar = document.createElement("div");
          toolbar.style.cssText = `
            position: absolute;
            top: 8px;
            right: 8px;
            background: rgba(0, 0, 0, 0.75);
            border-radius: 8px;
            display: flex;
            gap: 4px;
            padding: 4px;
            z-index: 10;
          `;

          const editBtn = document.createElement("button");
          editBtn.innerHTML = "✏️";
          editBtn.title = "Edit card";
          editBtn.style.cssText = "background: none; border: none; color: white; cursor: pointer; font-size: 14px;";
          editBtn.onclick = () => this.openCardEditor(index);

          const deleteBtn = document.createElement("button");
          deleteBtn.innerHTML = "🗑️";
          deleteBtn.title = "Delete card";
          deleteBtn.style.cssText = "background: none; border: none; color: white; cursor: pointer; font-size: 14px;";
          deleteBtn.onclick = async () => {
            this.cards.splice(index, 1);
            await this.saveCards();
            this.render();
          };

          toolbar.appendChild(editBtn);
          toolbar.appendChild(deleteBtn);
          cardWrapper.appendChild(toolbar);
        }

        this.container.appendChild(cardWrapper);
      }

      if (this.editMode) {
        const addCardBtn = document.createElement("ha-button");
        addCardBtn.setAttribute("outlined", "");
        addCardBtn.style.cssText = "width: 100%; margin-top: 8px; cursor: pointer;";
        addCardBtn.innerHTML = "<ha-icon icon='mdi:plus'></ha-icon> Add card";
        addCardBtn.onclick = () => this.openCardPicker();
        this.container.appendChild(addCardBtn);
      }
    }

    openCardPicker() {
      const event = new CustomEvent("show-dialog", {
        bubbles: true,
        composed: true,
        detail: {
          dialogTag: "hui-dialog-create-card",
          dialogParams: {
            cardPicked: async (cardConfig) => {
              this.cards.push(cardConfig);
              await this.saveCards();
              this.render();
            },
            saveCard: async (newConfig) => {
              this.cards.push(newConfig);
              await this.saveCards();
              this.render();
            },
          },
        },
      });
      document.body.dispatchEvent(event);
    }

    openCardEditor(index) {
      const currentConfig = this.cards[index];
      const event = new CustomEvent("show-dialog", {
        bubbles: true,
        composed: true,
        detail: {
          dialogTag: "hui-dialog-edit-card",
          dialogParams: {
            cardConfig: currentConfig,
            saveCard: async (newConfig) => {
              this.cards[index] = newConfig;
              await this.saveCards();
              this.render();
            },
          },
        },
      });
      document.body.dispatchEvent(event);
    }
  }

  if (document.readyState === "complete" || document.readyState === "interactive") {
    new ExtendedPopupManager();
  } else {
    window.addEventListener("DOMContentLoaded", () => new ExtendedPopupManager());
  }
})();
