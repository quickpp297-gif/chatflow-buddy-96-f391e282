# Hostinger deploy — /uploads folder

`npm run build` se `dist/` banega. Use `dist/` ko Hostinger ke `public_html/test/` (aapka `bookskt.online/test`) me upload kar do.

`dist/` me ye cheezein **automatically** include hongi:

- `uploads.php`  → upload receiver
- `uploads/`     → empty folder, isi me files save hongi
- `uploads/.htaccess` → PHP execute block + cache headers

## Ek baar ki setup

1. Hostinger File Manager me `public_html/test/uploads/` folder ki **permissions 755** ya `775` rakho (writable by PHP).
2. PHP version 7.4+ hona chahiye (default Hostinger pe hota hai).
3. HTTPS on hona chahiye (WhatsApp Cloud API HTTP media accept nahi karta).

## Subdirectory deploy (IMPORTANT for `bookskt.online/test`)

Agar app `bookskt.online/test/` me daal rahe ho (root pe nahi), to build se pehle yeh karo:

```bash
VITE_BASE_PATH=/test/ npm run build
```

Isse `dist/` ke andar saare asset paths `/test/...` ho jaayenge aur `uploads.php` bhi sahi jagah call hoga (`/test/uploads.php`).

Agar app root domain pe (e.g. `bookskt.online/`) hai, to seedha `npm run build` chalao.

## Kaise kaam karta hai

- Lovable preview (`*.lovable.app`) ya `localhost` pe app chal raha ho → media Supabase storage me jaati hai (jaise pehle).
- Kisi aur domain (jaise `bookskt.online/test`) pe app khulta hai → frontend `POST /uploads.php` karta hai, file `uploads/{account_id}/outgoing/...` me save hoti hai, aur uska public URL WhatsApp ko bheja jaata hai.

## Test

Deploy ke baad chat me ek image bhejo. Hostinger File Manager me dekho: `public_html/test/uploads/<account-id>/outgoing/` me file dikhni chahiye.

## Notes

- **Incoming** WhatsApp media abhi bhi Supabase me jaati hai (aapne yahi choose kiya tha).
- Max upload size: 25 MB. Badalna ho to `uploads.php` me `25 * 1024 * 1024` change karo, plus Hostinger PHP `upload_max_filesize` / `post_max_size` bhi check karo.