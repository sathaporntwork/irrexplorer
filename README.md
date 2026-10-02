# IRR & RPKI Status Explorer (TypeScript + Vite)

เว็บแอปพลิเคชัน Standalone Client-side สำหรับตรวจสอบและวิเคราะห์สถานะ **IRR Route Objects** และ **RPKI ROA** ของ Autonomous System Number (ASN) แบบเรียลไทม์ พัฒนาด้วย **TypeScript + Vite** ในสไตล์ **iOS Liquid Glass & Pitch-Black Dark Aesthetic** สามารถนำไปโฮสต์บน **GitHub Pages** หรือ Static Web Hosting ใดๆ ได้ฟรี 100% โดยไม่ต้องพึ่งพา Backend

---

## 🌟 ฟีเจอร์หลัก (Key Features)

### 1. การตรวจสอบและดึงข้อมูลเครือข่าย (Network Auditing)
- ⚡ **Direct Client-Side Querying**: ยิงตรงไปยัง [NLNOG IRR Explorer API](https://irrexplorer.nlnog.net/) จากเบราว์เซอร์ของผู้ใช้โดยตรง (รองรับ CORS)
- 🔍 **Interactive ASN Search**: ค้นหาเลข ASN ใดๆ ได้อย่างอิสระ พร้อมระบบตรวจสอบและแปลงฟอร์แมต ASN อัตโนมัติ
- 📊 **Dynamic Metric Cards**: แสดงสถิติสรุปภาพรวม:
  - **Total Prefixes**: จำนวน Prefix ทั้งหมดที่ประกาศ
  - **IP Breakdown**: สัดส่วน IPv4 และ IPv6
  - **RPKI Validation Status**: สัดส่วนสถานะ **Valid**, **Not Found**, และ **Invalid** พร้อมคำนวณ % และ Progress Bar
- 🏷️ **Smart Filtering & Text Search**:
  - กรองข้อมูลด่วนด้วย Pill Chips (All, IPv4, IPv6, RPKI Valid, RPKI Not Found, RPKI Invalid, APNIC Valid)
  - ค้นหา Prefix หรือ IP เจาะจงแบบ Instant Real-Time Search
- ↕️ **Interactive Column Sorting & Pagination**:
  - เรียงลำดับข้อมูลตาม Prefix, IP Version, APNIC Status, หรือ RPKI Status (Ascending / Descending)
  - แบ่งหน้าการแสดงผล (Pagination) 50 รายการต่อหน้า พร้อมปุ่มเปลี่ยนหน้า
- 📋 **Deep RPSL Route Object Inspector**:
  - หน้าต่าง Modal แสดงรายละเอียดของแต่ละ Prefix (Origin AS, RPKI Status, APNIC Status)
  - กล่องแสดง RPSL Raw Record แบบเต็ม พร้อมปุ่ม Copy สำหรับนำไปใช้งานต่อ
- 💾 **Instant Data Export**: ส่งออกชุดข้อมูล Prefix ทั้งหมดออกเป็นไฟล์ **CSV** หรือ **JSON** ได้ในคลิกเดียว
- 🔗 **Direct URL Deep-linking**: รองรับการแชร์ลิงก์พร้อมระบุ ASN ใน URL query param เช่น `?asn=xxx`

### 2. ดีไซน์และประสบการณ์การใช้งาน (Modern Liquid Glass UI)
- 🖤 **Pitch-Black OLED Tone**: คุมโทนพื้นหลังสีดำสนิท (`#000000`) เหมาะสำหรับจอ OLED และถนอมสายตา
- 💎 **Deep Smoked Liquid Glass**: การ์ดและคอนโทรลเลอร์ตกแต่งด้วยกระจกรมดำ สันขอบสะท้อนแสงเงา (Specular Highlight) และ Inner Bevel Refraction
- 🌓 **Dark / Light Theme Toggle**: ปุ่มสลับโหมดมืดและสว่าง พร้อมบันทึกสถานะลงใน `localStorage`
- 🔮 **Iridescent Glass Loading Overlay**: หน้าต่างโหลดข้อมูลแบบ Floating Glass Orb พร้อมแสงเรือง Chromatic Halo และแถบ Capsule Progress Bar สไตล์ High-Tech
- ⏱️ **Live Clock Badge**: แสดงเวลาปัจจุบันแบบเรียลไทม์ฟอร์แมต `yyyy-mm-dd hh:ii:ss` บน Navbar
- 📱 **Compact & Responsive Design**: ปรับสเกลหน้าจอให้กะทัดรัด (Compact Dashboard) ใช้งานได้ทั้งบน Desktop, Tablet และ Mobile
- 🔒 **Privacy & Sanitization**: ไม่มีข้อมูล ASN หรือ IP จริงฝังในโค้ด ปลอดภัยและเป็นมิตรกับความเป็นส่วนตัว

---

## 🛠️ เทคโนโลยีที่ใช้ (Tech Stack)

- **Language**: [TypeScript](https://www.typescriptlang.org/) (Strict Type-Safety)
- **Bundler & Dev Server**: [Vite](https://vitejs.dev/)
- **Styling**: Vanilla CSS (Custom Design System with CSS Tokens & Glassmorphism)
- **Typography**: Inter & JetBrains Mono (Google Fonts)
- **API Source**: [NLNOG IRR Explorer API](https://irrexplorer.nlnog.net/)
- **Deployment**: [GitHub Actions](https://github.com/features/actions) + [GitHub Pages](https://pages.github.com/)

---

## 📁 โครงสร้างโปรเจกต์ (Project Structure)

```text
irrexplorer_api/
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Actions สำหรับ Build & Deploy Pages อัตโนมัติ
├── public/
│   ├── assets/
│   │   └── glass_loader_orb.jpg # แอสเซตลูกแก้ว Iridescent Loading Orb
│   ├── favicon.svg             # Favicon ประจำโปรเจกต์
│   └── icons.svg
├── src/
│   ├── api.ts                  # โมดูลยิง REST API ไปยัง NLNOG IRR Explorer
│   ├── types.ts                # TypeScript Interfaces & Data Models
│   ├── style.css               # สไตล์ชีท Liquid Glass & Pitch-Black UI
│   └── main.ts                 # ตรรกะการทำงานหลัก (DOM, Event Listeners, Filtering, Sorting)
├── index.html                  # โครงสร้างหน้าเว็บหลัก
├── package.json
├── tsconfig.json
├── vite.config.ts              # ตั้งค่า base: './' เพื่อรองรับ GitHub Pages
└── README.md
```

---

## 🚀 วิธีการติดตั้งและรันในเครื่อง (Local Development)

### ข้อกำหนดเบื้องต้น (Prerequisites)
- ติดตั้ง [Node.js](https://nodejs.org/) (เวอร์ชัน 18 ขึ้นไป)

### คำสั่งสำหรับรันโปรเจกต์
```bash
# 1. ติดตั้ง Dependencies
npm install

# 2. เริ่มต้นรันโหมด Development (Hot Module Replacement)
npm run dev

# 3. ตรวจสอบ Type และ Build สำหรับ Production
npm run build

# 4. พรีวิวโค้ดที่ Build แล้ว (dist/)
npm run preview
```

---

## 🌐 ขั้นตอนการ Deploy ขึ้น GitHub Pages

โปรเจกต์นี้ได้รับการตั้งค่า GitHub Actions Workflow ไว้ที่ [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) เรียบร้อยแล้ว

1. **สร้าง Git Repository และ Push โค้ดขึ้น GitHub**:
   ```bash
   git init
   git add .
   git commit -m "feat: IRR & RPKI explorer with pitch-black liquid glass UI"
   git branch -M main
   git remote add origin https://github.com/<YOUR_USERNAME>/<YOUR_REPO_NAME>.git
   git push -u origin main
   ```

2. **เปิดการใช้งาน GitHub Pages ใน Repository Settings**:
   - เปิดไปยังหน้า GitHub Repository ของคุณ
   - ไปที่แท็บ **Settings** > เมนู **Pages** (แถบเมนูด้านซ้าย)
   - ภายใต้หัวข้อ **Build and deployment**:
     - เลือก **Source** เป็น: 👉 **GitHub Actions**
   - เมื่อ Push โค้ดไปยัง Branch `main` ระบบจะทำการ Build และ Deploy ให้อัตโนมัติ
   - หน้าเว็บพร้อมใช้งานที่: `https://<YOUR_USERNAME>.github.io/<YOUR_REPO_NAME>/`

---

## ☁️ ขั้นตอนการ Deploy ขึ้น Cloudflare Pages

สาเหตุของ Error `video/mp2t` หรือ `404` เกิดจากการที่ Cloudflare ไม่ได้รันขั้นตอน `npm run build` ทำให้เสิร์ฟไฟล์ดิบ `.ts` จาก Root แทนที่จะเสิร์ฟโฟลเดอร์ผลลัพธ์ `dist/`

### วิธีที่ 1: Deploy ผ่าน Cloudflare Pages (เชื่อมต่อ Git Repository) - แนะนำ
1. ในหน้า Cloudflare Dashboard ไปที่ **Workers & Pages** > **Create application** > **Pages** > **Connect to Git**
2. เลือก Repository ของคุณ แล้วตั้งค่า **Build settings** ดังนี้:
   - **Framework preset**: `Vite` (หรือเลือก None)
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Root directory**: `/` (เว้นว่างไว้)
3. *(ตัวเลือกเสริม)* ในส่วน **Environment variables** กำหนด:
   - Variable name: `NODE_VERSION`
   - Value: `20` (หรือ `18`)
4. กด **Save and Deploy** ระบบจะทำการคอมไพล์ TypeScript เป็น JavaScript ใน `dist/` และให้บริการเว็บได้อย่างถูกต้อง

> **หากสร้าง Project บน Cloudflare Pages ไปแล้ว:**
> ให้ไปที่ **Settings** ของโปรเจกต์บน Cloudflare Pages > **Builds & deployments** > แก้ไข **Build command** เป็น `npm run build` และ **Build output directory** เป็น `dist` จากนั้นกด Save แล้วไปที่แท็บ **Deployments** > กด **Retry deployment**

---

### วิธีที่ 2: Deploy แบบ Direct Upload (ลากโฟลเดอร์อัปโหลด)
1. รันคำสั่ง Build ในเครื่องของคุณก่อน:
   ```bash
   npm run build
   ```
2. ใน Cloudflare Dashboard เลือก **Create application** > **Pages** > **Upload assets**
3. **สำคัญมาก**: ให้ลากโฟลเดอร์ **`dist`** (ที่ได้จากการ build) ไปวาง **ห้ามลากโฟลเดอร์ Root ของโปรเจกต์**

---

## 📄 ลิขสิทธิ์และการใช้งาน (License)

ซอฟต์แวร์นี้เผยแพร่ภายใต้ลิขสิทธิ์ [MIT License](LICENSE) สามารถนำไปใช้งาน ปรับแต่ง หรือพัฒนาต่อยอดได้อย่างอิสระ ข้อมูล IRR และ RPKI มาจาก [NLNOG IRR Explorer](https://irrexplorer.nlnog.net/)
