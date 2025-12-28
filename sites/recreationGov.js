const SITE_KEY = 'recreationgov';
chrome.runtime.sendMessage({ siteKey: SITE_KEY });
let RM_CONFIG = {
    numberOfDays: 0,
    people: 1,
    vehicles: 0,
    trailerLength: 25,
    passType: '',
    passNumber: ''
};

if (chrome?.storage?.sync) {
    chrome.storage.sync.get(SITE_KEY, data => {
        RM_CONFIG = { ...RM_CONFIG, ...(data[SITE_KEY] || {}) };
        console.log('[RM] Loaded config:', RM_CONFIG);
    });
}


function runRecreationGov() {
    console.log('[RM] Recreation.gov detected');
    const rmContainer = document.querySelector('.reservation-manager-interface-wrapper');
    if (rmContainer) rmContainer.remove();
    new ReservationManager();
}

function normalizeAria(aria) {
    return aria.split(' is ')[0].split(' - Available')[0];
}

async function handleNextPage() {
    try {
        let groupSizeElement = await waitForElement('input.sarsa-text-field-input[name="numberField"]');
        if (!groupSizeElement) {
            groupSizeElement = await waitForElement('input.sarsa-text-field-input[name="numberField"]');
        }

        //Group size
        let groupSizeCount = groupSizeElement?.value;
        if (Number(groupSizeCount) == 0) {
            const peoplesLen = RM_CONFIG?.people || 1;
            for (let i = 0; i < peoplesLen; i++) {
                await clickElement('button[aria-label="Add people"]');
            }
        }

        let numberOfVehiclesElement = await waitForElement('input[id^="num_vehicles"]');
        if (!numberOfVehiclesElement) {
            numberOfVehiclesElement = await waitForElement('input[id^="num_vehicles"]');
        }

        let numberOfVehiclesCount = numberOfVehiclesElement?.value;
        if (Number(numberOfVehiclesCount) == 0) {
            const vehiclesLen = RM_CONFIG?.vehicles || 1;
            for (let i = 0; i < vehiclesLen; i++) {
                await clickElement('button[aria-label="Add Vehicles"]');
            }
        }

        // Camping Equipment
        //Vehicle Type - Trailer
        await setCheckbox('input[id^="equip_trailer_checkbox"]', true);
        //Trailer Length
        await typeIntoInput('input[id^="equip_trailer_length"]', '25');

        //Click Add a pass button
        await clickElement('.add-a-pass-btn');
        await selectDropdownValue('select[id^="pass_type"]', RM_CONFIG?.passType || 'Interagency Lifetime Senior Pass');
        await typeIntoInput('input[id^="pass_number"]', RM_CONFIG?.passNumber);
        await clickElement('#need-to-know-checkbox');
    } catch (e) {
        console.warn('Next page not loaded:', e);
    }
}

function selectDatesBasedOnDays(numberOfDays) {
    const row = document.querySelector('tr.row-selected');
    if (!row) {
        console.warn('No selected row found');
        return;
    }

    // Get all td elements (each representing a date) in the row
    const tdElements = row.querySelectorAll('td');

    // Find the start date (the td with the class "start")
    const startTd = row.querySelector('td.start');
    if (!startTd) {
        console.warn('No start date found');
        return;
    }

    // Get the index of the start date and start selecting from the next available td
    const startIndex = Array.from(tdElements).indexOf(startTd);

    // Number of days to select (minimum 2, maximum 7)
    if (numberOfDays < 2 || numberOfDays > 7) {
        console.warn('Number of days must be between 2 and 7');
        alert('Number of days must be between 2 and 7');
        return;
    }

    // Now we need to select consecutive available dates after the start date
    let selectedCount = 0;
    let lastSelectedDate = null; // Track the last selected date

    // Start selecting after the start date, skip first two reserved dates (starting from startIndex + 1)
    for (let i = startIndex + 1; i < tdElements.length && selectedCount < numberOfDays - 1; i++) {
        const td = tdElements[i];
        if (td.classList.contains('available')) {
            const button = td.querySelector('.rec-availability-date');
            if (button) {
                selectedCount++;
                lastSelectedDate = button; // Keep track of the last selected date
                console.log(`Selected date: ${button.getAttribute('aria-label')}`);
            }
        }
    }

    // Click on the last selected date
    if (selectedCount >= 1) {
        if (lastSelectedDate) {
            lastSelectedDate.click();
            console.log(`Clicked on the last selected date: ${lastSelectedDate.getAttribute('aria-label')}`);
        }
    } else {
        console.warn('Could not find the required number of available dates after the start date.');
    }
}

