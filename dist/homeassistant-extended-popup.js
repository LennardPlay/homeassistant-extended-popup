/**
 * Extended Entity Popup for Home Assistant
 * Native Lovelace Extension & HA Popup Enhancer
 */

(function () {
  console.log("Extended Entity Popup initialized");

  class ExtendedPopupManager {
    constructor() {
      this.editMode = false;
      this.cards = [];
      this.cardElements = [];
      this.currentEntityId = null;
      this.hass = null;
      this.dialog = null;
      this.container = null;
      this.draggedIndex = null;

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
      const newHass = this.getHass();
      if (newHass && this.hass !== newHass) {
        this.hass = newHass;
        this.updateHassInCards();
      }

      const dialog = document.querySelector("home-assistant")?.shadowRoot?.querySelector("ha-more-info-dialog") ||
                     document.querySelector("ha-more-info-dialog");

      if (!dialog) {
        if (this.currentEntityId !== null) {
          this.currentEntityId = null;
          this.editMode = false;
          this.container = null;
          this.cardElements = [];
        }
        return;
      }

      const isOpened = dialog.hasAttribute("open") || dialog.open || dialog.shadowRoot?.querySelector("ha-dialog")?.open;
      if (!isOpened) {
        if (this.currentEntityId !== null) {
          this.currentEntityId = null;
          this.editMode = false;
          this.container = null;
          this.cardElements = [];
        }
        return;
      }

      if (!this.hass) return;

      const entityId = dialog.entityId || dialog._entityId || dialog.stateObj?.entity_id;
      if (!entityId) return;

      const shadow = dialog.shadowRoot;
      if (!shadow) return;

      const container = shadow.querySelector("#extended-popup-container");
      if (this.currentEntityId !== entityId || !container || container.dataset.entityId !== entityId) {
        this.dialog = dialog;
        this.currentEntityId = entityId;
        this.setupDialogInjection(dialog, entityId);
      } else {
        this.injectMenuButton(dialog);
      }
    }

    updateHassInCards() {
      if (!this.hass || !this.cardElements) return;
      for (const cardEl of this.cardElements) {
        if (cardEl) {
          cardEl.hass = this.hass;
        }
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

        const contentArea = shadow.querySelector(".content") ||
                            shadow.querySelector("ha-dialog") ||
                            shadow.querySelector("mwc-dialog") ||
                            shadow;
        contentArea.appendChild(container);
      }
      container.dataset.entityId = entityId;
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

      const buttonMenu = shadow.querySelector("ha-button-menu") ||
                         shadow.querySelector("mwc-menu") ||
                         shadow.querySelector("ha-dialog")?.querySelector("ha-button-menu") ||
                         shadow.querySelector(".header")?.querySelector("ha-button-menu");

      if (buttonMenu) {
        let menuItem = buttonMenu.querySelector("#extended-popup-menu-item");
        if (!menuItem) {
          menuItem = document.createElement("ha-list-item");
          menuItem.id = "extended-popup-menu-item";
          menuItem.setAttribute("graphic", "icon");
          menuItem.style.cssText = "cursor: pointer;";
          buttonMenu.appendChild(menuItem);
        }

        const iconName = this.editMode ? "mdi:pencil-off" : "mdi:pencil";
        const labelText = this.editMode ? "Bearbeitungsmodus verlassen" : "Bearbeitungsmodus";

        menuItem.innerHTML = `<ha-icon icon="${iconName}" slot="graphic"></ha-icon>${labelText}`;
        menuItem.onclick = (e) => {
          e.stopPropagation();
          this.toggleEditMode();
        };
      }
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
      this.cardElements = [];

      const helpers = window.loadCardHelpers ? await window.loadCardHelpers() : null;

      for (let index = 0; index < this.cards.length; index++) {
        const cardConfig = this.cards[index];
        const cardWrapper = document.createElement("div");
        cardWrapper.className = "extended-popup-card-wrapper";
        cardWrapper.style.cssText = "position: relative; border-radius: 12px; transition: transform 0.15s ease, box-shadow 0.15s ease;";

        if (this.editMode) {
          cardWrapper.draggable = true;
          cardWrapper.dataset.index = index;

          cardWrapper.addEventListener("dragstart", (e) => {
            this.draggedIndex = index;
            e.dataTransfer.effectAllowed = "move";
            cardWrapper.style.opacity = "0.5";
          });

          cardWrapper.addEventListener("dragend", () => {
            cardWrapper.style.opacity = "1.0";
            this.draggedIndex = null;
          });

          cardWrapper.addEventListener("dragover", (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
          });

          cardWrapper.addEventListener("drop", async (e) => {
            e.preventDefault();
            if (this.draggedIndex === null || this.draggedIndex === index) return;
            const movedCard = this.cards.splice(this.draggedIndex, 1)[0];
            this.cards.splice(index, 0, movedCard);
            this.draggedIndex = null;
            await this.saveCards();
            this.render();
          });
        }

        if (helpers) {
          try {
            const cardEl = await helpers.createCardElement(cardConfig);
            cardEl.hass = this.hass;
            this.cardElements.push(cardEl);
            cardWrapper.appendChild(cardEl);
          } catch (e) {
            console.error("Failed to create card element:", e);
          }
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
            align-items: center;
            gap: 4px;
            padding: 4px;
            z-index: 10;
          `;

          const dragHandle = document.createElement("ha-icon");
          dragHandle.setAttribute("icon", "mdi:drag");
          dragHandle.title = "Ziehen zum Sortieren";
          dragHandle.style.cssText = "color: white; cursor: grab; padding: 4px;";
          toolbar.appendChild(dragHandle);

          const editBtn = document.createElement("ha-icon-button");
          editBtn.setAttribute("icon", "mdi:pencil");
          editBtn.title = "Karte bearbeiten";
          editBtn.style.cssText = "color: white; --mdc-icon-size: 18px; cursor: pointer;";
          editBtn.onclick = (e) => {
            e.stopPropagation();
            this.openCardEditor(index);
          };
          toolbar.appendChild(editBtn);

          const deleteBtn = document.createElement("ha-icon-button");
          deleteBtn.setAttribute("icon", "mdi:delete");
          deleteBtn.title = "Karte löschen";
          deleteBtn.style.cssText = "color: white; --mdc-icon-size: 18px; cursor: pointer;";
          deleteBtn.onclick = async (e) => {
            e.stopPropagation();
            this.cards.splice(index, 1);
            await this.saveCards();
            this.render();
          };
          toolbar.appendChild(deleteBtn);

          cardWrapper.appendChild(toolbar);
        }

        this.container.appendChild(cardWrapper);
      }

      if (this.editMode) {
        const addCardBtn = document.createElement("ha-button");
        addCardBtn.setAttribute("outlined", "");
        addCardBtn.style.cssText = "width: 100%; margin-top: 8px; cursor: pointer;";
        addCardBtn.innerHTML = "<ha-icon icon='mdi:plus' slot='icon'></ha-icon> Karte hinzufügen";
        addCardBtn.onclick = () => this.openCardPicker();
        this.container.appendChild(addCardBtn);
      }
    }

    openCardPicker() {
      const lovelaceCtx = {
        config: { views: [] },
        editMode: true,
        saveConfig: () => {},
      };

      const event = new CustomEvent("show-dialog", {
        bubbles: true,
        composed: true,
        detail: {
          dialogTag: "hui-dialog-create-card",
          dialogParams: {
            lovelace: lovelaceCtx,
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
      const lovelaceCtx = {
        config: { views: [] },
        editMode: true,
        saveConfig: () => {},
      };

      const event = new CustomEvent("show-dialog", {
        bubbles: true,
        composed: true,
        detail: {
          dialogTag: "hui-dialog-edit-card",
          dialogParams: {
            lovelace: lovelaceCtx,
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
