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

    getMoreInfoDialog() {
      const ha = document.querySelector("home-assistant");
      if (ha && ha.shadowRoot) {
        const dialog = ha.shadowRoot.querySelector("ha-more-info-dialog");
        if (dialog) return dialog;
      }
      return document.querySelector("ha-more-info-dialog");
    }

    findMenuInDialog(root, depth = 0) {
      if (!root || depth > 5) return null;
      let menu = root.querySelector("ha-button-menu, mwc-menu");
      if (menu) return menu;

      const children = root.querySelectorAll("*");
      for (let i = 0; i < children.length; i++) {
        if (children[i].shadowRoot) {
          menu = this.findMenuInDialog(children[i].shadowRoot, depth + 1);
          if (menu) return menu;
        }
      }
      return null;
    }

    checkAndInjectDialog() {
      const newHass = this.getHass();
      if (newHass) {
        this.hass = newHass;
        this.updateHassInCards();
      }

      const dialog = this.getMoreInfoDialog();

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
        this.injectHeaderControls(dialog);
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
                            shadow.querySelector("ha-dialog")?.querySelector(".content") ||
                            shadow.querySelector("ha-dialog") ||
                            shadow;
        contentArea.appendChild(container);
      }
      container.dataset.entityId = entityId;
      this.container = container;

      this.injectHeaderControls(dialog);
      await this.loadCards(entityId);
      this.render();
    }

    injectHeaderControls(dialog) {
      const shadow = dialog.shadowRoot;
      if (!shadow) return;

      const isAdmin = this.hass?.user ? this.hass.user.is_admin : false;
      if (!isAdmin) return;

      const iconName = this.editMode ? "mdi:pencil-off" : "mdi:pencil";
      const labelText = this.editMode ? "Bearbeitungsmodus verlassen" : "Bearbeitungsmodus";

      const buttonMenu = this.findMenuInDialog(shadow);

      if (buttonMenu) {
        let menuItem = buttonMenu.querySelector("#extended-popup-menu-item");
        if (!menuItem) {
          const itemTag = customElements.get("ha-menu-item") ? "ha-menu-item" : "ha-list-item";
          menuItem = document.createElement(itemTag);
          menuItem.id = "extended-popup-menu-item";
          menuItem.style.cssText = "cursor: pointer;";
          buttonMenu.appendChild(menuItem);
        }

        const isMenuItemTag = menuItem.tagName.toLowerCase() === "ha-menu-item";
        const iconSlot = isMenuItemTag ? "start" : "graphic";
        if (!isMenuItemTag) {
          menuItem.setAttribute("graphic", "icon");
        }

        menuItem.innerHTML = `<ha-icon icon="${iconName}" slot="${iconSlot}"></ha-icon>${labelText}`;
        menuItem.onclick = () => {
          this.toggleEditMode();
        };

        const existingBtn = shadow.querySelector("#extended-popup-edit-toggle");
        if (existingBtn) {
          existingBtn.remove();
        }
        return;
      }

      // Fallback: Inject edit button in dialog header action controls
      let editBtn = shadow.querySelector("#extended-popup-edit-toggle");

      if (!editBtn) {
        editBtn = document.createElement("ha-icon-button");
        editBtn.id = "extended-popup-edit-toggle";
        editBtn.setAttribute("slot", "actionItems");
        editBtn.style.cssText = "cursor: pointer; color: var(--primary-text-color); margin-left: 4px;";

        const iconEl = document.createElement("ha-icon");
        iconEl.id = "extended-popup-edit-icon";
        editBtn.appendChild(iconEl);

        const targetHeader = shadow.querySelector("[slot='actionItems']") ||
                             shadow.querySelector(".controls, .header") ||
                             shadow.querySelector("ha-dialog") ||
                             shadow;
        targetHeader.appendChild(editBtn);
      }

      const iconEl = editBtn.querySelector("#extended-popup-edit-icon") || editBtn;
      if (iconEl && iconEl !== editBtn) {
        iconEl.setAttribute("icon", iconName);
      } else {
        editBtn.setAttribute("icon", iconName);
      }
      editBtn.title = labelText;
      editBtn.onclick = () => {
        this.toggleEditMode();
      };
    }

    toggleEditMode() {
      this.editMode = !this.editMode;
      if (this.dialog) {
        this.injectHeaderControls(this.dialog);
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
        cardWrapper.style.cssText = "position: relative; border-radius: 12px; overflow: hidden;";

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

          const toolbar = document.createElement("div");
          toolbar.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: space-between;
            background: var(--secondary-background-color, #202020);
            padding: 4px 8px;
            border-bottom: 1px solid var(--divider-color, rgba(255, 255, 255, 0.1));
          `;

          const dragHandle = document.createElement("ha-icon");
          dragHandle.setAttribute("icon", "mdi:drag");
          dragHandle.title = "Ziehen zum Sortieren";
          dragHandle.style.cssText = "color: var(--primary-text-color); cursor: grab; padding: 4px;";
          toolbar.appendChild(dragHandle);

          const btnGroup = document.createElement("div");
          btnGroup.style.cssText = "display: flex; gap: 4px;";

          const editBtn = document.createElement("ha-icon-button");
          editBtn.setAttribute("icon", "mdi:pencil");
          editBtn.title = "Karte bearbeiten";
          editBtn.style.cssText = "--mdc-icon-size: 18px; cursor: pointer;";
          editBtn.onclick = (e) => {
            e.stopPropagation();
            this.openCardEditor(index);
          };
          btnGroup.appendChild(editBtn);

          const deleteBtn = document.createElement("ha-icon-button");
          deleteBtn.setAttribute("icon", "mdi:delete");
          deleteBtn.title = "Karte löschen";
          deleteBtn.style.cssText = "--mdc-icon-size: 18px; cursor: pointer;";
          deleteBtn.onclick = async (e) => {
            e.stopPropagation();
            this.cards.splice(index, 1);
            await this.saveCards();
            this.render();
          };
          btnGroup.appendChild(deleteBtn);

          toolbar.appendChild(btnGroup);
          cardWrapper.appendChild(toolbar);
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
