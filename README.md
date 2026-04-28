# Cookie Inspector

Cookie Inspector is a browser extension designed to help developers and privacy-conscious users inspect, analyze, and manage cookies for the current web page.

## Features

- Domain Grouping: Automatically groups cookies by their domain for better organization.
- Detailed View: Expand any cookie to see full details including Value, Path, Expiry, Size, and SameSite policy.
- Flag Badges: Quick visual indicators for Secure, HttpOnly, HostOnly, and Session cookies.
- Export Functionality: Export all cookies or cookies from a specific domain to the clipboard or as a JSON file.
- Import Functionality: Import cookies from JSON text or a file to the browser.
- Real-time Count: Displays the total number of cookies detected on the current page.

## Installation

### Chrome Web Store

https://chromewebstore.google.com/detail/cookie-inspector/ogcjkhbnanmhlpmhopneiiackjdmonmi

### Firefox Browser Add-ons

https://addons.mozilla.org/en-US/firefox/addon/sheentee-cookie-inspector/

### Manual Installation

To install Cookie Inspector as a developer extension:

1. Clone or download this repository to your local machine.
2. Open your browser and navigate to the extensions management page:
   - For Chrome-based browsers: `chrome://extensions`
   - For Firefox: `about:debugging#/runtime/this-firefox` (Select "Load Temporary Add-on")
3. Enable "Developer mode" in the top right corner (Chrome-based browsers).
4. Click "Load unpacked" and select the root directory of this project.
5. The Cookie Inspector icon should now appear in your extension toolbar.

## License

This project is licensed under the Creative Commons 0 (CC0) 1.0 Universal license. See the [LICENSE](LICENSE) file for details.