function ReservationManager() {
    const rm = this;
    rm.activeTarget = null;
    rm.refreshTimer = null;
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
        bottom: 0;
        padding: 10px;
        position: fixed;
        right: 0;
        left: 0;
        z-index: 99999999;
        box-shadow: 0 -4px 4px rgb(0 0 0 / 30%);
      }
      .interface-title { font-weight: bold; font-size: 18px; padding-right: 50px; display: none; }
      .interface-button { cursor: pointer; }
      .active { background: #41D9B3; }
    `;

    document.head.appendChild(interfaceStyles);
    document.body.appendChild(interfaceWrapper);

    rm.interfaceButton = interfaceWrapper.querySelector('.interface-button');
    rm.interfaceTitle = interfaceWrapper.querySelector('.interface-title');
    rm.interfaceTextEl = interfaceWrapper.querySelector('.interface-text');
    rm.interfaceContainer = interfaceWrapper;
    rm.interfaceButton.addEventListener('click', () => {
        rm.interfaceButton.style.display = 'none';
        rm.interfaceTitle.style.display = 'inline-block';
        rm.interfaceTextEl.textContent = 'Click the campsite/day you want to reserve.';
        rm.interfaceContainer.classList.add('active');

        rm.campsiteBtns = document.querySelectorAll('#availability-table .rec-full-button-wrap button');
        rm.btnRefresh = document.querySelector('.refresh-button');


        document.addEventListener('click', e => {
            const btn = e.target.closest(['.rec-availability-date', '#availability-table .rec-full-button-wrap button']
            );
            if (!btn) return;

            rm.selectCampsite({ currentTarget: btn });
        });


        rm.btnRefresh?.addEventListener('click', () => rm.handleRefresh());
    });
}

ReservationManager.prototype.selectCampsite = function (e) {
    const btn = e.currentTarget;
    const aria = btn.getAttribute('aria-label');
    const key = normalizeAria(aria);

    // Stop previous watcher
    if (this.refreshTimer) {
        clearInterval(this.refreshTimer);
        this.refreshTimer = null;
    }

    this.campsiteKey = key;
    this.activeTarget = key;
    this.interfaceTextEl.textContent = aria;

    if (aria.includes('Reserved')) {
        this.interfaceTextEl.textContent = `${key} (Watching...)`;

        this.refreshTimer = setInterval(() => {
            if (this.activeTarget === key) {
                this.handleRefresh();
            }
        }, 2500);
        return;
    }
    clearInterval(this.refreshTimer);
    this.refreshTimer = null;
    this.finalizeBooking(btn, aria);

};



ReservationManager.prototype.handleRefresh = function () {
    if (!this.campsiteKey || this.activeTarget !== this.campsiteKey) return;

    const btn = document.querySelector(
        `#availability-table button[aria-label^="${this.campsiteKey}"]`
    );

    if (!btn) {
        document.querySelector('.refresh-button')?.click();
        return;
    }

    const aria = btn.getAttribute('aria-label');

    if (aria.includes('Reserved')) {
        document.querySelector('.refresh-button')?.click();
        return;
    }

    // 🎉 Available → book
    this.finalizeBooking(btn, aria);
};


ReservationManager.prototype.finalizeBooking = async function (btn, aria) {
    if (this.refreshTimer) {
        clearInterval(this.refreshTimer);
        this.refreshTimer = null;
    }

    this.activeTarget = null;
    this.interfaceTextEl.textContent = `${aria} (Booking...)`;

    btn.click();
    // await delay(200)
    if (RM_CONFIG.numberOfDays > 1) {
        selectDatesBasedOnDays(RM_CONFIG.numberOfDays);
    }
    await delay(800)
    const bookBtn = document.querySelector(
        '.availability-grid-book-now-button-tracker'
    );

    if (!bookBtn) return;

    bookBtn.click();
    // ⏭️ wait for next page and automate it
    setTimeout(handleNextPage, 3000)
};