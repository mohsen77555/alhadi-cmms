# Alhadi CMMS Android APK عبر GitHub Actions

هذه الحزمة تحول ملف React TSX إلى مشروع جاهز لبناء APK عبر GitHub Actions باستخدام Capacitor.

## النتيجة
بعد رفع الملفات إلى GitHub، سيبني GitHub ملف APK تلقائيًا:

`Alhadi-CMMS-debug-apk / app-debug.apk`

## مهم جدًا
ملف APK لا يحتوي على Backend داخله. إذا لم يكن لديك Backend منشور على رابط عام HTTPS، سيعمل التطبيق بوضع محلي مؤقت على الهاتف فقط، ولن تكون المزامنة بين المستخدمين متاحة.

لتفعيل Backend حقيقي، شغّل Workflow يدويًا وضع رابط API في خانة `api_url` مثل:

`https://your-domain.com/api`

## طريقة من الهاتف فقط باستخدام GitHub Codespaces

1. افتح المستودع في GitHub من المتصفح.
2. افتح Codespaces.
3. ارفع ملف ZIP هذا داخل Codespaces.
4. افتح Terminal وشغل هذا الأمر بعد تغيير اسم الملف إذا لزم:

```bash
rm -rf /tmp/cmms-apk && mkdir -p /tmp/cmms-apk && unzip alhadi-cmms-apk-github.zip -d /tmp/cmms-apk && cp -a /tmp/cmms-apk/alhadi-cmms-apk-github/. . && git add . && git commit -m "Add Android APK build" && git push
```

5. اذهب إلى تبويب Actions في GitHub.
6. افتح Workflow باسم `Build Android APK`.
7. بعد انتهاء البناء، انزل إلى Artifacts وحمّل `Alhadi-CMMS-debug-apk`.
8. فك الضغط وستجد `app-debug.apk`.

## طريقة تشغيل Workflow يدويًا مع رابط Backend

1. ادخل GitHub > Actions.
2. اختر `Build Android APK`.
3. اضغط `Run workflow`.
4. في خانة `api_url` اكتب رابط backend، مثال:

```txt
https://my-cmms-server.com/api
```

5. اضغط Run.
6. حمّل APK من Artifacts.

## ملاحظات أمنية
هذه نسخة Debug للتجربة. للنشر الرسمي في Google Play نحتاج build من نوع Release موقّع أو AAB.
