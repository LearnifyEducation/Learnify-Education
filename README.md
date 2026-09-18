# Learnify Education — Inter Nation uslubidagi Full-Stack

Bu loyiha Inter Nation saytining umumiy axborot arxitekturasi va zamonaviy landing yo'nalishidan ilhomlangan, lekin Learnify brendi, matnlari va assetlari bilan qayta tuzilgan.

## Ishga tushirish
1. Node.js o'rnatilgan bo'lsin.
2. Terminalda loyiha papkasiga kiring.
3. `npm install`

> v3 qo‘shimchasi: vakansiya formasida PDF/DOC/DOCX rezyume yuklash mavjud.
4. `npm start`
5. `http://localhost:3000`

## Admin
- URL: `http://localhost:3000/admin`
- Login: `LearnifyEdu`
- Parol: ``

## Leadlar
Kontakt formasi `data/leads.json` ga yoziladi. Admin paneldan ko'rish, o'chirish va XLSX eksport qilish mumkin.

## Muhim
Production hostingdan oldin ADMIN_PASSWORD ni environment variable orqali o'zgartirish, HTTPS va server-side session storage qo'shish tavsiya qilinadi.


## Vakansiyalar
Vakansiya arizalari `data/vacancies.json` ga saqlanadi, rezyumelar `uploads/` papkasiga tushadi. Admin paneldan ko‘rish, rezyumeni ochish, o‘chirish va XLSX eksport qilish mumkin. Maksimal rezyume hajmi 5 MB.

## Avtomatik 3 til tahrirlash
Admin paneldagi **Sayt matnlarini tahrirlash** bo‘limida O‘zbekcha matnni o‘zgartirib saqlang. Server ruscha va inglizcha variantlarni avtomatik tarjima qilib `data/content.json` ga saqlaydi. Avtomatik tarjima uchun serverda internet ulanishi kerak (MyMemory translation service ishlatiladi). Agar tarjima xizmati vaqtincha ishlamasa, mavjud RU/EN matni saqlanib qoladi va admin panelda xato ko‘rsatiladi.
