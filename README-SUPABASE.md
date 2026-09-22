# اتصال کامل آکادمی به Supabase

## 1) دیتابیس
فایل `supabase-schema.sql` را کامل در Supabase > SQL Editor اجرا کنید.

## 2) مدیر
در Authentication > Users یک کاربر بسازید:
- Email: `admin@academy.local`
- Password: `123456`

سپس این SQL را اجرا کنید:

```sql
insert into public.admin_profiles(user_id)
select id from auth.users where email='admin@academy.local'
on conflict(user_id) do nothing;
```

## 3) ورزشکار و رمز ورود اختصاصی
برای ساخت حساب ورزشکار از Edge Function داخل این پروژه استفاده می‌شود. این روش باعث می‌شود رمز عبور در جدول سایت ذخیره نشود و Supabase Auth آن را مدیریت کند.

فایل:
`supabase/functions/admin-athlete/index.ts`

در Supabase Dashboard > Edge Functions یک Function با نام `admin-athlete` بسازید و محتوای همین فایل را قرار دهید، یا با Supabase CLI deploy کنید.

این Function فقط وقتی درخواست‌کننده مدیر واقعی باشد اجازه ساخت/حذف ورزشکار می‌دهد.

ورزشکار با این شکل وارد می‌شود:
- شماره موبایل خودش
- رمزی که مدیر هنگام ساخت حساب تعیین کرده است

سیستم داخلی ایمیل Supabase را به صورت `PHONE@academy.local` می‌سازد؛ کاربر لازم نیست ایمیل ببیند.

## 4) شهریه
برای هر ورزشکار این موارد در Supabase نگهداری می‌شود:
- مبلغ کل شهریه
- مبلغ پرداخت‌شده
- مبلغ باقی‌مانده
- تاریخ آخرین پرداخت
- تاریخچه پرداخت‌ها در جدول `payments`

مدیر از پنل ورزشکاران می‌تواند پرداخت جدید ثبت کند.

## 5) لوگو
لوگوی اصلی ثابت است و از پنل مدیر حذف شده است.
فایل `academy-logo.svg` لوگوی پیش‌فرض سایت است.

## 6) بنر
بنر همچنان از تنظیمات سایت قابل تغییر است. در نسخه فعلی مقدار `heroImageUrl` برای تصویر بنر استفاده می‌شود.

## 7) امنیت
کلید `service_role` هرگز نباید داخل `index.html` یا GitHub قرار بگیرد. فقط Edge Function روی سرور Supabase از آن استفاده می‌کند.
