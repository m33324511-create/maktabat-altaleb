# إعداد Supabase - تم التنفيذ

تم تجهيز وربط الموقع مع مشروع Supabase.

## الإعدادات المطلوبة في Supabase
- جدول `public.books` موجود ومتاح للقراءة العامة عبر RLS policy.
- Storage bucket باسم `books` ومضبوط Public.
- Edge Function باسم `upload-book` تم نشرها.
- Verify JWT للدالة `upload-book` مضبوط على OFF.
- Secret باسم `UPLOAD_PASSWORD` موجود في Edge Functions Secrets.

## ما يحتاجه الموقع
الملف `index.html` يحتوي فقط على رابط المشروع وPublishable Key اللازمة للقراءة والاتصال بالدالة.

لا تضع أبدًا `service_role` key أو قيمة `UPLOAD_PASSWORD` داخل ملفات الموقع.
