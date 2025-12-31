# Quick Reference Card

## 🚀 Essential Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Install dependencies
npm install

# Clear cache and reinstall
rm -rf node_modules package-lock.json && npm install
```

## 🔑 Environment Variables

```bash
# Required in .env file
VITE_GEMINI_API_KEY=your_actual_api_key_here
```

**Get API Key:** https://aistudio.google.com/app/apikey

## 📊 System Limits

- **Job Descriptions:** Max 10 per session
- **Resumes:** Max 25 per session
- **Batch Upload:** Max 100 files at once
- **File Formats:** PDF, DOC, DOCX

## 🎯 Matching Thresholds

| Skills Match % | Result |
|---------------|---------|
| 80-100% | Highly Qualified |
| 50-79% | Qualified |
| 0-49% | Not Qualified |

**Experience:** Candidate ≥ Required = Qualified

## 🔗 Important URLs

- **Local Dev:** http://localhost:8080
- **Supabase URL:** https://pjwdugunungwndjykwus.supabase.co
- **Gemini AI Studio:** https://aistudio.google.com

## 🗄️ Database Quick Access

```sql
-- Check user profile
SELECT * FROM profiles WHERE email = 'your@email.com';

-- View recent history
SELECT * FROM parsing_history 
ORDER BY created_at DESC LIMIT 5;

-- Check user role
SELECT p.email, ur.role 
FROM profiles p 
JOIN user_roles ur ON ur.user_id = p.id;
```

## 🐛 Common Errors & Fixes

### "API key not valid"
→ Update `.env` with real Gemini API key
→ Restart dev server

### "409 Conflict"
→ Profile missing - auto-fixed by trigger
→ Check: `SELECT * FROM profiles;`

### "History not showing"
→ Wait 5 seconds (auto-refresh)
→ Or refresh page manually

### "Parsing failed"
→ Check internet connection
→ Verify file format (PDF/DOCX)
→ Try smaller files

## 📞 Support Contacts

- **Documentation:** See README.md
- **Technical Details:** See TECHNICAL_DOCUMENTATION.md
- **Issue Reporting:** Contact system admin

## ⚡ Quick Start (New Developer)

```bash
# 1. Clone and setup
git clone <repo-url>
cd mazoparser-main
npm install

# 2. Configure environment
echo "VITE_GEMINI_API_KEY=your_key_here" > .env

# 3. Start development
npm run dev

# 4. Open browser
# Navigate to http://localhost:8080
```

## 🔐 Security Notes

- ✅ Use `anon` key (not `service_role`) in client
- ✅ RLS enabled on all tables
- ✅ API keys in environment variables
- ✅ JWT authentication required

## 📦 Key Dependencies

```json
{
  "react": "^18.x",
  "@supabase/supabase-js": "^2.x",
  "pdf-parse": "^1.x",
  "mammoth": "^1.x",
  "xlsx": "^0.18.x",
  "@tanstack/react-query": "^5.x"
}
```

## 🎨 UI Components Location

- **File Upload:** `src/components/FileUpload.tsx`
- **History View:** `src/components/ParsingHistory.tsx`
- **Main Page:** `src/pages/Index.tsx`
- **Parser Logic:** `src/components/DocumentParser.tsx`

## 💾 Storage Structure

```
Browser LocalStorage:
├── sb-<project>-auth-token (JWT)
└── user session data

Database:
├── profiles (user data)
├── user_roles (permissions)
└── parsing_history (reports)
```

---

**Tip:** Bookmark this page for quick access to common tasks and troubleshooting!

