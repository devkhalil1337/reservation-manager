# Reservation Manager

**Reservation Manager** is a Chrome extension that automates campsite reservations for **ReserveCalifornia** and **Recreation.gov**. It watches campsites for availability, auto-fills booking details, and can automatically proceed to checkout. Each site has its own separate configuration.

---

## Features

* Supports **ReserveCalifornia** and **Recreation.gov**.
* Watches specific campsites for availability.
* Auto-fills reservation forms with pre-saved details.
* Separate configuration per site.
* Lightweight popup UI to set your preferences.
* Automatic handling of checkout steps.

---

## Installation

1. Clone or download this repository.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** in the top-right corner.
4. Click **Load unpacked** and select the folder containing the extension.
5. The extension should now appear in the toolbar.

---

## Usage

### Step 1: Set Your Preferences

1. Click the **Reservation Manager** extension icon in the Chrome toolbar.

2. Fill in the popup fields:

   * **Number of Days** – How many days to reserve.
   * **People** – Number of adults.
   * **Vehicles** – Number of vehicles.
   * **Trailer Length (ft)** – Trailer length, if applicable.
   * **Pass Type** – Senior lifetime or annual pass (if any).
   * **Pass Number** – Corresponding pass number.

3. Click **Save**. Your preferences will be stored separately for each website.

> ⚠️ Each website has its own configuration (`reservecalifornia` and `recreationgov`) and does not interfere with the other.

---

### Step 2: Start Watching Campsites

1. Open a campsite page on **ReserveCalifornia** or **Recreation.gov**.
2. Click the **“Click here to begin campsite selection”** button in the interface added to the page.
3. Click on the campsite(s) you want to watch.
4. The extension will periodically refresh availability.
5. When a campsite becomes available, it will automatically proceed to the checkout page and fill in your details.

---

## Configuration Storage

* Uses `chrome.storage.sync` to save settings.
* Stores data under separate keys for each site:

| Site              | Storage Key         |
| ----------------- | ------------------- |
| ReserveCalifornia | `reservecalifornia` |
| Recreation.gov    | `recreationgov`     |

---

## File Structure

```
reservation-manager/
├── manifest.json            # Chrome extension manifest
├── popup.html               # Popup UI for preferences
├── popup.js                 # Handles popup logic and storage
├── content.js               # Shared content script logic
├── sites/
│   ├── reservecalifornia.js # Site-specific automation for ReserveCalifornia
│   └── recreationGov.js     # Site-specific automation for Recreation.gov
├── README.md                # This file
```

---

## Manifest Details

* **Manifest Version:** 3
* **Permissions:** `storage`
* **Content Scripts:**

  * `sites/reservecalifornia.js` → Runs on `reservecalifornia.com`
  * `sites/recreationGov.js` → Runs on `recreation.gov`
  * `content.js` → Common script for both sites
* **Popup:** `popup.html`

---

## Technical Notes

* Uses `chrome.runtime.sendMessage` to communicate between content scripts and the popup.
* Automatically detects the active website and loads site-specific configuration.
* Handles intervals and prevents multiple `handleNextPage` executions.
* All form automation is site-specific and can be modified for new fields if the site updates.

---

## Contributing

1. Fork the repository.
2. Make changes to the corresponding site script (`reservecalifornia.js` or `recreationGov.js`) or `popup.js`.
3. Test thoroughly before submitting a pull request.

---

## Disclaimer

This extension **automates website interactions** and should be used responsibly. Do not abuse automation features; follow each site’s terms of service.

---

## License

MIT License – see `LICENSE` for details.

