# آکادمی فرید — GitHub Pages + Supabase

این نسخه برای اجرای مستقیم روی GitHub Pages آماده شده است.

## 1) ساخت مدیر
در Supabase:
Authentication → Users → Add user

Email:
`admin@academy.local`

Password:
`123456`

## 2) Anonymous Sign-Ins
در:
Authentication → Providers

گزینه Anonymous Sign-Ins را روشن کن.

## 3) اجرای SQL
فایل `supabase-schema.sql` را کامل در:
SQL Editor → New query
قرار بده و Run کن.

بعد از ساخت کاربر مدیر، این SQL را اجرا کن:

```sql
insert into public.admin_profiles (user_id)
select id from auth.users
where email = 'admin@academy.local'
on conflict (user_id) do nothing;
```

## 4) لوگو و بنر
بعد از ورود مدیر:
پنل مربی → مدیریت محتوای سایت

برای لوگو و بنر می‌توانی مستقیماً از کامپیوتر فایل انتخاب کنی.
فایل‌ها در Storage Bucket به نام `site-media` ذخیره می‌شوند.

## 5) پیام‌ها
ورزشکار با Anonymous Auth وارد می‌شود.
پیام او در جدول `messages` ذخیره می‌شود.
هر ورزشکار فقط پیام‌های خودش را می‌بیند.
مدیر می‌تواند همه پیام‌ها را ببیند و پاسخ بدهد.

## 6) کلید Supabase
Publishable key داخل `index.html` قرار دارد.
هرگز `service_role` key را داخل HTML یا GitHub قرار نده.

## 7) موبایل
مشکل overflow و نمایش کدهای `${...}` در نسخه قبلی اصلاح شده است.
Header، Hero، فرم‌ها، پنل ورزشکار و پیام‌ها برای صفحه‌های کوچک سخت‌گیری بیشتری روی عرض دارند.
