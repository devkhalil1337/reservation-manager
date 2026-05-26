const SITE_KEY = 'reservecalifornia';
const RC_SESSION_KEY = 'rm_rc_session';

chrome.runtime.sendMessage({ siteKey: SITE_KEY });

function loadSessionState() {
    try {
        const raw = sessionStorage.getItem(RC_SESSION_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function saveSessionState(state) {
    try {
        sessionStorage.setItem(RC_SESSION_KEY, JSON.stringify(state));
    } catch (e) {
        console.warn('[RM] Could not save session state:', e);
    }
}

function clearSessionState() {
    try {
        sessionStorage.removeItem(RC_SESSION_KEY);
    } catch { /* ignore */ }
}

function normalizeTitle(title) {
    return title.split(' - ')[0].trim();
}

function sliceSelectorForTitle(title) {
    const normalized = normalizeTitle(title);
    const escaped =
        typeof CSS !== 'undefined' && CSS.escape
            ? CSS.escape(normalized)
            : normalized.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return `a.unit-slice[title^="${escaped}"]`;
}
let RM_CONFIG = {
    numberOfDays: 0,
    people: 1,
    vehicles: 0,
    trailerLength: 25,
    passType: '',
    passNumber: ''
};

chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'sync') return;

    if (changes[SITE_KEY]) {
        console.log('[RM] Storage updated, reloading config...');
        RM_CONFIG = {
            ...RM_CONFIG,
            ...changes[SITE_KEY].newValue
        };
        console.log('[RM] Updated config:', RM_CONFIG);
    }
});


function loadFormData() {
    return new Promise(resolve => {
        if (chrome?.storage?.sync) {
            chrome.storage.sync.get(SITE_KEY, data => {
                RM_CONFIG = { ...RM_CONFIG, ...(data[SITE_KEY] || {}) };
                console.log('[RM] Loaded config:', RM_CONFIG);
                resolve(RM_CONFIG);
            });
        } else {
            resolve(RM_CONFIG);
        }
    });
}



async function reservecalifornia() {
    console.log('[RM] reservecalifornia.com detected');

    const rmContainer =
        document.querySelector('.reservation-manager-interface-wrapper');
    if (rmContainer) rmContainer.remove();
    await loadFormData();
    new ReservationManager();
}


function ReservationManager() {
    const rm = this;

    rm.activeKey = null;          // currently watched campsite
    rm.refreshTimer = null;       // single refresh loop
    rm.finalized = false;         // hard terminal state
    rm.checkoutStarted = false;


    const interfaceWrapper = document.createElement('div');
    const interfaceStyles = document.createElement('style');

    interfaceWrapper.className = 'reservation-manager-interface-wrapper';
    interfaceWrapper.innerHTML = `
        <span class="interface-button">Click here to begin campsite selection.</span>
        <span class="interface-title">RESERVATION MANAGER</span>
        <button type="button" class="interface-stop">Stop</button>
        <span class="interface-text"></span>
    `;

    interfaceStyles.textContent = `
        .reservation-manager-interface-wrapper {
            background: cornflowerblue;
            padding: 10px 12px;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            z-index: 99999999;
            display: flex;
            align-items: center;
            gap: 10px;
            box-sizing: border-box;
        }
        .interface-title {
            font-weight: bold;
            display: none;
            flex-shrink: 0;
        }
        .interface-button { cursor: pointer; flex-shrink: 0; }
        .interface-text {
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .reservation-manager-interface-wrapper.active .interface-text:not(:empty) {
            flex: 1;
        }
        .interface-stop {
            display: none;
            flex-shrink: 0;
            padding: 6px 16px;
            background: #c0392b;
            color: #fff !important;
            border: 2px solid #fff;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 700;
            line-height: 1.2;
            box-shadow: 0 1px 4px rgba(0,0,0,0.25);
        }
        .interface-stop.is-visible {
            display: inline-block;
        }
        .interface-stop:hover { background: #a93226; }
        .active { background:#41D9B3; }
        .active .interface-stop {
            border-color: #1a5c4a;
        }
        a.unit-slice.rm-watching {
            outline: 3px solid #e74c3c !important;
            outline-offset: 2px;
            border-radius: 3px;
            position: relative;
            z-index: 1;
            filter: brightness(0.85) sepia(0.4);
        }
    `;

    document.head.appendChild(interfaceStyles);
    document.body.appendChild(interfaceWrapper);

    rm.interfaceButton = interfaceWrapper.querySelector('.interface-button');
    rm.interfaceTitle = interfaceWrapper.querySelector('.interface-title');
    rm.interfaceText = interfaceWrapper.querySelector('.interface-text');
    rm.interfaceStop = interfaceWrapper.querySelector('.interface-stop');
    rm.interfaceWrapper = interfaceWrapper;
    rm.selectionModeActive = false;
    rm._restoreToken = 0;

    rm._onDocumentClick = (e) => {
        const btn = e.target.closest('a.unit-slice');
        if (!btn) return;
        rm.selectCampsite(btn);
    };

    rm.interfaceButton.addEventListener('click', () => rm.enableSelectionMode());
    rm.interfaceStop.addEventListener('click', (e) => {
        e.stopPropagation();
        rm.stopWatching();
    });

    rm.tryRestoreSession();
}

