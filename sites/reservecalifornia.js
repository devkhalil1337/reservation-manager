const SITE_KEY = 'reservecalifornia';
chrome.runtime.sendMessage({ siteKey: SITE_KEY });
let RM_CONFIG = {
    numberOfDays: 0,
    people: 1,
    vehicles: 0,
    trailerLength: 25,
    passType: '',
    passNumber: ''
};

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
        <span class="interface-title">RESERVATION MANAGER</span>
        <span class="interface-text"></span>
        <span class="interface-button">Click here to begin campsite selection.</span>
    `;

    interfaceStyles.textContent = `
        .reservation-manager-interface-wrapper {
            background: cornflowerblue;
            padding: 10px;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            z-index: 99999999;
        }
        .interface-title { font-weight: bold; display:none; }
        .interface-button { cursor:pointer; }
        .active { background:#41D9B3; }
    `;

    document.head.appendChild(interfaceStyles);
    document.body.appendChild(interfaceWrapper);

    rm.interfaceButton = interfaceWrapper.querySelector('.interface-button');
    rm.interfaceTitle = interfaceWrapper.querySelector('.interface-title');
    rm.interfaceText = interfaceWrapper.querySelector('.interface-text');

    rm.interfaceButton.addEventListener('click', () => {
        rm.interfaceButton.style.display = 'none';
        rm.interfaceTitle.style.display = 'inline';
        rm.interfaceText.textContent = 'Click campsite/day to watch';
        interfaceWrapper.classList.add('active');

        document.addEventListener('click', e => {
            const btn = e.target.closest('a.unit-slice');
            if (!btn) return;
            rm.selectCampsite(btn);
        });
    });
}


ReservationManager.prototype.selectCampsite = function (btn) {
    const title = btn.title;
    if (!title) return;

    // 🔥 Cancel previous watcher
    if (this.refreshTimer) {
        clearInterval(this.refreshTimer);
        this.refreshTimer = null;
    }

    this.finalized = false;
    this.activeKey = title;
    this.interfaceText.textContent = `${title} (Watching...)`;

    // If already available → finalize immediately
    if (btn.classList.contains('available-unit')) {
        this.finalizeBooking(btn);
        return;
    }

    // Otherwise watch with ONE interval
    this.refreshTimer = setInterval(() => {
        if (this.activeKey === title && !this.finalized) {
            this.handleRefresh();
        }
    }, 800);
};


ReservationManager.prototype.handleRefresh = function () {
    if (!this.activeKey || this.finalized) return;

    const btn = document.querySelector(
        `a.unit-slice[title^="${this.activeKey}"]`
    );

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
// Modified finalizeBooking method
ReservationManager.prototype.finalizeBooking = async function (btn) {
    if (this.finalized) return;

    this.finalized = true;
    this.activeKey = null;

    // Clear any existing refresh interval
    if (this.refreshTimer) {
        clearInterval(this.refreshTimer);
        this.refreshTimer = null;
    }

    console.log('[RM] Campsite available, booking started');
    this.interfaceText.textContent = 'Booking...';

    // Click on the campsite button to go to the checkout page
    // btn.click();

    await clickElement('#checkout-button', {
        wait: true,
        delayMs: 200
    });
    if (!this.checkoutStarted) {
        this.checkoutStarted = true;
        handleNextPage();
    }
    // Wait for the checkout button to be enabled (not disabled)
    // const checkoutBtn = await this.waitForEnabledCheckoutButton();
    // if (checkoutBtn) {
    //     checkoutBtn.click();
    //     setTimeout(() => {
    //         if (!this.checkoutStarted) {
    //             this.checkoutStarted = true;
    //             handleNextPage();
    //         }
    //     }, 0);
    //     // Proceed with filling out the next page
    // }
};

// Helper function to wait for the checkout button to be enabled using waitForElement
ReservationManager.prototype.waitForEnabledCheckoutButton = function () {
    return waitForElement('#checkout-button').then((checkoutBtn) => {
        return new Promise((resolve, reject) => {
            // Check if the checkout button is disabled
            const interval = setInterval(() => {
                if (!checkoutBtn.disabled) {
                    clearInterval(interval);  // Stop checking once it's enabled
                    resolve(checkoutBtn);
                }
            }, 500);  // Check every 500ms

            // Timeout in case button does not become enabled in a reasonable time
            setTimeout(() => {
                clearInterval(interval);
                reject('Checkout button not enabled within timeout period');
            }, 30000); // 30 seconds timeout (you can adjust this value)
        });
    });
};





// ================= Checkout form automation =================


async function handleNextPage() {
    console.log('[RM] Filling checkout form...');
    try {
        let checkoutDetailsPage = await waitForElement('.main_title');
        if (!checkoutDetailsPage) {
            checkoutDetailsPage = await waitForElement('.main_title');
        }
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
