# Hostinger deploy — /uploads folder (no Supabase Storage)

`npm run build` se `dist/` banega. Use `dist/` ko Hostinger ke `public_html/test/` (aapka `bookskt.online/test`) me upload kar do.

`dist/` me ye cheezein **automatically** include hongi:

- `uploads.php`  → upload receiver
- `uploads/`     → empty folder, isi me files save hongi
- `uploads/.htaccess` → PHP execute block + cache headers

## Ek baar ki setup

1. Hostinger File Manager me `public_html/test/uploads/` folder ki **permissions 755** ya `775` rakho (writable by PHP).
2. PHP version 7.4+ hona chahiye (default Hostinger pe hota hai).
3. HTTPS on hona chahiye (WhatsApp Cloud API HTTP media accept nahi karta).
4. **Shared secret file banao** (incoming media ke liye):
   - File: `public_html/test/uploads_secret.txt`
   - Content: **exactly same value** jo aapne Lovable me `UPLOADS_SECRET` secret me set kiya hai.
   - Permissions 600 ya 644 — `public/.htaccess` isse HTTP se download hone se rokta hai.
5. Lovable secrets check karo:
   - `UPLOADS_BASE_URL` = `https://bookskt.online/test` (no trailing slash)
   - `UPLOADS_SECRET` = same string jo `uploads_secret.txt` me hai

## Subdirectory deploy (IMPORTANT for `bookskt.online/test`)

Agar app `bookskt.online/test/` me daal rahe ho (root pe nahi), to build se pehle yeh karo:

```bash
VITE_BASE_PATH=/test/ npm run build
```

Isse `dist/` ke andar saare asset paths `/test/...` ho jaayenge aur `uploads.php` bhi sahi jagah call hoga (`/test/uploads.php`).

Agar app root domain pe (e.g. `bookskt.online/`) hai, to seedha `npm run build` chalao.

## Kaise kaam karta hai

- **Outgoing** (browser se bheji gayi media): frontend `POST /uploads.php` karta hai. File `uploads/{account_id}/outgoing/...` me save hoti hai. Public URL WhatsApp ko jaata hai.
- **Incoming** (WhatsApp se aayi media): edge function (webhook) media download karke `POST /uploads.php` karta hai with `X-Upload-Secret` header. File `uploads/{account_id}/incoming/...` me save hoti hai.
- **Supabase Storage ab use nahi hota** — `whatsapp-media` bucket private ho gaya hai.

## Test

Deploy ke baad chat me ek image bhejo. Hostinger File Manager me dekho: `public_html/test/uploads/<account-id>/outgoing/` me file dikhni chahiye.

## Notes

- Max upload size: 25 MB. Badalna ho to `uploads.php` me `25 * 1024 * 1024` change karo, plus Hostinger PHP `upload_max_filesize` / `post_max_size` bhi check karo.
- Agar incoming media save nahi ho rahi → edge function logs me dekho `uploads.php 401` matlab `uploads_secret.txt` ka value Lovable wale `UPLOADS_SECRET` se match nahi kar raha.