ReservationManager.prototype.persistWatchState = function () {
    saveSessionState({
        selectionStarted: this.selectionModeActive,
        activeKey: this.activeKey,
        watching: !!(this.activeKey && !this.finalized)
    });
};

ReservationManager.prototype.highlightWatchedSlot = function (key) {
    this.clearSlotHighlight();
    const btn = document.querySelector(sliceSelectorForTitle(key));
    if (btn) btn.classList.add('rm-watching');
};

ReservationManager.prototype.clearSlotHighlight = function () {
    document.querySelectorAll('a.unit-slice.rm-watching').forEach(el => {
        el.classList.remove('rm-watching');
    });
};

ReservationManager.prototype.showStopButton = function () {
    if (!this.activeKey || this.finalized) return;
    if (this.interfaceStop) {
        this.interfaceStop.style.display = '';
        this.interfaceStop.classList.add('is-visible');
    }
};

ReservationManager.prototype.hideStopButton = function () {
    if (this.interfaceStop) {
        this.interfaceStop.classList.remove('is-visible');
        this.interfaceStop.style.display = 'none';
    }
};

ReservationManager.prototype.stopWatching = function () {
    this._restoreToken++;

    if (this.refreshTimer) {
        clearInterval(this.refreshTimer);
        this.refreshTimer = null;
    }

    this.activeKey = null;
    this.finalized = false;
    clearSessionState();
    this.hideStopButton();
    this.clearSlotHighlight();
    this.interfaceText.textContent = 'Click campsite/day to watch';
    console.log('[RM] Stopped watching');
};

ReservationManager.prototype.enableSelectionMode = function () {
    if (this.selectionModeActive) return;

    this.selectionModeActive = true;
    this.interfaceButton.style.display = 'none';
    this.interfaceTitle.style.display = 'inline';
    this.interfaceText.textContent = 'Click campsite/day to watch';
    this.interfaceWrapper.classList.add('active');
    this.hideStopButton();

    if (!this._campsiteListenerAttached) {
        this._campsiteListenerAttached = true;
        document.addEventListener('click', this._onDocumentClick);
    }

    this.persistWatchState();
};

ReservationManager.prototype.startWatchInterval = function (watchKey) {
    if (!this.activeKey || this.activeKey !== watchKey || this.finalized) return;

    if (this.refreshTimer) {
        clearInterval(this.refreshTimer);
        this.refreshTimer = null;
    }

    this.showStopButton();

    this.handleRefresh();

    this.refreshTimer = setInterval(() => {
        if (this.activeKey === watchKey && !this.finalized) {
            this.handleRefresh();
        }
    }, 800);
};

