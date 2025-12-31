# Mazo Beam Parser

A powerful resume-job description matching system that uses AI to parse documents and match candidates with job positions based on skills and experience.

## 🌟 Features

- **Intelligent Parsing**: Automatically extracts information from resumes and job descriptions
- **AI-Powered Matching**: Uses Google's Gemini AI for accurate document parsing
- **Skills Matching**: Advanced algorithm to match candidate skills with job requirements
- **Batch Processing**: Upload up to 10 job descriptions and 25 resumes simultaneously
- **Excel Reports**: Generate detailed matching reports in Excel format
- **History Tracking**: Save and review previous parsing sessions
- **User Management**: Admin panel for managing user access (admin users only)
- **Real-time Updates**: Automatic UI refresh with latest data

## 📋 Prerequisites

Before you begin, ensure you have:

- **Node.js** (v18 or higher)
- **npm** or **yarn**
- **Supabase Account** (for database and authentication)
- **Google Gemini API Key** (for document parsing)

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd mazoparser-main
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env` file in the project root:

```bash
# Gemini AI Configuration
VITE_GEMINI_API_KEY=your_gemini_api_key_here

# Get your Gemini API key from:
# https://aistudio.google.com/app/apikey
```

**Important:** Replace `your_gemini_api_key_here` with your actual Gemini API key.

### 4. Start the Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:8080`

## 📖 Usage Guide

### Step 1: Login

1. Open the application in your browser
2. Sign in with your credentials
3. If you're a new user, sign up first

### Step 2: Upload Job Descriptions

1. Click on **"Upload Job Descriptions"** section
2. Select PDF or DOCX files (up to 10 files)
3. Wait for parsing to complete
4. Currently uploaded count is displayed

### Step 3: Upload Resumes

1. Click on **"Upload Resumes"** section
2. Select PDF or DOCX files (up to 25 files)
3. Wait for parsing to complete
4. Currently uploaded count is displayed

### Step 4: Generate Report

1. Once both job descriptions and resumes are uploaded, the **"Generate Report"** button appears
2. Click the button to generate a matching report
3. An Excel file will be downloaded automatically
4. The report includes:
   - Candidate details (name, email, phone)
   - Skills matching percentage
   - Experience qualification status
   - Best matching position for each candidate

### Step 5: View History

1. Scroll to the **"Recent Reports"** section
2. View all previously generated reports
3. Click on any report to re-download it
4. Delete old reports using the trash icon

## 📊 Report Format

Generated reports include the following columns:

| Column | Description |
|--------|-------------|
| Sl No | Serial number |
| JD Name | Job description title |
| Resume Name | Original resume filename |
| Candidate Name | Extracted candidate name |
| Email | Candidate email address |
| Phone Number | Candidate phone number |
| Candidate Experience | Years of experience |
| JD Experience | Required years of experience |
| Candidate Skills | List of candidate skills |
| JD Skills | Required skills for the position |
| Skills Match % | Percentage of matching skills |
| Result Based on Skill | Qualified/Not Qualified based on skills |
| Result Based on Experience | Qualified/Not Qualified based on experience |

## 🎯 Matching Algorithm

### Skills Matching

The system uses a sophisticated multi-level matching algorithm:

1. **Exact Match**: Direct skill name matches
2. **Partial Match**: Multi-word skills with common components
3. **Substantial Match**: Skills that are substrings of each other
4. **Technology Equivalents**: Recognizes common variations (e.g., "React" = "React.js")

### Qualification Criteria

- **Skills**: 
  - 80-100%: Highly Qualified
  - 50-79%: Qualified
  - Below 50%: Not Qualified

- **Experience**:
  - Candidate experience ≥ Required experience: Qualified
  - Candidate experience < Required experience: Not Qualified

## 👥 User Roles

### Regular User
- Upload and parse documents
- Generate matching reports
- View own history

### Admin User
- All regular user features
- Access to User Management panel
- View and manage all users

## 🔧 Troubleshooting

### Common Issues

#### Issue: "API key not valid" Error

**Solution:**
1. Check your `.env` file has a valid Gemini API key
2. Get a new key from https://aistudio.google.com/app/apikey
3. Restart the development server after updating `.env`

#### Issue: Parsing Takes Too Long

**Solution:**
- Large files may take longer to process
- Ensure stable internet connection
- Try uploading fewer files at once

#### Issue: History Not Showing

**Solution:**
1. Check browser console for errors
2. Refresh the page
3. History auto-refreshes every 5 seconds

#### Issue: Cannot Upload Files

**Solution:**
- Ensure files are PDF or DOCX format
- Check file size (very large files may fail)
- Verify you haven't exceeded the upload limit (10 JDs, 25 resumes)

## 🛡️ Security Features

- **Row Level Security (RLS)**: Users can only access their own data
- **JWT Authentication**: Secure token-based authentication via Supabase
- **Environment Variables**: Sensitive keys stored securely
- **Input Validation**: File type and size validation

## 🔄 Updates and Maintenance

### Clearing Cache

If you experience issues after an update:
```bash
# Clear npm cache
npm cache clean --force

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Database Migrations

Database migrations are automatically applied. If you need to check migration status, refer to the technical documentation.

## 📝 File Format Support

### Supported Input Formats
- **PDF** (.pdf)
- **Microsoft Word** (.doc, .docx)

### Output Format
- **Microsoft Excel** (.xlsx)

## 🤝 Support

For issues, questions, or contributions:
1. Check the troubleshooting section
2. Review the technical documentation
3. Contact your system administrator

## 📄 License

[Your License Here]

## 🙏 Acknowledgments

- **Supabase**: Backend and authentication
- **Google Gemini AI**: Document parsing
- **React**: Frontend framework
- **Tailwind CSS**: Styling
- **shadcn/ui**: UI components

---

**Version:** 1.0.0  
**Last Updated:** December 31, 2025

For technical details, see [TECHNICAL_DOCUMENTATION.md](./TECHNICAL_DOCUMENTATION.md)

