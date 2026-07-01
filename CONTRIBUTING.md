# Contributing

Werbl is intentionally narrow. It should stay focused on local image conversion,
clear privacy behavior, and formats the browser can actually produce.

Before opening a pull request, run:

```powershell
npm install
npm run setup:smoke
npm run check
```

Please avoid adding analytics, ad code, remote upload behavior, or broad new
permissions unless the change is clearly explained in the README and privacy
policy.