ReservationManager.prototype.tryRestoreSession = function () {
    const state = loadSessionState();
    if (!state?.selectionStarted) return;

    this.enableSelectionMode();

    if (!state.watching || !state.activeKey) return;

    const title = normalizeTitle(state.activeKey);
    const restoreToken = this._restoreToken;

    this.activeKey = title;
    this.finalized = false;
    this.interfaceText.textContent = `${title} (Watching...)`;
    this.showStopButton();
    this.persistWatchState();

    const resumeWatch = () => {
        if (restoreToken !== this._restoreToken) return;
        if (!this.activeKey || this.activeKey !== title) return;

        const btn = document.querySelector(sliceSelectorForTitle(title));
        if (btn?.classList.contains('available-unit')) {
            this.finalizeBooking(btn);
            return;
        }
        this.highlightWatchedSlot(title);
        this.startWatchInterval(title);
    };

    waitForElement('a.unit-slice', 20000)
        .then(resumeWatch)
        .catch(() => {
            if (restoreToken !== this._restoreToken) return;
            if (!this.activeKey || this.activeKey !== title) return;
            console.warn('[RM] Grid not ready; resuming watch anyway');
            this.startWatchInterval(title);
        });
};


ReservationManager.prototype.selectCampsite = function (btn) {
    const title = btn.title;
    if (!title) return;

    // 🔥 Cancel previous watcher
    if (this.refreshTimer) {
        clearInterval(this.refreshTimer);
        this.refreshTimer = null;
    }

    if (!this.selectionModeActive) {
        this.enableSelectionMode();
    }

    this.finalized = false;
    this.activeKey = normalizeTitle(title);
    this.interfaceText.textContent = `${this.activeKey} (Watching...)`;
    this.persistWatchState();
    this.highlightWatchedSlot(this.activeKey);

    if (btn.classList.contains('available-unit')) {
        this.finalizeBooking(btn);
        return;
    }

    this.startWatchInterval(this.activeKey);
};


ReservationManager.prototype.handleRefresh = function () {
    if (!this.activeKey || this.finalized) return;

    const btn = document.querySelector(sliceSelectorForTitle(this.activeKey));

    if (!btn) {
        document.querySelector('.refresh-btn')?.click();
        return;
    }

    if (btn.classList.contains('available-unit')) {
        this.finalizeBooking(btn);
        return;
    }

    document.querySelector('.refresh-btn')?.click();
};

ReservationManager.prototype.finalizeBooking = async function (btn) {
    if (this.finalized) return;

    this.finalized = true;
    this.activeKey = null;
    clearSessionState();
    this.clearSlotHighlight();

    if (this.refreshTimer) {
        clearInterval(this.refreshTimer);
        this.refreshTimer = null;
    }

    console.log('[RM] Campsite available, booking started');
    this.interfaceText.textContent = 'Booking...';
    this.hideStopButton();

    btn.click();

    await clickElement('#checkout-button', {
        wait: true,
        delayMs: 200
    });
    if (!this.checkoutStarted) {
        this.checkoutStarted = true;
        handleNextPage();
    }
};


// ================= Checkout form automation =================


async function handleNextPage() {
    console.log('[RM] Filling checkout form...');
    try {
        await waitForElement('.main_title');
        await selectDropdownValue('#classification_dropdown', '61'); //Classification Regular/Senior Citizien
        await selectDropdownValue('#precart_Adults', '1'); //Adults
        await selectDropdownValue('#precart_Children', '0'); //Children
        await selectDropdownValue('#precart_camping', '74'); //Select Camping Unit
        await typeIntoInput('#precart_Occupant_Name', 'Don'); //Occupant Name
        await typeIntoInput('#discountPromoCode', ''); //Discount Promo Code
        await setCheckbox("#receiveCheckBox", true); //I agree to the above Terms and Conditions
        await setCheckbox("#extra_checkbox_163", true); //Please confirm your booking dates before finalizing your reservation.
        await clickElement('#precart_sumbit_btn'); //Reserve Unit
    } catch (e) {
        console.warn('[RM] Next page not loaded:', e);
        checkoutStarted = false; // optional reset if you want retries
    }
}
